import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import type { VizComponentMap } from "@/lib/resolveVizComponent";
import { extractWidgetPayload } from "@/lib/vizComponents";
import type { VizComponentDetail, VizComponentPayload, VizWidgetType } from "@/lib/vizComponents";

export function vizPayloadToLayoutWidget(input: {
  id: string;
  name: string;
  widgetType: VizWidgetType;
  payload: VizComponentPayload;
  widgetIdPrefix?: string;
}): LayoutWidget {
  const base = {
    id: `${input.widgetIdPrefix ?? "vc-preview"}-${input.id}`,
    title: input.name,
    colSpan: 12,
    rowSpan: 8,
    order: 0,
    componentRef: { componentId: input.id },
  };

  const payload = input.payload;
  switch (input.widgetType) {
    case "chart":
      return {
        ...base,
        type: "chart",
        chartConfig: payload.chartConfig,
        chartId: input.id,
      } as LayoutWidget;
    case "filter":
      return {
        ...base,
        type: "filter",
        filterConfig: payload.filterConfig!,
      } as LayoutWidget;
    case "text":
      return {
        ...base,
        type: "text",
        textConfig: payload.textConfig!,
      } as LayoutWidget;
    case "media":
      return {
        ...base,
        type: "media",
        mediaConfig: payload.mediaConfig!,
      } as LayoutWidget;
    case "customViz":
      return {
        ...base,
        type: "customViz",
        customVizConfig: payload.customVizConfig!,
      } as LayoutWidget;
    default:
      throw new Error(`Unsupported widget type: ${input.widgetType}`);
  }
}

export function componentDetailToLayoutWidget(detail: VizComponentDetail): LayoutWidget {
  return vizPayloadToLayoutWidget({
    id: detail.id,
    name: detail.name,
    widgetType: detail.widgetType,
    payload: detail.payloadJson,
    widgetIdPrefix: "vc-edit",
  });
}

export function componentEditorSnapshot(detail: VizComponentDetail): string {
  return JSON.stringify({
    name: detail.name,
    payload: detail.payloadJson,
  });
}

export function widgetEditorSnapshot(widget: LayoutWidget): string {
  return JSON.stringify({
    name: widget.title ?? "",
    payload: extractWidgetPayload(widget),
  });
}

export function buildSingleComponentMap(detail: VizComponentDetail): VizComponentMap {
  return new Map([[detail.id, detail]]);
}
