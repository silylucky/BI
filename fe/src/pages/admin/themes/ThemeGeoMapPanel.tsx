import { useMemo } from "react";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import { D3ViewRouter } from "@/components/charts/engine/d3/d3ViewRouter";

type ThemeGeoMapPanelProps = {
  columns: string[];
  rows: unknown[][];
  ariaLabel?: string;
  onProvinceClick?: (provinceName: string) => void;
};

function resolveFieldIndex(columns: string[], candidates: string[], fallback: number): number {
  for (const name of candidates) {
    const idx = columns.indexOf(name);
    if (idx >= 0) return idx;
  }
  return fallback;
}

export function ThemeGeoMapPanel({
  columns,
  rows,
  ariaLabel = "GIS 分布地图",
  onProvinceClick,
}: ThemeGeoMapPanelProps) {
  const regionIdx = resolveFieldIndex(columns, ["region", "province", "name"], 0);
  const metricIdx = resolveFieldIndex(columns, ["cnt", "value", "count"], 1);
  const regionField = columns[regionIdx] ?? columns[0] ?? "region";
  const metricField = columns[metricIdx] ?? columns[1] ?? columns[0] ?? "value";

  const config = useMemo<ChartViewConfig>(
    () => ({
      chartType: "map",
      dimensions: [{ field: regionField }],
      metrics: [{ field: metricField }],
    }),
    [regionField, metricField],
  );

  const viewModel = useMemo(
    () => buildChartViewModel(config, { columns, rows }),
    [config, columns, rows],
  );

  const style = useMemo(
    () =>
      buildStyleContext({
        config,
        scheme: "light",
        chartColors: [],
      }),
    [config],
  );

  return (
    <D3ViewRouter
      viewModel={viewModel}
      style={style}
      ariaLabel={ariaLabel}
      fill
      onInteraction={
        onProvinceClick
          ? (event) => {
              if (event.kind === "drill") onProvinceClick(event.value);
            }
          : undefined
      }
    />
  );
}
