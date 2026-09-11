import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Database,
  FileSpreadsheet,
  Globe,
  Layers,
  Puzzle,
} from "lucide-react";

export type DisplayGroup = "oltp" | "olap" | "warehouse" | "file" | "api" | "extension";

export const DISPLAY_GROUP_ORDER: readonly DisplayGroup[] = [
  "oltp",
  "olap",
  "warehouse",
  "file",
  "api",
  "extension",
] as const;

export const DISPLAY_GROUP_META: Record<DisplayGroup, { label: string; description: string }> = {
  oltp: { label: "关系型数据库", description: "MySQL、PostgreSQL、信创关系型等 OLTP 引擎" },
  olap: { label: "OLAP", description: "ClickHouse、Doris、StarRocks 等分析型引擎" },
  warehouse: { label: "数仓/湖仓", description: "Hive、Impala、Trino 等湖仓查询引擎" },
  file: { label: "文件", description: "Excel、CSV 等文件数据源" },
  api: { label: "API", description: "REST API 等接口型数据源" },
  extension: { label: "更多", description: "时序、搜索、文档库等扩展类型" },
};

export type ConnectorTypeItem = {
  type: string;
  displayName: string;
  category: string;
  capabilities: string[];
  displayGroup: DisplayGroup;
  categoryLabel: string;
  queryCapable: boolean;
  queryMode: "sql" | "native" | null;
  syncCapable: boolean;
  syncFetchImplemented: boolean;
};

/** API 原始项（兼容 camelCase / snake_case；缺 displayGroup 时由 category 推导） */
export type RawConnectorTypeItem = {
  type: string;
  displayName?: string;
  display_name?: string;
  category: string;
  capabilities?: string[];
  displayGroup?: string;
  display_group?: string;
  categoryLabel?: string;
  category_label?: string;
  queryCapable?: boolean;
  query_capable?: boolean;
  queryMode?: string | null;
  query_mode?: string | null;
  syncCapable?: boolean;
  sync_capable?: boolean;
  syncFetchImplemented?: boolean;
  sync_fetch_implemented?: boolean;
};

const CATEGORY_TO_DISPLAY_GROUP: Record<string, DisplayGroup> = {
  relational: "oltp",
  olap: "olap",
  lake: "warehouse",
  file: "file",
  api: "api",
  timeseries: "extension",
  search: "extension",
  document: "extension",
  embedded: "extension",
};

const DISPLAY_GROUP_SET = new Set<string>(DISPLAY_GROUP_ORDER);

export function resolveDisplayGroupFromCategory(
  category: string,
  rawGroup?: string | null,
): DisplayGroup {
  if (rawGroup && DISPLAY_GROUP_SET.has(rawGroup)) {
    return rawGroup as DisplayGroup;
  }
  return CATEGORY_TO_DISPLAY_GROUP[category] ?? "extension";
}

export function normalizeConnectorTypeItem(raw: RawConnectorTypeItem): ConnectorTypeItem {
  const displayGroup = resolveDisplayGroupFromCategory(
    raw.category,
    raw.displayGroup ?? raw.display_group,
  );
  const queryCapable = raw.queryCapable ?? raw.query_capable ?? false;
  const rawMode = raw.queryMode ?? raw.query_mode ?? null;
  const queryMode =
    rawMode === "sql" || rawMode === "native" ? rawMode : queryCapable ? "sql" : null;
  const syncCapable = raw.syncCapable ?? raw.sync_capable ?? queryCapable;
  const syncFetchImplemented =
    raw.syncFetchImplemented ?? raw.sync_fetch_implemented ?? false;
  return {
    type: raw.type,
    displayName: raw.displayName ?? raw.display_name ?? raw.type,
    category: raw.category,
    capabilities: raw.capabilities ?? [],
    displayGroup,
    categoryLabel:
      raw.categoryLabel ?? raw.category_label ?? DISPLAY_GROUP_META[displayGroup].label,
    queryCapable,
    queryMode: queryCapable ? queryMode : null,
    syncCapable,
    syncFetchImplemented,
  };
}

export function normalizeConnectorTypes(items: RawConnectorTypeItem[]): ConnectorTypeItem[] {
  return items.map(normalizeConnectorTypeItem);
}

const TYPE_ICON: Partial<Record<string, LucideIcon>> = {
  mysql: Database,
  postgresql: Database,
  starrocks: BarChart3,
  clickhouse: BarChart3,
  hive: Layers,
  trino: Layers,
  excel: FileSpreadsheet,
  csv: FileSpreadsheet,
  rest_api: Globe,
  roapi: Globe,
};

const GROUP_FALLBACK_ICON: Record<DisplayGroup, LucideIcon> = {
  oltp: Database,
  olap: BarChart3,
  warehouse: Layers,
  file: FileSpreadsheet,
  api: Globe,
  extension: Puzzle,
};

export function groupTypesByDisplayGroup(
  items: ConnectorTypeItem[],
): Map<DisplayGroup, ConnectorTypeItem[]> {
  const map = new Map<DisplayGroup, ConnectorTypeItem[]>();
  for (const group of DISPLAY_GROUP_ORDER) {
    map.set(group, []);
  }
  for (const item of items) {
    const bucket = map.get(item.displayGroup) ?? map.get("extension")!;
    bucket.push(item);
  }
  return map;
}

export function connectorTypeIcon(type: string, group: DisplayGroup): LucideIcon {
  return TYPE_ICON[type] ?? GROUP_FALLBACK_ICON[group];
}

export function firstNonEmptyGroup(map: Map<DisplayGroup, ConnectorTypeItem[]>): DisplayGroup {
  for (const group of DISPLAY_GROUP_ORDER) {
    if ((map.get(group)?.length ?? 0) > 0) return group;
  }
  return "oltp";
}
