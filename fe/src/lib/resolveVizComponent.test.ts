import { describe, expect, it } from "vitest";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import {
  buildComponentMap,
  detachLinkedWidget,
  linkedComponentContentRevisionSuffix,
  resolveLayoutWidget,
} from "@/lib/resolveVizComponent";
import type { VizComponentDetail } from "@/lib/vizComponents";

function chartWidget(id: string, overrides: Partial<LayoutWidget> = {}): LayoutWidget {
  return {
    id,
    type: "chart",
    title: "销售 KPI",
    colSpan: 6,
    rowSpan: 4,
    order: 0,
    chartConfig: {
      chartId: id,
      chartType: "bar",
      mode: "sql",
      dataSourceId: "ds-1",
      sql: "select 1",
      dimensions: [],
      metrics: [],
      filters: [],
    },
    ...overrides,
  };
}

function componentDetail(
  id: string,
  payload: VizComponentDetail["payloadJson"],
  revision = 1,
): VizComponentDetail {
  return {
    id,
    componentKey: `vc-${id}`,
    name: "库内 KPI",
    description: null,
    categoryKey: "general",
    widgetType: "chart",
    surfaceKinds: ["dashboard"],
    status: "published",
    thumbnailRef: null,
    tags: [],
    visibility: "org",
    contentRevision: revision,
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    payloadJson: payload,
    ownerUserId: null,
    orgScope: null,
    createdAt: new Date().toISOString(),
  };
}

describe("resolveVizComponent", () => {
  it("merges library payload and rewrites chartId", () => {
    const widget = chartWidget("w1", {
      componentRef: { componentId: "c1" },
      chartConfig: undefined,
    });
    const map = buildComponentMap([
      componentDetail("c1", {
        chartConfig: {
          chartId: "stale",
          chartType: "line",
          mode: "sql",
          dataSourceId: "ds-2",
          sql: "select 2",
          dimensions: [{ field: "region" }],
          metrics: [{ field: "amount" }],
          filters: [],
        },
      }),
    ]);
    const resolved = resolveLayoutWidget(widget, map);
    expect(resolved.chartConfig?.chartType).toBe("line");
    expect(resolved.chartConfig?.chartId).toBe("w1");
    expect(resolved.chartConfig?.dataSourceId).toBe("ds-2");
  });

  it("merges instance manualDrillStack over library payload", () => {
    const widget = chartWidget("w1", {
      componentRef: { componentId: "c1" },
      chartConfig: {
        chartId: "w1",
        chartType: "map-3d",
        mode: "sql",
        dataSourceId: "ds-1",
        sql: "select 1",
        dimensions: [{ field: "province" }],
        metrics: [{ field: "total" }],
        filters: [],
        nativeBody: {
          deStyle: {
            geo: {
              manualDrillStack: [{ field: "province", value: "福建省", label: "福建省" }],
            },
          },
        },
      },
    });
    const map = buildComponentMap([
      componentDetail("c1", {
        chartConfig: {
          chartId: "stale",
          chartType: "map-3d",
          mode: "sql",
          dataSourceId: "ds-2",
          sql: "select 2",
          dimensions: [{ field: "province" }],
          metrics: [{ field: "total" }],
          filters: [],
        },
      }),
    ]);
    const resolved = resolveLayoutWidget(widget, map);
    expect(resolved.chartConfig?.nativeBody?.deStyle?.geo?.manualDrillStack).toEqual([
      { field: "province", value: "福建省", label: "福建省" },
    ]);
    expect(resolved.chartConfig?.dataSourceId).toBe("ds-1");
  });

  it("detaches linked widget to inline config", () => {
    const widget = chartWidget("w1", { componentRef: { componentId: "c1" }, chartConfig: undefined });
    const map = buildComponentMap([
      componentDetail("c1", {
        chartConfig: {
          chartId: "stale",
          chartType: "pie",
          mode: "sql",
          dataSourceId: "ds-1",
          sql: "select 1",
          dimensions: [],
          metrics: [],
          filters: [],
        },
      }),
    ]);
    const detached = detachLinkedWidget(widget, map);
    expect(detached.componentRef?.detached).toBe(true);
    expect(detached.chartConfig?.chartType).toBe("pie");
  });

  it("merges instance customVizConfig dataBinding over library payload", () => {
    const widget: LayoutWidget = {
      id: "w-cv-1",
      type: "customViz",
      title: "告警滚动",
      colSpan: 6,
      rowSpan: 4,
      order: 0,
      componentRef: { componentId: "c-cv-1" },
      customVizConfig: {
        artifactId: "art-1",
        dataBinding: {
          status: "connected",
          datasetId: "ds-alerts",
          configId: "cfg-alerts",
          dimensions: [{ field: "message" }],
          metrics: [{ field: "severity", agg: "sum" }],
        },
      },
    };
    const map = buildComponentMap([
      {
        ...componentDetail("c-cv-1", {
          customVizConfig: {
            artifactId: "art-1",
            dataBinding: { status: "manual" },
          },
        }),
        widgetType: "customViz",
      },
    ]);
    const resolved = resolveLayoutWidget(widget, map);
    expect(resolved.customVizConfig?.dataBinding?.datasetId).toBe("ds-alerts");
    expect(resolved.customVizConfig?.dataBinding?.dimensions?.[0]?.field).toBe("message");
  });

  it("linked gis-map instance keeps local gisProject over library payload", () => {
    const widget = chartWidget("w1", {
      componentRef: { componentId: "c-gis" },
      chartConfig: {
        chartId: "w1",
        chartType: "gis-map",
        mode: "dataset",
        dimensions: [],
        metrics: [],
        filters: [],
        nativeBody: {
          gisProject: {
            basemap: "pmtiles",
            view: { center: [20, 10], zoom: 3, bearing: 0, pitch: 45 },
          },
        },
      },
    });
    const map = buildComponentMap([
      componentDetail("c-gis", {
        chartConfig: {
          chartId: "stale",
          chartType: "gis-map",
          mode: "dataset",
          dimensions: [],
          metrics: [],
          filters: [],
          nativeBody: {
            gisProject: {
              basemap: "pmtiles",
              view: { center: [100, 28], zoom: 1.5, bearing: 0, pitch: 0 },
            },
          },
        },
      }),
    ]);
    const resolved = resolveLayoutWidget(widget, map);
    expect(resolved.chartConfig?.nativeBody?.gisProject).toMatchObject({
      view: { center: [20, 10], zoom: 3, pitch: 45 },
    });
  });

  it("linkedComponentContentRevisionSuffix reflects loading and resolved revision", () => {
    const widget = chartWidget("w1", { componentRef: { componentId: "c1" } });
    const map = buildComponentMap([
      componentDetail("c1", {
        chartConfig: {
          chartId: "c1",
          chartType: "area",
          mode: "sql",
          dataSourceId: "ds-1",
          sql: "select 1",
          dimensions: [],
          metrics: [],
          filters: [],
        },
      }, 3),
    ]);
    expect(
      linkedComponentContentRevisionSuffix(widget, new Map(), true),
    ).toBe(":linked:loading");
    expect(linkedComponentContentRevisionSuffix(widget, map, false)).toBe(":linked:c1:3");
    expect(linkedComponentContentRevisionSuffix(widget, new Map(), false)).toBe(":linked:missing");
  });
});
