import { CHART_MOUNTING_WATCHDOG_MS } from "@/lib/chartLoadConcurrency";

export type ChartMountState = "waiting" | "mounting" | "ready";

type MountEntry = {
  widgetId: string;
  priority: number;
  inView: boolean;
  state: ChartMountState;
};

/** 限制同时进入重渲染阶段的 widget 数量；完成后释放 slot 供队列下一个使用 */
export class ChartMountScheduler {
  private maxConcurrent: number;
  private mounting = new Set<string>();
  private mountingAt = new Map<string, number>();
  private entries = new Map<string, MountEntry>();
  private listeners = new Set<() => void>();
  private interactionFreezeCount = 0;
  private interactionFrozen = false;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  /** 拖拽/缩放会话期间冻结已 ready 图表，避免 inView 抖动卸载兄弟组件 */
  acquireInteractionFreeze(): () => void {
    this.interactionFreezeCount += 1;
    this.syncInteractionFrozen();
    return () => {
      this.interactionFreezeCount = Math.max(0, this.interactionFreezeCount - 1);
      this.syncInteractionFrozen();
    };
  }

  isInteractionFrozen(): boolean {
    return this.interactionFrozen;
  }

  private syncInteractionFrozen(): void {
    const next = this.interactionFreezeCount > 0;
    if (next === this.interactionFrozen) return;
    this.interactionFrozen = next;
    if (!next) {
      this.preemptForPriority();
      this.drain();
    }
    this.notify();
  }

  setMaxConcurrent(maxConcurrent: number): void {
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.preemptForPriority();
    this.drain();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  register(widgetId: string, priority: number, inView: boolean): void {
    const existing = this.entries.get(widgetId);
    if (existing && existing.priority === priority && existing.inView === inView) {
      return;
    }
    if (existing) {
      existing.priority = priority;
      existing.inView = inView;
    } else {
      this.entries.set(widgetId, { widgetId, priority, inView, state: "waiting" });
    }
    this.preemptForPriority();
    this.drain();
    this.notify();
  }

  unregister(widgetId: string): void {
    const entry = this.entries.get(widgetId);
    if (entry?.state === "mounting") {
      this.releaseMounting(widgetId);
    }
    this.entries.delete(widgetId);
    this.drain();
    this.notify();
  }

  markReady(widgetId: string): void {
    const entry = this.entries.get(widgetId);
    if (!entry || entry.state !== "mounting") return;
    this.releaseMounting(widgetId);
    entry.state = "ready";
    this.drain();
    this.notify();
  }

  getGate(widgetId: string): { canQuery: boolean; canRender: boolean } {
    const entry = this.entries.get(widgetId);
    if (!entry) {
      return { canQuery: false, canRender: false };
    }
    // 已画完的图保留最后一帧：视口抖动/点选不要卸成灰色骨架（屏外只停 query）
    if (entry.state === "ready") {
      return { canQuery: entry.inView, canRender: true };
    }
    if (!entry.inView) {
      return { canQuery: false, canRender: false };
    }
    if (entry.state === "mounting") {
      return { canQuery: true, canRender: true };
    }
    return { canQuery: false, canRender: false };
  }

  /** 视口内 widget 均已 ready（用于缩略图截取前等待） */
  isInViewSettled(): boolean {
    for (const entry of this.entries.values()) {
      if (entry.inView && entry.state !== "ready") return false;
    }
    return true;
  }

  waitForInViewSettled(timeoutMs = 15_000): Promise<void> {
    if (this.isInViewSettled()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        if (this.isInViewSettled()) {
          cleanup();
          resolve();
        } else if (Date.now() > deadline) {
          cleanup();
          reject(new Error("ChartMountScheduler drain timeout"));
        }
      };
      const unsubscribe = this.subscribe(tick);
      const timer = window.setInterval(tick, 100);
      const cleanup = () => {
        unsubscribe();
        window.clearInterval(timer);
      };
      tick();
    });
  }

  private releaseMounting(widgetId: string): void {
    this.mounting.delete(widgetId);
    this.mountingAt.delete(widgetId);
  }

  private drain(): void {
    const waiting = [...this.entries.values()]
      .filter((entry) => entry.inView && entry.state === "waiting")
      .sort(
        (a, b) =>
          a.priority - b.priority || a.widgetId.localeCompare(b.widgetId),
      );

    for (const entry of waiting) {
      if (this.mounting.size >= this.maxConcurrent) break;
      entry.state = "mounting";
      this.mounting.add(entry.widgetId);
      if (!this.mountingAt.has(entry.widgetId)) {
        this.mountingAt.set(entry.widgetId, Date.now());
      }
    }
    this.scheduleWatchdog();
  }

  private preemptForPriority(): void {
    if (this.interactionFrozen) return;
    const waiting = [...this.entries.values()].filter(
      (entry) => entry.inView && entry.state === "waiting",
    );
    if (waiting.length === 0) return;

    const bestWaitingPriority = Math.min(...waiting.map((entry) => entry.priority));
    const need = waiting.filter((entry) => entry.priority === bestWaitingPriority).length;
    const free = this.maxConcurrent - this.mounting.size;
    let toFree = Math.max(0, Math.min(need, this.maxConcurrent) - free);
    if (toFree <= 0) return;

    const victims = [...this.entries.values()]
      .filter((entry) => entry.state === "mounting" && entry.priority > bestWaitingPriority)
      .sort((a, b) => b.priority - a.priority || b.widgetId.localeCompare(a.widgetId));
    for (const entry of victims) {
      if (toFree <= 0) break;
      entry.state = "waiting";
      this.releaseMounting(entry.widgetId);
      toFree -= 1;
    }
  }

  private scheduleWatchdog(): void {
    if (this.watchdogTimer != null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.mounting.size === 0) return;
    const oldest = Math.min(
      ...[...this.mounting].map((id) => this.mountingAt.get(id) ?? Date.now()),
    );
    const delay = Math.max(0, CHART_MOUNTING_WATCHDOG_MS - (Date.now() - oldest));
    this.watchdogTimer = setTimeout(() => {
      this.watchdogTimer = null;
      this.releaseStaleMounts();
    }, delay);
  }

  private releaseStaleMounts(): void {
    const now = Date.now();
    for (const widgetId of [...this.mounting]) {
      const started = this.mountingAt.get(widgetId) ?? 0;
      if (now - started < CHART_MOUNTING_WATCHDOG_MS) continue;
      this.markReady(widgetId);
    }
    this.scheduleWatchdog();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
