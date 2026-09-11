import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BatchDeleteDialog,
  ListHeaderCheckbox,
  ListPageBatchActions,
  ListRowCheckbox,
  useListBatchMode,
  DESTRUCTIVE_ALERT_ACTION_CLASS,
} from "@/components/layout/list-batch-delete";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  DataTable,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
  RowActions,
} from "@/components/layout/list-page-kit";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { formatBatchDeleteToast, runBatchDelete } from "@/lib/runBatchDelete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { useListPagination } from "@/lib/list-pagination";
import { queryKeys } from "@/lib/queryKeys";
import { RlsRoleBindingPanel } from "./RlsRoleBindingPanel";
import { RlsColumnBindingsPanel } from "./RlsColumnBindingsPanel";
import { ColumnMasksPanel } from "./ColumnMasksPanel";
import { RlsDimensionValuesPanel } from "./RlsDimensionValuesPanel";
import type { DimensionGroupOut, DimensionTypeOut } from "./rls-types";
import { SystemAdminListHint } from "../SystemAdminListHint";
import { PageErrorBanner } from "@/components/ui/page-error-banner";

export function RlsAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("dimensions");
  const [dimOpen, setDimOpen] = useState(false);
  const [dimCode, setDimCode] = useState("");
  const [dimName, setDimName] = useState("");
  const [dimValueType, setDimValueType] = useState("string");
  const [editDim, setEditDim] = useState<DimensionTypeOut | null>(null);
  const [editDimName, setEditDimName] = useState("");
  const [editDimDesc, setEditDimDesc] = useState("");
  const [deleteDim, setDeleteDim] = useState<DimensionTypeOut | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupDimId, setGroupDimId] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [filterDimId, setFilterDimId] = useState<string>("__all__");
  const [editGroup, setEditGroup] = useState<DimensionGroupOut | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteGroup, setDeleteGroup] = useState<DimensionGroupOut | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [valuesGroup, setValuesGroup] = useState<DimensionGroupOut | null>(null);
  const [valuesText, setValuesText] = useState("");

  const dimPagination = useListPagination();
  const groupPagination = useListPagination(20, [filterDimId]);

  const dimensionsCatalogQuery = useQuery({
    queryKey: queryKeys.rls.dimensions({ limit: 500, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: DimensionTypeOut[]; total: number }>(
        "/api/v1/rls/dimensions?limit=500&offset=0",
      ),
  });

  const dimensionsQuery = useQuery({
    queryKey: queryKeys.rls.dimensions({
      limit: dimPagination.pageSize,
      offset: dimPagination.offset,
    }),
    queryFn: () => {
      const q = new URLSearchParams({
        limit: String(dimPagination.pageSize),
        offset: String(dimPagination.offset),
      });
      return apiFetch<{ items: DimensionTypeOut[]; total: number }>(
        `/api/v1/rls/dimensions?${q}`,
      );
    },
    enabled: tab === "dimensions",
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.rls.groups({
      dimensionTypeId: filterDimId === "__all__" ? undefined : filterDimId,
      limit: groupPagination.pageSize,
      offset: groupPagination.offset,
    }),
    queryFn: () => {
      const q = new URLSearchParams({
        limit: String(groupPagination.pageSize),
        offset: String(groupPagination.offset),
      });
      if (filterDimId !== "__all__") q.set("dimension_type_id", filterDimId);
      return apiFetch<{ items: DimensionGroupOut[]; total: number }>(
        `/api/v1/rls/groups?${q}`,
      );
    },
    enabled: tab === "groups",
  });

  const bindingsGroupsQuery = useQuery({
    queryKey: queryKeys.rls.groups({ limit: 500, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: DimensionGroupOut[]; total: number }>(
        "/api/v1/rls/groups?limit=500&offset=0",
      ),
    enabled: tab === "bindings",
  });

  const valuesQuery = useQuery({
    queryKey: ["rls", "group-values", valuesGroup?.id],
    queryFn: () =>
      apiFetch<{ items: string[] }>(`/api/v1/rls/groups/${valuesGroup!.id}/values`),
    enabled: Boolean(valuesGroup?.id),
  });

  useEffect(() => {
    if (valuesGroup && valuesQuery.data?.items) {
      setValuesText(valuesQuery.data.items.join("\n"));
    }
  }, [valuesGroup, valuesQuery.data]);

  const createDim = useMutation({
    mutationFn: (body: { code: string; name: string; value_type: string }) =>
      apiFetch("/api/v1/rls/dimensions", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      toast.success("维度类型已创建");
      setDimOpen(false);
      setDimCode("");
      setDimName("");
      await qc.invalidateQueries({ queryKey: ["rls", "dimensions"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const updateDim = useMutation({
    mutationFn: (body: { id: string; name: string; description: string | null }) =>
      apiFetch(`/api/v1/rls/dimensions/${body.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: body.name, description: body.description }),
      }),
    onSuccess: async () => {
      toast.success("维度类型已更新");
      setEditDim(null);
      await qc.invalidateQueries({ queryKey: ["rls", "dimensions"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const removeDim = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/rls/dimensions/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("维度类型已删除");
      setDeleteDim(null);
      await qc.invalidateQueries({ queryKey: ["rls", "dimensions"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const createGroup = useMutation({
    mutationFn: (body: { dimension_type_id: string; code: string; name: string }) =>
      apiFetch("/api/v1/rls/groups", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      toast.success("维度分组已创建");
      setGroupOpen(false);
      setGroupCode("");
      setGroupName("");
      await qc.invalidateQueries({ queryKey: ["rls", "groups"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const updateGroup = useMutation({
    mutationFn: (body: { id: string; name: string }) =>
      apiFetch(`/api/v1/rls/groups/${body.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: body.name }),
      }),
    onSuccess: async () => {
      toast.success("分组已更新");
      setEditGroup(null);
      await qc.invalidateQueries({ queryKey: ["rls", "groups"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const removeGroup = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/rls/groups/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("分组已删除");
      setDeleteGroup(null);
      await qc.invalidateQueries({ queryKey: ["rls", "groups"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const replaceValues = useMutation({
    mutationFn: (body: { id: string; values: string[] }) =>
      apiFetch(`/api/v1/rls/groups/${body.id}/values`, {
        method: "PUT",
        body: JSON.stringify({ values: body.values }),
      }),
    onSuccess: async () => {
      toast.success("分组成员值已更新");
      setValuesGroup(null);
      setValuesText("");
      await qc.invalidateQueries({ queryKey: ["rls", "group-values"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const openValues = (g: DimensionGroupOut) => {
    setValuesText("");
    setValuesGroup(g);
  };

  const dimensions = dimensionsCatalogQuery.data?.items ?? [];
  const dimensionItems = dimensionsQuery.data?.items ?? [];
  const dimensionTotal = dimensionsQuery.data?.total ?? 0;
  const groups = groupsQuery.data?.items ?? [];
  const groupTotal = groupsQuery.data?.total ?? 0;
  const bindingGroups = bindingsGroupsQuery.data?.items ?? [];
  const dimNameById = Object.fromEntries(dimensions.map((d) => [d.id, d.name]));
  const groupRowIds = useMemo(() => groups.map((g) => g.id), [groups]);
  const groupSelection = useListRowSelection(groupRowIds);
  const groupBatch = useListBatchMode(groupSelection.clear);
  const handleBatchDeleteGroups = async () => {
    const ids = [...groupSelection.selectedIds];
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed, failures } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/rls/groups/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    groupSelection.clear();
    await qc.invalidateQueries({ queryKey: ["rls", "groups"] });
    const toastMsg = formatBatchDeleteToast(ok, failed, failures, "维度分组");
    if (toastMsg.variant === "success") toast.success(toastMsg.message);
    else toast.warning(toastMsg.message);
  };

  return (
    <AdminPageShell
      layout="list"
      title="行级权限（高级）"
      description="按组织或自定义维度过滤查询结果，适用于细粒度数据范围控制。"
    >
      <ListPageSection>
        <SystemAdminListHint scope="rls" />
        {dimensionsCatalogQuery.isError ? (
          <div className="shrink-0 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
            <PageErrorBanner
              message={mapApiError(dimensionsCatalogQuery.error)}
              onRetry={() => void dimensionsCatalogQuery.refetch()}
            />
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="dimensions">维度类型</TabsTrigger>
              <TabsTrigger value="groups">维度分组</TabsTrigger>
              <TabsTrigger value="bindings">角色绑定</TabsTrigger>
              <TabsTrigger value="columns">列映射</TabsTrigger>
              <TabsTrigger value="masks">列脱敏</TabsTrigger>
            </TabsList>
            {tab === "dimensions" ? (
              <Button type="button" variant="primary" size="sm" onClick={() => setDimOpen(true)}>
                <Plus className="size-4" aria-hidden />
                新建维度
              </Button>
            ) : null}
            {tab === "groups" ? (
              <div className="flex flex-wrap items-center gap-3">
                <ListPageBatchActions
                  batchMode={groupBatch.batchMode}
                  onToggleBatchMode={groupBatch.toggleBatchMode}
                  selectedCount={groupSelection.selectedCount}
                  entityLabel="个分组"
                  onClear={groupSelection.clear}
                  onDelete={() => setBatchDeleteOpen(true)}
                />
                <Button type="button" variant="primary" size="sm" onClick={() => setGroupOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  新建分组
                </Button>
              </div>
            ) : null}
          </div>

        <TabsContent value="dimensions" className="mt-0 flex min-h-0 flex-1 flex-col">
          {dimensionsQuery.isError ? (
            <ListPageTableFrame className="px-0 py-3">
              <PageErrorBanner
                message={mapApiError(dimensionsQuery.error)}
                onRetry={() => void dimensionsQuery.refetch()}
              />
            </ListPageTableFrame>
          ) : (
            <>
              <ListPageTableFrame className="px-0">
                <DataTable
                  loading={dimensionsQuery.isLoading}
                  empty={!dimensionsQuery.isLoading && dimensionItems.length === 0}
                  lastColumnAlign="right"
                  headers={["名称", "编码", "值类型", "组织维度", "操作"]}
                  rows={dimensionItems.map((d) => [
                    <span key="n" className="font-medium text-gray-800 dark:text-white/90">
                      {d.name}
                    </span>,
                    <code
                      key="c"
                      className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300"
                    >
                      {d.code}
                    </code>,
                    d.value_type,
                    d.org_dimension ? (
                      <Badge key="o" variant="light" color="primary" size="sm">
                        是
                      </Badge>
                    ) : (
                      "否"
                    ),
                    <RowActions key="a">
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="编辑维度类型"
                        onClick={() => {
                          setEditDim(d);
                          setEditDimName(d.name);
                          setEditDimDesc(d.description ?? "");
                        }}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="删除维度类型"
                        className="text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
                        onClick={() => setDeleteDim(d)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </RowActions>,
                  ])}
                />
              </ListPageTableFrame>
              <ListPagePagination
                current={dimPagination.page}
                pageSize={dimPagination.pageSize}
                total={dimensionTotal}
                onChange={dimPagination.onPageChange}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ListPageToolbar
            filters={
              <div className="grid w-full gap-2 sm:max-w-xs">
                <Label>按维度类型筛选</Label>
                <Select value={filterDimId} onValueChange={setFilterDimId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部</SelectItem>
                    {dimensions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />
          {groupsQuery.isError ? (
            <ListPageTableFrame className="px-0 py-3">
              <PageErrorBanner
                message={mapApiError(groupsQuery.error)}
                onRetry={() => void groupsQuery.refetch()}
              />
            </ListPageTableFrame>
          ) : (
            <>
              <ListPageTableFrame className="px-0">
                <DataTable
                  loading={groupsQuery.isLoading}
                  empty={!groupsQuery.isLoading && groups.length === 0}
                  lastColumnAlign="right"
                  headers={[
                    ...(groupBatch.batchMode
                      ? [
                          <ListHeaderCheckbox
                            key="select-all"
                            checked={groupSelection.allSelected}
                            indeterminate={groupSelection.someSelected}
                            disabled={groups.length === 0}
                            onCheckedChange={() => groupSelection.toggleAll()}
                          />,
                        ]
                      : []),
                    "名称",
                    "编码",
                    "维度类型",
                    "操作",
                  ]}
                  rows={groups.map((g) => [
                    ...(groupBatch.batchMode
                      ? [
                          <ListRowCheckbox
                            key={`${g.id}-select`}
                            checked={groupSelection.isSelected(g.id)}
                            onCheckedChange={() => groupSelection.toggle(g.id)}
                            ariaLabel={`选择分组 ${g.name}`}
                          />,
                        ]
                      : []),
                    <span key="n" className="font-medium text-gray-800 dark:text-white/90">
                      {g.name}
                    </span>,
                    <code
                      key="c"
                      className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300"
                    >
                      {g.code}
                    </code>,
                    dimNameById[g.dimension_type_id] ?? (
                      <span key="d" className="font-mono text-theme-xs">
                        {g.dimension_type_id.slice(0, 8)}…
                      </span>
                    ),
                    <RowActions key="a">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openValues(g)}
                      >
                        成员值
                      </Button>
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="编辑分组"
                        onClick={() => {
                          setEditGroup(g);
                          setEditName(g.name);
                        }}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="删除分组"
                        className="text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
                        onClick={() => setDeleteGroup(g)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </RowActions>,
                  ])}
                />
              </ListPageTableFrame>
              <ListPagePagination
                current={groupPagination.page}
                pageSize={groupPagination.pageSize}
                total={groupTotal}
                onChange={groupPagination.onPageChange}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="bindings" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ListPageTableFrame className="space-y-4">
            <RlsRoleBindingPanel
              groups={bindingGroups}
              groupsLoading={bindingsGroupsQuery.isLoading}
            />
            <RlsDimensionValuesPanel dimensions={dimensions} />
          </ListPageTableFrame>
        </TabsContent>

        <TabsContent value="columns" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ListPageTableFrame>
            <RlsColumnBindingsPanel dimensions={dimensions} />
          </ListPageTableFrame>
        </TabsContent>

        <TabsContent value="masks" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ListPageTableFrame>
            <ColumnMasksPanel />
          </ListPageTableFrame>
        </TabsContent>
      </Tabs>
      </ListPageSection>

      <Dialog open={dimOpen} onOpenChange={setDimOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建维度类型</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dim-code">编码</Label>
              <Input id="dim-code" value={dimCode} onChange={(e) => setDimCode(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dim-name">名称</Label>
              <Input id="dim-name" value={dimName} onChange={(e) => setDimName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>值类型</Label>
              <Select value={dimValueType} onValueChange={setDimValueType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">字符串</SelectItem>
                  <SelectItem value="number">数值</SelectItem>
                  <SelectItem value="boolean">布尔</SelectItem>
                  <SelectItem value="org_ref">组织引用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDimOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!dimCode.trim() || !dimName.trim() || createDim.isPending}
              onClick={() =>
                createDim.mutate({
                  code: dimCode.trim(),
                  name: dimName.trim(),
                  value_type: dimValueType,
                })
              }
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editDim)}
        onOpenChange={(open) => {
          if (!open) setEditDim(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑维度类型</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>编码</Label>
              <Input value={editDim?.code ?? ""} readOnly disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-dim-name">名称</Label>
              <Input
                id="edit-dim-name"
                value={editDimName}
                onChange={(e) => setEditDimName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-dim-desc">描述</Label>
              <Textarea
                id="edit-dim-desc"
                value={editDimDesc}
                onChange={(e) => setEditDimDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditDim(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!editDim || !editDimName.trim() || updateDim.isPending}
              onClick={() =>
                editDim &&
                updateDim.mutate({
                  id: editDim.id,
                  name: editDimName.trim(),
                  description: editDimDesc.trim() || null,
                })
              }
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteDim)}
        onOpenChange={(open) => {
          if (!open) setDeleteDim(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除维度类型？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteDim?.name}」。若仍被分组或角色绑定引用，操作会失败。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction
              className={DESTRUCTIVE_ALERT_ACTION_CLASS}
              disabled={removeDim.isPending}
              onClick={() => deleteDim && removeDim.mutate(deleteDim.id)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建维度分组</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>维度类型</Label>
              <Select value={groupDimId} onValueChange={setGroupDimId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择维度类型" />
                </SelectTrigger>
                <SelectContent>
                  {dimensions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grp-code">编码</Label>
              <Input id="grp-code" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grp-name">名称</Label>
              <Input id="grp-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGroupOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!groupDimId || !groupCode.trim() || !groupName.trim() || createGroup.isPending}
              onClick={() =>
                createGroup.mutate({
                  dimension_type_id: groupDimId,
                  code: groupCode.trim(),
                  name: groupName.trim(),
                })
              }
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editGroup)}
        onOpenChange={(open) => {
          if (!open) setEditGroup(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分组</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="edit-grp-name">名称</Label>
            <Input
              id="edit-grp-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditGroup(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!editGroup || !editName.trim() || updateGroup.isPending}
              onClick={() =>
                editGroup && updateGroup.mutate({ id: editGroup.id, name: editName.trim() })
              }
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(valuesGroup)}
        onOpenChange={(open) => {
          if (!open) {
            setValuesGroup(null);
            setValuesText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分组成员值 — {valuesGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="grp-values">每行一个值（保存为全量替换）</Label>
            {valuesQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            <Textarea
              id="grp-values"
              rows={8}
              value={valuesText}
              onChange={(e) => setValuesText(e.target.value)}
              placeholder={"华东\n华北"}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setValuesGroup(null);
                setValuesText("");
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!valuesGroup || replaceValues.isPending}
              onClick={() => {
                if (!valuesGroup) return;
                const values = valuesText
                  .split(/\r?\n/)
                  .map((v) => v.trim())
                  .filter(Boolean);
                if (values.length === 0) {
                  toast.error("至少填写一个成员值");
                  return;
                }
                replaceValues.mutate({ id: valuesGroup.id, values });
              }}
            >
              保存成员值
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteGroup)}
        onOpenChange={(open) => {
          if (!open) setDeleteGroup(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除维度分组？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteGroup?.name}」及其成员值；若仍被角色绑定可能失败。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction
              className={DESTRUCTIVE_ALERT_ACTION_CLASS}
              disabled={removeGroup.isPending}
              onClick={() => deleteGroup && removeGroup.mutate(deleteGroup.id)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        count={groupSelection.selectedCount}
        title="批量删除维度分组"
        description="将删除选中的维度分组及其成员值；若仍被角色绑定可能部分失败。"
        pending={batchDeleting}
        onConfirm={() => void handleBatchDeleteGroups()}
      />
    </AdminPageShell>
  );
}
