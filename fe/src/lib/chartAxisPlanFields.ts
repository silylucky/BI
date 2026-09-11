import type { DeAxisId } from "@/lib/chartDeAxis";
import type { RenderSpec } from "@/components/charts/engine/types";
import { colIndex } from "@/components/charts/engine/buildDatasetEncoding";
import { classifyDatasetField } from "@/components/dashboard/datasetFieldClassification";

/** buildPlan：优先读 DE 命名轴，回退 legacy dimensions/metrics 投影 */
export function fieldFromAxisOrLegacy(
  spec: RenderSpec,
  axisId: DeAxisId,
  index: number,
  legacyKind: "dimension" | "metric",
  legacyIndex: number,
): string {
  const fromAxis = spec.encoding.axes?.[axisId]?.[index]?.field?.trim();
  if (fromAxis) return fromAxis;
  if (legacyKind === "dimension") {
    return spec.encoding.dimensions[legacyIndex]?.field?.trim() ?? "";
  }
  return spec.encoding.metrics[legacyIndex]?.field?.trim() ?? "";
}

function usesDeAxisEncoding(spec: RenderSpec): boolean {
  const axes = spec.encoding.axes;
  return Boolean(axes && Object.keys(axes).length > 0);
}

/** DE 命名轴已启用时，可选槽位为空则不再回退 legacy（对标 DataEase 空 extBubble / 右子类别） */
export function optionalAxisField(
  spec: RenderSpec,
  axisId: DeAxisId,
  index: number,
  legacyKind: "dimension" | "metric",
  legacyIndex: number,
): string {
  const fromAxis = spec.encoding.axes?.[axisId]?.[index]?.field?.trim();
  if (fromAxis) return fromAxis;
  if (usesDeAxisEncoding(spec)) return "";
  if (legacyKind === "dimension") {
    return spec.encoding.dimensions[legacyIndex]?.field?.trim() ?? "";
  }
  return spec.encoding.metrics[legacyIndex]?.field?.trim() ?? "";
}

/** 双轴图指标：已配置 axes 时仅读轴槽，禁止用 legacy 误绑第二指标 */
export function resolveDualAxesMetrics(spec: RenderSpec): {
  columnMetric: string;
  lineMetric: string;
} {
  if (usesDeAxisEncoding(spec)) {
    return {
      columnMetric: spec.encoding.axes?.yAxis?.[0]?.field?.trim() ?? "",
      lineMetric: spec.encoding.axes?.yAxisExt?.[0]?.field?.trim() ?? "",
    };
  }
  return {
    columnMetric: fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0),
    lineMetric: fieldFromAxisOrLegacy(spec, "yAxisExt", 0, "metric", 1),
  };
}

/** 子类别/堆叠维与主类别轴相同时视为无效（避免柱序列与 X 轴重复拆维） */
export function normalizeCartesianSubField(
  categoryField: string,
  subField?: string,
): string | undefined {
  const sub = subField?.trim();
  if (!sub) return undefined;
  const category = categoryField?.trim();
  if (category && sub === category) return undefined;
  return sub;
}

const DATE_LIKE = /(?:^|_)(date|time|day|month|year|week|timestamp|datetime)(?:$|_)|_at$/i;

/** 区间图等：指标取数值；时间维度取时间戳 */
export function coerceAxisNumeric(row: unknown[], columns: string[], field: string): number {
  if (!field) return 0;
  const idx = colIndex(columns, field);
  if (idx < 0) return 0;
  const raw = row[idx];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw ?? "").trim();
  if (!text) return 0;
  const asNum = Number(text.replace(/,/g, ""));
  if (Number.isFinite(asNum) && (classifyDatasetField(field) === "metric" || !DATE_LIKE.test(field))) {
    return asNum;
  }
  const ts = Date.parse(text);
  return Number.isFinite(ts) ? ts : asNum || 0;
}
