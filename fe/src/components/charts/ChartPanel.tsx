import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type ChartPanelProps = {
  title: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  slowHint?: boolean;
  truncatedHint?: boolean;
  children: ReactNode;
};

export function ChartPanel({
  title,
  loading,
  error,
  empty,
  onRetry,
  slowHint = false,
  truncatedHint = false,
  children,
}: ChartPanelProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="mb-3 truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">
        {title}
      </h3>
      {loading ? (
        <div>
          <Skeleton
            className="min-h-[180px] w-full rounded-lg"
            aria-busy="true"
            aria-label="图表加载中"
          />
          {slowHint ? (
            <p className="mt-2 text-theme-xs text-gray-500">查询较慢，请稍候…</p>
          ) : null}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-error-500 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/15"
        >
          <p className="text-theme-sm text-error-700 dark:text-error-400">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
        </div>
      ) : empty ? (
        <PanelEmptyState
          icon={<BarChart3 className="size-6" aria-hidden />}
          title="暂无数据"
          description="当前查询未返回结果，请调整筛选条件或 SQL 后重试。"
          size="sm"
          tone="neutral"
          className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800"
        />
      ) : (
        <>
          {truncatedHint ? (
            <p className="mb-2 text-theme-xs text-warning-600 dark:text-warning-400">
              查询结果已截断，图表仅展示部分数据。请缩小筛选范围或提高查询上限。
            </p>
          ) : null}
          {children}
        </>
      )}
    </div>
  );
}
