import { describe, expect, it } from "vitest";
import {
  formatScreenClockDateLine,
  formatScreenClockDisplayParts,
  formatScreenClockTimeLine,
} from "./screenClockFormat";

describe("screenClockFormat", () => {
  const date = new Date(2026, 7, 7, 15, 30, 45);

  it("formats date lines by format", () => {
    expect(formatScreenClockDateLine(date, "YYYY-MM-DD")).toBe("2026-08-07");
    expect(formatScreenClockDateLine(date, "YYYY/MM/DD")).toBe("2026/08/07");
    expect(formatScreenClockDateLine(date, "YYYY年MM月DD日")).toBe("2026年08月07日");
    expect(formatScreenClockDateLine(date, "MM-DD")).toBe("08-07");
  });

  it("formats 24h and 12h time lines", () => {
    expect(formatScreenClockTimeLine(date, true, false)).toEqual({
      timeLine: "15:30:45",
    });
    expect(formatScreenClockTimeLine(date, false, false)).toEqual({
      timeLine: "15:30",
    });
    expect(formatScreenClockTimeLine(date, true, true)).toEqual({
      timeLine: "03:30:45",
      period: "PM",
    });
  });

  it("builds display parts with optional date", () => {
    expect(
      formatScreenClockDisplayParts(date, {
        showDate: true,
        dateFormat: "YYYY-MM-DD",
        showSeconds: false,
        use12Hour: false,
      }),
    ).toMatchObject({
      dateLine: "2026-08-07",
      timeLine: "15:30",
      weekday: "星期五",
    });
    expect(
      formatScreenClockDisplayParts(date, {
        showDate: false,
        dateFormat: "YYYY-MM-DD",
        showSeconds: false,
        use12Hour: false,
      }).dateLine,
    ).toBeUndefined();
  });
});
