import type { DashboardWidgetBase } from "@/components/dashboard/dashboardLayoutContracts";
import { applyCustomVizEditOverlay } from "@/components/dashboard/custom-viz/customVizExecute";
import type { VizComponentDetail } from "@/lib/vizComponents";
import { isLinkedComponentRef } from "@/lib/vizComponents";
import { applyLinkedChartInstanceOverlay } from "@/lib/geoMapRegionPicker";

export type VizComponentMap = Map<string, VizComponentDetail>;

function rewriteIds(widget: DashboardWidgetBase, payload: Record<string, unknown>): DashboardWidgetBase {
  const next = { ...widget };
  if (next.type === "chart" && payload.chartConfig) {
    const chartConfig = { ...(payload.chartConfig as object), chartId: widget.id };
    next.chartConfig = chartConfig as DashboardWidgetBase["chartConfig"];
  }
  if (next.type === "filter" && payload.filterConfig) {
    const filterConfig = { ...(payload.filterConfig as object), filterId: widget.id };
    next.filterConfig = filterConfig as DashboardWidgetBase["filterConfig"];
  }
  if (next.type === "text" && payload.textConfig) {
    next.textConfig = { ...(payload.textConfig as object) } as DashboardWidgetBase["textConfig"];
  }
  if (next.type === "media" && payload.mediaConfig) {
    next.mediaConfig = { ...(payload.mediaConfig as object) } as DashboardWidgetBase["mediaConfig"];
  }
  if (next.type === "customViz" && payload.customVizConfig) {
    next.customVizConfig = { ...(payload.customVizConfig as object) } as DashboardWidgetBase["customVizConfig"];
  }
  return next;
}

function instanceOwnsPayload(widget: DashboardWidgetBase): boolean {
  if (widget.type === "chart") {
    const cfg = widget.chartConfig;
    if (!cfg) return false;
    // GIS 无底图数据集绑定，样式/视角/不透明度写在 nativeBody.gisProject
    if (cfg.chartType === "gis-map") return true;
    const hasQuery = Boolean(cfg.dataSourceId || cfg.sql || cfg.datasetId);
    const hasFields = (cfg.dimensions?.length ?? 0) + (cfg.metrics?.length ?? 0) > 0;
    return hasQuery || hasFields;
  }
  if (widget.type === "customViz") return Boolean(widget.customVizConfig?.artifactId);
  if (widget.type === "filter") return Boolean(widget.filterConfig);
  if (widget.type === "text") return Boolean(widget.textConfig);
  if (widget.type === "media") return Boolean(widget.mediaConfig);
  return false;
}

export function resolveLayoutWidget<T extends DashboardWidgetBase>(
  widget: T,
  componentMap: VizComponentMap,
): T {
  const ref = widget.componentRef;
  if (!isLinkedComponentRef(ref)) return widget;
  // 看板已有实例配置：库只负责当初下发，不再覆盖数据和样式
  if (instanceOwnsPayload(widget)) return widget;

  const component = componentMap.get(ref.componentId);
  if (!component) {
    return {
      ...widget,
      title: widget.title || "组件已下架",
    };
  }

  if (component.widgetType !== widget.type) {
    return widget;
  }

  const payload = component.payloadJson as Record<string, unknown>;
  const resolved = rewriteIds({ ...widget, title: widget.title || component.name }, payload) as T;
  if (resolved.type === "chart" && resolved.chartConfig && widget.type === "chart" && widget.chartConfig) {
    return {
      ...resolved,
      chartConfig: applyLinkedChartInstanceOverlay(resolved.chartConfig, widget.chartConfig),
    } as T;
  }
  if (
    resolved.type === "customViz" &&
    resolved.customVizConfig &&
    widget.type === "customViz" &&
    widget.customVizConfig
  ) {
    return {
      ...resolved,
      customVizConfig: applyCustomVizEditOverlay(resolved.customVizConfig, widget.customVizConfig),
    } as T;
  }
  return resolved;
}

export function resolveLayoutWidgets<T extends DashboardWidgetBase>(
  widgets: T[],
  componentMap: VizComponentMap,
): T[] {
  return widgets.map((w) => resolveLayoutWidget(w, componentMap));
}

export function buildComponentMap(items: VizComponentDetail[]): VizComponentMap {
  return new Map(items.map((item) => [item.id, item]));
}

/** PixelWidgetSlot contentRevision：关联组件 batch-resolve 状态变化须触发重渲染 */
export function linkedComponentContentRevisionSuffix(
  widget: DashboardWidgetBase,
  componentMap: VizComponentMap,
  componentsLoading: boolean,
): string {
  if (!isLinkedComponentRef(widget.componentRef)) return "";
  if (componentsLoading) return ":linked:loading";
  const comp = componentMap.get(widget.componentRef.componentId);
  return comp ? `:linked:${comp.id}:${comp.contentRevision}` : ":linked:missing";
}

export function detachLinkedWidget<T extends DashboardWidgetBase>(
  widget: T,
  componentMap: VizComponentMap,
): T {
  const resolved = resolveLayoutWidget(widget, componentMap);
  const { componentRef: _removed, ...rest } = resolved;
  return {
    ...rest,
    componentRef: widget.componentRef
      ? { ...widget.componentRef, detached: true }
      : undefined,
  } as T;
}
