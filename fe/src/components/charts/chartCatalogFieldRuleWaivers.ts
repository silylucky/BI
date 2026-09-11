/**
 * Signed waivers for deriveFieldRuleFromDeCatalog max vs backend fieldRule (T-VIZ-R32-014).
 * GAP-MAX-DIM cartesian waivers removed after MULTI_DIM (Wave 0.1).
 */
export type FieldRuleMaxWaiver = {
  maxDimensions?: number;
  maxMetrics?: number;
  gapId: "GAP-MAX-DIM" | "GAP-TABLE-DRILL-COUNT" | "GAP-MAP-DRILL";
  reason: string;
};

/** chartType → signed max waiver（min 须严格相等，见 T-VIZ-R32-011） */
export const FIELD_RULE_MAX_WAIVERS: Record<string, FieldRuleMaxWaiver> = {
  "table-info": {
    maxDimensions: 9,
    gapId: "GAP-TABLE-DRILL-COUNT",
    reason: "both multi maxD8 + drill1 in deriveFieldRule; backend maxD=8",
  },
  "table-normal": {
    maxDimensions: 9,
    gapId: "GAP-TABLE-DRILL-COUNT",
    reason: "multi dim8 + drill1; backend maxD=8",
  },
  "table-pivot": {
    maxDimensions: 2,
    maxMetrics: 1,
    gapId: "GAP-MAX-DIM",
    reason: "row+col pivot slots max 2; single metric slot; backend max 8/8",
  },
  map: {
    maxDimensions: 3,
    gapId: "GAP-MAP-DRILL",
    reason: "region + drill×2 in derive; backend maxD=3",
  },
  "map-3d": {
    maxDimensions: 3,
    gapId: "GAP-MAP-DRILL",
    reason: "region + drill×2 in derive; backend maxD=3",
  },
  "gis-map": {
    maxDimensions: 3,
    gapId: "GAP-MAP-DRILL",
    reason: "lng+lat+label drill; backend GIS_MAP_RULE maxD=3",
  },
  kpi: {
    maxDimensions: 0,
    gapId: "GAP-MAX-DIM",
    reason: "metric-only slot; backend registry maxD=1 drift",
  },
  scatter: {
    maxDimensions: 1,
    gapId: "GAP-MAX-DIM",
    reason: "single category dim slot; backend maxD=2 includes bubble miscount",
  },
  quadrant: {
    maxDimensions: 1,
    maxMetrics: 3,
    gapId: "GAP-MAX-DIM",
    reason: "1 dim + X/Y/bubble metrics; backend maxD=2 maxM=2",
  },
  "multi-scatter": {
    maxDimensions: 1,
    gapId: "GAP-MAX-DIM",
    reason: "color dim slot only; backend maxD=2",
  },
  combo: {
    maxMetrics: 2,
    gapId: "GAP-MAX-DIM",
    reason: "左柱+右线各 1 槽；backend metrics 数组 max=8",
  },
  "chart-mix": {
    maxMetrics: 2,
    gapId: "GAP-MAX-DIM",
    reason: "左柱+右线各 1 槽；backend metrics 数组 max=8",
  },
  "chart-mix-group": {
    maxMetrics: 2,
    gapId: "GAP-MAX-DIM",
    reason: "左柱+右线各 1 槽；backend metrics 数组 max=8",
  },
  "chart-mix-stack": {
    maxMetrics: 2,
    gapId: "GAP-MAX-DIM",
    reason: "左柱+右线各 1 槽；backend metrics 数组 max=8",
  },
  "chart-mix-dual-line": {
    maxMetrics: 2,
    gapId: "GAP-MAX-DIM",
    reason: "左线+右线各 1 槽；backend metrics 数组 max=8",
  },
};
