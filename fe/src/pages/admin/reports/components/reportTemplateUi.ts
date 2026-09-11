/** 文档模板工作台：分栏仅 xl+，避免 lg 内容区过窄导致详情叠压。 */
export const REPORT_TEMPLATE_WORKBENCH_GRID_CLASS =
  "grid min-h-0 min-w-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]";

/** 目录选中节点（query），避免 pathname 变化触发壳层重绘。 */
export const TEMPLATE_NODE_QUERY = "node";

export function reportTemplatePath(nodeId?: string | null): string {
  if (!nodeId) return "/admin/reports/templates";
  const params = new URLSearchParams({ [TEMPLATE_NODE_QUERY]: nodeId });
  return `/admin/reports/templates?${params.toString()}`;
}
