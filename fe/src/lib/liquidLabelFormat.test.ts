import { describe, expect, it } from "vitest";
import { resolveLiquidMetricFormat, resolveLiquidRatioFormat } from "@/lib/liquidLabelFormat";

describe("liquidLabelFormat", () => {
  it("coerces legacy percent on metric to auto", () => {
    const fmt = resolveLiquidMetricFormat({ formatType: "percent", thousandSeparator: true });
    expect(fmt.type).toBe("auto");
  });

  it("prefers metric* fields over legacy label fields", () => {
    const fmt = resolveLiquidMetricFormat({
      formatType: "percent",
      metricFormatType: "currency",
      metricDecimals: 2,
      metricUnit: "万",
      metricThousandSeparator: false,
    });
    expect(fmt).toEqual({
      type: "currency",
      decimals: 2,
      unit: "万",
      thousandSeparator: false,
    });
  });

  it("builds ratio format from ratioDecimals", () => {
    const ratio = resolveLiquidRatioFormat({ ratioDecimals: 1 }, { thousandSeparator: false });
    expect(ratio).toEqual({ type: "percent", decimals: 1, thousandSeparator: false });
  });
});
