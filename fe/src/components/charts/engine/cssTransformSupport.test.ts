import { describe, expect, it } from "vitest";
import { withCanvasCssTransformSupport } from "./cssTransformSupport";

describe("cssTransformSupport", () => {
  it("merges supportCSSTransform into chart options", () => {
    expect(withCanvasCssTransformSupport({ data: [] })).toEqual({
      data: [],
      supportCSSTransform: true,
    });
  });
});
