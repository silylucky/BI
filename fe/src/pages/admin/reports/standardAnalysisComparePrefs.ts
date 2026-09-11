import type { AnalysisTheme, SnapshotRecord } from "../useStandardAnalysis";

export type CompareLayout = "pair" | "matrix";

export const COMPARE_LIVE_VALUE = "__live__";
export const COMPARE_AUTO_BASELINE = "__auto__";

const LAYOUT_PREFIX = "vs.std.compare.layout.";
const MATRIX_PREFIX = "vs.std.compare.matrix.";

export function readCompareLayout(packKey: string): CompareLayout {
  try {
    const raw = localStorage.getItem(`${LAYOUT_PREFIX}${packKey}`);
    return raw === "matrix" ? "matrix" : "pair";
  } catch {
    return "pair";
  }
}

export function writeCompareLayout(packKey: string, layout: CompareLayout): void {
  try {
    localStorage.setItem(`${LAYOUT_PREFIX}${packKey}`, layout);
  } catch {
    /* ignore */
  }
}

export function readMatrixPeriodKeys(packKey: string, theme: AnalysisTheme): string[] {
  try {
    const raw = localStorage.getItem(`${MATRIX_PREFIX}${packKey}.${theme}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function writeMatrixPeriodKeys(packKey: string, theme: AnalysisTheme, keys: string[]): void {
  try {
    localStorage.setItem(`${MATRIX_PREFIX}${packKey}.${theme}`, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export function snapshotsForTheme(
  snapshots: SnapshotRecord[] | undefined,
  theme: AnalysisTheme,
): SnapshotRecord[] {
  return (snapshots ?? [])
    .filter((item) => item.theme === theme)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
}

export function defaultMatrixPeriodKeys(
  snapshots: SnapshotRecord[] | undefined,
  theme: AnalysisTheme,
  livePeriodKey: string,
  limit = 4,
): string[] {
  const keys = snapshotsForTheme(snapshots, theme).map((item) => item.periodKey);
  const withLive = keys.includes(livePeriodKey) ? keys : [livePeriodKey, ...keys];
  return [...new Set(withLive)].slice(0, limit);
}
