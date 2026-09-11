import type { ChartStyleSectionId } from "@/lib/chartStyleSectionRegistry";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { isLegacyTableChartType } from "@/lib/chartViewConfig";

const TABLE_PALETTE_TYPES = new Set(
  BUILTIN_PLUGIN_DEFS.filter((def) => def.paletteCategory === "table").map((def) => def.type),
);

export type TableChartKind = "legacy" | "info" | "normal" | "pivot" | "matrix-heat";

export type TableInspectorProfile = {
  kind: TableChartKind;
  label: string;
  dataHint: string;
  styleSections: ChartStyleSectionId[];
  showPagination: boolean;
  showSummary: boolean;
  showSeriesNumber: boolean;
  showColumnWidth: boolean;
  showWordWrap: boolean;
  showRowHover: boolean;
  showSubTotals: boolean;
  advancedTimeRange: boolean;
  advancedConditional: boolean;
};

const TABLE_BASIC_SECTIONS: ChartStyleSectionId[] = [
  "tableBasic",
  "tableColor",
  "title",
  "background",
];

const PROFILES: Record<TableChartKind, TableInspectorProfile> = {
  legacy: {
    kind: "legacy",
    label: "明细表（旧）",
    dataHint: "拖入列维度或指标字段；未指定时展示查询结果全部列。",
    styleSections: TABLE_BASIC_SECTIONS,
    showPagination: true,
    showSummary: true,
    showSeriesNumber: false,
    showColumnWidth: true,
    showWordWrap: true,
    showRowHover: true,
    showSubTotals: false,
    advancedTimeRange: true,
    advancedConditional: false,
  },
  info: {
    kind: "info",
    label: "明细表",
    dataHint: "明细表展示原始行数据；列字段可选，留空则展示 SQL 结果全部列。",
    styleSections: TABLE_BASIC_SECTIONS,
    showPagination: true,
    showSummary: true,
    showSeriesNumber: true,
    showColumnWidth: true,
    showWordWrap: true,
    showRowHover: true,
    showSubTotals: false,
    advancedTimeRange: true,
    advancedConditional: false,
  },
  normal: {
    kind: "normal",
    label: "汇总表",
    dataHint: "至少配置 1 个维度与 1 个指标；SQL 建议 GROUP BY 维度列。",
    styleSections: TABLE_BASIC_SECTIONS,
    showPagination: true,
    showSummary: true,
    showSeriesNumber: false,
    showColumnWidth: true,
    showWordWrap: true,
    showRowHover: true,
    showSubTotals: true,
    advancedTimeRange: true,
    advancedConditional: false,
  },
  pivot: {
    kind: "pivot",
    label: "透视表",
    dataHint: "行维度、列维度与指标均为必填；列维度可选第二维度字段。",
    styleSections: TABLE_BASIC_SECTIONS,
    showPagination: true,
    showSummary: true,
    showSeriesNumber: false,
    showColumnWidth: true,
    showWordWrap: true,
    showRowHover: true,
    showSubTotals: true,
    advancedTimeRange: true,
    advancedConditional: false,
  },
  "matrix-heat": {
    kind: "matrix-heat",
    label: "矩阵热力",
    dataHint: "横轴维度、纵轴维度与数值指标均为必填。",
    styleSections: ["background", "palette", "geo", "title"],
    showPagination: false,
    showSummary: false,
    showSeriesNumber: false,
    showColumnWidth: false,
    showWordWrap: false,
    showRowHover: false,
    showSubTotals: false,
    advancedTimeRange: true,
    advancedConditional: true,
  },
};

export function resolveTableChartKind(chartType: string): TableChartKind | null {
  if (isLegacyTableChartType(chartType)) return "legacy";
  switch (chartType) {
    case "table-info":
      return "info";
    case "table-normal":
      return "normal";
    case "table-pivot":
      return "pivot";
    case "t-heatmap":
      return "matrix-heat";
    default:
      if (TABLE_PALETTE_TYPES.has(chartType)) return "info";
      return null;
  }
}

export function isTableLikeChartType(chartType: string): boolean {
  return resolveTableChartKind(chartType) != null;
}

export function tableInspectorProfile(chartType: string): TableInspectorProfile | null {
  const kind = resolveTableChartKind(chartType);
  if (!kind) return null;
  return PROFILES[kind];
}

export function tableStyleSectionsForType(chartType: string): ChartStyleSectionId[] {
  return tableInspectorProfile(chartType)?.styleSections ?? [];
}
