import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src", import.meta.url));
const echartsAllowed = join(root, "components", "charts", "engine", "echarts");
const antvAllowed = join(root, "components", "charts", "engine", "antv");

const echartsPatterns = [
  /from\s+["']echarts["']/,
  /from\s+["']echarts\//,
  /from\s+["']echarts-for-react["']/,
];

const antvPatterns = [
  /from\s+["']@antv\//,
  /require\s*\(\s*["']@antv\//,
];

const forbiddenImportPatterns = [
  /from\s+["']@\/components\/charts\/engine\/echarts/,
  /from\s+["']@\/components\/charts\/engine\/antv\/s2/,
  /from\s+["']@\/components\/charts\/engine\/antv\/g2/,
];

const forbiddenDirs = [
  join(root, "components", "charts", "engine", "echarts"),
  join(root, "components", "charts", "engine", "antv", "s2"),
  join(root, "components", "charts", "engine", "antv", "g2"),
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, files);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];

for (const dir of forbiddenDirs) {
  if (existsSync(dir)) {
    violations.push(`forbidden path exists: ${relative(root, dir)}`);
  }
}

for (const file of walk(root)) {
  const content = readFileSync(file, "utf8");

  if (!file.startsWith(echartsAllowed)) {
    for (const pattern of echartsPatterns) {
      if (pattern.test(content)) {
        violations.push(`${relative(root, file)}: echarts ${pattern}`);
      }
    }
  }

  if (!file.startsWith(antvAllowed)) {
    for (const pattern of antvPatterns) {
      if (pattern.test(content)) {
        violations.push(`${relative(root, file)}: antv ${pattern}`);
      }
    }
  }

  for (const pattern of forbiddenImportPatterns) {
    if (pattern.test(content)) {
      violations.push(`${relative(root, file)}: forbidden import ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("chart-engine import gate failed:\n" + violations.join("\n"));
  process.exit(1);
}

console.log("chart-engine import gate passed");
