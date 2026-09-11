import { describe, expect, it } from "vitest";
import { buildGraphFitTransform, computeGraphContentBounds } from "./graphFitView";

describe("graphFitView", () => {
  it("computes bounds including labels", () => {
    const bounds = computeGraphContentBounds(
      [
        { x: 10, y: 20 },
        { x: 200, y: 400 },
      ],
      true,
      12,
    );
    expect(bounds).toMatchObject({
      minX: expect.any(Number),
      minY: expect.any(Number),
      maxX: expect.any(Number),
      maxY: expect.any(Number),
    });
    expect(bounds!.maxY - bounds!.minY).toBeGreaterThan(380);
  });

  it("builds a scale-down transform for oversized content", () => {
    const transform = buildGraphFitTransform(
      { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      500,
      500,
    );
    expect(transform.k).toBeLessThan(1);
  });
});
