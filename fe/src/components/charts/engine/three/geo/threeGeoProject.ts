import * as d3 from "d3";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import {
  chinaGeoLayoutCenterInViewport,
  fitChinaGeoProjection,
  isDecorativeGeoFeature,
} from "@/components/charts/engine/geo/geoProjection";
import { resolveTerrainPackKey } from "@/components/charts/engine/three/geo/chinaTerrainLoader";
import {
  computeGeoProjBounds,
  type GeoMapLayoutMargin,
  type GeoProjBounds,
} from "@/components/charts/engine/three/geo/applyGeoTerrainSurface";

export const TERRAIN_REF_VIEWPORT = { width: 800, height: 600 } as const;

export const THREE_GEO_MAP_MARGIN: GeoMapLayoutMargin = {
  top: 8,
  right: 12,
  bottom: 24,
  left: 12,
};

export type ThreeGeoProjectContext = {
  projection: d3.GeoProjection;
  /** 全国地图投影：全画布 fit，与 GeoJSON 单测一致 */
  flowProjection: d3.GeoProjection;
  project: (coord: [number, number]) => [number, number] | null;
  /** 未做 bounds 居中；外轮廓合并更稳定 */
  projectForFlowPath: (coord: [number, number]) => [number, number] | null;
  /** 将 flow path 平移到与 `project` 一致的 mesh 坐标 */
  flowPathOffset: { x: number; y: number };
  projBounds: GeoProjBounds;
  margin: GeoMapLayoutMargin;
  centerX: number;
  centerY: number;
  layoutCenterX: number;
  layoutCenterY: number;
  viewport: { width: number; height: number };
};

/** 与 build:geo-terrain / bake-meta.json 一致：省轮廓勿 prepare，否则 fitExtent 畸变 */
export function buildProvinceOutlineFitCollection(adcode: number): GeoJSON.FeatureCollection | null {
  const raw = chinaProvincesGeo.features.find(
    (f) =>
      Number(f.properties?.adcode) === adcode &&
      !isDecorativeGeoFeature(f.properties) &&
      f.geometry != null,
  );
  if (!raw?.geometry) return null;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: String(raw.properties?.name ?? "") },
        geometry: raw.geometry,
      },
    ],
  };
}

/**
 * 卫星纹理烘焙按省级轮廓 projBounds；下钻到市/区县时：
 * - 有省级地形包：mesh/UV 用省轮廓 fit（与上周 bake 一致）
 * - 无省级地形包：用当前下钻 GeoJSON（市/区县）fit，避免仍按全国投影导致「下钻图不对」
 */
export function resolveTerrainProjectionFitCollection(
  mapId: string | undefined,
  drillDepth: number,
  drillGeo: { features?: Array<{ properties?: { adcode?: number | string; adchar?: string; name?: string }; geometry?: GeoJSON.Geometry | null }> },
): GeoJSON.FeatureCollection {
  const drillFit = buildMapFitCollection(drillGeo);
  if (drillDepth <= 0) return drillFit;
  const { level, adcode } = resolveTerrainPackKey(mapId, drillDepth);
  if (level !== "province" || adcode == null) return drillFit;
  return buildProvinceOutlineFitCollection(adcode) ?? drillFit;
}

/** 省级卫星包须与 800×600 烘焙视口一致；全国仍用实际画布尺寸 */
export function buildTerrainAlignedGeoProject(
  width: number,
  height: number,
  mapId: string | undefined,
  drillDepth: number,
  drillGeo: { features?: Array<{ properties?: { adcode?: number | string; adchar?: string; name?: string }; geometry?: GeoJSON.Geometry | null }> },
): ThreeGeoProjectContext {
  const fitCollection = resolveTerrainProjectionFitCollection(mapId, drillDepth, drillGeo);
  const { level } = resolveTerrainPackKey(mapId, drillDepth);
  const vw = level === "province" ? TERRAIN_REF_VIEWPORT.width : width;
  const vh = level === "province" ? TERRAIN_REF_VIEWPORT.height : height;
  return buildThreeGeoProject(vw, vh, fitCollection.features, fitCollection);
}

export function buildMapFitCollection(
  geo: { features?: Array<{ properties?: { adcode?: number | string; adchar?: string; name?: string }; geometry?: GeoJSON.Geometry | null }> },
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (geo.features ?? [])
      .filter((f) => !isDecorativeGeoFeature(f.properties) && f.geometry != null)
      .map((f) => ({
        type: "Feature" as const,
        properties: { name: f.properties?.name ?? "" },
        geometry: f.geometry!,
      })),
  };
}

export function buildNationalTerrainProject(
  geo: { features?: Array<{ properties?: { adcode?: number | string; adchar?: string; name?: string }; geometry?: GeoJSON.Geometry | null }> },
): ThreeGeoProjectContext {
  const fitCollection = buildMapFitCollection(geo);
  return buildThreeGeoProject(
    TERRAIN_REF_VIEWPORT.width,
    TERRAIN_REF_VIEWPORT.height,
    fitCollection.features,
    fitCollection,
  );
}

/** 与 D3 choropleth 同投影，并将 layoutCenter 对齐 Three 原点（避免中轴偏移） */
export function buildThreeGeoProject(
  width: number,
  height: number,
  boundsFeatures: Array<{ geometry: GeoJSON.Geometry | null }>,
  fitCollection: GeoJSON.FeatureCollection,
): ThreeGeoProjectContext {
  const margin = THREE_GEO_MAP_MARGIN;
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const projection = fitChinaGeoProjection(d3.geoMercator(), innerW, innerH, fitCollection);
  const flowProjection = fitChinaGeoProjection(d3.geoMercator(), width, height, fitCollection);
  const projectForFlowPath = (coord: [number, number]): [number, number] | null => {
    const p = flowProjection(coord);
    if (!p) return null;
    return [p[0] - width / 2, -(p[1] - height / 2)];
  };
  const { centerX: layoutCenterX, centerY: layoutCenterY } = chinaGeoLayoutCenterInViewport(
    width,
    height,
    margin,
  );

  const projectRaw = (coord: [number, number]): [number, number] | null => {
    const p = projection(coord);
    if (!p) return null;
    return [p[0] + margin.left - width / 2, -(p[1] + margin.top - height / 2)];
  };

  const rawBounds = computeGeoProjBounds(boundsFeatures, projectRaw);
  const centerX = (rawBounds.minX + rawBounds.maxX) / 2;
  const centerY = (rawBounds.minY + rawBounds.maxY) / 2;

  const project = (coord: [number, number]): [number, number] | null => {
    const p = projectRaw(coord);
    if (!p) return null;
    return [p[0] - centerX, p[1] - centerY];
  };

  return {
    projection,
    flowProjection,
    project,
    projectForFlowPath,
    flowPathOffset: { x: -centerX, y: -centerY },
    projBounds: computeGeoProjBounds(boundsFeatures, project),
    margin,
    centerX,
    centerY,
    layoutCenterX,
    layoutCenterY,
    viewport: { width, height },
  };
}
