import { type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { IconButton } from "@/components/ui/button";
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
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import {
  ListPageBody,
  ListPageToolbar,
  MetaDataTable,
  RowActions,
} from "./metadata-shared";
import { PageErrorBanner } from "@/components/ui/page-error-banner";

type Dimension = { id: string; code: string; name: string; status: string; themeNodeId?: string | null };
type ThemeNode = { id: string; name: string };
const NONE = "__none__";

export function DimensionsPanel({
  prefix,
  onPrefixChange,
  emptyIcon,
}: {
  prefix: string;
  onPrefixChange: (value: string) => void;
  emptyIcon: ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);
  const [editing, setEditing] = useState<Dimension | null>(null);
  const [valuesTarget, setValuesTarget] = useState<Dimension | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [themeNodeId, setThemeNodeId] = useState(NONE);
  const [valuesText, setValuesText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Dimension | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.metadataHub.dimensions({ codePrefix: prefix || undefined }),
    queryFn: () => {
      const q = new URLSearchParams({ limit: "100", offset: "0" });
      if (prefix.trim()) q.set("code_prefix", prefix.trim());
      return apiFetch<{ items: Dimension[] }>(`/api/v1/metadata/dimensions?${q}`);
    },
  });
  const themes = useQuery({
    queryKey: queryKeys.metadataHub.themes("null"),
    queryFn: () => apiFetch<{ items: ThemeNode[] }>("/api/v1/metadata/themes?parent_id=null&limit=100"),
  });
  const themeNames = new Map((themes.data?.items ?? []).map((t) => [t.id, t.name]));
  const inv = () => void qc.invalidateQueries({ queryKey: ["metadata", "dimensions"] });

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setThemeNodeId(NONE);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const theme = themeNodeId === NONE ? null : themeNodeId;
      if (editing) {
        await apiFetch(`/api/v1/metadata/dimensions/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: name.trim(), themeNodeId: theme }),
        });
      } else {
        await apiFetch("/api/v1/metadata/dimensions", {
          method: "POST",
          body: JSON.stringify({
            code: code.trim(),
            name: name.trim(),
            ...(theme ? { themeNodeId: theme } : {}),
          }),
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "维度已更新" : "维度已创建");
      setOpen(false);
      inv();
    },
    onError: (e) => toast.error(mapApiError(e)),
  });
  const regValues = useMutation({
    mutationFn: async () => {
      const items = valuesText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [c, ...r] = l.split(",");
          return { code: c.trim(), label: (r.join(",") || c).trim() };
        });
      await apiFetch(`/api/v1/metadata/dimensions/${valuesTarget!.id}/values`, {
        method: "POST",
        body: JSON.stringify({ items }),
      });
    },
    onSuccess: () => {
      toast.success("枚举值已注册");
      setValuesOpen(false);
    },
    onError: (e) => toast.error(mapApiError(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/metadata/dimensions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("维度已删除");
      setDeleteTarget(null);
      inv();
    },
    onError: (e) => toast.error(mapApiError(e)),
  });

  const items = query.data?.items ?? [];
  const rowIds = useMemo(() => items.map((d) => d.id), [items]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const handleBatchDelete = async () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/metadata/dimensions/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    selection.clear();
    inv();
    if (failed === 0) toast.success(`已删除 ${ok} 个维度`);
    else toast.warning(`已删除 ${ok} 个，${failed} 个删除失败`);
  };

  return (
    <>
      <ListPageToolbar
        filters={
          <SearchField
            className="w-full sm:max-w-xs"
            value={prefix}
            onChange={onPrefixChange}
            placeholder="按编码前缀筛选…"
            aria-label="维度编码前缀"
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ListPageBatchActions
              batchMode={batch.batchMode}
              onToggleBatchMode={batch.toggleBatchMode}
              selectedCount={selection.selectedCount}
              entityLabel="个维度"
              onClear={selection.clear}
              onDelete={() => setBatchDeleteOpen(true)}
            />
            <Button type="button" variant="primary" size="sm" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              新建维度
            </Button>
          </div>
        }
      />
      <ListPageBody>
        {query.error ? (
          <PageErrorBanner message={mapApiError(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <MetaDataTable
            loading={query.isLoading}
            empty={items.length === 0}
            lastColumnAlign="right"
            emptyState={{
              icon: emptyIcon,
              title: "暂无维度",
              description: "注册分析维度并关联业务主题，支持后续枚举值维护。",
              action: (
                <Button type="button" variant="primary" size="sm" onClick={openCreate}>
                  <Plus className="size-4" aria-hidden />
                  新建维度
                </Button>
              ),
            }}
            headers={[
              ...(batch.batchMode
                ? [
                    <ListHeaderCheckbox
                      key="select-all"
                      checked={selection.allSelected}
                      indeterminate={selection.someSelected}
                      disabled={items.length === 0}
                      onCheckedChange={() => selection.toggleAll()}
                    />,
                  ]
                : []),
              "名称",
              "编码",
              "主题",
              "状态",
              "操作",
            ]}
            rows={items.map((d) => [
              ...(batch.batchMode
                ? [
                    <ListRowCheckbox
                      key={`${d.id}-select`}
                      checked={selection.isSelected(d.id)}
                      onCheckedChange={() => selection.toggle(d.id)}
                      ariaLabel={`选择维度 ${d.name}`}
                    />,
                  ]
                : []),
              <span key="n" className="font-medium text-gray-900 dark:text-white/90">
                {d.name}
              </span>,
              <code
                key="c"
                className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300"
              >
                {d.code}
              </code>,
              d.themeNodeId ? (themeNames.get(d.themeNodeId) ?? "—") : "—",
              <Badge key="s" variant="light" color="primary" size="sm">
                {d.status}
              </Badge>,
              <RowActions key="a">
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={`编辑维度 ${d.name}`}
                  onClick={() => {
                    setEditing(d);
                    setCode(d.code);
                    setName(d.name);
                    setThemeNodeId(d.themeNodeId ?? NONE);
                    setOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </IconButton>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setValuesTarget(d);
                    setValuesText("");
                    setValuesOpen(true);
                  }}
                >
                  枚举值
                </Button>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={`删除维度 ${d.name}`}
                  onClick={() => setDeleteTarget(d)}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </RowActions>,
            ])}
          />
        )}
      </ListPageBody>

      <Dialog open={open} onOpenChange={setOpen}>
        <AdminFormDialogContent size="md">
          <AdminFormDialogHeader>
            <DialogTitle>{editing ? "编辑维度" : "新建维度"}</DialogTitle>
          </AdminFormDialogHeader>
          <AdminFormDialogBody>
            {!editing ? (
              <AdminFormField label="编码" htmlFor="dim-code">
                <Input id="dim-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </AdminFormField>
            ) : null}
            <AdminFormField label="名称" htmlFor="dim-name">
              <Input id="dim-name" value={name} onChange={(e) => setName(e.target.value)} />
            </AdminFormField>
            <AdminFormField label="所属主题">
              <Select value={themeNodeId} onValueChange={setThemeNodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="可选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>无</SelectItem>
                  {(themes.data?.items ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              保存
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>

      <Dialog open={valuesOpen} onOpenChange={setValuesOpen}>
        <AdminFormDialogContent size="md" scrollable>
          <AdminFormDialogHeader>
            <DialogTitle>注册枚举值 — {valuesTarget?.name}</DialogTitle>
          </AdminFormDialogHeader>
          <AdminFormDialogBody scrollable>
            <Textarea
              value={valuesText}
              onChange={(e) => setValuesText(e.target.value)}
              placeholder="open,开启"
              rows={6}
            />
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => setValuesOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="primary" disabled={regValues.isPending} onClick={() => regValues.mutate()}>
              注册
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除维度？</AlertDialogTitle>
            <AlertDialogDescription>将删除「{deleteTarget?.name}」</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && del.mutate(deleteTarget.id)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        count={selection.selectedCount}
        title="批量删除维度"
        pending={batchDeleting}
        onConfirm={() => void handleBatchDelete()}
      />
    </>
  );
}
