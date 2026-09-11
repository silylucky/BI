import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { PresentationMode } from "./standardAnalysisPrefs";

const INLINE_CHART_DS = "00000000-0000-4000-8000-000000000001";
const COMPARE_VIEW_STORAGE_PREFIX = "vs.std.compare.view.";

export function defaultComparePresentationMode(): PresentationMode {
  return "chart";
}

export function readStoredCompareViewMode(packKey: string): PresentationMode | null {
  try {
    const raw = localStorage.getItem(`${COMPARE_VIEW_STORAGE_PREFIX}${packKey}`);
    return raw === "chart" || raw === "table" ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredCompareViewMode(packKey: string, mode: PresentationMode): void {
  try {
    localStorage.setItem(`${COMPARE_VIEW_STORAGE_PREFIX}${packKey}`, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function buildComparePairChartConfig(): ChartViewConfig {
  return {
    chartType: "bar-group",
    dataSourceId: INLINE_CHART_DS,
    mode: "sql",
    sql: "SELECT 1",
    dimensions: [
      { field: "dim", label: "维度" },
      { field: "period", label: "周期" },
    ],
    metrics: [{ field: "cnt", label: "数量" }],
  };
}

const MATRIX_VIEW_STORAGE_PREFIX = "vs.std.compare.matrix.view.";

export function readStoredMatrixCompareViewMode(packKey: string): PresentationMode | null {
  try {
    const raw = localStorage.getItem(`${MATRIX_VIEW_STORAGE_PREFIX}${packKey}`);
    return raw === "chart" || raw === "table" ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredMatrixCompareViewMode(packKey: string, mode: PresentationMode): void {
  try {
    localStorage.setItem(`${MATRIX_VIEW_STORAGE_PREFIX}${packKey}`, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function buildCompareMatrixChartConfig(): ChartViewConfig {
  return {
    chartType: "line",
    dataSourceId: INLINE_CHART_DS,
    mode: "sql",
    sql: "SELECT 1",
    dimensions: [
      { field: "period", label: "周期" },
      { field: "dim", label: "维度" },
    ],
    metrics: [{ field: "cnt", label: "数量" }],
  };
}
