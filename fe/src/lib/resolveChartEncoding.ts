import { remapLegacySqlFieldsInChartConfig } from "@/lib/legacySqlFieldAliases";
import { humanizeChartFieldName, resolveChartFieldRefLabel } from "@/lib/chartFieldLabels";
import type { ChartFieldRef, ChartViewConfig } from "@/lib/chartViewConfig";
import { classifyDatasetField } from "@/components/dashboard/datasetFieldClassification";
import {
  getDeAxisBlueprint,
  getDeAxisLegacyMap,
  getDeAxisSpecs,
  type ChartAxesConfig,
  type DeAxisId,
  type DeAxisSlot,
  type ResolvedChartEncoding,
} from "@/lib/chartDeAxis";

function trimField(ref: ChartFieldRef | undefined): string {
  return ref?.field?.trim() ?? "";
}

function axisHasField(axes: ChartAxesConfig, axisId: DeAxisId): boolean {
  return (axes[axisId] ?? []).some((ref) => trimField(ref));
}

/** 旧版组合图误将右轴子类别放在 xAxisExt，迁移到 DE 正确槽位 */
export function remapMixAxisSlots(config: ChartViewConfig): ChartViewConfig {
  const chartType = config.chartType;
  if (
    chartType !== "chart-mix" &&
    chartType !== "combo" &&
    chartType !== "chart-mix-group" &&
    chartType !== "chart-mix-stack" &&
    chartType !== "chart-mix-dual-line"
  ) {
    return config;
  }
  const axes: ChartAxesConfig = { ...(config.axes ?? {}) };
  if (chartType === "chart-mix" || chartType === "combo") {
    if (axisHasField(axes, "xAxisExt") && !axisHasField(axes, "extBubble")) {
      axes.extBubble = [...(axes.xAxisExt ?? [])];
      axes.xAxisExt = [];
    }
  }
  if (chartType === "chart-mix-stack") {
    if (axisHasField(axes, "xAxisExt") && !axisHasField(axes, "extStack")) {
      axes.extStack = [...(axes.xAxisExt ?? [])];
      axes.xAxisExt = [];
    }
  }
  return { ...config, axes };
}

function axisField(axes: ChartAxesConfig, axisId: DeAxisId, index: number): string {
  return trimField(axes[axisId]?.[index]);
}

function axisFieldRef(axes: ChartAxesConfig, axisId: DeAxisId, index: number): ChartFieldRef | null {
  const ref = axes[axisId]?.[index];
  const field = ref?.field?.trim();
  if (!field) return null;
  const label = ref?.label?.trim();
  return label ? { field, label } : { field, label: humanizeChartFieldName(field) };
}

function axisFieldRefs(axes: ChartAxesConfig, axisId: DeAxisId): ChartFieldRef[] {
  return (axes[axisId] ?? [])
    .map((ref) => {
      const field = ref.field?.trim();
      if (!field) return null;
      const label = ref.label?.trim();
      return label ? { field, label } : { field, label: humanizeChartFieldName(field) };
    })
    .filter((ref): ref is ChartFieldRef => ref !== null);
}

function setAxisField(
  axes: ChartAxesConfig,
  axisId: DeAxisId,
  index: number,
  field: string,
  label?: string,
): ChartAxesConfig {
  const next = { ...axes };
  const list = [...(next[axisId] ?? [])];
  while (list.length <= index) list.push({ field: "" });
  const trimmed = field.trim();
  list[index] = trimmed
    ? { field: trimmed, label: label?.trim() || humanizeChartFieldName(trimmed) }
    : { field: "" };
  next[axisId] = list;
  return next;
}

/** 旧 dimensions/metrics → DE 命名轴 */
export function migrateChartConfigToDeAxes(config: ChartViewConfig): ChartViewConfig {
  const remapped = remapLegacySqlFieldsInChartConfig(config);
  if (remapped.axes && Object.keys(remapped.axes).length > 0) {
    return syncLegacyFieldsFromAxes(remapMixAxisSlots(remapped));
  }
  const chartType = remapped.chartType;

  if (chartType === "table-info" || chartType === "table") {
    const fields = [
      ...(remapped.dimensions?.map((d) => d.field?.trim()).filter(Boolean) ?? []),
      ...(remapped.metrics?.map((m) => m.field?.trim()).filter(Boolean) ?? []),
    ];
    const axes: ChartAxesConfig = {
      xAxis: fields.map((field) => ({ field: field! })),
    };
    return syncLegacyFieldsFromAxes({ ...remapped, axes });
  }

  if (chartType === "table-normal") {
    const dims = remapped.dimensions?.map((d) => d.field?.trim()).filter(Boolean) ?? [];
    const mets = remapped.metrics?.map((m) => m.field?.trim()).filter(Boolean) ?? [];
    const axes: ChartAxesConfig = {
      xAxis: dims.map((field) => ({ field })),
      yAxis: mets.map((field) => ({ field })),
    };
    return syncLegacyFieldsFromAxes({ ...remapped, axes });
  }

  const legacyMap = getDeAxisLegacyMap(chartType);
  const axes: ChartAxesConfig = {};

  for (const map of legacyMap) {
    if (!map.legacy) continue;
    const srcRef =
      map.legacy.kind === "dimension"
        ? remapped.dimensions?.[map.legacy.index]
        : remapped.metrics?.[map.legacy.index];
    const field = srcRef?.field?.trim();
    if (!field) continue;
    axes[map.axisId] = [...(axes[map.axisId] ?? [])];
    while (axes[map.axisId]!.length <= map.index) axes[map.axisId]!.push({ field: "" });
    axes[map.axisId]![map.index] = {
      field,
      ...(srcRef?.label?.trim() ? { label: srcRef.label.trim() } : {}),
    };
  }

  return syncLegacyFieldsFromAxes(remapMixAxisSlots({ ...remapped, axes }));
}

function syncTableBothAxesToLegacy(
  axes: ChartAxesConfig,
): { dimensions: ChartFieldRef[]; metrics: ChartFieldRef[] } {
  const xRefs = (axes.xAxis ?? []).filter((ref) => ref.field?.trim());
  const dimensions: ChartFieldRef[] = [];
  const metrics: ChartFieldRef[] = [];
  for (const ref of xRefs) {
    const labeled = resolveChartFieldRefLabel(ref);
    const kind = classifyDatasetField(ref.field);
    if (kind === "metric") {
      metrics.push(labeled);
    } else {
      dimensions.push(labeled);
    }
  }
  return { dimensions, metrics };
}

function syncAxesSpecsToLegacy(
  chartType: string,
  axes: ChartAxesConfig,
): { dimensions: ChartFieldRef[]; metrics: ChartFieldRef[] } {
  const specs = getDeAxisSpecs(chartType);
  const dimensions: ChartFieldRef[] = [];
  const metrics: ChartFieldRef[] = [];

  for (const spec of specs) {
    const axisId = spec.id;
    const refs = axisFieldRefs(axes, axisId);

    if (spec.fieldType === "dimension") {
      if (spec.uiMode === "multi") {
        for (const ref of refs) dimensions.push(ref);
      } else if (spec.limit > 1 && !spec.uiMode) {
        for (let i = 0; i < spec.limit; i += 1) {
          const ref = axisFieldRef(axes, axisId, i);
          if (ref) dimensions.push(ref);
        }
      } else {
        const ref = axisFieldRef(axes, axisId, 0);
        if (ref) dimensions.push(ref);
      }
      continue;
    }

    if (spec.fieldType === "metric") {
      if (spec.uiMode === "multi") {
        for (const ref of refs) metrics.push(ref);
      } else if (spec.limit > 1 && !spec.uiMode) {
        for (let i = 0; i < spec.limit; i += 1) {
          const ref = axisFieldRef(axes, axisId, i);
          if (ref) metrics.push(ref);
        }
      } else {
        const ref = axisFieldRef(axes, axisId, 0);
        if (ref) metrics.push(ref);
      }
      continue;
    }

    if (spec.fieldType === "both") {
      if (spec.uiMode === "multi") continue;
      const ref = axisFieldRef(axes, axisId, 0);
      if (!ref) continue;
      if (classifyDatasetField(ref.field) === "metric") metrics.push(ref);
      else dimensions.push(ref);
    }
  }

  return { dimensions, metrics };
}

/** axes 权威 → 投影 dimensions/metrics（buildPlan 兼容） */
export function syncLegacyFieldsFromAxes(config: ChartViewConfig): ChartViewConfig {
  const chartType = config.chartType;
  const axes = config.axes ?? {};

  if (chartType === "table-info" || chartType === "table") {
    const { dimensions, metrics } = syncTableBothAxesToLegacy(axes);
    const drillField = axisField(axes, "drill", 0);
    const nextDimensions = [...dimensions];
    if (drillField) {
      nextDimensions.push({ field: drillField, label: humanizeChartFieldName(drillField) });
    }
    return { ...config, axes, dimensions: nextDimensions, metrics };
  }

  if (chartType === "table-normal") {
    const dimensions = (axes.xAxis ?? [])
      .filter((ref) => ref.field?.trim())
      .map((ref) => resolveChartFieldRefLabel(ref));
    const drillField = axisField(axes, "drill", 0);
    if (drillField) {
      dimensions.push({ field: drillField, label: humanizeChartFieldName(drillField) });
    }
    const metrics = (axes.yAxis ?? [])
      .filter((ref) => ref.field?.trim())
      .map((ref) => resolveChartFieldRefLabel(ref));
    return { ...config, axes, dimensions, metrics };
  }

  const { dimensions, metrics } = syncAxesSpecsToLegacy(chartType, axes);
  return { ...config, axes, dimensions, metrics };
}

export function resolveChartEncoding(config: ChartViewConfig): ResolvedChartEncoding {
  const migrated = migrateChartConfigToDeAxes(config);
  const axes = migrated.axes ?? {};
  return {
    axes,
    dimensions: migrated.dimensions?.filter((d) => d.field?.trim()) ?? [],
    metrics: migrated.metrics?.filter((m) => m.field?.trim()) ?? [],
  };
}

export function axisFields(
  encoding: ResolvedChartEncoding,
  axisId: DeAxisId,
): ChartFieldRef[] {
  return (encoding.axes[axisId] ?? []).filter((r) => r.field?.trim());
}

export function firstAxisField(
  encoding: ResolvedChartEncoding,
  axisId: DeAxisId,
  index = 0,
): string {
  return encoding.axes[axisId]?.[index]?.field?.trim() ?? "";
}

export function axisFieldList(config: ChartViewConfig, axisId: DeAxisId): string[] {
  const migrated = migrateChartConfigToDeAxes(config);
  return (migrated.axes?.[axisId] ?? [])
    .map((ref) => ref.field?.trim())
    .filter((field): field is string => Boolean(field));
}

export function appendAxisField(
  config: ChartViewConfig,
  axisId: DeAxisId,
  field: string,
): ChartViewConfig {
  const axes = { ...(config.axes ?? {}) };
  const list = [...(axes[axisId] ?? [])];
  const trimmed = field.trim();
  list.push({ field: trimmed, label: humanizeChartFieldName(trimmed) });
  axes[axisId] = list;
  return syncLegacyFieldsFromAxes({ ...config, axes });
}

export function removeAxisFieldAt(
  config: ChartViewConfig,
  axisId: DeAxisId,
  index: number,
): ChartViewConfig {
  const axes = { ...(config.axes ?? {}) };
  const list = [...(axes[axisId] ?? [])];
  if (index < 0 || index >= list.length) return config;
  list.splice(index, 1);
  axes[axisId] = list;
  return syncLegacyFieldsFromAxes({ ...config, axes });
}

export function clearAxis(config: ChartViewConfig, axisId: DeAxisId): ChartViewConfig {
  const axes = { ...(config.axes ?? {}) };
  axes[axisId] = [];
  return syncLegacyFieldsFromAxes({ ...config, axes });
}

export function writeAxisField(
  config: ChartViewConfig,
  slot: Pick<DeAxisSlot, "axisId" | "index">,
  field: string,
): ChartViewConfig {
  const axes = setAxisField(config.axes ?? {}, slot.axisId, slot.index, field);
  return syncLegacyFieldsFromAxes({ ...config, axes });
}

export function fieldAtSlot(
  config: ChartViewConfig,
  slot: Pick<DeAxisSlot, "axisId" | "index">,
): string | undefined {
  const migrated = migrateChartConfigToDeAxes(config);
  const raw = migrated.axes?.[slot.axisId]?.[slot.index]?.field;
  return raw?.trim() ? raw : undefined;
}

export function clearAxisField(
  config: ChartViewConfig,
  slot: Pick<DeAxisSlot, "axisId" | "index">,
): ChartViewConfig {
  return writeAxisField(config, slot, "");
}

export function deAxisRenderReady(config: ChartViewConfig): boolean {
  const chartType = config.chartType;
  const encoding = resolveChartEncoding(config);
  const slots = getDeAxisBlueprint(chartType);

  for (const slot of slots) {
    if (!slot.required) continue;
    if (slot.uiMode === "multi") {
      const fields = axisFieldList(config, slot.axisId);
      if (fields.length === 0) return false;
      continue;
    }
    const field = axisField(encoding.axes, slot.axisId, slot.index);
    if (!field) return false;
  }

  // multi-scatter / bar-range: DE 特殊 OR 轴
  if (chartType === "multi-scatter") {
    const hasX = Boolean(firstAxisField(encoding, "xAxis", 0));
    if (!hasX) return false;
  }

  if (
    chartType === "combo" ||
    chartType === "chart-mix" ||
    chartType === "chart-mix-group" ||
    chartType === "chart-mix-stack" ||
    chartType === "chart-mix-dual-line"
  ) {
    const hasColumn = Boolean(axisField(encoding.axes, "yAxis", 0));
    const hasLine = Boolean(axisField(encoding.axes, "yAxisExt", 0));
    if (!hasColumn && !hasLine) return false;
  }

  return true;
}

export function classifyFieldForAxis(
  field: string,
  slot: DeAxisSlot,
): "dimension" | "metric" {
  if (slot.fieldType === "dimension") return "dimension";
  if (slot.fieldType === "metric") return "metric";
  return classifyDatasetField(field);
}

export function ensureDeAxisCapacity(config: ChartViewConfig): ChartViewConfig {
  const slots = getDeAxisBlueprint(config.chartType);
  let axes = { ...(config.axes ?? {}) };
  for (const slot of slots) {
    const list = [...(axes[slot.axisId] ?? [])];
    while (list.length <= slot.index) list.push({ field: "" });
    axes[slot.axisId] = list;
  }
  return syncLegacyFieldsFromAxes({ ...config, axes });
}
