import { colocatedSpriteBaseFromPmtilesUrl, TILE_SERVICE_ASSETS_PREFIX } from "@/components/charts/engine/maplibre/gisPmtilesUrl";

/** 与瓦片服务同机的 Protomaps sprites 根路径（无公网 CDN）。 */
export const DEFAULT_PROTOMAPS_SPRITE_BASE = `/${TILE_SERVICE_ASSETS_PREFIX}/sprites/v4`;

export function mirrorProtomapsBasemapAssetsUrl(url: string): string {
  return url.trim();
}

/** @deprecated 开发态改写已并入 resolveGisPmtilesArchiveUrl */
export function resolveDevBasemapAssetsUrl(url: string): string {
  return url.trim();
}

export function colocatedSpriteBase(pmtilesUrl: string | undefined, fallbackSprite?: string): string {
  if (fallbackSprite?.trim()) {
    const trimmed = fallbackSprite.trim();
    const flavorMatch = trimmed.match(/\/sprites\/v4\/(light|dark|grayscale|white|black)$/);
    if (flavorMatch) {
      return trimmed.replace(/\/(light|dark|grayscale|white|black)$/, "");
    }
  }
  return pmtilesUrl ? colocatedSpriteBaseFromPmtilesUrl(pmtilesUrl) : DEFAULT_PROTOMAPS_SPRITE_BASE;
}
