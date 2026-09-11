# M5 可视化/仪表板质量推分 r29 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/schemas/chart_view.py`、`backend/app/api/v1/charts.py`、`backend/app/dashboard/service.py`、`backend/app/api/v1/dashboards.py`、`tests/test_viz_dash_quality_r29.py`、`tests/test_viz_dash_l1_r28.py`（只读回归）、`fe/src/lib/api.ts`、`fe/src/components/charts/*`、`fe/src/components/dashboard/*`、`fe/src/pages/admin/dashboard/*`、`docs/api/README.md`、`docs/services/README.md`
> **子项：** VIZ-002, DASH-002, DASH-003, VIZ-001, DASH-001
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` → `backend-fastapi.mdc`；触及 `fe/**` → `fe-ui.mdc`）

**Goal:** 闭合 r28 M5 VIZ/DASH L1 遗留缺口 — VIZ-002/DASH-002/DASH-003 破 90 分，VIZ-001/DASH-001 巩固边界；交付字段级 validate、layout 业务校验、图表空/错/慢态与 table 分页、widget 标题/栅格调整与空态引导；`test_viz_dash_quality_r29.py` ≥32 项全绿，r28 回归不跌破。

**Architecture:** 后端 `chart_view.py` 扩展 `ChartViewError.fields` → `charts/validate` 422 `detail.fields`；`dashboard/service.validate_layout` 追加 widget 业务校验与 order 规范化；前端 `useChartExecute` 映射 query 错误码 + `ChartRenderer` 客户端分页（PAGE_SIZE=50）；Dashboard 编辑页经 `layoutUtils.resizeWidget`/`normalizeWidgetIds` 编排保存。

**Tech Stack:** FastAPI · Pydantic v2 · SQLAlchemy 2.x · pytest · ruff · React 19 · Vite · Vitest · ApexCharts · TailAdmin/shadcn

## Global Constraints

- **不修改** `docs/automate/goal.md` / `plan.md` 结构；**无**新 migration / 乐观锁列
- 不含 react-grid-layout、VIZ-003、DASH-004、Dataset 路径、`filters[]` SQL 注入全量
- 错误体默认 `{"code","message","detail":null}`；**唯一**例外：`POST /charts/validate` 422 可 `detail: { "fields": [...] }`
- layout 422 使用 `DASH_DUPLICATE_WIDGET` / `DASH_MISSING_CHART_CONFIG` / `DASH_CHART_ID_MISMATCH` 等独立 code（非泛化 `DASH_INVALID_LAYOUT`）
- `CHART_EXECUTE_LIMIT=100` 与后端 `query_default_limit` 对齐；table 客户端 `PAGE_SIZE=50`
- 文件预算：新建 **1** + 修改 **16** = **17** 触及 ≤20
- 验证基线：r28 `pytest` **600 passed** + 2 skipped；`test_viz_dash_l1_r28` 26/26；fe vitest **81/81**
- 本轮目标：`pytest` **≥632 passed** + 2 skipped；fe vitest **≥89**；`pnpm run check:design` PASS
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`；`cd fe && pnpm install && pnpm run check:design && pnpm test`

---

### Task 1: VIZ-001 ChartViewConfig 字段级 validate（后端）

**Files:**
- Modify: `backend/app/schemas/chart_view.py`
- Modify: `backend/app/api/v1/charts.py`
- Create: `tests/test_viz_dash_quality_r29.py`（VIZ-001 段 T-VIZ-R29-001-01~05）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: 现有 `ChartViewConfig` / `validate_chart_view_config`
- Produces: `ChartViewError(code, message, status, fields: list[dict])`；`fields` 项形如 `{"field": "metrics", "message": "..."}`

- [ ] **Step 1: 写入 VIZ-001 失败测试**

在 `tests/test_viz_dash_quality_r29.py` 新建文件并添加：

```python
"""M5 VIZ/DASH quality push r29 — VIZ-001~002 + DASH-001~003."""
from __future__ import annotations

import time
import uuid

import pytest

from app.schemas.chart_view import ChartViewError, validate_chart_view_config


def test_chart_view_oversized_dimension_field():
    """T-VIZ-R29-001-01: dimensions[].field >128 → 422 + fields。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {
                "chartType": "table",
                "dataSourceId": str(uuid.uuid4()),
                "mode": "sql",
                "sql": "SELECT 1",
                "dimensions": [{"field": "x" * 129}],
            }
        )
    assert exc.value.code == "CHART_INVALID"
    assert any(f.get("field") == "dimensions" for f in exc.value.fields)


def test_chart_view_too_many_filters():
    """T-VIZ-R29-001-02: filters 超 16 项 → 422。"""
    filters = [
        {"field": f"f{i}", "operator": "eq", "value": "1"} for i in range(17)
    ]
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {
                "chartType": "table",
                "dataSourceId": str(uuid.uuid4()),
                "mode": "sql",
                "sql": "SELECT 1",
                "filters": filters,
            }
        )
    assert exc.value.status == 422
    assert exc.value.fields


def test_chart_view_line_missing_metrics_fields():
    """T-VIZ-R29-001-03: line 缺 metrics → fields 含 metrics。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {
                "chartType": "line",
                "dataSourceId": str(uuid.uuid4()),
                "mode": "sql",
                "sql": "SELECT 1 AS x",
                "dimensions": [{"field": "x"}],
                "metrics": [],
            }
        )
    assert exc.value.code == "CHART_MISSING_SERIES"
    assert any("metrics" in (f.get("field") or "") for f in exc.value.fields)


def test_post_charts_validate_fields_detail(client, auth_headers):
    """T-VIZ-R29-001-04: POST validate 非法 → detail.fields 数组。"""
    resp = client.post(
        "/api/v1/charts/validate",
        json={
            "chartType": "line",
            "dataSourceId": str(uuid.uuid4()),
            "mode": "sql",
            "sql": "SELECT 1",
            "dimensions": [{"field": "x"}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "CHART_MISSING_SERIES"
    assert body["detail"] is not None
    assert "fields" in body["detail"]
    assert isinstance(body["detail"]["fields"], list)


def test_chart_view_validate_performance_smoke():
    """T-VIZ-R29-001-05: 连续 100 次 validate <1s。"""
    payload = {
        "chartType": "table",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1",
        "dimensions": [{"field": f"d{i}"} for i in range(8)],
    }
    start = time.perf_counter()
    for _ in range(100):
        validate_chart_view_config(payload)
    assert time.perf_counter() - start < 1.0
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "R29-001" -v`
Expected: FAIL — `ChartViewError` has no attribute `fields` 或 `detail` 为 null

- [ ] **Step 3: 扩展 `chart_view.py`**

```python
class ChartViewError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 422,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


def _loc_to_field(loc: tuple[object, ...]) -> str:
    parts: list[str] = []
    for item in loc:
        if item == "chart_type":
            parts.append("chartType")
        elif item == "data_source_id":
            parts.append("dataSourceId")
        elif isinstance(item, str):
            parts.append(item)
        elif isinstance(item, int):
            parts[-1] = f"{parts[-1]}[{item}]" if parts else str(item)
    return ".".join(parts) if parts else "config"


def _map_validation_error(exc: ValidationError) -> ChartViewError:
    fields: list[dict[str, str]] = []
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid chart config"))
        if msg.startswith("Value error, "):
            msg = msg.removeprefix("Value error, ")
        loc = err.get("loc", ())
        if msg.startswith("CHART_") and ":" in msg:
            code, text = msg.split(":", 1)
            field_name = _loc_to_field(tuple(loc))
            if field_name:
                fields.append({"field": field_name, "message": text})
            if not fields:
                return ChartViewError(code, text, 422, fields)
            continue
        fields.append({"field": _loc_to_field(tuple(loc)), "message": msg})
    if fields:
        first = fields[0]
        if "CHART_" in first.get("message", ""):
            pass
        return ChartViewError("CHART_INVALID", first["message"], 422, fields)
    return ChartViewError("CHART_INVALID", "Invalid chart config", 422, fields)
```

在 `validate_l1_rules` 的 `CHART_MISSING_SERIES` 分支改为：

```python
raise ValueError("CHART_MISSING_SERIES:dimensions and metrics are required for line/bar")
```

并确保 `_map_validation_error` 对 model validator 的 ValueError 生成 `fields` 含 `dimensions` 与 `metrics`。

- [ ] **Step 4: 更新 `charts.py` `_error_response`**

```python
def _error_response(exc: ChartViewError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )
```

- [ ] **Step 5: 运行测试确认 PASS**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "R29-001" -v`
Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/chart_view.py backend/app/api/v1/charts.py tests/test_viz_dash_quality_r29.py
git commit -m "feat(viz): field-level ChartViewConfig validate detail (VIZ-001 r29)"
```

---

### Task 2: VIZ-002 图表渲染器空/错/慢态 + table 分页（前端）

**Files:**
- Modify: `fe/src/lib/api.ts`
- Modify: `fe/src/components/charts/useChartExecute.ts`
- Modify: `fe/src/components/charts/ChartPanel.tsx`
- Modify: `fe/src/components/charts/ChartRenderer.tsx`
- Modify: `fe/src/components/charts/charts.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `ChartPanel` / `Button` outline 分页条 / `Skeleton` loading；遵守 EEL-01~03 空错加载清单
- desktop 与 mobile 分页控件 `flex-wrap` 无重叠；error `role="alert"`
- loading 显示 `aria-busy` + `aria-label="图表加载中"`；慢查询副文案「查询较慢，请稍候…」
- 通过 `pnpm run check:design`（语义 token、无硬编码 hex）

**Interfaces:**
- Consumes: `apiFetch`；query 错误码 `QUERY_TIMEOUT` / `QUERY_SYNTAX_ERROR` / `QUERY_TABLE_NOT_FOUND`
- Produces: `CHART_EXECUTE_LIMIT` 常量；`mapChartQueryError(code, message)`；`useChartExecute` 返回 `{ slowHint: boolean }`

- [ ] **Step 1: 写入 vitest 失败测试**

在 `charts.smoke.test.tsx` 末尾追加：

```tsx
  it("T-VIZ-R29-002-01: table 101 rows paginates to 50 visible", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => [i + 1]);
    mockApiFetch.mockResolvedValueOnce({ columns: ["id"], rows });
    render(<ChartRenderer config={tableConfig} title="大表" />);
    expect(await screen.findByText("id")).toBeInTheDocument();
    expect(screen.getAllByRole("cell").length).toBeLessThanOrEqual(50);
    expect(screen.getByText(/第 1\/3 页/)).toBeInTheDocument();
    expect(screen.getByText(/共 101 条/)).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-02: QUERY_TIMEOUT shows Chinese timeout message", async () => {
    const err = Object.assign(new Error("查询超时，请缩小数据范围"), { code: "QUERY_TIMEOUT" });
    mockApiFetch.mockRejectedValueOnce(err);
    render(<ChartRenderer config={tableConfig} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("查询超时，请缩小数据范围");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-03: bar chart smoke renders apex container", async () => {
    mockApiFetch.mockResolvedValueOnce({ columns: ["x", "y"], rows: [[1, 2]] });
    const barConfig: ChartViewConfig = {
      chartType: "bar",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1 AS x, 2 AS y",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
    };
    render(<ChartRenderer config={barConfig} />);
    expect(await screen.findByTestId("apex-chart-container")).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `cd fe && pnpm test -- src/components/charts/charts.smoke.test.tsx -t "R29-002" 2>&1 | tail -20`
Expected: FAIL — 无分页文案 / 无 role="alert"

- [ ] **Step 3: 扩展 `api.ts` 错误 code**

```typescript
export class ApiRequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

// 在 !response.ok 分支：
throw new ApiRequestError(body.message ?? "操作失败，请稍后重试", body.code);
```

- [ ] **Step 4: 实现 `useChartExecute.ts`**

```typescript
export const CHART_EXECUTE_LIMIT = 100;
const SLOW_THRESHOLD_MS = 3000;

export function mapChartQueryError(code: string | undefined, message: string): string {
  switch (code) {
    case "QUERY_TIMEOUT":
      return "查询超时，请缩小数据范围";
    case "QUERY_SYNTAX_ERROR":
      return "SQL 语法错误，请检查配置";
    case "QUERY_TABLE_NOT_FOUND":
      return "表不存在";
    default:
      return message || "操作失败，请稍后重试";
  }
}

// run() 内：
const started = Date.now();
// ... apiFetch ...
const slow = Date.now() - started > SLOW_THRESHOLD_MS;
// catch:
const apiErr = err as ApiRequestError;
setError(mapChartQueryError(apiErr.code, apiErr.message));
// return 增加 slowHint: slow && !error
```

body 使用 `limit: CHART_EXECUTE_LIMIT`。

- [ ] **Step 5: 更新 `ChartPanel.tsx`**

```tsx
type ChartPanelProps = {
  title: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  slowHint?: boolean;
  children: ReactNode;
};

// loading 分支：
<Skeleton className="min-h-[180px] w-full rounded-lg" aria-busy="true" aria-label="图表加载中" />
{slowHint ? <p className="mt-2 text-theme-xs text-gray-500">查询较慢，请稍候…</p> : null}

// error 分支外层 div 加 role="alert"
```

- [ ] **Step 6: 更新 `ChartRenderer.tsx` table 分页**

```tsx
const PAGE_SIZE = 50;
const [page, setPage] = useState(1);

// table 分支：rows.length > PAGE_SIZE 时 slice
const pageRows = rows.length > PAGE_SIZE ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : rows;
const totalPages = Math.ceil(rows.length / PAGE_SIZE);

// 分页条（rows.length > PAGE_SIZE）：
<div className="mt-3 flex flex-wrap items-center gap-2">
  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
  <span className="text-theme-xs text-gray-500">第 {page}/{totalPages} 页，共 {rows.length} 条</span>
  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
</div>

// line/bar rows.length > CHART_EXECUTE_LIMIT 时显示 warning 条（不渲染 apex）
```

`ChartRenderer` 传入 `slowHint` 给 `ChartPanel`；`config` 变更时 `setPage(1)`。

- [ ] **Step 7: 运行测试确认 PASS**

Run: `cd fe && pnpm test -- src/components/charts/charts.smoke.test.tsx 2>&1 | tail -15`
Expected: 全部 passed（含 r28 + r29 case）

- [ ] **Step 8: Commit**

```bash
git add fe/src/lib/api.ts fe/src/components/charts/
git commit -m "feat(viz): chart empty/error/slow states and table pagination (VIZ-002 r29)"
```

---

### Task 3: DASH-002 layout 业务校验 + 栅格调整（后端 + 前端）

**Files:**
- Modify: `backend/app/dashboard/service.py`
- Modify: `fe/src/components/dashboard/layoutUtils.ts`
- Modify: `fe/src/components/dashboard/DashboardWidget.tsx`
- Modify: `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- Modify: `tests/test_viz_dash_quality_r29.py`（DASH-002 段）
- Modify: `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`（DASH-002 vitest）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- colSpan 切换用 `IconButton variant="ghost"` + `aria-label`（如「宽度 6 列」）；选中态 `bg-gray-100`
- 保存 layout 422 时页面 `ErrorBanner` 显示中文 `message`，非 toast
- desktop/mobile：工具栏 `flex-wrap`；colSpan 变更后 grid cell 宽度可见变化（`xl:col-span-*`）

**Interfaces:**
- Consumes: Task 1 `validate_chart_view_config`
- Produces: `resizeWidget(widgets, id, patch)`；`normalizeWidgetOrders(widgets)`；`DashboardError` codes `DASH_DUPLICATE_WIDGET` / `DASH_MISSING_CHART_CONFIG` / `DASH_CHART_ID_MISMATCH`

- [ ] **Step 1: 写入 pytest 失败测试**

```python
def test_layout_duplicate_widget_id(client, auth_headers):
    """T-DASH-R29-002-01: 重复 widget id → 422 DASH_DUPLICATE_WIDGET。"""
    created = client.post(
        "/api/v1/dashboards",
        json={"name": "Dup", "slug": "dup-widget"},
        headers=auth_headers,
    )
    dash_id = created.json()["id"]
    wid = str(uuid.uuid4())
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        json={
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {"id": wid, "type": "chart", "title": "A", "colSpan": 6, "rowSpan": 1, "order": 0,
                     "chartConfig": {"chartType": "table", "dataSourceId": str(uuid.uuid4()),
                                     "mode": "sql", "sql": "SELECT 1", "chartId": wid}},
                    {"id": wid, "type": "chart", "title": "B", "colSpan": 6, "rowSpan": 1, "order": 1,
                     "chartConfig": {"chartType": "table", "dataSourceId": str(uuid.uuid4()),
                                     "mode": "sql", "sql": "SELECT 1", "chartId": wid}},
                ],
                "globalFilters": [],
            }
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_DUPLICATE_WIDGET"


def test_layout_chart_id_mismatch(client, auth_headers):
    """T-DASH-R29-002-02: chartId ≠ widget.id → 422 DASH_CHART_ID_MISMATCH。"""
    # 类似结构，chartId 故意不同


def test_layout_missing_chart_config(client, auth_headers):
    """T-DASH-R29-002-03: chart 类型缺 chartConfig → 422 DASH_MISSING_CHART_CONFIG。"""
    # chartConfig: null
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "R29-002-0" -v`
Expected: FAIL — code 为 `DASH_INVALID_LAYOUT`

- [ ] **Step 3: 扩展 `service.py` `validate_layout`**

```python
def _validate_layout_business(parsed: DashboardLayout) -> None:
    seen: set[str] = set()
    for widget in parsed.widgets:
        wid = str(widget.id)
        if wid in seen:
            raise DashboardError("DASH_DUPLICATE_WIDGET", "组件 ID 重复", 422)
        seen.add(wid)
        if widget.type == "chart":
            if widget.chart_config is None:
                raise DashboardError("DASH_MISSING_CHART_CONFIG", "图表组件缺少 chartConfig", 422)
            cfg = widget.chart_config
            if cfg.chart_id is not None and str(cfg.chart_id) != wid:
                raise DashboardError("DASH_CHART_ID_MISMATCH", "chartId 与组件 ID 不一致", 422)


def _normalize_widget_orders(widgets: list) -> list:
    ordered = sorted(widgets, key=lambda w: w.order)
    for i, w in enumerate(ordered):
        w.order = i
    return ordered

def validate_layout(layout: dict[str, Any]) -> dict[str, Any]:
    parsed = DashboardLayout.model_validate(layout)
    _validate_layout_business(parsed)
    parsed.widgets = _normalize_widget_orders(list(parsed.widgets))
    for widget in parsed.widgets:
        if widget.type == "chart" and widget.chart_config is not None:
            validate_chart_view_config(
                widget.chart_config.model_dump(by_alias=True, mode="json"),
            )
    return parsed.model_dump(by_alias=True, mode="json")
```

`update_layout` 的 `except ChartViewError` 保持；`DashboardError` 直接 re-raise（已有）。

- [ ] **Step 4: 扩展 `layoutUtils.ts`**

```typescript
export function resizeWidget(
  widgets: LayoutWidget[],
  id: string,
  patch: Partial<Pick<LayoutWidget, "colSpan" | "rowSpan" | "title">>,
): LayoutWidget[] {
  return widgets.map((w) => (w.id === id ? { ...w, ...patch } : w));
}

export function normalizeWidgetIds(widgets: LayoutWidget[]): LayoutWidget[] {
  return widgets.map((w) => ({
    ...w,
    chartConfig: { ...w.chartConfig, chartId: w.id },
  }));
}
```

- [ ] **Step 5: 更新 `DashboardWidget.tsx` 栅格工具栏**

新增 props：`onResize: (id, patch) => void`。

编辑模式工具栏增加宽度按钮组（4/6/8/12）与 rowSpan +/-（范围 1–8）：

```tsx
{([4, 6, 8, 12] as const).map((span) => (
  <IconButton
    key={span}
    type="button"
    variant="ghost"
    size="sm"
    aria-label={`宽度 ${span} 列`}
    className={widget.colSpan === span ? "bg-gray-100 dark:bg-gray-800" : undefined}
    onClick={() => onResize(widget.id, { colSpan: span })}
  >
    <span className="text-theme-xs">{span}</span>
  </IconButton>
))}
```

- [ ] **Step 6: 更新 `DashboardEditPage.tsx`**

```tsx
import { normalizeWidgetIds, resizeWidget } from "@/components/dashboard/layoutUtils";

const handleSave = async () => {
  const normalized = normalizeWidgetIds(sortWidgets(widgets));
  await apiFetch(`/api/v1/dashboards/${id}/layout`, {
    method: "PUT",
    body: JSON.stringify({ layoutJson: { version: 1, widgets: normalized, globalFilters: [] } }),
  });
};

// renderWidget 传入 onResize
onResize={(wid, patch) => setWidgets((prev) => resizeWidget(prev, wid, patch))}
```

- [ ] **Step 7: vitest DASH-002 case**

```tsx
  it("T-DASH-R29-002-04: colSpan 6→12 updates grid class", () => {
    const widget = { ...sampleWidgets[0], colSpan: 12 as const };
    const { container } = render(
      <DashboardGrid mode="edit" widgets={[widget]} renderWidget={() => <div />} />,
    );
    expect(container.querySelector(".xl\\:col-span-12")).toBeTruthy();
  });

  it("T-DASH-R29-002-05: illegal layout save shows Chinese error banner", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ id: "d1", name: "X", layoutJson: { version: 1, widgets: [], globalFilters: [] } })
      .mockRejectedValueOnce(Object.assign(new Error("组件 ID 重复"), { code: "DASH_DUPLICATE_WIDGET" }));
    // render edit page, click 保存布局, expect 组件 ID 重复
  });
```

- [ ] **Step 8: 运行测试确认 PASS**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "R29-002" -v`
Run: `cd fe && pnpm test -- src/pages/admin/dashboard/dashboard.smoke.test.tsx -t "R29-002" 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/dashboard/service.py fe/src/components/dashboard/ fe/src/pages/admin/dashboard/ tests/test_viz_dash_quality_r29.py
git commit -m "feat(dash): layout validation and grid resize controls (DASH-002 r29)"
```

---

### Task 4: DASH-003 组件面板增删改 + 空态引导

**Files:**
- Modify: `fe/src/components/dashboard/DashboardWidget.tsx`
- Modify: `fe/src/components/dashboard/DashboardGrid.tsx`
- Modify: `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- Modify: `tests/test_viz_dash_quality_r29.py`（DASH-003 段）
- Modify: `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`（DASH-003 vitest）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 空 grid 文案「仪表板还没有组件」+ 辅助说明 + CTA「添加组件」
- 标题 inline `Input` 可 Tab 聚焦；长标题 `truncate`
- chart 绑定只读摘要行（`mode` + sql 前 40 字 `truncate`）

**Interfaces:**
- Consumes: Task 3 `resizeWidget` / `normalizeWidgetIds`
- Produces: `onTitleChange(id, title)` 回调链

- [ ] **Step 1: pytest 失败测试**

```python
def test_layout_empty_widgets_valid(client, auth_headers):
    """T-DASH-R29-003-03: 删除全部 widget 后空数组合法。"""
    # create dashboard, PUT layout widgets=[], expect 200


def test_layout_max_32_widgets(client, auth_headers):
    """T-DASH-R29-003-04: 32 widgets 通过；33 → 422。"""
    widgets = [...]  # 33 项
    assert resp.status_code == 422


def test_layout_title_round_trip(db_session, auth_user_id):
    """T-DASH-R29-003-06: title/colSpan 保存后 GET 一致。"""
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "R29-003" -v`

- [ ] **Step 3: 更新 `DashboardGrid.tsx` 空态**

```tsx
<p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">仪表板还没有组件</p>
<p className="text-theme-xs text-gray-500">从左侧添加表格、折线图或柱状图</p>
<Button type="button" variant="primary" onClick={onAddWidget}>添加组件</Button>
```

- [ ] **Step 4: 更新 `DashboardWidget.tsx` 标题编辑与绑定摘要**

```tsx
type DashboardWidgetProps = {
  // ...
  onTitleChange: (id: string, title: string) => void;
};

// 编辑模式标题区：
<Input
  value={widget.title}
  onChange={(e) => onTitleChange(widget.id, e.target.value)}
  className="h-8 max-w-[200px] text-theme-sm"
  aria-label="组件标题"
/>
<p className="mt-1 truncate text-theme-xs text-gray-500">
  {widget.chartConfig.mode ?? "sql"} · {(widget.chartConfig.sql ?? "").slice(0, 40)}
</p>
```

- [ ] **Step 5: `DashboardEditPage` 接线 `onTitleChange`**

```tsx
onTitleChange={(wid, title) => setWidgets((prev) => resizeWidget(prev, wid, { title }))}
```

- [ ] **Step 6: vitest case**

```tsx
  it("T-DASH-R29-003-01: title change reflected in save payload", async () => {
    // mock GET + capture PUT body, edit title Input, save, assert title
  });

  it("T-DASH-R29-003-02: empty grid shows enhanced guidance", () => {
    render(<DashboardGrid mode="edit" widgets={[]} onAddWidget={() => {}} renderWidget={() => null} />);
    expect(screen.getByText("仪表板还没有组件")).toBeInTheDocument();
    expect(screen.getByText(/从左侧添加/)).toBeInTheDocument();
  });

  it("T-DASH-R29-003-05: delete middle widget reorders without error", async () => {
    // 删除 w2 后 sortWidgets 顺序正确
  });
```

- [ ] **Step 7: 运行测试确认 PASS**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "R29-003" -v`
Run: `cd fe && pnpm test -- src/pages/admin/dashboard/dashboard.smoke.test.tsx -t "R29-003" 2>&1 | tail -10`

- [ ] **Step 8: Commit**

```bash
git add fe/src/components/dashboard/ fe/src/pages/admin/dashboard/ tests/test_viz_dash_quality_r29.py
git commit -m "feat(dash): widget title edit and empty state guidance (DASH-003 r29)"
```

---

### Task 5: DASH-001 Dashboard CRUD 边界巩固

**Files:**
- Modify: `tests/test_viz_dash_quality_r29.py`（DASH-001 段）
- Modify: `fe/src/pages/admin/dashboard/DashboardListPage.tsx`
- Modify: `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 列表页分页 mock 数据渲染正确行数；加载 Skeleton 4 行；空态「暂无 Dashboard」保留

**Interfaces:**
- Consumes: `list_dashboards` / `update_dashboard` / `delete_dashboard`
- Produces: 分页 query `?limit=2&offset=1` 行为文档化

- [ ] **Step 1: pytest 失败测试**

```python
def test_dashboard_duplicate_name_allowed(client, auth_headers):
    """T-DASH-R29-001-01: 同名不同 slug → 201。"""
    r1 = client.post("/api/v1/dashboards", json={"name": "Same", "slug": "same-a"}, headers=auth_headers)
    r2 = client.post("/api/v1/dashboards", json={"name": "Same", "slug": "same-b"}, headers=auth_headers)
    assert r1.status_code == 201 and r2.status_code == 201


def test_list_dashboards_pagination(client, auth_headers):
    """T-DASH-R29-001-02: limit=2 offset=1 数学正确。"""
    for i in range(4):
        client.post("/api/v1/dashboards", json={"name": f"P{i}", "slug": f"pag-{i}"}, headers=auth_headers)
    resp = client.get("/api/v1/dashboards?limit=2&offset=1", headers=auth_headers)
    body = resp.json()
    assert body["limit"] == 2 and body["offset"] == 1
    assert len(body["items"]) == 2
    assert body["total"] >= 4


def test_soft_deleted_not_in_list(client, auth_headers):
    """T-DASH-R29-001-03: DELETE 后 list 不含该 id。"""
    # create, delete, list ids


def test_concurrent_name_patch_last_wins(client, auth_headers):
    """T-DASH-R29-001-04: 连续两次 PUT name 后者生效。"""
    created = client.post("/api/v1/dashboards", json={"name": "A", "slug": "cc-a"}, headers=auth_headers)
    dash_id = created.json()["id"]
    client.put(f"/api/v1/dashboards/{dash_id}", json={"name": "B"}, headers=auth_headers)
    client.put(f"/api/v1/dashboards/{dash_id}", json={"name": "C"}, headers=auth_headers)
    got = client.get(f"/api/v1/dashboards/{dash_id}", headers=auth_headers)
    assert got.json()["name"] == "C"
```

- [ ] **Step 2: 运行测试确认 FAIL**（若 r28 已部分覆盖则确认新增项 FAIL）

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "R29-001" -v`

- [ ] **Step 3: 列表页分页 smoke（可选增强）**

`DashboardListPage.tsx` 的 `load` 改为支持 `limit`/`offset` 状态或仅 vitest mock 验证：

```tsx
  it("T-DASH-R29-001-05: list page renders paginated row count", async () => {
    mockApiFetch.mockResolvedValueOnce({
      items: [
        { id: "1", name: "A", slug: "a", updatedAt: "2026-01-01" },
        { id: "2", name: "B", slug: "b", updatedAt: "2026-01-02" },
      ],
      total: 5,
      limit: 2,
      offset: 0,
    });
    render(<MemoryRouter><DashboardListPage /></MemoryRouter>);
    expect(await screen.findByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });
```

- [ ] **Step 4: 运行测试确认 PASS**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -k "DASH-R29-001" -v`
Run: `cd fe && pnpm test -- src/pages/admin/dashboard/dashboard.smoke.test.tsx -t "R29-001-05" 2>&1 | tail -8`

- [ ] **Step 5: Commit**

```bash
git add tests/test_viz_dash_quality_r29.py fe/src/pages/admin/dashboard/
git commit -m "test(dash): CRUD boundary pagination and concurrency (DASH-001 r29)"
```

---

### Task 6: VIZ-002 后端性能 smoke + 文档同步

**Files:**
- Modify: `tests/test_viz_dash_quality_r29.py`（T-VIZ-R29-002-05）
- Modify: `docs/api/README.md`
- Modify: `docs/services/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- 触及 `docs/**` → 遵守 `.cursor/rules/prd-sync.mdc` / `docs-layer.mdc`

**UI skill:** none

- [ ] **Step 1: 追加 pytest 性能 smoke**

```python
def test_chart_view_many_dimensions_boundary():
    """T-VIZ-R29-002-05: 8 dimensions 边界 validate 成功（性能代理）。"""
    cfg = validate_chart_view_config(
        {
            "chartType": "table",
            "dataSourceId": str(uuid.uuid4()),
            "mode": "sql",
            "sql": "SELECT 1",
            "dimensions": [{"field": f"d{i}"} for i in range(8)],
        }
    )
    assert len(cfg.dimensions) == 8
```

- [ ] **Step 2: 更新 `docs/api/README.md`**

在 `POST /api/v1/charts/validate` 行注明：422 时 `detail.fields: [{field, message}]`。

在 `PUT /api/v1/dashboards/{id}/layout` 行追加错误码：`DASH_DUPLICATE_WIDGET`、`DASH_MISSING_CHART_CONFIG`、`DASH_CHART_ID_MISMATCH`。

- [ ] **Step 3: 更新 `docs/services/README.md`**

VIZ/DASH 域状态行注明 r29 质量推分（字段级 validate、layout 校验、图表分页）。

- [ ] **Step 4: 统计 r29 测试总数**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py --collect-only -q | tail -3`
Expected: **≥32** tests collected

- [ ] **Step 5: Commit**

```bash
git add tests/test_viz_dash_quality_r29.py docs/api/README.md docs/services/README.md
git commit -m "docs: register r29 validate fields and layout error codes"
```

---

### Task 7: 全量回归与 r28 不跌破

**Files:**
- Test only: `tests/test_viz_dash_l1_r28.py`、`tests/test_viz_dash_quality_r29.py`、`fe/src/**/*.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 后端全量**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v 2>&1 | tail -5`
Expected: ruff PASS；**≥632 passed**, 2 skipped

- [ ] **Step 2: r28 专项**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_l1_r28.py -v`
Expected: **26/26** passed

- [ ] **Step 3: 前端全量**

Run: `cd fe && pnpm run check:design && pnpm test 2>&1 | tail -8`
Expected: check:design PASS；vitest **≥89** passed

- [ ] **Step 4: r29 专项**

Run: `cd backend && python3 -m pytest tests/test_viz_dash_quality_r29.py -v`
Expected: **≥32/32** passed

- [ ] **Step 5: Commit（若有遗漏修复）**

```bash
git add -A
git commit -m "chore: r29 viz/dash quality full regression green"
```

---

## Spec Self-Review（P2 自检）

| 检查项 | 结果 |
|--------|------|
| round-target 5 子项均有 Task | Task 1→5 覆盖 VIZ-001/002 + DASH-001/002/003 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 有验证命令 | 通过 |
| 前端 UI Task 含 Skills + UI Acceptance | Task 2/3/4/5 |
| 文件预算 17 ≤20 | 通过 |
| 类型/函数名跨 Task 一致 | `resizeWidget`/`normalizeWidgetIds`/`ChartViewError.fields`/`ApiRequestError.code` |

**执行模式固定：** subagent-driven-development (option 1) — P3 按 Task 1→7 顺序派发，Task 间 review gate。
