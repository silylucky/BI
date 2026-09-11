/** Query key for standard analysis pack deep-link from Report Center Hub. */
export const STANDARD_PACK_QUERY = "pack";
export const STANDARD_THEME_QUERY = "theme";

export const STANDARD_RESULTS_PATH = "/admin/reports/standard/results";
export const STANDARD_SETUP_PATH = "/admin/reports/standard/setup";

export function standardAnalysisPath(packKey?: string, theme?: string): string {
  const params = new URLSearchParams();
  if (packKey) params.set(STANDARD_PACK_QUERY, packKey);
  if (theme) params.set(STANDARD_THEME_QUERY, theme);
  const query = params.toString();
  return query ? `${STANDARD_RESULTS_PATH}?${query}` : STANDARD_RESULTS_PATH;
}

export function standardAnalysisConfigPath(packKey?: string): string {
  if (!packKey) return STANDARD_SETUP_PATH;
  const params = new URLSearchParams({ [STANDARD_PACK_QUERY]: packKey });
  return `${STANDARD_SETUP_PATH}?${params.toString()}`;
}

/** 调度与投递页：标准分析 Tab，可选按 packKey 筛选。 */
export function standardScheduleHubPath(packKey?: string): string {
  const params = new URLSearchParams({ tab: "standard" });
  if (packKey) params.set("sourceKey", packKey);
  return `/admin/reports/schedules?${params.toString()}`;
}

export const THEME_LABELS: Record<string, string> = {
  lifecycle: "生命周期",
  distribution: "区域分布",
  activity: "活跃度",
  trend: "趋势",
};
