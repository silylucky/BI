import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import {
  isSyncRunActive,
  isSyncRunSucceeded,
  syncRunCompletionToast,
  type SyncJobListResponse,
  type SyncRunSuccessPayload,
} from "@/pages/admin/ingestion/components/sync-job-types";

export type SyncRunSuccess = SyncRunSuccessPayload;

type UseSyncJobRunOptions = {
  onSuccess?: (payload: SyncRunSuccess) => void;
};

export function useSyncJobRun(options: UseSyncJobRunOptions = {}) {
  const navigate = useNavigate();
  const onSuccessRef = useRef(options.onSuccess);
  onSuccessRef.current = options.onSuccess;
  const pollTimerRef = useRef<number | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startRunPolling = useCallback(
    (jobId: string, jobName: string) => {
      stopPolling();
      setPollingJobId(jobId);
      const pollIntervalMs = 2000;
      const pollMaxTicks = 30;
      let ticks = 0;

      const finishPolling = () => {
        stopPolling();
        setPollingJobId((current) => (current === jobId ? null : current));
      };

      const pollOnce = async () => {
        ticks += 1;
        try {
          const data = await apiFetch<SyncJobListResponse>("/api/v1/ingestion/sync-jobs");
          const job = data.items.find((item) => item.id === jobId);
          const status = job?.last_run?.status;
          if (isSyncRunSucceeded(status) && job) {
            finishPolling();
            const payload: SyncRunSuccess = {
              jobId: job.id,
              jobName: job.name,
              targetTable: job.target_table,
              rowsSynced: job.last_run?.rows_synced ?? null,
              consumeWarning: job.last_run?.consume_warning ?? null,
            };
            onSuccessRef.current?.(payload);
            const message = syncRunCompletionToast(jobName, payload, status);
            const hasWarning = status === "succeeded_with_warnings" || Boolean(payload.consumeWarning);
            if (hasWarning) {
              toast.warning(message, { duration: 10_000 });
            } else {
              toast.success(message, { duration: 8000 });
            }
            return;
          }
          if (status === "failed") {
            finishPolling();
            toast.error(`任务「${jobName}」同步失败，请查看运行历史`);
            return;
          }
          if (status === "cancelled") {
            finishPolling();
            toast.message(`任务「${jobName}」已停止`);
            return;
          }
          if (ticks >= pollMaxTicks) {
            finishPolling();
            if (isSyncRunActive(status)) {
              toast.warning(`任务「${jobName}」仍在运行中，请稍后刷新或查看运行历史`, {
                duration: 10_000,
                action: {
                  label: "查看历史",
                  onClick: () => navigate(`/admin/ingestion/sync-jobs/${jobId}/history`),
                },
              });
            }
          }
        } catch {
          /* 轮询失败忽略 */
        }
      };

      void pollOnce();
      pollTimerRef.current = window.setInterval(() => {
        void pollOnce();
      }, pollIntervalMs);
    },
    [navigate, stopPolling],
  );

  const cancelJob = useCallback(
    async (job: { id: string; name: string }) => {
      setCancellingId(job.id);
      try {
        await apiFetch(`/api/v1/ingestion/sync-jobs/${job.id}/cancel`, { method: "POST" });
        toast.message(`已请求停止「${job.name}」`, {
          description: "将在当前阶段结束后停止。",
        });
        if (pollingJobId !== job.id) {
          startRunPolling(job.id, job.name);
        }
        return true;
      } catch (err) {
        const message = mapApiError(err);
        setRunError(message);
        toast.error(message);
        return false;
      } finally {
        setCancellingId(null);
      }
    },
    [pollingJobId, startRunPolling],
  );

  const runJob = useCallback(
    async (job: { id: string; name: string }) => {
      setRunError(null);
      setRunningId(job.id);
      try {
        await apiFetch(`/api/v1/ingestion/sync-jobs/${job.id}/run`, { method: "POST" });
        toast.success(`任务「${job.name}」已开始同步`, {
          action: {
            label: "查看历史",
            onClick: () => navigate(`/admin/ingestion/sync-jobs/${job.id}/history`),
          },
        });
        startRunPolling(job.id, job.name);
        return true;
      } catch (err) {
        const message = mapApiError(err);
        setRunError(message);
        toast.error(message);
        return false;
      } finally {
        setRunningId(null);
      }
    },
    [navigate, startRunPolling],
  );

  return {
    runJob,
    cancelJob,
    runningId,
    pollingJobId,
    cancellingId,
    runError,
    clearRunError: () => setRunError(null),
  };
}
