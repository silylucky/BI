import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasRuler } from "./CanvasRuler";

describe("CanvasRuler", () => {
  it("renders zero label at canvas origin on horizontal ruler", () => {
    render(
      <CanvasRuler
        orientation="horizontal"
        designLength={1920}
        scale={0.5}
        scrollOffsetPx={0}
        viewportPx={800}
      />,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("renders zero label when canvas is letterboxed", () => {
    render(
      <CanvasRuler
        orientation="vertical"
        designLength={1080}
        scale={0.5}
        scrollOffsetPx={-40}
        viewportPx={600}
      />,
    );
    const ruler = screen.getByTestId("canvas-ruler-vertical");
    expect(within(ruler).getByText("0")).toBeInTheDocument();
  });
});
