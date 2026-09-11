# M5 VIEW-001 + M6 companion 质量推分 r31 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/views/`、`backend/app/governance/`、`backend/app/openapi/`、`backend/app/api/v1/views.py`、`backend/app/api/v1/gov.py`、`backend/app/api/v1/datasources.py`、`backend/app/api/v1/query.py`、`tests/test_view_gov_api_r31.py`、`docs/services/views.md`、`docs/services/governance.md`、`docs/api/README.md`
> **子项：** VIEW-001, GOV-002, GOV-001, API-001, API-002
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 闭合 r30 L1 遗留边界 — VIEW validate bounds/cycle、GOV bus 失败/幂等/鉴权、catalog 非法过滤 4xx + DELETE 解绑、IF-06 OpenAPI CRUD/execute 示例补全；`test_view_gov_api_r31.py` ≥18 条 + r30 回归全绿。

**Architecture:** 在 r30 骨架上增量加固：`views/validate.py` 增 bounds 映射与 chartRef 环检测；`governance/bus/poc.py` 扩展 force-timeout/4xx/5xx；`catalog/service.py` 幂等登记 + 非法 category 400 + `delete_entry`；`openapi/extensions.py` 集中注入 datasources/gov/views IF-06 示例；entry 层 `gov.py` 增 admin 守卫与 traceId 错误体。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pytest · ruff

## Global Constraints

- 纯后端质量推分；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 migration
- 不含 `fe/`、VIEW-002/003、GOV-003~008、真实总线 HTTP、Admin 治理 UI
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": {...}|null}`；GOV 失败时 `detail.traceId` 存在
- API 前缀 `/api/v1/`；治理路由 prefix `/gov`
- traceId 取自 `trace_id_var.get()`（`app.core.logging`），失败响应写入 `detail.traceId`
- 文件预算：新建 **1** + 修改 **14** = **15**（`dashboard/service.py` 只读回归，不计修改）
- 验证基线：r30 `pytest` **662 passed** + 4 skipped；本轮目标 **≥680 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: VIEW-001 — validate bounds 映射 + chartRef 环检测

**Files:**
- Modify: `backend/app/views/validate.py`
- Modify: `backend/app/views/schemas.py`（错误码文档注释）
- Create: `tests/test_view_gov_api_r31.py`（VIEW 段 6 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `DashboardLayout`, `DashboardView`, `ViewError`, `dashboard.service.DashboardError`
- Produces: `validate_dashboard_view` 抛出 `VIEW_LAYOUT_BOUNDS` / `VIEW_CHART_REF_CYCLE`；合法空 widgets 仍 200

- [ ] **Step 1: 写失败测试（VIEW 边界 6 条）**

在 `tests/test_view_gov_api_r31.py` 写入 fixture 与 VIEW 段（复用 r30 `_R30_SQLITE_URL` 模式，module autouse fixture 同名 `r31_sqlite_env`）：

```python
"""M5 VIEW-001 + M6 companion 质量推分 r31 — VIEW-001/GOV-002/GOV-001/API-001/API-002."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view

_R31_SQLITE_URL = "sqlite+pysqlite:///file:view_gov_r31?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


def _valid_layout(widget_id: str | None = None) -> dict:
    wid = widget_id or str(uuid.uuid4())
    return {
        "version": 1,
        "widgets": [
            {
                "id": wid,
                "type": "chart",
                "title": "KPI",
                "colSpan": 12,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": "SELECT 1",
                },
            }
        ],
        "globalFilters": [],
    }


def test_view_empty_widgets_allowed_r31():
    """T-VIEW-R31-001-01: layout.widgets=[] → 200 且 widgets==[]。"""
    view = validate_dashboard_view(
        {"name": "Empty", "layout": {"version": 1, "widgets": [], "globalFilters": []}}
    )
    assert view.layout.widgets == []


def test_view_colspan_bounds_r31():
    """T-VIEW-R31-001-02: colSpan=5 → VIEW_LAYOUT_BOUNDS + detail.fields 含 colSpan。"""
    layout = _valid_layout()
    layout["widgets"][0]["colSpan"] = 5
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Bounds", "layout": layout})
    assert exc.value.code == "VIEW_LAYOUT_BOUNDS"
    assert any("colSpan" in f.get("field", "") for f in exc.value.fields)


def test_view_chart_ref_cycle_r31():
    """T-VIEW-R31-001-03: A→B→A chartRef → VIEW_CHART_REF_CYCLE。"""
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {"id": id_a, "type": "chart", "title": "A", "colSpan": 12, "order": 0, "chartRef": id_b},
            {"id": id_b, "type": "chart", "title": "B", "colSpan": 12, "order": 1, "chartRef": id_a},
        ],
        "globalFilters": [],
    }
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Cycle", "layout": layout})
    assert exc.value.code == "VIEW_CHART_REF_CYCLE"


@pytest.fixture(scope="module", autouse=True)
def r31_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R31_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    from app.datasources.models import get_meta_session
    from sqlalchemy import text

    session = get_meta_session()
    try:
        yield session
        session.rollback()
        session.execute(text("DELETE FROM dashboards"))
        session.commit()
    finally:
        session.close()


def test_views_validate_api_bounds_body_r31(client):
    """T-VIEW-R31-001-04: POST /views/validate colSpan 越界 → 422 code + detail.fields。"""
    layout = _valid_layout()
    layout["widgets"][0]["colSpan"] = 5
    resp = client.post("/api/v1/views/validate", headers=AUTH, json={"name": "Bad", "layout": layout})
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "VIEW_LAYOUT_BOUNDS"
    assert body["detail"] is not None
    assert isinstance(body["detail"]["fields"], list)


def test_dashboard_layout_put_regression_r31(client, db_session):
    """T-VIEW-R31-001-05: PUT layout 合法 200；重复 widget → DASH_DUPLICATE_WIDGET。"""
    from app.dashboard.service import create_dashboard, update_layout

    dash = create_dashboard(db_session, name="R31 Dash")
    layout = _valid_layout()
    out = update_layout(db_session, dash.id, layout)
    assert out.layout_json["widgets"]
    dup = layout.copy()
    dup["widgets"] = [layout["widgets"][0], layout["widgets"][0]]
    resp = client.put(
        f"/api/v1/dashboards/{dash.id}/layout",
        headers=AUTH,
        json={"layoutJson": dup},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_DUPLICATE_WIDGET"


def test_view_unknown_chart_ref_regression_r31():
    """T-VIEW-R31-001-06: 未知 chartId → VIEW_UNKNOWN_CHART_REF（r30 回归）。"""
    other = str(uuid.uuid4())
    layout = _valid_layout()
    layout["widgets"][0]["chartConfig"]["chartId"] = other
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Ref", "layout": layout})
    assert exc.value.code == "VIEW_UNKNOWN_CHART_REF"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_view_empty_widgets_allowed_r31 or test_view_colspan or test_view_chart_ref_cycle or test_views_validate_api_bounds or test_dashboard_layout_put_regression_r31 or test_view_unknown_chart_ref_regression" -v`
Expected: FAIL — `VIEW_LAYOUT_BOUNDS` / `VIEW_CHART_REF_CYCLE` 未实现或断言失败

- [ ] **Step 3: 修改 `backend/app/views/schemas.py` 增错误码注释**

在 `ViewError` 类 docstring 或模块顶部追加：

```python
# Error codes: VIEW_INVALID_LAYOUT, VIEW_LAYOUT_BOUNDS, VIEW_UNKNOWN_CHART_REF,
# VIEW_CHART_REF_CYCLE, VIEW_DEFAULT_SELF_REF
```

- [ ] **Step 4: 修改 `backend/app/views/validate.py`**

在现有文件追加/替换以下逻辑：

```python
def _map_validation_error(exc: ValidationError) -> ViewError:
    fields = [
        {"field": ".".join(str(p) for p in err.get("loc", ())), "message": str(err.get("msg", ""))}
        for err in exc.errors()
    ]
    bounds_tokens = ("colSpan", "rowSpan", "widgets")
    if any(any(t in f["field"] for t in bounds_tokens) for f in fields):
        return ViewError("VIEW_LAYOUT_BOUNDS", "Layout bounds violation", 422, fields)
    return ViewError("VIEW_INVALID_LAYOUT", "Invalid dashboard view", 422, fields)


def _check_chart_ref_cycle(raw_widgets: list[dict[str, Any]]) -> None:
    by_id = {str(w["id"]): w for w in raw_widgets if w.get("id")}
    for i, widget in enumerate(raw_widgets):
        visited: set[str] = set()
        current: str | None = str(widget.get("id", ""))
        while current:
            if current in visited:
                raise ViewError(
                    "VIEW_CHART_REF_CYCLE",
                    "Circular chart reference",
                    422,
                    [{"field": f"widgets[{i}].chartRef", "message": "Circular chart reference"}],
                )
            visited.add(current)
            node = by_id.get(current)
            if node is None:
                break
            chart_ref = node.get("chartRef")
            if chart_ref is not None:
                current = str(chart_ref)
                continue
            cfg = node.get("chartConfig") or {}
            cid = cfg.get("chartId")
            wid = node.get("id")
            if cid is not None and str(cid) != str(wid):
                current = str(cid)
            else:
                break
```

在 `validate_dashboard_view` 中：
1. `except ValidationError` 改为 `raise _map_validation_error(exc) from exc`
2. 在 `_check_chart_refs(...)` 之后调用 `_check_chart_ref_cycle(raw_widgets_list)`

- [ ] **Step 5: 运行 VIEW 测试通过**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_view_" -v`
Expected: 6 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/views/validate.py backend/app/views/schemas.py tests/test_view_gov_api_r31.py
git commit -m "feat(views): VIEW-001 bounds mapping and chartRef cycle detection r31"
```

---

### Task 2: GOV-002 — 总线失败路径 + 幂等 + admin 鉴权

**Files:**
- Modify: `backend/app/governance/bus/poc.py`
- Modify: `backend/app/governance/catalog/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_view_gov_api_r31.py`（GOV-002 段 5 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `BusPoCAdapter`, `CatalogError`, `trace_id_var`, `UserContext.roles`
- Produces: `register_entry_to_bus(...) -> tuple[BusRegisterOut, bool]`（bool=created）；新错误码 `BUS_REGISTRATION_TIMEOUT|CLIENT_ERROR|SERVER_ERROR`；`BUS_REGISTER_FORBIDDEN`

- [ ] **Step 1: 写失败测试（GOV-002 5 条）**

追加到 `tests/test_view_gov_api_r31.py`：

```python
from app.auth.deps import UserContext, get_current_user


def _create_entry(client, *, path: str, status: str = "active") -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Reg",
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_bus_register_timeout_r31(client):
    """T-GOV-R31-002-01: force-timeout → 504 BUS_REGISTRATION_TIMEOUT + detail.traceId。"""
    eid = _create_entry(client, path="/api/v1/force-timeout/demo")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 504
    body = resp.json()
    assert body["code"] == "BUS_REGISTRATION_TIMEOUT"
    assert body["detail"] is not None
    assert body["detail"]["traceId"]


def test_bus_register_4xx_5xx_r31(client):
    """T-GOV-R31-002-02: force-4xx → 400；force-5xx → 502。"""
    e4 = _create_entry(client, path="/api/v1/force-4xx/demo")
    r4 = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": e4})
    assert r4.status_code == 400
    assert r4.json()["code"] == "BUS_REGISTRATION_CLIENT_ERROR"
    e5 = _create_entry(client, path="/api/v1/force-5xx/demo")
    r5 = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": e5})
    assert r5.status_code == 502
    assert r5.json()["code"] == "BUS_REGISTRATION_SERVER_ERROR"


def test_bus_register_idempotent_r31(client):
    """T-GOV-R31-002-03: 同一 entry 连续登记 → 201 后 200 同 id。"""
    eid = _create_entry(client, path="/api/v1/query/execute-r31")
    first = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert first.status_code == 201
    second = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]


def test_bus_register_forbidden_non_admin_r31(client):
    """T-GOV-R31-002-04: 非 admin → 403 BUS_REGISTER_FORBIDDEN。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        eid = _create_entry(client, path="/api/v1/query/exec-forbidden")
        resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_bus_register_failure_no_succeeded_row_r31(client, db_session):
    """T-GOV-R31-002-05: force-fail 不插入 succeeded 行。"""
    from sqlalchemy import select
    from app.governance.catalog.models import BusRegistration

    eid = _create_entry(client, path="/api/v1/force-fail/r31")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 502
    rows = db_session.scalars(
        select(BusRegistration).where(BusRegistration.catalog_entry_id == uuid.UUID(eid))
    ).all()
    assert all(r.status != "succeeded" for r in rows)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_bus_register" -v`
Expected: FAIL — 新分支/幂等/403 未实现

- [ ] **Step 3: 扩展 `backend/app/governance/bus/poc.py`**

在 `InMemoryBusPoCAdapter.register` 的 `force-fail` 分支后追加：

```python
        if "force-timeout" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_TIMEOUT",
                error_message="Bus registration timed out",
            )
        if "force-4xx" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_CLIENT_ERROR",
                error_message="Bus client error",
            )
        if "force-5xx" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_SERVER_ERROR",
                error_message="Bus server error",
            )
```

- [ ] **Step 4: 加固 `backend/app/governance/catalog/service.py`**

1. `CatalogError` 增 `trace_id: str | None = None` 可选字段
2. `register_entry_to_bus` 签名改为返回 `tuple[BusRegisterOut, bool]`：

```python
def register_entry_to_bus(
    db: Session,
    entry_id: uuid.UUID,
    *,
    adapter: BusPoCAdapter | None = None,
) -> tuple[BusRegisterOut, bool]:
    # ... get_entry, draft check ...
    trace_id = trace_id_var.get() or uuid.uuid4().hex
    existing = db.scalar(
        select(BusRegistration).where(
            BusRegistration.catalog_entry_id == entry_id,
            BusRegistration.status == "succeeded",
        )
    )
    if existing is not None:
        return (
            BusRegisterOut(
                id=existing.id,
                status=existing.status,
                trace_id=existing.trace_id,
                bus_response=existing.bus_payload,
            ),
            False,
        )
    result = bus.register(entry=entry, trace_id=trace_id)
    if result.status == "failed":
        code = result.error_code or "BUS_REGISTRATION_FAILED"
        status_map = {
            "BUS_REGISTRATION_REJECTED": 502,
            "BUS_REGISTRATION_SERVER_ERROR": 502,
            "BUS_REGISTRATION_TIMEOUT": 504,
            "BUS_REGISTRATION_CLIENT_ERROR": 400,
            "BUS_ENTRY_NOT_PUBLISHABLE": 400,
        }
        status = status_map.get(code, 400)
        err = CatalogError(code, result.error_message or "Bus registration failed", status)
        err.trace_id = trace_id
        raise err
    # insert + return (out, True)
```

- [ ] **Step 5: 修改 `backend/app/api/v1/gov.py`**

```python
def _catalog_error_response(exc: catalog_service.CatalogError) -> JSONResponse:
    detail = None
    if getattr(exc, "trace_id", None):
        detail = {"traceId": exc.trace_id}
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _assert_bus_register_admin(actor: UserContext) -> None:
    if "admin" not in actor.roles:
        raise catalog_service.CatalogError(
            "BUS_REGISTER_FORBIDDEN", "Bus registration requires admin role", 403
        )


@router.post("/bus/register", response_model=BusRegisterOut)
def register_bus(
    payload: BusRegisterIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> BusRegisterOut | JSONResponse:
    try:
        _assert_bus_register_admin(actor)
        out, created = catalog_service.register_entry_to_bus(db, payload.catalog_entry_id)
        return JSONResponse(
            status_code=201 if created else 200,
            content=out.model_dump(by_alias=True, mode="json"),
        )
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)
```

- [ ] **Step 6: 运行 GOV-002 测试 + r30 bus 回归**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_bus_register" tests/test_view_gov_api_r30.py -k "test_bus_register" -v`
Expected: 全部 passed

- [ ] **Step 7: Commit**

```bash
git add backend/app/governance/bus/poc.py backend/app/governance/catalog/service.py backend/app/api/v1/gov.py tests/test_view_gov_api_r31.py
git commit -m "feat(gov): GOV-002 bus failure paths, idempotent register, admin guard r31"
```

---

### Task 3: GOV-001 — catalog 非法过滤 400 + DELETE 解绑

**Files:**
- Modify: `backend/app/governance/catalog/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_view_gov_api_r31.py`（GOV-001 段 5 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `list_entries` 非法 category → `CATALOG_INVALID_CATEGORY` 400；`delete_entry(db, entry_id) -> None`；`DELETE /catalog/entries/{entry_id}` → 204/404

- [ ] **Step 1: 写失败测试（GOV-001 5 条）**

```python
def test_gov_list_entries_invalid_category_r31(client):
    """T-GOV-R31-001-01: ?category=CAT-99 → 400 CATALOG_INVALID_CATEGORY。"""
    resp = client.get("/api/v1/gov/catalog/entries?category=CAT-99", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "CATALOG_INVALID_CATEGORY"


def test_gov_list_entries_pagination_r31(client):
    """T-GOV-R31-001-02: limit=1 offset=0 分页字段一致。"""
    for i in range(2):
        client.post(
            "/api/v1/gov/catalog/entries",
            headers=AUTH,
            json={
                "name": f"P{i}",
                "httpMethod": "GET",
                "path": f"/api/v1/p/{i}",
                "categoryCodes": ["CAT-01"],
                "status": "active",
            },
        )
    resp = client.get("/api/v1/gov/catalog/entries?limit=1&offset=0", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["limit"] == 1
    assert body["offset"] == 0
    assert body["total"] >= 2
    assert len(body["items"]) == 1


def test_gov_categories_kind_enum_r31(client):
    """T-GOV-R31-001-03: 三分法 kind 分别为 entity/aggregate/geo。"""
    resp = client.get("/api/v1/gov/catalog/categories", headers=AUTH)
    kinds = {item["kind"] for item in resp.json()["items"]}
    assert kinds == {"entity", "aggregate", "geo"}


def test_gov_delete_entry_r31(client):
    """T-GOV-R31-001-04: 创建 → DELETE 204 → GET 404。"""
    eid = _create_entry(client, path="/api/v1/to-delete")
    del_resp = client.delete(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    assert del_resp.status_code == 204
    get_resp = client.get(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    assert get_resp.status_code == 404


def test_gov_delete_then_bus_register_404_r31(client):
    """T-GOV-R31-001-05: 删除后 bus/register → 404。"""
    eid = _create_entry(client, path="/api/v1/deleted-bus")
    client.delete(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 404
    assert resp.json()["code"] == "CATALOG_ENTRY_NOT_FOUND"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_gov_list_entries_invalid or test_gov_list_entries_pagination or test_gov_categories_kind or test_gov_delete" -v`
Expected: FAIL

- [ ] **Step 3: 修改 `list_entries` 与新增 `delete_entry`**

在 `backend/app/governance/catalog/service.py`：

```python
def list_entries(...):
    _ensure_seed_categories(db)
    if category is not None and category not in VALID_CATEGORY_CODES:
        raise CatalogError("CATALOG_INVALID_CATEGORY", f"Unknown category: {category}", 400)
    # 保持现有过滤逻辑 ...


def delete_entry(db: Session, entry_id: uuid.UUID) -> None:
    row = db.scalar(select(CatalogEntry).where(CatalogEntry.id == entry_id))
    if row is None:
        raise CatalogError("CATALOG_ENTRY_NOT_FOUND", "Catalog entry not found", 404)
    db.delete(row)
    db.commit()
```

- [ ] **Step 4: 新增 DELETE 路由**

在 `backend/app/api/v1/gov.py`：

```python
@router.delete("/catalog/entries/{entry_id}", status_code=204)
def delete_catalog_entry(
    entry_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None | JSONResponse:
    try:
        catalog_service.delete_entry(db, entry_id)
        return None
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)
```

`list_catalog_entries` 路由包 try/except 返回 `_catalog_error_response`。

- [ ] **Step 5: 运行 GOV-001 测试 + r30 gov 回归**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_gov_" tests/test_view_gov_api_r30.py -k "test_gov_" -v`
Expected: 全部 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/governance/catalog/service.py backend/app/api/v1/gov.py tests/test_view_gov_api_r31.py
git commit -m "feat(gov): GOV-001 invalid category 400 and catalog entry DELETE r31"
```

---

### Task 4: API-001 — IF-06 datasources OpenAPI 示例补全

**Files:**
- Modify: `backend/app/openapi/extensions.py`
- Modify: `tests/test_view_gov_api_r31.py`（API-001 段 4 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: OpenAPI datasources 路径含 `data_source_id` parameter example；GET/POST responses 含 `application/json` example

- [ ] **Step 1: 写失败测试**

```python
def test_openapi_datasource_path_param_example_r31(client):
    """T-API-R31-001-01: GET /datasources/{id} path 参数含 example。"""
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/api/v1/datasources/{data_source_id}"]["get"]
    params = op.get("parameters", [])
    assert params
    assert params[0].get("example") or params[0].get("schema", {}).get("example")


def test_openapi_datasource_response_examples_r31(client):
    """T-API-R31-001-02: datasources POST/GET responses 含 json example。"""
    spec = client.get("/openapi.json").json()
    post = spec["paths"]["/api/v1/datasources"]["post"]
    post_resp = post["responses"]["201"]["content"]["application/json"]
    assert "example" in post_resp or "examples" in post_resp
    get_list = spec["paths"]["/api/v1/datasources"]["get"]
    get_resp = get_list["responses"]["200"]["content"]["application/json"]
    assert "example" in get_resp or "examples" in get_resp


def test_datasources_unauthorized_r31(client):
    """T-API-R31-001-03: GET /datasources 无 Authorization → 401。"""
    resp = client.get("/api/v1/datasources")
    assert resp.status_code == 401


def test_datasources_list_smoke_regression_r31(client):
    """T-API-R31-001-04: GET /datasources Bearer dev → 200（r30 回归）。"""
    resp = client.get("/api/v1/datasources", headers=AUTH)
    assert resp.status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_openapi_datasource or test_datasources_" -v`
Expected: FAIL — example 缺失

- [ ] **Step 3: 扩展 `backend/app/openapi/extensions.py`**

在 `customize_openapi` 循环后追加 datasources 后处理函数：

```python
_DS_ID_EXAMPLE = "00000000-0000-4000-8000-000000000001"
_DS_OUT_EXAMPLE = {
    "id": _DS_ID_EXAMPLE,
    "name": "Orders Warehouse",
    "code": "orders-wh",
    "type": "postgresql",
    "host": "db.internal",
    "port": 5432,
    "database": "analytics",
    "createdAt": "2026-07-04T00:00:00Z",
}

def _inject_datasource_openapi(schema: dict) -> None:
    paths = schema.get("paths", {})
    coll = paths.get("/api/v1/datasources", {})
    if "post" in coll:
        resp = coll["post"].setdefault("responses", {}).setdefault("201", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _DS_OUT_EXAMPLE
    if "get" in coll:
        resp = coll["get"].setdefault("responses", {}).setdefault("200", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = {"items": [_DS_OUT_EXAMPLE], "total": 1}
    detail = paths.get("/api/v1/datasources/{data_source_id}", {})
    for verb in detail.values():
        for param in verb.get("parameters", []):
            if param.get("name") == "data_source_id":
                param["example"] = _DS_ID_EXAMPLE
        if verb.get("responses", {}).get("200"):
            content = verb["responses"]["200"].setdefault("content", {}).setdefault("application/json", {})
            content["example"] = _DS_OUT_EXAMPLE
```

在 `customize_openapi` return 前调用 `_inject_datasource_openapi(schema)`；对 `/api/v1/gov` 与 `/api/v1/views` 路径追加 `IF-06` tag（若 operation 存在）。

- [ ] **Step 4: 运行 API-001 测试**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_openapi_datasource or test_datasources_" -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/openapi/extensions.py tests/test_view_gov_api_r31.py
git commit -m "feat(openapi): API-001 IF-06 datasources path/response examples r31"
```

---

### Task 5: API-002 — IF-06 execute OpenAPI + 边界测试

**Files:**
- Modify: `backend/app/openapi/extensions.py`
- Modify: `tests/test_view_gov_api_r31.py`（API-002 段 5 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: execute 200/400/403 response examples；多语句拒绝 `QUERY_NOT_READONLY`

- [ ] **Step 1: 写失败测试**

```python
def test_execute_unauthorized_r31(client):
    """T-API-R31-002-01: POST /execute 无 auth → 401。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "SELECT 1"},
    )
    assert resp.status_code == 401


def test_execute_multi_statement_rejected_r31(client):
    """T-API-R31-002-03: SELECT 1; DELETE → 400 QUERY_NOT_READONLY。"""
    ds_id = _create_test_datasource(client)
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": ds_id, "mode": "sql", "sql": "SELECT 1; DELETE FROM t"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_openapi_execute_response_example_r31(client):
    """T-API-R31-002-04: execute 200 response example 含 traceId。"""
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/api/v1/query/execute"]["post"]
    example = op["responses"]["200"]["content"]["application/json"].get("example", {})
    assert "traceId" in example


def _create_test_datasource(client) -> str:
    resp = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": "R31 DS",
            "code": f"r31-{uuid.uuid4().hex[:6]}",
            "type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "test",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]
```

补充 `test_execute_forbidden_hidden_datasource_r31`（T-API-R31-002-02）：创建 hidden datasource + viewer role grant 仅 visible，用 `app.dependency_overrides` 或 r27 `_set_dev_roles` 模式断言 403 `RESOURCE_FORBIDDEN`（若项目已有 visibility fixture 则复用 `tests/test_query_quality_r27.py` 的 `query_seed`/`viewer_headers` fixture import）。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_execute_ or test_openapi_execute" -v`
Expected: FAIL

- [ ] **Step 3: 扩展 `backend/app/openapi/extensions.py` execute 段**

```python
_EXECUTE_200_EXAMPLE = {
    "columns": ["value"],
    "rows": [[1]],
    "rowCount": 1,
    "truncated": False,
    "traceId": "abc123trace",
}

def _inject_execute_openapi(schema: dict) -> None:
    op = schema.get("paths", {}).get("/api/v1/query/execute", {}).get("post")
    if not op:
        return
    op["responses"]["200"]["content"]["application/json"]["example"] = _EXECUTE_200_EXAMPLE
    for code, err_code in (("400", "QUERY_NOT_READONLY"), ("403", "RESOURCE_FORBIDDEN")):
        resp = op.setdefault("responses", {}).setdefault(code, {"description": err_code})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = {"code": err_code, "message": err_code, "detail": None}
```

在 `customize_openapi` 调用 `_inject_execute_openapi(schema)`。

- [ ] **Step 4: 运行 API-002 测试 + r27 RLS smoke 标记回归**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -k "test_execute_ or test_openapi_execute" tests/test_query_quality_r27.py -k "rls" -v --tb=short`
Expected: passed（r27 不重复实现，仅回归）

- [ ] **Step 5: Commit**

```bash
git add backend/app/openapi/extensions.py tests/test_view_gov_api_r31.py
git commit -m "feat(openapi): API-002 IF-06 execute response examples and boundary tests r31"
```

---

### Task 6: 集成验证 + r30 全量回归

**Files:**
- Test: `tests/test_view_gov_api_r31.py`（清点 ≥18 条）
- Test: `tests/test_view_gov_api_r30.py`（只读回归）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 清点 r31 用例数**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py --collect-only -q | tail -1`
Expected: ≥18 tests collected

- [ ] **Step 2: r31 全绿**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r31.py -v`
Expected: ≥18 passed

- [ ] **Step 3: r30 回归全绿**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -v`
Expected: 30 passed

- [ ] **Step 4: 全量验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v`
Expected: ruff clean；≥680 passed, 4 skipped

- [ ] **Step 5: Commit（若有遗漏修复）**

```bash
git add -A
git commit -m "test: r31 integration verification and r30 regression green"
```

---

### Task 7: 文档同步（prd-sync）

**Files:**
- Modify: `docs/services/views.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（触及 `docs/services/` 与 `docs/api/`）

**UI skill:** none

- [ ] **Step 1: 更新 `docs/services/views.md`**

在错误码表追加：
- `VIEW_LAYOUT_BOUNDS` — colSpan/rowSpan/widgets 越界
- `VIEW_CHART_REF_CYCLE` — chartRef/chartId 循环引用

- [ ] **Step 2: 更新 `docs/services/governance.md`**

追加：
- `list_entries` 非法 `category` → 400 `CATALOG_INVALID_CATEGORY`
- `DELETE /gov/catalog/entries/{id}` → 204，CASCADE bus_registrations
- `POST /gov/bus/register` 需 admin；幂等二次 200；失败码 `BUS_REGISTRATION_TIMEOUT|CLIENT_ERROR|SERVER_ERROR`；`detail.traceId`

- [ ] **Step 3: 更新 `docs/api/README.md`**

登记：
- `DELETE /api/v1/gov/catalog/entries/{entry_id}` — 204
- `POST /api/v1/gov/bus/register` — 403 `BUS_REGISTER_FORBIDDEN`；幂等 200/201 说明
- IF-06 OpenAPI datasources/execute 示例补全注记

- [ ] **Step 4: 验证文档无占位符**

Run: `rg -n "TBD|TODO|适当" docs/services/views.md docs/services/governance.md docs/api/README.md || true`
Expected: 无匹配

- [ ] **Step 5: Commit**

```bash
git add docs/services/views.md docs/services/governance.md docs/api/README.md
git commit -m "docs: sync views/governance/api for r31 quality push"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| round-target 5 子项 → Task 1–5 + 验证/文档 | 通过 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 含 Files、Skills、UI skill: none、验证命令 | 通过 |
| 预估文件 15 + 3 docs ≤ 20 | 通过 |
| r30 回归显式 Task 6 | 通过 |
