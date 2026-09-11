import { useEffect } from "react";
import { useChartMountScheduler } from "@/components/charts/ChartMountContext";

/** 拖拽/缩放期间冻结已挂载图表，防止兄弟 widget 因 inView 抖动变灰 */
export function ChartMountInteractionBridge({ frozen }: { frozen: boolean }) {
  const scheduler = useChartMountScheduler();

  useEffect(() => {
    if (!scheduler || !frozen) return undefined;
    return scheduler.acquireInteractionFreeze();
  }, [scheduler, frozen]);

  return null;
}
