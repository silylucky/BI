import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AdminPageShell,
  AdminPageHeaderIcon,
} from "@/components/layout/admin-page-shell";
import {
  ListHeaderCheckbox,
  ListPageBatchActions,
  listTableSelectHeadClass,
} from "@/components/layout/list-batch-delete";
import {
  ListPageCardGridEmptyState,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
  PageErrorBanner,
} from "@/components/layout/list-page-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { useListPagination } from "@/lib/list-pagination";
import { queryKeys } from "@/lib/queryKeys";
import { OrgFormDialogs } from "./OrgFormDialogs";
import { mapOrgError } from "./orgErrors";
import { OrgListRow } from "./OrgListRow";
import type { OrgOut } from "./org-tree-utils";
import {
  buildOrgChildCounts,
  filterVisibleOrgs,
  sortOrgsByPath,
} from "./org-tree-utils";
import { useOrgBatchDelete } from "./useOrgBatchDelete";
import { SystemAdminListHint } from "../SystemAdminListHint";

const ORG_PICKER_LIMIT = 500;

export function OrgTreePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createParentId, setCreateParentId] = useState<string>("__root__");
  const [createParentLocked, setCreateParentLocked] = useState(false);
  const [createParentLabel, setCreateParentLabel] = useState<string | null>(null);
  const [editOrg, setEditOrg] = useState<OrgOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("__root__");
  const [deleteOrg, setDeleteOrg] = useState<OrgOut | null>(null);

  const isTreeView = debouncedQ.length === 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const pagination = useListPagination(20, [debouncedQ]);
  const listParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      limit: pagination.pageSize,
      offset: pagination.offset,
    }),
    [debouncedQ, pagination.pageSize, pagination.offset],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.orgs.list(listParams),
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(listParams.limit),
        offset: String(listParams.offset),
      });
      if (listParams.q) params.set("q", listParams.q);
      return apiFetch<{ items: OrgOut[]; total: number }>(`/api/v1/orgs?${params}`);
    },
    enabled: !isTreeView,
  });

  const { data: pickerData, isLoading: pickerLoading } = useQuery({
    queryKey: queryKeys.orgs.picker,
    queryFn: () =>
      apiFetch<{ items: OrgOut[] }>(`/api/v1/orgs?limit=${ORG_PICKER_LIMIT}&offset=0`),
    staleTime: 60_000,
    enabled: isTreeView,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["orgs"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: { name: string; parent_id?: string | null }) =>
      apiFetch<OrgOut>("/api/v1/orgs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      toast.success("组织节点已创建");
      setCreateOpen(false);
      setCreateName("");
      setCreateParentId("__root__");
      await invalidate();
    },
    onError: (err) => toast.error(mapOrgError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { id: string; name: string; parent_id: string | null }) =>
      apiFetch<OrgOut>(`/api/v1/orgs/${body.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: body.name, parent_id: body.parent_id }),
      }),
    onSuccess: async () => {
      toast.success("组织节点已更新");
      setEditOrg(null);
      await invalidate();
    },
    onError: (err) => toast.error(mapOrgError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/orgs/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("组织节点已删除");
      setDeleteOrg(null);
      await invalidate();
    },
    onError: (err) => toast.error(mapOrgError(err)),
  });

  const treeSource = useMemo(
    () => sortOrgsByPath(pickerData?.items ?? []),
    [pickerData?.items],
  );
  const childCounts = useMemo(() => buildOrgChildCounts(treeSource), [treeSource]);
  const visibleTreeItems = useMemo(
    () => filterVisibleOrgs(treeSource, collapsedIds),
    [treeSource, collapsedIds],
  );

  const searchItems = data?.items ?? [];
  const displayItems = isTreeView ? visibleTreeItems : searchItems;
  const total = isTreeView ? treeSource.length : (data?.total ?? 0);
  const pickerItems = pickerData?.items ?? searchItems;
  const listLoading = isTreeView ? pickerLoading : isLoading;
  const isEmpty = !listLoading && displayItems.length === 0;

  const {
    selection,
    batch,
    batchDeleteOpen,
    setBatchDeleteOpen,
    batchDeleting,
    handleBatchDelete,
  } = useOrgBatchDelete(displayItems, invalidate);

  const toggleCollapse = (orgId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const openEdit = (org: OrgOut) => {
    setEditOrg(org);
    setEditName(org.name);
    setEditParentId(org.parent_id ?? "__root__");
  };

  const openCreateRoot = () => {
    setCreateName("");
    setCreateParentId("__root__");
    setCreateParentLocked(false);
    setCreateParentLabel(null);
    setCreateOpen(true);
  };

  const openCreateChild = (org: OrgOut) => {
    setCreateName("");
    setCreateParentId(org.id);
    setCreateParentLocked(true);
    setCreateParentLabel(org.name);
    setCreateOpen(true);
  };

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setCreateParentLocked(false);
      setCreateParentLabel(null);
      setCreateParentId("__root__");
      setCreateName("");
    }
  };

  return (
    <AdminPageShell
      layout="list"
      title="组织架构"
      icon={
        <AdminPageHeaderIcon>
          <Building2 className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description="维护处室、部门或辖区层级。用户归属与数据范围过滤都依赖组织树，建议作为后台管理的第一步。"
      actions={
        <Button type="button" variant="primary" size="sm" onClick={openCreateRoot}>
          <Plus className="size-4" aria-hidden />
          新建组织
        </Button>
      }
    >
      <ListPageSection>
        <SystemAdminListHint scope="orgs" />
        <ListPageToolbar
          filters={
            <div className="grid w-full gap-2 sm:max-w-xs">
              <Label className="sr-only">搜索组织</Label>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="搜索组织名称…"
                aria-label="搜索组织"
              />
            </div>
          }
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ListPageBatchActions
                batchMode={batch.batchMode}
                onToggleBatchMode={batch.toggleBatchMode}
                selectedCount={selection.selectedCount}
                entityLabel="个组织"
                onClear={selection.clear}
                onDelete={() => setBatchDeleteOpen(true)}
              />
              {!listLoading ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  {debouncedQ ? `筛选结果 ${total} 条` : `共 ${total} 个组织节点`}
                </p>
              ) : null}
            </div>
          }
        />

        <ListPageTableFrame className="px-0">
          {isError && !isTreeView ? (
            <div className="px-5 py-3">
              <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} />
            </div>
          ) : null}
          {listLoading ? (
            <div className="space-y-2 px-5 py-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : isEmpty ? (
            <ListPageCardGridEmptyState
              icon={<Building2 className="size-7" aria-hidden />}
              title={debouncedQ ? "没有匹配的组织" : "尚未建立组织"}
              description={
                debouncedQ
                  ? "试试其他关键词，或清空搜索查看完整组织树。"
                  : "点击「新建组织」添加第一个处室或部门，随后在节点右侧添加子组织。"
              }
              action={
                !debouncedQ ? (
                  <Button type="button" variant="primary" size="sm" onClick={openCreateRoot}>
                    <Plus className="size-4" aria-hidden />
                    新建组织
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-only">
              <table className="min-w-[640px] w-full text-left text-theme-sm" aria-label="组织树">
                <thead className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]">
                  <tr>
                    {batch.batchMode ? (
                      <th className={listTableSelectHeadClass}>
                        <ListHeaderCheckbox
                          checked={selection.allSelected}
                          indeterminate={selection.someSelected}
                          disabled={displayItems.length === 0}
                          onCheckedChange={() => selection.toggleAll()}
                        />
                      </th>
                    ) : null}
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      组织名称
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 dark:text-gray-400 sm:table-cell">
                      层级
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((org) => {
                    const childCount = childCounts.get(org.id) ?? 0;
                    return (
                      <OrgListRow
                        key={org.id}
                        org={org}
                        batchMode={batch.batchMode}
                        isSelected={selection.isSelected(org.id)}
                        onToggleSelect={() => selection.toggle(org.id)}
                        onEdit={openEdit}
                        onAddChild={openCreateChild}
                        onDelete={setDeleteOrg}
                        showTreeChrome={isTreeView}
                        hasChildren={isTreeView && childCount > 0}
                        childCount={childCount}
                        isCollapsed={collapsedIds.has(org.id)}
                        onToggleCollapse={() => toggleCollapse(org.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ListPageTableFrame>

        {!listLoading && !isTreeView && total > 0 ? (
          <ListPagePagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            showSizeChanger
            onChange={pagination.onPageChange}
          />
        ) : null}
      </ListPageSection>

      <OrgFormDialogs
        pickerItems={pickerItems}
        createOpen={createOpen}
        onCreateOpenChange={handleCreateOpenChange}
        createName={createName}
        onCreateNameChange={setCreateName}
        createParentId={createParentId}
        onCreateParentIdChange={setCreateParentId}
        createParentLocked={createParentLocked}
        createParentLabel={createParentLabel}
        createPending={createMutation.isPending}
        onCreate={() =>
          createMutation.mutate({
            name: createName.trim(),
            parent_id: createParentId === "__root__" ? null : createParentId,
          })
        }
        editOrg={editOrg}
        onEditClose={() => setEditOrg(null)}
        editName={editName}
        onEditNameChange={setEditName}
        editParentId={editParentId}
        onEditParentIdChange={setEditParentId}
        editPending={updateMutation.isPending}
        onEditSave={() => {
          if (!editOrg) return;
          updateMutation.mutate({
            id: editOrg.id,
            name: editName.trim(),
            parent_id: editParentId === "__root__" ? null : editParentId,
          });
        }}
        deleteOrg={deleteOrg}
        onDeleteClose={() => setDeleteOrg(null)}
        deletePending={deleteMutation.isPending}
        onDeleteConfirm={() => deleteOrg && deleteMutation.mutate(deleteOrg.id)}
        batchDeleteOpen={batchDeleteOpen}
        onBatchDeleteOpenChange={setBatchDeleteOpen}
        batchSelectedCount={selection.selectedCount}
        batchDeleting={batchDeleting}
        onBatchDeleteConfirm={() => void handleBatchDelete()}
      />
    </AdminPageShell>
  );
}
