import { describe, expect, it } from "vitest";
import {
  groupStandardSchedulesByPackKey,
  retentionPeriodsLabel,
  summarizePackDelivery,
} from "./standardAnalysisDeliverySummary";
import type { ReportScheduleRow } from "./useReportSchedules";

describe("standardAnalysisDeliverySummary", () => {
  it("labels retention periods with default", () => {
    expect(retentionPeriodsLabel(undefined)).toBe("保留最近 12 期");
    expect(retentionPeriodsLabel(6)).toBe("保留最近 6 期");
  });

  it("summarizes delivery states", () => {
    expect(summarizePackDelivery([]).label).toBe("定时投递：未配置");
    const rows: ReportScheduleRow[] = [
      {
        id: "1",
        sourceType: "standard",
        sourceKey: "pack-a",
        status: "scheduled",
        cron: "0 8 * * *",
        timezone: "Asia/Shanghai",
        allowedActions: [],
      },
    ];
    expect(summarizePackDelivery(rows).label).toBe("定时投递：1 条已调度");
  });

  it("groups schedules by pack key", () => {
    const rows: ReportScheduleRow[] = [
      {
        id: "1",
        sourceType: "standard",
        sourceKey: "pack-a",
        status: "draft",
        cron: "0 8 * * *",
        timezone: "Asia/Shanghai",
        allowedActions: [],
      },
      {
        id: "2",
        sourceType: "standard",
        sourceKey: "pack-b",
        status: "scheduled",
        cron: "0 8 * * *",
        timezone: "Asia/Shanghai",
        allowedActions: [],
      },
    ];
    const map = groupStandardSchedulesByPackKey(rows);
    expect(map.get("pack-a")).toHaveLength(1);
    expect(map.get("pack-b")).toHaveLength(1);
  });
});
