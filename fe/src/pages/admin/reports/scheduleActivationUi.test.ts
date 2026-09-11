import { describe, expect, it } from "vitest";
import {
  resolveActivationBannerSchedule,
  syncPendingActivationId,
} from "./scheduleActivationUi";
import type { ReportScheduleRow } from "./useReportSchedules";

const draft: ReportScheduleRow = {
  id: "draft-1",
  status: "draft",
  cron: "0 8 * * *",
  timezone: "Asia/Shanghai",
  recipients: [{ type: "email", value: "a@example.com" }],
  allowedActions: ["schedule"],
  sourceType: "dashboard",
  sourceId: "dash-1",
  attachmentFormats: ["pdf"],
};

const scheduled: ReportScheduleRow = {
  ...draft,
  id: "sched-1",
  status: "scheduled",
  allowedActions: ["pause", "cancel"],
};

describe("scheduleActivationUi", () => {
  it("shows banner only for draft pending activation", () => {
    expect(resolveActivationBannerSchedule([draft], "draft-1")).toEqual(draft);
    expect(resolveActivationBannerSchedule([scheduled], "sched-1")).toBeNull();
    expect(resolveActivationBannerSchedule([draft], "draft-1", { embedded: true })).toBeNull();
  });

  it("clears pending id after schedule leaves draft", () => {
    expect(syncPendingActivationId([draft], "draft-1")).toBe("draft-1");
    expect(syncPendingActivationId([scheduled], "sched-1")).toBeNull();
  });
});
