import type { ChartType } from "@/lib/chartViewConfig";
import { chartStyleSectionsFromProfile } from "@/lib/chartTypeStyleProfiles";

/** 样式 Tab 折叠块 ID（按图表类型组合，对标 DataEase attr-style） */
export type ChartStyleSectionId =
  | "tableBasic"
  | "tableColor"
  | "variantBasic"
  | "axis"
  | "cartesianShape"
  | "pieShape"
  | "gaugeShape"
  | "liquidShape"
  | "kpiIndicator"
  | "funnelShape"
  | "sankeyShape"
  | "graphShape"
  | "radarShape"
  | "wordCloudShape"
  | "treemapShape"
  | "circlePackingShape"
  | "quadrantShape"
  | "progressBarShape"
  | "bulletShape"
  | "stockLineShape"
  | "tooltip"
  | "palette"
  | "mapBasic"
  | "geo"
  | "title"
  | "remark"
  | "legend"
  | "label"
  | "background"
  | "gisProject"
  | "gisLayers"
  | "gisOverlay"
  | "gisAtmosphere"
  | "gisSun";

export const STYLE_VARIANT_LABELS: Record<string, string> = {
  default: "默认",
  area: "面积",
  smooth: "平滑",
  stacked: "堆叠",
  grouped: "分组",
  horizontal: "横向",
  donut: "环形",
  rose: "玫瑰",
  progress: "进度",
  pyramid: "金字塔",
  force: "网络拓扑",
  dagre: "流向分层",
  bubble: "气泡",
};

/** 返回当前图表类型应展示的样式折叠块（读 chartTypeStyleProfiles） */
export function chartStyleSectionsForType(chartType: ChartType): ChartStyleSectionId[] {
  return chartStyleSectionsFromProfile(chartType);
}

export function styleVariantLabel(variant: string): string {
  return STYLE_VARIANT_LABELS[variant] ?? variant;
}
