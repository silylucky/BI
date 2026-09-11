import { morphNumber } from "@/components/charts/engine/d3/core/motionEngine";
import { getDepthVisual } from "@/components/charts/engine/d3/core/depthEngine";
import type { D3RenderConfig } from "@/components/charts/engine/d3/types";
import { themeFromConfig } from "@/components/charts/engine/d3/core/themeEngine";
import { classifyDatasetField } from "@/components/dashboard/datasetFieldClassification";
import { scaleChartPresentationFontSize } from "@/components/charts/engine/d3/core/chartPresentationScale";
import { formatChartValue } from "@/lib/chartValueFormat";

type KpiMetric = { field: string; label?: string | null };

type KpiItem = {
  label: string;
  raw: unknown;
  numeric: number | null;
};

function metricLabel(metric: KpiMetric): string {
  return metric.label?.trim() || metric.field;
}

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function columnIndex(columns: string[], field: string): number {
  return columns.indexOf(field);
}

function countNonNull(rows: unknown[][], colIdx: number): number {
  let count = 0;
  for (const row of rows) {
    const v = row[colIdx];
    if (v != null && v !== "") count += 1;
  }
  return count;
}

function sumNumericColumn(rows: unknown[][], colIdx: number): number {
  let sum = 0;
  for (const row of rows) {
    const n = parseNumeric(row[colIdx]);
    if (n != null) sum += n;
  }
  return sum;
}

function isNumericColumn(rows: unknown[][], colIdx: number): boolean {
  for (const row of rows) {
    const n = parseNumeric(row[colIdx]);
    if (n != null) return true;
  }
  return false;
}

function resolveAutoLabelField(
  columns: string[],
  metrics: KpiMetric[],
  rows: unknown[][],
  explicit?: string,
): string | undefined {
  if (explicit && columns.includes(explicit)) return explicit;
  if (metrics.length !== 1 || rows.length <= 1) return undefined;
  const metricField = metrics[0].field;
  const metricIdx = columnIndex(columns, metricField);
  const metricKind = classifyDatasetField(metricField);
  if (metricKind === "dimension" || !isNumericColumn(rows, metricIdx)) {
    return undefined;
  }
  const others = columns.filter((c) => c !== metricField);
  if (others.length !== 1) return undefined;
  return others[0];
}

function aggregateMetricValue(
  field: string,
  rows: unknown[][],
  columns: string[],
): { raw: number; numeric: number; suffix: string } {
  const idx = columnIndex(columns, field);
  if (idx < 0) return { raw: 0, numeric: 0, suffix: "" };
  const kind = classifyDatasetField(field);
  const numericCol = isNumericColumn(rows, idx);
  if (kind === "metric" && numericCol) {
    const sum = sumNumericColumn(rows, idx);
    return { raw: sum, numeric: sum, suffix: "求和" };
  }
  const count = countNonNull(rows, idx);
  return { raw: count, numeric: count, suffix: "计数" };
}

function buildKpiItems(
  metrics: KpiMetric[],
  rows: unknown[][],
  columns: string[],
  labelField?: string,
): KpiItem[] {
  const resolvedLabelField = resolveAutoLabelField(columns, metrics, rows, labelField);
  const labelIdx = resolvedLabelField ? columnIndex(columns, resolvedLabelField) : -1;
  const primaryMetric = metrics[0];

  if (metrics.length === 1 && labelIdx >= 0 && primaryMetric) {
    const valueIdx = columnIndex(columns, primaryMetric.field);
    if (valueIdx < 0) return [];
    return rows.map((row) => ({
      label: String(row[labelIdx] ?? metricLabel(primaryMetric)),
      raw: row[valueIdx],
      numeric: parseNumeric(row[valueIdx]),
    }));
  }

  if (metrics.length === 1 && primaryMetric) {
    const agg = aggregateMetricValue(primaryMetric.field, rows, columns);
    const suffix = agg.suffix ? ` (${agg.suffix})` : "";
    return [
      {
        label: `${metricLabel(primaryMetric)}${suffix}`,
        raw: agg.raw,
        numeric: agg.numeric,
      },
    ];
  }

  const row = rows[0] ?? [];
  return metrics.map((metric) => {
    const idx = columnIndex(columns, metric.field);
    const raw = idx >= 0 ? row[idx] : undefined;
    return {
      label: metricLabel(metric),
      raw,
      numeric: parseNumeric(raw),
    };
  });
}

function clampFontSize(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, px));
}

function kpiAlignFlex(align: "left" | "center" | "right"): string {
  if (align === "left") return "items-start";
  if (align === "right") return "items-end";
  return "items-center";
}

function kpiAlignGrid(align: "left" | "center" | "right"): string {
  if (align === "left") return "justify-items-start";
  if (align === "right") return "justify-items-end";
  return "justify-items-center";
}

export function renderD3KpiChart(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();

  const { theme: rawTheme, valueFormat, options, colors, width = 320, height = 180, visualScale, renderTier } = config;
  const theme = themeFromConfig(rawTheme);
  const metrics = (options.metrics as KpiMetric[] | undefined) ?? [];
  const rows = (options.rows as unknown[][] | undefined) ?? [];
  const columns = (options.columns as string[] | undefined) ?? [];
  const labelField = options.labelField as string | undefined;
  const items = buildKpiItems(metrics, rows, columns, labelField);

  const root = document.createElement("div");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "指标卡");
  root.className = "vs-kpi-chart flex h-full min-h-0 flex-col overflow-hidden";
  const kpiFontSize = clampFontSize(
    scaleChartPresentationFontSize(Number(options.__kpiFontSize ?? 40), {
      chartWidth: width,
      chartHeight: height,
      visualScale,
      renderTier,
    }),
    14,
    80,
  );
  const labelFontSize = clampFontSize(Math.round(kpiFontSize * 0.38), 8, 24);
  const kpiAlign = String(options.__kpiAlign ?? "center") as "left" | "center" | "right";
  const depthVisual = getDepthVisual();
  if (depthVisual === "enhanced") root.classList.add("vs-kpi-depth-enhanced");
  else if (depthVisual === "standard") root.classList.add("vs-kpi-depth-standard");
  root.style.width = "100%";
  root.style.height = "100%";
  root.style.boxSizing = "border-box";

  const layout = document.createElement("div");
  const single = items.length === 1;
  const alignFlex = kpiAlignFlex(kpiAlign);
  layout.className = single
    ? `flex h-full min-h-0 flex-col ${alignFlex} justify-center px-4 py-3`
    : `grid h-full min-h-0 auto-rows-fr gap-3 overflow-auto p-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] ${kpiAlignGrid(kpiAlign)}`;
  layout.style.textAlign = kpiAlign;

  const cleanups: (() => void)[] = [];
  const accentColors = colors?.length ? colors : ["#465fff"];
  const labelColor = "var(--dashboard-kpi-label-color, #12b76a)";

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const accent = accentColors[i % accentColors.length] ?? accentColors[0];

    const card = document.createElement("div");
    card.className = single
      ? `flex min-h-0 max-w-full flex-col ${alignFlex} justify-center gap-1`
      : `flex min-h-[4.5rem] w-full flex-col ${alignFlex} justify-center gap-1 rounded-xl border px-3 py-2 shadow-theme-xs`;
    if (!single) {
      card.style.borderColor = theme.gridLine;
      card.style.background = "var(--dashboard-widget-surface, transparent)";
    }

    const valueEl = document.createElement("p");
    valueEl.className = "font-semibold tabular-nums leading-none tracking-tight";
    valueEl.style.fontSize = `${kpiFontSize}px`;
    valueEl.style.color = accent;
    valueEl.textContent = formatChartValue(item.raw, valueFormat);

    const label = document.createElement("p");
    label.className = "line-clamp-2 font-medium leading-snug";
    label.style.fontSize = `${labelFontSize}px`;
    label.style.color = labelColor;
    label.textContent = item.label;

    if (item.numeric != null) {
      valueEl.textContent = formatChartValue(0, valueFormat);
      cleanups.push(
        morphNumber(0, item.numeric, (v) => {
          valueEl.textContent = formatChartValue(v, valueFormat);
        }),
      );
    }

    card.append(valueEl, label);
    layout.append(card);
  }

  root.append(layout);
  container.append(root);

  return () => {
    cleanups.forEach((fn) => fn());
    container.replaceChildren();
  };
}
