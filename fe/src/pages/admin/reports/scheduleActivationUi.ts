import type { ReportScheduleRow } from "./useReportSchedules";

/** 仅草稿且非嵌入弹窗时展示顶部激活横幅（嵌入态用操作栏「激活」即可）。 */
export function resolveActivationBannerSchedule(
  schedules: ReportScheduleRow[],
  pendingActivateId: string | null,
  options?: { embedded?: boolean },
): ReportScheduleRow | null {
  if (options?.embedded || !pendingActivateId) return null;
  const row = schedules.find((schedule) => schedule.id === pendingActivateId);
  if (!row || row.status !== "draft") return null;
  return row;
}

/** 列表刷新后：已非草稿则清除待激活标记。 */
export function syncPendingActivationId(
  schedules: ReportScheduleRow[],
  pendingActivateId: string | null,
): string | null {
  if (!pendingActivateId) return null;
  const row = schedules.find((schedule) => schedule.id === pendingActivateId);
  return row?.status === "draft" ? pendingActivateId : null;
}
