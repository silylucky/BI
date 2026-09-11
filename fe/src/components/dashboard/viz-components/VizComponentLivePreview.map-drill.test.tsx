import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VizComponentLivePreview } from "./VizComponentLivePreview";
import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";
import { applySalesGeoDrillMapConfig } from "@/lib/mapChartSalesGeo";

const chartRendererSpy = vi.fn();

vi.mock("@/components/charts/ChartRenderer", () => ({
  ChartRenderer: (props: Record<string, unknown>) => {
    chartRendererSpy(props);
    return <div data-testid="mock-chart-renderer" data-drill-enabled={String(props.drillEnabled)} />;
  },
}));

vi.mock("@/hooks/useElementSize", () => ({
  useElementSize: () => ({ ref: () => undefined, size: { width: 480, height: 360 } }),
}));

vi.mock("@/hooks/useInViewport", () => ({
  useInViewport: () => ({ ref: () => undefined, inView: true }),
}));

function mapWidget(): LayoutWidget {
  return {
    id: "vc-map-1",
    type: "chart",
    title: "区域地图",
    order: 0,
    colSpan: 6,
    rowSpan: 4,
    chartConfig: applySalesGeoDrillMapConfig(defaultChartConfig("map"), "ds-sample"),
  };
}

function barWidget(): LayoutWidget {
  return {
    id: "vc-bar-1",
    type: "chart",
    title: "柱状图",
    order: 0,
    colSpan: 6,
    rowSpan: 4,
    chartConfig: defaultChartConfig("bar"),
  };
}

afterEach(() => {
  cleanup();
  chartRendererSpy.mockClear();
});

describe("VizComponentLivePreview map drill wiring", () => {
  it("enables drill for 2D map charts", () => {
    render(<VizComponentLivePreview widget={mapWidget()} />);

    expect(screen.getByTestId("mock-chart-renderer")).toHaveAttribute("data-drill-enabled", "true");
    const props = chartRendererSpy.mock.calls.at(-1)?.[0];
    expect(props?.drillEnabled).toBe(true);
    expect(props?.widgetId).toBe("vc-map-1");
    expect(props?.embedded).toBe(true);
  });

  it("does not enable drill for non-map charts", () => {
    render(<VizComponentLivePreview widget={barWidget()} />);

    expect(screen.getByTestId("mock-chart-renderer")).toHaveAttribute("data-drill-enabled", "false");
    expect(chartRendererSpy.mock.calls.at(-1)?.[0]?.drillEnabled).toBe(false);
  });

  it("uses card preview profile in compact hub thumbnails", () => {
    render(<VizComponentLivePreview widget={barWidget()} compact />);

    expect(chartRendererSpy.mock.calls.at(-1)?.[0]?.previewProfile).toBe("card");
  });

  it("forwards onChartConfigChange to ChartRenderer", () => {
    const onChartConfigChange = vi.fn();
    render(
      <VizComponentLivePreview widget={mapWidget()} onChartConfigChange={onChartConfigChange} />,
    );

    expect(chartRendererSpy.mock.calls.at(-1)?.[0]?.onChartConfigChange).toBe(onChartConfigChange);
  });
});
