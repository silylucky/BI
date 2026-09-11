import { type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "../layoutUtils";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import { ChartGisMapLayersPanel } from "./ChartGisMapLayersPanel";

function gisWidget(): LayoutWidget {
  return {
    id: "w-gis-layers",
    type: "chart",
    title: "GIS",
    order: 1,
    colSpan: 6,
    rowSpan: 4,
    chartConfig: {
      chartType: "gis-map",
      mode: "sql",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      sql: "SELECT lng, lat, amount FROM points",
      nativeBody: {
        gisProject: {
          projection: "globe",
          tileServiceId: "planet-z15",
        },
      },
    },
  };
}

function renderPanel(ui: ReactElement, onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onChange,
    ...render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={gisWidget()} onChange={onChange}>
          {ui}
        </ChartInspectorProvider>
      </QueryClientProvider>,
    ),
  };
}

afterEach(cleanup);

describe("ChartGisMapLayersPanel", () => {
  it("renders GIS layers section", async () => {
    renderPanel(<ChartGisMapLayersPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-layers-panel")).toBeInTheDocument();
    });
  });

  it("writes activeLayerId when selecting a layer row", async () => {
    const onChange = vi.fn();
    renderPanel(<ChartGisMapLayersPanel />, onChange);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-layers-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "GIS 图层" }));
    await user.click(screen.getByRole("button", { name: "+ 热力层" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            gisProject: expect.objectContaining({
              activeLayerId: expect.any(String),
              layers: expect.arrayContaining([
                expect.objectContaining({ kind: "heatmap" }),
              ]),
            }),
          }),
        }),
      );
    });
  });
});
