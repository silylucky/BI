import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import {
  chartDataSlotBlueprint,
  chartRenderRequiredCounts,
} from "@/components/dashboard/chartFieldSlots";
import { sanitizeChartFieldsForValidate } from "@/lib/chartFieldRules";
import { buildChartRenderModel } from "@/lib/buildChartRenderModel";
import { BACKEND_CATALOG_FIELD_RULES } from "./chartCatalogBackendFieldRules";
import { deriveFieldRuleFromDeCatalog } from "@/lib/chartDeAxis";
import {
  assertCatalogSmokeCoverage,
  CHART_CATALOG_SMOKE_CASES,
  smokeCaseToConfig,
} from "./chartCatalogSmokeFixtures";
import { FIELD_RULE_MAX_WAIVERS } from "./chartCatalogFieldRuleWaivers";

const ACTIVE_TYPES = BUILTIN_PLUGIN_DEFS.filter((d) => !d.deprecated).map((d) => d.type);

function filledDims(count: number) {
  return Array.from({ length: count }, (_, i) => ({ field: `dim_${i}` }));
}

function filledMetrics(count: number) {
  return Array.from({ length: count }, (_, i) => ({ field: `met_${i}` }));
}

describe("chart catalog L3 FIELD", () => {
  assertCatalogSmokeCoverage();

  it("T-VIZ-R32-001: backend fieldRule snapshot covers all active types", () => {
    for (const type of ACTIVE_TYPES) {
      expect(BACKEND_CATALOG_FIELD_RULES[type], type).toBeDefined();
    }
  });

  it("T-VIZ-R32-002: smoke fixtures satisfy backend min/max field counts", () => {
    for (const item of CHART_CATALOG_SMOKE_CASES) {
      const rule = BACKEND_CATALOG_FIELD_RULES[item.type]!;
      const dimCount = item.dimensions.filter((d) => d.field?.trim()).length;
      const metCount = item.metrics.filter((m) => m.field?.trim()).length;
      expect(dimCount, `${item.type} dims`).toBeGreaterThanOrEqual(rule.minDimensions);
      expect(dimCount, `${item.type} dims`).toBeLessThanOrEqual(rule.maxDimensions);
      expect(metCount, `${item.type} metrics`).toBeGreaterThanOrEqual(rule.minMetrics);
      expect(metCount, `${item.type} metrics`).toBeLessThanOrEqual(rule.maxMetrics);
    }
  });

  it("T-VIZ-R32-003: chartRenderRequiredCounts respects backend minima", () => {
    for (const type of ACTIVE_TYPES) {
      const rule = BACKEND_CATALOG_FIELD_RULES[type]!;
      const counts = chartRenderRequiredCounts(type);
      expect(counts.minDimensions, type).toBeGreaterThanOrEqual(rule.minDimensions);
      expect(counts.minMetrics, type).toBeGreaterThanOrEqual(rule.minMetrics);
    }
  });

  it("T-VIZ-R32-004: each active type exposes DE slot blueprint", () => {
    for (const type of ACTIVE_TYPES) {
      const slots = chartDataSlotBlueprint(type);
      expect(slots.length, type).toBeGreaterThan(0);
      expect(slots.some((s) => s.label.length > 0), type).toBe(true);
    }
  });

  it.each(CHART_CATALOG_SMOKE_CASES.map((c) => [c.type, c] as const))(
    "T-VIZ-R32-005 %s: valid fixture passes buildChartRenderModel",
    (_type, item) => {
      const model = buildChartRenderModel(smokeCaseToConfig(item), item.columns, item.rows);
      expect(model.kind).toBe("ready");
    },
  );

  it("T-VIZ-R32-006: missing required dimension yields error", () => {
    const line = smokeCaseToConfig(CHART_CATALOG_SMOKE_CASES.find((c) => c.type === "line")!);
    const model = buildChartRenderModel(
      { ...line, dimensions: [{ field: "" }] },
      ["sale_date", "amount"],
      [["2025-07-01", 100]],
    );
    expect(model.kind).toBe("error");
  });

  it("T-VIZ-R32-007: sankey requires two dimensions", () => {
    const sankey = smokeCaseToConfig(CHART_CATALOG_SMOKE_CASES.find((c) => c.type === "sankey")!);
    const model = buildChartRenderModel(
      { ...sankey, dimensions: [{ field: "source" }] },
      ["source", "target", "weight"],
      [["A", "B", 1]],
    );
    expect(model.kind).toBe("error");
    if (model.kind === "error") {
      expect(model.message).toMatch(/起止|维度/);
    }
  });

  it("T-VIZ-R32-008: graph allows zero metrics", () => {
    const graph = smokeCaseToConfig(CHART_CATALOG_SMOKE_CASES.find((c) => c.type === "graph")!);
    const model = buildChartRenderModel(graph, ["source", "target"], [["A", "B"]]);
    expect(model.kind).toBe("ready");
  });

  it("T-VIZ-R32-009: dual-axis types allow single metric (bar-only or line-only)", () => {
    for (const type of ["chart-mix", "chart-mix-group", "chart-mix-stack", "chart-mix-dual-line"]) {
      const rule = BACKEND_CATALOG_FIELD_RULES[type]!;
      expect(rule.minMetrics).toBe(1);
    }
  });

  it("T-VIZ-R32-010: sanitize slot capacity respects backend max", () => {
    const rule = BACKEND_CATALOG_FIELD_RULES.line!;
    const cfg = smokeCaseToConfig(CHART_CATALOG_SMOKE_CASES.find((c) => c.type === "line")!);
    const over = {
      ...cfg,
      dimensions: filledDims(rule.maxDimensions + 2),
      metrics: filledMetrics(rule.maxMetrics + 2),
    };
    const trimmed = sanitizeChartFieldsForValidate(over);
    expect(trimmed.dimensions?.length).toBeLessThanOrEqual(rule.maxDimensions);
    expect(trimmed.metrics?.length).toBeLessThanOrEqual(rule.maxMetrics);
  });

  it("T-VIZ-R32-011: DE catalog min field rules align with backend snapshot", () => {
    for (const type of ACTIVE_TYPES) {
      const rule = BACKEND_CATALOG_FIELD_RULES[type]!;
      const deRule = deriveFieldRuleFromDeCatalog(type);
      expect(deRule.minDimensions, type).toBe(rule.minDimensions);
      expect(deRule.minMetrics, type).toBe(rule.minMetrics);
    }
  });

  it("T-VIZ-R32-014: DE catalog max field rules align with backend or signed waiver", () => {
    for (const type of ACTIVE_TYPES) {
      const rule = BACKEND_CATALOG_FIELD_RULES[type]!;
      const deRule = deriveFieldRuleFromDeCatalog(type);
      const waiver = FIELD_RULE_MAX_WAIVERS[type];
      if (waiver?.maxDimensions !== undefined) {
        expect(deRule.maxDimensions, `${type} maxD waiver`).toBe(waiver.maxDimensions);
      } else {
        expect(deRule.maxDimensions, type).toBe(rule.maxDimensions);
      }
      if (waiver?.maxMetrics !== undefined) {
        expect(deRule.maxMetrics, `${type} maxM waiver`).toBe(waiver.maxMetrics);
      } else {
        expect(deRule.maxMetrics, type).toBe(rule.maxMetrics);
      }
    }
  });

  it("T-VIZ-R32-012: gauge has no dimension slot and ignores stale dimensions in render model", () => {
    expect(chartDataSlotBlueprint("gauge").some((s) => s.kind === "dimension")).toBe(false);
    const gauge = smokeCaseToConfig(CHART_CATALOG_SMOKE_CASES.find((c) => c.type === "gauge")!);
    const withDim = { ...gauge, dimensions: [{ field: "sale_date" }] };
    const model = buildChartRenderModel(withDim, ["sale_date", "value"], [[100]]);
    expect(model.kind).toBe("ready");
  });

  it("T-VIZ-R32-013: table-pivot allows row-only pivot when column dimension omitted", () => {
    const pivot = smokeCaseToConfig(CHART_CATALOG_SMOKE_CASES.find((c) => c.type === "table-pivot")!);
    const model = buildChartRenderModel(
      { ...pivot, dimensions: [{ field: "row_dim" }] },
      ["row_dim", "col_dim", "amount"],
      [["A", "X", 10]],
    );
    expect(model.kind).toBe("ready");
  });
});
