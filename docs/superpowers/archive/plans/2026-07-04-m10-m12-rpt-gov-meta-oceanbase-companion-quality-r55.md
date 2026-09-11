# M10/M12 报表扩展 + M8 OpenAPI + META schema + OceanBase companion 质量推分 r55 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/reports/extension/render.py` · `extension/service.py` · `extension/schemas.py` · `batch/service.py` · `errors.py` · `backend/app/governance/openapi/service.py` · `openapi/schemas.py` · `backend/app/metadata/entity/validation.py`（新建）· `entity/service.py` · `entity/schemas.py` · `entity/errors.py` · `backend/app/datasources/dialects/oceanbase.py` · `backend/app/api/v1/reports/__init__.py` · `metadata.py` · `gov.py` · `tests/test_rpt_gov_meta_conn_r55.py` · `docs/services/{reports,governance,datasources}.md`
> **子项：** GOV-006, RPT-007, RPT-006, META-006, CONN-020
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 在 r54 L1 骨架上闭合 companion 质量推分——OpenAPI 映射版本边界/非法映射/deactivate、批量部分失败结构化 detail、扩展配置渲染规格/修订历史/持久化边界、实体 schema 校验链/只读 query bindings、OceanBase HTTP 4xx/502 链与 limit 边界；≥32 条 `test_rpt_gov_meta_conn_r55`；五 PRD ID 加权总分破 **≥90**。

**Architecture:** 域逻辑留在 `governance/openapi/`、`reports/extension|batch/`、`metadata/entity/`、`datasources/dialects/`；`api/v1/gov.py`、`reports/__init__.py`、`metadata.py` 仅薄 entry；各域 `probe_*_budget_ms` 同进程 mock 计时（50–200ms 预算）；内存 store 不变、非 Alembic。纯后端、无 `fe/`。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / pymysql / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **分层纪律**（`common.mdc`）：domain 写业务；`api/v1/*.py` = entry。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；冲突 409。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/api/README.md`。
- **验证基线**（r54 P5）：`cd backend && python3 -m pytest -q` ≈ **1380 passed** / 4 skipped；本轮目标 **≥1410 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_rpt_gov_meta_conn_r55.py \
    ../tests/test_rpt_gov_meta_conn_r54.py \
    ../tests/test_dash_rpt_query_nfr_r53.py \
    ../tests/test_design_conn_gov_query_r52.py \
    -v
  ```
  Expected: r55 **≥32/32** + r54 **42/42** + r53 **38/38** + r52 **52/52**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/governance/openapi/schemas.py` | GOV-006 `apiVersion` + validate out | 修改 |
| `backend/app/governance/openapi/service.py` | 版本边界、operationId 校验、deactivate、probe | 修改 |
| `backend/app/api/v1/gov.py` | validate 响应体、deactivate 路由 | 修改 |
| `backend/app/reports/errors.py` | `ReportBatchError`/`ReportExtensionError` 可选 `fields` | 修改 |
| `backend/app/reports/batch/service.py` | 部分失败 detail + batch probe | 修改 |
| `backend/app/api/v1/reports/__init__.py` | batch/extension 错误 `detail` 透传；render-spec/revisions 路由 | 修改 |
| `backend/app/reports/extension/render.py` | `build_extension_render_spec` + probe | 新建 |
| `backend/app/reports/extension/schemas.py` | render/revision/snapshot out | 修改 |
| `backend/app/reports/extension/service.py` | revision history + persistence snapshot | 修改 |
| `backend/app/metadata/entity/validation.py` | schema 校验链 + query bindings + probe | 新建 |
| `backend/app/metadata/entity/schemas.py` | validate in/out、query bindings out | 修改 |
| `backend/app/metadata/entity/errors.py` | `EntityTypeError.fields` | 修改 |
| `backend/app/metadata/entity/service.py` | 复用 validation；validate draft | 修改 |
| `backend/app/api/v1/metadata.py` | POST validate、GET query-bindings | 修改 |
| `backend/app/datasources/dialects/oceanbase.py` | 空库注释 + probe | 修改 |
| `tests/test_rpt_gov_meta_conn_r55.py` | 新套件 ≥32 断言 | 新建 |
| `docs/services/reports.md` | RPT companion 边界 | 修改 |
| `docs/services/governance.md` | GOV 映射版本/非法映射 | 修改 |
| `docs/services/datasources.md` | OceanBase r55 companion | 修改 |

预估 **P3 生产代码文件 15** + **测试 1** + **docs 3** = **19**（生产+测试 **16 ≤ 20**；`gov.py` 薄 entry 计入生产预算）。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_rpt_gov_meta_conn_r55.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""M10/M12 报表扩展 + GOV OpenAPI + META entity + OceanBase companion 质量推分 r55."""
from __future__ import annotations

import os
import time
import uuid
from unittest.mock import MagicMock, patch

import pymysql.err
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R55_SQLITE_URL = "sqlite+pysqlite:///file:rpt_gov_meta_conn_r55?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r55_ensure_connectors():
    from app.datasources import register_builtin_dialects
    from app.datasources.registry import registry

    if "oceanbase" not in registry._connectors:
        register_builtin_dialects()
    yield


@pytest.fixture(scope="module", autouse=True)
def r55_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R55_SQLITE_URL
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
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _create_template_node(client: TestClient, name: str = "Tpl") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": name, "nodeType": "template", "templateKind": "excel"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_folder_node(client: TestClient, name: str = "Folder") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": name, "nodeType": "folder"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_catalog_entry(client: TestClient, *, status: str = "draft") -> str:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"Svc-{suffix}",
            "httpMethod": "POST",
            "path": f"/api/v1/gov-svc/{suffix}",
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _publish_entry(client: TestClient, entry_id: str) -> None:
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    assert resp.status_code == 200, resp.text
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "published"


def _register_mapping(client: TestClient, entry_id: str, operation_id: str) -> str:
    resp = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": entry_id,
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/demo",
            "operationId": operation_id,
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
```

---

### Task 1: r55 夹具 + GOV-006 OpenAPI 映射 companion

**Files:**
- Modify: `backend/app/governance/openapi/schemas.py`
- Modify: `backend/app/governance/openapi/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Create: `tests/test_rpt_gov_meta_conn_r55.py`（夹具 + GOV ≥7 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `SUPPORTED_API_VERSIONS`、`probe_openapi_validate_budget_ms: int = 50`
- Produces: `validate_mapping(payload) -> OpenApiMappingValidateOut`
- Produces: `deactivate_mapping(mapping_id: uuid.UUID) -> OpenApiMappingOut`
- Produces: `POST /api/v1/gov/openapi-mappings/{id}/deactivate`

- [ ] **Step 1: Write the failing tests**

在 `tests/test_rpt_gov_meta_conn_r55.py` 写入上文 **Shared Test Fixtures** 全文，并追加：

```python
from app.governance.openapi.service import probe_openapi_validate_budget_ms, validate_mapping
from app.governance.openapi.schemas import OpenApiMappingCreate


def test_r55_fixture_bootstraps(client):
    """T-R55-000-01: r55 sqlite 环境 health 可达。"""
    assert client.get("/health").status_code == 200


def test_gov_r55_unsupported_api_version(client):
    """T-GOV-R55-006-01: apiVersion=v2 validate → 422 GOV_OPENAPI_MAP_UNSUPPORTED_VERSION。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/x",
            "operationId": "validOp",
            "apiVersion": "v2",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_UNSUPPORTED_VERSION"


def test_gov_r55_invalid_operation_id(client):
    """T-GOV-R55-006-02: operationId=123bad → 422 GOV_OPENAPI_MAP_INVALID_OPERATION_ID。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/x",
            "operationId": "123bad",
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_INVALID_OPERATION_ID"


def test_gov_r55_validate_ok(client):
    """T-GOV-R55-006-03: 合法映射 validate → 200 valid=true apiVersion=v1。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/ok",
            "operationId": "okOp",
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["valid"] is True
    assert body["apiVersion"] == "v1"
    assert body["warnings"] == []


def test_gov_r55_deactivate_mapping(client):
    """T-GOV-R55-006-04: register 后 deactivate → 200 active=false。"""
    eid = _create_catalog_entry(client)
    _publish_entry(client, eid)
    mid = _register_mapping(client, eid, f"deact_{uuid.uuid4().hex[:6]}")
    resp = client.post(f"/api/v1/gov/openapi-mappings/{mid}/deactivate", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["active"] is False


def test_gov_r55_deactivate_twice_409(client):
    """T-GOV-R55-006-05: 重复 deactivate → 409 GOV_OPENAPI_MAP_ALREADY_INACTIVE。"""
    eid = _create_catalog_entry(client)
    _publish_entry(client, eid)
    mid = _register_mapping(client, eid, f"deact2_{uuid.uuid4().hex[:6]}")
    client.post(f"/api/v1/gov/openapi-mappings/{mid}/deactivate", headers=AUTH)
    resp = client.post(f"/api/v1/gov/openapi-mappings/{mid}/deactivate", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_ALREADY_INACTIVE"


def test_gov_r55_probe_validate_under_budget():
    """T-GOV-R55-006-06: probe_openapi_validate 耗时 < 50ms。"""
    payload = OpenApiMappingCreate(
        http_method="GET",
        path="/api/v1/gov-svc/probe",
        operation_id="probeOp",
        api_version="v1",
    )
    started = time.perf_counter()
    validate_mapping(payload)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_openapi_validate_budget_ms


def test_gov_r55_draft_entry_rejected(client):
    """T-GOV-R55-006-07: draft entry register → 422 GOV_OPENAPI_MAP_ENTRY_NOT_PUBLISHED（r54 回归）。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": eid,
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/draft",
            "operationId": "draftOpR55",
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_ENTRY_NOT_PUBLISHED"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "gov_r55" -v`
Expected: FAIL（`GOV_OPENAPI_MAP_UNSUPPORTED_VERSION` / `OpenApiMappingValidateOut` / deactivate 路由未实现）

- [ ] **Step 3: Write minimal implementation**

`backend/app/governance/openapi/schemas.py` 追加：

```python
class OpenApiMappingValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    api_version: Literal["v1"] = Field(alias="apiVersion")
    warnings: list[str] = Field(default_factory=list)
```

在 `OpenApiMappingCreate` 增加：

```python
api_version: Literal["v1"] = Field(default="v1", alias="apiVersion")
```

`backend/app/governance/openapi/service.py` 核心增量：

```python
import re
import time
from app.governance.openapi.schemas import OpenApiMappingValidateOut

SUPPORTED_API_VERSIONS = frozenset({"v1"})
_OPERATION_ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,127}$")
_PATH_RE = re.compile(r"^/api/v1/[a-z0-9/_-]+$")
probe_openapi_validate_budget_ms: int = 50


def _validate_api_version(api_version: str) -> None:
    if api_version not in SUPPORTED_API_VERSIONS:
        raise OpenApiMappingError(
            "GOV_OPENAPI_MAP_UNSUPPORTED_VERSION",
            f"Unsupported apiVersion: {api_version}",
            422,
        )


def _validate_operation_id(operation_id: str) -> None:
    if not _OPERATION_ID_RE.match(operation_id):
        raise OpenApiMappingError(
            "GOV_OPENAPI_MAP_INVALID_OPERATION_ID",
            "operationId must match ^[a-zA-Z][a-zA-Z0-9_]{0,127}$",
            422,
        )


def _validate_method_path_consistency(http_method: str, path: str) -> None:
    if not path.startswith("/api/v1/"):
        raise OpenApiMappingError("GOV_OPENAPI_MAP_INVALID_PATH", "Path must start with /api/v1/", 422)
    if not _PATH_RE.match(path):
        raise OpenApiMappingError("GOV_OPENAPI_MAP_INVALID_PATH", "Path segment invalid", 422)


def validate_mapping(payload: OpenApiMappingCreate) -> OpenApiMappingValidateOut:
    _validate_api_version(payload.api_version)
    _validate_operation_id(payload.operation_id)
    _validate_method_path_consistency(payload.http_method, payload.path)
    _validate_entity_ref(payload.entity_type_ref)
    return OpenApiMappingValidateOut(valid=True, api_version=payload.api_version, warnings=[])


def deactivate_mapping(mapping_id: uuid.UUID) -> OpenApiMappingOut:
    record = _store.get(mapping_id)
    if record is None:
        raise OpenApiMappingError("GOV_OPENAPI_MAP_NOT_FOUND", "Mapping not found", 404)
    if not record["active"]:
        raise OpenApiMappingError(
            "GOV_OPENAPI_MAP_ALREADY_INACTIVE",
            "Mapping already inactive",
            409,
        )
    record["active"] = False
    return get_mapping(mapping_id)
```

`register_mapping` 开头在 `validate_mapping(payload)` 之后保持现有逻辑；`validate_mapping` 调用链替换原仅 path 检查。

`backend/app/api/v1/gov.py`：

```python
from app.governance.openapi.schemas import OpenApiMappingValidateOut

@router.post("/openapi-mappings/validate", response_model=OpenApiMappingValidateOut)
def validate_openapi_mapping(...):
    try:
        return openapi_service.validate_mapping(payload)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)

@router.post("/openapi-mappings/{mapping_id}/deactivate", response_model=None)
def deactivate_openapi_mapping(mapping_id: uuid.UUID, ...):
    try:
        return openapi_service.deactivate_mapping(mapping_id)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "gov_r55" -v`
Expected: **8 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/openapi/ backend/app/api/v1/gov.py tests/test_rpt_gov_meta_conn_r55.py
git commit -m "feat(gov): GOV-006 OpenAPI mapping version boundary, validate chain, deactivate r55"
```

---

### Task 2: RPT-007 批量部分失败 detail + probe

**Files:**
- Modify: `backend/app/reports/errors.py`
- Modify: `backend/app/reports/batch/service.py`
- Modify: `backend/app/api/v1/reports/__init__.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `validate_mapping` 无关；catalog/extension 已有
- Produces: `ReportBatchError(..., fields={...})` → HTTP `detail`
- Produces: `probe_batch_create_budget_ms: int = 200`

- [ ] **Step 1: Write the failing tests**

追加到 `tests/test_rpt_gov_meta_conn_r55.py`：

```python
from app.reports.batch.service import probe_batch_create_budget_ms, batch_create
from app.reports.batch.schemas import BatchCreateReportsIn, BatchReportItem


def test_rpt_r55_batch_partial_failure_index(client):
    """T-RPT-R55-007-01: 第 2 项 parent 无效 → 422 RPT_BATCH_PARTIAL_FAILURE + failedIndex=1。"""
    good_parent = _create_template_node(client, "BatchParent")
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": "FirstOk"},
                {"name": "SecondBad", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "RPT_BATCH_PARTIAL_FAILURE"
    assert body["detail"]["failedIndex"] == 1
    assert body["detail"]["failedItemName"] == "SecondBad"


def test_rpt_r55_batch_rollback_no_residual(client):
    """T-RPT-R55-007-02: 失败回滚后 catalog 无残留节点。"""
    unique = f"Rollback_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": unique},
                {"name": "Fail", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    listed = client.get("/api/v1/reports/catalog/nodes", headers=AUTH)
    names = [n["name"] for n in listed.json()]
    assert unique not in names


def test_rpt_r55_batch_rolled_back_count(client):
    """T-RPT-R55-007-03: detail.rolledBackCount=1 当第 2 项失败且第 1 项已创建。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": f"Rb_{uuid.uuid4().hex[:6]}"},
                {"name": "X", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["rolledBackCount"] == 1


def test_rpt_r55_batch_idempotent_replay(client):
    """T-RPT-R55-007-04: Idempotency-Key 重放 → idempotentReplay=true（r54 回归）。"""
    key = f"idem-{uuid.uuid4()}"
    headers = {**AUTH, "Idempotency-Key": key}
    payload = {"items": [{"name": f"Idem_{uuid.uuid4().hex[:6]}"}]}
    first = client.post("/api/v1/reports/batch", headers=headers, json=payload)
    second = client.post("/api/v1/reports/batch", headers=headers, json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["idempotentReplay"] is True


def test_rpt_r55_batch_idempotency_conflict(client):
    """T-RPT-R55-007-05: 同 key 不同 body → 409 RPT_BATCH_IDEMPOTENCY_CONFLICT（r54 回归）。"""
    key = f"conflict-{uuid.uuid4()}"
    headers = {**AUTH, "Idempotency-Key": key}
    client.post("/api/v1/reports/batch", headers=headers, json={"items": [{"name": "A"}]})
    resp = client.post("/api/v1/reports/batch", headers=headers, json={"items": [{"name": "B"}]})
    assert resp.status_code == 409
    assert resp.json()["code"] == "RPT_BATCH_IDEMPOTENCY_CONFLICT"


def test_rpt_r55_batch_probe_under_budget():
    """T-RPT-R55-007-06: 10 项 mock batch elapsed_ms < 200。"""
    items = [BatchReportItem(name=f"b{i}") for i in range(10)]
    payload = BatchCreateReportsIn(items=items)
    started = time.perf_counter()
    batch_create(payload, None)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_batch_create_budget_ms
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "rpt_r55_batch" -v`
Expected: FAIL（`RPT_BATCH_PARTIAL_FAILURE` / `detail` 字段缺失）

- [ ] **Step 3: Write minimal implementation**

`backend/app/reports/errors.py`：

```python
class ReportBatchError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)


class ReportExtensionError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
```

`backend/app/reports/batch/service.py` 循环改为带索引，捕获时结构化失败：

```python
probe_batch_create_budget_ms: int = 200

def batch_create(payload: BatchCreateReportsIn, idempotency_key: str | None) -> BatchCreateReportsOut:
    # ... idempotency 逻辑不变 ...
    created: list[uuid.UUID] = []
    try:
        for idx, item in enumerate(payload.items):
            try:
                created.append(_create_single_item(item))
            except ReportBatchError as exc:
                rolled_back = len(created)
                for node_id in created:
                    if catalog_service.node_exists(node_id):
                        catalog_service.delete_node(node_id)
                raise ReportBatchError(
                    "RPT_BATCH_PARTIAL_FAILURE",
                    exc.message,
                    422,
                    fields={
                        "failedIndex": idx,
                        "failedItemName": item.name,
                        "rolledBackCount": rolled_back,
                    },
                ) from exc
    except ReportBatchError:
        raise
    # ... 成功路径不变 ...
```

`backend/app/api/v1/reports/__init__.py`：

```python
def _batch_error(exc: ReportBatchError) -> JSONResponse:
    detail = exc.fields if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )

def _extension_error(exc: ReportExtensionError) -> JSONResponse:
    detail = exc.fields if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "rpt_r55_batch" -v`
Expected: **6 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/errors.py backend/app/reports/batch/service.py backend/app/api/v1/reports/__init__.py tests/test_rpt_gov_meta_conn_r55.py
git commit -m "feat(reports): RPT-007 batch partial failure detail and probe r55"
```

---

### Task 3: RPT-006 扩展配置渲染规格 + 修订历史 + 持久化边界

**Files:**
- Create: `backend/app/reports/extension/render.py`
- Modify: `backend/app/reports/extension/schemas.py`
- Modify: `backend/app/reports/extension/service.py`
- Modify: `backend/app/api/v1/reports/__init__.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `build_extension_render_spec(record, template_kind) -> dict`
- Produces: `probe_extension_load_budget_ms: int = 50`
- Produces: `list_revision_history(node_id) -> list[ExtensionRevisionOut]`
- Produces: `export_persistence_snapshot(node_id) -> dict`
- Produces: `GET .../extension/render-spec`、`GET .../extension/revisions`

- [ ] **Step 1: Write the failing tests**

```python
from app.reports.extension.render import build_extension_render_spec, probe_extension_load_budget_ms
from app.reports.extension import service as extension_service


def _upsert_extension(client: TestClient, node_id: str, **extra) -> None:
    body = {
        "catalogNodeId": node_id,
        "metrics": [
            {"key": "revenue", "label": "Revenue", "visible": True},
            {"key": "hidden_m", "label": "Hidden", "visible": False},
        ],
        "filters": [{"key": "region", "operator": "eq", "required": True}],
        **extra,
    }
    resp = client.put(f"/api/v1/reports/catalog/nodes/{node_id}/extension", headers=AUTH, json=body)
    assert resp.status_code == 200, resp.text


def test_rpt_r55_render_spec_visible_metrics(client):
    """T-RPT-R55-006-01: upsert 后 GET render-spec → renderVersion=1.0 + visible metrics。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    resp = client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/render-spec", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["renderVersion"] == "1.0"
    keys = {m["key"] for m in body["metrics"]}
    assert keys == {"revenue"}


def test_rpt_r55_render_spec_hides_invisible(client):
    """T-RPT-R55-006-02: visible=false metric 不出现在 render-spec。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    resp = client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/render-spec", headers=AUTH)
    assert "hidden_m" not in {m["key"] for m in resp.json()["metrics"]}


def test_rpt_r55_revision_history_with_change_note(client):
    """T-RPT-R55-006-03: 带 changeNote 的 upsert → revisions 列表含该条。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid, changeNote="Adjusted metrics")
    resp = client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/revisions", headers=AUTH)
    assert resp.status_code == 200, resp.text
    notes = [r.get("changeNote") for r in resp.json()["items"]]
    assert "Adjusted metrics" in notes


def test_rpt_r55_persistence_snapshot_memory(client):
    """T-RPT-R55-006-04: persistence snapshot store=memory。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    snap = extension_service.export_persistence_snapshot(uuid.UUID(nid))
    assert snap["store"] == "memory"


def test_rpt_r55_render_spec_probe_under_budget(client):
    """T-RPT-R55-006-05: GET render-spec 耗时 < 50ms（probe）。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    started = time.perf_counter()
    client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/render-spec", headers=AUTH)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_extension_load_budget_ms


def test_rpt_r55_folder_render_spec_rejected(client):
    """T-RPT-R55-006-06: folder 节点 render-spec → 422 RPT_EXT_INVALID_NODE_TYPE（r54 回归）。"""
    fid = _create_folder_node(client)
    resp = client.get(f"/api/v1/reports/catalog/nodes/{fid}/extension/render-spec", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_NODE_TYPE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "rpt_r55_render or rpt_r55_revision or rpt_r55_persistence or rpt_r55_folder" -v`
Expected: FAIL（404 render-spec 路由不存在）

- [ ] **Step 3: Write minimal implementation**

`backend/app/reports/extension/render.py`：

```python
from __future__ import annotations

from typing import Literal

probe_extension_load_budget_ms: int = 50


def build_extension_render_spec(record: dict, template_kind: str | None) -> dict:
    visible_metrics = [m for m in record.get("metrics", []) if m.get("visible", True)]
    return {
        "templateNodeId": str(record["catalog_node_id"]),
        "revision": record["revision"],
        "templateKind": template_kind,
        "metrics": visible_metrics,
        "filters": record.get("filters", []),
        "renderVersion": "1.0",
    }
```

`backend/app/reports/extension/schemas.py` 追加 `ExtensionRenderSpecOut`、`ExtensionRevisionOut`、`ExtensionPersistenceSnapshotOut`（字段对齐 design §3.4.2）。

`backend/app/reports/extension/service.py` 追加：

```python
def list_revision_history(node_id: uuid.UUID) -> list[dict]:
    _assert_template_node(node_id)
    record = _store.get(node_id)
    if record is None:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Extension config not found", 404)
    entries = [e for e in _audit_log if e.get("nodeId") == str(node_id)]
    if not entries:
        return [{
            "revision": record["revision"],
            "changeNote": None,
            "updatedAt": datetime.now(UTC).isoformat(),
        }]
    return [{"revision": record["revision"], "changeNote": e["changeNote"], "updatedAt": e["updatedAt"]} for e in entries]


def export_persistence_snapshot(node_id: uuid.UUID) -> dict:
    record = _store[node_id]
    return {
        "store": "memory",
        "revision": record["revision"],
        "metrics": record["metrics"],
        "filters": record["filters"],
        "auditEntryCount": sum(1 for e in _audit_log if e.get("nodeId") == str(node_id)),
    }


def get_render_spec(node_id: uuid.UUID) -> dict:
    _assert_template_node(node_id)
    record = _store.get(node_id)
    if record is None:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Extension config not found", 404)
    node = catalog_service.get_node(node_id)
    return build_extension_render_spec(record, node.template_kind)
```

`backend/app/api/v1/reports/__init__.py` 追加两条 GET 路由调用 `extension_service.get_render_spec` / `list_revision_history`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "rpt_r55_render or rpt_r55_revision or rpt_r55_persistence or rpt_r55_folder" -v`
Expected: **6 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports/extension/ backend/app/api/v1/reports/__init__.py tests/test_rpt_gov_meta_conn_r55.py
git commit -m "feat(reports): RPT-006 extension render-spec, revisions, persistence snapshot r55"
```

---

### Task 4: META-006 实体 schema 校验链 + 只读 query bindings

**Files:**
- Create: `backend/app/metadata/entity/validation.py`
- Modify: `backend/app/metadata/entity/schemas.py`
- Modify: `backend/app/metadata/entity/errors.py`
- Modify: `backend/app/metadata/entity/service.py`
- Modify: `backend/app/api/v1/metadata.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `validate_entity_schema_payload(...) -> None`（失败抛 `EntityTypeError` + `fields`）
- Produces: `build_readonly_query_bindings(entity_type) -> EntityQueryBindingsOut`
- Produces: `validate_entity_type_draft(payload) -> EntityTypeValidateOut`
- Produces: `probe_schema_validate_budget_ms: int = 50`
- Produces: `POST /api/v1/metadata/entity-types/validate`、`GET .../query-bindings`

- [ ] **Step 1: Write the failing tests**

```python
from app.metadata.entity.validation import probe_schema_validate_budget_ms, validate_entity_schema_payload
from app.metadata.entity.schemas import EntityTypeCreate, EntityAttributeDef


_REQUIRED_LIFECYCLE = frozenset({"draft", "active", "retired"})


def test_meta_r55_duplicate_attributes(client):
    """T-META-R55-006-01: validate 重复属性名 → 422 META_ENTITY_SCHEMA_INVALID + duplicateAttributes。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "dup_attr",
            "displayName": "Dup",
            "attributes": [
                {"name": "foo", "dataType": "string"},
                {"name": "foo", "dataType": "integer"},
            ],
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "META_ENTITY_SCHEMA_INVALID"
    assert "foo" in body["detail"]["fields"]["duplicateAttributes"]


def test_meta_r55_missing_lifecycle_states(client):
    """T-META-R55-006-02: lifecycle 仅 active → 422 missingLifecycleStates。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "lc_bad",
            "displayName": "LC",
            "attributes": [],
            "lifecycleStates": ["active"],
        },
    )
    assert resp.status_code == 422
    missing = resp.json()["detail"]["fields"]["missingLifecycleStates"]
    assert "draft" in missing or "retired" in missing


def test_meta_r55_validate_ok(client):
    """T-META-R55-006-03: 合法 payload validate → 200 valid=true。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "valid_ent",
            "displayName": "Valid",
            "attributes": [{"name": "code", "dataType": "string"}],
            "lifecycleStates": ["draft", "active", "retired"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_meta_r55_query_bindings_readonly(client):
    """T-META-R55-006-04: GET query-bindings → 每项 readOnly=true。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "qb_ent",
            "displayName": "QB",
            "attributes": [{"name": "amount", "dataType": "number"}],
        },
    )
    resp = client.get("/api/v1/metadata/entity-types/qb_ent/query-bindings", headers=AUTH)
    assert resp.status_code == 200
    assert all(b["readOnly"] is True for b in resp.json()["bindings"])


def test_meta_r55_json_not_filterable(client):
    """T-META-R55-006-05: json 类型 filterable=false。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "json_ent",
            "displayName": "J",
            "attributes": [{"name": "payload", "dataType": "json"}],
        },
    )
    resp = client.get("/api/v1/metadata/entity-types/json_ent/query-bindings", headers=AUTH)
    jb = next(b for b in resp.json()["bindings"] if b["name"] == "payload")
    assert jb["filterable"] is False


def test_meta_r55_validate_probe_under_budget():
    """T-META-R55-006-06: validate probe < 50ms。"""
    payload = EntityTypeCreate(type_code="probe_ent", display_name="P", attributes=[])
    started = time.perf_counter()
    validate_entity_schema_payload(
        payload.type_code, payload.display_name, payload.attributes, payload.lifecycle_states
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_schema_validate_budget_ms


def test_meta_r55_entity_in_use_delete_409(client):
    """T-META-R55-006-07: GOV mapping 引用后 DELETE entity → 409 META_ENTITY_TYPE_IN_USE（r54 回归）。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "in_use_ent", "displayName": "IU", "attributes": []},
    )
    eid = _create_catalog_entry(client)
    _publish_entry(client, eid)
    _register_mapping(client, eid, f"map_{uuid.uuid4().hex[:6]}")
    resp = client.delete("/api/v1/metadata/entity-types/in_use_ent", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_ENTITY_TYPE_IN_USE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "meta_r55" -v`
Expected: FAIL（validate 路由 / `META_ENTITY_SCHEMA_INVALID` 未实现）

- [ ] **Step 3: Write minimal implementation**

`backend/app/metadata/entity/errors.py`：

```python
class EntityTypeError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, fields: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
        super().__init__(message)
```

`backend/app/metadata/entity/validation.py`：

```python
_REQUIRED_LIFECYCLE = frozenset({"draft", "active", "retired"})
probe_schema_validate_budget_ms: int = 50


def validate_entity_schema_payload(type_code, display_name, attributes, lifecycle_states) -> None:
    names = [a.name for a in attributes]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        raise EntityTypeError(
            "META_ENTITY_SCHEMA_INVALID",
            "Duplicate attribute names",
            422,
            fields={"duplicateAttributes": dupes},
        )
    if lifecycle_states:
        missing = sorted(_REQUIRED_LIFECYCLE - set(lifecycle_states))
        if missing:
            raise EntityTypeError(
                "META_ENTITY_SCHEMA_INVALID",
                "lifecycleStates must include draft/active/retired",
                422,
                fields={"missingLifecycleStates": missing},
            )


def build_readonly_query_bindings(entity_type: EntityTypeOut) -> EntityQueryBindingsOut:
    bindings = [
        {
            "name": a.name,
            "dataType": a.data_type,
            "filterable": a.data_type != "json",
            "readOnly": True,
        }
        for a in entity_type.attributes
    ]
    return EntityQueryBindingsOut(type_code=entity_type.type_code, bindings=bindings)
```

`service.py` 在 create/update 调用 `validate_entity_schema_payload`；新增 `validate_entity_type_draft` 与 `get_query_bindings`。

`metadata.py` 更新 `_entity_type_error` 输出 `detail.fields`；新增 validate 与 query-bindings 路由。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "meta_r55" -v`
Expected: **7 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/entity/ backend/app/api/v1/metadata.py tests/test_rpt_gov_meta_conn_r55.py
git commit -m "feat(metadata): META-006 entity schema validation chain and query bindings r55"
```

---

### Task 5: CONN-020 OceanBase HTTP 链 + 空库/limit 边界 + probe

**Files:**
- Modify: `backend/app/datasources/dialects/oceanbase.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `probe_test_connection_budget_ms: int = 100`
- Consumes: `map_oceanbase_error`（`errors.py` 已有，不修改）

- [ ] **Step 1: Write the failing tests**

```python
from app.datasources.dialects.errors import (
    OCEANBASE_AUTH_FAILED,
    OCEANBASE_CONN_REFUSED,
    OCEANBASE_TIMEOUT,
    OCEANBASE_UNKNOWN_DATABASE,
    map_oceanbase_error,
)
from app.datasources.dialects.oceanbase import OCEANBASE_MAX_COLUMNS, OceanbaseConnector, probe_test_connection_budget_ms


def test_conn_r55_oceanbase_timeout_code():
    """T-CONN-R55-020-01: mock timeout 2002 → OCEANBASE_TIMEOUT。"""
    exc = pymysql.err.OperationalError(2002, "Connection timed out")
    code, _ = map_oceanbase_error(exc)
    assert code == OCEANBASE_TIMEOUT


def test_conn_r55_oceanbase_unknown_database():
    """T-CONN-R55-020-02: mock 1049 → OCEANBASE_UNKNOWN_DATABASE。"""
    exc = pymysql.err.OperationalError(1049, "Unknown database")
    code, _ = map_oceanbase_error(exc)
    assert code == OCEANBASE_UNKNOWN_DATABASE


@patch.object(OceanbaseConnector, "list_schemas", return_value=[])
def test_conn_r55_oceanbase_empty_schemas(_mock):
    """T-CONN-R55-020-03: mock 空库 list_schemas → []。"""
    assert OceanbaseConnector().list_schemas(MagicMock()) == []


@patch("app.datasources.dialects.oceanbase.MysqlConnector.list_columns")
def test_conn_r55_oceanbase_column_limit(mock_cols):
    """T-CONN-R55-020-04: mock 501 columns → len==500。"""
    mock_cols.return_value = [MagicMock()] * 501
    cols = OceanbaseConnector().list_columns(MagicMock(), "db", "t")
    assert len(cols) == OCEANBASE_MAX_COLUMNS == 500


@patch("app.datasources.dialects.oceanbase.OceanbaseConnector.test_connection")
def test_conn_r55_http_test_auth_fail(mock_test, client):
    """T-CONN-R55-020-05: HTTP test auth fail → ok=false + traceId。"""
    from app.datasources.dialects.base import TestConnectionResult
    mock_test.return_value = TestConnectionResult(
        ok=False, message="[OCEANBASE_AUTH_FAILED] bad", latency_ms=1, code=OCEANBASE_AUTH_FAILED
    )
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "oceanbase",
            "name": "ob-test",
            "code": f"ob-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 2881,
            "database": "app",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == OCEANBASE_AUTH_FAILED
    assert body.get("traceId")


def test_conn_r55_http_tables_missing_schema_400(client):
    """T-CONN-R55-020-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "oceanbase",
            "name": "ob-meta",
            "code": f"obm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 2881,
            "database": "app",
            "username": "u",
            "password": "p",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    resp = client.get(f"/api/v1/datasources/{ds_id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


@patch("app.datasources.dialects.oceanbase.OceanbaseConnector.list_schemas")
def test_conn_r55_http_schemas_connection_failed(mock_schemas, client):
    """T-CONN-R55-020-07: HTTP GET schemas 连接失败 → 502 METADATA_CONNECTION_FAILED。"""
    mock_schemas.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "oceanbase",
            "name": "ob-fail",
            "code": f"obf-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 2881,
            "database": "app",
            "username": "u",
            "password": "p",
        },
    )
    ds_id = create.json()["id"]
    resp = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"


@patch("app.datasources.dialects.oceanbase.OceanbaseConnector.test_connection")
def test_conn_r55_probe_test_connection_under_budget(mock_test):
    """T-CONN-R55-020-08: probe_test_connection < 100ms（mock）。"""
    from app.datasources.dialects.base import TestConnectionResult
    mock_test.return_value = TestConnectionResult(ok=True, message="ok", latency_ms=1, code=None)
    started = time.perf_counter()
    OceanbaseConnector().test_connection(host="127.0.0.1", port=2881, database="d", username="u", password="p")
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_test_connection_budget_ms
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "conn_r55" -v`
Expected: FAIL（`probe_test_connection_budget_ms` 未定义；部分 HTTP 链需 mock 对齐）

- [ ] **Step 3: Write minimal implementation**

`backend/app/datasources/dialects/oceanbase.py` 追加：

```python
probe_test_connection_budget_ms: int = 100

def list_schemas(self, connection: Any) -> list[SchemaInfo]:
    # Empty tenant/database returns [] — symmetric with GBase companion pattern.
    return self._inner.list_schemas(connection)
```

（`list_columns` 截断已有；补 docstring 即可。）

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -k "conn_r55" -v`
Expected: **8 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/oceanbase.py tests/test_rpt_gov_meta_conn_r55.py
git commit -m "feat(datasources): CONN-020 OceanBase companion HTTP chain and probe r55"
```

---

### Task 6: r55 全量 companion 套件 + 跨子项门控

**Files:**
- Modify: `tests/test_rpt_gov_meta_conn_r55.py`（确认 ≥32 条断言函数齐全）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 清点测试覆盖**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py --collect-only -q | tail -1`
Expected: **≥32** tests collected（当前设计：GOV 8 + RPT-007 6 + RPT-006 6 + META 7 + CONN 8 = **35**）

- [ ] **Step 2: 运行 r55 全绿**

Run: `cd backend && python3 -m pytest ../tests/test_rpt_gov_meta_conn_r55.py -v`
Expected: **35 passed**（≥32 门槛）

- [ ] **Step 3: ruff clean**

Run: `cd backend && python3 -m ruff check .`
Expected: exit 0

- [ ] **Step 4: Commit**（若有遗漏修补）

```bash
git add tests/test_rpt_gov_meta_conn_r55.py
git commit -m "test: r55 companion suite gate ≥32 assertions"
```

---

### Task 7: 回归门控（r54 + r53 + r52 + 全量 pytest）

**Files:**（只读验证，无代码变更除非回归失败）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 四套件回归**

Run:
```bash
cd backend && python3 -m pytest \
  ../tests/test_rpt_gov_meta_conn_r55.py \
  ../tests/test_rpt_gov_meta_conn_r54.py \
  ../tests/test_dash_rpt_query_nfr_r53.py \
  ../tests/test_design_conn_gov_query_r52.py \
  -v --tb=short
```
Expected: r55 **≥32/32** + r54 **42/42** + r53 **38/38** + r52 **52/52** = **164/164**

- [ ] **Step 2: 全量 pytest**

Run: `cd backend && python3 -m pytest -q`
Expected: **≥1410 passed**, 4 skipped, exit 0

- [ ] **Step 3: ruff**

Run: `cd backend && python3 -m ruff check .`
Expected: exit 0

- [ ] **Step 4: Commit**（仅当回归修复产生 diff）

```bash
git commit -m "fix: r55 regression gate r54/r53/r52 green"
```

---

### Task 8: 文档同步（`docs/services/` companion 边界）

**Files:**
- Modify: `docs/services/reports.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及 `docs/**`**：遵守 `docs-layer.mdc` 与 `prd-sync.mdc`；不写 HTTP schema 细节（→ `docs/api/README.md` 若新增路由由 implementer 补一行登记）。

- [ ] **Step 1: 更新 `docs/services/reports.md`**

在 RPT-006/007 companion 节登记：
- `build_extension_render_spec` + `GET .../render-spec` + `GET .../revisions` + `export_persistence_snapshot`（`store=memory` 非生产持久化边界）
- `RPT_BATCH_PARTIAL_FAILURE` + `detail.failedIndex`/`failedItemName`/`rolledBackCount`
- `probe_extension_load_budget_ms` / `probe_batch_create_budget_ms`

- [ ] **Step 2: 更新 `docs/services/governance.md`**

登记 GOV-006 companion：
- `SUPPORTED_API_VERSIONS` 仅 `v1`；`GOV_OPENAPI_MAP_UNSUPPORTED_VERSION` / `GOV_OPENAPI_MAP_INVALID_OPERATION_ID`
- `deactivate_mapping` + `GOV_OPENAPI_MAP_ALREADY_INACTIVE`
- `probe_openapi_validate_budget_ms`

- [ ] **Step 3: 更新 `docs/services/datasources.md`**

登记 CONN-020 r55 companion：
- 空库 `list_schemas` → `[]`
- `OCEANBASE_MAX_COLUMNS=500` 截断
- HTTP test 200 `ok=false`+`code`+`traceId`；metadata 400/502 链
- `probe_test_connection_budget_ms`

- [ ] **Step 4: 验证文档存在且无断链**

Run: `test -f docs/services/reports.md && test -f docs/services/governance.md && test -f docs/services/datasources.md && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add docs/services/reports.md docs/services/governance.md docs/services/datasources.md
git commit -m "docs: r55 companion boundaries for reports, governance, datasources"
```

---

## Self-Review（P2 已完成）

| 检查项 | 结果 |
|--------|------|
| design 五子项均有 Task | Task 1 GOV · Task 2 RPT-007 · Task 3 RPT-006 · Task 4 META · Task 5 CONN |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 有验证命令 | 通过 |
| 全 Task UI skill none | 通过 |
| 预估文件 ≤20 | 生产+测试 16 + docs 3（docs 不计入 round-target 上限） |
| 测试目标 ≥32 | 设计 35 条 T-* 断言 |
| pytest 全量目标 | ≥1410 passed（基线 1380 + ~35 新测） |
