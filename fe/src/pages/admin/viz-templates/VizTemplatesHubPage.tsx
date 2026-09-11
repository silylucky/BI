import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { LayoutTemplate, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import { DESTRUCTIVE_ALERT_ACTION_CLASS } from "@/components/layout/list-batch-delete";
import {
  LIST_PAGE_CARD_GRID_CLASS,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
  PageErrorBanner,
} from "@/components/layout/list-page-kit";
import { Button } from "@/components/ui/button";
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
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { VizTemplateCard } from "@/components/dashboard/templates/VizTemplateCard";
import { TemplateSettingsDialog } from "@/components/dashboard/templates/TemplateSettingsDialog";
import {
  canDeleteTemplate,
  VIZ_TEMPLATES_HUB,
} from "@/components/dashboard/templates/templateLabels";
import {
  archiveTemplate,
  createFromTemplate,
  deleteTemplate,
  fetchDashboardTemplates,
  filterTemplatesForHub,
  importTemplateEnvelope,
  parseVizTemplateHubCategoryKey,
  parseVizTemplateHubSurfaceKind,
  publishTemplate,
  type DashboardTemplateListItem,
  type VizLayoutEnvelope,
  type VizSurfaceKind,
} from "@/lib/dashboardTemplates";
import { hasCapability } from "@/lib/capabilities";
import { mapApiError } from "@/lib/apiError";
import { useListPagination } from "@/lib/list-pagination";
import { queryKeys } from "@/lib/queryKeys";
import { dataScreenEditPath } from "@/lib/dataScreenLayout";
import { buildTemplateEditSyncState } from "@/lib/templateEditSession";
import { useAuth } from "@/context/auth-context";
import { sessionUserFromMe } from "@/lib/session";
import {
  HUB_CARD_SHELL_CLASS,
  HUB_CARD_SKELETON_BODY_CLASS,
  HUB_CARD_SKELETON_PREVIEW_CLASS,
} from "@/components/dashboard/hubCardUi";
import { cn } from "@/lib/utils";
import { VizTemplatesHubFilters } from "./VizTemplatesHubFilters";

function readHubFilters(search: string) {
  const params = new URLSearchParams(search);
  return {
    surfaceKind: parseVizTemplateHubSurfaceKind(params.get("surfaceKind")),
    categoryKey: parseVizTemplateHubCategoryKey(params.get("categoryKey")),
  };
}

function TemplateCardSkeleton() {
  return (
    <div className={cn(HUB_CARD_SHELL_CLASS, "shadow-none")}>
      <Skeleton className={cn(HUB_CARD_SKELETON_PREVIEW_CLASS, "rounded-none")} />
      <div className={HUB_CARD_SKELETON_BODY_CLASS}>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <div className="flex gap-1.5">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
    </div>
  );
}

export function VizTemplatesHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const sessionUser = authUser
    ? sessionUserFromMe(authUser)
    : sessionUserFromMe({ username: "访客", roles: ["viewer"] });
  const canManage = hasCapability(sessionUser, "dashboard:template.manage");
  const canEdit = hasCapability(sessionUser, "dashboard:edit");

  const [surfaceKind, setSurfaceKind] = useState(
    () => readHubFilters(location.search).surfaceKind,
  );
  const [categoryKey, setCategoryKey] = useState(
    () => readHubFilters(location.search).categoryKey,
  );
  const [q, setQ] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [settingsItem, setSettingsItem] = useState<DashboardTemplateListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DashboardTemplateListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardTemplateListItem | null>(null);

  useEffect(() => {
    const next = readHubFilters(location.search);
    setSurfaceKind(next.surfaceKind);
    setCategoryKey(next.categoryKey);
  }, [location.search]);

  const syncHubSearch = useCallback(
    (patch: { surfaceKind?: VizSurfaceKind; categoryKey?: string | null }) => {
      const params = new URLSearchParams(location.search);
      if (patch.surfaceKind !== undefined) {
        if (patch.surfaceKind === "dashboard") params.delete("surfaceKind");
        else params.set("surfaceKind", patch.surfaceKind);
      }
      if (patch.categoryKey !== undefined) {
        if (patch.categoryKey) params.set("categoryKey", patch.categoryKey);
        else params.delete("categoryKey");
      }
      const search = params.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : "" },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );

  /** 类型 + 分类联合筛选；政务与其他分类交互一致。 */
  const listSurfaceKind = surfaceKind;
  const pagination = useListPagination(20, [listSurfaceKind, categoryKey, q]);

  const listQuery = useQuery({
    queryKey: queryKeys.dashboardTemplates.list({
      surfaceKind: listSurfaceKind,
      categoryKey: categoryKey ?? undefined,
      q,
      includeDrafts: canManage,
      limit: pagination.pageSize,
      offset: pagination.offset,
    }),
    queryFn: () =>
      fetchDashboardTemplates({
        surfaceKind: listSurfaceKind,
        categoryKey: categoryKey ?? undefined,
        q: q || undefined,
        includeDrafts: canManage,
        limit: pagination.pageSize,
        offset: pagination.offset,
      }),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTemplates.all });

  const useMutation_ = useMutation({
    mutationFn: (item: DashboardTemplateListItem) => createFromTemplate(item.id, item.name),
    onSuccess: (created, item) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      if (item.surfaceKind === "data-screen") {
        navigate(dataScreenEditPath(created.id));
      } else {
        navigate(`/admin/dashboards/${created.id}/edit`);
      }
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const editLayoutMutation = useMutation({
    mutationFn: (item: DashboardTemplateListItem) =>
      createFromTemplate(item.id, `${item.name}（编辑）`),
    onSuccess: (created, item) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      const templateEditSync = buildTemplateEditSyncState(item, canManage, authUser?.id);
      if (item.surfaceKind === "data-screen") {
        navigate(dataScreenEditPath(created.id), { state: { templateEditSync } });
      } else {
        navigate(`/admin/dashboards/${created.id}/edit`, { state: { templateEditSync } });
      }
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const publishMutation = useMutation({
    mutationFn: publishTemplate,
    onSuccess: () => {
      toast.success(VIZ_TEMPLATES_HUB.toastPublished);
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveTemplate,
    onSuccess: () => {
      toast.success(VIZ_TEMPLATES_HUB.toastArchived);
      setArchiveTarget(null);
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast.success(VIZ_TEMPLATES_HUB.toastDeleted);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const importMutation = useMutation({
    mutationFn: (envelope: VizLayoutEnvelope) => importTemplateEnvelope(envelope),
    onSuccess: () => {
      toast.success(VIZ_TEMPLATES_HUB.toastImported);
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const pending =
    useMutation_.isPending ||
    editLayoutMutation.isPending ||
    publishMutation.isPending ||
    archiveMutation.isPending ||
    deleteMutation.isPending;

  const items = filterTemplatesForHub(listQuery.data?.items ?? []);
  const total = listQuery.data?.total ?? 0;

  const handleSurfaceKindChange = (kind: VizSurfaceKind) => {
    setSurfaceKind(kind);
    syncHubSearch({ surfaceKind: kind });
  };

  const handleCategoryChange = (key: string | null) => {
    setCategoryKey(key);
    syncHubSearch({ categoryKey: key });
  };

  const renderCardGrid = (gridItems: DashboardTemplateListItem[], eagerCount = 0) => (
    <div className={LIST_PAGE_CARD_GRID_CLASS}>
      {gridItems.map((item, index) => (
        <VizTemplateCard
          key={item.id}
          item={item}
          canManage={canManage}
          canEdit={canEdit}
          pending={pending}
          previewEager={index < eagerCount}
          onUse={() => useMutation_.mutate(item)}
          onEditLayout={() => editLayoutMutation.mutate(item)}
          onOpenSettings={() => setSettingsItem(item)}
          onPublish={() => publishMutation.mutate(item.id)}
          onArchive={() => setArchiveTarget(item)}
          onDelete={() => setDeleteTarget(item)}
          canDelete={canDeleteTemplate(item, canManage, authUser?.id)}
        />
      ))}
    </div>
  );

  return (
    <AdminPageShell
      layout="list"
      title={VIZ_TEMPLATES_HUB.title}
      icon={
        <AdminPageHeaderIcon>
          <LayoutTemplate className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description={VIZ_TEMPLATES_HUB.description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/admin/viz-components">组织组件库</a>
          </Button>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => importRef.current?.click()}
              disabled={importMutation.isPending}
            >
              <Upload className="size-4" />
              {VIZ_TEMPLATES_HUB.importJson}
            </Button>
          ) : null}
        </div>
      }
    >
      <input
        ref={importRef}
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
              const parsed = JSON.parse(String(reader.result ?? "")) as VizLayoutEnvelope;
              importMutation.mutate(parsed);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : VIZ_TEMPLATES_HUB.invalidJson);
            }
          };
          reader.readAsText(file);
        }}
      />

      <ListPageSection>
        <ListPageToolbar
          filters={
            <VizTemplatesHubFilters
              surfaceKind={surfaceKind}
              categoryKey={categoryKey}
              onSurfaceKindChange={handleSurfaceKindChange}
              onCategoryChange={handleCategoryChange}
            />
          }
          actions={
            <SearchField
              className="w-full sm:max-w-xs"
              value={q}
              onChange={setQ}
              placeholder={VIZ_TEMPLATES_HUB.searchPlaceholder}
              aria-label={VIZ_TEMPLATES_HUB.searchAriaLabel}
            />
          }
        />

        {listQuery.isError ? (
          <div className="shrink-0 border-b px-5 py-3">
            <PageErrorBanner
              message={mapApiError(listQuery.error)}
              onRetry={() => void listQuery.refetch()}
            />
          </div>
        ) : null}

        <ListPageTableFrame>
          {listQuery.isLoading ? (
            <div className={LIST_PAGE_CARD_GRID_CLASS}>
              {Array.from({ length: 8 }).map((_, i) => (
                <TemplateCardSkeleton key={i} />
              ))}
            </div>
          ) : listQuery.isError ? null : items.length === 0 ? (
            <PanelEmptyState
              icon={<LayoutTemplate className="size-8" aria-hidden />}
              title={VIZ_TEMPLATES_HUB.emptyTitle}
              description={VIZ_TEMPLATES_HUB.emptyDescription}
              action={
                canEdit ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => importRef.current?.click()}
                    disabled={importMutation.isPending}
                  >
                    <Upload className="size-4" aria-hidden />
                    {VIZ_TEMPLATES_HUB.importJson}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            renderCardGrid(items, 4)
          )}
        </ListPageTableFrame>

        {!listQuery.isLoading && total > 0 ? (
          <ListPagePagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            showSizeChanger
            onChange={pagination.onPageChange}
          />
        ) : null}
      </ListPageSection>

      <TemplateSettingsDialog
        open={Boolean(settingsItem)}
        onOpenChange={(open) => {
          if (!open) setSettingsItem(null);
        }}
        item={settingsItem}
        onSaved={invalidate}
        onEditLayout={(item) => editLayoutMutation.mutate(item)}
      />

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>下架模板</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.visibility === "builtin"
                ? `确定下架「${archiveTarget.name}」？下架后将从模板市场隐藏；内置模板不会被永久删除，可在数据库中恢复发布。`
                : archiveTarget
                  ? `确定下架「${archiveTarget.name}」？下架后将从模板市场隐藏；如需永久删除，请使用「删除」。`
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              disabled={archiveMutation.isPending}
              onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
            >
              {archiveMutation.isPending ? "下架中…" : "下架"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{VIZ_TEMPLATES_HUB.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? VIZ_TEMPLATES_HUB.deleteDescription(deleteTarget.name) : null}
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
    </AdminPageShell>
  );
}
