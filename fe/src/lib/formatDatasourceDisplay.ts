export type DatasourceDisplayFields = {
  name?: string;
  code?: string;
  type?: string;
  host?: string;
  port?: number;
  database?: string;
};

/** 由数据连接登记信息拼出可读连接摘要（不写死产品名或库名）。 */
export function formatDatasourceEndpoint(ds: DatasourceDisplayFields): string {
  const segments: string[] = [];
  const type = ds.type?.trim();
  const host = ds.host?.trim();
  const database = ds.database?.trim();
  const code = ds.code?.trim();

  if (type) segments.push(type);
  if (host) {
    const hostPort = ds.port ? `${host}:${ds.port}` : host;
    segments.push(database ? `${hostPort}/${database}` : hostPort);
  } else if (database) {
    segments.push(database);
  }
  if (code) segments.push(`code ${code}`);

  return segments.join(" · ") || "—";
}

export function formatSyncDatasourceDisplay(ds: DatasourceDisplayFields) {
  const structured = formatSyncDatasourceStructured(ds);
  return {
    name: structured.name,
    endpoint: formatDatasourceEndpoint(ds),
    structured,
  };
}

export type SyncDatasourceStructured = {
  name: string;
  type: string | null;
  connectionLine: string | null;
  code: string | null;
};

export function formatSyncDatasourceStructured(ds: DatasourceDisplayFields): SyncDatasourceStructured {
  const name = ds.name?.trim() || "—";
  const type = ds.type?.trim() || null;
  const host = ds.host?.trim();
  const database = ds.database?.trim();
  const code = ds.code?.trim() || null;

  let connectionLine: string | null = null;
  if (host) {
    const hostPort = ds.port ? `${host}:${ds.port}` : host;
    connectionLine = database ? `${hostPort} / ${database}` : hostPort;
  } else if (database) {
    connectionLine = database;
  }

  return { name, type, connectionLine, code };
}
