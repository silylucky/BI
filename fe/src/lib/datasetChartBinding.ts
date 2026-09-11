import { apiFetch } from "@/lib/api";
import { DEFAULT_CHART_RESULT_LIMIT } from "@/lib/chartQueryLimitDefaults";
import { resetChartExecuteSharedInflight } from "@/lib/chartExecuteProbe";
import { randomId } from "@/lib/randomId";
import type { DatasetFieldKind } from "@/components/dashboard/datasetFieldClassification";
import { parseQualifiedTable } from "@/lib/datasetTableUtils";

export type DatasetQueryConfigPayload = {
  dataSourceId: string;
  connectorType: string;
  schema: string;
  table: string;
  columns: string[];
  columnKinds?: Record<string, DatasetFieldKind>;
  conditions: { logic: "AND"; conditions: [] };
  limit: number;
  offset: number;
};

type QueryConfigRecord = {
  id: string;
  revision?: number;
  configType: string;
  refType?: string;
  refId?: string;
  payload: DatasetQueryConfigPayload & Record<string, unknown>;
};

export type DatasetChartBinding = {
  configId: string;
  revision?: number;
  dataSourceId?: string;
  columns?: string[];
  columnKinds?: Record<string, DatasetFieldKind>;
  schema?: string;
  table?: string;
};

export type DatasetBindResult = {
  configId: string;
  revision: number;
};

function parseColumnKinds(raw: unknown): Record<string, DatasetFieldKind> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, DatasetFieldKind> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "dimension" || value === "metric") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildDatasetQueryPayload(params: {
  dataSourceId: string;
  connectorType: string;
  schema: string;
  table: string;
  columns: string[];
  columnKinds?: Record<string, DatasetFieldKind>;
}): DatasetQueryConfigPayload {
  const payload: DatasetQueryConfigPayload = {
    dataSourceId: params.dataSourceId,
    connectorType: params.connectorType,
    schema: params.schema,
    table: params.table,
    columns: params.columns,
    conditions: { logic: "AND", conditions: [] },
    limit: DEFAULT_CHART_RESULT_LIMIT,
    offset: 0,
  };
  if (params.columnKinds && Object.keys(params.columnKinds).length > 0) {
    const filtered: Record<string, DatasetFieldKind> = {};
    for (const col of params.columns) {
      const kind = params.columnKinds[col];
      if (kind) filtered[col] = kind;
    }
    if (Object.keys(filtered).length > 0) payload.columnKinds = filtered;
  }
  return payload;
}

export async function fetchDatasetQueryConfig(configId: string): Promise<DatasetChartBinding> {
  const record = await apiFetch<QueryConfigRecord>(`/api/v1/query/configs/${configId}`);
  const payload = record.payload ?? {};
  const dataSourceId =
    typeof payload.dataSourceId === "string" ? payload.dataSourceId : undefined;
  const columns = Array.isArray(payload.columns)
    ? payload.columns.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  const schema = typeof payload.schema === "string" ? payload.schema : undefined;
  const table = typeof payload.table === "string" ? payload.table : undefined;
  const columnKinds = parseColumnKinds(payload.columnKinds);
  return {
    configId: record.id,
    revision: record.revision,
    dataSourceId,
    columns,
    columnKinds,
    schema,
    table,
  };
}

export async function resolveDatasetChartBinding(configId: string): Promise<DatasetChartBinding> {
  return fetchDatasetQueryConfig(configId);
}

/** 新建或原地更新 dataset_query；已有 boundConfigId 时复用 ref 以避免孤儿配置。 */
export async function saveAndBindDatasetQueryConfig(params: {
  datasetId: string;
  boundConfigId?: string | null;
  dataSourceId: string;
  connectorType: string;
  tableName: string;
  columns: string[];
  columnKinds?: Record<string, DatasetFieldKind>;
}): Promise<DatasetBindResult> {
  const { schema, table } = parseQualifiedTable(params.tableName);
  const payload = buildDatasetQueryPayload({
    dataSourceId: params.dataSourceId,
    connectorType: params.connectorType,
    schema,
    table,
    columns: params.columns,
    columnKinds: params.columnKinds,
  });

  let refType = "dataset";
  let refId = randomId();

  if (params.boundConfigId) {
    const existing = await apiFetch<QueryConfigRecord>(
      `/api/v1/query/configs/${params.boundConfigId}`,
    );
    refType = existing.refType ?? "dataset";
    refId = existing.refId ?? refId;
  }

  const cfg = await apiFetch<{ id: string; revision: number }>("/api/v1/query/configs", {
    method: "PUT",
    body: JSON.stringify({
      configType: "dataset_query",
      schemaVersion: "1.0",
      refType,
      refId,
      payload,
    }),
  });

  if (!params.boundConfigId || cfg.id !== params.boundConfigId) {
    await apiFetch(`/api/v1/datasets/${params.datasetId}/bind-query-config`, {
      method: "POST",
      body: JSON.stringify({ configId: cfg.id }),
    });
  }

  resetChartExecuteSharedInflight();
  return { configId: cfg.id, revision: cfg.revision ?? 1 };
}

/** @deprecated 使用 saveAndBindDatasetQueryConfig */
export async function createAndBindDatasetQueryConfig(params: {
  datasetId: string;
  dataSourceId: string;
  connectorType: string;
  tableName: string;
  columns: string[];
  columnKinds?: Record<string, DatasetFieldKind>;
}): Promise<DatasetBindResult> {
  return saveAndBindDatasetQueryConfig(params);
}

export async function persistDatasetBind(params: {
  datasetId: string;
  boundConfigId?: string | null;
  dataSourceId: string;
  connectorType: string;
  tableName: string;
  selectedColumns: string[];
  columnKinds?: Record<string, DatasetFieldKind>;
}): Promise<DatasetBindResult> {
  return saveAndBindDatasetQueryConfig({
    datasetId: params.datasetId,
    boundConfigId: params.boundConfigId,
    dataSourceId: params.dataSourceId,
    connectorType: params.connectorType,
    tableName: params.tableName,
    columns: params.selectedColumns,
    columnKinds: params.columnKinds,
  });
}
