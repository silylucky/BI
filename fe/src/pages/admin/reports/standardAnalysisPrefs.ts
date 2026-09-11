import type { AnalysisTheme } from "./useStandardAnalysis";

const THEME_STORAGE_PREFIX = "vs.std.theme.";
const VIEW_STORAGE_PREFIX = "vs.std.view.";

const ANALYSIS_THEMES: AnalysisTheme[] = ["trend", "activity", "distribution", "lifecycle"];

export function isAnalysisTheme(value: string | null): value is AnalysisTheme {
  return value != null && ANALYSIS_THEMES.includes(value as AnalysisTheme);
}

export function readStoredTheme(packKey: string): AnalysisTheme | null {
  try {
    const raw = localStorage.getItem(`${THEME_STORAGE_PREFIX}${packKey}`);
    return isAnalysisTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(packKey: string, theme: AnalysisTheme): void {
  try {
    localStorage.setItem(`${THEME_STORAGE_PREFIX}${packKey}`, theme);
  } catch {
    // ignore quota / private mode
  }
}

export type PresentationMode = "chart" | "table";

export function readStoredViewMode(packKey: string): PresentationMode | null {
  try {
    const raw = localStorage.getItem(`${VIEW_STORAGE_PREFIX}${packKey}`);
    return raw === "chart" || raw === "table" ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredViewMode(packKey: string, mode: PresentationMode): void {
  try {
    localStorage.setItem(`${VIEW_STORAGE_PREFIX}${packKey}`, mode);
  } catch {
    // ignore
  }
}
