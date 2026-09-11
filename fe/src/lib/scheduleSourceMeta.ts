import { dataScreenEditPath } from "@/lib/dataScreenLayout";
import { reportTemplatePath } from "@/pages/admin/reports/components/reportTemplateUi";
import type { ReportScheduleRow } from "@/pages/admin/reports/useReportSchedules";

export function localizeSourceType(sourceType?: string): string {
  if (sourceType === "dashboard") return "看板";
  if (sourceType === "data_screen") return "大屏";
  if (sourceType === "standard") return "标准分析";
  return "模板";
}

export function sourceTypeBadgeColor(
  sourceType?: string,
): "primary" | "success" | "warning" | "error" {
  if (sourceType === "dashboard") return "primary";
  if (sourceType === "data_screen") return "warning";
  return "success";
}

export function scheduleSourceHref(schedule: Pick<ReportScheduleRow, "sourceType" | "sourceId" | "catalogNodeId" | "sourceKey">): string {
  if (schedule.sourceType === "standard" && schedule.sourceKey) {
    return `/admin/reports/standard/setup?pack=${encodeURIComponent(schedule.sourceKey)}`;
  }
  const id = schedule.sourceId ?? schedule.catalogNodeId;
  if (!id) return "/admin/reports/schedules";
  if (schedule.sourceType === "data_screen") {
    return dataScreenEditPath(id);
  }
  if (schedule.sourceType === "dashboard") {
    return `/admin/dashboards/${id}/edit`;
  }
  return reportTemplatePath(id);
}

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  analyst: "分析师",
  viewer: "查看者",
};

export function summarizeRecipients(
  recipients?: { type: string; value: string }[],
): string {
  if (!recipients?.length) return "—";
  const parts = recipients.map((r) => {
    if (r.type === "role") return `角色:${ROLE_LABELS[r.value] ?? r.value}`;
    if (r.type === "user") return `用户:${r.value}`;
    if (r.type === "email") return r.value;
    return r.value;
  });
  if (parts.length <= 2) return parts.join("、");
  return `${parts.slice(0, 2).join("、")} 等 ${parts.length} 项`;
}

export function summarizeDeliveryRecipients(
  deliverySteps?: {
    channel?: string;
    recipients?: string[];
  }[],
): string {
  if (!deliverySteps?.length) return "—";
  const parts: string[] = [];
  for (const step of deliverySteps) {
    if (step.channel === "email") {
      parts.push(...(step.recipients ?? []));
    }
  }
  if (!parts.length) return "—";
  if (parts.length <= 2) return parts.join("、");
  return `${parts.slice(0, 2).join("、")} 等 ${parts.length} 项`;
}

export function formatAttachmentLabels(formats?: string[]): string {
  if (!formats?.length) return "PDF";
  return formats.map((f) => f.toUpperCase()).join(" / ");
}

export const SCHEDULE_CREATE_INTENT = "schedule";

/** 看板列表页带创建定时报告引导 intent */
export function dashboardsListForScheduleCreate(): string {
  return `/admin/dashboards?intent=${SCHEDULE_CREATE_INTENT}`;
}

export type ScheduleTabFilter = "all" | "template" | "dashboard" | "standard";

export function parseScheduleTabParam(raw: string | null): ScheduleTabFilter {
  if (raw === "all" || raw === "template" || raw === "dashboard" || raw === "standard") return raw;
  return "dashboard";
}

export function filterSchedulesByTab<T extends { sourceType?: string }>(
  items: T[],
  tab: ScheduleTabFilter,
): T[] {
  if (tab === "all") return items;
  if (tab === "standard") {
    return items.filter((s) => s.sourceType === "standard");
  }
  if (tab === "template") {
    return items.filter((s) => !s.sourceType || s.sourceType === "template");
  }
  return items.filter((s) => s.sourceType === "dashboard" || s.sourceType === "data_screen");
}

/** 侧栏「查看调度」：切换到能展示该调度源的行所在 Tab */
export function scheduleTabForSourceType(sourceType?: string): ScheduleTabFilter {
  if (sourceType === "standard") return "standard";
  if (sourceType === "dashboard" || sourceType === "data_screen") return "dashboard";
  if (!sourceType || sourceType === "template") return "template";
  return "all";
}
