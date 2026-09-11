/**
 * 离线打包全国市级下辖区县 GeoJSON（构建期脚本，符合 GEO-IRON-01）。
 * 数据源：阿里 DataV 行政区划边界（仅开发机拉取一次，产物入库）。
 *
 * 用法：node fe/scripts/bundle-geo-districts.mjs [--force] [--limit=N]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CITIES_DIR = path.join(ROOT, "src/assets/geo/cities");
const DISTRICTS_DIR = path.join(ROOT, "src/assets/geo/districts");
const DATAV_BASE = "https://geo.datav.aliyun.com/areas_v3/bound";

const force = process.argv.includes("--force");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

async function listCityAdcodes() {
  const files = await fs.readdir(CITIES_DIR);
  const codes = new Set();
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(CITIES_DIR, file), "utf8");
    const geo = JSON.parse(raw);
    for (const f of geo.features ?? []) {
      const adcode = f.properties?.adcode;
      const level = f.properties?.level;
      if (level === "city" && Number.isFinite(adcode)) codes.add(adcode);
    }
  }
  return [...codes].sort((a, b) => a - b);
}

async function fetchDistrictGeo(cityAdcode) {
  const url = `${DATAV_BASE}/${cityAdcode}_full.json`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  await fs.mkdir(DISTRICTS_DIR, { recursive: true });
  const cityCodes = await listCityAdcodes();
  const slice = cityCodes.slice(0, Number.isFinite(limit) ? limit : cityCodes.length);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const code of slice) {
    const out = path.join(DISTRICTS_DIR, `${code}.json`);
    if (!force) {
      try {
        await fs.access(out);
        skip += 1;
        continue;
      } catch {
        /* missing */
      }
    }
    try {
      const geo = await fetchDistrictGeo(code);
      if (!geo) {
        console.warn(`skip ${code}: no district asset`);
        skip += 1;
        continue;
      }
      await fs.writeFile(out, `${JSON.stringify(geo)}\n`, "utf8");
      ok += 1;
      if (ok % 20 === 0) console.log(`bundled ${ok} districts…`);
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      console.error(`fail ${code}:`, e);
      fail += 1;
    }
  }

  console.log(`done: ok=${ok} skip=${skip} fail=${fail} cities=${slice.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
