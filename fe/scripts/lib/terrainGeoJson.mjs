import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVINCES_GEO = path.resolve(__dirname, "../../src/assets/geo/china-provinces.json");

export function isDecorativeGeoFeature(properties) {
  const adcode = properties?.adcode;
  if (typeof adcode === "string" && adcode.includes("_JD")) return true;
  return properties?.adchar === "JD";
}

export async function loadChinaTerrainFeatureCollection() {
  const raw = await fs.readFile(PROVINCES_GEO, "utf8");
  const geo = JSON.parse(raw);
  const features = (geo.features ?? [])
    .filter((f) => !isDecorativeGeoFeature(f.properties) && f.geometry != null)
    .map((f) => ({
      type: "Feature",
      properties: {
        name: f.properties?.name ?? "",
        adcode: f.properties?.adcode,
      },
      geometry: f.geometry,
    }));
  return { type: "FeatureCollection", features };
}

/** @param {number} adcode */
export async function loadProvinceFeatureCollection(adcode) {
  const collection = await loadChinaTerrainFeatureCollection();
  const features = collection.features.filter((f) => Number(f.properties?.adcode) === adcode);
  if (features.length === 0) return null;
  return { type: "FeatureCollection", features };
}
