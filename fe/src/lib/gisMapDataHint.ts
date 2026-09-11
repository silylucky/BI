import { classifyDatasetField } from "@/components/dashboard/datasetFieldClassification";
import { activeFieldRefs } from "@/lib/chartConfigState";
import { GIS_MAP_SCATTER_SAMPLE_SQL } from "@/lib/gisMapScatter";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

export type GisMapDataHintTone = "info" | "warn" | "ok";

export type GisMapDataHint = {
  tone: GisMapDataHintTone;
  message: string;
  /** 右栏展示的示例 SQL */
  sampleSql?: string | null;
  /** 地图内浮层用短文案 */
  overlayMessage?: string;
};

const GEO_NAME_PATTERN =
  /(?:^|_)(region|province|city|district|area|country|state|county|name|地区|省份|城市|区县|国家)(?:$|_)/i;

const LNG_NAME_PATTERN = /(?:^|_)(lng|lon|longitude|经度|x_coord)(?:$|_)/i;
const LAT_NAME_PATTERN = /(?:^|_)(lat|latitude|纬度|y_coord)(?:$|_)/i;

function looksLikeGeoName(field: string): boolean {
  return GEO_NAME_PATTERN.test(field.trim());
}

function looksLikeLngField(field: string): boolean {
  return LNG_NAME_PATTERN.test(field.trim());
}

function looksLikeLatField(field: string): boolean {
  return LAT_NAME_PATTERN.test(field.trim());
}

function hasCoordColumns(columns: string[]): boolean {
  return columns.some((c) => looksLikeLngField(c) || looksLikeLatField(c));
}

function hasGeoNameColumns(columns: string[]): boolean {
  return columns.some((c) => looksLikeGeoName(c));
}

/** GIS 地图数据绑定向导：须先连接底图服务；散点数据可选 */
export function resolveGisMapDataHint(
  config: ChartViewConfig,
  columns: string[],
): GisMapDataHint {
  const cfg = config;
  const gisProject = cfg.nativeBody?.gisProject;
  const tileServiceId =
    gisProject && typeof gisProject === "object" && "tileServiceId" in gisProject
      ? String((gisProject as { tileServiceId?: unknown }).tileServiceId ?? "").trim()
      : "";
  if (!tileServiceId) {
    return {
      tone: "warn",
      message:
        "请先在上方连接全球 PMTiles 底图服务，地图才能出图。散点叠加为可选项，需同时绑定数值型经度、纬度。",
      overlayMessage: "尚未连接全球底图服务",
    };
  }

  const dims = activeFieldRefs(cfg.dimensions);
  const metrics = activeFieldRefs(cfg.metrics);
  const lngField = dims[0]?.field?.trim();
  const latField = dims[1]?.field?.trim();
  const hasBinding =
    Boolean(lngField || latField || dims[2]?.field?.trim()) ||
    metrics.some((m) => Boolean(m.field?.trim()));

  if (!hasBinding) {
    if (columns.length > 0 && hasGeoNameColumns(columns) && !hasCoordColumns(columns)) {
      return {
        tone: "warn",
        message:
          "当前数据集是省/市/区县等地区字段，不能直接用于 GIS 散点。按地区着色请改用「区域地图」；若坚持 GIS 地球，请在 SQL 中准备数值型 longitude / latitude 列。",
        overlayMessage: "地区字段不能当经纬度，请换区域地图或准备坐标列",
      };
    }
    return {
      tone: "info",
      message:
        "底图已连接。可选叠加散点：同时绑定数值型经度、纬度；数值控制圆点大小，标签可选。可一键接入官方 de_map_heat 示例。",
      sampleSql: GIS_MAP_SCATTER_SAMPLE_SQL,
    };
  }

  if (lngField && looksLikeGeoName(lngField) && !looksLikeLngField(lngField)) {
    return {
      tone: "warn",
      message: `「${lngField}」是地区名，不是经度坐标。按「${lngField}」着色请改用「区域地图」。GIS 散点需数值 longitude / latitude。`,
      overlayMessage: `「${lngField}」不能作为经度`,
    };
  }

  if (latField && looksLikeGeoName(latField) && !looksLikeLatField(latField)) {
    return {
      tone: "warn",
      message: `「${latField}」是地区名，不是纬度坐标。请绑定数值 latitude 列，或改用「区域地图」。`,
      overlayMessage: `「${latField}」不能作为纬度`,
    };
  }

  if (lngField && !latField) {
    return {
      tone: "warn",
      message: "已绑定经度，还需绑定纬度字段；两者同时有效才会在底图上显示散点。",
      overlayMessage: "请同时绑定经度与纬度",
    };
  }

  if (latField && !lngField) {
    return {
      tone: "warn",
      message: "已绑定纬度，还需绑定经度字段。",
      overlayMessage: "请同时绑定经度与纬度",
    };
  }

  if (lngField && latField && metrics.length === 0) {
    return {
      tone: "ok",
      message: "散点位置已配置。可选：绑定「数值 / 指标」控制圆点大小。",
    };
  }

  if (!lngField && !latField && metrics.length > 0) {
    return {
      tone: "warn",
      message: "仅绑定数值无法出散点，还需同时绑定经度、纬度两个维度字段。",
      overlayMessage: "散点需要经度 + 纬度",
    };
  }

  if (lngField && latField) {
    const lngKind = classifyDatasetField(lngField);
    const latKind = classifyDatasetField(latField);
    if (lngKind === "dimension" && latKind === "dimension" && !looksLikeLngField(lngField) && !looksLikeLatField(latField)) {
      return {
        tone: "warn",
        message: `「${lngField}」「${latField}」看起来不是坐标列。经度、纬度须为可解析的数值（-180~180 / -90~90）。`,
        overlayMessage: "经纬度字段须为数值",
      };
    }
    return {
      tone: "ok",
      message: "散点叠加已配置：查询结果中的有效经纬度将显示在底图上。",
    };
  }

  return {
    tone: "info",
    message:
      "底图已连接。可选叠加散点：同时绑定数值型经度、纬度；按省/市着色请改用「区域地图」。",
  };
}

export function shouldShowGisMapOverlayHint(
  hint: GisMapDataHint,
  overlayReady: boolean,
): boolean {
  return !overlayReady && hint.tone === "warn" && Boolean(hint.overlayMessage);
}
