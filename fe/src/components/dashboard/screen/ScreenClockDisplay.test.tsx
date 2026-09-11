import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScreenClockDisplay } from "./ScreenClockDisplay";

describe("ScreenClockDisplay", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies configured text color to clock text nodes", () => {
    render(
      <ScreenClockDisplay
        styleConfig={{
          fontSize: 14,
          color: "#ff5500",
          weekdayColor: "#00aa88",
          showWeekday: true,
          showSeconds: true,
          showDate: true,
        }}
      />,
    );

    const time = screen.getByTestId("screen-clock-time");
    const weekday = screen.getByTestId("screen-clock-weekday");
    const date = screen.getByTestId("screen-clock-date");

    expect(time.style.color).toBe("rgb(255, 85, 0)");
    expect(weekday.style.color).toBe("rgb(0, 170, 136)");
    expect(date.style.color).toBe("rgb(255, 85, 0)");
  });

  it("hides date line when showDate is false", () => {
    render(
      <ScreenClockDisplay
        styleConfig={{
          showDate: false,
          showWeekday: false,
        }}
      />,
    );

    expect(screen.queryByTestId("screen-clock-date")).toBeNull();
    expect(screen.getByTestId("screen-clock-time")).toBeInTheDocument();
  });
});
