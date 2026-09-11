import { useEffect, useState } from "react";
import { DataTable, ListPageFooter, ListPageTableFrame } from "@/components/layout/list-page-kit";
import type { AnalysisPack, AnalysisTheme, CompareMatrixResult } from "../useStandardAnalysis";
import type { PresentationMode } from "../standardAnalysisPrefs";
import {
  defaultComparePresentationMode,
  readStoredMatrixCompareViewMode,
  writeStoredMatrixCompareViewMode,
} from "../standardAnalysisComparePresentation";
import { matrixPeriodTotals } from "../standardAnalysisCompareMatrixChartData";
import {
  STANDARD_COMPARE_TABLE_MAX_HEIGHT,
  standardCompareTableScrollHint,
} from "./standardAnalysisTableUi";
import { StandardAnalysisCompareMatrixChart } from "./StandardAnalysisCompareMatrixChart";
import { StandardAnalysisPresentationToggle } from "./StandardAnalysisPresentationToggle";

type Props = {
  pack: AnalysisPack;
  activeTheme: AnalysisTheme;
  matrixData?: CompareMatrixResult;
  isLoading: boolean;
};

function MatrixTotalSummaryStrip({ matrixData }: { matrixData: CompareMatrixResult }) {
  const totals = matrixPeriodTotals(matrixData);
  if (totals.length === 0) return null;

  return (
    <div
      className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-gray-200 px-4 py-3 dark:border-gray-800"
      data-testid="standard-analysis-matrix-total-summary"
    >
      <span className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">总量趋势</span>
      {totals.map((item) => (
        <div key={item.periodKey} className="flex items-baseline gap-1.5">
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">{item.periodKey}</span>
          <span className="text-theme-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {item.total}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StandardAnalysisCompareMatrixView({
  pack,
  activeTheme,
  matrixData,
  isLoading,
}: Props) {
  const periodKeys = matrixData?.periodKeys ?? [];
  const rowCount = matrixData?.rows.length ?? 0;
  const headers = ["维度", ...periodKeys];
  const scrollHint = standardCompareTableScrollHint(rowCount);
  const showChartToggle = Boolean(matrixData && rowCount > 0 && periodKeys.length >= 2);

  const [presentationMode, setPresentationMode] = useState<PresentationMode>(() => {
    const stored = readStoredMatrixCompareViewMode(pack.packKey);
    return stored ?? defaultComparePresentationMode();
  });

  useEffect(() => {
    const stored = readStoredMatrixCompareViewMode(pack.packKey);
    setPresentationMode(stored ?? defaultComparePresentationMode());
  }, [activeTheme, pack.packKey]);

  const handlePresentationModeChange = (mode: PresentationMode) => {
    setPresentationMode(mode);
    writeStoredMatrixCompareViewMode(pack.packKey, mode);
  };

  return (
    <ListPageTableFrame className="flex min-h-0 flex-1 flex-col px-4 pb-5 pt-0">
      {matrixData && !isLoading ? <MatrixTotalSummaryStrip matrixData={matrixData} /> : null}

      {showChartToggle ? (
        <div className="flex shrink-0 items-center justify-end px-4 pb-2 pt-3">
          <StandardAnalysisPresentationToggle
            mode={presentationMode}
            onChange={handlePresentationModeChange}
            testId="standard-analysis-matrix-chart-toggle"
          />
        </div>
      ) : null}

      {presentationMode === "chart" && matrixData && rowCount > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <StandardAnalysisCompareMatrixChart theme={activeTheme} matrixData={matrixData} />
        </div>
      ) : (
        <DataTable
          loading={isLoading}
          empty={!isLoading && rowCount === 0}
          headers={headers}
          maxBodyHeight={rowCount > 0 ? STANDARD_COMPARE_TABLE_MAX_HEIGHT : undefined}
          rows={(matrixData?.rows ?? []).map((row) => [
            <span key={`${row.key}-dim`} className="font-medium text-gray-800 dark:text-white/90">
              {row.key}
            </span>,
            ...periodKeys.map((periodKey) => (
              <span key={`${row.key}-${periodKey}`} className="tabular-nums">
                {row.values[periodKey] ?? "—"}
              </span>
            )),
          ])}
          emptyState={{
            icon: null,
            title: "暂无可对比数据",
            description: "请至少选择 2 个周期，并确保对应快照已保存。",
          }}
        />
      )}

      {matrixData && !isLoading ? (
        <ListPageFooter>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            共 {periodKeys.length} 个周期 · {rowCount} 个维度
            {scrollHint ? ` · ${scrollHint}` : ""}
          </p>
        </ListPageFooter>
      ) : null}
    </ListPageTableFrame>
  );
}
