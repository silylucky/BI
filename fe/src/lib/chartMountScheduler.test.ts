import { afterEach, describe, expect, it, vi } from "vitest";
import { CHART_MOUNTING_WATCHDOG_MS } from "./chartLoadConcurrency";
import { ChartMountScheduler } from "./chartMountScheduler";

describe("ChartMountScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("limits concurrent mounting slots", () => {
    const scheduler = new ChartMountScheduler(2);
    scheduler.register("a", 1, true);
    scheduler.register("b", 1, true);
    scheduler.register("c", 1, true);

    expect(scheduler.getGate("a")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("b")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("c")).toEqual({ canQuery: false, canRender: false });

    scheduler.markReady("a");
    expect(scheduler.getGate("c")).toEqual({ canQuery: true, canRender: true });
  });

  it("prioritizes selected widget", () => {
    const scheduler = new ChartMountScheduler(1);
    scheduler.register("slow", 1, true);
    scheduler.register("fast", 0, true);

    expect(scheduler.getGate("fast")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("slow")).toEqual({ canQuery: false, canRender: false });
  });

  it("pauses out-of-view widgets", () => {
    const scheduler = new ChartMountScheduler(2);
    scheduler.register("offscreen", 1, false);
    expect(scheduler.getGate("offscreen")).toEqual({ canQuery: false, canRender: false });
  });

  it("releases slot after markReady for empty-result widget", () => {
    const scheduler = new ChartMountScheduler(2);
    scheduler.register("empty", 1, true);
    scheduler.register("next", 1, true);
    scheduler.register("queued", 1, true);
    expect(scheduler.getGate("queued")).toEqual({ canQuery: false, canRender: false });
    scheduler.markReady("empty");
    expect(scheduler.getGate("queued")).toEqual({ canQuery: true, canRender: true });
  });

  it("waitForInViewSettled resolves when all in-view widgets are ready", async () => {
    const scheduler = new ChartMountScheduler(2);
    scheduler.register("a", 1, true);
    scheduler.register("b", 1, true);
    const pending = scheduler.waitForInViewSettled(1000);
    scheduler.markReady("a");
    scheduler.markReady("b");
    await expect(pending).resolves.toBeUndefined();
    expect(scheduler.isInViewSettled()).toBe(true);
  });

  it("waitForInViewSettled rejects after timeout", async () => {
    const scheduler = new ChartMountScheduler(1);
    scheduler.register("stuck", 1, true);
    await expect(scheduler.waitForInViewSettled(80)).rejects.toThrow(/timeout/);
  });

  it("keeps ready widgets rendered while interaction is frozen even if offscreen", () => {
    const scheduler = new ChartMountScheduler(1);
    scheduler.register("ready", 1, true);
    scheduler.markReady("ready");
    const release = scheduler.acquireInteractionFreeze();
    scheduler.register("ready", 1, false);
    expect(scheduler.getGate("ready")).toEqual({ canQuery: false, canRender: true });
    release();
    expect(scheduler.getGate("ready")).toEqual({ canQuery: false, canRender: true });
  });

  it("keeps in-view ready peers querying during interaction freeze", () => {
    const scheduler = new ChartMountScheduler(2);
    scheduler.register("selected", 0, true);
    scheduler.register("peer", 1, true);
    scheduler.markReady("selected");
    scheduler.markReady("peer");
    const release = scheduler.acquireInteractionFreeze();
    expect(scheduler.getGate("selected")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("peer")).toEqual({ canQuery: true, canRender: true });
    release();
    expect(scheduler.getGate("peer")).toEqual({ canQuery: true, canRender: true });
  });

  it("restores offscreen pause after interaction freeze ends", () => {
    const scheduler = new ChartMountScheduler(2);
    scheduler.register("a", 1, true);
    scheduler.markReady("a");
    const release = scheduler.acquireInteractionFreeze();
    scheduler.register("a", 1, false);
    expect(scheduler.getGate("a").canRender).toBe(true);
    release();
    expect(scheduler.getGate("a")).toEqual({ canQuery: false, canRender: true });
  });

  it("does not evict in-flight mounts when a higher-priority widget has a free slot", () => {
    const scheduler = new ChartMountScheduler(3);
    scheduler.register("a", 1, true);
    scheduler.register("b", 1, true);
    scheduler.register("selected", 0, true);

    expect(scheduler.getGate("a")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("b")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("selected")).toEqual({ canQuery: true, canRender: true });
  });

  it("preempts only enough slots for a higher-priority waiter", () => {
    const scheduler = new ChartMountScheduler(1);
    scheduler.register("slow", 1, true);
    scheduler.register("fast", 0, true);
    expect(scheduler.getGate("fast")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("slow")).toEqual({ canQuery: false, canRender: false });
  });

  it("does not notify when register is a no-op", () => {
    const scheduler = new ChartMountScheduler(2);
    scheduler.register("a", 1, true);
    let n = 0;
    scheduler.subscribe(() => {
      n += 1;
    });
    scheduler.register("a", 1, true);
    expect(n).toBe(0);
  });

  it("does not preempt in-flight mounts while interaction is frozen", () => {
    const scheduler = new ChartMountScheduler(1);
    scheduler.register("slow", 1, true);
    const release = scheduler.acquireInteractionFreeze();
    scheduler.register("fast", 0, true);
    expect(scheduler.getGate("slow")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("fast")).toEqual({ canQuery: false, canRender: false });
    release();
    expect(scheduler.getGate("fast")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("slow")).toEqual({ canQuery: false, canRender: false });
  });

  it("releases stale mounting slots after watchdog", () => {
    vi.useFakeTimers();
    const scheduler = new ChartMountScheduler(1);
    scheduler.register("stuck", 1, true);
    scheduler.register("next", 1, true);
    expect(scheduler.getGate("next").canRender).toBe(false);
    vi.advanceTimersByTime(CHART_MOUNTING_WATCHDOG_MS);
    expect(scheduler.getGate("stuck")).toEqual({ canQuery: true, canRender: true });
    expect(scheduler.getGate("next")).toEqual({ canQuery: true, canRender: true });
  });
});
