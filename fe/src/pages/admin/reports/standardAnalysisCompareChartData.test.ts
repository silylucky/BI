import { describe, expect, it } from "vitest";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { buildComparePairChartConfig } from "./standardAnalysisComparePresentation";
import {
  comparePairPeriodLabels,
  deltasToComparePairRows,
  pickTopCompareDeltas,
} from "./standardAnalysisCompareChartData";
import { resolveFirstAvailableTheme, type CompareResult } from "./useStandardAnalysis";

function sampleDeltas(): CompareResult["deltas"] {
  return [
    { key: "上海市", currentValue: 34, previousValue: 30, delta: 4, deltaPct: 13.3 },
    { key: "北京市", currentValue: 35, previousValue: 33, delta: 2, deltaPct: 6.1 },
    { key: "南京市", currentValue: 29, previousValue: 40, delta: -11, deltaPct: -27.5 },
    { key: "其他", currentValue: 5, previousValue: 5, delta: 0, deltaPct: 0 },
  ];
}

describe("standardAnalysisCompareChartData", () => {
  it("picks top deltas by absolute change", () => {
    const top = pickTopCompareDeltas(sampleDeltas(), 2);
    expect(top.map((item) => item.key)).toEqual(["南京市", "上海市"]);
  });

  it("builds grouped bar rows for compare chart", () => {
    const { headers, rows } = deltasToComparePairRows(sampleDeltas(), "本期", "对比期");
    expect(headers).toEqual(["dim", "period", "cnt"]);
    expect(rows).toEqual(
      expect.arrayContaining([
        ["南京市", "本期", 29],
        ["南京市", "对比期", 40],
      ]),
    );
  });

  it("labels compare periods for chart legend", () => {
    expect(
      comparePairPeriodLabels({
        packKey: "s1",
        theme: "distribution",
        currentPeriodKey: "2026-08-25",
        previousPeriodKey: "2026-08-24",
        current: { columns: [], rows: [] },
        previous: { columns: [], rows: [] },
        deltas: [],
      }),
    ).toEqual({
      currentLabel: "本期（2026-08-25）",
      previousLabel: "对比期（2026-08-24）",
    });
  });

  it("encodes grouped compare chart points", () => {
    const { headers, rows } = deltasToComparePairRows(sampleDeltas(), "本期", "对比期");
    const config = buildComparePairChartConfig();
    const vm = buildChartViewModel(config, { columns: headers, rows });
    const plan = buildPlanForType("bar-group", vm);
    const data = plan.options.data as Array<Record<string, string | number>>;
    expect(plan.plotType).toBe("Column");
    expect(plan.options.isGroup).toBe(true);
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ __category__: "南京市", __series__: "本期", __value__: 29 }),
        expect.objectContaining({ __category__: "南京市", __series__: "对比期", __value__: 40 }),
      ]),
    );
  });

  it("prefers trend theme when pack enables multiple themes", () => {
    expect(
      resolveFirstAvailableTheme(
        {
          packKey: "s1",
          displayName: "demo",
          dataSourceId: "ds",
          fieldMapping: {},
          enabledThemes: ["distribution", "trend", "lifecycle"],
          allowedRoles: ["admin"],
          snapshotCronPreset: "daily",
        },
        [
          { theme: "distribution", available: true },
          { theme: "trend", available: true },
          { theme: "lifecycle", available: true },
        ],
      ),
    ).toBe("trend");
  });
});
