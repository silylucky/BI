/**
 * Mirror fe/public/template-assets to an external folder (and optional reverse).
 * Run: npm run sync:template-assets
 * Env: TEMPLATE_ASSETS_MIRROR (default: ../../template-assets on Desktop)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, "../public/template-assets");
const TARGET = path.resolve(
  process.env.TEMPLATE_ASSETS_MIRROR ||
    path.join(__dirname, "../../../template-assets"),
);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(full);
    else n += 1;
  }
  return n;
}

if (!fs.existsSync(SOURCE)) {
  console.error(`Source not found: ${SOURCE}`);
  process.exit(1);
}

copyDir(SOURCE, TARGET);
const total = countFiles(TARGET);

// 确保单页图库在镜像目录根目录
const catalogSrc = path.join(SOURCE, "catalog.html");
const catalogDest = path.join(TARGET, "catalog.html");
if (fs.existsSync(catalogSrc)) {
  fs.copyFileSync(catalogSrc, catalogDest);
}

console.log(`Synced ${SOURCE}`);
console.log(`     -> ${TARGET}`);
console.log(`Total files: ${total} (packs subtree: ${countFiles(path.join(TARGET, "packs"))}+)`);
if (fs.existsSync(catalogDest)) {
  console.log(`Open catalog: ${catalogDest}`);
}

if (total < 200) {
  console.warn(`Warning: only ${total} files in mirror; run generate:gov-assets && generate:de-dashboard-assets first.`);
  process.exit(1);
}
