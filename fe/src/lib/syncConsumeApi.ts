import { apiFetch } from "@/lib/api";

export type ConsumeNextAction = "prepare" | "ensure_dataset" | "open_dashboard";
export type ConsumeLabel = "ready" | "pending_dataset" | "pending_prepare";

export type SyncJobConsumeHints = {
  targetTable: string;
  suggestedDatasetId: string;
  analyticsDatasourceId: string | null;
  analyticsReady: boolean;
  datasetId: string;
  datasetExists: boolean;
  datasetBound: boolean;
  nextAction: ConsumeNextAction;
  consumeLabel: ConsumeLabel;
  etlRulesConfigured?: boolean;
  etlRulesCount?: number;
};

export type SyncJobConsumeStatus = {
  label: ConsumeLabel;
  nextAction: ConsumeNextAction;
};

export async function fetchConsumeHints(jobId: string): Promise<SyncJobConsumeHints> {
  return apiFetch<SyncJobConsumeHints>(`/api/v1/ingestion/sync-jobs/${jobId}/consume-hints`);
}

export async function prepareSyncConsume(jobId: string): Promise<{
  analyticsDatasourceId: string | null;
  analyticsReady: boolean;
  created: boolean;
}> {
  return apiFetch(`/api/v1/ingestion/sync-jobs/${jobId}/prepare-consume`, { method: "POST" });
}

export async function ensureSyncDataset(jobId: string): Promise<{
  datasetId: string;
  boundConfigId: string;
  created: boolean;
  bound: boolean;
}> {
  return apiFetch(`/api/v1/ingestion/sync-jobs/${jobId}/ensure-dataset`, { method: "POST" });
}

export async function refreshSyncDatasetBinding(jobId: string): Promise<{
  datasetId: string;
  boundConfigId: string;
  displayName: string;
  columns: string[];
  refreshed: boolean;
}> {
  return apiFetch(`/api/v1/ingestion/sync-jobs/${jobId}/refresh-dataset-binding`, {
    method: "POST",
  });
}

export function consumeLabelText(label: ConsumeLabel): string {
  if (label === "ready") return "可出图";
  if (label === "pending_dataset") return "待建 Dataset";
  return "待准备";
}

export function consumeLabelColor(label: ConsumeLabel): "success" | "warning" | "light" {
  if (label === "ready") return "success";
  if (label === "pending_dataset") return "warning";
  return "light";
}

export function consumeActionAriaLabel(nextAction: ConsumeNextAction): string {
  if (nextAction === "open_dashboard") return "一键出图";
  if (nextAction === "ensure_dataset") return "去建 Dataset";
  return "准备出图环境";
}

export function consumeActionHref(
  jobId: string,
  nextAction: ConsumeNextAction,
  datasetId?: string | null,
): string {
  if (nextAction === "open_dashboard") {
    return datasetId ? `/admin/datasets/${datasetId}/edit` : "/admin/dashboards";
  }
  return `/admin/ingestion/sync-jobs/${jobId}/history`;
}
