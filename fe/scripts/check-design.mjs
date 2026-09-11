#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "../src");
const SKIP_FILES = new Set([path.join(SRC_ROOT, "index.css")]);
const EXT_RE = /\.(ts|tsx|css)$/i;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGB_RE = /rgba?\(/;

function parseScanRoot() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf("--root");
  if (rootIdx >= 0 && args[rootIdx + 1]) {
    return path.resolve(args[rootIdx + 1]);
  }
  return SRC_ROOT;
}

const SCAN_ROOT = parseScanRoot();

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (EXT_RE.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function checkFile(filePath) {
  if (SKIP_FILES.has(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes("@design-token-ok")) continue;
    const colHex = line.search(HEX_RE);
    if (colHex >= 0) {
      hits.push({ line: i + 1, col: colHex + 1, snippet: line.trim() });
      continue;
    }
    const colRgb = line.search(RGB_RE);
    if (colRgb >= 0) {
      hits.push({ line: i + 1, col: colRgb + 1, snippet: line.trim() });
    }
  }
  return hits;
}

const files = walk(SCAN_ROOT);
let failed = false;

for (const file of files) {
  const hits = checkFile(file);
  for (const hit of hits) {
    failed = true;
    const rel = path.relative(process.cwd(), file);
    console.error(`${rel}:${hit.line}:${hit.col} hardcoded color — ${hit.snippet}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`check:design passed (${files.length} files scanned)`);
process.exit(0);
