import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { FileText, FolderOpen, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import { ListPageSection } from "@/components/layout/list-page-kit";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { mapApiError } from "@/lib/apiError";
import { apiFetch } from "@/lib/api";
import type { TemplateKind } from "@/lib/reportCatalogProvision";
import { catalogAncestorFolderIds, catalogNodePath, pickDefaultCatalogNodeId } from "@/lib/reportCatalogUtils";
import { CatalogFolderPanel } from "./components/CatalogFolderPanel";
import { CatalogTreeNode } from "./components/CatalogTreeNode";
import { ListGhostEmptyState } from "@/components/ui/panel-empty-state";
import { Button } from "@/components/ui/button";
import { TemplateDetailPanel } from "./components/TemplateDetailPanel";
import { type CatalogNode, fetchCatalogExtension, useAllCatalogNodes, useReportTemplates } from "./useReportTemplates";
import { useReportCenterPreferences } from "./useReportCenterPrefs";
import { queryKeys } from "@/lib/queryKeys";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { ReportCenterBackLink } from "./components/ReportCenterBackLink";
import { ReportTemplateHeaderActions } from "./components/ReportTemplateHeaderActions";
import { REPORT_TEMPLATE_WORKBENCH_GRID_CLASS, TEMPLATE_NODE_QUERY } from "./components/reportTemplateUi";
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

export function ReportTemplatesPage() {
  const { nodeId: legacyNodeId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedOverride, setSelectedOverride] = useState<CatalogNode | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { nodesQuery, createNode, createTemplateNode, deleteNode, moveNode } = useReportTemplates(null);
  const allNodesQuery = useAllCatalogNodes();
  const centerPrefsQuery = useReportCenterPreferences();
  const autoSelectedRef = useRef(false);
  const prefetchedCatalogKeyRef = useRef("");
  const readOnly = user?.roles?.length === 1 && user.roles[0] === "viewer";
  const nodes = nodesQuery.data?.items ?? [];
  const allNodes = allNodesQuery.data ?? [];
  const selectedId = searchParams.get(TEMPLATE_NODE_QUERY) ?? legacyNodeId ?? null;
  const selected = useMemo(() => {
    if (selectedOverride?.id === selectedId) return selectedOverride;
    return allNodes.find((n) => n.id === selectedId) ?? nodes.find((n) => n.id === selectedId) ?? null;
  }, [allNodes, nodes, selectedId, selectedOverride]);
  const createParentId = selected?.nodeType === "folder" ? selected.id : null;

  const expandFolderIds = useMemo(() => {
    const set = new Set<string>();
    if (selectedId) {
      for (const id of catalogAncestorFolderIds(selectedId, allNodes)) set.add(id);
    }
    if (createParentId) set.add(createParentId);
    return set;
  }, [selectedId, allNodes, createParentId]);

  const prefetchExtension = useCallback(
    (id: string) => {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.reports.extension(id),
        queryFn: () => fetchCatalogExtension(id),
        staleTime: 5 * 60_000,
      });
    },
    [queryClient],
  );

  const applyNodeSelection = useCallback(
    (id: string | null, override?: CatalogNode | null) => {
      if (id === selectedId && override === undefined) return;
      if (id) prefetchExtension(id);
      if (override !== undefined) setSelectedOverride(override);
      else if (id !== selectedOverride?.id) setSelectedOverride(null);
      const next = new URLSearchParams(searchParams);
      if (id) next.set(TEMPLATE_NODE_QUERY, id);
      else next.delete(TEMPLATE_NODE_QUERY);
      setSearchParams(next, { replace: true });
    },
    [prefetchExtension, searchParams, selectedId, selectedOverride?.id, setSearchParams],
  );

  const handleSelect = useCallback(
    (id: string | null) => {
      applyNodeSelection(id);
    },
    [applyNodeSelection],
  );

  const seedDemoMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ code?: string; message?: string; detail?: { catalogNodeId?: string } }>(
        "/api/v1/reports/center/seed-demo",
        {
          method: "POST",
        },
      ),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["reports", "catalog"] });
      const nodeId = data.detail?.catalogNodeId;
      if (nodeId) applyNodeSelection(nodeId);
      if (data.code === "partial") {
        toast.warning(data.message ?? "示例报表部分加载，请检查数据源配置");
        return;
      }
      toast.success("示例报表已加载，可在右侧预览并导出");
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const legacyMigratedRef = useRef(false);

  useEffect(() => {
    if (!legacyNodeId || legacyMigratedRef.current) return;
    legacyMigratedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.set(TEMPLATE_NODE_QUERY, legacyNodeId);
    navigate({ pathname: "/admin/reports/templates", search: next.toString() }, { replace: true });
  }, [legacyNodeId, navigate, searchParams]);

  useEffect(() => {
    const catalog = allNodes.length > 0 ? allNodes : nodes;
    const catalogKey = catalog.map((n) => n.id).join(",");
    if (!catalogKey || catalogKey === prefetchedCatalogKeyRef.current) return;
    prefetchedCatalogKeyRef.current = catalogKey;
    for (const node of catalog) {
      if (node.nodeType === "template") prefetchExtension(node.id);
    }
  }, [allNodes, nodes, prefetchExtension]);

  useEffect(() => {
    if (selectedId) {
      autoSelectedRef.current = true;
      return;
    }
    if (autoSelectedRef.current) return;
    if (nodesQuery.isLoading) return;
    if (allNodesQuery.isLoading && allNodes.length === 0) return;
    if (!centerPrefsQuery.isFetched) return;
    const catalog = allNodes.length > 0 ? allNodes : nodes;
    if (catalog.length === 0) return;
    const defaultId = pickDefaultCatalogNodeId(catalog, centerPrefsQuery.data?.recent ?? []);
    if (!defaultId) return;
    autoSelectedRef.current = true;
    applyNodeSelection(defaultId);
  }, [
    selectedId,
    nodesQuery.isLoading,
    allNodesQuery.isLoading,
    allNodes,
    nodes,
    centerPrefsQuery.isFetched,
    centerPrefsQuery.data,
    applyNodeSelection,
  ]);

  const selectAfterDelete = useCallback(
    (deletedId: string) => {
      const catalog = (allNodes.length > 0 ? allNodes : nodes).filter((n) => n.id !== deletedId);
      handleSelect(pickDefaultCatalogNodeId(catalog, centerPrefsQuery.data?.recent ?? []));
    },
    [allNodes, nodes, centerPrefsQuery.data, handleSelect],
  );

  const handleCreateFolder = (parentId: string | null = createParentId) => {
    createNode.mutate(
      {
        name: "新建文件夹",
        nodeType: "folder",
        parentId,
      },
      {
        onSuccess: (created) => {
          applyNodeSelection(created.id, created);
          toast.success(parentId ? "已在文件夹内创建" : "已在根目录创建");
        },
        onError: (err) => toast.error(mapApiError(err)),
      },
    );
  };

  const handleCreateTemplate = (parentId: string | null = createParentId, templateKind: TemplateKind = "pdf") => {
    createTemplateNode.mutate(
      { name: "新建模板", parentId, templateKind },
      {
        onSuccess: (created) => {
          applyNodeSelection(created.id, created);
          toast.success(parentId ? "模板已创建到当前文件夹" : "模板已创建到根目录");
        },
        onError: (err) => toast.error(mapApiError(err)),
      },
    );
  };

  const handleMove = (id: string, parentId: string | null) => {
    moveNode.mutate(
      { id, parentId },
      {
        onSuccess: (moved) => {
          if (selectedId === id) setSelectedOverride(moved);
          toast.success("已移动");
        },
        onError: (err) => toast.error(mapApiError(err)),
      },
    );
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    deleteNode.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) selectAfterDelete(id);
        setDeleteTargetId(null);
        toast.success("已删除");
      },
      onError: (err) => toast.error(mapApiError(err)),
    });
  };

  const deleteTarget =
    deleteTargetId != null
      ? allNodes.find((n) => n.id === deleteTargetId) ?? nodes.find((n) => n.id === deleteTargetId) ?? null
      : null;

  const isCreating = createNode.isPending || createTemplateNode.isPending;

  const templateCreateToolbar = !readOnly ? (
    <ReportTemplateHeaderActions
      disabled={isCreating}
      onCreateFolder={() => handleCreateFolder()}
      onCreateTemplate={(kind) => handleCreateTemplate(createParentId, kind)}
    />
  ) : null;

  const sidebarCreateToolbar = !readOnly ? (
    <ReportTemplateHeaderActions
      disabled={isCreating}
      orientation="stack"
      onCreateFolder={() => handleCreateFolder()}
      onCreateTemplate={(kind) => handleCreateTemplate(createParentId, kind)}
    />
  ) : null;

  const catalogBody = nodesQuery.isLoading ? (
    <div className="space-y-2 px-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  ) : nodes.length === 0 ? (
    <ListGhostEmptyState
      layout="table"
      density="compact"
      rows={4}
      headingId="templates-catalog-empty"
      icon={<FolderOpen className="size-8" aria-hidden />}
      title="暂无模板目录"
      description="可先加载示例报表体验运行与导出，或新建 Excel / PDF 模板。"
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!readOnly && import.meta.env.DEV ? (
            <Button
              type="button"
              variant="primary"
              disabled={seedDemoMutation.isPending}
              onClick={() => seedDemoMutation.mutate()}
            >
              {seedDemoMutation.isPending ? "加载中…" : "加载示例报表"}
            </Button>
          ) : null}
          {templateCreateToolbar}
        </div>
      }
    />
  ) : (
    <ScrollArea className="min-h-0 flex-1 pr-2">
      <div className="space-y-0.5 px-1">
        {nodes.map((node) => (
          <CatalogTreeNode
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={handleSelect}
            allNodes={allNodes}
            allNodesLoaded={allNodesQuery.isSuccess}
            readOnly={readOnly}
            onMove={handleMove}
            onDelete={handleDelete}
            expandFolderIds={expandFolderIds}
            onPrefetch={prefetchExtension}
          />
        ))}
      </div>
    </ScrollArea>
  );

  const catalog = allNodes.length > 0 ? allNodes : nodes;
  const pendingAutoSelect =
    !selectedId &&
    !autoSelectedRef.current &&
    catalog.length > 0 &&
    (nodesQuery.isLoading || allNodesQuery.isLoading || !centerPrefsQuery.isFetched);

  const detailBody = pendingAutoSelect ? (
    <div className="flex min-h-[280px] flex-col justify-center gap-3 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">正在打开模板…</p>
    </div>
  ) : selected?.nodeType === "template" ? (
    <TemplateDetailPanel
      node={selected}
      allNodes={allNodes}
      readOnly={readOnly}
      onDeleted={() => selectAfterDelete(selected.id)}
    />
  ) : selected?.nodeType === "folder" ? (
    <CatalogFolderPanel
      node={selected}
      allNodes={allNodes}
      readOnly={readOnly}
      isCreating={isCreating}
      onCreate={(nodeType) =>
        nodeType === "folder" ? handleCreateFolder(selected.id) : handleCreateTemplate(selected.id)
      }
      onSelectChild={handleSelect}
      onDeleted={() => selectAfterDelete(selected.id)}
    />
  ) : (
    <ListGhostEmptyState
      layout="table"
      density="compact"
      rows={3}
      headingId="templates-detail-empty"
      icon={<MousePointerClick className="size-8" aria-hidden />}
      title={selectedId ? "节点不存在或已删除" : "从目录选择模板"}
      description={
        selectedId
          ? "请从左侧目录重新选择，或刷新页面。"
          : "在左侧目录中选择 Excel 或 PDF 模板，或选中文件夹后在此创建子项。"
      }
    />
  );

  const mobileOptions = allNodes.length > 0 ? allNodes : nodes;

  return (
    <AdminPageShell
      layout="list"
      title="文档模板"
      icon={
        <AdminPageHeaderIcon>
          <FileText className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description="维护目录、扩展配置、模板块与定时投递。"
      actions={<ReportCenterBackLink />}
    >
      {nodesQuery.isError ? (
        <PageErrorBanner message={mapApiError(nodesQuery.error)} onRetry={() => void nodesQuery.refetch()} />
      ) : null}

      <ListPageSection className="min-h-0 flex-1">
        {nodes.length === 0 && !nodesQuery.isLoading ? (
          <div className="flex min-h-[320px] flex-1 flex-col p-4 md:p-6">{catalogBody}</div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 xl:hidden dark:border-gray-800">
              {!readOnly && nodes.length > 0 ? templateCreateToolbar : null}
              <Select value={selectedId ?? "__none__"} onValueChange={(v) => handleSelect(v === "__none__" ? null : v)}>
                <SelectTrigger aria-label="选择目录节点" className="h-11">
                  <SelectValue placeholder="选择节点" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">选择节点…</SelectItem>
                  {mobileOptions.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {allNodes.length > 0 ? catalogNodePath(n, allNodes) : n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={REPORT_TEMPLATE_WORKBENCH_GRID_CLASS}>
              <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-b border-gray-200 xl:flex xl:border-b-0 xl:border-r dark:border-gray-800">
                <div className="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <div className="min-w-0">
                    <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">模板目录</h2>
                    <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                      {nodes.length > 0 ? `${nodes.length} 个根节点` : "按文件夹组织报表"}
                    </p>
                  </div>
                  {sidebarCreateToolbar ? <div className="mt-3">{sidebarCreateToolbar}</div> : null}
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-3">{catalogBody}</div>
              </aside>

              <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{detailBody}</section>
            </div>
          </>
        )}
      </ListPageSection>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deleteTarget?.name ?? "节点"}」？删除后无法恢复。
              {deleteTarget?.nodeType === "folder" ? "（须为空文件夹）" : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNode.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={deleteNode.isPending} onClick={confirmDelete}>
              {deleteNode.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}
