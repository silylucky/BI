import { describe, expect, it } from "vitest";
import {
  STANDARD_COMPARE_TABLE_MAX_HEIGHT,
  standardCompareTableScrollHint,
} from "./standardAnalysisTableUi";

describe("standardAnalysisTableUi", () => {
  it("shows scroll hint when many rows", () => {
    expect(standardCompareTableScrollHint(91)).toContain("滚动");
    expect(standardCompareTableScrollHint(5)).toBeNull();
  });

  it("defines bounded table height", () => {
    expect(STANDARD_COMPARE_TABLE_MAX_HEIGHT).toContain("60vh");
  });
});
