/** 对标 DataEase 大屏 Layer0 视觉 token（bi-data-screen.md） */
export const SCREEN_CANVAS_BG = "#0f172a";
export const SCREEN_ACCENT = "#22d3ee";
export const SCREEN_TITLE_COLOR = "#e0f2fe";
export const SCREEN_PANEL_BORDER = "rgba(34,211,238,0.3)";
export const SCREEN_PANEL_GLOW = "0 0 12px rgba(34,211,238,0.15)";

export const screenTokens = {
  panelBg: "bg-slate-900/80",
  panelBorder: "border-cyan-500/30",
  title: "text-cyan-100 text-sm font-medium",
  clock: "text-xs text-cyan-300/80 tabular-nums",
  clockLarge: "text-lg font-medium tracking-[0.08em] text-cyan-50 tabular-nums",
  weekday: "text-[11px] text-cyan-300/70",
} as const;

const WEEKDAY_ZH = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const;

export function formatScreenWeekday(date: Date): string {
  return WEEKDAY_ZH[date.getDay()] ?? "";
}
