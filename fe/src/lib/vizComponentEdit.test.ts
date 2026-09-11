import { describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import {
  instantiateVizComponentWidget,
  prepareWidgetInlineSnapshot,
  relinkWidgetToComponent,
  isPublishableWidgetType,
  resolveWidgetForCrossDashboardCopy,
} from "./vizComponentEdit";
import { buildComponentMap, resolveLayoutWidget } from "./resolveVizComponent";
import type { VizComponentDetail } from "./vizComponents";
import { TEMPLATE_DEMO_DATASOURCE_REF } from "./templateDemoData";

vi.mock("@/lib/vizComponents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./vizComponents")>();
  return {
    ...actual,
    batchResolveVizComponents: vi.fn(async (ids: string[]) => ({
      items: ids.map(
        (id): VizComponentDetail => ({
          id,
          componentKey: id,
          name: "库内图表",
          description: null,
          categoryKey: "general",
          widgetType: "chart",
          surfaceKinds: ["dashboard"],
          status: "published",
          thumbnailRef: null,
          tags: [],
          visibility: "org",
          contentRevision: 1,
          updatedAt: "",
          publishedAt: null,
          ownerUserId: null,
          orgScope: null,
          createdAt: "",
          payloadJson: {
            chartConfig: {
              chartId: "placeholder",
              chartType: "bar",
              mode: "sql",
              sql: "SELECT revenue FROM sales",
              dataSourceId: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        }),
      ),
    })),
  };
});

describe("instantiateVizComponentWidget", () => {
  it("copies library payload onto the canvas without a live componentRef", () => {
    const detail: VizComponentDetail = {
      id: "c1",
      componentKey: "c1",
      name: "柱状图",
      description: null,
      categoryKey: "general",
      widgetType: "chart",
      surfaceKinds: ["dashboard"],
      status: "published",
      thumbnailRef: null,
      tags: [],
      visibility: "org",
      contentRevision: 1,
      updatedAt: "",
      publishedAt: null,
      ownerUserId: null,
      orgScope: null,
      createdAt: "",
      payloadJson: {
        chartConfig: {
          chartId: "placeholder",
          chartType: "bar",
          mode: "sql",
          sql: "SELECT 1",
          dataSourceId: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    };
    const instance = instantiateVizComponentWidget(detail, []);
    expect(instance.componentRef).toBeUndefined();
    expect(instance.chartConfig?.sql).toBe("SELECT 1");
    expect(instance.chartConfig?.chartId).toBe(instance.id);
    expect(instance.title).toBe("柱状图");
  });
});

describe("vizComponentEdit", () => {
  it("relinkWidgetToComponent strips inline payload and restores componentRef", () => {
    const widget = {
      id: "w1",
      type: "chart",
      title: "本地",
      colSpan: 6,
      rowSpan: 4,
      order: 0,
      chartConfig: { chartId: "w1", chartType: "bar" },
      componentRef: { componentId: "c1", detached: true },
    } as LayoutWidget;

    const relinked = relinkWidgetToComponent(widget, "c1");
    expect(relinked.componentRef).toEqual({ componentId: "c1" });
    expect(relinked.chartConfig).toBeUndefined();
  });

  it("isPublishableWidgetType covers chart/filter/text/media/customViz", () => {
    expect(isPublishableWidgetType("chart")).toBe(true);
    expect(isPublishableWidgetType("filter")).toBe(true);
    expect(isPublishableWidgetType("customViz")).toBe(true);
    expect(isPublishableWidgetType("tabs")).toBe(false);
  });
});

describe("cross-dashboard copy", () => {
  it("resolves linked chart to inline demo ref snapshot", async () => {
    const linked = {
      id: "w-chart",
      type: "chart",
      title: "引用图表",
      colSpan: 6,
      rowSpan: 4,
      order: 0,
      componentRef: { componentId: "550e8400-e29b-41d4-a716-446655440001" },
    } as LayoutWidget;

    const snapshot = await resolveWidgetForCrossDashboardCopy(linked);
    expect(snapshot.componentRef).toBeUndefined();
    expect(snapshot.chartConfig?.sql).toBe("SELECT revenue FROM sales");
    expect(snapshot.chartConfig?.dataSourceId).toBe(TEMPLATE_DEMO_DATASOURCE_REF);
  });

  it("prepareWidgetInlineSnapshot normalizes inline chart uuid", () => {
    const widget = {
      id: "w1",
      type: "chart",
      title: "内联",
      colSpan: 6,
      rowSpan: 4,
      order: 0,
      chartConfig: {
        chartId: "w1",
        chartType: "bar",
        mode: "sql",
        sql: "SELECT 1",
        dataSourceId: "550e8400-e29b-41d4-a716-446655440000",
      },
    } as LayoutWidget;
    const snapshot = prepareWidgetInlineSnapshot(widget);
    expect(snapshot.chartConfig?.dataSourceId).toBe(TEMPLATE_DEMO_DATASOURCE_REF);
  });
});

describe("resolveLayoutWidget linked filter", () => {
  it("resolves filterConfig from component map for linkage", () => {
    const component: VizComponentDetail = {
      id: "fc1",
      name: "区域筛选",
      widgetType: "filter",
      surfaceKind: "dashboard",
      categoryKey: "filter",
      status: "published",
      contentRevision: 2,
      payloadJson: {
        filterConfig: {
          filterId: "placeholder",
          controlType: "select",
          label: "区域",
          fieldKey: "region",
        },
      },
      createdAt: "",
      updatedAt: "",
    };
    const map = buildComponentMap([component]);
    const widget = {
      id: "w-filter",
      type: "filter",
      title: "筛选",
      colSpan: 4,
      rowSpan: 1,
      order: 0,
      componentRef: { componentId: "fc1" },
    } as LayoutWidget;

    const resolved = resolveLayoutWidget(widget, map);
    expect(resolved.filterConfig?.filterId).toBe("w-filter");
    expect(resolved.filterConfig?.fieldKey).toBe("region");
  });
});
