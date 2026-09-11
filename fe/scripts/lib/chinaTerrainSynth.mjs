/** 离线高程合成 + hillshade / normal / displacement（构建脚本用） */

import { pixelToLngLat } from "./terrainMercator.mjs";

export const CHINA_BOUNDS = Object.freeze({
  west: 73,
  east: 136,
  south: 17,
  north: 54,
});

export { ALL_PROVINCE_ADCODES, readAllProvinceAdcodes } from "./terrainProvinceAdcodes.mjs";

/** @deprecated 使用 ALL_PROVINCE_ADCODES */
export { ALL_PROVINCE_ADCODES as PILOT_PROVINCE_ADCODES } from "./terrainProvinceAdcodes.mjs";

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function ridged(lng, lat) {
  let v = 0;
  let amp = 0.55;
  let freq = 0.18;
  for (let i = 0; i < 6; i += 1) {
    const n = smoothNoise(lng * freq, lat * freq * 0.94);
    const r = 1 - Math.abs(n * 2 - 1);
    v += r * r * amp;
    freq *= 2.1;
    amp *= 0.52;
  }
  return v;
}

function detailFbm(lng, lat) {
  let v = 0;
  let amp = 0.5;
  let freq = 0.65;
  for (let i = 0; i < 4; i += 1) {
    v += amp * smoothNoise(lng * freq, lat * freq);
    freq *= 2.2;
    amp *= 0.5;
  }
  return v;
}

export function sampleElevation(lng, lat) {
  const westHigh = Math.max(0, Math.min(1, (lng - 78) / 52)) * 0.38;
  const plateau = Math.max(0, Math.min(1, (lat - 27) / 12)) * westHigh * 0.22;
  const ridge = ridged(lng, lat) * 0.52;
  const detail = detailFbm(lng, lat) * 0.14;
  const basin = lat > 28 && lat < 34 && lng > 102 && lng < 110 ? -0.08 : 0;
  return Math.max(0, Math.min(1, 0.12 + westHigh + plateau + ridge + detail + basin));
}

function lngLatToGrid(lng, lat, bounds, size) {
  const gx = ((lng - bounds.west) / (bounds.east - bounds.west)) * (size - 1);
  const gy = ((bounds.north - lat) / (bounds.north - bounds.south)) * (size - 1);
  return [gx, gy];
}

function sampleGrid(height, size, gx, gy) {
  const x = Math.max(0, Math.min(size - 1, gx));
  const y = Math.max(0, Math.min(size - 1, gy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, size - 1);
  const y1 = Math.min(y0 + 1, size - 1);
  const tx = x - x0;
  const ty = y - y0;
  const h00 = height[y0 * size + x0];
  const h10 = height[y0 * size + x1];
  const h01 = height[y1 * size + x0];
  const h11 = height[y1 * size + x1];
  return h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) + h01 * (1 - tx) * ty + h11 * tx * ty;
}

export function buildHeightGrid(size, bounds) {
  const grid = new Float32Array(size * size);
  for (let py = 0; py < size; py += 1) {
    const lat = bounds.north - (py / (size - 1)) * (bounds.north - bounds.south);
    for (let px = 0; px < size; px += 1) {
      const lng = bounds.west + (px / (size - 1)) * (bounds.east - bounds.west);
      grid[py * size + px] = sampleElevation(lng, lat);
    }
  }
  return grid;
}

/** 与卫星 diffuse 同 Mercator 像素→经纬度映射 */
export function buildHeightGridMercator(width, height, bounds) {
  const grid = new Float32Array(width * height);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const { lng, lat } = pixelToLngLat(px, py, width, height, bounds);
      grid[py * width + px] = sampleElevation(lng, lat);
    }
  }
  return grid;
}

function hillshadeAt(height, size, px, py) {
  const zx = height[py * size + Math.min(px + 1, size - 1)] - height[py * size + Math.max(px - 1, 0)];
  const zy =
    height[Math.min(py + 1, size - 1) * size + px] - height[Math.max(py - 1, 0) * size + px];
  const slope = Math.atan(Math.sqrt(zx * zx + zy * zy) * 2.4);
  const aspect = Math.atan2(zy, -zx);
  const az = (315 * Math.PI) / 180;
  const alt = (42 * Math.PI) / 180;
  const shade =
    Math.sin(alt) * Math.sin(slope) + Math.cos(alt) * Math.cos(slope) * Math.cos(az - aspect);
  const elev = height[py * size + px];
  return Math.max(0, Math.min(1, shade * 0.55 + elev * 0.25 + 0.38));
}

function reliefRgb(shade, elev) {
  const baseR = 10 + elev * 45;
  const baseG = 18 + elev * 52;
  const baseB = 28 + elev * 70;
  const lit = shade * 0.83 + 0.32;
  return [
    Math.round(Math.min(255, baseR + lit * 138)),
    Math.round(Math.min(255, baseG + lit * 149)),
    Math.round(Math.min(255, baseB + lit * 166)),
  ];
}

export function buildTerrainRgba(height, size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const idx = py * size + px;
      const elev = height[idx];
      const shade = hillshadeAt(height, size, px, py);
      const [r, g, b] = reliefRgb(shade, elev);
      const i = idx * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

export function buildNormalRgba(height, size, strength = 3.8) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const l = height[py * size + Math.max(px - 1, 0)];
      const r = height[py * size + Math.min(px + 1, size - 1)];
      const u = height[Math.max(py - 1, 0) * size + px];
      const d = height[Math.min(py + 1, size - 1) * size + px];
      const nx = (l - r) * strength;
      const ny = (u - d) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      rgba[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      rgba[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

export function buildDisplacementRgba(height, size) {
  return buildDisplacementRgbaRect(height, size, size);
}

export function buildDisplacementRgbaRect(height, width, h) {
  const rgba = Buffer.alloc(width * h * 4);
  for (let i = 0; i < width * h; i += 1) {
    const g = Math.round(height[i] * 255);
    const o = i * 4;
    rgba[o] = g;
    rgba[o + 1] = g;
    rgba[o + 2] = g;
    rgba[o + 3] = 255;
  }
  return rgba;
}

export { lngLatToGrid, sampleGrid };
