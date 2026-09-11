import { describe, expect, it } from "vitest";
import {
  humanizeColumnName,
  humanizeMappedField,
  themeAggregationHintText,
} from "./standardAnalysisFieldLabels";

describe("standardAnalysisFieldLabels", () => {
  it("maps common column names to Chinese labels", () => {
    expect(humanizeColumnName("province")).toBe("省份");
    expect(humanizeColumnName("cnt")).toBe("数量");
    expect(humanizeColumnName("value")).toBe("数量");
    expect(humanizeColumnName("dim")).toBe("维度");
  });

  it("humanizes mapped fields for aggregation hints", () => {
    expect(humanizeMappedField("province", "distribution")).toBe("省份");
    expect(themeAggregationHintText("distribution", { region: "province" })).toBe("按省份计数");
  });

  it("falls back to raw column when unknown", () => {
    expect(humanizeColumnName("custom_col")).toBe("custom_col");
  });
});
