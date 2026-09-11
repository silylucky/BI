import { Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import { ListPageToolbar } from "@/components/layout/list-page-kit";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  AnalysisPack,
  AnalysisTheme,
  CompareMatrixResult,
  CompareResult,
  RunResult,
  SnapshotRecord,
  ThemeCapability,
} from "../useStandardAnalysis";
import { isThemeAvailable, themeCapabilityReason } from "../useStandardAnalysis";
import { StandardAnalysisCompareControls } from "./StandardAnalysisCompareControls";
import { StandardAnalysisCompareMatrixView } from "./StandardAnalysisCompareMatrixView";
import { StandardAnalysisCompareView } from "./StandardAnalysisCompareView";
import type { CompareLayout } from "../standardAnalysisComparePrefs";
import { compareVolumeHint } from "./standardAnalysisCompareUi";
import { sortThemesForDisplay, THEME_META } from "./standardAnalysisUi";
import { StandardAnalysisLiveView } from "./StandardAnalysisLiveView";
import { StandardAnalysisSnapshotStrip } from "./StandardAnalysisSnapshotStrip";

type Props = {
  pack: AnalysisPack;
  activeTheme: AnalysisTheme;
  viewMode: "live" | "compare";
  canManage: boolean;
  capturePending: boolean;
  onCaptureCurrent: () => void;
  onCapturePreviousBaseline: () => void;
  compareLayout: CompareLayout;
  onCompareLayoutChange: (layout: CompareLayout) => void;
  livePeriodKey: string;
  currentPeriodValue: string;
  baselinePeriodValue: string;
  matrixPeriodKeys: string[];
  onCurrentPeriodChange: (value: string) => void;
  onBaselinePeriodChange: (value: string) => void;
  onMatrixPeriodKeysChange: (keys: string[]) => void;
  matrixQuery: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
    data?: CompareMatrixResult;
  };
  onThemeChange: (theme: AnalysisTheme) => void;
  onViewModeChange: (mode: "live" | "compare") => void;
  runQuery: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
    data?: RunResult;
  };
  compareQuery: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
    data?: CompareResult;
  };
  snapshots?: SnapshotRecord[];
  themeCapabilities?: ThemeCapability[];
  mapError: (error: unknown) => string;
};

export function StandardAnalysisResultPanel({
  pack,
  activeTheme,
  viewMode,
  canManage,
  capturePending,
  onCaptureCurrent,
  onCapturePreviousBaseline,
  compareLayout,
  onCompareLayoutChange,
  livePeriodKey,
  currentPeriodValue,
  baselinePeriodValue,
  matrixPeriodKeys,
  onCurrentPeriodChange,
  onBaselinePeriodChange,
  onMatrixPeriodKeysChange,
  matrixQuery,
  onThemeChange,
  onViewModeChange,
  runQuery,
  compareQuery,
  snapshots,
  themeCapabilities,
  mapError,
}: Props) {
  const activeQuery = viewMode === "live" ? runQuery : compareLayout === "matrix" ? matrixQuery : compareQuery;
  const compareVolumeNote =
    viewMode === "compare" ? compareVolumeHint(pack, activeTheme) : null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Tabs
        value={activeTheme}
        onValueChange={(value) => onThemeChange(value as AnalysisTheme)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ListPageToolbar
          filters={
            <TabsList variant="enclosed" size="sm" className="h-auto max-w-full flex-wrap">
              {sortThemesForDisplay(pack.enabledThemes as AnalysisTheme[]).map((theme) => {
                const Icon = THEME_META[theme]?.icon;
                const available = isThemeAvailable(theme, themeCapabilities);
                const reason = themeCapabilityReason(theme, themeCapabilities);
                return (
                  <TabsTrigger
                    key={theme}
                    value={theme}
                    variant="enclosed"
                    size="sm"
                    className="gap-1.5"
                    disabled={!available}
                    title={reason}
                  >
                    {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
                    {THEME_META[theme]?.label ?? theme}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          }
          actions={
            <div className="flex items-center gap-2">
              <div className={cn(HUB_SEGMENTED_SHELL_CLASS, "inline-flex gap-0.5 p-0.5")}>
                <Button
                  type="button"
                  variant={viewMode === "live" ? "primary" : "ghost"}
                  size="sm"
                  className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 px-3")}
                  onClick={() => onViewModeChange("live")}
                >
                  实时
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "compare" ? "primary" : "ghost"}
                  size="sm"
                  className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 px-3")}
                  onClick={() => onViewModeChange("compare")}
                >
                  周期对比
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="size-8 p-0"
                disabled={activeQuery.isFetching}
                aria-label="刷新"
                onClick={() => activeQuery.refetch()}
              >
                <RefreshCw className={cn("size-4", activeQuery.isFetching && "animate-spin")} aria-hidden />
              </Button>
              {canManage && viewMode === "live" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-3"
                  disabled={capturePending}
                  data-testid="standard-analysis-capture-toolbar"
                  onClick={onCaptureCurrent}
                >
                  <Camera className="size-3.5" aria-hidden />
                  {capturePending ? "保存中…" : "保存本期快照"}
                </Button>
              ) : null}
            </div>
          }
        />

        {activeQuery.isError ? (
          <div className="px-5 pt-4">
            <PageErrorBanner message={mapError(activeQuery.error)} onRetry={() => activeQuery.refetch()} />
          </div>
        ) : null}

        <StandardAnalysisSnapshotStrip
          pack={pack}
          activeTheme={activeTheme}
          snapshots={snapshots}
          viewMode={viewMode}
          canManage={canManage}
          compareSummary={
            viewMode === "compare" && compareLayout === "pair" && compareQuery.data
              ? {
                  currentPeriodKey: compareQuery.data.currentPeriodKey,
                  previousPeriodKey: compareQuery.data.previousPeriodKey,
                }
              : undefined
          }
        />

        {viewMode === "live" ? (
          <StandardAnalysisLiveView
            pack={pack}
            activeTheme={activeTheme}
            runData={runQuery.data}
            isLoading={runQuery.isLoading}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <StandardAnalysisCompareControls
              layout={compareLayout}
              onLayoutChange={onCompareLayoutChange}
              activeTheme={activeTheme}
              livePeriodKey={livePeriodKey}
              snapshots={snapshots}
              currentPeriodValue={currentPeriodValue}
              baselinePeriodValue={baselinePeriodValue}
              matrixPeriodKeys={matrixPeriodKeys}
              onCurrentPeriodChange={onCurrentPeriodChange}
              onBaselinePeriodChange={onBaselinePeriodChange}
              onMatrixPeriodKeysChange={onMatrixPeriodKeysChange}
            />
            {compareVolumeNote ? (
              <p className="shrink-0 border-b border-amber-200/80 bg-amber-50/80 px-5 py-2 text-theme-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                {compareVolumeNote}
              </p>
            ) : null}
            {compareLayout === "matrix" ? (
              <StandardAnalysisCompareMatrixView
                pack={pack}
                activeTheme={activeTheme}
                matrixData={matrixQuery.data}
                isLoading={matrixQuery.isLoading}
              />
            ) : (
              <StandardAnalysisCompareView
                pack={pack}
                activeTheme={activeTheme}
                compareData={compareQuery.data}
                snapshots={snapshots}
                isLoading={compareQuery.isLoading}
                canManage={canManage}
                capturePending={capturePending}
                onCapturePreviousBaseline={onCapturePreviousBaseline}
              />
            )}
          </div>
        )}
      </Tabs>
    </section>
  );
}
