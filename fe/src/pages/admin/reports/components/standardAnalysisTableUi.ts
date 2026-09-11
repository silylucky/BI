/** 标准分析对比表：表体滚动区最大高度 */
export const STANDARD_COMPARE_TABLE_MAX_HEIGHT = "min(60vh, 520px)";

export function standardCompareTableScrollHint(rowCount: number): string | null {
  if (rowCount <= 8) return null;
  return "表格区域内可向下滚动查看全部维度";
}
