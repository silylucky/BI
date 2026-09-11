import type { GisMapDataHint } from "@/lib/gisMapDataHint";
import { cn } from "@/lib/utils";

const toneClass: Record<GisMapDataHint["tone"], string> = {
  info: "border-brand-500/20 bg-brand-500/5 text-gray-600 dark:text-gray-400",
  warn: "border-warning-500/30 bg-warning-500/10 text-warning-800 dark:text-warning-300",
  ok: "border-success-500/25 bg-success-500/10 text-success-800 dark:text-success-300",
};

/** GIS 地图数据页：说明 + 示例 SQL */
export function GisMapDataHintBanner({ hint }: { hint: GisMapDataHint }) {
  return (
    <div
      role={hint.tone === "warn" ? "alert" : "status"}
      data-testid="gis-map-data-hint"
      data-tone={hint.tone}
      className={cn(
        "space-y-1.5 rounded-md border px-2 py-1.5 text-[10px] leading-snug",
        toneClass[hint.tone],
      )}
    >
      <p>{hint.message}</p>
      {hint.sampleSql ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/5 p-1.5 font-mono text-[9px] text-gray-700 dark:bg-white/5 dark:text-gray-300">
          {hint.sampleSql}
        </pre>
      ) : null}
    </div>
  );
}
