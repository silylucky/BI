import type { TileServiceResolve } from "@/lib/tileServices";

/** 本地 PMTiles 外部服务端口（docker pmtiles-tile-server 默认 8080）。 */
const DEV_PMTILES_PORT = "8080";

export const TILE_SERVICE_ASSETS_PREFIX = "basemaps-assets";

/**
 * 开发态把跨域 PMTiles / 同机 glyphs·sprite 改走 Vite 同源代理。
 * 生产构建不改写，仍用平台登记的绝对 URL。
 */
export function resolveGisPmtilesArchiveUrl(rawUrl: string): string {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return rawUrl;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname.startsWith("/dev-pmtiles/")) {
      return rawUrl;
    }
    const colocatedPath = publicBasemapAssetPath(parsed);
    if (colocatedPath) {
      return `${window.location.origin}/dev-pmtiles${decodeURIComponent(colocatedPath)}`;
    }
    if (parsed.port !== DEV_PMTILES_PORT && !parsed.pathname.endsWith(".pmtiles")) {
      return rawUrl;
    }
    return `${window.location.origin}/dev-pmtiles${decodeURIComponent(parsed.pathname)}`;
  } catch {
    return rawUrl;
  }
}

/** 历史登记里的 github.io / jsDelivr 路径，改挂到瓦片服务的 /basemaps-assets。 */
export function publicBasemapAssetPath(parsed: URL): string | null {
  if (parsed.hostname === "protomaps.github.io" && parsed.pathname.startsWith("/basemaps-assets/")) {
    return parsed.pathname;
  }
  const jsdelivr = parsed.pathname.match(/^\/gh\/protomaps\/basemaps-assets@[^/]+(\/.*)$/);
  if (parsed.hostname.endsWith("jsdelivr.net") && jsdelivr) {
    return `/${TILE_SERVICE_ASSETS_PREFIX}${jsdelivr[1]}`;
  }
  return null;
}

export function withDevPmtilesArchiveUrl(resolved: TileServiceResolve): TileServiceResolve {
  return {
    ...resolved,
    pmtilesUrl: resolveGisPmtilesArchiveUrl(resolved.pmtilesUrl),
    glyphsUrl: resolveGisPmtilesArchiveUrl(resolved.glyphsUrl),
    spriteUrl: resolveGisPmtilesArchiveUrl(resolved.spriteUrl),
  };
}

export function buildPmtilesVectorSourceUrl(httpUrl: string): string {
  return `pmtiles://${httpUrl}`;
}

export function tileServiceOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function colocatedSpriteBaseFromPmtilesUrl(pmtilesUrl: string): string {
  const origin = tileServiceOrigin(pmtilesUrl);
  if (!origin) return `/${TILE_SERVICE_ASSETS_PREFIX}/sprites/v4`;
  return `${origin}/${TILE_SERVICE_ASSETS_PREFIX}/sprites/v4`;
}
