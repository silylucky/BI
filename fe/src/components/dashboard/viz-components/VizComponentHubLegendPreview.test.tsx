import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";
import { resetChartExecuteSharedInflight } from "@/lib/chartExecuteProbe";
import { VizComponentLivePreview } from "./VizComponentLivePreview";

const { fetchChartExecuteResult } = vi.hoisted(() => ({
  fetchChartExecuteResult: vi.fn(async () => ({
    columns: ["cat", "left", "right"],
    rows: [
      ["甲", 12, 8],
      ["乙", 6, 14],
    ],
  })),
}));

vi.mock("@/lib/chartExecuteProbe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chartExecuteProbe")>();
  return {
    ...actual,
    fetchChartExecuteResult,
    fetchChartExecuteResultShared: (
      config: Parameters<typeof actual.fetchChartExecuteResultShared>[0],
      options?: Parameters<typeof actual.fetchChartExecuteResultShared>[1],
    ) => fetchChartExecuteResult(config, options),
  };
});

vi.mock("@/hooks/useInViewport", () => ({
  useInViewport: () => ({ ref: () => undefined, inView: true }),
}));

vi.mock("@/hooks/useAdminHeavyRenderSuspended", () => ({
  useAdminHeavyRenderSuspended: () => false,
}));

const DS = "00000000-0000-4000-8000-000000000001";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

function bidirectionalWidget(): LayoutWidget {
  return {
    id: "vc-bidir-1",
    type: "chart",
    title: "对称条形图",
    order: 0,
    colSpan: 6,
    rowSpan: 4,
    chartConfig: {
      ...defaultChartConfig("bidirectional-bar"),
      dataSourceId: DS,
      configId: "cfg-bidir-1",
      mode: "dataset",
      dimensions: [{ field: "cat" }],
      metrics: [{ field: "left" }, { field: "right" }],
    },
  };
}

describe("VizComponent hub legend preview", () => {
  beforeEach(() => {
    fetchChartExecuteResult.mockClear();
    resetChartExecuteSharedInflight();
  });

  afterEach(() => cleanup());

  it("hub compact preview hides shell and inline legends", async () => {
    const { container } = wrap(
      <div style={{ width: 480, height: 280 }}>
        <VizComponentLivePreview widget={bidirectionalWidget()} compact geo3dRenderTier="thumbnail" />
      </div>,
    );

    expect(await screen.findByTestId("d3-bidirectional-bar-chart")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector(".dashboard-chart-legend")).toBeNull();
      expect(container.querySelector("g.vs-legend")).toBeNull();
    });
  });

  it("edit preview shows shell legend for multi-series charts", async () => {
    const { container } = wrap(
      <div style={{ width: 480, height: 280 }}>
        <VizComponentLivePreview widget={bidirectionalWidget()} />
      </div>,
    );

    expect(await screen.findByTestId("d3-bidirectional-bar-chart")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector(".dashboard-chart-legend")).toBeTruthy();
    });
  });
});
