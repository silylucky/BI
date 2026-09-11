export const ANALYTICS_DATASOURCE_CODE = "analytics";
export const ANALYTICS_DATASOURCE_NAME = "托管分析库";

export type DatasourceListItem = {
  id: string;
  name: string;
  code?: string;
  type?: string;
  host?: string;
  port?: number;
  database?: string;
};

/** sync 产物出图绑定：优先 code=analytics，否则 5433/analytics 的 PG。 */
export function filterSyncJobBindDatasources(items: DatasourceListItem[]): DatasourceListItem[] {
  const analytics = items.filter((item) => isAnalyticsDatasource(item.code ?? ""));
  if (analytics.length > 0) return analytics;
  return items.filter((item) => item.type === "postgresql" || item.type === "postgres");
}

export function resolveAnalyticsDatasourceId(
  items: DatasourceListItem[],
  preferred?: string,
): string {
  if (preferred && items.some((d) => d.id === preferred)) return preferred;
  const byCode = items.find((d) => isAnalyticsDatasource(d.code ?? ""));
  if (byCode) return byCode.id;
  const byConn = items.find(
    (d) =>
      (d.type === "postgresql" || d.type === "postgres") &&
      d.port === 5433 &&
      d.database === "analytics",
  );
  if (byConn) return byConn.id;
  return items[0]?.id ?? "";
}

/** 与后端 is_query_capable / is_sync_fetch_implemented 对齐：全部可查询连接器 */
const SYNC_CAPABLE_TYPES = new Set([
  "mysql",
  "mariadb",
  "tidb",
  "starrocks",
  "doris",
  "oceanbase",
  "gbase",
  "postgresql",
  "kingbase",
  "gaussdb",
  "redshift",
  "timescaledb",
  "clickhouse",
  "sqlite",
  "sqlserver",
  "oracle",
  "dm",
  "db2",
  "hive",
  "impala",
  "trino",
  "presto",
  "mongodb",
  "elasticsearch",
  "opensearch",
  "csv",
  "excel",
  "rest_api",
  "influxdb",
  "tdengine",
]);

export function isAnalyticsDatasource(code: string): boolean {
  return code === ANALYTICS_DATASOURCE_CODE;
}

export function isManagedAnalyticsDatasource(item: {
  code?: string | null;
  type?: string;
  port?: number;
  database?: string;
}): boolean {
  if (isAnalyticsDatasource(item.code ?? "")) return true;
  return (
    (item.type === "postgresql" || item.type === "postgres") &&
    item.port === 5433 &&
    item.database === "analytics"
  );
}

export function isSyncSourceCapable(type: string): boolean {
  return SYNC_CAPABLE_TYPES.has(type);
}

/** 可查询类型均支持同步拉数（与后端最终形态一致） */
export function isSyncFetchImplemented(type: string): boolean {
  return isSyncSourceCapable(type);
}
