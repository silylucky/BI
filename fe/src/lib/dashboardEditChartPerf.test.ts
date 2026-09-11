import { describe, expect, it } from "vitest";
import {
  capChartPaintSize,
  resolveEditPaintMaxEdge,
  shouldDeferEditLivePaint,
  shouldShowEmbeddedMountGateSkeleton,
} from "@/lib/dashboardEditChartPerf";

describe("dashboardEditChartPerf", () => {
  it("caps paint size by max edge", () => {
    expect(capChartPaintSize({ width: 800, height: 600 }, 720)).toEqual({
      width: 720,
      height: 540,
    });
  });

  it("skips cap when selected in edit mode", () => {
    expect(resolveEditPaintMaxEdge(true, true)).toBeUndefined();
    expect(resolveEditPaintMaxEdge(true, false)).toBe(720);
    expect(resolveEditPaintMaxEdge(false, false)).toBeUndefined();
  });

  it("defers live paint for unselected edit widgets", () => {
    expect(shouldDeferEditLivePaint(true, false)).toBe(true);
    expect(shouldDeferEditLivePaint(true, true)).toBe(false);
  });

  it("keeps embedded chart visible when query paused but data exists", () => {
    const snapshot = {
      gisBasemapOnly: false,
      isGisMapChart: false,
      columnCount: 2,
      rowCount: 10,
    };
    expect(shouldShowEmbeddedMountGateSkeleton(true, false, snapshot)).toBe(false);
    expect(
      shouldShowEmbeddedMountGateSkeleton(true, false, {
        ...snapshot,
        columnCount: 0,
        rowCount: 0,
      }),
    ).toBe(true);
  });

  it("still allows gis basemap without query", () => {
    expect(
      shouldShowEmbeddedMountGateSkeleton(true, false, {
        gisBasemapOnly: true,
        isGisMapChart: true,
        columnCount: 0,
        rowCount: 0,
      }),
    ).toBe(false);
  });
});
