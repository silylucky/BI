export type DatasetFieldKind = "dimension" | "metric";

/** 可聚合的数值型业务度量（对标 DataEase 指标） */
const METRIC_PATTERN =
  /(?:^|_)(amount|amt|count|cnt|qty|quantity|price|total|sum|avg|rate|score|value|values|记录数)(?:$|_)/i;

/** 时间、地域、名称、标识类维度 */
const DIMENSION_PATTERN =
  /(?:^|_)(date|time|day|month|year|week|region|area|city|province|country|product|category|channel|name|type|status|label|dim|code)(?:$|_)|^id$|_id$/i;

export function classifyDatasetField(field: string): DatasetFieldKind {
  const normalized = field.trim();
  if (!normalized) return "dimension";
  if (normalized === "记录数" || normalized.endsWith("*")) return "metric";
  if (DIMENSION_PATTERN.test(normalized)) return "dimension";
  if (METRIC_PATTERN.test(normalized)) return "metric";
  return "dimension";
}

export function resolveFieldKind(
  field: string,
  overrides?: Record<string, DatasetFieldKind>,
): DatasetFieldKind {
  return overrides?.[field] ?? classifyDatasetField(field);
}

export function groupDatasetFields(
  fields: string[],
  overrides?: Record<string, DatasetFieldKind>,
): {
  dimensions: string[];
  metrics: string[];
} {
  const dimensions: string[] = [];
  const metrics: string[] = [];
  for (const field of fields) {
    if (resolveFieldKind(field, overrides) === "metric") {
      metrics.push(field);
    } else {
      dimensions.push(field);
    }
  }
  return { dimensions, metrics };
}

/** 绑定出图配置时的默认列：按维/指标分类，避免把全部物理列一股脑写入。 */
export function suggestDatasetBindColumns(columns: string[]): string[] {
  if (columns.length === 0) return [];
  const { dimensions, metrics } = groupDatasetFields(columns);
  const picked = [...new Set([...dimensions, ...metrics])];
  return picked.length > 0 ? picked : [...columns];
}

export function fieldDisplayKind(
  field: string,
  overrides?: Record<string, DatasetFieldKind>,
): "date" | "text" | "number" {
  const kind = resolveFieldKind(field, overrides);
  if (kind === "metric") return "number";
  if (/(?:^|_)(date|time|day|month|year|week)(?:$|_)/i.test(field)) return "date";
  return "text";
}
