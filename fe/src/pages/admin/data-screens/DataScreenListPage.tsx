import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { ChevronDown, Eye, LayoutTemplate, Monitor, Pencil, Plus, Share2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  BatchDeleteDialog,
  ListHeaderCheckbox,
  ListPageBatchActions,
  ListRowCheckbox,
  useListBatchMode,
} from "@/components/layout/list-batch-delete";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import {
  DashboardListCard,
  DashboardListCardSkeleton,
  type DashboardListItem,
} from "@/components/dashboard/DashboardListCard";
import {
  DataTable,
  ListPageBody,
  ListPageCardGridEmptyState,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
  LIST_PAGE_CARD_GRID_CLASS,
  PageErrorBanner,
  RowActions,
} from "@/components/layout/list-page-kit";
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
import { Button, IconButton } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { buildDashboardsListUrl } from "@/lib/dashboardsListQuery";
import {
  buildDataScreenLayoutFromTemplate,
  parseImportedDataScreenLayout,
  type DataScreenTemplateId,
} from "@/lib/dataScreenTemplates";
import { createFromTemplate, type DashboardTemplateListItem } from "@/lib/dashboardTemplates";
import { TemplatePickerDialog } from "@/components/dashboard/templates/TemplatePickerDialog";
import {
  dashboardSharePath,
  dataScreenEditPath,
  dataScreenPreviewPath,
} from "@/lib/dataScreenLayout";
import { queryKeys } from "@/lib/queryKeys";
import { useListPagination } from "@/lib/list-pagination";
import { runBatchDelete } from "@/lib/runBatchDelete";
import { canEditDashboards, canShareDashboards, sessionUserFromMe } from "@/lib/session";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { useAuth } from "@/context/auth-context";
import { isDemoPackageDashboard } from "@/lib/demoPackage";
import {
  DashboardSurfaceViewModeToggle,
  filterDashboardSurfaceListItems,
  formatDashboardListUpdatedAt,
  useDashboardSurfaceListSearch,
  type DashboardSurfaceViewMode,
} from "@/pages/admin/dashboard/dashboardListUi";
import { DESTRUCTIVE_ALERT_ACTION_CLASS } from "@/components/layout/list-batch-delete";
import {
  readDashboardSurfaceListViewMode,
  writeDashboardSurfaceListViewMode,
} from "@/lib/dashboardSurfaceListPrefs";

type DashboardListResponse = {
  items: DashboardListItem[];
  total: number;
  limit: number;
  offset: number;
};

type ViewMode = DashboardSurfaceViewMode;

function sortDashboardListItems(items: DashboardListItem[]): DashboardListItem[] {
  return [...items].sort((a, b) => {
    const aDemo = isDemoPackageDashboard({ slug: a.slug, layoutJson: a.layoutJson }) ? 1 : 0;
    const bDemo = isDemoPackageDashboard({ slug: b.slug, layoutJson: b.layoutJson }) ? 1 : 0;
    if (aDemo !== bDemo) return bDemo - aDemo;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function DataScreenListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const sessionUser = authUser
    ? sessionUserFromMe(authUser)
    : sessionUserFromMe({ username: "用户", roles: ["viewer"] });
  const canEdit = canEditDashboards(sessionUser);
  const canShare = canShareDashboards(sessionUser);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    readDashboardSurfaceListViewMode("data-screen"),
  );
  const [deleteTarget, setDeleteTarget] = useState<DashboardListItem | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { search, setSearch, debouncedQ, hasFilters } = useDashboardSurfaceListSearch();
  const pagination = useListPagination(20, [debouncedQ]);

  const listQuery = useQuery({
    queryKey: queryKeys.dashboards.list({
      limit: pagination.pageSize,
      offset: pagination.offset,
      surfaceKind: "data-screen",
      q: debouncedQ || undefined,
    }),
    queryFn: () =>
      apiFetch<DashboardListResponse>(
        buildDashboardsListUrl({
          limit: pagination.pageSize,
          offset: pagination.offset,
          surfaceKind: "data-screen",
          q: debouncedQ || undefined,
        }),
      ),
  });

  const createMutation = useMutation({
    mutationFn: async (templateId: DataScreenTemplateId = "blank") => {
      const slug = `screen-${Date.now()}`;
      const created = await apiFetch<{ id: string }>("/api/v1/dashboards", {
        method: "POST",
        body: JSON.stringify({ name: "未命名大屏", slug }),
      });
      try {
        await apiFetch(`/api/v1/dashboards/${created.id}/layout`, {
          method: "PUT",
          body: JSON.stringify({
            layoutJson: buildDataScreenLayoutFromTemplate(templateId),
          }),
        });
      } catch (layoutErr) {
        try {
          await apiFetch(`/api/v1/dashboards/${created.id}`, { method: "DELETE" });
        } catch {
          // best-effort rollback
        }
        throw layoutErr;
      }
      return created;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      navigate(dataScreenEditPath(created.id));
    },
    onError: (err) => {
      toast.error(mapApiError(err));
    },
  });

  const fromTemplateMutation = useMutation({
    mutationFn: (template: DashboardTemplateListItem) =>
      createFromTemplate(template.id, "未命名大屏"),
    onSuccess: (created) => {
      setTemplatePickerOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      navigate(dataScreenEditPath(created.id));
    },
    onError: (err) => {
      toast.error(mapApiError(err));
    },
  });

  const importMutation = useMutation({
    mutationFn: async (layoutJson: ReturnType<typeof parseImportedDataScreenLayout>) => {
      const slug = `screen-import-${Date.now()}`;
      const created = await apiFetch<{ id: string }>("/api/v1/dashboards", {
        method: "POST",
        body: JSON.stringify({ name: "导入的大屏", slug }),
      });
      try {
        await apiFetch(`/api/v1/dashboards/${created.id}/layout`, {
          method: "PUT",
          body: JSON.stringify({ layoutJson }),
        });
      } catch (layoutErr) {
        try {
          await apiFetch(`/api/v1/dashboards/${created.id}`, { method: "DELETE" });
        } catch {
          // best-effort rollback
        }
        throw layoutErr;
      }
      return created;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      toast.success("布局已导入");
      navigate(dataScreenEditPath(created.id));
    },
    onError: (err) => {
      toast.error(mapApiError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (dashboardId: string) =>
      apiFetch(`/api/v1/dashboards/${dashboardId}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success("大屏已删除");
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
    onError: (err) => {
      toast.error(mapApiError(err));
    },
  });

  const sortedItems = useMemo(
    () => sortDashboardListItems(listQuery.data?.items ?? []),
    [listQuery.data?.items],
  );
  const total = listQuery.data?.total ?? 0;
  const visibleItems = useMemo(
    () => (hasFilters ? filterDashboardSurfaceListItems(sortedItems, debouncedQ) : sortedItems),
    [sortedItems, hasFilters, debouncedQ],
  );
  const displayTotal =
    hasFilters && visibleItems.length < sortedItems.length ? visibleItems.length : total;
  const rowIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const handleBatchDelete = async () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/dashboards/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    selection.clear();
    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    if (failed === 0) toast.success(`已删除 ${ok} 个大屏`);
    else toast.warning(`已删除 ${ok} 个，${failed} 个删除失败`);
  };

  const createButton = canEdit ? (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={createMutation.isPending || importMutation.isPending || fromTemplateMutation.isPending}
          >
            <Plus className="size-4" />
            新建大屏
            <ChevronDown className="size-4 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuItem onClick={() => createMutation.mutate("blank")}>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">空白大屏</span>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                1920×1080 深色画布
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTemplatePickerOpen(true)}>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">从模板库选择</span>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                浏览企业内可视化模板
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={createMutation.isPending || importMutation.isPending}
        onClick={() => importInputRef.current?.click()}
      >
        <Upload className="size-4" />
        导入 JSON
      </Button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(String(reader.result ?? ""));
              const layoutJson = parseImportedDataScreenLayout(parsed);
              importMutation.mutate(layoutJson);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "无法解析布局 JSON");
            }
          };
          reader.readAsText(file);
        }}
      />
    </div>
  ) : null;

  return (
    <AdminPageShell
      layout="list"
      title="数据大屏"
      icon={
        <AdminPageHeaderIcon>
          <Monitor className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description="16:9 深色可视化大屏；支持像素画布编辑、预览与发布。"
      actions={
        <>
          <DashboardSurfaceViewModeToggle
            viewMode={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              writeDashboardSurfaceListViewMode("data-screen", mode);
            }}
            ariaLabel="大屏视图切换"
          />
          {createButton}
        </>
      }
    >
      <ListPageSection>
        <ListPageToolbar
          filters={
            <div className="grid w-full gap-2 sm:max-w-xs">
              <Label className="sr-only">搜索大屏</Label>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="搜索名称、标识或描述…"
                aria-label="搜索大屏"
              />
            </div>
          }
          actions={
            canEdit ? (
              <ListPageBatchActions
                batchMode={batch.batchMode}
                onToggleBatchMode={batch.toggleBatchMode}
                selectedCount={selection.selectedCount}
                entityLabel="个大屏"
                onClear={selection.clear}
                onDelete={() => setBatchDeleteOpen(true)}
              />
            ) : null
          }
        />
        {listQuery.isError ? (
          <ListPageBody>
            <PageErrorBanner
              message={mapApiError(listQuery.error)}
              onRetry={() => void listQuery.refetch()}
            />
          </ListPageBody>
        ) : null}

        {viewMode === "grid" ? (
          <ListPageTableFrame>
          {listQuery.isLoading ? (
            <div className={LIST_PAGE_CARD_GRID_CLASS}>
              {Array.from({ length: 6 }).map((_, index) => (
                <DashboardListCardSkeleton key={index} />
              ))}
            </div>
          ) : listQuery.isError ? null : visibleItems.length === 0 ? (
            <ListPageCardGridEmptyState
              icon={<Monitor className="size-7" aria-hidden />}
              title={hasFilters ? "未找到匹配的大屏" : "暂无数据大屏"}
              description={
                hasFilters
                  ? "尝试调整搜索关键词。"
                  : "创建 1920×1080 深色画布，拖拽图表与 KPI 组件，用于指挥大厅与监控墙展示。"
              }
              action={hasFilters ? undefined : createButton}
              headingId="data-screen-empty-title"
              layout="data-screen"
            />
          ) : (
            <>
              <div className={LIST_PAGE_CARD_GRID_CLASS}>
                {visibleItems.map((screen) => (
                  <DashboardListCard
                    key={screen.id}
                    dashboard={screen}
                    previewSurfaceKind="data-screen"
                    canEdit={canEdit}
                    canShare={canShare}
                    routeBase="/admin/data-screens"
                    selected={selection.isSelected(screen.id)}
                    onToggleSelect={
                      canEdit && batch.batchMode
                        ? () => selection.toggle(screen.id)
                        : undefined
                    }
                    onDelete={canEdit ? () => setDeleteTarget(screen) : undefined}
                  />
                ))}
              </div>
              <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
                共 {displayTotal} 个大屏
                {(listQuery.data?.items.length ?? 0) < total ? "（当前页未加载全部）" : ""}
                ，按最近更新排序
              </p>
            </>
          )}
          </ListPageTableFrame>
        ) : (
          <ListPageTableFrame>
            <DataTable
              loading={listQuery.isLoading}
              empty={!listQuery.isLoading && !listQuery.isError && visibleItems.length === 0}
              headers={[
                ...(canEdit && batch.batchMode
                  ? [
                      <ListHeaderCheckbox
                        key="select-all"
                        checked={selection.allSelected}
                        indeterminate={selection.someSelected}
                        disabled={visibleItems.length === 0}
                        onCheckedChange={() => selection.toggleAll()}
                      />,
                    ]
                  : []),
                "名称",
                "组件数",
                "更新时间",
                "操作",
              ]}
              lastColumnAlign="right"
              emptyState={{
                icon: <Monitor className="size-7" aria-hidden />,
                title: hasFilters ? "未找到匹配的大屏" : "暂无数据大屏",
                description: hasFilters
                  ? "尝试调整搜索关键词。"
                  : "创建 1920×1080 深色画布，拖拽图表与 KPI 组件，用于指挥大厅与监控墙展示。",
                action: hasFilters ? undefined : createButton,
                layout: "data-screen",
              }}
              rows={visibleItems.map((row) => {
                const widgetCount = row.widgetCount ?? row.previewSummary?.widgets?.length ?? row.layoutJson?.widgets?.length ?? 0;
                const viewPath = dataScreenPreviewPath(row.id);
                const editPath = dataScreenEditPath(row.id);
                const sharePath = dashboardSharePath(row.id, true);

                return [
                  ...(canEdit && batch.batchMode
                    ? [
                        <ListRowCheckbox
                          key={`${row.id}-select`}
                          checked={selection.isSelected(row.id)}
                          onCheckedChange={() => selection.toggle(row.id)}
                          ariaLabel={`选择大屏 ${row.name}`}
                        />,
                      ]
                    : []),
                  <div key={`${row.id}-name`} className="min-w-0">
                    <Link
                      to={canEdit ? editPath : viewPath}
                      className="block truncate font-medium text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
                    >
                      {row.name}
                    </Link>
                    <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                      {row.description ?? row.slug}
                    </p>
                  </div>,
                  String(widgetCount),
                  formatDashboardListUpdatedAt(row.updatedAt),
                  <RowActions key={`${row.id}-actions`}>
                    <IconButton asChild variant="ghost" size="sm" aria-label="查看">
                      <Link to={viewPath}>
                        <Eye className="size-4" />
                      </Link>
                    </IconButton>
                    {canEdit ? (
                      <IconButton asChild variant="ghost" size="sm" aria-label="编辑">
                        <Link to={editPath}>
                          <Pencil className="size-4" />
                        </Link>
                      </IconButton>
                    ) : null}
                    {canShare ? (
                      <IconButton asChild variant="ghost" size="sm" aria-label="分享">
                        <Link to={sharePath}>
                          <Share2 className="size-4" />
                        </Link>
                      </IconButton>
                    ) : null}
                    {canEdit ? (
                      <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label="删除"
                        className="text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    ) : null}
                  </RowActions>,
                ];
              })}
            />
          </ListPageTableFrame>
        )}

        {!listQuery.isLoading && displayTotal > 0 ? (
          <ListPagePagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={displayTotal}
            showSizeChanger
            onChange={pagination.onPageChange}
          />
        ) : null}
      </ListPageSection>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除大屏</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deleteTarget?.name}」？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={DESTRUCTIVE_ALERT_ACTION_CLASS}
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canEdit ? (
        <BatchDeleteDialog
          open={batchDeleteOpen}
          onOpenChange={setBatchDeleteOpen}
          count={selection.selectedCount}
          title="批量删除大屏"
          description={`确定删除选中的 ${selection.selectedCount} 个大屏？删除后无法恢复。`}
          pending={batchDeleting}
          onConfirm={() => void handleBatchDelete()}
        />
      ) : null}

      {canEdit ? (
        <TemplatePickerDialog
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          surfaceKind="data-screen"
          pending={fromTemplateMutation.isPending}
          onSelect={(template) => fromTemplateMutation.mutate(template)}
        />
      ) : null}
    </AdminPageShell>
  );
}
