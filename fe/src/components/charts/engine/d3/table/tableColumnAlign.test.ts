import { describe, expect, it } from "vitest";
import { resolveEffectiveColumnWidthMode } from "./resolveTableLayoutMode";
import { columnAlignClass, resolveColumnAlign } from "./tableColumnAlign";

describe("resolveTableLayoutMode", () => {
  it("keeps auto equal split for few columns", () => {
    expect(resolveEffectiveColumnWidthMode("auto", 3)).toBe("auto");
  });

  it("defaults to auto when mode unset regardless of column count", () => {
    expect(resolveEffectiveColumnWidthMode(undefined, 9)).toBe("auto");
  });
});

describe("tableColumnAlign", () => {
  it("right-aligns numeric metrics", () => {
    expect(resolveColumnAlign("amount", [[100], [200]], 0)).toBe("right");
    expect(columnAlignClass("right")).toContain("text-right");
  });

  it("centers id columns", () => {
    expect(resolveColumnAlign("id", [[1], [2]], 0)).toBe("center");
  });

  it("left-aligns text dimensions", () => {
    expect(resolveColumnAlign("channel", [["线下门店"]], 0)).toBe("left");
  });
});
