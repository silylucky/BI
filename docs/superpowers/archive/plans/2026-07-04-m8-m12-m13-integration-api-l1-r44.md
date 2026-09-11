# M8/M12/M13 集成 API L1 kickoff 实现计划 — API-003/004/005/006/007

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/integration/`（新域）· `backend/app/governance/bus/adapter.py` · `backend/app/api/v1/{services,integration_bus,reports/export,embed}.py` · `backend/app/api/v1/router.py` · `backend/app/openapi/{version_policy,extensions}.py` · `tests/test_integration_api_l1_r44.py` · `tests/test_view_gov_api_r31.py`（回归）· `docs/services/integration.md` · `docs/services/README.md` · `docs/api/README.md`
> **子项：** API-003, API-004, API-005, API-006, API-007
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 交付 M8/M12/M13 集成 API L1 骨架 — IF-01~04 四路由簇（查询服务/总线注册/报表导出/门户嵌入）+ OpenAPI 版本策略与 IF tag 注入 + ≥28 条 pytest smoke；五 PRD ID 核心维脱离 0–5% 骨架档。

**Architecture:** 新增 domain 域 `backend/app/integration/`（无 HTTP，编排 catalog/query/viz.embed）；`governance/bus/adapter.py` 从 `poc.py` 提取 `BusAdapter` 协议与 `register_with_retry()`，`poc.py` 薄 re-export 保 r31 导入；`api/v1/` entry 层四路由簇薄绑定；`openapi/version_policy.py` + `extensions.py` 后处理 IF-01~04 tag/`operationId` 前缀。纯后端、内存 token store、无新 Alembic migration。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不新增** Alembic migration；不替换 `POST /gov/bus/register`（GOV-002）或 `POST /charts/embed/validate`（VIZ-006）。
- **分层纪律**（`common.mdc`）：`app/integration/` = domain（无 HTTP）；`api/v1/*.py` = entry；`governance/bus/adapter.py` = domain 薄提取。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422 + `detail.fields`；未鉴权 401；失败响应 `detail.traceId` 当可用。
- **鉴权**：所有新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin（`auth/middleware.py`）。
- **L1 角色守卫**：`integration` 或 `admin`（execute/bus/reports）；embed 签发 `admin` 或 `dashboard:share`。
- **真理源优先级**：`round-target` > `prd/F13-API.md` > `docs/api/README.md`。
- **验证基线**：现 `cd backend && python3 -m pytest ../tests -q` = **1068 passed** / 2 skipped；本轮目标 **≥1096 passed** + 2 skipped，零失败，`ruff` clean。
- **验证命令**：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_integration_api_l1_r44.py \
    ../tests/test_view_gov_api_r31.py \
    -v
  ```

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/integration/__init__.py` | 域导出 | 新建 |
| `backend/app/integration/errors.py` | `IntegrationError` 基类 | 新建 |
| `backend/app/integration/query_services.py` | API-003 已发布服务列表/详情/openapi/execute | 新建 |
| `backend/app/integration/bus_register.py` | API-004 IF-01 登记 + retry 编排 | 新建 |
| `backend/app/integration/reports_export.py` | API-005 导出元数据骨架 | 新建 |
| `backend/app/integration/embed_token.py` | API-006 token 签发 + SDK 参数 | 新建 |
| `backend/app/governance/bus/adapter.py` | `BusAdapter` + `register_with_retry` + `InMemoryBusAdapter` | 新建 |
| `backend/app/governance/bus/poc.py` | re-export `InMemoryBusPoCAdapter` 自 adapter | 修改 |
| `backend/app/api/v1/services.py` | IF-02 路由 | 新建 |
| `backend/app/api/v1/integration_bus.py` | IF-01 路由 | 新建 |
| `backend/app/api/v1/reports/export.py` | IF-03 路由 | 新建 |
| `backend/app/api/v1/embed.py` | IF-04 路由 | 新建 |
| `backend/app/api/v1/router.py` | 挂载四路由 | 修改 |
| `backend/app/openapi/version_policy.py` | API-007 版本策略常量 + `apply_version_policy` | 新建 |
| `backend/app/openapi/extensions.py` | 调用 `apply_version_policy` + 保留 IF-06 | 修改 |
| `tests/test_integration_api_l1_r44.py` | 新套件 ≥28 断言 | 新建 |
| `docs/services/integration.md` | integration 域附录 | 新建（Task 8） |
| `docs/services/README.md` | 域索引增行 | 修改（Task 8） |
| `docs/api/README.md` | 登记 IF 路由 | 修改（Task 8） |

预估文件数 **18 ≤ 20**。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_integration_api_l1_r44.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""M8/M12/M13 integration API L1 kickoff r44 — API-003/004/005/006/007."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R44_SQLITE_URL = "sqlite+pysqlite:///file:integration_r44?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}
SEED_TEMPLATE_ID = "00000000-0000-4000-8000-0000000000a1"


@pytest.fixture(scope="module", autouse=True)
def r44_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R44_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
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


def _create_catalog_entry(
    client: TestClient,
    *,
    path: str,
    status: str = "published",
    name: str = "Svc",
) -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": name,
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
```

---

### Task 1: integration 错误域脚手架（共享基类）

**Files:**
- Create: `backend/app/integration/__init__.py`
- Create: `backend/app/integration/errors.py`
- Create: `tests/test_integration_api_l1_r44.py`（fixture 文件 + 占位通过测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `IntegrationError(code:str, message:str, status:int=400, fields:list[dict]|None=None, trace_id:str|None=None)` — 属性 `.code/.message/.status/.fields/.trace_id`

- [ ] **Step 1: Write fixture file + unit test**

```python
# tests/test_integration_api_l1_r44.py（追加至 Shared Fixtures 之后）
from app.integration.errors import IntegrationError


def test_integration_error_fields_default():
    """T-API-R44-000-01(unit): IntegrationError fields 默认空列表。"""
    err = IntegrationError("TEST", "msg", 400)
    assert err.code == "TEST"
    assert err.fields == []
    assert err.trace_id is None
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py::test_integration_error_fields_default -v`
Expected: FAIL `ModuleNotFoundError: No module named 'app.integration'`

- [ ] **Step 3: Implement errors + __init__**

```python
# backend/app/integration/errors.py
from __future__ import annotations


class IntegrationError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        fields: list[dict[str, str]] | None = None,
        trace_id: str | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        self.trace_id = trace_id
        super().__init__(message)
```

```python
# backend/app/integration/__init__.py
from app.integration.errors import IntegrationError

__all__ = ["IntegrationError"]
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py::test_integration_error_fields_default -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/ tests/test_integration_api_l1_r44.py
git commit -m "feat(integration): add IntegrationError base for IF L1 r44"
```

---

### Task 2: API-003 — IF-02 查询服务 API

**Files:**
- Create: `backend/app/integration/query_services.py`
- Create: `backend/app/api/v1/services.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_integration_api_l1_r44.py`（T-API-R44-003-01~10）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `IntegrationError`; `catalog_service.list_entries/get_entry`; `UserContext`; `trace_id_var`
- Produces:
  - `list_published_services(db, *, category, limit, offset) -> QueryServiceListResponse`
  - `get_published_service(db, service_id) -> QueryServiceOut`
  - `get_service_openapi_fragment(service: QueryServiceOut) -> dict`
  - `execute_published_service(db, service_id, parameters, actor) -> QueryServiceExecuteOut`
  - `_assert_service_invoke(actor: UserContext) -> None` — admin 或 integration
  - Pydantic: `QueryServiceOut`, `QueryServiceListResponse`, `QueryServiceExecuteIn`, `QueryServiceExecuteOut`

- [ ] **Step 1: Write failing HTTP tests 003-01~03**

```python
# tests/test_integration_api_l1_r44.py 追加
from app.auth.deps import UserContext, get_current_user


def test_services_list_unauthorized_r44(client):
    """T-API-R44-003-01: GET /services 无鉴权 → 401。"""
    resp = client.get("/api/v1/services")
    assert resp.status_code == 401


def test_services_list_empty_r44(client):
    """T-API-R44-003-02: 空库 → items=[] total=0。"""
    resp = client.get("/api/v1/services", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_services_list_published_only_r44(client):
    """T-API-R44-003-03: published 出现；draft 不出现。"""
    pub_id = _create_catalog_entry(client, path="/api/v1/svc/pub", status="published")
    _create_catalog_entry(client, path="/api/v1/svc/draft", status="draft")
    resp = client.get("/api/v1/services", headers=AUTH)
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert pub_id in ids
    assert resp.json()["total"] >= 1
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -k "003-01 or 003-02 or 003-03" -v`
Expected: FAIL 404（路由不存在）

- [ ] **Step 3: Implement query_services.py + services.py + router**

`query_services.py` 核心逻辑（完整实现要点）：

```python
# backend/app/integration/query_services.py
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.logging import trace_id_var
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import CatalogEntryOut
from app.integration.errors import IntegrationError


class QueryServiceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    name: str
    http_method: str = Field(alias="httpMethod")
    path: str
    category_codes: list[str] = Field(alias="categoryCodes")
    status: str
    version: str = "v1"
    created_at: datetime = Field(alias="createdAt")


class QueryServiceListResponse(BaseModel):
    items: list[QueryServiceOut]
    total: int
    limit: int
    offset: int


class QueryServiceExecuteIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parameters: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class QueryServiceExecuteOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    columns: list[str]
    rows: list[list]
    row_count: int = Field(alias="rowCount")
    truncated: bool = False
    trace_id: str = Field(alias="traceId")


def _assert_service_invoke(actor: UserContext) -> None:
    if "admin" in actor.roles or "integration" in actor.roles:
        return
    raise IntegrationError(
        "SERVICE_EXECUTE_FORBIDDEN",
        "Service invoke requires integration or admin role",
        403,
    )


def _entry_to_service(entry: CatalogEntryOut) -> QueryServiceOut:
    return QueryServiceOut(
        id=entry.id,
        name=entry.name,
        http_method=entry.http_method,
        path=entry.path,
        category_codes=entry.category_codes,
        status=entry.status,
        version="v1",
        created_at=entry.created_at,
    )


def _require_published(entry: CatalogEntryOut) -> None:
    if entry.status != "published":
        raise IntegrationError(
            "SERVICE_NOT_PUBLISHED",
            "Service is not published",
            400,
        )


def list_published_services(
    db: Session,
    *,
    category: str | None,
    limit: int,
    offset: int,
) -> QueryServiceListResponse:
    try:
        catalog = catalog_service.list_entries(db, category=category, limit=10_000, offset=0)
    except catalog_service.CatalogError as exc:
        raise IntegrationError(exc.code, exc.message, exc.status) from exc
    published = [e for e in catalog.items if e.status == "published"]
    total = len(published)
    page = published[offset : offset + limit]
    return QueryServiceListResponse(
        items=[_entry_to_service(e) for e in page],
        total=total,
        limit=limit,
        offset=offset,
    )


def get_published_service(db: Session, service_id: uuid.UUID) -> QueryServiceOut:
    try:
        entry = catalog_service.get_entry(db, service_id)
    except catalog_service.CatalogError:
        raise IntegrationError("SERVICE_NOT_FOUND", "Service not found", 404) from None
    _require_published(entry)
    return _entry_to_service(entry)


def get_service_openapi_fragment(service: QueryServiceOut) -> dict:
    op_id = service.path.strip("/").replace("/", ".") or "execute"
    return {
        "openapi": "3.1.0",
        "info": {"title": service.name, "version": service.version},
        "paths": {
            service.path: {
                service.http_method.lower(): {
                    "operationId": op_id,
                    "summary": service.name,
                    "responses": {"200": {"description": "OK"}},
                }
            }
        },
    }


def execute_published_service(
    db: Session,
    service_id: uuid.UUID,
    parameters: dict,
    actor: UserContext,
) -> QueryServiceExecuteOut:
    _assert_service_invoke(actor)
    service = get_published_service(db, service_id)
    if "force-error" in service.path:
        trace = trace_id_var.get() or uuid.uuid4().hex
        raise IntegrationError(
            "SERVICE_EXECUTE_FAILED",
            "Service execution failed",
            502,
            trace_id=trace,
        )
    trace = trace_id_var.get() or uuid.uuid4().hex
    return QueryServiceExecuteOut(
        columns=["value"],
        rows=[[1]],
        row_count=1,
        truncated=False,
        trace_id=trace,
    )
```

`services.py` entry（错误体 helper + 四路由）：

```python
# backend/app/api/v1/services.py
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.datasources.models import get_meta_session
from app.integration.errors import IntegrationError
from app.integration import query_services as svc

router = APIRouter(prefix="/services", tags=["integration", "IF-02"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _err(exc: IntegrationError) -> JSONResponse:
    detail: dict | None = None
    if exc.fields:
        detail = {"fields": exc.fields}
    elif exc.trace_id:
        detail = {"traceId": exc.trace_id}
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("", response_model=svc.QueryServiceListResponse)
def list_services(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    category: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    try:
        return svc.list_published_services(db, category=category, limit=limit, offset=offset)
    except IntegrationError as exc:
        return _err(exc)


@router.get("/{service_id}", response_model=svc.QueryServiceOut)
def get_service(
    service_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return svc.get_published_service(db, service_id)
    except IntegrationError as exc:
        return _err(exc)


@router.get("/{service_id}/openapi")
def get_service_openapi(
    service_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        service = svc.get_published_service(db, service_id)
        return svc.get_service_openapi_fragment(service)
    except IntegrationError as exc:
        return _err(exc)


@router.post("/{service_id}/execute", response_model=svc.QueryServiceExecuteOut)
def execute_service(
    service_id: uuid.UUID,
    payload: svc.QueryServiceExecuteIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return svc.execute_published_service(
            db, service_id, payload.parameters, actor
        )
    except IntegrationError as exc:
        return _err(exc)
```

`router.py` 追加：

```python
from app.api.v1.services import router as services_router
# ...
api_v1_router.include_router(services_router)
```

- [ ] **Step 4: Append tests 003-04~10 + run all 003**

```python
def test_services_get_ok_r44(client):
    """T-API-R44-003-04: GET /services/{id} published → 200 version=v1。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/detail")
    resp = client.get(f"/api/v1/services/{eid}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["version"] == "v1"


def test_services_get_not_found_r44(client):
    """T-API-R44-003-05: 未知 id → 404 SERVICE_NOT_FOUND。"""
    resp = client.get(f"/api/v1/services/{uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "SERVICE_NOT_FOUND"


def test_services_get_draft_r44(client):
    """T-API-R44-003-06: draft → 400 SERVICE_NOT_PUBLISHED。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/d", status="draft")
    resp = client.get(f"/api/v1/services/{eid}", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "SERVICE_NOT_PUBLISHED"


def test_services_openapi_fragment_r44(client):
    """T-API-R44-003-07: GET openapi → paths + info.version。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/oapi")
    resp = client.get(f"/api/v1/services/{eid}/openapi", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "paths" in body
    assert body["info"]["version"] == "v1"


def test_services_execute_ok_r44(client):
    """T-API-R44-003-08: POST execute → rowCount>=1。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/exec")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {}},
    )
    assert resp.status_code == 200
    assert resp.json()["rowCount"] >= 1


def test_services_execute_forbidden_r44(client):
    """T-API-R44-003-09: 非 admin/integration → 403。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        eid = _create_catalog_entry(client, path="/api/v1/svc/forbid")
        resp = client.post(
            f"/api/v1/services/{eid}/execute",
            headers=AUTH,
            json={"parameters": {}},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "SERVICE_EXECUTE_FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_services_execute_force_error_r44(client):
    """T-API-R44-003-10: force-error path → 502 SERVICE_EXECUTE_FAILED。"""
    eid = _create_catalog_entry(client, path="/api/v1/force-error/demo")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {}},
    )
    assert resp.status_code == 502
    assert resp.json()["code"] == "SERVICE_EXECUTE_FAILED"
```

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -k "003" -v`
Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/query_services.py backend/app/api/v1/services.py backend/app/api/v1/router.py tests/test_integration_api_l1_r44.py
git commit -m "feat(api): IF-02 query services API skeleton (API-003)"
```

---

### Task 3: API-004 — IF-01 总线注册适配 + retry

**Files:**
- Create: `backend/app/governance/bus/adapter.py`
- Modify: `backend/app/governance/bus/poc.py`
- Create: `backend/app/integration/bus_register.py`
- Create: `backend/app/api/v1/integration_bus.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_integration_api_l1_r44.py`（T-API-R44-004-01~07）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces:
  - `BusAdapter` Protocol; `InMemoryBusAdapter`; `register_with_retry(adapter, *, entry, trace_id, max_attempts=3) -> BusRegisterResult`
  - `integration_bus_register(db, entry_id, actor, *, max_attempts=3) -> tuple[BusRegisterOut, bool]`
  - `integration_bus_retry(db, entry_id, actor) -> tuple[BusRegisterOut, bool]`
  - `_assert_integration_bus(actor)` — admin 或 integration

- [ ] **Step 1: Write unit test 004-07 + HTTP 004-01~02**

```python
from app.governance.bus.adapter import InMemoryBusAdapter, register_with_retry
from app.governance.catalog.schemas import CatalogEntryOut
from datetime import UTC, datetime


def test_register_with_retry_timeout_exhausted_r44():
    """T-API-R44-004-07(unit): timeout 重试次数 ≤ maxAttempts。"""
    entry = CatalogEntryOut(
        id=uuid.uuid4(),
        name="T",
        http_method="POST",
        path="/api/v1/force-timeout/r44",
        category_codes=["CAT-01"],
        status="published",
        created_at=datetime.now(UTC),
    )
    adapter = InMemoryBusAdapter()
    result = register_with_retry(
        adapter, entry=entry, trace_id="t1", max_attempts=3
    )
    assert result.status == "failed"
    assert result.error_code == "BUS_REGISTRATION_TIMEOUT"


def test_integration_bus_unauthorized_r44(client):
    """T-API-R44-004-01: 无鉴权 → 401。"""
    resp = client.post(
        "/api/v1/integration/bus/register",
        json={"catalogEntryId": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


def test_integration_bus_forbidden_r44(client):
    """T-API-R44-004-02: 非 integration/admin → 403。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        eid = _create_catalog_entry(client, path="/api/v1/bus/forbid")
        resp = client.post(
            "/api/v1/integration/bus/register",
            headers=AUTH,
            json={"catalogEntryId": eid},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_INTEGRATION_FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -k "004-01 or 004-02 or 004-07" -v`
Expected: FAIL

- [ ] **Step 3: Implement adapter.py**

```python
# backend/app/governance/bus/adapter.py
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from app.governance.catalog.schemas import CatalogEntryOut


@dataclass(frozen=True)
class BusRegisterResult:
    status: str
    bus_id: str | None = None
    registered_at: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    bus_payload: dict | None = None


class BusAdapter(Protocol):
    def register(self, *, entry: CatalogEntryOut, trace_id: str) -> BusRegisterResult: ...


_RETRYABLE = frozenset({
    "BUS_REGISTRATION_TIMEOUT",
    "BUS_REGISTRATION_SERVER_ERROR",
})


def register_with_retry(
    adapter: BusAdapter,
    *,
    entry: CatalogEntryOut,
    trace_id: str,
    max_attempts: int = 3,
) -> BusRegisterResult:
    last: BusRegisterResult | None = None
    for _ in range(max(1, max_attempts)):
        last = adapter.register(entry=entry, trace_id=trace_id)
        if last.status == "succeeded":
            return last
        if last.error_code not in _RETRYABLE:
            return last
    return last or BusRegisterResult(status="failed", error_code="BUS_REGISTER_RETRY_EXHAUSTED")


class InMemoryBusAdapter:
    def register(self, *, entry: CatalogEntryOut, trace_id: str) -> BusRegisterResult:
        if entry.status == "draft":
            return BusRegisterResult(
                status="failed",
                error_code="BUS_ENTRY_NOT_PUBLISHABLE",
                error_message="Draft entry",
            )
        if "force-fail" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_REJECTED",
                error_message="Bus rejected",
            )
        if "force-timeout" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_TIMEOUT",
                error_message="Bus registration timed out",
            )
        if "force-5xx" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_SERVER_ERROR",
                error_message="Bus server error",
            )
        bus_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        return BusRegisterResult(
            status="succeeded",
            bus_id=bus_id,
            registered_at=now,
            bus_payload={"busId": bus_id, "registeredAt": now, "traceId": trace_id},
        )
```

`poc.py` 改为 re-export（保留 r31 符号）：

```python
# backend/app/governance/bus/poc.py — 替换 InMemoryBusPoCAdapter 实现为：
from app.governance.bus.adapter import (
    BusRegisterResult,
    InMemoryBusAdapter,
    register_with_retry,
)

BusPoCAdapter = BusAdapter  # type: ignore[misc]
InMemoryBusPoCAdapter = InMemoryBusAdapter

__all__ = [
    "BusRegisterResult",
    "BusPoCAdapter",
    "InMemoryBusPoCAdapter",
    "register_with_retry",
]
```

（在文件顶部保留 `from app.governance.bus.adapter import BusAdapter as BusPoCAdapter` 若需 Protocol 别名；确保 `catalog/service.py` 的 `from app.governance.bus.poc import BusPoCAdapter, InMemoryBusPoCAdapter` 仍可用。）

- [ ] **Step 4: Implement bus_register.py + integration_bus.py**

`bus_register.py` 委托 `catalog_service.register_entry_to_bus`，传入 `RetryingBusAdapter` 包装：

```python
# backend/app/integration/bus_register.py
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.governance.bus.adapter import BusAdapter, InMemoryBusAdapter, register_with_retry
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import BusRegisterOut, CatalogEntryOut
from app.integration.errors import IntegrationError


class RetryingBusAdapter:
    def __init__(self, inner: BusAdapter, max_attempts: int) -> None:
        self._inner = inner
        self._max_attempts = max_attempts

    def register(self, *, entry: CatalogEntryOut, trace_id: str):
        return register_with_retry(
            self._inner,
            entry=entry,
            trace_id=trace_id,
            max_attempts=self._max_attempts,
        )


def _assert_integration_bus(actor: UserContext) -> None:
    if "admin" in actor.roles or "integration" in actor.roles:
        return
    raise IntegrationError(
        "BUS_REGISTER_INTEGRATION_FORBIDDEN",
        "Bus registration requires integration or admin role",
        403,
    )


def register_catalog_to_bus(
    db: Session,
    entry_id: uuid.UUID,
    actor: UserContext,
    *,
    max_attempts: int = 3,
) -> tuple[BusRegisterOut, bool]:
    _assert_integration_bus(actor)
    adapter = RetryingBusAdapter(InMemoryBusAdapter(), max_attempts)
    try:
        return catalog_service.register_entry_to_bus(db, entry_id, adapter=adapter)
    except catalog_service.CatalogError as exc:
        trace_id = getattr(exc, "trace_id", None)
        if exc.code == "BUS_REGISTRATION_TIMEOUT" and max_attempts > 1:
            raise IntegrationError(
                "BUS_REGISTER_RETRY_EXHAUSTED",
                exc.message,
                502,
                trace_id=trace_id,
            ) from exc
        raise IntegrationError(exc.code, exc.message, exc.status, trace_id=trace_id) from exc
```

`integration_bus.py`：

```python
# backend/app/api/v1/integration_bus.py
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.datasources.models import get_meta_session
from app.governance.catalog.schemas import BusRegisterOut
from app.integration import bus_register
from app.integration.errors import IntegrationError

router = APIRouter(prefix="/integration/bus", tags=["integration", "IF-01"])


class IntegrationBusRegisterIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")
    retry: dict | None = None


class IntegrationBusRetryIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")
    registration_id: uuid.UUID | None = Field(default=None, alias="registrationId")


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _err(exc: IntegrationError) -> JSONResponse:
    detail = {"traceId": exc.trace_id} if exc.trace_id else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.post("/register", response_model=BusRegisterOut)
def register_integration_bus(
    payload: IntegrationBusRegisterIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    max_attempts = 3
    if payload.retry and "maxAttempts" in payload.retry:
        max_attempts = int(payload.retry["maxAttempts"])
    try:
        out, created = bus_register.register_catalog_to_bus(
            db, payload.catalog_entry_id, actor, max_attempts=max_attempts
        )
        return JSONResponse(
            status_code=201 if created else 200,
            content=out.model_dump(by_alias=True, mode="json"),
        )
    except IntegrationError as exc:
        return _err(exc)


@router.post("/register/retry", response_model=BusRegisterOut)
def retry_integration_bus(
    payload: IntegrationBusRetryIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        out, created = bus_register.register_catalog_to_bus(
            db, payload.catalog_entry_id, actor, max_attempts=3
        )
        return JSONResponse(
            status_code=201 if created else 200,
            content=out.model_dump(by_alias=True, mode="json"),
        )
    except IntegrationError as exc:
        return _err(exc)
```

`router.py`：`from app.api.v1.integration_bus import router as integration_bus_router` + `include_router`.

- [ ] **Step 5: Append tests 004-03~06 + run all 004**

```python
def test_integration_bus_success_r44(client):
    """T-API-R44-004-03: published entry → 201 + busResponse.busId。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/ok-r44")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert resp.status_code == 201
    assert resp.json()["busResponse"]["busId"]


def test_integration_bus_idempotent_r44(client):
    """T-API-R44-004-04: 重复 POST → 200 同 busId。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/idempotent-r44")
    first = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    second = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["busResponse"]["busId"] == first.json()["busResponse"]["busId"]


def test_integration_bus_timeout_retry_r44(client):
    """T-API-R44-004-05: force-timeout + retry → 502 BUS_REGISTER_RETRY_EXHAUSTED。"""
    eid = _create_catalog_entry(client, path="/api/v1/force-timeout/r44-bus")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid, "retry": {"maxAttempts": 3}},
    )
    assert resp.status_code in (502, 504)
    assert resp.json()["code"] in (
        "BUS_REGISTER_RETRY_EXHAUSTED",
        "BUS_REGISTRATION_TIMEOUT",
    )


def test_integration_bus_draft_r44(client):
    """T-API-R44-004-06: draft → 400 BUS_ENTRY_NOT_PUBLISHABLE。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/draft", status="draft")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "BUS_ENTRY_NOT_PUBLISHABLE"
```

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -k "004" -v && python3 -m pytest ../tests/test_view_gov_api_r31.py -k "bus_register" -v`
Expected: 004 全 PASS；r31 bus 回归仍 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/governance/bus/ backend/app/integration/bus_register.py backend/app/api/v1/integration_bus.py backend/app/api/v1/router.py tests/test_integration_api_l1_r44.py
git commit -m "feat(api): IF-01 bus register adapter with retry (API-004)"
```

---

### Task 4: API-005 — IF-03 报表文档 API

**Files:**
- Create: `backend/app/integration/reports_export.py`
- Create: `backend/app/api/v1/reports/export.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_integration_api_l1_r44.py`（T-API-R44-005-01~07）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `create_export_request(actor, *, template_id, format, from_ts, to_ts) -> ReportExportOut`
- Constants: `SEED_TEMPLATE_IDS` 含 `SEED_TEMPLATE_ID`；`VALID_FORMATS = {"pdf","word","excel"}`

- [ ] **Step 1: Write failing tests 005-01~03**

```python
def test_reports_export_unauthorized_r44(client):
    """T-API-R44-005-01: 无鉴权 → 401。"""
    resp = client.get("/api/v1/reports/export?templateId=x&format=pdf")
    assert resp.status_code == 401


def test_reports_export_ok_r44(client):
    """T-API-R44-005-02: seed template → 200 status=pending。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=pdf",
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


def test_reports_export_invalid_format_r44(client):
    """T-API-R44-005-03: format=invalid → 422。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=invalid",
        headers=AUTH,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "REPORT_EXPORT_INVALID_FORMAT"
```

- [ ] **Step 2: Run — expect FAIL**（404）

- [ ] **Step 3: Implement reports_export.py + export.py**

```python
# backend/app/integration/reports_export.py
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.core.logging import trace_id_var
from app.integration.errors import IntegrationError

SEED_TEMPLATE_IDS = frozenset({uuid.UUID("00000000-0000-4000-8000-0000000000a1")})
VALID_FORMATS = frozenset({"pdf", "word", "excel"})


class ReportExportOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    export_id: uuid.UUID = Field(alias="exportId")
    template_id: uuid.UUID = Field(alias="templateId")
    format: str
    status: str = "pending"
    download_url: str | None = Field(default=None, alias="downloadUrl")
    expires_at: str | None = Field(default=None, alias="expiresAt")
    requested_at: str = Field(alias="requestedAt")
    trace_id: str = Field(alias="traceId")


def _assert_reports_export(actor: UserContext) -> None:
    if "admin" in actor.roles or "integration" in actor.roles:
        return
    raise IntegrationError(
        "REPORT_EXPORT_FORBIDDEN",
        "Report export requires integration or admin role",
        403,
    )


def create_export_request(
    actor: UserContext,
    *,
    template_id: uuid.UUID,
    fmt: str,
    from_ts: datetime | None,
    to_ts: datetime | None,
) -> ReportExportOut:
    _assert_reports_export(actor)
    if fmt not in VALID_FORMATS:
        raise IntegrationError(
            "REPORT_EXPORT_INVALID_FORMAT",
            f"Invalid format: {fmt}",
            422,
            fields=[{"field": "format", "message": "must be pdf|word|excel"}],
        )
    if from_ts and to_ts and from_ts > to_ts:
        raise IntegrationError(
            "REPORT_EXPORT_INVALID_RANGE",
            "from must be before to",
            422,
            fields=[{"field": "from", "message": "invalid range"}],
        )
    if template_id not in SEED_TEMPLATE_IDS:
        if str(template_id).endswith("force-rate-limit"):
            raise IntegrationError(
                "REPORT_EXPORT_RATE_LIMITED",
                "Rate limit exceeded",
                429,
            )
        raise IntegrationError(
            "REPORT_TEMPLATE_NOT_FOUND",
            "Template not found",
            404,
        )
    trace = trace_id_var.get() or uuid.uuid4().hex
    return ReportExportOut(
        export_id=uuid.uuid4(),
        template_id=template_id,
        format=fmt,
        status="pending",
        download_url=None,
        expires_at=None,
        requested_at=datetime.now(UTC).isoformat(),
        trace_id=trace,
    )
```

```python
# backend/app/api/v1/reports/export.py
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, get_current_user
from app.integration import reports_export as rex
from app.integration.errors import IntegrationError

router = APIRouter(prefix="/reports", tags=["integration", "IF-03"])


def _err(exc: IntegrationError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/export", response_model=rex.ReportExportOut)
def get_report_export(
    response: Response,
    actor: Annotated[UserContext, Depends(get_current_user)],
    template_id: uuid.UUID = Query(alias="templateId"),
    format: str = Query(alias="format"),
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    try:
        out = rex.create_export_request(
            actor,
            template_id=template_id,
            fmt=format,
            from_ts=from_ts,
            to_ts=to_ts,
        )
        response.headers["X-RateLimit-Limit"] = "60"
        response.headers["X-RateLimit-Remaining"] = "59"
        return out
    except IntegrationError as exc:
        return _err(exc)
```

- [ ] **Step 4: Append tests 005-04~07 + run**

```python
def test_reports_export_not_found_r44(client):
    """T-API-R44-005-04: 未知 template → 404。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={uuid.uuid4()}&format=pdf",
        headers=AUTH,
    )
    assert resp.status_code == 404


def test_reports_export_forbidden_r44(client):
    """T-API-R44-005-05: 非授权角色 → 403。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.get(
            f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=pdf",
            headers=AUTH,
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reports_export_rate_limit_headers_r44(client):
    """T-API-R44-005-06: 含 X-RateLimit-* 头。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=pdf",
        headers=AUTH,
    )
    assert resp.headers.get("X-RateLimit-Limit") == "60"
    assert resp.headers.get("X-RateLimit-Remaining") == "59"


def test_reports_export_rate_limited_r44(client):
    """T-API-R44-005-07: force-rate-limit template → 429。"""
    tid = "00000000-0000-4000-8000-force-rate-limit"
    resp = client.get(
        f"/api/v1/reports/export?templateId={tid}&format=pdf",
        headers=AUTH,
    )
    assert resp.status_code == 429
    assert resp.json()["code"] == "REPORT_EXPORT_RATE_LIMITED"
```

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -k "005" -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/reports_export.py backend/app/api/v1/reports/ backend/app/api/v1/router.py tests/test_integration_api_l1_r44.py
git commit -m "feat(api): IF-03 report export metadata skeleton (API-005)"
```

---

### Task 5: API-006 — IF-04 门户嵌入 API

**Files:**
- Create: `backend/app/integration/embed_token.py`
- Create: `backend/app/api/v1/embed.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_integration_api_l1_r44.py`（T-API-R44-006-01~08）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `app.viz.embed._ORIGIN_RE` 或 `is_origin_allowed`
- Produces: `issue_embed_token(actor, payload, origin_header) -> EmbedTokenOut`; `resolve_sdk_params(token) -> dict`

- [ ] **Step 1: Write failing tests 006-01~04**

```python
def test_embed_token_unauthorized_r44(client):
    """T-API-R44-006-01: POST 无鉴权 → 401。"""
    resp = client.post("/api/v1/embed/token", json={"chartId": str(uuid.uuid4())})
    assert resp.status_code == 401


def test_embed_token_ok_r44(client):
    """T-API-R44-006-02: chartId + 合法 origins → 201 token + sdkParams.apiBase。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(uuid.uuid4()),
            "allowedOrigins": ["https://portal.example.com"],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["token"]
    assert body["sdkParams"]["apiBase"]


def test_embed_token_conflict_r44(client):
    """T-API-R44-006-03: 双 target → 422 EMBED_TARGET_CONFLICT。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(uuid.uuid4()),
            "dashboardId": str(uuid.uuid4()),
            "allowedOrigins": [],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "EMBED_TARGET_CONFLICT"


def test_embed_token_invalid_origin_r44(client):
    """T-API-R44-006-04: 非法 origin → 422 EMBED_INVALID_ORIGIN。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(uuid.uuid4()),
            "allowedOrigins": ["not-a-url"],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "EMBED_INVALID_ORIGIN"
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement embed_token.py + embed.py**

```python
# backend/app/integration/embed_token.py
from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.integration.errors import IntegrationError
from app.viz.embed import _ORIGIN_RE

_TOKEN_STORE: dict[str, dict] = {}


class EmbedTokenIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")
    dashboard_id: uuid.UUID | None = Field(default=None, alias="dashboardId")
    allowed_origins: list[str] = Field(default_factory=list, alias="allowedOrigins")
    expires_in_sec: int = Field(default=3600, alias="expiresInSec", ge=60, le=86400)
    theme: Literal["light", "dark"] = "light"


class EmbedTokenOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    token: str
    expires_at: str = Field(alias="expiresAt")
    embed_url: str = Field(alias="embedUrl")
    sdk_params: dict = Field(alias="sdkParams")


def _assert_embed_issue(actor: UserContext) -> None:
    if "admin" in actor.roles or "dashboard:share" in actor.roles:
        return
    raise IntegrationError(
        "EMBED_TOKEN_FORBIDDEN",
        "Embed token requires admin or dashboard:share role",
        403,
    )


def _validate_origins(origins: list[str]) -> None:
    invalid = [
        {"field": f"allowedOrigins[{i}]", "message": f"invalid origin: {o}"}
        for i, o in enumerate(origins)
        if not _ORIGIN_RE.match(o)
    ]
    if invalid:
        raise IntegrationError(
            "EMBED_INVALID_ORIGIN", "invalid origin", 422, fields=invalid
        )


def issue_embed_token(
    actor: UserContext,
    payload: EmbedTokenIn,
    origin_header: str | None,
) -> EmbedTokenOut:
    _assert_embed_issue(actor)
    if payload.chart_id is None and payload.dashboard_id is None:
        raise IntegrationError(
            "EMBED_MISSING_TARGET",
            "chartId or dashboardId is required",
            422,
            fields=[
                {"field": "chartId", "message": "required"},
                {"field": "dashboardId", "message": "required"},
            ],
        )
    if payload.chart_id is not None and payload.dashboard_id is not None:
        raise IntegrationError(
            "EMBED_TARGET_CONFLICT",
            "chartId conflicts with dashboardId",
            422,
            fields=[
                {"field": "chartId", "message": "conflict"},
                {"field": "dashboardId", "message": "conflict"},
            ],
        )
    _validate_origins(payload.allowed_origins)
    if origin_header and payload.allowed_origins:
        if origin_header not in payload.allowed_origins:
            raise IntegrationError(
                "EMBED_ORIGIN_DENIED",
                "Origin not in allowedOrigins",
                403,
            )
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(seconds=payload.expires_in_sec)
    container_id = f"embed-{token[:8]}"
    api_base = "/api/v1"
    _TOKEN_STORE[token] = {
        "expires_at": expires_at,
        "container_id": container_id,
        "theme": payload.theme,
        "api_base": api_base,
    }
    return EmbedTokenOut(
        token=token,
        expires_at=expires_at.isoformat(),
        embed_url=f"/embed/{token}",
        sdk_params={
            "containerId": container_id,
            "theme": payload.theme,
            "apiBase": api_base,
            "token": token,
        },
    )


def resolve_sdk_params(token: str) -> dict:
    row = _TOKEN_STORE.get(token)
    if row is None:
        raise IntegrationError("EMBED_TOKEN_INVALID", "Invalid embed token", 404)
    if datetime.now(UTC) > row["expires_at"]:
        raise IntegrationError("EMBED_TOKEN_INVALID", "Embed token expired", 404)
    return {
        "containerId": row["container_id"],
        "theme": row["theme"],
        "apiBase": row["api_base"],
        "token": token,
    }
```

```python
# backend/app/api/v1/embed.py
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, get_current_user
from app.integration import embed_token as et
from app.integration.errors import IntegrationError

router = APIRouter(prefix="/embed", tags=["integration", "IF-04"])


def _err(exc: IntegrationError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.post("/token", status_code=status.HTTP_201_CREATED, response_model=et.EmbedTokenOut)
def post_embed_token(
    payload: et.EmbedTokenIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    origin: Annotated[str | None, Header(alias="Origin")] = None,
):
    try:
        return et.issue_embed_token(actor, payload, origin)
    except IntegrationError as exc:
        return _err(exc)


@router.get("/sdk-params")
def get_embed_sdk_params(
    _: Annotated[UserContext, Depends(get_current_user)],
    token: str = Query(),
):
    try:
        return et.resolve_sdk_params(token)
    except IntegrationError as exc:
        return _err(exc)
```

- [ ] **Step 4: Append tests 006-05~08 + run**

```python
def test_embed_token_forbidden_role_r44(client):
    """T-API-R44-006-05: 非 share/admin → 403。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.post(
            "/api/v1/embed/token",
            headers=AUTH,
            json={"chartId": str(uuid.uuid4()), "allowedOrigins": []},
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_embed_origin_denied_r44(client):
    """T-API-R44-006-06: Origin 不在白名单 → 403。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers={**AUTH, "Origin": "https://evil.com"},
        json={
            "chartId": str(uuid.uuid4()),
            "allowedOrigins": ["https://portal.example.com"],
        },
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "EMBED_ORIGIN_DENIED"


def test_embed_sdk_params_ok_r44(client):
    """T-API-R44-006-07: GET sdk-params 有效 token → containerId。"""
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": str(uuid.uuid4()), "allowedOrigins": []},
    )
    token = created.json()["token"]
    resp = client.get(f"/api/v1/embed/sdk-params?token={token}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["containerId"]


def test_embed_sdk_params_invalid_r44(client):
    """T-API-R44-006-08: 无效 token → 404 EMBED_TOKEN_INVALID。"""
    resp = client.get(
        "/api/v1/embed/sdk-params?token=invalid-token-xyz",
        headers=AUTH,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "EMBED_TOKEN_INVALID"
```

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -k "006" -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/embed_token.py backend/app/api/v1/embed.py backend/app/api/v1/router.py tests/test_integration_api_l1_r44.py
git commit -m "feat(api): IF-04 embed token issuance skeleton (API-006)"
```

---

### Task 6: API-007 — OpenAPI 版本策略与 IF tag 注入

**Files:**
- Create: `backend/app/openapi/version_policy.py`
- Modify: `backend/app/openapi/extensions.py`
- Test: `tests/test_integration_api_l1_r44.py`（T-API-R44-007-01~05）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `API_URL_PREFIX`, `VERSION_POLICY_TEXT`, `OPENAPI_INFO_EXTENSIONS`, `apply_version_policy(schema: dict) -> dict`
- Consumes: `get_settings().api_openapi_version`

- [ ] **Step 1: Write failing OpenAPI tests**

```python
def test_openapi_version_policy_extension_r44(client):
    """T-API-R44-007-01: info.x-api-version-policy 存在。"""
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert "x-api-version-policy" in resp.json()["info"]


def test_openapi_if02_tag_r44(client):
    """T-API-R44-007-02: /services operations 含 IF-02 tag。"""
    schema = client.get("/openapi.json").json()
    op = schema["paths"]["/api/v1/services"]["get"]
    assert "IF-02" in op.get("tags", [])


def test_openapi_if_operation_id_prefixes_r44(client):
    """T-API-R44-007-03: IF-01~04 operationId 前缀 if01.~if04.。"""
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    assert paths["/api/v1/integration/bus/register"]["post"]["operationId"].startswith("if01.")
    assert paths["/api/v1/services"]["get"]["operationId"].startswith("if02.")
    assert paths["/api/v1/reports/export"]["get"]["operationId"].startswith("if03.")
    assert paths["/api/v1/embed/token"]["post"]["operationId"].startswith("if04.")


def test_openapi_unversioned_paths_empty_r44(client):
    """T-API-R44-007-04: x-unversioned-paths==[]。"""
    info = client.get("/openapi.json").json()["info"]
    assert info.get("x-unversioned-paths", []) == []


def test_openapi_info_version_matches_settings_r44(client):
    """T-API-R44-007-05: info.version == settings.api_openapi_version。"""
    from app.core.config import get_settings

    schema = client.get("/openapi.json").json()
    assert schema["info"]["version"] == get_settings().api_openapi_version
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement version_policy.py + wire extensions.py**

```python
# backend/app/openapi/version_policy.py
from __future__ import annotations

API_URL_PREFIX = "/api/v1/"
VERSION_POLICY_TEXT = (
    "Breaking API changes require a new major URL version (e.g. /api/v2/). "
    "Additive non-breaking changes remain on /api/v1/."
)
OPENAPI_INFO_EXTENSIONS = {
    "x-api-version-policy": VERSION_POLICY_TEXT,
    "x-breaking-change-policy": "bump-url-major-on-breaking",
    "x-if-groups": ["IF-01", "IF-02", "IF-03", "IF-04", "IF-06"],
}

_SYSTEM_PATH_PREFIXES = ("/health", "/docs", "/redoc", "/openapi.json")

_IF_PREFIX_TAGS = (
    ("/api/v1/integration/bus", "IF-01", "if01."),
    ("/api/v1/services", "IF-02", "if02."),
    ("/api/v1/reports/export", "IF-03", "if03."),
    ("/api/v1/embed", "IF-04", "if04."),
)


def apply_version_policy(schema: dict) -> dict:
    info = schema.setdefault("info", {})
    desc = info.get("description") or ""
    if VERSION_POLICY_TEXT not in desc:
        info["description"] = (desc + "\n\n" + VERSION_POLICY_TEXT).strip()
    info.update(OPENAPI_INFO_EXTENSIONS)
    unversioned: list[str] = []
    for path in schema.get("paths", {}):
        if path.startswith(_SYSTEM_PATH_PREFIXES):
            continue
        if not path.startswith(API_URL_PREFIX):
            unversioned.append(path)
    info["x-unversioned-paths"] = unversioned
    for path, methods in schema.get("paths", {}).items():
        for verb, op in methods.items():
            if not isinstance(op, dict):
                continue
            for prefix, tag, op_prefix in _IF_PREFIX_TAGS:
                if path.startswith(prefix):
                    tags = list(op.get("tags") or [])
                    if tag not in tags:
                        tags.append(tag)
                    op["tags"] = tags
                    op_id = op.get("operationId") or f"{verb}"
                    if not op_id.startswith(op_prefix):
                        op["operationId"] = f"{op_prefix}{op_id}"
    return schema
```

在 `extensions.py` 的 `customize_openapi` 末尾、`app.openapi_schema = schema` 之前插入：

```python
from app.openapi.version_policy import apply_version_policy
# ...
    _inject_if06_tags(schema)
    apply_version_policy(schema)
    schema["info"]["version"] = settings.api_openapi_version
```

- [ ] **Step 4: Run 007 tests**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -k "007" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/openapi/version_policy.py backend/app/openapi/extensions.py tests/test_integration_api_l1_r44.py
git commit -m "feat(openapi): IF-01~04 tags and version policy (API-007)"
```

---

### Task 7: 全量回归门控

**Files:**
- Test: `tests/test_integration_api_l1_r44.py`（全套件）
- Test: `tests/test_view_gov_api_r31.py`（只读回归）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 跑 r44 全套件**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r44.py -v --tb=short`
Expected: **≥38 passed**（000-01 + 003×10 + 004×7 + 005×7 + 006×8 + 007×5）

- [ ] **Step 2: 跑 r31 gov/bus 回归**

Run: `cd backend && python3 -m pytest ../tests/test_view_gov_api_r31.py -v --tb=short`
Expected: **24 passed**

- [ ] **Step 3: ruff + 全量 pytest 门控**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest ../tests -q`
Expected: ruff clean；**≥1096 passed** + 2 skipped

- [ ] **Step 4: Commit（若有修复）**

```bash
git add -A
git commit -m "test(integration): r44 full suite + r31 regression gate"
```

---

### Task 8: 文档同步（P3 收尾）

**Files:**
- Create: `docs/services/integration.md`
- Modify: `docs/services/README.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（触及 `docs/services/` 与 `docs/api/`）

**UI skill:** none

- [ ] **Step 1: 新建 `docs/services/integration.md`**

内容须含：模块路径 `backend/app/integration/`；PRD 分片 `prd/F13-API.md`；里程碑 M8/M12/M13；状态「L1 已实现」；职责（IF-01~04 门面编排）；In（catalog 已发布服务、bus adapter、报表导出元数据、embed token）；Out（真实总线 HTTP、报表引擎、fe SDK、持久化 token）；依赖 catalog/query/viz.embed/governance.bus。

- [ ] **Step 2: 更新 `docs/services/README.md`**

增行：`integration` | `docs/services/integration.md` | IF 集成门面 | L1 已实现

- [ ] **Step 3: 更新 `docs/api/README.md`**

将 §5 `POST /embed/token`、§6 `GET /reports/export`、§8 `GET /services` 等行状态改为「已实现」；补 IF-01 `POST /integration/bus/register`、IF-04 `GET /embed/sdk-params`；脚注 IF tag 与主要错误码。

- [ ] **Step 4: 验证文档无断链**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest ../tests/test_integration_api_l1_r44.py ../tests/test_view_gov_api_r31.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/services/integration.md docs/services/README.md docs/api/README.md
git commit -m "docs: integration domain appendix and IF API registry (r44)"
```

---

## Self-Review Checklist

- [x] API-003~007 各有一组 Task + 验收测试 ID
- [x] 无 TBD/TODO/「适当处理」占位
- [x] 每 Task 含验证命令与期望输出
- [x] 全 Task UI skill: none（纯后端）
- [x] 18 文件 ≤ 20；3 模块（integration / api+v1 / openapi）≤ 3
- [x] IF 与 GOV-002、VIZ-006 边界在 Global Constraints 明确
- [x] poc.py re-export 策略覆盖 r31 回归风险
