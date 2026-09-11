import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardStyleSurface } from "../DashboardStyleSurface";
import { PixelShape } from "./PixelShape";

function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

const chartWidget = {
  id: "w-chart",
  type: "chart" as const,
  title: "桑基图",
  x: 40,
  y: 40,
  width: 480,
  height: 320,
  order: 1,
};

const canvas = { width: 1920, height: 1080 };

afterEach(() => {
  cleanup();
});

describe("PixelShape chart clip (edit mode)", () => {
  it("keeps overflow-hidden on shape shell layers in edit mode", () => {
    renderWithProviders(
      <DashboardStyleSurface componentGapPx={0}>
        <PixelShape
          widget={chartWidget}
          canvas={canvas}
          scale={1}
          mode="edit"
          selected
          viewport={{ x: 0, y: 0, width: 1920, height: 1080 }}
        >
          <div data-testid="chart-body">chart</div>
        </PixelShape>
      </DashboardStyleSurface>,
    );

    const body = screen.getByTestId("pixel-shape-body-w-chart");
    expect(body).toHaveClass("overflow-hidden");

    const inner = body.querySelector(".pixel-shape-inner");
    expect(inner).toHaveClass("overflow-hidden");

    const content = body.querySelector(".pixel-shape-content");
    expect(content).toHaveClass("overflow-hidden");
  });

  it("keeps overflow-hidden on shape shell layers in view mode", () => {
    renderWithProviders(
      <DashboardStyleSurface componentGapPx={0}>
        <PixelShape widget={chartWidget} canvas={canvas} scale={1} mode="view" selected={false}>
          <div data-testid="chart-body">chart</div>
        </PixelShape>
      </DashboardStyleSurface>,
    );

    const body = screen.getByTestId("pixel-shape-body-w-chart");
    expect(body).toHaveClass("overflow-hidden");
    expect(body.querySelector(".pixel-shape-inner")).toHaveClass("overflow-hidden");
    expect(body.querySelector(".pixel-shape-content")).toHaveClass("overflow-hidden");
  });
});
