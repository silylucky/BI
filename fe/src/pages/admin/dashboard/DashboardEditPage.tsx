import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ChevronLeft, Clock, Redo2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { updateTemplate } from "@/lib/dashboardTemplates";
import {
  readTemplateEditSyncState,
  type TemplateEditSyncState,
} from "@/lib/templateEditSession";
import { TEMPLATE_EDIT_SESSION } from "@/components/dashboard/templates/templateLabels";
import { isDashboardNotFound, mapApiError } from "@/lib/apiError";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { resolveDashboardLayoutJson } from "@/lib/resolveDashboardLayoutJson";
import { DashboardShareDialog } from "@/components/dashboard/DashboardShareDialog";
import { DashboardScheduleSheet } from "@/pages/admin/reports/components/DashboardScheduleSheet";
import { useAuth } from "@/context/auth-context";
import { matchesCapability, resolveEffectiveCapabilities } from "@/lib/capabilities";
import { canEditDashboards, canShareDashboards, sessionUserFromMe } from "@/lib/session";
import {
  dataScreenListPath,
  dataScreenPreviewPath,
  dashboardPreviewPath,
  ensureDataScreenStyleConfig,
  isDataScreenAdminPath,
  isDataScreenLayout,
} from "@/lib/dataScreenLayout";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { GlobalFilterBar } from "@/components/dashboard/GlobalFilterBar";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import {
  buildWidgetFilterParams,
  mergeLayoutFilterLinkage,
  sanitizeLinkageForSave,
  type Linkage,
} from "@/components/dashboard/dashboardFilterUtils";
import { useChartLinkageState } from "@/components/dashboard/useChartLinkageState";
import {
  appendWidgetToTabPane,
  coerceLayoutWidgets,
  isTabPaneChild,
  moveWidget,
  moveWidgetToExtreme,
  resizeWidget,
  sortWidgets,
  type DashboardLayout,
  type DashboardLayoutV2,
  type DashboardStyleConfig,
  type FilterWidgetConfig,
  type LayoutWidget,
  type MediaWidgetConfig,
  type PixelLayoutWidget,
  type TabsWidgetConfig,
  type TextWidgetConfig,
  type CustomVizWidgetConfig,
} from "@/components/dashboard/layoutUtils";
import {
  pixelWidgetToLayoutWidget,
  prepareDashboardLayout,
} from "@/components/dashboard/dashboardCanvasMode";
import {
  insertClonedPixelWidget,
  insertPixelPaletteWidget,
  insertPixelPaletteWidgetAt,
  insertPaletteWidgetIntoTabHost,
  type PixelRect,
} from "@/components/dashboard/pixelCanvas";
import { TAB_PALETTE_DROP_BUFFER_PX } from "@/components/dashboard/pixelCanvas/tabPaletteDrop";
import {
  activePaneIdForTabHost,
  resolvePaletteInsertTabHost,
  type TabInsertIntent,
} from "@/components/dashboard/pixelCanvas/tabInsertResolver";
import { preservePixelCanvasHostScroll } from "@/components/dashboard/pixelCanvas/preserveCanvasHostScroll";
import { clampPixelLayoutToCanvasBounds } from "@/components/dashboard/pixelCanvas/layoutSanitize";
import { unparkPixelWidgetFromTab } from "@/components/dashboard/pixelCanvas/tabParking";
import {
  editorDirtySnapshot,
  editorResetBaselineSnapshot,
  hydrateDashboardStyle,
  layoutForEditorAfterPersist,
  persistDashboardLayout,
  preparePixelLayoutForDisplay,
  syncPixelLayoutChartStyles,
} from "@/components/dashboard/stylePipeline";
import { resolvePixelGutter } from "@/components/dashboard/dashboardStyleConfig";
import { resolveDashboardChrome } from "@/components/dashboard/dashboardChromeConfig";
import {
  compactPixelLayoutForGapChange,
  compactPixelLayoutOuterRects,
} from "@/components/dashboard/pixelCanvas/gapCompaction";
import { hasPositiveOuterGaps } from "@/components/dashboard/gapRuntimeProbe";
import { cloneLayoutWidget } from "@/components/dashboard/cloneLayoutWidget";
import type { WidgetClipboardEntry } from "@/components/dashboard/widgetClipboard";
import type { DashboardWidgetActions } from "@/components/dashboard/WidgetContextMenu";
import { applyWidgetQuickStyleAction } from "@/components/dashboard/widgetContextMenuStyle";
import {
  normalizeWidgetLayout,
  placeWidgetAt,
  placeWidgetAtGridCenter,
  placeWidgetExact,
} from "@/components/dashboard/gridLayoutAdapter";
import type { GridInsertAt } from "@/components/dashboard/DashboardGrid";
import {
  createPaletteWidget,
  type PaletteInsertType,
} from "@/components/dashboard/createLayoutWidget";
import type { PaletteDragPayload } from "@/lib/dashboardDnd";
import { readTabsWidgetIdFromDropEvent } from "@/lib/tabsDropTarget";
import { persistDashboardThumbnailBestEffort } from "@/lib/uploadDashboardThumbnail";
import { cn } from "@/lib/utils";
import { DashboardContextInspector } from "@/components/dashboard/DashboardContextInspector";
import { DashboardTemplateExtras } from "@/components/dashboard/DashboardTemplateExtras";
import { LayerPanel } from "@/components/dashboard/LayerPanel";
import { DashboardEditWorkspace } from "@/components/dashboard/DashboardEditWorkspace";
import { DASHBOARD_EDIT_RAIL_SCROLL_CLASS } from "@/components/dashboard/dashboardEditRailLayout";
import { DashboardEditCanvas } from "@/components/dashboard/dashboard-edit/DashboardEditCanvas";
import { ChartDrillProvider } from "@/components/charts/ChartDrillContext";
import { ChartEditRail, ChartEditRailEmpty } from "@/components/dashboard/ChartEditRail";
import { CustomVizEditRail } from "@/components/dashboard/custom-viz/CustomVizEditRail";
import { customVizBindingToChartConfig } from "@/components/dashboard/custom-viz/customVizExecute";
import { FilterWidgetInspector } from "@/components/dashboard/FilterWidgetInspector";
import { TextEditRail } from "@/components/dashboard/TextEditRail";
import { ScreenVisualEditRail } from "@/components/dashboard/screen/ScreenVisualEditRail";
import { DataScreenConfigExtras } from "@/components/dashboard/screen/DataScreenConfigExtras";
import {
  isScreenMaterialPresetPayload,
  isScreenVisualWidget,
  patchScreenMaterialPreset,
  toolbarScreenMaterialSkipsTabHost,
} from "@/lib/screenVisualAssets";
import { collectDashboardImageUrls } from "@/lib/collectDashboardImageUrls";
import {
  clampDataScreenCanvasSize,
} from "@/lib/surfacePreset";
import type { PresentationMode } from "@/components/dashboard/screen/presentationScale";
import { DATA_SCREEN_EDIT_PRESENTATION_DEFAULT } from "@/components/dashboard/screen/presentationScale";
import { MediaEditRail } from "@/components/dashboard/MediaEditRail";
import { TabsEditRail } from "@/components/dashboard/TabsEditRail";
import { VizReuseDialog } from "@/components/dashboard/VizReuseDialog";
import { PublishVizComponentDialog } from "@/components/dashboard/PublishVizComponentDialog";
import { VizComponentInspectorHeader } from "@/components/dashboard/VizComponentInspectorHeader";
import { useVizComponentMap } from "@/hooks/useVizComponentMap";
import { useVizComponentInspectorActions } from "@/hooks/useVizComponentInspectorActions";
import { resolveLayoutWidget, resolveLayoutWidgets } from "@/lib/resolveVizComponent";
import { awaitLinkedComponentWrites, instantiateVizComponentWidget, isPublishableWidgetType } from "@/lib/vizComponentEdit";
import { flushDebouncedDrafts } from "@/lib/debouncedDraftFlush";
import { fetchVizComponent } from "@/lib/vizComponents";
import { WidgetEnlargeDialog } from "@/components/dashboard/widget-actions/WidgetEnlargeDialog";
import { WidgetViewDataDialog } from "@/components/dashboard/widget-actions/WidgetViewDataDialog";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { DashboardInlineTitle } from "@/components/dashboard/DashboardInlineTitle";
import { useDashboardCanvasState } from "@/hooks/useDashboardCanvasState";
import { useWidgetSelection } from "@/hooks/useWidgetSelection";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import { Button, IconButton } from "@/components/ui/button";
import { SaveFormButton } from "@/components/ui/save-form-button";
import { Skeleton } from "@/components/ui/skeleton";
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

type DashboardDetail = {
  id: string;
  name: string;
  layoutJson: DashboardLayout;
};

type DashboardEditPageProps = {
  mode: "edit" | "view";
};

function isLinkageNotConfigured(err: unknown): boolean {
  if (err instanceof ApiRequestError) {
    return err.code === "DASH_FILTER_NOT_FOUND" || err.code === "NOT_FOUND";
  }
  return false;
}

async function fetchDashboardLinkage(dashboardId: string): Promise<Linkage | null> {
  try {
    return await apiFetch<Linkage>(`/api/v1/dashboards/${dashboardId}/global-filters`);
  } catch (err) {
    if (isLinkageNotConfigured(err)) return null;
    toast.warning(`全局筛选联动加载失败：${mapApiError(err)}`);
    return null;
  }
}

function linkageSnapshot(widgets: LayoutWidget[], linkage: Linkage | null): string {
  return JSON.stringify(mergeLayoutFilterLinkage(widgets, linkage));
}

export function DashboardEditPage({ mode }: DashboardEditPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const sessionUser = user ? sessionUserFromMe(user) : null;
  const canEditDashboard = sessionUser ? canEditDashboards(sessionUser) : false;
  const canShareDashboard = sessionUser ? canShareDashboards(sessionUser) : false;
  const canManageSchedule =
    matchesCapability(resolveEffectiveCapabilities(user), "report:manage") ||
    matchesCapability(resolveEffectiveCapabilities(user), "dashboard:schedule");
  const routeIsDataScreen = isDataScreenAdminPath(location.pathname);
  const initialTemplateEditSync = useMemo(
    () => readTemplateEditSyncState(location.state),
    [location.state],
  );
  const [templateEditSync, setTemplateEditSync] = useState<TemplateEditSyncState | null>(
    initialTemplateEditSync,
  );
  const templateEditSyncRef = useRef(templateEditSync);
  templateEditSyncRef.current = templateEditSync;

  useEffect(() => {
    setTemplateEditSync(initialTemplateEditSync);
  }, [initialTemplateEditSync]);

  useEffect(() => {
    if (mode !== "edit") return undefined;
    setChartAnimationSuppressed(true);
    return () => setChartAnimationSuppressed(false);
  }, [mode]);

  const [name, setName] = useState("");
  const pixelEnabled = true;
  const {
    editor,
    canSave,
    layout,
    widgets,
    setWidgets,
    resetLayout,
    setPixelLayout,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDashboardCanvasState({
    keyboardEnabled: mode === "edit",
    pixelEnabled,
    editable: mode === "edit",
  });
  const { componentMap, refetch: refetchComponents } = useVizComponentMap(widgets);
  const [loading, setLoading] = useState(true);
  const isDataScreenSurface = useMemo(() => {
    if (!loading && layout) {
      return isDataScreenLayout(layout);
    }
    return routeIsDataScreen;
  }, [layout, loading, routeIsDataScreen]);
  const listPath = isDataScreenSurface ? dataScreenListPath() : "/admin/dashboards";
  const routeBase = isDataScreenSurface ? "/admin/data-screens" : "/admin/dashboards";
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDashboardOpen, setDeleteDashboardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 看板已在服务端删除/不存在：禁止继续编辑僵尸页 */
  const [missing, setMissing] = useState(false);
  /** 非 404 的加载失败：禁止在空画布上编辑 */
  const [loadFailed, setLoadFailed] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [linkage, setLinkage] = useState<Linkage | null>(null);
  const {
    selectedIds,
    primarySelectedId,
    handleSelect,
    clearSelection,
    removeFromSelection,
    pruneMissing,
  } = useWidgetSelection();
  const [savedName, setSavedName] = useState("");
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [savedLinkageSnapshot, setSavedLinkageSnapshot] = useState<string | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [styleConfig, setStyleConfig] = useState<DashboardStyleConfig>({});
  const dashboardImageUrls = useMemo(
    () => collectDashboardImageUrls(widgets, styleConfig),
    [widgets, styleConfig],
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [publishComponentOpen, setPublishComponentOpen] = useState(false);
  const [chartRailOpen, setChartRailOpen] = useState(true);
  const [chartRefreshKeys, setChartRefreshKeys] = useState<Record<string, number>>({});
  const pixelViewportRef = useRef<PixelRect | undefined>(undefined);
  const handlePixelViewportChange = useCallback((viewport: PixelRect) => {
    pixelViewportRef.current = viewport;
  }, []);
  const [widgetActionDialog, setWidgetActionDialog] = useState<{
    type: "view-data" | "enlarge";
    widgetId: string;
  } | null>(null);
  const [widgetClipboard, setWidgetClipboard] = useState<WidgetClipboardEntry | null>(null);

  const layoutRef = useRef(layout);
  const styleConfigRef = useRef(styleConfig);
  const nameRef = useRef(name);
  const linkageRef = useRef(linkage);
  const widgetsRef = useRef(widgets);
  layoutRef.current = layout;
  styleConfigRef.current = styleConfig;
  nameRef.current = name;
  linkageRef.current = linkage;
  widgetsRef.current = widgets;

  const applyName = useCallback((value: SetStateAction<string>) => {
    setName((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      nameRef.current = next;
      return next;
    });
  }, []);

  const applyStyleConfig = useCallback((value: SetStateAction<DashboardStyleConfig>) => {
    const prev = styleConfigRef.current;
    const raw = typeof value === "function" ? value(prev) : value;
    const next = hydrateDashboardStyle(raw);
    styleConfigRef.current = next;
    setStyleConfig(next);

    const currentLayout = layoutRef.current;
    if (currentLayout.version === 2 && currentLayout.widgets.length > 0) {
      const prevGap = resolvePixelGutter(prev);
      const nextGap = resolvePixelGutter(next);
      // 仅间隙配置变更时收紧外框；避免切换字体/网格等无关项反复 compact + toast
      if (prevGap !== nextGap) {
        const shouldCompact =
          nextGap < prevGap ||
          (nextGap === 0 && hasPositiveOuterGaps(currentLayout.widgets));
        if (shouldCompact) {
          const result =
            nextGap === 0
              ? compactPixelLayoutOuterRects(currentLayout)
              : compactPixelLayoutForGapChange(currentLayout, prevGap, nextGap);
          if (result.compacted) {
            setPixelLayout(result.layout);
          }
        }
      }
    }
  }, [setPixelLayout]);

  const applyLinkage = useCallback((value: SetStateAction<Linkage | null>) => {
    setLinkage((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      linkageRef.current = next;
      return next;
    });
  }, []);

  const loadGenerationRef = useRef(0);
  const hydratedRef = useRef(false);
  const isDirtyRef = useRef(false);

  const leaveEditShell = useCallback(() => {
    // 先清脏标记，避免离开守卫/二次操作卡在僵尸编辑态
    setMissing(true);
    resetLayout({ version: 1, widgets: [], globalFilters: [] });
    setSavedFingerprint(null);
    setSavedName("");
    setSavedLinkageSnapshot(null);
    setDeleteDashboardOpen(false);
    navigate(listPath, { replace: true });
  }, [navigate, resetLayout, listPath]);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    if (!id) return;
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    if (opts?.force) {
      hydratedRef.current = false;
      setSavedFingerprint(null);
      setSavedLinkageSnapshot(null);
    }
    try {
      const [data, loadedLinkage] = await Promise.all([
        apiFetch<DashboardDetail>(`/api/v1/dashboards/${id}`),
        fetchDashboardLinkage(id),
      ]);
      if (generation !== loadGenerationRef.current) return;
      if (!opts?.force && hydratedRef.current && isDirtyRef.current) {
        return;
      }
      setMissing(false);
      setName(data.name);
      nameRef.current = data.name;
      setSavedName(data.name);
      const layoutJson = resolveDashboardLayoutJson(data);
      const source =
        layoutJson.version === 1
          ? {
              ...layoutJson,
              widgets: normalizeWidgetLayout(
                sortWidgets(coerceLayoutWidgets(layoutJson.widgets ?? [])),
              ),
            }
          : layoutJson;
      const prepared = prepareDashboardLayout(
        source,
        mode === "edit" ? pixelEnabled : false,
      );
      const hydratedStyle = hydrateDashboardStyle(prepared.layout.styleConfig);
      let layoutForEditor: typeof prepared.layout = {
        ...prepared.layout,
        styleConfig: hydratedStyle,
      };
      if (layoutForEditor.version === 2) {
        layoutForEditor = syncPixelLayoutChartStyles(
          layoutForEditor,
          hydratedStyle.colorScheme ?? "light",
        );
        layoutForEditor = preparePixelLayoutForDisplay(layoutForEditor, hydratedStyle);
      }
      resetLayout(layoutForEditor);
      setStyleConfig(hydratedStyle);
      styleConfigRef.current = hydratedStyle;
      const loadSnapshot = editorResetBaselineSnapshot(
        layoutForEditor,
        hydratedStyle,
        mode === "edit" ? pixelEnabled : false,
      );
      setSavedFingerprint(loadSnapshot.fingerprint);
      setSavedLinkageSnapshot(linkageSnapshot(loadSnapshot.widgets, loadedLinkage));
      setLinkage(loadedLinkage);
      linkageRef.current = loadedLinkage;
      pixelViewportRef.current = undefined;
      clearSelection();
      hydratedRef.current = true;
      setFilterValues(() => {
        const next: Record<string, string> = {};
        for (const filter of loadedLinkage?.filters ?? []) {
          if (filter.defaultValue) next[filter.filterId] = filter.defaultValue;
        }
        for (const w of prepared.layout.widgets) {
          if (w.type === "filter" && w.filterConfig) {
            const fid = w.filterConfig.filterId;
            if (next[fid] === undefined && w.filterConfig.defaultValue) {
              next[fid] = w.filterConfig.defaultValue;
            }
          }
        }
        return next;
      });
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      if (isDashboardNotFound(err)) {
        setMissing(true);
        setLoadFailed(false);
        resetLayout({ version: 1, widgets: [], globalFilters: [] });
        setSavedFingerprint(JSON.stringify({ version: 1, widgets: [], globalFilters: [] }));
        setError(mapApiError(err));
      } else {
        setLoadFailed(true);
        setMissing(false);
        resetLayout({ version: 1, widgets: [], globalFilters: [] });
        setSavedFingerprint(null);
        setSavedLinkageSnapshot(null);
        setError(mapApiError(err));
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [id, resetLayout, clearSelection, mode, pixelEnabled]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    hydratedRef.current = false;
    void loadRef.current({ force: true });
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [id, mode]);

  useEffect(() => {
    if (mode !== "edit") return;
    pruneMissing(widgets.map((w) => w.id));
  }, [mode, widgets, pruneMissing]);

  const isDirty = useMemo(() => {
    if (missing || savedFingerprint === null) return false;
    const effectiveStyle = ensureDataScreenStyleConfig(styleConfig, isDataScreenSurface);
    const snapshot = editorDirtySnapshot(layout, effectiveStyle, pixelEnabled);
    return (
      snapshot.fingerprint !== savedFingerprint ||
      name.trim() !== savedName ||
      (savedLinkageSnapshot !== null &&
        linkageSnapshot(snapshot.widgets, linkage) !== savedLinkageSnapshot)
    );
  }, [
    missing,
    savedFingerprint,
    savedLinkageSnapshot,
    layout,
    styleConfig,
    pixelEnabled,
    name,
    savedName,
    linkage,
    isDataScreenSurface,
  ]);

  isDirtyRef.current = isDirty;

  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: mode === "edit" && canSave && isDirty && !missing,
  });

  const selectedWidget = useMemo(
    () => widgets.find((w) => w.id === primarySelectedId) ?? null,
    [widgets, primarySelectedId],
  );
  const resolvedSelectedWidget = useMemo(
    () => (selectedWidget ? resolveLayoutWidget(selectedWidget, componentMap) : null),
    [selectedWidget, componentMap],
  );
  const resolvedWidgets = useMemo(
    () => resolveLayoutWidgets(widgets, componentMap),
    [widgets, componentMap],
  );
  const vizInspectorActions = useVizComponentInspectorActions({
    primarySelectedId,
    selectedWidget,
    resolvedSelectedWidget,
    widgets,
    componentMap,
    setWidgets,
    refetchComponents,
  });
  const inspectorWidget = resolvedSelectedWidget ?? selectedWidget;
  const multiSelectCount = selectedIds.size;
  const canPublishSelected =
    multiSelectCount < 2 &&
    Boolean(selectedWidget && isPublishableWidgetType(selectedWidget.type));
  const collapseChartRail = useCallback(() => setChartRailOpen(false), []);

  const vizComponentHeader =
    selectedWidget && isPublishableWidgetType(selectedWidget.type) ? (
      <VizComponentInspectorHeader
        widget={selectedWidget}
        resolvedWidget={resolvedSelectedWidget ?? selectedWidget}
        componentMap={componentMap}
        onDetach={vizInspectorActions.detach}
        onPublish={() => setPublishComponentOpen(true)}
        onCollapse={collapseChartRail}
      />
    ) : null;

  const selectWidgetOnCanvas = useCallback(
    (widgetId: string, additive: boolean) => {
      preservePixelCanvasHostScroll(() => {
        const w = widgets.find((x) => x.id === widgetId);
        if (
          w &&
          (w.type === "chart" ||
            w.type === "customViz" ||
            w.type === "media" ||
            w.type === "tabs" ||
            w.type === "filter" ||
            w.type === "text")
        ) {
          setChartRailOpen(true);
        }
        handleSelect(widgetId, additive);
      });
    },
    [handleSelect, widgets],
  );

  const selectNestedWidgetOnCanvas = useCallback(
    (widgetId: string, additive: boolean) => {
      preservePixelCanvasHostScroll(() => {
        setChartRailOpen(true);
        handleSelect(widgetId, false);
      });
    },
    [handleSelect],
  );

  const selectTabChildWidget = useCallback(
    (childId: string) => {
      preservePixelCanvasHostScroll(() => {
        setChartRailOpen(true);
        handleSelect(childId, false);
      });
    },
    [handleSelect],
  );

  const [tabInsertIntent, setTabInsertIntent] = useState<TabInsertIntent | null>(null);
  const [dataScreenEditPresentationMode, setDataScreenEditPresentationMode] =
    useState<PresentationMode>(DATA_SCREEN_EDIT_PRESENTATION_DEFAULT);

  /** 对标 DE：选中 Tab（或其子组件）即锁定投放意图 */
  useEffect(() => {
    if (selectedWidget?.type === "tabs" && selectedWidget.tabsConfig) {
      setTabInsertIntent({
        tabsWidgetId: selectedWidget.id,
        paneId: selectedWidget.tabsConfig.activePaneId,
      });
      return;
    }
    if (layout.version === 2 && selectedWidget?.id) {
      const pixelChild = layout.widgets.find((w) => w.id === selectedWidget.id);
      if (pixelChild?.parentTabsId && pixelChild.tabPaneId) {
        setTabInsertIntent({
          tabsWidgetId: pixelChild.parentTabsId,
          paneId: pixelChild.tabPaneId,
        });
        return;
      }
    }
    setTabInsertIntent(null);
  }, [
    layout,
    selectedWidget?.id,
    selectedWidget?.type,
    selectedWidget?.tabsConfig?.activePaneId,
    selectedWidget?.tabsConfig,
  ]);

  const openDashboardContext = useCallback(() => {
    clearSelection();
    setChartRailOpen(true);
  }, [clearSelection]);

  const effectiveLinkage = useMemo(
    () => mergeLayoutFilterLinkage(resolvedWidgets, linkage),
    [resolvedWidgets, linkage],
  );

  const { chartLinkageRuntime, handleChartLinkageClick } = useChartLinkageState(
    resolvedWidgets,
  );

  const widgetActionTarget = useMemo(
    () =>
      widgetActionDialog
        ? (resolvedWidgets.find((item) => item.id === widgetActionDialog.widgetId) ?? null)
        : null,
    [widgetActionDialog, resolvedWidgets],
  );

  const widgetActionChartConfig = useMemo((): ChartViewConfig | null => {
    if (!widgetActionTarget) return null;
    if (widgetActionTarget.type === "chart" && widgetActionTarget.chartConfig) {
      return { ...widgetActionTarget.chartConfig, chartId: widgetActionTarget.id };
    }
    if (widgetActionTarget.type === "customViz" && widgetActionTarget.customVizConfig) {
      return {
        ...customVizBindingToChartConfig(widgetActionTarget.customVizConfig.dataBinding),
        chartId: widgetActionTarget.id,
      };
    }
    return null;
  }, [widgetActionTarget]);

  const widgetActionFilterParams = useMemo(() => {
    if (!widgetActionTarget) return undefined;
    if (widgetActionTarget.type !== "chart" && widgetActionTarget.type !== "customViz") {
      return undefined;
    }
    return buildWidgetFilterParams(
      widgetActionTarget.id,
      effectiveLinkage,
      filterValues,
      chartLinkageRuntime,
    );
  }, [widgetActionTarget, effectiveLinkage, filterValues, chartLinkageRuntime]);

  const widgetActionExecuteKey = useMemo(() => {
    if (!widgetActionTarget) return undefined;
    return JSON.stringify({
      filters: filterValues,
      refresh: chartRefreshKeys[widgetActionTarget.id] ?? 0,
    });
  }, [widgetActionTarget, filterValues, chartRefreshKeys]);

  const closeWidgetActionDialog = useCallback((open: boolean) => {
    if (!open) setWidgetActionDialog(null);
  }, []);

  const commitPixelPaletteInsert = useCallback(
    (
      type: PaletteInsertType | PaletteDragPayload,
      options?: {
        point?: { x: number; y: number };
        tabsWidgetIdFromDom?: string | null;
        tabsWidgetId?: string | null;
      },
    ) => {
      if (missing || !canSave || layout.version !== 2) return;
      const insertType = type as PaletteInsertType;
      const tabsHost = resolvePaletteInsertTabHost(insertType, layout, {
        tabsWidgetId: options?.tabsWidgetIdFromDom ?? options?.tabsWidgetId,
        point: options?.point,
        selectedWidgetId: primarySelectedId,
        intent: tabInsertIntent,
        dropBufferPx: TAB_PALETTE_DROP_BUFFER_PX,
      });
      let nextLayout: DashboardLayoutV2;
      if (tabsHost?.tabsConfig) {
        const paneId = activePaneIdForTabHost(
          tabsHost,
          tabInsertIntent,
          layout.widgets.find((w) => w.id === primarySelectedId),
        );
        nextLayout = insertPaletteWidgetIntoTabHost(insertType, layout, tabsHost, paneId);
      } else {
        nextLayout = options?.point
          ? insertPixelPaletteWidgetAt(insertType, layout, options.point)
          : insertPixelPaletteWidget(insertType, layout, pixelViewportRef.current);
      }
      const draft = nextLayout.widgets.find(
        (item) => !layout.widgets.some((widget) => widget.id === item.id),
      );
      if (!draft) return;
      if (tabsHost?.tabsConfig) {
        preservePixelCanvasHostScroll(() => {
          setPixelLayout(nextLayout);
          handleSelect(tabsHost.id, false);
          setChartRailOpen(true);
        });
      } else {
        setPixelLayout(nextLayout);
        handleSelect(draft.id, false);
        if (draft.type === "chart" || draft.type === "customViz") {
          setChartRailOpen(true);
        }
      }
      if (draft.type === "filter" && draft.filterConfig) {
        setFilterValues((previous) => ({
          ...previous,
          [draft.filterConfig!.filterId]: draft.filterConfig!.defaultValue ?? "",
        }));
      }
    },
    [
      canSave,
      handleSelect,
      layout,
      missing,
      primarySelectedId,
      setPixelLayout,
      tabInsertIntent,
    ],
  );

  const appendWidget = (type: PaletteInsertType, at?: GridInsertAt) => {
    if (missing || !canSave) return;
    if (layout.version === 2) {
      commitPixelPaletteInsert(
        type,
        tabInsertIntent &&
          type !== "tabs" &&
          !toolbarScreenMaterialSkipsTabHost(type)
          ? { tabsWidgetId: tabInsertIntent.tabsWidgetId }
          : undefined,
      );
      return;
    }
    const tabsHost =
      selectedWidget?.type === "tabs" &&
      selectedWidget.tabsConfig &&
      type !== "tabs" &&
      !toolbarScreenMaterialSkipsTabHost(type)
        ? selectedWidget
        : null;
    let draft = createPaletteWidget(type, widgets, at);
    if (tabsHost?.tabsConfig) {
      draft = {
        ...draft,
        parentTabsId: tabsHost.id,
        tabPaneId: tabsHost.tabsConfig.activePaneId,
        colSpan: 12,
        rowSpan: 2,
      };
    }
    let next: LayoutWidget[];
    if (tabsHost?.tabsConfig && draft.parentTabsId) {
      next = sortWidgets([...widgets, draft]);
      next = appendWidgetToTabPane(
        next,
        tabsHost.id,
        tabsHost.tabsConfig.activePaneId,
        draft.id,
      );
    } else {
      const placed =
        at?.exact === true
          ? placeWidgetExact(draft, {
              gridX: at.gridX,
              gridY: at.gridY,
              colSpan: at.colSpan,
              rowSpan: at.rowSpan,
            })
          : at != null
            ? placeWidgetAt(widgets, draft, at.gridX, at.gridY)
            : placeWidgetAtGridCenter(widgets, draft);
      next = sortWidgets([...widgets, placed]);
      draft = placed;
    }
    setWidgets(next);
    handleSelect(draft.id, false);
    if (draft.type === "chart" || draft.type === "customViz") {
      setChartRailOpen(true);
    }
    if (draft.type === "filter" && draft.filterConfig) {
      setFilterValues((prev) => ({
        ...prev,
        [draft.filterConfig!.filterId]: draft.filterConfig!.defaultValue ?? "",
      }));
    }
  };

  const appendClonedWidget = (widget: LayoutWidget, sourcePixel?: PixelLayoutWidget) => {
    if (missing || !canSave) return;
    if (layout.version === 2) {
      const nextLayout = insertClonedPixelWidget(widget, layout, pixelViewportRef.current, sourcePixel);
      const draft = nextLayout.widgets.find((item) => item.id === widget.id);
      if (!draft) return;
      setPixelLayout(nextLayout);
      handleSelect(draft.id, false);
      return;
    }
    const placed = placeWidgetAtGridCenter(widgets, widget);
    setWidgets((prev) => sortWidgets([...prev, placed]));
    handleSelect(placed.id, false);
  };

  const appendClonedWidgetRef = useRef(appendClonedWidget);
  appendClonedWidgetRef.current = appendClonedWidget;
  const insertFromHubRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || loading || missing || !canSave) return;
    const componentId = new URLSearchParams(location.search).get("insertComponent");
    if (!componentId) {
      insertFromHubRef.current = null;
      return;
    }
    if (insertFromHubRef.current === componentId) return;
    insertFromHubRef.current = componentId;

    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchVizComponent(componentId);
        if (cancelled) return;
        const instance = instantiateVizComponentWidget(detail, widgetsRef.current);
        appendClonedWidgetRef.current(instance);
        refetchComponents();
        navigate(location.pathname, { replace: true });
        toast.success(`已插入组件「${detail.name}」`);
      } catch (err) {
        if (cancelled) return;
        toast.error(mapApiError(err));
        navigate(location.pathname, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, loading, missing, canSave, location.search, location.pathname, navigate, refetchComponents]);

  const handleInsert = (type: PaletteInsertType) => {
    if (primarySelectedId && selectedWidget && isScreenMaterialPresetPayload(type)) {
      const patched = patchScreenMaterialPreset(selectedWidget, type);
      if (patched) {
        setWidgets((prev) =>
          prev.map((w) => (w.id === primarySelectedId ? patched : w)),
        );
        return;
      }
    }
    appendWidget(type);
  };

  const handleDropInsert = (type: PaletteInsertType, at: GridInsertAt) => {
    appendWidget(type, at);
  };

  const handlePaletteDrop = (
    type: PaletteDragPayload,
    point: { x: number; y: number },
    sourceEvent?: DragEvent,
  ) => {
    const tabsWidgetIdFromDom = sourceEvent ? readTabsWidgetIdFromDropEvent(sourceEvent) : null;
    commitPixelPaletteInsert(type, { point, tabsWidgetIdFromDom });
  };

  const handleTabPaletteDrop = useCallback(
    (tabsWidgetId: string, type: PaletteDragPayload) => {
      commitPixelPaletteInsert(type, { tabsWidgetId });
    },
    [commitPixelPaletteInsert],
  );

  const handleTabChildUnpark = useCallback(
    (widgetId: string, point: PixelPoint) => {
      if (missing || !canSave || layout.version !== 2) return;
      preservePixelCanvasHostScroll(() => {
        const next = unparkPixelWidgetFromTab(layout, widgetId, point);
        setPixelLayout(next);
        handleSelect(widgetId, false);
        setChartRailOpen(true);
      });
    },
    [canSave, handleSelect, layout, missing, setPixelLayout],
  );

  const handleFilterValueChange = (filterId: string, value: string) => {
    if (mode === "edit" && !canSave) return;
    setFilterValues((prev) => ({ ...prev, [filterId]: value }));
  };

  const handleChartDataRefresh = useCallback((widgetId: string) => {
    setChartRefreshKeys((prev) => ({ ...prev, [widgetId]: (prev[widgetId] ?? 0) + 1 }));
  }, []);

  const handleDeleteWidget = (widgetId: string) => {
    if (!canSave) return;
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    removeFromSelection([widgetId]);
  };

  const handleCopyWidget = useCallback(
    (widgetId: string) => {
      if (!canSave) return;
      const source = widgets.find((w) => w.id === widgetId);
      if (!source) return;
      const sourcePixel =
        layout.version === 2 ? layout.widgets.find((w) => w.id === widgetId) : undefined;
      setWidgetClipboard({
        widget: structuredClone(source),
        sourcePixel: sourcePixel ? structuredClone(sourcePixel) : undefined,
      });
      toast.success("已复制组件");
    },
    [canSave, widgets, layout],
  );

  const handlePasteWidget = useCallback(() => {
    if (!canSave || !widgetClipboard) return;
    appendClonedWidget(
      cloneLayoutWidget(widgetClipboard.widget, widgets),
      widgetClipboard.sourcePixel,
    );
  }, [canSave, widgetClipboard, widgets, appendClonedWidget]);

  const openWidgetViewDataDialog = useCallback((widgetId: string) => {
    const target = widgets.find((item) => item.id === widgetId);
    if (target?.type !== "chart" && target?.type !== "customViz") return;
    setWidgetActionDialog({ type: "view-data", widgetId });
  }, [widgets]);

  const openWidgetEnlargeDialog = useCallback((widgetId: string) => {
    const target = widgets.find((item) => item.id === widgetId);
    if (target?.type !== "chart") return;
    setWidgetActionDialog({ type: "enlarge", widgetId });
  }, [widgets]);

  const handleWidgetStyleQuickAction = useCallback(
    (
      widgetId: string,
      action: Parameters<typeof applyWidgetQuickStyleAction>[1],
      options?: Parameters<typeof applyWidgetQuickStyleAction>[3],
    ) => {
      setWidgets((prev) =>
        prev.map((item) =>
          item.id === widgetId
            ? applyWidgetQuickStyleAction(item, action, {
                surface: isDataScreenSurface ? "data-screen" : "dashboard",
                dashboardStyle: styleConfig,
              }, options)
            : item,
        ),
      );
    },
    [isDataScreenSurface, setWidgets, styleConfig],
  );

  const dashboardWidgetActions = useMemo<DashboardWidgetActions>(
    () => ({
      surface: isDataScreenSurface ? "data-screen" : "dashboard",
      dashboardStyle: styleConfig,
      onCopy: handleCopyWidget,
      onPaste: handlePasteWidget,
      clipboardReady: Boolean(widgetClipboard),
      onDelete: handleDeleteWidget,
      onEnlarge: openWidgetEnlargeDialog,
      onViewData: openWidgetViewDataDialog,
      onStyleQuickAction: handleWidgetStyleQuickAction,
      onTitleChange: (widgetId, title) => {
        setWidgets((prev) => resizeWidget(prev, widgetId, { title }));
      },
      showLayerActions: isDataScreenSurface,
      onMoveLayerUp: isDataScreenSurface
        ? (widgetId) => setWidgets((prev) => moveWidget(prev, widgetId, "down"))
        : undefined,
      onMoveLayerDown: isDataScreenSurface
        ? (widgetId) => setWidgets((prev) => moveWidget(prev, widgetId, "up"))
        : undefined,
      onToggleHidden: isDataScreenSurface
        ? (widgetId) =>
            setWidgets((prev) =>
              prev.map((item) =>
                item.id === widgetId ? { ...item, hidden: !item.hidden } : item,
              ),
            )
        : undefined,
      onToggleLocked: isDataScreenSurface
        ? (widgetId) =>
            setWidgets((prev) =>
              prev.map((item) =>
                item.id === widgetId ? { ...item, locked: !item.locked } : item,
              ),
            )
        : undefined,
      onBringToFront: isDataScreenSurface
        ? (widgetId) => setWidgets((prev) => moveWidgetToExtreme(prev, widgetId, "top"))
        : undefined,
      onSendToBack: isDataScreenSurface
        ? (widgetId) => setWidgets((prev) => moveWidgetToExtreme(prev, widgetId, "bottom"))
        : undefined,
    }),
    [
      handleCopyWidget,
      handleDeleteWidget,
      handlePasteWidget,
      handleWidgetStyleQuickAction,
      isDataScreenSurface,
      openWidgetEnlargeDialog,
      openWidgetViewDataDialog,
      setWidgets,
      styleConfig,
      widgetClipboard,
    ],
  );

  const handleBatchDelete = () => {
    if (!canSave) return;
    const ids = [...selectedIds];
    setWidgets((prev) => prev.filter((w) => !selectedIds.has(w.id)));
    removeFromSelection(ids);
    setBatchDeleteOpen(false);
  };

  const handleDataScreenCanvasSize = useCallback(
    (patch: { width?: number; height?: number }) => {
      const currentLayout = layoutRef.current;
      if (!canSave || currentLayout.version !== 2) return;
      const width = patch.width ?? currentLayout.canvas.width;
      const height = patch.height ?? currentLayout.canvas.height;
      const next = clampDataScreenCanvasSize(width, height);
      if (
        next.width === currentLayout.canvas.width &&
        next.height === currentLayout.canvas.height
      ) {
        return;
      }
      setPixelLayout(
        clampPixelLayoutToCanvasBounds({
          ...currentLayout,
          canvas: next,
        }),
      );
      if (next.width !== width || next.height !== height) {
        toast.message(`画布尺寸已调整为 ${next.width}×${next.height}（已钳制到允许范围）`);
      }
    },
    [canSave, setPixelLayout],
  );

  const handleDeleteDashboard = async () => {
    if (!canSave) return;
    if (!id || missing) {
      leaveEditShell();
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/dashboards/${id}`, { method: "DELETE" });
      leaveEditShell();
    } catch (err) {
      if (isDashboardNotFound(err)) {
        leaveEditShell();
        return;
      }
      setError(mapApiError(err));
      setDeleteDashboardOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    if (!id || missing || !canSave) return false;
    if (saving) {
      toast.message("正在保存中，请稍候…");
      return false;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
    flushDebouncedDrafts();

    const currentLayout = layoutRef.current;
    const currentStyle = ensureDataScreenStyleConfig(
      styleConfigRef.current,
      isDataScreenSurface,
    );
    const currentName = nameRef.current;
    const currentLinkage = linkageRef.current;

    setSaving(true);
    setError(null);
    try {
      try {
        await awaitLinkedComponentWrites();
      } catch (syncErr) {
        toast.error(mapApiError(syncErr));
        return false;
      }
      try {
        await refetchComponents();
      } catch (refetchErr) {
        console.warn("[dashboard-save] component map refetch failed after flush", refetchErr);
      }

      const normalizedLayout = persistDashboardLayout(currentLayout, currentStyle);
      const normalized =
        normalizedLayout.version === 1
          ? normalizedLayout.widgets
          : normalizedLayout.widgets.map(pixelWidgetToLayoutWidget);
      const trimmedName = currentName.trim() || "未命名看板";
      const mergedLinkage = sanitizeLinkageForSave(
        normalized,
        mergeLayoutFilterLinkage(normalized, currentLinkage),
      );

      const editorSave = await apiFetch<{
        dashboard: { name: string };
        globalFilters?: Linkage;
      }>(`/api/v1/dashboards/${id}/editor-save`, {
        method: "PUT",
        body: JSON.stringify({
          name: trimmedName,
          layoutJson: normalizedLayout,
          globalFilters: {
            dashboardId: id,
            filters: mergedLinkage.filters,
            linkageRules: mergedLinkage.linkageRules,
            refreshMode: mergedLinkage.refreshMode ?? "eager",
          },
        }),
      });

      applyName(editorSave.dashboard.name);
      setSavedName(editorSave.dashboard.name);

      const thumbnailUploaded = await persistDashboardThumbnailBestEffort(id);
      if (thumbnailUploaded) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      }

      const savedStyle = hydrateDashboardStyle(normalizedLayout.styleConfig);
      const layoutForEditor = layoutForEditorAfterPersist(normalizedLayout, savedStyle);
      resetLayout(layoutForEditor);
      setStyleConfig(savedStyle);
      styleConfigRef.current = savedStyle;
      const saveSnapshot = editorResetBaselineSnapshot(
        layoutForEditor,
        savedStyle,
        pixelEnabled,
      );
      setSavedFingerprint(saveSnapshot.fingerprint);

      const nextLinkage = editorSave.globalFilters ?? currentLinkage;
      applyLinkage(nextLinkage);
      setSavedLinkageSnapshot(linkageSnapshot(saveSnapshot.widgets, nextLinkage));

      const activeTemplateSync = templateEditSyncRef.current;
      if (activeTemplateSync?.writable) {
        try {
          const updatedTemplate = await updateTemplate(activeTemplateSync.templateId, {
            layoutJson: normalizedLayout as unknown as Record<string, unknown>,
            contentRevision: activeTemplateSync.contentRevision,
          });
          const nextTemplateSync: TemplateEditSyncState = {
            ...activeTemplateSync,
            contentRevision: updatedTemplate.contentRevision,
          };
          setTemplateEditSync(nextTemplateSync);
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTemplates.all });
          toast.success(TEMPLATE_EDIT_SESSION.savedWithTemplate(activeTemplateSync.templateName));
        } catch (templateErr) {
          toast.error(
            `${TEMPLATE_EDIT_SESSION.templateSyncFailed}：${mapApiError(templateErr)}`,
          );
          return false;
        }
      } else {
        toast.success("看板已保存");
      }
      return true;
    } catch (err) {
      if (isDashboardNotFound(err)) {
        toast.error(mapApiError(err));
        leaveEditShell();
        return false;
      }
      toast.error(mapApiError(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLeave = async () => {
    const ok = await handleSave();
    if (ok) confirmLeave();
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link to={listPath}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">返回</span>
        </Link>
      </Button>

      {!missing ? (
        <>
          <span
            className="hidden h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block"
            aria-hidden
          />
          {mode === "edit" ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link
                  to={
                    isDataScreenSurface && id
                      ? dataScreenPreviewPath(id)
                      : id
                        ? dashboardPreviewPath(id)
                        : `${routeBase}/${id}`
                  }
                >
                  预览
                </Link>
              </Button>
              {canShareDashboard ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                  分享
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScheduleOpen(true)}
                aria-label="定时推送"
              >
                <Clock className="size-4 sm:mr-1" aria-hidden />
                <span className="hidden sm:inline">定时推送</span>
              </Button>
            </>
          ) : canEditDashboard ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`${routeBase}/${id}/edit`}>编辑布局</Link>
            </Button>
          ) : null}
          {mode === "view" && id && !isDataScreenSurface ? (
            <Button asChild variant="outline" size="sm">
              <Link to={dashboardPreviewPath(id)}>全屏预览</Link>
            </Button>
          ) : null}
        </>
      ) : null}

      {mode === "edit" && canSave && !missing && !loadFailed ? (
        <>
          <span
            className="hidden h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block"
            aria-hidden
          />
          <SaveFormButton
            type="button"
            variant="primary"
            size="sm"
            isDirty={isDirty}
            saving={saving}
            onClick={() => void handleSave()}
          />
          <IconButton
            type="button"
            variant="outline"
            size="sm"
            aria-label="删除看板"
            disabled={deleting}
            className="border-error-200 text-error-600 hover:border-error-300 hover:bg-error-50 hover:text-error-700 dark:border-error-500/30 dark:text-error-400 dark:hover:border-error-500/50 dark:hover:bg-error-500/10"
            onClick={() => setDeleteDashboardOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <AdminPageShell title="仪表板" description="加载中…">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="min-h-[320px] w-full rounded-2xl" />
      </AdminPageShell>
    );
  }

  if (missing) {
    return (
      <AdminPageShell
        title={name || "看板不存在"}
        description="该看板不存在或已被删除，无法继续编辑。"
        actions={headerActions}
      >
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-white/[0.02]">
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            {error ?? "看板不存在或已被删除"}
          </p>
          <Button asChild variant="primary" size="sm">
            <Link to={listPath}>{isDataScreenSurface ? "返回大屏列表" : "返回看板列表"}</Link>
          </Button>
        </div>
      </AdminPageShell>
    );
  }

  const pageTitle =
    mode === "edit" && !missing && canSave ? (
      <DashboardInlineTitle value={name} onChange={applyName} />
    ) : (
      name || "仪表板"
    );

  const titleUnwrapped = mode === "edit" && !missing && canSave;

  return (
    <AdminPageShell
      layout="fill"
      title={pageTitle}
      titleUnwrapped={titleUnwrapped}
      onHeaderBlankPointerDown={
        mode === "edit" && canSave ? openDashboardContext : undefined
      }
      description={
        mode === "edit"
          ? error
            ? "加载失败，请查看下方错误说明"
            : loading || savedFingerprint === null
              ? "加载看板布局中…"
              : !canSave
            ? "像素布局只读 · 当前回退开关禁止修改与保存"
            : isDirty
              ? "有未保存的更改 · 保存后生效"
              : "已保存 · 点击标题可重命名"
          : "预览模式 · 筛选器变更会刷新关联图表"
      }
      actions={headerActions}
    >
      {error ? (
        <PageErrorBanner
          message={error}
          onDismiss={() => setError(null)}
          onRetry={() => {
            void load({ force: true });
          }}
        />
      ) : null}

      {mode === "edit" && templateEditSync ? (
        <div
          className="mb-3 rounded-lg border border-brand-200 bg-brand-50/80 px-4 py-2.5 text-theme-xs text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
          data-testid="template-edit-sync-banner"
        >
          {templateEditSync.writable
            ? TEMPLATE_EDIT_SESSION.writableHint(templateEditSync.templateName)
            : TEMPLATE_EDIT_SESSION.builtinReadOnlyHint}
        </div>
      ) : null}

      {id && mode !== "edit" ? (
        <GlobalFilterBar
          dashboardId={id}
          values={filterValues}
          onChange={handleFilterValueChange}
          dashboardStyle={styleConfig}
        />
      ) : null}

      {mode === "edit" && canSave && !loadFailed ? (
        <>
        <ChartDrillProvider>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardEditWorkspace
          widgetCount={widgets.length}
          multiSelectCount={multiSelectCount}
          canvasEngine={editor === "pixel" ? "pixel" : "grid"}
          canvasColorScheme={styleConfig.colorScheme ?? "light"}
          chartRailOpen={chartRailOpen}
          onChartRailOpenChange={setChartRailOpen}
          chartRailLabel={isDataScreenSurface ? "大屏配置" : "仪表板配置"}
          showRailFoldHeader={!primarySelectedId && multiSelectCount < 2}
          canvasActions={
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {multiSelectCount >= 2 ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  删除选中 ({multiSelectCount})
                </Button>
              ) : null}
              <IconButton
                type="button"
                variant="ghost"
                size="xs"
                disabled={!canUndo}
                onClick={undo}
                tooltip="回退到上一步编辑 (Ctrl+Z)"
                aria-label="上一步"
              >
                <Undo2 aria-hidden />
              </IconButton>
              <IconButton
                type="button"
                variant="ghost"
                size="xs"
                disabled={!canRedo}
                onClick={redo}
                tooltip="前进到下一步编辑 (Ctrl+Shift+Z 或 Ctrl+Y)"
                aria-label="下一步"
              >
                <Redo2 aria-hidden />
              </IconButton>
              <span className="hidden text-theme-xs text-gray-400 sm:inline">
                {layout.version === 2
                  ? isDataScreenSurface
                    ? "1920px 画布"
                    : "1440px 画布"
                  : "12 列"}
              </span>
            </div>
          }
          onPaletteInsert={handleInsert}
          onOpenReuse={() => setReuseOpen(true)}
          onOpenPublishToLibrary={
            canPublishSelected ? () => setPublishComponentOpen(true) : undefined
          }
          publishToLibraryDisabled={!canPublishSelected}
          onOpenDashboardStyle={openDashboardContext}
          onActivateDashboardContext={openDashboardContext}
          showAuxiliaryGrid={resolveDashboardChrome(styleConfig).showAuxiliaryGrid}
          onAuxiliaryGridChange={(showAuxiliaryGrid) =>
            applyStyleConfig((prev) => ({
              ...prev,
              chrome: { ...prev.chrome, showAuxiliaryGrid },
            }))
          }
          showScreenVisualAssets={isDataScreenSurface}
          canvas={
            <DashboardEditCanvas
              mode="edit"
              editor={editor}
              layout={layout}
              widgets={widgets}
              selectedIds={selectedIds}
              linkage={effectiveLinkage}
              filterValues={filterValues}
              chartLinkage={chartLinkageRuntime}
              onChartLinkageClick={handleChartLinkageClick}
              styleConfig={styleConfig}
              chartRefreshKeys={chartRefreshKeys}
              setWidgets={setWidgets}
              setPixelLayout={setPixelLayout}
              onSelect={selectWidgetOnCanvas}
              onNestedSelect={selectNestedWidgetOnCanvas}
              onClearSelection={openDashboardContext}
              onDeleteWidget={handleDeleteWidget}
              onFilterValueChange={handleFilterValueChange}
              onDropInsert={handleDropInsert}
              onPaletteDrop={handlePaletteDrop}
              onTabPaletteDrop={handleTabPaletteDrop}
              onTabChildUnpark={handleTabChildUnpark}
              onViewportChange={handlePixelViewportChange}
              tabInsertIntent={tabInsertIntent}
              onTabInsertIntentChange={setTabInsertIntent}
              widgetActions={canSave ? dashboardWidgetActions : undefined}
              dataScreenPresentationMode={dataScreenEditPresentationMode}
            />
          }
          chartRail={
            multiSelectCount >= 2 ? (
              <ChartEditRailEmpty
                message={
                  <>
                    <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      已选中 {multiSelectCount} 个组件
                    </p>
                    <p className="mt-1 max-w-[240px] text-theme-xs text-gray-500 dark:text-gray-400">
                      Shift+点击可增减多选；使用画布工具栏批量删除。
                    </p>
                  </>
                }
              />
            ) : selectedWidget?.type === "filter" && inspectorWidget?.filterConfig ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {vizComponentHeader}
                <FilterWidgetInspector
                  embedded
                  widget={
                    inspectorWidget as typeof inspectorWidget & { filterConfig: FilterWidgetConfig }
                  }
                  onChange={(filterConfig) => {
                    void vizInspectorActions.applyPayloadChange(
                      { filterConfig },
                      { filterConfig },
                    );
                  }}
                />
              </div>
            ) : selectedWidget?.type === "text" && inspectorWidget?.textConfig ? (
              isScreenVisualWidget(selectedWidget) ? (
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  {vizComponentHeader}
                  <ScreenVisualEditRail
                    className="min-h-0 flex-1"
                    widget={
                      inspectorWidget as typeof inspectorWidget & { textConfig: TextWidgetConfig }
                    }
                    onTitleChange={(title) => {
                      if (!primarySelectedId) return;
                      setWidgets((prev) =>
                        prev.map((w) => (w.id === primarySelectedId ? { ...w, title } : w)),
                      );
                    }}
                    onTextConfigChange={(textConfig) => {
                      void vizInspectorActions.applyPayloadChange({ textConfig }, { textConfig });
                    }}
                    onDelete={() => handleDeleteWidget(primarySelectedId!)}
                  />
                </div>
              ) : (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {vizComponentHeader}
              <TextEditRail
                className="min-h-0 flex-1"
                highlightUrls={dashboardImageUrls}
                widget={
                  inspectorWidget as typeof inspectorWidget & { textConfig: TextWidgetConfig }
                }
                onTitleChange={(title) => {
                  if (!primarySelectedId) return;
                  setWidgets((prev) =>
                    prev.map((w) => (w.id === primarySelectedId ? { ...w, title } : w)),
                  );
                }}
                onConfigChange={(textConfig) => {
                  void vizInspectorActions.applyPayloadChange({ textConfig }, { textConfig });
                }}
                onDelete={() => handleDeleteWidget(primarySelectedId!)}
              />
              </div>
              )
            ) : selectedWidget?.type === "media" && inspectorWidget?.mediaConfig ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {vizComponentHeader}
              <MediaEditRail
                className="min-h-0 flex-1"
                widget={
                  inspectorWidget as typeof inspectorWidget & { mediaConfig: MediaWidgetConfig }
                }
                onChange={(mediaConfig) => {
                  void vizInspectorActions.applyPayloadChange({ mediaConfig }, { mediaConfig });
                }}
                onTitleChange={(title) => {
                  if (!primarySelectedId) return;
                  setWidgets((prev) =>
                    prev.map((w) => (w.id === primarySelectedId ? { ...w, title } : w)),
                  );
                }}
                onDelete={() => handleDeleteWidget(primarySelectedId!)}
              />
              </div>
            ) : selectedWidget?.type === "tabs" && selectedWidget.tabsConfig ? (
              <TabsEditRail
                widget={
                  selectedWidget as typeof selectedWidget & { tabsConfig: TabsWidgetConfig }
                }
                allWidgets={widgets}
                selectedChildId={
                  isTabPaneChild(widgets, selectedWidget.id, primarySelectedId)
                    ? primarySelectedId
                    : null
                }
                onChange={(tabsConfig) => {
                  if (!primarySelectedId) return;
                  setWidgets((prev) =>
                    prev.map((w) => (w.id === primarySelectedId ? { ...w, tabsConfig } : w)),
                  );
                }}
                onSelectChild={selectTabChildWidget}
                onTitleChange={(title) => {
                  if (!primarySelectedId) return;
                  setWidgets((prev) =>
                    prev.map((w) => (w.id === primarySelectedId ? { ...w, title } : w)),
                  );
                }}
                onDelete={() => handleDeleteWidget(primarySelectedId!)}
                onRailCollapse={collapseChartRail}
              />
            ) : selectedWidget?.type === "customViz" && inspectorWidget?.customVizConfig ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {vizComponentHeader}
                <CustomVizEditRail
                  key={primarySelectedId ?? selectedWidget.id}
                  className="min-h-0 flex-1"
                  dashboardStyle={styleConfig}
                  widget={
                    inspectorWidget as typeof inspectorWidget & {
                      customVizConfig: CustomVizWidgetConfig;
                    }
                  }
                  onTitleChange={(title) => {
                    if (!primarySelectedId) return;
                    setWidgets((prev) => resizeWidget(prev, primarySelectedId, { title }));
                  }}
                  onChange={(customVizConfig) => {
                    void vizInspectorActions.applyPayloadChange(
                      { customVizConfig },
                      { customVizConfig },
                    );
                  }}
                  onDelete={() => handleDeleteWidget(primarySelectedId!)}
                  onDataRefresh={() => primarySelectedId && handleChartDataRefresh(primarySelectedId)}
                />
              </div>
            ) : selectedWidget?.type === "chart" ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {vizComponentHeader}
              <ChartEditRail
                key={primarySelectedId ?? selectedWidget.id}
                className="min-h-0 flex-1"
                widget={inspectorWidget}
                dashboardId={id}
                dashboardStyle={styleConfig}
                dashboardWidgets={widgets}
                onTitleChange={(title) => {
                  if (!primarySelectedId) return;
                  setWidgets((prev) => resizeWidget(prev, primarySelectedId, { title }));
                }}
                onChange={(chartConfig) => {
                  void vizInspectorActions.applyPayloadChange({ chartConfig }, { chartConfig });
                }}
                onDelete={() => handleDeleteWidget(primarySelectedId!)}
                onDataRefresh={() => primarySelectedId && handleChartDataRefresh(primarySelectedId)}
              />
              </div>
            ) : id ? (
              <div className={cn(DASHBOARD_EDIT_RAIL_SCROLL_CLASS, "min-h-0 flex-1")}>
                {isDataScreenSurface && layout.version === 2 ? (
                  <DataScreenConfigExtras
                    layout={layout}
                    styleConfig={styleConfig}
                    widgets={widgets}
                    name={name}
                    canSave={canSave}
                    dashboardId={id}
                    presentationMode={dataScreenEditPresentationMode}
                    onPresentationModeChange={setDataScreenEditPresentationMode}
                    onCanvasSizeChange={handleDataScreenCanvasSize}
                  />
                ) : null}
                {isDataScreenSurface ? (
                  <LayerPanel
                    widgets={widgets}
                    selectedId={primarySelectedId}
                    onSelect={(widgetId) => selectWidgetOnCanvas(widgetId, false)}
                    onWidgetsChange={setWidgets}
                    onDelete={handleDeleteWidget}
                    onBringToFront={(widgetId) =>
                      setWidgets((prev) => moveWidgetToExtreme(prev, widgetId, "top"))
                    }
                    onSendToBack={(widgetId) =>
                      setWidgets((prev) => moveWidgetToExtreme(prev, widgetId, "bottom"))
                    }
                    className="shrink-0 border-b border-gray-100 pb-4 dark:border-white/[0.06]"
                  />
                ) : null}
                {!isDataScreenSurface ? (
                  <DashboardTemplateExtras
                    layout={layout}
                    styleConfig={styleConfig}
                    widgets={widgets}
                    name={name}
                    canSave={canSave}
                    dashboardId={id}
                  />
                ) : null}
                <DashboardContextInspector
                  embedded
                  widgetCount={widgets.length}
                  widgets={widgets}
                  styleConfig={styleConfig}
                  onStyleChange={applyStyleConfig}
                  onWidgetsChange={setWidgets}
                  isPixelLayout={layout.version === 2}
                  dashboardId={id}
                  linkage={linkage}
                  effectiveLinkage={effectiveLinkage}
                  onLinkageChange={applyLinkage}
                />
              </div>
            ) : null
          }
        />
        </div>
        <VizReuseDialog
          open={reuseOpen}
          onOpenChange={setReuseOpen}
          currentDashboardId={id}
          widgets={widgets}
          styleConfig={styleConfig}
          targetPixelWidgets={layout.version === 2 ? layout.widgets : undefined}
          onInsertCloned={appendClonedWidget}
          onAfterLibraryInsert={() => {
            void refetchComponents();
          }}
        />
        <PublishVizComponentDialog
          open={publishComponentOpen}
          onOpenChange={setPublishComponentOpen}
          widget={selectedWidget}
          styleConfig={styleConfig}
          componentMap={componentMap}
          onPublished={() => {
            void refetchComponents();
          }}
        />
        {widgetActionDialog?.type === "view-data" &&
          widgetActionTarget &&
          widgetActionChartConfig && (
            <WidgetViewDataDialog
              open
              onOpenChange={closeWidgetActionDialog}
              title={widgetActionTarget.title}
              chartConfig={widgetActionChartConfig}
              filterParameters={widgetActionFilterParams}
              executeKey={widgetActionExecuteKey}
              dashboardStyle={styleConfig}
            />
          )}
        {widgetActionDialog?.type === "enlarge" &&
          widgetActionTarget &&
          widgetActionChartConfig && (
            <WidgetEnlargeDialog
              open
              onOpenChange={closeWidgetActionDialog}
              widgetId={widgetActionTarget.id}
              title={widgetActionTarget.title}
              chartConfig={widgetActionChartConfig}
              filterParameters={widgetActionFilterParams}
              executeKey={widgetActionExecuteKey}
              styleConfig={styleConfig}
            />
          )}
        </ChartDrillProvider>
        </>
      ) : (
        <DashboardEditCanvas
          mode={mode}
          editor={editor}
          layout={layout}
          widgets={widgets}
          selectedIds={selectedIds}
          linkage={effectiveLinkage}
          filterValues={filterValues}
          chartLinkage={chartLinkageRuntime}
          onChartLinkageClick={handleChartLinkageClick}
          styleConfig={styleConfig}
          setWidgets={setWidgets}
          setPixelLayout={setPixelLayout}
          onSelect={selectWidgetOnCanvas}
          onNestedSelect={selectNestedWidgetOnCanvas}
          onClearSelection={clearSelection}
          onDeleteWidget={handleDeleteWidget}
          onFilterValueChange={handleFilterValueChange}
          onDropInsert={handleDropInsert}
          onPaletteDrop={handlePaletteDrop}
              onTabPaletteDrop={handleTabPaletteDrop}
              onTabChildUnpark={handleTabChildUnpark}
              onViewportChange={handlePixelViewportChange}
              tabInsertIntent={tabInsertIntent}
              onTabInsertIntentChange={setTabInsertIntent}
              dataScreenPresentationMode={dataScreenEditPresentationMode}
        />
      )}
      {mode === "edit" && canSave ? (
        <AlertDialog open={leaveDialogOpen} onOpenChange={(open) => !open && cancelLeave()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>未保存的更改</AlertDialogTitle>
              <AlertDialogDescription>
                布局有未保存的修改，离开后将丢失。请先保存布局，或确认放弃更改。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel onClick={cancelLeave}>留在此页</AlertDialogCancel>
              <AlertDialogAction variant="outline" onClick={confirmLeave}>
                放弃更改并离开
              </AlertDialogAction>
              <SaveFormButton
                type="button"
                variant="primary"
                size="sm"
                isDirty={isDirty}
                saving={saving}
                saveLabel="保存并离开"
                onClick={() => void handleSaveAndLeave()}
              />
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {mode === "edit" && canSave ? (
        <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>批量删除组件</AlertDialogTitle>
              <AlertDialogDescription>
                确定删除选中的 {multiSelectCount} 个组件？删除后需保存布局才会生效。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleBatchDelete}>删除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {mode === "edit" && canSave ? (
        <AlertDialog open={deleteDashboardOpen} onOpenChange={setDeleteDashboardOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除看板</AlertDialogTitle>
              <AlertDialogDescription>
                确定删除「{name || "未命名看板"}」？删除后无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => void handleDeleteDashboard()}
              >
                {deleting ? "删除中…" : "删除"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {id && !missing ? (
        <DashboardShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          dashboardId={id}
          isScreen={isDataScreenSurface}
          initialDetail={{ name, layoutJson: layout }}
        />
      ) : null}
      {id && !missing ? (
        <DashboardScheduleSheet
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          sourceId={id}
          sourceType={isDataScreenSurface ? "data_screen" : "dashboard"}
          sourceName={name || "未命名"}
          widgetCount={layout.widgets?.length ?? 0}
          readOnly={!canManageSchedule}
        />
      ) : null}
    </AdminPageShell>
  );
}
