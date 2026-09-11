export const chartPalette = {
  brand: "#465fff", // @design-token-ok
  purple: "#7a5af8", // @design-token-ok
  success: "#12b76a", // @design-token-ok
  info: "#0ba5ec", // @design-token-ok
  pink: "#ee46bc", // @design-token-ok
} as const;

export const chartColors = Object.values(chartPalette);

export type ChartPalettePreset = {
  id: string;
  label: string;
  /** 选择器副文案 */
  hint: string;
  colors: readonly string[];
};

/**
 * VitalSpan 图表配色模板（品牌 Token 衍生，非第三方照搬）。
 * 默认 7 色序列 + 扩展至 9 色供 ECharts 多系列使用。
 */
export const CHART_PALETTE_CATALOG: readonly ChartPalettePreset[] = [
  {
    id: "default",
    label: "品牌",
    hint: "标准色，通用分析场景",
    colors: [
      "#465fff",
      "#7a5af8",
      "#12b76a",
      "#0ba5ec",
      "#ee46bc",
      "#f79009",
      "#2e90fa",
      "#15b79e",
      "#6172f3",
    ],
  },
  {
    id: "clarity",
    label: "清透",
    hint: "冷色趋势，强调对比",
    colors: [
      "#0ba5ec",
      "#36bffa",
      "#53b1fd",
      "#2e90fa",
      "#465fff",
      "#12b76a",
      "#4ade80",
      "#667085",
      "#98a2b3",
    ],
  },
  {
    id: "enterprise",
    label: "政企",
    hint: "稳重低饱和，汇报看板",
    colors: [
      "#344054",
      "#475467",
      "#465fff",
      "#1d2939",
      "#0e7490",
      "#067647",
      "#1849a9",
      "#667085",
      "#98a2b3",
    ],
  },
  {
    id: "amber",
    label: "暖金",
    hint: "暖色 KPI，经营叙事",
    colors: [
      "#f79009",
      "#fdb022",
      "#f04438",
      "#dc6803",
      "#b54708",
      "#f63d68",
      "#ee46bc",
      "#fec84b",
      "#e04f16",
    ],
  },
  {
    id: "spectrum",
    label: "广谱",
    hint: "色相均衡，多分类系列",
    colors: [
      "#465fff",
      "#12b76a",
      "#f79009",
      "#ee46bc",
      "#0ba5ec",
      "#7a5af8",
      "#15b79e",
      "#f04438",
      "#6172f3",
    ],
  },
  {
    id: "pastel",
    label: "浅韵",
    hint: "粉彩柔和，密集图表",
    colors: [
      "#84adff",
      "#b2ddff",
      "#a6f4c5",
      "#fecdd6",
      "#f9a8d4",
      "#c7d7fe",
      "#99f6e0",
      "#fde68a",
      "#d9d6fe",
    ],
  },
  {
    id: "contrast",
    label: "锐利",
    hint: "高对比，投影与大屏",
    colors: [
      "#101828",
      "#465fff",
      "#d92d20",
      "#079455",
      "#b42318",
      "#175cd3",
      "#f79009",
      "#0e7490",
      "#7a5af8",
    ],
  },
  {
    id: "night",
    label: "夜幕",
    hint: "深色底图专用亮色",
    colors: [
      "#84adff",
      "#53b1fd",
      "#6ce9a6",
      "#fdb022",
      "#f670c7",
      "#9b8afb",
      "#38bdf8",
      "#fda29b",
      "#a4bcfd",
    ],
  },
] as const;

/** 组件级配色：未单独指定时继承仪表板配色（图表检查栏首项文案） */
export const CHART_PALETTE_INHERIT_LABEL = "默认";

/** 历史 paletteId → 现行模板（已存配置兼容） */
const CHART_PALETTE_ALIASES: Record<string, string> = {
  tech: "clarity",
  business: "enterprise",
  warm: "amber",
  vintage: "enterprise",
  elegant: "pastel",
  future: "clarity",
  gradient: "spectrum",
  simple: "clarity",
  soft: "pastel",
};

export const CHART_PALETTE_PRESETS = Object.fromEntries(
  CHART_PALETTE_CATALOG.map((preset) => [preset.id, [...preset.colors]]),
) as Record<string, string[]>;

export type ChartPaletteId = (typeof CHART_PALETTE_CATALOG)[number]["id"];

export function chartPaletteLabel(paletteId?: string): string | undefined {
  if (!paletteId) return undefined;
  const resolved = CHART_PALETTE_ALIASES[paletteId] ?? paletteId;
  return CHART_PALETTE_CATALOG.find((item) => item.id === resolved)?.label ?? paletteId;
}

export function resolvePaletteId(paletteId?: string): string | undefined {
  if (!paletteId) return undefined;
  return CHART_PALETTE_ALIASES[paletteId] ?? paletteId;
}

export function resolveChartColors(paletteId?: string, custom?: string[]): string[] {
  if (custom?.length) return custom;
  const resolved = resolvePaletteId(paletteId);
  if (resolved && resolved in CHART_PALETTE_PRESETS) {
    return [...CHART_PALETTE_PRESETS[resolved]!];
  }
  return [...chartColors];
}

/** 继承仪表板时的色带预览（与仪表板配置配色方案一致） */
export function resolveInheritPreviewColors(
  dashboardPaletteId?: string,
  dashboardPaletteColors?: readonly string[],
): readonly string[] {
  return resolveChartColors(
    dashboardPaletteId ?? "default",
    dashboardPaletteColors?.length ? [...dashboardPaletteColors] : undefined,
  );
}

function expandHex(hex: string): string {
  if (hex.length === 3) {
    return hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return hex;
}

/** 将调色板色值转为带 alpha 的 CSS 颜色（对标 DataEase 配色不透明度） */
export function withChartColorOpacity(color: string, opacity: number): string {
  const alpha = Math.min(1, Math.max(0, opacity));
  if (alpha >= 1) return color;
  const trimmed = color.trim();
  if (trimmed.startsWith("rgba(")) {
    return trimmed.replace(
      /rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*\)/,
      `rgba($1, $2, $3, ${alpha})`,
    );
  }
  if (trimmed.startsWith("rgb(")) {
    return trimmed.replace(
      /rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
      `rgba($1, $2, $3, ${alpha})`,
    );
  }
  if (trimmed.startsWith("#")) {
    const hex = expandHex(trimmed.slice(1));
    if (hex.length !== 6) return color;
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return color;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function applyChartColorsOpacity(colors: string[], opacity?: number): string[] {
  if (opacity == null || opacity >= 1) return colors;
  return colors.map((color) => withChartColorOpacity(color, opacity));
}

/** 当前生效的调色板色序列（自定义优先于预设） */
export function resolveActivePaletteColors(
  paletteId?: string,
  custom?: readonly string[],
): readonly string[] {
  if (custom?.length) return custom;
  return resolveChartColors(paletteId);
}

/** 自定义色板是否与当前预设一致 */
export function paletteColorsMatchPreset(
  paletteId: string | undefined,
  colors?: readonly string[],
): boolean {
  if (!colors?.length) return true;
  const preset = resolveChartColors(paletteId);
  if (colors.length !== preset.length) return false;
  return colors.every(
    (color, index) => color.toLowerCase() === preset[index]?.toLowerCase(),
  );
}

export const chartFontFamily = "Outfit, sans-serif";
