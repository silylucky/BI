/** FE Picker / 组件标题展示名（与 backend ChartTypeSpec.display_name 对齐） */
export const CHART_TYPE_DISPLAY_NAMES: Record<string, string> = {
  gauge: "仪表盘",
  liquid: "水波图",
  kpi: "指标卡",
  table: "表格（已弃用）",
  "table-info": "明细表",
  "table-normal": "汇总表",
  "table-pivot": "透视表",
  "t-heatmap": "热力图",
  line: "基础折线图",
  area: "面积图",
  "area-stack": "堆叠折线图",
  timeline: "时间轴（已弃用）",
  bar: "基础柱状图",
  "bar-stack": "堆叠柱状图",
  "percentage-bar-stack": "百分比柱状图",
  "bar-group": "分组柱状图",
  "bar-group-stack": "分组堆叠柱状图",
  waterfall: "瀑布图",
  "bar-horizontal": "基础条形图",
  "bar-stack-horizontal": "堆叠条形图",
  "percentage-bar-stack-horizontal": "百分比条形图",
  "bar-range": "区间条形图",
  "bidirectional-bar": "对称条形图",
  "progress-bar": "进度条",
  "stock-line": "K 线图",
  "bullet-graph": "子弹图",
  pie: "饼图",
  "pie-donut": "环形图",
  "pie-rose": "玫瑰图",
  "pie-donut-rose": "玫瑰环形图",
  radar: "雷达图",
  treemap: "矩形树图",
  "word-cloud": "词云图",
  wordCloud: "词云（旧 ID）",
  map: "区域地图",
  "map-3d": "3D 区域地图",
  heatmap: "热力图（已弃用）",
  scatter: "散点图",
  quadrant: "象限图",
  funnel: "漏斗图",
  sankey: "桑基图",
  "circle-packing": "圆角矩形树图",
  "multi-scatter": "多维度散点图",
  graph: "关系图",
  combo: "折柱组合（已弃用）",
  "chart-mix": "柱线组合图",
  "chart-mix-group": "分组柱线组合图",
  "chart-mix-stack": "堆叠柱线组合图",
  "chart-mix-dual-line": "双线组合图",
};

export function isChartTypeSlug(value: string): boolean {
  return value in CHART_TYPE_DISPLAY_NAMES;
}

/** 将 widget.title 中的 chartType 机器名转为中文；自定义标题原样保留 */
export function resolveChartWidgetTitle(title: string, chartType?: string): string {
  const trimmed = title.trim();
  if (trimmed && isChartTypeSlug(trimmed)) {
    return CHART_TYPE_DISPLAY_NAMES[trimmed];
  }
  if (chartType && (!trimmed || trimmed === chartType)) {
    return CHART_TYPE_DISPLAY_NAMES[chartType] ?? chartType;
  }
  return trimmed || (chartType ? (CHART_TYPE_DISPLAY_NAMES[chartType] ?? chartType) : "图表");
}

/** 切换 chartType 时：仅当标题仍为类型 slug/中文类型名时同步更新 */
export function shouldSyncWidgetTitleOnChartTypeChange(
  title: string,
  oldChartType: string,
): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (trimmed === oldChartType) return true;
  if (isChartTypeSlug(trimmed)) return true;
  const oldLabel = CHART_TYPE_DISPLAY_NAMES[oldChartType];
  return Boolean(oldLabel && trimmed === oldLabel);
}
