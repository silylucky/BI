import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { embeddedChartSurface } from "./chartRendererEmbedded";

describe("embeddedChartSurface", () => {
  it("clips chart content by default (contain scaling inside widget)", () => {
    const { container } = render(
      embeddedChartSurface(<div data-testid="chart-host">chart</div>),
    );

    const surface = container.querySelector(".embedded-chart-live-surface");
    expect(surface).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("chart-host")).toBeInTheDocument();
  });

  it("allows explicit clip=false for isolated tests only", () => {
    const { container } = render(
      embeddedChartSurface(<div data-testid="chart-host">chart</div>, { clip: false }),
    );

    const surface = container.querySelector(".embedded-chart-live-surface");
    expect(surface).toHaveClass("overflow-visible");
  });
});
