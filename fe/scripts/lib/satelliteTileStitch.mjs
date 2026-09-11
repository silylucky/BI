/**
 * 构建期卫星瓦片拼接（等效 sat-hunter 导出 PNG，运行时零外链）
 * 源：ESRI World Imagery + World Hillshade（与 sat-hunter 可选源一致）
 *
 * WM Y 公式须与运行时 fe/src/lib/geoMercatorUv.ts mercatorNormalizedY 一致。
 */

const TILE = 256;

/**
 * 邻接瓦片缝羽化宽度（px）。
 * ESRI World Imagery 瓦片边缘本就有色差；非重叠羽化（weight→0）会把 1px 缝扩成粗黑网格，
 * 观感劣于硬贴。重叠混合未实现前保持 0（与上午可用版本一致）。
 */
export const TILE_FEATHER = 0;

const SOURCES = {
  diffuse: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  normal: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function lngLatToTileFloat(lng, lat, zoom) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export function tileRangeForBounds(bounds, zoom) {
  const sw = lngLatToTileFloat(bounds.west, bounds.south, zoom);
  const ne = lngLatToTileFloat(bounds.east, bounds.north, zoom);
  const n = 2 ** zoom;
  const xMin = clamp(Math.floor(Math.min(sw.x, ne.x)), 0, n - 1);
  const xMax = clamp(Math.floor(Math.max(sw.x, ne.x)), 0, n - 1);
  const yMin = clamp(Math.floor(Math.min(sw.y, ne.y)), 0, n - 1);
  const yMax = clamp(Math.floor(Math.max(sw.y, ne.y)), 0, n - 1);
  return { xMin, xMax, yMin, yMax, count: (xMax - xMin + 1) * (yMax - yMin + 1) };
}

/** @param {number} dist 距瓦片内缘像素距离，0 = 完全沿用已有像素 */
export function featherWeight(dist) {
  if (TILE_FEATHER <= 0) return 1;
  if (dist >= TILE_FEATHER) return 1;
  if (dist <= 0) return 0;
  const t = dist / TILE_FEATHER;
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function blendPixelOnto(dst, srcR, srcG, srcB, srcA, weight) {
  const srcAlpha = (srcA / 255) * weight;
  const dstAlpha = dst[3] / 255;
  const outA = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outA < 1e-6) {
    dst[0] = 0;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    return;
  }
  dst[0] = Math.round((srcR * srcAlpha + dst[0] * dstAlpha * (1 - srcAlpha)) / outA);
  dst[1] = Math.round((srcG * srcAlpha + dst[1] * dstAlpha * (1 - srcAlpha)) / outA);
  dst[2] = Math.round((srcB * srcAlpha + dst[2] * dstAlpha * (1 - srcAlpha)) / outA);
  dst[3] = Math.round(outA * 255);
}

/**
 * @param {Uint8Array} canvas
 * @param {Uint8Array} tileData
 */
export function placeTileOnCanvas(canvas, canvasW, canvasH, tileData, destX, destY, opts) {
  const { featherLeft, featherTop } = opts;
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const cx = destX + x;
      const cy = destY + y;
      if (cx < 0 || cy < 0 || cx >= canvasW || cy >= canvasH) continue;

      const ti = (y * TILE + x) * 4;
      const ci = (cy * canvasW + cx) * 4;
      const srcR = tileData[ti];
      const srcG = tileData[ti + 1];
      const srcB = tileData[ti + 2];
      const srcA = tileData[ti + 3];

      let weight = 1;
      if (featherLeft) weight = featherWeight(x);
      if (featherTop) weight = Math.min(weight, featherWeight(y));

      if (canvas[ci + 3] === 0 && weight >= 1) {
        canvas[ci] = srcR;
        canvas[ci + 1] = srcG;
        canvas[ci + 2] = srcB;
        canvas[ci + 3] = srcA;
        continue;
      }

      blendPixelOnto(
        canvas.subarray(ci, ci + 4),
        srcR,
        srcG,
        srcB,
        srcA,
        weight,
      );
    }
  }
}

async function fetchTile(url, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "VitalSpan-terrain-build/1.0" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`tile ${res.status}: ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

function tileUrl(template, z, x, y) {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

async function decodeTileRgba(sharp, buf) {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

async function buildFeatheredCanvas(sharp, template, zoom, range) {
  const canvasW = (range.xMax - range.xMin + 1) * TILE;
  const canvasH = (range.yMax - range.yMin + 1) * TILE;
  const canvas = new Uint8Array(canvasW * canvasH * 4);

  for (let ty = range.yMin; ty <= range.yMax; ty += 1) {
    for (let tx = range.xMin; tx <= range.xMax; tx += 1) {
      const buf = await fetchTile(tileUrl(template, zoom, tx, ty));
      const tileData = await decodeTileRgba(sharp, buf);
      const col = tx - range.xMin;
      const row = ty - range.yMin;
      placeTileOnCanvas(canvas, canvasW, canvasH, tileData, col * TILE, row * TILE, {
        featherLeft: col > 0,
        featherTop: row > 0,
      });
    }
  }

  return { canvas, canvasW, canvasH };
}

/**
 * @param {import('sharp')} sharp
 * @param {{ west: number; south: number; east: number; north: number }} bounds
 * @param {number} outputSize
 * @param {number} zoom
 * @param {'diffuse'|'normal'} kind
 */
export async function stitchSatellitePng(sharp, bounds, outputSize, zoom, kind) {
  const range = tileRangeForBounds(bounds, zoom);
  if (range.count > MAX_TILE_COUNT) {
    throw new Error(
      `zoom ${zoom} needs ${range.count} tiles (>${MAX_TILE_COUNT}). Lower zoom or shrink bounds.`,
    );
  }

  const template = SOURCES[kind];
  const { canvas, canvasW, canvasH } = await buildFeatheredCanvas(sharp, template, zoom, range);

  const nw = lngLatToTileFloat(bounds.west, bounds.north, zoom);
  const se = lngLatToTileFloat(bounds.east, bounds.south, zoom);
  const cropLeft = Math.max(0, Math.round((nw.x - range.xMin) * TILE));
  const cropTop = Math.max(0, Math.round((nw.y - range.yMin) * TILE));
  const cropRight = Math.min(canvasW, Math.round((se.x - range.xMin) * TILE));
  const cropBottom = Math.min(canvasH, Math.round((se.y - range.yMin) * TILE));
  const cropW = Math.max(1, cropRight - cropLeft);
  const cropH = Math.max(1, cropBottom - cropTop);

  // 须先物化 composite 再 extract：sharp 链式 composite→extract 会错位（BUG-13）
  const composed = await sharp(Buffer.from(canvas), {
    raw: { width: canvasW, height: canvasH, channels: 4 },
  })
    .png()
    .toBuffer();

  const base = sharp(composed).extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH });

  const maxEdge = outputSize;
  const scale = maxEdge / Math.max(cropW, cropH);
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));
  const buffer = await base.resize(outW, outH, { fit: "fill" }).png().toBuffer();

  return { buffer, width: outW, height: outH };
}

export const MAX_TILE_COUNT = 1500;

export function pickZoom(bounds, national) {
  if (national) {
    for (const zoom of [8, 7, 6]) {
      const range = tileRangeForBounds(bounds, zoom);
      if (range.count <= MAX_TILE_COUNT) return zoom;
    }
    return 6;
  }
  const span = Math.max(bounds.east - bounds.west, bounds.north - bounds.south);
  return span > 8 ? 8 : 9;
}
