import { cn } from "@/lib/utils";

export type ScreenRefreshState = "idle" | "refreshing" | "error";

export type RefreshStatusBadgeProps = {
  lastAt?: string | null;
  intervalSec?: number;
  countdownSec?: number | null;
  state?: ScreenRefreshState;
  theme?: "dark" | "light";
  onClick?: () => void;
};

export function RefreshStatusBadge({
  lastAt,
  intervalSec,
  countdownSec,
  state = "idle",
  theme = "dark",
  onClick,
}: RefreshStatusBadgeProps) {
  const isDark = theme === "dark";
  const label =
    state === "error"
      ? "同步失败，请重试"
      : state === "refreshing"
        ? "正在同步..."
        : `更新于 ${lastAt ?? "—"}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors",
        isDark
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
      data-testid="screen-refresh-badge"
    >
      {state === "refreshing" ? (
        <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      <span>{label}</span>
      {intervalSec ? (
        <span className="opacity-70">
          · 每 {intervalSec}s
          {countdownSec != null && state === "idle" ? ` · ${countdownSec}s 后刷新` : null}
        </span>
      ) : (
        <span className="opacity-70">· 点击刷新</span>
      )}
    </button>
  );
}
