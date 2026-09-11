import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardStyleSurface } from "./DashboardStyleSurface";

const widget = {
  id: "w1",
  type: "text" as const,
  title: "文本",
  colSpan: 6,
  rowSpan: 4,
  order: 1,
  textConfig: { content: "hello" },
};

afterEach(() => {
  cleanup();
});

describe("DashboardGrid component gap", () => {
  it("applies gap shell class and CSS variable for grid layout", () => {
    const { container } = render(
      <DashboardStyleSurface componentGapPx={8}>
        <DashboardGrid
          mode="view"
          widgets={[widget]}
          styleConfig={{ gapPreset: "md", widgetGap: 8, pixelGutter: 5 }}
          renderWidget={() => <div data-testid="grid-widget-body">body</div>}
        />
      </DashboardStyleSurface>,
    );

    const scope = container.querySelector(".dashboard-theme-scope");
    expect(scope).toHaveStyle({ "--dashboard-shape-gap": "8px" });

    const cell = container.querySelector(".grid-widget-cell.dashboard-shape-gap-shell");
    expect(cell).toBeTruthy();
    expect(cell?.className).not.toContain("dashboard-widget-surface");
  });

  it("uses widget surface on cell when gap is zero", () => {
    const { container } = render(
      <DashboardStyleSurface componentGapPx={0}>
        <DashboardGrid
          mode="view"
          widgets={[widget]}
          styleConfig={{ gapPreset: "none" }}
          renderWidget={() => <div>body</div>}
        />
      </DashboardStyleSurface>,
    );

    const cell = container.querySelector(".grid-widget-cell.dashboard-shape-gap-shell");
    expect(cell?.className).toContain("dashboard-widget-surface");
  });
});

describe("DashboardGrid auxiliary grid", () => {
  it("shows edit overlay when chrome.showAuxiliaryGrid is enabled", () => {
    render(
      <DashboardStyleSurface componentGapPx={0}>
        <DashboardGrid
          mode="edit"
          widgets={[widget]}
          styleConfig={{ chrome: { showAuxiliaryGrid: true } }}
          onLayoutChange={() => {}}
          renderWidget={() => <div>body</div>}
        />
      </DashboardStyleSurface>,
    );
    expect(screen.getByTestId("dashboard-grid-aux-grid")).toBeInTheDocument();
  });

  it("hides edit overlay when chrome.showAuxiliaryGrid is disabled", () => {
    render(
      <DashboardStyleSurface componentGapPx={0}>
        <DashboardGrid
          mode="edit"
          widgets={[widget]}
          styleConfig={{ chrome: { showAuxiliaryGrid: false } }}
          onLayoutChange={() => {}}
          renderWidget={() => <div>body</div>}
        />
      </DashboardStyleSurface>,
    );
    expect(screen.queryByTestId("dashboard-grid-aux-grid")).not.toBeInTheDocument();
  });
});
