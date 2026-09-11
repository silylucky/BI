import { Link } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";
import type { ReportScheduleRow } from "../useReportSchedules";
import type { AnalysisPack } from "../useStandardAnalysis";
import { standardScheduleHubPath } from "../standardRoutes";
import { SNAPSHOT_LABELS } from "./standardAnalysisUi";
import { summarizePackDelivery } from "../standardAnalysisDeliverySummary";
import { cn } from "@/lib/utils";

type Props = {
  packs: AnalysisPack[];
  activePackKey: string | null;
  isLoading?: boolean;
  onSelect: (packKey: string) => void;
  headerAction?: ReactNode;
  emptyHint?: string;
  deliveryByPackKey?: Map<string, ReportScheduleRow[]>;
};

export function StandardAnalysisPackList({
  packs,
  activePackKey,
  isLoading,
  onSelect,
  headerAction,
  emptyHint = "暂无分析包",
  deliveryByPackKey,
}: Props) {
  return (
    <aside className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden border-b border-gray-200 bg-gray-50/40 xl:border-b-0 xl:border-r dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="min-w-0 flex-1">
          <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">分析包</h2>
          <p className="mt-0.5 text-theme-xs break-words text-gray-500 dark:text-gray-400">
            选择业务对象分析范围
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isLoading ? (
            <Badge variant="light" color="light" size="sm" className="tabular-nums">
              {packs.length}
            </Badge>
          ) : null}
          {headerAction}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-1.5 p-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-16 w-full rounded-xl" />
                </li>
              ))
            : packs.length === 0
              ? (
                  <li className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    {emptyHint}
                  </li>
                )
              : packs.map((pack) => {
                const active = pack.packKey === activePackKey;
                const snapshotLabel = SNAPSHOT_LABELS[pack.snapshotCronPreset] ?? pack.snapshotCronPreset;
                const delivery = summarizePackDelivery(deliveryByPackKey?.get(pack.packKey));
                const dataLabel = pack.datasetId ? "数据集" : "未绑定";

                return (
                  <li key={pack.packKey}>
                    <div
                      className={cn(
                        "rounded-xl border transition-colors",
                        active
                          ? "border-brand-200 bg-white shadow-theme-xs dark:border-brand-500/30 dark:bg-white/[0.04]"
                          : "border-transparent bg-white/70 hover:border-gray-200 hover:bg-white dark:bg-transparent dark:hover:border-gray-800 dark:hover:bg-white/[0.03]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(pack.packKey)}
                        aria-current={active ? "true" : undefined}
                        className="w-full px-3 py-2.5 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "min-w-0 truncate text-theme-sm font-medium",
                              active ? "text-gray-900 dark:text-white" : "text-gray-800 dark:text-white/90",
                            )}
                          >
                            {pack.displayName}
                          </span>
                          {active ? (
                            <Badge variant="light" color="primary" size="sm" className="shrink-0">
                              当前
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="light" color="light" size="sm">
                            {dataLabel}
                          </Badge>
                          <Badge variant="light" color="info" size="sm">
                            {snapshotLabel}
                          </Badge>
                        </div>
                      </button>
                      <div className="px-3 pb-2.5 pt-0">
                        <Link
                          to={standardScheduleHubPath(pack.packKey)}
                          data-testid="standard-analysis-pack-delivery"
                          className="inline-flex max-w-full"
                        >
                          <Badge
                            variant="light"
                            color={
                              delivery.tone === "active"
                                ? "success"
                                : delivery.tone === "draft"
                                  ? "warning"
                                  : "light"
                            }
                            size="sm"
                            className="truncate hover:opacity-90"
                          >
                            {delivery.label.replace(/^定时投递：/, "投递：")}
                          </Badge>
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
        </ul>
      </ScrollArea>
    </aside>
  );
}
