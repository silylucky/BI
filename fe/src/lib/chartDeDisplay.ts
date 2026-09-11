import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  DEFAULT_QUERY_LIMIT,
  MIN_QUERY_LIMIT,
  resolveQueryLimit,
  type DashboardStyleConfig,
} from "@/components/dashboard/dashboardStyleConfig";
import { defaultChartResultLimitString } from "@/lib/chartQueryLimitDefaults";

export type ChartDeDisplayOptions = {
  refreshMode?: string;
  resultLimit?: string;
};

export function defaultChartResultLimitValue(): string {
  return defaultChartResultLimitString();
}

/** 新建组件默认写入 deDisplay.resultLimit，与看板 defaultQueryLimit 语义一致 */
export function buildDefaultChartDeDisplay(): ChartDeDisplayOptions {
  return { resultLimit: defaultChartResultLimitValue() };
}

const REFRESH_SEC: Record<string, number> = {
  "10s": 10,
  "30s": 30,
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
};

export const CHART_REFRESH_MIN_SEC = 5;
export const CHART_REFRESH_MAX_SEC = 86_400;

/** DataEase 组件级刷新预设 */
export const CHART_REFRESH_PRESET_OPTIONS = [
  { value: "10s", label: "10 秒" },
  { value: "30s", label: "30 秒" },
  { value: "1m", label: "1 分钟" },
  { value: "5m", label: "5 分钟" },
  { value: "15m", label: "15 分钟" },
  { value: "1h", label: "1 小时" },
  { value: "custom", label: "自定义" },
] as const;

export function clampChartRefreshSec(sec: number): number {
  if (!Number.isFinite(sec)) return CHART_REFRESH_MIN_SEC;
  return Math.min(CHART_REFRESH_MAX_SEC, Math.max(CHART_REFRESH_MIN_SEC, Math.round(sec)));
}

export function isCustomRefreshMode(mode?: string): boolean {
  return Boolean(mode?.startsWith("custom:"));
}

export function formatChartRefreshSelectValue(mode?: string): string {
  if (!mode || mode === "off") return "off";
  if (isCustomRefreshMode(mode)) return "custom";
  return mode;
}

export function parseCustomRefreshSec(mode?: string, fallback = 60): number {
  if (!isCustomRefreshMode(mode)) return clampChartRefreshSec(fallback);
  const n = Number.parseInt(mode!.slice("custom:".length), 10);
  return clampChartRefreshSec(Number.isFinite(n) ? n : fallback);
}

export function buildCustomRefreshMode(sec: number): string {
  return `custom:${clampChartRefreshSec(sec)}`;
}

export type CustomRefreshUnit = "s" | "m";

export const CUSTOM_REFRESH_UNIT_OPTIONS = [
  { value: "s" as const, label: "秒" },
  { value: "m" as const, label: "分" },
];

export function splitCustomRefreshSec(
  sec: number,
  preferUnit?: CustomRefreshUnit,
): { amount: number; unit: CustomRefreshUnit } {
  const clamped = clampChartRefreshSec(sec);
  if (preferUnit === "m") {
    return { amount: Math.max(1, Math.round(clamped / 60)), unit: "m" };
  }
  if (preferUnit === "s") {
    return { amount: clamped, unit: "s" };
  }
  if (clamped >= 60 && clamped % 60 === 0) {
    return { amount: clamped / 60, unit: "m" };
  }
  return { amount: clamped, unit: "s" };
}

export function parseCustomRefreshParts(mode?: string): { amount: number; unit: CustomRefreshUnit } {
  return splitCustomRefreshSec(parseCustomRefreshSec(mode, 60));
}

export function buildCustomRefreshFromParts(amount: number, unit: CustomRefreshUnit): string {
  const n = Math.max(1, Math.round(amount));
  const sec = unit === "m" ? n * 60 : n;
  return buildCustomRefreshMode(sec);
}

export function customRefreshAmountBounds(unit: CustomRefreshUnit): { min: number; max: number } {
  if (unit === "m") {
    return { min: 1, max: Math.floor(CHART_REFRESH_MAX_SEC / 60) };
  }
  return { min: CHART_REFRESH_MIN_SEC, max: CHART_REFRESH_MAX_SEC };
}

/** 结果展示可选条数上限（LIMIT 取最新 N 条，不是全表） */
export const CHART_RESULT_LIMIT_MAX = 1000;
export const CHART_RESULT_LIMIT_CUSTOM = "custom";

/** DataEase 结果展示：组件级与看板默认共用预设 */
export const CHART_RESULT_LIMIT_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "500", label: "500" },
  { value: "1000", label: "1000" },
] as const;

export const CHART_RESULT_LIMIT_SELECT_OPTIONS = [
  ...CHART_RESULT_LIMIT_OPTIONS,
  { value: CHART_RESULT_LIMIT_CUSTOM, label: "自定义" },
] as const;

export type ChartResultLimitOption = (typeof CHART_RESULT_LIMIT_OPTIONS)[number]["value"];

export function clampChartResultLimit(n: number): number {
  return Math.min(CHART_RESULT_LIMIT_MAX, Math.max(MIN_QUERY_LIMIT, n));
}

export function isPresetResultLimit(value?: string): boolean {
  return CHART_RESULT_LIMIT_OPTIONS.some((opt) => opt.value === value);
}

export function isCustomResultLimit(value?: string): boolean {
  if (!value) return false;
  if (value.startsWith(`${CHART_RESULT_LIMIT_CUSTOM}:`)) return true;
  return parseDeResultLimit(value) != null && !isPresetResultLimit(value);
}

/** Select 展示值：预设条数或「自定义」 */
export function formatResultLimitSelectValue(
  value?: string,
  emptyFallback = String(DEFAULT_QUERY_LIMIT),
): string {
  if (isPresetResultLimit(value)) return value!;
  if (isCustomResultLimit(value)) return CHART_RESULT_LIMIT_CUSTOM;
  return isPresetResultLimit(emptyFallback) ? emptyFallback : String(DEFAULT_QUERY_LIMIT);
}

export function buildCustomResultLimit(n: number): string {
  return `${CHART_RESULT_LIMIT_CUSTOM}:${clampChartResultLimit(n)}`;
}

export function resultLimitCustomAmount(value?: string, fallback = CHART_RESULT_LIMIT_MAX): number {
  return parseDeResultLimit(value) ?? clampChartResultLimit(fallback);
}

export function persistResultLimitSelection(selectValue: string, stored?: string): string {
  if (selectValue === CHART_RESULT_LIMIT_CUSTOM) {
    return buildCustomResultLimit(resultLimitCustomAmount(stored));
  }
  return selectValue;
}

/** 看板 defaultQueryLimit → Select value（与组件 deDisplay.resultLimit 同语义） */
export function dashboardQueryLimitSelectValue(limit?: number): string {
  return formatResultLimitSelectValue(String(clampChartResultLimit(limit ?? DEFAULT_QUERY_LIMIT)));
}

/** Select value → 看板 defaultQueryLimit 持久化值 */
export function selectValueToDashboardQueryLimit(value: string): number {
  return parseDeResultLimit(value) ?? DEFAULT_QUERY_LIMIT;
}

export function readChartDeDisplay(cfg: ChartViewConfig): ChartDeDisplayOptions {
  const raw = cfg.nativeBody?.deDisplay;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const d = raw as ChartDeDisplayOptions;
  return {
    refreshMode: d.refreshMode,
    resultLimit: d.resultLimit,
  };
}

export function patchChartDeDisplay(
  cfg: ChartViewConfig,
  patch: Partial<ChartDeDisplayOptions>,
): ChartViewConfig {
  const prev = readChartDeDisplay(cfg);
  const merged = { ...prev, ...patch };
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deDisplay: merged,
    },
  };
}

/** 解析组件级「结果展示」为 execute limit；历史 `all`/`10000` → 1000（最新 1000 条） */
export function parseDeResultLimit(value?: string): number | undefined {
  if (!value) return undefined;
  if (value === "all" || value === "10000") return CHART_RESULT_LIMIT_MAX;
  const raw = value.startsWith(`${CHART_RESULT_LIMIT_CUSTOM}:`)
    ? value.slice(`${CHART_RESULT_LIMIT_CUSTOM}:`.length)
    : value;
  if (raw === CHART_RESULT_LIMIT_CUSTOM) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return clampChartResultLimit(n);
}

/** 组件级刷新间隔（秒）；`off` 或未设置 → null */
export function parseDeRefreshIntervalSec(mode?: string): number | null {
  if (!mode || mode === "off") return null;
  if (isCustomRefreshMode(mode)) return parseCustomRefreshSec(mode);
  return REFRESH_SEC[mode] ?? null;
}

/** 看板默认 limit 与组件级 deDisplay.resultLimit 合并 */
export function resolveChartQueryLimit(
  cfg: ChartViewConfig,
  dashboardStyle: DashboardStyleConfig,
): number {
  const raw = cfg.nativeBody?.deDisplay;
  if (!raw || typeof raw !== "object") {
    return resolveQueryLimit(dashboardStyle);
  }
  const de = raw as ChartDeDisplayOptions;
  if (de.resultLimit) {
    const widgetLimit = parseDeResultLimit(de.resultLimit);
    if (widgetLimit != null) return widgetLimit;
  }
  return clampChartResultLimit(resolveQueryLimit(dashboardStyle));
}
