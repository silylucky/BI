import { useQuery } from "@tanstack/react-query";
import { Copy, Plus, Table2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildSelectSql,
  isTableAdded,
  mapMetadataError,
  qualifiedTableName,
  type ColumnMeta,
  type TableSelection,
} from "./schemaBrowserUtils";

async function copyText(text: string, label: string) {
  await navigator.clipboard.writeText(text);
  toast.success(`已复制${label}`);
}

type TableColumnsPanelProps = {
  dataSourceId: string;
  selection: TableSelection | null;
  addedTableNames?: ReadonlySet<string>;
  onAddTable?: (selection: TableSelection) => void;
};

function ColumnsEmptyState() {
  return (
    <PanelEmptyState
      icon={<Table2 className="size-7" aria-hidden />}
      title="选择左侧表查看字段"
      description="展开 Schema 后点击表名，此处将展示字段名、类型与可空性。"
      size="md"
      tone="neutral"
    />
  );
}

export function TableColumnsPanel({
  dataSourceId,
  selection,
  addedTableNames,
  onAddTable,
}: TableColumnsPanelProps) {
  const columnsQuery = useQuery({
    queryKey: selection
      ? queryKeys.datasources.columns(dataSourceId, selection.schema, selection.table)
      : ["skip"],
    queryFn: () =>
      apiFetch<{ items: ColumnMeta[] }>(
        `/api/v1/datasources/${dataSourceId}/columns?schema=${encodeURIComponent(selection!.schema)}&table=${encodeURIComponent(selection!.table)}`,
      ),
    enabled: Boolean(dataSourceId && selection),
  });

  if (!selection) return <ColumnsEmptyState />;

  const tableKey = qualifiedTableName(selection.schema, selection.table);
  const added = addedTableNames ? isTableAdded(selection, addedTableNames) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">表结构</p>
            <p className="mt-1 font-mono text-theme-sm font-semibold break-all text-gray-900 dark:text-white">
              {tableKey}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="light" color="light" size="sm">
                {selection.type}
              </Badge>
              {columnsQuery.data?.items ? (
                <Badge variant="light" color="primary" size="sm">
                  {columnsQuery.data.items.length} 个字段
                </Badge>
              ) : null}
              {added ? (
                <Badge variant="light" color="success" size="sm">
                  已加入
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {onAddTable ? (
              <Button
                variant="primary"
                size="sm"
                disabled={added}
                onClick={() => onAddTable(selection)}
              >
                <Plus className="size-4" aria-hidden />
                {added ? "已添加" : "加入 Dataset"}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void copyText(tableKey, "表名")}>
              <Copy aria-hidden />
              复制表名
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyText(buildSelectSql(selection.schema, selection.table), "SQL")}
            >
              <Copy aria-hidden />
              生成 SELECT
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {columnsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : null}
        {columnsQuery.isError ? (
          <p className="text-theme-sm text-error-600 dark:text-error-400">
            {mapMetadataError(columnsQuery.error)}
          </p>
        ) : null}
        {columnsQuery.data?.items ? (
          <Table size="compact" stickyHeader wrapperClassName="border-0 shadow-none">
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-white/[0.03] dark:hover:bg-white/[0.03]">
                <TableHead>字段名</TableHead>
                <TableHead>数据类型</TableHead>
                <TableHead className="w-20 text-center">可空</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columnsQuery.data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-gray-500">
                    暂无字段
                  </TableCell>
                </TableRow>
              ) : (
                columnsQuery.data.items.map((col) => (
                  <TableRow key={col.name}>
                    <TableCell className="font-mono font-medium">{col.name}</TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">{col.dataType}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="light"
                        color={col.nullable ? "success" : "warning"}
                        size="sm"
                        className="min-w-8 justify-center"
                      >
                        {col.nullable ? "是" : "否"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </div>
  );
}
