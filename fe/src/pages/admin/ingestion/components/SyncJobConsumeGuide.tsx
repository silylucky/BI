import { BarChart3, Layers, LayoutDashboard, Play, Route, X } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { buildDatasetCreatePath } from "@/lib/syncConsumePaths";
import { cn } from "@/lib/utils";

type SyncJobConsumeGuideProps = {
  jobId?: string;
  /** 任务显示名；有则标题会标明是哪条任务 */
  jobName?: string;
  targetTable: string;
  rowsSynced?: number | null;
  analyticsDatasourceId?: string | null;
  /** after_success：刚跑成功；how_to：编辑页出图指引 */
  variant?: "after_success" | "how_to";
  /** 刚从新建页跳转而来，强调先运行 */
  justCreated?: boolean;
  syncMode?: "full" | "incremental";
  onDismiss?: () => void;
  className?: string;
};

const HOW_TO_STEPS = [
  {
    step: 1,
    title: "运行同步",
    description: "在本页点击页顶「立即运行」，将源表数据写入托管分析库。",
    icon: Play,
  },
  {
    step: 2,
    title: "创建 Dataset",
    description: "运行成功后，点击「一键创建 Dataset 并绑定」，锁定同步产出表。",
    icon: Layers,
  },
  {
    step: 3,
    title: "配置看板",
    description: "进入仪表板，选择该 Dataset 拖字段出图。",
    icon: LayoutDashboard,
  },
] as const;

export function SyncJobConsumeGuide({
  jobId,
  jobName,
  targetTable,
  rowsSynced,
  analyticsDatasourceId,
  variant = "after_success",
  justCreated = false,
  syncMode = "full",
  onDismiss,
  className,
}: SyncJobConsumeGuideProps) {
  const datasetCreatePath = buildDatasetCreatePath({
    targetTable,
    suggestedDatasetId: targetTable,
    dataSourceId: analyticsDatasourceId ?? undefined,
  });
  const historyPath = jobId ? `/admin/ingestion/sync-jobs/${jobId}/history` : null;

  if (variant === "how_to") {
    return (
      <div
        role="region"
        aria-labelledby="sync-consume-howto-title"
        className={cn(
          "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]",
          className,
        )}
      >
        <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-400" />

        <div className="p-5 lg:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30">
                <Route className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3
                  id="sync-consume-howto-title"
                  className="text-theme-base font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                  {justCreated ? "任务已创建 · 下一步请运行同步" : "下一步：运行同步并出图"}
                </h3>
                <p className="mt-1 text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  目标表
                  <span className="font-mono text-theme-xs"> {targetTable}</span>
                  对应 Dataset ID
                  <span className="font-mono text-theme-xs"> {targetTable}</span>
                  ，写入托管分析库
                  <span className="font-mono text-theme-xs"> 5433/analytics</span>
                  。须先运行同步才有表与数据。
                  {justCreated ? " 配置已保存，请按下方步骤继续。" : runModeHint(syncMode)}
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

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {HOW_TO_STEPS.map(({ step, title, description, icon: Icon }) => (
              <div
                key={step}
                className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-theme-xs font-semibold text-white">
                    {step}
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white text-gray-600 shadow-theme-xs dark:bg-gray-900 dark:text-gray-300">
                    <Icon className="size-4" aria-hidden />
                  </span>
                </div>
                <h4 className="mt-3 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                  {title}
                </h4>
                <p className="mt-1 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200/80 pt-5 dark:border-gray-800">
            {historyPath ? (
              <Button asChild variant="outline" size="sm">
                <Link to={historyPath}>运行历史</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/ingestion/sync-jobs">返回列表</Link>
            </Button>
          </div>

          <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.02]">
            <summary className="cursor-pointer text-theme-xs font-medium text-gray-600 dark:text-gray-400">
              高级：手动登记分析库并创建 Dataset
            </summary>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-theme-xs text-gray-500 dark:text-gray-400">
              <li>
                在
                <Link
                  to="/admin/datasources/new"
                  className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                >
                  连接管理
                </Link>
                登记 PostgreSQL（
                <span className="font-mono">127.0.0.1:5433/analytics</span>）。
              </li>
              <li>
                <Link
                  to={datasetCreatePath}
                  className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                >
                  手动创建数据集（高级）
                </Link>
                并勾选表
                <span className="font-mono"> {targetTable}</span>（须在同步成功后）。
              </li>
            </ol>
          </details>
        </div>
      </div>
    );
  }

  const title = jobName
    ? `任务「${jobName}」同步成功 · 下一步出图`
    : "同步成功 · 下一步出图";

  return (
    <div
      role="region"
      aria-labelledby="sync-consume-after-title"
      className={cn(
        "overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/70 via-white to-white shadow-theme-xs dark:border-brand-500/20 dark:from-brand-500/10 dark:via-white/[0.02] dark:to-white/[0.02]",
        className,
      )}
    >
      <div className="h-1 bg-gradient-to-r from-brand-500 to-success-500" />

      <div className="p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30">
              <BarChart3 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3
                id="sync-consume-after-title"
                className="text-theme-base font-semibold tracking-tight text-gray-900 dark:text-white"
              >
                {title}
              </h3>
              <p className="mt-1 text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {jobName ? (
                  <>
                    任务
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      「{jobName}」
                    </span>
                    已将数据写入
                  </>
                ) : (
                  "已将数据写入"
                )}
                托管分析库
                <span className="font-mono text-theme-xs"> localhost:5433/analytics</span>
                的表
                <span className="font-mono text-theme-xs"> {targetTable}</span>
                {rowsSynced != null ? `（本次 ${rowsSynced} 行）` : ""}
                。推荐使用下方「一键创建数据集并绑定」出图。
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

        <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200/80 pt-5 dark:border-gray-800">
          <Button asChild variant="outline" size="sm">
            <Link to={datasetCreatePath}>手动创建数据集（高级）</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/dashboards">打开仪表板</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function runModeHint(syncMode: "full" | "incremental"): string {
  return syncMode === "incremental"
    ? " 增量任务 upsert，不清空目标表。"
    : " 全量任务会覆盖目标表已有数据。";
}
