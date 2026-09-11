import { type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "./layoutUtils";
import { ChartInspectorProvider } from "./ChartInspectorProvider";
import { ChartGisMapTileServiceSetup } from "./ChartGisMapTileServiceSetup";

vi.mock("@/lib/tileServices", () => ({
  listTileServices: vi.fn(async () => [
    { id: "planet-z15", name: "Planet Z15 Global", enabled: true },
    { id: "other", name: "Other Service", enabled: true },
  ]),
  resolveTileService: vi.fn(async (serviceId: string) => ({
    id: serviceId,
    name: serviceId === "planet-z15" ? "Planet Z15 Global" : "Other Service",
    pmtilesUrl: `http://localhost:8080/${serviceId}.pmtiles`,
    glyphsUrl: "https://example.com/fonts/{fontstack}/{range}.pbf",
    spriteUrl: "https://example.com/sprites/v4/light",
  })),
}));

const probeAssets = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })));

vi.mock("@/lib/tileServiceAssetsHealth", () => ({
  probeTileServiceBasemapAssets: (resolved: unknown) => probeAssets(resolved),
}));

function gisWidget(tileServiceId?: string): LayoutWidget {
  return {
    id: "w-gis",
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
          ...(tileServiceId ? { tileServiceId } : {}),
        },
      },
    },
  };
}

function renderSetup(ui: ReactElement, onChange = vi.fn(), widget = gisWidget()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onChange,
    ...render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={widget} onChange={onChange}>
          {ui}
        </ChartInspectorProvider>
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => {
  probeAssets.mockReset();
  probeAssets.mockResolvedValue({ ok: true });
  cleanup();
});

describe("ChartGisMapTileServiceSetup", () => {
  it("shows connect flow when no service is linked", async () => {
    renderSetup(<ChartGisMapTileServiceSetup />);

    await waitFor(() => {
      expect(screen.getByTestId("chart-gis-map-tile-service-setup")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "连接服务" })).toBeDisabled();
    expect(screen.queryByText("已连接")).not.toBeInTheDocument();
  });

  it("connects selected service on explicit action", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSetup(<ChartGisMapTileServiceSetup />, onChange);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "选择全球 PMTiles 服务" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: "选择全球 PMTiles 服务" }));
    await user.click(screen.getByRole("option", { name: "Planet Z15 Global（planet-z15）" }));
    await user.click(screen.getByRole("button", { name: "连接服务" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            gisProject: expect.objectContaining({ tileServiceId: "planet-z15" }),
          }),
        }),
      );
    });
  });

  it("shows connected status with resolved endpoint", async () => {
    probeAssets.mockResolvedValue({ ok: true });
    renderSetup(<ChartGisMapTileServiceSetup />, vi.fn(), gisWidget("planet-z15"));

    await waitFor(() => {
      expect(screen.getByText("已连接")).toBeInTheDocument();
      expect(screen.getByText("Planet Z15 Global")).toBeInTheDocument();
      expect(screen.getByText("http://localhost:8080/planet-z15.pmtiles")).toBeInTheDocument();
      expect(screen.getByText("/api/v1/tile-services/planet-z15/resolve")).toBeInTheDocument();
    });

    expect(screen.queryByRole("combobox", { name: "选择全球 PMTiles 服务" })).not.toBeInTheDocument();
  });

  it("does not show success when glyph/sprite probe fails", async () => {
    probeAssets.mockResolvedValue({ ok: false, message: "标注资源不可用" });
    renderSetup(<ChartGisMapTileServiceSetup />, vi.fn(), gisWidget("planet-z15"));

    await waitFor(() => {
      expect(screen.getByText("服务已登记，标注资源不可用")).toBeInTheDocument();
    });
    expect(screen.queryByText("已连接")).not.toBeInTheDocument();
  });
});
