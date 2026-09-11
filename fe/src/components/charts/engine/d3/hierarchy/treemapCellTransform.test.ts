import { describe, expect, it } from "vitest";
import {
  treemapCellBaseTransform,
  treemapCellHoverTransform,
  TREEMAP_HOVER_SCALE,
} from "./treemapCellTransform";

describe("treemapCellTransform", () => {
  it("builds base translate", () => {
    expect(treemapCellBaseTransform(12, 8)).toBe("translate(12,8)");
  });

  it("scales from cell center on hover", () => {
    const transform = treemapCellHoverTransform(10, 20, 100, 40);
    expect(transform).toContain("translate(10,20)");
    expect(transform).toContain(`scale(${TREEMAP_HOVER_SCALE})`);
    expect(transform).toContain("translate(50,20)");
    expect(transform).toContain("translate(-50,-20)");
  });
});
