import type { CustomVizDataBinding } from "../layoutUtils";
import { isCustomVizDetailTableFieldSlots, parseCustomVizFieldSlots } from "./customVizFieldSlots";

export type CustomVizFieldMinimums = {
  dimMin: number;
  metricMin: number;
  dimMax: number;
  metricMax: number;
};

export function countBoundCustomVizFields(binding: CustomVizDataBinding | undefined): {
  dimensions: number;
  metrics: number;
} {
  return {
    dimensions: binding?.dimensions?.filter((d) => d.field?.trim()).length ?? 0,
    metrics: binding?.metrics?.filter((m) => m.field?.trim()).length ?? 0,
  };
}

/** 按 manifest 与明细表范式解析出数所需维/指标下限（manifest 误设 metrics.min 时不阻塞多列明细表）。 */
export function resolveCustomVizFieldMinimums(
  fieldSlots: Record<string, unknown> | undefined,
  binding?: CustomVizDataBinding,
): CustomVizFieldMinimums {
  const slotDefs = parseCustomVizFieldSlots(fieldSlots);
  const dimDef = slotDefs.find((g) => g.kind === "dimension");
  const metricDef = slotDefs.find((g) => g.kind === "metric");
  const dimMin = dimDef?.min ?? 1;
  let metricMin = metricDef?.min ?? 1;
  const dimMax = dimDef?.max ?? 1;
  const metricMax = metricDef?.max ?? 1;

  if (metricMax === 0) {
    metricMin = 0;
  }

  const { dimensions: dims, metrics } = countBoundCustomVizFields(binding);
  if (
    metricMin > 0 &&
    metrics === 0 &&
    dims >= dimMin &&
    isCustomVizDetailTableFieldSlots(fieldSlots)
  ) {
    metricMin = 0;
  }

  return { dimMin, metricMin, dimMax, metricMax };
}

export function resolveCustomVizSlotBindingHint(
  binding: CustomVizDataBinding | undefined,
  fieldSlots?: Record<string, unknown>,
): string | null {
  if (!binding?.dataSourceId || !binding?.configId) return null;
  const { dimensions: dims, metrics } = countBoundCustomVizFields(binding);
  const { dimMin, metricMin } = resolveCustomVizFieldMinimums(fieldSlots, binding);
  if (dims >= dimMin && metrics >= metricMin) return null;

  const slotDefs = parseCustomVizFieldSlots(fieldSlots);
  const dimLabel = slotDefs.find((g) => g.kind === "dimension")?.label ?? "维度列";
  const metricLabel = slotDefs.find((g) => g.kind === "metric")?.label ?? "数值列";
  const parts: string[] = [];
  if (dims < dimMin) parts.push(`至少绑定 ${dimMin} 个${dimLabel}`);
  if (metrics < metricMin) parts.push(`至少绑定 ${metricMin} 个${metricLabel}`);
  return parts.join("；");
}
