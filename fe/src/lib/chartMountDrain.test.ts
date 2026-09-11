import { describe, expect, it } from "vitest";
import { ChartMountScheduler } from "./chartMountScheduler";
import {
  registerActiveChartMountScheduler,
  waitForActiveChartMountDrain,
} from "./chartMountDrain";

describe("waitForActiveChartMountDrain", () => {
  it("does not throw when drain times out", async () => {
    const scheduler = new ChartMountScheduler(1);
    scheduler.register("slow", 1, true);
    registerActiveChartMountScheduler(scheduler);
    await expect(waitForActiveChartMountDrain(50)).resolves.toBe(false);
    registerActiveChartMountScheduler(null);
  });

  it("resolves when scheduler is unset", async () => {
    registerActiveChartMountScheduler(null);
    await expect(waitForActiveChartMountDrain()).resolves.toBe(true);
  });
});
