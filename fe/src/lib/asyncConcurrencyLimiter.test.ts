import { describe, expect, it } from "vitest";
import { createConcurrencyLimiter } from "./asyncConcurrencyLimiter";

describe("createConcurrencyLimiter", () => {
  it("runs at most N tasks concurrently", async () => {
    const limit = createConcurrencyLimiter(2);
    let active = 0;
    let maxActive = 0;

    const task = () =>
      limit(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
      });

    await Promise.all([task(), task(), task(), task()]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
