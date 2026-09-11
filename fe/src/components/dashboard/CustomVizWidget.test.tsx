import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useChartExecute } from "@/components/charts/useChartExecute";
import { ADVANCED_CHART_ROW_CAP } from "@/components/charts/engine/buildDatasetEncoding";
import { CustomVizWidget } from "./CustomVizWidget";
import type { CustomVizHostElement } from "./custom-viz/customVizRuntime";
import { rewriteBundleCss } from "./customVizHost";
import { coerceLayoutWidget } from "./layoutUtils";

const useElementSizeMock = vi.fn(() => ({
  ref: vi.fn(),
  size: { width: 320, height: 200 },
}));

vi.mock("@/hooks/useElementSize", () => ({
  useElementSize: () => useElementSizeMock(),
}));

vi.mock("@/lib/api", () => ({
  fetchWithTimeout: vi.fn(async () => ({
    ok: true,
    text: async () => "<!DOCTYPE html><html><body><p>custom</p></body></html>",
  })),
  getAuthHeaders: () => ({}),
  apiFetch: vi.fn(async () => ({
    artifactId: "550e8400-e29b-41d4-a716-446655440000",
    manifest: { defaultStyle: {} },
    status: "active",
    contentHash: "abc",
  })),
}));

vi.mock("@/components/charts/useChartExecute", () => ({
  useChartExecute: vi.fn(() => ({
    columns: [],
    rows: [],
    loading: false,
    error: null,
    slowHint: false,
  })),
}));

vi.mock("@/lib/appBasePath", () => ({
  resolveApiBaseUrl: () => "http://localhost:8000",
}));

afterEach(() => {
  useElementSizeMock.mockReturnValue({
    ref: vi.fn(),
    size: { width: 320, height: 200 },
  });
  vi.mocked(useChartExecute).mockReturnValue({
    columns: [],
    rows: [],
    loading: false,
    error: null,
    slowHint: false,
  });
  document.body.innerHTML = "";
});

describe("CustomVizWidget", () => {
  it("coerces customViz widget type", () => {
    const w = coerceLayoutWidget({
      id: "w1",
      type: "customViz",
      customVizConfig: { artifactId: "a1", dataBinding: { status: "manual" } },
    });
    expect(w.type).toBe("customViz");
    expect(w.customVizConfig?.artifactId).toBe("a1");
  });

  it("mounts artifact HTML into the host Base", async () => {
    render(
      <CustomVizWidget
        widget={{
          id: "w1",
          type: "customViz",
          title: "AI",
          colSpan: 6,
          rowSpan: 3,
          order: 0,
          customVizConfig: { artifactId: "550e8400-e29b-41d4-a716-446655440000" },
        }}
        mode="view"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("custom")).toBeInTheDocument();
    });
    const host = screen.getByTestId("custom-viz-host") as CustomVizHostElement;
    expect(host.vsCv).toBeTruthy();
    expect(screen.getByTestId("custom-viz-host")).toHaveClass("vs-custom-viz-host");
  });

  it("scopes bundle html/body css to the host", () => {
    expect(rewriteBundleCss("html,body{margin:0}#root{padding:8px}")).toBe(
      ".vs-custom-viz-host, .vs-custom-viz-host{margin:0}.vs-custom-viz-host #root{padding:8px}",
    );
  });

  it("hides edit toolbar when showChartActionButtons is off", async () => {
    render(
      <CustomVizWidget
        widget={{
          id: "w1",
          type: "customViz",
          title: "AI",
          colSpan: 6,
          rowSpan: 3,
          order: 0,
          customVizConfig: { artifactId: "550e8400-e29b-41d4-a716-446655440000" },
        }}
        mode="edit"
        dashboardStyle={{ chrome: { showChartActionButtons: false } }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("custom")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("拖动以移动组件")).not.toBeInTheDocument();
  });

  it("shows data loading hint only when showChartLoadingHint is on", async () => {
    vi.mocked(useChartExecute).mockReturnValue({
      columns: [],
      rows: [],
      loading: true,
      error: null,
      slowHint: false,
    });

    const widget = {
      id: "w1",
      type: "customViz" as const,
      title: "AI",
      colSpan: 6,
      rowSpan: 3,
      order: 0,
      customVizConfig: {
        artifactId: "550e8400-e29b-41d4-a716-446655440000",
        dataBinding: {
          status: "connected",
          dataSourceId: "ds1",
          datasetId: "set1",
          configId: "cfg1",
          dimensions: [{ field: "name" }],
          metrics: [{ field: "value", agg: "sum" as const }],
        },
      },
    };

    const { rerender } = render(
      <CustomVizWidget
        widget={widget}
        mode="view"
        dashboardStyle={{ chrome: { showChartLoadingHint: true } }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("custom-viz-data-loading")).toBeInTheDocument();
    });

    rerender(
      <CustomVizWidget
        widget={widget}
        mode="view"
        dashboardStyle={{ chrome: { showChartLoadingHint: false } }}
      />,
    );
    expect(screen.queryByTestId("custom-viz-data-loading")).not.toBeInTheDocument();
  });

  it("shows truncated banner when rows exceed cap", async () => {
    const cappedRows = Array.from({ length: ADVANCED_CHART_ROW_CAP }, (_, index) => [
      `row-${index}`,
      index,
    ]);
    vi.mocked(useChartExecute).mockReturnValue({
      columns: ["name", "value"],
      rows: [...cappedRows, [`row-${ADVANCED_CHART_ROW_CAP}`, ADVANCED_CHART_ROW_CAP]],
      loading: false,
      error: null,
      slowHint: false,
    });

    render(
      <CustomVizWidget
        widget={{
          id: "w1",
          type: "customViz",
          title: "AI",
          colSpan: 6,
          rowSpan: 3,
          order: 0,
          customVizConfig: {
            artifactId: "550e8400-e29b-41d4-a716-446655440000",
            dataBinding: {
              status: "connected",
              dataSourceId: "ds1",
              datasetId: "set1",
              configId: "cfg1",
              dimensions: [{ field: "name" }],
              metrics: [{ field: "value", agg: "sum" as const }],
            },
          },
        }}
        mode="view"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("custom-viz-truncated-banner")).toHaveTextContent(
        `数据量较大，已采样显示前 ${ADVANCED_CHART_ROW_CAP} 条`,
      );
    });
  });

  it("re-injects payload style on config.style change without executeKey bump", async () => {
    const widget = {
      id: "w1",
      type: "customViz" as const,
      title: "AI",
      colSpan: 6,
      rowSpan: 3,
      order: 0,
      customVizConfig: {
        artifactId: "550e8400-e29b-41d4-a716-446655440000",
        style: { accentColor: "#111111" },
      },
    };

    const view = render(<CustomVizWidget widget={widget} mode="view" />);
    await waitFor(() => {
      expect(view.getByTestId("custom-viz-host")).toBeInTheDocument();
    });
    const host = view.getByTestId("custom-viz-host");
    expect(host.style.getPropertyValue("--vs-style-accent-color")).toBe("#111111");

    view.rerender(
      <CustomVizWidget
        widget={{
          ...widget,
          customVizConfig: {
            ...widget.customVizConfig,
            style: { accentColor: "#abcdef" },
          },
        }}
        mode="view"
      />,
    );
    await waitFor(() => {
      expect(host.style.getPropertyValue("--vs-style-accent-color")).toBe("#abcdef");
    });
  });

  it("updates payload layout when host size changes", async () => {
    useElementSizeMock.mockReturnValue({
      ref: vi.fn(),
      size: { width: 320, height: 200 },
    });
    const widget = {
      id: "w1",
      type: "customViz" as const,
      title: "AI",
      colSpan: 6,
      rowSpan: 3,
      order: 0,
      customVizConfig: {
        artifactId: "550e8400-e29b-41d4-a716-446655440000",
      },
    };

    const view = render(<CustomVizWidget widget={widget} mode="view" />);
    await waitFor(() => {
      expect(view.getByTestId("custom-viz-host")).toBeInTheDocument();
    });
    const host = view.getByTestId("custom-viz-host");
    await waitFor(() => {
      expect(host.dataset.vsCvLayoutSig).toBe("320x200");
    });

    useElementSizeMock.mockReturnValue({
      ref: vi.fn(),
      size: { width: 640, height: 400 },
    });
    view.rerender(<CustomVizWidget widget={widget} mode="view" />);
    await waitFor(() => {
      expect(host.dataset.vsCvLayoutSig).toBe("640x400");
    });
  });

  it("mounts manifest styleHooks bridge sheet from artifact meta", async () => {
    const { apiFetch } = await import("@/lib/api");
    vi.mocked(apiFetch).mockResolvedValueOnce({
      artifactId: "550e8400-e29b-41d4-a716-446655440000",
      manifest: {
        defaultStyle: {},
        styleSchema: { properties: { accentColor: { type: "string" } } },
        styleHooks: { accentColor: { selectors: [".custom-bar"] } },
      },
      status: "active",
      contentHash: "hooks-hash",
    });

    render(
      <CustomVizWidget
        widget={{
          id: "w1",
          type: "customViz",
          title: "AI",
          colSpan: 6,
          rowSpan: 3,
          order: 0,
          customVizConfig: { artifactId: "550e8400-e29b-41d4-a716-446655440000" },
        }}
        mode="view"
      />,
    );

    await waitFor(() => {
      const host = screen.getByTestId("custom-viz-host");
      expect(host.querySelector(".vs-cv-style-hooks")?.textContent).toContain(".custom-bar");
    });
  });
});
