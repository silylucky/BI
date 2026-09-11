/**
 * 诊断：mesh UV 采样点 vs 纹理像素地理内容
 */
import fs from "node:fs";
import sharp from "sharp";
import * as d3 from "d3";
import chinaProvinces from "../src/assets/geo/china-provinces.json" with { type: "json" };
import nationalMeta from "../src/assets/geo/terrain/national/meta.json" with { type: "json" };

const POINTS = [
  { name: "北京", lng: 116.4, lat: 39.9 },
  { name: "上海", lng: 121.5, lat: 31.2 },
  { name: "乌鲁木齐", lng: 87.6, lat: 43.8 },
  { name: "广州", lng: 113.3, lat: 23.1 },
  { name: "巴尔喀什湖", lng: 77.0, lat: 46.0 },
];

const bounds = {
  west: nationalMeta.bounds[0],
  south: nationalMeta.bounds[1],
  east: nationalMeta.bounds[2],
  north: nationalMeta.bounds[3],
};

function isDecorative(p) {
  const adcode = p?.adcode;
  if (typeof adcode === "string" && adcode.includes("_JD")) return true;
  return p?.adchar === "JD";
}

const features = chinaProvinces.features.filter((f) => !isDecorative(f.properties));
const collection = { type: "FeatureCollection", features };

const width = 800;
const height = 600;
const margin = { top: 8, right: 12, bottom: 24, left: 12 };
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;
const projection = d3.geoMercator().fitExtent(
  [
    [margin.left, margin.top + innerH * 0.02],
    [margin.left + innerW, margin.top + innerH * 0.98],
  ],
  collection,
);

function projectRaw(coord) {
  const p = projection(coord);
  return [p[0] + margin.left - width / 2, -(p[1] + margin.top - height / 2)];
}

let rawMinX = Infinity, rawMaxX = -Infinity, rawMinY = Infinity, rawMaxY = -Infinity;
for (const f of features) {
  const geom = f.geometry;
  const walk = (c) => {
    const pr = projectRaw(c);
    rawMinX = Math.min(rawMinX, pr[0]);
    rawMaxX = Math.max(rawMaxX, pr[0]);
    rawMinY = Math.min(rawMinY, pr[1]);
    rawMaxY = Math.max(rawMaxY, pr[1]);
  };
  if (geom.type === "Polygon") geom.coordinates.forEach((r) => r.forEach(walk));
  if (geom.type === "MultiPolygon") geom.coordinates.forEach((p) => p.forEach((r) => r.forEach(walk)));
}
const centerX = (rawMinX + rawMaxX) / 2;
const centerY = (rawMinY + rawMaxY) / 2;
const project = (c) => {
  const p = projectRaw(c);
  return [p[0] - centerX, p[1] - centerY];
};

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const f of features) {
  const geom = f.geometry;
  const walk = (c) => {
    const pr = project(c);
    minX = Math.min(minX, pr[0]);
    maxX = Math.max(maxX, pr[0]);
    minY = Math.min(minY, pr[1]);
    maxY = Math.max(maxY, pr[1]);
  };
  if (geom.type === "Polygon") geom.coordinates.forEach((r) => r.forEach(walk));
  if (geom.type === "MultiPolygon") geom.coordinates.forEach((p) => p.forEach((r) => r.forEach(walk)));
}

const corners = [
  [bounds.west, bounds.south],
  [bounds.east, bounds.south],
  [bounds.west, bounds.north],
  [bounds.east, bounds.north],
];
let tMinX = Infinity, tMaxX = -Infinity, tMinY = Infinity, tMaxY = -Infinity;
for (const c of corners) {
  const p = project(c);
  tMinX = Math.min(tMinX, p[0]);
  tMaxX = Math.max(tMaxX, p[0]);
  tMinY = Math.min(tMinY, p[1]);
  tMaxY = Math.max(tMaxY, p[1]);
}

const texBuf = await sharp("src/assets/geo/terrain/national/diffuse.webp").raw().toBuffer({
  resolveWithObject: true,
});
const { data, info } = texBuf;

function sampleTex(u, v) {
  const x = Math.max(0, Math.min(info.width - 1, Math.round(u * (info.width - 1))));
  const y = Math.max(0, Math.min(info.height - 1, Math.round((1 - v) * (info.height - 1))));
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2], x, y };
}

function sampleLngLat(lng, lat) {
  const u = (lng - bounds.west) / (bounds.east - bounds.west);
  const latRad = (lat * Math.PI) / 180;
  const yN = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  const yNorth = (1 - Math.log(Math.tan((bounds.north * Math.PI) / 180) + 1 / Math.cos((bounds.north * Math.PI) / 180)) / Math.PI) / 2;
  const ySouth = (1 - Math.log(Math.tan((bounds.south * Math.PI) / 180) + 1 / Math.cos((bounds.south * Math.PI) / 180)) / Math.PI) / 2;
  const v = (yN - ySouth) / (yNorth - ySouth);
  return sampleTex(u, v);
}

console.log("terrainProjBounds", { tMinX, tMaxX, tMinY, tMaxY });
console.log("mesh proj", { minX, maxX, minY, maxY });

for (const p of POINTS) {
  const mesh = project([p.lng, p.lat]);
  const u = (mesh[0] - tMinX) / (tMaxX - tMinX);
  const v = (mesh[1] - tMinY) / (tMaxY - tMinY);
  const viaBbox = sampleTex(u, v);
  const viaLngLat = sampleLngLat(p.lng, p.lat);
  const inside = d3.geoContains(collection, [p.lng, p.lat]);
  console.log(p.name, { inside, u: u.toFixed(3), v: v.toFixed(3), viaBbox, viaLngLat });
}
