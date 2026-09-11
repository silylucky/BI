/** SQL→Dataset 迁移残留的中文别名 → 物理列（与官方示例表对齐） */
export const LEGACY_SQL_FIELD_ALIASES: Record<string, string> = {
  网格: "grid_name",
  事件数: "event_count",
  已办结: "resolved_count",
  省份: "province",
  城市: "city",
  区县: "district",
  服务量: "service_volume",
  事件类型: "incident_type",
  数量: "count",
  热词: "word",
  权重: "weight",
  问题类型: "issue_type",
  地点: "location",
  责任单位: "unit",
  状态: "status",
  进度: "progress",
  类别: "category",
  支出金额: "spent_amount",
  产业: "industry",
  投资额: "investment_amount",
  指标: "metric_name",
  数值: "value",
};

export function remapLegacySqlField(field: string): string {
  const trimmed = field.trim();
  return LEGACY_SQL_FIELD_ALIASES[trimmed] ?? trimmed;
}

type FieldRef = { field?: string; label?: string | null };

function remapFieldRef<T extends FieldRef>(item: T): T {
  if (!item?.field) return item;
  const next = remapLegacySqlField(item.field);
  return next === item.field ? item : { ...item, field: next };
}

function remapFieldList(list: FieldRef[] | undefined): FieldRef[] | undefined {
  if (!list) return list;
  return list.map((item) => remapFieldRef(item));
}

/** 把 chartConfig 里残留中文 SQL 别名改回物理列名 */
export function remapLegacySqlFieldsInChartConfig<T extends {
  dimensions?: FieldRef[];
  metrics?: FieldRef[];
  axes?: Record<string, FieldRef[] | undefined>;
}>(config: T): T {
  const axes = config.axes;
  const nextAxes = axes
    ? Object.fromEntries(
        Object.entries(axes).map(([key, value]) => [key, remapFieldList(value)]),
      )
    : axes;
  return {
    ...config,
    dimensions: remapFieldList(config.dimensions) as T["dimensions"],
    metrics: remapFieldList(config.metrics) as T["metrics"],
    axes: nextAxes as T["axes"],
  };
}
