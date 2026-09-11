import type { TileServiceResolve } from "@/lib/tileServices";

export const GIS_GLYPH_PROBE_FONTSTACK = "Noto Sans Regular";
export const GIS_GLYPH_PROBE_RANGE = "0-255";

const ASSETS_UNAVAILABLE =
  "标注资源不可用。请把 basemaps-assets 放到与 PMTiles 同一瓦片服务目录。";

export type TileServiceAssetsProbe = { ok: true } | { ok: false; message: string };

export function expandGlyphsProbeUrl(glyphsUrl: string): string {
  return glyphsUrl
    .replaceAll("{fontstack}", encodeURIComponent(GIS_GLYPH_PROBE_FONTSTACK))
    .replaceAll("{range}", GIS_GLYPH_PROBE_RANGE);
}

export function spriteJsonUrl(spriteUrl: string): string {
  const base = spriteUrl.replace(/\.json$/i, "");
  return `${base}.json`;
}

async function fetchOk(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(url, { method: "GET", credentials: "omit" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function probeTileServiceBasemapAssets(
  resolved: Pick<TileServiceResolve, "glyphsUrl" | "spriteUrl">,
  fetchImpl: typeof fetch = fetch,
): Promise<TileServiceAssetsProbe> {
  const glyphUrl = expandGlyphsProbeUrl(resolved.glyphsUrl);
  const spriteUrl = spriteJsonUrl(resolved.spriteUrl);
  const [glyphOk, spriteOk] = await Promise.all([
    fetchOk(glyphUrl, fetchImpl),
    fetchOk(spriteUrl, fetchImpl),
  ]);
  if (glyphOk && spriteOk) return { ok: true };
  return { ok: false, message: ASSETS_UNAVAILABLE };
}
