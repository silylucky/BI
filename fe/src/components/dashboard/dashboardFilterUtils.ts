import type { FilterControlType, FilterOption, FilterWidgetConfig, LayoutWidget } from "./layoutUtils";

export type LinkageFilter = {
  filterId: string;
  dimensionRef: string;
  defaultValue?: string | null;
  controlType?: FilterControlType;
  options?: FilterOption[];
};

type Linkage = {
  filters: LinkageFilter[];
  linkageRules: { sourceFilterId: string; targetWidgetIds: string[]; parameterKey: string }[];
  refreshMode?: "eager" | "lazy";
};

/** 图表点击联动：源组件 → 参数键 → 目标组件 */
export type ChartLinkageRule = {
  sourceWidgetId: string;
  targetWidgetIds: string[];
  parameterKey: string;
};

export type ChartLinkageRuntime = {
  /** parameterKey → 最近点击的区域维度值 */
  params: Record<string, string>;
  rules: ChartLinkageRule[];
};

const UNSAFE = /[;]|--|\/\*/;

export function injectSqlParameters(sql: string, params: Record<string, string>): string {
  return sql.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) return `{{${key}}}`;
    if (UNSAFE.test(value)) {
      throw new Error("筛选值包含非法字符，请修改后重试");
    }
    return value.replace(/'/g, "''");
  });
}

export function buildWidgetFilterParams(
  widgetId: string,
  linkage: Linkage,
  filterValues: Record<string, string>,
  chartLinkage?: ChartLinkageRuntime | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of linkage.linkageRules) {
    if (!rule.targetWidgetIds.includes(widgetId)) continue;
    const value = filterValues[rule.sourceFilterId];
    if (value !== undefined && value !== "") out[rule.parameterKey] = value;
  }
  if (chartLinkage) {
    for (const rule of chartLinkage.rules) {
      if (rule.sourceWidgetId === widgetId) continue;
      if (!rule.targetWidgetIds.includes(widgetId)) continue;
      const value = chartLinkage.params[rule.parameterKey];
      if (value !== undefined && value !== "") out[rule.parameterKey] = value;
    }
  }
  return out;
}

/** 将画布筛选器组件合并进联动规则：默认绑定全部图表 widget */
export function mergeLayoutFilterLinkage(widgets: LayoutWidget[], linkage: Linkage | null): Linkage {
  const chartIds = widgets.filter((w) => w.type === "chart").map((w) => w.id);
  const filterWidgets = widgets.filter(
    (w): w is LayoutWidget & { filterConfig: FilterWidgetConfig } =>
      w.type === "filter" && Boolean(w.filterConfig),
  );

  const base: Linkage = linkage ?? { filters: [], linkageRules: [], refreshMode: "eager" };
  const filters = [...base.filters];
  const linkageRules = [...base.linkageRules];
  const knownFilterIds = new Set(filters.map((f) => f.filterId));
  const knownRuleKeys = new Set(linkageRules.map((r) => `${r.sourceFilterId}:${r.parameterKey}`));

  for (const fw of filterWidgets) {
    const cfg = fw.filterConfig;
    if (!knownFilterIds.has(cfg.filterId)) {
      filters.push({
        filterId: cfg.filterId,
        dimensionRef: cfg.dimensionRef,
        defaultValue: cfg.defaultValue,
        controlType: cfg.controlType,
        options: cfg.options,
      });
      knownFilterIds.add(cfg.filterId);
    }
    const parameterKey = cfg.parameterKey?.trim() || cfg.dimensionRef || "value";
    const ruleKey = `${cfg.filterId}:${parameterKey}`;
    if (!knownRuleKeys.has(ruleKey) && chartIds.length > 0) {
      linkageRules.push({
        sourceFilterId: cfg.filterId,
        targetWidgetIds: [...chartIds],
        parameterKey,
      });
      knownRuleKeys.add(ruleKey);
    }
  }

  const liveFilterIds = new Set(filterWidgets.map((fw) => fw.filterConfig.filterId));
  const prunedFilters = filters.filter((f) => liveFilterIds.has(f.filterId));
  const prunedFilterIds = new Set(prunedFilters.map((f) => f.filterId));
  const prunedRules = linkageRules.filter((rule) => prunedFilterIds.has(rule.sourceFilterId));

  return { ...base, filters: prunedFilters, linkageRules: prunedRules };
}

/** 保存前剔除已删除 widget 的联动目标，避免 global-filters PUT 422 */
export function sanitizeLinkageForSave(widgets: LayoutWidget[], linkage: Linkage): Linkage {
  const widgetIds = new Set(widgets.map((w) => w.id));
  const filterIds = new Set(linkage.filters.map((f) => f.filterId));
  const linkageRules = linkage.linkageRules
    .map((rule) => ({
      ...rule,
      targetWidgetIds: rule.targetWidgetIds.filter((id) => widgetIds.has(id)),
    }))
    .filter((rule) => filterIds.has(rule.sourceFilterId) && rule.targetWidgetIds.length > 0);

  return { ...linkage, linkageRules };
}

export function resolveFilterControlType(filter: LinkageFilter): FilterControlType {
  if (filter.controlType) return filter.controlType;
  if (filter.options && filter.options.length > 0) return "select";
  return "text";
}

export type { Linkage };
