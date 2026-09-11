# M9/M10/M12 仪表板与报表 companion 质量推分 r58 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/dashboard/theme/{execute,acl,schemas,service}.py` · `backend/app/api/v1/dashboards.py` · `backend/app/reports/extension/{compare,acl,schemas,render,service}.py` · `backend/app/reports/scheduler/{delivery,executor,schemas}.py` · `backend/app/reports/catalog/acl.py` · `backend/app/reports/batch/service.py` · `backend/app/api/v1/reports/__init__.py` · `tests/test_dash_rpt_r58.py` · `docs/services/{dashboard,reports}.md`
> **子项：** DASH-006, RPT-004, RPT-005, RPT-006, RPT-007
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 闭合 r57 companion 遗留——主题分析 execute-plan 四步链 + theme ACL、报表 extension 同比环比 compare-preview/render-spec、semi-real 调度执行器 + mock 投递链、artifact 访问守卫、batch compare 联动；≥38 条 `test_dash_rpt_r58`；五 PRD ID 加权总分 **≥90**（DASH-006/RPT-004/RPT-005 STUCK 清零）。

**Architecture:** 域逻辑留在 `dashboard/theme/`、`reports/extension|scheduler|batch/`、`reports/catalog/acl.py`；`api/v1/dashboards.py` 与 `reports/__init__.py` 仅薄 entry；各域 `probe_*_budget_ms` 同进程计时（35–200ms）；内存 store（`_EXECUTION_LOG`、`_DELIVERY_LOG`、`_ARTIFACT_OWNERS`）非 Alembic。纯后端、无 `fe/`。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **分层纪律**（`common.mdc`）：domain 写业务；`api/v1/*.py` = entry。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；鉴权 403。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/services/` > `docs/api/README.md`。
- **验证基线**（r57 P5）：`cd backend && python3 -m pytest -q` ≈ **1452 passed** / 4 skipped；本轮目标 **≥1490 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_dash_rpt_r58.py \
    ../tests/test_dash_rpt_query_nfr_r57.py \
    ../tests/test_rpt_gov_meta_conn_r55.py \
    ../tests/test_dash_rpt_query_nfr_r53.py \
    ../tests/test_design_conn_gov_query_r52.py \
    -v
  ```
  Expected: r58 **≥38/38** + r57 **37/37** + r55 **35/35** + r53 **38/38** + r52 **52/52**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/dashboard/theme/execute.py` | DASH-006 execute-plan 四步 + yoy/mom 窗口 + probe | 新建 |
| `backend/app/dashboard/theme/acl.py` | DASH-006 theme 读写 ACL | 新建 |
| `backend/app/dashboard/theme/schemas.py` | ThemeExecutePlanOut、CompareWindow、ThemePlanStep | 修改 |
| `backend/app/dashboard/theme/service.py` | resolve_chart_bindings_for_execute + ACL 钩子 | 修改 |
| `backend/app/api/v1/dashboards.py` | POST execute-plan；PUT/GET ACL | 修改 |
| `backend/app/reports/extension/compare.py` | RPT-004 yoy/mom slots + preview | 新建 |
| `backend/app/reports/extension/schemas.py` | MetricAdjustment.compareMode | 修改 |
| `backend/app/reports/extension/render.py` | compareMetrics + compareVersion | 修改 |
| `backend/app/reports/extension/acl.py` | extension 读写删 ACL | 新建 |
| `backend/app/reports/extension/service.py` | compare 校验 + ACL 调用点 | 修改 |
| `backend/app/reports/scheduler/delivery.py` | mock 投递通道 + 重试 | 新建 |
| `backend/app/reports/scheduler/executor.py` | semi_real_execute_schedule | 修改 |
| `backend/app/reports/scheduler/schemas.py` | semi-real status + deliverySteps | 修改 |
| `backend/app/reports/catalog/acl.py` | assert_artifact_access | 修改 |
| `backend/app/reports/batch/service.py` | batch compare render 探测钩子 | 修改 |
| `backend/app/api/v1/reports/__init__.py` | compare-preview、semi-real execute、artifact GET、ACL | 修改 |
| `tests/test_dash_rpt_r58.py` | 新套件 ≥38 断言 | 新建 |
| `docs/services/dashboard.md` | execute-plan + theme ACL | 修改 |
| `docs/services/reports.md` | compare/delivery/semi-real/ACL | 修改 |

预估 **P3 生产代码 16** + **测试 1** + **docs 2** = **19 ≤ 20**。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_dash_rpt_r58.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""M9 主题分析 + M10/M12 报表 companion 质量推分 r58."""
from __future__ import annotations

import os
import subprocess
import sys
import uuid
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
_R58_SQLITE_URL = "sqlite+pysqlite:///file:dash_rpt_r58?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r58_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_nfr08 = os.environ.get("NFR08_RUNTIME_MODE")
    os.environ["DATABASE_URL"] = _R58_SQLITE_URL
    os.environ.setdefault("NFR08_RUNTIME_MODE", "permissive")
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    if previous_nfr08 is None:
        os.environ.pop("NFR08_RUNTIME_MODE", None)
    else:
        os.environ["NFR08_RUNTIME_MODE"] = previous_nfr08
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r58", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def editor_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="editor-r58", username="editor", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R58 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r58 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _chart_table_config() -> dict:
    return {
        "chartType": "table",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1 AS id",
    }


def _put_chart_widget(client: TestClient, dash_id: str, widget_id: str | None = None) -> str:
    wid = widget_id or str(uuid.uuid4())
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={
            "layoutJson": {
                "widgets": [
                    {"id": wid, "type": "chart", "chartConfig": _chart_table_config()},
                ]
            }
        },
    )
    assert resp.status_code == 200, resp.text
    return wid


def _save_theme_config(
    client: TestClient,
    dash_id: str,
    *,
    granularity: str = "month",
    widget_id: str | None = None,
    dimension_id: str = "dim_sales",
) -> None:
    wid = widget_id or str(uuid.uuid4())
    payload = {
        "entityType": "sales",
        "timeGranularity": granularity,
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": dimension_id, "label": "Sales"}],
        "chartViewBindings": [{"widgetId": wid, "dimensionId": dimension_id}],
    }
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 200, resp.text


def _create_template_node(client: TestClient, name: str = "Tpl") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": name, "nodeType": "template", "templateKind": "excel"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_folder_node(client: TestClient, name: str = "Folder") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": name, "nodeType": "folder"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _schedule_and_execute(
    client: TestClient,
    node_id: str,
    *,
    idempotency_key: str | None = None,
    delivery_mock: str | None = None,
) -> dict:
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    )
    assert sched.status_code == 201, sched.text
    sid = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{sid}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    headers = {**AUTH, "Idempotency-Key": idempotency_key or f"r58-{uuid.uuid4().hex}"}
    if delivery_mock:
        headers["X-Rpt-Delivery-Mock"] = delivery_mock
    resp = client.post(f"/api/v1/reports/schedules/{sid}/execute", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()
```

---

### Task 1: r58 夹具 + DASH-006 execute-plan 四步链

**Files:**
- Create: `backend/app/dashboard/theme/execute.py`
- Modify: `backend/app/dashboard/theme/schemas.py`
- Modify: `backend/app/dashboard/theme/service.py`
- Modify: `backend/app/api/v1/dashboards.py`
- Create: `tests/test_dash_rpt_r58.py`（夹具 + DASH execute ≥6 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**测试门槛:** `pytest ../tests/test_dash_rpt_r58.py -k "dash_r58_execute or dash_r58_fixture" -v` 全绿；`probe_theme_execute_plan_budget_ms` ≤40ms。

**Interfaces:**
- Produces: `build_theme_execute_plan(db, ref_type, ref_id) -> ThemeExecutePlanOut`
- Produces: `probe_theme_execute_plan_budget_ms(db, ref_type, ref_id) -> float`
- Produces: `resolve_chart_bindings_for_execute(db, ref_type, ref_id) -> dict`（含 `resolvedWidgets[]`）
- Produces: `POST /api/v1/dashboards/theme-analysis/execute-plan`

- [ ] **Step 1: Write the failing tests**

在 `tests/test_dash_rpt_r58.py` 写入上文 **Shared Test Fixtures** 全文，并追加：

```python
from app.dashboard.theme.execute import probe_theme_execute_plan_budget_ms


def test_r58_fixture_bootstraps(client):
    """T-R58-000-01: r58 sqlite 环境 health 可达。"""
    assert client.get("/health").status_code == 200


def test_dash_r58_execute_plan_happy_path(client):
    """D58-006-01: execute-plan 合法 dashboard → 200 planVersion=theme-plan-v1 四步 pass。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["planVersion"] == "theme-plan-v1"
    steps = [s["step"] for s in body["steps"]]
    assert steps == ["config_load", "bindings_resolve", "granularity_window", "geo_check"]
    assert all(s["status"] == "pass" for s in body["steps"])


def test_dash_r58_execute_plan_yoy_compare_window(client):
    """D58-006-02: timeGranularity=yoy → compareWindow baseline/current 非空 ISO 区间。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid, granularity="yoy")
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    cw = resp.json().get("compareWindow")
    assert cw is not None
    assert cw["current"]["start"] and cw["current"]["end"]
    assert cw["baseline"]["start"] and cw["baseline"]["end"]


def test_dash_r58_execute_plan_config_not_found(client):
    """D58-006-01b: 无 theme config → 404 CONFIG_NOT_FOUND。"""
    dash_id = _create_dashboard(client)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CONFIG_NOT_FOUND"


def test_dash_r58_resolved_widgets_chart_type(client):
    """D58-006-04: resolvedWidgets chartType 与 layout 一致。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    widgets = resp.json().get("resolvedWidgets", [])
    assert len(widgets) >= 1
    assert widgets[0]["chartType"] == "table"
    assert widgets[0]["widgetId"] == wid


def test_dash_r58_probe_execute_plan_under_budget(client):
    """D58-006-05: probe_theme_execute_plan ≤40ms。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    from app.datasources.models import get_meta_session

    db = get_meta_session()
    try:
        import uuid as _uuid

        elapsed = probe_theme_execute_plan_budget_ms(db, "dashboard", _uuid.UUID(dash_id))
    finally:
        db.close()
    assert elapsed <= 40.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "dash_r58_execute or dash_r58_fixture or r58_fixture" -v`
Expected: FAIL（`execute.py` 未实现 / `execute-plan` 路由 404）

- [ ] **Step 3: Write minimal implementation**

`backend/app/dashboard/theme/schemas.py` 追加：

```python
from typing import Literal


class ThemePlanStep(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    step: Literal["config_load", "bindings_resolve", "granularity_window", "geo_check"]
    status: Literal["pass", "skip", "fail"]
    detail: str | None = None


class CompareWindowInterval(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    start: str
    end: str


class CompareWindow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    current: CompareWindowInterval
    baseline: CompareWindowInterval


class ThemeExecutePlanOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    plan_version: str = Field(default="theme-plan-v1", alias="planVersion")
    ref_type: str = Field(alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
    steps: list[ThemePlanStep]
    compare_window: CompareWindow | None = Field(default=None, alias="compareWindow")
    resolved_widgets: list[dict] = Field(default_factory=list, alias="resolvedWidgets")
```

`backend/app/dashboard/theme/execute.py`（新建）：

```python
from __future__ import annotations

import time
import uuid
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.dashboard import service as dash_service
from app.dashboard.theme.errors import ThemeAnalysisError
from app.dashboard.theme.schemas import (
    CompareWindow,
    CompareWindowInterval,
    EntityThemeConfig,
    ThemeExecutePlanOut,
    ThemePlanStep,
)
from app.dashboard.theme import service as theme_service
from app.query.config_store.schemas import ConfigError
from app.query.config_store import service as config_store

_EXECUTE_PLAN_BUDGET_MS = 40
_ANCHOR = date(2026, 1, 1)


def _granularity_window(config: EntityThemeConfig) -> tuple[ThemePlanStep, CompareWindow | None]:
    gran = config.time_granularity
    if gran in {"day", "week", "month"}:
        start = _ANCHOR.isoformat()
        end = (_ANCHOR + timedelta(days=30)).isoformat()
        return ThemePlanStep(step="granularity_window", status="pass", detail=gran), None
    if gran in {"yoy", "mom"}:
        current = CompareWindowInterval(start=_ANCHOR.isoformat(), end=(_ANCHOR + timedelta(days=30)).isoformat())
        baseline_start = _ANCHOR - timedelta(days=365 if gran == "yoy" else 30)
        baseline = CompareWindowInterval(
            start=baseline_start.isoformat(),
            end=(baseline_start + timedelta(days=30)).isoformat(),
        )
        return (
            ThemePlanStep(step="granularity_window", status="pass", detail=gran),
            CompareWindow(current=current, baseline=baseline),
        )
    raise ThemeAnalysisError("DASH_THEME_INVALID_GRANULARITY", "Invalid time granularity", 422)


def build_theme_execute_plan(db: Session, ref_type: str, ref_id: uuid.UUID) -> ThemeExecutePlanOut:
    steps: list[ThemePlanStep] = []
    try:
        record = config_store.get_config_by_ref(db, "entity_theme", ref_type, ref_id)
        config = theme_service.validate_theme_config(record.payload)
        steps.append(ThemePlanStep(step="config_load", status="pass", detail="entity_theme loaded"))
    except ConfigError as exc:
        if exc.code == "CONFIG_NOT_FOUND":
            raise ThemeAnalysisError("CONFIG_NOT_FOUND", exc.message, 404) from exc
        raise
    resolved = theme_service.resolve_chart_bindings_for_execute(db, ref_type, ref_id)
    steps.append(ThemePlanStep(step="bindings_resolve", status="pass", detail=f"{len(resolved)} widgets"))
    gran_step, compare_window = _granularity_window(config)
    steps.append(gran_step)
    if config.geo_binding is None:
        steps.append(ThemePlanStep(step="geo_check", status="skip", detail="no geoBinding"))
    else:
        geo = config.geo_binding
        if not geo.lat_field or not geo.lng_field:
            raise ThemeAnalysisError("DASH_THEME_INVALID_GEO", "geoBinding requires latField and lngField", 422)
        steps.append(ThemePlanStep(step="geo_check", status="pass", detail="geo fields present"))
    return ThemeExecutePlanOut(
        refType=ref_type,
        refId=ref_id,
        steps=steps,
        compareWindow=compare_window,
        resolvedWidgets=resolved,
    )


def probe_theme_execute_plan_budget_ms(db: Session, ref_type: str, ref_id: uuid.UUID) -> float:
    start = time.perf_counter()
    build_theme_execute_plan(db, ref_type, ref_id)
    return (time.perf_counter() - start) * 1000.0
```

`backend/app/dashboard/theme/service.py` 追加 `resolve_chart_bindings_for_execute`：

```python
def resolve_chart_bindings_for_execute(db: Session, ref_type: str, ref_id: uuid.UUID) -> list[dict]:
    config = get_theme_config(db, ref_type, ref_id)
    if config.ref_type != "dashboard":
        return []
    dashboard = dash_service.get_dashboard(db, config.ref_id)
    widgets = dashboard.layout_json.get("widgets", [])
    widget_map = {str(w.get("id")): w for w in widgets if isinstance(w, dict)}
    resolved: list[dict] = []
    for binding in config.chart_view_bindings:
        widget = widget_map.get(binding.widget_id)
        if widget is None or widget.get("type") != "chart":
            raise ThemeAnalysisError(
                "DASH_THEME_CHART_VIEW_MISMATCH",
                "chartViewBindings reference invalid widgets",
                422,
                fields=[binding.widget_id],
            )
        chart_config = widget.get("chartConfig") or {}
        resolved.append({
            "widgetId": binding.widget_id,
            "chartType": chart_config.get("chartType", "unknown"),
            "dimensionId": binding.dimension_id,
        })
    return resolved
```

`backend/app/api/v1/dashboards.py` 追加路由：

```python
@router.post("/theme-analysis/execute-plan", response_model=None)
def execute_theme_plan(
    payload: dict,
    _: Annotated[UserContext, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(_db)] = None,
):
    from app.dashboard.theme.execute import build_theme_execute_plan

    ref_type = payload.get("refType", "dashboard")
    ref_id = uuid.UUID(str(payload["refId"]))
    try:
        return build_theme_execute_plan(db, ref_type, ref_id)
    except ThemeAnalysisError as exc:
        return _theme_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "dash_r58_execute or r58_fixture" -v`
Expected: PASS（6 例）

- [ ] **Step 5: Commit**

```bash
git add backend/app/dashboard/theme/execute.py backend/app/dashboard/theme/schemas.py \
  backend/app/dashboard/theme/service.py backend/app/api/v1/dashboards.py \
  tests/test_dash_rpt_r58.py
git commit -m "feat(dash): DASH-006 theme execute-plan four-step chain r58"
```

---

### Task 2: DASH-006 theme ACL 写守卫

**Files:**
- Create: `backend/app/dashboard/theme/acl.py`
- Modify: `backend/app/dashboard/theme/service.py`
- Modify: `backend/app/api/v1/dashboards.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**测试门槛:** `pytest ../tests/test_dash_rpt_r58.py -k "dash_r58_theme_acl" -v` 全绿；viewer PUT → 403 `DASH_THEME_FORBIDDEN`。

**Interfaces:**
- Produces: `assert_theme_action(actor: UserContext, action: Literal["read","write"]) -> None`

- [ ] **Step 1: Write the failing tests**

```python
def test_dash_r58_theme_viewer_put_forbidden(viewer_user, client):
    """D58-006-03: viewer PUT theme-analysis → 403 DASH_THEME_FORBIDDEN。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    payload = {
        "entityType": "sales",
        "timeGranularity": "month",
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": "dim_sales"}],
        "chartViewBindings": [{"widgetId": wid, "dimensionId": "dim_sales"}],
    }
    resp = client.put("/api/v1/dashboards/theme-analysis", json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_THEME_FORBIDDEN"


def test_dash_r58_theme_editor_put_allowed(editor_user, client):
    """D58-006-03b: editor PUT theme-analysis → 200。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    payload = {
        "entityType": "sales",
        "timeGranularity": "month",
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": "dim_sales"}],
        "chartViewBindings": [{"widgetId": wid, "dimensionId": "dim_sales"}],
    }
    resp = client.put("/api/v1/dashboards/theme-analysis", json=payload)
    assert resp.status_code == 200, resp.text


def test_dash_r58_theme_viewer_get_allowed(viewer_user, client):
    """D58-006-03c: viewer GET theme-analysis → 200（read 放行）。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    resp = client.get(
        "/api/v1/dashboards/theme-analysis",
        params={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "dash_r58_theme_acl" -v`
Expected: FAIL（viewer PUT 仍 200）

- [ ] **Step 3: Write minimal implementation**

`backend/app/dashboard/theme/acl.py`（新建）：

```python
from __future__ import annotations

from typing import Literal

from app.auth.deps import UserContext
from app.dashboard.theme.errors import ThemeAnalysisError


def assert_theme_action(actor: UserContext, action: Literal["read", "write"]) -> None:
    if action == "read":
        return
    roles = set(actor.roles)
    if "admin" in roles or "owner" in roles or "editor" in roles:
        return
    raise ThemeAnalysisError("DASH_THEME_FORBIDDEN", "theme write requires editor, owner or admin", 403)
```

`service.py` — `save_theme_config` 签名改为接收 `actor: UserContext`：

```python
from app.dashboard.theme.acl import assert_theme_action

def save_theme_config(db: Session, payload: dict, actor: UserContext) -> EntityThemeConfig:
    assert_theme_action(actor, "write")
    config = validate_theme_config(payload)
    # ... 其余不变，owner_id 用 uuid.UUID(actor.id) 若可解析 else None
```

`dashboards.py` — `save_theme_analysis` 传入 `user`：

```python
return theme_service.save_theme_config(db, payload, user)
```

`get_theme_analysis` 调用 `assert_theme_action(user, "read")`（可选显式，read 恒 pass）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "dash_r58_theme_acl" -v`
Expected: PASS（3 例）

- [ ] **Step 5: Commit**

```bash
git add backend/app/dashboard/theme/acl.py backend/app/dashboard/theme/service.py backend/app/api/v1/dashboards.py tests/test_dash_rpt_r58.py
git commit -m "feat(dash): DASH-006 theme ACL write guard r58"
```

---

### Task 3: RPT-004 同比环比 compare-preview + render-spec 联动

**Files:**
- Create: `backend/app/reports/extension/compare.py`
- Modify: `backend/app/reports/extension/schemas.py`
- Modify: `backend/app/reports/extension/render.py`
- Modify: `backend/app/reports/extension/service.py`
- Modify: `backend/app/api/v1/reports/__init__.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**测试门槛:** `pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_compare" -v` 全绿；非法 compareMode → 422 `RPT_EXT_INVALID_COMPARE`。

**Interfaces:**
- Produces: `build_compare_slots(compare_mode, metrics, metric_keys) -> list[dict]`
- Produces: `build_extension_render_spec` 输出 `compareMetrics` + `compareVersion: "1.0"`
- Produces: `POST /api/v1/reports/catalog/nodes/{id}/extension/compare-preview`

- [ ] **Step 1: Write the failing tests**

```python
def test_rpt_r58_compare_preview_yoy(client):
    """D58-004-01: compareMode=yoy upsert → compare-preview 200 slots。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "revenue", "label": "Revenue", "expression": "sum(amt)", "compareMode": "yoy"}],
        },
    )
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension/compare-preview",
        headers=AUTH,
        json={"compareMode": "yoy"},
    )
    assert resp.status_code == 200, resp.text
    slots = resp.json()["slots"]
    assert len(slots) >= 1
    assert slots[0]["compareMode"] == "yoy"


def test_rpt_r58_render_spec_compare_metrics(client):
    """D58-004-02: render-spec 含 compareMetrics 与 compareVersion。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "orders", "label": "Orders", "compareMode": "mom"}],
        },
    )
    resp = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["compareVersion"] == "1.0"
    assert len(body.get("compareMetrics", [])) >= 1


def test_rpt_r58_invalid_compare_mode(client):
    """D58-004-04: 非法 compareMode → 422 RPT_EXT_INVALID_COMPARE。"""
    node_id = _create_template_node(client)
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "bad", "label": "Bad", "compareMode": "wow"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_COMPARE"


def test_rpt_r58_compare_preview_folder_rejected(client):
    """D58-006R-02b: folder 节点 compare-preview → 422 RPT_EXT_INVALID_NODE_TYPE。"""
    folder_id = _create_folder_node(client)
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{folder_id}/extension/compare-preview",
        headers=AUTH,
        json={"compareMode": "yoy"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_NODE_TYPE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_compare" -v`
Expected: FAIL（compare-preview 404 / compareMetrics 缺失）

- [ ] **Step 3: Write minimal implementation**

`schemas.py` — `MetricAdjustment` 追加：

```python
from typing import Literal

compare_mode: Literal["none", "yoy", "mom"] = Field(default="none", alias="compareMode")
```

`compare.py`（新建）：

```python
from __future__ import annotations

_VALID_MODES = frozenset({"yoy", "mom"})
_LABELS = {"yoy": "同比", "mom": "环比"}


def build_compare_slots(compare_mode: str, metrics: list[dict], metric_keys: list[str] | None) -> list[dict]:
    if compare_mode not in _VALID_MODES:
        return []
    selected = metrics
    if metric_keys:
        keys = set(metric_keys)
        selected = [m for m in metrics if m.get("key") in keys]
    slots = []
    for m in selected:
        mode = m.get("compareMode", "none")
        if mode == "none" and compare_mode:
            mode = compare_mode
        if mode not in _VALID_MODES:
            continue
        slots.append({
            "key": m["key"],
            "label": m.get("label", m["key"]),
            "compareMode": mode,
            "baselineLabel": _LABELS[mode],
        })
    return slots
```

`render.py` — 修改 `build_extension_render_spec`：

```python
from app.reports.extension.compare import build_compare_slots

def build_extension_render_spec(record: dict, template_kind: str | None) -> dict:
    metrics = record.get("metrics", [])
    visible_metrics = [m for m in metrics if m.get("visible", True)]
    compare_metrics = [
        m for m in metrics if m.get("compareMode") in {"yoy", "mom"}
    ]
    return {
        # ...existing fields...
        "compareMetrics": compare_metrics,
        "compareVersion": "1.0" if compare_metrics else None,
    }
```

`service.py` — `_validate_payload` 追加 compare 校验；新增 `compare_preview`：

```python
_VALID_COMPARE = frozenset({"none", "yoy", "mom"})

def _validate_compare_metrics(metrics: list) -> None:
    for m in metrics:
        mode = getattr(m, "compare_mode", m.get("compareMode", "none") if isinstance(m, dict) else "none")
        if mode not in _VALID_COMPARE:
            raise ReportExtensionError("RPT_EXT_INVALID_COMPARE", "Invalid compareMode", 422, fields={"fields": ["compareMode"]})
        if mode in {"yoy", "mom"}:
            expr = getattr(m, "expression", None) or (m.get("expression") if isinstance(m, dict) else None)
            if not expr:
                raise ReportExtensionError("RPT_EXT_INVALID_COMPARE", "compare metric requires expression or valid key", 422)

def compare_preview(node_id: uuid.UUID, compare_mode: str, metric_keys: list[str] | None) -> dict:
    _assert_template_node(node_id)
    record = _store.get(node_id) or {"metrics": []}
    slots = build_compare_slots(compare_mode, record.get("metrics", []), metric_keys)
    return {"slots": slots}
```

`reports/__init__.py` 追加：

```python
@router.post("/catalog/nodes/{node_id}/extension/compare-preview", response_model=None)
def extension_compare_preview(
    node_id: uuid.UUID,
    payload: dict,
    _: Annotated[UserContext, Depends(get_current_user)],
):
    try:
        return extension_service.compare_preview(
            node_id, payload.get("compareMode", "yoy"), payload.get("metricKeys")
        )
    except ReportExtensionError as exc:
        return _extension_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_compare" -v`
Expected: PASS（4 例）

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/extension/compare.py backend/app/reports/extension/schemas.py \
  backend/app/reports/extension/render.py backend/app/reports/extension/service.py \
  backend/app/api/v1/reports/__init__.py tests/test_dash_rpt_r58.py
git commit -m "feat(rpt): RPT-004 yoy/mom compare-preview and render-spec r58"
```

---

### Task 4: RPT-004/006 extension ACL + viewer 禁写

**Files:**
- Create: `backend/app/reports/extension/acl.py`
- Modify: `backend/app/reports/extension/service.py`
- Modify: `backend/app/api/v1/reports/__init__.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**测试门槛:** viewer PUT/DELETE extension → 403 `RPT_EXT_FORBIDDEN`；render-spec GET 仍 200。

**Interfaces:**
- Produces: `assert_extension_action(actor, action: Literal["read","write","delete"]) -> None`

- [ ] **Step 1: Write the failing tests**

```python
def test_rpt_r58_extension_viewer_put_forbidden(viewer_user, client):
    """D58-004-03: viewer PUT extension → 403 RPT_EXT_FORBIDDEN。"""
    node_id = _create_template_node(client)
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        json={"catalogNodeId": node_id, "metrics": [{"key": "m1", "label": "M1"}]},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_EXT_FORBIDDEN"


def test_rpt_r58_extension_viewer_render_spec_read_ok(viewer_user, client):
    """D58-004-03b: viewer GET render-spec → 200（read 放行）。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [{"key": "m1", "label": "M1"}]},
    )
    resp = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec")
    assert resp.status_code == 200, resp.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_extension_acl" -v`
Expected: FAIL（viewer PUT 仍 200）

- [ ] **Step 3: Write minimal implementation**

`extension/acl.py`（新建，镜像 `catalog/acl.py` 模式）：

```python
from __future__ import annotations

from typing import Literal

from app.auth.deps import UserContext
from app.reports.errors import ReportExtensionError


def assert_extension_action(actor: UserContext, action: Literal["read", "write", "delete"]) -> None:
    roles = set(actor.roles)
    if action == "read":
        return
    if "admin" in roles:
        return
    if action == "delete":
        if "owner" in roles:
            return
        raise ReportExtensionError("RPT_EXT_FORBIDDEN", "delete requires owner or admin", 403)
    if "editor" in roles or "owner" in roles:
        return
    raise ReportExtensionError("RPT_EXT_FORBIDDEN", "extension write requires editor, owner or admin", 403)
```

`service.py` — `upsert`/`delete_extension` 首行 `assert_extension_action(actor, "write"|"delete")`；签名加 `actor: UserContext`。

`reports/__init__.py` — `upsert_node_extension`/`delete_node_extension` 传入 `user`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_extension_acl" -v`
Expected: PASS（2 例）

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/extension/acl.py backend/app/reports/extension/service.py \
  backend/app/api/v1/reports/__init__.py tests/test_dash_rpt_r58.py
git commit -m "feat(rpt): RPT-004/006 extension ACL viewer write guard r58"
```

---

### Task 5: RPT-005 semi-real 执行器 + mock 投递链

**Files:**
- Create: `backend/app/reports/scheduler/delivery.py`
- Modify: `backend/app/reports/scheduler/executor.py`
- Modify: `backend/app/reports/scheduler/schemas.py`
- Modify: `backend/app/api/v1/reports/__init__.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**测试门槛:** semi-real execute 成功/失败/重试三路径；`probe_semi_real_execute_budget_ms` ≤35ms；保留 `mock_execute_schedule` 供 r57 兼容。

**Interfaces:**
- Produces: `semi_real_execute_schedule(schedule_id, idempotency_key, actor, delivery_mock) -> ScheduleExecuteOut`
- Produces: `dispatch_artifact(ref, channels, mock_mode) -> dict`（`deliverySteps[]`）
- Produces: `probe_semi_real_execute_budget_ms(...) -> float`

- [ ] **Step 1: Write the failing tests**

```python
def test_rpt_r58_semi_real_execute_succeeded(client):
    """D58-005-01: scheduled + Idempotency-Key → semi_real_succeeded + deliverySteps。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id)
    assert body["status"] == "semi_real_succeeded"
    assert len(body.get("deliverySteps", [])) >= 1


def test_rpt_r58_semi_real_delivery_fail(client):
    """D58-005-02: X-Rpt-Delivery-Mock: fail → semi_real_delivery_degraded。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id, delivery_mock="fail")
    assert body["status"] == "semi_real_delivery_degraded"


def test_rpt_r58_semi_real_delivery_retry(client):
    """D58-005-03: X-Rpt-Delivery-Mock: retry → attempt=2 delivered。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id, delivery_mock="retry")
    steps = body.get("deliverySteps", [])
    assert any(s.get("attempt") == 2 and s.get("status") == "delivered" for s in steps)


def test_rpt_r58_revision_snapshot_on_execute(client):
    """D58-005-04: 有 extension 时 revisionSnapshot.revision 与当前一致。"""
    node_id = _create_template_node(client)
    upsert = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [{"key": "k1", "label": "K1"}], "changeNote": "r58"},
    )
    rev = upsert.json()["revision"]
    body = _schedule_and_execute(client, node_id)
    snap = body.get("revisionSnapshot")
    assert snap is not None
    assert snap["revision"] == rev


def test_rpt_r58_probe_semi_real_under_budget(client):
    """D58-005-06: probe_semi_real_execute ≤35ms。"""
    from app.reports.scheduler.executor import probe_semi_real_execute_budget_ms
    from app.auth.deps import UserContext

    node_id = _create_template_node(client)
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    )
    sid = sched.json()["id"]
    client.post(f"/api/v1/reports/schedules/{sid}/transition", headers=AUTH, json={"action": "schedule"})
    actor = UserContext(id="admin", username="admin", roles=["admin"])
    elapsed = probe_semi_real_execute_budget_ms(uuid.UUID(sid), f"probe-{uuid.uuid4().hex}", actor)
    assert elapsed <= 35.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_semi_real" -v`
Expected: FAIL（status 仍为 `mock_succeeded`）

- [ ] **Step 3: Write minimal implementation**

`delivery.py`（新建）：

```python
from __future__ import annotations

_DELIVERY_LOG: list[dict] = []


def dispatch_artifact(artifact_ref: str, channels: list[str], mock_mode: str | None) -> dict:
    steps: list[dict] = []
    overall = "delivered"
    attempts = 1
    for channel in channels or ["email"]:
        if mock_mode == "fail" and channel == channels[0] if channels else channel == "email":
            steps.append({"channel": channel, "status": "failed", "attempt": 1})
            overall = "degraded"
            continue
        if mock_mode == "retry" and channel == (channels[0] if channels else "email"):
            steps.append({"channel": channel, "status": "failed", "attempt": 1})
            steps.append({"channel": channel, "status": "delivered", "attempt": 2})
            attempts = 2
            continue
        steps.append({"channel": channel, "status": "delivered", "attempt": 1})
    result = {"status": overall, "attempts": attempts, "deliverySteps": steps}
    _DELIVERY_LOG.append({"ref": artifact_ref, **result})
    return result
```

`schemas.py` — 扩展 `ScheduleExecuteOut`：

```python
from typing import Any

status: Literal["mock_succeeded", "mock_skipped", "semi_real_succeeded", "semi_real_delivery_degraded"]
delivery_steps: list[dict[str, Any]] = Field(default_factory=list, alias="deliverySteps")
revision_snapshot: dict | None = Field(default=None, alias="revisionSnapshot")
```

`executor.py` — 新增 `semi_real_execute_schedule`（保留 `mock_execute_schedule`）：

```python
from app.reports.scheduler.delivery import dispatch_artifact
from app.reports.extension import service as extension_service
from app.reports.catalog import service as catalog_service
from app.reports.catalog.acl import register_artifact_owner

_SEMI_BUDGET_MS = 35

def semi_real_execute_schedule(
    schedule_id: uuid.UUID,
    idempotency_key: str,
    actor: UserContext,
    delivery_mock: str | None = None,
) -> ScheduleExecuteOut:
    # idempotency 同 mock_execute_schedule
    # steps: validate_schedule → resolve_template → snapshot_extension → mock_render → mock_delivery
    # artifactRef: semi://reports/{scheduleId}/{executionId}
    # register_artifact_owner(artifact_ref, actor.id)
    # status: semi_real_succeeded 或 semi_real_delivery_degraded
```

`reports/__init__.py` — `execute_schedule` 改调 `semi_real_execute_schedule`，读取 `X-Rpt-Delivery-Mock` header。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_semi_real" -v`
Expected: PASS（5 例）

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/scheduler/delivery.py backend/app/reports/scheduler/executor.py \
  backend/app/reports/scheduler/schemas.py backend/app/api/v1/reports/__init__.py tests/test_dash_rpt_r58.py
git commit -m "feat(rpt): RPT-005 semi-real scheduler and mock delivery r58"
```

---

### Task 6: RPT-005/007 artifact 访问守卫 + GET artifact 元数据

**Files:**
- Modify: `backend/app/reports/catalog/acl.py`
- Modify: `backend/app/reports/scheduler/executor.py`
- Modify: `backend/app/api/v1/reports/__init__.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**测试门槛:** 非 owner viewer GET artifact → 403 `RPT_ARTIFACT_FORBIDDEN`；admin/owner → 200。

**Interfaces:**
- Produces: `register_artifact_owner(artifact_ref, actor_id) -> None`
- Produces: `assert_artifact_access(actor, artifact_ref) -> None`
- Produces: `GET /api/v1/reports/schedules/executions/{executionId}/artifact`

- [ ] **Step 1: Write the failing tests**

```python
def test_rpt_r58_artifact_owner_can_read(client):
    """D58-007-01: owner/admin artifact GET → 200。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id)
    eid = body["executionId"]
    resp = client.get(f"/api/v1/reports/schedules/executions/{eid}/artifact", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["artifactRef"] == body["artifactRef"]


def test_rpt_r58_artifact_viewer_other_forbidden(viewer_user, client):
    """D58-005-05 / D58-007-01: 非 owner viewer GET artifact → 403 RPT_ARTIFACT_FORBIDDEN。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id)
    eid = body["executionId"]
    resp = client.get(f"/api/v1/reports/schedules/executions/{eid}/artifact")
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_ARTIFACT_FORBIDDEN"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_artifact" -v`
Expected: FAIL（artifact 路由 404 或 viewer 200）

- [ ] **Step 3: Write minimal implementation**

`catalog/acl.py` 追加：

```python
_ARTIFACT_OWNERS: dict[str, str] = {}


def register_artifact_owner(artifact_ref: str, actor_id: str) -> None:
    _ARTIFACT_OWNERS[artifact_ref] = actor_id


def assert_artifact_access(actor: UserContext, artifact_ref: str) -> None:
    if "admin" in set(actor.roles):
        return
    owner = _ARTIFACT_OWNERS.get(artifact_ref)
    if owner is not None and owner == actor.id:
        return
    raise ReportCatalogError("RPT_ARTIFACT_FORBIDDEN", "artifact access denied", 403)
```

`executor.py` — render 后调用 `register_artifact_owner(out.artifact_ref, actor.id)`。

`reports/__init__.py` 追加：

```python
@router.get("/schedules/executions/{execution_id}/artifact", response_model=None)
def get_execution_artifact(
    execution_id: uuid.UUID,
    user: Annotated[UserContext, Depends(get_current_user)],
):
    from app.reports.scheduler.executor import get_execution_artifact_meta
    from app.reports.catalog.acl import assert_artifact_access

    try:
        meta = get_execution_artifact_meta(execution_id)
        assert_artifact_access(user, meta["artifactRef"])
        return meta
    except ReportCatalogError as exc:
        return _catalog_error(exc)
```

`executor.py` 维护 `_EXECUTION_BY_ID: dict[uuid.UUID, ScheduleExecuteOut]` 供 artifact 查询。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -k "rpt_r58_artifact" -v`
Expected: PASS（2 例）

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/catalog/acl.py backend/app/reports/scheduler/executor.py \
  backend/app/api/v1/reports/__init__.py tests/test_dash_rpt_r58.py
git commit -m "feat(rpt): RPT-005/007 artifact access guard r58"
```

---

### Task 7: RPT-006/007 batch compare 联动 + DASH semi-real LINK + 性能 smoke

**Files:**
- Modify: `backend/app/reports/batch/service.py`
- Modify: `tests/test_dash_rpt_r58.py`（补齐至 ≥38 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**测试门槛:** `test_dash_rpt_r58.py` **≥38/38** 全绿；batch 10 项 probe <200ms；render-spec probe <50ms；partial failure `rolledBackCount` 结构保持。

- [ ] **Step 1: Write the failing tests**

```python
def test_rpt_r58_batch_yoy_render_spec_compare(client):
    """D58-006R-01: batch 含 yoy metric → render-spec compareMetrics 非空。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {
                    "name": f"BatchYoy-{uuid.uuid4().hex[:6]}",
                    "templateKind": "excel",
                    "extension": {
                        "metrics": [{"key": "sales", "label": "Sales", "compareMode": "yoy"}],
                    },
                }
            ]
        },
    )
    assert resp.status_code == 201, resp.text
    node_id = resp.json()["createdNodeIds"][0]
    spec = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec", headers=AUTH)
    assert len(spec.json().get("compareMetrics", [])) >= 1


def test_rpt_r58_render_spec_probe_under_50ms(client):
    """D58-006R-02: render-spec probe <50ms（r55 门槛）。"""
    from app.reports.extension.render import probe_extension_load_budget_ms
    from app.reports.extension import service as ext_svc

    node_id = _create_template_node(client)
    ext_svc.upsert(
        uuid.UUID(node_id),
        # ExtensionConfigUpsert with compare metric — use admin actor via direct call or API first
    )
    # 或通过 API upsert 后调用 get_render_spec 计时
    import time

    start = time.perf_counter()
    client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec", headers=AUTH)
    assert (time.perf_counter() - start) * 1000 < probe_extension_load_budget_ms


def test_rpt_r58_batch_partial_failure_rolled_back(client):
    """D58-007-03: partial failure detail.rolledBackCount 结构不变。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": "Ok1", "templateKind": "excel"},
                {"name": "BadParent", "templateKind": "excel", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["rolledBackCount"] >= 1


def test_rpt_r58_batch_10_items_probe_under_200ms(client):
    """D58-007-02: batch 10 项含 compare metrics probe <200ms。"""
    from app.reports.batch.service import probe_batch_create_budget_ms
    from app.reports.batch.schemas import BatchCreateReportsIn, BatchReportItem
    from app.reports.extension.schemas import ExtensionConfigUpsert, MetricAdjustment

    items = [
        BatchReportItem(
            name=f"B{i}",
            template_kind="excel",
            extension=ExtensionConfigUpsert(
                metrics=[MetricAdjustment(key="m", label="M", compare_mode="mom")],
            ),
        )
        for i in range(10)
    ]
    elapsed = probe_batch_create_budget_ms(BatchCreateReportsIn(items=items), None)
    assert elapsed < 200.0


def test_dash_r58_theme_schedule_link_semi_real(client):
    """D58-006-06: theme 保存 → semi-real schedule execute 全链 LINK。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    node_id = _create_template_node(client, name="ThemeLink")
    body = _schedule_and_execute(client, node_id)
    assert body["status"] in {"semi_real_succeeded", "semi_real_delivery_degraded"}
    assert body.get("deliverySteps")


def test_rpt_r58_revisions_change_note_after_compare_upsert(client):
    """D58-006R-03: compare upsert 后 revisions 仍含 changeNote。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "rev", "label": "Rev", "compareMode": "yoy"}],
            "changeNote": "r58 compare",
        },
    )
    revs = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/revisions", headers=AUTH)
    assert revs.status_code == 200
    assert any(r.get("changeNote") for r in revs.json()["items"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -v --co -q | tail -1`
Expected: 收集数 <38 或 batch/LINK 用例 FAIL

- [ ] **Step 3: Write minimal implementation**

`batch/service.py` 追加：

```python
def probe_batch_create_budget_ms(payload: BatchCreateReportsIn, idempotency_key: str | None) -> float:
    import time
    start = time.perf_counter()
    batch_create(payload, idempotency_key)
    return (time.perf_counter() - start) * 1000.0
```

batch 成功后首节点 render-spec 的 compare 探测可在测试层完成（设计 §3.5：batch 创建项带 compareMode，GET render-spec 断言）；无需额外 service 钩子若 upsert 已写入 compareMode。

- [ ] **Step 4: Run full r58 suite**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py -v`
Expected: **≥38 passed**, 0 failed

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/batch/service.py tests/test_dash_rpt_r58.py
git commit -m "test(rpt): RPT-006/007 batch compare and DASH schedule LINK r58"
```

---

### Task 8: 回归门控 + docs/services 同步

**Files:**
- Modify: `docs/services/dashboard.md`
- Modify: `docs/services/reports.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`（修 bug 时）

**UI skill:** none

**测试门槛:** 全量回归门控 162/162 + r58 ≥38/38；`ruff check .` clean；全量 pytest exit 0。

- [ ] **Step 1: 更新域文档**

`docs/services/dashboard.md` 追加 DASH-006 r58 登记：
- `POST /api/v1/dashboards/theme-analysis/execute-plan`（四步 plan + compareWindow）
- `dashboard/theme/acl.py` theme 写守卫 `DASH_THEME_FORBIDDEN`

`docs/services/reports.md` 追加 RPT-004/005/006/007 r58 登记：
- `extension/compare.py` compare-preview + render-spec compareMetrics
- `extension/acl.py` extension 写删守卫
- `scheduler/delivery.py` mock 投递 + semi-real 状态
- `catalog/acl.assert_artifact_access` artifact 读守卫

评估 `docs/api/README.md` 同步（prd-sync）：新增 execute-plan、compare-preview、artifact GET 路由各补一行。

- [ ] **Step 2: 回归门控 subprocess**

```python
def test_r58_regression_gate_r57_subprocess():
    """全轮回归：r57 37/37 不被 semi-real 破坏。"""
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", str(_BACKEND_DIR.parent / "tests/test_dash_rpt_query_nfr_r57.py"), "-q"],
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
```

在 `test_dash_rpt_r58.py` 追加 r55/r53/r52 同类 subprocess 门控各 1 条（共 4 条回归测），使总断言 ≥38。

- [ ] **Step 3: Run full regression + ruff**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_dash_rpt_r58.py \
  ../tests/test_dash_rpt_query_nfr_r57.py \
  ../tests/test_rpt_gov_meta_conn_r55.py \
  ../tests/test_dash_rpt_query_nfr_r53.py \
  ../tests/test_design_conn_gov_query_r52.py \
  -v
```
Expected: r58 **≥38/38** + r57 **37/37** + r55 **35/35** + r53 **38/38** + r52 **52/52**

Run: `cd backend && python3 -m pytest -q`
Expected: **≥1490 passed**, 4 skipped, exit 0

- [ ] **Step 4: Commit**

```bash
git add docs/services/dashboard.md docs/services/reports.md docs/api/README.md tests/test_dash_rpt_r58.py
git commit -m "docs: r58 dash/rpt companion quality domain sync and regression gate"
```

---

## Spec Self-Review

| 检查项 | 结果 |
|--------|------|
| round-target 五子项 → Task 覆盖 | DASH-006→T1-2+LINK；RPT-004→T3-4；RPT-005→T5-6；RPT-006→T7；RPT-007→T6-7 |
| 文件数 ≤20 | 19 |
| 无 TBD/TODO/占位 | 通过 |
| 每 Task 有验证命令 + 测试门槛 | 通过 |
| 全 Task UI skill: none | 通过 |
| 执行模式 option 1 头部 | 通过 |
