# M9 可视化高级图表类型 companion 质量推分 r43 实现计划 — VIZ-003/004/005/006/008

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `fe/package.json` · `fe/src/lib/chartViewConfig.ts` · `fe/src/lib/chartRegistry.ts` · `fe/src/lib/echarts-theme.ts` · `fe/src/lib/chartErrors.ts` · `fe/src/assets/geo/regions-simplified.json` · `fe/src/components/charts/adapters/renderFromSpec.ts` · `fe/src/components/charts/adapters/AdvancedEchartsChart.tsx` · `fe/src/components/charts/ChartConfigPanel.tsx` · `fe/src/components/charts/ChartRenderer.tsx` · `fe/src/embed/EmbedChartPage.tsx` · `fe/src/embed/EmbedSharePanel.tsx` · `fe/src/layouts/EmbedLayout.tsx` · `fe/src/routes.tsx` · `fe/src/components/charts/charts.smoke.test.tsx` · `fe/src/components/charts/charts.advanced.smoke.test.tsx` · `backend/app/viz/embed.py` · `tests/test_viz_advanced_l1_r43.py` · `fe/src/components/README.md`
> **子项：** VIZ-003, VIZ-004, VIZ-005, VIZ-006, VIZ-008
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`fe-ui.mdc` globs `fe/**`、`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py` 由 P3 按 Files 动态匹配）

**Goal:** 在前端闭合 r42 后端 chart-spec 契约缺口 —— ECharts 高级五类型渲染 + render-spec 适配层 + 字段/样式配置 UI + `/embed/*` 嵌入表面 + vitest/pytest companion smoke，目标五 ID 加权总分 **≥90**。

**Architecture:** table/line/bar 保留 Apex（r28/r29 回归不动）；map/sankey/funnel/graph/gauge 走 `POST /charts/render-spec` → `renderFromSpec.buildEchartsOption` → `AdvancedEchartsChart`（echarts-for-react）。`chartRegistry.ts` 镜像 `GET /charts/types` 驱动 `isChartViewConfig` 与 `ChartConfigPanel` 选项。Embed 为 chromeless 独立表面（`EmbedLayout` + `/embed/chart/:chartId` + `/embed/share`）。后端仅 companion 导出 `is_origin_allowed()` 供双端复用。

**Tech Stack:** React 19 / TypeScript / Vite / vitest / ECharts 5 + echarts-for-react / ApexCharts（既有）/ FastAPI pytest。

## Global Constraints

- **companion 质量推分**：后端 r42 契约已就绪；本轮主攻 `fe/` 渲染与配置 UI，后端仅 `embed.py` 边界闭合。
- **零第三方 BI 运行时**（NFR-08）：禁止 Superset/DataEase。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不新增** HTTP 路由（复用 r42 三路由）；不新增 Alembic migration。
- **分层**（`common.mdc` + `fe-ui.mdc`）：`adapters/` = domain 渲染；`ChartRenderer` = 编排；`embed/` = entry 页面；HTTP 仅经 `@/lib/api.ts`。
- **非目标**：VIZ-007 SDK、生产地图瓦片 CDN、AntV、CSP/X-Frame-Options 响应头、时间范围选择器、`/admin/charts/explore` 独立页。
- **性能 cap**：`ADVANCED_CHART_ROW_CAP=500`、`GRAPH_NODE_CAP=200`、`SANKEY_LINK_CAP=300`；断言 cap 后节点/行数 + 警告 DOM，不断言绝对毫秒。
- **UI 设计 skill**：`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（所有触及 `fe/**/*.tsx` 的 Task 必读）。
- **验证基线**：`test_viz_advanced_l1_r42.py` 35/35 绿 + `charts.smoke.test.tsx` 7/7 绿；本轮新增 `test_viz_advanced_l1_r43.py` **≥28** 断言 + `charts.advanced.smoke.test.tsx`。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `fe/package.json` | 新增 echarts 依赖 | 修改 |
| `fe/src/lib/chartViewConfig.ts` | 扩展 9 类型 + styleVariant；registry 驱动校验 | 修改 |
| `fe/src/lib/chartRegistry.ts` | `fetchChartTypeCatalog()` 镜像 GET `/charts/types` | 新建 |
| `fe/src/lib/echarts-theme.ts` | ECharts 主题对齐 `chart-theme.ts` Token | 新建 |
| `fe/src/lib/chartErrors.ts` | `mapChartConfigError` 中文映射 | 新建 |
| `fe/src/assets/geo/regions-simplified.json` | 省级 mock GeoJSON（无 CDN） | 新建 |
| `fe/src/components/charts/adapters/renderFromSpec.ts` | RenderSpec → ECharts option | 新建 |
| `fe/src/components/charts/adapters/AdvancedEchartsChart.tsx` | 统一 ECharts 挂载 + cap 警告 | 新建 |
| `fe/src/components/charts/ChartConfigPanel.tsx` | 字段 + styleVariant 配置 UI | 新建 |
| `fe/src/components/charts/ChartRenderer.tsx` | 高级类型分发 + config 模式 | 修改 |
| `fe/src/embed/EmbedChartPage.tsx` | chromeless 单图表预览 | 新建 |
| `fe/src/embed/EmbedSharePanel.tsx` | origin 白名单 + iframe 预览 | 新建 |
| `fe/src/layouts/EmbedLayout.tsx` | 最小 chrome 布局 | 新建 |
| `fe/src/routes.tsx` | `/embed/chart/:chartId`、`/embed/share` | 修改 |
| `fe/src/components/charts/charts.smoke.test.tsx` | r28/r29 回归保持绿 | 修改（仅 mock 扩展若需） |
| `fe/src/components/charts/charts.advanced.smoke.test.tsx` | 五类型 + 配置 + Embed vitest | 新建 |
| `backend/app/viz/embed.py` | 导出 `is_origin_allowed()` | 修改 |
| `tests/test_viz_advanced_l1_r43.py` | companion pytest ≥28 断言 | 新建 |
| `fe/src/components/README.md` | 登记新公共组件 | 修改 |

预估文件数 **19 ≤ 20**（`chartErrors.ts` 为 design §4.3 组件映射必需，计入 companion 交付）。

---

## Task 1: ECharts 依赖与 chartViewConfig / chartRegistry（VIZ-003 registry 镜像）

**Files:**
- Modify: `fe/package.json`
- Modify: `fe/src/lib/chartViewConfig.ts`
- Create: `fe/src/lib/chartRegistry.ts`
- Test: `fe/src/components/charts/charts.advanced.smoke.test.tsx`（本 Task 仅建空 describe + registry 用例）

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（类型扩展影响 Dashboard 配置）
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 本 Task 不渲染 UI；类型扩展不得破坏既有 Dashboard table/line/bar 存盘配置
- `isChartViewConfig` 对旧 widget（table/line/bar）仍返回 true

**Interfaces:**
- Produces:
  - `ChartType` = 9 类型联合
  - `fetchChartTypeCatalog(): Promise<ChartTypeCatalogItem[]>`
  - `getCachedCatalog(): ChartTypeCatalogItem[] | null`
  - `isKnownChartType(type: string): boolean`
  - `isChartViewConfig(value: unknown): value is ChartViewConfig`（registry 驱动，同步 fallback 内置列表）

- [ ] **Step 1: 安装 ECharts 依赖**

```bash
cd fe && pnpm add echarts@^5.6.0 echarts-for-react@^3.0.2
```

- [ ] **Step 2: Write the failing test**

```tsx
// fe/src/components/charts/charts.advanced.smoke.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchChartTypeCatalog } from "@/lib/chartRegistry";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

describe("chartRegistry", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("T-VIZ-R43-003-02: fetchChartTypeCatalog mock 9 类型含 map", async () => {
    mockApiFetch.mockResolvedValueOnce([
      { type: "table", displayName: "表格", category: "basic", renderer: "table", styleVariants: ["default"], fieldRule: {} },
      { type: "map", displayName: "地图", category: "geo", renderer: "echarts", styleVariants: ["default"], fieldRule: { minDimensions: 1 } },
      { type: "sankey", displayName: "桑基", category: "flow", renderer: "echarts", styleVariants: ["default"], fieldRule: {} },
      { type: "funnel", displayName: "漏斗", category: "flow", renderer: "echarts", styleVariants: ["default"], fieldRule: {} },
      { type: "graph", displayName: "关系", category: "relation", renderer: "echarts", styleVariants: ["default"], fieldRule: {} },
      { type: "gauge", displayName: "仪表", category: "advanced", renderer: "echarts", styleVariants: ["default"], fieldRule: {} },
      { type: "line", displayName: "折线", category: "basic", renderer: "echarts", styleVariants: ["default"], fieldRule: {} },
      { type: "bar", displayName: "柱", category: "basic", renderer: "echarts", styleVariants: ["default", "stacked"], fieldRule: {} },
      { type: "pie", displayName: "饼", category: "basic", renderer: "echarts", styleVariants: ["default"], fieldRule: {} },
    ]);
    const catalog = await fetchChartTypeCatalog();
    expect(catalog.map((c) => c.type)).toContain("map");
    expect(catalog.length).toBe(9);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "003-02" -v`
Expected: FAIL `Cannot find module '@/lib/chartRegistry'`

- [ ] **Step 4: Implement `chartRegistry.ts`**

```ts
// fe/src/lib/chartRegistry.ts
import { apiFetch } from "@/lib/api";

export type ChartTypeCatalogItem = {
  type: string;
  displayName: string;
  category: string;
  renderer: string;
  styleVariants: string[];
  fieldRule: {
    minDimensions?: number;
    maxDimensions?: number;
    minMetrics?: number;
    maxMetrics?: number;
    note?: string;
  };
};

let cache: ChartTypeCatalogItem[] | null = null;

const FALLBACK_TYPES = [
  "table", "line", "bar", "pie", "gauge", "map", "sankey", "funnel", "graph",
] as const;

export function getCachedCatalog(): ChartTypeCatalogItem[] | null {
  return cache;
}

export function isKnownChartType(type: string): boolean {
  if (cache) return cache.some((c) => c.type === type);
  return (FALLBACK_TYPES as readonly string[]).includes(type);
}

export async function fetchChartTypeCatalog(): Promise<ChartTypeCatalogItem[]> {
  const body = await apiFetch<ChartTypeCatalogItem[]>("/charts/types");
  cache = body;
  return body;
}
```

- [ ] **Step 5: Extend `chartViewConfig.ts`**

```ts
// fe/src/lib/chartViewConfig.ts — 替换 CHART_TYPES 硬编码
import { isKnownChartType } from "./chartRegistry";

export type ChartType =
  | "table" | "line" | "bar" | "pie" | "gauge"
  | "map" | "sankey" | "funnel" | "graph";

export type ChartTypeL1 = ChartType;

export type ChartFieldRef = { field: string; label?: string | null };
export type ChartFilterRef = {
  field: string;
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";
  value: string | number | boolean | string[];
};

export type ChartViewConfig = {
  chartType: ChartType;
  styleVariant?: string;
  dataSourceId?: string;
  bindingId?: string;
  chartId?: string;
  mode?: "sql" | "table";
  sql?: string;
  schema?: string;
  table?: string;
  dimensions?: ChartFieldRef[];
  metrics?: ChartFieldRef[];
  filters?: ChartFilterRef[];
};

const BASIC_TYPES: ChartType[] = ["table", "line", "bar"];

export function isBasicChartType(type: ChartType): boolean {
  return BASIC_TYPES.includes(type);
}

export function isAdvancedEchartsType(type: ChartType): boolean {
  return !isBasicChartType(type) && type !== "pie";
}

export function isChartViewConfig(value: unknown): value is ChartViewConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as ChartViewConfig;
  return typeof v.chartType === "string" && isKnownChartType(v.chartType);
}
```

- [ ] **Step 6: Run test + typecheck**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "003-02" -v && pnpm exec tsc -b --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add fe/package.json fe/pnpm-lock.yaml fe/src/lib/chartViewConfig.ts fe/src/lib/chartRegistry.ts fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat(fe): add chartRegistry mirror and extend chartViewConfig for 9 types"
```

---

## Task 2: echarts-theme 与 mock GeoJSON（VIZ-003 地图基础）

**Files:**
- Create: `fe/src/lib/echarts-theme.ts`
- Create: `fe/src/assets/geo/regions-simplified.json`
- Test: `fe/src/components/charts/charts.advanced.smoke.test.tsx`（追加 theme 用例）

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（Token 对齐 `chart-theme.ts`）

**UI Acceptance:**
- 暗色模式下 ECharts axisLabel/tooltip 文字对比度可读（非空且非纯白底白字）
- GeoJSON 无外部 CDN 请求

**Interfaces:**
- Produces: `getEchartsTheme(isDark: boolean): Record<string, unknown>`
- Produces: `regions-simplified.json` FeatureCollection ≥10 省级 polygon

- [ ] **Step 1: Write the failing test**

```tsx
// append to charts.advanced.smoke.test.tsx
import { getEchartsTheme } from "@/lib/echarts-theme";

describe("echarts-theme", () => {
  it("T-VIZ-R43-003-03: echarts-theme 暗色 label 色非空", () => {
    const theme = getEchartsTheme(true);
    const textStyle = theme.textStyle as { color?: string };
    expect(textStyle?.color).toBeTruthy();
    expect(textStyle?.color).not.toBe("#ffffff");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "003-03" -v`
Expected: FAIL module not found

- [ ] **Step 3: Create `echarts-theme.ts`**

```ts
// fe/src/lib/echarts-theme.ts
import { chartPalette, chartAxisLabelStyle } from "./chart-theme";

export function getEchartsTheme(isDark: boolean): Record<string, unknown> {
  const labelColor = isDark ? "#98a2b3" : chartAxisLabelStyle.colors; // @design-token-ok
  const axisLine = isDark ? "#344054" : "#e4e7ec"; // @design-token-ok
  return {
    color: [chartPalette.brand, chartPalette.purple, chartPalette.success, chartPalette.info, chartPalette.pink],
    backgroundColor: "transparent",
    textStyle: { color: labelColor, fontFamily: "Outfit, sans-serif" },
    categoryAxis: {
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: { color: labelColor },
      splitLine: { lineStyle: { color: axisLine } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: { color: labelColor },
      splitLine: { lineStyle: { color: axisLine } },
    },
  };
}
```

- [ ] **Step 4: Create minimal GeoJSON（≥10 省，坐标可矩形简化）**

```json
{
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "name": "北京" }, "geometry": { "type": "Polygon", "coordinates": [[[116.0,39.5],[117.0,39.5],[117.0,40.5],[116.0,40.5],[116.0,39.5]]] } },
    { "type": "Feature", "properties": { "name": "上海" }, "geometry": { "type": "Polygon", "coordinates": [[[121.0,31.0],[122.0,31.0],[122.0,32.0],[121.0,32.0],[121.0,31.0]]] } },
    { "type": "Feature", "properties": { "name": "广东" }, "geometry": { "type": "Polygon", "coordinates": [[[113.0,22.0],[115.0,22.0],[115.0,24.0],[113.0,24.0],[113.0,22.0]]] } },
    { "type": "Feature", "properties": { "name": "浙江" }, "geometry": { "type": "Polygon", "coordinates": [[[120.0,29.0],[121.5,29.0],[121.5,30.5],[120.0,30.5],[120.0,29.0]]] } },
    { "type": "Feature", "properties": { "name": "江苏" }, "geometry": { "type": "Polygon", "coordinates": [[[118.5,31.5],[120.0,31.5],[120.0,33.0],[118.5,33.0],[118.5,31.5]]] } },
    { "type": "Feature", "properties": { "name": "四川" }, "geometry": { "type": "Polygon", "coordinates": [[[103.0,29.5],[105.0,29.5],[105.0,31.5],[103.0,31.5],[103.0,29.5]]] } },
    { "type": "Feature", "properties": { "name": "湖北" }, "geometry": { "type": "Polygon", "coordinates": [[[113.5,29.5],[115.5,29.5],[115.5,31.5],[113.5,31.5],[113.5,29.5]]] } },
    { "type": "Feature", "properties": { "name": "山东" }, "geometry": { "type": "Polygon", "coordinates": [[[117.0,35.5],[119.0,35.5],[119.0,37.5],[117.0,37.5],[117.0,35.5]]] } },
    { "type": "Feature", "properties": { "name": "河南" }, "geometry": { "type": "Polygon", "coordinates": [[[113.0,33.5],[115.0,33.5],[115.0,35.5],[113.0,35.5],[113.0,33.5]]] } },
    { "type": "Feature", "properties": { "name": "福建" }, "geometry": { "type": "Polygon", "coordinates": [[[117.5,24.5],[119.0,24.5],[119.0,26.5],[117.5,26.5],[117.5,24.5]]] } }
  ]
}
```

保存至 `fe/src/assets/geo/regions-simplified.json`。

- [ ] **Step 5: Run test — expect PASS**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "003-03" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add fe/src/lib/echarts-theme.ts fe/src/assets/geo/regions-simplified.json fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat(fe): add echarts theme tokens and mock GeoJSON for map charts"
```

---

## Task 3: renderFromSpec 适配层（VIZ-008）

**Files:**
- Create: `fe/src/components/charts/adapters/renderFromSpec.ts`
- Test: `fe/src/components/charts/charts.advanced.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- N/A（纯逻辑适配层，无 DOM）

**Interfaces:**
- Produces:
  - `RenderSpec` type（对齐 r42 `build_render_spec` 输出）
  - `ADVANCED_CHART_ROW_CAP = 500`, `GRAPH_NODE_CAP = 200`, `SANKEY_LINK_CAP = 300`
  - `buildEchartsOption(spec, rows, columns): EChartsOption`
  - `capRows(rows, cap): { rows, truncated: boolean }`

- [ ] **Step 1: Write the failing test**

```tsx
import { buildEchartsOption, type RenderSpec } from "@/components/charts/adapters/renderFromSpec";

describe("renderFromSpec", () => {
  it("T-VIZ-R43-008-01: funnel 合法 spec+rows → series[0].type===funnel", () => {
    const spec: RenderSpec = {
      engine: "echarts",
      chartType: "funnel",
      styleVariant: "default",
      encoding: { dimensions: [{ field: "stage" }], metrics: [{ field: "value" }] },
      source: {},
    };
    const columns = ["stage", "value"];
    const rows = [["A", 100], ["B", 60], ["C", 30]];
    const option = buildEchartsOption(spec, rows, columns);
    expect((option.series as Array<{ type: string }>)[0].type).toBe("funnel");
  });

  it("T-VIZ-R43-008-02: graph 201 节点 → option 节点数 ≤200", () => {
    const spec: RenderSpec = {
      engine: "echarts",
      chartType: "graph",
      styleVariant: "default",
      encoding: {
        dimensions: [{ field: "src" }, { field: "dst" }],
        metrics: [{ field: "w" }],
      },
      source: {},
    };
    const columns = ["src", "dst", "w"];
    const rows = Array.from({ length: 201 }, (_, i) => [`n${i}`, `n${i + 1}`, 1]);
    const option = buildEchartsOption(spec, rows, columns);
    const nodes = (option.series as Array<{ data: unknown[] }>)[0].data;
    expect(nodes.length).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "renderFromSpec" -v`
Expected: FAIL module not found

- [ ] **Step 3: Implement `renderFromSpec.ts`**

```ts
// fe/src/components/charts/adapters/renderFromSpec.ts
import type { ChartFieldRef } from "@/lib/chartViewConfig";
import regionsGeo from "@/assets/geo/regions-simplified.json";
import * as echarts from "echarts/core";

export const ADVANCED_CHART_ROW_CAP = 500;
export const GRAPH_NODE_CAP = 200;
export const SANKEY_LINK_CAP = 300;

export type RenderSpec = {
  engine: "echarts" | "table";
  chartType: string;
  styleVariant: string;
  encoding: { dimensions: ChartFieldRef[]; metrics: ChartFieldRef[] };
  source: Record<string, unknown>;
};

type EChartsOption = Record<string, unknown>;

function colIndex(columns: string[], field: string): number {
  return columns.indexOf(field);
}

export function capRows<T>(rows: T[], cap: number): { rows: T[]; truncated: boolean } {
  if (rows.length <= cap) return { rows, truncated: false };
  return { rows: rows.slice(0, cap), truncated: true };
}

function buildFunnelOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  const dim = spec.encoding.dimensions[0]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const di = colIndex(columns, dim);
  const mi = colIndex(columns, metric);
  const data = rows.map((r) => ({ name: String(r[di] ?? ""), value: Number(r[mi] ?? 0) }));
  return { series: [{ type: "funnel", sort: "descending", data }] };
}

function buildSankeyOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  const src = spec.encoding.dimensions[0]?.field ?? "";
  const dst = spec.encoding.dimensions[1]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const si = colIndex(columns, src);
  const di = colIndex(columns, dst);
  const mi = colIndex(columns, metric);
  const { rows: capped } = capRows(rows, SANKEY_LINK_CAP);
  const links = capped.map((r) => ({
    source: String(r[si] ?? ""),
    target: String(r[di] ?? ""),
    value: Number(r[mi] ?? 0),
  }));
  const nodes = [...new Set(links.flatMap((l) => [l.source, l.target]))].map((name) => ({ name }));
  return { series: [{ type: "sankey", data: nodes, links }] };
}

function buildGraphOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  const src = spec.encoding.dimensions[0]?.field ?? "";
  const dst = spec.encoding.dimensions[1]?.field ?? "";
  const si = colIndex(columns, src);
  const di = colIndex(columns, dst);
  const nodeSet = new Set<string>();
  const links: Array<{ source: string; target: string; value?: number }> = [];
  for (const r of rows) {
    const s = String(r[si] ?? "");
    const t = String(r[di] ?? "");
    nodeSet.add(s);
    nodeSet.add(t);
    links.push({ source: s, target: t, value: 1 });
    if (nodeSet.size > GRAPH_NODE_CAP) break;
  }
  const nodes = [...nodeSet].slice(0, GRAPH_NODE_CAP).map((name) => ({ name, value: 1 }));
  return { series: [{ type: "graph", layout: "force", roam: true, data: nodes, links: links.slice(0, GRAPH_NODE_CAP) }] };
}

function buildMapOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  const regionField = spec.encoding.dimensions[0]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const ri = colIndex(columns, regionField);
  const mi = colIndex(columns, metric);
  echarts.registerMap("vs-regions", regionsGeo as never);
  const data = rows.map((r) => ({ name: String(r[ri] ?? ""), value: Number(r[mi] ?? 0) }));
  return { series: [{ type: "map", map: "vs-regions", data }] };
}

function buildGaugeOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const mi = colIndex(columns, metric);
  const value = rows.length ? Number(rows[0][mi] ?? 0) : 0;
  return { series: [{ type: "gauge", data: [{ value }] }] };
}

export function buildEchartsOption(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
): EChartsOption {
  const { rows: capped } = capRows(rows, ADVANCED_CHART_ROW_CAP);
  switch (spec.chartType) {
    case "funnel":
      return buildFunnelOption(spec, capped, columns);
    case "sankey":
      return buildSankeyOption(spec, capped, columns);
    case "graph":
      return buildGraphOption(spec, capped, columns);
    case "map":
      return buildMapOption(spec, capped, columns);
    case "gauge":
      return buildGaugeOption(spec, capped, columns);
    default:
      return { series: [{ type: "bar", data: [] }] };
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "renderFromSpec" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fe/src/components/charts/adapters/renderFromSpec.ts fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat(fe): add renderFromSpec ECharts adapter with performance caps"
```

---

## Task 4: AdvancedEchartsChart 组件（VIZ-003/004/005/008 渲染挂载）

**Files:**
- Create: `fe/src/components/charts/adapters/AdvancedEchartsChart.tsx`
- Test: `fe/src/components/charts/charts.advanced.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `ChartPanel` 壳层语义；图表容器 `min-h-[180px]`、`data-testid="echarts-chart"`
- 超出 cap 时 `role=status` 警告「数据量较大，已采样显示前 500 条」
- desktop/mobile 无图表区高度塌陷（≥180px）
- 禁止页面内重画图表边框样式（容器样式集中在组件内）

**Interfaces:**
- Consumes: `buildEchartsOption`, `RenderSpec`, `ADVANCED_CHART_ROW_CAP`
- Produces: `AdvancedEchartsChart({ spec, rows, columns, ariaLabel })`

- [ ] **Step 1: Mock echarts-for-react + failing render test**

```tsx
vi.mock("echarts-for-react", () => ({
  default: () => <div data-testid="echarts-chart" />,
}));

import { render, screen } from "@testing-library/react";
import { AdvancedEchartsChart } from "@/components/charts/adapters/AdvancedEchartsChart";

describe("AdvancedEchartsChart", () => {
  it("T-VIZ-R43-003-01: map + 3 省 mock → echarts 容器", () => {
    render(
      <AdvancedEchartsChart
        spec={{
          engine: "echarts",
          chartType: "map",
          styleVariant: "default",
          encoding: { dimensions: [{ field: "region" }], metrics: [{ field: "v" }] },
          source: {},
        }}
        rows={[["北京", 1], ["上海", 2], ["广东", 3]]}
        columns={["region", "v"]}
        ariaLabel="地图"
      />,
    );
    expect(screen.getByTestId("echarts-chart")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "003-01" -v`
Expected: FAIL

- [ ] **Step 3: Implement component**

```tsx
// fe/src/components/charts/adapters/AdvancedEchartsChart.tsx
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { getEchartsTheme } from "@/lib/echarts-theme";
import {
  ADVANCED_CHART_ROW_CAP,
  buildEchartsOption,
  capRows,
  type RenderSpec,
} from "./renderFromSpec";

type Props = {
  spec: RenderSpec;
  rows: unknown[][];
  columns: string[];
  ariaLabel: string;
  isDark?: boolean;
};

export function AdvancedEchartsChart({ spec, rows, columns, ariaLabel, isDark = false }: Props) {
  const { rows: capped, truncated } = useMemo(
    () => capRows(rows, ADVANCED_CHART_ROW_CAP),
    [rows],
  );
  const option = useMemo(
    () => buildEchartsOption(spec, capped, columns),
    [spec, capped, columns],
  );
  const theme = useMemo(() => getEchartsTheme(isDark), [isDark]);

  return (
    <div className="min-h-[180px] w-full" aria-label={ariaLabel}>
      {truncated ? (
        <p role="status" className="mb-2 text-theme-xs text-warning-600 dark:text-warning-400">
          数据量较大，已采样显示前 {ADVANCED_CHART_ROW_CAP} 条
        </p>
      ) : null}
      <ReactECharts
        option={option}
        theme={theme}
        style={{ height: 180, width: "100%" }}
        opts={{ renderer: "canvas" }}
        data-testid="echarts-chart"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "AdvancedEchartsChart" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fe/src/components/charts/adapters/AdvancedEchartsChart.tsx fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat(fe): add AdvancedEchartsChart with row cap warning"
```

---

## Task 5: ChartConfigPanel 与 chartErrors（VIZ-004/005）

**Files:**
- Create: `fe/src/lib/chartErrors.ts`
- Create: `fe/src/components/charts/ChartConfigPanel.tsx`
- Test: `fe/src/components/charts/charts.advanced.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（Select/Label/Alert 表单密度）

**UI Acceptance:**
- 字段 Select 纵向表单：`h-11`、`rounded-lg`、`text-theme-sm`；`FormDescription` 展示 FieldRule note
- 非法 styleVariant → `Alert variant=destructive` 含「样式」或 `CHART_INVALID_STYLE_VARIANT`
- 缺 metric → 字段下中文错误（禁 toast 报字段级错误）
- desktop：配置区 `rounded-xl border` 与 Dashboard 卡片一致；mobile 无控件重叠

**Interfaces:**
- Produces: `mapChartConfigError(code: string, message?: string): string`
- Produces: `ChartConfigPanel({ config, columns, onChange, onValidateError? })`

- [ ] **Step 1: Write failing tests**

```tsx
import userEvent from "@testing-library/user-event";
import { ChartConfigPanel } from "@/components/charts/ChartConfigPanel";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("ChartConfigPanel", () => {
  it("T-VIZ-R43-005-02: funnel 缺 metric → 配置面板展示字段错误文案", async () => {
    const cfg: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [],
    };
    mockApiFetch.mockRejectedValueOnce(
      Object.assign(new Error("字段不符合要求"), {
        code: "CHART_FIELD_REQUIREMENT",
        fields: [{ field: "metrics", message: "至少 1 个度量" }],
      }),
    );
    render(<ChartConfigPanel config={cfg} columns={["stage", "value"]} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "校验配置" }));
    expect(await screen.findByText(/度量|字段/)).toBeInTheDocument();
  });

  it("T-VIZ-R43-004-02: styleVariant=invalid → alert 含样式或错误码", async () => {
    const cfg: ChartViewConfig = {
      chartType: "bar",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      styleVariant: "invalid",
      dimensions: [{ field: "d" }],
      metrics: [{ field: "m" }],
    };
    mockApiFetch.mockRejectedValueOnce(
      Object.assign(new Error("样式无效"), { code: "CHART_INVALID_STYLE_VARIANT" }),
    );
    render(<ChartConfigPanel config={cfg} columns={["d", "m"]} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "校验配置" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/样式|CHART_INVALID_STYLE_VARIANT/);
  });
});
```

- [ ] **Step 2: Implement `chartErrors.ts`**

```ts
// fe/src/lib/chartErrors.ts
const MAP: Record<string, string> = {
  CHART_FIELD_REQUIREMENT: "字段配置不符合图表要求",
  CHART_INVALID_STYLE_VARIANT: "所选样式子类型无效",
  CHART_MISSING_SERIES: "请至少配置一个度量字段",
  CHART_INVALID_TYPE: "图表类型无效",
};

export function mapChartConfigError(code: string, message?: string): string {
  return MAP[code] ?? message ?? "配置校验失败，请检查字段与样式";
}
```

- [ ] **Step 3: Implement `ChartConfigPanel.tsx`**

```tsx
// fe/src/components/charts/ChartConfigPanel.tsx
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mapChartConfigError } from "@/lib/chartErrors";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { fetchChartTypeCatalog, type ChartTypeCatalogItem } from "@/lib/chartRegistry";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  config: ChartViewConfig;
  columns: string[];
  onChange: (next: ChartViewConfig) => void;
};

export function ChartConfigPanel({ config, columns, onChange }: Props) {
  const [catalog, setCatalog] = useState<ChartTypeCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    fetchChartTypeCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const spec = catalog.find((c) => c.type === config.chartType);
  const styleVariants = spec?.styleVariants ?? ["default"];

  const updateDim = (idx: number, field: string) => {
    const dimensions = [...(config.dimensions ?? [])];
    dimensions[idx] = { field };
    onChange({ ...config, dimensions });
  };

  const updateMetric = (idx: number, field: string) => {
    const metrics = [...(config.metrics ?? [])];
    metrics[idx] = { field };
    onChange({ ...config, metrics });
  };

  const validate = async () => {
    setError(null);
    setFieldError(null);
    try {
      await apiFetch("/charts/validate", { method: "POST", body: JSON.stringify(config) });
    } catch (e) {
      const err = e as Error & { code?: string; fields?: Array<{ field: string; message: string }> };
      const msg = mapChartConfigError(err.code ?? "", err.message);
      if (err.code === "CHART_INVALID_STYLE_VARIANT") {
        setError(msg);
      } else if (err.fields?.length) {
        setFieldError(err.fields.map((f) => f.message).join("；"));
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="space-y-4">
        <div>
          <Label>维度字段</Label>
          <Select value={config.dimensions?.[0]?.field ?? ""} onValueChange={(v) => updateDim(0, v)}>
            <SelectTrigger className="h-11 rounded-lg">
              <SelectValue placeholder="选择维度" />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {spec?.fieldRule?.note ? (
            <p className="mt-1 text-theme-xs text-gray-500">{spec.fieldRule.note}</p>
          ) : null}
        </div>
        <div>
          <Label>度量字段</Label>
          <Select value={config.metrics?.[0]?.field ?? ""} onValueChange={(v) => updateMetric(0, v)}>
            <SelectTrigger className="h-11 rounded-lg">
              <SelectValue placeholder="选择度量" />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>样式子类型</Label>
          <Select
            value={config.styleVariant ?? "default"}
            onValueChange={(v) => onChange({ ...config, styleVariant: v })}
          >
            <SelectTrigger className="h-11 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {styleVariants.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {fieldError ? <p className="text-theme-sm text-error-600">{fieldError}</p> : null}
        {error ? (
          <div role="alert" className="rounded-lg border border-error-500 bg-error-50 p-3 text-theme-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
            {error}
          </div>
        ) : null}
        <Button type="button" variant="default" className="h-11 rounded-lg" onClick={validate}>
          校验配置
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "ChartConfigPanel" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fe/src/lib/chartErrors.ts fe/src/components/charts/ChartConfigPanel.tsx fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat(fe): add ChartConfigPanel with field and style variant validation UI"
```

---

## Task 6: ChartRenderer 集成改造（全类型分发）

**Files:**
- Modify: `fe/src/components/charts/ChartRenderer.tsx`
- Test: `fe/src/components/charts/charts.advanced.smoke.test.tsx` + `charts.smoke.test.tsx` 回归

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- table/line/bar Apex 路径行为不变（r28/r29 7 用例全绿）
- 高级类型：`lg:grid lg:grid-cols-2` 配置+图表分栏；`<lg` 上下堆叠
- 漏斗/桑基/关系/地图有数据态层级清晰；空数据仍走 `ChartPanel`「暂无数据」
- `mode="config"` 时渲染 `ChartConfigPanel`；Dashboard 默认 `preview`

**Interfaces:**
- Consumes: `AdvancedEchartsChart`, `ChartConfigPanel`, `RenderSpec`, `isAdvancedEchartsType`, `isBasicChartType`
- Produces: `ChartRenderer({ config, title?, mode?: "preview" | "config" })`

- [ ] **Step 1: Write failing funnel integration test**

```tsx
describe("ChartRenderer advanced", () => {
  it("T-VIZ-R43-008-03: funnel mock render-spec → data-testid=echarts-chart", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ columns: ["stage", "value"], rows: [["A", 10], ["B", 5]] })
      .mockResolvedValueOnce({
        engine: "echarts",
        chartType: "funnel",
        styleVariant: "default",
        encoding: { dimensions: [{ field: "stage" }], metrics: [{ field: "value" }] },
        source: {},
      });
    const cfg: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [{ field: "value" }],
    };
    render(<ChartRenderer config={cfg} />);
    expect(await screen.findByTestId("echarts-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R43-005-03: 501 行 → 警告 + 渲染不抛错", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => [`S${i}`, i]);
    mockApiFetch
      .mockResolvedValueOnce({ columns: ["stage", "value"], rows })
      .mockResolvedValueOnce({
        engine: "echarts",
        chartType: "funnel",
        styleVariant: "default",
        encoding: { dimensions: [{ field: "stage" }], metrics: [{ field: "value" }] },
        source: {},
      });
    const cfg: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [{ field: "value" }],
    };
    render(<ChartRenderer config={cfg} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/500/);
    expect(screen.getByTestId("echarts-chart")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Refactor `ChartRenderer.tsx`**

关键增量（在既有 Apex 路径旁新增）：

```tsx
// 新增 imports
import { isAdvancedEchartsType, isBasicChartType, type ChartViewConfig } from "@/lib/chartViewConfig";
import { apiFetch } from "@/lib/api";
import { AdvancedEchartsChart } from "./adapters/AdvancedEchartsChart";
import { ChartConfigPanel } from "./ChartConfigPanel";
import type { RenderSpec } from "./adapters/renderFromSpec";
import { createBarChartOptions, createLineChartOptions } from "@/lib/chart-theme";

type ChartRendererProps = {
  config: ChartViewConfig;
  title?: string;
  mode?: "preview" | "config";
};

// 在组件内：
const [renderSpec, setRenderSpec] = useState<RenderSpec | null>(null);
const [localConfig, setLocalConfig] = useState(config);

useEffect(() => { setLocalConfig(config); }, [config]);

useEffect(() => {
  if (!isAdvancedEchartsType(localConfig.chartType) || loading || error) return;
  apiFetch<RenderSpec>("/charts/render-spec", {
    method: "POST",
    body: JSON.stringify(localConfig),
  }).then(setRenderSpec).catch(() => setRenderSpec(null));
}, [localConfig, loading, error]);

// renderBody 内：isAdvancedEchartsType → AdvancedEchartsChart
// bar styleVariant stacked：createBarChartOptions(categories, { plotOptions: { bar: { stacked: true } } })

// return 内 ChartPanel children 外包：
<div className={mode === "config" ? "grid gap-4 lg:grid-cols-2" : ""}>
  {mode === "config" ? (
    <ChartConfigPanel config={localConfig} columns={columns} onChange={setLocalConfig} />
  ) : null}
  <div>{/* renderBody */}</div>
</div>
```

保持 `table`/`line`/`bar` 既有逻辑不变；`bar` 在 `styleVariant==="stacked"` 时传入 stacked plotOptions。

- [ ] **Step 3: Run advanced + regression tests**

Run: `cd fe && pnpm exec vitest run src/components/charts/ -v`
Expected: charts.smoke 7/7 + advanced 新增用例 PASS

- [ ] **Step 4: Commit**

```bash
git add fe/src/components/charts/ChartRenderer.tsx fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat(fe): integrate advanced ECharts path in ChartRenderer with config mode"
```

---

## Task 7: Embed 表面与 is_origin_allowed（VIZ-006）

**Files:**
- Create: `fe/src/layouts/EmbedLayout.tsx`
- Create: `fe/src/embed/EmbedChartPage.tsx`
- Create: `fe/src/embed/EmbedSharePanel.tsx`
- Modify: `fe/src/routes.tsx`
- Modify: `backend/app/viz/embed.py`
- Test: `fe/src/components/charts/charts.advanced.smoke.test.tsx`（Embed 用例）+ `tests/test_viz_advanced_l1_r43.py`（is_origin_allowed 单测开头）

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（Embed 表单 `max-w-2xl`、chromeless）
- Read `.agents/skills/fastapi/SKILL.md`（embed.py 导出）

**UI Acceptance:**
- `/embed/share`：`max-w-2xl` 居中表单；主按钮「校验并生成嵌入链接」`variant=default`
- iframe `title="嵌入图表预览"`、`rounded-lg border`；origin URL `truncate` + `title` tooltip
- 非法 origin → 字段下错误或 `role=alert`；未授权 parent → 全屏错误「当前来源未授权嵌入」
- `/embed/chart/:id`：`min-h-[240px]` Skeleton 加载；错误 `role=alert` + 重试
- mobile 375px：Embed 图表无横向溢出遮挡

**Interfaces:**
- Produces: `is_origin_allowed(origin: str, allowed: list[str]) -> bool`（Python）
- Produces: `ORIGIN_RE` 与 `_ORIGIN_RE` 一致（前端复制同 regex 于 `EmbedSharePanel`）

- [ ] **Step 1: Backend failing test**

```python
# tests/test_viz_advanced_l1_r43.py（文件开头）
from app.viz.embed import is_origin_allowed

def test_is_origin_allowed_empty_list_allows_all():
    assert is_origin_allowed("https://a.com", []) is True

def test_is_origin_allowed_match():
    assert is_origin_allowed("https://a.com", ["https://a.com"]) is True

def test_is_origin_allowed_port():
    assert is_origin_allowed("https://a.com:8443", ["https://a.com:8443"]) is True

def test_is_origin_allowed_no_match():
    assert is_origin_allowed("https://evil.com", ["https://a.com"]) is False
```

- [ ] **Step 2: Run pytest — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r43.py::test_is_origin_allowed_match -v`
Expected: FAIL `cannot import is_origin_allowed`

- [ ] **Step 3: Export from embed.py**

```python
# backend/app/viz/embed.py — 在 _ORIGIN_RE 后追加
def is_origin_allowed(origin: str, allowed: list[str]) -> bool:
    if not allowed:
        return True
    if not _ORIGIN_RE.match(origin):
        return False
    return origin in allowed
```

- [ ] **Step 4: Implement EmbedLayout + pages + routes**

```tsx
// fe/src/layouts/EmbedLayout.tsx
import { Outlet } from "react-router";

export function EmbedLayout() {
  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-900">
      <Outlet />
    </div>
  );
}
```

```tsx
// fe/src/embed/EmbedSharePanel.tsx — 核心逻辑
const ORIGIN_RE = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/;

function isOriginAllowed(origin: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  if (!ORIGIN_RE.test(origin)) return false;
  return allowed.includes(origin);
}
// 表单：chartId Input、origin Input + Badge 列表、POST /charts/embed/validate、iframe 预览 sandbox="allow-scripts"
```

```tsx
// fe/src/embed/EmbedChartPage.tsx
// 读取 :chartId、searchParams theme；检查 parent origin；ChartRenderer preview；未授权全屏错误卡片
```

```tsx
// fe/src/routes.tsx 追加
import { EmbedLayout } from "@/layouts/EmbedLayout";
import { EmbedChartPage } from "@/embed/EmbedChartPage";
import { EmbedSharePanel } from "@/embed/EmbedSharePanel";

<Route path="/embed" element={<EmbedLayout />}>
  <Route path="chart/:chartId" element={<EmbedChartPage />} />
  <Route path="share" element={<EmbedSharePanel />} />
</Route>
```

- [ ] **Step 5: Frontend failing tests**

```tsx
describe("Embed", () => {
  it("T-VIZ-R43-006-01: EmbedSharePanel 非法 origin not-a-url → 字段错误", async () => {
    render(<EmbedSharePanel />);
    await userEvent.type(screen.getByLabelText(/来源|Origin/i), "not-a-url");
    await userEvent.click(screen.getByRole("button", { name: /添加|校验/ }));
    expect(await screen.findByText(/无效|格式/)).toBeInTheDocument();
  });

  it("T-VIZ-R43-006-03: 未授权 origin → 错误态文案", () => {
    vi.stubGlobal("location", { ...window.location, origin: "https://evil.com" });
    render(<EmbedChartPage />);
    expect(screen.getByText(/未授权嵌入/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r43.py -k is_origin_allowed -v`
Run: `cd fe && pnpm exec vitest run src/components/charts/charts.advanced.smoke.test.tsx -t "Embed" -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/viz/embed.py tests/test_viz_advanced_l1_r43.py fe/src/layouts/EmbedLayout.tsx fe/src/embed/ fe/src/routes.tsx fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat: add embed surfaces and is_origin_allowed companion guard"
```

---

## Task 8: 完整测试套件 + README + 回归门控

**Files:**
- Modify: `fe/src/components/charts/charts.advanced.smoke.test.tsx`（补全五类型 + sankey + bar stacked）
- Modify: `fe/src/components/charts/charts.smoke.test.tsx`（仅当 mock 冲突时调整）
- Modify: `tests/test_viz_advanced_l1_r43.py`（补全 ≥28 断言）
- Modify: `fe/src/components/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（README 登记）

**UI Acceptance:**
- 实施完成后 `pnpm run check:design` 通过
- design §4.6 视觉 QA：Desktop light/dark、Mobile 375px、四态（空/501行/非法origin/非法style）可截图验证

- [ ] **Step 1: 补全 vitest 覆盖**

追加用例（若 Task 1–7 未覆盖）：

| ID | 用例 |
|----|------|
| T-VIZ-R43-004-01 | sankey 2 维+1 度量 → echarts 容器 |
| T-VIZ-R43-004-03 | bar stacked mock → Apex options 含 stacked |
| T-VIZ-R43-005-01 | funnel 3 阶段 mock → 漏斗 series 可见（mock option 或容器） |
| T-VIZ-R43-006-02 | 合法配置 → iframe `title` 可访问 |

- [ ] **Step 2: 补全 pytest `test_viz_advanced_l1_r43.py`（≥28 断言）**

| 类别 | 数量 | 示例 |
|------|:----:|------|
| `is_origin_allowed` 单元 | 4 | Task 7 已写 |
| render-spec 链 | ≥6 | funnel/sankey/graph/map 各 POST 200 + engine=echarts；radar 422 |
| embed HTTP 回归 | ≥7 | 复用 r42 T-VIZ-R42-006-01~08 断言 ID |
| field/style 回归 | ≥8 | 复用 r42 T-VIZ-R42-004/005 关键断言 |
| catalog | ≥3 | GET /charts/types 9 类型 + map fieldRule |

```python
def test_post_render_spec_sankey_ok(client, auth_headers):
    """T-VIZ-R43-008-04: POST /charts/render-spec 合法 sankey → 200 engine=echarts。"""
    payload = {
        "chartType": "sankey",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1",
        "dimensions": [{"field": "src"}, {"field": "dst"}],
        "metrics": [{"field": "amt"}],
    }
    resp = client.post("/api/v1/charts/render-spec", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["engine"] == "echarts"
```

- [ ] **Step 3: 更新 `fe/src/components/README.md`**

登记：

| 组件 | 路径 | 用途 |
|------|------|------|
| AdvancedEchartsChart | `charts/adapters/AdvancedEchartsChart.tsx` | 高级 ECharts 渲染（map/sankey/funnel/graph/gauge） |
| ChartConfigPanel | `charts/ChartConfigPanel.tsx` | 字段 + styleVariant 配置 |
| EmbedChartPage | `../embed/EmbedChartPage.tsx` | `/embed/chart/:chartId` |
| EmbedSharePanel | `../embed/EmbedSharePanel.tsx` | `/embed/share` origin 配置 |
| EmbedLayout | `../layouts/EmbedLayout.tsx` | Embed chromeless 布局 |

- [ ] **Step 4: 全量回归门控**

```bash
cd backend && python3 -m pytest tests/test_viz_advanced_l1_r43.py tests/test_viz_advanced_l1_r42.py -q
cd fe && pnpm exec vitest run src/components/charts/
cd fe && pnpm run check:design
```

Expected:
- pytest r43 ≥28 passed + r42 35/35
- vitest charts/ 全绿（smoke 7 + advanced ≥15）
- check:design exit 0

- [ ] **Step 5: Commit**

```bash
git add fe/src/components/charts/charts.advanced.smoke.test.tsx fe/src/components/charts/charts.smoke.test.tsx tests/test_viz_advanced_l1_r43.py fe/src/components/README.md
git commit -m "test: add r43 viz companion smoke suite and register chart components"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| VIZ-003 地图 + registry | Task 1–2–4–6–8 |
| VIZ-004 桑基 + style UI | Task 5–6–8 |
| VIZ-005 漏斗 + 配置 | Task 5–6–8 |
| VIZ-006 Embed + origin | Task 7–8 |
| VIZ-008 render-spec 适配 | Task 3–6–8 |
| 文件数 ≤20 | 19 |
| 无 TBD/TODO | ✓ |
| 每 Task 验证命令 | ✓ |
| UI Task 含 UI Acceptance + b-design skill | ✓ |

---

## 执行说明

**Plan complete.** 执行模式固定为 **subagent-driven-development (option 1)**：每个 Task 派发独立 subagent，两阶段 review（spec compliance → code quality），Task 8 完成后进入 P4 验证。

P5 文档同步（非 P3 代码）：`docs/ui/layout.md` §4 Embed 路由注记、`docs/automate/prd/F06-VIZ.md` VIZ-003~008 状态/锚点、`docs/api/README.md` 锚点补充（无新 HTTP 路由）。
