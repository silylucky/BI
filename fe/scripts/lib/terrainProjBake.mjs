/**
 * 对标 sc-datav shape.tsx：在参考视口 projBounds 空间烘焙卫星 diffuse，
 * 运行时 applyGeoCapBboxUv(projBounds) 线性铺展，与 mesh 坐标 1:1。
 */
import * as d3 from "d3";
import { stitchSatellitePng } from "./satelliteTileStitch.mjs";
import { mercatorNormalizedY } from "./terrainMercator.mjs";
import { buildTerrainThreeProject, TERRAIN_REF_VIEWPORT } from "./terrainThreeProject.mjs";

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function bilinearSample(data, width, height, fx, fy) {
  const x = Math.max(0, Math.min(width - 1, fx));
  const y = Math.max(0, Math.min(height - 1, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c += 1) {
    const v00 = data[i00 + c];
    const v10 = data[i10 + c];
    const v01 = data[i01 + c];
    const v11 = data[i11 + c];
    out[c] = Math.round(
      v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty,
    );
  }
  return out;
}

function sampleMercatorRgba(data, mercW, mercH, lng, lat, bounds) {
  const lngSpan = bounds.east - bounds.west || 1;
  const yNorth = mercatorNormalizedY(bounds.north);
  const ySouth = mercatorNormalizedY(bounds.south);
  const ySpan = ySouth - yNorth || 1;
  const u = clamp01((lng - bounds.west) / lngSpan);
  const v = clamp01((mercatorNormalizedY(lat) - yNorth) / ySpan);
  const px = u * (mercW - 1);
  const py = v * (mercH - 1);
  return bilinearSample(data, mercW, mercH, px, py);
}

/**
 * @param {import('sharp')} sharp
 * @param {{ west: number; south: number; east: number; north: number }} bounds
 * @param {import('geojson').FeatureCollection} featureCollection
 * @param {number} outputSize
 * @param {number} zoom
 * @param {'diffuse'|'normal'} kind
 */
export async function bakeProjSatellitePng(
  sharp,
  bounds,
  featureCollection,
  outputSize,
  zoom,
  kind,
) {
  const mercSize = Math.min(outputSize * 2, 8192);
  const { buffer: mercBuffer, width: mercW, height: mercH } = await stitchSatellitePng(
    sharp,
    bounds,
    mercSize,
    zoom,
    kind,
  );
  const { data: mercData } = await sharp(mercBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: refW, height: refH } = TERRAIN_REF_VIEWPORT;
  const geoProject = buildTerrainThreeProject(
    refW,
    refH,
    featureCollection.features,
    featureCollection,
  );
  const { projBounds, projection, viewport, margin, centerX, centerY } = geoProject;
  const spanX = projBounds.maxX - projBounds.minX || 1;
  const spanY = projBounds.maxY - projBounds.minY || 1;
  const aspect = spanY / spanX;
  const outW = outputSize;
  const outH = Math.max(1, Math.round(outputSize * aspect));
  const bakeW = Math.min(outW, 2048);
  const bakeH = Math.max(1, Math.round(bakeW * aspect));

  const outData = Buffer.alloc(bakeW * bakeH * 4);

  for (let py = 0; py < bakeH; py += 1) {
    for (let px = 0; px < bakeW; px += 1) {
      const uMesh = px / (bakeW - 1 || 1);
      const vMesh = 1 - py / (bakeH - 1 || 1);
      const x = projBounds.minX + uMesh * spanX;
      const y = projBounds.minY + vMesh * spanY;

      const screenX = x + centerX + viewport.width / 2 - margin.left;
      const screenY = viewport.height / 2 - (y + centerY) - margin.top;
      const lngLat = projection.invert?.([screenX, screenY]);

      let rgba = [0, 0, 0, 0];
      if (lngLat && d3.geoContains(featureCollection, lngLat)) {
        rgba = sampleMercatorRgba(mercData, mercW, mercH, lngLat[0], lngLat[1], bounds);
      }

      const i = (py * bakeW + px) * 4;
      outData[i] = rgba[0];
      outData[i + 1] = rgba[1];
      outData[i + 2] = rgba[2];
      outData[i + 3] = rgba[3];
    }
  }

  let buffer = await sharp(outData, { raw: { width: bakeW, height: bakeH, channels: 4 } })
    .png()
    .toBuffer();
  if (bakeW !== outW || bakeH !== outH) {
    buffer = await sharp(buffer).resize(outW, outH, { fit: "fill" }).png().toBuffer();
  }

  return {
    buffer,
    width: outW,
    height: outH,
    projBounds,
    refViewport: [refW, refH],
  };
}
