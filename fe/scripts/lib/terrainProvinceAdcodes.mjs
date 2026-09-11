import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVINCES_GEO = path.resolve(__dirname, "../../src/assets/geo/china-provinces.json");

function isDecorativeGeoFeature(properties) {
  const adcode = properties?.adcode;
  if (typeof adcode === "string" && adcode.includes("_JD")) return true;
  return properties?.adchar === "JD";
}

/** 34 个省级行政区 adcode（含港澳台，排除九段线等装饰要素） */
export function readAllProvinceAdcodes() {
  const geo = JSON.parse(fs.readFileSync(PROVINCES_GEO, "utf8"));
  return (geo.features ?? [])
    .filter((f) => !isDecorativeGeoFeature(f.properties) && f.geometry != null)
    .map((f) => Number(f.properties?.adcode))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export const ALL_PROVINCE_ADCODES = readAllProvinceAdcodes();
