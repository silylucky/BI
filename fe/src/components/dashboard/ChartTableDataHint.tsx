import { tableInspectorProfile } from "@/lib/chartTableInspector";
import { useChartInspector } from "./ChartInspectorContext";

/** 数据 Tab 顶部：按表格类型展示 DE 对齐说明 */
export function ChartTableDataHint() {
  const { cfg } = useChartInspector();
  const profile = tableInspectorProfile(cfg.chartType);
  if (!profile) return null;

  return (
    <p className="rounded-md border border-brand-200/60 bg-brand-50/50 px-2 py-1.5 text-[10px] leading-snug text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
      {profile.dataHint}
    </p>
  );
}
