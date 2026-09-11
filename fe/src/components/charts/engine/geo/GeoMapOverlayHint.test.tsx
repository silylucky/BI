import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GeoMapOverlayHint } from "./GeoMapOverlayHint";

describe("GeoMapOverlayHint", () => {
  it("renders as bottom overlay without taking layout flow", () => {
    const { container } = render(
      <div className="relative h-40">
        <GeoMapOverlayHint message="已是最后一层" data-testid="geo-map-hint" />
      </div>,
    );

    const hint = screen.getByTestId("geo-map-hint");
    expect(hint).toHaveAttribute("role", "status");
    expect(hint.className).toMatch(/absolute/);
    expect(hint.className).toMatch(/bottom-2/);
    expect(hint).toHaveTextContent("已是最后一层");
    expect(container.firstElementChild?.childElementCount).toBe(1);
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(
      <div className="relative h-40">
        <GeoMapOverlayHint
          message="地图加载超时，请重试"
          tone="error"
          onRetry={onRetry}
          data-testid="geo-map-hint"
        />
      </div>,
    );

    const retry = screen.getByTestId("geo-map-hint-retry");
    expect(retry).toHaveTextContent("重试");
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
