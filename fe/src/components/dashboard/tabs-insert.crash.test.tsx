import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabsEditRail } from "./TabsEditRail";
import { TabsWidget } from "./TabsWidget";
import { pixelWidgetToLayoutWidget } from "./dashboardCanvasMode";
import { defaultChartConfig } from "./layoutUtils";
import { insertPixelPaletteWidget } from "./pixelCanvas/createPixelWidget";
import { PixelCanvasScaleProvider } from "./pixelCanvas/PixelCanvasScaleContext";
import type { DashboardLayoutV2 } from "./layoutUtils";

const baseLayout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1440, height: 900 },
  widgets: [
    {
      id: "chart-1",
      type: "chart",
      title: "amount",
      x: 0,
      y: 0,
      width: 480,
      height: 300,
      order: 0,
      chartConfig: { ...defaultChartConfig("bar"), chartId: "chart-1" },
    },
  ],
  globalFilters: [],
};

describe("tabs insert crash", () => {
  it("insertPixelPaletteWidget adds tabs widget", () => {
    const next = insertPixelPaletteWidget("tabs", baseLayout);
    const tabs = next.widgets.find((w) => w.type === "tabs");
    expect(tabs?.tabsConfig).toBeTruthy();
  });

  it("TabsEditRail renders for new tabs widget", () => {
    const next = insertPixelPaletteWidget("tabs", baseLayout);
    const widgets = next.widgets.map(pixelWidgetToLayoutWidget);
    const tabs = widgets.find((w) => w.type === "tabs" && w.tabsConfig)!;
    render(
      <TabsEditRail
        widget={tabs as typeof tabs & { tabsConfig: NonNullable<typeof tabs.tabsConfig> }}
        allWidgets={widgets}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("页签列表")).toBeInTheDocument();
  });

  it("TabsWidget renders in shape shell", () => {
    const next = insertPixelPaletteWidget("tabs", baseLayout);
    const widgets = next.widgets.map(pixelWidgetToLayoutWidget);
    const tabs = widgets.find((w) => w.type === "tabs" && w.tabsConfig)!;
    render(
      <PixelCanvasScaleProvider scale={1}>
        <TabsWidget
          widget={tabs as typeof tabs & { tabsConfig: NonNullable<typeof tabs.tabsConfig> }}
          allWidgets={widgets}
          mode="edit"
          shell="shape"
          renderChild={() => null}
        />
      </PixelCanvasScaleProvider>,
    );
    expect(screen.getByRole("tab", { name: "页签 1" })).toBeInTheDocument();
  });
});
