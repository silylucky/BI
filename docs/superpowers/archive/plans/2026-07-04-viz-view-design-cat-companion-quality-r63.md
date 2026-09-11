# 跨域 companion 质量推分 r63 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/viz/sdk_portal/` · `backend/app/views/` · `backend/app/designer/workflow.py` · `backend/app/governance/catalog/cat05/` · `backend/app/api/v1/{charts,views,designer,gov}.py` · `tests/test_viz_view_design_cat_r63.py` · `docs/services/{viz,views,designer,governance}.md`
> **子项：** VIZ-007, VIEW-002, DESIGN-004, CAT-005, VIEW-003
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 闭合 r59–r61 L1 后遗留的性能 58% 与完整度 74–76% 薄弱维——五域 companion `probe_*_budget_ms`（≤50ms）、ACL/bounds/cycle/404 边界 + ≥32 条 `test_viz_view_design_cat_r63`；五 PRD ID 加权总分 **≥90**。

**Architecture:** 域逻辑留在 `viz/sdk_portal/`、`views/`、`designer/workflow.py`、`governance/catalog/cat05/`；`api/v1/*.py` 仅薄 entry 透传 actor/user；`views/probe.py` 供 VIEW-002/003 共享；内存 store 惯例（非 Alembic）。纯后端、无 `fe/`。

**Tech Stack:** Python 3.11 / FastAPI / Pydantic v2 / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**、**UI Acceptance: N/A**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构；PRD 分片勾选与 8 维重评留 **P5**。
- **分层纪律**（`common.mdc`）：domain 写业务；`api/v1/*.py` = entry（不写守卫细节）。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；鉴权 403；未找到 404。
- **perf probe 预算**：各域 `probe_*_budget_ms` 同进程 `time.perf_counter`，阈值 **50ms**（无真实网络）。
- **鉴权**：路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/services/` > `docs/api/README.md`。
- **验证基线**（r62 P5）：`cd backend && python3 -m pytest -q` ≈ **1622 passed** / 4 skipped；本轮目标 **≥1654 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（Task 7 / P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_viz_view_design_cat_r63.py \
    ../tests/test_cat_nfr_rpt_meta_r62.py \
    ../tests/test_cat_dash_viz_nfr_r61.py \
    ../tests/test_rpt_view_cat_gov_r60.py \
    -v && python3 -m pytest -q
  ```
  Expected: r63 **≥32/32** + r62 **32/32** + r61 **32/32** + r60 **34/34**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/viz/sdk_portal/probe.py` | VIZ-007 validate + lifecycle perf probe | 新建 |
| `backend/app/viz/sdk_portal/errors.py` | `VIZ_SDK_*` 错误码常量 | 修改 |
| `backend/app/viz/sdk_portal/service.py` | token 必填、duplicate origin、lifecycle ACL | 修改 |
| `backend/app/views/probe.py` | VIEW-002 resolve + VIEW-003 create perf probe | 新建 |
| `backend/app/views/role_template.py` | `maxWidgetCount` [1,64] 域校验 | 修改 |
| `backend/app/views/user_override.py` | get by id、dashboard 404、cycle 路径 | 修改 |
| `backend/app/designer/workflow.py` | catalog/designType 守卫 + workflow probe | 修改 |
| `backend/app/governance/catalog/cat05/errors.py` | `CAT05_FORBIDDEN` 常量 | 修改 |
| `backend/app/governance/catalog/cat05/service.py` | ticket ACL + stats probe | 修改 |
| `backend/app/api/v1/charts.py` | lifecycle actor 透传 + SdkPortalError 映射 | 修改 |
| `backend/app/api/v1/views.py` | GET `/users/me/views/{view_id}`；RoleDefaultViewsIn 放宽 Pydantic 边界 | 修改 |
| `backend/app/api/v1/designer.py` | catalog mismatch 错误映射（已有 `_designer_error` 复用） | 修改 |
| `backend/app/api/v1/gov.py` | ticket create/stats 传入 `UserContext` | 修改 |
| `tests/test_viz_view_design_cat_r63.py` | 新套件 ≥32 断言 | 新建 |
| `docs/services/viz.md` | sdk_portal probe/ACL 登记 | 修改 |
| `docs/services/views.md` | bounds/probe/GET by id | 修改 |
| `docs/services/designer.md` | workflow-link companion | 修改 |
| `docs/services/governance.md` | cat05 ACL 登记 | 修改 |
| `docs/api/README.md` | GET `/api/v1/users/me/views/{view_id}` 一行登记 | 修改 |

预估 **P3 生产代码 13** + **测试 1** + **docs 5** = **19 ≤ 20**。

---

### Task 1: r63 共享夹具与测试脚手架

**Files:**
- Create: `tests/test_viz_view_design_cat_r63.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: module-scoped sqlite fixture、`client`/`viewer_user`/`enterprise_user` fixtures、`_create_dashboard`、`_sdk_init_payload`、`_ticket_payload`、`_publish_workflow_instance` helpers；`test_r63_fixture_bootstraps` 绿灯。

- [ ] **Step 1: 写入夹具与 bootstrap 测**

```python
"""跨域 companion 质量推分 r63 — VIZ/VIEW/DESIGN/CAT."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R63_SQLITE_URL = "sqlite+pysqlite:///file:viz_view_design_cat_r63?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r63_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_nfr08 = os.environ.get("NFR08_RUNTIME_MODE")
    os.environ["DATABASE_URL"] = _R63_SQLITE_URL
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
        return UserContext(id="viewer-r63", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat05 import service as cat05_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r63", username="enterprise", roles=["enterprise"])

    cat05_service.set_user_ticket_scope("enterprise-r63", "TICKET-DEFAULT")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R63 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r63 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _sdk_init_payload(target_id: str | None = None) -> dict:
    return {
        "appId": "portal-demo",
        "targetType": "chart",
        "targetId": target_id or str(uuid.uuid4()),
        "authMode": "token",
        "embedToken": "tok-demo",
        "allowedOrigins": ["https://portal.example.com"],
        "lifecycleHooks": {"onInit": True, "onDestroy": True},
    }


def _ticket_payload(key: str = "TICKET_OPS") -> dict:
    return {
        "ticketCategoryKey": key,
        "displayName": "Ops Tickets",
        "statusFilters": ["open", "pending"],
        "tableRef": "stub.tickets",
        "allowedRoles": ["analyst"],
    }


def _create_workflow_instance(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _publish_workflow_instance(client: TestClient, instance_id: str) -> None:
    for action, role in [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{instance_id}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text


def test_r63_fixture_bootstraps(client):
    """T-R63-000-01: r63 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200
```

- [ ] **Step 2: 运行 bootstrap 测**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py::test_r63_fixture_bootstraps -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_viz_view_design_cat_r63.py
git commit -m "test(r63): add shared fixtures scaffold for companion quality"
```

---

### Task 2: VIZ-007 — SDK 门户 probe + lifecycle ACL

**Files:**
- Create: `backend/app/viz/sdk_portal/probe.py`
- Modify: `backend/app/viz/sdk_portal/errors.py`
- Modify: `backend/app/viz/sdk_portal/service.py`
- Modify: `backend/app/api/v1/charts.py`
- Test: `tests/test_viz_view_design_cat_r63.py`（追加 VIZ-007 用例）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: Task 1 fixtures
- Produces: `probe_validate_sdk_budget_ms(payload) -> SdkPortalProbeResult`；`probe_lifecycle_budget_ms(phase, actor) -> SdkPortalProbeResult`；`validate_sdk_init` 抛出 `VIZ_SDK_TOKEN_REQUIRED`/`VIZ_SDK_DUPLICATE_ORIGIN`；`lifecycle_manifest(payload, actor)` destroy 阶段 ACL `VIZ_SDK_FORBIDDEN`

- [ ] **Step 1: 写入失败测试（VIZ-007）**

在 `tests/test_viz_view_design_cat_r63.py` 追加：

```python
def test_viz_r63_007_probe_validate_under_budget():
    """T-VIZ-R63-007-01: probe_validate_sdk_budget_ms < 50ms。"""
    from app.viz.sdk_portal.probe import probe_validate_sdk_budget_ms
    from app.viz.sdk_portal.schemas import SdkPortalInitIn

    payload = SdkPortalInitIn.model_validate(_sdk_init_payload())
    result = probe_validate_sdk_budget_ms(payload)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_viz_r63_007_probe_lifecycle_under_budget():
    """T-VIZ-R63-007-02: probe_lifecycle_budget_ms init < 50ms。"""
    from app.auth.deps import UserContext
    from app.viz.sdk_portal.probe import probe_lifecycle_budget_ms

    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_lifecycle_budget_ms("init", actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_viz_r63_007_token_required_422(client):
    """T-VIZ-R63-007-03: auth_mode=token 无 embedToken → 422 VIZ_SDK_TOKEN_REQUIRED。"""
    payload = _sdk_init_payload()
    payload.pop("embedToken", None)
    resp = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIZ_SDK_TOKEN_REQUIRED"


def test_viz_r63_007_duplicate_origin_422(client):
    """T-VIZ-R63-007-04: duplicate allowedOrigins → 422 VIZ_SDK_DUPLICATE_ORIGIN。"""
    payload = _sdk_init_payload()
    payload["allowedOrigins"] = ["https://a.example.com", "https://a.example.com"]
    resp = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIZ_SDK_DUPLICATE_ORIGIN"


def test_viz_r63_007_lifecycle_destroy_forbidden_viewer(client, viewer_user):
    """T-VIZ-R63-007-05: viewer lifecycle destroy → 403 VIZ_SDK_FORBIDDEN。"""
    resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "destroy"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "VIZ_SDK_FORBIDDEN"


def test_viz_r63_007_lifecycle_destroy_admin_ok(client):
    """T-VIZ-R63-007-06: admin lifecycle destroy 仍 200。"""
    resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "destroy"})
    assert resp.status_code == 200
    assert resp.json()["phase"] == "destroy"


def test_viz_r63_007_r61_regression_subset(client):
    """T-VIZ-R63-007-07: r61 validate/capabilities 子集回归。"""
    ok = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=_sdk_init_payload())
    assert ok.status_code == 200
    caps = client.get("/api/v1/charts/sdk/capabilities", headers=AUTH)
    assert caps.status_code == 200
    assert "chart" in caps.json()["targetTypes"]


def test_viz_r63_007_lifecycle_destroy_editor_ok(client):
    """T-VIZ-R63-007-08: editor lifecycle destroy 200。"""
    async def _override() -> UserContext:
        return UserContext(id="editor-r63", username="editor", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    try:
        resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "destroy"})
        assert resp.status_code == 200
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "viz_r63_007" -v`
Expected: FAIL（probe 模块缺失 / 错误码未实现）

- [ ] **Step 3: 实现域代码**

`backend/app/viz/sdk_portal/errors.py` 追加常量：

```python
VIZ_SDK_TOKEN_REQUIRED = "VIZ_SDK_TOKEN_REQUIRED"
VIZ_SDK_DUPLICATE_ORIGIN = "VIZ_SDK_DUPLICATE_ORIGIN"
VIZ_SDK_FORBIDDEN = "VIZ_SDK_FORBIDDEN"
```

`backend/app/viz/sdk_portal/probe.py`（新建）：

```python
from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.viz.sdk_portal.errors import SdkPortalError
from app.viz.sdk_portal.schemas import LifecyclePhase, SdkLifecycleIn, SdkPortalInitIn
from app.viz.sdk_portal.service import lifecycle_manifest, validate_sdk_init

probe_sdk_validate_budget_ms = 50
probe_sdk_lifecycle_budget_ms = 50


@dataclass(frozen=True)
class SdkPortalProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_sdk_budget_ms(payload: SdkPortalInitIn) -> SdkPortalProbeResult:
    started = time.perf_counter()
    try:
        validate_sdk_init(payload)
        ok = True
    except SdkPortalError:
        ok = False
    return SdkPortalProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)


def probe_lifecycle_budget_ms(phase: LifecyclePhase, actor: UserContext) -> SdkPortalProbeResult:
    started = time.perf_counter()
    try:
        lifecycle_manifest(SdkLifecycleIn(phase=phase), actor)
        ok = True
    except SdkPortalError:
        ok = False
    return SdkPortalProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
```

`backend/app/viz/sdk_portal/service.py` 关键增量：

```python
from app.auth.deps import UserContext
from app.viz.sdk_portal.errors import (
    SdkPortalError,
    VIZ_SDK_DUPLICATE_ORIGIN,
    VIZ_SDK_FORBIDDEN,
    VIZ_SDK_TOKEN_REQUIRED,
)


def validate_sdk_init(payload: SdkPortalInitIn) -> SdkPortalValidateOut:
    # ... 保留 target/origin 校验 ...
    if payload.auth_mode == "token" and not payload.embed_token:
        raise SdkPortalError(
            VIZ_SDK_TOKEN_REQUIRED,
            "embedToken is required when authMode is token",
            422,
            [{"field": "embedToken", "message": "required"}],
        )
    seen: set[str] = set()
    for i, origin in enumerate(payload.allowed_origins):
        if origin in seen:
            raise SdkPortalError(
                VIZ_SDK_DUPLICATE_ORIGIN,
                "duplicate allowedOrigins entry",
                422,
                [{"field": f"allowedOrigins[{i}]", "message": "duplicate"}],
            )
        seen.add(origin)
    return SdkPortalValidateOut(valid=True, app_id=payload.app_id, token_required=False)


def lifecycle_manifest(payload: SdkLifecycleIn, actor: UserContext) -> SdkLifecycleOut:
    if payload.phase == "destroy":
        roles = set(actor.roles)
        if not roles.intersection({"admin", "editor"}):
            raise SdkPortalError(VIZ_SDK_FORBIDDEN, "destroy lifecycle requires admin or editor", 403)
    return SdkLifecycleOut(phase=payload.phase, ready=True, sdk_version=_SDK_VERSION)
```

`backend/app/api/v1/charts.py` 修改 `sdk_lifecycle`：

```python
@router.post("/sdk/lifecycle", response_model=None)
def sdk_lifecycle(
    payload: SdkLifecycleIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> SdkLifecycleOut | JSONResponse:
    try:
        return sdk_portal_service.lifecycle_manifest(payload, actor)
    except SdkPortalError as exc:
        return _sdk_error(exc)
```

- [ ] **Step 4: 运行 VIZ-007 测试**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "viz_r63_007" -v`
Expected: PASS（8/8）

- [ ] **Step 5: Commit**

```bash
git add backend/app/viz/sdk_portal/ backend/app/api/v1/charts.py tests/test_viz_view_design_cat_r63.py
git commit -m "feat(viz): VIZ-007 sdk portal probe and lifecycle ACL companion"
```

---

### Task 3: VIEW-002 — 角色默认视图 bounds + resolve probe

**Files:**
- Create: `backend/app/views/probe.py`
- Modify: `backend/app/views/role_template.py`
- Modify: `backend/app/api/v1/views.py`（`RoleDefaultViewsIn` 移除 ge/le，改由域校验）
- Test: `tests/test_viz_view_design_cat_r63.py`（追加 VIEW-002 用例）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: Task 1 fixtures
- Produces: `probe_resolve_defaults_budget_ms(role_codes: list[str]) -> ViewProbeResult`；`put_defaults` 对 `maxWidgetCount` 不在 [1,64] 抛 `VIEW_DEFAULT_OUT_OF_BOUNDS`

- [ ] **Step 1: 写入失败测试（VIEW-002）**

```python
def test_view_r63_002_max_widget_zero_422(client):
    """T-VIEW-R63-002-01: maxWidgetCount=0 → 422 VIEW_DEFAULT_OUT_OF_BOUNDS。"""
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4()), "maxWidgetCount": 0},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_DEFAULT_OUT_OF_BOUNDS"


def test_view_r63_002_max_widget_65_422(client):
    """T-VIEW-R63-002-02: maxWidgetCount=65 → 422 VIEW_DEFAULT_OUT_OF_BOUNDS。"""
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4()), "maxWidgetCount": 65},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_DEFAULT_OUT_OF_BOUNDS"


def test_view_r63_002_probe_resolve_under_budget():
    """T-VIEW-R63-002-03: probe_resolve_defaults_budget_ms < 50ms。"""
    from app.views import store
    from app.views.probe import probe_resolve_defaults_budget_ms

    store.clear_role_defaults()
    store.set_role_defaults("admin", {"dashboardId": "d1", "maxWidgetCount": 12})
    result = probe_resolve_defaults_budget_ms(["admin", "viewer"])
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_view_r63_002_resolve_empty_roles_default():
    """T-VIEW-R63-002-04: resolve_defaults_for_roles([]) 空默认 maxWidgetCount=24。"""
    from app.views.role_template import resolve_defaults_for_roles

    resolved = resolve_defaults_for_roles([])
    assert resolved["dashboardId"] is None
    assert resolved["maxWidgetCount"] == 24


def test_view_r63_002_r60_regression_put_get(client):
    """T-VIEW-R63-002-05: r60 admin PUT+GET 子集仍绿。"""
    dash_id = _create_dashboard(client)
    put = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id, "maxWidgetCount": 12},
    )
    assert put.status_code == 200
    get = client.get("/api/v1/roles/admin/default-views", headers=AUTH)
    assert get.status_code == 200
    assert get.json()["maxWidgetCount"] == 12


def test_view_r63_002_viewer_put_forbidden_regression(client, viewer_user):
    """T-VIEW-R63-002-06: viewer PUT 仍 403 VIEW_DEFAULT_FORBIDDEN（r60 回归）。"""
    resp = client.put(
        "/api/v1/roles/viewer/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4()), "maxWidgetCount": 8},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "VIEW_DEFAULT_FORBIDDEN"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "view_r63_002" -v`
Expected: FAIL

- [ ] **Step 3: 实现域代码**

`backend/app/views/probe.py`（新建）：

```python
from __future__ import annotations

import time
from dataclasses import dataclass

from app.views.role_template import resolve_defaults_for_roles

probe_resolve_defaults_budget_ms_limit = 50
probe_create_override_budget_ms_limit = 50


@dataclass(frozen=True)
class ViewProbeResult:
    elapsed_ms: float
    ok: bool


def probe_resolve_defaults_budget_ms(role_codes: list[str]) -> ViewProbeResult:
    started = time.perf_counter()
    resolve_defaults_for_roles(role_codes)
    return ViewProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=True)
```

`backend/app/views/role_template.py` 在 `put_defaults` 内 `_assert_admin` 之后追加：

```python
_MIN_WIDGETS = 1
_MAX_WIDGETS = 64


def _assert_widget_bounds(max_widgets: int) -> None:
    if max_widgets < _MIN_WIDGETS or max_widgets > _MAX_WIDGETS:
        raise ViewError(
            "VIEW_DEFAULT_OUT_OF_BOUNDS",
            f"maxWidgetCount must be between {_MIN_WIDGETS} and {_MAX_WIDGETS}",
            422,
            [{"field": "maxWidgetCount", "message": "out of bounds"}],
        )


def put_defaults(...):
    _assert_admin(actor)
    max_widgets = int(payload.get("maxWidgetCount", 24))
    _assert_widget_bounds(max_widgets)
    # ... 其余不变 ...
```

`backend/app/api/v1/views.py` 修改 `RoleDefaultViewsIn`：

```python
max_widget_count: int = Field(default=24, alias="maxWidgetCount")
```

（移除 `ge=1, le=256`，由域层抛 `VIEW_DEFAULT_OUT_OF_BOUNDS`）

- [ ] **Step 4: 运行 VIEW-002 测试**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "view_r63_002" -v`
Expected: PASS（6/6）

- [ ] **Step 5: Commit**

```bash
git add backend/app/views/probe.py backend/app/views/role_template.py backend/app/api/v1/views.py tests/test_viz_view_design_cat_r63.py
git commit -m "feat(views): VIEW-002 role default bounds and resolve probe"
```

---

### Task 4: DESIGN-004 — workflow-link probe + catalog 非法联动

**Files:**
- Modify: `backend/app/designer/workflow.py`
- Test: `tests/test_viz_view_design_cat_r63.py`（追加 DESIGN-004 用例）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: Task 1 `_create_workflow_instance`、`_publish_workflow_instance`
- Produces: `probe_validate_workflow_link_budget_ms(session, link) -> float`；`designType=query` + 非空 `catalogEntryId` → `DESIGN_WORKFLOW_CATALOG_MISMATCH`

- [ ] **Step 1: 写入失败测试（DESIGN-004）**

```python
def test_design_r63_004_catalog_mismatch_422(client):
    """T-DESIGN-R63-004-01: designType=query + catalogEntryId → 422 DESIGN_WORKFLOW_CATALOG_MISMATCH。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={
            "designerItemId": str(uuid.uuid4()),
            "workflowInstanceId": wf_id,
            "designType": "query",
            "catalogEntryId": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_WORKFLOW_CATALOG_MISMATCH"


def test_design_r63_004_probe_under_budget(client):
    """T-DESIGN-R63-004-02: probe_validate_workflow_link_budget_ms < 50ms。"""
    from app.auth.models import get_meta_session
    from app.designer.workflow import DesignerWorkflowLinkIn, probe_validate_workflow_link_budget_ms

    wf_id = _create_workflow_instance(client)
    link = DesignerWorkflowLinkIn.model_validate(
        {"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"}
    )
    session = get_meta_session()
    try:
        elapsed = probe_validate_workflow_link_budget_ms(session, link)
    finally:
        session.close()
    assert elapsed < 50


def test_design_r63_004_publish_ready_true_published_workflow(client):
    """T-DESIGN-R63-004-03: published workflow 无 catalog → publishReady=true。"""
    wf_id = _create_workflow_instance(client)
    _publish_workflow_instance(client, wf_id)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"},
    )
    assert resp.status_code == 200
    assert resp.json()["publishReady"] is True


def test_design_r63_004_r59_regression_draft_false(client):
    """T-DESIGN-R63-004-04: draft workflow publishReady=false（r59 回归）。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"},
    )
    assert resp.status_code == 200
    assert resp.json()["publishReady"] is False


def test_design_r63_004_chart_without_catalog_ok(client):
    """T-DESIGN-R63-004-05: chart designType 无 catalogEntryId validate 200。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={
            "designerItemId": str(uuid.uuid4()),
            "workflowInstanceId": wf_id,
            "designType": "chart",
            "catalogEntryId": None,
        },
    )
    assert resp.status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "design_r63_004" -v`
Expected: FAIL

- [ ] **Step 3: 实现 workflow.py 增量**

在 `validate_workflow_link` 开头追加 catalog 守卫；文件末尾追加 probe：

```python
import time

probe_validate_workflow_link_budget_ms_limit = 50


def validate_workflow_link(session: Session, link: DesignerWorkflowLinkIn) -> DesignerWorkflowLinkValidateOut:
    if link.design_type == "query" and link.catalog_entry_id is not None:
        raise DesignerError(
            "DESIGN_WORKFLOW_CATALOG_MISMATCH",
            "query designType must not include catalogEntryId",
            422,
            fields=[{"field": "catalogEntryId", "message": "not allowed for query designType"}],
        )
    # ... 原有校验 ...


def probe_validate_workflow_link_budget_ms(session: Session, link: DesignerWorkflowLinkIn) -> float:
    started = time.perf_counter()
    validate_workflow_link(session, link)
    return (time.perf_counter() - started) * 1000
```

- [ ] **Step 4: 运行 DESIGN-004 测试**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "design_r63_004" -v`
Expected: PASS（5/5）

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/workflow.py tests/test_viz_view_design_cat_r63.py
git commit -m "feat(designer): DESIGN-004 workflow-link probe and catalog mismatch guard"
```

---

### Task 5: CAT-005 — 工单统计 ACL + stats probe

**Files:**
- Modify: `backend/app/governance/catalog/cat05/errors.py`
- Modify: `backend/app/governance/catalog/cat05/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Test: `tests/test_viz_view_design_cat_r63.py`（追加 CAT-005 用例）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: Task 1 `enterprise_user` fixture、`set_user_ticket_scope`
- Produces: `create_ticket_item(payload, user)`、`get_ticket_stats(key, user)` ACL；`probe_ticket_stats_budget_ms(key) -> Cat05ProbeResult`

- [ ] **Step 1: 写入失败测试（CAT-005）**

```python
def test_cat_r63_005_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R63-005-01: enterprise scope 外 GET stats → 403 CAT05_FORBIDDEN。"""
    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET-DEFAULT"))
    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_OTHER"))
    resp = client.get("/api/v1/gov/catalog/tickets/items/TICKET_OTHER/stats", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT05_FORBIDDEN"


def test_cat_r63_005_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R63-005-02: viewer POST items → 403 CAT05_FORBIDDEN。"""
    resp = client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_VIEWER"))
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT05_FORBIDDEN"


def test_cat_r63_005_probe_stats_under_budget(client):
    """T-CAT-R63-005-03: probe_ticket_stats_budget_ms < 50ms。"""
    from app.governance.catalog.cat05.service import probe_ticket_stats_budget_ms

    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_PROBE"))
    result = probe_ticket_stats_budget_ms("TICKET_PROBE")
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r63_005_viewer_stats_read_ok(client, viewer_user):
    """T-CAT-R63-005-04: viewer GET stats 只读 200。"""
    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_READ"))
    resp = client.get("/api/v1/gov/catalog/tickets/items/TICKET_READ/stats", headers=AUTH)
    assert resp.status_code == 200
    assert "open" in resp.json()


def test_cat_r63_005_r61_regression_validate(client):
    """T-CAT-R63-005-05: r61 validate 子集仍绿。"""
    resp = client.post("/api/v1/gov/catalog/tickets/validate", headers=AUTH, json=_ticket_payload())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_cat_r63_005_enterprise_scope_in_ok(client, enterprise_user):
    """T-CAT-R63-005-06: enterprise scope 内 GET stats 200。"""
    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET-DEFAULT"))
    resp = client.get("/api/v1/gov/catalog/tickets/items/TICKET-DEFAULT/stats", headers=AUTH)
    assert resp.status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "cat_r63_005" -v`
Expected: FAIL

- [ ] **Step 3: 实现 cat05 ACL + probe**

`backend/app/governance/catalog/cat05/errors.py`：

```python
CAT05_FORBIDDEN = "CAT05_FORBIDDEN"
```

`backend/app/governance/catalog/cat05/service.py` 关键增量（probe 可内联同文件或放 `probe.py`；为控文件数放 service 末尾）：

```python
import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat05.errors import CAT05_FORBIDDEN, Cat05Error

_USER_TICKET_SCOPE: dict[str, str] = {}
probe_ticket_stats_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat05ProbeResult:
    elapsed_ms: float
    ok: bool


def set_user_ticket_scope(user_id: str, category_key: str) -> None:
    _USER_TICKET_SCOPE[user_id] = category_key


def _assert_ticket_access(user: UserContext, category_key: str, *, write: bool) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "enterprise" in roles:
        expected = _USER_TICKET_SCOPE.get(user.id, "TICKET-DEFAULT")
        if category_key != expected:
            raise Cat05Error(CAT05_FORBIDDEN, "enterprise user cannot access ticket category", 403)
        return
    if write:
        raise Cat05Error(CAT05_FORBIDDEN, "viewer cannot create ticket stats", 403)


def create_ticket_item(payload: TicketStatsItemIn, user: UserContext) -> TicketStatsItemOut:
    item = _validate_payload(payload)
    _assert_ticket_access(user, item.ticket_category_key, write=True)
    # ... 原有 create 逻辑 ...


def get_ticket_stats(key: str, user: UserContext) -> TicketStatsProbeOut:
    if key not in _store:
        raise Cat05Error("CAT05_NOT_FOUND", f"ticketCategoryKey not found: {key}", 404)
    _assert_ticket_access(user, key, write=False)
    return TicketStatsProbeOut(open=12, closed=3, pending=5, sampled_at=datetime.now(UTC))


def probe_ticket_stats_budget_ms(key: str) -> Cat05ProbeResult:
    started = time.perf_counter()
    admin = UserContext(id="probe", username="probe", roles=["admin"])
    get_ticket_stats(key, admin)
    return Cat05ProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=True)
```

`backend/app/api/v1/gov.py` 透传 user：

```python
def create_ticket_stats_item(
    payload: TicketStatsItemIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> TicketStatsItemOut | JSONResponse:
    try:
        return cat05_service.create_ticket_item(payload, actor)
    except Cat05Error as exc:
        return _cat05_error(exc)


def probe_ticket_stats(
    key: str,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> TicketStatsProbeOut | JSONResponse:
    try:
        return cat05_service.get_ticket_stats(key, actor)
    except Cat05Error as exc:
        return _cat05_error(exc)
```

- [ ] **Step 4: 运行 CAT-005 测试**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "cat_r63_005" -v`
Expected: PASS（6/6）

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/catalog/cat05/ backend/app/api/v1/gov.py tests/test_viz_view_design_cat_r63.py
git commit -m "feat(governance): CAT-005 ticket stats ACL and perf probe"
```

---

### Task 6: VIEW-003 — me/views GET/404/cycle + create probe

**Files:**
- Modify: `backend/app/views/probe.py`
- Modify: `backend/app/views/user_override.py`
- Modify: `backend/app/api/v1/views.py`
- Test: `tests/test_viz_view_design_cat_r63.py`（追加 VIEW-003 用例）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: Task 3 `probe.py` 骨架
- Produces: `get_override(user_id, view_id)`；`GET /api/v1/users/me/views/{view_id}`；`create_override` dashboard 404；`probe_create_override_budget_ms(db, actor, payload) -> ViewProbeResult`

- [ ] **Step 1: 写入失败测试（VIEW-003）**

```python
def _valid_user_layout(widget_count: int = 1) -> dict:
    widgets = []
    for i in range(widget_count):
        widgets.append(
            {
                "id": str(uuid.uuid4()),
                "type": "chart",
                "title": f"W{i}",
                "colSpan": 12,
                "order": i,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": "SELECT 1",
                },
            }
        )
    return {"version": 1, "widgetCount": widget_count, "widgets": widgets, "globalFilters": []}


def test_view_r63_003_get_unknown_404(client):
    """T-VIEW-R63-003-01: GET /me/views/{unknown} → 404 VIEW_OVERRIDE_NOT_FOUND。"""
    resp = client.get(f"/api/v1/users/me/views/{uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "VIEW_OVERRIDE_NOT_FOUND"


def test_view_r63_003_dashboard_not_found_404(client):
    """T-VIEW-R63-003-02: POST 未知 dashboardId → 404 VIEW_OVERRIDE_DASHBOARD_NOT_FOUND。"""
    layout = _valid_user_layout(1)
    resp = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "No Dash", "dashboardId": str(uuid.uuid4()), "layout": layout},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "VIEW_OVERRIDE_DASHBOARD_NOT_FOUND"


def test_view_r63_003_chart_ref_cycle_422(client):
    """T-VIEW-R63-003-03: chartRef cycle → 422 VIEW_CHART_REF_CYCLE。"""
    dash_id = _create_dashboard(client)
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    bad_layout = {
        "version": 1,
        "widgetCount": 2,
        "widgets": [
            {"id": id_a, "type": "chart", "title": "A", "colSpan": 12, "order": 0, "chartRef": id_b},
            {"id": id_b, "type": "chart", "title": "B", "colSpan": 12, "order": 1, "chartRef": id_a},
        ],
        "globalFilters": [],
    }
    resp = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "Cycle", "dashboardId": dash_id, "layout": bad_layout},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_CHART_REF_CYCLE"


def test_view_r63_003_probe_create_under_budget(client):
    """T-VIEW-R63-003-04: probe_create_override_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.auth.models import get_meta_session
    from app.views.probe import probe_create_override_budget_ms

    dash_id = _create_dashboard(client)
    actor = UserContext(id="admin", username="admin", roles=["admin"])
    payload = {"name": f"Probe-{uuid.uuid4().hex[:6]}", "dashboardId": dash_id, "layout": _valid_user_layout(1)}
    session = get_meta_session()
    try:
        result = probe_create_override_budget_ms(session, actor, payload)
    finally:
        session.close()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_view_r63_003_get_after_create_200(client):
    """T-VIEW-R63-003-05: POST 后 GET by id 200。"""
    dash_id = _create_dashboard(client)
    layout = _valid_user_layout(1)
    created = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "Owned", "dashboardId": dash_id, "layout": layout},
    )
    assert created.status_code == 201
    view_id = created.json()["id"]
    got = client.get(f"/api/v1/users/me/views/{view_id}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["name"] == "Owned"


def test_view_r63_003_list_regression(client):
    """T-VIEW-R63-003-06: GET list 仍 200（r60 回归）。"""
    resp = client.get("/api/v1/users/me/views", headers=AUTH)
    assert resp.status_code == 200
    assert "items" in resp.json()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "view_r63_003" -v`
Expected: FAIL

- [ ] **Step 3: 实现 user_override + probe + 路由**

`backend/app/views/user_override.py`：

```python
from app.dashboard.service import get_dashboard, DashboardError


def get_override(user_id: str, view_id: str) -> dict[str, Any]:
    for item in store.list_user_overrides(user_id):
        if item.get("id") == view_id:
            return item
    raise ViewError("VIEW_OVERRIDE_NOT_FOUND", "View override not found", 404)


def create_override(db: Session, actor: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
    # ... name conflict / classification 守卫保留 ...
    try:
        get_dashboard(db, uuid.UUID(str(payload["dashboardId"])))
    except DashboardError:
        raise ViewError("VIEW_OVERRIDE_DASHBOARD_NOT_FOUND", "Dashboard not found", 404) from None
    # ... 其余不变 ...
```

`backend/app/views/probe.py` 追加：

```python
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.views.user_override import create_override


def probe_create_override_budget_ms(
    db: Session, actor: UserContext, payload: dict
) -> ViewProbeResult:
    started = time.perf_counter()
    try:
        create_override(db, actor, payload)
        ok = True
    except ViewError:
        ok = False
    return ViewProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
```

`backend/app/api/v1/views.py` 追加路由：

```python
@user_views_router.get("/me/views/{view_id}", response_model=None)
def get_my_view(view_id: str, actor: Annotated[UserContext, Depends(get_current_user)]):
    try:
        return get_override(actor.id, view_id)
    except ViewError as exc:
        return _error_response(exc)
```

并在 import 中加入 `get_override`。

- [ ] **Step 4: 运行 VIEW-003 测试**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -k "view_r63_003" -v`
Expected: PASS（6/6）

- [ ] **Step 5: Commit**

```bash
git add backend/app/views/ backend/app/api/v1/views.py tests/test_viz_view_design_cat_r63.py
git commit -m "feat(views): VIEW-003 me/views GET by id, dashboard 404, create probe"
```

---

### Task 7: r63 套件聚合与四轮回归门控

**Files:**
- Modify: `tests/test_viz_view_design_cat_r63.py`（补齐计数断言，目标 ≥32）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 统计用例数**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py --collect-only -q`
Expected: **≥32** collected

- [ ] **Step 2: r63 全套件**

Run: `cd backend && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -v`
Expected: **≥32/32** PASS

- [ ] **Step 3: 四轮回归门控**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_viz_view_design_cat_r63.py \
  ../tests/test_cat_nfr_rpt_meta_r62.py \
  ../tests/test_cat_dash_viz_nfr_r61.py \
  ../tests/test_rpt_view_cat_gov_r60.py \
  -v
```
Expected: r63 ≥32 + r62 32/32 + r61 32/32 + r60 34/34；exit_code **0**

- [ ] **Step 4: 全量 pytest**

Run: `cd backend && python3 -m pytest -q`
Expected: ≥1654 passed, 4 skipped, exit_code **0**

- [ ] **Step 5: Commit（若有修复）**

```bash
git add tests/test_viz_view_design_cat_r63.py
git commit -m "test(r63): complete companion suite and regression gate"
```

---

### Task 8: 文档同步（services + API 登记簿）

**Files:**
- Modify: `docs/services/viz.md`
- Modify: `docs/services/views.md`
- Modify: `docs/services/designer.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（文档同步评估）

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 更新域附录（各文件追加 Companion r63 小节，≤15 行/文件）**

`docs/services/viz.md` 登记：
- `viz/sdk_portal/probe.py`：`probe_validate_sdk_budget_ms` / `probe_lifecycle_budget_ms`（50ms）
- ACL：`VIZ_SDK_TOKEN_REQUIRED`、`VIZ_SDK_DUPLICATE_ORIGIN`、`VIZ_SDK_FORBIDDEN`（destroy 需 admin/editor）

`docs/services/views.md` 登记：
- `views/probe.py`：resolve/create probe
- `VIEW_DEFAULT_OUT_OF_BOUNDS` [1,64]；`GET /users/me/views/{id}`；`VIEW_OVERRIDE_NOT_FOUND` / `VIEW_OVERRIDE_DASHBOARD_NOT_FOUND`

`docs/services/designer.md` 登记：
- `probe_validate_workflow_link_budget_ms`；`DESIGN_WORKFLOW_CATALOG_MISMATCH`

`docs/services/governance.md` 登记：
- cat05 `_assert_ticket_access` / `set_user_ticket_scope`；`CAT05_FORBIDDEN`；`probe_ticket_stats_budget_ms`

- [ ] **Step 2: API 登记簿一行**

`docs/api/README.md` 追加：
```markdown
| GET | `/api/v1/users/me/views/{view_id}` | IF-06 | 已实现 | `api/v1/views.py` | 用户视图覆盖按 id 读取（r63 VIEW-003） |
```

- [ ] **Step 3: 验证无代码回归**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest ../tests/test_viz_view_design_cat_r63.py -q`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/services/viz.md docs/services/views.md docs/services/designer.md docs/services/governance.md docs/api/README.md
git commit -m "docs: r63 companion probe/ACL/bounds registration"
```

---

## Spec Self-Review（P2 完成前自检）

- [x] 五 PRD 子项各映射 ≥1 Task（VIZ-007→2，VIEW-002→3，DESIGN-004→4，CAT-005→5，VIEW-003→6）
- [x] 无 TBD/TODO/「适当处理」占位
- [x] 每 Task 含验证命令与期望输出
- [x] 全 Task UI skill none（纯后端）
- [x] P3 生产文件 13 + 测试 1 + docs 5 = **19 ≤ 20**
- [x] r62/r61/r60 回归门控写入 Task 7
- [x] 执行模式固定 **subagent-driven-development (option 1)**

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-04-viz-view-design-cat-companion-quality-r63.md`.

**执行选项（Automation 固定）：**

**1. Subagent-Driven (recommended)** — 已选定；P3 使用 `subagent-driven-development`，每 Task 独立 subagent + 双 review。

**2. Inline Execution** — 本轮不采用。
