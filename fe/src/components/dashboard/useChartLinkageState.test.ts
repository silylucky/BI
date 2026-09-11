import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { buildWidgetFilterParams } from "./dashboardFilterUtils";
import { useChartLinkageState } from "./useChartLinkageState";
import type { LayoutWidget } from "./layoutUtils";
import { patchChartDeFeatures } from "@/lib/chartDeFeatures";
import { defaultChartConfig } from "./layoutUtils";

function mapWidget(id: string, linkageEnabled = true): LayoutWidget {
  const chartConfig = patchChartDeFeatures(defaultChartConfig("map"), {
    linkage: { enabled: linkageEnabled, parameterKey: "region", targetWidgetIds: ["bar-1"] },
  });
  return {
    id,
    type: "chart",
    title: "地图",
    colSpan: 6,
    rowSpan: 4,
    x: 0,
    y: 0,
    chartConfig,
  };
}

function barWidget(id: string): LayoutWidget {
  return {
    id,
    type: "chart",
    title: "柱图",
    colSpan: 6,
    rowSpan: 4,
    x: 6,
    y: 0,
    chartConfig: defaultChartConfig("bar"),
  };
}

describe("useChartLinkageState", () => {
  it("updates runtime params and injects into target widget filter params", () => {
    const widgets = [mapWidget("map-1"), barWidget("bar-1")];
    const { result } = renderHook(() => useChartLinkageState(widgets));

    expect(result.current.chartLinkageRuntime.rules).toHaveLength(1);
    expect(
      buildWidgetFilterParams("bar-1", { filters: [], linkageRules: [] }, {}, result.current.chartLinkageRuntime),
    ).toEqual({});

    act(() => {
      result.current.handleChartLinkageClick("map-1", {
        parameterKey: "region",
        value: "广东省",
      });
    });

    const injected = buildWidgetFilterParams(
      "bar-1",
      { filters: [], linkageRules: [] },
      {},
      result.current.chartLinkageRuntime,
    );
    expect(injected).toEqual({ region: "广东省" });
  });

  it("initialParams seed linkage runtime", () => {
    const widgets = [mapWidget("map-1"), barWidget("bar-1")];
    const { result } = renderHook(() =>
      useChartLinkageState(widgets, { region: "北京市" }),
    );

    const injected = buildWidgetFilterParams(
      "bar-1",
      { filters: [], linkageRules: [] },
      {},
      result.current.chartLinkageRuntime,
    );
    expect(injected).toEqual({ region: "北京市" });
  });

  it("resetChartLinkageParams clears injected filters", () => {
    const widgets = [mapWidget("map-1"), barWidget("bar-1")];
    const { result } = renderHook(() => useChartLinkageState(widgets));

    act(() => {
      result.current.handleChartLinkageClick("map-1", {
        parameterKey: "region",
        value: "浙江省",
      });
    });

    act(() => {
      result.current.resetChartLinkageParams();
    });

    expect(
      buildWidgetFilterParams("bar-1", { filters: [], linkageRules: [] }, {}, result.current.chartLinkageRuntime),
    ).toEqual({});
  });
});
