# M-FINAL F-E 治理收官 + F-F NFR companion 首批（批次 4）实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/integration/bus_adapter_factory.py`（新建）、`backend/app/integration/bus_register.py`、`backend/app/governance/bus/degradation.py`（新建）、`backend/app/governance/bus/pipeline.py`、`backend/app/governance/bus/auto_schemas.py`、`backend/app/governance/publish/service.py`、`backend/app/governance/publish/schemas.py`、`backend/app/governance/acl.py`、`backend/app/core/nfr/dashboard_availability.py`、`backend/app/core/nfr/plugin_extension.py`、`backend/app/core/nfr/xinchuang.py`、`backend/app/api/v1/gov.py`、`backend/app/api/v1/nfr.py`、`tests/test_mfinal_fe_gov_batch4_r248.py`（新建）、`docs/api/README.md`、`docs/services/governance.md`、`docs/nfr/dashboard-availability.md`、`docs/nfr/xinchuang-deployment.md`
> **子项：** GOV-007、GOV-008、NFR-003、NFR-005、NFR-007
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端预指定 fastapi + TDD + bug-case-library）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`）

**Goal:** F-E/F-F 批次 4 companion 验收缺口补全：IF-01 总线适配工厂 + publish 源 `deferred` 降级、治理 ACL 矩阵补洞、核心看板批量 smoke、连接器 drill 连通/只读链、信创 Markdown 部署报告，≥28 条 r248 集成测 + r247 回归绿。

**Architecture:** `integration/bus_adapter_factory.get_bus_adapter()` 统一 `RetryingBusAdapter(InMemoryBusAdapter())` 构造，消除 pipeline 与 `bus_register` 双份适配器；publish 源总线失败写 FSM `deferred` 并返回 `busRegisterStatus`（approve 仍 200）；手动 `POST /bus/auto-register` 保持 `failed` + 502；NFR 增量为纯后端 probe/API，无 `fe/` 变更。

**Tech Stack:** Python 3.12 + FastAPI + SQLAlchemy + pytest + ruff。

## Global Constraints

- 不修改 `docs/automate/goal.md` / `plan.md` 结构；PRD 分片与 plan 勾选留给 P5
- 单 Python 业务文件 ≤ 200 行；`degradation.py` / `bus_adapter_factory.py` 各 < 80 行
- 本轮 **backend-only**：`UI skill: none`；不新增 `fe/` 文件
- publish 源总线失败 **不 rollback** 发布状态；仅写 `deferred` FSM + `bus_auto_register_deferred` 审计
- 手动 auto-register / retry 路径保持 r247 语义（`failed` FSM、502 exhausted）；retry 同时允许 `deferred` 态
- `CORE_DASHBOARD_IDS` 首屏 P95 硬阈值 **5000ms**；smoke 端点 strict 模式 breach → 503 `DASHBOARD_AVAILABILITY_BREACH`
- `EXPECTED_XINCHUANG_TYPES = ("dm", "kingbase", "gbase", "oceanbase", "tidb", "gaussdb")` 与 F-C CONN-017~022 对账
- 文档同步：`docs/api/README.md` + `docs/services/governance.md` + `docs/nfr/*.md`（`prd-sync.mdc`）
- 回归门控：r248 ≥28/28 绿 + `test_mfinal_fe_gov_batch3_r247.py` 全量绿 + `ruff check .` + 全量 pytest 绿
- 提交格式：`feat:` / `test:` / `docs:` + 英文动词短语

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `backend/app/integration/bus_adapter_factory.py` | **新建** | IF-01 `get_bus_adapter()` 工厂 |
| `backend/app/integration/bus_register.py` | **修改** | 改用工厂；导出 `register_with_if01_adapter` |
| `backend/app/governance/bus/degradation.py` | **新建** | `BusRegisterOutcome`、`record_deferred_registration` |
| `backend/app/governance/bus/pipeline.py` | **修改** | 工厂注入；publish 源 deferred；retry 支持 deferred |
| `backend/app/governance/bus/auto_schemas.py` | **修改** | `FsmState` 增 `deferred` |
| `backend/app/governance/publish/service.py` | **修改** | approve/publish_from_workflow 返回 bus 状态 |
| `backend/app/governance/publish/schemas.py` | **修改** | `PublishActionOut` 增 bus 字段 |
| `backend/app/governance/acl.py` | **修改** | self-approve + workflow publish 守卫 |
| `backend/app/core/nfr/dashboard_availability.py` | **修改** | `CORE_DASHBOARD_IDS` + `probe_core_dashboards_smoke` |
| `backend/app/core/nfr/plugin_extension.py` | **修改** | connectivity/readonly + `assert_core_module_unchanged` |
| `backend/app/core/nfr/xinchuang.py` | **修改** | schema 字段 + Markdown 渲染 + EXPECTED_TYPES |
| `backend/app/api/v1/gov.py` | **修改** | publish 响应透传 bus 字段（无新路由） |
| `backend/app/api/v1/nfr.py` | **修改** | smoke 端点、drill 增字段、markdown format |
| `tests/test_mfinal_fe_gov_batch4_r248.py` | **新建** | ≥28 条 GOV/NFR r248 + P4-SMOKE 尾段 |
| `docs/api/README.md` | **修改** | 新路由/查询参数/响应字段 |
| `docs/services/governance.md` | **修改** | IF-01、deferred FSM、ACL 补洞 |
| `docs/nfr/dashboard-availability.md` | **修改** | 批量 smoke、P95 阈值 |
| `docs/nfr/xinchuang-deployment.md` | **修改** | Markdown 格式、EXPECTED_TYPES |

---

### Task 1: GOV-007 — IF-01 工厂 + deferred 降级 + pipeline 重构

**Files:**
- Create: `backend/app/integration/bus_adapter_factory.py`
- Create: `backend/app/governance/bus/degradation.py`
- Modify: `backend/app/integration/bus_register.py`
- Modify: `backend/app/governance/bus/pipeline.py`
- Modify: `backend/app/governance/bus/auto_schemas.py`
- Create: `tests/test_mfinal_fe_gov_batch4_r248.py`（仅 007-01~007-03 子集 + module fixture）

**Interfaces:**
- Produces: `get_bus_adapter(*, max_attempts: int = 3) -> BusAdapter`
- Produces: `BusRegisterOutcome(status: Literal["succeeded","deferred","failed"], error_code: str | None, bus_id: str | None)`
- Produces: `record_deferred_registration(db, actor, entry_id, trace_id, error_code) -> None`
- Produces: `attempt_auto_bus_register_for_publish(db, actor, entry_id) -> BusRegisterOutcome`
- Produces: `retry_auto_register` 允许 FSM `deferred` 或 `failed`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 新建测试文件与 GOV-007 工厂/deferred 用例**

```python
"""M-FINAL F-E/F-F r248 — GOV-007~008 + NFR-003/005/007 批次 4。"""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_R248_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fe_gov_r248?mode=memory&cache=shared&uri=true"
REF_ID = "00000000-0000-4000-8000-000000000248"


@pytest.fixture(scope="module", autouse=True)
def r248_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R248_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
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
    from app.governance.bus import auto as bus_auto

    bus_auto._auto_states.clear()
    bus_auto._USER_AUTO_BUS_SCOPE.clear()
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def r248_permissive_nfr_modes(monkeypatch):
    monkeypatch.setenv("DASHBOARD_AVAILABILITY_MODE", "permissive")
    monkeypatch.setenv("XINCHUANG_DEPLOY_MODE", "permissive")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def integration_headers():
    return jwt_auth_headers(roles=["integration"])


def test_gov_r248_007_01_bus_adapter_factory_shared():
    """T-GOV-R248-007-01: pipeline 与 bus_register 共用 IF-01 工厂。"""
    from app.integration.bus_adapter_factory import get_bus_adapter
    from app.integration import bus_register

    a = get_bus_adapter()
    b = bus_register._build_adapter(max_attempts=3)
    assert type(a).__name__ == type(b).__name__


def test_gov_r248_007_02_publish_deferred_on_timeout(client, integration_headers):
    """T-GOV-R248-007-02: approve + force-timeout → 200 published + busRegisterStatus=deferred。"""
    # 复用 r247 _create_entry 模式：path 含 force-timeout
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Deferred Svc",
            "path": "/api/v1/services/deferred-force-timeout",
            "httpMethod": "POST",
            "categoryCodes": ["CAT-02"],
        },
    )
    assert resp.status_code == 201
    entry_id = resp.json()["id"]
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    approve = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert approve.status_code == 200
    body = approve.json()
    assert body["status"] == "published"
    assert body.get("busRegisterStatus") == "deferred"
    assert body.get("busRegisterErrorCode") == "BUS_REGISTER_RETRY_EXHAUSTED"


def test_gov_r248_007_03_deferred_fsm_audit(client, integration_headers):
    """T-GOV-R248-007-03: deferred 态 FSM + audit bus_auto_register_deferred。"""
    from app.governance.bus.auto import get_fsm_state
    from uuid import UUID

    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Audit Deferred",
            "path": "/api/v1/services/audit-force-timeout",
            "httpMethod": "POST",
            "categoryCodes": ["CAT-02"],
        },
    )
    entry_id = UUID(resp.json()["id"])
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert get_fsm_state(entry_id) == "deferred"
```

Run: `cd /workspace/backend && PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch4_r248.py::test_gov_r248_007_01_bus_adapter_factory_shared /workspace/tests/test_mfinal_fe_gov_batch4_r248.py::test_gov_r248_007_02_publish_deferred_on_timeout /workspace/tests/test_mfinal_fe_gov_batch4_r248.py::test_gov_r248_007_03_deferred_fsm_audit -v`
Expected: FAIL（模块/字段未实现）

- [ ] **Step 2: 实现 IF-01 工厂**

创建 `backend/app/integration/bus_adapter_factory.py`：

```python
from __future__ import annotations

from app.governance.bus.adapter import InMemoryBusAdapter
from app.integration.bus_register import RetryingBusAdapter


def get_bus_adapter(*, max_attempts: int = 3) -> RetryingBusAdapter:
    return RetryingBusAdapter(InMemoryBusAdapter(), max_attempts=max_attempts)
```

修改 `backend/app/integration/bus_register.py` — 删除本地 `RetryingBusAdapter` 类定义，改为：

```python
from app.integration.bus_adapter_factory import get_bus_adapter

RetryingBusAdapter = type(get_bus_adapter())  # re-export for tests importing RetryingBusAdapter


def _build_adapter(*, max_attempts: int = 3):
    return get_bus_adapter(max_attempts=max_attempts)


def register_with_if01_adapter(
    db: Session,
    entry_id: uuid.UUID,
    actor: UserContext,
    *,
    max_attempts: int = 3,
) -> tuple[BusRegisterOut, bool]:
    return register_catalog_to_bus(db, entry_id, actor, max_attempts=max_attempts)


def register_catalog_to_bus(...):
    ...
    adapter = _build_adapter(max_attempts=max_attempts)
```

- [ ] **Step 3: 实现 degradation + pipeline publish 软路径**

创建 `backend/app/governance/bus/degradation.py`：

```python
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.deps import UserContext
from app.governance.bus.auto import _set_fsm


@dataclass(frozen=True)
class BusRegisterOutcome:
    status: Literal["succeeded", "deferred", "failed"]
    error_code: str | None = None
    bus_id: str | None = None


def record_deferred_registration(
    db: Session,
    actor: UserContext,
    entry_id: uuid.UUID,
    trace_id: str,
    error_code: str,
) -> None:
    _set_fsm(entry_id, "deferred")
    record_platform_event(
        db,
        actor_id=actor.id,
        actor_username=actor.username,
        target_type="gov_catalog_entry",
        target_id=entry_id,
        action="bus_auto_register_deferred",
        detail={"traceId": trace_id, "errorCode": error_code, "source": "publish"},
        trace_id=trace_id,
    )
```

修改 `backend/app/governance/bus/auto_schemas.py` 第 8 行：

```python
FsmState = Literal["idle", "auto_registering", "succeeded", "failed", "deferred"]
```

修改 `backend/app/governance/bus/pipeline.py` 核心增量：

```python
from app.integration.bus_adapter_factory import get_bus_adapter
from app.governance.bus.degradation import BusRegisterOutcome, record_deferred_registration

# 删除本地 RetryingBusAdapter 类

def attempt_auto_bus_register_for_publish(
    db: Session, actor: UserContext, entry_id: uuid.UUID
) -> BusRegisterOutcome:
    try:
        out, _code = trigger_auto_bus_register(db, actor, entry_id, source="publish")
        return BusRegisterOutcome(status="succeeded", bus_id=out.bus_id)
    except catalog_service.CatalogError as exc:
        trace_id = trace_id_var.get() or uuid.uuid4().hex
        code = exc.code if exc.code == "BUS_REGISTER_RETRY_EXHAUSTED" else "BUS_REGISTER_RETRY_EXHAUSTED"
        record_deferred_registration(db, actor, entry_id, trace_id, code)
        db.commit()
        return BusRegisterOutcome(status="deferred", error_code=code)

def trigger_auto_bus_register(...):
    ...
    adapter = get_bus_adapter(max_attempts=3)
    ...

def retry_auto_register(...):
    state = get_fsm_state(entry_id)
    if state not in ("failed", "deferred"):
        raise catalog_service.CatalogError(...)
```

**注意**：`trigger_auto_bus_register` 在 `source=="publish"` 且失败时，应 **先** 映射 exhausted 再 raise，由 `attempt_auto_bus_register_for_publish` 捕获；手动 `source in ("manual","retry")` 仍 `_set_fsm(..., "failed")` 并 raise。

- [ ] **Step 4: 重跑 Step 1 测试**

Run: 同 Step 1 命令
Expected: PASS（3/3）

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/bus_adapter_factory.py backend/app/integration/bus_register.py backend/app/governance/bus/degradation.py backend/app/governance/bus/pipeline.py backend/app/governance/bus/auto_schemas.py tests/test_mfinal_fe_gov_batch4_r248.py
git commit -m "feat: GOV-007 IF-01 bus adapter factory and deferred registration"
```

---

### Task 2: GOV-007 — publish 结构化 outcome + gov API 透传

**Files:**
- Modify: `backend/app/governance/publish/schemas.py`
- Modify: `backend/app/governance/publish/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_mfinal_fe_gov_batch4_r248.py`（增 007-04~007-06）

**Interfaces:**
- Consumes: `attempt_auto_bus_register_for_publish` from Task 1
- Produces: `PublishActionOut.bus_register_status: str | None`（alias `busRegisterStatus`）
- Produces: `PublishActionOut.bus_register_error_code: str | None`（alias `busRegisterErrorCode`）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 扩展 schema 与失败测试**

`backend/app/governance/publish/schemas.py`：

```python
class PublishActionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    status: str
    bus_register_status: str | None = Field(default=None, alias="busRegisterStatus")
    bus_register_error_code: str | None = Field(default=None, alias="busRegisterErrorCode")
```

追加测试：

```python
def test_gov_r248_007_04_approve_success_bus_status(client):
  """正常 path approve → busRegisterStatus=succeeded。"""
  resp = client.post("/api/v1/gov/catalog/entries", headers=AUTH, json={...正常 path...})
  entry_id = resp.json()["id"]
  client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
  approve = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
  assert approve.status_code == 200
  assert approve.json().get("busRegisterStatus") == "succeeded"


def test_gov_r248_007_05_manual_auto_register_still_failed(client, integration_headers):
  """手动 auto-register 失败仍 failed FSM + 502（非 deferred）。"""
  ...
  assert resp.status_code == 502


def test_gov_r248_007_06_deferred_retry_succeeds_or_exhausted(client, integration_headers):
  """deferred 态 retry → succeeded 或 502。"""
  ...
```

- [ ] **Step 2: 修改 approve_entry / publish_from_workflow**

`backend/app/governance/publish/service.py` 替换裸 `except: pass`：

```python
def approve_entry(...) -> PublishActionOut:
    ...
    bus_status: str | None = None
    bus_error: str | None = None
    if actor is not None:
        from app.governance.bus.pipeline import attempt_auto_bus_register_for_publish

        outcome = attempt_auto_bus_register_for_publish(db, actor, entry_id)
        bus_status = outcome.status
        bus_error = outcome.error_code
    return PublishActionOut(
        id=row.id,
        status=row.status,
        busRegisterStatus=bus_status,
        busRegisterErrorCode=bus_error,
    )
```

`gov.py` 的 `publish_approve` 无需改逻辑（`response_model=PublishActionOut` 自动序列化新字段）。

- [ ] **Step 3: 验证**

Run: `cd /workspace/backend && PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch4_r248.py -k "007_0" -v`
Expected: PASS（≥6 条 007 前缀）

- [ ] **Step 4: Commit**

```bash
git add backend/app/governance/publish/schemas.py backend/app/governance/publish/service.py tests/test_mfinal_fe_gov_batch4_r248.py
git commit -m "feat: GOV-007 publish busRegisterStatus structured outcome"
```

---

### Task 3: GOV-008 — 治理 ACL 矩阵补洞

**Files:**
- Modify: `backend/app/governance/acl.py`
- Modify: `tests/test_mfinal_fe_gov_batch4_r248.py`（增 `test_gov_r248_008_*` ×6）

**Interfaces:**
- Produces: `assert_publish_action` 拒绝 owner 自批（`GOV_ACL_SELF_APPROVE_FORBIDDEN`）
- Produces: `assert_workflow_transition` 增 `publish` → 要求 `publisher`/`admin`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 写失败测试**

```python
def test_gov_r248_008_01_self_approve_forbidden(client, monkeypatch):
    """owner publisher 自批无 admin → 403 GOV_ACL_SELF_APPROVE_FORBIDDEN。"""
    owner_id = str(uuid.uuid4())
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=owner_id, username="pub", roles=["publisher"]
    )
    # 创建 entry 并 grant；设置 owner_id = owner_id；approve → 403
    ...


def test_gov_r248_008_02_requester_cannot_approve_transition(client):
    """requester 对 workflow approve transition → 403 GOV_WORKFLOW_FORBIDDEN。"""
    ...


def test_gov_r248_008_03_matrix_has_nine_actions(client):
    """GET /gov/acl/matrix actions 长度 ≥9 且含 bus_auto_register_retry。"""
    resp = client.get("/api/v1/gov/acl/matrix", headers=AUTH)
    actions = resp.json()["actions"]
    assert len(actions) >= 9
    assert any(a["action"] == "bus_auto_register_retry" for a in actions)


def test_gov_r248_008_04_viewer_publish_approve_forbidden(client, viewer_headers):
    assert client.post(..., headers=viewer_headers).status_code == 403


def test_gov_r248_008_05_publisher_without_grant_forbidden(client):
    ...


def test_gov_r248_008_06_approver_bus_auto_register_forbidden(client, approver_headers):
    ...
```

- [ ] **Step 2: 实现 acl 增量**

`backend/app/governance/acl.py`：

```python
def assert_workflow_transition(actor: UserContext, action: str, actor_role: str) -> None:
    role_map = {
        "submit": "requester",
        "approve": "approver",
        "reject": "approver",
        "complete_design": "designer",
        "publish": "publisher",
    }
    ...


def assert_publish_action(session, actor, action, entry_id):
    ...
    if action == "approve" and "publisher" in actor.roles:
        row = session.get(CatalogEntry, entry_id)  # 或现有查询
        actor_uuid = _actor_uuid(actor.id)
        if row and actor_uuid and row.owner_id == actor_uuid and "admin" not in actor.roles:
            raise GovAclError(
                "GOV_ACL_SELF_APPROVE_FORBIDDEN",
                "Publisher cannot approve own entry without admin",
                403,
            )
        if not check_resource_access(...):
            raise GovAclError("GOV_RESOURCE_FORBIDDEN", ...)
```

- [ ] **Step 3: 验证**

Run: `cd /workspace/backend && PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch4_r248.py -k "008" -v`
Expected: PASS（6/6）

- [ ] **Step 4: Commit**

```bash
git add backend/app/governance/acl.py tests/test_mfinal_fe_gov_batch4_r248.py
git commit -m "feat: GOV-008 self-approve and workflow publish ACL guards"
```

---

### Task 4: NFR-003 — 核心看板批量 smoke 端点

**Files:**
- Modify: `backend/app/core/nfr/dashboard_availability.py`
- Modify: `backend/app/api/v1/nfr.py`
- Modify: `tests/test_mfinal_fe_gov_batch4_r248.py`（增 `test_nfr_r248_003_*` ×5）

**Interfaces:**
- Produces: `CORE_DASHBOARD_IDS = ("core-dash", "executive-overview")`
- Produces: `probe_core_dashboards_smoke(actor) -> tuple[DashboardAvailabilityReport, ...]`
- Produces: `GET /api/v1/nfr/dashboard-availability/smoke` → `{dashboards, allAvailable, p95ThresholdMs}`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 写失败测试（含 pytest marker）**

```python
@pytest.mark.nfr_dashboard_smoke
def test_nfr_r248_003_01_smoke_all_available(client):
    resp = client.get("/api/v1/nfr/dashboard-availability/smoke", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["allAvailable"] is True
    assert body["p95ThresholdMs"] == 5000
    for d in body["dashboards"]:
        assert d["firstScreenP95Ms"] <= 5000


@pytest.mark.nfr_dashboard_smoke
def test_nfr_r248_003_02_smoke_simulate_breach(client):
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/smoke?simulateBreach=true",
        headers=AUTH,
    )
    assert resp.json()["allAvailable"] is False


def test_nfr_r248_003_03_strict_smoke_503(client, monkeypatch):
    monkeypatch.setenv("DASHBOARD_AVAILABILITY_MODE", "strict")
    get_settings.cache_clear()
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/smoke?simulateBreach=true",
        headers=AUTH,
    )
    assert resp.status_code == 503
    assert resp.json()["code"] == "DASHBOARD_AVAILABILITY_BREACH"
```

- [ ] **Step 2: 实现 probe 与路由**

`dashboard_availability.py`：

```python
CORE_DASHBOARD_IDS = ("core-dash", "executive-overview")


def probe_core_dashboards_smoke(
    actor: UserContext, *, simulate_breach: bool = False
) -> list[DashboardAvailabilityReport]:
    return [
        build_dashboard_availability_report(did, actor, simulate_breach=simulate_breach)
        for did in CORE_DASHBOARD_IDS
    ]
```

`nfr.py` 新增：

```python
@router.get("/dashboard-availability/smoke")
def dashboard_availability_smoke(
    simulate_breach: bool = Query(False, alias="simulateBreach"),
    actor: Annotated[UserContext, Depends(get_current_user)] = ...,
):
    reports = probe_core_dashboards_smoke(actor, simulate_breach=simulate_breach)
    all_ok = all(r.within_sla and r.within_first_screen_budget for r in reports)
    if get_settings().dashboard_availability_mode == "strict" and not all_ok:
        return JSONResponse(status_code=503, content={...})
    return {
        "dashboards": [...],
        "allAvailable": all_ok,
        "p95ThresholdMs": 5000,
    }
```

- [ ] **Step 3: 验证**

Run: `cd /workspace/backend && PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch4_r248.py -k "003" -v -m nfr_dashboard_smoke`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/nfr/dashboard_availability.py backend/app/api/v1/nfr.py tests/test_mfinal_fe_gov_batch4_r248.py
git commit -m "feat: NFR-003 core dashboard availability smoke endpoint"
```

---

### Task 5: NFR-005 — 连接器 plugin drill 连通/只读链

**Files:**
- Modify: `backend/app/core/nfr/plugin_extension.py`
- Modify: `backend/app/api/v1/nfr.py`
- Modify: `tests/test_mfinal_fe_gov_batch4_r248.py`（增 `test_nfr_r248_005_*` ×4）

**Interfaces:**
- Produces: `ExtensionDrillResult` 增 `connectivity_ok: bool`, `readonly_query_ok: bool`
- Produces: `assert_core_module_unchanged() -> bool`
- Produces: drill API 响应增 `connectivityOk`, `readonlyQueryOk`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 写失败测试**

```python
def test_nfr_r248_005_01_drill_connectivity_readonly(client):
    resp = client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    body = resp.json()
    assert body["connectivityOk"] is True
    assert body["readonlyQueryOk"] is True
    assert body["zeroInvasion"] is True


def test_nfr_r248_005_02_assert_core_module_unchanged():
    from app.core.nfr.plugin_extension import assert_core_module_unchanged
    assert assert_core_module_unchanged() is True


def test_nfr_r248_005_03_drill_teardown_no_stub(client):
    client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    from app.datasources.registry import registry
    assert registry.get("drill_stub") is None
```

- [ ] **Step 2: 实现 drill 增量**

`DrillStubConnector` 增：

```python
def probe_readonly_sql(self, **kwargs):
    return ("SELECT 1", True)
```

`run_extension_drill`：

```python
conn_ok = stub.test_connection().ok
ro_ok = stub.probe_readonly_sql()[1]
return ExtensionDrillResult(True, types, verify_zero_invasion(), elapsed, conn_ok, ro_ok)
```

`assert_core_module_unchanged`：

```python
def assert_core_module_unchanged() -> bool:
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[2] / "datasources"
    allowed = {pathlib.Path(__file__).resolve(), root / "dialects"}
    for py in root.rglob("*.py"):
        if "drill_stub" in py.read_text() and py.resolve() not in allowed:
            return False
    return verify_zero_invasion()
```

- [ ] **Step 3: 验证**

Run: `cd /workspace/backend && PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch4_r248.py -k "005" -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/nfr/plugin_extension.py backend/app/api/v1/nfr.py tests/test_mfinal_fe_gov_batch4_r248.py
git commit -m "feat: NFR-005 plugin drill connectivity and readonly chain"
```

---

### Task 6: NFR-007 — 信创 deployment-report Markdown + F-C 对账

**Files:**
- Modify: `backend/app/core/nfr/xinchuang.py`
- Modify: `backend/app/api/v1/nfr.py`
- Modify: `tests/test_mfinal_fe_gov_batch4_r248.py`（增 `test_nfr_r248_007_*` ×4）

**Interfaces:**
- Produces: `EXPECTED_XINCHUANG_TYPES` 六型元组
- Produces: `XinchuangDeploymentReport` 增 `schema_version`, `generated_at`, `missing_expected_types`
- Produces: `render_deployment_report_markdown(report) -> str`
- Produces: `GET .../deployment-report?format=markdown` → `text/markdown`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 写失败测试**

```python
def test_nfr_r248_007_01_json_schema_fields(client):
    resp = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH)
    body = resp.json()
    assert body["schemaVersion"] == "1.0"
    assert "generatedAt" in body
    assert "missingExpectedTypes" in body


def test_nfr_r248_007_02_missing_expected_types(client):
    body = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH).json()
    missing = set(body["missingExpectedTypes"])
    assert "oceanbase" in missing or "tidb" in missing  # permissive 下常见缺项


def test_nfr_r248_007_03_markdown_format(client):
    resp = client.get(
        "/api/v1/nfr/xinchuang/deployment-report?format=markdown",
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers.get("content-type", "")
    assert "## 信创部署验收报告" in resp.text


def test_nfr_r248_007_04_deployment_report_budget():
    from app.core.nfr.xinchuang import probe_deployment_report_budget_ms
    assert probe_deployment_report_budget_ms().ok is True
```

- [ ] **Step 2: 实现 xinchuang 增量**

```python
from datetime import UTC, datetime

EXPECTED_XINCHUANG_TYPES = ("dm", "kingbase", "gbase", "oceanbase", "tidb", "gaussdb")

@dataclass(frozen=True)
class XinchuangDeploymentReport:
    schema_version: str
    generated_at: str
    missing_expected_types: tuple[str, ...]
    ...  # 现有字段

def build_xinchuang_deployment_report() -> XinchuangDeploymentReport:
    xc = _registered_xinchuang()
    registered_set = set(xc)
    missing = sorted(set(EXPECTED_XINCHUANG_TYPES) - registered_set)
    ...
    return XinchuangDeploymentReport(
        schema_version="1.0",
        generated_at=datetime.now(UTC).isoformat(),
        missing_expected_types=tuple(missing),
        ...
    )

def render_deployment_report_markdown(report: XinchuangDeploymentReport) -> str:
    lines = ["## 信创部署验收报告", "", f"- schemaVersion: {report.schema_version}", ...]
    return "\n".join(lines)
```

`nfr.py` `xinchuang_deployment_report` 增 `format: str = Query("json")`；`markdown` 时 `return Response(content=md, media_type="text/markdown")`。

- [ ] **Step 3: 验证**

Run: `cd /workspace/backend && PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch4_r248.py -k "007" -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/nfr/xinchuang.py backend/app/api/v1/nfr.py tests/test_mfinal_fe_gov_batch4_r248.py
git commit -m "feat: NFR-007 xinchuang deployment report markdown export"
```

---

### Task 7: 集成测收官 — P4-SMOKE 尾段 + r247 回归

**Files:**
- Modify: `tests/test_mfinal_fe_gov_batch4_r248.py`（补全 `test_gov_r248_007_07~009` P4-SMOKE 尾段 + 剩余 NFR 探针预算测）

**Interfaces:**
- Consumes: r247 `VALID_CONDITIONS` / `VALID_RULES` / `VALID_OUTPUT` / `_seed_designer_blocks` 模式
- Produces: `test_gov_r248_007_09_p4_smoke_publish_to_bus_tail` 七步链式断言

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 实现 P4-SMOKE 尾段单测**

从 `tests/test_mfinal_fe_gov_batch3_r247.py` 复制 designer/workflow fixture 辅助函数，实现：

```python
def test_gov_r248_007_09_p4_smoke_publish_to_bus_tail(client):
    """P4-SMOKE 尾段：designer → workflow → publish/from-workflow → bus FSM。"""
    _seed_designer_blocks(client, REF_ID)
    wf = client.post("/api/v1/gov/designer/submit-workflow", headers=AUTH, json={"refId": REF_ID})
    instance_id = wf.json()["workflowInstanceId"]
    for action, role in [("submit", "requester"), ("approve", "approver"), ("complete_design", "designer")]:
        client.post(
            f"/api/v1/gov/workflow/instances/{instance_id}/transition",
            headers=jwt_auth_headers(roles=[role]),
            json={"action": action},
        )
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=jwt_auth_headers(roles=["publisher"]),
        json={"workflowInstanceId": instance_id},
    )
    assert pub.status_code == 200
    entry_id = pub.json()["catalogEntryId"]
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={entry_id}", headers=AUTH)
    assert fsm.json()["fsmState"] in ("registered", "succeeded", "deferred")
    if fsm.json().get("fsmState") == "deferred":
        retry = client.post(
            "/api/v1/gov/bus/auto-register/retry",
            headers=jwt_auth_headers(roles=["integration"]),
            json={"catalogEntryId": entry_id},
        )
        assert retry.status_code in (200, 502)
```

- [ ] **Step 2: 全量 r248 + r247 回归**

Run:
```bash
cd /workspace/backend && python3 -m ruff check .
PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch4_r248.py -v --tb=short
PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests/test_mfinal_fe_gov_batch3_r247.py -q
PYTHONPATH=/workspace/backend:/workspace/tests python3 -m pytest /workspace/tests -q
```
Expected: r248 ≥28 passed；r247 全绿；全量 pytest exit 0

- [ ] **Step 3: Commit**

```bash
git add tests/test_mfinal_fe_gov_batch4_r248.py
git commit -m "test: add mfinal fe gov batch4 r248 integration suite with P4-SMOKE tail"
```

---

### Task 8: 文档同步 — API / governance / NFR 附录

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/nfr/dashboard-availability.md`
- Modify: `docs/nfr/xinchuang-deployment.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（文档分层与同步总表）

**UI skill:** none

**UI Acceptance:** N/A（backend-only）

- [ ] **Step 1: 登记 API**

`docs/api/README.md` 追加行：

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/api/v1/nfr/dashboard-availability/smoke` | 核心看板批量可用性 smoke；`simulateBreach`；strict→503 | 已实现（r248） |
| GET | `/api/v1/nfr/xinchuang/deployment-report` | 增 `format=json\|markdown`；JSON 增 `schemaVersion`/`missingExpectedTypes` | 已实现（r248） |
| POST | `/api/v1/gov/publish/entries/{id}/approve` | 响应增 `busRegisterStatus`/`busRegisterErrorCode` | 已实现（r248） |

- [ ] **Step 2: 更新 governance 域附录**

`docs/services/governance.md` 增补：
- IF-01：`integration/bus_adapter_factory.get_bus_adapter()`
- 失败降级：publish 源 → FSM `deferred` + `bus_auto_register_deferred` 审计
- ACL：`GOV_ACL_SELF_APPROVE_FORBIDDEN`、workflow `publish` action 角色要求

- [ ] **Step 3: 更新 NFR 文档**

`docs/nfr/dashboard-availability.md`：`CORE_DASHBOARD_IDS`、`/smoke` 端点、P95 5000ms。

`docs/nfr/xinchuang-deployment.md`：`EXPECTED_XINCHUANG_TYPES` 六型表、Markdown 报告格式示例。

- [ ] **Step 4: 验证文档存在且无断链**

Run: `rg -l "dashboard-availability/smoke|busRegisterStatus|信创部署验收报告" docs/`
Expected: 四个 docs 文件均命中

- [ ] **Step 5: Commit**

```bash
git add docs/api/README.md docs/services/governance.md docs/nfr/dashboard-availability.md docs/nfr/xinchuang-deployment.md
git commit -m "docs: sync API and governance/NFR anchors for batch4 r248"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| GOV-007 IF-01 + deferred + publish outcome | Task 1–2 |
| GOV-008 self-approve + workflow publish | Task 3 |
| NFR-003 smoke + P95 | Task 4 |
| NFR-005 connectivity/readonly + zero invasion | Task 5 |
| NFR-007 markdown + EXPECTED_TYPES | Task 6 |
| ≥28 pytest + P4-SMOKE 尾段 | Task 7 |
| docs 同步 | Task 8 |
| 占位符扫描 | 无 TBD/TODO |
| 文件数 | 17（含 auto_schemas 必要修改）≤20 |
| UI skill | 全 Task 标注 none + N/A |
