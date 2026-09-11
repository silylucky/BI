import { describe, expect, it } from "vitest";
import { collectDashboardImageUrls } from "./collectDashboardImageUrls";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { defaultMediaConfig } from "@/components/dashboard/layoutUtils";

describe("collectDashboardImageUrls", () => {
  it("does not throw for webpage media without widgetStyle", () => {
    const widgets: LayoutWidget[] = [
      {
        id: "w1",
        type: "media",
        title: "网页",
        colSpan: 8,
        rowSpan: 4,
        order: 0,
        mediaConfig: {
          ...defaultMediaConfig(),
          kind: "webpage",
          url: "https://example.com",
        },
      },
    ];
    expect(() => collectDashboardImageUrls(widgets, {})).not.toThrow();
    expect(collectDashboardImageUrls(widgets, {})).toEqual(["https://example.com"]);
  });

  it("does not throw for tabs without widgetStyle", () => {
    const widgets: LayoutWidget[] = [
      {
        id: "t1",
        type: "tabs",
        title: "页签",
        colSpan: 12,
        rowSpan: 4,
        order: 0,
        tabsConfig: {
          tabsId: "t1",
          panes: [{ id: "p1", title: "页签1", childWidgetIds: [] }],
          activePaneId: "p1",
        },
      },
    ];
    expect(() => collectDashboardImageUrls(widgets, {})).not.toThrow();
    expect(collectDashboardImageUrls(widgets, {})).toEqual([]);
  });

  it("collects media widgetStyle background when present", () => {
    const widgets: LayoutWidget[] = [
      {
        id: "w1",
        type: "media",
        title: "图片",
        colSpan: 6,
        rowSpan: 3,
        order: 0,
        mediaConfig: {
          ...defaultMediaConfig(),
          url: "/a.png",
          widgetStyle: {
            backgroundImage: "/template-assets/bg.png",
          },
        },
      },
    ];
    expect(collectDashboardImageUrls(widgets, {})).toEqual([
      "/a.png",
      "/template-assets/bg.png",
    ]);
  });
});
