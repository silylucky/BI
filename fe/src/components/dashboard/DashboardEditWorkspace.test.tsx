import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardEditWorkspace } from "./DashboardEditWorkspace";

afterEach(() => {
  cleanup();
});

describe("DashboardEditWorkspace", () => {
  it("binds dot-grid chrome to dashboard colorScheme, not shell theme", () => {
    render(
      <DashboardEditWorkspace
        onPaletteInsert={vi.fn()}
        canvas={<div>canvas</div>}
        chartRail={<div>rail</div>}
        canvasColorScheme="dark"
      />,
    );

    const surface = document.querySelector(".dashboard-canvas-surface");
    expect(surface).toHaveAttribute("data-dashboard-color-scheme", "dark");
    expect(screen.getByText("canvas")).toBeInTheDocument();
  });

  it("uses a single pass-through rail shell for chartRail content", () => {
    render(
      <DashboardEditWorkspace
        onPaletteInsert={vi.fn()}
        canvas={<div>canvas</div>}
        chartRail={<div data-testid="rail-child">rail</div>}
      />,
    );

    const shells = screen.getAllByTestId("dashboard-edit-rail-scroll");
    expect(shells).toHaveLength(1);
    expect(shells[0]).toHaveClass("overflow-hidden");
    expect(shells[0]).toContainElement(screen.getByTestId("rail-child"));
    expect(screen.getByTestId("dashboard-edit-rail-shell")).toBeInTheDocument();
  });

  it("exposes a resize handle between canvas and chart rail", () => {
    render(
      <DashboardEditWorkspace
        onPaletteInsert={vi.fn()}
        canvas={<div>canvas</div>}
        chartRail={<div>rail</div>}
      />,
    );

    expect(screen.getByTestId("dashboard-edit-rail-shell-resize-handle")).toBeInTheDocument();
  });
});
