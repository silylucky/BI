type EChartsOption = Record<string, unknown>;
import { activeFieldRefs } from "@/lib/chartConfigState";
import { isLineOrBarType, type ChartType, type ChartViewConfig } from "@/lib/chartViewConfig";
import { getChartPlugin } from "@/components/charts/engine/plugins/registry";
import { resolveChartColors, resolvePaletteId } from "@/lib/chartPalette";
import { readChartDeStyle } from "@/lib/chartDeStyle";

/** 对标 DE basicStyle.seriesColor：按系列/指标单独设色 */
export type ChartSeriesColorItem = {
  id: string;
  name: string;
  color: string;
};

export function supportsChartSeriesColorEditing(chartType: ChartType): boolean {
  const plugin = getChartPlugin(chartType);
  if (plugin) {
    return (
      plugin.paletteCategory === "trend" ||
      plugin.paletteCategory === "compare" ||
      plugin.paletteCategory === "dual_axes"
    );
  }
  return isLineOrBarType(chartType);
}

/** 系列默认色取色：组件自定义色板 > 已解析 chartColors */
export function resolveSeriesPaletteColors(
  chartConfig: ChartViewConfig,
  resolvedChartColors?: readonly string[],
): readonly string[] | undefined {
  const de = readChartDeStyle(chartConfig);
  if (de.paletteId != null && de.paletteColors?.length) {
    return de.paletteColors;
  }
  if (resolvedChartColors?.length) {
    return resolvedChartColors;
  }
  return undefined;
}

export function resolveChartSeriesColorItems(
  cfg: ChartViewConfig,
  paletteId: string | undefined,
  stored?: readonly ChartSeriesColorItem[],
  paletteColors?: readonly string[],
): ChartSeriesColorItem[] {
  if (!supportsChartSeriesColorEditing(cfg.chartType)) return [];

  const metrics = activeFieldRefs(cfg.metrics);
  if (metrics.length === 0) return [];

  const palette = resolveChartColors(
    resolvePaletteId(paletteId) ?? "default",
    paletteColors?.length ? [...paletteColors] : undefined,
  );
  const storedMap = new Map((stored ?? []).map((item) => [item.id, item]));

  return metrics.map((metric, index) => {
    const id = metric.field;
    const name = metric.label?.trim() || metric.field;
    const saved = storedMap.get(id);
    return {
      id,
      name,
      color: saved?.color ?? palette[index % palette.length] ?? palette[0],
    };
  });
}

export function chartSeriesColorCustomized(
  cfg: ChartViewConfig,
  paletteId: string | undefined,
  stored?: readonly ChartSeriesColorItem[],
  resolvedChartColors?: readonly string[],
): boolean {
  if (!stored?.length) return false;
  const defaults = resolveChartSeriesColorItems(
    cfg,
    paletteId,
    undefined,
    resolveSeriesPaletteColors(cfg, resolvedChartColors),
  );
  const defaultMap = new Map(defaults.map((item) => [item.id, item.color]));
  return stored.some((item) => defaultMap.get(item.id) !== item.color);
}

export function applyChartSeriesColorOverrides(
  option: EChartsOption,
  items: readonly ChartSeriesColorItem[],
): EChartsOption {
  if (!items.length || !Array.isArray(option.series)) return option;

  const byName = new Map(items.map((item) => [item.name, item.color]));
  const byId = new Map(items.map((item) => [item.id, item.color]));

  return {
    ...option,
    series: option.series.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const series = entry as { name?: string; itemStyle?: Record<string, unknown> };
      const key = series.name != null ? String(series.name) : "";
      const color = byName.get(key) ?? byId.get(key);
      if (!color) return entry;
      return {
        ...entry,
        itemStyle: {
          ...(series.itemStyle ?? {}),
          color,
        },
      };
    }),
  };
}
