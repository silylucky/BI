import type { MapChartFieldHint } from "@/lib/mapChartDataHint";

/** 对标 DataEase：地图字段配置提示 + 示例 SQL */
export function MapChartFieldHintBanner({ hint }: { hint: MapChartFieldHint }) {
  return (
    <div className="space-y-1.5 rounded-md border border-brand-500/20 bg-brand-500/5 px-2 py-1.5 text-[10px] leading-snug text-gray-600 dark:text-gray-400">
      <p>{hint.message}</p>
      {hint.sampleSql ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/5 p-1.5 font-mono text-[9px] text-gray-700 dark:bg-white/5 dark:text-gray-300">
          {hint.sampleSql}
        </pre>
      ) : null}
    </div>
  );
}
