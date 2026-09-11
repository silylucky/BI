import type { AnalysisTheme } from "./useStandardAnalysis";
import { SECTION_COLUMN_LABELS } from "./standardAnalysisPresentation";

const COLUMN_FRIENDLY_NAMES: Record<string, string> = {
  province: "省份",
  city: "城市",
  district: "区县",
  region: "区域",
  area: "区域",
  status: "状态",
  state: "状态",
  sale_date: "销售日期",
  created_at: "创建时间",
  createdat: "创建时间",
  order_date: "订单日期",
  amount: "金额",
  quantity: "数量",
  value: "数量",
  cnt: "数量",
  count: "数量",
};

export function humanizeColumnName(column: string): string {
  const trimmed = column.trim();
  if (!trimmed) return column;
  const fromSection = SECTION_COLUMN_LABELS[trimmed];
  if (fromSection) return fromSection;
  const lower = trimmed.toLowerCase();
  return COLUMN_FRIENDLY_NAMES[lower] ?? trimmed;
}

export function humanizeMappedField(column: string, theme?: AnalysisTheme): string {
  const friendly = humanizeColumnName(column);
  if (theme === "distribution" && friendly === column && /province|city|district|region/i.test(column)) {
    return humanizeColumnName(column);
  }
  return friendly;
}

export function themeAggregationHintText(
  theme: AnalysisTheme,
  fieldMapping: { status?: string; region?: string; createdAt?: string },
): string {
  if (theme === "lifecycle" && fieldMapping.status) {
    return `按${humanizeMappedField(fieldMapping.status, theme)}计数`;
  }
  if (theme === "distribution" && fieldMapping.region) {
    return `按${humanizeMappedField(fieldMapping.region, theme)}计数`;
  }
  if ((theme === "activity" || theme === "trend") && fieldMapping.createdAt) {
    return `按${humanizeMappedField(fieldMapping.createdAt, theme)}按日计数`;
  }
  return "";
}
