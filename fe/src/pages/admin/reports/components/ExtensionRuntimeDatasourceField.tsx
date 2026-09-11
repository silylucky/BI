import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { mapApiError } from "@/lib/apiError";
import type { DatasourceListItem } from "@/lib/datasourceRoles";
import { formatDatasourceEndpoint } from "@/lib/formatDatasourceDisplay";

type ExtensionRuntimeDatasourceFieldProps = {
  mode: "picker" | "readonly";
  value: string;
  items: DatasourceListItem[];
  loading?: boolean;
  error?: unknown;
  onChange?: (id: string) => void;
};

export function ExtensionRuntimeDatasourceField({
  mode,
  value,
  items,
  loading,
  error,
  onChange,
}: ExtensionRuntimeDatasourceFieldProps) {
  const selected = items.find((ds) => ds.id === value);

  if (mode === "readonly") {
    return (
      <div className="grid gap-2">
        <Label htmlFor="default-ds-readonly">运行库</Label>
        {loading ? (
          <Skeleton className="h-11 w-full rounded-lg" />
        ) : (
          <Input
            id="default-ds-readonly"
            readOnly
            value={selected?.name ?? "托管分析库"}
            className="h-11 bg-gray-50 dark:bg-gray-900/50"
          />
        )}
        {selected ? (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {formatDatasourceEndpoint(selected)}
          </p>
        ) : null}
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          数据集模式随绑定自动确定，无需单独选择。
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="default-ds">运行数据源</Label>
      {loading ? (
        <Skeleton className="h-11 w-full rounded-lg" />
      ) : error ? (
        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          数据源加载失败：{mapApiError(error)}
        </p>
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger id="default-ds" className="h-11">
            <SelectValue placeholder="必选：SQL 查询使用的数据连接" />
          </SelectTrigger>
          <SelectContent>
            {items.map((ds) => (
              <SelectItem key={ds.id} value={ds.id}>
                {ds.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {!loading && !error && items.length === 0 ? (
        <p className="text-theme-xs text-amber-700 dark:text-amber-400">
          暂无数据源。请先到「数据连接」创建连接。
        </p>
      ) : (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          SQL 模式须指定执行连接；数据集指标仍共用此默认连接。
        </p>
      )}
    </div>
  );
}
