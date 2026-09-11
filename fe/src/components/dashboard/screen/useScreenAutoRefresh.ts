import { useCallback, useEffect, useRef, useState } from "react";
import { formatScreenClock } from "@/lib/screenVisualAssets";
import type { ScreenRefreshState } from "./RefreshStatusBadge";

const MIN_REFRESH_SEC = 5;

export type UseScreenAutoRefreshOptions = {
  refreshIntervalSec?: number;
  enabled?: boolean;
};

export type UseScreenAutoRefreshResult = {
  lastAt: string | null;
  state: ScreenRefreshState;
  countdownSec: number | null;
  globalChartRefreshKey: number;
  manualRefresh: () => void;
};

export function useScreenAutoRefresh({
  refreshIntervalSec,
  enabled = true,
}: UseScreenAutoRefreshOptions): UseScreenAutoRefreshResult {
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [state, setState] = useState<ScreenRefreshState>("idle");
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [globalChartRefreshKey, setGlobalChartRefreshKey] = useState(0);
  const refreshingRef = useRef(false);

  const intervalSec =
    enabled && refreshIntervalSec && refreshIntervalSec >= MIN_REFRESH_SEC
      ? refreshIntervalSec
      : undefined;

  const runRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setState("refreshing");
    if (intervalSec) setCountdownSec(intervalSec);
    window.setTimeout(() => {
      setGlobalChartRefreshKey((key) => key + 1);
      setLastAt(formatScreenClock(new Date()).slice(11));
      setState("idle");
      refreshingRef.current = false;
    }, 120);
  }, [intervalSec]);

  useEffect(() => {
    if (!intervalSec) {
      setCountdownSec(null);
      return undefined;
    }
    setCountdownSec(intervalSec);
    const tick = window.setInterval(() => {
      setCountdownSec((prev) => {
        if (prev == null || prev <= 1) {
          runRefresh();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [intervalSec, runRefresh]);

  return {
    lastAt,
    state,
    countdownSec,
    globalChartRefreshKey,
    manualRefresh: runRefresh,
  };
}
