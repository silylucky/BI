import { describe, expect, it } from "vitest";
import { formatChartFieldErrors, mapChartConfigError } from "./chartErrors";

describe("mapChartConfigError", () => {
  it("maps timeline dimension overflow to Chinese with action hint", () => {
    expect(
      mapChartConfigError(
        "CHART_FIELD_REQUIREMENT",
        "timeline requires 1-1 dimensions, got 2.",
      ),
    ).toContain("时间轴");
    expect(
      mapChartConfigError(
        "CHART_FIELD_REQUIREMENT",
        "timeline requires 1-1 dimensions, got 2.",
      ),
    ).toContain("最多允许 1 个");
  });

  it("passes through Chinese backend messages", () => {
    const msg =
      "时间轴：当前配置了 2 个维度，最多允许 1 个。请移除多余的维度槽位中的字段。时间轴需 1 个时间维度，可选 0–4 个指标";
    expect(mapChartConfigError("CHART_FIELD_REQUIREMENT", msg)).toBe(msg);
  });

  it("dedupes identical field errors", () => {
    const msg =
      "时间轴：当前配置了 2 个维度，最多允许 1 个。请移除多余的维度槽位中的字段";
    expect(
      formatChartFieldErrors("CHART_FIELD_REQUIREMENT", [
        { message: msg },
        { message: msg },
      ]),
    ).toBe(msg);
  });
});
