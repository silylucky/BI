import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AnalysisPack, AnalysisTheme, SnapshotRecord } from "../useStandardAnalysis";
import { useReportSchedulesList } from "../useReportSchedules";
import { standardScheduleHubPath } from "../standardRoutes";
import {
  retentionPeriodsLabel,
  summarizePackDelivery,
} from "../standardAnalysisDeliverySummary";
import {
  latestSnapshotForTheme,
  SNAPSHOT_SCHEDULE_HINT,
  snapshotPresetLabel,
  themeAggregationHint,
} from "./standardAnalysisCompareUi";
import { THEME_META } from "./standardAnalysisUi";
import { cn } from "@/lib/utils";

type CompareSummary = {
  currentPeriodKey?: string;
  previousPeriodKey?: string | null;
};

type Props = {
  pack: AnalysisPack;
  activeTheme: AnalysisTheme;
  snapshots?: SnapshotRecord[];
  viewMode: "live" | "compare";
  canManage: boolean;
  compareSummary?: CompareSummary;
};

function formatLatestSnapshot(latest: SnapshotRecord | undefined): string {
  if (!latest) return "暂无（保存后可对比）";
  return `${latest.periodKey} · ${new Date(latest.capturedAt).toLocaleString()}`;
}

export function StandardAnalysisSnapshotStrip({
  pack,
  activeTheme,
  snapshots,
  viewMode,
  canManage,
  compareSummary,
}: Props) {
  const latest = latestSnapshotForTheme(snapshots, activeTheme);
  const scheduleHint = SNAPSHOT_SCHEDULE_HINT[pack.snapshotCronPreset];
  const snapshotLabel = snapshotPresetLabel(pack.snapshotCronPreset);
  const themeLabel = THEME_META[activeTheme]?.label ?? activeTheme;
  const calibrationHint = themeAggregationHint(pack, activeTheme);
  const retentionLabel = retentionPeriodsLabel(pack.snapshotRetentionPeriods);

  const schedulesQuery = useReportSchedulesList({
    sourceType: "standard",
    sourceKey: pack.packKey,
  });
  const delivery = summarizePackDelivery(schedulesQuery.data?.items);

  return (
    <div
      className="shrink-0 border-b border-gray-200 dark:border-gray-800"
      data-testid="standard-analysis-observability-strip"
    >
      <div
        className="grid gap-2 px-5 py-2.5 text-theme-xs text-gray-600 sm:grid-cols-2 dark:text-gray-400"
        data-testid="standard-analysis-observability-compact"
      >
        {viewMode === "compare" ? (
          <>
            <p className="min-w-0">
              <span className="font-medium text-gray-700 dark:text-gray-300">对比期</span>
              {compareSummary?.previousPeriodKey
                ? ` ${compareSummary.previousPeriodKey}`
                : " 尚未生成"}
            </p>
            <p className="min-w-0">
              <span className="font-medium text-gray-700 dark:text-gray-300">最近快照</span>
              {` ${formatLatestSnapshot(latest)}`}
            </p>
          </>
        ) : (
          <p className="min-w-0 sm:col-span-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">最近快照</span>
            {` ${formatLatestSnapshot(latest)}`}
          </p>
        )}
      </div>

      <Collapsible defaultOpen={false} className="group border-t border-gray-100 dark:border-white/[0.06]">
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 px-5 py-2 text-left text-theme-xs text-gray-500",
            "hover:bg-gray-50/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
            "dark:text-gray-400 dark:hover:bg-white/[0.03]",
          )}
          data-testid="standard-analysis-ops-toggle"
        >
          <ChevronRight
            className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90"
            aria-hidden
          />
          运维与口径详情
        </CollapsibleTrigger>
        <CollapsibleContent
          className="space-y-1 px-5 pb-2.5 text-theme-xs text-gray-600 dark:text-gray-400"
          data-testid="standard-analysis-ops-detail"
        >
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">口径</span>
            ：{themeLabel} · {calibrationHint}
          </p>
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">快照节奏</span>
            ：{snapshotLabel}，{scheduleHint}；{retentionLabel}
          </p>
          <p data-testid="standard-analysis-delivery-summary">
            <span className="font-medium text-gray-700 dark:text-gray-300">投递</span>
            ：{delivery.label.replace(/^定时投递：/, "")}
            {delivery.tone === "none" && canManage ? (
              <>
                {" "}
                <Link
                  to={standardScheduleHubPath(pack.packKey)}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  去配置
                </Link>
              </>
            ) : null}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
