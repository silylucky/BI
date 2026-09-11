import { describe, expect, it } from "vitest";
import { cronFromWizard, describeCron, parseCronToWizard } from "./scheduleCronWizard";

describe("scheduleCronWizard", () => {
  it("builds hourly cron", () => {
    expect(
      cronFromWizard({ frequency: "hourly", hour: 8, minute: 15, weekday: 1, dayOfMonth: 1 }),
    ).toBe("15 * * * *");
    expect(describeCron("15 * * * *")).toBe("每小时 15 分");
  });

  it("builds daily cron", () => {
    expect(
      cronFromWizard({ frequency: "daily", hour: 8, minute: 0, weekday: 1, dayOfMonth: 1 }),
    ).toBe("0 8 * * *");
    expect(describeCron("0 8 * * *")).toBe("每天 08:00");
  });

  it("builds weekly cron", () => {
    expect(
      cronFromWizard({ frequency: "weekly", hour: 8, minute: 0, weekday: 1, dayOfMonth: 1 }),
    ).toBe("0 8 * * 1");
    expect(describeCron("0 8 * * 1")).toBe("每周一 08:00");
  });

  it("builds monthly cron", () => {
    expect(
      cronFromWizard({ frequency: "monthly", hour: 9, minute: 30, weekday: 1, dayOfMonth: 15 }),
    ).toBe("30 9 15 * *");
    expect(describeCron("30 9 15 * *")).toBe("每月 15 日 09:30");
  });

  it("round-trips wizard presets", () => {
    const weekly = parseCronToWizard("0 8 * * 1");
    expect(weekly?.frequency).toBe("weekly");
    expect(cronFromWizard(weekly!)).toBe("0 8 * * 1");

    const hourly = parseCronToWizard("30 * * * *");
    expect(hourly?.frequency).toBe("hourly");
    expect(cronFromWizard(hourly!)).toBe("30 * * * *");
  });
});
