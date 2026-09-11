import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { DataTable } from "@/components/layout/list-page-kit";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import type { ColumnBindingOut, DimensionTypeOut } from "./rls-types";

type Props = {
  dimensions: DimensionTypeOut[];
};

export function RlsColumnBindingsPanel({ dimensions }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tableName, setTableName] = useState("");
  const [columnName, setColumnName] = useState("");
  const [dimId, setDimId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [filterDataset, setFilterDataset] = useState("");

  const bindingsQuery = useQuery({
    queryKey: queryKeys.rls.columnBindings({
      datasetId: filterDataset || undefined,
    }),
    queryFn: () => {
      const q = new URLSearchParams({ limit: "100", offset: "0" });
      if (filterDataset.trim()) q.set("datasetId", filterDataset.trim());
      return apiFetch<{ items: ColumnBindingOut[]; total: number }>(
        `/api/v1/rls/column-bindings?${q}`,
      );
    },
  });

  const createBinding = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/rls/column-bindings", {
        method: "POST",
        body: JSON.stringify({
          datasetId: datasetId.trim() || null,
          tableName: tableName.trim(),
          dimensionTypeId: dimId,
          columnName: columnName.trim(),
        }),
      }),
    onSuccess: async () => {
      toast.success("列映射已创建");
      setOpen(false);
      setTableName("");
      setColumnName("");
      setDimId("");
      setDatasetId("");
      await qc.invalidateQueries({ queryKey: ["rls", "column-bindings"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const removeBinding = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/rls/column-bindings/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("列映射已删除");
      await qc.invalidateQueries({ queryKey: ["rls", "column-bindings"] });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const previewMutation = useMutation({
    mutationFn: (row: ColumnBindingOut) =>
      apiFetch<{ fragment: string }>("/api/v1/rls/preview", {
        method: "POST",
        body: JSON.stringify({
          datasetId: row.datasetId,
          tableName: row.tableName,
        }),
      }),
    onSuccess: (data) => toast.message("RLS 预览", { description: data.fragment }),
    onError: (err) => toast.error(mapApiError(err)),
  });

  const items = bindingsQuery.data?.items ?? [];
  const dimNameById = Object.fromEntries(dimensions.map((d) => [d.id, d.name]));

  return (
    <div className="space-y-4">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        将物理表列映射到权限维度，查询执行时自动注入多维 RLS 谓词。
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2 sm:max-w-xs">
          <Label>按数据集 ID 筛选</Label>
          <Input
            value={filterDataset}
            onChange={(e) => setFilterDataset(e.target.value)}
            placeholder="可选，如 ds-sales"
          />
        </div>
        <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          新建列映射
        </Button>
      </div>
      {bindingsQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <DataTable
          loading={false}
          empty={items.length === 0}
          lastColumnAlign="right"
          headers={["表名", "列名", "维度类型", "数据集", "操作"]}
          rows={items.map((row) => [
            <code key="t" className="font-mono text-theme-xs">
              {row.tableName}
            </code>,
            <code key="c" className="font-mono text-theme-xs">
              {row.columnName}
            </code>,
            dimNameById[row.dimensionTypeId] ?? row.dimensionTypeId.slice(0, 8),
            row.datasetId ?? "—",
            <div key="a" className="flex justify-end gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => previewMutation.mutate(row)}
              >
                预览
              </Button>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                aria-label="删除列映射"
                className="text-error-600"
                onClick={() => removeBinding.mutate(row.id)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>,
          ])}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建列映射</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>数据集 ID（可选）</Label>
              <Input value={datasetId} onChange={(e) => setDatasetId(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="binding-table">物理表名</Label>
              <Input
                id="binding-table"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="binding-column">列名</Label>
              <Input
                id="binding-column"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="binding-dimension">维度类型</Label>
              <Select value={dimId} onValueChange={setDimId}>
                <SelectTrigger id="binding-dimension">
                  <SelectValue placeholder="选择维度" />
                </SelectTrigger>
                <SelectContent>
                  {dimensions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
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
              disabled={
                !tableName.trim() || !columnName.trim() || !dimId || createBinding.isPending
              }
              onClick={() => createBinding.mutate()}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
