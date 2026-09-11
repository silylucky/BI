export type SummaryMetricItem = {
  label: string;
  value: string;
  hint?: string;
};

type Props = {
  metrics: SummaryMetricItem[];
};

/** 图表区顶部紧凑指标条（不占 Card 大块留白） */
export function StandardAnalysisSummaryMetrics({ metrics }: Props) {
  if (metrics.length === 0) return null;

  return (
    <div
      className="flex shrink-0 flex-wrap items-stretch divide-x divide-gray-200 rounded-lg border border-gray-200 bg-gray-50/80 dark:divide-gray-800 dark:border-gray-800 dark:bg-white/[0.02]"
      data-testid="standard-analysis-live-summary"
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="min-w-[5.5rem] flex-1 px-3 py-2 sm:px-4"
          title={metric.hint}
        >
          <p className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">{metric.label}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums leading-tight text-gray-800 dark:text-white/90">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}
