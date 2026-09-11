import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useScreenAutoRefresh } from "./useScreenAutoRefresh";

function Probe({ interval }: { interval?: number }) {
  const state = useScreenAutoRefresh({ refreshIntervalSec: interval, enabled: true });
  return (
    <div>
      <span data-testid="key">{state.globalChartRefreshKey}</span>
      <span data-testid="countdown">{state.countdownSec ?? "none"}</span>
    </div>
  );
}

describe("useScreenAutoRefresh", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts countdown when interval is configured", () => {
    vi.useFakeTimers();
    render(<Probe interval={10} />);
    expect(screen.getByTestId("countdown").textContent).toBe("10");
  });

  it("skips countdown when interval below minimum", () => {
    render(<Probe interval={3} />);
    expect(screen.getByTestId("countdown").textContent).toBe("none");
  });
});
