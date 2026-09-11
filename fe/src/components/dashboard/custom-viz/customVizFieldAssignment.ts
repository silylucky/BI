import { classifyDatasetField, groupDatasetFields } from "../datasetFieldClassification";
import type { CustomVizDataBinding, CustomVizMetricRef } from "../layoutUtils";
import {
  expandCustomVizFieldSlotsForUi,
  isCustomVizDetailTableFieldSlots,
  parseCustomVizFieldSlotGroupsForUi,
  type CustomVizFieldTarget,
} from "./customVizFieldSlots";

const DATE_FIELD =
  /(?:^|_)(date|time|day|month|year|week|timestamp|datetime)(?:$|_)|_at$/i;
const GEO_FIELD =
  /(?:^|_)(region|area|city|province|country|geo|name|district|地名|省份|城市)(?:$|_)|省|市|自治区|区$|县$/i;

export type CustomVizFieldAssignResult = { ok: true } | { ok: false; message: string };

export function resolveCustomVizUiSlot(
  fieldSlots: Record<string, unknown> | undefined,
  target: CustomVizFieldTarget,
) {
  const slots = expandCustomVizFieldSlotsForUi(fieldSlots);
  return slots.find((s) => s.kind === target.kind && s.index === target.index);
}

export function resolveCustomVizFieldGroup(
  fieldSlots: Record<string, unknown> | undefined,
  kind: CustomVizFieldTarget["kind"],
) {
  return parseCustomVizFieldSlotGroupsForUi(fieldSlots).find((g) => g.kind === kind);
}

export function reconcileCustomVizFields(
  binding: CustomVizDataBinding,
  columns: string[],
): CustomVizDataBinding {
  const allowed = new Set(columns);
  return {
    ...binding,
    dimensions: (binding.dimensions ?? []).filter((d) => allowed.has(d.field?.trim() ?? "")),
    metrics: (binding.metrics ?? []).filter((m) => allowed.has(m.field?.trim() ?? "")),
  };
}

/** 选中 Dataset 且列就绪后，对标内置 chart 的 suggestChartFields。 */
export function suggestCustomVizFields(
  columns: string[],
  fieldSlots: Record<string, unknown> | undefined,
): Pick<CustomVizDataBinding, "dimensions" | "metrics"> {
  if (columns.length === 0) return { dimensions: [], metrics: [] };

  const groups = parseCustomVizFieldSlotGroupsForUi(fieldSlots);
  const dimGroup = groups.find((g) => g.kind === "dimension");
  const metricGroup = groups.find((g) => g.kind === "metric");
  const { dimensions: dimCols, metrics: metricCols } = groupDatasetFields(columns);

  const dimensions: NonNullable<CustomVizDataBinding["dimensions"]> = [];
  const metrics: CustomVizMetricRef[] = [];

  if (dimGroup) {
    const detailTable = isCustomVizDetailTableFieldSlots(fieldSlots);
    if (detailTable) {
      const fields = dimCols.length > 0 ? [...dimCols, ...metricCols] : columns;
      const seen = new Set<string>();
      for (const field of fields) {
        if (seen.has(field) || dimensions.length >= dimGroup.max) continue;
        seen.add(field);
        dimensions.push({ field });
      }
    } else {
      const field = dimCols[0] ?? columns[0];
      if (field) dimensions.push({ field });
    }
  }

  if (metricGroup && metricGroup.min > 0 && !isCustomVizDetailTableFieldSlots(fieldSlots)) {
    const field =
      metricCols[0] ?? columns.find((col) => !dimensions.some((d) => d.field === col));
    if (field) metrics.push({ field, agg: "sum" });
  }

  return { dimensions, metrics };
}

export function resolveCustomVizSlotLabel(
  fieldSlots: Record<string, unknown> | undefined,
  target: CustomVizFieldTarget,
): string | undefined {
  return resolveCustomVizUiSlot(fieldSlots, target)?.label;
}

/** 对标内置 chart：维度槽禁指标、指标槽禁维度；manifest expect 与标签启发式约束语义 */
export function validateCustomVizFieldAssignment(
  field: string,
  target: CustomVizFieldTarget,
  fieldSlots?: Record<string, unknown>,
  slotLabel?: string,
  slotExpect?: "date" | "geo",
): CustomVizFieldAssignResult {
  const trimmed = field.trim();
  if (!trimmed) {
    return { ok: false, message: "字段名无效" };
  }

  const fieldKind = classifyDatasetField(trimmed);
  const dimGroup = resolveCustomVizFieldGroup(fieldSlots, "dimension");
  const metricGroup = resolveCustomVizFieldGroup(fieldSlots, "metric");
  const detailTable = isCustomVizDetailTableFieldSlots(fieldSlots);

  if (target.kind === "dimension" && fieldKind === "metric" && !detailTable) {
    return {
      ok: false,
      message: `「${trimmed}」是指标字段，不能放入「${slotLabel ?? "维度"}」。请从右侧「指标」分组拖入，或改放指标槽`,
    };
  }

  if (target.kind === "metric" && fieldKind === "dimension") {
    return {
      ok: false,
      message: `「${trimmed}」是维度字段，不能放入「${slotLabel ?? "指标"}」。请从右侧「维度」分组拖入，或改放维度槽`,
    };
  }

  const expectDate =
    slotExpect === "date" ||
    (target.kind === "dimension" && slotLabel && /时间|日期/.test(slotLabel));
  if (expectDate && !DATE_FIELD.test(trimmed)) {
    return {
      ok: false,
      message: `时间维度须使用时间类字段（如 sale_date），「${trimmed}」不适合作为横轴`,
    };
  }

  const expectGeo =
    slotExpect === "geo" ||
    (target.kind === "dimension" && slotLabel && /地区|地理|省份|区域/.test(slotLabel));
  if (expectGeo && !GEO_FIELD.test(trimmed)) {
    return {
      ok: false,
      message: `地理维度须使用地区类字段（如 province、region），「${trimmed}」无法参与地图/区域轴`,
    };
  }

  return { ok: true };
}
