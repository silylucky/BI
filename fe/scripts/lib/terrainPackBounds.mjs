import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVINCES_GEO = path.resolve(__dirname, "../../src/assets/geo/china-provinces.json");

function walkGeometryCoords(geometry, visit) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) for (const c of ring) visit(c);
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) for (const c of ring) visit(c);
    }
  }
}

function isDecorativeGeoFeature(properties) {
  const adcode = properties?.adcode;
  if (typeof adcode === "string" && adcode.includes("_JD")) return true;
  return properties?.adchar === "JD";
}

function boundsFromFeatures(features, padRatio = 0.02) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;

  const visit = (coord) => {
    const [lng, lat] = coord;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  };

  for (const f of features) {
    if (f.geometry) walkGeometryCoords(f.geometry, visit);
  }

  const padLng = (east - west) * padRatio || 0.5;
  const padLat = (north - south) * padRatio || 0.5;
  return {
    west: west - padLng,
    east: east + padLng,
    south: south - padLat,
    north: north + padLat,
  };
}

export async function readNationalBounds() {
  const raw = await fs.readFile(PROVINCES_GEO, "utf8");
  const geo = JSON.parse(raw);
  const features = (geo.features ?? []).filter((f) => !isDecorativeGeoFeature(f.properties));
  return boundsFromFeatures(features, 0.02);
}

export async function readProvinceBounds(adcode) {
  const raw = await fs.readFile(PROVINCES_GEO, "utf8");
  const geo = JSON.parse(raw);
  const feature = geo.features?.find((f) => f.properties?.adcode === adcode);
  if (!feature?.geometry) return null;
  return boundsFromFeatures([feature], 0.06);
}
