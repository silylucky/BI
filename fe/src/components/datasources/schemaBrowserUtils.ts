import { mapApiError } from "@/lib/apiError";

const METADATA_MESSAGES: Record<string, string> = {
  METADATA_CONNECTION_FAILED: "无法连接数据源，请先在上方测试连通性",
  METADATA_POOL_EXHAUSTED: "数据源连接池繁忙，请点「测试连接」后重试",
  METADATA_TIMEOUT: "元数据查询超时，请稍后重试",
  METADATA_NOT_SUPPORTED: "该连接器不支持元数据浏览",
  METADATA_INVALID_REQUEST: "请求参数无效",
  RESOURCE_FORBIDDEN: "无权访问该数据源",
};

const SYSTEM_SCHEMA_PATTERN =
  /^(information_schema|performance_schema|mysql|sys|pg_.*|_timescaledb_.*|timescaledb_information)$/i;

export type TableMeta = { name: string; type: string };
export type ColumnMeta = { name: string; dataType: string; nullable: boolean };
export type TableSelection = { schema: string; table: string; type: string };

export function mapMetadataError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && METADATA_MESSAGES[code]) return METADATA_MESSAGES[code];
  return mapApiError(err);
}

export function qualifiedTableName(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function isTableAdded(
  selection: Pick<TableSelection, "schema" | "table">,
  addedNames: ReadonlySet<string>,
): boolean {
  const qualified = qualifiedTableName(selection.schema, selection.table);
  return addedNames.has(qualified) || addedNames.has(selection.table);
}

export function isCurrentTable(
  selection: Pick<TableSelection, "schema" | "table">,
  currentTableName?: string,
): boolean {
  if (!currentTableName?.trim()) return false;
  const qualified = qualifiedTableName(selection.schema, selection.table);
  return currentTableName === qualified || currentTableName === selection.table;
}

export function buildSelectSql(schema: string, table: string): string {
  return `SELECT * FROM ${qualifiedTableName(schema, table)} LIMIT 100`;
}

export function isSystemSchema(name: string): boolean {
  return SYSTEM_SCHEMA_PATTERN.test(name);
}

export function partitionSchemas(names: string[], defaultDatabase?: string) {
  const user: string[] = [];
  const system: string[] = [];
  for (const name of names) {
    (isSystemSchema(name) ? system : user).push(name);
  }
  const sortByDefault = (a: string, b: string) => {
    if (defaultDatabase) {
      if (a === defaultDatabase) return -1;
      if (b === defaultDatabase) return 1;
    }
    return a.localeCompare(b);
  };
  user.sort(sortByDefault);
  system.sort(sortByDefault);
  return { user, system };
}

export function matchesSearch(text: string, query: string): boolean {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

export function filterTables(tables: TableMeta[], query: string): TableMeta[] {
  if (!query.trim()) return tables;
  return tables.filter((t) => matchesSearch(t.name, query));
}
