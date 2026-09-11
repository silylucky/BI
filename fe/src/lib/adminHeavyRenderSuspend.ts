import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { releaseAllListPreviewSlots } from "@/lib/listPreviewActivation";

let suspended = false;
const listeners = new Set<() => void>();

/** 订阅导航过渡期（useSyncExternalStore） */
export function subscribeAdminHeavyRenderSuspend(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAdminHeavyRenderSuspendSnapshot(): boolean {
  return suspended;
}

function notifySuspendListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** 侧栏按下时调用：同步摘掉列表 live 预览，释放主线程给路由切换 */
export function beginAdminNavTransition(): void {
  if (suspended) return;
  suspended = true;
  setChartAnimationSuppressed(true);
  releaseAllListPreviewSlots();
  notifySuspendListeners();
}

/** 新路由壳层就绪后恢复（由 AdminNavPerfTracker 调用） */
export function endAdminNavTransition(): void {
  if (!suspended) return;
  suspended = false;
  setChartAnimationSuppressed(false);
  notifySuspendListeners();
}

export function resetAdminNavTransitionForTests(): void {
  suspended = false;
  listeners.clear();
}
