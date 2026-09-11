import type { ChartMountScheduler } from "@/lib/chartMountScheduler";

let activeScheduler: ChartMountScheduler | null = null;

export function registerActiveChartMountScheduler(
  scheduler: ChartMountScheduler | null,
): void {
  activeScheduler = scheduler;
}

/**
 * 尽力等待可见图表挂载完成（缩略图截取前）。
 * 超时返回 false，避免阻塞布局保存主路径。
 */
export async function waitForActiveChartMountDrain(timeoutMs = 8_000): Promise<boolean> {
  if (!activeScheduler) return true;
  try {
    await activeScheduler.waitForInViewSettled(timeoutMs);
    return true;
  } catch {
    return false;
  }
}
