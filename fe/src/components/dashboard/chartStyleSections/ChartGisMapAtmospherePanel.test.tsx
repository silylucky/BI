import { type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "../layoutUtils";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import { DEFAULT_GIS_EFFECTS_SETTINGS } from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";
import { ChartGisMapAtmospherePanel } from "./ChartGisMapAtmospherePanel";

function gisGlobeWidget(): LayoutWidget {
  return {
    id: "w-gis-atmosphere",
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
          projection: "globe",
          tileServiceId: "planet-z15",
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

describe("ChartGisMapAtmospherePanel", () => {
  it("uses inspector switch and inline color rows with GeoLibre defaults", async () => {
    const user = userEvent.setup();
    renderPanel(gisGlobeWidget(), <ChartGisMapAtmospherePanel />);

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-atmosphere-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "大气效果" }));
    expect(screen.getByRole("switch", { name: "已启用" })).toBeChecked();
    expect(screen.getByLabelText("光晕颜色取色器")).toBeInTheDocument();
    expect(screen.getByLabelText("太空颜色取色器")).toBeInTheDocument();
    expect(DEFAULT_GIS_EFFECTS_SETTINGS.spaceColor).toBe("#000000");
    expect(DEFAULT_GIS_EFFECTS_SETTINGS.haloColor).toBe("#4d9fe6");
  });
});
