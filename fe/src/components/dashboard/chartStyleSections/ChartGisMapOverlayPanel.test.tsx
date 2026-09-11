import { type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "../layoutUtils";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import { ChartGisMapOverlayPanel } from "./ChartGisMapOverlayPanel";

vi.mock("@/components/charts/engine/maplibre/gisMapViewBridge", () => ({
  syncGisMapViewLayers: vi.fn(() => true),
  applyGisMapViewOverlayPatch: vi.fn(() => true),
}));

function gisWidget(): LayoutWidget {
  return {
    id: "w-gis-overlay",
    type: "chart",
    title: "GIS",
    order: 1,
    colSpan: 6,
    rowSpan: 4,
    chartConfig: {
      chartType: "gis-map",
      mode: "sql",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      sql: "SELECT longitude, latitude, amount FROM stores",
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

describe("ChartGisMapOverlayPanel", () => {
  it("renders scatter overlay section", async () => {
    renderPanel(<ChartGisMapOverlayPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-overlay-panel")).toBeInTheDocument();
    });
  });

  it("writes showLabels true to active layer style", async () => {
    const onChange = vi.fn();
    renderPanel(<ChartGisMapOverlayPanel />, onChange);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-overlay-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "散点叠加" }));
    expect(screen.getByRole("switch", { name: "显示标签" })).not.toBeChecked();
    await user.click(screen.getByRole("switch", { name: "显示标签" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            gisProject: expect.objectContaining({
              layers: expect.arrayContaining([
                expect.objectContaining({
                  style: expect.objectContaining({ showLabels: true }),
                }),
              ]),
            }),
          }),
        }),
      );
    });
  });

  it("writes scaleByMetric false to active layer style", async () => {
    const onChange = vi.fn();
    renderPanel(<ChartGisMapOverlayPanel />, onChange);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-overlay-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "散点叠加" }));
    await user.click(screen.getByRole("switch", { name: "按指标缩放大小" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            gisProject: expect.objectContaining({
              layers: expect.arrayContaining([
                expect.objectContaining({
                  style: expect.objectContaining({ scaleByMetric: false }),
                }),
              ]),
            }),
          }),
        }),
      );
    });
  });

  it("writes labelMinZoom to active layer style", async () => {
    const widget = gisWidget();
    widget.chartConfig.nativeBody = {
      gisProject: {
        projection: "globe",
        tileServiceId: "planet-z15",
        layers: [
          {
            id: "scatter-1",
            name: "散点层",
            kind: "scatter",
            style: { showLabels: true },
          },
        ],
        activeLayerId: "scatter-1",
      },
    };
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={widget} onChange={onChange}>
          <ChartGisMapOverlayPanel />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-overlay-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "散点叠加" }));
    const zoomField = screen.getByRole("spinbutton", { name: "标签最小 zoom" });
    fireEvent.change(zoomField, { target: { value: "6" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            gisProject: expect.objectContaining({
              layers: expect.arrayContaining([
                expect.objectContaining({
                  style: expect.objectContaining({ labelMinZoom: 6 }),
                }),
              ]),
            }),
          }),
        }),
      );
    });
  });

  it("clears layer style on reset", async () => {
    const widget = gisWidget();
    widget.chartConfig.nativeBody = {
      gisProject: {
        projection: "globe",
        tileServiceId: "planet-z15",
        overlay: { color: "#ff0000", opacity: 0.5 },
      },
    };
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={widget} onChange={onChange}>
          <ChartGisMapOverlayPanel />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-overlay-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "散点叠加" }));
    await user.click(screen.getByRole("button", { name: /恢复默认/ }));

    await waitFor(() => {
      const nextConfig = onChange.mock.calls.at(-1)?.[0];
      const gisProject = nextConfig?.nativeBody?.gisProject;
      expect(gisProject?.overlay).toBeUndefined();
      expect(gisProject?.layers?.[0]?.style).toBeUndefined();
    });
  });
});
