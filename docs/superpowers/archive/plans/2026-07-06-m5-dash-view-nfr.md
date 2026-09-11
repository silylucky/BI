# M5 Dashboard 组件库收官实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/viz/*` · `backend/app/views/*` · `fe/src/components/charts/*` · `fe/src/components/dashboard/*` · `fe/src/lib/chart*.ts` · `fe/src/pages/admin/dashboard/*` · `tests/test_dash_m5_widgets.py` · `tests/test_view_m5_protocol.py` · `tests/test_nfr_001_first_screen_smoke.py` · `docs/api/README.md` · `fe/src/components/README.md`
> **子项：** DASH-003, VIEW-001, NFR-001
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `fe/**` 匹配 `fe-ui.mdc`；`backend/**` 匹配 `backend-fastapi.mdc`）

**Goal:** Dashboard 可注册并渲染地图/热力/KPI/时间轴四类扩展 widget；FR-VIEW-1 视图协议 `protocolVersion` 可 round-trip 校验；含扩展 widget 的 Dashboard view 首屏有可判定 perf smoke 基线。

**Architecture:** DASH-003 在 `builtin.py` 注册 `heatmap`/`kpi`/`timeline`（`map` 已存在），FE 走既有 `ChartTypeRegistry` + `renderFromSpec` + `ChartRenderer` 分支（KPI 独立 `KpiCard`）；VIEW-001 在 `DashboardView` 增 `protocolVersion` 与 `protocol.py` round-trip helper；NFR-001 在 mock execute 下 vitest P95 + pytest probe budget 断言。

**Tech Stack:** FastAPI · Pydantic v2 · React 19 · ECharts · Vitest · pytest · TestClient

## Global Constraints

- 真理源：`docs/superpowers/evolution/2026-07-06-round-target-m5-dash.md` > `docs/superpowers/specs/2026-07-06-m5-dash-view-nfr-design.md`
- `base_branch`: `dev-auto`；禁止修改 `docs/automate/goal.md`；P5 前不改 `plan.md` 结构
- 非目标：Dataset 语义层、M6 CAT/GOV、GIS 下钻、AntV L7、Playwright perf E2E、VIEW-002/003、修改 `layout_json` 栅格 schema
- 图表直连 `dataSourceId` + SQL，不经 Dataset
- 文件预算：**18** 主文件（design §3）；总计 ≤20
- 后端验证：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_dash_m5_widgets.py tests/test_view_m5_protocol.py tests/test_nfr_001_first_screen_smoke.py -q`
- 前端验证：`cd fe && pnpm run check:design && pnpm vitest run src/components/charts/charts.dash003.smoke.test.tsx src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`

---

### Task 1: DASH-003 后端 ChartType 注册与 pytest

**Files:**
- Modify: `backend/app/viz/builtin.py`
- Create: `tests/test_dash_m5_widgets.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `ChartTypeSpec`, `FieldRule`, `registry.register`
- Produces: `GET /api/v1/charts/types` 含 `map`/`heatmap`/`kpi`/`timeline`；`POST /api/v1/charts/render-spec` 对四类返回合法 `engine`

- [ ] **Step 1: 写失败 pytest**

`tests/test_dash_m5_widgets.py`：

```python
"""M5 DASH-003 — 四类扩展 widget registry + render-spec."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app as fastapi_app
from app.viz.builtin import register_builtin_chart_types

AUTH = {"Authorization": "Bearer dev"}
M5_TYPES = ("map", "heatmap", "kpi", "timeline")


@pytest.fixture(scope="module", autouse=True)
def _register_builtins():
    register_builtin_chart_types()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_dash_003_01_catalog_includes_m5_types(client: TestClient):
    resp = client.get("/api/v1/charts/types", headers=AUTH)
    assert resp.status_code == 200
    types = {item["type"] for item in resp.json()}
    for t in M5_TYPES:
        assert t in types, f"missing {t} in catalog"


@pytest.mark.parametrize(
    "chart_type,sql,dims,metrics,expected_engine",
    [
        ("map", "SELECT '北京' AS region, 100 AS value", ["region"], ["value"], "echarts"),
        ("heatmap", "SELECT 'A' AS x, '1' AS y, 10 AS v", ["x", "y"], ["v"], "echarts"),
        ("kpi", "SELECT 1280 AS total, 12.5 AS rate", [], ["total", "rate"], "kpi"),
        ("timeline", "SELECT '2026-01-01' AS t, 1 AS v", ["t"], ["v"], "echarts"),
    ],
)
def test_dash_003_02_render_spec(
    client: TestClient, chart_type, sql, dims, metrics, expected_engine,
):
    body = {
        "chartType": chart_type,
        "mode": "sql",
        "dataSourceId": "00000000-0000-4000-8000-000000000010",
        "sql": sql,
        "dimensions": [{"field": d} for d in dims],
        "metrics": [{"field": m} for m in metrics],
    }
    resp = client.post("/api/v1/charts/render-spec", headers=AUTH, json=body)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["engine"] == expected_engine
    assert data["chartType"] == chart_type


def test_dash_003_05_execute_chain_sql_mode(client: TestClient):
    """不经 Dataset：chartConfig sql 模式可走 query execute（mock 数据源存在时 200/422 均可断言结构）。"""
    body = {
        "chartType": "kpi",
        "mode": "sql",
        "dataSourceId": "00000000-0000-4000-8000-000000000099",
        "sql": "SELECT 1 AS total",
        "dimensions": [],
        "metrics": [{"field": "total"}],
    }
    resp = client.post("/api/v1/charts/render-spec", headers=AUTH, json=body)
    assert resp.status_code == 200
    assert resp.json()["source"]["mode"] == "sql"
```

Run: `cd backend && python3 -m pytest tests/test_dash_m5_widgets.py -v`
Expected: FAIL（catalog 缺 heatmap/kpi/timeline）

- [ ] **Step 2: 注册三类 ChartTypeSpec**

`backend/app/viz/builtin.py` 在 `_BUILTIN_SPECS` 元组中 `map` 行之后追加：

```python
    ChartTypeSpec("heatmap", "热力图", "geo", "echarts", _CAPS, ("default",), FieldRule(2, 2, 1, 1)),
    ChartTypeSpec("kpi", "KPI 指标", "indicator", "kpi", _CAPS, ("default",), FieldRule(0, 1, 1, 4)),
    ChartTypeSpec("timeline", "时间轴", "temporal", "echarts", _CAPS, ("default",), FieldRule(1, 1, 0, 4)),
```

- [ ] **Step 3: 验证 pytest 通过**

Run: `cd backend && python3 -m ruff check app/viz/builtin.py tests/test_dash_m5_widgets.py && python3 -m pytest tests/test_dash_m5_widgets.py -q`
Expected: `3 passed`（1 catalog + 4 parametrize render-spec + 1 execute chain）

- [ ] **Step 4: Commit**

```bash
git add backend/app/viz/builtin.py tests/test_dash_m5_widgets.py
git commit -m "feat(viz): register heatmap/kpi/timeline chart types (DASH-003 BE)"
```

---

### Task 2: DASH-003 前端渲染（KpiCard + heatmap/timeline + ChartRenderer）

**Files:**
- Modify: `fe/src/lib/chartViewConfig.ts`
- Modify: `fe/src/lib/chartRegistry.ts`
- Create: `fe/src/components/charts/adapters/KpiCard.tsx`
- Modify: `fe/src/components/charts/adapters/renderFromSpec.ts`
- Modify: `fe/src/components/charts/ChartRenderer.tsx`
- Create: `fe/src/components/charts/charts.dash003.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- KPI 卡对齐 TailAdmin 指标卡：`text-title-sm tabular-nums` 主值、`text-theme-xs` 标签
- heatmap/timeline 容器 `min-h-[180px]` 无溢出；loading/error/empty 走 `ChartPanel` 三态
- desktop/mobile 四类 widget 容器非空；`pnpm run check:design` 无硬编码 hex

**Interfaces:**
- Consumes: `useChartExecute`, `ChartPanel`, `RenderSpec`, `ChartViewConfig`
- Produces: `isKpiType()`, `isAdvancedEchartsType()` 扩展；`KpiCard`；`buildHeatmapOption`/`buildTimelineOption`；`ChartRenderer` KPI 分支

- [ ] **Step 1: 扩展 chartViewConfig 与 chartRegistry**

`fe/src/lib/chartViewConfig.ts` 追加类型与 helper：

```ts
export type ChartType =
  | "table"
  | "line"
  | "bar"
  | "pie"
  | "gauge"
  | "map"
  | "heatmap"
  | "kpi"
  | "timeline"
  | "sankey"
  | "funnel"
  | "graph";

const KPI_TYPES: ChartType[] = ["kpi"];

export function isKpiType(type: ChartType): boolean {
  return KPI_TYPES.includes(type);
}

export function isAdvancedEchartsType(type: ChartType): boolean {
  return !isBasicChartType(type) && !isKpiType(type) && type !== "pie";
}
```

`fe/src/lib/chartRegistry.ts` 在 `FALLBACK_TYPES` 数组 `map` 后追加 `"heatmap", "kpi", "timeline"`。

- [ ] **Step 2: 写失败 vitest smoke**

`fe/src/components/charts/charts.dash003.smoke.test.tsx`：

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { ChartRenderer } from "./ChartRenderer";

const DS = "00000000-0000-4000-8000-000000000010";
const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function mockExecute(rows: unknown[][], columns: string[]) {
  mockApiFetch.mockImplementation(async (path: string, opts?: { method?: string; body?: string }) => {
    if (path === "/api/v1/query/execute") {
      return { columns, rows, rowCount: rows.length };
    }
    if (path === "/api/v1/charts/render-spec") {
      const cfg = JSON.parse(opts?.body ?? "{}") as ChartViewConfig;
      return {
        engine: cfg.chartType === "kpi" ? "kpi" : "echarts",
        chartType: cfg.chartType,
        styleVariant: "default",
        encoding: {
          dimensions: cfg.dimensions ?? [],
          metrics: cfg.metrics ?? [],
        },
        source: { mode: "sql", dataSourceId: DS, sql: cfg.sql },
      };
    }
    return {};
  });
}

const cases: Array<{ type: ChartViewConfig["chartType"]; label: string; rows: unknown[][]; cols: string[] }> = [
  { type: "map", label: "地图", rows: [["北京", 100]], cols: ["region", "value"] },
  { type: "heatmap", label: "热力", rows: [["A", "1", 10]], cols: ["x", "y", "v"] },
  { type: "kpi", label: "KPI", rows: [[1280, 12.5]], cols: ["total", "rate"] },
  { type: "timeline", label: "时间轴", rows: [["2026-01-01", 1]], cols: ["t", "v"] },
];

describe("DASH-003 chart render smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it.each(cases)("renders $type container", async ({ type, label, rows, cols }) => {
    mockExecute(rows, cols);
    const config: ChartViewConfig = {
      chartType: type,
      mode: "sql",
      dataSourceId: DS,
      sql: "SELECT 1",
      dimensions: type === "kpi" ? [] : [{ field: cols[0] }],
      metrics: type === "kpi"
        ? [{ field: "total" }, { field: "rate" }]
        : [{ field: cols[cols.length - 1] }],
    };
    render(<ChartRenderer config={config} title={label} mode="preview" />);
    await waitFor(() => {
      expect(screen.queryByLabelText("图表加载中")).not.toBeInTheDocument();
    });
    expect(screen.getByText(label)).toBeInTheDocument();
    if (type === "kpi") {
      expect(screen.getByRole("group", { name: /指标/ })).toBeInTheDocument();
    }
  });
});
```

Run: `cd fe && pnpm vitest run src/components/charts/charts.dash003.smoke.test.tsx`
Expected: FAIL（heatmap/kpi/timeline 未实现）

- [ ] **Step 3: 实现 KpiCard**

`fe/src/components/charts/adapters/KpiCard.tsx`：

```tsx
import type { ChartFieldRef } from "@/lib/chartViewConfig";

type KpiCardProps = {
  title: string;
  metrics: ChartFieldRef[];
  columns: string[];
  rows: unknown[][];
};

function formatValue(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(raw);
  if (!Number.isNaN(n) && String(raw).trim() !== "") return n.toLocaleString("zh-CN");
  return String(raw);
}

export function KpiCard({ title, metrics, columns, rows }: KpiCardProps) {
  const row = rows[0] ?? [];
  return (
    <div role="group" aria-label={`${title}指标`} className="grid gap-4 sm:grid-cols-2">
      {metrics.map((m) => {
        const idx = columns.indexOf(m.field);
        const value = idx >= 0 ? row[idx] : undefined;
        return (
          <div key={m.field} className="min-h-[72px] rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="line-clamp-2 text-theme-xs text-gray-500">{m.label ?? m.field}</p>
            <p className="text-title-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
              {formatValue(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 扩展 renderFromSpec**

`fe/src/components/charts/adapters/renderFromSpec.ts` 在 `buildMapOption` 之后追加：

```ts
function buildHeatmapOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  const xField = spec.encoding.dimensions[0]?.field ?? "";
  const yField = spec.encoding.dimensions[1]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const xi = colIndex(columns, xField);
  const yi = colIndex(columns, yField);
  const mi = colIndex(columns, metric);
  const xCats = [...new Set(rows.map((r) => String(r[xi] ?? "")))];
  const yCats = [...new Set(rows.map((r) => String(r[yi] ?? "")))];
  const data = rows.map((r) => [String(r[xi] ?? ""), String(r[yi] ?? ""), Number(r[mi] ?? 0)]);
  return {
    tooltip: { position: "top" },
    grid: { containLabel: true },
    xAxis: { type: "category", data: xCats },
    yAxis: { type: "category", data: yCats },
    visualMap: { min: 0, max: Math.max(...data.map((d) => Number(d[2])), 1), calculable: true },
    series: [{ type: "heatmap", data }],
  };
}

function buildTimelineOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  const timeField = spec.encoding.dimensions[0]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const ti = colIndex(columns, timeField);
  const mi = colIndex(columns, metric);
  const points = rows.map((r) => [String(r[ti] ?? ""), Number(r[mi] ?? 0)]);
  return {
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: points.map((p) => p[0]) },
    yAxis: { type: "value" },
    series: [{ type: "line", data: points.map((p) => p[1]) }],
  };
}
```

在 `buildEchartsOption` 的 `switch` 中追加：

```ts
    case "heatmap":
      return buildHeatmapOption(spec, capped, columns);
    case "timeline":
      return buildTimelineOption(spec, capped, columns);
```

- [ ] **Step 5: ChartRenderer KPI 分支**

`fe/src/components/charts/ChartRenderer.tsx` 顶部 import 追加 `isKpiType` 与 `KpiCard`；在 `renderBody` 最前插入：

```tsx
    if (isKpiType(localConfig.chartType)) {
      return (
        <KpiCard
          title={title}
          metrics={localConfig.metrics ?? []}
          columns={columns}
          rows={rows as unknown[][]}
        />
      );
    }
```

并将 `useEffect` 中 render-spec 条件改为：

```tsx
    if (isKpiType(localConfig.chartType) || !isAdvancedEchartsType(localConfig.chartType) || loading || error) {
```

- [ ] **Step 6: 验证 vitest**

Run: `cd fe && pnpm vitest run src/components/charts/charts.dash003.smoke.test.tsx && pnpm run check:design`
Expected: `4 passed`；check:design 无新增违规

- [ ] **Step 7: Commit**

```bash
git add fe/src/lib/chartViewConfig.ts fe/src/lib/chartRegistry.ts \
  fe/src/components/charts/adapters/KpiCard.tsx \
  fe/src/components/charts/adapters/renderFromSpec.ts \
  fe/src/components/charts/ChartRenderer.tsx \
  fe/src/components/charts/charts.dash003.smoke.test.tsx
git commit -m "feat(charts): KPI card + heatmap/timeline render (DASH-003 FE)"
```

---

### Task 3: DASH-003 WidgetPalette 与默认配置

**Files:**
- Modify: `fe/src/components/dashboard/WidgetPalette.tsx`
- Modify: `fe/src/components/dashboard/layoutUtils.ts`
- Modify: `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- Modify: `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`
- Modify: `fe/src/components/README.md`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- Palette 两组标题「基础组件」「扩展组件」；`Button variant="outline"` 全宽左对齐
- tablet/mobile Palette 全宽置顶无重叠；按钮可 Tab 聚焦 `focus-visible:ring-brand-500`
- 插入扩展 widget 后 `layoutJson` payload 含正确 `chartType`

**Interfaces:**
- Consumes: `fetchChartTypeCatalog`, `ChartType`, `defaultChartConfig`
- Produces: `WidgetPalette onInsert(type: ChartType)`；`defaultChartConfig` 支持 map/heatmap/kpi/timeline

- [ ] **Step 1: 扩展 defaultChartConfig**

`fe/src/components/dashboard/layoutUtils.ts` 将 import 改为 `ChartType`；`defaultChartConfig` 签名改为 `(type: ChartType)` 并追加分支：

```ts
  if (type === "map") {
    return {
      chartType: "map",
      ...base,
      sql: "SELECT '北京' AS region, 100 AS value",
      dimensions: [{ field: "region" }],
      metrics: [{ field: "value" }],
    };
  }
  if (type === "heatmap") {
    return {
      chartType: "heatmap",
      ...base,
      sql: "SELECT 'A' AS x, '1' AS y, 10 AS v",
      dimensions: [{ field: "x" }, { field: "y" }],
      metrics: [{ field: "v" }],
    };
  }
  if (type === "kpi") {
    return {
      chartType: "kpi",
      ...base,
      sql: "SELECT 1280 AS total, 12.5 AS rate",
      dimensions: [],
      metrics: [{ field: "total" }, { field: "rate" }],
    };
  }
  if (type === "timeline") {
    return {
      chartType: "timeline",
      ...base,
      sql: "SELECT '2026-01-01' AS t, 1 AS v",
      dimensions: [{ field: "t" }],
      metrics: [{ field: "v" }],
    };
  }
```

- [ ] **Step 2: 重写 WidgetPalette（catalog 分组）**

`fe/src/components/dashboard/WidgetPalette.tsx` 完整替换：

```tsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChartType } from "@/lib/chartViewConfig";
import { fetchChartTypeCatalog, type ChartTypeCatalogItem } from "@/lib/chartRegistry";

const BASIC_TYPES = new Set(["table", "line", "bar"]);
const EXTENDED_FALLBACK: Array<{ type: ChartType; label: string }> = [
  { type: "map", label: "地图" },
  { type: "heatmap", label: "热力图" },
  { type: "kpi", label: "KPI 指标" },
  { type: "timeline", label: "时间轴" },
];

type WidgetPaletteProps = {
  onInsert: (type: ChartType) => void;
};

function groupCatalog(items: ChartTypeCatalogItem[]) {
  const basic: ChartTypeCatalogItem[] = [];
  const extended: ChartTypeCatalogItem[] = [];
  for (const item of items) {
    if (BASIC_TYPES.has(item.type)) basic.push(item);
    else if (["map", "heatmap", "kpi", "timeline"].includes(item.type)) extended.push(item);
  }
  return { basic, extended };
}

export function WidgetPalette({ onInsert }: WidgetPaletteProps) {
  const [catalog, setCatalog] = useState<ChartTypeCatalogItem[] | null>(null);

  useEffect(() => {
    void fetchChartTypeCatalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  const { basic, extended } = useMemo(() => {
    if (!catalog) {
      return {
        basic: [
          { type: "table", displayName: "表格" },
          { type: "line", displayName: "折线图" },
          { type: "bar", displayName: "柱状图" },
        ] as ChartTypeCatalogItem[],
        extended: EXTENDED_FALLBACK.map((x) => ({
          type: x.type,
          displayName: x.label,
          category: "extended",
          renderer: "echarts",
          styleVariants: ["default"],
          fieldRule: {},
        })),
      };
    }
    return groupCatalog(catalog);
  }, [catalog]);

  const renderGroup = (title: string, items: ChartTypeCatalogItem[]) => (
    <div className="space-y-2">
      <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      {items.map((item) => (
        <Button
          key={item.type}
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={() => onInsert(item.type as ChartType)}
        >
          {item.displayName}
        </Button>
      ))}
    </div>
  );

  return (
    <aside className="w-full space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] lg:w-64">
      <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">添加组件</p>
      {renderGroup("基础组件", basic)}
      {extended.length ? renderGroup("扩展组件", extended) : null}
    </aside>
  );
}
```

- [ ] **Step 3: DashboardEditPage 宽化 handleInsert**

`fe/src/pages/admin/dashboard/DashboardEditPage.tsx`：

```tsx
import type { ChartType } from "@/lib/chartViewConfig";
```

将 `handleInsert` 参数类型改为 `ChartType`，标题映射扩展：

```tsx
  const TITLE_MAP: Record<string, string> = {
    table: "表格",
    line: "折线图",
    bar: "柱状图",
    map: "地图",
    heatmap: "热力图",
    kpi: "KPI 指标",
    timeline: "时间轴",
  };

  const handleInsert = (type: ChartType) => {
    // ...
    title: TITLE_MAP[type] ?? type,
```

- [ ] **Step 4: 更新 dashboard.smoke.test.tsx**

在 palette 测试后追加：

```tsx
  it("T-DASH-003-04: palette shows extended group", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce([
      { type: "table", displayName: "表格", category: "basic", renderer: "table", styleVariants: ["default"], fieldRule: {} },
      { type: "heatmap", displayName: "热力图", category: "geo", renderer: "echarts", styleVariants: ["default"], fieldRule: {} },
    ]);
    const onInsert = vi.fn();
    render(<WidgetPalette onInsert={onInsert} />);
    expect(await screen.findByText("扩展组件")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "热力图" }));
    expect(onInsert).toHaveBeenCalledWith("heatmap");
  });
```

- [ ] **Step 5: 登记 KpiCard**

`fe/src/components/README.md` 在 charts 小节追加一行：

```markdown
| `charts/adapters/KpiCard.tsx` | KPI 指标卡（1–4 metrics，DASH-003） | `ChartRenderer` |
```

- [ ] **Step 6: 验证**

Run: `cd fe && pnpm vitest run src/pages/admin/dashboard/dashboard.smoke.test.tsx && pnpm run check:design`
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add fe/src/components/dashboard/WidgetPalette.tsx fe/src/components/dashboard/layoutUtils.ts \
  fe/src/pages/admin/dashboard/DashboardEditPage.tsx \
  fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx fe/src/components/README.md
git commit -m "feat(dashboard): extended widget palette + defaults (DASH-003)"
```

---

### Task 4: VIEW-001 FR-VIEW-1 协议 formalize

**Files:**
- Modify: `backend/app/views/schemas.py`
- Create: `backend/app/views/protocol.py`
- Create: `tests/test_view_m5_protocol.py`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `validate_dashboard_view`, `DashboardView`
- Produces: `VIEW_PROTOCOL_VERSION`, `round_trip_view_document(data) -> dict`；`DashboardView.protocol_version`

- [ ] **Step 1: 写失败 pytest**

`tests/test_view_m5_protocol.py`：

```python
"""M5 VIEW-001 — protocolVersion + round-trip + destructive cases."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app as fastapi_app
from app.views.protocol import VIEW_PROTOCOL_VERSION, round_trip_view_document
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view

AUTH = {"Authorization": "Bearer dev"}
WIDGET_ID = "33333333-3333-4333-8333-333333333333"


def _m5_layout_widget(chart_type: str, dims: list[str], metrics: list[str]) -> dict:
    return {
        "id": WIDGET_ID,
        "type": "chart",
        "title": chart_type,
        "colSpan": 6,
        "rowSpan": 1,
        "order": 0,
        "chartConfig": {
            "chartType": chart_type,
            "chartId": WIDGET_ID,
            "mode": "sql",
            "dataSourceId": "00000000-0000-4000-8000-000000000010",
            "sql": "SELECT 1",
            "dimensions": [{"field": d} for d in dims],
            "metrics": [{"field": m} for m in metrics],
        },
    }


def _view_doc(widgets: list[dict]) -> dict:
    return {
        "name": "M5 view",
        "protocolVersion": VIEW_PROTOCOL_VERSION,
        "layout": {"version": 1, "widgets": widgets, "globalFilters": []},
    }


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_view_001_01_validate_extended_widgets():
    doc = _view_doc([
        _m5_layout_widget("map", ["region"], ["value"]),
        _m5_layout_widget("heatmap", ["x", "y"], ["v"]),
        _m5_layout_widget("kpi", [], ["total"]),
        _m5_layout_widget("timeline", ["t"], ["v"]),
    ])
    view = validate_dashboard_view(doc)
    assert view.layout.widgets


def test_view_001_02_round_trip_equivalent():
    doc = _view_doc([_m5_layout_widget("heatmap", ["x", "y"], ["v"])])
    out = round_trip_view_document(doc)
    again = round_trip_view_document(out)
    assert again["layout"]["widgets"][0]["chartConfig"]["chartType"] == "heatmap"


def test_view_001_03_unknown_chart_type_rejected():
    doc = _view_doc([_m5_layout_widget("not-a-chart", [], ["v"])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.status == 422


def test_view_001_05_dashboard_put_get_round_trip(client: TestClient):
    create = client.post("/api/v1/dashboards", headers=AUTH, json={"name": "M5-RT", "description": ""})
    assert create.status_code == 201
    dash_id = create.json()["id"]
    layout = _view_doc([_m5_layout_widget("kpi", [], ["total", "rate"])])["layout"]
    put = client.put(f"/api/v1/dashboards/{dash_id}", headers=AUTH, json={"layoutJson": layout})
    assert put.status_code == 200, put.text
    get = client.get(f"/api/v1/dashboards/{dash_id}", headers=AUTH)
    assert get.status_code == 200
    got = get.json()["layoutJson"]["widgets"][0]["chartConfig"]["chartType"]
    assert got == "kpi"
    val = client.post("/api/v1/views/validate", headers=AUTH, json={"name": "x", "layout": layout})
    assert val.status_code == 200
```

Run: `cd backend && python3 -m pytest tests/test_view_m5_protocol.py -v`
Expected: FAIL（`protocol.py` / `protocolVersion` 不存在）

- [ ] **Step 2: 实现 schemas + protocol**

`backend/app/views/schemas.py` 追加 import 与字段：

```python
from typing import Literal
# ...
class DashboardView(BaseModel):
    # ...existing fields...
    protocol_version: Literal[1] = Field(default=1, alias="protocolVersion")
```

`backend/app/views/protocol.py`：

```python
from __future__ import annotations

from typing import Any

from app.views.validate import validate_dashboard_view

VIEW_PROTOCOL_VERSION = 1


def round_trip_view_document(data: dict[str, Any]) -> dict[str, Any]:
    view = validate_dashboard_view(data)
    dumped = view.model_dump(by_alias=True, mode="json")
    validate_dashboard_view(dumped)
    return dumped


def export_view_json_schema() -> dict[str, Any]:
    from app.views.schemas import DashboardView

    return DashboardView.model_json_schema()
```

- [ ] **Step 3: API 文档登记**

`docs/api/README.md` 在 views 相关行或备注区追加：

```markdown
| DashboardView | `protocolVersion` | `1` | FR-VIEW-1 视图文档版本（M5 VIEW-001） |
```

- [ ] **Step 4: 验证**

Run: `cd backend && python3 -m ruff check app/views/ tests/test_view_m5_protocol.py && python3 -m pytest tests/test_view_m5_protocol.py -q`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/views/schemas.py backend/app/views/protocol.py \
  tests/test_view_m5_protocol.py docs/api/README.md
git commit -m "feat(views): FR-VIEW-1 protocolVersion + round-trip (VIEW-001)"
```

---

### Task 5: NFR-001 Dashboard 首屏 perf smoke

**Files:**
- Create: `tests/test_nfr_001_first_screen_smoke.py`
- Create: `fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- view 模式 4 widget 全部脱离 loading（`aria-busy` 消失）后计时
- mock 路径下 P95 ≤ 3000ms；无布局跳动或重叠

**Interfaces:**
- Consumes: `probe_dashboard_first_screen`, `DashboardEditPage mode="view"`
- Produces: pytest `within_budget` 断言；vitest P95 计时

- [ ] **Step 1: 写失败 BE pytest**

`tests/test_nfr_001_first_screen_smoke.py`：

```python
"""M5 NFR-001 companion — Dashboard first-screen perf smoke."""
from __future__ import annotations

from app.core.nfr.dashboard_first_screen import (
    DashboardFirstScreenProbeIn,
    probe_dashboard_first_screen,
)


def test_nfr_001_01_extended_widget_fixture_within_budget():
    out = probe_dashboard_first_screen(
        DashboardFirstScreenProbeIn(dashboardId="dash-m5-smoke", widgetCount=4, budgetMs=5000),
    )
    assert out.within_budget is True
    assert out.elapsed_ms <= out.budget_ms
    assert out.widget_count == 4


def test_nfr_001_02_simulate_slow_breach():
    out = probe_dashboard_first_screen(
        DashboardFirstScreenProbeIn(
            dashboardId="dash-m5-smoke", widgetCount=4, budgetMs=5000, simulateSlow=True,
        ),
    )
    assert out.within_budget is False
```

Run: `cd backend && python3 -m pytest tests/test_nfr_001_first_screen_smoke.py -v`
Expected: PASS（复用现有 mock probe；若失败则仅调整断言与 design 阈值对齐）

- [ ] **Step 2: 写 FE perf vitest**

`fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { DashboardEditPage } from "./DashboardEditPage";

const DS = "00000000-0000-4000-8000-000000000010";
const mockApiFetch = vi.fn();
const P95_BUDGET_MS = 3000;
const SAMPLES = 5;

vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function extendedWidgets(): LayoutWidget[] {
  const types = ["map", "heatmap", "kpi", "timeline"] as const;
  return types.map((type, order) => {
    const id = `w-${type}`;
    return {
      id,
      type: "chart",
      title: type,
      colSpan: 6,
      rowSpan: 1,
      order,
      chartConfig: { ...defaultChartConfig(type), chartId: id, dataSourceId: DS },
    };
  });
}

function setupMocks(widgets: LayoutWidget[]) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path.includes("/dashboards/")) {
      return { id: "d1", name: "Perf", layoutJson: { version: 1, widgets, globalFilters: [] } };
    }
    if (path === "/api/v1/query/execute") {
      return { columns: ["x", "y"], rows: [[1, 2]], rowCount: 1 };
    }
    if (path === "/api/v1/charts/render-spec") {
      return { engine: "echarts", chartType: "map", encoding: { dimensions: [], metrics: [] }, source: {} };
    }
    if (path.includes("/global-filters")) return { filters: [] };
    return {};
  });
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe("NFR-001 dashboard first screen perf smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("NFR-001-03: view mode 4 widgets P95 within budget", async () => {
    const widgets = extendedWidgets();
    setupMocks(widgets);
    const timings: number[] = [];

    for (let i = 0; i < SAMPLES; i += 1) {
      const start = performance.now();
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { unmount } = render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/admin/dashboards/d1"]}>
            <Routes>
              <Route path="/admin/dashboards/:id" element={<DashboardEditPage mode="view" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(
        () => {
          expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(0);
        },
        { timeout: 5000 },
      );
      timings.push(performance.now() - start);
      unmount();
    }

    expect(p95(timings)).toBeLessThanOrEqual(P95_BUDGET_MS);
  });
});
```

Run: `cd fe && pnpm vitest run src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`
Expected: PASS（mock 即时返回）

- [ ] **Step 3: 联合验证**

Run:
```bash
cd backend && python3 -m pytest tests/test_nfr_001_first_screen_smoke.py -q
cd fe && pnpm vitest run src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx
```
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add tests/test_nfr_001_first_screen_smoke.py \
  fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx
git commit -m "test(nfr): dashboard first-screen perf smoke (NFR-001)"
```

---

### Task 6: 回归门控与 PRD 同步评估

**Files:**
- （只读核对）`tests/test_view_gov_api_r31.py`
- （P5 对账，本 Task 仅评估）`docs/services/views.md`、`docs/automate/prd/F07-DASH.md`、`F09-VIEW.md`、`F15-NFR.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: 后端全量子集**

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  tests/test_dash_m5_widgets.py \
  tests/test_view_m5_protocol.py \
  tests/test_nfr_001_first_screen_smoke.py \
  tests/test_view_gov_api_r31.py -q
```
Expected: 全部 PASS（r31 边界不退化）

- [ ] **Step 2: 前端全量子集**

```bash
cd fe && pnpm run check:design && pnpm vitest run \
  src/components/charts/charts.dash003.smoke.test.tsx \
  src/pages/admin/dashboard/dashboard.smoke.test.tsx \
  src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx
```
Expected: 全部 PASS

- [ ] **Step 3: PRD 同步评估（记录，P5 勾选）**

| 变更 | 文档动作 |
|------|----------|
| DASH-003 四类 widget | P5 勾选 `prd/F07-DASH.md` DASH-003 |
| VIEW-001 protocolVersion | P5 更新 `docs/services/views.md` + 勾选 `F09-VIEW.md` 相关项 |
| NFR-001 perf smoke | P5 勾选 `prd/F15-NFR.md` NFR-001 companion 项 |

- [ ] **Step 4: Commit（若有文档微调）**

```bash
git status
# 仅当 Step 1-2 发现必要修复时提交；否则无代码变更
```

---

## Spec Self-Review

| 检查项 | 结果 |
|--------|------|
| DASH-003 覆盖 | Task 1–3 + pytest/vitest |
| VIEW-001 覆盖 | Task 4 |
| NFR-001 覆盖 | Task 5 |
| 占位符 | 无 |
| 文件数 | 18 主文件 |
| UI skill + Acceptance | Task 2–3、5 已写明 |
| 验证命令 | 每 Task 含 Run/Expected |
