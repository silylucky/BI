/** 看板/大屏预览档位：default=完整交互；card=列表 Hub 轻量真实预览 */
export type DashboardPreviewProfile = "default" | "card";

/** 列表卡片单图查询行数上限（仍走真实 query/execute） */
export const CARD_PREVIEW_QUERY_LIMIT = 20;

export function isCardPreviewProfile(profile?: DashboardPreviewProfile): boolean {
  return profile === "card";
}

export function resolveCardPreviewQueryLimit(configuredLimit: number): number {
  const safe = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : CARD_PREVIEW_QUERY_LIMIT;
  return Math.min(safe, CARD_PREVIEW_QUERY_LIMIT);
}
