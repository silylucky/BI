type EChartsOption = Record<string, unknown>;

const DEFAULT_COLOR = "#465fff";

export type ChartLegendItem = { name: string; color: string };

/** 从 ECharts option 提取图例项（与 series / 配色顺序对齐） */
export function resolveChartLegendItems(
  option: EChartsOption,
  paletteColors: string[] = [],
): ChartLegendItem[] {
  const colors = paletteColors.length > 0 ? paletteColors : [DEFAULT_COLOR];
  const items: { name: string; color: string }[] = [];
  let colorIndex = 0;
  const nextColor = () => colors[colorIndex++ % colors.length] ?? DEFAULT_COLOR;

  if (!Array.isArray(option.series)) return items;

  for (const raw of option.series) {
    if (!raw || typeof raw !== "object") continue;
    const series = raw as { type?: string; name?: string; data?: unknown[] };
    const type = series.type;

    if (type === "pie" || type === "funnel") {
      for (const point of series.data ?? []) {
        if (!point || typeof point !== "object") continue;
        const name = (point as { name?: unknown }).name;
        if (name == null || name === "") continue;
        items.push({ name: String(name), color: nextColor() });
      }
      continue;
    }

    if (type === "map" || type === "map-3d" || type === "heatmap" || type === "gauge" || type === "sankey") {
      continue;
    }

    if (series.name != null && String(series.name) !== "") {
      items.push({ name: String(series.name), color: nextColor() });
    }
  }

  return items;
}
