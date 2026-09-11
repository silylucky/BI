# 跨域远期薄弱项 L1 kickoff r59 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/metadata/dataset/` · `backend/app/governance/catalog/classification/` · `backend/app/dashboard/entity_overview/` · `backend/app/datasources/dialects/kingbase/` · `backend/app/designer/workflow.py` · `backend/app/api/v1/{datasets,gov,dashboards,designer}.py` · `backend/app/api/v1/router.py` · `backend/app/query/config_store/schemas.py` · `backend/app/datasources/dialects/errors.py` · `backend/app/datasources/dialects/__init__.py` · `backend/app/datasources/__init__.py` · `tests/test_meta_cat_dash_conn_design_r59.py` · `docs/services/{metadata,governance,dashboard,datasources,designer}.md` · `docs/services/README.md` · `docs/api/README.md`
> **子项：** META-004, CAT-004, DASH-005, CONN-018, DESIGN-004
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 交付五域 L1 薄骨架（Dataset 元数据、分类树、仪表板实体总览、Kingbase 方言、设计器工单关联）+ ≥32 条 pytest smoke；五 PRD ID 加权总分 L1 目标 ≥80。

**Architecture:** 各子域独立 `errors/schemas/service` 三件套 + 薄 `api/v1` entry；Dataset/分类树用进程内内存 dict；entity_overview 与 workflow-link 用 `config_store`；Kingbase 委托 `PostgresConnector` + `register_connector_plugin`；分类树 move 环检测镜像 `metadata/themes/service.py` 算法。纯后端、无 Alembic migration、不触 `fe/`。

**Tech Stack:** Python 3.11 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / psycopg / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**、**UI Acceptance: N/A**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不修改** `backend/app/datasources/registry.py` 的 `ConnectorRegistry.register` / `get` 方法体。
- **分层纪律**（`common.mdc`）：域模块 = domain；`api/v1/*.py` = entry。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；`detail.fields` 为字段级错误列表。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/api/README.md`。
- **验证基线**（r58 P5）：`cd backend && python3 -m pytest -q` ≈ **1490 passed** / 4 skipped；本轮目标 **≥1522 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**：`test_dash_rpt_r58` **38/38** + `test_dash_rpt_query_nfr_r57` **37/37** 全绿。
- **验证命令**（Task 7 全量）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_meta_cat_dash_conn_design_r59.py \
    ../tests/test_dash_rpt_r58.py \
    ../tests/test_dash_rpt_query_nfr_r57.py \
    -v
  ```

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/metadata/dataset/errors.py` | `DatasetError` + `META_DATASET_*` | 新建 |
| `backend/app/metadata/dataset/schemas.py` | Dataset DTO | 新建 |
| `backend/app/metadata/dataset/service.py` | 内存 store + validate/list/get/create | 新建 |
| `backend/app/api/v1/datasets.py` | 4 路由薄 entry | 新建 |
| `backend/app/api/v1/router.py` | 挂载 `datasets_router` | 修改 |
| `backend/app/governance/catalog/classification/errors.py` | `ClassificationError` + `CAT_CLASS_*` | 新建 |
| `backend/app/governance/catalog/classification/schemas.py` | 节点 DTO + move payload | 新建 |
| `backend/app/governance/catalog/classification/service.py` | 树 CRUD/move/环检测 | 新建 |
| `backend/app/api/v1/gov.py` | +classification 路由簇（4 路由） | 修改 |
| `backend/app/dashboard/entity_overview/errors.py` | `EntityOverviewError` + `DASH_OVERVIEW_*` | 新建 |
| `backend/app/dashboard/entity_overview/schemas.py` | 总览 item 契约 | 新建 |
| `backend/app/dashboard/entity_overview/service.py` | validate/save/get + publish 探测 | 新建 |
| `backend/app/api/v1/dashboards.py` | +entity-overview 路由簇（3 路由） | 修改 |
| `backend/app/datasources/dialects/kingbase/__init__.py` | 导出 `KingbaseConnector` | 新建 |
| `backend/app/datasources/dialects/kingbase/connector.py` | PG 委托 + test_connection | 新建 |
| `backend/app/datasources/dialects/errors.py` | `map_kingbase_error` + `KINGBASE_*` | 修改 |
| `backend/app/datasources/dialects/__init__.py` | 导出 kingbase | 修改 |
| `backend/app/datasources/__init__.py` | `register_connector_plugin(KingbaseConnector())` | 修改 |
| `backend/app/designer/workflow.py` | workflow-link validate/save/get | 新建 |
| `backend/app/api/v1/designer.py` | +workflow-link 路由簇（3 路由） | 修改 |
| `backend/app/query/config_store/schemas.py` | 允许 `entity_overview`/`designer_workflow_link` | 修改 |
| `tests/test_meta_cat_dash_conn_design_r59.py` | 新套件 ≥32 断言 | 新建 |

预估 **P3 生产代码文件 21**（design 19 + `router.py` + `config_store/schemas.py`）；docs Task 8 另计。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_meta_cat_dash_conn_design_r59.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""跨域远期薄弱项 L1 kickoff r59 — META/CAT/DASH/CONN/DESIGN."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R59_SQLITE_URL = "sqlite+pysqlite:///file:meta_cat_dash_conn_design_r59?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r59_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_nfr08 = os.environ.get("NFR08_RUNTIME_MODE")
    os.environ["DATABASE_URL"] = _R59_SQLITE_URL
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
        return UserContext(id="viewer-r59", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R59 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r59 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_workflow_instance(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
```

---

### Task 1: 测试夹具 + config_store 类型扩展

**Files:**
- Modify: `backend/app/query/config_store/schemas.py`
- Create: `tests/test_meta_cat_dash_conn_design_r59.py`（夹具 + 2 条启动测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `ALLOWED_CONFIG_TYPES` 含 `entity_overview`、`designer_workflow_link`

- [ ] **Step 1: Write the failing test**

在 `tests/test_meta_cat_dash_conn_design_r59.py` 写入上文 **Shared Test Fixtures** 全文，并追加：

```python
from app.query.config_store.schemas import ALLOWED_CONFIG_TYPES


def test_r59_fixture_bootstraps(client):
    """T-R59-000-01: r59 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r59_config_types_include_new_kinds():
    """T-R59-000-02: config_store 允许 entity_overview/designer_workflow_link。"""
    assert {"entity_overview", "designer_workflow_link"}.issubset(ALLOWED_CONFIG_TYPES)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py::test_r59_config_types_include_new_kinds -v`
Expected: FAIL — `entity_overview` not in `ALLOWED_CONFIG_TYPES`

- [ ] **Step 3: Write minimal implementation**

`backend/app/query/config_store/schemas.py` 第 9–17 行改为：

```python
ALLOWED_CONFIG_TYPES = frozenset({
    "query_conditions",
    "compute_rules",
    "visual_query_design",
    "sql_mode",
    "output_fields",
    "workflow_instance",
    "entity_theme",
    "entity_overview",
    "designer_workflow_link",
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/config_store/schemas.py tests/test_meta_cat_dash_conn_design_r59.py
git commit -m "test(r59): fixtures + config_store types for entity_overview/workflow-link"
```

---

### Task 2: META-004 Dataset 元数据项 L1

**Files:**
- Create: `backend/app/metadata/dataset/errors.py`
- Create: `backend/app/metadata/dataset/schemas.py`
- Create: `backend/app/metadata/dataset/service.py`
- Create: `backend/app/api/v1/datasets.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `tests/test_meta_cat_dash_conn_design_r59.py`（+7 META 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `create_dataset`, `list_datasets`, `get_dataset`, `validate_dataset_draft`;路由前缀 `/api/v1/datasets`

- [ ] **Step 1: Write the failing tests**

在 `tests/test_meta_cat_dash_conn_design_r59.py` 追加：

```python
def _dataset_payload(dataset_id: str = "demo-orders") -> dict:
    return {
        "datasetId": dataset_id,
        "displayName": "Demo Orders",
        "tables": [{"name": "orders", "alias": "o"}],
        "computedFields": [{"name": "total", "expression": "amount * qty"}],
        "allowedRoles": ["analyst"],
    }


def test_meta_r59_004_list_empty(client):
    """T-META-R59-004-01: GET /datasets 空列表 200。"""
    resp = client.get("/api/v1/datasets", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_meta_r59_004_create_and_get(client):
    """T-META-R59-004-02: POST create 201 + GET 详情。"""
    payload = _dataset_payload(f"ds-{uuid.uuid4().hex[:8]}")
    create = client.post("/api/v1/datasets", headers=AUTH, json=payload)
    assert create.status_code == 201, create.text
    got = client.get(f"/api/v1/datasets/{payload['datasetId']}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["displayName"] == "Demo Orders"


def test_meta_r59_004_create_conflict(client):
    """T-META-R59-004-03: 重复 datasetId 409 META_DATASET_CONFLICT。"""
    ds_id = f"dup-{uuid.uuid4().hex[:6]}"
    payload = _dataset_payload(ds_id)
    assert client.post("/api/v1/datasets", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/datasets", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_DATASET_CONFLICT"


def test_meta_r59_004_get_not_found(client):
    """T-META-R59-004-04: 未知 id 404 META_DATASET_NOT_FOUND。"""
    resp = client.get("/api/v1/datasets/missing-dataset", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "META_DATASET_NOT_FOUND"


def test_meta_r59_004_validate_ok(client):
    """T-META-R59-004-05: POST /validate 合法 payload valid=true。"""
    resp = client.post("/api/v1/datasets/validate", headers=AUTH, json=_dataset_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["tableCount"] == 1
    assert body["computedFieldCount"] == 1


def test_meta_r59_004_validate_empty_tables(client):
    """T-META-R59-004-06: 空 tables 422 META_DATASET_EMPTY_TABLES。"""
    payload = _dataset_payload()
    payload["tables"] = []
    resp = client.post("/api/v1/datasets/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_EMPTY_TABLES"


def test_meta_r59_004_invalid_computed_field(client):
    """T-META-R59-004-07: 非法 computedFields 名 422 META_DATASET_INVALID_FIELD。"""
    payload = _dataset_payload(f"bad-{uuid.uuid4().hex[:6]}")
    payload["computedFields"] = [{"name": "Bad-Name", "expression": "1"}]
    resp = client.post("/api/v1/datasets", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_INVALID_FIELD"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "meta_r59_004" -v`
Expected: FAIL — 404 on `/api/v1/datasets`

- [ ] **Step 3: Write minimal implementation**

`backend/app/metadata/dataset/errors.py`：

```python
from __future__ import annotations


class DatasetError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
```

`backend/app/metadata/dataset/schemas.py`：

```python
from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_DATASET_ID_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")
_FIELD_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


class DatasetTableDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=128)
    alias: str | None = None


class DatasetComputedField(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    expression: str = Field(min_length=1, max_length=4096)

    @field_validator("name")
    @classmethod
    def _name_pattern(cls, v: str) -> str:
        if not _FIELD_RE.match(v):
            raise ValueError("invalid field name")
        return v


class DatasetItemIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dataset_id: str = Field(alias="datasetId")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    tables: list[DatasetTableDef] = Field(default_factory=list, max_length=32)
    computed_fields: list[DatasetComputedField] = Field(default_factory=list, alias="computedFields", max_length=64)
    allowed_roles: list[str] = Field(default_factory=lambda: ["analyst"], alias="allowedRoles")

    @field_validator("dataset_id")
    @classmethod
    def _dataset_id_pattern(cls, v: str) -> str:
        if not _DATASET_ID_RE.match(v):
            raise ValueError("invalid datasetId")
        return v


class DatasetItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dataset_id: str = Field(alias="datasetId")
    display_name: str = Field(alias="displayName")
    tables: list[DatasetTableDef]
    computed_fields: list[DatasetComputedField] = Field(alias="computedFields")
    allowed_roles: list[str] = Field(alias="allowedRoles")


class DatasetListResponse(BaseModel):
    items: list[DatasetItemOut]
    total: int


class DatasetValidateOut(BaseModel):
    valid: bool
    dataset_id: str = Field(alias="datasetId")
    table_count: int = Field(alias="tableCount")
    computed_field_count: int = Field(alias="computedFieldCount")
```

`backend/app/metadata/dataset/service.py`：

```python
from __future__ import annotations

import re

from app.metadata.dataset.errors import DatasetError
from app.metadata.dataset.schemas import (
    DatasetItemIn,
    DatasetItemOut,
    DatasetListResponse,
    DatasetValidateOut,
)

_store: dict[str, dict] = {}
_FIELD_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


def _to_out(record: dict) -> DatasetItemOut:
    return DatasetItemOut.model_validate(record)


def _validate_body(payload: DatasetItemIn) -> None:
    if not payload.tables:
        raise DatasetError(
            "META_DATASET_EMPTY_TABLES",
            "At least one table is required",
            422,
            fields=[{"field": "tables", "message": "must not be empty"}],
        )
    for field in payload.computed_fields:
        if not _FIELD_RE.match(field.name):
            raise DatasetError(
                "META_DATASET_INVALID_FIELD",
                "Invalid computed field name",
                422,
                fields=[{"field": "computedFields", "message": field.name}],
            )


def create_dataset(payload: DatasetItemIn) -> DatasetItemOut:
    _validate_body(payload)
    if payload.dataset_id in _store:
        raise DatasetError("META_DATASET_CONFLICT", "Dataset already exists", 409)
    record = payload.model_dump(by_alias=True)
    _store[payload.dataset_id] = record
    return _to_out(record)


def list_datasets(limit: int = 50, offset: int = 0) -> DatasetListResponse:
    items = sorted(_store.values(), key=lambda r: r["datasetId"])
    capped = min(max(limit, 1), 500)
    sliced = items[max(offset, 0) : max(offset, 0) + capped]
    return DatasetListResponse(items=[_to_out(r) for r in sliced], total=len(items))


def get_dataset(dataset_id: str) -> DatasetItemOut:
    record = _store.get(dataset_id)
    if record is None:
        raise DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404)
    return _to_out(record)


def validate_dataset_draft(payload: DatasetItemIn) -> DatasetValidateOut:
    _validate_body(payload)
    return DatasetValidateOut(
        valid=True,
        dataset_id=payload.dataset_id,
        table_count=len(payload.tables),
        computed_field_count=len(payload.computed_fields),
    )
```

`backend/app/api/v1/datasets.py`：

```python
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, get_current_user
from app.metadata.dataset.errors import DatasetError
from app.metadata.dataset.schemas import DatasetItemIn, DatasetItemOut, DatasetListResponse, DatasetValidateOut
from app.metadata.dataset import service as dataset_service

router = APIRouter(prefix="/datasets", tags=["metadata", "META-004"])


def _dataset_error(exc: DatasetError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    _: Annotated[UserContext, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> DatasetListResponse:
    return dataset_service.list_datasets(limit, offset)


@router.post("", response_model=DatasetItemOut, status_code=status.HTTP_201_CREATED)
def create_dataset(
    payload: DatasetItemIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DatasetItemOut | JSONResponse:
    try:
        return dataset_service.create_dataset(payload)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.get("/{dataset_id}", response_model=DatasetItemOut)
def get_dataset(
    dataset_id: str,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DatasetItemOut | JSONResponse:
    try:
        return dataset_service.get_dataset(dataset_id)
    except DatasetError as exc:
        return _dataset_error(exc)


@router.post("/validate", response_model=DatasetValidateOut)
def validate_dataset(
    payload: DatasetItemIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DatasetValidateOut | JSONResponse:
    try:
        return dataset_service.validate_dataset_draft(payload)
    except DatasetError as exc:
        return _dataset_error(exc)
```

`backend/app/api/v1/router.py` 追加 import 与挂载（在 `metadata_router` 行后）：

```python
from app.api.v1.datasets import router as datasets_router
# ...
api_v1_router.include_router(datasets_router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "meta_r59_004" -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/dataset/ backend/app/api/v1/datasets.py backend/app/api/v1/router.py tests/test_meta_cat_dash_conn_design_r59.py
git commit -m "feat(meta): META-004 dataset L1 CRUD + validate API"
```

---

### Task 3: CAT-004 分类树 L1

**Files:**
- Create: `backend/app/governance/catalog/classification/errors.py`
- Create: `backend/app/governance/catalog/classification/schemas.py`
- Create: `backend/app/governance/catalog/classification/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_meta_cat_dash_conn_design_r59.py`（+7 CAT 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: 无
- Produces: `create_node`, `list_nodes`, `move_node`, `delete_node`；路由 `/api/v1/gov/catalog/classification/nodes`

- [ ] **Step 1: Write the failing tests**

```python
def _class_node(code: str | None = None, parent_id: str | None = None) -> dict:
    return {
        "code": code or f"CAT_{uuid.uuid4().hex[:6].upper()}",
        "name": "Category Node",
        "parentId": parent_id,
        "kind": "folder",
        "sortOrder": 0,
    }


def test_cat_r59_004_create_root_and_child(client):
    """T-CAT-R59-004-01: 创建根节点 + 子节点。"""
    root = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node())
    assert root.status_code == 201, root.text
    root_id = root.json()["nodeId"]
    child = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=root_id),
    )
    assert child.status_code == 201
    listed = client.get(f"/api/v1/gov/catalog/classification/nodes?parentId={root_id}", headers=AUTH)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1


def test_cat_r59_004_move_cycle(client):
    """T-CAT-R59-004-02: move 成环 422 CAT_CLASS_CYCLE。"""
    root = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node()).json()
    child = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=root["nodeId"]),
    ).json()
    resp = client.post(
        f"/api/v1/gov/catalog/classification/nodes/{root['nodeId']}/move",
        headers=AUTH,
        json={"parentId": child["nodeId"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT_CLASS_CYCLE"


def test_cat_r59_004_parent_not_found(client):
    """T-CAT-R59-004-03: 未知 parent 404 CAT_CLASS_PARENT_NOT_FOUND。"""
    missing = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=missing),
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT_CLASS_PARENT_NOT_FOUND"


def test_cat_r59_004_code_conflict(client):
    """T-CAT-R59-004-04: 重复 code 409 CAT_CLASS_CODE_CONFLICT。"""
    code = f"DUP_{uuid.uuid4().hex[:4].upper()}"
    assert client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node(code)).status_code == 201
    dup = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node(code))
    assert dup.status_code == 409
    assert dup.json()["code"] == "CAT_CLASS_CODE_CONFLICT"


def test_cat_r59_004_delete_with_children(client):
    """T-CAT-R59-004-05: 删除含子节点 409 CAT_CLASS_HAS_CHILDREN。"""
    root = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node()).json()
    client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=root["nodeId"]),
    )
    resp = client.delete(f"/api/v1/gov/catalog/classification/nodes/{root['nodeId']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "CAT_CLASS_HAS_CHILDREN"


def test_cat_r59_004_delete_leaf(client):
    """T-CAT-R59-004-06: 删除叶节点 204。"""
    leaf = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node()).json()
    resp = client.delete(f"/api/v1/gov/catalog/classification/nodes/{leaf['nodeId']}", headers=AUTH)
    assert resp.status_code == 204


def test_cat_r59_004_max_depth(client):
    """T-CAT-R59-004-07: 超深 422 CAT_CLASS_MAX_DEPTH。"""
    parent_id = None
    last_id = None
    for _ in range(9):
        payload = _class_node(parent_id=parent_id)
        resp = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=payload)
        if resp.status_code != 201:
            assert resp.status_code == 422
            assert resp.json()["code"] == "CAT_CLASS_MAX_DEPTH"
            return
        last_id = resp.json()["nodeId"]
        parent_id = last_id
    pytest.fail("expected depth guard before 10 levels")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "cat_r59_004" -v`
Expected: FAIL — 404 on classification routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/governance/catalog/classification/errors.py`：

```python
from __future__ import annotations


class ClassificationError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
```

`backend/app/governance/catalog/classification/schemas.py`：

```python
from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_CLASS_DEPTH = 8


class ClassificationNodeCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    name: str = Field(min_length=1, max_length=120)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    kind: Literal["folder", "leaf"] = "folder"
    sort_order: int = Field(default=0, alias="sortOrder")


class ClassificationNodeMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parent_id: uuid.UUID | None = Field(default=None, alias="parentId")
    sort_order: int | None = Field(default=None, alias="sortOrder")


class ClassificationNodeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    node_id: uuid.UUID = Field(alias="nodeId")
    code: str
    name: str
    parent_id: uuid.UUID | None = Field(alias="parentId")
    kind: Literal["folder", "leaf"]
    sort_order: int = Field(alias="sortOrder")


class ClassificationNodeListResponse(BaseModel):
    items: list[ClassificationNodeOut]
    total: int
```

`backend/app/governance/catalog/classification/service.py`（内存树，环检测镜像 themes）：

```python
from __future__ import annotations

import uuid

from app.governance.catalog.classification.errors import ClassificationError
from app.governance.catalog.classification.schemas import (
    MAX_CLASS_DEPTH,
    ClassificationNodeCreate,
    ClassificationNodeListResponse,
    ClassificationNodeMove,
    ClassificationNodeOut,
)

_nodes: dict[uuid.UUID, dict] = {}
_codes: set[str] = set()


def _to_out(record: dict) -> ClassificationNodeOut:
    return ClassificationNodeOut.model_validate(record)


def _children(parent_id: uuid.UUID | None) -> list[dict]:
    return [n for n in _nodes.values() if n["parentId"] == parent_id]


def _node_depth(node_id: uuid.UUID | None) -> int:
    depth = 0
    current = node_id
    seen: set[uuid.UUID] = set()
    while current is not None:
        if current in seen:
            break
        seen.add(current)
        depth += 1
        if depth > MAX_CLASS_DEPTH:
            break
        record = _nodes.get(current)
        if record is None:
            break
        current = record.get("parentId")
    return depth


def _subtree_height(root_id: uuid.UUID) -> int:
    max_h = 0
    level = [root_id]
    while level:
        max_h += 1
        if max_h > MAX_CLASS_DEPTH:
            break
        next_level = []
        for nid in level:
            next_level.extend(c["nodeId"] for c in _children(nid))
        level = next_level
    return max_h


def _collect_descendants(node_id: uuid.UUID) -> set[uuid.UUID]:
    out: set[uuid.UUID] = set()
    frontier = [node_id]
    while frontier:
        current = frontier.pop()
        for child in _children(current):
            cid = child["nodeId"]
            if cid not in out:
                out.add(cid)
                frontier.append(cid)
    return out


def _assert_depth(parent_id: uuid.UUID | None, subtree_root: uuid.UUID | None = None) -> None:
    parent_depth = _node_depth(parent_id)
    extra = _subtree_height(subtree_root) if subtree_root else 1
    if parent_depth + extra > MAX_CLASS_DEPTH:
        raise ClassificationError(
            "CAT_CLASS_MAX_DEPTH",
            f"Classification tree depth cannot exceed {MAX_CLASS_DEPTH}",
            422,
            fields=[{"field": "parentId", "message": f"max depth is {MAX_CLASS_DEPTH}"}],
        )


def list_nodes(parent_id: uuid.UUID | None = None, limit: int = 100, offset: int = 0) -> ClassificationNodeListResponse:
    items = sorted(_children(parent_id), key=lambda n: (n["sortOrder"], n["name"]))
    capped = min(max(limit, 1), 500)
    sliced = items[max(offset, 0) : max(offset, 0) + capped]
    return ClassificationNodeListResponse(items=[_to_out(n) for n in sliced], total=len(items))


def create_node(payload: ClassificationNodeCreate) -> ClassificationNodeOut:
    if payload.code in _codes:
        raise ClassificationError("CAT_CLASS_CODE_CONFLICT", "Classification code already exists", 409)
    if payload.parent_id is not None and payload.parent_id not in _nodes:
        raise ClassificationError("CAT_CLASS_PARENT_NOT_FOUND", "Parent node not found", 404)
    _assert_depth(payload.parent_id)
    node_id = uuid.uuid4()
    record = {
        "nodeId": node_id,
        "code": payload.code,
        "name": payload.name,
        "parentId": payload.parent_id,
        "kind": payload.kind,
        "sortOrder": payload.sort_order,
    }
    _nodes[node_id] = record
    _codes.add(payload.code)
    return _to_out(record)


def move_node(node_id: uuid.UUID, payload: ClassificationNodeMove) -> ClassificationNodeOut:
    record = _nodes.get(node_id)
    if record is None:
        raise ClassificationError("CAT_CLASS_PARENT_NOT_FOUND", "Node not found", 404)
    parent_id = payload.parent_id
    if parent_id == node_id:
        raise ClassificationError("CAT_CLASS_CYCLE", "Cannot move node under itself", 422)
    if parent_id is not None:
        if parent_id in _collect_descendants(node_id):
            raise ClassificationError("CAT_CLASS_CYCLE", "Cannot move node under its descendant", 422)
        if parent_id not in _nodes:
            raise ClassificationError("CAT_CLASS_PARENT_NOT_FOUND", "Parent node not found", 404)
    _assert_depth(parent_id, node_id)
    record["parentId"] = parent_id
    if payload.sort_order is not None:
        record["sortOrder"] = payload.sort_order
    return _to_out(record)


def delete_node(node_id: uuid.UUID) -> None:
    if node_id not in _nodes:
        raise ClassificationError("CAT_CLASS_PARENT_NOT_FOUND", "Node not found", 404)
    if _children(node_id):
        raise ClassificationError("CAT_CLASS_HAS_CHILDREN", "Cannot delete node with children", 409)
    code = _nodes[node_id]["code"]
    del _nodes[node_id]
    _codes.discard(code)
```

在 `backend/app/api/v1/gov.py` 追加（import 之后、文件末尾路由区）：

```python
from app.governance.catalog.classification.errors import ClassificationError
from app.governance.catalog.classification.schemas import (
    ClassificationNodeCreate,
    ClassificationNodeListResponse,
    ClassificationNodeMove,
    ClassificationNodeOut,
)
from app.governance.catalog.classification import service as classification_service


def _classification_error(exc: ClassificationError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/catalog/classification/nodes", response_model=ClassificationNodeListResponse)
def list_classification_nodes(
    _: Annotated[UserContext, Depends(get_current_user)],
    parent_id: uuid.UUID | None = Query(default=None, alias="parentId"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ClassificationNodeListResponse:
    return classification_service.list_nodes(parent_id, limit, offset)


@router.post("/catalog/classification/nodes", response_model=ClassificationNodeOut, status_code=status.HTTP_201_CREATED)
def create_classification_node(
    payload: ClassificationNodeCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ClassificationNodeOut | JSONResponse:
    try:
        return classification_service.create_node(payload)
    except ClassificationError as exc:
        return _classification_error(exc)


@router.post("/catalog/classification/nodes/{node_id}/move", response_model=ClassificationNodeOut)
def move_classification_node(
    node_id: uuid.UUID,
    payload: ClassificationNodeMove,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ClassificationNodeOut | JSONResponse:
    try:
        return classification_service.move_node(node_id, payload)
    except ClassificationError as exc:
        return _classification_error(exc)


@router.delete("/catalog/classification/nodes/{node_id}", response_model=None)
def delete_classification_node(
    node_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> Response | JSONResponse:
    try:
        classification_service.delete_node(node_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ClassificationError as exc:
        return _classification_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "cat_r59_004" -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/catalog/classification/ backend/app/api/v1/gov.py tests/test_meta_cat_dash_conn_design_r59.py
git commit -m "feat(gov): CAT-004 classification tree L1 with cycle guard"
```

---

### Task 4: DASH-005 实体总览 item L1

**Files:**
- Create: `backend/app/dashboard/entity_overview/errors.py`
- Create: `backend/app/dashboard/entity_overview/schemas.py`
- Create: `backend/app/dashboard/entity_overview/service.py`
- Modify: `backend/app/api/v1/dashboards.py`
- Modify: `tests/test_meta_cat_dash_conn_design_r59.py`（+6 DASH 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: `dash_service.get_dashboard`, `publish_service.get_publish_status`
- Produces: `validate_overview`, `save_overview`, `get_overview`

- [ ] **Step 1: Write the failing tests**

```python
def _overview_payload(dashboard_id: str, catalog_entry_id: str | None = None) -> dict:
    body = {
        "dashboardId": dashboard_id,
        "entityTypeRef": "customer",
        "statCards": [{"metricKey": "total_orders", "label": "Orders"}],
        "filters": [{"dimensionId": "region"}],
        "drillTargets": [{"widgetId": "w1"}],
    }
    if catalog_entry_id:
        body["catalogEntryId"] = catalog_entry_id
    return body


def test_dash_r59_005_validate_empty_cards(client):
    """T-DASH-R59-005-01: validate 空 statCards 422。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    payload["statCards"] = []
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_EMPTY_CARDS"


def test_dash_r59_005_unknown_dashboard(client):
    """T-DASH-R59-005-02: 未知 dashboard 404。"""
    payload = _overview_payload(str(uuid.uuid4()))
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 404
    assert resp.json()["code"] == "DASH_OVERVIEW_DASHBOARD_NOT_FOUND"


def test_dash_r59_005_save_and_get(client):
    """T-DASH-R59-005-03: save/get 往返。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    save = client.put(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH, json=payload)
    assert save.status_code == 200, save.text
    got = client.get(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["entityTypeRef"] == "customer"
    assert got.json()["publishStatus"] is None


def test_dash_r59_005_forbidden_viewer(client, viewer_user):
    """T-DASH-R59-005-04: 非 owner viewer 403。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    client.put(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH, json=payload)
    resp = client.get(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_OVERVIEW_FORBIDDEN"


def test_dash_r59_005_duplicate_metric(client):
    """T-DASH-R59-005-05: 重复 metricKey 422。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    payload["statCards"] = [
        {"metricKey": "dup", "label": "A"},
        {"metricKey": "dup", "label": "B"},
    ]
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_DUPLICATE_METRIC"


def test_dash_r59_005_theme_route_unchanged(client):
    """T-DASH-R59-005-06: theme-analysis validate 仍 422（边界不交叉）。"""
    resp = client.post("/api/v1/dashboards/theme-analysis/validate", headers=AUTH, json={})
    assert resp.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "dash_r59_005" -v`
Expected: FAIL — 404 on entity-overview routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/dashboard/entity_overview/errors.py`：

```python
from __future__ import annotations


class EntityOverviewError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
```

`backend/app/dashboard/entity_overview/schemas.py`：

```python
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class StatCardDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    metric_key: str = Field(alias="metricKey", min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)


class FilterDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dimension_id: str = Field(alias="dimensionId", min_length=1, max_length=64)
    default_value: str | None = Field(default=None, alias="defaultValue")


class DrillTargetDef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    widget_id: str = Field(alias="widgetId", min_length=1, max_length=64)
    target_dashboard_id: uuid.UUID | None = Field(default=None, alias="targetDashboardId")


class EntityOverviewItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: uuid.UUID = Field(alias="dashboardId")
    entity_type_ref: str = Field(alias="entityTypeRef", min_length=1, max_length=64)
    stat_cards: list[StatCardDef] = Field(alias="statCards")
    filters: list[FilterDef] = Field(default_factory=list)
    drill_targets: list[DrillTargetDef] = Field(default_factory=list, alias="drillTargets")
    catalog_entry_id: uuid.UUID | None = Field(default=None, alias="catalogEntryId")


class EntityOverviewOut(EntityOverviewItem):
    publish_status: str | None = Field(default=None, alias="publishStatus")
```

`backend/app/dashboard/entity_overview/service.py`：

```python
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard import service as dash_service
from app.dashboard.entity_overview.errors import EntityOverviewError
from app.dashboard.entity_overview.schemas import EntityOverviewItem, EntityOverviewOut
from app.governance.publish import service as publish_service
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert

_REF_TYPE = "entity_overview"


def _assert_access(actor: UserContext, dashboard_created_by: uuid.UUID | None) -> None:
    if "admin" in actor.roles:
        return
    try:
        actor_uuid = uuid.UUID(actor.id)
    except ValueError:
        raise EntityOverviewError("DASH_OVERVIEW_FORBIDDEN", "Access denied", 403) from None
    if dashboard_created_by is None or dashboard_created_by != actor_uuid:
        raise EntityOverviewError("DASH_OVERVIEW_FORBIDDEN", "Access denied", 403)


def _validate_item(session: Session, item: EntityOverviewItem) -> EntityOverviewItem:
    if not item.stat_cards:
        raise EntityOverviewError(
            "DASH_OVERVIEW_EMPTY_CARDS",
            "At least one stat card is required",
            422,
            fields=[{"field": "statCards", "message": "must not be empty"}],
        )
    keys = [c.metric_key for c in item.stat_cards]
    if len(keys) != len(set(keys)):
        raise EntityOverviewError("DASH_OVERVIEW_DUPLICATE_METRIC", "Duplicate metricKey", 422)
    try:
        dash_service.get_dashboard(session, item.dashboard_id)
    except dash_service.DashboardError as exc:
        if exc.code == "DASH_NOT_FOUND":
            raise EntityOverviewError("DASH_OVERVIEW_DASHBOARD_NOT_FOUND", "Dashboard not found", 404) from exc
        raise
    return item


def validate_overview(session: Session, item: EntityOverviewItem) -> EntityOverviewItem:
    return _validate_item(session, item)


def save_overview(session: Session, item: EntityOverviewItem, actor: UserContext) -> EntityOverviewOut:
    _validate_item(session, item)
    dashboard = dash_service.get_dashboard(session, item.dashboard_id)
    _assert_access(actor, dashboard.created_by)
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="entity_overview",
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=item.dashboard_id,
            payload=item.model_dump(by_alias=True, mode="json"),
        ),
        owner_id=uuid.UUID(actor.id) if actor.id else None,
    )
    return get_overview(session, item.dashboard_id, actor)


def get_overview(session: Session, dashboard_id: uuid.UUID, actor: UserContext) -> EntityOverviewOut:
    dashboard = dash_service.get_dashboard(session, dashboard_id)
    _assert_access(actor, dashboard.created_by)
    try:
        record = config_store.get_config_by_ref(session, "entity_overview", _REF_TYPE, dashboard_id)
    except Exception as exc:
        from app.query.config_store.schemas import ConfigError

        if isinstance(exc, ConfigError):
            raise EntityOverviewError("DASH_OVERVIEW_NOT_FOUND", "Entity overview not configured", 404) from exc
        raise
    item = EntityOverviewItem.model_validate(record.payload)
    publish_status = None
    if item.catalog_entry_id:
        try:
            publish_status = publish_service.get_publish_status(session, item.catalog_entry_id).status
        except Exception:
            publish_status = None
    return EntityOverviewOut(**item.model_dump(), publishStatus=publish_status)
```

在 `backend/app/api/v1/dashboards.py` 追加：

```python
from app.dashboard.entity_overview.errors import EntityOverviewError
from app.dashboard.entity_overview.schemas import EntityOverviewItem, EntityOverviewOut
from app.dashboard.entity_overview import service as overview_service


def _overview_error(exc: EntityOverviewError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/entity-overview/validate", response_model=EntityOverviewItem)
def validate_entity_overview(
    payload: EntityOverviewItem,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> EntityOverviewItem | JSONResponse:
    try:
        return overview_service.validate_overview(db, payload)
    except EntityOverviewError as exc:
        return _overview_error(exc)


@router.put("/{dashboard_id}/entity-overview", response_model=EntityOverviewOut)
def save_entity_overview(
    dashboard_id: uuid.UUID,
    payload: EntityOverviewItem,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> EntityOverviewOut | JSONResponse:
    if payload.dashboard_id != dashboard_id:
        return JSONResponse(status_code=422, content={"code": "DASH_OVERVIEW_ID_MISMATCH", "message": "dashboardId mismatch", "detail": None})
    try:
        return overview_service.save_overview(db, payload, user)
    except EntityOverviewError as exc:
        return _overview_error(exc)


@router.get("/{dashboard_id}/entity-overview", response_model=EntityOverviewOut)
def get_entity_overview(
    dashboard_id: uuid.UUID,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> EntityOverviewOut | JSONResponse:
    try:
        return overview_service.get_overview(db, dashboard_id, user)
    except EntityOverviewError as exc:
        return _overview_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "dash_r59_005" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/dashboard/entity_overview/ backend/app/api/v1/dashboards.py tests/test_meta_cat_dash_conn_design_r59.py
git commit -m "feat(dashboard): DASH-005 entity overview L1 validate/save/get"
```

---

### Task 5: CONN-018 人大金仓连接器 L1

**Files:**
- Create: `backend/app/datasources/dialects/kingbase/__init__.py`
- Create: `backend/app/datasources/dialects/kingbase/connector.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `tests/test_meta_cat_dash_conn_design_r59.py`（+6 CONN 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Produces: `KingbaseConnector`, `map_kingbase_error`; `export_type_catalog()` 含 `kingbase`

- [ ] **Step 1: Write the failing tests**

```python
from unittest.mock import MagicMock, patch

from app.core.nfr.plugin_extension import export_type_catalog
from app.datasources.dialects.kingbase.connector import KINGBASE_MAX_COLUMNS, KingbaseConnector


def test_conn_r59_018_catalog_has_kingbase():
    """T-CONN-R59-018-01: export_type_catalog 含 kingbase relational。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert "kingbase" in types
    assert types["kingbase"]["category"] == "relational"


def test_conn_r59_018_test_connection_ok_mock():
    """T-CONN-R59-018-02: test-connection mock 成功 ok=true。"""
    connector = KingbaseConnector()
    mock_conn = MagicMock()
    with patch.object(connector._inner, "open_connection", return_value=mock_conn):
        result = connector.test_connection(host="h", port=54321, username="u", password="p", database="d")
    assert result.ok is True
    mock_conn.close.assert_called_once()


def test_conn_r59_018_test_connection_auth_failed_mock():
    """T-CONN-R59-018-03: auth 失败 KINGBASE_AUTH_FAILED。"""
    import psycopg

    connector = KingbaseConnector()
    err = psycopg.OperationalError("password authentication failed")
    err.sqlstate = "28P01"
    with patch.object(connector._inner, "open_connection", side_effect=err):
        result = connector.test_connection(host="h", port=54321, username="u", password="p", database="d")
    assert result.ok is False
    assert result.code == "KINGBASE_AUTH_FAILED"


def test_conn_r59_018_http_test_connection_draft(client):
    """T-CONN-R59-018-04: HTTP test-connection draft kingbase 200。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test-connection",
            headers=AUTH,
            json={"type": "kingbase", "host": "127.0.0.1", "port": 54321, "database": "test", "username": "u", "password": "secret"},
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_conn_r59_018_http_no_password_leak(client):
    """T-CONN-R59-018-05: 响应不得含 password。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test-connection",
            headers=AUTH,
            json={"type": "kingbase", "host": "127.0.0.1", "port": 54321, "database": "test", "username": "u", "password": "secret"},
        )
    assert "password" not in resp.text.lower()


def test_conn_r59_018_list_columns_limit():
    """T-CONN-R59-018-06: list_columns 截断 KINGBASE_MAX_COLUMNS。"""
    connector = KingbaseConnector()
    mock_conn = MagicMock()
    cols = [type("C", (), {"name": f"c{i}"})() for i in range(KINGBASE_MAX_COLUMNS + 10)]
    with patch.object(connector._inner, "list_columns", return_value=cols):
        out = connector.list_columns(mock_conn, "public", "t")
    assert len(out) == KINGBASE_MAX_COLUMNS
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "conn_r59_018" -v`
Expected: FAIL — `ModuleNotFoundError: kingbase`

- [ ] **Step 3: Write minimal implementation**

`backend/app/datasources/dialects/kingbase/connector.py`：

```python
from __future__ import annotations

import time
from typing import Any

import psycopg

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_kingbase_error
from app.datasources.dialects.postgres import PostgresConnector

KINGBASE_MAX_COLUMNS = 500
KINGBASE_DEFAULT_PORT = 54321


class KingbaseConnector:
    type = "kingbase"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "人大金仓 KingbaseES"

    def __init__(self) -> None:
        self._inner = PostgresConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        started = time.perf_counter()
        port = kwargs.get("port", KINGBASE_DEFAULT_PORT)
        conn_kwargs = {**kwargs, "port": port}
        try:
            connection = self._inner.open_connection(**conn_kwargs)
            try:
                connection.execute("SELECT 1")
            finally:
                connection.close()
        except psycopg.Error as exc:
            code, detail = map_kingbase_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs) -> Any:
        port = kwargs.get("port", KINGBASE_DEFAULT_PORT)
        return self._inner.open_connection(**{**kwargs, "port": port})

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._inner.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        cols = self._inner.list_columns(connection, schema, table)
        return cols[:KINGBASE_MAX_COLUMNS]
```

`backend/app/datasources/dialects/kingbase/__init__.py`：

```python
from app.datasources.dialects.kingbase.connector import KINGBASE_MAX_COLUMNS, KingbaseConnector

__all__ = ["KINGBASE_MAX_COLUMNS", "KingbaseConnector"]
```

在 `backend/app/datasources/dialects/errors.py`（OceanBase 块之后）追加：

```python
# KingbaseES (PostgreSQL protocol)
KINGBASE_CONN_REFUSED = "KINGBASE_CONN_REFUSED"
KINGBASE_AUTH_FAILED = "KINGBASE_AUTH_FAILED"
KINGBASE_TIMEOUT = "KINGBASE_TIMEOUT"
KINGBASE_UNKNOWN_DATABASE = "KINGBASE_UNKNOWN_DATABASE"
KINGBASE_UNKNOWN = "KINGBASE_UNKNOWN"

_KINGBASE_FROM_PG = {
    PG_CONN_REFUSED: KINGBASE_CONN_REFUSED,
    PG_AUTH_FAILED: KINGBASE_AUTH_FAILED,
    PG_TIMEOUT: KINGBASE_TIMEOUT,
    PG_UNKNOWN_DATABASE: KINGBASE_UNKNOWN_DATABASE,
    PG_SSL_ERROR: KINGBASE_UNKNOWN,
    PG_UNKNOWN: KINGBASE_UNKNOWN,
}


def map_kingbase_error(exc: Exception) -> tuple[str, str]:
    if hasattr(exc, "sqlstate") or "OperationalError" in type(exc).__name__:
        pg_code, detail = map_postgres_operational_error(exc)
        return _KINGBASE_FROM_PG.get(pg_code, KINGBASE_UNKNOWN), detail
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered:
        return KINGBASE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return KINGBASE_TIMEOUT, detail
    if "refused" in lowered:
        return KINGBASE_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return KINGBASE_UNKNOWN_DATABASE, detail
    return KINGBASE_UNKNOWN, detail
```

并在 `__all__` 追加 `KINGBASE_*` 常量与 `map_kingbase_error`。

`backend/app/datasources/dialects/__init__.py` 追加：

```python
from app.datasources.dialects.kingbase import KINGBASE_MAX_COLUMNS, KingbaseConnector
```

`backend/app/datasources/__init__.py` 追加：

```python
from app.datasources.dialects.kingbase import KingbaseConnector
# register_builtin_dialects() 内：
register_connector_plugin(KingbaseConnector())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "conn_r59_018" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/kingbase/ backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/__init__.py backend/app/datasources/__init__.py tests/test_meta_cat_dash_conn_design_r59.py
git commit -m "feat(datasources): CONN-018 KingbaseES connector L1 via PG delegate"
```

---

### Task 6: DESIGN-004 设计器工单关联 L1

**Files:**
- Create: `backend/app/designer/workflow.py`
- Modify: `backend/app/api/v1/designer.py`
- Modify: `tests/test_meta_cat_dash_conn_design_r59.py`（+6 DESIGN 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

**Interfaces:**
- Consumes: `workflow_service.get_instance`, `publish_service.get_publish_status`
- Produces: `validate_workflow_link`, `save_workflow_link`, `get_workflow_link`

- [ ] **Step 1: Write the failing tests**

```python
def _workflow_link_payload(designer_item_id: str | None = None, workflow_id: str | None = None) -> dict:
    return {
        "designerItemId": designer_item_id or str(uuid.uuid4()),
        "workflowInstanceId": workflow_id or _create_workflow_instance(client=None),  # placeholder patched below
        "designType": "chart",
    }


def test_design_r59_004_validate_unknown_instance(client):
    """T-DESIGN-R59-004-01: 未知 workflow instance 404。"""
    payload = {
        "designerItemId": str(uuid.uuid4()),
        "workflowInstanceId": str(uuid.uuid4()),
        "designType": "chart",
    }
    resp = client.post("/api/v1/designer/workflow-link/validate", headers=AUTH, json=payload)
    assert resp.status_code == 404
    assert resp.json()["code"] == "DESIGN_WORKFLOW_INSTANCE_NOT_FOUND"


def test_design_r59_004_save_and_get(client):
    """T-DESIGN-R59-004-02: save/get 幂等覆盖。"""
    wf_id = _create_workflow_instance(client)
    item_id = str(uuid.uuid4())
    payload = {"designerItemId": item_id, "workflowInstanceId": wf_id, "designType": "chart"}
    save1 = client.put("/api/v1/designer/workflow-link", headers=AUTH, json=payload)
    assert save1.status_code == 200, save1.text
    save2 = client.put("/api/v1/designer/workflow-link", headers=AUTH, json=payload)
    assert save2.status_code == 200
    got = client.get(f"/api/v1/designer/workflow-link?designerItemId={item_id}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["workflowInstanceId"] == wf_id


def test_design_r59_004_validate_publish_ready_false(client):
    """T-DESIGN-R59-004-03: draft workflow publishReady=false。"""
    wf_id = _create_workflow_instance(client)
    payload = {"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"}
    resp = client.post("/api/v1/designer/workflow-link/validate", headers=AUTH, json=payload)
    assert resp.status_code == 200
    assert resp.json()["publishReady"] is False


def test_design_r59_004_invalid_item(client):
    """T-DESIGN-R59-004-04: 空 designerItemId 422。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={"designerItemId": "", "workflowInstanceId": wf_id, "designType": "chart"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_WORKFLOW_INVALID_ITEM"


def test_design_r59_004_sql_mode_route_unchanged(client):
    """T-DESIGN-R59-004-05: sql-mode capabilities 仍 200（不重复 DESIGN-003/005）。"""
    resp = client.get("/api/v1/designer/sql-mode/capabilities", headers=AUTH)
    assert resp.status_code == 200


def test_design_r59_004_get_missing(client):
    """T-DESIGN-R59-004-06: 未 save 的 item GET 404。"""
    resp = client.get(f"/api/v1/designer/workflow-link?designerItemId={uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
```

修正 `_workflow_link_payload` 不在模块级调用 client；上列测试已自包含，无需该 helper。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "design_r59_004" -v`
Expected: FAIL — 404 on workflow-link routes

- [ ] **Step 3: Write minimal implementation**

`backend/app/designer/workflow.py`：

```python
from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.designer.schemas import DesignerError
from app.governance.publish import service as publish_service
from app.governance.workflow import service as workflow_service
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigError, ConfigUpsert

_CONFIG_TYPE = "designer_workflow_link"
_REF_TYPE = "designer"


class DesignerWorkflowLinkIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    designer_item_id: uuid.UUID = Field(alias="designerItemId")
    workflow_instance_id: uuid.UUID = Field(alias="workflowInstanceId")
    catalog_entry_id: uuid.UUID | None = Field(default=None, alias="catalogEntryId")
    design_type: Literal["chart", "report", "query"] = Field(default="chart", alias="designType")


class DesignerWorkflowLinkValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool = True
    publish_ready: bool = Field(alias="publishReady")


class DesignerWorkflowLinkOut(DesignerWorkflowLinkIn):
    publish_ready: bool = Field(default=False, alias="publishReady")


def _workflow_status(session: Session, instance_id: uuid.UUID) -> str:
    try:
        return workflow_service.get_instance(session, instance_id).status
    except Exception as exc:
        raise DesignerError("DESIGN_WORKFLOW_INSTANCE_NOT_FOUND", "Workflow instance not found", 404) from exc


def _compute_publish_ready(session: Session, link: DesignerWorkflowLinkIn) -> bool:
    # GOV-003 FSM 终态为 published（design 字面 approved 对齐此终态）
    status = _workflow_status(session, link.workflow_instance_id)
    if status != "published":
        return False
    if link.catalog_entry_id is None:
        return True
    try:
        return publish_service.get_publish_status(session, link.catalog_entry_id).status == "published"
    except Exception:
        return False


def validate_workflow_link(session: Session, link: DesignerWorkflowLinkIn) -> DesignerWorkflowLinkValidateOut:
    if not str(link.designer_item_id):
        raise DesignerError("DESIGN_WORKFLOW_INVALID_ITEM", "designerItemId required", 422)
    _workflow_status(session, link.workflow_instance_id)
    return DesignerWorkflowLinkValidateOut(publishReady=_compute_publish_ready(session, link))


def save_workflow_link(session: Session, link: DesignerWorkflowLinkIn, owner_id: uuid.UUID | None) -> DesignerWorkflowLinkOut:
    validate_workflow_link(session, link)
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_CONFIG_TYPE,
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=link.designer_item_id,
            payload=link.model_dump(by_alias=True, mode="json"),
        ),
        owner_id=owner_id,
    )
    return get_workflow_link(session, link.designer_item_id)


def get_workflow_link(session: Session, designer_item_id: uuid.UUID) -> DesignerWorkflowLinkOut:
    try:
        record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, designer_item_id)
    except ConfigError as exc:
        raise DesignerError("DESIGN_WORKFLOW_LINK_NOT_FOUND", "Workflow link not found", 404) from exc
    link = DesignerWorkflowLinkIn.model_validate(record.payload)
    return DesignerWorkflowLinkOut(
        **link.model_dump(),
        publishReady=_compute_publish_ready(session, link),
    )
```

在 `backend/app/api/v1/designer.py` 追加：

```python
from app.designer import workflow as workflow_link_service
from app.designer.workflow import DesignerWorkflowLinkIn, DesignerWorkflowLinkOut, DesignerWorkflowLinkValidateOut


@router.post("/workflow-link/validate", response_model=DesignerWorkflowLinkValidateOut)
def validate_workflow_link(
    payload: DesignerWorkflowLinkIn,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DesignerWorkflowLinkValidateOut | JSONResponse:
    try:
        return workflow_link_service.validate_workflow_link(db, payload)
    except DesignerError as exc:
        return _designer_error(exc)


@router.put("/workflow-link", response_model=DesignerWorkflowLinkOut)
def save_workflow_link(
    payload: DesignerWorkflowLinkIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DesignerWorkflowLinkOut | JSONResponse:
    try:
        return workflow_link_service.save_workflow_link(db, payload, _owner_uuid(actor))
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/workflow-link", response_model=DesignerWorkflowLinkOut)
def get_workflow_link(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    designer_item_id: uuid.UUID = Query(alias="designerItemId"),
) -> DesignerWorkflowLinkOut | JSONResponse:
    try:
        return workflow_link_service.get_workflow_link(db, designer_item_id)
    except DesignerError as exc:
        return _designer_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -k "design_r59_004" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/workflow.py backend/app/api/v1/designer.py tests/test_meta_cat_dash_conn_design_r59.py
git commit -m "feat(designer): DESIGN-004 workflow-link validate/save/get L1"
```

---

### Task 7: 全量 smoke + 回归门控

**Files:**
- Modify: `tests/test_meta_cat_dash_conn_design_r59.py`（确认 32 断言齐全）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 确认断言计数**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py --collect-only -q | tail -1`
Expected: **32** tests collected（7 META + 7 CAT + 6 DASH + 6 CONN + 6 DESIGN + 2 fixture）

- [ ] **Step 2: r59 套件全绿**

Run: `cd backend && python3 -m pytest ../tests/test_meta_cat_dash_conn_design_r59.py -v`
Expected: **32 passed**

- [ ] **Step 3: 回归门控 r58 + r57**

Run: `cd backend && python3 -m pytest ../tests/test_dash_rpt_r58.py ../tests/test_dash_rpt_query_nfr_r57.py -v`
Expected: **38/38** + **37/37** passed

- [ ] **Step 4: ruff + 全量 pytest**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -q`
Expected: ruff exit 0；pytest **≥1522 passed**, 4 skipped, exit_code 0

- [ ] **Step 5: Commit（若有修复）**

```bash
git add tests/test_meta_cat_dash_conn_design_r59.py
git commit -m "test(r59): complete 32-assert smoke + regression gate green"
```

---

### Task 8: 文档同步（P3 清单 §9）

**Files:**
- Modify: `docs/services/metadata.md`
- Modify: `docs/services/governance.md`
- Create or Modify: `docs/services/dashboard.md`（若不存在则新建）
- Modify: `docs/services/datasources.md`
- Modify: `docs/services/designer.md`
- Modify: `docs/services/README.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（通过 alwaysApply 已注入；本 Task 触及 `docs/**` 时再 Read 全文）

**UI skill:** none

**UI Acceptance:** N/A

- [ ] **Step 1: 更新域附录**

`docs/services/metadata.md` 增加 `metadata/dataset/` 小节：Dataset L1 内存 store、validate/list CRUD、边界（不含 M4 ORM migration）。

`docs/services/governance.md` 增加 `catalog/classification/`：分类树内存 L1、cycle/depth 守卫。

`docs/services/dashboard.md` 增加 `entity_overview/`：与 `theme-analysis` 边界、config_store 持久化。

`docs/services/datasources.md` 登记 `kingbase` 插件、PG 委托、默认端口 54321。

`docs/services/designer.md` 增加 `workflow.py` workflow-link 契约。

`docs/services/README.md` 更新五域实现状态一行。

- [ ] **Step 2: 更新 API 登记簿**

`docs/api/README.md` 追加：

| 方法 | 路径 | 状态 | 锚点 |
|------|------|------|------|
| GET/POST | `/api/v1/datasets` | 已实现 | META-004 |
| POST | `/api/v1/datasets/validate` | 已实现 | META-004 |
| GET | `/api/v1/datasets/{dataset_id}` | 已实现 | META-004 |
| GET/POST/DELETE | `/api/v1/gov/catalog/classification/nodes` | 已实现 | CAT-004 |
| POST | `/api/v1/gov/catalog/classification/nodes/{id}/move` | 已实现 | CAT-004 |
| POST/PUT/GET | `/api/v1/dashboards/.../entity-overview` | 已实现 | DASH-005 |
| — | `type=kingbase` test-connection | 已实现 | CONN-018 |
| POST/PUT/GET | `/api/v1/designer/workflow-link` | 已实现 | DESIGN-004 |

- [ ] **Step 3: 验证 docs 无占位符**

Run: `rg -n "TBD|TODO|适当处理" docs/services/metadata.md docs/services/governance.md docs/services/dashboard.md docs/services/datasources.md docs/services/designer.md docs/api/README.md || true`
Expected: 无匹配

- [ ] **Step 4: Commit**

```bash
git add docs/services/ docs/api/README.md
git commit -m "docs(r59): register META/CAT/DASH/CONN/DESIGN L1 routes and domain boundaries"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** META-004/CAT-004/DASH-005/CONN-018/DESIGN-004 各有独立 Task + 测试分组
- [x] **Placeholder scan:** 无 TBD/TODO/「适当处理」
- [x] **Type consistency:** `DatasetItemIn`、`ClassificationNodeOut`、`EntityOverviewOut`、`KingbaseConnector`、`DesignerWorkflowLinkIn` 跨 Task 命名一致
- [x] **文件预算:** P3 生产 21 文件（design 19 + router + config_store）；测试 1；docs Task 8 另计
- [x] **回归门控:** r58 38/38 + r57 37/37 写入 Task 7
- [x] **UI:** 全 Task `UI skill: none` + `UI Acceptance: N/A`
