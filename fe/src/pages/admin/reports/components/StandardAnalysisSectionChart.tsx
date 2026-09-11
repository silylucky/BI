import { useMemo, useRef, type ReactNode } from "react";
import { ChartEngineView } from "@/components/charts/engine/ChartEngineView";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import { useDashboardColorScheme } from "@/hooks/useDashboardColorScheme";
import { resolveEffectivePaletteColors } from "@/lib/chartDeStyle";
import type { AnalysisTheme, StandardAnalysisRenderMeta } from "../useStandardAnalysis";
import { buildStandardSectionChartConfig } from "../standardAnalysisPresentation";
import {
  prepareTrendChartRows,
  sortTimeSeriesRows,
} from "../standardAnalysisTimeSeries";
import { buildLiveSummaryMetrics } from "./standardAnalysisUi";
import { StandardAnalysisSummaryMetrics } from "./StandardAnalysisSummaryMetrics";

type Props = {
  theme: AnalysisTheme;
  headers: string[];
  rows: unknown[][];
  chartType: "bar" | "line";
  meta?: StandardAnalysisRenderMeta;
  headerActions?: ReactNode;
};

export function StandardAnalysisSectionChart({
  theme,
  headers,
  rows,
  chartType,
  meta,
  headerActions,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scheme = useDashboardColorScheme(containerRef);
  const metrics = useMemo(
    () => buildLiveSummaryMetrics(headers, rows, theme, meta),
    [headers, meta, rows, theme],
  );

  const chartRows = useMemo(() => {
    if (theme === "trend") return prepareTrendChartRows(headers, rows);
    if (theme === "activity") return sortTimeSeriesRows(headers, rows);
    return rows;
  }, [headers, rows, theme]);

  const config = useMemo(
    () => buildStandardSectionChartConfig(headers, chartType, theme),
    [chartType, headers, theme],
  );

  const viewModel = useMemo(
    () =>
      buildChartViewModel(config, {
        columns: headers,
        rows: chartRows as (string | number | boolean | null)[][],
      }),
    [chartRows, config, headers],
  );

  const style = useMemo(
    () =>
      buildStyleContext({
        config,
        scheme,
        chartColors: resolveEffectivePaletteColors(config, "default"),
        embedEdit: false,
      }),
    [config, scheme],
  );

  const ariaLabel = useMemo(() => {
    const labels: Record<AnalysisTheme, string> = {
      distribution: "区域分布图表",
      activity: "活跃度趋势图表",
      trend: "趋势图表",
      lifecycle: "生命周期图表",
    };
    return labels[theme];
  }, [theme]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col gap-2 px-5 pb-4 pt-2">
      <div className="flex shrink-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <StandardAnalysisSummaryMetrics metrics={metrics} />
        </div>
        {headerActions}
      </div>
      <div className="relative min-h-[360px] flex-1 w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <ChartEngineView
          viewModel={viewModel}
          style={style}
          chartConfig={config}
          ariaLabel={ariaLabel}
          fill
          height={400}
        />
      </div>
    </div>
  );
}
