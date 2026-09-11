import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, LayoutDashboard, LayoutTemplate, Pencil, Plus, Share2, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  BatchDeleteDialog,
  ListPageBatchActions,
  ListHeaderCheckbox,
  ListRowCheckbox,
  useListBatchMode,
} from "@/components/layout/list-batch-delete";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import {
  DashboardListCard,
  DashboardListCardSkeleton,
  DashboardListEmptyIcon,
  type DashboardListItem,
} from "@/components/dashboard/DashboardListCard";
import { DashboardQuickCreateDialog } from "@/components/dashboard/DashboardQuickCreateDialog";
import { TemplatePickerDialog } from "@/components/dashboard/templates/TemplatePickerDialog";
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
import { Button, IconButton } from "@/components/ui/button";
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
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { useListPagination } from "@/lib/list-pagination";
import { canEditDashboards, canShareDashboards, sessionUserFromMe } from "@/lib/session";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { runBatchDelete } from "@/lib/runBatchDelete";
import { useAuth } from "@/context/auth-context";
import { buildDashboardsListUrl } from "@/lib/dashboardsListQuery";
import { createFromTemplate, type DashboardTemplateListItem } from "@/lib/dashboardTemplates";
import { isDemoPackageDashboard } from "@/lib/demoPackage";
import { SCHEDULE_CREATE_INTENT } from "@/lib/scheduleSourceMeta";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import {
  DashboardSurfaceViewModeToggle,
  filterDashboardSurfaceListItems,
  formatDashboardListUpdatedAt,
  useDashboardSurfaceListSearch,
  type DashboardSurfaceViewMode,
} from "./dashboardListUi";
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

export function DashboardListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scheduleCreateIntent = searchParams.get("intent") === SCHEDULE_CREATE_INTENT;
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const sessionUser = authUser
    ? sessionUserFromMe(authUser)
    : sessionUserFromMe({ username: "用户", roles: ["viewer"] });
  const canEdit = canEditDashboards(sessionUser);
  const canShare = canShareDashboards(sessionUser);

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    readDashboardSurfaceListViewMode("dashboard"),
  );
  const [deleteTarget, setDeleteTarget] = useState<DashboardListItem | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const { search, setSearch, debouncedQ, hasFilters } = useDashboardSurfaceListSearch();
  const pagination = useListPagination(20, [debouncedQ]);

  const listQuery = useQuery({
    queryKey: queryKeys.dashboards.list({
      limit: pagination.pageSize,
      offset: pagination.offset,
      surfaceKind: "dashboard",
      q: debouncedQ || undefined,
    }),
    queryFn: () =>
      apiFetch<DashboardListResponse>(
        buildDashboardsListUrl({
          limit: pagination.pageSize,
          offset: pagination.offset,
          surfaceKind: "dashboard",
          q: debouncedQ || undefined,
        }),
      ),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const slug = `dash-${Date.now()}`;
      return apiFetch<{ id: string }>("/api/v1/dashboards", {
        method: "POST",
        body: JSON.stringify({ name: "未命名看板", slug }),
      });
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      navigate(`/admin/dashboards/${created.id}/edit`);
    },
  });

  const fromTemplateMutation = useMutation({
    mutationFn: (template: DashboardTemplateListItem) =>
      createFromTemplate(template.id, template.name),
    onSuccess: (created) => {
      setTemplatePickerOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      navigate(`/admin/dashboards/${created.id}/edit`);
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? items.length;
  const sortedItems = useMemo(() => sortDashboardListItems(items), [items]);
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
    if (failed === 0) toast.success(`已删除 ${ok} 个看板`);
    else toast.warning(`已删除 ${ok} 个，${failed} 个删除失败`);
  };

  const createButton = canEdit ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={createMutation.isPending || fromTemplateMutation.isPending}
        onClick={() => setQuickCreateOpen(true)}
      >
        <Plus className="size-4" />
        新建看板
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={createMutation.isPending || fromTemplateMutation.isPending}
        onClick={() => setTemplatePickerOpen(true)}
      >
        <LayoutTemplate className="size-4" />
        使用模板新建
      </Button>
    </div>
  ) : null;

  return (
    <AdminPageShell
      layout="list"
      title="数据看板"
      icon={
        <AdminPageHeaderIcon>
          <LayoutDashboard className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description={
        canEdit
          ? "创建并管理可视化看板，拖拽组件、绑定数据源后发布给业务用户。"
          : "浏览已授权的数据看板，点击进入查看模式。"
      }
      actions={
        <>
          <DashboardSurfaceViewModeToggle
            viewMode={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              writeDashboardSurfaceListViewMode("dashboard", mode);
            }}
          />
          {createButton}
        </>
      }
    >
      <ListPageSection>
        {scheduleCreateIntent ? (
          <Alert className="mb-4">
            <CalendarClock className="size-4" aria-hidden />
            <AlertTitle>创建定时报告</AlertTitle>
            <AlertDescription>
              请打开目标看板编辑页，点击工具栏「定时推送」配置 PDF 定时报告。
            </AlertDescription>
          </Alert>
        ) : null}
        <ListPageToolbar
          filters={
            <div className="grid w-full gap-2 sm:max-w-xs">
              <Label className="sr-only">搜索看板</Label>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="搜索名称、标识或描述…"
                aria-label="搜索看板"
              />
            </div>
          }
          actions={
            canEdit ? (
              <ListPageBatchActions
                batchMode={batch.batchMode}
                onToggleBatchMode={batch.toggleBatchMode}
                selectedCount={selection.selectedCount}
                entityLabel="个看板"
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
                {Array.from({ length: 8 }).map((_, index) => (
                  <DashboardListCardSkeleton key={index} />
                ))}
              </div>
            ) : listQuery.isError ? null : visibleItems.length === 0 ? (
              <ListPageCardGridEmptyState
                icon={<DashboardListEmptyIcon />}
                title={hasFilters ? "未找到匹配的看板" : "暂无仪表板"}
                description={
                  hasFilters
                    ? "尝试调整搜索关键词。"
                    : "创建第一个看板，拖拽图表组件并绑定数据源后即可发布。"
                }
                action={hasFilters ? undefined : createButton}
                headingId="dashboard-empty-title"
                layout="cards"
              />
            ) : (
              <>
                <div className={LIST_PAGE_CARD_GRID_CLASS}>
                  {visibleItems.map((dashboard) => (
                    <DashboardListCard
                      key={dashboard.id}
                      dashboard={dashboard}
                      previewSurfaceKind="dashboard"
                      canEdit={canEdit}
                      canShare={canShare}
                      selected={selection.isSelected(dashboard.id)}
                      onToggleSelect={
                        canEdit && batch.batchMode
                          ? () => selection.toggle(dashboard.id)
                          : undefined
                      }
                      onDelete={canEdit ? () => setDeleteTarget(dashboard) : undefined}
                    />
                  ))}
                </div>
                <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
                  共 {displayTotal} 个看板
                  {items.length < total ? "（当前页未加载全部）" : ""}
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
              icon: <DashboardListEmptyIcon />,
              title: hasFilters ? "未找到匹配的看板" : "暂无仪表板",
              description: hasFilters
                ? "尝试调整搜索关键词。"
                : "创建第一个看板，拖拽图表组件并绑定数据源后即可发布。",
              action: hasFilters ? undefined : createButton,
              layout: "cards",
            }}
            rows={visibleItems.map((row) => {
              const widgetCount = row.widgetCount ?? row.previewSummary?.widgets?.length ?? row.layoutJson?.widgets?.length ?? 0;
              const viewPath = `/admin/dashboards/${row.id}`;
              const editPath = `/admin/dashboards/${row.id}/edit`;

              return [
                ...(canEdit && batch.batchMode
                  ? [
                      <ListRowCheckbox
                        key={`${row.id}-select`}
                        checked={selection.isSelected(row.id)}
                        onCheckedChange={() => selection.toggle(row.id)}
                        ariaLabel={`选择看板 ${row.name}`}
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
                      <Link to={`/admin/dashboards/${row.id}/share`}>
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

      {createMutation.isError ? (
        <PageErrorBanner
          message={mapApiError(createMutation.error)}
          onRetry={() => createMutation.reset()}
        />
      ) : null}
      {deleteMutation.isError ? (
        <PageErrorBanner
          message={mapApiError(deleteMutation.error)}
          onRetry={() => deleteMutation.reset()}
        />
      ) : null}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除看板</AlertDialogTitle>
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
          title="批量删除看板"
          description={`确定删除选中的 ${selection.selectedCount} 个看板？删除后无法恢复。`}
          pending={batchDeleting}
          onConfirm={() => void handleBatchDelete()}
        />
      ) : null}

      {canEdit ? (
        <DashboardQuickCreateDialog
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          onBlankCreate={() => createMutation.mutate()}
          blankPending={createMutation.isPending}
        />
      ) : null}

      {canEdit ? (
        <TemplatePickerDialog
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          surfaceKind="dashboard"
          pending={fromTemplateMutation.isPending}
          onSelect={(template) => fromTemplateMutation.mutate(template)}
        />
      ) : null}
    </AdminPageShell>
  );
}
