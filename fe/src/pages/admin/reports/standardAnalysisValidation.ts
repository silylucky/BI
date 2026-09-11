import type { DatasetFieldKind } from "@/components/dashboard/datasetFieldClassification";
import {
  fieldDisplayKind,
  resolveFieldKind,
} from "@/components/dashboard/datasetFieldClassification";
import type { AnalysisPack, AnalysisTheme, FieldMapping, ThemeCapability } from "./useStandardAnalysis";
import { THEME_LABELS } from "./standardRoutes";

const THEME_FIELD_REQUIREMENTS: Record<AnalysisTheme, { key: keyof FieldMapping; label: string }> = {
  lifecycle: { key: "status", label: "状态" },
  distribution: { key: "region", label: "区域" },
  activity: { key: "createdAt", label: "时间" },
  trend: { key: "createdAt", label: "时间" },
};

const TIME_THEMES: AnalysisTheme[] = ["activity", "trend"];

/** 常见数值列名，误绑为时间字段时会导致伪日期（如 1970-01-01） */
const NUMERIC_TIME_FIELD_PATTERN =
  /^(amount|amt|qty|quantity|count|cnt|num|number|price|total|sum|value|score|rate|fee|cost|sales|revenue|sale_count)$/i;

const FIELD_CANDIDATES: Record<keyof FieldMapping, string[]> = {
  status: ["status", "state", "lifecycle", "type", "category"],
  region: ["region", "area", "city", "province", "district", "region_map"],
  createdAt: [
    "sale_date",
    "created_at",
    "createdat",
    "create_time",
    "updated_at",
    "event_time",
    "order_date",
    "biz_date",
  ],
};

const REGION_PRIORITY = ["city", "province", "district", "region", "area", "region_map"] as const;

const STATUS_PRIORITY = ["status", "state", "lifecycle", "type", "category", "channel"] as const;

function columnLookup(columns: string[]): Map<string, string> {
  return new Map(columns.map((column) => [column.toLowerCase(), column]));
}

function pickByCandidates(lookup: Map<string, string>, candidates: readonly string[]): string {
  for (const candidate of candidates) {
    const hit = lookup.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return "";
}

function isMetricColumn(column: string, columnKinds?: Record<string, DatasetFieldKind>): boolean {
  return resolveFieldKind(column, columnKinds) === "metric";
}

function isKnownDateColumnName(column: string): boolean {
  return FIELD_CANDIDATES.createdAt.some((candidate) => candidate.toLowerCase() === column.toLowerCase());
}

function isDateColumn(column: string, columnKinds?: Record<string, DatasetFieldKind>): boolean {
  if (isMetricColumn(column, columnKinds)) return false;
  if (NUMERIC_TIME_FIELD_PATTERN.test(column)) return false;
  if (isKnownDateColumnName(column)) return true;
  return fieldDisplayKind(column, columnKinds) === "date";
}

function isInvalidTimeMapping(
  column: string,
  columnKinds?: Record<string, DatasetFieldKind>,
): boolean {
  if (!column) return true;
  return !isDateColumn(column, columnKinds);
}

function pickRegionColumn(
  columns: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): string {
  const lookup = columnLookup(columns);
  const exact = pickByCandidates(lookup, REGION_PRIORITY);
  if (exact && !isMetricColumn(exact, columnKinds)) return exact;

  for (const column of columns) {
    if (isMetricColumn(column, columnKinds)) continue;
    if (/(?:^|_)(region|area|city|province|district|country)(?:$|_)/i.test(column)) {
      return column;
    }
  }
  return "";
}

function pickStatusColumn(
  columns: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
  exclude = new Set<string>(),
): string {
  const lookup = columnLookup(columns);
  const exact = pickByCandidates(lookup, STATUS_PRIORITY);
  if (exact && !exclude.has(exact) && !isMetricColumn(exact, columnKinds)) return exact;

  for (const column of columns) {
    if (exclude.has(column) || isMetricColumn(column, columnKinds)) continue;
    if (isDateColumn(column, columnKinds)) continue;
    if (/(?:^|_)(status|state|type|category|channel|label)(?:$|_)/i.test(column)) {
      return column;
    }
  }
  return "";
}

function pickCreatedAtColumn(
  columns: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): string {
  const lookup = columnLookup(columns);
  const exact = pickByCandidates(lookup, FIELD_CANDIDATES.createdAt);
  if (exact && !isInvalidTimeMapping(exact, columnKinds)) return exact;

  for (const column of columns) {
    if (isDateColumn(column, columnKinds)) return column;
  }
  return "";
}

export function suggestStandardFieldMapping(
  columns: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): FieldMapping {
  if (columns.length === 0) {
    return { status: "", region: "", createdAt: "" };
  }

  const region = pickRegionColumn(columns, columnKinds);
  const regionSet = region ? new Set([region]) : new Set<string>();
  const status = pickStatusColumn(columns, columnKinds, regionSet);
  const createdAt = pickCreatedAtColumn(columns, columnKinds);

  return { status, region, createdAt };
}

function mappingValueInColumns(value: string, columns: string[]): boolean {
  if (!value.trim()) return false;
  const lookup = columnLookup(columns);
  return lookup.has(value.toLowerCase());
}

export function mergeSuggestedFieldMapping(
  current: FieldMapping,
  columns: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): FieldMapping {
  if (columns.length === 0) return current;

  const suggested = suggestStandardFieldMapping(columns, columnKinds);

  const resolveSlot = (
    key: keyof FieldMapping,
    isInvalid: (value: string) => boolean,
  ): string => {
    const currentValue = current[key]?.trim() ?? "";
    if (currentValue && mappingValueInColumns(currentValue, columns) && !isInvalid(currentValue)) {
      return currentValue;
    }
    return suggested[key] || "";
  };

  return {
    status: resolveSlot("status", () => false),
    region: resolveSlot("region", () => false),
    createdAt: resolveSlot("createdAt", (value) => isInvalidTimeMapping(value, columnKinds)),
  };
}

export type MappingFieldRole = keyof FieldMapping;

export function listMappingColumnOptions(
  role: MappingFieldRole,
  columns: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): string[] {
  if (columns.length === 0) return [];

  if (role === "createdAt") {
    const dateColumns = columns.filter((column) => isDateColumn(column, columnKinds));
    return dateColumns.length > 0 ? dateColumns : columns.filter((column) => !isMetricColumn(column, columnKinds));
  }

  if (role === "region") {
    const geoColumns = columns.filter(
      (column) =>
        !isMetricColumn(column, columnKinds) &&
        (REGION_PRIORITY.some((candidate) => candidate.toLowerCase() === column.toLowerCase()) ||
          /(?:^|_)(region|area|city|province|district|country)(?:$|_)/i.test(column)),
    );
    return geoColumns.length > 0 ? geoColumns : columns.filter((column) => !isMetricColumn(column, columnKinds));
  }

  return columns.filter(
    (column) => !isMetricColumn(column, columnKinds) && !isDateColumn(column, columnKinds),
  );
}

export function validateCreatedAtFieldMapping(
  draft: AnalysisPack,
  columnKinds?: Record<string, DatasetFieldKind>,
): string | null {
  const needsTime = draft.enabledThemes.some((theme) => TIME_THEMES.includes(theme));
  if (!needsTime) return null;

  const createdAt = draft.fieldMapping.createdAt?.trim();
  if (!createdAt) return null;

  if (columnKinds?.[createdAt] === "metric") {
    return `时间字段「${createdAt}」在数据集中被标记为指标，请选择日期或时间类型列`;
  }

  if (NUMERIC_TIME_FIELD_PATTERN.test(createdAt)) {
    return `时间字段「${createdAt}」疑似数值列，活跃度与趋势将无法正确解析日期`;
  }

  if (!isDateColumn(createdAt, columnKinds)) {
    return `时间字段「${createdAt}」不像日期列；当前数据集若无日期字段，请关闭活跃度与趋势主题`;
  }

  return null;
}

const ALL_ANALYSIS_THEMES: AnalysisTheme[] = ["lifecycle", "distribution", "activity", "trend"];

export function evaluateDraftThemeCapabilities(
  draft: AnalysisPack,
  columnOptions: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): ThemeCapability[] {
  const colSet = new Set(columnOptions.map((column) => column.toLowerCase()));

  return ALL_ANALYSIS_THEMES.map((theme) => {
    const requirement = THEME_FIELD_REQUIREMENTS[theme];
    const mapped = draft.fieldMapping[requirement.key]?.trim();
    if (!mapped) {
      return { theme, available: false, reason: `缺少${requirement.label}字段映射` };
    }
    if (columnOptions.length > 0 && !colSet.has(mapped.toLowerCase())) {
      return { theme, available: false, reason: "映射列不在数据集列中" };
    }
    if (TIME_THEMES.includes(theme)) {
      const timeError = validateCreatedAtFieldMapping(
        { ...draft, enabledThemes: [theme] },
        columnKinds,
      );
      if (timeError) {
        return { theme, available: false, reason: timeError };
      }
    }
    return { theme, available: true, reason: null };
  });
}

export function validateStandardPackDraft(
  draft: AnalysisPack,
  columnOptions: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): string | null {
  const colSet = new Set(columnOptions.map((column) => column.toLowerCase()));

  for (const theme of draft.enabledThemes) {
    const requirement = THEME_FIELD_REQUIREMENTS[theme];
    const mapped = draft.fieldMapping[requirement.key]?.trim();
    if (!mapped) {
      return `已启用「${THEME_LABELS[theme]}」主题，请在字段映射中配置${requirement.label}字段`;
    }
    if (columnOptions.length > 0 && !colSet.has(mapped.toLowerCase())) {
      return `「${THEME_LABELS[theme]}」所需的「${mapped}」不在当前数据集列中，请重新映射或更换数据集`;
    }
  }

  const createdAtError = validateCreatedAtFieldMapping(draft, columnKinds);
  if (createdAtError) return createdAtError;

  const capabilities = evaluateDraftThemeCapabilities(draft, columnOptions, columnKinds);
  for (const theme of draft.enabledThemes) {
    const cap = capabilities.find((item) => item.theme === theme);
    if (cap && !cap.available) {
      return `主题「${THEME_LABELS[theme]}」当前不可用：${cap.reason ?? "请检查字段映射"}`;
    }
  }

  return null;
}
