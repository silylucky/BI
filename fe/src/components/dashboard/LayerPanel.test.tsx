import { cleanup, fireEvent, render as rtlRender, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayerPanel } from "./LayerPanel";
import type { LayoutWidget } from "./layoutUtils";

function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

const widgets: LayoutWidget[] = [
  {
    id: "w1",
    type: "chart",
    title: "透视表",
    colSpan: 6,
    rowSpan: 4,
    order: 0,
    chartConfig: { chartType: "table-pivot", dimensions: [], metrics: [] },
  },
  {
    id: "w2",
    type: "chart",
    title: "基础条形图",
    colSpan: 6,
    rowSpan: 4,
    order: 1,
    chartConfig: { chartType: "bar", dimensions: [], metrics: [] },
  },
  {
    id: "w3",
    type: "chart",
    title: "热力图",
    colSpan: 6,
    rowSpan: 4,
    order: 2,
    chartConfig: { chartType: "t-heatmap", dimensions: [], metrics: [] },
  },
];

afterEach(() => {
  cleanup();
});

describe("LayerPanel", () => {
  it("lists top-level widgets in reverse z-order", () => {
    const { container } = render(
      <LayerPanel widgets={widgets} selectedId={null} onSelect={vi.fn()} onWidgetsChange={vi.fn()} />,
    );
    const list = container.querySelector("[data-layer-panel] ul");
    expect(list).toBeTruthy();
    const titles = within(list as HTMLElement)
      .getAllByText(/透视表|基础条形图|热力图/)
      .map((el) => el.textContent);
    expect(titles).toEqual(["热力图", "基础条形图", "透视表"]);
  });

  it("toggles hidden inline without selecting first", () => {
    const onWidgetsChange = vi.fn();
    render(
      <LayerPanel widgets={widgets} selectedId={null} onSelect={vi.fn()} onWidgetsChange={onWidgetsChange} />,
    );
    const rows = document.querySelectorAll("[data-layer-panel] li > div[role='button']");
    const barRow = rows[1] as HTMLElement;
    fireEvent.click(within(barRow).getByRole("button", { name: "隐藏图层" }));
    expect(onWidgetsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "w2", hidden: true })]),
    );
  });

  it("toggles lock inline on any row", () => {
    const onWidgetsChange = vi.fn();
    render(
      <LayerPanel widgets={widgets} selectedId={null} onSelect={vi.fn()} onWidgetsChange={onWidgetsChange} />,
    );
    const rows = document.querySelectorAll("[data-layer-panel] li > div[role='button']");
    fireEvent.click(within(rows[0] as HTMLElement).getByRole("button", { name: "锁定图层" }));
    expect(onWidgetsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "w3", locked: true })]),
    );
  });

  it("selects layer on row click", () => {
    const onSelect = vi.fn();
    render(
      <LayerPanel widgets={widgets} selectedId={null} onSelect={onSelect} onWidgetsChange={vi.fn()} />,
    );
    const rows = document.querySelectorAll("[data-layer-panel] li [role='button']");
    fireEvent.click(rows[rows.length - 1] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith("w1");
  });

  it("selects layer when clicking title text", () => {
    const onSelect = vi.fn();
    render(
      <LayerPanel widgets={widgets} selectedId={null} onSelect={onSelect} onWidgetsChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("透视表"));
    expect(onSelect).toHaveBeenCalledWith("w1");
  });

  it("deletes layer via trash button", () => {
    const onDelete = vi.fn();
    render(
      <LayerPanel
        widgets={widgets}
        selectedId={null}
        onSelect={vi.fn()}
        onWidgetsChange={vi.fn()}
        onDelete={onDelete}
      />,
    );
    const rows = document.querySelectorAll("[data-layer-panel] li > div[role='button']");
    fireEvent.click(within(rows[1] as HTMLElement).getByRole("button", { name: "删除图层" }));
    expect(onDelete).toHaveBeenCalledWith("w2");
  });

  it("brings layer to front and sends to back", () => {
    const onBringToFront = vi.fn();
    const onSendToBack = vi.fn();
    render(
      <LayerPanel
        widgets={widgets}
        selectedId={null}
        onSelect={vi.fn()}
        onWidgetsChange={vi.fn()}
        onBringToFront={onBringToFront}
        onSendToBack={onSendToBack}
      />,
    );
    const rows = document.querySelectorAll("[data-layer-panel] li > div[role='button']");
    const heatmapRow = rows[0] as HTMLElement;
    fireEvent.click(within(heatmapRow).getByRole("button", { name: "置于顶层" }));
    fireEvent.click(within(heatmapRow).getByRole("button", { name: "置于底层" }));
    expect(onBringToFront).toHaveBeenCalledWith("w3");
    expect(onSendToBack).toHaveBeenCalledWith("w3");
  });

  it("lists tab child widgets with indent label", () => {
    const tabWidgets: LayoutWidget[] = [
      {
        id: "tabs-1",
        type: "tabs",
        title: "页签",
        order: 0,
        tabsConfig: {
          activePaneId: "pane-1",
          panes: [{ id: "pane-1", title: "A", childWidgetIds: ["child-1"] }],
        },
      },
      {
        id: "child-1",
        type: "chart",
        title: "内嵌图表",
        order: 1,
        parentTabsId: "tabs-1",
        tabPaneId: "pane-1",
        chartConfig: { chartType: "bar", dimensions: [], metrics: [] },
      },
    ];
    render(
      <LayerPanel
        widgets={tabWidgets}
        selectedId={null}
        onSelect={vi.fn()}
        onWidgetsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("内嵌图表")).toBeInTheDocument();
    expect(screen.getByText("Tab 内嵌")).toBeInTheDocument();
  });
});
