/**
 * 将图表组件回退到 a0555775（14:37），保留 three/ 3D 地图当前实现。
 * 用法：node fe/scripts/rollback-chart-to-a0555775.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASELINE = "a0555775";
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** 3D 地图（Three.js）路径：不恢复、不删除 */
const SKIP_RESTORE_PREFIX = "fe/src/components/charts/engine/three/";

const FILES_TO_DELETE = [
  "fe/src/components/charts/engine/d3/core/d3Legend.test.ts",
  "fe/src/components/charts/engine/d3/core/legendInteraction.ts",
  "fe/src/components/charts/engine/d3/core/motionEngine.test.ts",
  "fe/src/components/charts/engine/d3/geo/choroplethDrillBreadcrumb.ts",
  "fe/src/components/charts/engine/d3/geo/choroplethLabelDensity.ts",
  "fe/src/components/charts/engine/d3/geo/choroplethVisualMap.ts",
];

function gitShow(commit, path) {
  return execSync(`git show ${commit}:${path}`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function listChangedFiles() {
  const out = execSync(
    `git diff --name-only ${BASELINE}..HEAD -- fe/src/components/charts/engine fe/src/index.css fe/e2e/chart-visual-snapshots.spec.ts`,
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const changed = listChangedFiles();
function existsInBaseline(path) {
  try {
    execSync(`git cat-file -e ${BASELINE}:${path}`, { cwd: REPO_ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const toRestore = changed.filter(
  (path) => !path.startsWith(SKIP_RESTORE_PREFIX) && existsInBaseline(path),
);
const toDeleteOnly = changed.filter(
  (path) => !path.startsWith(SKIP_RESTORE_PREFIX) && !existsInBaseline(path),
);

let restored = 0;
let skipped = 0;

for (const relPath of toRestore) {
  const absPath = join(REPO_ROOT, relPath);
  try {
    const content = gitShow(BASELINE, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content, "utf8");
    restored += 1;
    console.log(`restored: ${relPath}`);
  } catch (err) {
    console.error(`failed: ${relPath}`, err.message ?? err);
    process.exitCode = 1;
  }
}

for (const relPath of changed.filter((path) => path.startsWith(SKIP_RESTORE_PREFIX))) {
  skipped += 1;
  console.log(`skipped (3d map): ${relPath}`);
}

for (const relPath of toDeleteOnly) {
  const absPath = join(REPO_ROOT, relPath);
  if (existsSync(absPath)) {
    unlinkSync(absPath);
    console.log(`deleted (not in baseline): ${relPath}`);
  }
}

for (const relPath of FILES_TO_DELETE) {
  const absPath = join(REPO_ROOT, relPath);
  if (!existsSync(absPath)) {
    console.log(`already absent: ${relPath}`);
    continue;
  }
  unlinkSync(absPath);
  console.log(`deleted: ${relPath}`);
}

console.log(`\nDone. restored=${restored}, skipped_3d=${skipped}, deleted=${FILES_TO_DELETE.length}`);
