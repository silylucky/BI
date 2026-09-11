import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenDateTimeDisplay } from "./ScreenDateTimeDisplay";

describe("ScreenDateTimeDisplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T08:00:00"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders split date and time lines", () => {
    render(<ScreenDateTimeDisplay />);
    expect(screen.getByText("2026-07-24")).toBeInTheDocument();
    expect(screen.getByText("08:00:00")).toBeInTheDocument();
  });

  it("hides seconds when configured", () => {
    render(<ScreenDateTimeDisplay styleConfig={{ showSeconds: false }} />);
    const timeLine = screen.getByTestId("screen-datetime-time");
    expect(timeLine).toHaveTextContent("08:00");
    expect(timeLine).not.toHaveTextContent("08:00:00");
  });
});
