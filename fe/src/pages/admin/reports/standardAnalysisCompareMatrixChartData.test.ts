import { describe, expect, it } from "vitest";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { buildCompareMatrixChartConfig } from "./standardAnalysisComparePresentation";
import {
  matrixPeriodTotals,
  matrixToLineRows,
  pickTopMatrixDimensions,
} from "./standardAnalysisCompareMatrixChartData";
import type { CompareMatrixResult } from "./useStandardAnalysis";

function sampleMatrix(): CompareMatrixResult {
  return {
    packKey: "s1",
    theme: "distribution",
    periodKind: "daily",
    periodKeys: ["2026-08-25", "2026-08-24", "2026-08-23"],
    rows: [
      { key: "上海市", values: { "2026-08-25": 34, "2026-08-24": 34, "2026-08-23": 30 } },
      { key: "北京市", values: { "2026-08-25": 35, "2026-08-24": 33, "2026-08-23": 33 } },
      { key: "南京市", values: { "2026-08-25": 29, "2026-08-24": 40, "2026-08-23": 25 } },
    ],
  };
}

describe("standardAnalysisCompareMatrixChartData", () => {
  it("picks top dimensions by period range", () => {
    const matrix = sampleMatrix();
    expect(pickTopMatrixDimensions(matrix.rows, matrix.periodKeys, 2)).toEqual(["南京市", "上海市"]);
  });

  it("builds long rows for multi-series line chart", () => {
    const { headers, rows, selectedDimensions } = matrixToLineRows(sampleMatrix(), 2);
    expect(headers).toEqual(["period", "dim", "cnt"]);
    expect(selectedDimensions).toEqual(["南京市", "上海市"]);
    expect(rows).toEqual(
      expect.arrayContaining([
        ["2026-08-23", "南京市", 25],
        ["2026-08-25", "南京市", 29],
      ]),
    );
  });

  it("summarizes totals per period", () => {
    expect(matrixPeriodTotals(sampleMatrix())).toEqual([
      { periodKey: "2026-08-23", total: 88 },
      { periodKey: "2026-08-24", total: 107 },
      { periodKey: "2026-08-25", total: 98 },
    ]);
  });

  it("encodes matrix compare line chart points", () => {
    const { headers, rows } = matrixToLineRows(sampleMatrix(), 2);
    const config = buildCompareMatrixChartConfig();
    const vm = buildChartViewModel(config, { columns: headers, rows });
    const plan = buildPlanForType("line", vm);
    const data = plan.options.data as Array<Record<string, string | number>>;
    expect(plan.plotType).toBe("Line");
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ __category__: "2026-08-23", __series__: "南京市", __value__: 25 }),
        expect.objectContaining({ __category__: "2026-08-25", __series__: "上海市", __value__: 34 }),
      ]),
    );
  });
});
