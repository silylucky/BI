/**
 * 将现有 diffuse.webp / normal.webp 导出为 _source/*.png（无网络时的引导）
 * 用法：node scripts/bootstrap-terrain-source-from-webp.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ALL_PROVINCE_ADCODES } from "./lib/terrainProvinceAdcodes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../src/assets/geo/terrain");

async function bootstrapPack(packDir) {
  const sourceDir = path.join(packDir, "_source");
  await fs.mkdir(sourceDir, { recursive: true });
  for (const kind of ["diffuse", "normal"]) {
    const webp = path.join(packDir, `${kind}.webp`);
    const png = path.join(sourceDir, `${kind}.png`);
    try {
      await fs.access(webp);
    } catch {
      continue;
    }
    try {
      await fs.access(png);
      console.log(`  skip ${kind}.png (exists)`);
      continue;
    } catch {
      /* create missing only */
    }
    await sharp(webp).png().toFile(png);
    console.log(`  ${png}`);
  }
}

async function main() {
  console.log("national");
  await bootstrapPack(path.join(OUT, "national"));
  for (const adcode of ALL_PROVINCE_ADCODES) {
    console.log(`province ${adcode}`);
    await bootstrapPack(path.join(OUT, "provinces", String(adcode)));
  }
  console.log("Done. Replace _source/*.png with sat-hunter exports when available.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
