/**
 * 与 terrainProjBake / applyGeoCapBboxUv 同坐标系：在 projBounds 像素格采样高程，
 * 避免 Mercator 位移图与卫星 diffuse UV 错位产生规则「凸起」网格。
 */
import * as d3 from "d3";
import { sampleElevation } from "./chinaTerrainSynth.mjs";
import { buildTerrainThreeProject, TERRAIN_REF_VIEWPORT } from "./terrainThreeProject.mjs";

/**
 * @param {number} outW 目标宽（用于纵横比）
 * @param {number} outH 目标高
 * @param {import('geojson').FeatureCollection} featureCollection
 * @param {{ width: number; height: number }} [refViewport]
 * @param {{ maxBakeEdge?: number }} [options]
 * @returns {{ grid: Float32Array; width: number; height: number }}
 */
export function buildHeightGridProjBounds(
  outW,
  outH,
  featureCollection,
  refViewport = TERRAIN_REF_VIEWPORT,
  options = {},
) {
  const maxBakeEdge = options.maxBakeEdge ?? 1024;
  const bakeW = Math.min(outW, maxBakeEdge);
  const bakeH = Math.max(1, Math.round(bakeW * (outH / outW)));
  const geoProject = buildTerrainThreeProject(
    refViewport.width,
    refViewport.height,
    featureCollection.features,
    featureCollection,
  );
  const { projBounds, projection, viewport, margin, centerX, centerY } = geoProject;
  const spanX = projBounds.maxX - projBounds.minX || 1;
  const spanY = projBounds.maxY - projBounds.minY || 1;
  const grid = new Float32Array(bakeW * bakeH);

  for (let py = 0; py < bakeH; py += 1) {
    for (let px = 0; px < bakeW; px += 1) {
      const uMesh = px / (bakeW - 1 || 1);
      const vMesh = 1 - py / (bakeH - 1 || 1);
      const x = projBounds.minX + uMesh * spanX;
      const y = projBounds.minY + vMesh * spanY;
      const screenX = x + centerX + viewport.width / 2 - margin.left;
      const screenY = viewport.height / 2 - (y + centerY) - margin.top;
      const lngLat = projection.invert?.([screenX, screenY]);

      let h = 0;
      if (lngLat && d3.geoContains(featureCollection, lngLat)) {
        h = sampleElevation(lngLat[0], lngLat[1]);
      }
      grid[py * bakeW + px] = h;
    }
  }
  return { grid, width: bakeW, height: bakeH };
}

/** 轻度平滑，削弱 ridged 噪声在 displacement 上的尖脊 */
export function softenHeightGrid(grid, width, height, radius = 1) {
  if (radius <= 0) return grid;
  const out = new Float32Array(grid.length);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sx = Math.max(0, Math.min(width - 1, px + dx));
          const sy = Math.max(0, Math.min(height - 1, py + dy));
          sum += grid[sy * width + sx];
          n += 1;
        }
      }
      out[py * width + px] = sum / n;
    }
  }
  return out;
}
