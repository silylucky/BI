/**
 * 构建期下载卫星/阴影瓦片到 terrain 各包的 _source 目录
 * 对标 sc-datav：参考视口 projBounds 空间烘焙 + 轮廓裁切
 *
 * 用法：
 *   pnpm run fetch:terrain-sat [-- --force]
 *   pnpm run fetch:terrain-sat -- --force --national-only
 *   pnpm run fetch:terrain-sat -- --force --provinces-only
 *   pnpm run fetch:terrain-sat -- --force --adcode=330000
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ALL_PROVINCE_ADCODES } from "./lib/terrainProvinceAdcodes.mjs";
import { pickZoom } from "./lib/satelliteTileStitch.mjs";
import { bakeProjSatellitePng } from "./lib/terrainProjBake.mjs";
import {
  loadChinaTerrainFeatureCollection,
  loadProvinceFeatureCollection,
} from "./lib/terrainGeoJson.mjs";
import { readNationalBounds, readProvinceBounds } from "./lib/terrainPackBounds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/assets/geo/terrain");

const NATIONAL_SIZE = 4096;
const PROVINCE_SIZE = 4096;

function parseCliArgs(argv) {
  const force = argv.includes("--force");
  const nationalOnly = argv.includes("--national-only");
  const provincesOnly = argv.includes("--provinces-only");
  const adcodeFilters = argv
    .filter((a) => a.startsWith("--adcode="))
    .map((a) => Number(a.slice("--adcode=".length)))
    .filter((n) => Number.isFinite(n));
  const withNormal = argv.includes("--with-normal");
  return { force, nationalOnly, provincesOnly, adcodeFilters, withNormal };
}

function resolveProvinceAdcodes(adcodeFilters) {
  if (adcodeFilters.length > 0) return adcodeFilters;
  return ALL_PROVINCE_ADCODES;
}

async function writeSourcePack(dir, bounds, featureCollection, size, national, force, withNormal) {
  const sourceDir = path.join(dir, "_source");
  await fs.mkdir(sourceDir, { recursive: true });
  const zoom = pickZoom(bounds, national);
  console.log(`  zoom=${zoom} bounds=[${bounds.west},${bounds.south},${bounds.east},${bounds.north}]`);
  console.log(`  projBounds bake: ${featureCollection.features.length} feature(s)`);

  const diffusePath = path.join(sourceDir, "diffuse.png");
  const normalPath = path.join(sourceDir, "normal.png");
  const metaPath = path.join(sourceDir, "bake-meta.json");

  if (force || !(await fileExists(diffusePath))) {
    console.log(force ? "  re-baking diffuse…" : "  baking diffuse (ESRI → projBounds)…");
    const baked = await bakeProjSatellitePng(
      sharp,
      bounds,
      featureCollection,
      size,
      zoom,
      "diffuse",
    );
    await fs.writeFile(diffusePath, baked.buffer);
    await fs.writeFile(
      metaPath,
      `${JSON.stringify({ refViewport: baked.refViewport, projBounds: baked.projBounds }, null, 2)}\n`,
    );
  } else {
    console.log("  diffuse.png exists — skip (use --force to refresh)");
  }

  if (withNormal && (force || !(await fileExists(normalPath)))) {
    try {
      console.log(force ? "  re-baking normal…" : "  baking normal (hillshade → projBounds)…");
      const { buffer } = await bakeProjSatellitePng(
        sharp,
        bounds,
        featureCollection,
        size,
        zoom,
        "normal",
      );
      await fs.writeFile(normalPath, buffer);
    } catch (err) {
      console.warn("  normal fetch failed — build will skip normal.webp:", err.message);
    }
  } else if (!withNormal) {
    console.log("  normal skipped (pass --with-normal to fetch hillshade)");
  } else {
    console.log("  normal.png exists — skip (use --force to refresh)");
  }

  console.log(`  wrote ${sourceDir}`);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { force, nationalOnly, provincesOnly, adcodeFilters, withNormal } = parseCliArgs(
    process.argv.slice(2),
  );

  if (!provincesOnly) {
    const nationalBounds = await readNationalBounds();
    const nationalFeatures = await loadChinaTerrainFeatureCollection();
    console.log("National pack…");
    await writeSourcePack(
      path.join(OUT, "national"),
      nationalBounds,
      nationalFeatures,
      NATIONAL_SIZE,
      true,
      force,
      withNormal,
    );
  }

  if (!nationalOnly) {
    const provinceAdcodes = resolveProvinceAdcodes(adcodeFilters);
    console.log(`Provinces: ${provinceAdcodes.length} pack(s)…`);
    for (const adcode of provinceAdcodes) {
      const bounds = await readProvinceBounds(adcode);
      const features = await loadProvinceFeatureCollection(adcode);
      if (!bounds || !features) {
        console.warn(`Skip ${adcode}: no bounds or geometry`);
        continue;
      }
      console.log(`Province ${adcode}…`);
      await writeSourcePack(
        path.join(OUT, "provinces", String(adcode)),
        bounds,
        features,
        PROVINCE_SIZE,
        false,
        force,
        withNormal,
      );
    }
  }

  console.log("Done. Run: pnpm run build:geo-terrain");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
