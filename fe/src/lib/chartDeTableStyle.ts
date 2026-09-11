import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";
import { resolveTablePaletteStyle } from "@/lib/chartTablePalette";

export type TablePaginationMode = "page" | "scroll";
export type TablePaginationVariant = "compact" | "normal";
export type TableColumnWidthMode = "auto" | "fixed" | "custom";

export type ChartDeTableStyle = {
  /** 0–100，组件整体不透明度 */
  opacity?: number;
  /** 表格配色预设 id（与图表 palette 同名） */
  tablePaletteId?: string;
  /** 表头背景（对标 DE 表格配色） */
  headerBg?: string;
  /** 表头文字色 */
  headerFg?: string;
  /** 表头字号（px） */
  headerFontSize?: number;
  /** 单元格背景 */
  bodyBg?: string;
  /** 单元格文字色 */
  bodyFg?: string;
  /** 单元格字号（px） */
  bodyFontSize?: number;
  /** 汇总行背景 */
  summaryBg?: string;
  /** 汇总行文字色 */
  summaryFg?: string;
  /** 斑马纹行背景色（有值即启用斑马纹，对标 DE 色块而非开关） */
  zebraBg?: string;
  /** @deprecated 使用 zebraBg；true 时回退默认斑马纹色 */
  zebraStriped?: boolean;
  /** 列背景（对标 DE「列背景」） */
  columnBg?: string;
  /** 表头左上角/冻结角背景（对标 DE「角背景」） */
  cornerBg?: string;
  /** 无数据提示文字色 */
  emptyHintFg?: string;
  /** 分页器文字/图标色 */
  paginationFg?: string;
  /** 分页器字号 */
  paginationFontSize?: number;
  scrollbarColor?: string;
  borderColor?: string;
  paginationMode?: TablePaginationMode;
  pageSize?: 20 | 50 | 100;
  paginationVariant?: TablePaginationVariant;
  columnWidthMode?: TableColumnWidthMode;
  /** 自定义列宽：列名 → 百分比 */
  columnWidths?: Record<string, number>;
  /** 交互拖拽列宽：列名 → 像素（优先于百分比） */
  columnWidthsPx?: Record<string, number>;
  /** 序号列像素宽度 */
  seriesColumnWidthPx?: number;
  /** 数据行统一高度（像素） */
  rowHeightPx?: number;
  wordWrap?: boolean;
  rowHover?: boolean;
  /** 是否显示底部汇总行；undefined 时在存在可汇总列时自动显示 */
  showSummary?: boolean;
  /** 明细表左侧序号列 */
  showSeriesNumber?: boolean;
  /** 透视表行末合计列 */
  showRowTotal?: boolean;
  /** 透视表底部合计行 */
  showColTotal?: boolean;
};

export const DEFAULT_TABLE_PAGE_SIZE = 20;
export const DEFAULT_TABLE_PAGINATION_FONT_SIZE = 14;
export const DEFAULT_TABLE_ZEBRA_BG = "rgba(148, 163, 184, 0.12)";
/** 对标 DataEase：新建表格类组件默认列宽「自适应」 */
export const DEFAULT_TABLE_COLUMN_WIDTH_MODE: TableColumnWidthMode = "auto";

export function resolveTableZebraBg(style: ChartDeTableStyle): string | undefined {
  if (style.zebraStriped === false) return undefined;
  if (style.zebraBg?.trim()) return style.zebraBg;
  if (style.zebraStriped === true) return DEFAULT_TABLE_ZEBRA_BG;
  return undefined;
}

/** 渲染层：组件 zebra 配置 + 主题 CSS 变量（清除斑马纹时 zebraStriped=false 不再回退默认） */
export function resolveEffectiveTableZebraBg(
  tableStyle: ChartDeTableStyle,
  themeVars?: Record<string, string>,
): string | undefined {
  if (tableStyle.zebraStriped === false) return undefined;
  const explicit = resolveTableZebraBg(tableStyle);
  if (explicit) return explicit;
  const fromTheme = themeVars?.["--dashboard-table-zebra-bg"];
  return typeof fromTheme === "string" && fromTheme.trim() ? fromTheme : undefined;
}

/** 组件 deTableStyle 覆盖看板默认表格配色；优先级：预设 < 看板默认 < 组件 override */
export function mergeChartTableStyle(
  chartStyle: ChartDeTableStyle,
  dashboardDefaults?: ChartDeTableStyle,
  scheme: ColorScheme = "light",
): ChartDeTableStyle {
  const paletteId = chartStyle.tablePaletteId ?? dashboardDefaults?.tablePaletteId;
  const preset = paletteId ? resolveTablePaletteStyle(paletteId, scheme) : {};
  const merged = { ...preset, ...(dashboardDefaults ?? {}), ...chartStyle };
  if (paletteId) merged.tablePaletteId = paletteId;
  return merged;
}

export function readDashboardTableColorDefaults(
  styleConfig?: { tableColorStyle?: ChartDeTableStyle },
): ChartDeTableStyle {
  return styleConfig?.tableColorStyle ?? {};
}

function normalizeChartDeTableStyle(raw: ChartDeTableStyle): ChartDeTableStyle {
  const next: ChartDeTableStyle = { ...raw };
  if (next.rowHeightPx != null && Number.isFinite(next.rowHeightPx)) {
    next.rowHeightPx = Math.round(next.rowHeightPx);
  }
  return next;
}

export function readChartDeTableStyle(cfg: ChartViewConfig): ChartDeTableStyle {
  const raw = cfg.nativeBody?.deTableStyle;
  if (!raw || typeof raw !== "object") return {};
  return normalizeChartDeTableStyle(raw as ChartDeTableStyle);
}

const TABLE_COLOR_FIELD_KEYS = [
  "headerBg",
  "headerFg",
  "bodyBg",
  "bodyFg",
  "summaryBg",
  "summaryFg",
  "zebraBg",
  "zebraStriped",
  "columnBg",
  "cornerBg",
  "emptyHintFg",
  "paginationFg",
  "scrollbarColor",
  "borderColor",
] as const satisfies readonly (keyof ChartDeTableStyle)[];

/** 看板图表配色变更时：保留表格结构字段，重写配色预设与逐字段色 */
export function buildDashboardTableColorStyleForPalette(
  prev: ChartDeTableStyle | undefined,
  paletteId: string,
  scheme: ColorScheme = "light",
): ChartDeTableStyle {
  const preset = resolveTablePaletteStyle(paletteId, scheme);
  const structure: ChartDeTableStyle = { ...(prev ?? {}) };
  for (const key of TABLE_COLOR_FIELD_KEYS) {
    delete structure[key];
  }
  delete structure.tablePaletteId;
  return {
    ...structure,
    ...preset,
    tablePaletteId: paletteId,
  };
}

/** 清除组件级表格配色 override，保留列宽/分页等结构字段 */
export function stripChartTableColorOverrides(cfg: ChartViewConfig): ChartViewConfig {
  const prev = readChartDeTableStyle(cfg);
  const hasColorField = TABLE_COLOR_FIELD_KEYS.some((key) => prev[key] !== undefined);
  if (!hasColorField) return cfg;

  const next: ChartDeTableStyle = { ...prev };
  for (const key of TABLE_COLOR_FIELD_KEYS) {
    delete next[key];
  }

  const nativeBody = { ...cfg.nativeBody };
  if (Object.keys(next).length > 0) {
    nativeBody.deTableStyle = next;
  } else {
    delete nativeBody.deTableStyle;
  }
  return { ...cfg, nativeBody };
}

export function patchChartDeTableStyle(
  cfg: ChartViewConfig,
  patch: Partial<ChartDeTableStyle>,
): ChartViewConfig {
  const prev = readChartDeTableStyle(cfg);
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deTableStyle: { ...prev, ...patch },
    },
  };
}

/** 切换表格配色预设：写入 id 并清除逐字段颜色 override（保留字号/分页等结构字段） */
export function patchChartDeTablePalette(
  cfg: ChartViewConfig,
  paletteId: string | undefined,
  _scheme: ColorScheme = "light",
): ChartViewConfig {
  const prev = readChartDeTableStyle(cfg);
  const next: ChartDeTableStyle = { ...prev };
  for (const key of TABLE_COLOR_FIELD_KEYS) {
    delete next[key];
  }
  if (paletteId) {
    next.tablePaletteId = paletteId;
  } else {
    delete next.tablePaletteId;
  }
  const nativeBody = { ...cfg.nativeBody };
  if (Object.keys(next).length > 0) {
    nativeBody.deTableStyle = next;
  } else {
    delete nativeBody.deTableStyle;
  }
  return { ...cfg, nativeBody };
}

/** 切换列宽模式时清理互斥配置，避免「面板选了自适应但拖拽像素仍生效」 */
export function patchTableColumnWidthMode(
  cfg: ChartViewConfig,
  mode: TableColumnWidthMode,
): ChartViewConfig {
  const patch: Partial<ChartDeTableStyle> = { columnWidthMode: mode };
  if (mode === "auto") {
    patch.columnWidths = undefined;
    patch.columnWidthsPx = undefined;
  } else if (mode === "fixed") {
    patch.columnWidths = undefined;
    patch.columnWidthsPx = undefined;
  }
  return patchChartDeTableStyle(cfg, patch);
}

export function resolveTablePageSize(cfg: ChartViewConfig): number {
  return readChartDeTableStyle(cfg).pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
}

export { resolveChartFieldLabel } from "@/lib/chartFieldLabels";

/** 表格样式面板列顺序：与明细表 xAxis 槽位一致 */
export function resolveTableStyleDisplayColumns(
  cfg: ChartViewConfig,
  columns: string[] = [],
): string[] {
  const axisFields = (cfg.axes?.xAxis ?? [])
    .map((ref) => ref.field?.trim())
    .filter((field): field is string => Boolean(field));
  if (axisFields.length > 0) return axisFields;
  if (columns.length > 0) return columns;
  const legacy = [
    ...(cfg.dimensions ?? []).map((d) => d.field?.trim()).filter(Boolean),
    ...(cfg.metrics ?? []).map((m) => m.field?.trim()).filter(Boolean),
  ] as string[];
  return legacy;
}

function isNumericCell(value: unknown): boolean {
  if (value == null || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n);
}

/** 确定参与汇总的列：指标列优先，否则自动识别数值列 */
export function resolveTableSummaryColumns(
  columns: string[],
  displayCols: string[],
  rows: unknown[][],
  options: { metricFields?: string[]; showSummary?: boolean },
): string[] {
  if (options.showSummary === false) return [];
  const metricCols = (options.metricFields ?? []).filter((field) => displayCols.includes(field));
  if (metricCols.length > 0) return metricCols;
  if (options.showSummary === true) {
    return displayCols.filter((col) => {
      const idx = columns.indexOf(col);
      if (idx < 0) return false;
      return rows.some((row) => isNumericCell(row[idx]));
    });
  }
  return [];
}

export function computeTableSummaryValues(
  columns: string[],
  displayCols: string[],
  rows: unknown[][],
  summaryCols: string[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const col of displayCols) {
    if (!summaryCols.includes(col)) {
      values[col] = null;
      continue;
    }
    const idx = columns.indexOf(col);
    let sum = 0;
    let any = false;
    for (const row of rows) {
      const raw = idx >= 0 ? row[idx] : undefined;
      if (!isNumericCell(raw)) continue;
      sum += Number(raw);
      any = true;
    }
    values[col] = any ? sum : null;
  }
  return values;
}
