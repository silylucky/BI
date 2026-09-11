import { useMemo, useRef } from "react";
import { ChartEngineView } from "@/components/charts/engine/ChartEngineView";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import { useDashboardColorScheme } from "@/hooks/useDashboardColorScheme";
import { resolveEffectivePaletteColors } from "@/lib/chartDeStyle";
import type { AnalysisTheme, CompareResult } from "../useStandardAnalysis";
import {
  comparePairPeriodLabels,
  deltasToComparePairRows,
} from "../standardAnalysisCompareChartData";
import { buildComparePairChartConfig } from "../standardAnalysisComparePresentation";

type Props = {
  theme: AnalysisTheme;
  compareData: CompareResult;
};

export function StandardAnalysisCompareChart({ theme, compareData }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scheme = useDashboardColorScheme(containerRef);
  const { currentLabel, previousLabel } = useMemo(
    () => comparePairPeriodLabels(compareData),
    [compareData],
  );
  const { headers, rows } = useMemo(
    () => deltasToComparePairRows(compareData.deltas, currentLabel, previousLabel),
    [compareData.deltas, currentLabel, previousLabel],
  );

  const config = useMemo(() => buildComparePairChartConfig(), []);

  const viewModel = useMemo(
    () =>
      buildChartViewModel(config, {
        columns: headers,
        rows,
      }),
    [config, headers, rows],
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
      distribution: "区域分布周期对比图表",
      activity: "活跃度周期对比图表",
      trend: "趋势周期对比图表",
      lifecycle: "生命周期周期对比图表",
    };
    return labels[theme];
  }, [theme]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col pt-2 pb-2">
      <div className="relative min-h-[320px] flex-1 w-full">
        <ChartEngineView
          viewModel={viewModel}
          style={style}
          chartConfig={config}
          ariaLabel={ariaLabel}
          fill
          height={360}
        />
      </div>
      {compareData.deltas.length > rows.length / 2 ? (
        <p className="px-1 pt-2 text-theme-xs text-gray-500 dark:text-gray-400">
          图表展示增减幅度最大的 {rows.length / 2} 个维度；切换「数据表」可查看全部 {compareData.deltas.length} 个维度。
        </p>
      ) : null}
    </div>
  );
}
