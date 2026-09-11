# M13 设计器 + M11 OpenSearch + 治理/查询 L1 kickoff 实现计划 — r49

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/designer/`（schemas + sql_mode + output_fields）· `backend/app/api/v1/designer.py` · `backend/app/datasources/dialects/opensearch.py` · `backend/app/datasources/dialects/errors.py` · `backend/app/datasources/dialects/__init__.py` · `backend/app/datasources/__init__.py` · `backend/pyproject.toml` · `backend/app/governance/workflow/`（4 文件）· `backend/app/api/v1/gov.py` · `backend/app/query/native/`（3 文件）· `backend/app/api/v1/query.py` · `backend/app/query/config_store/schemas.py` · `tests/test_design_conn_gov_query_r49.py` · `docs/services/{designer,datasources,governance,query}.md` · `docs/services/README.md` · `docs/api/README.md`
> **子项：** DESIGN-005, DESIGN-003, CONN-016, GOV-003, QUERY-003
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 交付设计器 SQL 模式 + 输出字段契约、OpenSearch 方言插件登记、治理工单五态 FSM、Native 查询路由守卫；≥35 条 pytest smoke；五 PRD ID L1 目标 ≥85。

**Architecture:** `designer/sql_mode.py` 委托 `query/readonly.assert_readonly_sql`；`designer/output_fields.py` 消费 `DESIGNER_FIELD_REGISTRY` + glossary code；`OpensearchConnector` 镜像 `elasticsearch.py` 经 `register_connector_plugin` 登记；`governance/workflow/service.py` 对齐 `publish/service` FSM 模式 + `config_store` 持久化实例；`query/native/guard.py` 只读 `export_type_catalog()` 按 `category` 路由。纯后端、无 Alembic migration、不实现 native 执行器。

**Tech Stack:** Python 3.11 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / opensearch-py / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不修改** `backend/app/datasources/registry.py` 的 `ConnectorRegistry.register` / `get` 方法体。
- **分层纪律**（`common.mdc`）：`designer/`、`governance/workflow/`、`query/native/` = domain；`api/v1/*.py` = entry。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；未鉴权 401。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/api/README.md`。
- **验证基线**（r46 P5）：`cd backend && python3 -m pytest -q` ≈ **1170 passed** / 4 skipped；本轮目标 **≥1205 passed** + 4 skipped，零失败，`ruff` clean。
- **验证命令**：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_design_conn_gov_query_r49.py \
    ../tests/test_meta_design_r32.py \
    ../tests/test_meta_design_r33.py \
    ../tests/test_nfr_gov_conn_r46.py \
    -v
  ```

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/designer/schemas.py` | DESIGN-003/005 DTO | 修改 |
| `backend/app/designer/sql_mode.py` | SQL 只读校验 + capabilities + config_store | 新建 |
| `backend/app/designer/output_fields.py` | 输出字段/聚合校验 + config_store | 新建 |
| `backend/app/api/v1/designer.py` | +9 路由（sql-mode 4 + output-fields 3 + validate） | 修改 |
| `backend/app/query/config_store/schemas.py` | 允许 `sql_mode`/`output_fields`/`workflow_instance` | 修改 |
| `backend/app/datasources/dialects/opensearch.py` | CONN-016 `OpensearchConnector` | 新建 |
| `backend/app/datasources/dialects/errors.py` | `map_opensearch_error` + `OPENSEARCH_*` | 修改 |
| `backend/app/datasources/dialects/__init__.py` | 导出 `OpensearchConnector` | 修改 |
| `backend/app/datasources/__init__.py` | `register_connector_plugin(OpensearchConnector())` | 修改 |
| `backend/pyproject.toml` | `connectors-ext` 追加 `opensearch-py>=2.4.0` | 修改 |
| `backend/app/governance/workflow/__init__.py` | 域导出 | 新建 |
| `backend/app/governance/workflow/errors.py` | `WorkflowError` + `GOV_WORKFLOW_*` | 新建 |
| `backend/app/governance/workflow/schemas.py` | 模板/实例/迁移 DTO | 新建 |
| `backend/app/governance/workflow/service.py` | 模板校验 + 五态 FSM + config_store | 新建 |
| `backend/app/api/v1/gov.py` | workflow 路由簇 | 修改 |
| `backend/app/query/native/__init__.py` | 域导出 | 新建 |
| `backend/app/query/native/schemas.py` | `NativeQuerySpec`/`RoutingDecision` | 新建 |
| `backend/app/query/native/guard.py` | `resolve_query_mode` + `validate_native_spec` | 新建 |
| `backend/app/api/v1/query.py` | `POST /native/validate` + `GET /routing/modes` | 修改 |
| `tests/test_design_conn_gov_query_r49.py` | 新套件 ≥35 断言函数 | 新建 |

预估 **P3 生产代码文件 19**（含 `config_store/schemas.py` 扩展）；docs Task 8 另计。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_design_conn_gov_query_r49.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""M13 设计器 + M11 OpenSearch + 治理/查询 L1 kickoff r49."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R49_SQLITE_URL = "sqlite+pysqlite:///file:design_conn_gov_query_r49?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r49_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R49_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.themes.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
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


def _ref_id() -> str:
    return str(uuid.uuid4())


def _designer_ref_payload(ref_id: str | None = None) -> dict:
    rid = ref_id or _ref_id()
    return {"refType": "design_draft", "refId": rid}
```

---

### Task 1: 测试夹具 + config_store 类型扩展

**Files:**
- Modify: `backend/app/query/config_store/schemas.py`
- Create: `tests/test_design_conn_gov_query_r49.py`（夹具 + 1 条启动测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `ALLOWED_CONFIG_TYPES` 含 `sql_mode`、`output_fields`、`workflow_instance`

- [ ] **Step 1: Write the failing test**

在 `tests/test_design_conn_gov_query_r49.py` 写入上文 **Shared Test Fixtures** 全文，并追加：

```python
from app.query.config_store.schemas import ALLOWED_CONFIG_TYPES


def test_r49_fixture_bootstraps(client):
    """T-R49-000-01: r49 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r49_config_types_include_new_kinds():
    """T-R49-000-02: config_store 允许 sql_mode/output_fields/workflow_instance。"""
    assert {"sql_mode", "output_fields", "workflow_instance"}.issubset(ALLOWED_CONFIG_TYPES)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py::test_r49_config_types_include_new_kinds -v`
Expected: FAIL — `sql_mode` not in `ALLOWED_CONFIG_TYPES`

- [ ] **Step 3: Write minimal implementation**

`backend/app/query/config_store/schemas.py` 第 9 行改为：

```python
ALLOWED_CONFIG_TYPES = frozenset({
    "query_conditions",
    "compute_rules",
    "visual_query_design",
    "sql_mode",
    "output_fields",
    "workflow_instance",
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/config_store/schemas.py tests/test_design_conn_gov_query_r49.py
git commit -m "test(r49): scaffold fixture and extend config_store types"
```

---

### Task 2: DESIGN-005 传统 SQL 模式

**Files:**
- Modify: `backend/app/designer/schemas.py`
- Create: `backend/app/designer/sql_mode.py`
- Modify: `backend/app/api/v1/designer.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `assert_readonly_sql(sql: str) -> None` from `app.query.readonly`（raises `QueryError`）
- Produces: `validate_sql_mode(spec: SqlModeSpec) -> SqlModeSpec`、`sql_mode_capabilities() -> dict`、`save_sql_mode(session, spec, owner_id)`、`get_sql_mode(session, ref_type, ref_id)`

- [ ] **Step 1: Write the failing test**

在 `tests/test_design_conn_gov_query_r49.py` 追加：

```python
def test_design005_validate_select_ok_r49(client):
    """T-DESIGN-R49-005-01: 合法 SELECT 1 → validate 200。"""
    ref = _ref_id()
    ds_id = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": ds_id,
            "sql": "SELECT 1",
            **_designer_ref_payload(ref),
        },
    )
    assert resp.status_code == 200
    assert resp.json()["sql"] == "SELECT 1"


def test_design005_insert_not_readonly_r49(client):
    """T-DESIGN-R49-005-02: INSERT → 422 DESIGN_SQL_NOT_READONLY。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "INSERT INTO t VALUES(1)",
            **_designer_ref_payload(ref),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design005_empty_sql_r49(client):
    """T-DESIGN-R49-005-03: 空 SQL → 422 DESIGN_SQL_EMPTY。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "   ",
            **_designer_ref_payload(ref),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_EMPTY"


def test_design005_put_get_roundtrip_r49(client):
    """T-DESIGN-R49-005-04: PUT 合法 spec → GET 往返一致。"""
    ref = _ref_id()
    ds_id = str(uuid.uuid4())
    payload = {
        "dataSourceId": ds_id,
        "sql": "SELECT id FROM orders",
        **_designer_ref_payload(ref),
    }
    put = client.put("/api/v1/designer/sql-mode", headers=AUTH, json=payload)
    assert put.status_code == 200, put.text
    got = client.get(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        params={"refId": ref},
    )
    assert got.status_code == 200
    body = got.json()
    assert body["sql"] == payload["sql"]
    assert body["dataSourceId"] == ds_id


def test_design005_capabilities_r49(client):
    """T-DESIGN-R49-005-05: GET capabilities 含 maxSqlLength=65536。"""
    resp = client.get("/api/v1/designer/sql-mode/capabilities", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["maxSqlLength"] == 65536
    assert "SELECT" in body["allowedStatements"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "design005" -v`
Expected: FAIL — 404 on `/designer/sql-mode/validate`

- [ ] **Step 3: Write minimal implementation**

`backend/app/designer/schemas.py` 末尾追加：

```python
class SqlModeSpec(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    sql: str = Field(min_length=1, max_length=65536)
    parameters: dict[str, object] = Field(default_factory=dict)
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
```

`backend/app/designer/sql_mode.py`（新建全文）：

```python
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.designer.schemas import DesignerError, SqlModeSpec
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert
from app.query.readonly import assert_readonly_sql
from app.query.schemas import QueryError

_MAX_SQL_LEN = 65536


def validate_sql_mode(spec: SqlModeSpec) -> SqlModeSpec:
    if not spec.sql.strip():
        raise DesignerError("DESIGN_SQL_EMPTY", "SQL must not be empty", 422)
    try:
        assert_readonly_sql(spec.sql)
    except QueryError as exc:
        if exc.code == "QUERY_SQL_TOO_LONG":
            raise DesignerError("DESIGN_SQL_TOO_LONG", exc.message, exc.status) from exc
        raise DesignerError("DESIGN_SQL_NOT_READONLY", exc.message, exc.status) from exc
    return spec


def sql_mode_capabilities() -> dict[str, object]:
    return {
        "allowedStatements": ["SELECT"],
        "maxSqlLength": _MAX_SQL_LEN,
        "highlightSupported": False,
    }


def _payload(spec: SqlModeSpec) -> dict:
    return {
        "schemaVersion": spec.schema_version,
        "dataSourceId": str(spec.data_source_id),
        "sql": spec.sql,
        "parameters": spec.parameters,
    }


def save_sql_mode(session: Session, spec: SqlModeSpec, owner_id: uuid.UUID | None = None):
    validate_sql_mode(spec)
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="sql_mode",
            schema_version=spec.schema_version,
            ref_type=spec.ref_type,
            ref_id=spec.ref_id,
            payload=_payload(spec),
        ),
        owner_id=owner_id,
    )
    return spec, record


def get_sql_mode(session: Session, ref_type: str, ref_id: uuid.UUID) -> SqlModeSpec:
    record = config_store.get_config_by_ref(session, "sql_mode", ref_type, ref_id)
    payload = record.payload
    return SqlModeSpec(
        schema_version=payload.get("schemaVersion", "1.0"),
        data_source_id=uuid.UUID(payload["dataSourceId"]),
        sql=payload["sql"],
        parameters=payload.get("parameters", {}),
        ref_type=ref_type,
        ref_id=ref_id,
    )
```

`backend/app/api/v1/designer.py` 追加 import 与路由（在文件末尾、`router` 定义之后）：

```python
from app.designer.schemas import SqlModeSpec
from app.designer import sql_mode as sql_mode_service

# 更新 tags：
router = APIRouter(
    prefix="/designer",
    tags=["designer", "DESIGN-001", "DESIGN-002", "DESIGN-003", "DESIGN-005"],
)


@router.post("/sql-mode/validate", response_model=SqlModeSpec)
def validate_sql_mode(
    payload: SqlModeSpec,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> SqlModeSpec | JSONResponse:
    try:
        return sql_mode_service.validate_sql_mode(payload)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/sql-mode/capabilities")
def get_sql_mode_capabilities(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> dict:
    return sql_mode_service.sql_mode_capabilities()


@router.put("/sql-mode", response_model=SqlModeSpec)
def save_sql_mode(
    payload: SqlModeSpec,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> SqlModeSpec | JSONResponse:
    try:
        config, _ = sql_mode_service.save_sql_mode(db, payload, _owner_uuid(actor))
        return config
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/sql-mode", response_model=SqlModeSpec)
def get_sql_mode(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    ref_type: str = "design_draft",
    ref_id: uuid.UUID | None = None,
) -> SqlModeSpec | JSONResponse:
    if ref_id is None:
        return JSONResponse(
            status_code=422,
            content={"code": "DESIGN_MISSING_REF", "message": "ref_id is required", "detail": None},
        )
    try:
        return sql_mode_service.get_sql_mode(db, ref_type, ref_id)
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "design005" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/schemas.py backend/app/designer/sql_mode.py backend/app/api/v1/designer.py tests/test_design_conn_gov_query_r49.py
git commit -m "feat(designer): DESIGN-005 sql-mode validate and config_store"
```

---

### Task 3: DESIGN-003 输出字段与聚合配置

**Files:**
- Modify: `backend/app/designer/schemas.py`
- Create: `backend/app/designer/output_fields.py`
- Modify: `backend/app/api/v1/designer.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `DESIGNER_FIELD_REGISTRY` from `app.designer.schemas`；`glossary_service.list_terms(session)` 取 `code` 集合
- Produces: `validate_output_fields_config(session, config) -> OutputFieldsConfig`、`save_output_fields(...)`、`get_output_fields(...)`

- [ ] **Step 1: Write the failing test**

```python
def _output_fields_payload(ref_id: str, fields: list[dict], aggregates: list[dict] | None = None) -> dict:
    return {
        "fields": fields,
        "aggregates": aggregates or [],
        **_designer_ref_payload(ref_id),
    }


def test_design003_put_get_roundtrip_r49(client):
    """T-DESIGN-R49-003-01: 合法 fields PUT → GET 往返。"""
    ref = _ref_id()
    payload = _output_fields_payload(
        ref,
        [{"fieldId": "order_amount", "alias": "amt", "visible": True}],
    )
    put = client.put("/api/v1/designer/output-fields", headers=AUTH, json=payload)
    assert put.status_code == 200, put.text
    got = client.get("/api/v1/designer/output-fields", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200
    assert got.json()["fields"][0]["fieldId"] == "order_amount"


def test_design003_empty_fields_r49(client):
    """T-DESIGN-R49-003-02: 空 fields → 422 DESIGN_EMPTY_OUTPUT_FIELDS。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(ref, []),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_OUTPUT_FIELDS"


def test_design003_unknown_field_r49(client):
    """T-DESIGN-R49-003-03: 未知 fieldId → 422 DESIGN_UNKNOWN_FIELD。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(ref, [{"fieldId": "not_a_field"}]),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"


def test_design003_invalid_aggregate_r49(client):
    """T-DESIGN-R49-003-04: 非法聚合 fn median → 422 DESIGN_INVALID_AGGREGATE。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(
            ref,
            [{"fieldId": "order_amount"}],
            [{"fn": "median", "fieldId": "order_amount", "groupBy": []}],
        ),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design003_meta_field_ref_glossary_r49(client):
    """T-DESIGN-R49-003-05: metaFieldRef=order_amount（glossary 存在）→ 200。"""
    client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "order_amount", "name": "订单金额"},
    )
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(
            ref,
            [{"fieldId": "order_amount", "metaFieldRef": "order_amount"}],
        ),
    )
    assert resp.status_code == 200


def test_design003_coexist_with_sql_mode_r49(client):
    """T-DESIGN-R49-003-06: 同 ref_id 可并存读取 conditions + output-fields + sql-mode。"""
    ref = _ref_id()
    client.put(
        "/api/v1/designer/conditions",
        headers=AUTH,
        json={
            "logic": "AND",
            "conditions": [
                {
                    "fieldId": "order_amount",
                    "operator": "gt",
                    "value": 0,
                    "valueType": "number",
                }
            ],
            **_designer_ref_payload(ref),
        },
    )
    client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json=_output_fields_payload(ref, [{"fieldId": "order_amount"}]),
    )
    client.put(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1",
            **_designer_ref_payload(ref),
        },
    )
    assert client.get("/api/v1/designer/conditions", headers=AUTH, params={"refId": ref}).status_code == 200
    assert client.get("/api/v1/designer/output-fields", headers=AUTH, params={"refId": ref}).status_code == 200
    assert client.get("/api/v1/designer/sql-mode", headers=AUTH, params={"refId": ref}).status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "design003" -v`
Expected: FAIL — 404 on `/designer/output-fields/validate`

- [ ] **Step 3: Write minimal implementation**

`backend/app/designer/schemas.py` 追加：

```python
ALLOWED_OUTPUT_AGGREGATES = frozenset({"sum", "avg", "count", "min", "max"})


class OutputFieldItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field_id: str = Field(alias="fieldId")
    alias: str | None = None
    visible: bool = True
    meta_field_ref: str | None = Field(default=None, alias="metaFieldRef")


class AggregateItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    fn: str
    field_id: str = Field(alias="fieldId")
    group_by: list[str] = Field(default_factory=list, alias="groupBy")


class OutputFieldsConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    fields: list[OutputFieldItem]
    aggregates: list[AggregateItem] = Field(default_factory=list)
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
```

`backend/app/designer/output_fields.py`（新建全文）：

```python
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.designer.schemas import (
    ALLOWED_OUTPUT_AGGREGATES,
    AggregateItem,
    DESIGNER_FIELD_REGISTRY,
    DesignerError,
    OutputFieldItem,
    OutputFieldsConfig,
)
from app.metadata.glossary import service as glossary_service
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert


def _glossary_codes(session: Session) -> set[str]:
    listed = glossary_service.list_terms(session, limit=500, offset=0)
    return {item.code for item in listed.items}


def validate_output_fields_config(session: Session, config: OutputFieldsConfig) -> OutputFieldsConfig:
    if not config.fields:
        raise DesignerError(
            "DESIGN_EMPTY_OUTPUT_FIELDS",
            "At least one output field is required",
            422,
            fields=[{"field": "fields", "message": "must not be empty"}],
        )
    glossary = _glossary_codes(session)
    for idx, field in enumerate(config.fields):
        prefix = f"fields[{idx}]"
        if field.field_id not in DESIGNER_FIELD_REGISTRY:
            raise DesignerError(
                "DESIGN_UNKNOWN_FIELD",
                "Unknown field in output",
                422,
                fields=[{"field": f"{prefix}.fieldId", "message": f"{field.field_id} not registered"}],
            )
        if field.meta_field_ref and field.meta_field_ref not in DESIGNER_FIELD_REGISTRY:
            if field.meta_field_ref not in glossary:
                raise DesignerError(
                    "DESIGN_UNKNOWN_META_REF",
                    "Unknown meta field reference",
                    422,
                    fields=[
                        {
                            "field": f"{prefix}.metaFieldRef",
                            "message": f"{field.meta_field_ref} not in glossary or registry",
                        }
                    ],
                )
    for idx, agg in enumerate(config.aggregates):
        prefix = f"aggregates[{idx}]"
        if agg.fn not in ALLOWED_OUTPUT_AGGREGATES:
            raise DesignerError(
                "DESIGN_INVALID_AGGREGATE",
                f"Aggregate function not allowed: {agg.fn}",
                422,
                fields=[{"field": f"{prefix}.fn", "message": "not in whitelist"}],
            )
        if agg.field_id not in DESIGNER_FIELD_REGISTRY:
            raise DesignerError(
                "DESIGN_UNKNOWN_FIELD",
                "Unknown field in aggregate",
                422,
                fields=[{"field": f"{prefix}.fieldId", "message": f"{agg.field_id} not registered"}],
            )
        for j, gb in enumerate(agg.group_by):
            if gb not in DESIGNER_FIELD_REGISTRY:
                raise DesignerError(
                    "DESIGN_UNKNOWN_FIELD",
                    "Unknown groupBy field",
                    422,
                    fields=[{"field": f"{prefix}.groupBy[{j}]", "message": f"{gb} not registered"}],
                )
    return config


def _payload(config: OutputFieldsConfig) -> dict:
    return {
        "schemaVersion": config.schema_version,
        "fields": [f.model_dump(by_alias=True) for f in config.fields],
        "aggregates": [a.model_dump(by_alias=True) for a in config.aggregates],
    }


def save_output_fields(session: Session, config: OutputFieldsConfig, owner_id: uuid.UUID | None = None):
    validate_output_fields_config(session, config)
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="output_fields",
            schema_version=config.schema_version,
            ref_type=config.ref_type,
            ref_id=config.ref_id,
            payload=_payload(config),
        ),
        owner_id=owner_id,
    )
    return config, record


def get_output_fields(session: Session, ref_type: str, ref_id: uuid.UUID) -> OutputFieldsConfig:
    record = config_store.get_config_by_ref(session, "output_fields", ref_type, ref_id)
    payload = record.payload
    return OutputFieldsConfig(
        schema_version=payload.get("schemaVersion", "1.0"),
        fields=[OutputFieldItem.model_validate(f) for f in payload["fields"]],
        aggregates=[AggregateItem.model_validate(a) for a in payload.get("aggregates", [])],
        ref_type=ref_type,
        ref_id=ref_id,
    )
```

`backend/app/api/v1/designer.py` 追加：

```python
from app.designer.schemas import OutputFieldsConfig
from app.designer import output_fields as output_fields_service


@router.post("/output-fields/validate", response_model=OutputFieldsConfig)
def validate_output_fields(
    payload: OutputFieldsConfig,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> OutputFieldsConfig | JSONResponse:
    try:
        return output_fields_service.validate_output_fields_config(db, payload)
    except DesignerError as exc:
        return _designer_error(exc)


@router.put("/output-fields", response_model=OutputFieldsConfig)
def save_output_fields(
    payload: OutputFieldsConfig,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> OutputFieldsConfig | JSONResponse:
    try:
        config, _ = output_fields_service.save_output_fields(db, payload, _owner_uuid(actor))
        return config
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/output-fields", response_model=OutputFieldsConfig)
def get_output_fields(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    ref_type: str = "design_draft",
    ref_id: uuid.UUID | None = None,
) -> OutputFieldsConfig | JSONResponse:
    if ref_id is None:
        return JSONResponse(
            status_code=422,
            content={"code": "DESIGN_MISSING_REF", "message": "ref_id is required", "detail": None},
        )
    try:
        return output_fields_service.get_output_fields(db, ref_type, ref_id)
    except ConfigError as exc:
        return _config_error(exc)
    except DesignerError as exc:
        return _designer_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "design003 or design005" -v`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/schemas.py backend/app/designer/output_fields.py backend/app/api/v1/designer.py tests/test_design_conn_gov_query_r49.py
git commit -m "feat(designer): DESIGN-003 output-fields validate and persistence"
```

---

### Task 4: CONN-016 OpenSearch 方言

**Files:**
- Create: `backend/app/datasources/dialects/opensearch.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `backend/pyproject.toml`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `OpensearchConnector` with `type="opensearch"`, `category="search"`；`map_opensearch_error(exc) -> tuple[str, str]`

- [ ] **Step 1: Write the failing test**

```python
from unittest.mock import MagicMock, patch

from app.core.nfr.plugin_extension import get_plugin_registration_meta
from app.datasources.dialects.opensearch import OpensearchConnector
from app.datasources.registry import export_type_catalog


def test_conn016_opensearch_in_catalog_r49():
    """T-CONN-R49-016-01: export_type_catalog 含 opensearch category=search。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "opensearch" in types
    assert types["opensearch"]["category"] == "search"


def test_conn016_plugin_registration_meta_r49():
    """T-CONN-R49-016-02: get_plugin_registration_meta(opensearch) registered_via=plugin。"""
    meta = get_plugin_registration_meta("opensearch")
    assert meta is not None
    assert meta["registered_via"] == "plugin"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn016_test_connection_ok_r49(mock_os_cls):
    """T-CONN-R49-016-03: mock client.info 成功 → ok=True。"""
    mock_os_cls.return_value.info.return_value = {"version": {"number": "2.11.0"}}
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="", password="")
    assert result.ok is True


def test_conn016_empty_host_r49():
    """T-CONN-R49-016-04: 空 host → OPENSEARCH_INVALID_HOST。"""
    conn = OpensearchConnector()
    result = conn.test_connection(host="  ", port=9200, database="", username="", password="")
    assert result.ok is False
    assert result.code == "OPENSEARCH_INVALID_HOST"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn016_auth_failed_r49(mock_os_cls):
    """T-CONN-R49-016-05: mock 401 → OPENSEARCH_AUTH_FAILED。"""
    mock_os_cls.return_value.info.side_effect = Exception("authentication failed 401")
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="u", password="p")
    assert result.ok is False
    assert result.code == "OPENSEARCH_AUTH_FAILED"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn016_list_columns_truncate_r49(mock_os_cls):
    """T-CONN-R49-016-06: list_columns 超 500 字段 truncate。"""
    props = {f"f{i}": {"type": "keyword"} for i in range(510)}
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    mock_os_cls.return_value = mock_client
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    cols = conn.list_columns(client, "idx", "_doc")
    assert len(cols) == 500
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "conn016" -v`
Expected: FAIL — `ModuleNotFoundError: app.datasources.dialects.opensearch`

- [ ] **Step 3: Write minimal implementation**

`backend/app/datasources/dialects/opensearch.py`（新建，镜像 `elasticsearch.py`）：

```python
from __future__ import annotations

import time
from typing import Any

from opensearchpy import OpenSearch

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult

OPENSEARCH_INVALID_HOST = "OPENSEARCH_INVALID_HOST"
OPENSEARCH_CONNECTION_REFUSED = "OPENSEARCH_CONNECTION_REFUSED"
OPENSEARCH_AUTH_FAILED = "OPENSEARCH_AUTH_FAILED"
OPENSEARCH_TIMEOUT = "OPENSEARCH_TIMEOUT"
OPENSEARCH_UNKNOWN = "OPENSEARCH_UNKNOWN"
OPENSEARCH_MAX_MAPPING_FIELDS = 500

_OS_TYPE_MAP = {
    "keyword": "string",
    "text": "string",
    "long": "number",
    "integer": "number",
    "double": "number",
    "float": "number",
    "date": "datetime",
    "boolean": "boolean",
    "object": "json",
    "nested": "json",
}


def _normalize_os_type(os_type: str) -> str:
    return _OS_TYPE_MAP.get(os_type, "unknown")


def _build_client(*, host: str, port: int, username: str, password: str, timeout_sec: float) -> OpenSearch:
    if not host.strip():
        raise ValueError("host is required")
    scheme = "https" if port == 443 else "http"
    url = f"{scheme}://{host}:{port}"
    kwargs: dict[str, Any] = {"hosts": [url], "timeout": timeout_sec}
    if username or password:
        kwargs["http_auth"] = (username, password)
    return OpenSearch(**kwargs)


class OpensearchConnector:
    type = "opensearch"
    category = "search"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "OpenSearch"

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        **_: object,
    ) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            client = _build_client(
                host=host, port=port, username=username, password=password, timeout_sec=timeout_sec
            )
            client.info()
        except ValueError:
            return TestConnectionResult(
                ok=False,
                message="[OPENSEARCH_INVALID_HOST] host is required",
                latency_ms=int((time.perf_counter() - started) * 1000),
                code=OPENSEARCH_INVALID_HOST,
            )
        except Exception as exc:
            msg = str(exc).lower()
            code = OPENSEARCH_UNKNOWN
            if "timeout" in msg or "timed out" in msg:
                code = OPENSEARCH_TIMEOUT
            elif "connection refused" in msg or "failed to establish" in msg:
                code = OPENSEARCH_CONNECTION_REFUSED
            elif "authentication" in msg or "401" in msg or "403" in msg:
                code = OPENSEARCH_AUTH_FAILED
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {exc}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        **_: object,
    ) -> OpenSearch:
        return _build_client(
            host=host,
            port=port,
            username=username,
            password=password,
            timeout_sec=connect_timeout_sec,
        )

    def list_schemas(self, connection: OpenSearch) -> list[SchemaInfo]:
        rows = connection.cat.indices(format="json")
        names = [row["index"] for row in rows if not str(row["index"]).startswith(".")]
        return [SchemaInfo(name=n) for n in sorted(names)]

    def list_tables(self, connection: OpenSearch, schema: str) -> list[TableInfo]:
        return [TableInfo(name="_doc", type="index")]

    def list_columns(self, connection: OpenSearch, schema: str, table: str) -> list[ColumnInfo]:
        mapping = connection.indices.get_mapping(index=schema)
        props = mapping.get(schema, {}).get("mappings", {}).get("properties", {})
        columns = [
            ColumnInfo(
                name=name,
                data_type=_normalize_os_type(str(meta.get("type", "object"))),
                nullable=True,
            )
            for name, meta in sorted(props.items())
        ]
        if len(columns) > OPENSEARCH_MAX_MAPPING_FIELDS:
            return columns[:OPENSEARCH_MAX_MAPPING_FIELDS]
        return columns
```

`backend/app/datasources/dialects/errors.py` 追加（在文件末尾 `__all__` 之前）：

```python
OPENSEARCH_INVALID_HOST = "OPENSEARCH_INVALID_HOST"
OPENSEARCH_CONNECTION_REFUSED = "OPENSEARCH_CONNECTION_REFUSED"
OPENSEARCH_AUTH_FAILED = "OPENSEARCH_AUTH_FAILED"
OPENSEARCH_TIMEOUT = "OPENSEARCH_TIMEOUT"
OPENSEARCH_UNKNOWN = "OPENSEARCH_UNKNOWN"


def map_opensearch_error(exc: Exception) -> tuple[str, str]:
    msg = str(exc).lower()
    if "timeout" in msg or "timed out" in msg:
        return OPENSEARCH_TIMEOUT, str(exc)
    if "connection refused" in msg or "failed to establish" in msg:
        return OPENSEARCH_CONNECTION_REFUSED, str(exc)
    if "authentication" in msg or "401" in msg or "403" in msg:
        return OPENSEARCH_AUTH_FAILED, str(exc)
    if "host is required" in msg:
        return OPENSEARCH_INVALID_HOST, str(exc)
    return OPENSEARCH_UNKNOWN, str(exc)
```

更新 `errors.py` 的 `__all__` 列表追加上述常量与 `map_opensearch_error`。

`backend/app/datasources/dialects/__init__.py`：import 并 `__all__` 追加 `OpensearchConnector`、`OPENSEARCH_MAX_MAPPING_FIELDS`。

`backend/app/datasources/__init__.py`：

```python
from app.datasources.dialects.opensearch import OpensearchConnector
# register_builtin_dialects 末尾：
    register_connector_plugin(OpensearchConnector())
```

`backend/pyproject.toml` `connectors-ext` 追加 `"opensearch-py>=2.4.0"`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pip install -q 'opensearch-py>=2.4.0' && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "conn016" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/opensearch.py backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/__init__.py backend/app/datasources/__init__.py backend/pyproject.toml tests/test_design_conn_gov_query_r49.py
git commit -m "feat(datasources): CONN-016 OpenSearch connector via plugin registration"
```

---

### Task 5: GOV-003 工单流程模板 REST 骨架

**Files:**
- Create: `backend/app/governance/workflow/__init__.py`
- Create: `backend/app/governance/workflow/errors.py`
- Create: `backend/app/governance/workflow/schemas.py`
- Create: `backend/app/governance/workflow/service.py`
- Modify: `backend/app/api/v1/gov.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `list_templates() -> list[WorkflowTemplateOut]`、`create_instance(session, template_id, ref_id)`、`transition_instance(session, instance_id, action, actor_role)`、`get_instance(session, instance_id)`

- [ ] **Step 1: Write the failing test**

```python
def test_gov003_list_templates_r49(client):
    """T-GOV-R49-003-01: GET templates 含 standard_query_release。"""
    resp = client.get("/api/v1/gov/workflow/templates", headers=AUTH)
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()["items"]]
    assert "standard_query_release" in ids


def test_gov003_create_instance_draft_r49(client):
    """T-GOV-R49-003-02: POST instance → status=draft。"""
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "draft"
    return resp.json()["id"]


def test_gov003_happy_path_fsm_r49(client):
    """T-GOV-R49-003-03..06: 五态迁移 happy path。"""
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    ).json()
    iid = inst["id"]

    def trans(action: str, role: str) -> str:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text
        return r.json()["status"]

    assert trans("submit", "requester") == "pending_approval"
    assert trans("approve", "approver") == "designing"
    assert trans("complete_design", "designer") == "pending_publish"
    assert trans("publish", "publisher") == "published"


def test_gov003_invalid_transition_r49(client):
    """T-GOV-R49-003-07: draft + publish → 400 GOV_WORKFLOW_INVALID_TRANSITION。"""
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    ).json()
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{inst['id']}/transition",
        headers=AUTH,
        json={"action": "publish", "actorRole": "publisher"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "GOV_WORKFLOW_INVALID_TRANSITION"


def test_gov003_forbidden_role_r49(client):
    """T-GOV-R49-003-08: pending_approval + approve + requester → 403 GOV_WORKFLOW_FORBIDDEN_ROLE。"""
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    ).json()
    client.post(
        f"/api/v1/gov/workflow/instances/{inst['id']}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{inst['id']}/transition",
        headers=AUTH,
        json={"action": "approve", "actorRole": "requester"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_WORKFLOW_FORBIDDEN_ROLE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "gov003" -v`
Expected: FAIL — 404 on `/gov/workflow/templates`

- [ ] **Step 3: Write minimal implementation**

`backend/app/governance/workflow/errors.py`：

```python
from __future__ import annotations


class WorkflowError(Exception):
    def __init__(self, code: str, message: str, status: int) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)
```

`backend/app/governance/workflow/schemas.py`：

```python
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class WorkflowNode(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    role: str


class WorkflowTemplateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str
    nodes: list[WorkflowNode]


class WorkflowTemplateListOut(BaseModel):
    items: list[WorkflowTemplateOut]


class WorkflowTemplateValidateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str
    nodes: list[WorkflowNode]


class WorkflowInstanceCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    template_id: str = Field(alias="templateId")
    ref_id: uuid.UUID = Field(alias="refId")


class WorkflowTransitionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    action: str
    actor_role: str = Field(alias="actorRole")


class WorkflowInstanceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    template_id: str = Field(alias="templateId")
    ref_id: uuid.UUID = Field(alias="refId")
    status: str
    allowed_actions: list[str] = Field(alias="allowedActions")
```

`backend/app/governance/workflow/service.py`（核心 FSM）：

```python
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.governance.workflow.errors import WorkflowError
from app.governance.workflow.schemas import (
    WorkflowInstanceCreateIn,
    WorkflowInstanceOut,
    WorkflowTemplateOut,
    WorkflowTemplateValidateIn,
)
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert

_BUILTIN_TEMPLATES: dict[str, WorkflowTemplateOut] = {
    "standard_query_release": WorkflowTemplateOut(
        id="standard_query_release",
        name="标准查询发布流程",
        nodes=[
            {"id": "draft", "role": "requester"},
            {"id": "pending_approval", "role": "approver"},
            {"id": "designing", "role": "designer"},
            {"id": "pending_publish", "role": "publisher"},
            {"id": "published", "role": "publisher"},
        ],
    )
}

_TRANSITIONS: dict[str, dict[str, tuple[str, str]]] = {
    "draft": {"submit": ("pending_approval", "requester")},
    "pending_approval": {
        "approve": ("designing", "approver"),
        "reject": ("draft", "approver"),
    },
    "designing": {"complete_design": ("pending_publish", "designer")},
    "pending_publish": {"publish": ("published", "publisher")},
    "published": {},
}


def list_templates() -> list[WorkflowTemplateOut]:
    return list(_BUILTIN_TEMPLATES.values())


def validate_template(payload: WorkflowTemplateValidateIn) -> WorkflowTemplateOut:
    node_ids = [n.id for n in payload.nodes]
    if len(node_ids) != len(set(node_ids)):
        raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", "Duplicate node ids", 422)
    if any(not n.role.strip() for n in payload.nodes):
        raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", "Node role required", 422)
    return WorkflowTemplateOut(id=payload.id, name=payload.name, nodes=payload.nodes)


def _allowed_actions(status: str) -> list[str]:
    return sorted(_TRANSITIONS.get(status, {}).keys())


def _load_instance_payload(session: Session, instance_id: uuid.UUID) -> dict:
    record = config_store.get_config_by_ref(session, "workflow_instance", "workflow", instance_id)
    return record.payload


def create_instance(session: Session, payload: WorkflowInstanceCreateIn) -> WorkflowInstanceOut:
    if payload.template_id not in _BUILTIN_TEMPLATES:
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_NOT_FOUND", "Template not found", 404)
    instance_id = uuid.uuid4()
    body = {
        "templateId": payload.template_id,
        "refId": str(payload.ref_id),
        "status": "draft",
        "history": [],
    }
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="workflow_instance",
            schema_version="1.0",
            ref_type="workflow",
            ref_id=instance_id,
            payload=body,
        ),
    )
    return WorkflowInstanceOut(
        id=instance_id,
        templateId=payload.template_id,
        refId=payload.ref_id,
        status="draft",
        allowedActions=_allowed_actions("draft"),
    )


def get_instance(session: Session, instance_id: uuid.UUID) -> WorkflowInstanceOut:
    body = _load_instance_payload(session, instance_id)
    return WorkflowInstanceOut(
        id=instance_id,
        templateId=body["templateId"],
        refId=uuid.UUID(body["refId"]),
        status=body["status"],
        allowedActions=_allowed_actions(body["status"]),
    )


def transition_instance(
    session: Session, instance_id: uuid.UUID, action: str, actor_role: str
) -> WorkflowInstanceOut:
    body = _load_instance_payload(session, instance_id)
    status = body["status"]
    rules = _TRANSITIONS.get(status, {})
    if action not in rules:
        raise WorkflowError("GOV_WORKFLOW_INVALID_TRANSITION", f"Cannot {action} from {status}", 400)
    next_status, required_role = rules[action]
    if actor_role != required_role:
        raise WorkflowError("GOV_WORKFLOW_FORBIDDEN_ROLE", f"Role {actor_role} cannot {action}", 403)
    body["status"] = next_status
    body.setdefault("history", []).append({"action": action, "from": status, "to": next_status, "role": actor_role})
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="workflow_instance",
            schema_version="1.0",
            ref_type="workflow",
            ref_id=instance_id,
            payload=body,
        ),
    )
    return WorkflowInstanceOut(
        id=instance_id,
        templateId=body["templateId"],
        refId=uuid.UUID(body["refId"]),
        status=next_status,
        allowedActions=_allowed_actions(next_status),
    )
```

`backend/app/governance/workflow/__init__.py` 导出 `service` 与 schemas。

`backend/app/api/v1/gov.py` 追加：

```python
from app.governance.workflow.errors import WorkflowError
from app.governance.workflow import service as workflow_service
from app.governance.workflow.schemas import (
    WorkflowInstanceCreateIn,
    WorkflowInstanceOut,
    WorkflowTemplateListOut,
    WorkflowTemplateOut,
    WorkflowTemplateValidateIn,
    WorkflowTransitionIn,
)


def _workflow_error(exc: WorkflowError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("/workflow/templates", response_model=WorkflowTemplateListOut)
def list_workflow_templates(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> WorkflowTemplateListOut:
    return WorkflowTemplateListOut(items=workflow_service.list_templates())


@router.post("/workflow/templates/validate", response_model=WorkflowTemplateOut)
def validate_workflow_template(
    payload: WorkflowTemplateValidateIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> WorkflowTemplateOut | JSONResponse:
    try:
        return workflow_service.validate_template(payload)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.post("/workflow/instances", status_code=201, response_model=WorkflowInstanceOut)
def create_workflow_instance(
    payload: WorkflowInstanceCreateIn,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowInstanceOut | JSONResponse:
    try:
        return workflow_service.create_instance(db, payload)
    except WorkflowError as exc:
        return _workflow_error(exc)


@router.get("/workflow/instances/{instance_id}", response_model=WorkflowInstanceOut)
def get_workflow_instance(
    instance_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowInstanceOut | JSONResponse:
    try:
        return workflow_service.get_instance(db, instance_id)
    except Exception as exc:
        from app.query.config_store.schemas import ConfigError
        if isinstance(exc, ConfigError):
            return JSONResponse(status_code=404, content={"code": "GOV_WORKFLOW_INSTANCE_NOT_FOUND", "message": "Instance not found", "detail": None})
        raise


@router.post("/workflow/instances/{instance_id}/transition", response_model=WorkflowInstanceOut)
def transition_workflow_instance(
    instance_id: uuid.UUID,
    payload: WorkflowTransitionIn,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> WorkflowInstanceOut | JSONResponse:
    try:
        return workflow_service.transition_instance(db, instance_id, payload.action, payload.actor_role)
    except WorkflowError as exc:
        return _workflow_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "gov003" -v`
Expected: 5 passed（`test_gov003_create_instance_draft_r49` 无 assert 可计为 setup 或合并进 happy path）

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/workflow/ backend/app/api/v1/gov.py tests/test_design_conn_gov_query_r49.py
git commit -m "feat(governance): GOV-003 workflow template FSM REST skeleton"
```

---

### Task 6: QUERY-003 Native 双路径契约 + 路由守卫

**Files:**
- Create: `backend/app/query/native/__init__.py`
- Create: `backend/app/query/native/schemas.py`
- Create: `backend/app/query/native/guard.py`
- Modify: `backend/app/api/v1/query.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `export_type_catalog()` from `app.datasources.registry`
- Produces: `resolve_query_mode(connector_type: str) -> str`、`validate_native_spec(spec: NativeQuerySpec) -> tuple[NativeQuerySpec, str]`

- [ ] **Step 1: Write the failing test**

```python
def test_query003_routing_modes_r49(client):
    """T-QUERY-R49-003-01: opensearch→native，mysql→sql。"""
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    assert resp.status_code == 200
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes["opensearch"] == "native"
    assert modes["mysql"] == "sql"


def test_query003_native_validate_ok_r49(client):
    """T-QUERY-R49-003-02: opensearch + 合法 body 无 sql → 200。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={
            "connectorType": "opensearch",
            "body": {"query": {"match_all": {}}},
            "index": "logs",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["resolvedMode"] == "native"


def test_query003_sql_disguise_r49(client):
    """T-QUERY-R49-003-03: native + sql 字段 → 422 QUERY_NATIVE_SQL_DISGUISE。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={
            "connectorType": "opensearch",
            "body": {"query": {"match_all": {}}},
            "sql": "SELECT 1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_SQL_DISGUISE"


def test_query003_wrong_mode_mysql_body_r49(client):
    """T-QUERY-R49-003-04: mysql + body 无 sql → 422 QUERY_NATIVE_WRONG_MODE。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "mysql", "body": {"x": 1}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_WRONG_MODE"


def test_query003_empty_body_r49(client):
    """T-QUERY-R49-003-05: native + 空 body → 422 QUERY_NATIVE_EMPTY_BODY。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "opensearch", "body": {}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_EMPTY_BODY"


def test_query003_unsupported_connector_r49(client):
    """T-QUERY-R49-003-06: 未知 connectorType → 422 QUERY_NATIVE_UNSUPPORTED_CONNECTOR。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "not_a_connector", "body": {"q": 1}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_UNSUPPORTED_CONNECTOR"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "query003" -v`
Expected: FAIL — 404 on `/query/routing/modes`

- [ ] **Step 3: Write minimal implementation**

`backend/app/query/native/schemas.py`：

```python
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class NativeQuerySpec(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    connector_type: str = Field(alias="connectorType")
    body: dict[str, Any] = Field(default_factory=dict)
    index: str | None = None
    sql: str | None = None

    @model_validator(mode="after")
    def reject_sql_field(self) -> NativeQuerySpec:
        if self.sql is not None:
            raise ValueError("sql field is not allowed in native mode")
        return self


class NativeValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    connector_type: str = Field(alias="connectorType")
    body: dict[str, Any]
    index: str | None = None
    resolved_mode: str = Field(alias="resolvedMode")


class RoutingModeItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    connector_type: str = Field(alias="connectorType")
    mode: str


class RoutingModesOut(BaseModel):
    modes: list[RoutingModeItem]
```

`backend/app/query/native/guard.py`：

```python
from __future__ import annotations

from app.datasources.registry import export_type_catalog
from app.query.native.schemas import NativeQuerySpec, NativeValidateOut, RoutingModeItem, RoutingModesOut
from app.query.schemas import QueryError

NATIVE_CATEGORIES = frozenset({"search", "document", "timeseries"})


def _catalog_by_type() -> dict[str, str]:
    return {item["type"]: item["category"] for item in export_type_catalog()}


def resolve_query_mode(connector_type: str) -> str:
    category = _catalog_by_type().get(connector_type)
    if category is None:
        raise QueryError("QUERY_NATIVE_UNSUPPORTED_CONNECTOR", f"Unknown connector: {connector_type}", 422)
    return "native" if category in NATIVE_CATEGORIES else "sql"


def list_routing_modes() -> RoutingModesOut:
    modes = [
        RoutingModeItem(connectorType=item["type"], mode=("native" if item["category"] in NATIVE_CATEGORIES else "sql"))
        for item in export_type_catalog()
    ]
    return RoutingModesOut(modes=sorted(modes, key=lambda m: m.connector_type))


def validate_native_spec(spec: NativeQuerySpec) -> NativeValidateOut:
    mode = resolve_query_mode(spec.connector_type)
    if mode != "native":
        raise QueryError("QUERY_NATIVE_WRONG_MODE", f"{spec.connector_type} requires sql mode", 422)
    if not spec.body:
        raise QueryError("QUERY_NATIVE_EMPTY_BODY", "Native query body must not be empty", 422)
    if not isinstance(spec.body, dict):
        raise QueryError("QUERY_NATIVE_INVALID_BODY", "body must be a JSON object", 422)
    return NativeValidateOut(
        connectorType=spec.connector_type,
        body=spec.body,
        index=spec.index,
        resolvedMode=mode,
    )
```

`backend/app/query/native/__init__.py` 导出 guard 函数。

`backend/app/api/v1/query.py` 追加：

```python
from pydantic import ValidationError
from app.query.native.guard import list_routing_modes, validate_native_spec
from app.query.native.schemas import NativeQuerySpec, NativeValidateOut, RoutingModesOut


@router.get("/routing/modes", response_model=RoutingModesOut)
def get_routing_modes(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> RoutingModesOut:
    return list_routing_modes()


@router.post("/native/validate", response_model=NativeValidateOut)
def validate_native_query(
    payload: NativeQuerySpec,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> NativeValidateOut | JSONResponse:
    try:
        return validate_native_spec(payload)
    except ValidationError:
        return JSONResponse(
            status_code=422,
            content={"code": "QUERY_NATIVE_SQL_DISGUISE", "message": "sql field is not allowed in native mode", "detail": None},
        )
    except QueryError as exc:
        return _error_response(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -k "query003" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/native/ backend/app/api/v1/query.py tests/test_design_conn_gov_query_r49.py
git commit -m "feat(query): QUERY-003 native routing guard and validate API"
```

---

### Task 7: 联动断言 + 回归门控

**Files:**
- Modify: `tests/test_design_conn_gov_query_r49.py`（追加联动 + 计数校验）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

- [ ] **Step 1: Write linkage tests**

```python
def test_r49_link_same_ref_three_designer_configs_r49(client):
    """T-R49-LINK-01: 同 ref 读取 conditions + output-fields + sql-mode（复用 design003 用例逻辑）。"""
    ref = _ref_id()
    assert client.put(
        "/api/v1/designer/compute-rules",
        headers=AUTH,
        json={
            "rules": [
                {
                    "id": "r1",
                    "name": "sum",
                    "ruleType": "sum",
                    "targetField": "amount",
                    "expression": "sum(order_amount)",
                    "dependsOn": [],
                }
            ],
            **_designer_ref_payload(ref),
        },
    ).status_code == 200
    test_design003_coexist_with_sql_mode_r49(client)  # 或直接内联断言四类 GET 200


def test_r49_link_health_r49(client):
    """T-R49-LINK-02: /health 200。"""
    assert client.get("/health").status_code == 200


def test_r49_suite_has_minimum_tests():
    """T-R49-META-01: r49 套件 ≥35 条测试函数。"""
    import inspect
    import tests.test_design_conn_gov_query_r49 as mod

    count = len([n for n, o in inspect.getmembers(mod) if n.startswith("test_") and callable(o)])
    assert count >= 35
```

注：若 `test_r49_suite_has_minimum_tests` 在 Task 7 前未达 35，将 `test_gov003_create_instance_draft_r49` 保留为独立断言函数（不 `return`），并在 Task 2–6 已计 30+ 条。

- [ ] **Step 2: Run full r49 suite**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -v --collect-only | tail -5`
Expected: ≥35 tests collected；全绿：

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -v`
Expected: **35/35 passed**

- [ ] **Step 3: Run regression gate**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_design_conn_gov_query_r49.py \
  ../tests/test_meta_design_r32.py \
  ../tests/test_meta_design_r33.py \
  ../tests/test_nfr_gov_conn_r46.py \
  -q
```
Expected: ruff exit 0；r49 **35/35** + r32 **21/21** + r33 **19/19** + r46 **36/36**

- [ ] **Step 4: Commit**

```bash
git add tests/test_design_conn_gov_query_r49.py
git commit -m "test(r49): linkage assertions and regression gate"
```

---

### Task 8: 文档同步（prd-sync）

**Files:**
- Modify: `docs/api/README.md`
- Modify or create: `docs/services/designer.md`（若不存在则新建简短域附录）
- Modify: `docs/services/datasources.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/services/query.md`
- Modify: `docs/services/README.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（文档同步评估）

**UI skill:** none

- [ ] **Step 1: 登记 API 路由**

`docs/api/README.md` 追加行（状态=已实现）：

| Method | Path | 域 | PRD | 说明 |
|--------|------|-----|-----|------|
| POST | `/api/v1/designer/sql-mode/validate` | designer | DESIGN-005 | SQL 只读校验 |
| GET | `/api/v1/designer/sql-mode/capabilities` | designer | DESIGN-005 | SQL 模式能力 |
| PUT/GET | `/api/v1/designer/sql-mode` | designer | DESIGN-005 | SQL 模式持久化 |
| POST | `/api/v1/designer/output-fields/validate` | designer | DESIGN-003 | 输出字段校验 |
| PUT/GET | `/api/v1/designer/output-fields` | designer | DESIGN-003 | 输出字段持久化 |
| GET | `/api/v1/gov/workflow/templates` | governance | GOV-003 | 工单模板列表 |
| POST | `/api/v1/gov/workflow/templates/validate` | governance | GOV-003 | 模板校验 |
| POST/GET | `/api/v1/gov/workflow/instances` | governance | GOV-003 | 实例创建/读取 |
| POST | `/api/v1/gov/workflow/instances/{id}/transition` | governance | GOV-003 | 状态迁移 |
| GET | `/api/v1/query/routing/modes` | query | QUERY-003 | 连接器路由模式 |
| POST | `/api/v1/query/native/validate` | query | QUERY-003 | Native 查询守卫 |

- [ ] **Step 2: 更新域附录**

- `docs/services/datasources.md`：In 增 OpenSearch `opensearch` type；登记路径 `register_connector_plugin`
- `docs/services/governance.md`：In 增 `workflow/` 五态 FSM；Out 明确不调用 `publish_service` 串联
- `docs/services/query.md`：In 增 `native/guard` 路由探测；Out 不含 native 执行器
- `docs/services/designer.md` 或等价：DESIGN-003/005 契约说明
- `docs/services/README.md`：更新实现状态行

- [ ] **Step 3: Verify docs only**

Run: `cd backend && python3 -m ruff check .`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/
git commit -m "docs(r49): register designer/gov/query/opensearch L1 APIs and services"
```

---

## Spec Self-Review（P2 自检）

| 检查项 | 结果 |
|--------|------|
| DESIGN-005/003/CONN-016/GOV-003/QUERY-003 各有 Task | Task 2–6 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 有验证命令 | 通过 |
| 全 Task UI skill none | 通过 |
| 预估 P3 文件 ≤20 | 19 生产 + 1 测试 |
| config_store 扩展已纳入 | Task 1 |
| 回归门控 r32/r33/r46 | Task 7 |

**执行模式（固定）：** subagent-driven-development option 1 — P3 按 Task 1→8 顺序派发 subagent，Task 间跑 r49 子集 + 最终 Task 7 全量回归。
