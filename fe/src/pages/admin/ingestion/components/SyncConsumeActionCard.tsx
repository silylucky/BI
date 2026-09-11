import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Database,
  LayoutDashboard,
  Layers,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mapApiError } from "@/lib/apiError";
import {
  consumeLabelColor,
  consumeLabelText,
  ensureSyncDataset,
  fetchConsumeHints,
  prepareSyncConsume,
  refreshSyncDatasetBinding,
  type ConsumeNextAction,
  type SyncJobConsumeHints,
} from "@/lib/syncConsumeApi";
import { cn } from "@/lib/utils";

type SyncConsumeActionCardProps = {
  jobId: string;
  jobName?: string;
  targetTable: string;
  rowsSynced?: number | null;
  consumeWarning?: string | null;
  /** 其他写入同一 target_table 的任务名（用于共用 Dataset 提示） */
  sharedTargetJobNames?: string[];
  canManage?: boolean;
  onDismiss?: () => void;
  onUpdated?: () => void;
  className?: string;
};

type PipelineStepState = "done" | "current" | "pending";

function StatTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90",
          mono && "font-mono text-theme-xs font-medium",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PipelineStep({
  label,
  state,
  icon: Icon,
}: {
  label: string;
  state: PipelineStepState;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
          state === "done" &&
            "bg-success-50 text-success-600 ring-success-200 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20",
          state === "current" &&
            "bg-brand-50 text-brand-600 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30",
          state === "pending" &&
            "bg-gray-50 text-gray-400 ring-gray-200 dark:bg-white/[0.02] dark:text-gray-500 dark:ring-gray-800",
        )}
      >
        {state === "done" ? (
          <CheckCircle2 className="size-4" aria-hidden />
        ) : (
          <Icon className="size-4" aria-hidden />
        )}
      </span>
      <span
        className={cn(
          "truncate text-theme-xs font-medium",
          state === "done" && "text-success-700 dark:text-success-500",
          state === "current" && "text-brand-700 dark:text-brand-400",
          state === "pending" && "text-gray-500 dark:text-gray-400",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function pipelineState(
  step: "sync" | "dataset" | "dashboard",
  nextAction: ConsumeNextAction | undefined,
): PipelineStepState {
  if (step === "sync") return "done";
  if (step === "dataset") {
    if (nextAction === "open_dashboard") return "done";
    if (nextAction === "ensure_dataset" || nextAction === "prepare") return "current";
    return "pending";
  }
  if (nextAction === "open_dashboard") return "current";
  return "pending";
}

export function SyncConsumeActionCard({
  jobId,
  jobName,
  targetTable,
  rowsSynced,
  consumeWarning,
  sharedTargetJobNames = [],
  canManage = false,
  onDismiss,
  onUpdated,
  className,
}: SyncConsumeActionCardProps) {
  const [hints, setHints] = useState<SyncJobConsumeHints | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHints = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchConsumeHints(jobId);
      setHints(data);
      return data;
    } catch (err) {
      setError(mapApiError(err));
      return null;
    }
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await refreshHints();
      if (cancelled || !data) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (canManage && data.nextAction === "prepare") {
        setPreparing(true);
        try {
          await prepareSyncConsume(jobId);
          const next = await refreshHints();
          if (!cancelled && next?.analyticsReady) {
            onUpdated?.();
          }
        } catch (err) {
          if (!cancelled) setError(mapApiError(err));
        } finally {
          if (!cancelled) setPreparing(false);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, canManage, refreshHints, onUpdated]);

  const handleEnsureDataset = async () => {
    setEnsuring(true);
    setError(null);
    try {
      const result = await ensureSyncDataset(jobId);
      await refreshHints();
      onUpdated?.();
      toast.success(
        result.created
          ? `数据集「${result.datasetId}」已创建并绑定`
          : `数据集「${result.datasetId}」已绑定查询配置`,
      );
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setEnsuring(false);
    }
  };

  const handleRefreshBinding = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const result = await refreshSyncDatasetBinding(jobId);
      await refreshHints();
      onUpdated?.();
      toast.success(`已刷新 Dataset「${result.displayName}」绑定列（${result.columns.length} 列）`);
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  };

  const hasWarning = Boolean(consumeWarning);
  const title = jobName
    ? `任务「${jobName}」${hasWarning ? "同步完成（有警告）" : "同步成功"} · 下一步出图`
    : hasWarning
      ? "同步完成（有警告）· 下一步出图"
      : "同步成功 · 下一步出图";
  const busy = loading || preparing || ensuring || refreshing;
  const consumeLabel = hints?.consumeLabel;

  return (
    <div
      role="region"
      aria-labelledby="sync-consume-title"
      className={cn(
        "overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/70 via-white to-white shadow-theme-xs dark:border-brand-500/20 dark:from-brand-500/10 dark:via-white/[0.02] dark:to-white/[0.02]",
        className,
      )}
    >
      <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-success-500" />

      <div className="p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-500/10 text-success-600 ring-1 ring-success-500/20 dark:bg-success-500/15 dark:text-success-500">
              <CheckCircle2 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3
                id="sync-consume-title"
                className="text-theme-base font-semibold tracking-tight text-gray-900 dark:text-white"
              >
                {title}
              </h3>
              <p className="mt-1 text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">
                数据已写入托管分析库表
                <span className="font-mono text-theme-xs"> {targetTable}</span>
                {rowsSynced != null ? `（本次 ${rowsSynced} 行）` : ""}
                。系统会自动登记分析库，按下方步骤完成 Dataset 与看板配置即可出图。
              </p>
            </div>
          </div>
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400"
              aria-label="关闭引导"
              onClick={onDismiss}
            >
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatTile label="目标表" value={targetTable} mono />
          <StatTile
            label="本次同步"
            value={rowsSynced != null ? `${rowsSynced} 行` : "—"}
          />
          <StatTile
            label="出图状态"
            value={
              consumeLabel ? (
                <Badge variant="light" color={consumeLabelColor(consumeLabel)} size="sm">
                  {consumeLabelText(consumeLabel)}
                </Badge>
              ) : busy ? (
                <span className="inline-flex items-center gap-1.5 text-theme-xs font-normal text-gray-500">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  加载中…
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-gray-200/80 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <PipelineStep
            label="同步入库"
            state={pipelineState("sync", hints?.nextAction)}
            icon={Database}
          />
          <span className="hidden h-px w-4 shrink-0 bg-gray-300 sm:block dark:bg-gray-700" aria-hidden />
          <PipelineStep
            label="创建 Dataset"
            state={pipelineState("dataset", hints?.nextAction)}
            icon={Layers}
          />
          <span className="hidden h-px w-4 shrink-0 bg-gray-300 sm:block dark:bg-gray-700" aria-hidden />
          <PipelineStep
            label="配置看板"
            state={pipelineState("dashboard", hints?.nextAction)}
            icon={LayoutDashboard}
          />
        </div>

        {sharedTargetJobNames.length > 0 ? (
          <p className="mt-4 rounded-lg border border-warning-200 bg-warning-50/80 px-3 py-2 text-theme-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
            检测到 {sharedTargetJobNames.length} 个历史任务也写入
            <span className="font-mono"> {targetTable}</span>
            （{sharedTargetJobNames.slice(0, 3).join("、")}
            {sharedTargetJobNames.length > 3 ? "…" : ""}）。新建任务已禁止共表；建议迁移到独立目标表名。
          </p>
        ) : null}

        {hints && hints.etlRulesConfigured !== false ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="light" color="primary" size="sm" className="gap-1">
              <Sparkles className="size-3" aria-hidden />
              {(hints.etlRulesCount ?? 0) > 0
                ? `已应用 ${hints.etlRulesCount} 条清洗规则`
                : "未识别到额外规则，同步时仍会自动清洗"}
            </Badge>
            <Link
              to={`/admin/ingestion/sync-jobs/${jobId}/etl-rules`}
              className="text-theme-xs text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
            >
              {(hints.etlRulesCount ?? 0) > 0 ? "查看或调整" : "手动添加规则"}
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-error-200 bg-error-50/80 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
            {error}
          </p>
        ) : null}

        {consumeWarning ? (
          <p className="mt-4 rounded-lg border border-warning-200 bg-warning-50/80 px-3 py-2 text-theme-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
            {consumeWarning}
          </p>
        ) : null}

        {busy && !hints ? (
          <div className="mt-4 flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            正在准备分析库…
          </div>
        ) : null}

        {hints?.nextAction === "ensure_dataset" && canManage ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200/80 pt-5 dark:border-gray-800">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              loading={ensuring}
              onClick={() => void handleEnsureDataset()}
            >
              一键创建数据集并绑定
            </Button>
          </div>
        ) : null}

        {hints?.nextAction === "open_dashboard" ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200/80 pt-5 dark:border-gray-800">
            <Button asChild variant="primary" size="sm">
              <Link to="/admin/dashboards">创建看板</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/datasets/${hints.datasetId}/edit`}>
                <Layers className="size-4" aria-hidden />
                查看数据集
              </Link>
            </Button>
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                loading={refreshing}
                onClick={() => void handleRefreshBinding()}
              >
                刷新绑定列
              </Button>
            ) : null}
          </div>
        ) : null}

        {hints?.nextAction === "prepare" && !canManage ? (
          <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
            分析库尚未就绪，请联系管理员完成托管分析库配置。
          </p>
        ) : null}

        <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2 text-theme-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
          <summary className="cursor-pointer select-none font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            高级：手动登记分析库
          </summary>
          <p className="mt-2 leading-relaxed">
            通常无需手动操作。若需覆盖连接，可前往
            <Link
              to="/admin/datasources/new"
              className="mx-1 text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
            >
              连接管理
            </Link>
            登记 PostgreSQL 分析库（端口 5433，库 analytics）。
          </p>
        </details>
      </div>
    </div>
  );
}
