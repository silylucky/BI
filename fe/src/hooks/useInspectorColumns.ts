import { useCallback, useEffect, useState } from "react";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { fetchDatasetQueryConfig } from "@/lib/datasetChartBinding";

/** 字段库列出来自 dataset_query 配置，不跑带 encoding 的图表 execute。 */
export function useInspectorColumns(cfg: ChartViewConfig) {
  const configId = cfg.configId;
  const ready = Boolean(configId);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshColumns = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!configId) {
      setColumns([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchDatasetQueryConfig(configId)
      .then((binding) => {
        if (!cancelled) setColumns(binding.columns ?? []);
      })
      .catch(() => {
        if (!cancelled) setColumns([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configId, refreshTick]);

  return { columns, loading, ready, refreshColumns };
}
