import type { ChartFieldRef } from "@/lib/chartViewConfig";

/** DataEase chart-edit 命名轴（v2 最新 stable） */
export type DeAxisId =
  | "xAxis"
  | "yAxis"
  | "yAxisExt"
  | "extBubble"
  | "extColor"
  | "drill"
  | "extStack"
  | "xAxisExt"
  | "filter";

export type DeAxisFieldType = "dimension" | "metric" | "both";

/** Inspector 槽位 UI：multi = 单容器多 chip 追加 */
export type DeAxisUiMode = "single" | "multi";

/** 单轴定义（DE axisConfig 一项） */
export type DeAxisSpec = {
  id: DeAxisId;
  label: string;
  fieldType: DeAxisFieldType;
  limit: number;
  required: boolean;
  /** 指标轴展示聚合后缀 */
  showAggregation?: boolean;
  /** 多字段轴内各槽位子标签（如 K 线四价） */
  slotLabels?: string[];
  /** multi：单容器多字段；默认 single 按 limit 展开 */
  uiMode?: DeAxisUiMode;
  /** both 轴：维度侧上限（默认 8） */
  maxDimensions?: number;
  /** both 轴：指标侧上限（默认 8） */
  maxMetrics?: number;
};

/** Inspector 渲染用：展开 limit 后的单槽 */
export type DeAxisSlot = {
  axisId: DeAxisId;
  index: number;
  label: string;
  fieldType: DeAxisFieldType;
  required: boolean;
  showAggregation?: boolean;
  uiMode?: DeAxisUiMode;
  limit?: number;
  maxDimensions?: number;
  maxMetrics?: number;
  /** 旧版 dimensions/metrics 索引，用于迁移 */
  legacy?: { kind: "dimension" | "metric"; index: number };
};

export type ChartAxesConfig = Partial<Record<DeAxisId, ChartFieldRef[]>>;

export type ResolvedChartEncoding = {
  axes: ChartAxesConfig;
  /** 兼容 buildPlan 过渡期：由 axes 投影 */
  dimensions: ChartFieldRef[];
  metrics: ChartFieldRef[];
};
