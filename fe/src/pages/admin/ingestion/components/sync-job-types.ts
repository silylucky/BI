import type { SourceHealth } from "@/lib/sourceHealth";

export type SyncJobLastRun = {
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_synced: number | null;
  rows_truncated?: boolean;
  consume_warning?: string | null;
  error_message: string | null;
};

export type SyncJobConsumeStatus = {
  label: "ready" | "pending_dataset" | "pending_prepare";
  next_action: "prepare" | "ensure_dataset" | "open_dashboard";
};

export type SyncJobSummary = {
  id: string;
  name: string;
  source_type: string;
  source_database?: string | null;
  source_label?: string | null;
  source_data_source_id?: string | null;
  sync_mode?: string;
  target_table: string;
  enabled: boolean;
  schedule_cron: string | null;
  last_run?: SyncJobLastRun | null;
  consume_status?: SyncJobConsumeStatus | null;
  source_health?: SourceHealth | null;
};

export type SyncJobListResponse = {
  items: SyncJobSummary[];
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  sqlserver: "SQL Server",
  oracle: "Oracle",
};

export function sourceTypeLabel(type: string) {
  return SOURCE_TYPE_LABELS[type.toLowerCase()] ?? type;
}

export function syncModeLabel(mode: string | undefined) {
  if (mode === "incremental") return "增量";
  return "全量";
}

export function sourceSummaryLabel(job: Pick<SyncJobSummary, "source_type" | "source_database" | "source_label">) {
  if (job.source_label) return job.source_label;
  const type = sourceTypeLabel(job.source_type);
  if (job.source_database) return `${type} · ${job.source_database}`;
  return type;
}

export type SyncRunSuccessPayload = {
  jobId: string;
  jobName: string;
  targetTable: string;
  rowsSynced: number | null;
  consumeWarning?: string | null;
};

export function isSyncRunSucceeded(status: string | undefined | null) {
  return status === "succeeded" || status === "succeeded_with_warnings";
}

export function syncRunCompletionHeadline(hasWarning: boolean) {
  return hasWarning ? "同步完成（有警告）" : "同步成功";
}

export function syncRunSuccessFromJob(job: SyncJobSummary): SyncRunSuccessPayload | null {
  if (!isSyncRunSucceeded(job.last_run?.status)) {
    return null;
  }
  return {
    jobId: job.id,
    jobName: job.name,
    targetTable: job.target_table,
    rowsSynced: job.last_run?.rows_synced ?? null,
    consumeWarning: job.last_run?.consume_warning ?? null,
  };
}

export function syncRunCompletionToast(
  jobName: string,
  payload: Pick<SyncRunSuccessPayload, "rowsSynced" | "consumeWarning">,
  status: string | undefined | null,
) {
  const hasWarning = status === "succeeded_with_warnings" || Boolean(payload.consumeWarning);
  const headline = syncRunCompletionHeadline(hasWarning);
  const rowsPart = payload.rowsSynced != null ? `，写入 ${payload.rowsSynced} 行` : "";
  const warningPart = payload.consumeWarning ? `：${payload.consumeWarning}` : "";
  return `任务「${jobName}」${headline}${rowsPart}${warningPart}`;
}

export function lastRunStatusLabel(status: string) {
  if (status === "succeeded_with_warnings") return "成功（有警告）";
  if (status === "succeeded") return "成功";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  if (status === "cancelling") return "停止中";
  if (status === "cancelled") return "已停止";
  return status;
}

export function lastRunBadgeColor(status: string): "success" | "error" | "warning" | "light" {
  if (status === "succeeded_with_warnings") return "warning";
  if (status === "succeeded") return "success";
  if (status === "failed") return "error";
  if (status === "running" || status === "cancelling") return "warning";
  if (status === "cancelled") return "light";
  return "light";
}

export function isSyncRunActive(status: string | undefined | null) {
  return status === "running" || status === "cancelling";
}

export const CRON_PRESETS = [
  { label: "每天 02:00", value: "0 2 * * *" },
  { label: "每天 06:00", value: "0 6 * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每周一 02:00", value: "0 2 * * 1" },
] as const;
