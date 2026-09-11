import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { apiFetch } from "@/lib/api";
import { normalizeLayoutForTemplateExport } from "@/lib/templateDemoData";

export type VizSurfaceKind = "dashboard" | "data-screen";

export type DashboardTemplateListItem = {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  categoryKey: string;
  surfaceKind: VizSurfaceKind;
  status: "draft" | "published" | "archived";
  thumbnailRef: string | null;
  visibility: "builtin" | "org" | "private";
  ownerUserId: string | null;
  contentRevision: number;
  updatedAt: string;
  publishedAt: string | null;
};

export type DashboardTemplateDetail = DashboardTemplateListItem & {
  layoutJson: Record<string, unknown>;
  sourceDashboardId: string | null;
  ownerUserId: string | null;
  orgScope: string | null;
  createdAt: string;
};

export type DashboardTemplateListResponse = {
  items: DashboardTemplateListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type VizLayoutEnvelope = {
  templateVersion: 1;
  kind: "viz-layout" | "data-screen";
  surfaceKind?: VizSurfaceKind;
  name: string;
  description?: string | null;
  categoryKey?: string;
  layout: Record<string, unknown>;
};

export const TEMPLATE_CATEGORIES: { key: string; label: string }[] = [
  { key: "general", label: "通用" },
  { key: "monitoring", label: "监控" },
  { key: "government", label: "政务" },
  { key: "analytics", label: "分析" },
];

const TEMPLATE_CATEGORY_KEYS = new Set(TEMPLATE_CATEGORIES.map((cat) => cat.key));

export function parseVizTemplateHubSurfaceKind(
  raw: string | null | undefined,
): VizSurfaceKind {
  return raw === "data-screen" ? "data-screen" : "dashboard";
}

export function parseVizTemplateHubCategoryKey(
  raw: string | null | undefined,
): string | null {
  if (!raw || !TEMPLATE_CATEGORY_KEYS.has(raw)) return null;
  return raw;
}

/** Hub / 模板选择器不展示的内置模板（当前无隐藏项） */
export const HUB_HIDDEN_BUILTIN_TEMPLATE_KEYS = new Set<string>();

export function filterTemplatesForHub(
  items: DashboardTemplateListItem[],
): DashboardTemplateListItem[] {
  return items.filter(
    (item) =>
      item.status !== "archived" && !HUB_HIDDEN_BUILTIN_TEMPLATE_KEYS.has(item.templateKey),
  );
}

export function buildTemplatesListUrl(params: {
  surfaceKind?: VizSurfaceKind;
  categoryKey?: string;
  q?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}): string {
  const search = new URLSearchParams();
  if (params.surfaceKind) search.set("surfaceKind", params.surfaceKind);
  if (params.categoryKey) search.set("categoryKey", params.categoryKey);
  if (params.q) search.set("q", params.q);
  if (params.includeDrafts) search.set("includeDrafts", "true");
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return `/api/v1/dashboard-templates${qs ? `?${qs}` : ""}`;
}

export function fetchDashboardTemplates(params: {
  surfaceKind?: VizSurfaceKind;
  categoryKey?: string;
  q?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}) {
  return apiFetch<DashboardTemplateListResponse>(buildTemplatesListUrl(params));
}

export function fetchTemplateDetail(templateId: string) {
  return apiFetch<DashboardTemplateDetail>(`/api/v1/dashboard-templates/${templateId}`);
}

export function buildVizLayoutEnvelope(
  layout: DashboardLayout,
  name: string,
  surfaceKind: VizSurfaceKind,
): VizLayoutEnvelope {
  const trimmed = name.trim() || (surfaceKind === "data-screen" ? "未命名大屏" : "未命名看板");
  return {
    templateVersion: 1,
    kind: "viz-layout",
    surfaceKind,
    name: trimmed,
    layout: normalizeLayoutForTemplateExport(layout) as unknown as Record<string, unknown>,
  };
}

export function createFromTemplate(templateId: string, name?: string) {
  return apiFetch<{ id: string }>("/api/v1/dashboards/from-template", {
    method: "POST",
    body: JSON.stringify({ templateId, name }),
  });
}

export function publishTemplate(templateId: string) {
  return apiFetch<DashboardTemplateDetail>(`/api/v1/dashboard-templates/${templateId}/publish`, {
    method: "POST",
  });
}

export function archiveTemplate(templateId: string) {
  return apiFetch<DashboardTemplateDetail>(`/api/v1/dashboard-templates/${templateId}/archive`, {
    method: "POST",
  });
}

export function deleteTemplate(templateId: string) {
  return apiFetch<void>(`/api/v1/dashboard-templates/${templateId}`, {
    method: "DELETE",
  });
}

export function importTemplateEnvelope(envelope: VizLayoutEnvelope) {
  return apiFetch<DashboardTemplateDetail>("/api/v1/dashboard-templates/import", {
    method: "POST",
    body: JSON.stringify(envelope),
  });
}

export function exportTemplateEnvelope(templateId: string) {
  return apiFetch<VizLayoutEnvelope>(`/api/v1/dashboard-templates/${templateId}/export`);
}

export function createTemplateFromDashboard(input: {
  name: string;
  description?: string;
  categoryKey?: string;
  surfaceKind: VizSurfaceKind;
  sourceDashboardId: string;
  visibility?: "private" | "org";
}) {
  return apiFetch<DashboardTemplateDetail>("/api/v1/dashboard-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTemplate(
  templateId: string,
  input: {
    name?: string;
    description?: string | null;
    categoryKey?: string;
    layoutJson?: Record<string, unknown>;
    contentRevision: number;
  },
) {
  return apiFetch<DashboardTemplateDetail>(`/api/v1/dashboard-templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryKey !== undefined ? { categoryKey: input.categoryKey } : {}),
      ...(input.layoutJson !== undefined ? { layoutJson: input.layoutJson } : {}),
      contentRevision: input.contentRevision,
    }),
  });
}
