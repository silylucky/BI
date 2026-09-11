import type { ChartViewConfig } from "@/lib/chartViewConfig";

export type ChartMarkLine = {
  id: string;
  enabled: boolean;
  name?: string;
  axis: "y" | "x";
  value: number;
  color?: string;
  lineStyle?: "solid" | "dashed";
};

export type ChartConditionalOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export type ChartConditionalRule = {
  id: string;
  enabled: boolean;
  operator: ChartConditionalOperator;
  value: number;
  color: string;
};

export type ChartLinkageConfig = {
  enabled: boolean;
  /** 注入 SQL `{{key}}` 占位符的参数键 */
  parameterKey?: string;
  /** 联动目标组件；空则联动看板上其余全部图表 */
  targetWidgetIds?: string[];
};

export type ChartDeFeatures = {
  dataZoom?: boolean;
  showLabel?: boolean;
  markLines?: ChartMarkLine[];
  conditionalRules?: ChartConditionalRule[];
  linkage?: ChartLinkageConfig;
};

const DEFAULT_LINKAGE: ChartLinkageConfig = {
  enabled: false,
  parameterKey: "region",
  targetWidgetIds: [],
};

export function readChartDeFeatures(cfg: ChartViewConfig): ChartDeFeatures {
  const raw = cfg.nativeBody?.deFeatures;
  if (!raw || typeof raw !== "object") return {};
  return raw as ChartDeFeatures;
}

export function patchChartDeFeatures(
  cfg: ChartViewConfig,
  patch: Partial<ChartDeFeatures>,
): ChartViewConfig {
  const prev = readChartDeFeatures(cfg);
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deFeatures: { ...prev, ...patch },
    },
  };
}

export function readChartMarkLines(cfg: ChartViewConfig): ChartMarkLine[] {
  return readChartDeFeatures(cfg).markLines ?? [];
}

export function readChartConditionalRules(cfg: ChartViewConfig): ChartConditionalRule[] {
  return readChartDeFeatures(cfg).conditionalRules ?? [];
}

export function readChartLinkageConfig(cfg: ChartViewConfig): ChartLinkageConfig {
  const linkage = readChartDeFeatures(cfg).linkage;
  return { ...DEFAULT_LINKAGE, ...linkage };
}

export function chartLinkageIsConfigured(linkage: ChartLinkageConfig): boolean {
  return linkage.enabled && Boolean(linkage.parameterKey?.trim());
}

export function matchConditionalRule(value: number, rule: ChartConditionalRule): boolean {
  switch (rule.operator) {
    case "gt":
      return value > rule.value;
    case "gte":
      return value >= rule.value;
    case "lt":
      return value < rule.value;
    case "lte":
      return value <= rule.value;
    default:
      return value === rule.value;
  }
}

function extractSeriesNumeric(item: unknown): number | null {
  if (typeof item === "number" && Number.isFinite(item)) return item;
  if (Array.isArray(item)) {
    const tail = item[item.length - 1];
    return typeof tail === "number" && Number.isFinite(tail) ? tail : null;
  }
  if (item && typeof item === "object" && "value" in item) {
    const v = (item as { value?: unknown }).value;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return extractSeriesNumeric(v);
  }
  return null;
}

/** ECharts 辅助线（对标 DE 高级 · 辅助线） */
export function applyMarkLinesToEchartsOption(
  option: Record<string, unknown>,
  markLines: ChartMarkLine[],
): Record<string, unknown> {
  const active = markLines.filter((line) => line.enabled && Number.isFinite(line.value));
  if (active.length === 0 || !Array.isArray(option.series) || option.series.length === 0) {
    return option;
  }
  const data = active.map((line) => ({
    ...(line.axis === "y" ? { yAxis: line.value } : { xAxis: line.value }),
    name: line.name?.trim() || undefined,
    lineStyle: {
      color: line.color || "#f04438",
      type: line.lineStyle || "dashed",
    },
  }));
  const series = option.series.map((entry, index) => {
    if (index !== 0 || !entry || typeof entry !== "object") return entry;
    return {
      ...(entry as object),
      markLine: {
        symbol: "none",
        silent: true,
        label: { show: true, fontSize: 10 },
        data,
      },
    };
  });
  return { ...option, series };
}

/** 柱/线/热力条件着色（对标 DE 高级 · 条件样式）→ G2Plot */
export function applyConditionalRulesToG2PlotOptions(
  options: Record<string, unknown>,
  plotType: string,
  rules: ChartConditionalRule[],
): Record<string, unknown> {
  const active = rules.filter((rule) => rule.enabled && Number.isFinite(rule.value));
  if (active.length === 0) return options;

  const yField = options.yField as string | undefined;
  const colorField = options.colorField as string | undefined;

  const resolveNumeric = (datum: Record<string, unknown>): number | null => {
    if (yField && datum[yField] != null) {
      const value = Number(datum[yField]);
      return Number.isFinite(value) ? value : null;
    }
    if (colorField && datum[colorField] != null) {
      const value = Number(datum[colorField]);
      return Number.isFinite(value) ? value : null;
    }
    return null;
  };

  const styleFn = (datum: Record<string, unknown>) => {
    const numeric = resolveNumeric(datum);
    if (numeric == null) return {};
    const matched = active.find((rule) => matchConditionalRule(numeric, rule));
    return matched ? { fill: matched.color } : {};
  };

  if (plotType === "Column" || plotType === "Bar") {
    const key = plotType === "Bar" ? "barStyle" : "columnStyle";
    return { ...options, [key]: styleFn };
  }
  if (plotType === "Line") {
    return { ...options, lineStyle: styleFn };
  }
  if (plotType === "Heatmap") {
    return {
      ...options,
      color: (datum: Record<string, unknown>) => {
        const numeric = resolveNumeric(datum);
        if (numeric == null) return undefined;
        const matched = active.find((rule) => matchConditionalRule(numeric, rule));
        return matched?.color;
      },
    };
  }
  return options;
}

/** 柱/线条件着色（对标 DE 高级 · 条件样式）→ ECharts */
export function applyConditionalRulesToEchartsOption(
  option: Record<string, unknown>,
  rules: ChartConditionalRule[],
): Record<string, unknown> {
  const active = rules.filter((rule) => rule.enabled && Number.isFinite(rule.value));
  if (active.length === 0 || !Array.isArray(option.series)) return option;

  const series = option.series.map((entry, index) => {
    if (index !== 0 || !entry || typeof entry !== "object") return entry;
    const seriesObj = entry as Record<string, unknown>;
    if (!Array.isArray(seriesObj.data)) return entry;
    const nextData = seriesObj.data.map((item) => {
      const numeric = extractSeriesNumeric(item);
      if (numeric == null) return item;
      const matched = active.find((rule) => matchConditionalRule(numeric, rule));
      if (!matched) return item;
      if (item && typeof item === "object") {
        return {
          ...(item as object),
          itemStyle: { color: matched.color },
        };
      }
      return { value: item, itemStyle: { color: matched.color } };
    });
    return { ...seriesObj, data: nextData };
  });
  return { ...option, series };
}

export function applyChartAdvancedFeaturesToEchartsOption(
  option: Record<string, unknown>,
  cfg: ChartViewConfig,
): Record<string, unknown> {
  let next = option;
  next = applyMarkLinesToEchartsOption(next, readChartMarkLines(cfg));
  next = applyConditionalRulesToEchartsOption(next, readChartConditionalRules(cfg));
  return next;
}
