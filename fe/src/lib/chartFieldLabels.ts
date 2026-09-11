import type { ChartAxesConfig } from "@/lib/chartDeAxis";
import type { ChartFieldRef, ChartViewConfig } from "@/lib/chartViewConfig";

const CHART_FIELD_FRIENDLY_NAMES: Record<string, string> = {
  province: "省份",
  city: "城市",
  district: "区县",
  region: "区域",
  area: "区域",
  status: "状态",
  state: "状态",
  sale_date: "销售日期",
  stat_date: "统计日期",
  created_at: "创建时间",
  order_date: "订单日期",
  amount: "金额",
  quantity: "数量",
  value: "数值",
  cnt: "数量",
  count: "数量",
  event_count: "事件数",
  grid_name: "网格名称",
  metric_name: "指标名称",
  metric_code: "指标编码",
  name: "名称",
  date: "日期",
  time: "时间",
  category: "类别",
  type: "类型",
};

function refLabel(ref: ChartFieldRef | undefined): string | undefined {
  const label = ref?.label?.trim();
  return label || undefined;
}

/** 图表字段：无显式 label 时按常见 BI 列名 humanize，仍未知则保留原名 */
export function humanizeChartFieldName(field: string): string {
  const trimmed = field.trim();
  if (!trimmed) return field;
  const lower = trimmed.toLowerCase();
  const mapped = CHART_FIELD_FRIENDLY_NAMES[lower];
  if (mapped) return mapped;
  if (lower.endsWith("_count")) {
    const stem = lower.slice(0, -6);
    const stemLabel = CHART_FIELD_FRIENDLY_NAMES[stem];
    return stemLabel ? `${stemLabel}数量` : trimmed;
  }
  if (lower.endsWith("_name")) {
    const stem = lower.slice(0, -5);
    const stemLabel = CHART_FIELD_FRIENDLY_NAMES[stem];
    return stemLabel ? `${stemLabel}名称` : trimmed;
  }
  if (lower.endsWith("_date")) {
    const stem = lower.slice(0, -5);
    const stemLabel = CHART_FIELD_FRIENDLY_NAMES[stem];
    return stemLabel ? `${stemLabel}日期` : trimmed;
  }
  return trimmed;
}

export function resolveChartFieldRefLabel(ref: ChartFieldRef): ChartFieldRef {
  const field = ref.field?.trim();
  if (!field) return { field: "" };
  const label = refLabel(ref) ?? humanizeChartFieldName(field);
  return { field, label };
}

function labelFromAxes(axes: ChartAxesConfig | undefined, field: string): string | undefined {
  if (!axes) return undefined;
  for (const refs of Object.values(axes)) {
    const ref = refs?.find((r) => r.field === field);
    const label = refLabel(ref);
    if (label) return label;
  }
  return undefined;
}

type EncodingLike = {
  dimensions?: ChartFieldRef[];
  metrics?: ChartFieldRef[];
  axes?: ChartAxesConfig;
};

/** 渲染/表头：encoding 上的 dimensions/metrics/axes.label，否则 humanize */
export function resolveEncodingFieldLabel(encoding: EncodingLike, field: string): string {
  const dim = encoding.dimensions?.find((d) => d.field === field);
  const dimLabel = refLabel(dim);
  if (dimLabel) return dimLabel;
  const metric = encoding.metrics?.find((m) => m.field === field);
  const metricLabel = refLabel(metric);
  if (metricLabel) return metricLabel;
  const axisLabel = labelFromAxes(encoding.axes, field);
  if (axisLabel) return axisLabel;
  return humanizeChartFieldName(field);
}

/** 样式面板/表头：优先 dimensions/metrics/axes 上的中文别名 */
export function resolveChartFieldLabel(cfg: ChartViewConfig, field: string): string {
  return resolveEncodingFieldLabel(
    {
      dimensions: cfg.dimensions,
      metrics: cfg.metrics,
      axes: cfg.axes,
    },
    field,
  );
}
