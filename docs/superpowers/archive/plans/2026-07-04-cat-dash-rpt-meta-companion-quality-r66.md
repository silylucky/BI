# 跨域 companion 质量推分 r66 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/governance/catalog/{cat01,cat02}/` · `backend/app/dashboard/entity_overview/` · `backend/app/reports/engine/` · `backend/app/metadata/dataset/` · `backend/app/api/v1/{gov,datasets,reports/engine}.py` · `tests/test_cat_dash_rpt_meta_r66.py` · `docs/services/{governance,dashboard,reports,metadata}.md`
> **子项：** CAT-001, CAT-002, DASH-005, RPT-001, META-004
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 闭合 r59/r60/r64 L1 后遗留的性能 58% 与完整度 74–76% 薄弱维——五域 companion `probe_*_budget_ms`（≤50ms）、ACL/NOT_FOUND/stage-move 边界 + ≥33 条 `test_cat_dash_rpt_meta_r66`；五 PRD ID 加权总分 **≥90**。

**Architecture:** 域逻辑留在 `cat01`/`cat02`/`entity_overview`/`reports/engine`/`metadata/dataset`；各域独立 `probe.py`（cat01/cat02/entity_overview/engine）或 service 内联 probe（dataset 镜像 physical）；`api/v1/*.py` 仅薄 entry 透传 `UserContext`；内存 store + `set_user_*_scope` 供测试夹具。纯后端、无 `fe/`。

**Tech Stack:** Python 3.11 / FastAPI / Pydantic v2 / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**、**UI Acceptance: N/A**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构；PRD 分片勾选与 8 维重评留 **P5**。
- **分层纪律**（`common.mdc`）：domain 写业务；`api/v1/*.py` = entry（不写守卫细节）。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；鉴权 403；未找到 404。
- **perf probe 预算**：各域 `probe_*_budget_ms` 同进程 `time.perf_counter`，阈值 **50ms**（无真实网络/DB）。
- **鉴权**：路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/services/` > `docs/api/README.md`。
- **验证基线**（r65 P4）：`cd backend && python3 -m pytest -q` ≈ **1719 passed** / 4 skipped；本轮目标 **≥1752 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（Task 7 / P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_cat_dash_rpt_meta_r66.py \
    ../tests/test_cat_rpt_meta_r65.py \
    ../tests/test_nfr_cat_r64.py \
    ../tests/test_cat_nfr_rpt_meta_r62.py \
    ../tests/test_cat_dash_viz_nfr_r61.py \
    ../tests/test_meta_cat_dash_conn_design_r59.py \
    -v && python3 -m pytest -q
  ```
  Expected: r66 **≥33/33** + r65 **32/32** + r64 **33/33** + r62 **32/32** + r61 **32/32** + r59 **34/34**（合计 **196/196**）；全量 exit_code **0**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/governance/catalog/cat01/probe.py` | CAT-001 list + validate perf probe | 新建 |
| `backend/app/governance/catalog/cat01/errors.py` | `CAT01_FORBIDDEN` / `CAT01_EMPTY_ROLES` / `CAT01_STAGE_*` | 修改 |
| `backend/app/governance/catalog/cat01/schemas.py` | `LifecycleStageMove` | 修改 |
| `backend/app/governance/catalog/cat01/service.py` | scope ACL、get、stage move、list 过滤 | 修改 |
| `backend/app/governance/catalog/cat02/probe.py` | CAT-002 validate + list perf probe | 新建 |
| `backend/app/governance/catalog/cat02/errors.py` | `CAT02_FORBIDDEN` / `CAT02_DUPLICATE_*` | 修改 |
| `backend/app/governance/catalog/cat02/schemas.py` | `AggregateTemplateListResponse` | 修改 |
| `backend/app/governance/catalog/cat02/service.py` | scope ACL、list、duplicate dim/metric | 修改 |
| `backend/app/dashboard/entity_overview/probe.py` | validate + get perf probe | 新建 |
| `backend/app/dashboard/entity_overview/errors.py` | `DASH_OVERVIEW_INVALID_ENTITY_TYPE` / `INVALID_DRILL_WIDGET` | 修改 |
| `backend/app/dashboard/entity_overview/service.py` | entityTypeRef/drill 校验深化 | 修改 |
| `backend/app/reports/engine/acl.py` | `assert_engine_run_access` + `set_user_engine_scope` | 新建 |
| `backend/app/reports/engine/probe.py` | run template perf probe | 新建 |
| `backend/app/reports/engine/errors.py` | `RPT_ENGINE_FORBIDDEN` / `RPT_ENGINE_INVALID_PARAMETER` | 修改 |
| `backend/app/reports/engine/service.py` | ACL 调用、parameters 键守卫 | 修改 |
| `backend/app/metadata/dataset/errors.py` | `META_DATASET_FORBIDDEN` / `META_DATASET_DUPLICATE_TABLE` | 修改 |
| `backend/app/metadata/dataset/service.py` | write ACL、enterprise list 过滤、probe×2 | 修改 |
| `backend/app/api/v1/gov.py` | cat01/02 actor 透传 + GET/move/list 路由 | 修改 |
| `backend/app/api/v1/datasets.py` | create/list actor 透传 | 修改 |
| `backend/app/api/v1/reports/engine.py` | run actor 透传 | 修改 |
| `tests/test_cat_dash_rpt_meta_r66.py` | 新套件 ≥33 断言 | 新建 |
| `docs/services/governance.md` | cat01/cat02 companion 登记 | 修改 |
| `docs/services/dashboard.md` | entity_overview probe/validate | 修改 |
| `docs/services/reports.md` | engine acl/probe | 修改 |
| `docs/services/metadata.md` | dataset ACL/probe | 修改 |
| `docs/api/README.md` | 新路由各一行 | 修改 |

预估 **P3 生产代码 18** + **测试 1** = **19 ≤ 20**（docs 不占 P3 文件预算）。

---

### Task 1: r66 共享夹具与测试脚手架

**Files:**
- Create: `tests/test_cat_dash_rpt_meta_r66.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: module-scoped sqlite fixture、`client`/`viewer_user`/`enterprise_user` fixtures、`_lifecycle_payload`、`_aggregate_payload`、`_overview_payload`、`_dataset_payload`、`_create_dashboard`、`_create_report_template` helpers；`test_r66_fixture_bootstraps` 绿灯。

- [ ] **Step 1: 写入夹具与 bootstrap 测**

```python
"""跨域 companion 质量推分 r66 — CAT/DASH/RPT/META."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R66_SQLITE_URL = "sqlite+pysqlite:///file:cat_dash_rpt_meta_r66?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r66_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_nfr08 = os.environ.get("NFR08_RUNTIME_MODE")
    os.environ["DATABASE_URL"] = _R66_SQLITE_URL
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
    from app.governance.catalog.cat01 import service as cat01_service
    from app.governance.catalog.cat02 import service as cat02_service
    from app.metadata.dataset import service as dataset_service

    cat01_service._store.clear()
    cat02_service._store.clear()
    dataset_service._store.clear()
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
        return UserContext(id="viewer-r66", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat01 import service as cat01_service
    from app.governance.catalog.cat02 import service as cat02_service
    from app.metadata.dataset import service as dataset_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r66", username="enterprise", roles=["enterprise"])

    cat01_service.set_user_entity_scope("enterprise-r66", "ticket")
    cat02_service.set_user_aggregate_scope("enterprise-r66", "AGG")
    dataset_service.set_user_dataset_scope("enterprise-r66", "ds-")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_r66_fixture_bootstraps(client):
    """T-R66-000-01: r66 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def _lifecycle_payload(key: str = "LIFE_OPS") -> dict:
    return {
        "templateKey": key,
        "displayName": "Ops Lifecycle",
        "entityTypeCode": "ticket",
        "lifecycleStages": ["created", "active", "closed"],
        "readOnlyOpenApi": True,
        "allowedRoles": ["analyst"],
    }


def _aggregate_payload(key: str = "AGG_SALES") -> dict:
    return {
        "aggregateKey": key,
        "displayName": "Sales Aggregate",
        "dimensions": ["region"],
        "metrics": ["amount"],
        "aggregationFn": "sum",
        "attributionLabel": "poc-sales-v1",
        "tableRef": "stub.sales",
    }


def _dataset_payload(dataset_id: str = "ds-demo-orders") -> dict:
    return {
        "datasetId": dataset_id,
        "displayName": "Demo Orders",
        "tables": [{"name": "orders", "alias": "o"}],
        "computedFields": [],
        "allowedRoles": ["analyst"],
    }


def _create_dashboard(client: TestClient, name: str = "R66 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": name, "description": "r66 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_report_template(client: TestClient, *, template_kind: str | None = None) -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": f"Tpl-{uuid.uuid4().hex[:6]}",
            "nodeType": "template",
            "templateKind": template_kind,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _overview_payload(dashboard_id: str) -> dict:
    return {
        "dashboardId": dashboard_id,
        "entityTypeRef": "customer",
        "statCards": [{"metricKey": "total_orders", "label": "Orders"}],
        "filters": [],
        "drillTargets": [{"widgetId": "w1"}],
    }
```

- [ ] **Step 2: 运行 bootstrap 测**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py::test_r66_fixture_bootstraps -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_cat_dash_rpt_meta_r66.py
git commit -m "test(r66): scaffold fixtures for cat/dash/rpt/meta companion quality"
```

---

### Task 2: CAT-001 lifecycle scope ACL、GET/move 与 perf probe

**Files:**
- Create: `backend/app/governance/catalog/cat01/probe.py`
- Modify: `backend/app/governance/catalog/cat01/errors.py`
- Modify: `backend/app/governance/catalog/cat01/schemas.py`
- Modify: `backend/app/governance/catalog/cat01/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_cat_dash_rpt_meta_r66.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `CAT01_FORBIDDEN`, `CAT01_EMPTY_ROLES`, `CAT01_STAGE_NOT_FOUND`, `CAT01_STAGE_INDEX_OUT_OF_BOUNDS`, `set_user_entity_scope`, `get_lifecycle_template`, `move_lifecycle_stage`, `create_lifecycle_template(payload, user)`, `list_lifecycle_templates(limit, offset, user)`, `LifecycleStageMove`, `Cat01ProbeResult`, `probe_list_lifecycle_templates_budget_ms`, `probe_validate_lifecycle_budget_ms`

- [ ] **Step 1: 写入 CAT-001 失败测试**

在 `tests/test_cat_dash_rpt_meta_r66.py` 追加：

```python
def test_cat_r66_001_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R66-001-01: viewer POST create 403 CAT01_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(f"LIFE_{uuid.uuid4().hex[:6].upper()}"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT01_FORBIDDEN"


def test_cat_r66_001_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R66-001-02: enterprise scope 外 entityTypeCode 403 CAT01_FORBIDDEN。"""
    payload = _lifecycle_payload(f"LIFE_{uuid.uuid4().hex[:6].upper()}")
    payload["entityTypeCode"] = "invoice"
    resp = client.post("/api/v1/gov/catalog/lifecycle-templates", headers=AUTH, json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT01_FORBIDDEN"


def test_cat_r66_001_get_unknown_not_found(client):
    """T-CAT-R66-001-03: GET 未知 templateKey 404 CAT01_NOT_FOUND。"""
    resp = client.get("/api/v1/gov/catalog/lifecycle-templates/MISSING_KEY", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT01_NOT_FOUND"


def test_cat_r66_001_stage_move_unknown_stage(client):
    """T-CAT-R66-001-04: stage move 未知 stageName 404 CAT01_STAGE_NOT_FOUND。"""
    key = f"LIFE_{uuid.uuid4().hex[:6].upper()}"
    assert client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    ).status_code == 201
    resp = client.post(
        f"/api/v1/gov/catalog/lifecycle-templates/{key}/stages/move",
        headers=AUTH,
        json={"stageName": "missing", "toIndex": 0},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT01_STAGE_NOT_FOUND"


def test_cat_r66_001_probe_list_under_50ms(client):
    """T-CAT-R66-001-05: probe_list_lifecycle_templates_budget_ms < 50ms。"""
    from app.governance.catalog.cat01.probe import probe_list_lifecycle_templates_budget_ms

    result = probe_list_lifecycle_templates_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r66_001_probe_validate_under_50ms(client):
    """T-CAT-R66-001-06: probe_validate_lifecycle_budget_ms < 50ms。"""
    from app.governance.catalog.cat01.probe import probe_validate_lifecycle_budget_ms

    result = probe_validate_lifecycle_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r66_001_stage_move_ok(client):
    """T-CAT-R66-001-07: stage move 重排成功 200。"""
    key = f"LIFE_{uuid.uuid4().hex[:6].upper()}"
    assert client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    ).status_code == 201
    resp = client.post(
        f"/api/v1/gov/catalog/lifecycle-templates/{key}/stages/move",
        headers=AUTH,
        json={"stageName": "closed", "toIndex": 0},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["lifecycleStages"][0] == "closed"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "cat_r66_001" -v`
Expected: FAIL（`CAT01_FORBIDDEN` / probe / GET/move 路由未定义）

- [ ] **Step 3: 实现 errors + schemas**

`backend/app/governance/catalog/cat01/errors.py`：

```python
from __future__ import annotations

CAT01_EMPTY_STAGES = "CAT01_EMPTY_STAGES"
CAT01_DUPLICATE_STAGE = "CAT01_DUPLICATE_STAGE"
CAT01_INVALID_ENTITY_TYPE = "CAT01_INVALID_ENTITY_TYPE"
CAT01_KEY_CONFLICT = "CAT01_KEY_CONFLICT"
CAT01_NOT_FOUND = "CAT01_NOT_FOUND"
CAT01_FORBIDDEN = "CAT01_FORBIDDEN"
CAT01_EMPTY_ROLES = "CAT01_EMPTY_ROLES"
CAT01_STAGE_NOT_FOUND = "CAT01_STAGE_NOT_FOUND"
CAT01_STAGE_INDEX_OUT_OF_BOUNDS = "CAT01_STAGE_INDEX_OUT_OF_BOUNDS"


class Cat01Error(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
```

`backend/app/governance/catalog/cat01/schemas.py` 追加：

```python
class LifecycleStageMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    stage_name: str = Field(alias="stageName", min_length=1, max_length=64)
    to_index: int = Field(alias="toIndex", ge=0)
```

- [ ] **Step 4: 实现 service ACL + get/move/list**

`backend/app/governance/catalog/cat01/service.py` 关键增量：

```python
from app.auth.deps import UserContext
from app.governance.catalog.cat01.errors import (
    CAT01_EMPTY_ROLES,
    CAT01_FORBIDDEN,
    CAT01_NOT_FOUND,
    CAT01_STAGE_INDEX_OUT_OF_BOUNDS,
    CAT01_STAGE_NOT_FOUND,
    Cat01Error,
)
from app.governance.catalog.cat01.schemas import LifecycleStageMove

_USER_ENTITY_SCOPE: dict[str, str] = {}


def set_user_entity_scope(user_id: str, entity_prefix: str) -> None:
    _USER_ENTITY_SCOPE[user_id] = entity_prefix


def _assert_lifecycle_write_access(user: UserContext, entity_type_code: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise Cat01Error(CAT01_FORBIDDEN, "viewer cannot modify lifecycle templates", 403)
    if "enterprise" in roles:
        prefix = _USER_ENTITY_SCOPE.get(user.id, "ticket")
        if not entity_type_code.startswith(prefix):
            raise Cat01Error(CAT01_FORBIDDEN, "enterprise user out of entity scope", 403)


def _validate_payload(payload: LifecycleTemplateIn) -> LifecycleTemplateIn:
    # ... 保留现有 stages/entityType 校验 ...
    if not payload.allowed_roles:
        raise Cat01Error(
            CAT01_EMPTY_ROLES,
            "allowedRoles must not be empty",
            422,
            [{"field": "allowedRoles", "message": "must not be empty"}],
        )
    return payload


def get_lifecycle_template(template_key: str) -> LifecycleTemplateOut:
    row = _store.get(template_key)
    if row is None:
        raise Cat01Error(CAT01_NOT_FOUND, f"templateKey not found: {template_key}", 404)
    return LifecycleTemplateOut.model_validate(row)


def create_lifecycle_template(payload: LifecycleTemplateIn, user: UserContext) -> LifecycleTemplateOut:
    item = _validate_payload(payload)
    _assert_lifecycle_write_access(user, item.entity_type_code)
    # ... 保留 key conflict 逻辑 ...


def list_lifecycle_templates(
    limit: int, offset: int, user: UserContext | None = None,
) -> LifecycleTemplateListResponse:
    items = list(_store.values())
    if user is not None and "enterprise" in set(user.roles) and "admin" not in set(user.roles):
        prefix = _USER_ENTITY_SCOPE.get(user.id, "ticket")
        items = [i for i in items if str(i.get("entityTypeCode", "")).startswith(prefix)]
    page = items[offset : offset + limit]
    return LifecycleTemplateListResponse(
        items=[LifecycleTemplateOut.model_validate(i) for i in page],
        total=len(items),
    )


def move_lifecycle_stage(
    template_key: str, payload: LifecycleStageMove, user: UserContext,
) -> LifecycleTemplateOut:
    row = _store.get(template_key)
    if row is None:
        raise Cat01Error(CAT01_NOT_FOUND, f"templateKey not found: {template_key}", 404)
    _assert_lifecycle_write_access(user, row["entityTypeCode"])
    stages: list[str] = list(row["lifecycleStages"])
    try:
        from_index = stages.index(payload.stage_name)
    except ValueError as exc:
        raise Cat01Error(
            CAT01_STAGE_NOT_FOUND,
            f"stageName not found: {payload.stage_name}",
            404,
        ) from exc
    if payload.to_index < 0 or payload.to_index >= len(stages):
        raise Cat01Error(
            CAT01_STAGE_INDEX_OUT_OF_BOUNDS,
            "toIndex out of bounds",
            422,
            [{"field": "toIndex", "message": f"must be 0..{len(stages) - 1}"}],
        )
    stage = stages.pop(from_index)
    stages.insert(payload.to_index, stage)
    row["lifecycleStages"] = stages
    _store[template_key] = row
    return LifecycleTemplateOut.model_validate(row)
```

- [ ] **Step 5: 实现 probe.py**

`backend/app/governance/catalog/cat01/probe.py`：

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.governance.catalog.cat01 import service as cat01_service
from app.governance.catalog.cat01.schemas import LifecycleTemplateIn

probe_lifecycle_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat01ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_list_lifecycle_templates_budget_ms() -> Cat01ProbeResult:
    started = time.perf_counter()
    from app.auth.deps import UserContext

    cat01_service.list_lifecycle_templates(50, 0, UserContext(id="probe", username="probe", roles=["admin"]))
    elapsed = (time.perf_counter() - started) * 1000
    return Cat01ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_lifecycle_budget_ms_limit)


def probe_validate_lifecycle_budget_ms() -> Cat01ProbeResult:
    started = time.perf_counter()
    sample = LifecycleTemplateIn.model_validate({
        "templateKey": f"LIFE_{uuid.uuid4().hex[:6].upper()}",
        "displayName": "Probe",
        "entityTypeCode": "ticket",
        "lifecycleStages": ["created", "active"],
        "allowedRoles": ["analyst"],
    })
    cat01_service.validate_lifecycle_template(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat01ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_lifecycle_budget_ms_limit)
```

- [ ] **Step 6: 薄 entry 透传 actor + 新路由**

`backend/app/api/v1/gov.py` 修改 lifecycle 路由：

```python
from app.governance.catalog.cat01.schemas import LifecycleStageMove

@router.post("/catalog/lifecycle-templates", ...)
def lifecycle_templates_create(
    payload: LifecycleTemplateIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> LifecycleTemplateOut | JSONResponse:
    try:
        return cat01_service.create_lifecycle_template(payload, actor)
    except Cat01Error as exc:
        return _cat01_error(exc)

@router.get("/catalog/lifecycle-templates/{template_key}", response_model=LifecycleTemplateOut)
def lifecycle_templates_get(
    template_key: str,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> LifecycleTemplateOut | JSONResponse:
    try:
        return cat01_service.get_lifecycle_template(template_key)
    except Cat01Error as exc:
        return _cat01_error(exc)

@router.get("/catalog/lifecycle-templates", ...)
def lifecycle_templates_list(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: Annotated[UserContext, Depends(get_current_user)] = None,
) -> LifecycleTemplateListResponse:
    return cat01_service.list_lifecycle_templates(limit, offset, actor)

@router.post("/catalog/lifecycle-templates/{template_key}/stages/move", response_model=LifecycleTemplateOut)
def lifecycle_templates_stage_move(
    template_key: str,
    payload: LifecycleStageMove,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> LifecycleTemplateOut | JSONResponse:
    try:
        return cat01_service.move_lifecycle_stage(template_key, payload, actor)
    except Cat01Error as exc:
        return _cat01_error(exc)
```

- [ ] **Step 7: 运行 CAT-001 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "cat_r66_001" -v`
Expected: PASS（7/7）

- [ ] **Step 8: Commit**

```bash
git add backend/app/governance/catalog/cat01/ backend/app/api/v1/gov.py tests/test_cat_dash_rpt_meta_r66.py
git commit -m "feat(cat01): CAT-001 lifecycle ACL + stage move + perf probe companion"
```

---

### Task 3: CAT-002 aggregate scope ACL、list 与 perf probe

**Files:**
- Create: `backend/app/governance/catalog/cat02/probe.py`
- Modify: `backend/app/governance/catalog/cat02/errors.py`
- Modify: `backend/app/governance/catalog/cat02/schemas.py`
- Modify: `backend/app/governance/catalog/cat02/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_cat_dash_rpt_meta_r66.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `CAT02_FORBIDDEN`, `CAT02_DUPLICATE_DIMENSION`, `CAT02_DUPLICATE_METRIC`, `set_user_aggregate_scope`, `list_aggregate_templates`, `create_aggregate_template(payload, user)`, `AggregateTemplateListResponse`, `probe_validate_aggregate_budget_ms`, `probe_list_aggregate_budget_ms`

- [ ] **Step 1: 写入 CAT-002 失败测试**

```python
def test_cat_r66_002_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R66-002-01: viewer POST create 403 CAT02_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/aggregate-templates",
        headers=AUTH,
        json=_aggregate_payload(f"AGG_{uuid.uuid4().hex[:6].upper()}"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT02_FORBIDDEN"


def test_cat_r66_002_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R66-002-02: enterprise scope 外 aggregateKey 403 CAT02_FORBIDDEN。"""
    payload = _aggregate_payload("OTHER_SCOPE")
    resp = client.post("/api/v1/gov/catalog/aggregate-templates", headers=AUTH, json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT02_FORBIDDEN"


def test_cat_r66_002_duplicate_dimensions(client):
    """T-CAT-R66-002-03: duplicate dimensions 422 CAT02_DUPLICATE_DIMENSION。"""
    payload = _aggregate_payload(f"AGG_{uuid.uuid4().hex[:6].upper()}")
    payload["dimensions"] = ["region", "region"]
    resp = client.post("/api/v1/gov/catalog/aggregate-templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT02_DUPLICATE_DIMENSION"


def test_cat_r66_002_list_route(client):
    """T-CAT-R66-002-04: GET list aggregate-templates 200。"""
    resp = client.get("/api/v1/gov/catalog/aggregate-templates", headers=AUTH)
    assert resp.status_code == 200
    assert "items" in resp.json()


def test_cat_r66_002_probe_validate_under_50ms(client):
    """T-CAT-R66-002-05: probe_validate_aggregate_budget_ms < 50ms。"""
    from app.governance.catalog.cat02.probe import probe_validate_aggregate_budget_ms

    result = probe_validate_aggregate_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r66_002_probe_list_under_50ms(client):
    """T-CAT-R66-002-06: probe_list_aggregate_budget_ms < 50ms。"""
    from app.governance.catalog.cat02.probe import probe_list_aggregate_budget_ms

    result = probe_list_aggregate_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "cat_r66_002" -v`
Expected: FAIL

- [ ] **Step 3: 实现 errors + schemas + service**

`backend/app/governance/catalog/cat02/errors.py` 追加：

```python
CAT02_FORBIDDEN = "CAT02_FORBIDDEN"
CAT02_DUPLICATE_DIMENSION = "CAT02_DUPLICATE_DIMENSION"
CAT02_DUPLICATE_METRIC = "CAT02_DUPLICATE_METRIC"
```

`backend/app/governance/catalog/cat02/schemas.py` 追加：

```python
class AggregateTemplateListResponse(BaseModel):
    items: list[AggregateTemplateOut]
    total: int
```

`backend/app/governance/catalog/cat02/service.py` 关键增量：

```python
from app.auth.deps import UserContext
from app.governance.catalog.cat02.errors import (
    CAT02_DUPLICATE_DIMENSION,
    CAT02_DUPLICATE_METRIC,
    CAT02_FORBIDDEN,
    Cat02Error,
)
from app.governance.catalog.cat02.schemas import AggregateTemplateListResponse

_USER_AGGREGATE_SCOPE: dict[str, str] = {}


def set_user_aggregate_scope(user_id: str, key_prefix: str) -> None:
    _USER_AGGREGATE_SCOPE[user_id] = key_prefix


def _assert_aggregate_write_access(user: UserContext, aggregate_key: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise Cat02Error(CAT02_FORBIDDEN, "viewer cannot modify aggregate templates", 403)
    if "enterprise" in roles:
        prefix = _USER_AGGREGATE_SCOPE.get(user.id, "AGG")
        if not aggregate_key.startswith(prefix):
            raise Cat02Error(CAT02_FORBIDDEN, "enterprise user out of aggregate scope", 403)


def _validate_payload(payload: AggregateTemplateIn) -> AggregateTemplateIn:
    # ... 保留现有空 dimensions/metrics/aggregationFn 校验 ...
    if len(payload.dimensions) != len(set(payload.dimensions)):
        raise Cat02Error(CAT02_DUPLICATE_DIMENSION, "duplicate dimension", 422)
    if len(payload.metrics) != len(set(payload.metrics)):
        raise Cat02Error(CAT02_DUPLICATE_METRIC, "duplicate metric", 422)
    return payload


def create_aggregate_template(payload: AggregateTemplateIn, user: UserContext) -> AggregateTemplateOut:
    item = _validate_payload(payload)
    _assert_aggregate_write_access(user, item.aggregate_key)
    # ... 保留 key conflict 逻辑 ...


def list_aggregate_templates(
    limit: int, offset: int, user: UserContext | None = None,
) -> AggregateTemplateListResponse:
    items = list(_store.values())
    if user is not None and "enterprise" in set(user.roles) and "admin" not in set(user.roles):
        prefix = _USER_AGGREGATE_SCOPE.get(user.id, "AGG")
        items = [i for i in items if str(i.get("aggregateKey", "")).startswith(prefix)]
    page = items[offset : offset + limit]
    return AggregateTemplateListResponse(
        items=[AggregateTemplateOut.model_validate(i) for i in page],
        total=len(items),
    )
```

- [ ] **Step 4: 实现 probe.py**

`backend/app/governance/catalog/cat02/probe.py`：

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat02 import service as cat02_service
from app.governance.catalog.cat02.schemas import AggregateTemplateIn

probe_aggregate_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat02ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_aggregate_budget_ms() -> Cat02ProbeResult:
    started = time.perf_counter()
    sample = AggregateTemplateIn.model_validate({
        "aggregateKey": f"AGG_{uuid.uuid4().hex[:6].upper()}",
        "displayName": "Probe",
        "dimensions": ["region"],
        "metrics": ["amount"],
        "aggregationFn": "sum",
        "attributionLabel": "probe",
    })
    cat02_service.validate_aggregate_template(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat02ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_aggregate_budget_ms_limit)


def probe_list_aggregate_budget_ms() -> Cat02ProbeResult:
    started = time.perf_counter()
    cat02_service.list_aggregate_templates(50, 0, UserContext(id="probe", username="probe", roles=["admin"]))
    elapsed = (time.perf_counter() - started) * 1000
    return Cat02ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_aggregate_budget_ms_limit)
```

- [ ] **Step 5: gov.py 透传 actor + GET list 路由**

```python
@router.post("/catalog/aggregate-templates", ...)
def aggregate_templates_create(
    payload: AggregateTemplateIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> AggregateTemplateOut | JSONResponse:
    try:
        return cat02_service.create_aggregate_template(payload, actor)
    except Cat02Error as exc:
        return _cat02_error(exc)

@router.get("/catalog/aggregate-templates", response_model=AggregateTemplateListResponse)
def aggregate_templates_list(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: Annotated[UserContext, Depends(get_current_user)] = None,
) -> AggregateTemplateListResponse:
    return cat02_service.list_aggregate_templates(limit, offset, actor)
```

- [ ] **Step 6: 运行 CAT-002 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "cat_r66_002" -v`
Expected: PASS（6/6）

- [ ] **Step 7: Commit**

```bash
git add backend/app/governance/catalog/cat02/ backend/app/api/v1/gov.py tests/test_cat_dash_rpt_meta_r66.py
git commit -m "feat(cat02): CAT-002 aggregate ACL + list + perf probe companion"
```

---

### Task 4: DASH-005 entity overview validate/ACL/probe 深化

**Files:**
- Create: `backend/app/dashboard/entity_overview/probe.py`
- Modify: `backend/app/dashboard/entity_overview/errors.py`
- Modify: `backend/app/dashboard/entity_overview/service.py`
- Modify: `tests/test_cat_dash_rpt_meta_r66.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `DASH_OVERVIEW_INVALID_ENTITY_TYPE`, `DASH_OVERVIEW_INVALID_DRILL_WIDGET`, `EntityOverviewProbeResult`, `probe_validate_overview_budget_ms(session, item)`, `probe_get_overview_budget_ms(session, dashboard_id, actor)`

- [ ] **Step 1: 写入 DASH-005 失败测试**

```python
def test_dash_r66_005_invalid_entity_type_ref(client):
    """T-DASH-R66-005-01: 非法 entityTypeRef 422 DASH_OVERVIEW_INVALID_ENTITY_TYPE。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    payload["entityTypeRef"] = "Bad-Type"
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_INVALID_ENTITY_TYPE"


def test_dash_r66_005_invalid_drill_widget(client):
    """T-DASH-R66-005-02: drill widget 不在 layout 422 DASH_OVERVIEW_INVALID_DRILL_WIDGET。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    payload["drillTargets"] = [{"widgetId": "missing-widget"}]
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_INVALID_DRILL_WIDGET"


def test_dash_r66_005_probe_validate_under_50ms(client):
    """T-DASH-R66-005-03: probe_validate_overview_budget_ms < 50ms。"""
    from app.dashboard.entity_overview.probe import probe_validate_overview_budget_ms
    from app.dashboard.entity_overview.schemas import EntityOverviewItem
    from app.datasources.models import get_meta_engine
    from sqlalchemy.orm import Session

    dash_id = uuid.UUID(_create_dashboard(client))
    engine = get_meta_engine()
    with Session(engine) as session:
        item = EntityOverviewItem.model_validate(_overview_payload(str(dash_id)))
        result = probe_validate_overview_budget_ms(session, item)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r66_005_probe_get_under_50ms(client):
    """T-DASH-R66-005-04: probe_get_overview_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.dashboard.entity_overview.probe import probe_get_overview_budget_ms
    from app.datasources.models import get_meta_engine
    from sqlalchemy.orm import Session

    dash_id = _create_dashboard(client)
    client.put(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH, json=_overview_payload(dash_id))
    engine = get_meta_engine()
    with Session(engine) as session:
        actor = UserContext(id="00000000-0000-0000-0000-000000000001", username="dev", roles=["admin"])
        result = probe_get_overview_budget_ms(session, uuid.UUID(dash_id), actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r66_005_forbidden_viewer(client, viewer_user):
    """T-DASH-R66-005-05: 非 owner viewer save 403 DASH_OVERVIEW_FORBIDDEN。"""
    dash_id = _create_dashboard(client)
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/entity-overview",
        headers=AUTH,
        json=_overview_payload(dash_id),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_OVERVIEW_FORBIDDEN"


def test_dash_r66_005_valid_drill_with_layout(client):
    """T-DASH-R66-005-06: layout 含 widget 时 validate 200。"""
    dash_id = _create_dashboard(client)
    layout = {
        "version": 1,
        "widgets": [{"id": "w1", "type": "chart", "order": 0, "chartConfig": {"chartType": "bar"}}],
        "globalFilters": [],
    }
    assert client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout}).status_code == 200
    resp = client.post(
        "/api/v1/dashboards/entity-overview/validate",
        headers=AUTH,
        json=_overview_payload(dash_id),
    )
    assert resp.status_code == 200, resp.text
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "dash_r66_005" -v`
Expected: FAIL

- [ ] **Step 3: 实现 errors + service 深化**

`backend/app/dashboard/entity_overview/errors.py` 追加模块级常量（在 class 前）：

```python
DASH_OVERVIEW_INVALID_ENTITY_TYPE = "DASH_OVERVIEW_INVALID_ENTITY_TYPE"
DASH_OVERVIEW_INVALID_DRILL_WIDGET = "DASH_OVERVIEW_INVALID_DRILL_WIDGET"
```

`backend/app/dashboard/entity_overview/service.py` 在 `_validate_item` 追加：

```python
import re

_ENTITY_TYPE_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


def _validate_item(session: Session, item: EntityOverviewItem) -> EntityOverviewItem:
    # ... 保留 statCards/duplicate/dashboard 存在性校验 ...
    if not _ENTITY_TYPE_RE.match(item.entity_type_ref):
        raise EntityOverviewError(
            DASH_OVERVIEW_INVALID_ENTITY_TYPE,
            "Invalid entityTypeRef",
            422,
            fields=[{"field": "entityTypeRef", "message": "must match ^[a-z][a-z0-9_]{1,63}$"}],
        )
    dashboard = dash_service.get_dashboard(session, item.dashboard_id)
    widget_ids = {
        str(w.get("id"))
        for w in (dashboard.layout_json or {}).get("widgets", [])
        if isinstance(w, dict) and w.get("id") is not None
    }
    for drill in item.drill_targets:
        if drill.widget_id not in widget_ids:
            raise EntityOverviewError(
                DASH_OVERVIEW_INVALID_DRILL_WIDGET,
                f"drill widget not in layout: {drill.widget_id}",
                422,
                fields=[{"field": "drillTargets.widgetId", "message": drill.widget_id}],
            )
    return item
```

- [ ] **Step 4: 实现 probe.py**

`backend/app/dashboard/entity_overview/probe.py`：

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.entity_overview import service as overview_service
from app.dashboard.entity_overview.schemas import EntityOverviewItem

probe_overview_budget_ms_limit = 50


@dataclass(frozen=True)
class EntityOverviewProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_overview_budget_ms(session: Session, item: EntityOverviewItem) -> EntityOverviewProbeResult:
    started = time.perf_counter()
    overview_service.validate_overview(session, item)
    elapsed = (time.perf_counter() - started) * 1000
    return EntityOverviewProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_overview_budget_ms_limit)


def probe_get_overview_budget_ms(
    session: Session, dashboard_id: uuid.UUID, actor: UserContext,
) -> EntityOverviewProbeResult:
    started = time.perf_counter()
    overview_service.get_overview(session, dashboard_id, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return EntityOverviewProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_overview_budget_ms_limit)
```

- [ ] **Step 5: 运行 DASH-005 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "dash_r66_005" -v`
Expected: PASS（6/6）

- [ ] **Step 6: Commit**

```bash
git add backend/app/dashboard/entity_overview/ tests/test_cat_dash_rpt_meta_r66.py
git commit -m "feat(entity_overview): DASH-005 validate/probe companion deepening"
```

---

### Task 5: RPT-001 reports engine run ACL、非法参数与 perf probe

**Files:**
- Create: `backend/app/reports/engine/acl.py`
- Create: `backend/app/reports/engine/probe.py`
- Modify: `backend/app/reports/engine/errors.py`
- Modify: `backend/app/reports/engine/service.py`
- Modify: `backend/app/api/v1/reports/engine.py`
- Modify: `tests/test_cat_dash_rpt_meta_r66.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `RPT_ENGINE_FORBIDDEN`, `RPT_ENGINE_INVALID_PARAMETER`, `set_user_engine_scope`, `assert_engine_run_access`, `probe_run_template_budget_ms`, `run_template(template_id, payload, actor)`

- [ ] **Step 1: 写入 RPT-001 失败测试**

```python
def test_rpt_r66_001_viewer_run_foreign_forbidden(client, viewer_user):
    """T-RPT-R66-001-01: viewer run 非自有模板 403 RPT_ENGINE_FORBIDDEN。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_ENGINE_FORBIDDEN"


def test_rpt_r66_001_enterprise_scope_forbidden(client, enterprise_user):
    """T-RPT-R66-001-02: enterprise run scope 外模板 403 RPT_ENGINE_FORBIDDEN。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_ENGINE_FORBIDDEN"


def test_rpt_r66_001_invalid_parameter_proto(client):
    """T-RPT-R66-001-03: parameters __proto__ 422 RPT_ENGINE_INVALID_PARAMETER。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web", "parameters": {"__proto__": "x"}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_INVALID_PARAMETER"


def test_rpt_r66_001_probe_under_50ms(client):
    """T-RPT-R66-001-04: probe_run_template_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.reports.engine.probe import probe_run_template_budget_ms
    from app.reports.engine.schemas import RenderRunIn

    tid = uuid.UUID(_create_report_template(client, template_kind=None))
    actor = UserContext(id="00000000-0000-0000-0000-000000000001", username="dev", roles=["admin"])
    result = probe_run_template_budget_ms(tid, RenderRunIn(format="web"), actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_rpt_r66_001_unknown_template_404(client):
    """T-RPT-R66-001-05: 未知 template 404 RPT_ENGINE_TEMPLATE_NOT_FOUND。"""
    resp = client.post(
        f"/api/v1/reports/templates/{uuid.uuid4()}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_ENGINE_TEMPLATE_NOT_FOUND"


def test_rpt_r66_001_pdf_not_supported_regression(client):
    """T-RPT-R66-001-06: format=pdf 422 RPT_ENGINE_FORMAT_NOT_SUPPORTED（回归）。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "pdf"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_FORMAT_NOT_SUPPORTED"


def test_rpt_r66_001_enterprise_scope_ok(client, enterprise_user):
    """T-RPT-R66-001-07: enterprise scope 内 run 200。"""
    from app.reports.engine import acl as engine_acl

    tid = uuid.UUID(_create_report_template(client, template_kind=None))
    engine_acl.set_user_engine_scope("enterprise-r66", {tid})
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 200, resp.text
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "rpt_r66_001" -v`
Expected: FAIL

- [ ] **Step 3: 实现 acl.py + errors**

`backend/app/reports/engine/errors.py` 追加：

```python
RPT_ENGINE_FORBIDDEN = "RPT_ENGINE_FORBIDDEN"
RPT_ENGINE_INVALID_PARAMETER = "RPT_ENGINE_INVALID_PARAMETER"
```

`backend/app/reports/engine/acl.py`：

```python
from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.reports.catalog import acl as catalog_acl
from app.reports.engine.errors import RPT_ENGINE_FORBIDDEN, ReportEngineError

_USER_ENGINE_SCOPE: dict[str, set[uuid.UUID]] = {}


def set_user_engine_scope(user_id: str, allowed_template_ids: set[uuid.UUID]) -> None:
    _USER_ENGINE_SCOPE[user_id] = set(allowed_template_ids)


def assert_engine_run_access(actor: UserContext, template_id: uuid.UUID) -> None:
    roles = set(actor.roles)
    if "admin" in roles:
        return
    if "enterprise" in roles:
        allowed = _USER_ENGINE_SCOPE.get(actor.id, set())
        if template_id not in allowed:
            raise ReportEngineError(RPT_ENGINE_FORBIDDEN, "enterprise user out of engine scope", 403)
        return
    if "viewer" in roles:
        owner = catalog_acl._NODE_OWNERS.get(template_id)
        if owner is not None and owner != actor.id:
            raise ReportEngineError(RPT_ENGINE_FORBIDDEN, "viewer cannot run foreign template", 403)
        return
    if roles.intersection({"editor", "analyst", "owner"}):
        return
    raise ReportEngineError(RPT_ENGINE_FORBIDDEN, "insufficient role to run template", 403)
```

- [ ] **Step 4: 实现 service + probe + entry**

`backend/app/reports/engine/service.py` 修改 `run_template`：

```python
from app.auth.deps import UserContext
from app.reports.engine import acl as engine_acl
from app.reports.engine.errors import RPT_ENGINE_INVALID_PARAMETER, RPT_ENGINE_FORBIDDEN


def _validate_parameters(parameters: dict) -> dict:
    for key in parameters:
        if not isinstance(key, str):
            raise ReportEngineError(RPT_ENGINE_INVALID_PARAMETER, "parameter keys must be strings", 422)
        if key == "__proto__":
            raise ReportEngineError(RPT_ENGINE_INVALID_PARAMETER, "reserved parameter key", 422)
    return parameters


def run_template(template_id: uuid.UUID, payload: RenderRunIn, actor: UserContext) -> RenderRunOut:
    engine_acl.assert_engine_run_access(actor, template_id)
    _validate_parameters(payload.parameters or {})
    # ... 保留 format/pdf/not_found 逻辑 ...
```

`backend/app/reports/engine/probe.py`：

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.reports.engine import service as engine_service
from app.reports.engine.schemas import RenderRunIn

probe_engine_run_budget_ms_limit = 50


@dataclass(frozen=True)
class EngineProbeResult:
    elapsed_ms: float
    ok: bool


def probe_run_template_budget_ms(
    template_id: uuid.UUID, payload: RenderRunIn, actor: UserContext,
) -> EngineProbeResult:
    started = time.perf_counter()
    engine_service.run_template(template_id, payload, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return EngineProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_engine_run_budget_ms_limit)
```

`backend/app/api/v1/reports/engine.py`：

```python
def run_report_template(
    template_id: uuid.UUID,
    payload: RenderRunIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> RenderRunOut | JSONResponse:
    try:
        return engine_service.run_template(template_id, payload, actor)
    except ReportEngineError as exc:
        return _engine_error(exc)
```

- [ ] **Step 5: 运行 RPT-001 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "rpt_r66_001" -v`
Expected: PASS（7/7）

- [ ] **Step 6: Commit**

```bash
git add backend/app/reports/engine/ backend/app/api/v1/reports/engine.py tests/test_cat_dash_rpt_meta_r66.py
git commit -m "feat(reports-engine): RPT-001 run ACL + parameter guard + perf probe"
```

---

### Task 6: META-004 dataset validate+CRUD ACL 与 perf probe

**Files:**
- Modify: `backend/app/metadata/dataset/errors.py`
- Modify: `backend/app/metadata/dataset/service.py`
- Modify: `backend/app/api/v1/datasets.py`
- Modify: `tests/test_cat_dash_rpt_meta_r66.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `META_DATASET_FORBIDDEN`, `META_DATASET_DUPLICATE_TABLE`, `set_user_dataset_scope`, `create_dataset(payload, user)`, `list_datasets(limit, offset, user)`, `DatasetProbeResult`, `probe_validate_dataset_budget_ms`, `probe_list_datasets_budget_ms`

- [ ] **Step 1: 写入 META-004 失败测试**

```python
def test_meta_r66_004_viewer_create_forbidden(client, viewer_user):
    """T-META-R66-004-01: viewer POST create 403 META_DATASET_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json=_dataset_payload(f"ds-{uuid.uuid4().hex[:8]}"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_DATASET_FORBIDDEN"


def test_meta_r66_004_enterprise_scope_forbidden(client, enterprise_user):
    """T-META-R66-004-02: enterprise scope 外 datasetId 403 META_DATASET_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json=_dataset_payload("other-scope-dataset"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_DATASET_FORBIDDEN"


def test_meta_r66_004_duplicate_table_name(client):
    """T-META-R66-004-03: duplicate table name 422 META_DATASET_DUPLICATE_TABLE。"""
    payload = _dataset_payload(f"ds-{uuid.uuid4().hex[:8]}")
    payload["tables"] = [{"name": "orders", "alias": "a"}, {"name": "orders", "alias": "b"}]
    resp = client.post("/api/v1/datasets/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_DUPLICATE_TABLE"


def test_meta_r66_004_probe_validate_under_50ms(client):
    """T-META-R66-004-04: probe_validate_dataset_budget_ms < 50ms。"""
    from app.metadata.dataset import service as dataset_service

    result = dataset_service.probe_validate_dataset_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r66_004_probe_list_under_50ms(client):
    """T-META-R66-004-05: probe_list_datasets_budget_ms < 50ms。"""
    from app.metadata.dataset import service as dataset_service

    result = dataset_service.probe_list_datasets_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r66_004_enterprise_list_filtered(client, enterprise_user):
    """T-META-R66-004-06: enterprise list 仅返回 scope 前缀项。"""
    in_scope = _dataset_payload("ds-in-scope")
    out_scope = _dataset_payload("other-out-scope")
    assert client.post("/api/v1/datasets", headers=AUTH, json=in_scope).status_code == 201
    admin_create = client.post("/api/v1/datasets", headers=AUTH, json=out_scope)
    assert admin_create.status_code == 201
    listed = client.get("/api/v1/datasets", headers=AUTH).json()
    ids = {item["datasetId"] for item in listed["items"]}
    assert "ds-in-scope" in ids
    assert "other-out-scope" not in ids
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "meta_r66_004" -v`
Expected: FAIL

- [ ] **Step 3: 实现 errors + service（镜像 physical 内联 probe）**

`backend/app/metadata/dataset/errors.py` 追加：

```python
META_DATASET_FORBIDDEN = "META_DATASET_FORBIDDEN"
META_DATASET_DUPLICATE_TABLE = "META_DATASET_DUPLICATE_TABLE"
```

`backend/app/metadata/dataset/service.py` 关键增量：

```python
import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.metadata.dataset.errors import (
    META_DATASET_DUPLICATE_TABLE,
    META_DATASET_FORBIDDEN,
    DatasetError,
)

_USER_DATASET_SCOPE: dict[str, str] = {}
probe_dataset_budget_ms_limit = 50


@dataclass(frozen=True)
class DatasetProbeResult:
    elapsed_ms: float
    ok: bool


def set_user_dataset_scope(user_id: str, id_prefix: str) -> None:
    _USER_DATASET_SCOPE[user_id] = id_prefix


def _assert_dataset_write_access(user: UserContext, dataset_id: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise DatasetError(META_DATASET_FORBIDDEN, "viewer cannot create datasets", 403)
    if "enterprise" in roles:
        prefix = _USER_DATASET_SCOPE.get(user.id, "ds-")
        if not dataset_id.startswith(prefix):
            raise DatasetError(META_DATASET_FORBIDDEN, "enterprise user out of dataset scope", 403)


def _validate_body(payload: DatasetItemIn) -> None:
    # ... 保留 tables/field 校验 ...
    table_names = [t.name for t in payload.tables]
    if len(table_names) != len(set(table_names)):
        raise DatasetError(META_DATASET_DUPLICATE_TABLE, "duplicate table name", 422)


def create_dataset(payload: DatasetItemIn, user: UserContext) -> DatasetItemOut:
    _assert_dataset_write_access(user, payload.dataset_id)
    _validate_body(payload)
    # ... 保留 conflict 逻辑 ...


def list_datasets(
    limit: int = 50, offset: int = 0, user: UserContext | None = None,
) -> DatasetListResponse:
    items = sorted(_store.values(), key=lambda r: r["datasetId"])
    if user is not None and "enterprise" in set(user.roles) and "admin" not in set(user.roles):
        prefix = _USER_DATASET_SCOPE.get(user.id, "ds-")
        items = [r for r in items if str(r.get("datasetId", "")).startswith(prefix)]
    # ... 保留分页逻辑 ...


def probe_validate_dataset_budget_ms() -> DatasetProbeResult:
    started = time.perf_counter()
    sample = DatasetItemIn.model_validate({
        "datasetId": "ds-probe-sample",
        "displayName": "Probe",
        "tables": [{"name": "orders"}],
    })
    validate_dataset_draft(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return DatasetProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_dataset_budget_ms_limit)


def probe_list_datasets_budget_ms() -> DatasetProbeResult:
    started = time.perf_counter()
    list_datasets(limit=50, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return DatasetProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_dataset_budget_ms_limit)
```

- [ ] **Step 4: datasets.py 透传 actor**

```python
@router.get("", response_model=DatasetListResponse)
def list_datasets(
    actor: Annotated[UserContext, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> DatasetListResponse:
    return dataset_service.list_datasets(limit, offset, actor)

@router.post("", ...)
def create_dataset(
    payload: DatasetItemIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> DatasetItemOut | JSONResponse:
    try:
        return dataset_service.create_dataset(payload, actor)
    except DatasetError as exc:
        return _dataset_error(exc)
```

- [ ] **Step 5: 运行 META-004 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -k "meta_r66_004" -v`
Expected: PASS（6/6）

- [ ] **Step 6: Commit**

```bash
git add backend/app/metadata/dataset/ backend/app/api/v1/datasets.py tests/test_cat_dash_rpt_meta_r66.py
git commit -m "feat(dataset): META-004 ACL + duplicate table + perf probe companion"
```

---

### Task 7: r66 套件聚合与六轮回归门控

**Files:**
- Modify: `tests/test_cat_dash_rpt_meta_r66.py`（确认用例计数 ≥33）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 统计用例数**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py --collect-only -q`
Expected: **≥33** collected（1 bootstrap + 7 CAT-001 + 6 CAT-002 + 6 DASH-005 + 7 RPT-001 + 6 META-004 = **33**）

- [ ] **Step 2: r66 全套件**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_rpt_meta_r66.py -v`
Expected: **≥33/33** PASS

- [ ] **Step 3: 六轮回归门控**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_cat_dash_rpt_meta_r66.py \
  ../tests/test_cat_rpt_meta_r65.py \
  ../tests/test_nfr_cat_r64.py \
  ../tests/test_cat_nfr_rpt_meta_r62.py \
  ../tests/test_cat_dash_viz_nfr_r61.py \
  ../tests/test_meta_cat_dash_conn_design_r59.py \
  -v
```
Expected: r66 **≥33/33** + r65 **32/32** + r64 **33/33** + r62 **32/32** + r61 **32/32** + r59 **34/34**；`ruff` exit **0**

- [ ] **Step 4: 全量 pytest**

Run: `cd backend && python3 -m pytest -q`
Expected: exit_code **0**；passed 数较基线 **+33** 左右

- [ ] **Step 5: r64 CAT-001/002 回归 spot-check**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_cat_r64.py -k "cat001 or cat002" -v`
Expected: `T-CAT-R64-001-01~06` + `T-CAT-R64-002-01~06` 全绿

---

### Task 8: 文档同步（governance + dashboard + reports + metadata + api）

**Files:**
- Modify: `docs/services/governance.md`
- Modify: `docs/services/dashboard.md`
- Modify: `docs/services/reports.md`
- Modify: `docs/services/metadata.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 更新 governance.md**

在 `catalog/cat01/` 行补充：**r66 companion** — `set_user_entity_scope` + `CAT01_FORBIDDEN` viewer/enterprise ACL；`get_lifecycle_template` / `move_lifecycle_stage` NOT_FOUND 闭合；`probe_list/validate_lifecycle_budget_ms` ≤50ms。

在 `catalog/cat02/` 行补充：**r66 companion** — `set_user_aggregate_scope` + `CAT02_FORBIDDEN`；`list_aggregate_templates` enterprise 过滤；duplicate dimension/metric；`probe_validate/list_aggregate_budget_ms` ≤50ms。

- [ ] **Step 2: 更新 dashboard.md**

`entity_overview/`：**r66 companion** — `entityTypeRef` pattern + drill widget layout 守卫；`probe_validate/get_overview_budget_ms` ≤50ms。

- [ ] **Step 3: 更新 reports.md**

`reports/engine/`：**r66 companion** — `assert_engine_run_access` + `set_user_engine_scope`；`RPT_ENGINE_FORBIDDEN` / `RPT_ENGINE_INVALID_PARAMETER`；`probe_run_template_budget_ms` ≤50ms。

- [ ] **Step 4: 更新 metadata.md**

`metadata/dataset/`：**r66 companion** — `set_user_dataset_scope` + `META_DATASET_FORBIDDEN`；duplicate table name；`probe_validate/list_datasets_budget_ms` ≤50ms；内存 store 非 Alembic。

- [ ] **Step 5: 更新 docs/api/README.md**

登记新路由各一行：
- `GET /api/v1/gov/catalog/lifecycle-templates/{templateKey}`
- `POST /api/v1/gov/catalog/lifecycle-templates/{templateKey}/stages/move`
- `GET /api/v1/gov/catalog/aggregate-templates`

- [ ] **Step 6: Commit**

```bash
git add docs/services/governance.md docs/services/dashboard.md docs/services/reports.md docs/services/metadata.md docs/api/README.md
git commit -m "docs: r66 CAT/DASH/RPT/META companion probe/ACL registration"
```

---

## Self-Review Checklist

| design 子项 | 对应 Task | 覆盖 |
|-------------|-----------|------|
| CAT-001 lifecycle ACL + GET/move + probe×2 | Task 2 | ✓ |
| CAT-002 aggregate ACL + list + probe×2 | Task 3 | ✓ |
| DASH-005 entityTypeRef/drill + probe×2 | Task 4 | ✓ |
| RPT-001 engine ACL + parameter guard + probe | Task 5 | ✓ |
| META-004 dataset ACL + duplicate table + probe×2 | Task 6 | ✓ |
| r66 ≥33 测 + 196 回归门控 | Task 7 | ✓ |
| docs 同步 | Task 8 | ✓ |
| 文件数 ≤20（P3 生产 18 + 测试 1） | File Structure | ✓ |
| 全 Task UI skill none | Tasks 1–8 | ✓ |
| 无 TBD/TODO 占位符 | 全文 | ✓ |
