import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { mapApiError } from "@/lib/apiError";
import {
  chartExecuteBindingKey,
  chartExecuteNotReadyMessage,
  fetchChartExecuteResultShared,
  isChartExecuteReady,
  peekChartExecuteCachedResult,
} from "@/lib/chartExecuteProbe";

export {
  buildFilterParameters,
  buildTimeRangeParameters,
  CHART_EXECUTE_LIMIT,
} from "@/lib/chartExecuteProbe";

const SLOW_THRESHOLD_MS = 3000;

type ChartExecuteOptions = {
  filterParameters?: Record<string, string>;
  executeKey?: string;
  limit?: number;
  enabled?: boolean;
};

/** @deprecated 请直接使用 mapApiError；保留供测试与外部引用 */
export function mapChartQueryError(code: string | undefined, message: string): string {
  if (code) {
    const withCode = Object.assign(new Error(message), { code });
    return mapApiError(withCode);
  }
  return mapApiError(new Error(message));
}

export function useChartExecute(config: ChartViewConfig, options: ChartExecuteOptions = {}) {
  const { filterParameters, executeKey, limit, enabled = true } = options;
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<(string | number | boolean | null)[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const configRef = useRef(config);
  const filterRef = useRef(filterParameters);
  const limitRef = useRef(limit);
  const hasDisplayedDataRef = useRef(false);
  const requestGenRef = useRef(0);
  configRef.current = config;
  filterRef.current = filterParameters;
  limitRef.current = limit;

  const requestKey = chartExecuteBindingKey(config, filterParameters, limit);

  const run = useCallback(async () => {
    const gen = ++requestGenRef.current;
    const activeConfig = configRef.current;
    const activeFilters = filterRef.current;
    const showBlockingLoading = !hasDisplayedDataRef.current;
    if (showBlockingLoading) {
      setLoading(true);
    }
    setError(null);
    setSlowHint(false);
    setTruncated(false);
    const started = Date.now();
    try {
      if (!isChartExecuteReady(activeConfig)) {
        if (gen !== requestGenRef.current) return;
        setError(chartExecuteNotReadyMessage(activeConfig));
        setColumns([]);
        setRows([]);
        hasDisplayedDataRef.current = false;
        return;
      }

      const data = await fetchChartExecuteResultShared(activeConfig, {
        filterParameters: activeFilters,
        limit: limitRef.current,
      });
      if (gen !== requestGenRef.current) return;
      setColumns(data.columns);
      setRows(data.rows);
      setTruncated(Boolean(data.truncated));
      hasDisplayedDataRef.current = data.columns.length > 0 || data.rows.length > 0;
      setSlowHint(Date.now() - started > SLOW_THRESHOLD_MS);
    } catch (err) {
      if (gen !== requestGenRef.current) return;
      setError(mapApiError(err));
      setColumns([]);
      setRows([]);
      hasDisplayedDataRef.current = false;
      setSlowHint(false);
      setTruncated(false);
    } finally {
      if (gen === requestGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return () => {
        requestGenRef.current += 1;
      };
    }

    const cached = peekChartExecuteCachedResult(configRef.current, {
      filterParameters: filterRef.current,
      limit: limitRef.current,
    });
    if (cached) {
      setColumns(cached.columns);
      setRows(cached.rows);
      setTruncated(Boolean(cached.truncated));
      hasDisplayedDataRef.current =
        cached.columns.length > 0 || cached.rows.length > 0;
      setLoading(false);
      setError(null);
    } else {
      hasDisplayedDataRef.current = false;
      setTruncated(false);
    }
    void run();

    return () => {
      requestGenRef.current += 1;
    };
  }, [requestKey, executeKey, run, enabled]);

  return { columns, rows, loading, error, slowHint, truncated, rerun: run };
}
