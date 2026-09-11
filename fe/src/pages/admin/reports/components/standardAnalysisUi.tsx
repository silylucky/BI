import type { LucideIcon } from "lucide-react";
import { Activity, Database, GitBranch, MapPin, Timer, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnalysisPack, AnalysisTheme, StandardAnalysisRenderMeta } from "../useStandardAnalysis";
import { THEME_LABELS } from "../standardRoutes";
import {
  lastCumulativeCount,
  maxDailyCountInRows,
} from "../standardAnalysisTimeSeries";
import { cn } from "@/lib/utils";

/** 分栏仅 xl+：侧栏占用后 lg 内容区过窄，栅格 min-width:auto 会叠到详情上。 */
export const STANDARD_WORKBENCH_GRID_CLASS =
  "grid min-h-0 min-w-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]";

export const THEME_META: Record<AnalysisTheme, { label: string; icon: LucideIcon }> = {
  lifecycle: { label: THEME_LABELS.lifecycle, icon: GitBranch },
  distribution: { label: THEME_LABELS.distribution, icon: MapPin },
  activity: { label: THEME_LABELS.activity, icon: Activity },
  trend: { label: THEME_LABELS.trend, icon: TrendingUp },
};

export const SNAPSHOT_LABELS: Record<string, string> = {
  daily: "每日快照",
  weekly: "每周快照",
  monthly: "每月快照",
};

export const ALL_ANALYSIS_THEMES: AnalysisTheme[] = ["trend", "activity", "distribution", "lifecycle"];

export function sortThemesForDisplay(themes: AnalysisTheme[]): AnalysisTheme[] {
  return [...themes].sort(
    (left, right) => ALL_ANALYSIS_THEMES.indexOf(left) - ALL_ANALYSIS_THEMES.indexOf(right),
  );
}

export const SNAPSHOT_RETENTION_OPTIONS = [
  { value: 6, label: "保留最近 6 期" },
  { value: 12, label: "保留最近 12 期（推荐）" },
  { value: 24, label: "保留最近 24 期" },
  { value: 36, label: "保留最近 36 期" },
] as const;

export function createEmptyAnalysisPack(): AnalysisPack {
  return {
    packKey: "",
    displayName: "",
    datasetId: "",
    boundConfigId: "",
    dataSourceId: "",
    fieldMapping: { status: "", region: "", createdAt: "" },
    enabledThemes: ["lifecycle", "distribution"],
    allowedRoles: ["analyst", "admin"],
    snapshotCronPreset: "daily",
    snapshotRetentionPeriods: 12,
  };
}

export function StandardAnalysisMetaRow({ pack, className }: { pack: AnalysisPack; className?: string }) {
  const snapshotLabel = SNAPSHOT_LABELS[pack.snapshotCronPreset] ?? pack.snapshotCronPreset;
  const retentionLabel = `保留 ${pack.snapshotRetentionPeriods ?? 12} 期`;
  const usesDataset = Boolean(pack.datasetId);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {usesDataset ? (
        <Badge variant="light" color="success" size="sm" className="max-w-[min(100%,14rem)] truncate">
          <Database className="size-3 shrink-0" aria-hidden />
          数据集绑定
        </Badge>
      ) : (
        <Badge variant="light" color="light" size="sm">
          <Database className="size-3 shrink-0" aria-hidden />
          未绑定数据集
        </Badge>
      )}
      <Badge variant="light" color="info" size="sm">
        <Timer className="size-3 shrink-0" aria-hidden />
        {snapshotLabel}
      </Badge>
      <Badge variant="light" color="light" size="sm">
        {retentionLabel}
      </Badge>
    </div>
  );
}

export function formatCompareDelta(delta: number | null): string {
  if (delta == null) return "—";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function compareDeltaClassName(delta: number | null): string {
  if (delta == null) return "text-gray-500 dark:text-gray-400";
  if (delta > 0) return "text-success-600 dark:text-success-400";
  if (delta < 0) return "text-error-600 dark:text-error-400";
  return "text-gray-600 dark:text-gray-300";
}

type ColumnLike = { name?: string; key?: string } | string;

export function columnName(col: ColumnLike): string {
  if (typeof col === "string") return col;
  return col.name ?? col.key ?? "";
}

export function normalizeColumns(columns: ColumnLike[]): string[] {
  return columns.map(columnName).filter(Boolean);
}

export function normalizeRows(rows: unknown[], headers: string[]): unknown[][] {
  return rows.map((row) => {
    if (Array.isArray(row)) return row;
    if (typeof row === "object" && row !== null) {
      return headers.map((h) => (row as Record<string, unknown>)[h] ?? "");
    }
    return [];
  });
}

export function buildLiveSummaryMetrics(
  headers: string[],
  rows: unknown[][],
  theme: AnalysisTheme,
  meta?: StandardAnalysisRenderMeta,
): SummaryMetricItem[] {
  const cntIdx = findMetricColumnIndex(headers);
  const sumCnt = cntIdx >= 0 ? sumNumericColumn(rows, cntIdx) : 0;
  const peakCnt = cntIdx >= 0 ? maxNumericColumn(rows, cntIdx) : null;
  const totalRecords = meta?.sourceRowCount ?? (cntIdx >= 0 ? sumCnt : rows.length);
  const pointCount = meta?.aggregatedPointCount ?? rows.length;

  if (theme === "trend") {
    const cumulativeTotal = lastCumulativeCount(headers, rows) ?? totalRecords;
    const dailyPeak = maxDailyCountInRows(headers, rows);
    const metrics: SummaryMetricItem[] = [
      { label: "时间点", value: formatSummaryCount(pointCount) },
      {
        label: "累计总量",
        value: formatSummaryCount(cumulativeTotal),
        hint: "与趋势折线末端纵轴一致",
      },
    ];
    if (dailyPeak != null) {
      metrics.push({
        label: "单日最高",
        value: formatSummaryCount(dailyPeak),
        hint: "各时间桶内单日计数峰值",
      });
    }
    return metrics;
  }

  if (theme === "activity") {
    const metrics: SummaryMetricItem[] = [
      { label: "时间点", value: formatSummaryCount(pointCount) },
      {
        label: "记录总数",
        value: formatSummaryCount(totalRecords),
        hint: "聚合前样本行数",
      },
    ];
    if (peakCnt != null) {
      metrics.push({
        label: "单点峰值",
        value: formatSummaryCount(peakCnt),
        hint: "与折线图纵轴峰值一致",
      });
    }
    return metrics;
  }

  if (theme === "distribution") {
    const metrics: SummaryMetricItem[] = [
      { label: "区域数", value: formatSummaryCount(pointCount) },
      { label: "记录总数", value: formatSummaryCount(totalRecords) },
    ];
    const topRegion = findTopDimensionMetric(headers, rows, cntIdx);
    if (topRegion) metrics.push(topRegion);
    return metrics;
  }

  const metrics: SummaryMetricItem[] = [
    { label: "状态数", value: formatSummaryCount(pointCount) },
    { label: "记录总数", value: formatSummaryCount(totalRecords) },
  ];
  const topStatus = findTopDimensionMetric(headers, rows, cntIdx);
  if (topStatus) {
    metrics.push({ ...topStatus, label: "最高状态" });
  }
  return metrics;
}

export type SummaryMetricItem = {
  label: string;
  value: string;
  hint?: string;
};

function findMetricColumnIndex(headers: string[]): number {
  return headers.findIndex((header) => /^(数量|cnt|count|total|sum|qty|amount|value)$/i.test(header));
}

function findDimensionColumnIndex(headers: string[]): number {
  return headers.findIndex((header) => /^(dim|维度|d|date|status|region|province|city)$/i.test(header));
}

function sumNumericColumn(rows: unknown[][], colIdx: number): number {
  return rows.reduce((acc, row) => {
    const value = Number(row[colIdx]);
    return Number.isFinite(value) ? acc + value : acc;
  }, 0);
}

function maxNumericColumn(rows: unknown[][], colIdx: number): number | null {
  let peak = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = Number(row[colIdx]);
    if (!Number.isFinite(value)) continue;
    if (value > peak) peak = value;
  }
  return Number.isFinite(peak) ? peak : null;
}

function formatSummaryCount(value: number): string {
  return value.toLocaleString("zh-CN");
}

function findTopDimensionMetric(
  headers: string[],
  rows: unknown[][],
  cntIdx: number,
): SummaryMetricItem | null {
  const dimIdx = findDimensionColumnIndex(headers);
  const metricIdx =
    cntIdx >= 0 ? cntIdx : headers.findIndex((header) => /^(cnt|count|数量)$/i.test(header));
  if (dimIdx < 0 || metricIdx < 0 || rows.length === 0) return null;

  let topDim = "";
  let topVal = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const val = Number(row[metricIdx]);
    if (!Number.isFinite(val) || val <= topVal) continue;
    topVal = val;
    topDim = String(row[dimIdx] ?? "");
  }
  if (!topDim) return null;
  return {
    label: "最高区域",
    value: `${topDim}（${formatSummaryCount(topVal)}）`,
    hint: "与柱状图最高柱一致",
  };
}
