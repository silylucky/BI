import * as THREE from "three";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import { uvFromBboxPosition } from "@/components/charts/engine/three/geo/applyGeoCapBboxUv";
import type { ChinaTerrainPack } from "@/components/charts/engine/three/geo/chinaTerrainLoader";
import {
  resolveProvinceTerrainUvBounds,
  resolveTerrainPackKey,
} from "@/components/charts/engine/three/geo/chinaTerrainLoader";
import { buildTerrainAlignedGeoProject } from "@/components/charts/engine/three/geo/threeGeoProject";

/** 省包 centroid 探针 RGB 下限；低于此视为贴图与 projBounds 错位（全黑顶面） */
export const PROVINCE_TERRAIN_PROBE_MIN_RGB = 60;

let probeCanvas: HTMLCanvasElement | null = null;
let probeCtx: CanvasRenderingContext2D | null = null;

function probeContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!probeCanvas) {
    probeCanvas = document.createElement("canvas");
    probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  }
  return probeCtx;
}

/** 在已加载纹理上按 UV 采样 RGB 之和（浏览器内） */
export function sampleTerrainTextureRgb(
  texture: THREE.Texture,
  u: number,
  v: number,
): number | null {
  const ctx = probeContext();
  const img = texture.image as CanvasImageSource | undefined;
  if (!ctx || !img || !probeCanvas) return null;

  const el = img as HTMLImageElement;
  const w = el.naturalWidth || el.width;
  const h = el.naturalHeight || el.height;
  if (!w || !h) return null;

  if (probeCanvas.width !== w) probeCanvas.width = w;
  if (probeCanvas.height !== h) probeCanvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  const px = Math.max(0, Math.min(w - 1, Math.round(u * (w - 1))));
  const py = Math.max(0, Math.min(h - 1, Math.round((1 - v) * (h - 1))));
  const d = ctx.getImageData(px, py, 1, 1).data;
  return d[0]! + d[1]! + d[2]!;
}

export function resolveProvinceTerrainProbeUv(
  mapId: string | undefined,
  drillDepth: number,
  drillGeo: {
    features?: Array<{ properties?: { adcode?: number | string }; geometry?: GeoJSON.Geometry | null }>;
  },
): [number, number] | null {
  const bake = resolveProvinceTerrainUvBounds(mapId, drillDepth);
  const { level, adcode } = resolveTerrainPackKey(mapId, drillDepth);
  if (!bake || level !== "province" || adcode == null) return null;

  const feature = chinaProvincesGeo.features.find(
    (f) => Number(f.properties?.adcode) === adcode,
  );
  const centroid = feature?.properties?.centroid as [number, number] | undefined;
  if (!centroid) return null;

  const geoProject = buildTerrainAlignedGeoProject(800, 600, mapId, drillDepth, drillGeo);
  const p = geoProject.project(centroid);
  if (!p) return null;
  return uvFromBboxPosition(p[0], p[1], bake);
}

export function isProvinceTerrainPackUsable(
  pack: ChinaTerrainPack,
  probeUv: [number, number] | null,
): boolean {
  if (!probeUv) return true;
  const sum = sampleTerrainTextureRgb(pack.colorMap, probeUv[0], probeUv[1]);
  if (sum == null) return true;
  return sum >= PROVINCE_TERRAIN_PROBE_MIN_RGB;
}
