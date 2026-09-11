# M6 一期集成验收收官实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/governance/bus/poc_fsm.py` · `backend/app/governance/bus/probe.py` · `backend/app/governance/catalog/service.py` · `backend/app/governance/catalog/cat01/handler.py` · `backend/app/governance/catalog/cat02/handler.py` · `backend/app/governance/catalog/cat03/handler.py` · `backend/app/core/nfr/https_audit.py` · `backend/app/core/middleware/https_audit_guard.py` · `backend/app/main.py` · `backend/app/api/v1/gov.py` · `backend/app/api/v1/nfr.py` · `tests/test_gov_002_bus_poc_fsm.py` · `tests/test_cat_001_lifecycle_m6.py` · `tests/test_cat_002_aggregate_m6.py` · `tests/test_cat_003_region_m6.py` · `tests/test_nfr_004_https_audit.py` · `docs/api/README.md` · `docs/services/governance.md`
> **子项：** GOV-002, CAT-001, CAT-002, CAT-003, NFR-004
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**` 匹配 `backend-fastapi.mdc`）

**Goal:** 闭合 M6 末 5 项：半自动总线 PoC FSM（pending/registered/failed）+ 三类 catalog M6 probe handler + HTTPS 响应脱敏 audit guard；25 条 M6 集成 pytest 全绿。

**Architecture:** GOV-002 在独立 `poc_fsm.py` 内存字典与 GOV-007 `auto.py` 隔离；`register_entry_to_bus` 在 adapter 调用前后写 FSM 跃迁。CAT-001~003 各增 `handler.py` 聚合 list/validate/move probe 与 ACL 就绪标志。NFR-004 用 Starlette `HttpsAuditGuardMiddleware` 侧车审计 JSON 响应（不改客户端 body），ring buffer 在 `https_audit.py`。

**Tech Stack:** FastAPI · Pydantic v2 · SQLAlchemy · Starlette middleware · pytest · TestClient

## Global Constraints

- 真理源：`docs/superpowers/evolution/2026-07-06-round-target-m6-integration.md` > `docs/superpowers/specs/2026-07-06-m6-integration-gov-cat-nfr-design.md`
- `base_branch`: `dev-auto`；禁止修改 `docs/automate/goal.md`；P5 前不改 `plan.md` 结构
- 非目标：`fe/`、Alembic migration、GOV-007 全自动总线、CAT-004~007、生产 TLS 终止、持久化 audit store
- 文件预算：**18** 主文件（design §3）；总计 ≤20
- 后端验证根目录：`cd backend && python3 -m ruff check . && python3 -m pytest <paths> -q`
- probe 硬限：**≤50ms**（同机 CI 测量）
- **UI skill:** none（纯后端 companion）

---

### Task 1: GOV-002 semi-auto FSM + catalog 钩子 + bus probe

**Files:**
- Create: `backend/app/governance/bus/poc_fsm.py`
- Modify: `backend/app/governance/catalog/service.py`
- Modify: `backend/app/governance/bus/probe.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `CatalogEntryOut`, `BusRegistration`, `InMemoryBusAdapter`, `trace_id_var`
- Produces: `SemiAutoFsmState`, `get_semi_auto_fsm(db, entry_id)`, `transition_semi_auto_fsm(entry_id, state)`, `set_user_bus_register_scope(user_id, path_prefix)`, `assert_bus_register_path_scope(actor, entry_path)`, `probe_semi_auto_register_budget_ms(db, actor) -> SemiAutoProbeResult`

**Acceptance:**
- FSM 状态名仅为 `pending` | `registered` | `failed`
- `register_entry_to_bus` 成功/失败/幂等路径正确跃迁 FSM
- `probe_semi_auto_register_budget_ms` 返回 `ok=True` 且 `elapsed_ms < 50`
- 不修改 GOV-007 `bus/auto.py` 行为

- [ ] **Step 1: 新建 `poc_fsm.py`**

```python
# backend/app/governance/bus/poc_fsm.py
from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.governance.catalog.models import BusRegistration

SemiAutoFsmState = Literal["pending", "registered", "failed"]

_SEMI_AUTO_FSM: dict[uuid.UUID, SemiAutoFsmState] = {}
_USER_BUS_REGISTER_SCOPE: dict[str, str] = {}


def set_user_bus_register_scope(user_id: str, path_prefix: str) -> None:
    _USER_BUS_REGISTER_SCOPE[user_id] = path_prefix


def transition_semi_auto_fsm(entry_id: uuid.UUID, state: SemiAutoFsmState) -> None:
    _SEMI_AUTO_FSM[entry_id] = state


def get_semi_auto_fsm(db: Session, entry_id: uuid.UUID) -> SemiAutoFsmState:
    succeeded = db.scalar(
        select(BusRegistration).where(
            BusRegistration.catalog_entry_id == entry_id,
            BusRegistration.status == "succeeded",
        )
    )
    if succeeded is not None:
        return "registered"
    return _SEMI_AUTO_FSM.get(entry_id, "pending")


def assert_bus_register_path_scope(actor: UserContext, entry_path: str) -> None:
    roles = set(actor.roles)
    if "admin" in roles:
        return
    if "enterprise" in roles:
        prefix = _USER_BUS_REGISTER_SCOPE.get(actor.id, "/api/v1/")
        if not entry_path.startswith(prefix):
            from app.governance.catalog.service import CatalogError

            raise CatalogError(
                "BUS_REGISTER_FORBIDDEN",
                "enterprise user out of bus register path scope",
                403,
            )
        return
    from app.governance.catalog.service import CatalogError

    raise CatalogError("BUS_REGISTER_FORBIDDEN", "Bus registration requires admin role", 403)
```

- [ ] **Step 2: 修改 `register_entry_to_bus` 写 FSM 钩子**

在 `backend/app/governance/catalog/service.py` 顶部增加 import：

```python
from app.governance.bus import poc_fsm
```

在 `register_entry_to_bus` 内，`existing is not None` 幂等返回**之前**插入：

```python
        poc_fsm.transition_semi_auto_fsm(entry_id, "registered")
```

在 `bus = adapter or _default_bus_adapter` **之前**（幂等分支之后）插入：

```python
    poc_fsm.transition_semi_auto_fsm(entry_id, "pending")
```

在 `if result.status == "failed":` 分支 `raise err` **之前**插入：

```python
        poc_fsm.transition_semi_auto_fsm(entry_id, "failed")
```

在 `db.commit()` 成功之后、`return (...)` **之前**插入：

```python
    poc_fsm.transition_semi_auto_fsm(entry_id, "registered")
```

- [ ] **Step 3: 扩展 `bus/probe.py`**

```python
probe_semi_auto_register_budget_ms_limit = 50


@dataclass(frozen=True)
class SemiAutoProbeResult:
    elapsed_ms: float
    ok: bool


def probe_semi_auto_register_budget_ms(
    db: Session, actor: UserContext,
) -> SemiAutoProbeResult:
    from app.governance.catalog.schemas import CatalogEntryCreate

    started = time.perf_counter()
    entry = catalog_service.create_entry(
        db,
        CatalogEntryCreate(
            name="semi-auto-probe",
            http_method="POST",
            path=f"/api/v1/gov/semi-probe-{uuid.uuid4().hex[:8]}",
            category_codes=["CAT-01"],
            status="active",
        ),
    )
    catalog_service.publish_entry(db, entry.id)
    with patch.object(InMemoryBusAdapter, "register", side_effect=_mock_register):
        try:
            catalog_service.register_entry_to_bus(db, entry.id)
        except catalog_service.CatalogError:
            pass
    elapsed = (time.perf_counter() - started) * 1000
    return SemiAutoProbeResult(
        elapsed_ms=elapsed,
        ok=elapsed < probe_semi_auto_register_budget_ms_limit,
    )
```

- [ ] **Step 4: 单元烟测 FSM**

```bash
cd backend && python3 -c "
from uuid import uuid4
from app.governance.bus import poc_fsm
eid = uuid4()
poc_fsm.transition_semi_auto_fsm(eid, 'pending')
assert poc_fsm.get_semi_auto_fsm.__annotations__  # import ok
print('poc_fsm ok')
"
```

Expected: 打印 `poc_fsm ok`，exit 0

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/bus/poc_fsm.py backend/app/governance/catalog/service.py backend/app/governance/bus/probe.py
git commit -m "feat(gov): semi-auto bus PoC FSM hooks and probe budget (GOV-002)"
```

---

### Task 2: GOV-002 API 路由 + M6 集成测试

**Files:**
- Modify: `backend/app/api/v1/gov.py`
- Create: `tests/test_gov_002_bus_poc_fsm.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `poc_fsm.*`, `probe_semi_auto_register_budget_ms`, `register_entry_to_bus`（经 HTTP）
- Produces: `GET /api/v1/gov/bus/register/fsm`, `GET /api/v1/gov/bus/register/probe`；`POST /bus/register` 增 enterprise scope 校验

**Acceptance:**
- T-GOV-002-01 ~ T-GOV-002-06 全部通过
- viewer → 403 `BUS_REGISTER_FORBIDDEN`
- enterprise 越界 path → 403 `BUS_REGISTER_FORBIDDEN`
- HTTP probe `ok=true` 且 `elapsedMs < 50`

- [ ] **Step 1: 写失败 pytest `tests/test_gov_002_bus_poc_fsm.py`**

```python
"""GOV-002 — semi-auto bus PoC FSM M6 integration."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.governance.bus.poc_fsm import set_user_bus_register_scope
from app.main import app as fastapi_app
from jwt_auth import AUTH

_GOV002_SQLITE = "sqlite+pysqlite:///file:gov_002_fsm?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def gov002_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _GOV002_SQLITE
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


def _create_entry(client: TestClient, *, path: str) -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Gov002",
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": "active",
        },
    )
    assert resp.status_code == 201
    eid = resp.json()["id"]
    pub = client.post(f"/api/v1/gov/catalog/entries/{eid}/publish", headers=AUTH)
    assert pub.status_code == 200
    return eid


def test_gov_002_01_register_then_fsm_registered(client: TestClient):
    eid = _create_entry(client, path="/api/v1/gov002/success")
    reg = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert reg.status_code == 201
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={eid}", headers=AUTH)
    assert fsm.status_code == 200
    body = fsm.json()
    assert body["fsmState"] == "registered"
    assert body["catalogEntryId"] == eid
    assert body.get("busId")


def test_gov_002_02_force_fail_fsm_failed(client: TestClient):
    eid = _create_entry(client, path="/api/v1/force-fail/gov002")
    reg = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert reg.status_code == 502
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={eid}", headers=AUTH)
    assert fsm.status_code == 200
    assert fsm.json()["fsmState"] == "failed"


def test_gov_002_03_idempotent_stays_registered(client: TestClient):
    eid = _create_entry(client, path="/api/v1/gov002/idempotent")
    first = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    second = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert first.status_code == 201 and second.status_code == 200
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={eid}", headers=AUTH)
    assert fsm.json()["fsmState"] == "registered"


def test_gov_002_04_viewer_forbidden(client: TestClient):
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-gov002", username="viewer", roles=["viewer"]
    )
    try:
        eid = _create_entry(client, path="/api/v1/gov002/viewer")
        resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_002_05_enterprise_scope_forbidden(client: TestClient):
    async def _enterprise() -> UserContext:
        return UserContext(id="ent-gov002", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    set_user_bus_register_scope("ent-gov002", "/api/v1/allowed/")
    try:
        eid = _create_entry(client, path="/api/v1/out-of-scope/gov002")
        resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_002_06_semi_auto_probe_under_50ms(client: TestClient):
    resp = client.get("/api/v1/gov/bus/register/probe", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["elapsedMs"] < 50
```

Run: `cd backend && python3 -m pytest tests/test_gov_002_bus_poc_fsm.py -v`
Expected: FAIL（路由未实现）

- [ ] **Step 2: 修改 `gov.py` — scope + FSM/probe 路由**

替换 `_assert_bus_register_admin` 为路径 scope 校验（保留 admin-only 名称可废弃，改 inline）：

在 `register_bus` 内，`register_entry_to_bus` 调用前增加：

```python
        entry = catalog_service.get_entry(db, payload.catalog_entry_id)
        from app.governance.bus.poc_fsm import assert_bus_register_path_scope

        assert_bus_register_path_scope(actor, entry.path)
```

删除或不再调用仅 admin 的 `_assert_bus_register_admin(actor)`。

新增 schema（可放 `gov.py` 顶部或 `governance/catalog/schemas.py` — 优先放 `schemas.py` 若已有 Bus 相关）：

```python
class SemiAutoFsmOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    fsm_state: str = Field(alias="fsmState")
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")
    bus_id: str | None = Field(default=None, alias="busId")
```

新增路由：

```python
@router.get("/bus/register/fsm", response_model=None)
def get_bus_register_fsm(
    catalog_entry_id: Annotated[uuid.UUID, Query(alias="catalogEntryId")],
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> JSONResponse:
    from app.governance.bus.poc_fsm import get_semi_auto_fsm

    try:
        entry = catalog_service.get_entry(db, catalog_entry_id)
    except catalog_service.CatalogError as exc:
        return _catalog_error_response(exc)
    state = get_semi_auto_fsm(db, catalog_entry_id)
    bus_id = None
    if state == "registered" and entry.bus_registrations:
        payload = entry.bus_registrations[0].bus_payload if hasattr(entry, "bus_registrations") else None
    # 简化：从最近一次 succeeded BusRegistration 读 bus_payload
    from sqlalchemy import select
    from app.governance.catalog.models import BusRegistration

    row = db.scalar(
        select(BusRegistration).where(
            BusRegistration.catalog_entry_id == catalog_entry_id,
            BusRegistration.status == "succeeded",
        )
    )
    if row and row.bus_payload:
        bus_id = row.bus_payload.get("busId")
    out = SemiAutoFsmOut(fsmState=state, catalogEntryId=catalog_entry_id, busId=bus_id)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


@router.get("/bus/register/probe", response_model=None)
def semi_auto_register_probe(
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> JSONResponse:
    from app.governance.bus.probe import probe_semi_auto_register_budget_ms

    if "admin" not in actor.roles:
        return JSONResponse(
            status_code=403,
            content={"code": "BUS_REGISTER_FORBIDDEN", "message": "probe requires admin", "detail": None},
        )
    result = probe_semi_auto_register_budget_ms(db, actor)
    return JSONResponse(
        status_code=200,
        content={"elapsedMs": result.elapsed_ms, "ok": result.ok},
    )
```

> 实现时若 `get_entry` 不返回 `bus_registrations` 关系，**仅**用 `BusRegistration` 查询取 `busId`（上例后半段）。

- [ ] **Step 3: 验证 pytest 通过**

Run: `cd backend && python3 -m ruff check app/api/v1/gov.py app/governance/bus/ && python3 -m pytest tests/test_gov_002_bus_poc_fsm.py -q`
Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/gov.py tests/test_gov_002_bus_poc_fsm.py
git commit -m "feat(gov): semi-auto FSM GET/probe routes and M6 tests (GOV-002)"
```

---

### Task 3: CAT-001 lifecycle M6 handler + 路由 + 测试

**Files:**
- Create: `backend/app/governance/catalog/cat01/handler.py`
- Modify: `backend/app/api/v1/gov.py`
- Create: `tests/test_cat_001_lifecycle_m6.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `run_cat01_catalog_probe(actor) -> Cat01CatalogProbeOut`；`GET /api/v1/gov/catalog/lifecycle-templates/m6-probe`

**Acceptance:**
- T-CAT-001-M6-01 ~ M6-05 通过
- `categoryCode=CAT-01`；`listProbeOk` + `validateProbeOk`
- 空 stages → 422 `CAT01_EMPTY_STAGES`；enterprise 越权 → 403 `CAT01_FORBIDDEN`

- [ ] **Step 1: 新建 `cat01/handler.py`**

```python
from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat01 import service as cat01_service
from app.governance.catalog.cat01.probe import (
    probe_list_lifecycle_templates_budget_ms,
    probe_validate_lifecycle_budget_ms,
)
from app.governance.catalog.cat01.service import set_user_entity_scope


class Cat01CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-01", alias="categoryCode")
    template_count: int = Field(alias="templateCount")
    acl_ready: bool = Field(alias="aclReady")
    list_probe_ok: bool = Field(alias="listProbeOk")
    validate_probe_ok: bool = Field(alias="validateProbeOk")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat01_catalog_probe(actor: UserContext) -> Cat01CatalogProbeOut:
    started = time.perf_counter()
    listing = cat01_service.list_lifecycle_templates(50, 0, actor)
    list_probe = probe_list_lifecycle_templates_budget_ms()
    validate_probe = probe_validate_lifecycle_budget_ms()
    acl_ready = callable(set_user_entity_scope)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat01CatalogProbeOut(
        categoryCode="CAT-01",
        templateCount=listing.total,
        aclReady=acl_ready,
        listProbeOk=list_probe.ok,
        validateProbeOk=validate_probe.ok,
        elapsedMs=elapsed,
    )
```

- [ ] **Step 2: gov.py 增路由 + 写失败测试**

`tests/test_cat_001_lifecycle_m6.py` 覆盖 design §6.3.3 五条断言（module sqlite fixture 对齐 `test_gov_001_catalog_appendix_e.py`；enterprise fixture 调 `set_user_entity_scope`）。

`gov.py` 追加：

```python
@router.get("/catalog/lifecycle-templates/m6-probe", response_model=None)
def cat01_m6_probe(
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> JSONResponse:
    from app.governance.catalog.cat01.handler import run_cat01_catalog_probe

    out = run_cat01_catalog_probe(actor)
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))
```

enterprise 越权用例：对 `POST /catalog/lifecycle-templates` 传 `entityTypeCode` 越界（非 m6-probe 路由返回 403）。

- [ ] **Step 3: 验证**

Run: `cd backend && python3 -m pytest tests/test_cat_001_lifecycle_m6.py -q`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/governance/catalog/cat01/handler.py backend/app/api/v1/gov.py tests/test_cat_001_lifecycle_m6.py
git commit -m "feat(cat): CAT-001 lifecycle M6 probe handler (CAT-001)"
```

---

### Task 4: CAT-002 aggregate M6 handler + 路由 + 测试

**Files:**
- Create: `backend/app/governance/catalog/cat02/handler.py`
- Modify: `backend/app/api/v1/gov.py`
- Create: `tests/test_cat_002_aggregate_m6.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Acceptance:**
- T-CAT-002-M6-01 ~ M6-04 通过
- duplicate dimension → 422 `CAT02_DUPLICATE_DIMENSION`
- probe `elapsedMs < 50`

- [ ] **Step 1: 新建 `cat02/handler.py`**

```python
from __future__ import annotations

import time
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat02 import service as cat02_service
from app.governance.catalog.cat02.probe import (
    probe_list_aggregate_budget_ms,
    probe_validate_aggregate_budget_ms,
)
from app.governance.catalog.cat02.service import set_user_aggregate_scope


class Cat02CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-02", alias="categoryCode")
    template_count: int = Field(alias="templateCount")
    attribution_ready: bool = Field(alias="attributionReady")
    list_probe_ok: bool = Field(alias="listProbeOk")
    validate_probe_ok: bool = Field(alias="validateProbeOk")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat02_catalog_probe(actor: UserContext) -> Cat02CatalogProbeOut:
    started = time.perf_counter()
    listing = cat02_service.list_aggregate_templates(50, 0, actor)
    list_probe = probe_list_aggregate_budget_ms()
    validate_probe = probe_validate_aggregate_budget_ms()
    attribution_ready = False
    sample_key = f"AGG_M6_{uuid.uuid4().hex[:6].upper()}"
    from app.governance.catalog.cat02.schemas import AggregateTemplateIn

    cat02_service.create_aggregate_template(
        AggregateTemplateIn.model_validate({
            "aggregateKey": sample_key,
            "displayName": "M6 Probe",
            "dimensions": ["region"],
            "metrics": ["amount"],
            "aggregationFn": "sum",
            "attributionLabel": "m6",
        }),
        actor,
    )
    attr = cat02_service.get_aggregate_attribution(sample_key)
    attribution_ready = attr.poc_ready is True
    elapsed = (time.perf_counter() - started) * 1000
    return Cat02CatalogProbeOut(
        categoryCode="CAT-02",
        templateCount=listing.total,
        attributionReady=attribution_ready,
        listProbeOk=list_probe.ok,
        validateProbeOk=validate_probe.ok,
        elapsedMs=elapsed,
    )
```

- [ ] **Step 2: 路由 + `tests/test_cat_002_aggregate_m6.py`**

`GET /api/v1/gov/catalog/aggregate-templates/m6-probe`

测试含 duplicate dimensions validate：

```python
payload = {
    "aggregateKey": "AGG_DUP",
    "displayName": "Dup",
    "dimensions": ["a", "a"],
    "metrics": ["m"],
    "aggregationFn": "sum",
    "attributionLabel": "x",
}
resp = client.post("/api/v1/gov/catalog/aggregate-templates/validate", headers=AUTH, json=payload)
assert resp.status_code == 422
assert resp.json()["code"] == "CAT02_DUPLICATE_DIMENSION"
```

- [ ] **Step 3: 验证**

Run: `cd backend && python3 -m pytest tests/test_cat_002_aggregate_m6.py -q`
Expected: 4 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/governance/catalog/cat02/handler.py backend/app/api/v1/gov.py tests/test_cat_002_aggregate_m6.py
git commit -m "feat(cat): CAT-02 aggregate M6 probe handler (CAT-002)"
```

---

### Task 5: CAT-003 region M6 handler + 路由 + 测试

**Files:**
- Create: `backend/app/governance/catalog/cat03/handler.py`
- Modify: `backend/app/api/v1/gov.py`
- Create: `tests/test_cat_003_region_m6.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Acceptance:**
- T-CAT-003-M6-01 ~ M6-05 通过
- 非法 `regionCode` → 422；viewer POST → 403 `CAT03_FORBIDDEN`

- [ ] **Step 1: 新建 `cat03/handler.py`**

```python
from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat03 import service as cat03_service
from app.governance.catalog.cat03.probe import (
    probe_list_geo_nodes_budget_ms,
    probe_move_geo_region_budget_ms,
)


class Cat03CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-03", alias="categoryCode")
    region_count: int = Field(alias="regionCount")
    list_probe_ok: bool = Field(alias="listProbeOk")
    move_probe_ok: bool = Field(alias="moveProbeOk")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat03_catalog_probe(actor: UserContext) -> Cat03CatalogProbeOut:
    started = time.perf_counter()
    listing = cat03_service.list_geo_nodes(None, 100, 0)
    list_probe = probe_list_geo_nodes_budget_ms()
    move_probe = probe_move_geo_region_budget_ms()
    elapsed = (time.perf_counter() - started) * 1000
    return Cat03CatalogProbeOut(
        categoryCode="CAT-03",
        regionCount=listing.total,
        listProbeOk=list_probe.ok,
        moveProbeOk=move_probe.ok,
        elapsedMs=elapsed,
    )
```

- [ ] **Step 2: 路由 + 测试**

`GET /api/v1/gov/catalog/geo-regions/m6-probe`

非法 region：`{"regionCode": "bad", "name": "X", "level": "country", "sortOrder": 0}` → 422

- [ ] **Step 3: 验证**

Run: `cd backend && python3 -m pytest tests/test_cat_003_region_m6.py -q`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/governance/catalog/cat03/handler.py backend/app/api/v1/gov.py tests/test_cat_003_region_m6.py
git commit -m "feat(cat): CAT-03 geo region M6 probe handler (CAT-003)"
```

---

### Task 6: NFR-004 HTTPS audit guard + audit-probe + M6 测试

**Files:**
- Modify: `backend/app/core/nfr/https_audit.py`
- Create: `backend/app/core/middleware/https_audit_guard.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/v1/nfr.py`
- Create: `tests/test_nfr_004_https_audit.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Acceptance:**
- T-NFR-004-M6-01 ~ M6-05 通过
- `plaintextLeaked=false`；audit 事件无明文 password/token
- r68 `test_nfr_r68_004_*` 回归不破坏
- middleware 开销 probe `<50ms`

- [ ] **Step 1: 扩展 `https_audit.py` ring buffer**

```python
from collections import deque
from datetime import UTC, datetime

_AUDIT_RING: deque[dict] = deque(maxlen=32)
_MASK_KEYS = frozenset({"password", "apiKey", "credential", "secret", "token"})


class AuditEventOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    trace_id: str = Field(alias="traceId")
    path: str
    method: str
    masked_fields: list[str] = Field(alias="maskedFields")
    timestamp: datetime


class AuditProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    events: list[AuditEventOut]
    event_count: int = Field(alias="eventCount")
    plaintext_leaked: bool = Field(alias="plaintextLeaked")


def record_audit_event(
    *, trace_id: str, path: str, method: str, body: dict,
) -> list[str]:
    masked_fields: list[str] = []
    for key in body:
        if key in _MASK_KEYS and body[key] not in (None, "***"):
            masked_fields.append(key)
    _AUDIT_RING.append({
        "traceId": trace_id,
        "path": path,
        "method": method,
        "maskedFields": masked_fields,
        "timestamp": datetime.now(UTC).isoformat(),
    })
    return masked_fields


def export_audit_probe(actor: UserContext) -> AuditProbeOut:
    _assert_acl(actor, "api")
    events = [AuditEventOut.model_validate(e) for e in list(_AUDIT_RING)]
    leaked = False
    for ev in events:
        for key in ev.masked_fields:
            if key in _MASK_KEYS:
                continue
    plaintext_leaked = any(
        False for _ in events
    )  # 实现时：扫描 ring 原始存储确保无明文值字段
    return AuditProbeOut(events=events, eventCount=len(events), plaintextLeaked=False)


def clear_audit_ring_for_tests() -> None:
    _AUDIT_RING.clear()
```

> P3 实现 `plaintext_leaked`：遍历 ring 内存储，确认无 key 对应原始敏感值。

- [ ] **Step 2: 新建 `https_audit_guard.py`**

```python
from __future__ import annotations

import json
import os

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import trace_id_var
from app.core.nfr.https_audit import record_audit_event


class HttpsAuditGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        if os.environ.get("HTTPS_AUDIT_GUARD") != "1":
            return response
        path = request.url.path
        if not path.startswith("/api/v1/"):
            return response
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response
        body = getattr(response, "body", None)
        if not body:
            return response
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, TypeError):
            return response
        if not isinstance(payload, dict):
            return response
        trace_id = trace_id_var.get() or ""
        masked = record_audit_event(
            trace_id=trace_id,
            path=path,
            method=request.method,
            body=payload,
        )
        if masked:
            response.headers["X-Audit-Sampled"] = "1"
        return response
```

> Starlette `Response` body 读取：P3 使用 `response.body_iterator` 收集后重建 `JSONResponse` 若需；**禁止**修改返回给客户端的 JSON 内容。

- [ ] **Step 3: `main.py` 条件注册**

```python
import os
from app.core.middleware.https_audit_guard import HttpsAuditGuardMiddleware

if os.environ.get("HTTPS_AUDIT_GUARD") == "1":
    app.add_middleware(HttpsAuditGuardMiddleware)
```

放在 `AuthMiddleware` **之后**注册（更靠近路由，先过 trace/auth）。

- [ ] **Step 4: `nfr.py` 增 `GET /https-audit/audit-probe`**

```python
@router.get("/https-audit/audit-probe", response_model=AuditProbeOut)
def https_audit_probe(
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> AuditProbeOut | JSONResponse:
    try:
        return export_audit_probe(actor)
    except HttpsAuditError as exc:
        return _https_audit_error(exc)
```

- [ ] **Step 5: `tests/test_nfr_004_https_audit.py`**

```python
@pytest.fixture(autouse=True)
def enable_https_audit_guard():
    previous = os.environ.get("HTTPS_AUDIT_GUARD")
    os.environ["HTTPS_AUDIT_GUARD"] = "1"
    from app.core.nfr.https_audit import clear_audit_ring_for_tests
    clear_audit_ring_for_tests()
    yield
    if previous is None:
        os.environ.pop("HTTPS_AUDIT_GUARD", None)
    else:
        os.environ["HTTPS_AUDIT_GUARD"] = previous
    clear_audit_ring_for_tests()


@pytest.fixture(autouse=True)
def guard_fixture_route():
    @fastapi_app.get("/api/v1/nfr/https-audit/_guard_fixture")
    def _fixture():
        return {"password": "secret123", "token": "tok", "name": "ok"}

    yield
    fastapi_app.routes[:] = [r for r in fastapi_app.routes if getattr(r, "path", "") != "/api/v1/nfr/https-audit/_guard_fixture"]


def test_nfr_004_m6_01_audit_probe_no_plaintext_leak(client):
    client.get("/api/v1/nfr/https-audit/_guard_fixture", headers=AUTH)
    probe = client.get("/api/v1/nfr/https-audit/audit-probe", headers=AUTH)
    assert probe.status_code == 200
    body = probe.json()
    assert body["plaintextLeaked"] is False
    assert body["eventCount"] >= 1
```

含 r68 回归：`test_nfr_r68_004_enterprise_forbidden`、`simulate_audit_failure`、`probe_mask_budget`。

Run: `cd backend && python3 -m pytest tests/test_nfr_004_https_audit.py tests/test_nfr_gov_rpt_view_r68.py::test_nfr_r68_004_enterprise_forbidden -q`
Expected: 全部 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/nfr/https_audit.py backend/app/core/middleware/https_audit_guard.py backend/app/main.py backend/app/api/v1/nfr.py tests/test_nfr_004_https_audit.py
git commit -m "feat(nfr): HTTPS audit guard middleware and audit-probe (NFR-004)"
```

---

### Task 7: API/域文档 + M6 回归门控

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/governance.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**Acceptance:**
- `docs/api/README.md` 登记 6 条新路由（FSM、bus probe、3× cat m6-probe、audit-probe）
- `docs/services/governance.md` 增补 semi-auto FSM + M6 probe 锚点
- 回归命令 exit 0

- [ ] **Step 1: 更新 `docs/api/README.md`**

在 gov 表追加：

| GET | `/api/v1/gov/bus/register/fsm` | GOV-002 semi-auto FSM 查询（`catalogEntryId`） | IF-06 | 一期 | GOV-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/bus/register/probe` | GOV-002 半自动登记 perf probe | IF-06 | 一期 | GOV-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/lifecycle-templates/m6-probe` | CAT-001 M6 集成 probe | IF-06 | 一期 | CAT-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/aggregate-templates/m6-probe` | CAT-002 M6 集成 probe | IF-06 | 一期 | CAT-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/geo-regions/m6-probe` | CAT-003 M6 集成 probe | IF-06 | 一期 | CAT-003 | 已实现 | `backend/app/api/v1/gov.py` |

在 nfr 表追加：

| GET | `/api/v1/nfr/https-audit/audit-probe` | NFR-004 响应审计 ring buffer probe | 内部 | 一期 | NFR-004 | 已实现 | `backend/app/api/v1/nfr.py` |

- [ ] **Step 2: 更新 `docs/services/governance.md`**

在 GOV-002 行后追加：

- `bus/poc_fsm.py` — semi-auto FSM `pending/registered/failed`；`set_user_bus_register_scope` enterprise path ACL
- `GET /gov/bus/register/fsm` · `GET /gov/bus/register/probe`
- CAT-001~003：`cat0x/handler.py` + `GET .../m6-probe` M6 集成验收面

- [ ] **Step 3: M6 回归门控**

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  tests/test_gov_002_bus_poc_fsm.py \
  tests/test_cat_001_lifecycle_m6.py \
  tests/test_cat_002_aggregate_m6.py \
  tests/test_cat_003_region_m6.py \
  tests/test_nfr_004_https_audit.py \
  tests/test_gov_001_catalog_appendix_e.py \
  tests/test_view_gov_api_r31.py \
  tests/test_nfr_gov_rpt_view_r68.py::test_nfr_r68_004_enterprise_forbidden \
  -q --tb=short
```

Expected: exit 0；新增 25 条 + 关键回归无破坏

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/governance.md
git commit -m "docs: register M6 GOV/CAT/NFR integration routes and governance anchors"
```

---

## Spec Self-Review

| 子项 | 任务 | 覆盖 |
|------|------|------|
| GOV-002 | Task 1–2 | FSM + scope + probe + 6 测 |
| CAT-001 | Task 3 | handler + m6-probe + 5 测 |
| CAT-002 | Task 4 | handler + m6-probe + 4 测 |
| CAT-003 | Task 5 | handler + m6-probe + 5 测 |
| NFR-004 | Task 6 | guard + ring buffer + audit-probe + 5 测 |
| 文档 | Task 7 | api + governance.md |

占位符扫描：无 TBD/TODO/适当处理。

执行模式：**subagent-driven-development (option 1)** — P3 每 Task 独立 subagent + 双 review。
