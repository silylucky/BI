import type { ReportScheduleRow } from "./useReportSchedules";
import { localizeScheduleStatus } from "./useReportSchedules";

export type PackDeliverySummary = {
  label: string;
  tone: "none" | "active" | "draft" | "paused" | "cancelled";
};

export function retentionPeriodsLabel(periods: number | undefined): string {
  const n = periods ?? 12;
  return `保留最近 ${n} 期`;
}

export function summarizePackDelivery(schedules: ReportScheduleRow[] | undefined): PackDeliverySummary {
  const items = schedules ?? [];
  if (items.length === 0) {
    return { label: "定时投递：未配置", tone: "none" };
  }
  const scheduled = items.filter((row) => row.status === "scheduled");
  if (scheduled.length > 0) {
    return {
      label: `定时投递：${scheduled.length} 条已调度`,
      tone: "active",
    };
  }
  const paused = items.filter((row) => row.status === "paused");
  if (paused.length > 0) {
    return {
      label: `定时投递：${paused.length} 条已暂停`,
      tone: "paused",
    };
  }
  const draft = items.filter((row) => row.status === "draft");
  if (draft.length > 0) {
    return {
      label: `定时投递：${draft.length} 条草稿`,
      tone: "draft",
    };
  }
  const cancelled = items.filter((row) => row.status === "cancelled");
  if (cancelled.length > 0) {
    return {
      label: `定时投递：${cancelled.length} 条已取消`,
      tone: "cancelled",
    };
  }
  const status = localizeScheduleStatus(items[0]?.status ?? "");
  return { label: `定时投递：${items.length} 条（${status}）`, tone: "none" };
}

export function groupStandardSchedulesByPackKey(
  schedules: ReportScheduleRow[] | undefined,
): Map<string, ReportScheduleRow[]> {
  const map = new Map<string, ReportScheduleRow[]>();
  for (const row of schedules ?? []) {
    const key = row.sourceKey;
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}
