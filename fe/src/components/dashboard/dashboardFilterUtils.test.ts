import { describe, expect, it } from "vitest";
import {
  buildWidgetFilterParams,
  injectSqlParameters,
  mergeLayoutFilterLinkage,
  resolveFilterControlType,
  sanitizeLinkageForSave,
} from "./dashboardFilterUtils";
import { defaultChartConfig, defaultFilterConfig, type LayoutWidget } from "./layoutUtils";

describe("dashboardFilterUtils", () => {
  it("injectSqlParameters replaces placeholders", () => {
    const sql = injectSqlParameters("SELECT * FROM t WHERE region = '{{region}}'", { region: "east" });
    expect(sql).toContain("east");
  });

  it("rejects unsafe parameter values", () => {
    expect(() => injectSqlParameters("{{x}}", { x: "a;drop" })).toThrow();
  });

  it("buildWidgetFilterParams only includes linked widget", () => {
    const params = buildWidgetFilterParams(
      "w1",
      {
        filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "all" }],
        linkageRules: [{ sourceFilterId: "f1", targetWidgetIds: ["w1"], parameterKey: "region" }],
        refreshMode: "eager",
      },
      { f1: "east" },
    );
    expect(params).toEqual({ region: "east" });
  });

  it("resolveFilterControlType falls back to select when options exist", () => {
    expect(resolveFilterControlType({ filterId: "f", dimensionRef: "d", options: [{ label: "A", value: "a" }] })).toBe(
      "select",
    );
    expect(resolveFilterControlType({ filterId: "f", dimensionRef: "d" })).toBe("text");
  });

  it("mergeLayoutFilterLinkage auto-links filter widgets to charts", () => {
    const chart: LayoutWidget = {
      id: "c1",
      type: "chart",
      title: "图",
      colSpan: 6,
      rowSpan: 3,
      order: 0,
      chartConfig: { ...defaultChartConfig("bar"), chartId: "c1", dataSourceId: "ds", mode: "sql", sql: "select '{{region}}'" },
    };
    const filter: LayoutWidget = {
      id: "fw1",
      type: "filter",
      title: "筛选",
      colSpan: 4,
      rowSpan: 2,
      order: 1,
      filterConfig: { ...defaultFilterConfig("fw1"), parameterKey: "region", controlType: "select" },
    };
    const merged = mergeLayoutFilterLinkage([chart, filter], null);
    expect(merged.filters.some((f) => f.filterId === "fw1")).toBe(true);
    const params = buildWidgetFilterParams("c1", merged, { fw1: "east" });
    expect(params).toEqual({ region: "east" });
  });

  it("sanitizeLinkageForSave drops stale widget targets", () => {
    const chart: LayoutWidget = {
      id: "c1",
      type: "chart",
      title: "图",
      colSpan: 6,
      rowSpan: 3,
      order: 0,
      chartConfig: { ...defaultChartConfig("bar"), chartId: "c1", dataSourceId: "ds", mode: "sql", sql: "select 1" },
    };
    const sanitized = sanitizeLinkageForSave([chart], {
      filters: [{ filterId: "f1", dimensionRef: "区域" }],
      linkageRules: [
        { sourceFilterId: "f1", targetWidgetIds: ["c1", "deleted"], parameterKey: "region" },
        { sourceFilterId: "missing", targetWidgetIds: ["c1"], parameterKey: "x" },
      ],
      refreshMode: "eager",
    });
    expect(sanitized.linkageRules).toEqual([
      { sourceFilterId: "f1", targetWidgetIds: ["c1"], parameterKey: "region" },
    ]);
  });

  it("buildWidgetFilterParams merges chart linkage params for target widgets", () => {
    const params = buildWidgetFilterParams(
      "w2",
      { filters: [], linkageRules: [] },
      {},
      {
        params: { region: "广东省" },
        rules: [{ sourceWidgetId: "w1", targetWidgetIds: ["w2"], parameterKey: "region" }],
      },
    );
    expect(params).toEqual({ region: "广东省" });
  });
});
