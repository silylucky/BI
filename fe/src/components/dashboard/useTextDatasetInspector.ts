import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { resolveDatasetChartBinding } from "@/lib/datasetChartBinding";
import { queryKeys } from "@/lib/queryKeys";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { useInspectorColumns } from "@/hooks/useInspectorColumns";
import type { TextWidgetConfig } from "./layoutUtils";

type DatasetListItem = {
  datasetId: string;
  displayName: string;
  boundConfigId?: string | null;
};

function probeConfig(
  textConfig: TextWidgetConfig,
  datasetItems: DatasetListItem[],
  dataSourceId?: string,
): ChartViewConfig | null {
  if (!textConfig.datasetId) return null;
  const dataset = datasetItems.find((item) => item.datasetId === textConfig.datasetId);
  if (!dataset?.boundConfigId) return null;
  return {
    chartType: "table",
    mode: "dataset",
    datasetId: textConfig.datasetId,
    configId: dataset.boundConfigId,
    dataSourceId,
  };
}

export function useTextDatasetInspector(
  textConfig: TextWidgetConfig,
  onChange: (config: TextWidgetConfig) => void,
) {
  const bindingSyncRef = useRef<string | null>(null);
  const [dataSourceId, setDataSourceId] = useState<string | undefined>();

  const {
    data: datasetData,
    isLoading: datasetsLoading,
    isError: datasetsError,
  } = useQuery({
    queryKey: queryKeys.datasets.list({ limit: 200, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: DatasetListItem[] }>("/api/v1/datasets?limit=200&offset=0"),
  });

  const datasetItems = datasetData?.items ?? [];
  const datasetsEmpty = !datasetsLoading && !datasetsError && datasetItems.length === 0;
  const selectedDataset = datasetItems.find((item) => item.datasetId === textConfig.datasetId);

  useEffect(() => {
    const boundId = selectedDataset?.boundConfigId;
    if (!boundId) {
      setDataSourceId(undefined);
      bindingSyncRef.current = null;
      return;
    }

    const syncKey = `${textConfig.datasetId}:${boundId}`;
    if (bindingSyncRef.current === syncKey) return;

    let cancelled = false;
    void resolveDatasetChartBinding(boundId)
      .then((binding) => {
        if (cancelled) return;
        bindingSyncRef.current = syncKey;
        setDataSourceId(binding.dataSourceId);
      })
      .catch(() => {
        if (!cancelled) setDataSourceId(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDataset?.boundConfigId, textConfig.datasetId]);

  const probe = probeConfig(textConfig, datasetItems, dataSourceId);
  const { columns, loading: columnsLoading, ready: columnsReady, refreshColumns } = useInspectorColumns(
    probe ?? { chartType: "table", mode: "dataset" },
  );

  const handleDatasetSelect = useCallback(
    (datasetId: string) => {
      onChange({
        ...textConfig,
        datasetId,
        dimensionField: undefined,
        metricField: undefined,
      });
    },
    [onChange, textConfig],
  );

  const assignField = useCallback(
    (fieldName: string, target: "dimension" | "metric") => {
      if (target === "dimension") {
        onChange({ ...textConfig, dimensionField: fieldName });
        return;
      }
      onChange({ ...textConfig, metricField: fieldName });
    },
    [onChange, textConfig],
  );

  return {
    datasetItems,
    datasetsLoading,
    datasetsError,
    datasetsEmpty,
    selectedDataset,
    columns,
    columnsLoading,
    columnsReady: Boolean(probe) && columnsReady,
    handleDatasetSelect,
    assignField,
    refreshColumns,
  };
}
