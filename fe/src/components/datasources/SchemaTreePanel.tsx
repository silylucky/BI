import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Check, Database, Plus, Table2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import {
  filterTables,
  isCurrentTable,
  isTableAdded,
  mapMetadataError,
  matchesSearch,
  type TableMeta,
  type TableSelection,
} from "./schemaBrowserUtils";

type SchemaGroupProps = {
  dataSourceId: string;
  schema: string;
  expanded: boolean;
  isDefault: boolean;
  searchQuery: string;
  selection: TableSelection | null;
  mode?: "browse" | "datasetPick";
  currentTableName?: string;
  onToggle: () => void;
  onSelectTable: (schema: string, table: TableMeta) => void;
  onTablesLoaded?: (schema: string, tables: TableMeta[]) => void;
  onPickTable?: (selection: TableSelection) => void;
  addedTableNames?: ReadonlySet<string>;
  onAddTable?: (selection: TableSelection) => void;
};

function SchemaGroup({
  dataSourceId,
  schema,
  expanded,
  isDefault,
  searchQuery,
  selection,
  mode = "browse",
  currentTableName,
  onToggle,
  onSelectTable,
  onTablesLoaded,
  onPickTable,
  addedTableNames,
  onAddTable,
}: SchemaGroupProps) {
  const tablesQuery = useQuery({
    queryKey: queryKeys.datasources.tables(dataSourceId, schema),
    queryFn: () =>
      apiFetch<{ items: TableMeta[] }>(
        `/api/v1/datasources/${dataSourceId}/tables?schema=${encodeURIComponent(schema)}`,
      ),
    enabled: expanded && Boolean(dataSourceId),
  });

  const tables = filterTables(tablesQuery.data?.items ?? [], searchQuery);
  const schemaVisible = matchesSearch(schema, searchQuery) || tables.length > 0;

  useEffect(() => {
    if (tablesQuery.data?.items?.length) {
      onTablesLoaded?.(schema, tablesQuery.data.items);
    }
  }, [onTablesLoaded, schema, tablesQuery.data?.items]);

  if (!schemaVisible) return null;

  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-theme-sm transition-colors",
          "hover:bg-white dark:hover:bg-white/5",
          expanded && "bg-white shadow-theme-xs dark:bg-white/[0.04]",
        )}
      >
        <ChevronRight
          className={cn("size-4 shrink-0 text-gray-400 transition-transform", expanded && "rotate-90")}
          aria-hidden
        />
        <Database className="size-4 shrink-0 text-brand-500" aria-hidden />
        <TruncateHint
          title={schema}
          className="min-w-0 flex-1 font-medium text-gray-800 dark:text-white/90"
        >
          {schema}
        </TruncateHint>
        {isDefault ? (
          <Badge variant="light" color="primary" size="sm" className="shrink-0">
            当前库
          </Badge>
        ) : null}
      </button>

      {expanded ? (
        <div className="mt-1 space-y-0.5 border-l-2 border-brand-100 pl-3 ml-5 dark:border-brand-500/20">
          {tablesQuery.isLoading ? <Skeleton className="mx-2 my-1 h-8 rounded-lg" /> : null}
          {tablesQuery.isError ? (
            <p className="px-2 py-2 text-theme-xs text-error-500">{mapMetadataError(tablesQuery.error)}</p>
          ) : null}
          {!tablesQuery.isLoading && !tablesQuery.isError && tables.length === 0 ? (
            <p className="px-2 py-2 text-theme-xs text-gray-500 dark:text-gray-400">无匹配表</p>
          ) : null}
          {tables.map((table) => {
            const active =
              selection?.schema === schema && selection?.table === table.name;
            const added = addedTableNames
              ? isTableAdded({ schema, table: table.name }, addedTableNames)
              : false;
            const isCurrent = isCurrentTable({ schema, table: table.name }, currentTableName);
            const pickable = Boolean(onAddTable);
            const isDatasetPick = mode === "datasetPick";
            const handleTableClick = () => {
              onSelectTable(schema, table);
              if (isDatasetPick && onPickTable) {
                onPickTable({ schema, table: table.name, type: table.type });
              }
            };
            return (
              <div
                key={table.name}
                className={cn(
                  "group flex w-full items-center gap-1 rounded-lg pr-1 transition-colors",
                  active || isCurrent
                    ? "bg-brand-50 dark:bg-brand-500/15"
                    : "hover:bg-white dark:hover:bg-white/5",
                )}
              >
                <button
                  type="button"
                  onClick={handleTableClick}
                  onDoubleClick={() => {
                    if (isDatasetPick || !pickable || added) return;
                    onAddTable?.({ schema, table: table.name, type: table.type });
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-theme-sm transition-colors",
                    active || isCurrent
                      ? "font-medium text-brand-700 dark:text-brand-400"
                      : "text-gray-700 dark:text-gray-300",
                  )}
                >
                  <Table2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  <TruncateHint
                    title={isDatasetPick ? `${schema}.${table.name}` : table.name}
                    className="min-w-0 flex-1"
                  >
                    {isDatasetPick ? `${schema}.${table.name}` : table.name}
                  </TruncateHint>
                </button>
                {isDatasetPick && isCurrent ? (
                  <span
                    className="mr-2 flex size-7 shrink-0 items-center justify-center text-success-600 dark:text-success-400"
                    aria-label="当前数据表"
                    title="当前数据表"
                  >
                    <Check className="size-3.5" aria-hidden />
                  </span>
                ) : null}
                {!isDatasetPick && pickable ? (
                  added ? (
                    <span
                      className="mr-2 flex size-7 shrink-0 items-center justify-center text-success-600 dark:text-success-400"
                      aria-label="已加入 Dataset"
                      title="已加入"
                    >
                      <Check className="size-3.5" aria-hidden />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-brand-50 hover:text-brand-600 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/20 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                      aria-label={`添加 ${table.name}`}
                      title="添加此表"
                      onClick={() =>
                        onAddTable?.({ schema, table: table.name, type: table.type })
                      }
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type SchemaTreePanelProps = {
  dataSourceId: string;
  userSchemas: string[];
  systemSchemas: string[];
  hideSystem: boolean;
  defaultDatabase?: string;
  searchQuery: string;
  expandedSchemas: Record<string, boolean>;
  selection: TableSelection | null;
  mode?: "browse" | "datasetPick";
  currentTableName?: string;
  onToggleSchema: (schema: string) => void;
  onSelectTable: (schema: string, table: TableMeta) => void;
  onTablesLoaded: (schema: string, tables: TableMeta[]) => void;
  onPickTable?: (selection: TableSelection) => void;
  addedTableNames?: ReadonlySet<string>;
  onAddTable?: (selection: TableSelection) => void;
};

export function SchemaTreePanel({
  dataSourceId,
  userSchemas,
  systemSchemas,
  hideSystem,
  defaultDatabase,
  searchQuery,
  expandedSchemas,
  selection,
  mode = "browse",
  currentTableName,
  onToggleSchema,
  onSelectTable,
  onTablesLoaded,
  onPickTable,
  addedTableNames,
  onAddTable,
}: SchemaTreePanelProps) {
  const visibleSystem = hideSystem
    ? []
    : systemSchemas.filter((s) => matchesSearch(s, searchQuery));

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-gray-50/60 dark:bg-white/[0.02]",
        mode === "browse" && "border-r border-gray-200 dark:border-gray-800",
      )}
    >
      {mode !== "datasetPick" ? (
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-theme-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Schema / 表
          </p>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {userSchemas.length === 0 && visibleSystem.length === 0 ? (
          <p className="px-2 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            无匹配结果
          </p>
        ) : (
          <>
            {userSchemas.map((schema) => (
              <SchemaGroup
                key={schema}
                dataSourceId={dataSourceId}
                schema={schema}
                expanded={Boolean(expandedSchemas[schema])}
                isDefault={schema === defaultDatabase}
                searchQuery={searchQuery}
                selection={selection}
                mode={mode}
                currentTableName={currentTableName}
                onToggle={() => onToggleSchema(schema)}
                onSelectTable={onSelectTable}
                onTablesLoaded={onTablesLoaded}
                onPickTable={onPickTable}
                addedTableNames={addedTableNames}
                onAddTable={onAddTable}
              />
            ))}
            {visibleSystem.length > 0 ? (
              <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-800">
                <p className="mb-1 px-3 text-theme-xs text-gray-400 dark:text-gray-500">系统库</p>
                {visibleSystem.map((schema) => (
                  <SchemaGroup
                    key={schema}
                    dataSourceId={dataSourceId}
                    schema={schema}
                    expanded={Boolean(expandedSchemas[schema])}
                    isDefault={false}
                    searchQuery={searchQuery}
                    selection={selection}
                    mode={mode}
                    currentTableName={currentTableName}
                    onToggle={() => onToggleSchema(schema)}
                    onSelectTable={onSelectTable}
                    onTablesLoaded={onTablesLoaded}
                    onPickTable={onPickTable}
                    addedTableNames={addedTableNames}
                    onAddTable={onAddTable}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
