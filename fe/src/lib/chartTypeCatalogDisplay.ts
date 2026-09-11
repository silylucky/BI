import type { ChartTypeCatalogItem } from "@/lib/chartRegistry";
import { chartTypeIcon, CHART_TYPE_ICONS } from "@/lib/chartTypeIcons";

export { chartTypeIcon, CHART_TYPE_ICONS };

/** 与后端 ChartTypeSpec.category 对齐；分组标题供 Palette / 类型目录共用 */
export const CHART_CATEGORY_LABELS: Record<string, string> = {
  basic: "基础",
  advanced: "高级",
  geo: "地理",
  indicator: "指标",
  temporal: "时序",
  flow: "流向",
  relation: "关系",
};

export const CHART_CATEGORY_ORDER: readonly string[] = [
  "basic",
  "indicator",
  "geo",
  "flow",
  "relation",
  "advanced",
] as const;

/** 后端 catalog `renderer` 契约字段（非运行时 SDK 名） */
export const CHART_RENDERER_LABELS: Record<string, string> = {
  table: "表格",
  antv: "画布",
  kpi: "KPI 卡",
  echarts: "ECharts（已迁移）",
};

/** FE 插件 `library` — 实际运行时引擎 */
export const CHART_LIBRARY_LABELS: Record<string, string> = {
  d3: "D3",
  react: "React",
};

export function chartLibraryLabel(library?: string | null): string {
  if (!library) return "—";
  return CHART_LIBRARY_LABELS[library] ?? library;
}

export function chartRendererLabel(renderer?: string | null): string {
  if (!renderer) return "—";
  return CHART_RENDERER_LABELS[renderer] ?? renderer;
}

export const CHART_CAPABILITY_LABELS: Record<string, string> = {
  style_variant: "样式变体",
  field_config: "字段配置",
  render_spec: "渲染规格",
};

/** catalog 请求失败时的回退（与 backend builtin 一致） */
export const FALLBACK_CATALOG_ITEMS: ChartTypeCatalogItem[] = [
  { type: "table", displayName: "表格", category: "basic", renderer: "table", styleVariants: ["default"], fieldRule: {} },
  { type: "line", displayName: "折线图", category: "basic", renderer: "antv", styleVariants: ["default", "area", "smooth", "stacked"], fieldRule: {} },
  { type: "bar", displayName: "柱状图", category: "basic", renderer: "antv", styleVariants: ["default", "stacked", "grouped", "horizontal"], fieldRule: {} },
  { type: "pie", displayName: "饼图", category: "basic", renderer: "antv", styleVariants: ["default", "donut", "rose"], fieldRule: {} },
  { type: "scatter", displayName: "散点图", category: "basic", renderer: "antv", styleVariants: ["default", "bubble"], fieldRule: {} },
  { type: "combo", displayName: "折柱组合", category: "basic", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "gauge", displayName: "仪表盘", category: "indicator", renderer: "antv", styleVariants: ["default", "progress"], fieldRule: {} },
  { type: "map", displayName: "地图", category: "geo", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "map-3d", displayName: "3D 区域地图", category: "geo", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "heatmap", displayName: "热力图", category: "geo", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "kpi", displayName: "KPI 指标", category: "indicator", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "timeline", displayName: "时间轴", category: "basic", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "sankey", displayName: "桑基图", category: "flow", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "funnel", displayName: "漏斗图", category: "flow", renderer: "antv", styleVariants: ["default", "pyramid"], fieldRule: {} },
  { type: "graph", displayName: "关系图", category: "relation", renderer: "antv", styleVariants: ["force", "dagre"], fieldRule: {} },
  { type: "wordCloud", displayName: "词云", category: "advanced", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "bidirectional-bar", displayName: "双向条形图", category: "advanced", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
  { type: "waterfall", displayName: "瀑布图", category: "advanced", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
];

export function chartCategoryLabel(category: string): string {
  return CHART_CATEGORY_LABELS[category] ?? category;
}

export type ChartCatalogGroup = {
  category: string;
  label: string;
  items: ChartTypeCatalogItem[];
};

export function groupCatalogItemsByCategory(items: ChartTypeCatalogItem[]): ChartCatalogGroup[] {
  const buckets = new Map<string, ChartTypeCatalogItem[]>();
  for (const item of items) {
    const list = buckets.get(item.category) ?? [];
    list.push(item);
    buckets.set(item.category, list);
  }

  const orderedCategories = [
    ...CHART_CATEGORY_ORDER.filter((c) => buckets.has(c)),
    ...[...buckets.keys()].filter((c) => !CHART_CATEGORY_ORDER.includes(c)).sort(),
  ];

  return orderedCategories.map((category) => ({
    category,
    label: chartCategoryLabel(category),
    items: buckets.get(category) ?? [],
  }));
}
