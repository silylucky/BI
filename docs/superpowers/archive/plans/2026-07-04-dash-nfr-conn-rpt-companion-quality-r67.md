# 跨域 companion 质量推分 r67 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/dashboard/global_filters/` · `backend/app/core/nfr/`（`dashboard_first_screen.py` + `report_perf.py` + `errors.py`）· `backend/app/datasources/dialects/kingbase/` · `backend/app/reports/templates/` · `backend/app/api/v1/{nfr,datasources,reports/templates}.py` · `tests/test_dash_nfr_conn_rpt_r67.py` · `docs/services/{dashboard,core,datasources,reports}.md`
> **子项：** DASH-004, NFR-001, NFR-002, CONN-018, RPT-003
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 闭合 r59/r61/r62/r64 L1 后遗留的性能 58% 与完整度 76% 薄弱维——五域 companion `probe_*_budget_ms`（≤50ms）、enterprise scope + viewer 写禁止 + validate 边界深化 + ≥34 条 `test_dash_nfr_conn_rpt_r67`；五 PRD ID 加权总分 **≥90**。

**Architecture:** 域逻辑留在 `global_filters/`、`core/nfr/`、`kingbase/`、`reports/templates/`；各域独立 `probe.py`（或 NFR 单文件内联双 probe）；`api/v1/*.py` 仅薄 entry 透传 `UserContext` 与 kingbase params 422 映射；内存 scope 注册 `set_user_*_scope` 供测试夹具。纯后端、无 `fe/`。

**Tech Stack:** Python 3.11 / FastAPI / Pydantic v2 / SQLAlchemy / pytest + TestClient / ruff。

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
- **验证基线**（r66 P4）：`cd backend && python3 -m pytest -q` ≈ **1752 passed** / 4 skipped；本轮目标 **≥1786 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（Task 7 / P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_dash_nfr_conn_rpt_r67.py \
    ../tests/test_cat_dash_rpt_meta_r66.py \
    ../tests/test_cat_rpt_meta_r65.py \
    ../tests/test_nfr_cat_r64.py \
    ../tests/test_cat_nfr_rpt_meta_r62.py \
    ../tests/test_cat_dash_viz_nfr_r61.py \
    ../tests/test_meta_cat_dash_conn_design_r59.py \
    -v && python3 -m pytest -q
  ```
  Expected: r67 **≥34/34** + r66 **33/33** + r65 **32/32** + r64 **33/33** + r62 **32/32** + r61 **32/32** + r59 **34/34**（合计 **196/196**）；全量 exit_code **0**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/dashboard/global_filters/probe.py` | DASH-004 validate + get perf probe | 新建 |
| `backend/app/dashboard/global_filters/errors.py` | `INVALID_DIMENSION_REF` / `DUPLICATE_PARAMETER_KEY` 常量 | 修改 |
| `backend/app/dashboard/global_filters/service.py` | enterprise scope、viewer 禁写、dimensionRef/parameterKey 校验 | 修改 |
| `backend/app/core/nfr/dashboard_first_screen.py` | ACL、dashboardId pattern、双 probe | 修改 |
| `backend/app/core/nfr/report_perf.py` | ACL、sampleQueryId、simulateFailure、双 probe | 修改 |
| `backend/app/core/nfr/errors.py` | FORBIDDEN / INVALID_* 常量 | 修改 |
| `backend/app/datasources/dialects/kingbase/params.py` | 连接参数预校验 | 新建 |
| `backend/app/datasources/dialects/kingbase/probe.py` | mock test_connection probe | 新建 |
| `backend/app/datasources/dialects/kingbase/connector.py` | test_connection 前 params 校验 | 修改 |
| `backend/app/datasources/dialects/errors.py` | `KINGBASE_INVALID_PARAMS` / `KINGBASE_PORT_OUT_OF_RANGE` | 修改 |
| `backend/app/reports/templates/acl.py` | viewer 禁写 + enterprise scope | 新建 |
| `backend/app/reports/templates/probe.py` | validate + get perf probe | 新建 |
| `backend/app/reports/templates/errors.py` | `RPT_TEMPLATE_FORBIDDEN` / `DUPLICATE_BLOCK` 常量 | 修改 |
| `backend/app/reports/templates/service.py` | ACL、duplicate block、chartType 守卫 | 修改 |
| `backend/app/api/v1/nfr.py` | first-screen/report-perf actor 透传 | 修改 |
| `backend/app/api/v1/datasources.py` | kingbase draft params 422 链（薄） | 修改 |
| `backend/app/api/v1/reports/templates.py` | upsert/get actor 透传 | 修改 |
| `tests/test_dash_nfr_conn_rpt_r67.py` | 新套件 ≥34 断言 | 新建 |
| `docs/services/dashboard.md` | global_filters companion 登记 | 修改 |
| `docs/services/core.md` | NFR first-screen/report-perf ACL/probe | 修改 |
| `docs/services/datasources.md` | kingbase params/probe | 修改 |
| `docs/services/reports.md` | templates ACL/probe | 修改 |
| `docs/api/README.md` | 行为深化状态注记（无新路由） | 修改 |

预估 **P3 生产代码 16** + **测试 1** = **17 ≤ 20**（`api/v1` 3 文件计入生产；docs 不占 P3 文件预算）。

---

### Task 1: r67 共享夹具与测试脚手架

**Files:**
- Create: `tests/test_dash_nfr_conn_rpt_r67.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: module-scoped sqlite fixture、`client`/`viewer_user`/`enterprise_user` fixtures、`_create_dashboard_with_widget`、`_filter_linkage_payload`、`_template_payload` helpers；`test_r67_fixture_bootstraps` 绿灯。

- [ ] **Step 1: 写入夹具与 bootstrap 测**

```python
"""跨域 companion 质量推分 r67 — DASH/NFR/CONN/RPT."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R67_SQLITE_URL = "sqlite+pysqlite:///file:dash_nfr_conn_rpt_r67?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}
_R67_WIDGET_ID = "22222222-2222-4222-8222-222222222222"


@pytest.fixture(scope="module", autouse=True)
def r67_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_nfr08 = os.environ.get("NFR08_RUNTIME_MODE")
    os.environ["DATABASE_URL"] = _R67_SQLITE_URL
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
    from app.reports.templates import service as template_service

    template_service._store.clear()
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
        return UserContext(id="viewer-r67", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="enterprise-r67", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard_with_widget(client: TestClient, widget_id: str = _R67_WIDGET_ID) -> str:
    create = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"R67-{uuid.uuid4().hex[:6]}", "description": "r67 fixture"},
    )
    assert create.status_code == 201, create.text
    dash_id = create.json()["id"]
    layout = {
        "widgets": [{"id": widget_id, "type": "chart", "title": "w1", "x": 0, "y": 0, "w": 4, "h": 3}],
    }
    put = client.put(f"/api/v1/dashboards/{dash_id}", headers=AUTH, json={"layoutJson": layout})
    assert put.status_code == 200, put.text
    return dash_id


def _filter_linkage_payload(dashboard_id: str, widget_id: str = _R67_WIDGET_ID) -> dict:
    return {
        "dashboardId": dashboard_id,
        "filters": [{"filterId": "f1", "dimensionRef": "region", "defaultValue": "CN"}],
        "linkageRules": [{"sourceFilterId": "f1", "targetWidgetIds": [widget_id], "parameterKey": "region"}],
        "refreshMode": "eager",
    }


def _template_payload(key: str = "tmpl-r67-demo") -> dict:
    return {
        "templateKey": key,
        "format": "word",
        "displayName": "R67 Template",
        "blocks": [{"blockType": "sql", "queryRef": "q1"}],
    }


def test_r67_fixture_bootstraps(client):
    """T-R67-000-01: r67 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r67_fixture_auth_smoke(client):
    """T-R67-000-02: /api/v1/me 可达。"""
    resp = client.get("/api/v1/me", headers=AUTH)
    assert resp.status_code == 200
```

- [ ] **Step 2: 运行 bootstrap 测确认失败（文件新建后应 PASS）**

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py::test_r67_fixture_bootstraps ../tests/test_dash_nfr_conn_rpt_r67.py::test_r67_fixture_auth_smoke -v`
Expected: **2 passed**

- [ ] **Step 3: Commit**

```bash
git add tests/test_dash_nfr_conn_rpt_r67.py
git commit -m "test(r67): scaffold fixtures for dash/nfr/conn/rpt companion"
```

---

### Task 2: DASH-004 global_filters probe/ACL/validate 深化

**Files:**
- Create: `backend/app/dashboard/global_filters/probe.py`
- Modify: `backend/app/dashboard/global_filters/errors.py`
- Modify: `backend/app/dashboard/global_filters/service.py`
- Modify: `tests/test_dash_nfr_conn_rpt_r67.py`（追加 DASH-004 区块 7 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: Task 1 `_create_dashboard_with_widget`、`_filter_linkage_payload`、`enterprise_user` fixture
- Produces: `set_user_filter_dashboard_scope`、`probe_validate_linkage_budget_ms`、`probe_get_linkage_budget_ms`；错误码 `DASH_FILTER_INVALID_DIMENSION_REF`、`DASH_FILTER_DUPLICATE_PARAMETER_KEY`

- [ ] **Step 1: 扩展 errors.py**

```python
# backend/app/dashboard/global_filters/errors.py — 追加常量
DASH_FILTER_INVALID_DIMENSION_REF = "DASH_FILTER_INVALID_DIMENSION_REF"
DASH_FILTER_DUPLICATE_PARAMETER_KEY = "DASH_FILTER_DUPLICATE_PARAMETER_KEY"
```

- [ ] **Step 2: 写入失败测（DASH-004 companion）**

在 `tests/test_dash_nfr_conn_rpt_r67.py` 追加：

```python
import uuid as _uuid

from app.dashboard.global_filters import service as gf_service
from app.dashboard.global_filters.probe import (
    probe_get_linkage_budget_ms,
    probe_validate_linkage_budget_ms,
)
from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem
from app.auth.deps import UserContext
from sqlalchemy.orm import Session
from app.datasources.models import get_meta_engine


def _admin_actor() -> UserContext:
    return UserContext(id="dev", username="dev", roles=["admin"])


def test_dash_r67_004_probe_validate_under_50ms(client):
    """T-DASH-R67-004-01: probe_validate_linkage_budget_ms < 50ms。"""
    dash_id = _create_dashboard_with_widget(client)
    item = GlobalFilterLinkageItem.model_validate(_filter_linkage_payload(dash_id))
    with Session(get_meta_engine()) as session:
        result = probe_validate_linkage_budget_ms(session, item)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r67_004_probe_get_under_50ms(client):
    """T-DASH-R67-004-02: probe_get_linkage_budget_ms < 50ms（已 save）。"""
    dash_id = _create_dashboard_with_widget(client)
    client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=_filter_linkage_payload(dash_id))
    actor = _admin_actor()
    with Session(get_meta_engine()) as session:
        result = probe_get_linkage_budget_ms(session, _uuid.UUID(dash_id), actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r67_004_enterprise_scope_forbidden(client, enterprise_user):
    """T-DASH-R67-004-03: enterprise 越权 dashboardId GET → 403。"""
    dash_id = _create_dashboard_with_widget(client)
    gf_service.set_user_filter_dashboard_scope("enterprise-r67", set())
    resp = client.get(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_FILTER_FORBIDDEN"


def test_dash_r67_004_viewer_put_forbidden(client, viewer_user):
    """T-DASH-R67-004-04: viewer PUT save → 403。"""
    dash_id = _create_dashboard_with_widget(client)
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/global-filters",
        headers=AUTH,
        json=_filter_linkage_payload(dash_id),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_FILTER_FORBIDDEN"


def test_dash_r67_004_invalid_dimension_ref(client):
    """T-DASH-R67-004-05: 非法 dimensionRef → 422。"""
    dash_id = _create_dashboard_with_widget(client)
    payload = _filter_linkage_payload(dash_id)
    payload["filters"][0]["dimensionRef"] = "Bad-Ref"
    resp = client.post("/api/v1/dashboards/global-filters/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_FILTER_INVALID_DIMENSION_REF"


def test_dash_r67_004_duplicate_parameter_key(client):
    """T-DASH-R67-004-06: 重复 parameterKey → 422。"""
    dash_id = _create_dashboard_with_widget(client)
    payload = _filter_linkage_payload(dash_id)
    payload["linkageRules"].append(
        {"sourceFilterId": "f1", "targetWidgetIds": [_R67_WIDGET_ID], "parameterKey": "region"},
    )
    resp = client.post("/api/v1/dashboards/global-filters/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_FILTER_DUPLICATE_PARAMETER_KEY"


def test_dash_r67_004_r61_regression_pointer(client):
    """T-DASH-R67-004-07: r61 T-DASH-R61-004-01 validate 仍 200。"""
    dash_id = _create_dashboard_with_widget(client)
    resp = client.post(
        "/api/v1/dashboards/global-filters/validate",
        headers=AUTH,
        json=_filter_linkage_payload(dash_id),
    )
    assert resp.status_code == 200
```

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -k "dash_r67_004" -v`
Expected: **FAIL**（probe/ACL 未实现）

- [ ] **Step 3: 实现 service.py 深化**

在 `service.py` 追加 scope 注册与校验（关键片段）：

```python
import re
from app.dashboard.global_filters.errors import (
    DASH_FILTER_DUPLICATE_PARAMETER_KEY,
    DASH_FILTER_INVALID_DIMENSION_REF,
)

_DIMENSION_REF_RE = re.compile(r"^[a-z][a-z0-9_.]{0,127}$")
_USER_FILTER_DASHBOARD_SCOPE: dict[str, set[uuid.UUID]] = {}


def set_user_filter_dashboard_scope(user_id: str, allowed_dashboard_ids: set[uuid.UUID]) -> None:
    _USER_FILTER_DASHBOARD_SCOPE[user_id] = set(allowed_dashboard_ids)


def _assert_write_access(actor: UserContext) -> None:
    if set(actor.roles) <= {"viewer"}:
        raise GlobalFilterError("DASH_FILTER_FORBIDDEN", "viewer cannot modify global filter linkage", 403)


def _assert_enterprise_scope(actor: UserContext, dashboard_id: uuid.UUID) -> None:
    if "enterprise" not in actor.roles:
        return
    allowed = _USER_FILTER_DASHBOARD_SCOPE.get(actor.id)
    if allowed is None:
        return
    if dashboard_id not in allowed:
        raise GlobalFilterError("DASH_FILTER_FORBIDDEN", "enterprise user out of dashboard scope", 403)


def _validate_filter_bindings(filters: list) -> None:
    for f in filters:
        if not _DIMENSION_REF_RE.match(f.dimension_ref):
            raise GlobalFilterError(
                DASH_FILTER_INVALID_DIMENSION_REF,
                "Invalid dimensionRef",
                422,
                [{"field": "dimensionRef", "message": "invalid pattern"}],
            )


def _validate_linkage_rules(rules: list) -> None:
    keys = [r.parameter_key for r in rules]
    if len(keys) != len(set(keys)):
        raise GlobalFilterError(
            DASH_FILTER_DUPLICATE_PARAMETER_KEY,
            "Duplicate parameterKey in linkageRules",
            422,
            [{"field": "parameterKey", "message": "duplicate"}],
        )
```

在 `_validate_linkage` 开头调用 `_validate_filter_bindings(item.filters)` 与 `_validate_linkage_rules(item.linkage_rules)`；在 `save_linkage` 首行调用 `_assert_write_access(actor)`；在 `save_linkage`/`get_linkage` 调用 `_assert_enterprise_scope(actor, item.dashboard_id)` 或 `dashboard_id`。

- [ ] **Step 4: 实现 probe.py**

```python
# backend/app/dashboard/global_filters/probe.py
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.global_filters import service as gf_service
from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem

probe_linkage_budget_ms_limit = 50


@dataclass(frozen=True)
class GlobalFilterProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_linkage_budget_ms(session: Session, item: GlobalFilterLinkageItem) -> GlobalFilterProbeResult:
    started = time.perf_counter()
    gf_service.validate_linkage(session, item)
    elapsed = (time.perf_counter() - started) * 1000
    return GlobalFilterProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_linkage_budget_ms_limit)


def probe_get_linkage_budget_ms(
    session: Session, dashboard_id: uuid.UUID, actor: UserContext,
) -> GlobalFilterProbeResult:
    started = time.perf_counter()
    gf_service.get_linkage(session, dashboard_id, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return GlobalFilterProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_linkage_budget_ms_limit)
```

- [ ] **Step 5: 运行 DASH-004 测**

Run: `cd backend && python3 -m ruff check app/dashboard/global_filters/ && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -k "dash_r67_004" -v`
Expected: **7 passed**

- [ ] **Step 6: r61 DASH-004 回归 spot-check**

Run: `cd backend && python3 -m pytest ../tests/test_cat_dash_viz_nfr_r61.py -k "dash_r61_004" -v`
Expected: **6/6** PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/dashboard/global_filters/ tests/test_dash_nfr_conn_rpt_r67.py
git commit -m "feat(dash): DASH-004 global_filters companion probe/ACL/validate r67"
```

---

### Task 3: NFR-001 dashboard-first-screen ACL/probe 深化

**Files:**
- Modify: `backend/app/core/nfr/errors.py`
- Modify: `backend/app/core/nfr/dashboard_first_screen.py`
- Modify: `backend/app/api/v1/nfr.py`
- Modify: `tests/test_dash_nfr_conn_rpt_r67.py`（追加 NFR-001 区块 6 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: Task 1 `enterprise_user` fixture
- Produces: `set_user_first_screen_scope`、`probe_validate_first_screen_budget_ms`、`probe_first_screen_probe_budget_ms`；`validate_dashboard_first_screen(payload, actor)`、`probe_dashboard_first_screen(payload, actor)`；常量 `DASHBOARD_FIRST_SCREEN_FORBIDDEN`、`DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID`

- [ ] **Step 1: errors.py 追加常量**

```python
DASHBOARD_FIRST_SCREEN_FORBIDDEN = "DASHBOARD_FIRST_SCREEN_FORBIDDEN"
DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID = "DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID"
```

- [ ] **Step 2: 写入失败测**

```python
from app.core.nfr.dashboard_first_screen import (
    DashboardFirstScreenProbeIn,
    probe_first_screen_probe_budget_ms,
    probe_validate_first_screen_budget_ms,
    set_user_first_screen_scope,
)


def test_nfr_r67_001_probe_validate_under_50ms():
    """T-NFR-R67-001-01: probe_validate_first_screen_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_validate_first_screen_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_nfr_r67_001_probe_probe_under_50ms():
    """T-NFR-R67-001-02: probe_first_screen_probe_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_first_screen_probe_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_nfr_r67_001_enterprise_forbidden(client, enterprise_user):
    """T-NFR-R67-001-03: enterprise 越权 dashboardId → 403。"""
    set_user_first_screen_scope("enterprise-r67", "dash-allowed-")
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/probe",
        headers=AUTH,
        json={"dashboardId": "other-dash-001"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASHBOARD_FIRST_SCREEN_FORBIDDEN"


def test_nfr_r67_001_invalid_dashboard_id(client):
    """T-NFR-R67-001-04: dashboardId 含空格 → 422。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/validate",
        headers=AUTH,
        json={"dashboardId": "bad id", "budgetMs": 5000},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID"


def test_nfr_r67_001_validate_ok(client):
    """T-NFR-R67-001-05: 合法 validate 仍 200（r64 语义）。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/validate",
        headers=AUTH,
        json={"dashboardId": "dash-001", "budgetMs": 5000, "widgetCount": 12},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_nfr_r67_001_r64_regression_probe_elapsed(client):
    """T-NFR-R67-001-06: probe 默认 elapsedMs=800 withinBudget=true。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/probe",
        headers=AUTH,
        json={"dashboardId": "dash-001"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["elapsedMs"] == 800
    assert body["withinBudget"] is True
```

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -k "nfr_r67_001" -v`
Expected: **FAIL**

- [ ] **Step 3: 实现 dashboard_first_screen.py**

关键增量（在现有文件内）：

```python
import re
import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.core.nfr.errors import (
    DASHBOARD_FIRST_SCREEN_FORBIDDEN,
    DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID,
    # ...existing imports...
)

_DASHBOARD_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$")
_USER_FIRST_SCREEN_SCOPE: dict[str, str] = {}
probe_first_screen_budget_ms_limit = 50


@dataclass(frozen=True)
class FirstScreenProbeResult:
    elapsed_ms: float
    ok: bool


def set_user_first_screen_scope(user_id: str, dashboard_prefix: str) -> None:
    _USER_FIRST_SCREEN_SCOPE[user_id] = dashboard_prefix


def _assert_acl(actor: UserContext, dashboard_id: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_FIRST_SCREEN_SCOPE.get(actor.id, "dash-")
    if not dashboard_id.startswith(prefix):
        raise DashboardFirstScreenError(
            DASHBOARD_FIRST_SCREEN_FORBIDDEN,
            "enterprise user out of first-screen scope",
            403,
        )


def _guard_dashboard_id(dashboard_id: str) -> None:
    if not _DASHBOARD_ID_RE.match(dashboard_id):
        raise DashboardFirstScreenError(
            DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID,
            "Invalid dashboardId",
            422,
            [{"field": "dashboardId", "message": "invalid pattern"}],
        )


def _guard(payload: DashboardFirstScreenProbeIn, actor: UserContext) -> DashboardFirstScreenProbeIn:
    # 在现有非空检查后追加：
    _guard_dashboard_id(payload.dashboard_id.strip())
    _assert_acl(actor, payload.dashboard_id)
    # ...existing budget/widget guards...
```

更新 `validate_dashboard_first_screen` / `probe_dashboard_first_screen` 签名接收 `actor: UserContext`，在 `_guard` 中调用 ACL。

追加 probe 函数：

```python
def probe_validate_first_screen_budget_ms(actor: UserContext) -> FirstScreenProbeResult:
    started = time.perf_counter()
    validate_dashboard_first_screen(
        DashboardFirstScreenProbeIn(dashboardId="dash-probe", budgetMs=5000, widgetCount=4),
        actor,
    )
    elapsed = (time.perf_counter() - started) * 1000
    return FirstScreenProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_first_screen_budget_ms_limit)


def probe_first_screen_probe_budget_ms(actor: UserContext) -> FirstScreenProbeResult:
    started = time.perf_counter()
    probe_dashboard_first_screen(DashboardFirstScreenProbeIn(dashboardId="dash-probe"), actor)
    elapsed = (time.perf_counter() - started) * 1000
    return FirstScreenProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_first_screen_budget_ms_limit)
```

- [ ] **Step 4: nfr.py 透传 actor**

```python
@router.post("/dashboard-first-screen/validate", ...)
def dashboard_first_screen_validate(
    payload: DashboardFirstScreenProbeIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> DashboardFirstScreenValidateOut | JSONResponse:
    try:
        return validate_dashboard_first_screen(payload, actor)
    except DashboardFirstScreenError as exc:
        return _dashboard_first_screen_error(exc)


@router.post("/dashboard-first-screen/probe", ...)
def dashboard_first_screen_probe(
    payload: DashboardFirstScreenProbeIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> DashboardFirstScreenProbeOut | JSONResponse:
    try:
        return probe_dashboard_first_screen(payload, actor)
    except DashboardFirstScreenError as exc:
        return _dashboard_first_screen_error(exc)
```

- [ ] **Step 5: 运行 NFR-001 测 + r64 回归**

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -k "nfr_r67_001" -v && python3 -m pytest ../tests/test_nfr_cat_r64.py -k "nfr001" -v`
Expected: r67 **6/6** + r64 **6/6** PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/nfr/ backend/app/api/v1/nfr.py tests/test_dash_nfr_conn_rpt_r67.py
git commit -m "feat(nfr): NFR-001 dashboard-first-screen ACL/probe companion r67"
```

---

### Task 4: NFR-002 report-perf ACL/validate/probe 深化

**Files:**
- Modify: `backend/app/core/nfr/errors.py`
- Modify: `backend/app/core/nfr/report_perf.py`
- Modify: `backend/app/api/v1/nfr.py`
- Modify: `tests/test_dash_nfr_conn_rpt_r67.py`（追加 NFR-002 区块 6 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `set_user_report_perf_scope`、`probe_validate_report_perf_budget_ms`、`probe_report_perf_probe_budget_ms`；`ReportPerfProbeIn.simulate_failure`；常量 `REPORT_PERF_FORBIDDEN`、`REPORT_PERF_INVALID_SAMPLE_QUERY`

- [ ] **Step 1: errors.py 追加**

```python
REPORT_PERF_FORBIDDEN = "REPORT_PERF_FORBIDDEN"
REPORT_PERF_INVALID_SAMPLE_QUERY = "REPORT_PERF_INVALID_SAMPLE_QUERY"
```

- [ ] **Step 2: 写入失败测**

```python
from app.core.nfr.report_perf import (
    probe_report_perf_probe_budget_ms,
    probe_validate_report_perf_budget_ms,
    set_user_report_perf_scope,
)


def test_nfr_r67_002_probe_validate_under_50ms():
    """T-NFR-R67-002-01: probe_validate_report_perf_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_validate_report_perf_budget_ms(actor)
    assert result.ok is True


def test_nfr_r67_002_probe_probe_under_50ms():
    """T-NFR-R67-002-02: probe_report_perf_probe_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_report_perf_probe_budget_ms(actor)
    assert result.ok is True


def test_nfr_r67_002_enterprise_forbidden(client, enterprise_user):
    """T-NFR-R67-002-03: enterprise 越权 reportId → 403。"""
    set_user_report_perf_scope("enterprise-r67", "rpt-allowed-")
    resp = client.post(
        "/api/v1/nfr/report-query-perf/probe",
        headers=AUTH,
        json={"reportId": "other-rpt-001"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "REPORT_PERF_FORBIDDEN"


def test_nfr_r67_002_invalid_sample_query_id(client):
    """T-NFR-R67-002-04: 非法 sampleQueryId → 422。"""
    resp = client.post(
        "/api/v1/nfr/report-query-perf/validate",
        headers=AUTH,
        json={"reportId": "rpt-001", "sampleQueryId": "Bad-ID"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "REPORT_PERF_INVALID_SAMPLE_QUERY"


def test_nfr_r67_002_simulate_failure(client):
    """T-NFR-R67-002-05: simulateFailure=true → samplePassed=false。"""
    resp = client.post(
        "/api/v1/nfr/report-query-perf/probe",
        headers=AUTH,
        json={"reportId": "rpt-001", "simulateFailure": True},
    )
    assert resp.status_code == 200
    assert resp.json()["samplePassed"] is False


def test_nfr_r67_002_r61_regression(client):
    """T-NFR-R67-002-06: probe 默认 elapsedMs=120（r61 语义）。"""
    resp = client.post(
        "/api/v1/nfr/report-query-perf/probe",
        headers=AUTH,
        json={"reportId": "rpt-001"},
    )
    assert resp.status_code == 200
    assert resp.json()["elapsedMs"] == 120
```

- [ ] **Step 3: 实现 report_perf.py**

在 `ReportPerfProbeIn` 追加：

```python
simulate_failure: bool = Field(default=False, alias="simulateFailure")
```

实现（镜像 NFR-001 模式）：

```python
import re
import time
from dataclasses import dataclass

_SAMPLE_QUERY_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")
_USER_REPORT_PERF_SCOPE: dict[str, str] = {}


def set_user_report_perf_scope(user_id: str, report_prefix: str) -> None:
    _USER_REPORT_PERF_SCOPE[user_id] = report_prefix


def _assert_acl(actor: UserContext, report_id: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_REPORT_PERF_SCOPE.get(actor.id, "rpt-")
    if not report_id.startswith(prefix):
        raise ReportPerfError(REPORT_PERF_FORBIDDEN, "enterprise user out of report perf scope", 403)


def _guard_sample_query_id(sample_query_id: str | None) -> None:
    if sample_query_id and not _SAMPLE_QUERY_RE.match(sample_query_id):
        raise ReportPerfError(
            REPORT_PERF_INVALID_SAMPLE_QUERY,
            "Invalid sampleQueryId",
            422,
            [{"field": "sampleQueryId", "message": "invalid pattern"}],
        )
```

更新 `_guard_config(payload, actor)`；`probe_report_perf` 在 `simulate_failure` 时设 `sample_passed=False`。

双 probe 函数 `probe_validate_report_perf_budget_ms` / `probe_report_perf_probe_budget_ms`。

- [ ] **Step 4: nfr.py report-perf 路由透传 actor**

```python
def report_query_perf_probe(payload, actor: Annotated[UserContext, Depends(get_current_user)]):
    return probe_report_perf(payload, actor)
```

- [ ] **Step 5: 运行测 + r61 回归**

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -k "nfr_r67_002" -v && python3 -m pytest ../tests/test_cat_dash_viz_nfr_r61.py -k "nfr_r61_002" -v`
Expected: r67 **6/6** + r61 NFR-002 **6/6**

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/nfr/report_perf.py backend/app/core/nfr/errors.py backend/app/api/v1/nfr.py tests/test_dash_nfr_conn_rpt_r67.py
git commit -m "feat(nfr): NFR-002 report-perf ACL/probe companion r67"
```

---

### Task 5: CONN-018 kingbase 参数校验、HTTP 链与 probe

**Files:**
- Create: `backend/app/datasources/dialects/kingbase/params.py`
- Create: `backend/app/datasources/dialects/kingbase/probe.py`
- Modify: `backend/app/datasources/dialects/kingbase/connector.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/api/v1/datasources.py`
- Modify: `tests/test_dash_nfr_conn_rpt_r67.py`（追加 CONN-018 区块 6 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `validate_kingbase_connection_params`、`KingbaseParamsError`、`probe_test_connection_budget_ms`；常量 `KINGBASE_INVALID_PARAMS`、`KINGBASE_PORT_OUT_OF_RANGE`

- [ ] **Step 1: errors.py 追加 kingbase params 常量**

```python
KINGBASE_INVALID_PARAMS = "KINGBASE_INVALID_PARAMS"
KINGBASE_PORT_OUT_OF_RANGE = "KINGBASE_PORT_OUT_OF_RANGE"
```

- [ ] **Step 2: 实现 params.py**

```python
# backend/app/datasources/dialects/kingbase/params.py
from __future__ import annotations

from app.datasources.dialects.errors import KINGBASE_INVALID_PARAMS, KINGBASE_PORT_OUT_OF_RANGE


class KingbaseParamsError(Exception):
    def __init__(self, code: str, message: str, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.fields = fields or []
        super().__init__(message)


def validate_kingbase_connection_params(
    *,
    host: str | None,
    port: int | None,
    database: str | None,
    username: str | None,
    **_,
) -> None:
    missing = []
    if not host or not str(host).strip():
        missing.append({"field": "host", "message": "required"})
    if not database or not str(database).strip():
        missing.append({"field": "database", "message": "required"})
    if not username or not str(username).strip():
        missing.append({"field": "username", "message": "required"})
    if missing:
        raise KingbaseParamsError(KINGBASE_INVALID_PARAMS, "Invalid kingbase connection params", missing)
    if port is not None and (port < 1 or port > 65535):
        raise KingbaseParamsError(
            KINGBASE_PORT_OUT_OF_RANGE,
            "port out of range",
            [{"field": "port", "message": "must be 1-65535"}],
        )
```

- [ ] **Step 3: 写入失败测**

```python
from unittest.mock import MagicMock, patch

from app.datasources.dialects.kingbase.connector import KingbaseConnector
from app.datasources.dialects.kingbase.probe import probe_test_connection_budget_ms


def test_conn_r67_018_probe_under_50ms():
    """T-CONN-R67-018-01: probe_test_connection_budget_ms < 50ms。"""
    mock_conn = MagicMock()
    with patch.object(KingbaseConnector()._inner, "open_connection", return_value=mock_conn):
        result = probe_test_connection_budget_ms(
            host="127.0.0.1", port=54321, database="db", username="u", password="p",
        )
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_conn_r67_018_http_missing_host(client):
    """T-CONN-R67-018-02: 缺 host HTTP draft → 422 KINGBASE_INVALID_PARAMS。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "kingbase",
            "name": "kb-missing-host",
            "code": f"kb-{uuid.uuid4().hex[:8]}",
            "host": "",
            "port": 54321,
            "database": "db",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "KINGBASE_INVALID_PARAMS"


def test_conn_r67_018_http_port_out_of_range(client):
    """T-CONN-R67-018-03: port=0 → 422 KINGBASE_PORT_OUT_OF_RANGE。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "kingbase",
            "name": "kb-bad-port",
            "code": f"kb-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 0,
            "database": "db",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "KINGBASE_PORT_OUT_OF_RANGE"


def test_conn_r67_018_auth_failed_regression():
    """T-CONN-R67-018-04: mock auth 失败仍 KINGBASE_AUTH_FAILED。"""
    import psycopg

    connector = KingbaseConnector()
    err = psycopg.OperationalError("password authentication failed")
    err.sqlstate = "28P01"
    with patch.object(connector._inner, "open_connection", side_effect=err):
        result = connector.test_connection(
            host="h", port=54321, username="u", password="p", database="d",
        )
    assert result.ok is False
    assert result.code == "KINGBASE_AUTH_FAILED"


def test_conn_r67_018_http_no_password_leak(client):
    """T-CONN-R67-018-05: 响应不得含 password。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "kingbase",
                "name": "kb-nopw",
                "code": f"kb-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 54321,
                "database": "db",
                "username": "u",
                "password": "secret",
            },
        )
    assert resp.status_code == 200
    assert "password" not in resp.text.lower()


def test_conn_r67_018_r59_regression_pointer(client):
    """T-CONN-R67-018-06: r59 HTTP draft kingbase 200 指针。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "kingbase",
                "name": "kb-ok",
                "code": f"kb-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 54321,
                "database": "db",
                "username": "u",
                "password": "p",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
```

- [ ] **Step 4: 实现 probe.py + connector 入口校验**

```python
# backend/app/datasources/dialects/kingbase/probe.py
from __future__ import annotations

import time
from dataclasses import dataclass
from unittest.mock import MagicMock, patch

from app.datasources.dialects.kingbase.connector import KingbaseConnector

probe_kingbase_budget_ms_limit = 50


@dataclass(frozen=True)
class KingbaseProbeResult:
    elapsed_ms: float
    ok: bool


def probe_test_connection_budget_ms(**kwargs) -> KingbaseProbeResult:
    connector = KingbaseConnector()
    mock_conn = MagicMock()
    started = time.perf_counter()
    with patch.object(connector._inner, "open_connection", return_value=mock_conn):
        connector.test_connection(**kwargs)
    elapsed = (time.perf_counter() - started) * 1000
    return KingbaseProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_kingbase_budget_ms_limit)
```

`connector.test_connection` 首行：

```python
from app.datasources.dialects.kingbase.params import KingbaseParamsError, validate_kingbase_connection_params

try:
    validate_kingbase_connection_params(
        host=kwargs.get("host"),
        port=kwargs.get("port", KINGBASE_DEFAULT_PORT),
        database=kwargs.get("database"),
        username=kwargs.get("username"),
    )
except KingbaseParamsError as exc:
    return TestConnectionResult(ok=False, message=exc.message, latency_ms=0, code=exc.code)
```

- [ ] **Step 5: datasources.py 薄 entry kingbase 422 链**

在 `test_connection_draft` 路由 handler 内、`ds_service.test_connection_draft` 调用前：

```python
from app.datasources.dialects.kingbase.params import KingbaseParamsError, validate_kingbase_connection_params

if payload.type == "kingbase":
    try:
        validate_kingbase_connection_params(
            host=payload.host,
            port=payload.port,
            database=payload.database,
            username=payload.username,
        )
    except KingbaseParamsError as exc:
        detail = {"fields": exc.fields} if exc.fields else None
        return JSONResponse(
            status_code=422,
            content={"code": exc.code, "message": exc.message, "detail": detail},
        )
```

- [ ] **Step 6: 运行 CONN-018 测 + r59 回归**

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -k "conn_r67_018" -v && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "conn_r59_018" -v`
Expected: r67 **6/6** + r59 **6/6**

- [ ] **Step 7: Commit**

```bash
git add backend/app/datasources/dialects/kingbase/ backend/app/datasources/dialects/errors.py backend/app/api/v1/datasources.py tests/test_dash_nfr_conn_rpt_r67.py
git commit -m "feat(conn): CONN-018 kingbase params/probe/HTTP chain r67"
```

---

### Task 6: RPT-003 template blocks ACL/validate/probe 深化

**Files:**
- Create: `backend/app/reports/templates/acl.py`
- Create: `backend/app/reports/templates/probe.py`
- Modify: `backend/app/reports/templates/errors.py`
- Modify: `backend/app/reports/templates/service.py`
- Modify: `backend/app/api/v1/reports/templates.py`
- Modify: `tests/test_dash_nfr_conn_rpt_r67.py`（追加 RPT-003 区块 7 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `set_user_template_scope`、`assert_template_write_access`；`probe_validate_template_budget_ms`、`probe_get_template_budget_ms`；`upsert_template_definition(key, payload, actor)`、`get_template_definition(key, actor)`

- [ ] **Step 1: errors.py 追加常量**

```python
RPT_TEMPLATE_FORBIDDEN = "RPT_TEMPLATE_FORBIDDEN"
RPT_TEMPLATE_DUPLICATE_BLOCK = "RPT_TEMPLATE_DUPLICATE_BLOCK"
```

- [ ] **Step 2: 实现 acl.py（镜像 prefab r65）**

```python
# backend/app/reports/templates/acl.py
from __future__ import annotations

from app.auth.deps import UserContext
from app.reports.templates.errors import RPT_TEMPLATE_FORBIDDEN, TemplateDefError

_USER_TEMPLATE_SCOPE: dict[str, str] = {}


def set_user_template_scope(user_id: str, key_prefix: str) -> None:
    _USER_TEMPLATE_SCOPE[user_id] = key_prefix


def assert_template_write_access(actor: UserContext, template_key: str) -> None:
    roles = set(actor.roles)
    if roles <= {"viewer"}:
        raise TemplateDefError(RPT_TEMPLATE_FORBIDDEN, "viewer cannot upsert templates", 403)
    if "enterprise" in roles:
        prefix = _USER_TEMPLATE_SCOPE.get(actor.id, "tmpl-")
        if not template_key.startswith(prefix):
            raise TemplateDefError(RPT_TEMPLATE_FORBIDDEN, "enterprise user out of template scope", 403)


def assert_template_read_access(actor: UserContext, template_key: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_TEMPLATE_SCOPE.get(actor.id, "tmpl-")
    if not template_key.startswith(prefix):
        raise TemplateDefError(RPT_TEMPLATE_FORBIDDEN, "enterprise user out of template scope", 403)
```

- [ ] **Step 3: 写入失败测**

```python
from app.reports.templates import service as template_service
from app.reports.templates.acl import set_user_template_scope
from app.reports.templates.probe import probe_get_template_budget_ms, probe_validate_template_budget_ms


def test_rpt_r67_003_probe_validate_under_50ms():
    """T-RPT-R67-003-01: probe_validate_template_budget_ms < 50ms。"""
    from app.reports.templates.schemas import TemplateDefinitionIn

    payload = TemplateDefinitionIn.model_validate(_template_payload("tmpl-probe-val"))
    result = probe_validate_template_budget_ms(payload)
    assert result.ok is True


def test_rpt_r67_003_probe_get_under_50ms():
    """T-RPT-R67-003-02: probe_get_template_budget_ms < 50ms。"""
    key = "tmpl-probe-get"
    template_service.upsert_template_definition(
        key,
        __import__("app.reports.templates.schemas", fromlist=["TemplateDefinitionIn"]).TemplateDefinitionIn.model_validate(_template_payload(key)),
        UserContext(id="dev", username="dev", roles=["admin"]),
    )
    result = probe_get_template_budget_ms(key, UserContext(id="dev", username="dev", roles=["admin"]))
    assert result.ok is True


def test_rpt_r67_003_viewer_put_forbidden(client, viewer_user):
    """T-RPT-R67-003-03: viewer PUT → 403 RPT_TEMPLATE_FORBIDDEN。"""
    key = "tmpl-viewer-block"
    resp = client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=_template_payload(key))
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_TEMPLATE_FORBIDDEN"


def test_rpt_r67_003_enterprise_get_forbidden(client, enterprise_user):
    """T-RPT-R67-003-04: enterprise 越权 key GET → 403。"""
    key = "tmpl-admin-only"
    admin_put = client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=_template_payload(key))
    assert admin_put.status_code == 200
    set_user_template_scope("enterprise-r67", "tmpl-allowed-")
    resp = client.get(f"/api/v1/reports/templates/{key}", headers=AUTH)
    assert resp.status_code == 403


def test_rpt_r67_003_duplicate_block(client):
    """T-RPT-R67-003-05: duplicate sql block → 422 RPT_TEMPLATE_DUPLICATE_BLOCK。"""
    key = "tmpl-dup"
    payload = _template_payload(key)
    payload["blocks"] = [
        {"blockType": "sql", "queryRef": "q1"},
        {"blockType": "sql", "queryRef": "q1"},
    ]
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_TEMPLATE_DUPLICATE_BLOCK"


def test_rpt_r67_003_chart_type_guard(client):
    """T-RPT-R67-003-06: chart 块非法 chartType → 422 RPT_TEMPLATE_INVALID_BLOCK。"""
    key = "tmpl-bad-chart"
    payload = {
        "templateKey": key,
        "format": "pdf",
        "displayName": "bad chart",
        "blocks": [{"blockType": "chart", "chartType": "donut"}],
    }
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422


def test_rpt_r67_003_r62_regression(client):
    """T-RPT-R67-003-07: r62 validate word+sql 仍 200。"""
    resp = client.post(
        "/api/v1/reports/templates/validate",
        headers=AUTH,
        json=_template_payload("tmpl-r62-pointer"),
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True
```

- [ ] **Step 4: service.py + probe.py + api 透传 actor**

`service.py` 在 `_validate_definition` 追加 duplicate block 检测与 chart `chart_type` 枚举守卫（`line`/`bar`/`pie`）；`upsert_template_definition`/`get_template_definition` 接收 `actor: UserContext` 并调用 acl。

`probe.py` 镜像 prefab/entity_overview 模式。

`templates.py`：

```python
def upsert_template(..., actor: Annotated[UserContext, Depends(get_current_user)]):
    return template_service.upsert_template_definition(template_key, payload, actor)

def get_template(..., actor: Annotated[UserContext, Depends(get_current_user)]):
    return template_service.get_template_definition(template_key, actor)
```

- [ ] **Step 5: 运行 RPT-003 测 + r62 回归**

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -k "rpt_r67_003" -v && python3 -m pytest ../tests/test_cat_nfr_rpt_meta_r62.py -k "rpt_r62_003" -v`
Expected: r67 **7/7** + r62 **6/6**

- [ ] **Step 6: Commit**

```bash
git add backend/app/reports/templates/ backend/app/api/v1/reports/templates.py tests/test_dash_nfr_conn_rpt_r67.py
git commit -m "feat(rpt): RPT-003 templates ACL/probe companion r67"
```

---

### Task 7: r67 套件聚合与六轮回归门控

**Files:**
- Modify: `tests/test_dash_nfr_conn_rpt_r67.py`（确认用例计数 ≥34）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 统计用例数**

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py --collect-only -q`
Expected: **≥34** collected（2 bootstrap + 7 DASH-004 + 6 NFR-001 + 6 NFR-002 + 6 CONN-018 + 7 RPT-003 = **34**）

- [ ] **Step 2: r67 全套件**

Run: `cd backend && python3 -m pytest ../tests/test_dash_nfr_conn_rpt_r67.py -v`
Expected: **≥34/34** PASS

- [ ] **Step 3: 六轮回归门控**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_dash_nfr_conn_rpt_r67.py \
  ../tests/test_cat_dash_rpt_meta_r66.py \
  ../tests/test_cat_rpt_meta_r65.py \
  ../tests/test_nfr_cat_r64.py \
  ../tests/test_cat_nfr_rpt_meta_r62.py \
  ../tests/test_cat_dash_viz_nfr_r61.py \
  ../tests/test_meta_cat_dash_conn_design_r59.py \
  -v
```
Expected: r67 **≥34/34** + r66 **33/33** + r65 **32/32** + r64 **33/33** + r62 **32/32** + r61 **32/32** + r59 **34/34**；`ruff` exit **0**

- [ ] **Step 4: 全量 pytest**

Run: `cd backend && python3 -m pytest -q`
Expected: exit_code **0**；passed 数较基线 **+34** 左右

- [ ] **Step 5: Commit（若有门控修复）**

```bash
git add -A
git commit -m "test(r67): companion suite aggregation and regression gate green"
```

---

### Task 8: 文档同步（dashboard + core + datasources + reports + api）

**Files:**
- Modify: `docs/services/dashboard.md`
- Modify: `docs/services/core.md`
- Modify: `docs/services/datasources.md`
- Modify: `docs/services/reports.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 更新 dashboard.md**

`global_filters/`：**r67 companion** — `set_user_filter_dashboard_scope` + viewer 禁写 + enterprise dashboard scope；`DASH_FILTER_INVALID_DIMENSION_REF` / `DUPLICATE_PARAMETER_KEY`；`probe_validate/get_linkage_budget_ms` ≤50ms。

- [ ] **Step 2: 更新 core.md**

NFR-001：**r67 companion** — `set_user_first_screen_scope` + `DASHBOARD_FIRST_SCREEN_FORBIDDEN` / `INVALID_DASHBOARD_ID`；双 probe ≤50ms。

NFR-002：**r67 companion** — `set_user_report_perf_scope` + `REPORT_PERF_FORBIDDEN` / `INVALID_SAMPLE_QUERY`；`simulateFailure` 降级；双 probe ≤50ms。

- [ ] **Step 3: 更新 datasources.md**

`dialects/kingbase/`：**r67 companion** — `validate_kingbase_connection_params` + `KINGBASE_INVALID_PARAMS` / `PORT_OUT_OF_RANGE`；HTTP draft 422 链；`probe_test_connection_budget_ms` ≤50ms。

- [ ] **Step 4: 更新 reports.md**

`reports/templates/`：**r67 companion** — `assert_template_write_access` + `set_user_template_scope`；`RPT_TEMPLATE_FORBIDDEN` / `DUPLICATE_BLOCK`；`probe_validate/get_template_budget_ms` ≤50ms。

- [ ] **Step 5: 更新 docs/api/README.md**

对既有路由追加 **r67 行为深化** 注记（无新 path）：
- `POST /api/v1/nfr/dashboard-first-screen/{validate,probe}` — enterprise ACL
- `POST /api/v1/nfr/report-query-perf/{validate,probe}` — enterprise ACL + sampleQueryId
- `POST /api/v1/datasources/test` — kingbase params 422
- `PUT/GET /api/v1/reports/templates/{templateKey}` — templates ACL

- [ ] **Step 6: Commit**

```bash
git add docs/services/dashboard.md docs/services/core.md docs/services/datasources.md docs/services/reports.md docs/api/README.md
git commit -m "docs: r67 DASH/NFR/CONN/RPT companion probe/ACL registration"
```

---

## Self-Review Checklist

| design 子项 | 对应 Task | 覆盖 |
|-------------|-----------|------|
| DASH-004 global_filters probe×2 + ACL + validate | Task 2 | ✓ |
| NFR-001 first-screen ACL + dashboardId pattern + probe×2 | Task 3 | ✓ |
| NFR-002 report-perf ACL + sampleQueryId + simulateFailure + probe×2 | Task 4 | ✓ |
| CONN-018 kingbase params + HTTP 422 + probe | Task 5 | ✓ |
| RPT-003 templates ACL + duplicate block + probe×2 | Task 6 | ✓ |
| r67 ≥34 测 + 196 回归门控 | Task 7 | ✓ |
| docs 同步 | Task 8 | ✓ |
| 文件数 ≤20（P3 生产 16 + 测试 1 = 17） | File Structure | ✓ |
| 全 Task UI skill none | Tasks 1–8 | ✓ |
| 无 TBD/TODO 占位符 | 全文 | ✓ |
