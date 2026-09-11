/**
 * 图表/自定义组件「结果展示」默认条数（取最新 N 条）。
 */
export const DEFAULT_CHART_RESULT_LIMIT = 20;

export function defaultChartResultLimitString(): string {
  return String(DEFAULT_CHART_RESULT_LIMIT);
}
