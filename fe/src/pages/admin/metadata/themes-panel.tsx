import { type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  BatchDeleteDialog,
  ListHeaderCheckbox,
  ListPageBatchActions,
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
} from "@/components/ui/alert-dialog";
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ListGhostEmptyState } from "@/components/ui/panel-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { ListPageBody, ListPageToolbar } from "./metadata-shared";
import { ThemeTree, type ThemeNode } from "./theme-tree";
import { PageErrorBanner } from "@/components/ui/page-error-banner";

type Term = { id: string; name: string };

const NONE = "__none__";

export function ThemesPanel({ emptyIcon }: { emptyIcon: ReactNode }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [parentForCreate, setParentForCreate] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [termId, setTermId] = useState(NONE);
  const [deleteTarget, setDeleteTarget] = useState<ThemeNode | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const allNodes = useQuery({
    queryKey: queryKeys.metadataHub.themes("all"),
    queryFn: () => apiFetch<{ items: ThemeNode[] }>("/api/v1/metadata/themes?limit=500"),
  });
  const terms = useQuery({
    queryKey: queryKeys.metadataHub.glossary(),
    queryFn: () => apiFetch<{ items: Term[] }>("/api/v1/metadata/glossary?limit=100"),
    enabled: createOpen,
  });
  const inv = () => void qc.invalidateQueries({ queryKey: ["metadata", "themes"] });

  const openCreateRoot = () => {
    setParentForCreate(null);
    setName("");
    setTermId(NONE);
    setCreateOpen(true);
  };

  const createMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/metadata/themes", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          ...(parentForCreate ? { parentId: parentForCreate } : {}),
          ...(termId !== NONE ? { termId } : {}),
        }),
      }),
    onSuccess: () => {
      toast.success("主题节点已创建");
      setCreateOpen(false);
      inv();
    },
    onError: (e) => toast.error(mapApiError(e)),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/metadata/themes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("主题节点已删除");
      setDeleteTarget(null);
      inv();
    },
    onError: (e) => toast.error(mapApiError(e)),
  });

  const items = allNodes.data?.items ?? [];
  const isEmpty = !allNodes.isLoading && items.length === 0;
  const leafIds = useMemo(() => {
    const parentIds = new Set(items.map((n) => n.parentId).filter(Boolean));
    return items.filter((n) => !items.some((c) => c.parentId === n.id)).map((n) => n.id);
  }, [items]);
  const selection = useListRowSelection(leafIds);
  const batch = useListBatchMode(selection.clear);

  const handleBatchDelete = async () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/metadata/themes/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    selection.clear();
    inv();
    if (failed === 0) toast.success(`已删除 ${ok} 个主题节点`);
    else toast.warning(`已删除 ${ok} 个，${failed} 个删除失败（仅叶节点可删）`);
  };

  return (
    <>
      <ListPageToolbar
        filters={
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            递归主题树：拖拽行可调整同级顺序（调用 move API）；点击展开子级。
          </p>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ListPageBatchActions
              batchMode={batch.batchMode}
              onToggleBatchMode={batch.toggleBatchMode}
              selectedCount={selection.selectedCount}
              entityLabel="个节点"
              onClear={selection.clear}
              onDelete={() => setBatchDeleteOpen(true)}
            />
            <Button type="button" variant="primary" size="sm" onClick={openCreateRoot}>
              <Plus className="size-4" aria-hidden />
              新建根节点
            </Button>
          </div>
        }
      />
      <ListPageBody>
        {allNodes.error ? (
          <PageErrorBanner message={mapApiError(allNodes.error)} onRetry={() => void allNodes.refetch()} />
        ) : isEmpty ? (
          <ListGhostEmptyState
            icon={emptyIcon}
            title="暂无主题节点"
            description="从根节点开始搭建业务主题树，并可关联术语字典条目。"
            action={
              <Button type="button" variant="primary" size="sm" onClick={openCreateRoot}>
                <Plus className="size-4" aria-hidden />
                新建根节点
              </Button>
            }
            headingId="themes-empty"
          />
        ) : allNodes.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {batch.batchMode ? (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <ListHeaderCheckbox
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  disabled={leafIds.length === 0}
                  onCheckedChange={() => selection.toggleAll()}
                />
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  仅叶节点可勾选删除
                </span>
              </div>
            ) : null}
            <ThemeTree
              nodes={items}
              selectedIds={selection.selectedIds}
              onToggleSelect={batch.batchMode ? selection.toggle : undefined}
              onCreateChild={(parentId) => {
              setParentForCreate(parentId);
              setName("");
              setTermId(NONE);
              setCreateOpen(true);
            }}
            onDelete={setDeleteTarget}
          />
          </>
        )}
      </ListPageBody>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <AdminFormDialogContent size="md">
          <AdminFormDialogHeader>
            <DialogTitle>{parentForCreate ? "新建子节点" : "新建根节点"}</DialogTitle>
          </AdminFormDialogHeader>
          <AdminFormDialogBody>
            <AdminFormField label="名称" htmlFor="theme-name">
              <Input id="theme-name" value={name} onChange={(e) => setName(e.target.value)} />
            </AdminFormField>
            <AdminFormField label="关联术语">
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger>
                  <SelectValue placeholder="可选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>无</SelectItem>
                  {(terms.data?.items ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              创建
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除主题节点？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name}」，仅叶节点可删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && delMut.mutate(deleteTarget.id)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        count={selection.selectedCount}
        title="批量删除主题节点"
        description="仅叶节点可删除；含子节点的项将跳过或失败。"
        pending={batchDeleting}
        onConfirm={() => void handleBatchDelete()}
      />
    </>
  );
}
