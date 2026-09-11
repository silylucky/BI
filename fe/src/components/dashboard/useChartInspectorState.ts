import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { activeFieldRefs, reconcileChartFields } from "@/lib/chartConfigState";
import { isChartExecuteReady, suggestChartFields } from "@/lib/chartExecuteProbe";
import { resolveDatasetChartBinding } from "@/lib/datasetChartBinding";
import type { DatasetFieldKind } from "@/components/dashboard/datasetFieldClassification";
import { queryKeys } from "@/lib/queryKeys";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { fetchChartTypeCatalog, type ChartTypeCatalogItem } from "@/lib/chartRegistry";
import { filterVisibleCatalogItems } from "@/lib/chartPaletteTaxonomy";
import { useInspectorColumns } from "@/hooks/useInspectorColumns";
import type { LayoutWidget } from "./layoutUtils";
import { defaultChartConfig } from "./layoutUtils";
import { WIDGET_CHART_LABELS } from "./widgetIcons";
import { resolveAutoAssignTarget } from "@/lib/chartFieldAssignment";
import { appendAxisField, writeAxisField } from "@/lib/resolveChartEncoding";
import { isDemoPackageDataset } from "@/lib/demoPackage";
import { pickChartNativeBodyUi } from "@/lib/chartNativeBodyUi";
import type { SlotTarget } from "./chartInspectorTypes";

type DataSourceListItem = { id: string; name: string; code: string };
type DatasetListItem = {
  datasetId: string;
  displayName: string;
  boundConfigId?: string | null;
  boundConfigRevision?: number | null;
};

function resolveDataMode(cfg: ChartViewConfig): "dataset" | "sql" {
  if (cfg.mode === "sql" || (cfg.sql && cfg.mode !== "dataset")) return "sql";
  return "dataset";
}

export type ChartInspectorState = ReturnType<typeof useChartInspectorState>;

export function useChartInspectorState(
  widget: LayoutWidget,
  readChartConfig: () => ChartViewConfig,
  emitChange: (cfg: ChartViewConfig) => void,
) {
  const cfg = widget.chartConfig ?? defaultChartConfig("table");
  const { columns, loading: columnsLoading, ready: columnsReady, refreshColumns } = useInspectorColumns(cfg);
  const emitChartChange = useCallback(
    (next: ChartViewConfig) => {
      emitChange(next);
    },
    [emitChange],
  );
  const bindingSyncRef = useRef<string | null>(null);
  const autoFieldsRef = useRef<string | null>(null);
  const [catalog, setCatalog] = useState<ChartTypeCatalogItem[]>([]);
  const [activeSlot, setActiveSlot] = useState<SlotTarget | null>(null);
  const [fieldAssignError, setFieldAssignError] = useState<string | null>(null);
  const [datasetBindingError, setDatasetBindingError] = useState<string | null>(null);
  const [columnKindOverrides, setColumnKindOverrides] = useState<
    Record<string, DatasetFieldKind> | undefined
  >(undefined);

  useEffect(() => {
    fetchChartTypeCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const { data: dsData, isLoading: dsLoading } = useQuery({
    queryKey: queryKeys.datasources.list(),
    queryFn: () => apiFetch<{ items: DataSourceListItem[] }>("/api/v1/datasources"),
  });

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
  const datasourceItems = dsData?.items ?? [];
  const dataMode = resolveDataMode(cfg);
  const selectedDataset = datasetItems.find((d) => d.datasetId === cfg.datasetId);
  const datasetReady = isChartExecuteReady(cfg);
  const datasetsEmpty = !datasetsLoading && !datasetsError && datasetItems.length === 0;
  const datasourcesEmpty = !dsLoading && datasourceItems.length === 0;
  const typeLabel = WIDGET_CHART_LABELS[cfg.chartType] ?? cfg.chartType;
  const chartTypeOptions =
    catalog.length > 0
      ? filterVisibleCatalogItems(catalog)
      : [{ type: cfg.chartType, displayName: typeLabel } as ChartTypeCatalogItem];

  const handleDatasetSelect = useCallback(
    async (datasetId: string) => {
      const ds = datasetItems.find((d) => d.datasetId === datasetId);
      const boundId = ds?.boundConfigId ?? undefined;
      const current = readChartConfig();
      let dataSourceId = current.dataSourceId;

      if (boundId) {
        try {
          const binding = await resolveDatasetChartBinding(boundId);
          if (binding.dataSourceId) dataSourceId = binding.dataSourceId;
          setColumnKindOverrides(binding.columnKinds);
          setDatasetBindingError(null);
        } catch {
          setColumnKindOverrides(undefined);
          setDatasetBindingError("数据集绑定解析失败，请检查数据集配置或改用手写 SQL");
        }
      } else if (isDemoPackageDataset(datasetId, ds?.displayName)) {
        setColumnKindOverrides(undefined);
        setDatasetBindingError(
          "官方示例 Dataset 查询配置尚未就绪，请重启后端或运行 python scripts/seed-demo-package.py",
        );
      } else {
        setColumnKindOverrides(undefined);
        setDatasetBindingError("该 Dataset 尚未绑定查询配置，请先在数据集管理中绑定");
      }

      const nextBase = {
        ...current,
        mode: "dataset" as const,
        datasetId,
        configId: boundId,
        configRevision: ds?.boundConfigRevision ?? undefined,
        dataSourceId,
        sql: undefined,
        nativeBody: pickChartNativeBodyUi(current.nativeBody),
      };

      emitChartChange(nextBase);
    },
    [datasetItems, emitChartChange, readChartConfig],
  );

  useEffect(() => {
    if (dataMode !== "dataset" || !cfg.datasetId || datasetsLoading) return;

    const ds = datasetItems.find((d) => d.datasetId === cfg.datasetId);
    const boundId = ds?.boundConfigId;
    if (!boundId) {
      if (isDemoPackageDataset(cfg.datasetId, ds?.displayName)) {
        setDatasetBindingError(
          "官方示例 Dataset 查询配置尚未就绪，请重启后端或运行 python scripts/seed-demo-package.py",
        );
      }
      return;
    }

    const needsConfig = cfg.configId !== boundId;
    const needsDs = !cfg.dataSourceId;
    const needsRevision = (cfg.configRevision ?? null) !== (ds?.boundConfigRevision ?? null);
    if (!needsConfig && !needsDs && !needsRevision) {
      bindingSyncRef.current = `${cfg.datasetId}:${boundId}:${cfg.configId}:${cfg.dataSourceId}:${ds?.boundConfigRevision ?? ""}`;
      return;
    }

    const syncKey = `${cfg.datasetId}:${boundId}:${needsConfig}:${needsDs}:${needsRevision}`;
    if (bindingSyncRef.current === syncKey) return;

    let cancelled = false;
    void (async () => {
      const current = readChartConfig();
      let dataSourceId = current.dataSourceId;
      let bindingRevision: number | undefined;
      try {
        const binding = await resolveDatasetChartBinding(boundId);
        if (binding.dataSourceId) dataSourceId = binding.dataSourceId;
        bindingRevision = binding.revision;
        setColumnKindOverrides(binding.columnKinds);
        setDatasetBindingError(null);
      } catch {
        setColumnKindOverrides(undefined);
        setDatasetBindingError("数据集绑定解析失败，请检查数据集配置或改用手写 SQL");
      }
      if (cancelled) return;

      bindingSyncRef.current = syncKey;
      emitChartChange({
        ...readChartConfig(),
        mode: "dataset",
        configId: boundId,
        configRevision: bindingRevision ?? ds?.boundConfigRevision ?? undefined,
        ...(dataSourceId ? { dataSourceId } : {}),
        nativeBody: pickChartNativeBodyUi(readChartConfig().nativeBody),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [dataMode, cfg, datasetItems, datasetsLoading, emitChartChange, readChartConfig]);

  const columnsKey = columns.join("|");
  useEffect(() => {
    if (!columns.length) return;
    const current = readChartConfig();
    const reconciled = reconcileChartFields(current, columns);
    const same =
      JSON.stringify(current.dimensions) === JSON.stringify(reconciled.dimensions) &&
      JSON.stringify(current.metrics) === JSON.stringify(reconciled.metrics) &&
      JSON.stringify(current.axes) === JSON.stringify(reconciled.axes) &&
      JSON.stringify(current.timeRange) === JSON.stringify(reconciled.timeRange);
    if (!same) emitChartChange(reconciled);
    // 仅在列集合变化时剔除无效字段，避免拖入字段时被立即清掉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnsKey]);

  useEffect(() => {
    if (!columns.length) return;
    const current = readChartConfig();
    const hasFields =
      activeFieldRefs(current.dimensions).length > 0 ||
      activeFieldRefs(current.metrics).length > 0;
    if (hasFields) return;
    const autoKey = `${current.chartType}:${columnsKey}`;
    if (autoFieldsRef.current === autoKey) return;
    autoFieldsRef.current = autoKey;
    const suggested = suggestChartFields(columns, current.chartType);
    emitChartChange({ ...current, ...suggested });
  }, [columns, columnsKey, emitChartChange, readChartConfig]);

  const assignField = useCallback(
    (fieldName: string, target?: SlotTarget) => {
      const current = readChartConfig();
      const resolved = resolveAutoAssignTarget(current, current.chartType, fieldName, target ?? activeSlot);
      if ("error" in resolved) {
        setFieldAssignError(resolved.error);
        return;
      }
      setFieldAssignError(null);
      if (resolved.append) {
        emitChartChange(appendAxisField(current, resolved.target.axisId, fieldName));
      } else {
        emitChartChange(writeAxisField(current, resolved.target, fieldName));
      }
      setActiveSlot(null);
    },
    [activeSlot, emitChartChange, readChartConfig],
  );

  return {
    widget,
    onChange: emitChartChange,
    cfg,
    columns,
    columnsLoading,
    columnsReady,
    refreshColumns,
    catalog: chartTypeOptions,
    dataMode,
    dsLoading,
    datasetsLoading,
    datasetsError,
    datasourceItems,
    datasetItems,
    datasetsEmpty,
    datasourcesEmpty,
    selectedDataset,
    datasetReady,
    handleDatasetSelect,
    activeSlot,
    setActiveSlot,
    assignField,
    fieldAssignError,
    clearFieldAssignError: () => setFieldAssignError(null),
    datasetBindingError,
    clearDatasetBindingError: () => setDatasetBindingError(null),
    columnKindOverrides,
  };
}
