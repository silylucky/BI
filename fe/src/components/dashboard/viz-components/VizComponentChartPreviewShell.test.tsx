import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VizComponentChartPreviewShell } from "@/components/dashboard/viz-components/VizComponentChartPreviewShell";
import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";
import { patchChartDeStyleNested } from "@/lib/chartDeStyle";

describe("VizComponentChartPreviewShell", () => {
  it("renders grid widget border chrome like dashboard view", () => {
    const widget: LayoutWidget = {
      id: "vc-edit-1",
      type: "chart",
      title: "销量趋势",
      colSpan: 12,
      rowSpan: 8,
      order: 0,
      chartConfig: defaultChartConfig("line"),
    };

    render(
      <VizComponentChartPreviewShell
        widget={widget as LayoutWidget & { chartConfig: NonNullable<typeof widget.chartConfig> }}
      >
        <div data-testid="chart-body">chart</div>
      </VizComponentChartPreviewShell>,
    );

    const shell = screen.getByTestId("viz-component-chart-shell");
    expect(shell.className).toContain("rounded-xl");
    expect(shell.className).toContain("border");
    expect(screen.getByTestId("chart-body")).toBeInTheDocument();
  });

  it("renders decorative frame overlay from deStyle background", () => {
    const widget: LayoutWidget = {
      id: "vc-edit-2",
      type: "chart",
      title: "带边框",
      colSpan: 12,
      rowSpan: 8,
      order: 0,
      chartConfig: patchChartDeStyleNested(defaultChartConfig("line"), "background", {
        backgroundShow: true,
        backgroundMode: "frame",
        framePresetId: "frame-2",
        frameColor: "#ff0000",
      }),
    };

    render(
      <VizComponentChartPreviewShell
        widget={widget as LayoutWidget & { chartConfig: NonNullable<typeof widget.chartConfig> }}
      >
        <div>chart</div>
      </VizComponentChartPreviewShell>,
    );

    const frame = screen.getByTestId("viz-chart-shell-frame-0");
    expect(frame.style.backgroundImage).toContain("data:image/svg+xml");
  });

  it("renders background image on shell layer from deStyle", () => {
    const widget: LayoutWidget = {
      id: "vc-edit-3",
      type: "chart",
      title: "带底图",
      colSpan: 12,
      rowSpan: 8,
      order: 0,
      chartConfig: patchChartDeStyleNested(defaultChartConfig("line"), "background", {
        backgroundShow: true,
        backgroundMode: "image",
        backgroundImage: "data:image/svg+xml;base64,PHN2Zy8+",
      }),
    };

    render(
      <VizComponentChartPreviewShell
        widget={widget as LayoutWidget & { chartConfig: NonNullable<typeof widget.chartConfig> }}
      >
        <div>chart</div>
      </VizComponentChartPreviewShell>,
    );

    const bg = document.querySelector('[data-testid="viz-chart-shell-bg-0"]') as HTMLElement | null;
    const img = bg?.querySelector("img");
    expect(img?.getAttribute("src")).toContain("data:image/svg+xml");
    expect(img?.style.objectFit).toBe("fill");
  });

  it("hides title bar in compact list-card mode", () => {
    const widget: LayoutWidget = {
      id: "vc-card-1",
      type: "chart",
      title: "3dmap",
      colSpan: 12,
      rowSpan: 8,
      order: 0,
      chartConfig: defaultChartConfig("map-3d"),
    };

    const { container } = render(
      <VizComponentChartPreviewShell
        widget={widget as LayoutWidget & { chartConfig: NonNullable<typeof widget.chartConfig> }}
        compact
      >
        <div data-testid="chart-body">chart</div>
      </VizComponentChartPreviewShell>,
    );

    const shell = within(container).getByTestId("viz-component-chart-shell");
    expect(within(shell).queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
    expect(within(shell).getByTestId("chart-body")).toBeInTheDocument();
  });

  it("omits grid border chrome in compact hub-card mode", () => {
    const widget: LayoutWidget = {
      id: "vc-card-2",
      type: "chart",
      title: "3dmap",
      colSpan: 12,
      rowSpan: 8,
      order: 0,
      chartConfig: defaultChartConfig("map-3d"),
    };

    const { container } = render(
      <VizComponentChartPreviewShell
        widget={widget as LayoutWidget & { chartConfig: NonNullable<typeof widget.chartConfig> }}
        compact
      >
        <div>chart</div>
      </VizComponentChartPreviewShell>,
    );

    const shell = within(container).getByTestId("viz-component-chart-shell");
    expect(shell.className).not.toContain("rounded-xl");
    expect(shell.className).not.toContain("border-gray-200");
  });
});
