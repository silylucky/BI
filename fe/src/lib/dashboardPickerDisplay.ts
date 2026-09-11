import type { DashboardLayout } from "@/components/dashboard/layoutUtils";

export type DashboardPickerItem = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  layoutJson?: DashboardLayout;
  updatedAt?: string;
};

export function shortDashboardId(id: string, length = 8): string {
  const trimmed = id.trim();
  if (trimmed.length <= length) return trimmed;
  return `${trimmed.slice(0, length)}…`;
}

function formatUpdatedAt(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildDashboardNameCounts(items: DashboardPickerItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = item.name?.trim() || "未命名看板";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/** 主标题：重名看板追加短 ID，避免列表无法区分 */
export function dashboardPickerPrimaryLabel(
  item: DashboardPickerItem,
  nameCounts?: Map<string, number>,
): string {
  const name = item.name?.trim() || "未命名看板";
  const counts = nameCounts ?? buildDashboardNameCounts([item]);
  if ((counts.get(name) ?? 1) > 1) {
    return `${name} · ${shortDashboardId(item.id)}`;
  }
  return name;
}

export function dashboardPickerMeta(item: DashboardPickerItem): string {
  const widgetCount = item.layoutJson?.widgets?.length;
  const parts = [shortDashboardId(item.id, 12)];
  if (typeof widgetCount === "number") {
    parts.push(`${widgetCount} 个组件`);
  }
  const updated = formatUpdatedAt(item.updatedAt);
  if (updated) {
    parts.push(`更新 ${updated}`);
  }
  return parts.join(" · ");
}

export function matchesDashboardPickerQuery(item: DashboardPickerItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.name,
    item.slug,
    item.id,
    item.description ?? "",
    dashboardPickerMeta(item),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
