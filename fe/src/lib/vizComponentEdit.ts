import type { DashboardWidgetBase } from "@/components/dashboard/dashboardLayoutContracts";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import type { VizComponentMap } from "@/lib/resolveVizComponent";
import { buildComponentMap, resolveLayoutWidget } from "@/lib/resolveVizComponent";
import {
  batchResolveVizComponents,
  collectComponentIds,
  extractWidgetPayload,
  isLinkedComponentRef,
  updateVizComponent,
  type VizComponentDetail,
  type VizComponentPayload,
} from "@/lib/vizComponents";
import { createLinkedLayoutWidget } from "@/components/dashboard/createLayoutWidget";
import { normalizeChartConfigForPortableDemo } from "@/lib/templateDemoData";
import { buildLinkedChartInstanceOverlay } from "@/lib/geoMapRegionPicker";
import { queueLinkedComponentPush } from "@/lib/linkedComponentSaveQueue";

export { awaitLinkedComponentWrites } from "@/lib/linkedComponentSaveQueue";

/** ADR-14：已链接 widget 保存时剥离内联 payload，仅保留实例覆盖（如地图下钻路径） */
export function stripLinkedWidgetForPersist<T extends DashboardWidgetBase>(widget: T): T {
  if (!isLinkedComponentRef(widget.componentRef)) return widget;
  if (widget.type === "chart") {
    const overlay = widget.chartConfig
      ? buildLinkedChartInstanceOverlay(widget.chartConfig)
      : undefined;
    return { ...widget, chartConfig: overlay } as T;
  }
  if (widget.type === "filter") {
    return { ...widget, filterConfig: undefined } as T;
  }
  if (widget.type === "text") {
    return { ...widget, textConfig: undefined } as T;
  }
  if (widget.type === "media") {
    return { ...widget, mediaConfig: undefined } as T;
  }
  if (widget.type === "customViz") {
    return { ...widget, customVizConfig: undefined } as T;
  }
  return widget;
}

export function normalizeLinkedChartConfigChange(
  widget: LayoutWidget,
  chartConfig: NonNullable<LayoutWidget["chartConfig"]>,
): LayoutWidget["chartConfig"] | undefined {
  if (!isLinkedComponentRef(widget.componentRef)) return chartConfig;
  return buildLinkedChartInstanceOverlay(chartConfig);
}

export async function pushWidgetPayloadToLibrary(
  widget: LayoutWidget,
  componentMap: VizComponentMap,
  payload: VizComponentPayload,
): Promise<VizComponentDetail | void> {
  const ref = widget.componentRef;
  if (!isLinkedComponentRef(ref)) return;
  const component = componentMap.get(ref.componentId);
  if (!component) {
    throw new Error("组件库条目不存在或无权访问");
  }
  const updated = await updateVizComponent(component.id, {
    payloadJson: payload,
    contentRevision: component.contentRevision,
  });
  componentMap.set(component.id, updated);
  return updated;
}

/** 复用：把库里那一刻的 payload 拷到画布，之后只属于看板，不再挂活链接。 */
export function instantiateVizComponentWidget(
  component: VizComponentDetail,
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const stub = createLinkedLayoutWidget(component, widgets, at);
  const resolved = resolveLayoutWidget(stub, buildComponentMap([component]));
  const { componentRef: _ref, ...rest } = resolved;
  return rest as LayoutWidget;
}

export function enqueueWidgetPayloadToLibrary(
  widget: LayoutWidget,
  componentMap: VizComponentMap,
  payload: VizComponentPayload,
): Promise<unknown> {
  return queueLinkedComponentPush(widget, componentMap, payload);
}

export async function syncResolvedWidgetToLibrary(
  widget: LayoutWidget,
  resolved: LayoutWidget,
  componentMap: VizComponentMap,
): Promise<VizComponentDetail | void> {
  return pushWidgetPayloadToLibrary(widget, componentMap, extractWidgetPayload(resolved));
}

export async function flushLinkedLocalOverridesToLibrary(
  _widgets: LayoutWidget[],
  _componentMap: VizComponentMap,
): Promise<void> {
  return;
}

/** 跨看板复制：linked 组件先 resolve 再 inline 快照（含演示 dataSourceId） */
export function prepareWidgetInlineSnapshot(widget: LayoutWidget): LayoutWidget {
  const { componentRef: _removed, ...rest } = widget;
  if (rest.type === "chart" && rest.chartConfig) {
    return {
      ...rest,
      chartConfig: normalizeChartConfigForPortableDemo(rest.chartConfig),
    } as LayoutWidget;
  }
  return rest as LayoutWidget;
}

export async function resolveWidgetForCrossDashboardCopy(
  widget: LayoutWidget,
): Promise<LayoutWidget> {
  if (!isLinkedComponentRef(widget.componentRef)) {
    return prepareWidgetInlineSnapshot(widget);
  }
  const ids = collectComponentIds([widget]);
  if (ids.length === 0) return prepareWidgetInlineSnapshot(widget);
  const { items } = await batchResolveVizComponents(ids);
  const map = buildComponentMap(items);
  return prepareWidgetInlineSnapshot(resolveLayoutWidget(widget, map));
}

export function relinkWidgetToComponent(
  widget: LayoutWidget,
  componentId: string,
): LayoutWidget {
  const { chartConfig, filterConfig, textConfig, mediaConfig, customVizConfig, ...rest } = widget;
  return {
    ...rest,
    componentRef: { componentId },
  };
}

export function isPublishableWidgetType(
  type: DashboardWidgetBase["type"],
): type is "chart" | "filter" | "text" | "media" | "customViz" {
  return (
    type === "chart" ||
    type === "filter" ||
    type === "text" ||
    type === "media" ||
    type === "customViz"
  );
}
