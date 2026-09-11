import * as THREE from "three";
import nationalMeta from "@/assets/geo/terrain/national/meta.json";
import nationalDiffuseUrl from "@/assets/geo/terrain/national/diffuse.webp?url";
import nationalNormalUrl from "@/assets/geo/terrain/national/normal.webp?url";
import { CHINA_TERRAIN_NATIONAL_ID } from "@/assets/geo/terrain/manifest";
import type { GeoProjBounds, TerrainCapSource } from "@/components/charts/engine/three/geo/applyGeoTerrainSurface";

export type TerrainGeoBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ChinaTerrainPack = {
  level: "national" | "province";
  adcode: number | null;
  bounds: TerrainGeoBounds;
  source: TerrainCapSource;
  colorMap: THREE.Texture;
  normalMap?: THREE.Texture;
  /** DEV：diffuse 源 URL，便于 Network 对照 */
  debugUrl?: string;
  dispose: () => void;
};

export type LoadTerrainPackOpts = {
  mapId?: string;
  drillDepth?: number;
  isDark?: boolean;
};

const VS_REGIONS_MAP_ID = "vs-regions";

const provinceMetaGlob = import.meta.glob<{ default: { bounds: number[]; size: number } }>(
  "@/assets/geo/terrain/provinces/*/meta.json",
  { eager: true },
);

const provinceDiffuseGlob = import.meta.glob<string>("@/assets/geo/terrain/provinces/*/diffuse.webp", {
  query: "?url",
  import: "default",
  eager: true,
});
const provinceNormalGlob = import.meta.glob<string>("@/assets/geo/terrain/provinces/*/normal.webp", {
  query: "?url",
  import: "default",
  eager: true,
});

const provinceBakeMetaGlob = import.meta.glob<{ default: { projBounds?: GeoProjBounds } }>(
  "@/assets/geo/terrain/provinces/*/_source/bake-meta.json",
  { eager: true },
);

const provinceBakeProjBoundsByAdcode = new Map<number, GeoProjBounds>();
for (const [key, mod] of Object.entries(provinceBakeMetaGlob)) {
  const m = /provinces\/(\d+)\/_source\/bake-meta\.json$/.exec(key);
  if (!m) continue;
  const data = "default" in mod ? mod.default : (mod as { projBounds?: GeoProjBounds });
  if (data.projBounds) provinceBakeProjBoundsByAdcode.set(Number(m[1]), data.projBounds);
}

const provinceMetaByAdcode = new Map<number, { bounds: number[]; size: number }>();
for (const [key, mod] of Object.entries(provinceMetaGlob)) {
  const m = /provinces\/(\d+)\/meta\.json$/.exec(key);
  if (!m) continue;
  const data = "default" in mod ? mod.default : (mod as { bounds: number[]; size: number });
  provinceMetaByAdcode.set(Number(m[1]), data);
}

function provinceAssetUrl(glob: Record<string, string>, adcode: number, kind: string): string | null {
  const key = Object.keys(glob).find((k) => k.includes(`/provinces/${adcode}/${kind}.webp`));
  return key ? glob[key] : null;
}

function hasProvinceTerrainPack(adcode: number): boolean {
  return provinceMetaByAdcode.has(adcode);
}

/** 市/区县 mapId 归一到省级 adcode（XX0000） */
export function resolveProvinceAdcodeFromMapId(mapId: string): number | null {
  const raw = parseAdcodeFromMapId(mapId);
  if (raw == null) return null;
  return Math.floor(raw / 10000) * 10000;
}

export function resolveProvinceTerrainUvBounds(
  mapId: string | undefined,
  drillDepth = 0,
): GeoProjBounds | null {
  const { level, adcode } = resolveTerrainPackKey(mapId, drillDepth);
  if (level !== "province" || adcode == null) return null;
  return provinceBakeProjBoundsByAdcode.get(adcode) ?? null;
}

export function parseAdcodeFromMapId(mapId: string): number | null {
  const m = /^vs-geo-(\d{6})$/.exec(mapId.trim());
  if (!m) return null;
  return Number(m[1]);
}

export function resolveTerrainPackKey(mapId: string | undefined, drillDepth = 0): {
  level: "national" | "province";
  adcode: number | null;
} {
  const id = mapId?.trim() || VS_REGIONS_MAP_ID;
  if (drillDepth <= 0 || id === VS_REGIONS_MAP_ID) {
    return { level: "national", adcode: null };
  }
  const provinceAdcode = resolveProvinceAdcodeFromMapId(id);
  if (provinceAdcode != null && hasProvinceTerrainPack(provinceAdcode)) {
    return { level: "province", adcode: provinceAdcode };
  }
  return { level: "national", adcode: null };
}

/** 下钻到省/市时优先用省级高分辨率卫星贴图，全国桥接仅作兜底 */
export function shouldLoadProvinceTerrainPack(
  mapId: string | undefined,
  drillDepth: number,
): boolean {
  if (drillDepth <= 0) return false;
  return resolveTerrainPackKey(mapId, drillDepth).level === "province";
}

function boundsFromMeta(meta: { bounds: number[] }): TerrainGeoBounds {
  const [west, south, east, north] = meta.bounds;
  return { west, south, east, north };
}

function loadTexture(url: string, colorSpace?: THREE.ColorSpace): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        if (colorSpace) tex.colorSpace = colorSpace;
        resolve(tex);
      },
      undefined,
      () => reject(new Error(`terrain texture failed: ${url}`)),
    );
  });
}

async function loadTextureWithRetry(
  url: string,
  colorSpace?: THREE.ColorSpace,
  retries = 1,
): Promise<THREE.Texture> {
  try {
    return await loadTexture(url, colorSpace);
  } catch (err) {
    if (retries <= 0) throw err;
    return loadTextureWithRetry(url, colorSpace, retries - 1);
  }
}

function metaSource(meta: { source?: string }): TerrainCapSource {
  return meta.source === "procedural" ? "procedural" : "satellite";
}

function createPack(
  level: "national" | "province",
  adcode: number | null,
  bounds: TerrainGeoBounds,
  source: TerrainCapSource,
  diffuseUrl: string,
  normalUrl?: string | null,
): Promise<ChinaTerrainPack> {
  return loadTextureWithRetry(diffuseUrl, THREE.SRGBColorSpace).then(async (colorMap) => {
    let normalMap: THREE.Texture | undefined;

    if (normalUrl && source !== "satellite") {
      try {
        normalMap = await loadTextureWithRetry(normalUrl);
      } catch {
        normalMap = undefined;
      }
    }

    return {
      level,
      adcode,
      bounds,
      source,
      colorMap,
      normalMap,
      ...(import.meta.env.DEV ? { debugUrl: diffuseUrl } : {}),
      dispose: () => {
        colorMap.dispose();
        normalMap?.dispose();
      },
    };
  });
}

const cache = new Map<string, Promise<ChinaTerrainPack>>();

export function loadChinaTerrainPack(opts: LoadTerrainPackOpts): Promise<ChinaTerrainPack> {
  const { mapId, drillDepth = 0 } = opts;
  const keySpec = resolveTerrainPackKey(mapId, drillDepth);
  const cacheKey = `${keySpec.level}:${keySpec.adcode ?? CHINA_TERRAIN_NATIONAL_ID}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let promise: Promise<ChinaTerrainPack>;
  if (keySpec.level === "province" && keySpec.adcode != null) {
    const adcode = keySpec.adcode;
    const meta = provinceMetaByAdcode.get(adcode);
    const diffuse = provinceAssetUrl(provinceDiffuseGlob, adcode, "diffuse");
    const normal = provinceAssetUrl(provinceNormalGlob, adcode, "normal");
    if (!meta || !diffuse) {
      promise = loadChinaTerrainPack({
        mapId: VS_REGIONS_MAP_ID,
        drillDepth: 0,
      });
    } else {
      promise = createPack(
        "province",
        adcode,
        boundsFromMeta(meta),
        metaSource(meta),
        diffuse,
        normal,
      );
    }
  } else {
    promise = createPack(
      "national",
      null,
      boundsFromMeta(nationalMeta),
      metaSource(nationalMeta),
      nationalDiffuseUrl,
      nationalNormalUrl,
    );
  }

  cache.set(cacheKey, promise);
  promise.catch(() => {
    cache.delete(cacheKey);
  });
  return promise;
}

export function clearChinaTerrainPackCache(): void {
  cache.clear();
}

export function nationalTerrainBounds(): TerrainGeoBounds {
  return boundsFromMeta(nationalMeta);
}
