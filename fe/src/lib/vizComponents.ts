import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { sanitizeChartFieldsForValidate } from "@/lib/chartFieldRules";
import { apiFetch } from "@/lib/api";
import {
  normalizeChartConfigForPortableDemo,
  TEMPLATE_DEMO_DATASOURCE_REF,
} from "@/lib/templateDemoData";
import type {
  DashboardWidgetBase,
  VizComponentRef,
} from "@/components/dashboard/dashboardLayoutContracts";
import type { FilterWidgetConfig, MediaWidgetConfig, TextWidgetConfig, CustomVizWidgetConfig } from "@/components/dashboard/layoutUtils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidComponentUuid(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export type VizSurfaceKind = "dashboard" | "data-screen";
export type VizWidgetType = "chart" | "filter" | "text" | "media" | "customViz";

export type VizComponentPayload = {
  chartConfig?: ChartViewConfig;
  filterConfig?: FilterWidgetConfig;
  textConfig?: TextWidgetConfig;
  mediaConfig?: MediaWidgetConfig;
  customVizConfig?: CustomVizWidgetConfig;
};

export type VizComponentListItem = {
  id: string;
  componentKey: string;
  name: string;
  description: string | null;
  categoryKey: string;
  widgetType: VizWidgetType;
  surfaceKinds: VizSurfaceKind[];
  status: "draft" | "published" | "archived";
  thumbnailRef: string | null;
  thumbnailUrl?: string | null;
  tags: string[];
  visibility: "org" | "private";
  contentRevision: number;
  referenceCount?: number;
  updatedAt: string;
  publishedAt: string | null;
};

export type VizComponentDetail = VizComponentListItem & {
  payloadJson: VizComponentPayload;
  ownerUserId: string | null;
  orgScope: string | null;
  createdAt: string;
};

export type VizComponentListResponse = {
  items: VizComponentListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type VizComponentBatchResolveResponse = {
  items: VizComponentDetail[];
};

export type VizComponentReferenceItem = {
  dashboardId: string;
  dashboardName: string;
  dashboardSurfaceKind: VizSurfaceKind;
  widgetId: string;
  widgetTitle: string | null;
};

export type VizComponentReferencesResponse = {
  items: VizComponentReferenceItem[];
  total: number;
};

export const VIZ_COMPONENT_CATEGORIES: { key: string; label: string }[] = [
  { key: "general", label: "通用" },
  { key: "monitoring", label: "监控" },
  { key: "government", label: "政务" },
  { key: "analytics", label: "分析" },
];

export function buildVizComponentsListUrl(params: {
  surfaceKind?: VizSurfaceKind;
  widgetType?: VizWidgetType;
  chartPaletteCategory?: string;
  categoryKey?: string;
  q?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}): string {
  const search = new URLSearchParams();
  if (params.surfaceKind) search.set("surfaceKind", params.surfaceKind);
  if (params.widgetType) search.set("widgetType", params.widgetType);
  if (params.chartPaletteCategory) search.set("chartPaletteCategory", params.chartPaletteCategory);
  if (params.categoryKey) search.set("categoryKey", params.categoryKey);
  if (params.q) search.set("q", params.q);
  if (params.includeDrafts) search.set("includeDrafts", "true");
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return `/api/v1/viz-components${qs ? `?${qs}` : ""}`;
}

function normalizeWidgetType(value: unknown): VizWidgetType {
  if (
    value === "chart" ||
    value === "filter" ||
    value === "text" ||
    value === "media" ||
    value === "customViz"
  ) {
    return value;
  }
  return "chart";
}

function normalizeSurfaceKinds(value: unknown): VizSurfaceKind[] {
  if (!Array.isArray(value)) return ["dashboard"];
  const kinds = value.filter(
    (item): item is VizSurfaceKind => item === "dashboard" || item === "data-screen",
  );
  return kinds.length > 0 ? kinds : ["dashboard"];
}

function normalizeListItem(raw: VizComponentListItem): VizComponentListItem {
  return {
    ...raw,
    widgetType: normalizeWidgetType(raw.widgetType),
    surfaceKinds: normalizeSurfaceKinds(raw.surfaceKinds),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    referenceCount: typeof raw.referenceCount === "number" ? raw.referenceCount : 0,
  };
}

export function fetchVizComponents(params: {
  surfaceKind?: VizSurfaceKind;
  widgetType?: VizWidgetType;
  chartPaletteCategory?: string;
  categoryKey?: string;
  q?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}) {
  return apiFetch<VizComponentListResponse>(buildVizComponentsListUrl(params)).then((data) => ({
    ...data,
    items: (data.items ?? []).map(normalizeListItem),
  }));
}

export function fetchVizComponent(id: string) {
  return apiFetch<VizComponentDetail>(`/api/v1/viz-components/${id}`);
}

export function fetchVizComponentReferences(id: string) {
  return apiFetch<VizComponentReferencesResponse>(`/api/v1/viz-components/${id}/references`);
}

export function batchResolveVizComponents(ids: string[]) {
  return apiFetch<VizComponentBatchResolveResponse>("/api/v1/viz-components/batch-resolve", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/** batch-resolve 缓存就地更新，避免 linked 组件改配置后画布不刷新 */
export function patchVizComponentResolveCache(
  queryClient: QueryClient,
  componentIds: string[],
  updated: VizComponentDetail,
): void {
  queryClient.setQueryData<VizComponentBatchResolveResponse>(
    queryKeys.vizComponents.resolve(componentIds),
    (old) => {
      if (!old) return { items: [updated] };
      const exists = old.items.some((item) => item.id === updated.id);
      const items = exists
        ? old.items.map((item) => (item.id === updated.id ? updated : item))
        : [...old.items, updated];
      return { items };
    },
  );
}

export function createVizComponent(body: {
  name: string;
  description?: string;
  categoryKey?: string;
  widgetType: VizWidgetType;
  surfaceKinds?: VizSurfaceKind[];
  payloadJson?: VizComponentPayload;
  sourceWidget?: DashboardWidgetBase;
  visibility?: "org" | "private";
  tags?: string[];
}) {
  return apiFetch<VizComponentDetail>("/api/v1/viz-components", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateVizComponent(
  id: string,
  body: {
    name?: string;
    description?: string;
    categoryKey?: string;
    surfaceKinds?: VizSurfaceKind[];
    payloadJson?: VizComponentPayload;
    visibility?: "org" | "private";
    tags?: string[];
    contentRevision?: number;
  },
) {
  return apiFetch<VizComponentDetail>(`/api/v1/viz-components/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function publishVizComponent(id: string) {
  return apiFetch<VizComponentDetail>(`/api/v1/viz-components/${id}/publish`, {
    method: "POST",
  });
}

export function archiveVizComponent(id: string) {
  return apiFetch<VizComponentDetail>(`/api/v1/viz-components/${id}/archive`, {
    method: "POST",
  });
}

export function deleteVizComponent(id: string) {
  return apiFetch<void>(`/api/v1/viz-components/${id}`, { method: "DELETE" });
}

export function extractWidgetPayload(widget: DashboardWidgetBase): VizComponentPayload {
  switch (widget.type) {
    case "chart":
      if (!widget.chartConfig) throw new Error("chart widget missing chartConfig");
      return { chartConfig: sanitizeChartFieldsForValidate(widget.chartConfig) };
    case "filter":
      if (!widget.filterConfig) throw new Error("filter widget missing filterConfig");
      return { filterConfig: widget.filterConfig };
    case "text":
      if (!widget.textConfig) throw new Error("text widget missing textConfig");
      return { textConfig: widget.textConfig };
    case "media":
      if (!widget.mediaConfig) throw new Error("media widget missing mediaConfig");
      return { mediaConfig: widget.mediaConfig };
    case "customViz":
      if (!widget.customVizConfig) throw new Error("customViz widget missing customVizConfig");
      return { customVizConfig: widget.customVizConfig };
    default:
      throw new Error(`Widget type ${widget.type} cannot be published`);
  }
}

/** 发布/跨看板复制：chart 绑定归一化为演示占位符（保留 SQL） */
export function normalizePayloadForPortableDemo(payload: VizComponentPayload): VizComponentPayload {
  if (!payload.chartConfig) return payload;
  return {
    ...payload,
    chartConfig: normalizeChartConfigForPortableDemo(payload.chartConfig),
  };
}

export { TEMPLATE_DEMO_DATASOURCE_REF };

export function isLinkedComponentRef(ref?: VizComponentRef): ref is VizComponentRef {
  return Boolean(ref?.componentId && !ref.detached);
}

export function collectComponentIds(widgets: DashboardWidgetBase[]): string[] {
  const ids = new Set<string>();
  for (const w of widgets) {
    if (!isLinkedComponentRef(w.componentRef)) continue;
    const id = w.componentRef.componentId.trim();
    if (isValidComponentUuid(id)) ids.add(id);
  }
  return [...ids];
}
