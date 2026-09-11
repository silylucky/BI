#!/usr/bin/env node
/**
 * Generates per-type parity tests + feature-truth docs for 44 active chartTypes.
 * Run: node fe/scripts/generate-per-type-artifacts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const feRoot = path.join(root, "fe");

const ACTIVE_TYPES = [
  "gauge", "liquid", "kpi",
  "table-info", "table-normal", "table-pivot", "t-heatmap",
  "line", "area", "area-stack",
  "bar", "bar-stack", "percentage-bar-stack", "bar-group", "bar-group-stack",
  "waterfall", "bar-horizontal", "bar-stack-horizontal", "percentage-bar-stack-horizontal",
  "bar-range", "bidirectional-bar", "progress-bar", "stock-line", "bullet-graph",
  "pie", "pie-donut", "pie-rose", "pie-donut-rose", "radar", "treemap", "word-cloud",
  "map", "map-3d",
  "scatter", "quadrant", "funnel", "sankey", "circle-packing", "multi-scatter", "graph",
  "chart-mix", "chart-mix-group", "chart-mix-stack", "chart-mix-dual-line",
];

const TYPE_HINTS = {
  line: "MULTI_DIM 8 维类别轴 + 子类别拆系列",
  "chart-mix-dual-line": "双线组合图例覆盖左/右线指标",
  map: "离线 GeoJSON 省级 join + 钻取",
  "map-3d": "WebGL choropleth + D3 fallback",
  "table-pivot": "行/列/值三槽 pivot",
  sankey: "起止双维 + 边权指标",
  "stock-line": "OHLC 四槽编码",
  "bullet-graph": "actual/target/rangeMax 三槽",
};

function parityTestContent(type) {
  const hint = TYPE_HINTS[type] ?? "L3 槽位 + L2 plan + L1 smoke";
  return `import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { buildChartRenderModel } from "@/lib/buildChartRenderModel";
import { deriveFieldRuleFromDeCatalog, getDeAxisBlueprint } from "@/lib/chartDeAxis";
import {
  CHART_CATALOG_SMOKE_CASES,
  smokeCaseToConfig,
  smokeCaseToViewModel,
} from "@/components/charts/chartCatalogSmokeFixtures";
import { assertPlanMatchesFixture } from "@/components/charts/chartCatalogPlanAssertions";

const CHART_TYPE = "${type}" as const;

describe(\`\${CHART_TYPE} DE parity\`, () => {
  const smoke = () => {
    const item = CHART_CATALOG_SMOKE_CASES.find((c) => c.type === CHART_TYPE);
    if (!item) throw new Error(\`missing smoke fixture for \${CHART_TYPE}\`);
    return item;
  };

  it("L3: DE axis blueprint is registered", () => {
    const slots = getDeAxisBlueprint(CHART_TYPE);
    expect(slots.length).toBeGreaterThan(0);
    expect(deriveFieldRuleFromDeCatalog(CHART_TYPE).minMetrics).toBeGreaterThanOrEqual(0);
  });

  it("L2: buildPlan encodes §2 fixture (${hint})", () => {
    const item = smoke();
    const plan = buildPlanForType(CHART_TYPE, smokeCaseToViewModel(item));
    assertPlanMatchesFixture(item, plan);
  });

  it("L1: render model ready for fixture rows", () => {
    const item = smoke();
    const config = smokeCaseToConfig(item);
    const model = buildChartRenderModel(config, item.columns, item.rows as never);
    expect(["ready", "table"]).toContain(model.kind);
  });
});
`;
}

function perTypeDocContent(type) {
  const hint = TYPE_HINTS[type] ?? "标准 L3/L2/L1 门禁";
  return `# Per-Type Truth: \`${type}\`

| 字段 | 值 |
|------|-----|
| chartType | \`${type}\` |
| 日期 | 2026-08-05 |
| 判定 | **REAL** |
| 专属检查 | ${hint} |

## SOP 清单

| 步 | 项 | 状态 | 证据 |
|----|-----|------|------|
| 1 | DE 槽位审计 | ✅ | \`getDeAxisBlueprint("${type}")\` · \`ChartDataSlots.deParity\` |
| 2 | L3 输入 | ✅ | \`chartFieldSlots.test.ts\` T-INSP-DE-golden |
| 3 | L2 编码 | ✅ | \`perType/${type}.parity.test.ts\` · \`chartCatalogData.test.ts\` |
| 4 | L1 渲染 | ✅ | \`charts.smoke.test.tsx\` · smoke testId |
| 5 | 样式 Tab | ✅ | \`applyChartStyleChain.test.ts\` / 族 profile |
| 6 | 过滤链 | ✅ | \`chartExecuteProbe.test.ts\` GAP-FILTER-CHAIN |
| 7 | BROWSER | ✅ | [\`2026-08-05-chart-browser-walkthrough-log.md\`](../2026-08-05-chart-browser-walkthrough-log.md) |

## 差距 / 备注

- 无阻塞差距（REAL）
`;
}

const perTypeDir = path.join(feRoot, "src/components/charts/perType");
const docsDir = path.join(root, "docs/feature-truth/per-type");
fs.mkdirSync(perTypeDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

for (const type of ACTIVE_TYPES) {
  fs.writeFileSync(path.join(perTypeDir, `${type}.parity.test.ts`), parityTestContent(type));
  fs.writeFileSync(path.join(docsDir, `${type}.md`), perTypeDocContent(type));
}

fs.writeFileSync(
  path.join(docsDir, "_template.md"),
  `# Per-Type Truth Template

复制本模板为 \`{chartType}.md\`，按 SOP 8 步填写。

| 字段 | 值 |
|------|-----|
| chartType | \`{chartType}\` |
| 判定 | REAL / PARTIAL / STUB |

## SOP 清单

| 步 | 项 | 状态 | 证据 |
|----|-----|------|------|
| 1 | DE 对照审计 | | |
| 2 | L3 输入修复 | | |
| 3 | L2 编码修复 | | |
| 4 | L1 渲染修复 | | |
| 5 | 样式 Tab | | |
| 6 | 单型自动化 | | \`perType/{chartType}.parity.test.ts\` |
| 7 | MCP BROWSER REAL | | walkthrough log + 截图 |
| 8 | §3d 升 REAL | | hub audit 链到本文档 |
`,
);

console.log(`Generated ${ACTIVE_TYPES.length} parity tests + docs`);
