import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BarChart3, Table2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import {
  DataTable,
  ListPageTableFrame,
} from "@/components/layout/list-page-kit";
import { cn } from "@/lib/utils";
import { standardAnalysisConfigPath } from "../standardRoutes";
import {
  readStoredViewMode,
  writeStoredViewMode,
  type PresentationMode,
} from "../standardAnalysisPrefs";
import type { AnalysisPack, AnalysisTheme, RunResult } from "../useStandardAnalysis";
import {
  defaultLivePresentationMode,
  detectSuspiciousTimeSeries,
  humanizeSectionHeaders,
  isChartSection,
} from "../standardAnalysisPresentation";
import { buildStandardAnalysisDataWarningNote } from "../standardAnalysisDataMeta";
import {
  normalizeColumns,
  normalizeRows,
} from "./standardAnalysisUi";
import { StandardAnalysisSectionChart } from "./StandardAnalysisSectionChart";

type Props = {
  pack: AnalysisPack;
  activeTheme: AnalysisTheme;
  runData?: RunResult;
  isLoading: boolean;
};

function resolveInitialPresentationMode(
  packKey: string,
  liveSection: Parameters<typeof defaultLivePresentationMode>[0],
): PresentationMode {
  const stored = readStoredViewMode(packKey);
  if (stored) return stored;
  return defaultLivePresentationMode(liveSection);
}

export function StandardAnalysisLiveView({
  pack,
  activeTheme,
  runData,
  isLoading,
}: Props) {
  const liveSection = runData?.renderSpec.sections[0];
  const rawHeaders = liveSection ? normalizeColumns(liveSection.columns) : [];
  const displayHeaders = humanizeSectionHeaders(rawHeaders);
  const normalizedRows = liveSection ? normalizeRows(liveSection.rows, rawHeaders) : [];
  const liveRows = normalizedRows.map((row) => row.map((cell) => String(cell ?? "")));
  const chartSection = isChartSection(liveSection) ? liveSection : undefined;

  const [presentationMode, setPresentationMode] = useState<PresentationMode>(() =>
    resolveInitialPresentationMode(pack.packKey, liveSection),
  );

  useEffect(() => {
    const stored = readStoredViewMode(pack.packKey);
    if (stored) {
      setPresentationMode(stored);
      return;
    }
    setPresentationMode(defaultLivePresentationMode(liveSection));
  }, [activeTheme, liveSection?.kind, liveSection?.chartType, pack.packKey, liveSection]);

  const showChartToggle = Boolean(chartSection);
  const timeSeriesWarning = detectSuspiciousTimeSeries(activeTheme, rawHeaders, liveRows);
  const mappedTimeField = pack.fieldMapping.createdAt?.trim();
  const dataWarning = buildStandardAnalysisDataWarningNote(runData?.renderSpec.meta);

  const handlePresentationModeChange = (mode: PresentationMode) => {
    setPresentationMode(mode);
    writeStoredViewMode(pack.packKey, mode);
  };

  const presentationToggle = showChartToggle ? (
    <div className={cn(HUB_SEGMENTED_SHELL_CLASS, "inline-flex shrink-0 gap-0.5 p-0.5")}>
      <Button
        type="button"
        variant={presentationMode === "chart" ? "primary" : "ghost"}
        size="sm"
        className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 gap-1.5 px-3")}
        onClick={() => handlePresentationModeChange("chart")}
      >
        <BarChart3 className="size-3.5" aria-hidden />
        图表
      </Button>
      <Button
        type="button"
        variant={presentationMode === "table" ? "primary" : "ghost"}
        size="sm"
        className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 gap-1.5 px-3")}
        onClick={() => handlePresentationModeChange("table")}
      >
        <Table2 className="size-3.5" aria-hidden />
        数据表
      </Button>
    </div>
  ) : null;

  return (
    <ListPageTableFrame className="flex min-h-0 flex-1 flex-col">
      {dataWarning ? (
        <div className="px-5 pt-3">
          <Alert severity="warning" appearance="soft">
            <AlertDescription>{dataWarning}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {timeSeriesWarning ? (
        <div className="px-5 pt-4">
          <Alert severity="warning" appearance="soft">
            <AlertTitle>时间字段可能配置有误</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {timeSeriesWarning}
                {mappedTimeField ? ` 当前映射为「${mappedTimeField}」。` : ""}
              </span>
              <Button type="button" variant="outline" size="sm" className="w-fit" asChild>
                <Link to={standardAnalysisConfigPath(pack.packKey)}>前往配置页修正</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {!isLoading && presentationMode === "chart" && chartSection ? (
          <StandardAnalysisSectionChart
            theme={activeTheme}
            headers={rawHeaders}
            rows={normalizedRows}
            chartType={chartSection.chartType}
            meta={runData?.renderSpec.meta}
            headerActions={presentationToggle}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {presentationToggle ? (
              <div className="flex shrink-0 justify-end px-5 pt-2">{presentationToggle}</div>
            ) : null}
            <DataTable
              loading={isLoading}
              empty={!isLoading && liveRows.length === 0}
              headers={displayHeaders}
              rows={liveRows}
              emptyState={{
                icon: null,
                title: "暂无数据",
                description: "当前主题未返回结果，请切换主题或稍后重试。",
              }}
            />
          </div>
        )}
      </div>
    </ListPageTableFrame>
  );
}
