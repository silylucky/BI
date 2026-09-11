import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { fetchWithTimeout, getAuthHeaders } from "@/lib/api";
import { resolveApiBaseUrl } from "@/lib/appBasePath";
import { resolveChartQueryLimit } from "@/lib/chartDeDisplay";
import { useChartExecute } from "@/components/charts/useChartExecute";
import {
  ADVANCED_CHART_ROW_CAP,
  capRows,
} from "@/components/charts/engine/buildDatasetEncoding";
import { fetchAiVizArtifactMeta } from "@/lib/aiVizArtifacts";
import { readCustomVizStyleHooks, type CustomVizStyleHooks } from "@/lib/customVizStyleHooks";
import { useElementSize } from "@/hooks/useElementSize";
import type { DashboardWidgetShell } from "./dashboardCanvasMode";
import type { LayoutWidget, CustomVizWidgetConfig, DashboardStyleConfig } from "./layoutUtils";
import {
  CUSTOM_VIZ_HOST_CLASS,
  CustomVizHostErrorBoundary,
  customVizHostStyle,
  mountCustomVizHtml,
} from "./customVizHost";
import {
  buildCustomVizRuntimeEncoding,
  customVizBindingToChartConfig,
  isCustomVizExecuteReady,
  resolveCustomVizSlotBindingHint,
} from "./custom-viz/customVizExecute";
import { resolveCustomVizRuntimeStyle } from "./custom-viz/customVizDisplayStyle";
import { buildCustomVizRuntimePayload, injectCustomVizPayload } from "./custom-viz/customVizPayload";
import type { CustomVizHostElement } from "./custom-viz/customVizRuntime";
import { resolveDashboardChrome } from "./dashboardChromeConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { gridWidgetShellClassName, GridWidgetShellFrame, resolveGridWidgetShell } from "./widgetRailStyleSections";

async function loadCustomVizArtifact(artifactId: string): Promise<{
  html: string;
  defaultStyle: Record<string, unknown>;
  fieldSlots?: Record<string, unknown>;
  styleHooks?: CustomVizStyleHooks;
}> {
  let defaultStyle: Record<string, unknown> = {};
  let fieldSlots: Record<string, unknown> | undefined;
  let styleHooks: CustomVizStyleHooks | undefined;
  let hash = "";
  try {
    const meta = await fetchAiVizArtifactMeta(artifactId);
    defaultStyle = meta.manifest.defaultStyle ?? {};
    fieldSlots = meta.fieldSlots;
    styleHooks = readCustomVizStyleHooks(meta.manifest as Record<string, unknown>);
    hash = meta.contentHash ?? "";
  } catch {
    defaultStyle = {};
  }
  const qs = hash ? `?h=${encodeURIComponent(hash)}` : "";
  const resp = await fetchWithTimeout(
    `${resolveApiBaseUrl()}/api/v1/ai-viz/artifacts/${encodeURIComponent(artifactId)}/entry${qs}`,
    { headers: { ...getAuthHeaders() } },
  );
  if (!resp.ok) {
    const body = (await resp.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "加载自定义组件失败");
  }
  return { html: await resp.text(), defaultStyle, fieldSlots, styleHooks };
}

type CustomVizWidgetProps = {
  widget: LayoutWidget & { customVizConfig: CustomVizWidgetConfig };
  mode: "edit" | "view";
  shell?: DashboardWidgetShell;
  nested?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
  dashboardStyle?: DashboardStyleConfig;
  showToolbarDelete?: boolean;
  filterParameters?: Record<string, string>;
  executeKey?: string;
};

export function CustomVizWidget({
  widget,
  mode,
  shell = "grid",
  nested = false,
  selected = false,
  onSelect,
  onDelete: _onDelete,
  onTitleChange: _onTitleChange,
  dashboardStyle,
  showToolbarDelete: _showToolbarDelete = true,
  filterParameters,
  executeKey,
}: CustomVizWidgetProps) {
  const cfg = widget.customVizConfig;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manifestDefaultStyle, setManifestDefaultStyle] = useState<Record<string, unknown>>({});
  const [manifestFieldSlots, setManifestFieldSlots] = useState<Record<string, unknown> | undefined>();
  const [manifestStyleHooks, setManifestStyleHooks] = useState<CustomVizStyleHooks | undefined>();
  const loadedHtmlRef = useRef(false);
  const showGridChrome = shell === "grid";
  const gridShell = resolveGridWidgetShell(widget, dashboardStyle);
  const inShapeShell = shell === "shape";
  const hostStyle = customVizHostStyle(dashboardStyle, cfg);
  const chrome = resolveDashboardChrome(dashboardStyle);
  const showEditToolbar = showGridChrome && mode === "edit" && chrome.showChartActionButtons;

  const chartCfg = customVizBindingToChartConfig(cfg.dataBinding);
  const executeReady = isCustomVizExecuteReady(cfg.dataBinding, manifestFieldSlots);
  const queryLimit = resolveChartQueryLimit(chartCfg, dashboardStyle ?? {});
  const { columns, rows, loading, error: executeError } = useChartExecute(chartCfg, {
    enabled: executeReady,
    filterParameters,
    executeKey,
    limit: queryLimit,
  });
  const showDataLoadingHint =
    executeReady && loading && columns.length === 0 && rows.length === 0 && chrome.showChartLoadingHint;

  const { rows: cappedRows, truncated: rowsTruncated } = useMemo(
    () => capRows(rows, ADVANCED_CHART_ROW_CAP),
    [rows],
  );

  const { ref: hostSizeRef, size: hostSize } = useElementSize<HTMLDivElement>({
    debounceMs: mode === "edit" ? 0 : 100,
  });

  const hostLayout = useMemo(
    () => ({
      width: Math.max(Math.round(hostSize.width), 1),
      height: Math.max(Math.round(hostSize.height), 1),
    }),
    [hostSize.width, hostSize.height],
  );

  const setHostRef = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      hostSizeRef(node);
      setHostEl((prev) => (prev === node ? prev : node));
    },
    [hostSizeRef],
  );

  useEffect(() => {
    let cancelled = false;
    let seq = 0;
    loadedHtmlRef.current = false;
    setHtml(null);
    setLoadError(null);

    async function load() {
      const artifactId = cfg.artifactId?.trim();
      if (!artifactId) {
        setLoadError("未绑定自定义组件，请在组件库中选择或重新配置");
        return;
      }
      const my = ++seq;
      try {
        const next = await loadCustomVizArtifact(artifactId);
        if (cancelled || my !== seq) return;
        loadedHtmlRef.current = true;
        setManifestDefaultStyle(next.defaultStyle);
        setManifestFieldSlots(next.fieldSlots);
        setManifestStyleHooks(next.styleHooks);
        setHtml(next.html);
        setLoadError(null);
      } catch (err) {
        if (cancelled || my !== seq) return;
        if (loadedHtmlRef.current) return;
        setHtml(null);
        setLoadError(err instanceof Error ? err.message : "加载自定义组件失败");
      }
    }

    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cfg.artifactId]);

  const runtimeStyle = useMemo(
    () =>
      resolveCustomVizRuntimeStyle({
        manifestDefault: manifestDefaultStyle,
        config: cfg,
        dashboardStyle,
      }),
    [manifestDefaultStyle, cfg.style, cfg.displayStyle, dashboardStyle],
  );

  const runtimeEncoding = useMemo(
    () => buildCustomVizRuntimeEncoding(cfg.dataBinding),
    [cfg.dataBinding],
  );

  const slotBindingHint = useMemo(
    () => resolveCustomVizSlotBindingHint(cfg.dataBinding, manifestFieldSlots),
    [cfg.dataBinding, manifestFieldSlots],
  );

  const runtimePayload = useMemo(
    () =>
      buildCustomVizRuntimePayload({
        executeReady,
        loading,
        error: executeError,
        columns,
        rows: cappedRows,
        style: runtimeStyle,
        encoding: runtimeEncoding,
        layout: hostLayout,
        truncated: rowsTruncated,
        rowCap: rowsTruncated ? ADVANCED_CHART_ROW_CAP : undefined,
        slotBindingHint,
      }),
    [
      cappedRows,
      columns,
      executeError,
      executeReady,
      hostLayout,
      loading,
      rowsTruncated,
      runtimeEncoding,
      runtimeStyle,
      slotBindingHint,
    ],
  );

  const runtimePayloadRef = useRef(runtimePayload);
  runtimePayloadRef.current = runtimePayload;

  useEffect(() => {
    if (!hostEl || !html) return undefined;
    try {
      const cleanup = mountCustomVizHtml(hostEl, html, { styleHooks: manifestStyleHooks });
      injectCustomVizPayload(hostEl, runtimePayloadRef.current);
      return cleanup;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "自定义组件渲染失败");
      return undefined;
    }
  }, [hostEl, html, manifestStyleHooks]);

  useEffect(() => {
    if (!hostEl || !html) return;
    if (!(hostEl as CustomVizHostElement).vsCv) return;
    injectCustomVizPayload(hostEl, runtimePayload);
  }, [hostEl, html, runtimePayload]);

  const body = loadError ? (
    <div className="flex h-full min-h-[64px] flex-col items-center justify-center gap-1 px-3 text-center text-theme-xs text-gray-500 dark:text-gray-400">
      <span>{loadError}</span>
      {cfg.dataBinding?.status === "manual" ? (
        <span className="text-theme-xs text-gray-400 dark:text-gray-500">数据待手动绑定</span>
      ) : null}
    </div>
  ) : html ? (
    <CustomVizHostErrorBoundary>
      <div className="relative flex size-full min-h-0 flex-col">
        {rowsTruncated ? (
          <p
            role="status"
            data-testid="custom-viz-truncated-banner"
            className="mb-1 shrink-0 px-1 text-theme-sm text-warning-600 dark:text-warning-400"
          >
            数据量较大，已采样显示前 {ADVANCED_CHART_ROW_CAP} 条
          </p>
        ) : null}
        <div className="relative min-h-0 flex-1">
          {showDataLoadingHint ? (
            <Skeleton
              className="absolute inset-0 rounded-lg"
              aria-busy="true"
              aria-label="图表加载中"
              data-testid="custom-viz-data-loading"
            />
          ) : null}
          <div
            ref={setHostRef}
            data-testid="custom-viz-host"
            className={`${CUSTOM_VIZ_HOST_CLASS} size-full min-h-[64px]`}
            style={hostStyle}
          />
        </div>
      </div>
    </CustomVizHostErrorBoundary>
  ) : (
    <div className="flex h-full min-h-[64px] items-center justify-center text-theme-xs text-gray-500 dark:text-gray-400">
      正在加载自定义组件…
    </div>
  );

  if (inShapeShell) {
    return (
      <div
        className={cn(
          "relative flex size-full min-h-0 flex-col overflow-hidden",
        )}
        onClick={onSelect}
      >
        {body}
      </div>
    );
  }

  return (
    <GridWidgetShellFrame
      shell={gridShell}
      widgetId={widget.id}
      className={gridWidgetShellClassName(showGridChrome, selected)}
    >
      {showEditToolbar ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.04]">
          <div
            className="dashboard-drag-handle flex shrink-0 cursor-grab items-center active:cursor-grabbing"
            role="group"
            aria-label="拖动以移动组件"
          >
            <GripVertical className="size-3.5 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden />
          </div>
          <span className="truncate text-theme-xs font-medium text-gray-700 dark:text-gray-200">{widget.title}</span>
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1 p-1">{body}</div>
    </GridWidgetShellFrame>
  );
}

export function isCustomVizConfigReady(config: CustomVizWidgetConfig | undefined): boolean {
  return Boolean(config?.artifactId?.trim());
}
