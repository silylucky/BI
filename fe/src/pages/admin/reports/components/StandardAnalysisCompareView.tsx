import { useEffect, useState } from "react";
import { Camera, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, ListPageFooter, ListPageTableFrame } from "@/components/layout/list-page-kit";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { cn } from "@/lib/utils";
import { STANDARD_ANALYSIS_CONTENT_PAD_CLASS } from "./standardAnalysisConfigUi";
import type { AnalysisPack, AnalysisTheme, CompareResult } from "../useStandardAnalysis";
import type { PresentationMode } from "../standardAnalysisPrefs";
import {
  defaultComparePresentationMode,
  readStoredCompareViewMode,
  writeStoredCompareViewMode,
} from "../standardAnalysisComparePresentation";
import {
  compareDeltaClassName,
  formatCompareDelta,
  THEME_META,
} from "./standardAnalysisUi";
import {
  formatCompareDeltaPct,
  hasPreviousSnapshot,
} from "./standardAnalysisCompareUi";
import {
  STANDARD_COMPARE_TABLE_MAX_HEIGHT,
  standardCompareTableScrollHint,
} from "./standardAnalysisTableUi";
import { StandardAnalysisCompareChart } from "./StandardAnalysisCompareChart";
import { StandardAnalysisPresentationToggle } from "./StandardAnalysisPresentationToggle";

type Props = {
  pack: AnalysisPack;
  activeTheme: AnalysisTheme;
  compareData?: CompareResult;
  snapshots?: Array<{ theme: AnalysisTheme; periodKey: string; capturedAt: string }>;
  isLoading: boolean;
  canManage: boolean;
  capturePending: boolean;
  onCapturePreviousBaseline: () => void;
};

function CompareSemanticsBanner({
  activeTheme,
  compareData,
}: {
  activeTheme: AnalysisTheme;
  compareData: CompareResult;
}) {
  const themeLabel = THEME_META[activeTheme]?.label ?? activeTheme;

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-theme-xs font-medium text-gray-800 dark:text-white/90">{themeLabel} · 周期对比</p>
      <ul className="space-y-1 text-theme-xs text-gray-600 dark:text-gray-400">
        <li>
          <span className="font-medium text-gray-700 dark:text-gray-300">本期</span>
          ：{compareData.currentSource === "snapshot" ? "历史快照" : "当前实时查询"}（周期键 {compareData.currentPeriodKey}）
        </li>
        <li>
          <span className="font-medium text-gray-700 dark:text-gray-300">对比期</span>
          ：历史快照
          {compareData.previousPeriodKey ? `（${compareData.previousPeriodKey}）` : "（尚未生成）"}
        </li>
      </ul>
    </div>
  );
}

function NoPreviousSnapshotState({
  pack,
  previousPeriodKey,
  canManage,
  capturePending,
  onCapturePreviousBaseline,
}: {
  pack: AnalysisPack;
  previousPeriodKey?: string | null;
  canManage: boolean;
  capturePending: boolean;
  onCapturePreviousBaseline: () => void;
}) {
  return (
    <PanelEmptyState
      icon={<Timer className="size-6" aria-hidden />}
      title="对比期快照缺失"
      description={
        previousPeriodKey
          ? `所选对比周期（${previousPeriodKey}）尚无快照。可点击下方按钮，用当前查询结果写入该期基准后立即查看增减。`
          : `所选对比周期尚无快照，请先保存对应周期的基准快照。`
      }
      action={
        canManage && previousPeriodKey ? (
          <Button type="button" size="sm" disabled={capturePending} onClick={onCapturePreviousBaseline}>
            <Camera className="size-4" aria-hidden />
            {capturePending ? "保存中…" : "保存上期基准快照"}
          </Button>
        ) : undefined
      }
      size="md"
      variant="framed"
    />
  );
}

export function StandardAnalysisCompareView({
  pack,
  activeTheme,
  compareData,
  snapshots,
  isLoading,
  canManage,
  capturePending,
  onCapturePreviousBaseline,
}: Props) {
  const ready = compareData && hasPreviousSnapshot(compareData);
  const deltaRows = compareData?.deltas ?? [];
  const scrollHint = standardCompareTableScrollHint(deltaRows.length);
  const showChartToggle = Boolean(ready && deltaRows.length > 0);

  const [presentationMode, setPresentationMode] = useState<PresentationMode>(() => {
    const stored = readStoredCompareViewMode(pack.packKey);
    return stored ?? defaultComparePresentationMode();
  });

  useEffect(() => {
    const stored = readStoredCompareViewMode(pack.packKey);
    setPresentationMode(stored ?? defaultComparePresentationMode());
  }, [activeTheme, pack.packKey]);

  const handlePresentationModeChange = (mode: PresentationMode) => {
    setPresentationMode(mode);
    writeStoredCompareViewMode(pack.packKey, mode);
  };

  return (
    <ListPageTableFrame className={cn("flex min-h-0 flex-1 flex-col pb-5 pt-0", STANDARD_ANALYSIS_CONTENT_PAD_CLASS)}>
      {compareData && !isLoading ? (
        <div className="px-4 pt-4">
          <CompareSemanticsBanner activeTheme={activeTheme} compareData={compareData} />
        </div>
      ) : null}

      {showChartToggle ? (
        <div className="flex shrink-0 items-center justify-end px-4 pb-2">
          <StandardAnalysisPresentationToggle
            mode={presentationMode}
            onChange={handlePresentationModeChange}
            testId="standard-analysis-compare-chart-toggle"
          />
        </div>
      ) : null}

      {!isLoading && compareData && !hasPreviousSnapshot(compareData) ? (
        <div className="flex flex-1 items-center justify-center px-4 pb-6">
          <NoPreviousSnapshotState
            pack={pack}
            previousPeriodKey={compareData.previousPeriodKey}
            canManage={canManage}
            capturePending={capturePending}
            onCapturePreviousBaseline={onCapturePreviousBaseline}
          />
        </div>
      ) : presentationMode === "chart" && ready && compareData ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <StandardAnalysisCompareChart theme={activeTheme} compareData={compareData} />
        </div>
      ) : (
        <DataTable
          loading={isLoading}
          empty={!isLoading && ready && deltaRows.length === 0}
          headers={["维度", "本期", "对比期", "增减"]}
          lastColumnAlign="right"
          maxBodyHeight={deltaRows.length > 0 ? STANDARD_COMPARE_TABLE_MAX_HEIGHT : undefined}
          rows={deltaRows.map((delta) => [
            <span key={`${delta.key}-dim`} className="font-medium text-gray-800 dark:text-white/90">
              {delta.key}
            </span>,
            <span key={`${delta.key}-current`} className="tabular-nums">
              {delta.currentValue}
            </span>,
            <span key={`${delta.key}-previous`} className="tabular-nums text-gray-500 dark:text-gray-400">
              {delta.previousValue ?? "—"}
            </span>,
            <span
              key={`${delta.key}-delta`}
              className={cn("tabular-nums font-medium", compareDeltaClassName(delta.delta))}
            >
              {formatCompareDelta(delta.delta)}
              {formatCompareDeltaPct(delta.deltaPct) ? (
                <span className="ml-1 text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                  ({formatCompareDeltaPct(delta.deltaPct)})
                </span>
              ) : null}
            </span>,
          ])}
          emptyState={{
            icon: null,
            title: "暂无可对比数据",
            description: "当前主题未返回可对比的维度结果。",
          }}
        />
      )}

      {compareData && !isLoading ? (
        <ListPageFooter>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            本期 {compareData.currentPeriodKey}
            {compareData.previousPeriodKey ? ` · 对比期 ${compareData.previousPeriodKey}` : " · 对比期快照缺失"}
            {scrollHint ? ` · ${scrollHint}` : ""}
            {deltaRows.length > 0 ? ` · 共 ${deltaRows.length} 个维度` : ""}
          </p>
        </ListPageFooter>
      ) : null}
    </ListPageTableFrame>
  );
}
