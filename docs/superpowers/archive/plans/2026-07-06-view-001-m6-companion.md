# M5 VIEW-001 收官 + M6 NFR/GOV companion 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/views/*` · `backend/app/api/v1/views.py` · `backend/app/core/nfr/dashboard_first_screen.py` · `backend/app/governance/catalog/*` · `backend/app/api/v1/gov.py` · `fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx` · `tests/test_view_m5_protocol.py` · `tests/test_nfr_001_first_screen_smoke.py` · `tests/test_gov_001_catalog_appendix_e.py` · `docs/api/README.md`
> **子项：** VIEW-001, NFR-001, GOV-001
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `fe/**` 匹配 `fe-ui.mdc`；`backend/**` 匹配 `backend-fastapi.mdc`）

**Goal:** 闭合 FR-VIEW-1 全 widget 破坏性校验与 `GET /views/schema`；NFR-001 扩展 widget fixture 首屏 perf smoke 可判定；GOV-001 附录 E 七分法 taxonomy L1 catalog + probe。

**Architecture:** VIEW-001 在 `protocol.py` 增 `assert_protocol_version`，`validate.py` 入口守卫并映射 `ChartViewError`→`ViewError`；NFR-001 在 probe 输出 `fixtureProfile` 常量 `M5_EXTENDED_WIDGET_FIXTURE`；GOV-001 新建 `appendix_e.py` 静态 taxonomy + idempotent seed upsert + `GET /gov/catalog/appendix-e`。

**Tech Stack:** FastAPI · Pydantic v2 · SQLAlchemy · React 19 · Vitest · pytest · TestClient

## Global Constraints

- 真理源：`docs/superpowers/evolution/2026-07-06-round-target-view-001-m6.md` > `docs/superpowers/specs/2026-07-06-view-001-m6-companion-design.md`
- `base_branch`: `dev-auto`；禁止修改 `docs/automate/goal.md`；P5 前不改 `plan.md` 结构
- 非目标：Dataset（QUERY-009）、M7 连接器、CAT burst 专项 API、GOV-002 总线 PoC、NFR-004 TLS、VIZ-005 筛选 UI、Admin taxonomy 配置 UI、Alembic migration
- 文件预算：**16** 主文件（design §3）；总计 ≤20
- 后端验证：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_view_m5_protocol.py tests/test_nfr_001_first_screen_smoke.py tests/test_gov_001_catalog_appendix_e.py -q`
- 前端验证：`cd fe && pnpm exec vitest run src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`
- 回归：`cd backend && python3 -m pytest tests/test_view_gov_api_r31.py tests/test_dash_nfr_conn_rpt_r67.py -q`

---

### Task 1: VIEW-001 protocolVersion 守卫 + ChartViewError 映射

**Files:**
- Modify: `backend/app/views/protocol.py`
- Modify: `backend/app/views/validate.py`
- Modify: `tests/test_view_m5_protocol.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `ViewError`, `VIEW_PROTOCOL_VERSION`, `validate_chart_view_config` / `ChartViewError`
- Produces: `assert_protocol_version(data: dict) -> None`；`validate_dashboard_view` 在 Pydantic 前调用守卫；`ChartViewError` 映射为同 code 的 `ViewError`

- [ ] **Step 1: 写失败 pytest（VIEW-001-04a~04d）**

在 `tests/test_view_m5_protocol.py` 追加：

```python
def test_view_001_04a_heatmap_one_dimension_rejected():
    doc = _view_doc([_m5_layout_widget("heatmap", ["x"], ["v"])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"
    assert any("dimensions" in f.get("field", "") for f in exc.value.fields)


def test_view_001_04b_kpi_empty_metrics_rejected():
    doc = _view_doc([_m5_layout_widget("kpi", [], [])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"
    assert any("metrics" in f.get("field", "") for f in exc.value.fields)


def test_view_001_04c_timeline_empty_dimensions_rejected():
    doc = _view_doc([_m5_layout_widget("timeline", [], ["v"])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_view_001_04d_protocol_version_2_rejected():
    doc = _view_doc([_m5_layout_widget("kpi", [], ["total"])])
    doc["protocolVersion"] = 2
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "VIEW_PROTOCOL_UNSUPPORTED"
    assert any(f.get("field") == "protocolVersion" for f in exc.value.fields)
```

Run: `cd backend && python3 -m pytest tests/test_view_m5_protocol.py::test_view_001_04a_heatmap_one_dimension_rejected tests/test_view_m5_protocol.py::test_view_001_04d_protocol_version_2_rejected -v`
Expected: FAIL（无 VIEW_PROTOCOL_UNSUPPORTED / CHART_FIELD_REQUIREMENT 映射）

- [ ] **Step 2: 实现 protocol 守卫与 ChartViewError 映射**

`backend/app/views/protocol.py` 追加：

```python
from app.views.schemas import ViewError


def assert_protocol_version(data: dict[str, Any]) -> None:
    raw = data.get("protocolVersion")
    if raw is None:
        return
    if int(raw) != VIEW_PROTOCOL_VERSION:
        raise ViewError(
            "VIEW_PROTOCOL_UNSUPPORTED",
            f"Unsupported protocolVersion: {raw}",
            422,
            [{"field": "protocolVersion", "message": f"Expected {VIEW_PROTOCOL_VERSION}"}],
        )
```

`backend/app/views/validate.py` 在 `validate_dashboard_view` 开头（`DashboardView.model_validate` 之前）插入：

```python
from app.views.protocol import assert_protocol_version

def validate_dashboard_view(data: dict[str, Any]) -> DashboardView:
    assert_protocol_version(data)
    ...
```

在 `validate_layout_dict` 的 `validate_chart_view_config` 调用外包 try/except：

```python
from app.schemas.chart_view import ChartViewError, validate_chart_view_config

    for widget in parsed.widgets:
        if widget.type == "chart" and widget.chart_config is not None:
            try:
                validate_chart_view_config(
                    widget.chart_config.model_dump(by_alias=True, mode="json"),
                )
            except ChartViewError as exc:
                raise ViewError(exc.code, exc.message, exc.status, exc.fields) from exc
```

`validate_dashboard_view` 的 `except Exception` 分支同样处理 `ChartViewError`：

```python
    except ChartViewError as exc:
        raise ViewError(exc.code, exc.message, exc.status, exc.fields) from exc
```

- [ ] **Step 3: 验证 pytest 通过**

Run: `cd backend && python3 -m ruff check app/views/protocol.py app/views/validate.py tests/test_view_m5_protocol.py && python3 -m pytest tests/test_view_m5_protocol.py -q`
Expected: 全部 passed（含既有 01~03、05）

- [ ] **Step 4: Commit**

```bash
git add backend/app/views/protocol.py backend/app/views/validate.py tests/test_view_m5_protocol.py
git commit -m "feat(views): protocolVersion guard and CHART_FIELD_REQUIREMENT mapping (VIEW-001)"
```

---

### Task 2: VIEW-001 破坏性回归 + GET /views/schema API

**Files:**
- Modify: `backend/app/api/v1/views.py`
- Modify: `tests/test_view_m5_protocol.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `export_view_json_schema()`, `assert_protocol_version`, `validate_dashboard_view`
- Produces: `GET /api/v1/views/schema` → 200 JSON Schema；VIEW-001-04e~04g + VIEW-001-06 测试绿

- [ ] **Step 1: 写失败 pytest（04e~04g + schema API）**

```python
def test_view_001_04e_extended_widget_colspan_3_rejected():
    w = _m5_layout_widget("map", ["region"], ["value"])
    w["colSpan"] = 3
    doc = _view_doc([w])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "VIEW_LAYOUT_BOUNDS"


def test_view_001_04g_chart_ref_cycle_with_kpi():
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": id_a,
                "type": "chart",
                "title": "KPI",
                "colSpan": 6,
                "order": 0,
                "chartRef": id_b,
                "chartConfig": {
                    "chartType": "kpi",
                    "chartId": id_a,
                    "mode": "sql",
                    "dataSourceId": "00000000-0000-4000-8000-000000000010",
                    "sql": "SELECT 1",
                    "dimensions": [],
                    "metrics": [{"field": "total"}],
                },
            },
            {
                "id": id_b,
                "type": "chart",
                "title": "Map",
                "colSpan": 6,
                "order": 1,
                "chartRef": id_a,
                "chartConfig": {
                    "chartType": "map",
                    "chartId": id_b,
                    "mode": "sql",
                    "dataSourceId": "00000000-0000-4000-8000-000000000010",
                    "sql": "SELECT 1",
                    "dimensions": [{"field": "region"}],
                    "metrics": [{"field": "value"}],
                },
            },
        ],
        "globalFilters": [],
    }
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "cycle", "layout": layout})
    assert exc.value.code == "VIEW_CHART_REF_CYCLE"


def test_view_001_06_get_schema_api(client: TestClient):
    resp = client.get("/api/v1/views/schema", headers=AUTH)
    assert resp.status_code == 200
    schema = resp.json()
    assert "properties" in schema
    assert "protocolVersion" in schema["properties"]
```

Run: `cd backend && python3 -m pytest tests/test_view_m5_protocol.py::test_view_001_06_get_schema_api -v`
Expected: FAIL（404 或路由不存在）

- [ ] **Step 2: 实现 GET /schema**

`backend/app/api/v1/views.py` 追加：

```python
from app.views.protocol import export_view_json_schema

@router.get("/schema", response_model=None)
def read_view_schema(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> dict:
    return export_view_json_schema()
```

- [ ] **Step 3: 验证**

Run: `cd backend && python3 -m ruff check app/api/v1/views.py && python3 -m pytest tests/test_view_m5_protocol.py -q`
Expected: 全部 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/views.py tests/test_view_m5_protocol.py
git commit -m "feat(views): GET /views/schema and destructive regression tests (VIEW-001)"
```

---

### Task 3: NFR-001 后端 fixtureProfile + pytest 断言

**Files:**
- Modify: `backend/app/core/nfr/dashboard_first_screen.py`
- Modify: `tests/test_nfr_001_first_screen_smoke.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `DashboardFirstScreenProbeIn`, `DashboardFirstScreenProbeOut`
- Produces: `M5_EXTENDED_WIDGET_FIXTURE` 常量；`fixtureProfile: dict | None` 字段；`dashboardId=="dash-m5-extended"` 或 env `NFR001_FIXTURE_PROFILE=extended` 时填充

- [ ] **Step 1: 写失败 pytest**

`tests/test_nfr_001_first_screen_smoke.py` 改写/扩展：

```python
from app.core.nfr.dashboard_first_screen import (
    M5_EXTENDED_WIDGET_FIXTURE,
    DashboardFirstScreenProbeIn,
    probe_dashboard_first_screen,
)


def test_nfr_001_01_extended_widget_fixture_within_budget():
    out = probe_dashboard_first_screen(
        DashboardFirstScreenProbeIn(
            dashboardId=M5_EXTENDED_WIDGET_FIXTURE["id"],
            widgetCount=4,
            budgetMs=5000,
        ),
    )
    assert out.within_budget is True
    assert out.fixture_profile is not None
    assert out.fixture_profile["id"] == "dash-m5-extended"
    assert out.fixture_profile["widgetTypes"] == ["map", "heatmap", "kpi", "timeline"]
    assert out.widget_count == 4
```

Run: `cd backend && python3 -m pytest tests/test_nfr_001_first_screen_smoke.py::test_nfr_001_01_extended_widget_fixture_within_budget -v`
Expected: FAIL（`fixture_profile` 属性不存在）

- [ ] **Step 2: 实现 fixtureProfile**

`backend/app/core/nfr/dashboard_first_screen.py`：

```python
M5_EXTENDED_WIDGET_FIXTURE: dict[str, object] = {
    "id": "dash-m5-extended",
    "widgetTypes": ["map", "heatmap", "kpi", "timeline"],
    "widgetCount": 4,
}


def _resolve_fixture_profile(dashboard_id: str, widget_count: int) -> dict[str, object] | None:
    if dashboard_id == M5_EXTENDED_WIDGET_FIXTURE["id"]:
        return dict(M5_EXTENDED_WIDGET_FIXTURE)
    if widget_count == 4 and os.environ.get("NFR001_FIXTURE_PROFILE") == "extended":
        return dict(M5_EXTENDED_WIDGET_FIXTURE)
    return None
```

`DashboardFirstScreenProbeOut` 增字段：

```python
    fixture_profile: dict[str, object] | None = Field(default=None, alias="fixtureProfile")
```

`probe_dashboard_first_screen` return 时填充 `fixture_profile=_resolve_fixture_profile(item.dashboard_id, item.widget_count)`。

- [ ] **Step 3: 验证 + 默认 probe 无回归**

Run: `cd backend && python3 -m pytest tests/test_nfr_001_first_screen_smoke.py -q && python3 -m pytest tests/test_dash_nfr_conn_rpt_r67.py -k first_screen -q`
Expected: NFR smoke 2 passed；r67 first_screen 探针仍 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/nfr/dashboard_first_screen.py tests/test_nfr_001_first_screen_smoke.py
git commit -m "feat(nfr): M5 extended widget fixtureProfile on first-screen probe (NFR-001)"
```

---

### Task 4: NFR-001 FE perf smoke 薄改（per-type render-spec mock）

**Files:**
- Modify: `fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `DashboardEditPage`、`ChartPanel`、`KpiCard`；遵守 design.md §7 通用 UI 质量基线
- desktop vitest 下 4 widget 加载完成无 `aria-busy=true`；无新增生产 UI 变更
- hover/focus/active/loading/empty/error 沿用既有 ChartPanel 契约；本轮仅 mock 与注释
- `pnpm run check:design` 无硬编码色、无局部私有组件体系漂移

- [ ] **Step 1: 更新 mock 按 chartType 返回 engine**

文件头追加注释：

```typescript
/** NFR-001: vitest P95 ≤3000ms 为 CI 稳定门槛；SRS/API budgetMs 默认 5000ms。 */
```

`setupMocks` 内 `/charts/render-spec` 分支改为：

```typescript
    if (path === "/api/v1/charts/render-spec") {
      const body = (args[1] as { body?: string } | undefined)?.body;
      let chartType = "map";
      if (typeof body === "string") {
        try {
          chartType = String(JSON.parse(body).chartType ?? "map");
        } catch {
          chartType = "map";
        }
      }
      const engine = chartType === "kpi" ? "kpi" : "echarts";
      return {
        engine,
        chartType,
        encoding: { dimensions: [], metrics: [] },
        source: {},
      };
    }
```

- [ ] **Step 2: 验证 vitest**

Run: `cd fe && pnpm exec vitest run src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`
Expected: `1 passed`；P95 ≤ 3000ms

- [ ] **Step 3: Commit**

```bash
git add fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx
git commit -m "test(nfr): per-chartType render-spec mock for extended widget perf smoke (NFR-001)"
```

---

### Task 5: GOV-001 附录 E taxonomy 模块 + seed upsert

**Files:**
- Create: `backend/app/governance/catalog/appendix_e.py`
- Modify: `backend/app/governance/catalog/models.py`
- Modify: `backend/app/governance/catalog/schemas.py`
- Modify: `backend/app/governance/catalog/service.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `docs/srs/附录E-7类查询接口清单.md` 七分法
- Produces: `APPENDIX_E_TAXONOMY`（7 项 CAT-01~07）；`export_appendix_e_schema()`；`get_appendix_e_taxonomy()`；`VALID_CATEGORY_CODES` 含 CAT-07；idempotent `_ensure_seed_categories`

- [ ] **Step 1: 写失败 pytest（GOV-001-01~03 骨架）**

Create `tests/test_gov_001_catalog_appendix_e.py`：

```python
"""GOV-001 — Appendix E taxonomy L1 catalog."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_GOV_SQLITE = "sqlite+pysqlite:///file:gov_001_appendix_e?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def gov_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _GOV_SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    import app.auth.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_gov_001_01_appendix_e_returns_seven_categories(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/appendix-e", headers=AUTH)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["appendix"] == "E"
    assert data["version"] == 1
    assert len(data["taxonomy"]) == 7
    codes = {item["code"] for item in data["taxonomy"]}
    assert codes == {f"CAT-{i:02d}" for i in range(1, 8)}
    assert "schema" in data
    assert data["schema"]["$id"] == "vitalspan://gov/appendix-e/v1"


def test_gov_001_02_categories_list_has_seven(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/categories", headers=AUTH)
    assert resp.status_code == 200
    codes = {item["code"] for item in resp.json()["items"]}
    assert len(codes) == 7


def test_gov_001_03_create_entry_cat04_valid_cat99_invalid(client: TestClient):
    ok = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Timeseries probe",
            "httpMethod": "GET",
            "path": "/api/v1/timeseries",
            "categoryCodes": ["CAT-04"],
        },
    )
    assert ok.status_code == 201
    bad = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Bad",
            "httpMethod": "GET",
            "path": "/api/v1/bad",
            "categoryCodes": ["CAT-99"],
        },
    )
    assert bad.status_code == 400
    assert bad.json()["code"] == "CATALOG_INVALID_CATEGORY"
```

Run: `cd backend && python3 -m pytest tests/test_gov_001_catalog_appendix_e.py -v`
Expected: FAIL（404 / 3 categories only）

- [ ] **Step 2: 实现 appendix_e + models + service**

`backend/app/governance/catalog/appendix_e.py`（新建，对齐 design §6.4.2）：

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AppendixECategory:
    code: str
    name: str
    kind: str
    description: str
    example_api: str


APPENDIX_E_TAXONOMY: tuple[AppendixECategory, ...] = (
    AppendixECategory("CAT-01", "实体生命周期查询类", "entity", "可配置实体类型之状态与关系查询", "GET /api/v1/entities/{entityType}/{entityId}"),
    AppendixECategory("CAT-02", "统计分析聚合类", "aggregate", "按地域/时间/分类维度的聚合统计", "GET /api/v1/stats/aggregate"),
    AppendixECategory("CAT-03", "地域维度查询类", "geo", "服务区域、GIS 分布、地域下钻", "GET /api/v1/geo/distribution"),
    AppendixECategory("CAT-04", "时间序列分析类", "timeseries", "日/周/月/同比环比时序数据", "GET /api/v1/timeseries"),
    AppendixECategory("CAT-05", "工单与业务受理类", "ticket", "工单类业务统计与明细", "GET /api/v1/tickets/stats"),
    AppendixECategory("CAT-06", "生产与销售统计类", "production", "厂商/型号等生产销售统计", "GET /api/v1/production/stats"),
    AppendixECategory("CAT-07", "组织行为审计类", "audit", "操作主体登录、行为、层级查询", "GET /api/v1/workno/behavior"),
)


def export_appendix_e_schema() -> dict[str, Any]:
    return {
        "$id": "vitalspan://gov/appendix-e/v1",
        "type": "object",
        "required": ["code", "name", "kind", "description", "exampleApi", "status"],
        "properties": {
            "code": {"type": "string", "pattern": "^CAT-0[1-7]$"},
            "name": {"type": "string"},
            "kind": {"type": "string"},
            "description": {"type": "string"},
            "exampleApi": {"type": "string"},
            "status": {"type": "string", "const": "suggested"},
        },
    }


def taxonomy_as_dicts() -> list[dict[str, str]]:
    return [
        {
            "code": c.code,
            "name": c.name,
            "kind": c.kind,
            "description": c.description,
            "exampleApi": c.example_api,
            "status": "suggested",
        }
        for c in APPENDIX_E_TAXONOMY
    ]
```

`models.py` 扩展 `SEED_CATEGORIES` 与 `VALID_CATEGORY_CODES` 至 CAT-07（从 `appendix_e.APPENDIX_E_TAXONOMY` 派生或显式列出 7 行）。

`schemas.py` 追加：

```python
class AppendixETaxonomyOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    appendix: str = "E"
    version: int = 1
    taxonomy: list[dict[str, str]]
    schema_: dict[str, object] = Field(alias="schema")
```

`service.py`：

```python
from app.governance.catalog.appendix_e import APPENDIX_E_TAXONOMY, export_appendix_e_schema, taxonomy_as_dicts

def _ensure_seed_categories(db: Session) -> None:
    for cat in APPENDIX_E_TAXONOMY:
        existing = db.get(CatalogCategory, cat.code)
        if existing is None:
            db.add(
                CatalogCategory(
                    code=cat.code,
                    name=cat.name,
                    kind=cat.kind,
                    description=cat.description,
                )
            )
    db.commit()


def get_appendix_e_taxonomy() -> AppendixETaxonomyOut:
    return AppendixETaxonomyOut(
        taxonomy=taxonomy_as_dicts(),
        schema_=export_appendix_e_schema(),
    )
```

- [ ] **Step 3: 验证 categories/entries 测试（暂不测 appendix-e route）**

Run: `cd backend && python3 -m ruff check app/governance/catalog/ && python3 -m pytest tests/test_gov_001_catalog_appendix_e.py::test_gov_001_02_categories_list_has_seven tests/test_gov_001_catalog_appendix_e.py::test_gov_001_03_create_entry_cat04_valid_cat99_invalid -q`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/governance/catalog/appendix_e.py backend/app/governance/catalog/models.py backend/app/governance/catalog/schemas.py backend/app/governance/catalog/service.py tests/test_gov_001_catalog_appendix_e.py
git commit -m "feat(gov): Appendix E taxonomy constants and idempotent CAT-01~07 seed (GOV-001)"
```

---

### Task 6: GOV-001 API + probe + ACL + API 文档登记

**Files:**
- Create: `backend/app/governance/catalog/probe.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_gov_001_catalog_appendix_e.py`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**Interfaces:**
- Consumes: `get_appendix_e_taxonomy()`, `set_user_catalog_taxonomy_scope`（新建，对齐 r67 ACL 模式）
- Produces: `GET /api/v1/gov/catalog/appendix-e`；`probe_appendix_e_taxonomy_budget_ms(actor)`；`GOV_APPENDIX_E_FORBIDDEN` 403

- [ ] **Step 1: 写失败 pytest（04~05 + appendix-e route）**

`tests/test_gov_001_catalog_appendix_e.py` 追加：

```python
from app.auth.deps import UserContext, get_current_user
from app.governance.catalog.probe import probe_appendix_e_taxonomy_budget_ms
from app.governance.catalog.service import set_user_catalog_taxonomy_scope


def test_gov_001_04_probe_within_50ms():
    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_appendix_e_taxonomy_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


@pytest.fixture
def enterprise_appendix_scope(monkeypatch):
    from app.main import app as fastapi_app

    def _enterprise() -> UserContext:
        return UserContext(id="enterprise-gov001", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    set_user_catalog_taxonomy_scope("enterprise-gov001", "CAT-0")
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_001_05_enterprise_scope_forbidden(client: TestClient, enterprise_appendix_scope):
    set_user_catalog_taxonomy_scope("enterprise-gov001", "CAT-0")
    resp = client.get("/api/v1/gov/catalog/appendix-e")
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_APPENDIX_E_FORBIDDEN"
```

Run: `cd backend && python3 -m pytest tests/test_gov_001_catalog_appendix_e.py::test_gov_001_01_appendix_e_returns_seven_categories -v`
Expected: FAIL

- [ ] **Step 2: 实现 probe + route + ACL**

`backend/app/governance/catalog/probe.py`：

```python
from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.core.nfr.dashboard_first_screen import FirstScreenProbeResult
from app.governance.catalog.service import get_appendix_e_taxonomy_for_actor

probe_appendix_e_taxonomy_budget_ms_limit = 50


def probe_appendix_e_taxonomy_budget_ms(actor: UserContext) -> FirstScreenProbeResult:
    started = time.perf_counter()
    get_appendix_e_taxonomy_for_actor(actor)
    elapsed = (time.perf_counter() - started) * 1000
    return FirstScreenProbeResult(
        elapsed_ms=elapsed,
        ok=elapsed < probe_appendix_e_taxonomy_budget_ms_limit,
    )
```

`service.py` 增 ACL（对齐 `dashboard_first_screen.set_user_first_screen_scope`）：

```python
_USER_CATALOG_TAXONOMY_SCOPE: dict[str, str] = {}

def set_user_catalog_taxonomy_scope(user_id: str, allowed_prefix: str) -> None:
    _USER_CATALOG_TAXONOMY_SCOPE[user_id] = allowed_prefix

def _assert_appendix_acl(actor: UserContext) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_CATALOG_TAXONOMY_SCOPE.get(actor.id, "CAT-")
    if prefix != "CAT-":
        raise CatalogError(
            "GOV_APPENDIX_E_FORBIDDEN",
            "enterprise user out of appendix-e taxonomy scope",
            403,
        )

def get_appendix_e_taxonomy_for_actor(actor: UserContext) -> AppendixETaxonomyOut:
    _assert_appendix_acl(actor)
    return get_appendix_e_taxonomy()
```

`gov.py` 路由用 try/except 包装（与 `list_catalog_entries` 一致）：

```python
@router.get("/catalog/appendix-e", response_model=None)
def read_appendix_e_taxonomy(
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> AppendixETaxonomyOut | JSONResponse:
    try:
        return catalog_service.get_appendix_e_taxonomy_for_actor(actor)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)
```

`docs/api/README.md` 登记两行：

```markdown
| GET | `/api/v1/views/schema` | DashboardView JSON Schema | IF-06 | 一期 | VIEW-001 | 已实现 | `backend/app/api/v1/views.py` |
| GET | `/api/v1/gov/catalog/appendix-e` | 附录 E 七分法 taxonomy + schema | IF-06 | 一期 | GOV-001 | 已实现 | `backend/app/api/v1/gov.py` |
```

并更新既有 `/gov/catalog/categories` 行备注为「CAT-01~07 seed」。

- [ ] **Step 3: 全量增量验证**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest tests/test_view_m5_protocol.py tests/test_nfr_001_first_screen_smoke.py tests/test_gov_001_catalog_appendix_e.py -q
cd fe && pnpm exec vitest run src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx
cd backend && python3 -m pytest tests/test_view_gov_api_r31.py tests/test_dash_nfr_conn_rpt_r67.py -q
```
Expected: 全部 exit 0

- [ ] **Step 4: Commit**

```bash
git add backend/app/governance/catalog/probe.py backend/app/api/v1/gov.py backend/app/governance/catalog/service.py tests/test_gov_001_catalog_appendix_e.py docs/api/README.md
git commit -m "feat(gov): GET /catalog/appendix-e + probe + ACL; register APIs (GOV-001)"
```

---

## Spec Self-Review

| 子项 | 覆盖 Task |
|------|-----------|
| VIEW-001 FR-VIEW-1 破坏性 + schema | Task 1–2 |
| NFR-001 扩展 widget fixture perf | Task 3–4 |
| GOV-001 附录 E L1 | Task 5–6 |
| 文件数 | 16（design §3） |
| 占位符 | 无 TBD/TODO |
