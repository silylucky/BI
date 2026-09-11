/**
 * 对标 sat-hunter「按区域轮廓下载」：瓦片拼接后按 GeoJSON 轮廓 alpha 裁切。
 * 纹理语义 = Mercator 瓦片中间产物；最终 diffuse 在 projBounds 空间烘焙（terrainProjBake.mjs）。
 */
import * as d3 from "d3";
import { pixelToLngLat } from "./terrainMercator.mjs";
import { stitchSatellitePng } from "./satelliteTileStitch.mjs";

/**
 * @param {import('sharp')} sharp
 * @param {Buffer} rgbaBuffer
 * @param {number} width
 * @param {number} height
 * @param {{ west: number; south: number; east: number; north: number }} bounds
 * @param {GeoJSON.FeatureCollection} featureCollection
 */
export async function maskTerrainToContour(sharp, rgbaBuffer, width, height, bounds, featureCollection) {
  const { data } = await sharp(rgbaBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const { lng, lat } = pixelToLngLat(px, py, width, height, bounds);
      const i = (py * width + px) * 4;
      if (!d3.geoContains(featureCollection, [lng, lat])) {
        data[i + 3] = 0;
      }
    }
  }

  return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * @param {import('sharp')} sharp
 * @param {{ west: number; south: number; east: number; north: number }} bounds
 * @param {GeoJSON.FeatureCollection} featureCollection
 * @param {number} outputSize
 * @param {number} zoom
 * @param {'diffuse'|'normal'} kind
 */
export async function stitchContourSatellitePng(sharp, bounds, featureCollection, outputSize, zoom, kind) {
  const { buffer, width, height } = await stitchSatellitePng(sharp, bounds, outputSize, zoom, kind);
  const masked = await maskTerrainToContour(sharp, buffer, width, height, bounds, featureCollection);
  return { buffer: masked, width, height };
}
