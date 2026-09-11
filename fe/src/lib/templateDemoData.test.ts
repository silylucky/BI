import { describe, expect, it } from "vitest";
import type { DashboardLayoutV1 } from "@/components/dashboard/layoutUtils";
import {
  normalizeChartConfigForPortableDemo,
  normalizeLayoutForTemplateExport,
  TEMPLATE_DEMO_DATASOURCE_REF,
} from "./templateDemoData";

const envUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("templateDemoData", () => {
  it("normalizes empty or env UUID dataSourceId to demo ref", () => {
    expect(
      normalizeChartConfigForPortableDemo({
        chartId: "c1",
        chartType: "bar",
        mode: "sql",
        sql: "SELECT 1",
        dataSourceId: envUuid,
      }).dataSourceId,
    ).toBe(TEMPLATE_DEMO_DATASOURCE_REF);

    expect(
      normalizeChartConfigForPortableDemo({
        chartId: "c1",
        chartType: "bar",
        mode: "sql",
        sql: "SELECT 1",
      }).dataSourceId,
    ).toBe(TEMPLATE_DEMO_DATASOURCE_REF);
  });

  it("preserves bindingId charts without forcing demo ref", () => {
    expect(
      normalizeChartConfigForPortableDemo({
        chartId: "c1",
        chartType: "bar",
        bindingId: "b1",
        dataSourceId: envUuid,
      }).dataSourceId,
    ).toBe(envUuid);
  });

  it("normalizes layout widgets on export", () => {
    const layout: DashboardLayoutV1 = {
      version: 1,
      widgets: [
        {
          id: "w1",
          type: "chart",
          title: "销售",
          order: 0,
          colSpan: 6,
          rowSpan: 4,
          chartConfig: {
            chartId: "w1",
            chartType: "bar",
            mode: "sql",
            sql: "SELECT 1",
            dataSourceId: envUuid,
          },
        },
      ],
      globalFilters: [],
    };
    const exported = normalizeLayoutForTemplateExport(layout);
    expect(exported.widgets[0].chartConfig?.dataSourceId).toBe(TEMPLATE_DEMO_DATASOURCE_REF);
    expect(exported.widgets[0].chartConfig?.sql).toBe("SELECT 1");
  });
});
