import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { fetchDatasetQueryConfig } from "@/lib/datasetChartBinding";
import { DatasetBindPanel } from "@/pages/admin/datasets/components/DatasetBindPanel";
import type { DatasetItem } from "@/pages/admin/datasets/types";

type DatasetListItem = { datasetId: string; displayName: string; boundConfigId?: string | null };

export function ReportMetricDatasetFields({
  datasetId,
  boundConfigId,
  onDatasetIdChange,
  onBoundConfigIdChange,
  onSuggestedDataSourceId,
  boundPendingHint,
  hideBoundPendingHint = false,
}: {
  datasetId: string;
  boundConfigId: string;
  onDatasetIdChange: (id: string) => void;
  onBoundConfigIdChange: (id: string) => void;
  onSuggestedDataSourceId?: (id: string) => void;
  /** 绑定变更后在面板内展示提示（不再弹 toast，避免与 DatasetBindPanel 重复） */
  boundPendingHint?: string;
  /** 为 true 时隐藏待保存提示（例如分析包已保存） */
  hideBoundPendingHint?: boolean;
}) {
  const qc = useQueryClient();
  const [showPendingHint, setShowPendingHint] = useState(false);
  const listQuery = useQuery({
    queryKey: ["reports", "datasets", "picker"],
    queryFn: () => apiFetch<{ items: DatasetListItem[] }>("/api/v1/datasets?limit=200&offset=0"),
  });
  const detailQuery = useQuery({
    queryKey: ["reports", "datasets", datasetId],
    queryFn: () => apiFetch<DatasetItem>(`/api/v1/datasets/${datasetId}`),
    enabled: Boolean(datasetId),
  });

  const items = listQuery.data?.items ?? [];
  const detail = detailQuery.data;
  const effectiveBound = boundConfigId || detail?.boundConfigId || "";

  const boundConfigQuery = useQuery({
    queryKey: ["reports", "dataset-bound-config", effectiveBound],
    queryFn: () => fetchDatasetQueryConfig(effectiveBound),
    enabled: Boolean(effectiveBound),
  });

  const onBoundConfigIdChangeRef = useRef(onBoundConfigIdChange);
  const onSuggestedDataSourceIdRef = useRef(onSuggestedDataSourceId);
  onBoundConfigIdChangeRef.current = onBoundConfigIdChange;
  onSuggestedDataSourceIdRef.current = onSuggestedDataSourceId;

  useEffect(() => {
    const nextBound = detail?.boundConfigId;
    if (nextBound && nextBound !== boundConfigId) {
      onBoundConfigIdChangeRef.current(nextBound);
    }
  }, [detail?.boundConfigId, boundConfigId]);

  useEffect(() => {
    const dsId = boundConfigQuery.data?.dataSourceId;
    if (dsId) onSuggestedDataSourceIdRef.current?.(dsId);
  }, [boundConfigQuery.data?.dataSourceId]);

  useEffect(() => {
    setShowPendingHint(false);
  }, [datasetId]);

  const handleBound = (configId: string) => {
    const bindingChanged = configId !== boundConfigId;
    onBoundConfigIdChange(configId);
    void qc.invalidateQueries({ queryKey: ["reports", "datasets", datasetId] });
    void detailQuery.refetch();
    if (boundPendingHint && bindingChanged) {
      setShowPendingHint(true);
    }
  };

  return (
    <div className="grid gap-4 sm:col-span-2">
      <div className="grid gap-2">
        <Label htmlFor="metric-dataset">数据集</Label>
        {listQuery.isLoading ? (
          <Skeleton className="h-11 w-full rounded-lg" />
        ) : (
          <Select value={datasetId || undefined} onValueChange={onDatasetIdChange}>
            <SelectTrigger id="metric-dataset" className="h-11">
              <SelectValue placeholder="选择已创建的数据集" />
            </SelectTrigger>
            <SelectContent className="max-w-[min(100vw-2rem,32rem)]">
              {items.map((d) => (
                <SelectItem key={d.datasetId} value={d.datasetId} className="truncate">
                  <span className="truncate">
                    {d.displayName}
                    {d.boundConfigId ? "（已绑定）" : "（未绑定）"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!listQuery.isLoading && items.length === 0 ? (
          <p className="text-theme-xs text-amber-700 dark:text-amber-400">
            暂无数据集。请先到{" "}
            <Link to="/admin/datasets" className="underline">
              数据集
            </Link>{" "}
            创建并绑定查询。
          </p>
        ) : (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            选「已绑定」的数据集可直接用；未绑定的需在下方完成绑定。
          </p>
        )}
      </div>
      {datasetId && detailQuery.isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
      {datasetId && detail ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
          {effectiveBound ? (
            <p className="mb-3 font-mono text-[11px] text-gray-500 dark:text-gray-400">
              绑定配置：{effectiveBound.slice(0, 8)}…
            </p>
          ) : (
            <p className="mb-3 text-theme-xs text-amber-700 dark:text-amber-400">
              该数据集尚未绑定查询，请在下方完成绑定后再保存。
            </p>
          )}
          <DatasetBindPanel
            datasetId={datasetId}
            tables={detail.tables}
            boundConfigId={detail.boundConfigId}
            origin={detail.origin}
            syncJobId={detail.syncJobId}
            onBound={handleBound}
          />
          {showPendingHint && boundPendingHint && !hideBoundPendingHint ? (
            <Alert severity="info" appearance="soft" className="mt-3">
              <AlertDescription>{boundPendingHint}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
