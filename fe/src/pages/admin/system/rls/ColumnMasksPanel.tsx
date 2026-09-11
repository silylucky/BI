import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/layout/list-page-kit";
import { Button, IconButton } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

type MaskStrategy = "hide" | "partial" | "hash";

type ColumnMaskOut = {
  id: string;
  datasourceId?: string | null;
  datasetId?: string | null;
  tableName: string;
  columnName: string;
  maskStrategy: MaskStrategy;
};

const STRATEGY_LABEL: Record<MaskStrategy, string> = {
  hide: "隐藏",
  partial: "部分掩码",
  hash: "哈希",
};

export function ColumnMasksPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tableName, setTableName] = useState("");
  const [columnName, setColumnName] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [strategy, setStrategy] = useState<MaskStrategy>("partial");
  const [filterDataset, setFilterDataset] = useState("");

  const masksQuery = useQuery({
    queryKey: queryKeys.rls.columnMasks({ datasetId: filterDataset || undefined }),
    queryFn: () => {
      const q = new URLSearchParams();
      if (filterDataset.trim()) q.set("datasetId", filterDataset.trim());
      const suffix = q.toString() ? `?${q}` : "";
      return apiFetch<{ items: ColumnMaskOut[] }>(`/api/v1/column-masks${suffix}`);
    },
  });

  const createMask = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/column-masks", {
        method: "POST",
        body: JSON.stringify({
          datasetId: datasetId.trim() || null,
          tableName: tableName.trim(),
          columnName: columnName.trim(),
          maskStrategy: strategy,
        }),
      }),
    onSuccess: async () => {
      toast.success("列脱敏规则已创建");
      setOpen(false);
      setTableName("");
      setColumnName("");
      setDatasetId("");
      setStrategy("partial");
      await qc.invalidateQueries({ queryKey: ["rls", "column-masks"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const removeMask = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/column-masks/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("列脱敏规则已删除");
      await qc.invalidateQueries({ queryKey: ["rls", "column-masks"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const items = masksQuery.data?.items ?? [];

  return (
    <div className="space-y-4 p-5">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        配置查询结果列脱敏策略（隐藏、部分掩码或哈希），作用于 API 层结果后处理。
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2 sm:max-w-xs">
          <Label>按数据集 ID 筛选</Label>
          <Input
            value={filterDataset}
            onChange={(e) => setFilterDataset(e.target.value)}
            placeholder="可选"
          />
        </div>
        <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          新建脱敏规则
        </Button>
      </div>
      {masksQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <DataTable
          loading={false}
          empty={items.length === 0}
          headers={["表", "列", "数据集", "策略", ""]}
          lastColumnAlign="right"
          rows={items.map((row) => [
            <code key="t" className="font-mono text-theme-xs">
              {row.tableName}
            </code>,
            <code key="c" className="font-mono text-theme-xs">
              {row.columnName}
            </code>,
            row.datasetId ?? "—",
            STRATEGY_LABEL[row.maskStrategy],
            <IconButton
              key="a"
              type="button"
              variant="ghost"
              size="sm"
              aria-label="删除脱敏规则"
              className="text-error-600"
              onClick={() => removeMask.mutate(row.id)}
            >
              <Trash2 className="size-4" />
            </IconButton>,
          ])}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建列脱敏</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="mask-dataset">数据集 ID（可选）</Label>
              <Input
                id="mask-dataset"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mask-table">表名 *</Label>
              <Input
                id="mask-table"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mask-column">列名 *</Label>
              <Input
                id="mask-column"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>脱敏策略</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as MaskStrategy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hide">隐藏</SelectItem>
                  <SelectItem value="partial">部分掩码</SelectItem>
                  <SelectItem value="hash">哈希</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!tableName.trim() || !columnName.trim() || createMask.isPending}
              onClick={() => createMask.mutate()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
