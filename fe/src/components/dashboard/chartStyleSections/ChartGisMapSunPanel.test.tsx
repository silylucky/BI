import { type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "../layoutUtils";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import { ChartGisMapSunPanel } from "./ChartGisMapSunPanel";

function gisWidget(projection: "globe" | "mercator"): LayoutWidget {
  return {
    id: "w-gis-sun",
    type: "chart",
    title: "GIS",
    order: 1,
    colSpan: 6,
    rowSpan: 4,
    chartConfig: {
      chartType: "gis-map",
      mode: "sql",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      sql: "SELECT 1",
      nativeBody: {
        gisProject: {
          projection,
          tileServiceId: "planet-z15",
          sun: { enabled: true },
        },
      },
    },
  };
}

function renderPanel(widget: LayoutWidget, ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ChartInspectorProvider widget={widget} onChange={vi.fn()}>
        {ui}
      </ChartInspectorProvider>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("ChartGisMapSunPanel projection", () => {
  it("shows sun controls on mercator flat map", async () => {
    const user = userEvent.setup();
    renderPanel(gisWidget("mercator"), <ChartGisMapSunPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-sun-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "太阳" }));
    expect(screen.getByRole("switch", { name: "启用太阳光照" })).toBeChecked();
    expect(screen.queryByText("请先将投影设为「球面地球」。")).not.toBeInTheDocument();
  });

  it("shows sun controls on globe projection", async () => {
    const user = userEvent.setup();
    renderPanel(gisWidget("globe"), <ChartGisMapSunPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-sun-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "太阳" }));
    expect(screen.getByRole("switch", { name: "启用太阳光照" })).toBeChecked();
  });
});
