import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { resolveD3InspectorFeatureMatrix } from "@/components/charts/engine/d3/inspectorCapabilityMatrix";
import { chartInspectorCapabilities } from "@/lib/chartInspectorCapabilities";
import {
  filterStyleSectionsForChart,
  supportsPaletteOpacity,
  supportsSeriesGradientToggle,
} from "@/lib/chartStylePanelGates";
import {
  chartStyleSectionsFromProfile,
  resolveChartTypeStyleProfile,
} from "@/lib/chartTypeStyleProfiles";
import type { ChartType } from "@/lib/chartViewConfig";

export type AuditRow = {
  id: string;
  category: "chart" | "widget" | "dashboard";
  deprecated?: boolean;
  migratesTo?: string;
  styleSections: string;
  inspectorCaps: string;
  d3Matrix: string;
  paletteOpacity: "wired" | "hidden" | "n/a";
  seriesGradient: "wired" | "hidden" | "n/a";
  knownGaps: string;
  status: "ok" | "p0-fixed" | "p1-backlog";
};

function capsSummary(type: ChartType): string {
  const c = chartInspectorCapabilities(type);
  const parts: string[] = [];
  if (c.legend) parts.push("legend");
  if (c.label || c.labelFormat) parts.push("label");
  if (c.dataZoom) parts.push("dataZoom");
  if (c.markLines) parts.push("markLines");
  if (c.conditional) parts.push("conditional");
  if (c.remark) parts.push("remark");
  return parts.join(", ") || "—";
}

function d3Summary(type: ChartType): string {
  const m = resolveD3InspectorFeatureMatrix(type);
  if (!m) return "plugin-default";
  return Object.entries(m)
    .map(([k, v]) => `${k}:${v}`)
    .join("; ");
}

function gateField(type: ChartType, wired: boolean): "wired" | "hidden" | "n/a" {
  if (type === "map") return wired ? "wired" : "hidden";
  if (wired) return "n/a";
  return "hidden";
}

const P1_BACKLOG: Partial<Record<string, string>> = {
  map: "profile 无 label 分区但 caps.label=true；2D 区域标签样式待决策",
  funnel: "caps.label=true 无独立 label 分区（标签在 palette 内嵌）",
  graph: "caps 与 profile legend/label 分叉",
  "chart-mix-dual-line": "legend partial，主系列覆盖待确认",
  pie: "seriesGradient 未接线（P0 已隐藏 UI）",
  "table-info": "depthVisual 弱消费",
  geo3d: "groundMirror 等字段未暴露 UI",
};

export function buildChartAuditRows(): AuditRow[] {
  return BUILTIN_PLUGIN_DEFS.map((def) => {
    const type = def.type as ChartType;
    const raw = chartStyleSectionsFromProfile(type);
    const gated = filterStyleSectionsForChart(type, raw);
    const profile = resolveChartTypeStyleProfile(type);
    const gaps: string[] = [];
    if (def.deprecated) gaps.push(`deprecated→${def.migratesTo ?? "?"}`);
    if (P1_BACKLOG[type]) gaps.push(P1_BACKLOG[type]!);
    if (type === "map-3d" && raw.includes("palette")) gaps.push("palette 不应出现");
    if (gated.includes("palette") && !supportsPaletteOpacity(type) && type !== "map") {
      gaps.push("paletteOpacity UI 已门控隐藏");
    }
    const p0Fixed =
      type.startsWith("table") ||
      type === "wordCloud" ||
      type === "stock-line" ||
      gated.includes("tooltip");

    return {
      id: type,
      category: "chart",
      deprecated: def.deprecated,
      migratesTo: def.migratesTo,
      styleSections: gated.join(" → "),
      inspectorCaps: capsSummary(type),
      d3Matrix: d3Summary(type),
      paletteOpacity: type === "map" ? "wired" : gateField(type, supportsPaletteOpacity(type)),
      seriesGradient: supportsSeriesGradientToggle(type) ? "wired" : "hidden",
      knownGaps: gaps.join("; ") || "—",
      status: P1_BACKLOG[type] ? "p1-backlog" : p0Fixed ? "p0-fixed" : "ok",
    };
  });
}

const WIDGET_ROWS: AuditRow[] = [
  {
    id: "filter",
    category: "widget",
    styleSections: "FilterWidgetInspector: dimensionRef, parameterKey, controlType, defaultValue, placeholder, allowClear, multiSelect",
    inspectorCaps: "全局筛选注入 / linkage",
    d3Matrix: "n/a",
    paletteOpacity: "n/a",
    seriesGradient: "n/a",
    knownGaps: "—",
    status: "ok",
  },
  {
    id: "text",
    category: "widget",
    styleSections: "TextEditRail: content, fontSize, fontWeight, color, align, verticalAlign, datasetBinding",
    inspectorCaps: "文本渲染 + 可选 dataset 绑定",
    d3Matrix: "n/a",
    paletteOpacity: "n/a",
    seriesGradient: "n/a",
    knownGaps: "—",
    status: "ok",
  },
  {
    id: "media",
    category: "widget",
    styleSections: "MediaEditRail: mediaType, src, objectFit, alt, autoplay, loop, muted",
    inspectorCaps: "图片/视频展示",
    d3Matrix: "n/a",
    paletteOpacity: "n/a",
    seriesGradient: "n/a",
    knownGaps: "—",
    status: "ok",
  },
  {
    id: "tabs",
    category: "widget",
    styleSections: "TabsWidgetInspector: tabs[], defaultTabId, tabBarStyle",
    inspectorCaps: "标签页切换与子 widget",
    d3Matrix: "n/a",
    paletteOpacity: "n/a",
    seriesGradient: "n/a",
    knownGaps: "—",
    status: "ok",
  },
];

const DASHBOARD_ROWS: AuditRow[] = [
  {
    id: "dashboard-style",
    category: "dashboard",
    styleSections:
      "DashboardStyleSections: 仪表板风格(colorScheme), 整体配置, 仪表板背景",
    inspectorCaps: "applyDashboardStylePatch → 子 chart 继承",
    d3Matrix: "n/a",
    paletteOpacity: "n/a",
    seriesGradient: "n/a",
    knownGaps: "看板级 palette/seriesGradient 为默认继承源",
    status: "ok",
  },
  {
    id: "dashboard-widget-style",
    category: "dashboard",
    styleSections:
      "DashboardWidgetStyleSections: 组件外观(shell), 图表标题, 数值格式, 筛选器外观, 图表配色(paletteId/opacity/gradient/depth)",
    inspectorCaps: "widgetStyle/titleStyle/numberFormat/filterChrome",
    d3Matrix: "n/a",
    paletteOpacity: "wired",
    seriesGradient: "wired",
    knownGaps: "depthVisual 同步子 chart",
    status: "ok",
  },
  {
    id: "dashboard-context",
    category: "dashboard",
    styleSections: "DashboardContextInspector: 空白态选中时展示 DashboardStyleSections + DashboardWidgetStyleSections",
    inspectorCaps: "无 chart 选中时的看板级配置入口",
    d3Matrix: "n/a",
    paletteOpacity: "n/a",
    seriesGradient: "n/a",
    knownGaps: "—",
    status: "ok",
  },
];

export function buildFullAuditMatrix(): AuditRow[] {
  return [...buildChartAuditRows(), ...WIDGET_ROWS, ...DASHBOARD_ROWS];
}

function rowToMarkdown(row: AuditRow): string {
  const dep = row.deprecated ? ` (deprecated→${row.migratesTo})` : "";
  return `| ${row.id}${dep} | ${row.styleSections} | ${row.inspectorCaps} | ${row.d3Matrix} | ${row.paletteOpacity} | ${row.seriesGradient} | ${row.knownGaps} | ${row.status} |`;
}

export function renderAuditMatrixMarkdown(): string {
  const rows = buildFullAuditMatrix();
  const header = `# 组件配置全量审计矩阵

> 生成时间：2026-08-03 · 范围：49 chartType + 4 widget + 看板级  
> 方法论：UI 暴露（profile + gates）→ 能力门控（caps + d3Matrix）→ 渲染消费（P0 门控 / renderer grep）

## 图例

| status | 含义 |
|--------|------|
| ok | 无已知 P0 缺口 |
| p0-fixed | 本轮 P0 已修复或门控 |
| p1-backlog | 矩阵已登记，后续迭代 |

## A. ChartType（${BUILTIN_PLUGIN_DEFS.length}）

| chartType | 样式 Tab 分区（gated） | Inspector caps | D3 matrix | paletteOpacity | seriesGradient | knownGaps | status |
|-----------|------------------------|----------------|-----------|----------------|----------------|-----------|--------|
`;

  const chartRows = rows.filter((r) => r.category === "chart").map(rowToMarkdown).join("\n");

  const widgetHeader = `
## B. 非图表 Widget（4）

| widget | Inspector 字段 | 消费点 | D3 matrix | paletteOpacity | seriesGradient | knownGaps | status |
|--------|----------------|--------|-----------|----------------|----------------|-----------|--------|
`;
  const widgetRows = rows.filter((r) => r.category === "widget").map(rowToMarkdown).join("\n");

  const dashHeader = `
## C. 看板级配置（3）

| 入口 | 配置分区 | 消费路径 | D3 matrix | paletteOpacity | seriesGradient | knownGaps | status |
|------|----------|----------|-----------|----------------|----------------|-----------|--------|
`;
  const dashRows = rows.filter((r) => r.category === "dashboard").map(rowToMarkdown).join("\n");

  const p0 = `
## P0 修复摘要（2026-08-03）

| ID | 修复 |
|----|------|
| P0-1 | \`supportsPaletteOpacity\` 仅 map；其余类型隐藏 opacity 滑块 |
| P0-2 | \`supportsSeriesGradientToggle\` 白名单至 bar/line/area/chart-mix 族 |
| P0-3 | \`ChartTooltipStyleSection\` 补 tooltip 颜色/背景 |
| P0-4 | table 系移除无效 \`palette\` 分区 |
| P0-5 | stock-line 移除空 \`cartesianShape\` 分区 |
| P0-6 | wordCloud D3 matrix 对齐 word-cloud |
| P0-7 | map-3d 无 palette（已完成） |

## P1 Backlog

- pie/funnel 等接线 seriesGradient（若产品需要）
- map 2D label 样式分区决策
- table depthVisual 弱消费
- geo3d 未暴露字段清理
`;

  return header + chartRows + widgetHeader + widgetRows + dashHeader + dashRows + p0;
}
