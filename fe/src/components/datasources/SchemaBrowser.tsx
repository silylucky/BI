import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, FolderTree } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SchemaTreePanel } from "./SchemaTreePanel";
import {
  mapMetadataError,
  matchesSearch,
  partitionSchemas,
  type TableMeta,
  type TableSelection,
} from "./schemaBrowserUtils";
import { TableColumnsPanel } from "./TableColumnsPanel";

type SchemaItem = { name: string };

export function SchemaBrowser({
  dataSourceId,
  className,
  embedded = false,
  defaultDatabase,
  focusTable,
  mode = "browse",
  currentTableName,
  onPickTable,
  onSelectionChange,
  toolbarActions,
  addedTableNames,
  onAddTable,
}: {
  dataSourceId: string;
  className?: string;
  embedded?: boolean;
  defaultDatabase?: string;
  focusTable?: { schema: string; table: string };
  mode?: "browse" | "datasetPick";
  currentTableName?: string;
  onPickTable?: (selection: TableSelection) => void;
  onSelectionChange?: (selection: TableSelection | null) => void;
  toolbarActions?: ReactNode;
  /** Dataset 选表：已加入的表名集合（browse 模式遗留） */
  addedTableNames?: ReadonlySet<string>;
  /** Dataset 选表：点击/双击添加（browse 模式遗留） */
  onAddTable?: (selection: TableSelection) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [hideSystem, setHideSystem] = useState(true);
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<TableSelection | null>(null);
  const initRef = useRef(false);

  const schemasQuery = useQuery({
    queryKey: queryKeys.datasources.schemas(dataSourceId),
    queryFn: () => apiFetch<{ items: SchemaItem[] }>(`/api/v1/datasources/${dataSourceId}/schemas`),
    enabled: Boolean(dataSourceId),
  });

  const schemaNames = useMemo(
    () => (schemasQuery.data?.items ?? []).map((s) => s.name),
    [schemasQuery.data?.items],
  );

  const { user: userSchemas, system: systemSchemas } = useMemo(
    () => partitionSchemas(schemaNames, defaultDatabase),
    [defaultDatabase, schemaNames],
  );

  const filteredUserSchemas = useMemo(
    () => userSchemas.filter((s) => matchesSearch(s, searchQuery)),
    [searchQuery, userSchemas],
  );

  useEffect(() => {
    initRef.current = false;
    setSelection(null);
    setExpandedSchemas({});
    setSearchQuery("");
  }, [dataSourceId]);

  useEffect(() => {
    if (!schemaNames.length || initRef.current) return;
    const preferred =
      (focusTable?.schema && schemaNames.includes(focusTable.schema) && focusTable.schema) ||
      (currentTableName?.includes(".") &&
        schemaNames.includes(currentTableName.split(".", 2)[0]) &&
        currentTableName.split(".", 2)[0]) ||
      (defaultDatabase && schemaNames.includes(defaultDatabase) && defaultDatabase) ||
      userSchemas[0] ||
      schemaNames[0];
    if (preferred) {
      setExpandedSchemas((s) => ({ ...s, [preferred]: true }));
    }
  }, [currentTableName, defaultDatabase, focusTable?.schema, schemaNames, userSchemas]);

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [onSelectionChange, selection]);

  const handleTablesLoaded = useCallback(
    (schema: string, tables: TableMeta[]) => {
      if (initRef.current || !tables.length) return;
      if (focusTable && focusTable.schema === schema) {
        const match = tables.find((t) => t.name === focusTable.table);
        if (match) {
          initRef.current = true;
          setSelection({ schema, table: match.name, type: match.type });
          return;
        }
      }
      initRef.current = true;
      setSelection({ schema, table: tables[0].name, type: tables[0].type });
    },
    [focusTable],
  );

  const handleToggleSchema = (schema: string) => {
    setExpandedSchemas((s) => ({ ...s, [schema]: !s[schema] }));
  };

  const handleSelectTable = (schema: string, table: TableMeta) => {
    setSelection({ schema, table: table.name, type: table.type });
  };

  const cardClassName = cn("flex h-full flex-col overflow-hidden", className);

  const renderHeader = (extra?: ReactNode) =>
    embedded ? null : (
      <CardHeader className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <FolderTree className="size-4" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-theme-base">元数据浏览</CardTitle>
              <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                Schema · 表 · 字段三级结构
              </p>
            </div>
          </div>
          {extra}
        </div>
      </CardHeader>
    );

  const browserBody = (content: ReactNode) => {
    if (embedded) {
      return <div className={cn("flex min-h-0 flex-1 flex-col", className)}>{content}</div>;
    }
    return (
      <Card elevation={1} className={cardClassName}>
        {content}
      </Card>
    );
  };

  if (schemasQuery.isLoading) {
    return browserBody(
      <CardContent className="p-5">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="mt-4 h-[360px] w-full rounded-xl" />
      </CardContent>,
    );
  }

  if (schemasQuery.isError) {
    const msg = mapMetadataError(schemasQuery.error);
    return browserBody(
      <CardContent className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
          <Database className="size-6" aria-hidden />
        </div>
        <p className="max-w-sm text-theme-sm text-error-700 dark:text-error-400">{msg}</p>
        <Button className="mt-4" variant="outline" size="sm" onClick={() => void schemasQuery.refetch()}>
          重试
        </Button>
      </CardContent>,
    );
  }

  if (schemaNames.length === 0) {
    return browserBody(
      <CardContent className="flex flex-1 items-center justify-center py-16">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">暂无 schema</p>
      </CardContent>,
    );
  }

  const isDatasetPick = mode === "datasetPick";

  const toolbar = (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-3 border-b border-gray-200 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between",
        embedded ? "px-4 py-2.5 sm:px-4" : "px-4 py-4 sm:px-5",
      )}
    >
      <SearchField
        className="w-full sm:max-w-xs"
        inputClassName="h-10"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="搜索 Schema 或表名…"
        aria-label="搜索元数据"
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="hide-system-schemas"
            checked={hideSystem}
            onCheckedChange={(v) => setHideSystem(v === true)}
          />
          <Label htmlFor="hide-system-schemas" className="cursor-pointer text-theme-sm text-gray-600 dark:text-gray-400">
            隐藏系统库
          </Label>
        </div>
        {toolbarActions}
        {isDatasetPick && onPickTable ? (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            单击表名设为当前数据表
          </p>
        ) : null}
        {!isDatasetPick && onAddTable ? (
          <p className="hidden text-theme-xs text-gray-500 lg:block dark:text-gray-400">
            双击表名或点 <span className="font-medium text-gray-700 dark:text-gray-300">+</span> 添加
          </p>
        ) : null}
        {!embedded ? (
          <Badge variant="light" color="light" size="sm">
            {schemaNames.length} 个 schema
          </Badge>
        ) : null}
      </div>
    </div>
  );

  const splitView = (
    <div
      className={cn(
        "grid min-h-0 flex-1 overflow-hidden",
        isDatasetPick ? "grid-cols-1" : "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]",
        !embedded && !isDatasetPick && "min-h-[420px]",
      )}
      data-testid="schema-browser-split"
    >
      <SchemaTreePanel
        dataSourceId={dataSourceId}
        userSchemas={filteredUserSchemas}
        systemSchemas={systemSchemas}
        hideSystem={hideSystem}
        defaultDatabase={defaultDatabase}
        searchQuery={searchQuery}
        expandedSchemas={expandedSchemas}
        selection={selection}
        mode={mode}
        currentTableName={currentTableName}
        onToggleSchema={handleToggleSchema}
        onSelectTable={handleSelectTable}
        onTablesLoaded={handleTablesLoaded}
        onPickTable={onPickTable}
        addedTableNames={addedTableNames}
        onAddTable={isDatasetPick ? undefined : onAddTable}
      />
      {!isDatasetPick ? (
        <TableColumnsPanel
          dataSourceId={dataSourceId}
          selection={selection}
          addedTableNames={addedTableNames}
          onAddTable={onAddTable}
        />
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col", className)} data-testid="schema-browser">
        {toolbar}
        {splitView}
      </div>
    );
  }

  return browserBody(
    <>
      {renderHeader(
        <Badge variant="light" color="light" size="sm">
          {schemaNames.length} 个 schema
        </Badge>,
      )}
      {toolbar}
      {splitView}
    </>,
  );
}
