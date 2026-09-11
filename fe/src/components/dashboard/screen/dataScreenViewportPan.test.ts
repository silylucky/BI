import { describe, expect, it } from "vitest";
import { applyViewportPanScroll, applyViewportPanTranslate } from "./dataScreenViewportPan";

describe("dataScreenViewportPan", () => {
  it("translates viewport regardless of scroll overflow", () => {
    const session = {
      pointerId: 1,
      startX: 100,
      startY: 80,
      panX: 0,
      panY: 0,
    };
    expect(applyViewportPanTranslate(session, 130, 110)).toEqual({
      panX: 30,
      panY: 30,
    });
  });

  it("scroll pan moves opposite to pointer (legacy)", () => {
    expect(
      applyViewportPanScroll(
        {
          pointerId: 1,
          startX: 100,
          startY: 80,
          scrollLeft: 40,
          scrollTop: 20,
        },
        130,
        110,
      ),
    ).toEqual({
      scrollLeft: 10,
      scrollTop: -10,
    });
  });
});
