import { describe, expect, it } from "vitest";
import { formatDataLabelText, formatDataLabelLines, resolveDataLabelContentFromDeStyle } from "@/lib/chartDataLabelFormat";

describe("chartDataLabelFormat", () => {
  it("combines dimension indicator and percent like DataEase", () => {
    const text = formatDataLabelText(
      "吉林省",
      14998,
      238000,
      { showDimension: true, showIndicator: true, showPercent: true, percentDecimals: 2 },
      { type: "auto", thousandSeparator: true },
    );
    expect(text).toContain("吉林省");
    expect(text).toContain("14,998");
    expect(text).toMatch(/\(6\.30%\)/);
  });

  it("splits dimension indicator and percent into separate lines", () => {
    const lines = formatDataLabelLines(
      "吉林省",
      14998,
      238000,
      { showDimension: true, showIndicator: true, showPercent: true, percentDecimals: 2 },
      { type: "auto", thousandSeparator: true },
    );
    expect(lines).toEqual(["吉林省", "14,998", "6.30%"]);
  });

  it("resolves label content from deStyle", () => {
    expect(
      resolveDataLabelContentFromDeStyle({
        showDimension: true,
        showPercent: true,
        showIndicator: false,
      }),
    ).toEqual({
      showDimension: true,
      showIndicator: false,
      showPercent: true,
      percentDecimals: 2,
    });
  });
});
