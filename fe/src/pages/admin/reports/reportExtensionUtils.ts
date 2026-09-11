import { ApiRequestError } from "@/lib/api";
import {
  resolveAnalyticsDatasourceId,
  type DatasourceListItem,
} from "@/lib/datasourceRoles";
import type { ExtensionMetric } from "./useReportTemplates";

export type ExtensionConfig = {
  catalogNodeId: string;
  metrics: ExtensionMetric[];
  filters: Array<{ key: string; operator: string }>;
  changeNote?: string | null;
  defaultDataSourceId?: string | null;
  revision?: number;
};

function readString(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function normalizeMetric(raw: Record<string, unknown>): ExtensionMetric {
  const queryModeRaw = raw.queryMode ?? raw.query_mode;
  return {
    key: String(raw.key ?? ""),
    label: String(raw.label ?? ""),
    visible: raw.visible !== false,
    queryMode: queryModeRaw === "dataset" ? "dataset" : "sql",
    expression: readString(raw.expression),
    datasetId: readString(raw.datasetId ?? raw.dataset_id),
    boundConfigId: readString(raw.boundConfigId ?? raw.bound_config_id),
    compareMode: readString(raw.compareMode ?? raw.compare_mode) ?? "none",
  };
}

export function normalizeExtensionResponse(raw: unknown): ExtensionConfig {
  const body = (raw ?? {}) as Record<string, unknown>;
  const catalogNodeId = String(body.catalogNodeId ?? body.catalog_node_id ?? "");
  return {
    catalogNodeId,
    metrics: (Array.isArray(body.metrics) ? body.metrics : []).map((item) =>
      normalizeMetric(item as Record<string, unknown>),
    ),
    filters: (Array.isArray(body.filters) ? body.filters : []).map((item) => {
      const filter = item as Record<string, unknown>;
      return {
        key: String(filter.key ?? ""),
        operator: String(filter.operator ?? ""),
      };
    }),
    changeNote: readString(body.changeNote ?? body.change_note),
    defaultDataSourceId: readString(body.defaultDataSourceId ?? body.default_data_source_id),
    revision: typeof body.revision === "number" ? body.revision : undefined,
  };
}

export function emptyExtensionConfig(nodeId: string): ExtensionConfig {
  return { catalogNodeId: nodeId, metrics: [], filters: [] };
}

export function isExtensionNotFoundError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.code === "RPT_EXT_NODE_NOT_FOUND";
}

export const METRIC_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function metricKeyValidationMessage(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "请填写指标键";
  if (!METRIC_KEY_PATTERN.test(trimmed)) {
    return "指标键须以小写字母开头，仅含小写字母、数字与下划线（如 revenue）";
  }
  return null;
}

/** 扩展里存在 SQL 指标时，才需要用户手选运行数据源。 */
export function extensionNeedsSqlDatasourcePicker(metrics: ExtensionMetric[]): boolean {
  return metrics.some((m) => {
    if (!m.visible && m.visible !== undefined) return false;
    if (m.queryMode === "dataset") return false;
    return m.queryMode === "sql" || Boolean(m.expression?.trim());
  });
}

export function resolveExtensionDefaultDataSourceId(
  metrics: ExtensionMetric[],
  dsItems: DatasourceListItem[],
  explicitId: string,
): string {
  const trimmed = explicitId.trim();
  if (trimmed) return trimmed;
  if (!extensionNeedsSqlDatasourcePicker(metrics)) {
    return resolveAnalyticsDatasourceId(dsItems);
  }
  return "";
}
