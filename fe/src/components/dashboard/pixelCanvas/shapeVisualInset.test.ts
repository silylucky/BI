import { describe, expect, it } from "vitest";
import { resolveWidgetChromeInset } from "./shapeVisualInset";

describe("shapeVisualInset", () => {
  it("sums border and padding per edge", () => {
    expect(
      resolveWidgetChromeInset({
        borderWidth: 1,
        paddingLeft: 8,
        paddingMode: "individual",
      }),
    ).toEqual({ top: 1, right: 1, bottom: 1, left: 9 });
  });
});
