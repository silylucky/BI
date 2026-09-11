import {
  chartDataSlotBlueprint,
  type ChartDataSlotBlueprint,
} from "@/components/dashboard/chartFieldSlots";
import { classifyDatasetField } from "@/components/dashboard/datasetFieldClassification";
import type { SlotTarget } from "@/components/dashboard/chartInspectorTypes";
import {
  looksLikeGisGeoLabelField,
  looksLikeGisLatField,
  looksLikeGisLngField,
} from "@/lib/gisMapScatter";
import { axisFieldList, fieldAtSlot } from "@/lib/resolveChartEncoding";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

export type FieldAssignResult = { ok: true } | { ok: false; message: string };

const DATE_FIELD =
  /(?:^|_)(date|time|day|month|year|week|timestamp|datetime)(?:$|_)|_at$/i;
const GEO_FIELD =
  /(?:^|_)(region|area|city|province|country|geo|name|district|地名|省份|城市)(?:$|_)|省|市|自治区|区$|县$/i;
const REGION_ID_FIELD = /(?:^|_)(region_id|adcode|area_code|geo_id)(?:$|_)|^id$|_id$/i;

function slotMeta(chartType: string, target: SlotTarget): ChartDataSlotBlueprint | undefined {
  return chartDataSlotBlueprint(chartType).find(
    (s) => s.axisId === target.axisId && s.index === target.index,
  );
}

/** 对标 DataEase：按 DE 轴 fieldType 校验；both 轴维/指标均可 */
export function validateFieldAssignment(
  field: string,
  target: SlotTarget,
  chartType: string,
): FieldAssignResult {
  const trimmed = field.trim();
  if (!trimmed) {
    return { ok: false, message: "字段名无效" };
  }

  const slot = slotMeta(chartType, target);
  if (!slot) {
    return { ok: false, message: "当前图表类型不支持该槽位" };
  }

  const fieldKind = classifyDatasetField(trimmed);

  if (slot.kind === "dimension" && fieldKind === "metric") {
    return {
      ok: false,
      message: `「${trimmed}」是指标字段，不能放入「${slot.label}」。请从右侧「指标」分组拖入数值字段，或改放指标槽`,
    };
  }

  if (slot.kind === "metric" && fieldKind === "dimension") {
    if (chartType === "kpi" && target.axisId === "yAxis") {
      return { ok: true };
    }
    return {
      ok: false,
      message: `「${trimmed}」是维度字段，不能放入「${slot.label}」。请从右侧「维度」分组拖入，或改放维度槽`,
    };
  }

  if (chartType === "timeline" && target.axisId === "xAxis" && !DATE_FIELD.test(trimmed)) {
    return {
      ok: false,
      message: `时间轴须使用时间类维度（如 sale_date、order_time），「${trimmed}」不适合作为时间轴`,
    };
  }

  if (
    (chartType === "map" || chartType === "map-3d") &&
    target.axisId === "xAxis"
  ) {
    const geoLike =
      GEO_FIELD.test(trimmed) ||
      REGION_ID_FIELD.test(trimmed) ||
      /^(name|region_name|province_name|city_name)$/i.test(trimmed);
    if (!geoLike) {
      return {
        ok: false,
        message: `地图须使用地理名称或区域编码字段（如 region、province、region_id），「${trimmed}」无法参与地图着色`,
      };
    }
  }

  if (
    (chartType === "heatmap" || chartType === "t-heatmap") &&
    (target.axisId === "xAxis" || target.axisId === "xAxisExt") &&
    fieldKind === "metric"
  ) {
    return {
      ok: false,
      message: `热力图横纵轴须为维度字段，「${trimmed}」是指标字段`,
    };
  }

  if (chartType === "gis-map") {
    if (target.axisId === "xAxis" && target.index === 0) {
      if (looksLikeGisGeoLabelField(trimmed) || (!looksLikeGisLngField(trimmed) && fieldKind === "dimension")) {
        return {
          ok: false,
          message: `「${trimmed}」不能作为经度。请绑定 lng / longitude 等数值型经度列，或点「接入 de_map_heat」一键配置`,
        };
      }
    }
    if (target.axisId === "xAxisExt" && target.index === 0) {
      if (looksLikeGisGeoLabelField(trimmed) || (!looksLikeGisLatField(trimmed) && fieldKind === "dimension")) {
        return {
          ok: false,
          message: `「${trimmed}」不能作为纬度。请绑定 lat / latitude 等数值型纬度列`,
        };
      }
    }
  }

  return { ok: true };
}

/** 多字段容器：重复与维/指标上限 */
export function validateMultiAxisAppend(
  cfg: ChartViewConfig,
  field: string,
  slot: ChartDataSlotBlueprint,
  chartType: string,
): FieldAssignResult {
  const typeCheck = validateFieldAssignment(field, { axisId: slot.axisId, index: slot.index }, chartType);
  if (!typeCheck.ok) return typeCheck;

  const trimmed = field.trim();
  const existing = axisFieldList(cfg, slot.axisId);
  if (existing.includes(trimmed)) {
    return { ok: false, message: `「${trimmed}」已在「${slot.label}」中` };
  }

  const maxTotal = slot.limit ?? 16;
  if (existing.length >= maxTotal) {
    return { ok: false, message: `「${slot.label}」最多 ${maxTotal} 个字段` };
  }

  const fieldKind = classifyDatasetField(trimmed);
  const dimCount = existing.filter((f) => classifyDatasetField(f) !== "metric").length;
  const metCount = existing.filter((f) => classifyDatasetField(f) === "metric").length;
  const maxD = slot.maxDimensions ?? 8;
  const maxM = slot.maxMetrics ?? 8;

  if (fieldKind === "metric" && metCount >= maxM) {
    return { ok: false, message: `「${slot.label}」指标字段已达上限（${maxM} 个）` };
  }
  if (fieldKind !== "metric" && dimCount >= maxD) {
    return { ok: false, message: `「${slot.label}」维度字段已达上限（${maxD} 个）` };
  }

  return { ok: true };
}

/** 点击字段库时：multi 槽追加；single 槽找空位 */
export function resolveAutoAssignTarget(
  cfg: ChartViewConfig,
  chartType: string,
  field: string,
  preferred?: SlotTarget | null,
): { target: SlotTarget; append?: boolean } | { error: string } {
  if (preferred) {
    const slot = slotMeta(chartType, preferred);
    if (slot?.uiMode === "multi") {
      const check = validateMultiAxisAppend(cfg, field, slot, chartType);
      if (!check.ok) return { error: check.message };
      return { target: preferred, append: true };
    }
    const empty = !fieldAtSlot(cfg, preferred);
    if (!empty) {
      return { error: `请先清空当前槽位再绑定「${field}」` };
    }
    const check = validateFieldAssignment(field, preferred, chartType);
    if (!check.ok) return { error: check.message };
    return { target: preferred };
  }

  for (const slot of chartDataSlotBlueprint(chartType)) {
    const target: SlotTarget = { axisId: slot.axisId, index: slot.index };
    if (slot.uiMode === "multi") {
      const check = validateMultiAxisAppend(cfg, field, slot, chartType);
      if (check.ok) return { target, append: true };
      const trimmed = field.trim();
      if (axisFieldList(cfg, slot.axisId).includes(trimmed)) {
        return { error: check.message };
      }
      continue;
    }
    if (fieldAtSlot(cfg, target)) continue;
    const check = validateFieldAssignment(field, target, chartType);
    if (check.ok) return { target };
  }

  return {
    error: `没有可放置「${field}」的空槽。请清空不合适的槽位，或检查字段类型（维度/指标）是否与图表要求一致`,
  };
}

export { fieldAtSlot };
