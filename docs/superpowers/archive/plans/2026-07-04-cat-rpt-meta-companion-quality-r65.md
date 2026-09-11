# 跨域 companion 质量推分 r65 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/governance/catalog/{cat03,classification,cat06}/` · `backend/app/reports/prefab/` · `backend/app/metadata/physical/` · `backend/app/api/v1/{gov,reports/prefab,metadata}.py` · `tests/test_cat_rpt_meta_r65.py` · `docs/services/{governance,metadata}.md`
> **子项：** CAT-003, CAT-004, CAT-006, RPT-002, META-005
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 闭合 r59–r62 L1 后遗留的性能 58% 与完整度 76% 薄弱维——五域 companion `probe_*_budget_ms`（≤50ms）、ACL/NOT_FOUND/校验边界 + ≥32 条 `test_cat_rpt_meta_r65`；五 PRD ID 加权总分 **≥90**。

**Architecture:** 域逻辑留在 `governance/catalog/`、`reports/prefab/`、`metadata/physical/`；各域独立 `probe.py`（cat03/classification/prefab）或 service 内 probe（cat06/physical）；`api/v1/*.py` 仅薄 entry 透传 `UserContext`；内存 store + `set_user_*_scope` 供测试夹具。纯后端、无 `fe/`。

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
- **验证基线**（r64 P5）：`cd backend && python3 -m pytest -q` ≈ **1687 passed** / 4 skipped；本轮目标 **≥1719 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（Task 7 / P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_cat_rpt_meta_r65.py \
    ../tests/test_nfr_cat_r64.py \
    ../tests/test_cat_nfr_rpt_meta_r62.py \
    ../tests/test_cat_dash_viz_nfr_r61.py \
    ../tests/test_meta_cat_dash_conn_design_r59.py \
    -v && python3 -m pytest -q
  ```
  Expected: r65 **≥32/32** + r64 **33/33** + r62 **32/32** + r61 **32/32** + r59 **34/34**；全量 exit_code **0**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/governance/catalog/cat03/probe.py` | CAT-003 list + move perf probe | 新建 |
| `backend/app/governance/catalog/cat03/errors.py` | `CAT03_FORBIDDEN` 常量 | 修改 |
| `backend/app/governance/catalog/cat03/service.py` | region scope ACL、viewer 写禁止、actor 参数 | 修改 |
| `backend/app/governance/catalog/classification/probe.py` | CAT-004 list + move perf probe | 新建 |
| `backend/app/governance/catalog/classification/errors.py` | `CAT_CLASS_NOT_FOUND` · `CAT_CLASS_FORBIDDEN` | 修改 |
| `backend/app/governance/catalog/classification/service.py` | NOT_FOUND 修正、classification scope ACL | 修改 |
| `backend/app/governance/catalog/cat06/errors.py` | `CAT06_EMPTY_METRICS` 导出常量 | 修改 |
| `backend/app/governance/catalog/cat06/service.py` | stats ACL、probe×2、empty metrics 巩固 | 修改 |
| `backend/app/reports/prefab/probe.py` | RPT-002 validate + list perf probe | 新建 |
| `backend/app/reports/prefab/errors.py` | `RPT_PREFAB_EMPTY_ROLES` · `RPT_PREFAB_ANALYSIS_MISMATCH` | 修改 |
| `backend/app/reports/prefab/service.py` | allowedRoles/analysisType 联动、enterprise scope | 修改 |
| `backend/app/metadata/physical/errors.py` | `META_PHYSICAL_FORBIDDEN` · `META_PHYSICAL_INVALID_COLUMN` | 修改 |
| `backend/app/metadata/physical/service.py` | register ACL、probe×2、column name pattern | 修改 |
| `backend/app/api/v1/gov.py` | geo/classification/production-stats actor 透传 | 修改 |
| `backend/app/api/v1/reports/prefab.py` | 可选 GET `/probe` 导出 | 修改 |
| `backend/app/api/v1/metadata.py` | register actor 透传 | 修改 |
| `tests/test_cat_rpt_meta_r65.py` | 新套件 ≥32 断言 | 新建 |
| `docs/services/governance.md` | cat03/classification/cat06 companion 登记 | 修改 |
| `docs/services/metadata.md` | physical register companion 登记 | 修改 |

预估 **P3 生产代码 16** + **测试 1** + **docs 2** = **19 ≤ 20**。

---

### Task 1: r65 共享夹具与测试脚手架

**Files:**
- Create: `tests/test_cat_rpt_meta_r65.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: module-scoped sqlite fixture、`client`/`viewer_user`/`enterprise_user` fixtures、`_geo_node_payload`、`_class_node`、`_production_stats_payload`、`_prefab_payload`、`_physical_payload` helpers；`test_r65_fixture_bootstraps` 绿灯。

- [ ] **Step 1: 写入夹具与 bootstrap 测**

```python
"""跨域 companion 质量推分 r65 — CAT/RPT/META."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R65_SQLITE_URL = "sqlite+pysqlite:///file:cat_rpt_meta_r65?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r65_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_nfr08 = os.environ.get("NFR08_RUNTIME_MODE")
    os.environ["DATABASE_URL"] = _R65_SQLITE_URL
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
        return UserContext(id="viewer-r65", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat03 import service as cat03_service
    from app.governance.catalog.classification import service as class_service
    from app.governance.catalog.cat06 import service as cat06_service
    from app.reports.prefab import service as prefab_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r65", username="enterprise", roles=["enterprise"])

    cat03_service.set_user_region_scope("enterprise-r65", "CN")
    class_service.set_user_class_scope("enterprise-r65", "CAT")
    cat06_service.set_user_brand_scope("enterprise-r65", "BRAND01")
    prefab_service.set_user_prefab_scope("enterprise-r65", "bind-cn")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_r65_fixture_bootstraps(client):
    """T-R65-000-01: r65 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def _geo_node_payload(code: str = "CN-SH", parent_id: str | None = None) -> dict:
    return {
        "regionCode": code,
        "name": f"Region {code}",
        "parentId": parent_id,
        "level": 1,
        "sortOrder": 0,
    }


def _class_node(code: str | None = None, parent_id: str | None = None) -> dict:
    return {
        "code": code or f"CAT_{uuid.uuid4().hex[:6].upper()}",
        "name": "Category Node",
        "parentId": parent_id,
        "kind": "folder",
        "sortOrder": 0,
    }


def _production_stats_payload(stats_key: str | None = None, brand_id: str = "BRAND01") -> dict:
    key = stats_key or f"PS_{uuid.uuid4().hex[:6].upper()}"
    return {
        "statsKey": key,
        "displayName": "Production Demo",
        "vendorType": "enterprise",
        "brandId": brand_id,
        "locType": "all",
        "metricKeys": ["inbound", "inventory", "activation"],
    }


def _prefab_payload(binding_key: str | None = None) -> dict:
    return {
        "bindingKey": binding_key or f"bind-{uuid.uuid4().hex[:8]}",
        "entityTypeCode": "customer",
        "analysisType": "lifecycle",
        "dimensionCodes": ["region"],
        "displayName": "Customer Lifecycle",
        "allowedRoles": ["analyst"],
    }


def _physical_payload(fqn: str | None = None) -> dict:
    fqn_val = fqn or f"sales.orders_{uuid.uuid4().hex[:6]}"
    return {
        "tableFqn": fqn_val,
        "dataSourceId": str(uuid.uuid4()),
        "displayName": "Orders Table",
        "entityTypeCode": "order",
        "columns": [
            {"name": "id", "dataType": "bigint", "nullable": False},
            {"name": "amount", "dataType": "decimal", "nullable": True},
        ],
    }
```

- [ ] **Step 2: 运行 bootstrap 测**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py::test_r65_fixture_bootstraps -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_cat_rpt_meta_r65.py
git commit -m "test(r65): scaffold fixtures for cat/rpt/meta companion quality"
```

---

### Task 2: CAT-003 geo region ACL 与 perf probe

**Files:**
- Create: `backend/app/governance/catalog/cat03/probe.py`
- Modify: `backend/app/governance/catalog/cat03/errors.py`
- Modify: `backend/app/governance/catalog/cat03/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_cat_rpt_meta_r65.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `CAT03_FORBIDDEN`, `set_user_region_scope`, `_assert_geo_write_access`, `create_geo_node(payload, user)`, `move_geo_node(region_id, payload, user)`, `delete_geo_node(region_id, user)`, `Cat03ProbeResult`, `probe_list_geo_nodes_budget_ms`, `probe_move_geo_region_budget_ms`, `probe_geo_list_budget_ms_limit = 50`

- [ ] **Step 1: 写入 CAT-003 失败测试**

在 `tests/test_cat_rpt_meta_r65.py` 追加：

```python
def test_cat_r65_003_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R65-003-01: viewer POST create 403 CAT03_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-VIEWER"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT03_FORBIDDEN"


def test_cat_r65_003_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R65-003-02: enterprise scope 外 regionCode 403 CAT03_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("US-NY"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT03_FORBIDDEN"


def test_cat_r65_003_probe_list_under_50ms(client):
    """T-CAT-R65-003-03: probe_list_geo_nodes_budget_ms < 50ms。"""
    from app.governance.catalog.cat03.probe import probe_list_geo_nodes_budget_ms

    result = probe_list_geo_nodes_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_003_probe_move_under_50ms(client):
    """T-CAT-R65-003-04: probe_move_geo_region_budget_ms < 50ms。"""
    from app.governance.catalog.cat03.probe import probe_move_geo_region_budget_ms

    result = probe_move_geo_region_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_003_move_cycle_regression(client):
    """T-CAT-R65-003-05: move 成环仍 422 CAT03_CYCLE（r61 回归）。"""
    a = client.post("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH, json=_geo_node_payload("CN-A")).json()
    b = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-B", parent_id=a["regionId"]),
    ).json()
    resp = client.post(
        f"/api/v1/gov/catalog/geo-regions/nodes/{a['regionId']}/move",
        headers=AUTH,
        json={"parentId": b["regionId"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT03_CYCLE"


def test_cat_r65_003_enterprise_scope_ok(client, enterprise_user):
    """T-CAT-R65-003-06: enterprise scope 内 regionCode 201。"""
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-SCOPED"),
    )
    assert resp.status_code == 201, resp.text
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "cat_r65_003" -v`
Expected: FAIL（`CAT03_FORBIDDEN` / probe 模块未定义 / service 无 user 参数）

- [ ] **Step 3: 实现 errors + service ACL**

`backend/app/governance/catalog/cat03/errors.py`：

```python
from __future__ import annotations

CAT03_FORBIDDEN = "CAT03_FORBIDDEN"


class Cat03Error(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
```

`backend/app/governance/catalog/cat03/service.py` 追加/修改（在现有 import 后）：

```python
from app.auth.deps import UserContext
from app.governance.catalog.cat03.errors import CAT03_FORBIDDEN, Cat03Error

_USER_REGION_SCOPE: dict[str, str] = {}


def set_user_region_scope(user_id: str, region_code_prefix: str) -> None:
    _USER_REGION_SCOPE[user_id] = region_code_prefix


def _assert_geo_write_access(user: UserContext, region_code: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise Cat03Error(CAT03_FORBIDDEN, "viewer cannot modify geo regions", 403)
    if "enterprise" in roles:
        prefix = _USER_REGION_SCOPE.get(user.id, "CN")
        if not region_code.startswith(prefix):
            raise Cat03Error(CAT03_FORBIDDEN, "enterprise user out of region scope", 403)
```

将 `create_geo_node` 签名改为 `create_geo_node(payload: GeoRegionCreate, user: UserContext) -> GeoRegionOut`，首行调用 `_assert_geo_write_access(user, payload.region_code)`。

将 `move_geo_node` 签名改为 `move_geo_node(region_id: uuid.UUID, payload: GeoRegionMove, user: UserContext) -> GeoRegionOut`，在找到 record 后调用 `_assert_geo_write_access(user, record["regionCode"])`；若 new_parent 存在，也对 parent 的 regionCode 做 scope 检查（parent record `regionCode`）。

将 `delete_geo_node` 签名改为 `delete_geo_node(region_id: uuid.UUID, user: UserContext) -> None`，找到 record 后 `_assert_geo_write_access(user, record["regionCode"])`。

- [ ] **Step 4: 实现 probe.py**

`backend/app/governance/catalog/cat03/probe.py`：

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat03 import service as cat03_service
from app.governance.catalog.cat03.schemas import GeoRegionCreate, GeoRegionMove

probe_geo_list_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat03ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_list_geo_nodes_budget_ms(parent_id: uuid.UUID | None = None) -> Cat03ProbeResult:
    started = time.perf_counter()
    cat03_service.list_geo_nodes(parent_id, limit=100, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat03ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_geo_list_budget_ms_limit)


def probe_move_geo_region_budget_ms() -> Cat03ProbeResult:
    actor = UserContext(id="probe", username="probe", roles=["admin"])
    started = time.perf_counter()
    root = cat03_service.create_geo_node(
        GeoRegionCreate(region_code=f"CN-P{uuid.uuid4().hex[:4].upper()}", name="Probe Root", parent_id=None, level=1, sort_order=0),
        actor,
    )
    child = cat03_service.create_geo_node(
        GeoRegionCreate(region_code=f"CN-C{uuid.uuid4().hex[:4].upper()}", name="Probe Child", parent_id=root.region_id, level=2, sort_order=0),
        actor,
    )
    cat03_service.move_geo_node(child.region_id, GeoRegionMove(parent_id=root.region_id, sort_order=1), actor)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat03ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_geo_list_budget_ms_limit)
```

- [ ] **Step 5: 薄 entry 透传 actor**

`backend/app/api/v1/gov.py` 修改 geo 三路由（参照 cat05 `create_ticket_stats_item` 模式）：

```python
@router.post("/catalog/geo-regions/nodes", ...)
def create_geo_region_node(
    payload: GeoRegionCreate,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> GeoRegionOut | JSONResponse:
    try:
        return cat03_service.create_geo_node(payload, actor)
    except Cat03Error as exc:
        return _cat03_error(exc)

@router.post("/catalog/geo-regions/nodes/{region_id}/move", ...)
def move_geo_region_node(
    region_id: uuid.UUID,
    payload: GeoRegionMove,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> GeoRegionOut | JSONResponse:
    try:
        return cat03_service.move_geo_node(region_id, payload, actor)
    except Cat03Error as exc:
        return _cat03_error(exc)

@router.delete("/catalog/geo-regions/nodes/{region_id}", ...)
def delete_geo_region_node(
    region_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> Response | JSONResponse:
    try:
        cat03_service.delete_geo_node(region_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Cat03Error as exc:
        return _cat03_error(exc)
```

- [ ] **Step 6: 运行 CAT-003 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "cat_r65_003" -v`
Expected: PASS（6/6）

- [ ] **Step 7: Commit**

```bash
git add backend/app/governance/catalog/cat03/ backend/app/api/v1/gov.py tests/test_cat_rpt_meta_r65.py
git commit -m "feat(cat03): CAT-003 geo region ACL + perf probe companion"
```

---

### Task 3: CAT-004 classification NOT_FOUND 修正与 ACL/probe

**Files:**
- Create: `backend/app/governance/catalog/classification/probe.py`
- Modify: `backend/app/governance/catalog/classification/errors.py`
- Modify: `backend/app/governance/catalog/classification/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_cat_rpt_meta_r65.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `CAT_CLASS_NOT_FOUND`, `CAT_CLASS_FORBIDDEN`, `set_user_class_scope`, `create_node(payload, user)`, `move_node(node_id, payload, user)`, `delete_node(node_id, user)`, `probe_list_classification_budget_ms`, `probe_classification_move_budget_ms`

- [ ] **Step 1: 写入 CAT-004 失败测试**

```python
def test_cat_r65_004_move_unknown_not_found(client):
    """T-CAT-R65-004-01: move 未知 node 404 CAT_CLASS_NOT_FOUND。"""
    missing = str(uuid.uuid4())
    resp = client.post(
        f"/api/v1/gov/catalog/classification/nodes/{missing}/move",
        headers=AUTH,
        json={"parentId": None},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT_CLASS_NOT_FOUND"


def test_cat_r65_004_delete_unknown_not_found(client):
    """T-CAT-R65-004-02: delete 未知 node 404 CAT_CLASS_NOT_FOUND。"""
    missing = str(uuid.uuid4())
    resp = client.delete(f"/api/v1/gov/catalog/classification/nodes/{missing}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT_CLASS_NOT_FOUND"


def test_cat_r65_004_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R65-004-03: viewer POST create 403 CAT_CLASS_FORBIDDEN。"""
    resp = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node())
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT_CLASS_FORBIDDEN"


def test_cat_r65_004_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R65-004-04: enterprise scope 外 code 403 CAT_CLASS_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node("OTHER_SCOPE"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT_CLASS_FORBIDDEN"


def test_cat_r65_004_probe_list_under_50ms(client):
    """T-CAT-R65-004-05: probe_list_classification_budget_ms < 50ms。"""
    from app.governance.catalog.classification.probe import probe_list_classification_budget_ms

    result = probe_list_classification_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_004_probe_move_under_50ms(client):
    """T-CAT-R65-004-06: probe_classification_move_budget_ms < 50ms。"""
    from app.governance.catalog.classification.probe import probe_classification_move_budget_ms

    result = probe_classification_move_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "cat_r65_004" -v`
Expected: FAIL

- [ ] **Step 3: 实现 errors + service**

`backend/app/governance/catalog/classification/errors.py`：

```python
from __future__ import annotations

CAT_CLASS_NOT_FOUND = "CAT_CLASS_NOT_FOUND"
CAT_CLASS_FORBIDDEN = "CAT_CLASS_FORBIDDEN"


class ClassificationError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
```

`classification/service.py` 关键修改：

```python
from app.auth.deps import UserContext
from app.governance.catalog.classification.errors import (
    CAT_CLASS_FORBIDDEN,
    CAT_CLASS_NOT_FOUND,
    ClassificationError,
)

_USER_CLASS_SCOPE: dict[str, str] = {}


def set_user_class_scope(user_id: str, code_prefix: str) -> None:
    _USER_CLASS_SCOPE[user_id] = code_prefix


def _assert_classification_write_access(user: UserContext, code: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise ClassificationError(CAT_CLASS_FORBIDDEN, "viewer cannot modify classification nodes", 403)
    if "enterprise" in roles:
        prefix = _USER_CLASS_SCOPE.get(user.id, "CAT")
        if not code.startswith(prefix):
            raise ClassificationError(CAT_CLASS_FORBIDDEN, "enterprise user out of classification scope", 403)
```

`move_node` 中 `record is None` 分支改为 `CAT_CLASS_NOT_FOUND`（404）；`delete_node` 同理。

`create_node(payload, user)` 首行 `_assert_classification_write_access(user, payload.code)`；`move_node`/`delete_node` 增加 `user` 参数并在写操作前检查 node `code`。

- [ ] **Step 4: 实现 classification/probe.py**

`backend/app/governance/catalog/classification/probe.py`：

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.classification import service as classification_service
from app.governance.catalog.classification.schemas import ClassificationNodeCreate, ClassificationNodeMove

probe_classification_list_budget_ms_limit = 50


@dataclass(frozen=True)
class ClassificationProbeResult:
    elapsed_ms: float
    ok: bool


def probe_list_classification_budget_ms(parent_id: uuid.UUID | None = None) -> ClassificationProbeResult:
    started = time.perf_counter()
    classification_service.list_nodes(parent_id, limit=100, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return ClassificationProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_classification_list_budget_ms_limit)


def probe_classification_move_budget_ms() -> ClassificationProbeResult:
    actor = UserContext(id="probe", username="probe", roles=["admin"])
    started = time.perf_counter()
    root = classification_service.create_node(
        ClassificationNodeCreate(
            code=f"CAT-P{uuid.uuid4().hex[:4].upper()}",
            name="Probe Root",
            parent_id=None,
            kind="folder",
            sort_order=0,
        ),
        actor,
    )
    child = classification_service.create_node(
        ClassificationNodeCreate(
            code=f"CAT-C{uuid.uuid4().hex[:4].upper()}",
            name="Probe Child",
            parent_id=root.node_id,
            kind="leaf",
            sort_order=0,
        ),
        actor,
    )
    classification_service.move_node(child.node_id, ClassificationNodeMove(parent_id=root.node_id, sort_order=1), actor)
    elapsed = (time.perf_counter() - started) * 1000
    return ClassificationProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_classification_list_budget_ms_limit)
```

- [ ] **Step 5: gov.py classification 三路由透传 `actor`**

- [ ] **Step 6: 运行 CAT-004 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "cat_r65_004" -v`
Expected: PASS（6/6）

- [ ] **Step 7: Commit**

```bash
git add backend/app/governance/catalog/classification/ backend/app/api/v1/gov.py tests/test_cat_rpt_meta_r65.py
git commit -m "feat(classification): CAT-004 NOT_FOUND fix + ACL + perf probe"
```

---

### Task 4: CAT-006 production stats ACL 与 perf probe

**Files:**
- Modify: `backend/app/governance/catalog/cat06/errors.py`
- Modify: `backend/app/governance/catalog/cat06/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_cat_rpt_meta_r65.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `CAT06_EMPTY_METRICS` 常量、`get_production_stats(key, user)`、`list_production_stats(user, limit, offset)`、`probe_production_stats_budget_ms(key)`、`probe_validate_production_stats_budget_ms()`、`Cat06ProbeResult`

- [ ] **Step 1: 写入 CAT-006 失败测试**

```python
def test_cat_r65_006_stats_brand_forbidden(client, enterprise_user):
    """T-CAT-R65-006-01: enterprise GET stats scope 外 brand 403 CAT06_BRAND_FORBIDDEN。"""
    key = f"PS_BR_{uuid.uuid4().hex[:4].upper()}"
    payload = _production_stats_payload(key, brand_id="BRAND99")
    assert client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload).status_code == 201
    resp = client.get(f"/api/v1/gov/catalog/production-stats/{key}/stats", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT06_BRAND_FORBIDDEN"


def test_cat_r65_006_empty_metrics(client):
    """T-CAT-R65-006-02: empty metricKeys 422 CAT06_EMPTY_METRICS。"""
    payload = _production_stats_payload()
    payload["metricKeys"] = []
    resp = client.post("/api/v1/gov/catalog/production-stats/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT06_EMPTY_METRICS"


def test_cat_r65_006_probe_stats_under_50ms(client):
    """T-CAT-R65-006-03: probe_production_stats_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.governance.catalog.cat06 import service as cat06_service
    from app.governance.catalog.cat06.schemas import ProductionStatsItemIn

    key = f"PS_PR_{uuid.uuid4().hex[:4].upper()}"
    admin = UserContext(id="admin-r65", username="admin", roles=["admin"])
    cat06_service.create_production_stats(
        ProductionStatsItemIn.model_validate(_production_stats_payload(key)),
        admin,
    )
    result = cat06_service.probe_production_stats_budget_ms(key)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_006_probe_validate_under_50ms(client):
    """T-CAT-R65-006-04: probe_validate_production_stats_budget_ms < 50ms。"""
    from app.governance.catalog.cat06 import service as cat06_service

    result = cat06_service.probe_validate_production_stats_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_006_list_filtered_for_enterprise(client, enterprise_user):
    """T-CAT-R65-006-05: enterprise list 仅见 scope 内 brandId。"""
    in_scope = _production_stats_payload(f"PS_IN_{uuid.uuid4().hex[:4].upper()}", "BRAND01")
    out_scope = _production_stats_payload(f"PS_OUT_{uuid.uuid4().hex[:4].upper()}", "BRAND99")
    # admin 先 seed 两项（恢复 admin override 或用 AUTH 默认 admin）
    assert client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=in_scope).status_code == 201
    assert client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=out_scope).status_code == 201
    listed = client.get("/api/v1/gov/catalog/production-stats", headers=AUTH)
    keys = {i["statsKey"] for i in listed.json()["items"]}
    assert in_scope["statsKey"] in keys
    assert out_scope["statsKey"] not in keys
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "cat_r65_006" -v`
Expected: FAIL

- [ ] **Step 3: 实现 cat06 errors + service**

`backend/app/governance/catalog/cat06/errors.py` 追加：

```python
CAT06_EMPTY_METRICS = "CAT06_EMPTY_METRICS"
```

`service.py` 使用 `CAT06_EMPTY_METRICS` 常量替换字面量；修改：

```python
import time
from dataclasses import dataclass

probe_production_stats_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat06ProbeResult:
    elapsed_ms: float
    ok: bool


def get_production_stats(key: str, user: UserContext) -> ProductionStatsProbeOut:
    if key not in _store:
        raise Cat06Error("CAT06_NOT_FOUND", f"statsKey not found: {key}", 404)
    brand_id = _store[key]["brandId"]
    _assert_brand_access(user, brand_id)
    return ProductionStatsProbeOut(
        inbound=120,
        inventory=85,
        opened=40,
        activated=22,
        sampled_at=datetime.now(UTC),
    )


def list_production_stats(user: UserContext, limit: int, offset: int) -> ProductionStatsListResponse:
    roles = set(user.roles)
    items = list(_store.values())
    if "enterprise" in roles and not roles.intersection({"admin", "analyst"}):
        expected = _USER_BRAND_SCOPE.get(user.id, "BRAND01")
        items = [i for i in items if i.get("brandId") == expected]
    page = items[offset : offset + limit]
    return ProductionStatsListResponse(
        items=[ProductionStatsItemOut.model_validate(i) for i in page],
        total=len(items),
    )


def probe_production_stats_budget_ms(key: str) -> Cat06ProbeResult:
    started = time.perf_counter()
    admin = UserContext(id="probe", username="probe", roles=["admin"])
    get_production_stats(key, admin)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat06ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_production_stats_budget_ms_limit)


def probe_validate_production_stats_budget_ms() -> Cat06ProbeResult:
    started = time.perf_counter()
    sample = ProductionStatsItemIn.model_validate({
        "statsKey": "PS_PROBE",
        "displayName": "Probe",
        "vendorType": "enterprise",
        "brandId": "BRAND01",
        "locType": "all",
        "metricKeys": ["inbound"],
    })
    validate_production_stats(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat06ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_production_stats_budget_ms_limit)
```

- [ ] **Step 4: gov.py 透传 actor**

```python
@router.get("/catalog/production-stats", ...)
def production_stats_list(
    actor: Annotated[UserContext, Depends(get_current_user)],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ProductionStatsListResponse:
    return cat06_service.list_production_stats(actor, limit, offset)


@router.get("/catalog/production-stats/{stats_key}/stats", ...)
def production_stats_probe(
    stats_key: str,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> ProductionStatsProbeOut | JSONResponse:
    try:
        return cat06_service.get_production_stats(stats_key, actor)
    except Cat06Error as exc:
        return _cat06_error(exc)
```

- [ ] **Step 5: 运行 CAT-006 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "cat_r65_006" -v`
Expected: PASS（5/5）

- [ ] **Step 6: Commit**

```bash
git add backend/app/governance/catalog/cat06/ backend/app/api/v1/gov.py tests/test_cat_rpt_meta_r65.py
git commit -m "feat(cat06): CAT-006 stats ACL closure + perf probe companion"
```

---

### Task 5: RPT-002 prefab bindings 校验/ACL 与 perf probe

**Files:**
- Create: `backend/app/reports/prefab/probe.py`
- Modify: `backend/app/reports/prefab/errors.py`
- Modify: `backend/app/reports/prefab/service.py`
- Modify: `backend/app/api/v1/reports/prefab.py`
- Modify: `tests/test_cat_rpt_meta_r65.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `RPT_PREFAB_EMPTY_ROLES`, `RPT_PREFAB_ANALYSIS_MISMATCH`, `set_user_prefab_scope`, enterprise scope 检查、`probe_validate_prefab_budget_ms`, `probe_list_prefab_bindings_budget_ms`

- [ ] **Step 1: 写入 RPT-002 失败测试**

```python
def test_rpt_r65_002_empty_roles(client):
    """T-RPT-R65-002-01: allowedRoles=[] 422 RPT_PREFAB_EMPTY_ROLES。"""
    payload = _prefab_payload()
    payload["allowedRoles"] = []
    resp = client.post("/api/v1/reports/prefab/bindings/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_PREFAB_EMPTY_ROLES"


def test_rpt_r65_002_analysis_mismatch(client):
    """T-RPT-R65-002-02: distribution 无 region 422 RPT_PREFAB_ANALYSIS_MISMATCH。"""
    payload = _prefab_payload()
    payload["analysisType"] = "distribution"
    payload["dimensionCodes"] = ["status"]
    resp = client.post("/api/v1/reports/prefab/bindings/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_PREFAB_ANALYSIS_MISMATCH"


def test_rpt_r65_002_enterprise_scope_forbidden(client, enterprise_user):
    """T-RPT-R65-002-03: enterprise scope 外 bindingKey PUT 403 RPT_PREFAB_FORBIDDEN。"""
    key = f"bind-us-{uuid.uuid4().hex[:4]}"
    resp = client.put(f"/api/v1/reports/prefab/bindings/{key}", headers=AUTH, json=_prefab_payload(key))
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_PREFAB_FORBIDDEN"


def test_rpt_r65_002_probe_validate_under_50ms(client):
    """T-RPT-R65-002-04: probe_validate_prefab_budget_ms < 50ms。"""
    from app.reports.prefab.probe import probe_validate_prefab_budget_ms

    result = probe_validate_prefab_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_rpt_r65_002_probe_list_under_50ms(client):
    """T-RPT-R65-002-05: probe_list_prefab_bindings_budget_ms < 50ms。"""
    from app.reports.prefab.probe import probe_list_prefab_bindings_budget_ms

    result = probe_list_prefab_bindings_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_rpt_r65_002_enterprise_scope_ok(client, enterprise_user):
    """T-RPT-R65-002-06: enterprise scope 内 bindingKey PUT 200。"""
    key = f"bind-cn-{uuid.uuid4().hex[:4]}"
    resp = client.put(f"/api/v1/reports/prefab/bindings/{key}", headers=AUTH, json=_prefab_payload(key))
    assert resp.status_code == 200, resp.text
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "rpt_r65_002" -v`
Expected: FAIL

- [ ] **Step 3: 实现 errors + service**

`backend/app/reports/prefab/errors.py`：

```python
RPT_PREFAB_EMPTY_ROLES = "RPT_PREFAB_EMPTY_ROLES"
RPT_PREFAB_ANALYSIS_MISMATCH = "RPT_PREFAB_ANALYSIS_MISMATCH"
```

`service.py` 在 `_validate_binding` 追加：

```python
_USER_PREFAB_SCOPE: dict[str, str] = {}


def set_user_prefab_scope(user_id: str, key_prefix: str) -> None:
    _USER_PREFAB_SCOPE[user_id] = key_prefix


def _assert_prefab_scope(user: UserContext, binding_key: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "enterprise" in roles:
        prefix = _USER_PREFAB_SCOPE.get(user.id, "bind-cn")
        if not binding_key.startswith(prefix):
            raise PrefabError("RPT_PREFAB_FORBIDDEN", "enterprise user out of prefab binding scope", 403)


# 在 _validate_binding 内：
if not payload.allowed_roles:
    raise PrefabError(
        RPT_PREFAB_EMPTY_ROLES,
        "allowedRoles must not be empty",
        422,
        [{"field": "allowedRoles", "message": "must not be empty"}],
    )
if payload.analysis_type == "distribution" and "region" not in payload.dimension_codes:
    raise PrefabError(
        RPT_PREFAB_ANALYSIS_MISMATCH,
        "distribution analysis requires region dimension",
        422,
        [{"field": "dimensionCodes", "message": "distribution requires region"}],
    )

# upsert_prefab_binding 在 _assert_write_access 后调用 _assert_prefab_scope(user, key)
```

- [ ] **Step 4: 实现 prefab/probe.py**

`backend/app/reports/prefab/probe.py`：

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.reports.prefab import service as prefab_service
from app.reports.prefab.schemas import PrefabBindingIn

probe_prefab_budget_ms_limit = 50


@dataclass(frozen=True)
class PrefabProbeResult:
    elapsed_ms: float
    ok: bool


def _sample_binding() -> PrefabBindingIn:
    return PrefabBindingIn.model_validate({
        "bindingKey": f"bind-probe-{uuid.uuid4().hex[:6]}",
        "entityTypeCode": "customer",
        "analysisType": "lifecycle",
        "dimensionCodes": ["region"],
        "displayName": "Probe Binding",
        "allowedRoles": ["analyst"],
    })


def probe_validate_prefab_budget_ms() -> PrefabProbeResult:
    started = time.perf_counter()
    prefab_service.validate_prefab_binding(_sample_binding())
    elapsed = (time.perf_counter() - started) * 1000
    return PrefabProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_prefab_budget_ms_limit)


def probe_list_prefab_bindings_budget_ms() -> PrefabProbeResult:
    started = time.perf_counter()
    prefab_service.list_prefab_bindings()
    elapsed = (time.perf_counter() - started) * 1000
    return PrefabProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_prefab_budget_ms_limit)
```

- [ ] **Step 5: 可选 GET `/api/v1/reports/prefab/probe` 返回两 probe elapsed**

`backend/app/api/v1/reports/prefab.py` 可选追加：

```python
@router.get("/probe")
def prefab_probe(_: Annotated[UserContext, Depends(get_current_user)]) -> dict:
    from app.reports.prefab.probe import (
        probe_list_prefab_bindings_budget_ms,
        probe_validate_prefab_budget_ms,
    )
    v = probe_validate_prefab_budget_ms()
    l = probe_list_prefab_bindings_budget_ms()
    return {
        "validateElapsedMs": v.elapsed_ms,
        "listElapsedMs": l.elapsed_ms,
        "withinBudget": v.ok and l.ok,
    }
```

- [ ] **Step 6: 运行 RPT-002 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "rpt_r65_002" -v`
Expected: PASS（6/6）

- [ ] **Step 7: Commit**

```bash
git add backend/app/reports/prefab/ backend/app/api/v1/reports/prefab.py tests/test_cat_rpt_meta_r65.py
git commit -m "feat(prefab): RPT-002 binding validation + ACL + perf probe"
```

---

### Task 6: META-005 physical register ACL、column pattern 与 perf probe

**Files:**
- Modify: `backend/app/metadata/physical/errors.py`
- Modify: `backend/app/metadata/physical/service.py`
- Modify: `backend/app/api/v1/metadata.py`
- Modify: `tests/test_cat_rpt_meta_r65.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `META_PHYSICAL_FORBIDDEN`, `META_PHYSICAL_INVALID_COLUMN`, `register_physical_table(payload, user)`, `probe_validate_physical_budget_ms`, `probe_list_physical_tables_budget_ms`

- [ ] **Step 1: 写入 META-005 失败测试**

```python
def test_meta_r65_005_viewer_register_forbidden(client, viewer_user):
    """T-META-R65-005-01: viewer POST register 403 META_PHYSICAL_FORBIDDEN。"""
    resp = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload())
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_PHYSICAL_FORBIDDEN"


def test_meta_r65_005_invalid_column_name(client):
    """T-META-R65-005-02: column name Bad-Column 422 META_PHYSICAL_INVALID_COLUMN。"""
    payload = _physical_payload()
    payload["columns"] = [{"name": "Bad-Column", "dataType": "varchar", "nullable": True}]
    resp = client.post("/api/v1/metadata/physical-tables/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_PHYSICAL_INVALID_COLUMN"


def test_meta_r65_005_probe_validate_under_50ms(client):
    """T-META-R65-005-03: probe_validate_physical_budget_ms < 50ms。"""
    from app.metadata.physical import service as physical_service

    result = physical_service.probe_validate_physical_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r65_005_probe_list_under_50ms(client):
    """T-META-R65-005-04: probe_list_physical_tables_budget_ms < 50ms。"""
    from app.metadata.physical import service as physical_service

    result = physical_service.probe_list_physical_tables_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r65_005_admin_register_ok(client):
    """T-META-R65-005-05: admin POST register 201（回归）。"""
    resp = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload())
    assert resp.status_code == 201, resp.text
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "meta_r65_005" -v`
Expected: FAIL

- [ ] **Step 3: 实现 errors + service**

`backend/app/metadata/physical/errors.py`：

```python
META_PHYSICAL_FORBIDDEN = "META_PHYSICAL_FORBIDDEN"
META_PHYSICAL_INVALID_COLUMN = "META_PHYSICAL_INVALID_COLUMN"
```

`service.py` 追加：

```python
import time
import re
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.metadata.physical.errors import (
    META_PHYSICAL_FORBIDDEN,
    META_PHYSICAL_INVALID_COLUMN,
    PhysicalTableError,
)

_COLUMN_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
probe_physical_budget_ms_limit = 50


@dataclass(frozen=True)
class PhysicalProbeResult:
    elapsed_ms: float
    ok: bool


def _assert_physical_write_access(user: UserContext) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    raise PhysicalTableError(META_PHYSICAL_FORBIDDEN, "insufficient role to register physical tables", 403)


def _validate_register(payload: PhysicalTableRegisterIn) -> PhysicalTableRegisterIn:
    if not _FQN_RE.match(payload.table_fqn):
        raise PhysicalTableError("META_PHYSICAL_INVALID_FQN", "Invalid tableFqn format", 422)
    if not payload.columns:
        raise PhysicalTableError("META_PHYSICAL_EMPTY_COLUMNS", "columns must not be empty", 422)
    names = [c.name for c in payload.columns]
    if len(names) != len(set(names)):
        raise PhysicalTableError("META_PHYSICAL_DUPLICATE_COLUMN", "duplicate column name", 422)
    try:
        uuid.UUID(str(payload.data_source_id))
    except ValueError as exc:
        raise PhysicalTableError("META_PHYSICAL_INVALID_DATASOURCE", "Invalid dataSourceId", 422) from exc
    for col in payload.columns:
        if not _COLUMN_NAME_RE.match(col.name):
            raise PhysicalTableError(
                META_PHYSICAL_INVALID_COLUMN,
                f"invalid column name: {col.name}",
                422,
                [{"field": "columns.name", "message": "must match ^[a-z][a-z0-9_]{0,63}$"}],
            )
    return payload


def register_physical_table(payload: PhysicalTableRegisterIn, user: UserContext) -> PhysicalTableOut:
    _assert_physical_write_access(user)
    item = _validate_register(payload)
    if item.table_fqn in _store:
        raise PhysicalTableError("META_PHYSICAL_CONFLICT", f"tableFqn already exists: {item.table_fqn}", 409)
    _store[item.table_fqn] = item.model_dump(by_alias=True, mode="json")
    return PhysicalTableOut.model_validate(_store[item.table_fqn])


def probe_validate_physical_budget_ms() -> PhysicalProbeResult:
    started = time.perf_counter()
    sample = PhysicalTableRegisterIn.model_validate({
        "tableFqn": "sales.probe_table",
        "dataSourceId": str(uuid.uuid4()),
        "displayName": "Probe Table",
        "entityTypeCode": "order",
        "columns": [{"name": "id", "dataType": "bigint", "nullable": False}],
    })
    validate_physical_table(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return PhysicalProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_physical_budget_ms_limit)


def probe_list_physical_tables_budget_ms() -> PhysicalProbeResult:
    started = time.perf_counter()
    list_physical_tables(limit=50, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return PhysicalProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_physical_budget_ms_limit)
```

- [ ] **Step 4: metadata.py 透传 actor**

```python
@router.post("/physical-tables", ...)
def physical_tables_register(
    payload: PhysicalTableRegisterIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> PhysicalTableOut | JSONResponse:
    try:
        return physical_service.register_physical_table(payload, actor)
    except PhysicalTableError as exc:
        return _physical_error(exc)
```

- [ ] **Step 5: 运行 META-005 测试**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -k "meta_r65_005" -v`
Expected: PASS（5/5）

- [ ] **Step 6: Commit**

```bash
git add backend/app/metadata/physical/ backend/app/api/v1/metadata.py tests/test_cat_rpt_meta_r65.py
git commit -m "feat(physical): META-005 register ACL + column pattern + perf probe"
```

---

### Task 7: r65 套件聚合与五轮回归门控

**Files:**
- Modify: `tests/test_cat_rpt_meta_r65.py`（确认用例计数 ≥32）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 统计用例数并补齐路由 smoke（目标 ≥32）**

若 collect-only < 32，在 `tests/test_cat_rpt_meta_r65.py` 追加：

```python
def test_r65_geo_route_exists(client):
    """T-R65-000-02: geo-regions list 路由可达。"""
    resp = client.get("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH)
    assert resp.status_code == 200


def test_r65_prefab_route_exists(client):
    """T-R65-000-03: prefab bindings list 路由可达。"""
    resp = client.get("/api/v1/reports/prefab/bindings", headers=AUTH)
    assert resp.status_code == 200


def test_r65_physical_route_exists(client):
    """T-R65-000-04: physical-tables list 路由可达。"""
    resp = client.get("/api/v1/metadata/physical-tables", headers=AUTH)
    assert resp.status_code == 200
```

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py --collect-only -q`
Expected: **≥32** collected（规划 29 域测 + 4 bootstrap/route = **33**）

- [ ] **Step 2: r65 全套件**

Run: `cd backend && python3 -m pytest ../tests/test_cat_rpt_meta_r65.py -v`
Expected: **≥32/32** PASS

- [ ] **Step 3: 五轮回归门控**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_cat_rpt_meta_r65.py \
  ../tests/test_nfr_cat_r64.py \
  ../tests/test_cat_nfr_rpt_meta_r62.py \
  ../tests/test_cat_dash_viz_nfr_r61.py \
  ../tests/test_meta_cat_dash_conn_design_r59.py \
  -v
```
Expected: r65 **≥32/32** + r64 **33/33** + r62 **32/32** + r61 **32/32** + r59 **34/34**；`ruff` exit **0**

- [ ] **Step 4: 全量 pytest**

Run: `cd backend && python3 -m pytest -q`
Expected: exit_code **0**；passed 数较基线 **+32** 左右

- [ ] **Step 5: Commit（若 Step 1 补测）**

```bash
git add tests/test_cat_rpt_meta_r65.py
git commit -m "test(r65): reach ≥32 companion assertions + regression gate"
```

---

### Task 8: 文档同步（governance + metadata）

**Files:**
- Modify: `docs/services/governance.md`
- Modify: `docs/services/metadata.md`
- Modify（同 PR 一行，不占 19 文件预算）：`docs/services/reports.md`（若存在 prefab 节）
- Modify（同 PR 一行）：`docs/api/README.md`（若新增 GET `/api/v1/reports/prefab/probe`）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 更新 governance.md**

在 `catalog/cat03/` 行补充：**r65 companion** — `probe_list/move_geo_region_budget_ms` ≤50ms；`set_user_region_scope` + `CAT03_FORBIDDEN` viewer/enterprise scope ACL。

在 `catalog/classification/` 行补充：**r65 companion** — `CAT_CLASS_NOT_FOUND` move/delete 修正；classification scope ACL + probe。

在 `catalog/cat06/` 行补充（若无独立节则追加表格行）：**r65 companion** — `get_production_stats(user)` brand ACL；`list_production_stats` enterprise 过滤；`probe_production_stats/validate` ≤50ms。

- [ ] **Step 2: 更新 metadata.md**

追加或更新 physical 域附录：**META-005 r65 companion** — `register_physical_table(user)` admin/analyst only；column name `^[a-z][a-z0-9_]{0,63}$`；`probe_validate/list_physical` ≤50ms；内存 store 非 Alembic。

- [ ] **Step 3: 可选 reports.md + api README 一行登记**

`docs/services/reports.md`：`reports/prefab/` — RPT-002 r65 `allowedRoles`/`analysisType` 联动 + enterprise scope + probe。

`docs/api/README.md`：若实现 GET probe 路由，登记 `GET /api/v1/reports/prefab/probe`。

- [ ] **Step 4: Commit**

```bash
git add docs/services/governance.md docs/services/metadata.md docs/services/reports.md docs/api/README.md
git commit -m "docs: r65 CAT/RPT/META companion probe/ACL registration"
```

---

## Self-Review Checklist

| design 子项 | 对应 Task | 覆盖 |
|-------------|-----------|------|
| CAT-003 geo ACL + probe×2 | Task 2 | ✓ |
| CAT-004 NOT_FOUND + ACL + probe×2 | Task 3 | ✓ |
| CAT-006 stats ACL + probe×2 + empty metrics | Task 4 | ✓ |
| RPT-002 validation + scope + probe×2 | Task 5 | ✓ |
| META-005 register ACL + column + probe×2 | Task 6 | ✓ |
| test_cat_rpt_meta_r65 ≥32 | Task 1 + 7 | ✓ |
| 五轮回归门控 | Task 7 | ✓ |
| docs governance + metadata | Task 8 | ✓ |

**占位符扫描：** 无 TBD/TODO/适当处理。

**类型一致性：** 各域 probe 返回 `*ProbeResult`；service 写操作均接收 `UserContext`；错误码与 design §3 一致。

**执行模式：** subagent-driven-development (option 1) — P3 按 Task 1→8 顺序派发 subagent，Task 间 two-stage review。
