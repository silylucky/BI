import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartRenderer } from "./ChartRenderer";
import { ChartDrillProvider } from "./ChartDrillContext";
import { ChartMountProvider } from "./ChartMountContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { DashboardThemeStylePanel } from "@/components/dashboard/dashboardThemeStylePanel";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({
    columns: ["province", "value"],
    rows: [["内蒙古自治区", 100]],
  }),
}));

vi.mock("@/components/charts/engine/CanvasChartHost", () => ({
  CanvasChartHost: () => <div data-testid="mock-canvas-chart" />,
}));

function mapConfigWithDrill(): ChartViewConfig {
  return {
    chartType: "map",
    chartId: "map-remount",
    mode: "sql",
    dataSourceId: "00000000-0000-4000-8000-000000000001",
    sql: "SELECT 1",
    dimensions: [{ field: "province" }],
    metrics: [{ field: "value" }],
    nativeBody: {
      deStyle: {
        geo: {
          manualDrillStack: [
            { field: "province", value: "内蒙古自治区", label: "内蒙古自治区" },
          ],
        },
      },
    },
  };
}

function renderMapChart(config: ChartViewConfig, mountKey?: string) {
  return render(
    <TooltipProvider delayDuration={0}>
      <ChartMountProvider maxConcurrent={4}>
        <ChartDrillProvider>
          <div className="dashboard-theme-scope relative h-[400px] w-[600px]">
            <ChartRenderer
              key={mountKey}
              config={config}
              embedded
              drillEnabled
              widgetId="map-remount"
              renderEnabled
              queryEnabled
            />
          </div>
        </ChartDrillProvider>
      </ChartMountProvider>
    </TooltipProvider>,
  );
}

describe("ChartRenderer geo drill persist remount", () => {
  afterEach(() => cleanup());

  it("restores breadcrumb from manualDrillStack after remount", async () => {
    const config = mapConfigWithDrill();
    const { unmount } = renderMapChart(config, "first");
    await waitFor(() => {
      expect(screen.getByText("内蒙古自治区")).toBeInTheDocument();
    });
    unmount();
    renderMapChart(config, "second");
    await waitFor(() => {
      expect(screen.getByText("内蒙古自治区")).toBeInTheDocument();
    });
  });
});

describe("DashboardThemeStylePanel reset confirm", () => {
  afterEach(() => cleanup());

  it("asks for confirmation before resetting theme colors", () => {
    const onReset = vi.fn();
    render(
      <DashboardThemeStylePanel colorScheme="dark" onResetColorsToTheme={onReset} />,
    );

    fireEvent.click(screen.getByTestId("dashboard-theme-reset-colors"));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByText("重置为当前主题默认？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认重置" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
