import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LayoutDashboard, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  BatchDeleteDialog,
  ListHeaderCheckbox,
  ListPageBatchActions,
  ListRowCheckbox,
  useListBatchMode,
} from "@/components/layout/list-batch-delete";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { runBatchDelete } from "@/lib/runBatchDelete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import {
  buildDashboardNameMap,
  useDashboardOptions,
} from "./DashboardPickerSelect";
import { UserViewFormDialog } from "./UserViewFormDialog";

type ViewRow = {
  id: string;
  name: string;
  dashboardId: string;
  layout?: Record<string, unknown>;
  isDefault?: boolean;
};

export function UserViewsSection() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingRow, setEditingRow] = useState<ViewRow | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const dashboardsQuery = useDashboardOptions();
  const dashboardMap = buildDashboardNameMap(dashboardsQuery.data?.items);

  const listQuery = useQuery({
    queryKey: ["users", "me", "views"],
    queryFn: () => apiFetch<{ items: ViewRow[] }>("/api/v1/users/me/views"),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["users", "me", "views"] });

  const createMutation = useMutation({
    mutationFn: (values: { name: string; dashboardId: string }) =>
      apiFetch("/api/v1/users/me/views", {
        method: "POST",
        body: JSON.stringify({ name: values.name, dashboardId: values.dashboardId, layout: {} }),
      }),
    onSuccess: () => {
      toast.success("个人视图已创建");
      setFormOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (row: ViewRow) =>
      apiFetch(`/api/v1/users/me/views/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: row.name,
          dashboardId: row.dashboardId,
          layout: row.layout ?? {},
          ...(row.isDefault !== undefined ? { isDefault: row.isDefault } : {}),
        }),
      }),
    onSuccess: () => {
      toast.success("已更新");
      setFormOpen(false);
      setEditingRow(null);
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/users/me/views/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("已删除");
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const setDefault = (target: ViewRow) => {
    updateMutation.mutate({ ...target, isDefault: true });
  };

  const openCreate = () => {
    setFormMode("create");
    setEditingRow(null);
    setFormOpen(true);
  };

  const openEdit = (row: ViewRow) => {
    setFormMode("edit");
    setEditingRow(row);
    setFormOpen(true);
  };

  const handleFormSubmit = (values: { name: string; dashboardId: string }) => {
    if (formMode === "create") {
      createMutation.mutate(values);
      return;
    }
    if (!editingRow) return;
    updateMutation.mutate({ ...editingRow, ...values });
  };

  const items = (listQuery.data?.items ?? []).slice(0, 20);
  const rowIds = useMemo(() => items.map((row) => row.id), [items]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const handleBatchDelete = async () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/users/me/views/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    selection.clear();
    invalidate();
    if (failed === 0) toast.success(`已删除 ${ok} 个个人视图`);
    else toast.warning(`已删除 ${ok} 个，${failed} 个删除失败`);
  };

  if (listQuery.isError) {
    return (
      <PageErrorBanner
        message={mapApiError(listQuery.error)}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  const formPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-title-sm">
          <LayoutDashboard className="size-4" aria-hidden />
          个人默认视图
        </CardTitle>
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          新建视图
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-theme-sm text-gray-600 dark:text-gray-400">
          配置登录后优先进入的仪表板。标记为「登录入口」的视图将优先于角色默认设置。
        </p>
        {listQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-800">
            <p className="text-theme-sm text-gray-600 dark:text-gray-400">
              尚未配置个人默认视图，将使用角色默认入口
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              创建第一个视图
            </Button>
          </div>
        ) : (
          <>
            <ListPageBatchActions
              batchMode={batch.batchMode}
              onToggleBatchMode={batch.toggleBatchMode}
              selectedCount={selection.selectedCount}
              entityLabel="个视图"
              onClear={selection.clear}
              onDelete={() => setBatchDeleteOpen(true)}
              className="mb-3"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  {batch.batchMode ? (
                    <TableHead className="w-10">
                      <ListHeaderCheckbox
                        checked={selection.allSelected}
                        indeterminate={selection.someSelected}
                        disabled={items.length === 0}
                        onCheckedChange={() => selection.toggleAll()}
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>名称</TableHead>
                  <TableHead>仪表板</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const dashboardName = dashboardMap.get(row.dashboardId);
                  return (
                    <TableRow key={row.id}>
                      {batch.batchMode ? (
                        <TableCell>
                          <ListRowCheckbox
                            checked={selection.isSelected(row.id)}
                            onCheckedChange={() => selection.toggle(row.id)}
                            ariaLabel={`选择视图 ${row.name}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{row.name}</span>
                          {row.isDefault ? (
                            <Badge variant="light" color="success" size="sm">
                              登录入口
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Link
                            to={`/admin/dashboards/${row.dashboardId}`}
                            className="inline-flex items-center gap-1 text-theme-sm text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {dashboardName ?? "未命名仪表板"}
                            <ExternalLink className="size-3.5" aria-hidden />
                          </Link>
                          <span className="font-mono text-theme-xs text-gray-500">
                            {row.dashboardId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`编辑视图 ${row.name}`}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={row.isDefault || updateMutation.isPending}
                            onClick={() => setDefault(row)}
                          >
                            设为登录入口
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                aria-label={`删除视图 ${row.name}`}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>删除个人视图？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  删除后将回落到角色默认仪表板。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(row.id)}>
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      <UserViewFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={{
          name: editingRow?.name ?? "",
          dashboardId: editingRow?.dashboardId ?? "",
        }}
        pending={formPending}
        onSubmit={handleFormSubmit}
      />

      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        count={selection.selectedCount}
        title="批量删除个人视图"
        description="删除后将回落到角色默认仪表板。"
        pending={batchDeleting}
        onConfirm={() => void handleBatchDelete()}
      />
    </Card>
  );
}
