import { describe, expect, it } from "vitest";
import type { AnalysisPack, CompareResult } from "../useStandardAnalysis";
import {
  formatCompareDeltaPct,
  hasPreviousSnapshot,
  themeAggregationHint,
} from "./standardAnalysisCompareUi";

const pack: AnalysisPack = {
  packKey: "s1",
  displayName: "sss1",
  datasetId: "demo-v-sales-geo",
  dataSourceId: "00000000-0000-4000-8000-000000000001",
  fieldMapping: { status: "status", region: "city", createdAt: "sale_date" },
  enabledThemes: ["distribution"],
  allowedRoles: ["admin"],
  snapshotCronPreset: "daily",
};

describe("standardAnalysisCompareUi", () => {
  it("describes theme aggregation from field mapping", () => {
    expect(themeAggregationHint(pack, "distribution")).toBe("按城市计数");
    expect(themeAggregationHint(pack, "lifecycle")).toBe("按状态计数");
  });

  it("detects missing previous snapshot", () => {
    const withoutPrevious: CompareResult = {
      packKey: "s1",
      theme: "distribution",
      currentPeriodKey: "2026-08-18",
      previousPeriodKey: "2026-08-17",
      current: { columns: [], rows: [] },
      previous: null,
      deltas: [{ key: "南京市", currentValue: 29, previousValue: null, delta: null, deltaPct: null }],
    };
    expect(hasPreviousSnapshot(withoutPrevious)).toBe(false);
    expect(hasPreviousSnapshot({ ...withoutPrevious, previous: { columns: [], rows: [] } })).toBe(true);
  });

  it("formats delta percent", () => {
    expect(formatCompareDeltaPct(12.34)).toBe("+12.3%");
    expect(formatCompareDeltaPct(-4.5)).toBe("-4.5%");
    expect(formatCompareDeltaPct(null)).toBeNull();
  });
});
