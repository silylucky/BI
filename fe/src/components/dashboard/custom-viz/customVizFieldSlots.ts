import {
  CUSTOM_VIZ_DEFAULT_DIMENSION_LABEL,
  CUSTOM_VIZ_DEFAULT_METRIC_LABEL,
  sanitizeManifestLabel,
} from "./customVizManifestLabels";

export type CustomVizFieldSlotDef = {
  key: string;
  kind: "dimension" | "metric";
  label: string;
  required: boolean;
  min: number;
  max: number;
  expect?: "date" | "geo";
};

export type CustomVizFieldTarget = {
  kind: "dimension" | "metric";
  index: number;
};

export type CustomVizUiFieldSlot = CustomVizFieldSlotDef & {
  index: number;
  uiKey: string;
};

/** 对标内置 chart：max>1 用 ChartFieldMultiSlot，否则单槽。 */
export type CustomVizUiFieldSlotGroup = CustomVizFieldSlotDef & {
  uiMode: "multi" | "single";
};

export function customVizFieldTargetsEqual(a: CustomVizFieldTarget, b: CustomVizFieldTarget): boolean {
  return a.kind === b.kind && a.index === b.index;
}

type SlotRule = {
  min?: number;
  max?: number;
  label?: string;
  /** manifest 可选：约束维度槽期望字段语义 */
  expect?: "date" | "geo";
};

function parseSlot(key: string, rule: SlotRule | undefined): CustomVizFieldSlotDef | null {
  if (!rule) return null;
  const kind = key.toLowerCase().includes("metric") ? "metric" : "dimension";
  const min = typeof rule.min === "number" ? rule.min : kind === "metric" ? 1 : 1;
  const max = typeof rule.max === "number" ? rule.max : 1;
  const fallback = kind === "metric" ? CUSTOM_VIZ_DEFAULT_METRIC_LABEL : CUSTOM_VIZ_DEFAULT_DIMENSION_LABEL;
  return {
    key,
    kind,
    label: sanitizeManifestLabel(rule.label, fallback),
    required: min > 0,
    min,
    max,
    ...(rule.expect ? { expect: rule.expect } : {}),
  };
}

const DEFAULT_FIELD_SLOT_DEFS: CustomVizFieldSlotDef[] = [
  {
    key: "dimensions",
    kind: "dimension",
    label: CUSTOM_VIZ_DEFAULT_DIMENSION_LABEL,
    required: true,
    min: 1,
    max: 1,
  },
  {
    key: "metrics",
    kind: "metric",
    label: CUSTOM_VIZ_DEFAULT_METRIC_LABEL,
    required: true,
    min: 1,
    max: 1,
  },
];

export function parseCustomVizFieldSlots(
  fieldSlots: Record<string, unknown> | undefined,
): CustomVizFieldSlotDef[] {
  if (!fieldSlots) return DEFAULT_FIELD_SLOT_DEFS;
  const slots: CustomVizFieldSlotDef[] = [];
  for (const [key, value] of Object.entries(fieldSlots)) {
    if (!value || typeof value !== "object") continue;
    const slot = parseSlot(key, value as SlotRule);
    if (slot) slots.push(slot);
  }
  if (slots.length === 0) return DEFAULT_FIELD_SLOT_DEFS;
  return slots;
}

export function parseCustomVizFieldSlotGroupsForUi(
  fieldSlots: Record<string, unknown> | undefined,
): CustomVizUiFieldSlotGroup[] {
  return parseCustomVizFieldSlots(fieldSlots)
    .filter((def) => def.max > 0)
    .map((def) => ({
      ...def,
      uiMode: def.max > 1 ? ("multi" as const) : ("single" as const),
    }));
}

/** 流动/明细表：多列 dimensions；metrics 可为 0，或 manifest 误设 min>=1 时仍按明细表处理。 */
export function isCustomVizDetailTableFieldSlots(
  fieldSlots: Record<string, unknown> | undefined,
): boolean {
  const groups = parseCustomVizFieldSlotGroupsForUi(fieldSlots);
  const dimGroup = groups.find((g) => g.kind === "dimension");
  const metricGroup = groups.find((g) => g.kind === "metric");
  if (!dimGroup || dimGroup.uiMode !== "multi") return false;
  if (!metricGroup || metricGroup.min === 0 || metricGroup.max === 0) return true;
  return dimGroup.max > 1;
}

/** @deprecated 仅 resolveCustomVizUiSlot 等旧路径；UI 请用 parseCustomVizFieldSlotGroupsForUi */
export function expandCustomVizFieldSlotsForUi(
  fieldSlots: Record<string, unknown> | undefined,
): CustomVizUiFieldSlot[] {
  const defs = parseCustomVizFieldSlots(fieldSlots);
  const out: CustomVizUiFieldSlot[] = [];
  let dimIndex = 0;
  let metricIndex = 0;
  for (const def of defs) {
    const count = Math.max(def.max, def.min, 1);
    for (let i = 0; i < count; i += 1) {
      const index = def.kind === "dimension" ? dimIndex++ : metricIndex++;
      out.push({
        ...def,
        index,
        uiKey: `${def.key}-${index}`,
        label: count > 1 ? `${def.label} ${i + 1}` : def.label,
      });
    }
  }
  return out;
}
