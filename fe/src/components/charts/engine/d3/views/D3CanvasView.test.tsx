import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { D3CanvasView } from "@/components/charts/engine/d3/views/D3CanvasView";
import * as d3RendererSession from "@/components/charts/engine/d3/core/d3RendererSession";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

vi.mock("@/hooks/useElementSize", () => ({
  useElementSize: () => ({
    ref: vi.fn(),
    size: { width: 320, height: 240 },
  }),
}));

vi.mock("@/hooks/useEmbeddedChartLiveResize", () => ({
  useEmbeddedChartLiveResize: () => undefined,
}));

vi.mock("@/hooks/useChartVisualScale", () => ({
  useChartVisualScale: () => 1,
}));

vi.mock("@/components/dashboard/pixelCanvas/pixelShapePlayerContext", () => ({
  usePixelShapePlayer: () => false,
}));

const pieConfig: ChartViewConfig = {
  chartType: "pie",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "category" }],
  metrics: [{ field: "value" }],
  nativeBody: {
    deStyle: { label: { position: "inside", fontSize: 12 } },
  },
};

function buildPieProps(styleOverrides?: Partial<ChartStyleContext>) {
  const viewModel = buildChartViewModel(pieConfig, {
    columns: ["category", "value"],
    rows: [
      ["A", 40],
      ["B", 35],
      ["C", 25],
    ],
  });
  const style = buildStyleContext({
    config: pieConfig,
    chartColors: ["#465fff", "#12b76a", "#f79009"],
  });
  return {
    viewModel,
    style: { ...style, embedEdit: true, ...styleOverrides },
    chartConfig: pieConfig,
    ariaLabel: "品类占比",
    height: 240,
    width: 320,
  };
}

describe("D3CanvasView", () => {
  let runSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runSpy = vi.spyOn(d3RendererSession, "runD3Renderer").mockImplementation(() => undefined);
  });

  afterEach(() => {
    runSpy.mockRestore();
  });

  it("re-renders when deStyle label changes without resize", async () => {
    const props = buildPieProps();
    const { rerender } = render(<D3CanvasView {...props} />);
    await waitFor(() => expect(runSpy).toHaveBeenCalled());
    const initialCalls = runSpy.mock.calls.length;

    const nextConfig: ChartViewConfig = {
      ...pieConfig,
      nativeBody: {
        deStyle: { label: { position: "outside", fontSize: 16 } },
      },
    };

    rerender(
      <D3CanvasView
        {...props}
        chartConfig={nextConfig}
        style={{
          ...props.style,
          deStyle: { label: { position: "outside", fontSize: 16 } },
          labelPresentation: { fontSize: 16 },
        }}
      />,
    );

    await waitFor(() => expect(runSpy.mock.calls.length).toBeGreaterThan(initialCalls));
  });

  it("does not force-repaint when paintMaxEdge changes but capped size is unchanged", async () => {
    const props = buildPieProps();
    const { rerender } = render(
      <D3CanvasView {...props} fill layoutFootprint={{ width: 320, height: 240 }} paintMaxEdge={720} />,
    );
    await waitFor(() => expect(runSpy).toHaveBeenCalled());
    const afterMount = runSpy.mock.calls.length;

    rerender(
      <D3CanvasView
        {...props}
        fill
        layoutFootprint={{ width: 320, height: 240 }}
        paintMaxEdge={undefined}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(runSpy.mock.calls.length).toBe(afterMount);
  });
});
