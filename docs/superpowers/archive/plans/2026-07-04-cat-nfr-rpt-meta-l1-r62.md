# 跨域远期 stub L1 kickoff r62 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/governance/catalog/cat06/` · `backend/app/core/nfr/dashboard_sla.py` · `backend/app/core/nfr/errors.py` · `backend/app/reports/prefab/` · `backend/app/reports/templates/` · `backend/app/metadata/physical/` · `backend/app/api/v1/{gov,nfr,metadata}.py` · `backend/app/api/v1/reports/{prefab,templates,__init__}.py` · `backend/tests/test_cat_nfr_rpt_meta_r62.py`
> **子项：** CAT-006, NFR-003, RPT-002, RPT-003, META-005
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py` 由 P3 按 Files 动态匹配）

**Goal:** 交付五域 L1 薄骨架（生产统计模板、看板 SLA 探测、预制分析绑定、Word/Excel/PDF 模板定义、物理表元数据登记）+ ≥30 条 pytest smoke；五 PRD ID 加权总分 L1 目标 ≥80。

**Architecture:** 各子域独立 `errors/schemas/service` 三件套 + 薄 `api/v1` entry；全部进程内内存 dict；NFR-003 镜像 r61 `report_perf` mock probe 模式；RPT-002 只读校验 `metadata/dimensions` 内置 seed（`region`/`status`）；META-005 与 META-006 entity schema 分轨。纯后端、无 Alembic migration、不触 `fe/`。

**Tech Stack:** Python 3.11 / FastAPI / Pydantic v2 / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**、**UI Acceptance: N/A**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构；PRD 分片勾选留 **P5**（本 plan Task 8 不执行 docs 回写）。
- **分层纪律**（`common.mdc`）：域模块 = domain；`api/v1/*.py` = entry（不写业务 SQL/守卫细节）。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；`detail.fields` 为字段级错误列表。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/api/README.md`。
- **验证基线**（r61 P5）：`cd backend && python3 -m pytest -q` ≈ **1590 passed** / 4 skipped；本轮目标 **≥1620 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**：`test_cat_dash_viz_nfr_r61` **32/32** + `test_rpt_view_cat_gov_r60` **34/34** + `test_meta_cat_dash_conn_design_r59` **34/34** 全绿。
- **验证命令**（Task 8 全量）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    tests/test_cat_nfr_rpt_meta_r62.py \
    tests/test_cat_dash_viz_nfr_r61.py \
    tests/test_rpt_view_cat_gov_r60.py \
    tests/test_meta_cat_dash_conn_design_r59.py \
    -v && python3 -m pytest -q
  ```

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/governance/catalog/cat06/errors.py` | `Cat06Error` + `CAT06_*` | 新建 |
| `backend/app/governance/catalog/cat06/schemas.py` | ProductionStats DTO | 新建 |
| `backend/app/governance/catalog/cat06/service.py` | validate/create/list/stats + brand 域隔离 | 新建 |
| `backend/app/api/v1/gov.py` | +production-stats 路由簇（4 路由） | 修改 |
| `backend/app/core/nfr/dashboard_sla.py` | SLA validate/probe/alerts | 新建 |
| `backend/app/core/nfr/errors.py` | 追加 `DASHBOARD_SLA_*` | 修改 |
| `backend/app/api/v1/nfr.py` | +dashboard-sla 路由簇（3 路由） | 修改 |
| `backend/app/reports/prefab/errors.py` | `PrefabError` + `RPT_PREFAB_*` | 新建 |
| `backend/app/reports/prefab/schemas.py` | PrefabBinding DTO | 新建 |
| `backend/app/reports/prefab/service.py` | list/validate/upsert + dimension 守卫 | 新建 |
| `backend/app/api/v1/reports/prefab.py` | 薄 entry ≤3 路由 | 新建 |
| `backend/app/reports/templates/errors.py` | `TemplateDefError` + `RPT_TEMPLATE_*` | 新建 |
| `backend/app/reports/templates/schemas.py` | TemplateDefinition + Block DTO | 新建 |
| `backend/app/reports/templates/service.py` | define/validate/get + format 守卫 | 新建 |
| `backend/app/api/v1/reports/templates.py` | 薄 entry ≤3 路由 | 新建 |
| `backend/app/api/v1/reports/__init__.py` | `include_router(prefab/templates)` | 修改 |
| `backend/app/metadata/physical/errors.py` | `PhysicalTableError` + `META_PHYSICAL_*` | 新建 |
| `backend/app/metadata/physical/schemas.py` | PhysicalTableRegister DTO | 新建 |
| `backend/app/metadata/physical/service.py` | register/validate/get/list | 新建 |
| `backend/app/api/v1/metadata.py` | +physical-tables 路由簇（4 路由） | 修改 |
| `backend/tests/test_cat_nfr_rpt_meta_r62.py` | 新套件 ≥30 断言 | 新建 |

预估 **P3 生产代码文件 19** + **1 测试文件** = **20 文件 ≤20**。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_cat_nfr_rpt_meta_r62.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""跨域远期 stub L1 kickoff r62 — CAT/NFR/RPT/META."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R62_SQLITE_URL = "sqlite+pysqlite:///file:cat_nfr_rpt_meta_r62?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r62_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_nfr08 = os.environ.get("NFR08_RUNTIME_MODE")
    previous_sla = os.environ.get("DASHBOARD_SLA_MODE")
    os.environ["DATABASE_URL"] = _R62_SQLITE_URL
    os.environ.setdefault("NFR08_RUNTIME_MODE", "permissive")
    os.environ.pop("DASHBOARD_SLA_MODE", None)
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
    if previous_sla is None:
        os.environ.pop("DASHBOARD_SLA_MODE", None)
    else:
        os.environ["DASHBOARD_SLA_MODE"] = previous_sla
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat06 import service as cat06_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r62", username="enterprise", roles=["enterprise"])

    cat06_service.set_user_brand_scope("enterprise-r62", "BRAND01")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r62", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)
```

---

### Task 1: 测试夹具 + r62 启动 smoke

**Files:**
- Create: `backend/tests/test_cat_nfr_rpt_meta_r62.py`（夹具 + 2 条启动测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `r62_sqlite_env` module fixture；`enterprise_user` / `viewer_user` dependency overrides

- [ ] **Step 1: Write the failing test**

创建 `backend/tests/test_cat_nfr_rpt_meta_r62.py`，写入上文 **Shared Test Fixtures** 全文，并追加：

```python
def test_r62_fixture_bootstraps(client):
    """T-R62-000-01: r62 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r62_production_stats_route_missing(client):
    """T-R62-000-02: production-stats 路由尚未实现时 404。"""
    resp = client.post(
        "/api/v1/gov/catalog/production-stats/validate",
        headers=AUTH,
        json={"statsKey": "PS_DEMO", "displayName": "Demo", "vendorType": "enterprise", "brandId": "BRAND01"},
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py::test_r62_production_stats_route_missing -v`
Expected: PASS（路由未实现时 404 符合 RED 语义；若已存在则本步跳过）

- [ ] **Step 3: Write minimal implementation**

本 Task 仅建立夹具文件；域实现从 Task 2 起。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_cat_nfr_rpt_meta_r62.py
git commit -m "test(r62): fixtures + bootstrap smoke for CAT/NFR/RPT/META L1"
```

---

### Task 2: CAT-006 生产与销售统计 L1

**Files:**
- Create: `backend/app/governance/catalog/cat06/errors.py`
- Create: `backend/app/governance/catalog/cat06/schemas.py`
- Create: `backend/app/governance/catalog/cat06/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `backend/tests/test_cat_nfr_rpt_meta_r62.py`（+6 CAT 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `validate_production_stats`, `create_production_stats`, `list_production_stats`, `get_production_stats`; `set_user_brand_scope(user_id, brand_id)`; 路由前缀 `/api/v1/gov/catalog/production-stats`

- [ ] **Step 1: Write the failing tests**

在 `tests/test_cat_nfr_rpt_meta_r62.py` 追加：

```python
def _production_stats_payload(stats_key: str = "PS_DEMO", brand_id: str = "BRAND01") -> dict:
    return {
        "statsKey": stats_key,
        "displayName": "Production Demo",
        "vendorType": "enterprise",
        "brandId": brand_id,
        "locType": "all",
        "metricKeys": ["inbound", "inventory", "activation"],
    }


def test_cat_r62_006_validate_ok(client):
    """T-CAT-R62-006-01: POST validate 合法 payload 200 valid=true。"""
    resp = client.post(
        "/api/v1/gov/catalog/production-stats/validate",
        headers=AUTH,
        json=_production_stats_payload(),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["valid"] is True
    assert body["statsKey"] == "PS_DEMO"


def test_cat_r62_006_create_and_stats(client):
    """T-CAT-R62-006-02: POST create 201 + GET stats mock 分项。"""
    key = f"PS_{uuid.uuid4().hex[:6].upper()}"
    payload = _production_stats_payload(key)
    create = client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload)
    assert create.status_code == 201, create.text
    stats = client.get(f"/api/v1/gov/catalog/production-stats/{key}/stats", headers=AUTH)
    assert stats.status_code == 200
    body = stats.json()
    assert "inbound" in body and "activated" in body


def test_cat_r62_006_create_conflict(client):
    """T-CAT-R62-006-03: 重复 statsKey 409 CAT06_KEY_CONFLICT。"""
    key = f"PS_DUP_{uuid.uuid4().hex[:4].upper()}"
    payload = _production_stats_payload(key)
    assert client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "CAT06_KEY_CONFLICT"


def test_cat_r62_006_stats_not_found(client):
    """T-CAT-R62-006-04: 未知 statsKey 404 CAT06_NOT_FOUND。"""
    resp = client.get("/api/v1/gov/catalog/production-stats/MISSING_KEY/stats", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT06_NOT_FOUND"


def test_cat_r62_006_enterprise_brand_forbidden(client, enterprise_user):
    """T-CAT-R62-006-05: enterprise 用户跨 brandId 403 CAT06_BRAND_FORBIDDEN。"""
    payload = _production_stats_payload(f"PS_BR_{uuid.uuid4().hex[:4].upper()}", brand_id="BRAND99")
    resp = client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT06_BRAND_FORBIDDEN"


def test_cat_r62_006_invalid_vendor(client):
    """T-CAT-R62-006-06: 非法 vendorType 422 CAT06_INVALID_VENDOR。"""
    payload = _production_stats_payload()
    payload["vendorType"] = "invalid_vendor"
    resp = client.post("/api/v1/gov/catalog/production-stats/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT06_INVALID_VENDOR"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "cat_r62_006" -v`
Expected: FAIL — 404 on production-stats routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/governance/catalog/cat06/errors.py`：

```python
from __future__ import annotations


class Cat06Error(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
```

`backend/app/governance/catalog/cat06/schemas.py`：

```python
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

VendorType = Literal["enterprise", "scheme", "model", "dcas"]
LocType = Literal["warehouse", "retail", "all"]


class ProductionStatsItemIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    stats_key: str = Field(alias="statsKey", pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    vendor_type: VendorType = Field(alias="vendorType")
    brand_id: str = Field(alias="brandId", pattern=r"^[A-Z0-9]{2,16}$")
    loc_type: LocType = Field(default="all", alias="locType")
    metric_keys: list[str] = Field(
        default_factory=lambda: ["inbound", "inventory", "activation"],
        alias="metricKeys",
    )


class ProductionStatsItemOut(ProductionStatsItemIn):
    pass


class ProductionStatsValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    stats_key: str = Field(alias="statsKey")


class ProductionStatsProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    inbound: int
    inventory: int
    opened: int
    activated: int
    sampled_at: datetime = Field(alias="sampledAt")


class ProductionStatsListResponse(BaseModel):
    items: list[ProductionStatsItemOut]
    total: int
```

`backend/app/governance/catalog/cat06/service.py`：

```python
from __future__ import annotations

from datetime import UTC, datetime

from app.auth.deps import UserContext
from app.governance.catalog.cat06.errors import Cat06Error
from app.governance.catalog.cat06.schemas import (
    ProductionStatsItemIn,
    ProductionStatsItemOut,
    ProductionStatsListResponse,
    ProductionStatsProbeOut,
    ProductionStatsValidateOut,
)

_VALID_VENDOR = frozenset({"enterprise", "scheme", "model", "dcas"})
_store: dict[str, dict] = {}
_USER_BRAND_SCOPE: dict[str, str] = {}


def set_user_brand_scope(user_id: str, brand_id: str) -> None:
    _USER_BRAND_SCOPE[user_id] = brand_id


def _assert_brand_access(user: UserContext, brand_id: str) -> None:
    roles = set(user.roles)
    if "enterprise" in roles and not roles.intersection({"admin", "analyst"}):
        expected = _USER_BRAND_SCOPE.get(user.id, "BRAND01")
        if brand_id != expected:
            raise Cat06Error(
                "CAT06_BRAND_FORBIDDEN",
                f"enterprise user cannot access brand {brand_id}",
                403,
            )


def _validate_payload(payload: ProductionStatsItemIn) -> ProductionStatsItemIn:
    if payload.vendor_type not in _VALID_VENDOR:
        raise Cat06Error(
            "CAT06_INVALID_VENDOR",
            "Invalid vendorType",
            422,
            [{"field": "vendorType", "message": "invalid"}],
        )
    if not payload.metric_keys:
        raise Cat06Error(
            "CAT06_EMPTY_METRICS",
            "metricKeys must not be empty",
            422,
            [{"field": "metricKeys", "message": "must not be empty"}],
        )
    return payload


def validate_production_stats(payload: ProductionStatsItemIn) -> ProductionStatsValidateOut:
    item = _validate_payload(payload)
    return ProductionStatsValidateOut(valid=True, stats_key=item.stats_key)


def create_production_stats(payload: ProductionStatsItemIn, user: UserContext) -> ProductionStatsItemOut:
    item = _validate_payload(payload)
    _assert_brand_access(user, item.brand_id)
    if item.stats_key in _store:
        raise Cat06Error("CAT06_KEY_CONFLICT", f"statsKey already exists: {item.stats_key}", 409)
    _store[item.stats_key] = item.model_dump(by_alias=True, mode="json")
    return ProductionStatsItemOut.model_validate(_store[item.stats_key])


def list_production_stats(limit: int, offset: int) -> ProductionStatsListResponse:
    items = list(_store.values())
    page = items[offset : offset + limit]
    return ProductionStatsListResponse(
        items=[ProductionStatsItemOut.model_validate(i) for i in page],
        total=len(items),
    )


def get_production_stats(key: str) -> ProductionStatsProbeOut:
    if key not in _store:
        raise Cat06Error("CAT06_NOT_FOUND", f"statsKey not found: {key}", 404)
    return ProductionStatsProbeOut(
        inbound=120,
        inventory=85,
        opened=40,
        activated=22,
        sampled_at=datetime.now(UTC),
    )
```

在 `backend/app/api/v1/gov.py` 追加 import 与路由（镜像 cat05 模式）：

```python
from app.governance.catalog.cat06.errors import Cat06Error
from app.governance.catalog.cat06.schemas import (
    ProductionStatsItemIn,
    ProductionStatsItemOut,
    ProductionStatsListResponse,
    ProductionStatsProbeOut,
    ProductionStatsValidateOut,
)
from app.governance.catalog.cat06 import service as cat06_service


def _cat06_error(exc: Cat06Error) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/catalog/production-stats/validate", response_model=ProductionStatsValidateOut)
def production_stats_validate(
    payload: ProductionStatsItemIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ProductionStatsValidateOut | JSONResponse:
    try:
        return cat06_service.validate_production_stats(payload)
    except Cat06Error as exc:
        return _cat06_error(exc)


@router.post("/catalog/production-stats", response_model=ProductionStatsItemOut, status_code=status.HTTP_201_CREATED)
def production_stats_create(
    payload: ProductionStatsItemIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> ProductionStatsItemOut | JSONResponse:
    try:
        return cat06_service.create_production_stats(payload, actor)
    except Cat06Error as exc:
        return _cat06_error(exc)


@router.get("/catalog/production-stats", response_model=ProductionStatsListResponse)
def production_stats_list(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Annotated[UserContext, Depends(get_current_user)] = None,
) -> ProductionStatsListResponse:
    return cat06_service.list_production_stats(limit, offset)


@router.get("/catalog/production-stats/{stats_key}/stats", response_model=ProductionStatsProbeOut)
def production_stats_probe(
    stats_key: str,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ProductionStatsProbeOut | JSONResponse:
    try:
        return cat06_service.get_production_stats(stats_key)
    except Cat06Error as exc:
        return _cat06_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "cat_r62_006" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/catalog/cat06/ backend/app/api/v1/gov.py backend/tests/test_cat_nfr_rpt_meta_r62.py
git commit -m "feat(cat06): CAT-006 production stats template L1 + brand isolation"
```

---

### Task 3: NFR-003 核心看板可用性 SLA L1

**Files:**
- Create: `backend/app/core/nfr/dashboard_sla.py`
- Modify: `backend/app/core/nfr/errors.py`
- Modify: `backend/app/api/v1/nfr.py`
- Modify: `backend/tests/test_cat_nfr_rpt_meta_r62.py`（+6 NFR 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `validate_dashboard_sla`, `probe_dashboard_sla`, `get_dashboard_sla_alerts`; 错误常量 `DASHBOARD_SLA_*`

- [ ] **Step 1: Write the failing tests**

```python
def _sla_probe_payload(dashboard_id: str | None = None, **kwargs) -> dict:
    body = {"dashboardId": dashboard_id or str(uuid.uuid4()), "windowHours": 24, "slaTargetPercent": 99.5}
    body.update(kwargs)
    return body


def test_nfr_r62_003_validate_ok(client):
    """T-NFR-R62-003-01: POST validate 200 valid=true。"""
    resp = client.post("/api/v1/nfr/dashboard-sla/validate", headers=AUTH, json=_sla_probe_payload())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_nfr_r62_003_empty_dashboard(client):
    """T-NFR-R62-003-02: 空 dashboardId 422 DASHBOARD_SLA_DASHBOARD_REQUIRED。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/validate",
        headers=AUTH,
        json={"dashboardId": "", "windowHours": 24},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_SLA_DASHBOARD_REQUIRED"


def test_nfr_r62_003_probe_within_sla(client):
    """T-NFR-R62-003-03: POST probe 200 withinSla=true（mock 99.7）。"""
    resp = client.post("/api/v1/nfr/dashboard-sla/probe", headers=AUTH, json=_sla_probe_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["withinSla"] is True
    assert body["uptimePercent"] >= 99.5


def test_nfr_r62_003_probe_breach(client, monkeypatch):
    """T-NFR-R62-003-04: simulateBreach probe 503 DASHBOARD_SLA_BELOW_TARGET。"""
    payload = _sla_probe_payload(simulateBreach=True)
    resp = client.post("/api/v1/nfr/dashboard-sla/probe", headers=AUTH, json=payload)
    assert resp.status_code == 503
    assert resp.json()["code"] == "DASHBOARD_SLA_BELOW_TARGET"


def test_nfr_r62_003_alerts(client):
    """T-NFR-R62-003-05: GET alerts 200 configured 字段存在。"""
    resp = client.get("/api/v1/nfr/dashboard-sla/alerts", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "configured" in body
    assert "channels" in body


def test_nfr_r62_003_window_out_of_range(client):
    """T-NFR-R62-003-06: windowHours 越界 422 DASHBOARD_SLA_WINDOW_OUT_OF_RANGE。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/validate",
        headers=AUTH,
        json=_sla_probe_payload(windowHours=200),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_SLA_WINDOW_OUT_OF_RANGE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "nfr_r62_003" -v`
Expected: FAIL — 404 on dashboard-sla routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/errors.py` 追加：

```python
# NFR-003 核心看板可用性 SLA
DASHBOARD_SLA_DASHBOARD_REQUIRED = "DASHBOARD_SLA_DASHBOARD_REQUIRED"
DASHBOARD_SLA_WINDOW_OUT_OF_RANGE = "DASHBOARD_SLA_WINDOW_OUT_OF_RANGE"
DASHBOARD_SLA_BELOW_TARGET = "DASHBOARD_SLA_BELOW_TARGET"
```

`backend/app/core/nfr/dashboard_sla.py`：

```python
from __future__ import annotations

import os
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.nfr.errors import (
    DASHBOARD_SLA_BELOW_TARGET,
    DASHBOARD_SLA_DASHBOARD_REQUIRED,
    DASHBOARD_SLA_WINDOW_OUT_OF_RANGE,
)

_MOCK_UPTIME = 99.7
_ALERTS = {"enabled": True, "channels": ["email", "webhook"], "thresholdPercent": 99.5}


class DashboardSlaError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class DashboardSlaProbeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: str = Field(default="", alias="dashboardId", max_length=128)
    window_hours: int = Field(default=24, alias="windowHours")
    sla_target_percent: float = Field(default=99.5, alias="slaTargetPercent")
    simulate_breach: bool = Field(default=False, alias="simulateBreach")


class DashboardSlaValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    dashboard_id: str = Field(alias="dashboardId")


class DashboardSlaProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: str = Field(alias="dashboardId")
    uptime_percent: float = Field(alias="uptimePercent")
    sla_target_percent: float = Field(alias="slaTargetPercent")
    within_sla: bool = Field(alias="withinSla")
    window_hours: int = Field(alias="windowHours")
    sampled_at: datetime = Field(alias="sampledAt")


class DashboardSlaAlertsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    enabled: bool
    channels: list[str]
    threshold_percent: float = Field(alias="thresholdPercent")
    configured: bool


def _guard(payload: DashboardSlaProbeIn) -> DashboardSlaProbeIn:
    if not payload.dashboard_id or not payload.dashboard_id.strip():
        raise DashboardSlaError(
            DASHBOARD_SLA_DASHBOARD_REQUIRED,
            "dashboardId is required",
            422,
            [{"field": "dashboardId", "message": "required"}],
        )
    if payload.window_hours < 1 or payload.window_hours > 168:
        raise DashboardSlaError(DASHBOARD_SLA_WINDOW_OUT_OF_RANGE, "windowHours out of range", 422)
    if payload.sla_target_percent < 90.0 or payload.sla_target_percent > 99.99:
        raise DashboardSlaError("DASHBOARD_SLA_TARGET_OUT_OF_RANGE", "slaTargetPercent out of range", 422)
    return payload


def validate_dashboard_sla(payload: DashboardSlaProbeIn) -> DashboardSlaValidateOut:
    item = _guard(payload)
    return DashboardSlaValidateOut(valid=True, dashboard_id=item.dashboard_id)


def probe_dashboard_sla(payload: DashboardSlaProbeIn) -> DashboardSlaProbeOut:
    item = _guard(payload)
    uptime = 99.0 if item.simulate_breach else _MOCK_UPTIME
    within = uptime >= item.sla_target_percent
    strict = os.environ.get("DASHBOARD_SLA_MODE") == "strict"
    if (item.simulate_breach or strict) and not within:
        raise DashboardSlaError(DASHBOARD_SLA_BELOW_TARGET, "SLA below target", 503)
    return DashboardSlaProbeOut(
        dashboard_id=item.dashboard_id,
        uptime_percent=uptime,
        sla_target_percent=item.sla_target_percent,
        within_sla=within,
        window_hours=item.window_hours,
        sampled_at=datetime.now(UTC),
    )


def get_dashboard_sla_alerts() -> DashboardSlaAlertsOut:
    channels = _ALERTS["channels"]
    return DashboardSlaAlertsOut(
        enabled=_ALERTS["enabled"],
        channels=channels,
        threshold_percent=_ALERTS["thresholdPercent"],
        configured=bool(channels),
    )
```

`backend/app/api/v1/nfr.py` 追加 import 与路由：

```python
from app.core.nfr.dashboard_sla import (
    DashboardSlaAlertsOut,
    DashboardSlaError,
    DashboardSlaProbeIn,
    DashboardSlaProbeOut,
    DashboardSlaValidateOut,
    get_dashboard_sla_alerts,
    probe_dashboard_sla,
    validate_dashboard_sla,
)


def _dashboard_sla_error(exc: DashboardSlaError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/dashboard-sla/validate", response_model=DashboardSlaValidateOut)
def dashboard_sla_validate(
    payload: DashboardSlaProbeIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DashboardSlaValidateOut | JSONResponse:
    try:
        return validate_dashboard_sla(payload)
    except DashboardSlaError as exc:
        return _dashboard_sla_error(exc)


@router.post("/dashboard-sla/probe", response_model=DashboardSlaProbeOut)
def dashboard_sla_probe(
    payload: DashboardSlaProbeIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DashboardSlaProbeOut | JSONResponse:
    try:
        return probe_dashboard_sla(payload)
    except DashboardSlaError as exc:
        return _dashboard_sla_error(exc)


@router.get("/dashboard-sla/alerts", response_model=DashboardSlaAlertsOut)
def dashboard_sla_alerts(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DashboardSlaAlertsOut:
    return get_dashboard_sla_alerts()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "nfr_r62_003" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/dashboard_sla.py backend/app/core/nfr/errors.py backend/app/api/v1/nfr.py backend/tests/test_cat_nfr_rpt_meta_r62.py
git commit -m "feat(nfr): NFR-003 dashboard SLA probe + alerts stub L1"
```

---

### Task 4: RPT-002 预制分析报表绑定 L1

**Files:**
- Create: `backend/app/reports/prefab/errors.py`
- Create: `backend/app/reports/prefab/schemas.py`
- Create: `backend/app/reports/prefab/service.py`
- Create: `backend/app/api/v1/reports/prefab.py`
- Modify: `backend/app/api/v1/reports/__init__.py`
- Modify: `backend/tests/test_cat_nfr_rpt_meta_r62.py`（+6 RPT-002 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `list_prefab_bindings`, `validate_prefab_binding`, `upsert_prefab_binding`; 内置维度 seed `region`/`status`

- [ ] **Step 1: Write the failing tests**

```python
def _prefab_payload(binding_key: str | None = None) -> dict:
    return {
        "bindingKey": binding_key or f"bind-{uuid.uuid4().hex[:8]}",
        "entityTypeCode": "customer",
        "analysisType": "lifecycle",
        "dimensionCodes": ["region"],
        "displayName": "Customer Lifecycle",
        "allowedRoles": ["analyst"],
    }


def test_rpt_r62_002_list_empty(client):
    """T-RPT-R62-002-01: GET bindings 空列表 200。"""
    resp = client.get("/api/v1/reports/prefab/bindings", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []


def test_rpt_r62_002_validate_ok(client):
    """T-RPT-R62-002-02: POST validate 合法 200 valid=true。"""
    resp = client.post(
        "/api/v1/reports/prefab/bindings/validate",
        headers=AUTH,
        json=_prefab_payload(),
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_rpt_r62_002_dimension_unknown(client):
    """T-RPT-R62-002-03: 未知 dimension 422 RPT_PREFAB_DIMENSION_UNKNOWN。"""
    payload = _prefab_payload()
    payload["dimensionCodes"] = ["missing_dim"]
    resp = client.post("/api/v1/reports/prefab/bindings/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_PREFAB_DIMENSION_UNKNOWN"


def test_rpt_r62_002_upsert_and_list(client):
    """T-RPT-R62-002-04: PUT upsert 200 + GET 列表含项。"""
    key = f"bind-{uuid.uuid4().hex[:6]}"
    payload = _prefab_payload(key)
    put = client.put(f"/api/v1/reports/prefab/bindings/{key}", headers=AUTH, json=payload)
    assert put.status_code == 200, put.text
    listed = client.get("/api/v1/reports/prefab/bindings", headers=AUTH)
    assert any(i["bindingKey"] == key for i in listed.json()["items"])


def test_rpt_r62_002_viewer_forbidden(client, viewer_user):
    """T-RPT-R62-002-05: viewer 角色 PUT 403 RPT_PREFAB_FORBIDDEN。"""
    key = f"bind-v-{uuid.uuid4().hex[:4]}"
    resp = client.put(f"/api/v1/reports/prefab/bindings/{key}", headers=AUTH, json=_prefab_payload(key))
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_PREFAB_FORBIDDEN"


def test_rpt_r62_002_upsert_idempotent(client):
    """T-RPT-R62-002-06: 重复 PUT 覆盖幂等 200。"""
    key = f"bind-idem-{uuid.uuid4().hex[:4]}"
    payload = _prefab_payload(key)
    assert client.put(f"/api/v1/reports/prefab/bindings/{key}", headers=AUTH, json=payload).status_code == 200
    payload["displayName"] = "Updated Name"
    again = client.put(f"/api/v1/reports/prefab/bindings/{key}", headers=AUTH, json=payload)
    assert again.status_code == 200
    assert again.json()["displayName"] == "Updated Name"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "rpt_r62_002" -v`
Expected: FAIL — 404 on prefab routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/reports/prefab/errors.py`：

```python
from __future__ import annotations


class PrefabError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
```

`backend/app/reports/prefab/schemas.py`：

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AnalysisType = Literal["lifecycle", "activity", "trend", "distribution"]


class PrefabBindingIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    binding_key: str = Field(alias="bindingKey", pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    entity_type_code: str = Field(alias="entityTypeCode", pattern=r"^[a-z][a-z0-9_]{1,63}$")
    analysis_type: AnalysisType = Field(alias="analysisType")
    dimension_codes: list[str] = Field(min_length=1, alias="dimensionCodes")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    allowed_roles: list[str] = Field(default_factory=lambda: ["analyst"], alias="allowedRoles")


class PrefabBindingOut(PrefabBindingIn):
    pass


class PrefabBindingValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    binding_key: str = Field(alias="bindingKey")


class PrefabBindingListResponse(BaseModel):
    items: list[PrefabBindingOut]
    total: int
```

`backend/app/reports/prefab/service.py`：

```python
from __future__ import annotations

import re

from app.auth.deps import UserContext
from app.reports.prefab.errors import PrefabError
from app.reports.prefab.schemas import (
    PrefabBindingIn,
    PrefabBindingListResponse,
    PrefabBindingOut,
    PrefabBindingValidateOut,
)

_ENTITY_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
_KNOWN_DIMENSIONS = frozenset({"region", "status"})
_store: dict[str, dict] = {}


def _assert_write_access(user: UserContext) -> None:
    roles = set(user.roles)
    if roles <= {"viewer"} or (roles == {"viewer"}):
        raise PrefabError("RPT_PREFAB_FORBIDDEN", "viewer cannot upsert prefab bindings", 403)


def _validate_binding(payload: PrefabBindingIn) -> PrefabBindingIn:
    if not _ENTITY_RE.match(payload.entity_type_code):
        raise PrefabError(
            "RPT_PREFAB_INVALID_ENTITY",
            "Invalid entityTypeCode",
            422,
            [{"field": "entityTypeCode", "message": "invalid pattern"}],
        )
    unknown = [c for c in payload.dimension_codes if c not in _KNOWN_DIMENSIONS]
    if unknown:
        raise PrefabError(
            "RPT_PREFAB_DIMENSION_UNKNOWN",
            f"Unknown dimension codes: {unknown[0]}",
            422,
            [{"field": "dimensionCodes", "message": f"unknown: {unknown[0]}"}],
        )
    return payload


def list_prefab_bindings() -> PrefabBindingListResponse:
    items = list(_store.values())
    return PrefabBindingListResponse(
        items=[PrefabBindingOut.model_validate(i) for i in items],
        total=len(items),
    )


def validate_prefab_binding(payload: PrefabBindingIn) -> PrefabBindingValidateOut:
    item = _validate_binding(payload)
    return PrefabBindingValidateOut(valid=True, binding_key=item.binding_key)


def upsert_prefab_binding(key: str, payload: PrefabBindingIn, user: UserContext) -> PrefabBindingOut:
    _assert_write_access(user)
    if key != payload.binding_key:
        raise PrefabError("RPT_PREFAB_KEY_MISMATCH", "path binding_key mismatch", 422)
    item = _validate_binding(payload)
    _store[key] = item.model_dump(by_alias=True, mode="json")
    return PrefabBindingOut.model_validate(_store[key])
```

`backend/app/api/v1/reports/prefab.py`：

```python
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, get_current_user
from app.reports.prefab.errors import PrefabError
from app.reports.prefab.schemas import (
    PrefabBindingIn,
    PrefabBindingListResponse,
    PrefabBindingOut,
    PrefabBindingValidateOut,
)
from app.reports.prefab import service as prefab_service

router = APIRouter(prefix="/prefab", tags=["reports-prefab"])


def _prefab_error(exc: PrefabError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.get("/bindings", response_model=PrefabBindingListResponse)
def list_bindings(_: Annotated[UserContext, Depends(get_current_user)]) -> PrefabBindingListResponse:
    return prefab_service.list_prefab_bindings()


@router.post("/bindings/validate", response_model=PrefabBindingValidateOut)
def validate_binding(
    payload: PrefabBindingIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> PrefabBindingValidateOut | JSONResponse:
    try:
        return prefab_service.validate_prefab_binding(payload)
    except PrefabError as exc:
        return _prefab_error(exc)


@router.put("/bindings/{binding_key}", response_model=PrefabBindingOut)
def upsert_binding(
    binding_key: str,
    payload: PrefabBindingIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> PrefabBindingOut | JSONResponse:
    try:
        return prefab_service.upsert_prefab_binding(binding_key, payload, actor)
    except PrefabError as exc:
        return _prefab_error(exc)
```

`backend/app/api/v1/reports/__init__.py` 追加：

```python
from app.api.v1.reports.prefab import router as prefab_router

router.include_router(prefab_router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "rpt_r62_002" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/prefab/ backend/app/api/v1/reports/prefab.py backend/app/api/v1/reports/__init__.py backend/tests/test_cat_nfr_rpt_meta_r62.py
git commit -m "feat(reports): RPT-002 prefab analysis binding L1"
```

---

### Task 5: RPT-003 Word/Excel/PDF 模板定义 L1

**Files:**
- Create: `backend/app/reports/templates/errors.py`
- Create: `backend/app/reports/templates/schemas.py`
- Create: `backend/app/reports/templates/service.py`
- Create: `backend/app/api/v1/reports/templates.py`
- Modify: `backend/app/api/v1/reports/__init__.py`
- Modify: `backend/tests/test_cat_nfr_rpt_meta_r62.py`（+6 RPT-003 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `validate_template_definition`, `upsert_template_definition`, `get_template_definition`

- [ ] **Step 1: Write the failing tests**

```python
def _template_payload(template_key: str | None = None) -> dict:
    key = template_key or f"tmpl-{uuid.uuid4().hex[:8]}"
    return {
        "templateKey": key,
        "format": "word",
        "displayName": "Sales Report",
        "blocks": [{"blockType": "sql", "queryRef": "q_sales_summary"}],
    }


def test_rpt_r62_003_validate_word_sql(client):
    """T-RPT-R62-003-01: POST validate word+sql 块 200。"""
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=_template_payload())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_rpt_r62_003_empty_blocks(client):
    """T-RPT-R62-003-02: 空 blocks 422 RPT_TEMPLATE_EMPTY_BLOCKS。"""
    payload = _template_payload()
    payload["blocks"] = []
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_TEMPLATE_EMPTY_BLOCKS"


def test_rpt_r62_003_invalid_block(client):
    """T-RPT-R62-003-03: 非法 blockType 422 RPT_TEMPLATE_INVALID_BLOCK。"""
    payload = _template_payload()
    payload["blocks"] = [{"blockType": "unknown", "queryRef": "x"}]
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_TEMPLATE_INVALID_BLOCK"


def test_rpt_r62_003_put_get_roundtrip(client):
    """T-RPT-R62-003-04: PUT 登记后 GET 200 回读一致。"""
    key = f"tmpl-rt-{uuid.uuid4().hex[:6]}"
    payload = _template_payload(key)
    assert client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=payload).status_code == 200
    got = client.get(f"/api/v1/reports/templates/{key}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["displayName"] == payload["displayName"]


def test_rpt_r62_003_not_found(client):
    """T-RPT-R62-003-05: GET 未知 templateKey 404 RPT_TEMPLATE_NOT_FOUND。"""
    resp = client.get("/api/v1/reports/templates/missing-template-key", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_TEMPLATE_NOT_FOUND"


def test_rpt_r62_003_chart_block(client):
    """T-RPT-R62-003-06: chart 块须 chartType 合法 200。"""
    payload = _template_payload()
    payload["format"] = "pdf"
    payload["blocks"] = [{"blockType": "chart", "chartType": "line"}]
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "rpt_r62_003" -v`
Expected: FAIL — 404 on templates routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/reports/templates/errors.py`：

```python
from __future__ import annotations


class TemplateDefError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
```

`backend/app/reports/templates/schemas.py`：

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TemplateFormat = Literal["word", "excel", "pdf"]
BlockType = Literal["sql", "table", "chart"]
ChartType = Literal["line", "bar", "pie"]


class TemplateBlock(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    block_type: BlockType = Field(alias="blockType")
    query_ref: str | None = Field(default=None, alias="queryRef", max_length=256)
    table_ref: str | None = Field(default=None, alias="tableRef", max_length=256)
    chart_type: ChartType | None = Field(default=None, alias="chartType")


class TemplateDefinitionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    template_key: str = Field(alias="templateKey", pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    format: TemplateFormat
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    blocks: list[TemplateBlock]


class TemplateDefinitionOut(TemplateDefinitionIn):
    pass


class TemplateValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    template_key: str = Field(alias="templateKey")
    block_count: int = Field(alias="blockCount")
```

`backend/app/reports/templates/service.py`：

```python
from __future__ import annotations

from app.reports.templates.errors import TemplateDefError
from app.reports.templates.schemas import (
    TemplateBlock,
    TemplateDefinitionIn,
    TemplateDefinitionOut,
    TemplateValidateOut,
)

_VALID_BLOCKS = frozenset({"sql", "table", "chart"})
_store: dict[str, dict] = {}


def _validate_block(block: TemplateBlock) -> None:
    if block.block_type not in _VALID_BLOCKS:
        raise TemplateDefError("RPT_TEMPLATE_INVALID_BLOCK", "Invalid blockType", 422)
    if block.block_type == "sql" and not (block.query_ref and block.query_ref.strip()):
        raise TemplateDefError("RPT_TEMPLATE_INVALID_BLOCK", "sql block requires queryRef", 422)
    if block.block_type == "table" and not (block.table_ref and block.table_ref.strip()):
        raise TemplateDefError("RPT_TEMPLATE_INVALID_BLOCK", "table block requires tableRef", 422)
    if block.block_type == "chart" and block.chart_type is None:
        raise TemplateDefError("RPT_TEMPLATE_INVALID_BLOCK", "chart block requires chartType", 422)


def _validate_definition(payload: TemplateDefinitionIn) -> TemplateDefinitionIn:
    if not payload.blocks:
        raise TemplateDefError("RPT_TEMPLATE_EMPTY_BLOCKS", "blocks must not be empty", 422)
    for block in payload.blocks:
        _validate_block(block)
    return payload


def validate_template_definition(payload: TemplateDefinitionIn) -> TemplateValidateOut:
    item = _validate_definition(payload)
    return TemplateValidateOut(valid=True, template_key=item.template_key, block_count=len(item.blocks))


def upsert_template_definition(key: str, payload: TemplateDefinitionIn) -> TemplateDefinitionOut:
    if key != payload.template_key:
        raise TemplateDefError("RPT_TEMPLATE_KEY_MISMATCH", "path template_key mismatch", 422)
    item = _validate_definition(payload)
    _store[key] = item.model_dump(by_alias=True, mode="json")
    return TemplateDefinitionOut.model_validate(_store[key])


def get_template_definition(key: str) -> TemplateDefinitionOut:
    if key not in _store:
        raise TemplateDefError("RPT_TEMPLATE_NOT_FOUND", f"templateKey not found: {key}", 404)
    return TemplateDefinitionOut.model_validate(_store[key])
```

`backend/app/api/v1/reports/templates.py`：

```python
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, get_current_user
from app.reports.templates.errors import TemplateDefError
from app.reports.templates.schemas import TemplateDefinitionIn, TemplateDefinitionOut, TemplateValidateOut
from app.reports.templates import service as template_service

router = APIRouter(prefix="/templates", tags=["reports-templates"])


def _template_error(exc: TemplateDefError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/validate", response_model=TemplateValidateOut)
def validate_template(
    payload: TemplateDefinitionIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> TemplateValidateOut | JSONResponse:
    try:
        return template_service.validate_template_definition(payload)
    except TemplateDefError as exc:
        return _template_error(exc)


@router.put("/{template_key}", response_model=TemplateDefinitionOut)
def upsert_template(
    template_key: str,
    payload: TemplateDefinitionIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> TemplateDefinitionOut | JSONResponse:
    try:
        return template_service.upsert_template_definition(template_key, payload)
    except TemplateDefError as exc:
        return _template_error(exc)


@router.get("/{template_key}", response_model=TemplateDefinitionOut)
def get_template(
    template_key: str,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> TemplateDefinitionOut | JSONResponse:
    try:
        return template_service.get_template_definition(template_key)
    except TemplateDefError as exc:
        return _template_error(exc)
```

`backend/app/api/v1/reports/__init__.py` 追加：

```python
from app.api.v1.reports.templates import router as templates_router

router.include_router(templates_router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "rpt_r62_003" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/templates/ backend/app/api/v1/reports/templates.py backend/app/api/v1/reports/__init__.py backend/tests/test_cat_nfr_rpt_meta_r62.py
git commit -m "feat(reports): RPT-003 template definition blocks L1"
```

---

### Task 6: META-005 物理表元数据登记 L1

**Files:**
- Create: `backend/app/metadata/physical/errors.py`
- Create: `backend/app/metadata/physical/schemas.py`
- Create: `backend/app/metadata/physical/service.py`
- Modify: `backend/app/api/v1/metadata.py`
- Modify: `backend/tests/test_cat_nfr_rpt_meta_r62.py`（+6 META 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `register_physical_table`, `validate_physical_table`, `get_physical_table`, `list_physical_tables`; GET 详情用 query `?fqn=`

- [ ] **Step 1: Write the failing tests**

```python
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


def test_meta_r62_005_register(client):
    """T-META-R62-005-01: POST register 201。"""
    resp = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload())
    assert resp.status_code == 201, resp.text


def test_meta_r62_005_duplicate_conflict(client):
    """T-META-R62-005-02: 重复 fqn 409 META_PHYSICAL_CONFLICT。"""
    fqn = f"sales.dup_{uuid.uuid4().hex[:6]}"
    payload = _physical_payload(fqn)
    assert client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_PHYSICAL_CONFLICT"


def test_meta_r62_005_empty_columns(client):
    """T-META-R62-005-03: POST validate 空 columns 422 META_PHYSICAL_EMPTY_COLUMNS。"""
    payload = _physical_payload()
    payload["columns"] = []
    resp = client.post("/api/v1/metadata/physical-tables/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_PHYSICAL_EMPTY_COLUMNS"


def test_meta_r62_005_not_found(client):
    """T-META-R62-005-04: GET 未知 fqn 404 META_PHYSICAL_NOT_FOUND。"""
    resp = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"fqn": "missing.table"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "META_PHYSICAL_NOT_FOUND"


def test_meta_r62_005_duplicate_column(client):
    """T-META-R62-005-05: 列名重复 422 META_PHYSICAL_DUPLICATE_COLUMN。"""
    payload = _physical_payload()
    payload["columns"] = [
        {"name": "id", "dataType": "bigint", "nullable": False},
        {"name": "id", "dataType": "int", "nullable": True},
    ]
    resp = client.post("/api/v1/metadata/physical-tables/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_PHYSICAL_DUPLICATE_COLUMN"


def test_meta_r62_005_list_contains(client):
    """T-META-R62-005-06: GET list 含已登记项。"""
    fqn = f"inventory.stock_{uuid.uuid4().hex[:6]}"
    assert client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload(fqn)).status_code == 201
    listed = client.get("/api/v1/metadata/physical-tables", headers=AUTH)
    assert listed.status_code == 200
    assert any(i["tableFqn"] == fqn for i in listed.json()["items"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "meta_r62_005" -v`
Expected: FAIL — 404 on physical-tables routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/metadata/physical/errors.py`：

```python
from __future__ import annotations


class PhysicalTableError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)
```

`backend/app/metadata/physical/schemas.py`：

```python
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class PhysicalColumn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=64)
    data_type: str = Field(alias="dataType", min_length=1, max_length=32)
    nullable: bool = True
    description: str | None = Field(default=None, max_length=256)


class PhysicalTableRegisterIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    table_fqn: str = Field(
        alias="tableFqn",
        pattern=r"^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{1,63}$",
    )
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    entity_type_code: str | None = Field(default=None, alias="entityTypeCode", max_length=64)
    columns: list[PhysicalColumn]


class PhysicalTableOut(PhysicalTableRegisterIn):
    pass


class PhysicalTableValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    table_fqn: str = Field(alias="tableFqn")
    column_count: int = Field(alias="columnCount")


class PhysicalTableListResponse(BaseModel):
    items: list[PhysicalTableOut]
    total: int
```

`backend/app/metadata/physical/service.py`：

```python
from __future__ import annotations

import re
import uuid

from app.metadata.physical.errors import PhysicalTableError
from app.metadata.physical.schemas import (
    PhysicalTableListResponse,
    PhysicalTableOut,
    PhysicalTableRegisterIn,
    PhysicalTableValidateOut,
)

_FQN_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{1,63}$")
_store: dict[str, dict] = {}


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
    return payload


def validate_physical_table(payload: PhysicalTableRegisterIn) -> PhysicalTableValidateOut:
    item = _validate_register(payload)
    return PhysicalTableValidateOut(valid=True, table_fqn=item.table_fqn, column_count=len(item.columns))


def register_physical_table(payload: PhysicalTableRegisterIn) -> PhysicalTableOut:
    item = _validate_register(payload)
    if item.table_fqn in _store:
        raise PhysicalTableError("META_PHYSICAL_CONFLICT", f"tableFqn already exists: {item.table_fqn}", 409)
    _store[item.table_fqn] = item.model_dump(by_alias=True, mode="json")
    return PhysicalTableOut.model_validate(_store[item.table_fqn])


def get_physical_table(fqn: str) -> PhysicalTableOut:
    if fqn not in _store:
        raise PhysicalTableError("META_PHYSICAL_NOT_FOUND", f"tableFqn not found: {fqn}", 404)
    return PhysicalTableOut.model_validate(_store[fqn])


def list_physical_tables(limit: int = 50, offset: int = 0) -> PhysicalTableListResponse:
    items = list(_store.values())
    page = items[offset : offset + limit]
    return PhysicalTableListResponse(
        items=[PhysicalTableOut.model_validate(i) for i in page],
        total=len(items),
    )
```

`backend/app/api/v1/metadata.py` 追加：

```python
from app.metadata.physical.errors import PhysicalTableError
from app.metadata.physical.schemas import (
    PhysicalTableListResponse,
    PhysicalTableOut,
    PhysicalTableRegisterIn,
    PhysicalTableValidateOut,
)
from app.metadata.physical import service as physical_service


def _physical_error(exc: PhysicalTableError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.get("/physical-tables", response_model=None)
def physical_tables_get(
  fqn: str | None = Query(default=None),
  limit: int = Query(default=50, ge=1, le=200),
  offset: int = Query(default=0, ge=0),
  _: Annotated[UserContext, Depends(get_current_user)] = None,
):
    if fqn is not None:
        try:
            return physical_service.get_physical_table(fqn)
        except PhysicalTableError as exc:
            return _physical_error(exc)
    return physical_service.list_physical_tables(limit, offset)


@router.post("/physical-tables", response_model=PhysicalTableOut, status_code=status.HTTP_201_CREATED)
def physical_tables_register(
    payload: PhysicalTableRegisterIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> PhysicalTableOut | JSONResponse:
    try:
        return physical_service.register_physical_table(payload)
    except PhysicalTableError as exc:
        return _physical_error(exc)


@router.post("/physical-tables/validate", response_model=PhysicalTableValidateOut)
def physical_tables_validate(
    payload: PhysicalTableRegisterIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> PhysicalTableValidateOut | JSONResponse:
    try:
        return physical_service.validate_physical_table(payload)
    except PhysicalTableError as exc:
        return _physical_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -k "meta_r62_005" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/physical/ backend/app/api/v1/metadata.py backend/tests/test_cat_nfr_rpt_meta_r62.py
git commit -m "feat(metadata): META-005 physical table register L1"
```

---

### Task 7: r62 全量 smoke 聚合验证

**Files:**
- Modify: `backend/tests/test_cat_nfr_rpt_meta_r62.py`（确认 ≥32 断言全绿）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: Run full r62 test module**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -v`
Expected: **≥32 passed**（2 boot + 6×5 域 = 32）

- [ ] **Step 2: Assert count**

Run: `cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py --collect-only -q | tail -1`
Expected: collected **32** items

- [ ] **Step 3: Ruff on touched paths**

Run: `cd backend && python3 -m ruff check app/governance/catalog/cat06 app/core/nfr/dashboard_sla.py app/reports/prefab app/reports/templates app/metadata/physical app/api/v1/gov.py app/api/v1/nfr.py app/api/v1/metadata.py app/api/v1/reports/ tests/test_cat_nfr_rpt_meta_r62.py`
Expected: All checks passed

- [ ] **Step 4: Commit**（若有 lint 微调）

```bash
git add -A
git commit -m "test(r62): aggregate smoke — 32 assertions across five L1 domains"
```

---

### Task 8: 三轮回归门控 + 全量 pytest

**Files:**（无新文件；仅验证）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: r62 + r61 + r60 + r59 回归套件**

Run:
```bash
cd backend && python3 -m pytest \
  tests/test_cat_nfr_rpt_meta_r62.py \
  tests/test_cat_dash_viz_nfr_r61.py \
  tests/test_rpt_view_cat_gov_r60.py \
  tests/test_meta_cat_dash_conn_design_r59.py \
  -v
```
Expected: r62 **32/32** + r61 **32/32** + r60 **34/34** + r59 **34/34** = **132/132** passed

- [ ] **Step 2: 全量 pytest**

Run: `cd backend && python3 -m pytest -q`
Expected: exit 0；passed ≥ **1620**；skipped **4**

- [ ] **Step 3: 全量 ruff**

Run: `cd backend && python3 -m ruff check .`
Expected: All checks passed

- [ ] **Step 4: Commit**（若 Step 1–3 仅验证无代码变更则跳过）

```bash
git status --porcelain
# 工作区干净则无需 commit
```

---

## Self-Review（P2 已完成）

| 检查项 | 结果 |
|--------|------|
| design 五子项均有 Task | Task 2–6 对应 CAT-006/NFR-003/RPT-002/RPT-003/META-005 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 有验证命令 | 通过 |
| 全 Task UI skill none | 通过 |
| 文件数 ≤20 | 19 生产 + 1 测试 = 20 |
| 新测 ≥30 | 32 断言（2 boot + 30 域） |
| 8 Task 惯例 | Task 1–8 |
| P5 docs 不在 P3 | Task 8 仅验证，docs 留 P5 |

**执行模式（固定）：** subagent-driven-development (option 1) — 每 Task 派发独立 subagent + 两阶段 review，不询问用户。
