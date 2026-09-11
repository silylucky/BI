# M12 Query 翻译器 + M11 信创/专项连接器 + META 维度 L1 kickoff r38 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/query/translator/`、`backend/app/api/v1/query.py`、`backend/app/datasources/dialects/gaussdb.py`、`dm.py`、`trino.py`、`errors.py`、`dialects/__init__.py`、`backend/app/datasources/__init__.py`、`backend/pyproject.toml`、`backend/app/metadata/dimensions/`、`backend/app/api/v1/metadata.py`、`backend/migrations/versions/0016_dimension_dict.py`、`tests/test_query_meta_conn_r38.py`、`docs/services/datasources.md`、`docs/services/metadata.md`、`docs/api/README.md`
> **子项：** QUERY-008, CONN-022, META-003, CONN-017, CONN-010
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** M12/M11 L1 kickoff — 交付配置→SQL 翻译器骨架（`POST /api/v1/query/translate`）、GaussDB/达梦/Trino 三方言 registry + mock 测试、维度字典双表 CRUD/注册 API；`test_query_meta_conn_r38.py` ≥33 条 + r37 `test_connectors_gov_r37.py` 40/40 回归全绿；五 ID 加权总分 L1 ≥86。

**Architecture:** QUERY-008 薄翻译层复用 `get_sql_dialect()` + `DESIGNER_FIELD_REGISTRY` 字段白名单，条件值写入 `parameters` dict 防注入；三连接器镜像 r36 L1 插件模式（GaussDB 委托 `PostgresConnector`、DM 对齐 Oracle 自省、Trino catalog/schema 三级）；META-003 镜像 glossary CRUD + migration 0016；独立 SQLite fixture `query_meta_conn_r38`。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · psycopg 3 · dmPython · trino-python-client · pytest · ruff · Alembic

## Global Constraints

- 纯后端 L1 kickoff；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不触及 `fe/`
- `docs/automate/prd/F04-CONN.md`、`F05-QUERY.md`、`F11-META.md` **P5 对账**（非 P3）
- 翻译 L1 支持方言：`mysql`/`postgresql`/`clickhouse`；L1 算子：`eq,ne,gt,gte,lt,lte,in,like,is_null,is_not_null`
- 连接器 `test_connection` 失败：**HTTP 200** + `ok=false` + `{PREFIX}_*` `code`（与 DS-003 一致）
- 文件预算：新建 **12** + 修改 **7** = **19**（含 3 docs）
- 验证基线：r37 后 **854 passed** + 4 skipped；本轮目标 **≥884 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_query_meta_conn_r38.py tests/test_connectors_gov_r37.py -v`

---

### Task 1: 基础设施 — `connectors-ext` 扩展 + r38 测试脚手架

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `tests/test_query_meta_conn_r38.py`（module fixture + `test_r38_scaffold`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/writing-plans/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；本轮不触及 `fe/` 或壳层组件

**Interfaces:**
- Consumes: r32 `test_meta_design_r32.py` fixture 模式；r37 `test_connectors_gov_r37.py` 回归套件路径
- Produces: `connectors-ext` 增 `dmPython`/`trino`；`_R38_SQLITE_URL` fixture；`client` fixture

- [ ] **Step 1: 修改 pyproject.toml 增 dmPython + trino**

在 `backend/pyproject.toml` 的 `[project.optional-dependencies] connectors-ext` 列表末尾追加：

```toml
connectors-ext = [
    "pyhive>=0.7.0",
    "pymssql>=2.3.0",
    "oracledb>=2.5.0",
    "clickhouse-connect>=0.7.0",
    "dmPython>=2.5.0",
    "trino>=0.330.0",
]
```

- [ ] **Step 2: 创建 test_query_meta_conn_r38.py 脚手架**

```python
"""M12 Query 翻译器 + M11 信创/专项连接器 + META 维度 L1 kickoff r38."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R38_SQLITE_URL = "sqlite+pysqlite:///file:query_meta_conn_r38?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r38_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R38_SQLITE_URL
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


def test_r38_scaffold(client):
    """T-R38-000-01: fixture 可用，/health 200。"""
    assert client.get("/health").status_code == 200
```

- [ ] **Step 3: 运行脚手架测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r38.py::test_r38_scaffold -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml tests/test_query_meta_conn_r38.py
git commit -m "chore(r38): connectors-ext dmPython/trino + test scaffold"
```

---

### Task 2: QUERY-008 — 翻译器 schemas + service + 7 条单元测试

**Files:**
- Create: `backend/app/query/translator/schemas.py`
- Create: `backend/app/query/translator/service.py`
- Modify: `tests/test_query_meta_conn_r38.py`（追加 QUERY-008 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端翻译器；无 UI 变更

**Interfaces:**
- Consumes: `app.query.dialects.get_sql_dialect`、`app.designer.schemas.DESIGNER_FIELD_REGISTRY`、`app.query.rls.guard.validate_identifier`、`get_settings().query_default_limit`
- Produces: `TranslateRequest`、`TranslateResponse`、`TranslateError`、`translate_config_to_sql(request) -> TranslateResponse`

- [ ] **Step 1: 创建 translator/schemas.py**

```python
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import get_settings

L1_OPERATORS = frozenset({
    "eq", "ne", "gt", "gte", "lt", "lte", "in", "like", "is_null", "is_not_null",
})
ALLOWED_LOGIC = frozenset({"AND", "OR"})


class TranslateError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 422,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class TranslateConditionItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field_id: str = Field(alias="fieldId", min_length=1)
    operator: str
    value: object | None = None
    value_type: str = Field(default="string", alias="valueType")


class TranslateConditions(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    logic: str
    conditions: list[TranslateConditionItem]


class TranslateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    connector_type: str = Field(alias="connectorType")
    schema_name: str = Field(alias="schema")
    table: str
    columns: list[str] = Field(min_length=1)
    conditions: TranslateConditions | None = None
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)

    @field_validator("columns")
    @classmethod
    def reject_star(cls, cols: list[str]) -> list[str]:
        if any(c.strip() == "*" for c in cols):
            raise ValueError("wildcard * is not allowed in L1")
        return cols


class TranslateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sql: str
    parameters: dict[str, object]
    connector_type: str = Field(alias="connectorType")
```

- [ ] **Step 2: 创建 translator/service.py**

```python
from __future__ import annotations

from app.core.config import get_settings
from app.designer.schemas import DESIGNER_FIELD_REGISTRY
from app.query.dialects import UnsupportedDialectError, get_sql_dialect
from app.query.rls.guard import validate_identifier
from app.query.translator.schemas import (
    ALLOWED_LOGIC,
    L1_OPERATORS,
    TranslateConditionItem,
    TranslateConditions,
    TranslateError,
    TranslateRequest,
    TranslateResponse,
)


def _param_name(index: int) -> str:
    return f"p{index}"


def _placeholder(connector_type: str, name: str, value_type: str) -> str:
    if connector_type == "clickhouse":
        ch_type = "Int64" if value_type == "number" else "String"
        return f"{{{name}:{ch_type}}}"
    return f"%({name})s"


def _validate_identifiers(schema: str, table: str, columns: list[str]) -> None:
    try:
        validate_identifier(schema)
        validate_identifier(table)
        for col in columns:
            validate_identifier(col)
    except Exception as exc:
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_IDENTIFIER",
            str(exc),
            422,
        ) from exc


def _validate_conditions(conditions: TranslateConditions | None) -> None:
    if conditions is None:
        return
    if conditions.logic not in ALLOWED_LOGIC:
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            f"logic must be one of {sorted(ALLOWED_LOGIC)}",
            422,
        )
    unknown: list[dict[str, str]] = []
    for item in conditions.conditions:
        if item.field_id not in DESIGNER_FIELD_REGISTRY:
            unknown.append({"field": "fieldId", "message": f"unknown field: {item.field_id}"})
        if item.operator not in L1_OPERATORS:
            raise TranslateError(
                "QUERY_TRANSLATE_INVALID_OPERATOR",
                f"unsupported operator: {item.operator}",
                422,
            )
    if unknown:
        raise TranslateError(
            "QUERY_TRANSLATE_UNKNOWN_FIELD",
            "Unknown condition field(s)",
            422,
            fields=unknown,
        )


def _condition_sql(
    item: TranslateConditionItem,
    *,
    connector_type: str,
    dialect,
    param_index: int,
    parameters: dict[str, object],
) -> tuple[str, int]:
    col = dialect.quote_identifier(item.field_id)
    op = item.operator
    if op in ("is_null", "is_not_null"):
        suffix = "IS NULL" if op == "is_null" else "IS NOT NULL"
        return f"{col} {suffix}", param_index
    pname = _param_name(param_index)
    placeholder = _placeholder(connector_type, pname, item.value_type)
    parameters[pname] = item.value
    param_index += 1
    if op == "eq":
        return f"{col} = {placeholder}", param_index
    if op == "ne":
        return f"{col} <> {placeholder}", param_index
    if op == "gt":
        return f"{col} > {placeholder}", param_index
    if op == "gte":
        return f"{col} >= {placeholder}", param_index
    if op == "lt":
        return f"{col} < {placeholder}", param_index
    if op == "lte":
        return f"{col} <= {placeholder}", param_index
    if op == "like":
        return f"{col} LIKE {placeholder}", param_index
    if op == "in":
        if not isinstance(item.value, list):
            raise TranslateError("QUERY_TRANSLATE_INVALID_CONFIG", "in operator requires array value", 422)
        placeholders = []
        for val in item.value:
            pname = _param_name(param_index)
            placeholders.append(_placeholder(connector_type, pname, item.value_type))
            parameters[pname] = val
            param_index += 1
        return f"{col} IN ({', '.join(placeholders)})", param_index
    raise TranslateError("QUERY_TRANSLATE_INVALID_OPERATOR", f"unsupported operator: {op}", 422)


def translate_config_to_sql(request: TranslateRequest) -> TranslateResponse:
    try:
        dialect = get_sql_dialect(request.connector_type)
    except UnsupportedDialectError as exc:
        raise TranslateError(
            "QUERY_TRANSLATE_UNSUPPORTED_DIALECT",
            f"Unsupported connector type: {exc.connector_type}",
            422,
        ) from exc

    if not request.columns:
        raise TranslateError("QUERY_TRANSLATE_INVALID_CONFIG", "columns must not be empty", 422)

    settings = get_settings()
    limit = request.limit if request.limit is not None else settings.query_default_limit
    if limit > settings.query_default_limit:
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            f"limit must be <= {settings.query_default_limit}",
            422,
        )

    _validate_identifiers(request.schema_name, request.table, request.columns)
    _validate_conditions(request.conditions)

    quoted_cols = ", ".join(dialect.quote_identifier(c) for c in request.columns)
    qualified = dialect.qualify_table(request.schema_name, request.table)
    sql = f"SELECT {quoted_cols} FROM {qualified}"
    parameters: dict[str, object] = {}

    if request.conditions and request.conditions.conditions:
        idx = 0
        parts: list[str] = []
        for cond in request.conditions.conditions:
            fragment, idx = _condition_sql(
                cond,
                connector_type=request.connector_type,
                dialect=dialect,
                param_index=idx,
                parameters=parameters,
            )
            parts.append(fragment)
        joiner = f" {request.conditions.logic} "
        sql = f"{sql} WHERE {joiner.join(parts)}"

    sql = dialect.wrap_limit(sql, limit=limit, offset=request.offset)
    return TranslateResponse(
        sql=sql,
        parameters=parameters,
        connector_type=request.connector_type,
    )
```

- [ ] **Step 3: 追加 QUERY-008 单元测试（直接调 service + HTTP 占位）**

在 `tests/test_query_meta_conn_r38.py` 追加：

```python
from app.query.dialects import get_sql_dialect
from app.query.translator.schemas import TranslateConditions, TranslateConditionItem, TranslateRequest
from app.query.translator import service as translator_service
from app.query.translator.schemas import TranslateError


def test_query_translate_postgresql_r38():
    """T-QUERY-R38-008-01: postgresql 合法 config → sql 含 SELECT + quoted 表；有条件时 parameters 非空。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="orders",
        columns=["order_amount", "status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="eq", value="open", valueType="string"),
            ],
        ),
        limit=100,
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "SELECT" in resp.sql
    assert '"public"' in resp.sql or "public" in resp.sql
    assert resp.parameters


def test_query_translate_mysql_eq_r38():
    """T-QUERY-R38-008-02: mysql + eq 条件 → WHERE + 占位符；无字面量注入。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="sales",
        table="orders",
        columns=["order_amount"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="order_amount", operator="eq", value=99, valueType="number"),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "WHERE" in resp.sql
    assert "%(p0)s" in resp.sql
    assert "99" not in resp.sql
    assert resp.parameters["p0"] == 99


def test_query_translate_clickhouse_limit_r38():
    """T-QUERY-R38-008-03: clickhouse + limit → SQL 含 LIMIT。"""
    req = TranslateRequest(
        connectorType="clickhouse",
        schema="default",
        table="events",
        columns=["customer_id"],
        limit=50,
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "LIMIT 50" in resp.sql


def test_query_translate_unsupported_dialect_r38():
    """T-QUERY-R38-008-04: 未知 connectorType → QUERY_TRANSLATE_UNSUPPORTED_DIALECT。"""
    req = TranslateRequest(
        connectorType="hive",
        schema="db",
        table="t",
        columns=["x"],
    )
    try:
        translator_service.translate_config_to_sql(req)
        assert False, "expected TranslateError"
    except TranslateError as exc:
        assert exc.code == "QUERY_TRANSLATE_UNSUPPORTED_DIALECT"


def test_query_translate_unknown_field_r38():
    """T-QUERY-R38-008-05: 未知 fieldId → QUERY_TRANSLATE_UNKNOWN_FIELD + fields。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="not_in_registry", operator="eq", value="x", valueType="string"),
            ],
        ),
    )
    try:
        translator_service.translate_config_to_sql(req)
        assert False, "expected TranslateError"
    except TranslateError as exc:
        assert exc.code == "QUERY_TRANSLATE_UNKNOWN_FIELD"
        assert exc.fields


def test_query_translate_empty_columns_r38():
    """T-QUERY-R38-008-06: 空 columns → 422 QUERY_TRANSLATE_INVALID_CONFIG。"""
    try:
        TranslateRequest(
            connectorType="postgresql",
            schema="public",
            table="t",
            columns=[],
        )
        assert False, "expected validation error"
    except Exception:
        pass
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
    )
    req.columns = []
    try:
        translator_service.translate_config_to_sql(req)
        assert False, "expected TranslateError"
    except TranslateError as exc:
        assert exc.code == "QUERY_TRANSLATE_INVALID_CONFIG"


def test_query_sql_dialect_registry_smoke_r38():
    """T-QUERY-R38-008-07: get_sql_dialect 三 type smoke。"""
    for t in ("mysql", "postgresql", "clickhouse"):
        d = get_sql_dialect(t)
        assert d.connector_type == t
```

- [ ] **Step 4: 运行 QUERY-008 测试**

Run: `cd backend && python3 -m ruff check app/query/translator/ && python3 -m pytest tests/test_query_meta_conn_r38.py -k "query_translate or query_sql_dialect" -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/translator/ tests/test_query_meta_conn_r38.py
git commit -m "feat(r38): QUERY-008 config-to-SQL translator L1"
```

---

### Task 3: QUERY-008 — POST /translate API 路由 + HTTP 测试

**Files:**
- Modify: `backend/app/api/v1/query.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端 API；无 UI 变更

**Interfaces:**
- Consumes: `translate_config_to_sql`、`TranslateError`、`TranslateRequest`、`TranslateResponse`
- Produces: `POST /api/v1/query/translate` 路由；`_translate_error(exc) -> JSONResponse`

- [ ] **Step 1: 扩展 query.py — import + error handler + route**

在 `backend/app/api/v1/query.py` 顶部 import 区追加：

```python
from app.query.translator.schemas import TranslateError, TranslateRequest, TranslateResponse
from app.query.translator import service as translator_service
```

在 `_error_response` 后追加：

```python
def _translate_error(exc: TranslateError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )
```

在 `router` 定义后、`/execute` 之前或之后追加：

```python
@router.post(
    "/translate",
    response_model=TranslateResponse,
    summary="Translate visual query config to parameterized SQL (QUERY-008)",
    responses={
        422: {"description": "QUERY_TRANSLATE_* — invalid config, unknown field, unsupported dialect"},
    },
)
def translate_query(
    payload: TranslateRequest,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> TranslateResponse | JSONResponse:
    try:
        return translator_service.translate_config_to_sql(payload)
    except TranslateError as exc:
        return _translate_error(exc)
```

- [ ] **Step 2: 追加 HTTP 集成 smoke（复用已有 7 条中的 2 条经 API）**

在 `tests/test_query_meta_conn_r38.py` 追加：

```python
def test_query_translate_http_postgresql_r38(client):
    """T-QUERY-R38-008-08: POST /translate postgresql → 200 + sql。"""
    payload = {
        "connectorType": "postgresql",
        "schema": "public",
        "table": "orders",
        "columns": ["order_amount"],
        "conditions": {
            "logic": "AND",
            "conditions": [
                {"fieldId": "status", "operator": "eq", "value": "open", "valueType": "string"},
            ],
        },
        "limit": 10,
    }
    resp = client.post("/api/v1/query/translate", headers=AUTH, json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "sql" in body
    assert body["connectorType"] == "postgresql"


def test_query_translate_http_unknown_field_r38(client):
    """T-QUERY-R38-008-09: POST /translate 未知字段 → 422 + code。"""
    payload = {
        "connectorType": "mysql",
        "schema": "db",
        "table": "t",
        "columns": ["status"],
        "conditions": {
            "logic": "AND",
            "conditions": [
                {"fieldId": "bogus_field", "operator": "eq", "value": "x", "valueType": "string"},
            ],
        },
    }
    resp = client.post("/api/v1/query/translate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_UNKNOWN_FIELD"
```

- [ ] **Step 3: 运行 API 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r38.py -k "translate" -v`
Expected: ≥9 passed（7 单元 + 2 HTTP）

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/query.py tests/test_query_meta_conn_r38.py
git commit -m "feat(r38): POST /api/v1/query/translate endpoint"
```

---

### Task 4: CONN-022 — GaussDB 方言 + `map_gaussdb_error` + 7 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `backend/app/datasources/dialects/gaussdb.py`
- Modify: `tests/test_query_meta_conn_r38.py`（追加 CONN-022 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `PostgresConnector`、`map_postgres_operational_error`、`PG_*` 常量
- Produces: `GaussdbConnector`；`map_gaussdb_error`；`GAUSSDB_*` 常量

- [ ] **Step 1: errors.py 追加 GaussDB 段**

在 `backend/app/datasources/dialects/errors.py` 末尾追加：

```python
# GaussDB (PostgreSQL-compatible alias)
GAUSSDB_CONN_REFUSED = "GAUSSDB_CONN_REFUSED"
GAUSSDB_AUTH_FAILED = "GAUSSDB_AUTH_FAILED"
GAUSSDB_TIMEOUT = "GAUSSDB_TIMEOUT"
GAUSSDB_UNKNOWN_DATABASE = "GAUSSDB_UNKNOWN_DATABASE"
GAUSSDB_UNKNOWN = "GAUSSDB_UNKNOWN"

_GAUSSDB_FROM_PG = {
    PG_CONN_REFUSED: GAUSSDB_CONN_REFUSED,
    PG_AUTH_FAILED: GAUSSDB_AUTH_FAILED,
    PG_TIMEOUT: GAUSSDB_TIMEOUT,
    PG_UNKNOWN_DATABASE: GAUSSDB_UNKNOWN_DATABASE,
    PG_SSL_ERROR: GAUSSDB_UNKNOWN,
    PG_UNKNOWN: GAUSSDB_UNKNOWN,
}


def map_gaussdb_error(exc: Exception) -> tuple[str, str]:
    if hasattr(exc, "sqlstate") or "OperationalError" in type(exc).__name__:
        pg_code, detail = map_postgres_operational_error(exc)
        return _GAUSSDB_FROM_PG.get(pg_code, GAUSSDB_UNKNOWN), detail
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered:
        return GAUSSDB_AUTH_FAILED, detail
    if "timeout" in lowered:
        return GAUSSDB_TIMEOUT, detail
    if "refused" in lowered:
        return GAUSSDB_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return GAUSSDB_UNKNOWN_DATABASE, detail
    return GAUSSDB_UNKNOWN, detail
```

- [ ] **Step 2: 创建 gaussdb.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_gaussdb_error
from app.datasources.dialects.postgres import PostgresConnector


class GaussdbConnector:
    type = "gaussdb"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "GaussDB"

    def __init__(self) -> None:
        self._delegate = PostgresConnector()

    def open_connection(self, **kwargs: Any) -> Any:
        return self._delegate.open_connection(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self.open_connection(**kwargs)
            try:
                conn.execute("SELECT 1")
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_gaussdb_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        schemas = self._delegate.list_schemas(connection)
        return schemas or []

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        return self._delegate.list_tables(connection, schema) or []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        return self._delegate.list_columns(connection, schema, table)
```

- [ ] **Step 3: 追加 CONN-022 测试（mock psycopg）**

```python
from unittest.mock import MagicMock, patch

from app.datasources.dialects.gaussdb import GaussdbConnector
from app.datasources.registry import export_type_catalog


def test_conn_gaussdb_catalog_r38():
    """T-CONN-R38-022-01: types catalog 含 gaussdb，category=relational。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert "gaussdb" in types
    assert types["gaussdb"]["category"] == "relational"


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_success_r38(mock_open):
    """T-CONN-R38-022-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    mock_open.return_value = conn
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="db", username="u", password="p",
    )
    assert result.ok is True
    conn.close.assert_called_once()


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_auth_failed_r38(mock_open):
    """T-CONN-R38-022-03: mock 认证失败 → GAUSSDB_AUTH_FAILED。"""
    import psycopg

    exc = psycopg.OperationalError("password authentication failed")
    exc.sqlstate = "28P01"
    mock_open.side_effect = exc
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="db", username="u", password="bad",
    )
    assert result.ok is False
    assert result.code == "GAUSSDB_AUTH_FAILED"


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_conn_refused_r38(mock_open):
    """T-CONN-R38-022-04: mock 连接拒绝 → GAUSSDB_CONN_REFUSED。"""
    mock_open.side_effect = ConnectionRefusedError("refused")
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="db", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "GAUSSDB_CONN_REFUSED"


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_unknown_database_r38(mock_open):
    """T-CONN-R38-022-05: mock 未知库 → GAUSSDB_UNKNOWN_DATABASE。"""
    import psycopg

    exc = psycopg.OperationalError("database does not exist")
    exc.sqlstate = "3D000"
    mock_open.side_effect = exc
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="missing", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "GAUSSDB_UNKNOWN_DATABASE"


def test_conn_gaussdb_empty_schemas_r38():
    """T-CONN-R38-022-06: mock 空 schema 列表 → []。"""
    conn = MagicMock()
    with patch.object(GaussdbConnector, "_delegate") as mock_delegate:
        mock_delegate.list_schemas.return_value = []
        assert GaussdbConnector().list_schemas(conn) == []


def test_conn_gaussdb_unknown_schema_tables_r38():
    """T-CONN-R38-022-07: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    with patch.object(GaussdbConnector, "_delegate") as mock_delegate:
        mock_delegate.list_tables.return_value = []
        assert GaussdbConnector().list_tables(conn, "unknown_schema") == []
```

- [ ] **Step 4: 运行 GaussDB 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r38.py -k "gaussdb" -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/gaussdb.py tests/test_query_meta_conn_r38.py
git commit -m "feat(r38): CONN-022 GaussDB connector L1"
```

---

### Task 5: CONN-017 — 达梦 DM 方言 + `map_dm_error` + 6 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `backend/app/datasources/dialects/dm.py`
- Modify: `tests/test_query_meta_conn_r38.py`（追加 CONN-017 段 6 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `oracle.py` 自省 SQL 模式；`map_dm_error`
- Produces: `DmConnector`；`DM_*` 常量；`DM_MAX_COLUMNS=500`

- [ ] **Step 1: errors.py 追加 DM 段**

```python
# DM (Dameng)
DM_CONN_REFUSED = "DM_CONN_REFUSED"
DM_AUTH_FAILED = "DM_AUTH_FAILED"
DM_TIMEOUT = "DM_TIMEOUT"
DM_UNKNOWN_DATABASE = "DM_UNKNOWN_DATABASE"
DM_UNKNOWN = "DM_UNKNOWN"
DM_DRIVER_MISSING = "DM_DRIVER_MISSING"


def map_dm_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "dmpython" in lowered or "no module named" in lowered and "dm" in lowered:
        return DM_DRIVER_MISSING, detail
    if "password" in lowered or "login" in lowered or "-2501" in detail:
        return DM_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return DM_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return DM_CONN_REFUSED, detail
    if "database" in lowered and ("unknown" in lowered or "not exist" in lowered):
        return DM_UNKNOWN_DATABASE, detail
    return DM_UNKNOWN, detail
```

- [ ] **Step 2: 创建 dm.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import DM_DRIVER_MISSING, map_dm_error

DM_MAX_COLUMNS = 500
_SYSTEM_OWNERS = frozenset({"SYS", "SYSDBA"})


class DmConnector:
    type = "dm"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "达梦 DM"

    def _connect(self, **kwargs: Any) -> Any:
        try:
            import dmPython
        except ImportError as exc:
            raise ImportError("dmPython driver not installed") from exc
        return dmPython.connect(
            user=kwargs["username"],
            password=kwargs["password"],
            server=kwargs["host"],
            port=kwargs.get("port", 5236),
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self._connect(**kwargs)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT 1 FROM DUAL")
            finally:
                connection.close()
        except ImportError:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{DM_DRIVER_MISSING}] dmPython driver not installed",
                latency_ms=latency_ms,
                code=DM_DRIVER_MISSING,
            )
        except Exception as exc:
            code, detail = map_dm_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT DISTINCT OWNER FROM ALL_TABLES
            WHERE OWNER NOT IN ('SYS','SYSDBA')
            ORDER BY 1
            """
        )
        return [
            SchemaInfo(name=row[0])
            for row in cursor.fetchall()
            if row and row[0] not in _SYSTEM_OWNERS
        ]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            "SELECT TABLE_NAME, 'TABLE' FROM ALL_TABLES WHERE OWNER = ? ORDER BY 1",
            (schema.upper(),),
        )
        rows = cursor.fetchall()
        return [TableInfo(name=row[0], type=row[1]) for row in rows if row] if rows else []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COLUMN_NAME, DATA_TYPE, NULLABLE
            FROM ALL_TAB_COLUMNS
            WHERE OWNER = ? AND TABLE_NAME = ?
            ORDER BY COLUMN_ID
            """,
            (schema.upper(), table.upper()),
        )
        columns = [
            ColumnInfo(name=row[0], data_type=row[1], nullable=str(row[2]) == "Y")
            for row in cursor.fetchall()
            if row
        ]
        return columns[:DM_MAX_COLUMNS] if len(columns) > DM_MAX_COLUMNS else columns
```

- [ ] **Step 3: 追加 CONN-017 测试（mock dmPython.connect）**

```python
from app.datasources.dialects.dm import DmConnector


def test_conn_dm_catalog_r38():
    """T-CONN-R38-017-01: types catalog 含 dm（注册后断言，Task 6 注册后全绿）。"""
    from app.datasources.registry import export_type_catalog
    types = {t["type"]: t for t in export_type_catalog()}
    # 若尚未注册，先手动注册 smoke
    if "dm" not in types:
        from app.datasources.registry import register_dialect
        register_dialect(DmConnector())
        types = {t["type"]: t for t in export_type_catalog()}
    assert types["dm"]["category"] == "relational"


@patch("dmPython.connect")
def test_conn_dm_success_r38(mock_connect):
    """T-CONN-R38-017-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = DmConnector().test_connection(
        host="h", port=5236, database="db", username="u", password="p",
    )
    assert result.ok is True


@patch("dmPython.connect")
def test_conn_dm_auth_failed_r38(mock_connect):
    """T-CONN-R38-017-03: mock 凭证失败 → DM_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Login failed -2501")
    result = DmConnector().test_connection(
        host="h", port=5236, database="db", username="u", password="bad",
    )
    assert result.ok is False
    assert result.code == "DM_AUTH_FAILED"


@patch("dmPython.connect")
def test_conn_dm_conn_refused_r38(mock_connect):
    """T-CONN-R38-017-04: mock 不可达 → DM_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("refused")
    result = DmConnector().test_connection(
        host="h", port=5236, database="db", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "DM_CONN_REFUSED"


@patch("dmPython.connect")
def test_conn_dm_unknown_database_r38(mock_connect):
    """T-CONN-R38-017-05: mock 未知 database → DM_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = Exception("database not exist")
    result = DmConnector().test_connection(
        host="h", port=5236, database="missing", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "DM_UNKNOWN_DATABASE"


@patch("dmPython.connect")
def test_conn_dm_unknown_schema_tables_r38(mock_connect):
    """T-CONN-R38-017-06: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    assert DmConnector().list_tables(conn, "UNKNOWN") == []
```

- [ ] **Step 4: 运行 DM 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r38.py -k "conn_dm" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/dm.py tests/test_query_meta_conn_r38.py
git commit -m "feat(r38): CONN-017 Dameng DM connector L1"
```

---

### Task 6: CONN-010 — Trino 方言 + registry 三方言注册 + 6 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `backend/app/datasources/dialects/trino.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `tests/test_query_meta_conn_r38.py`（追加 CONN-010 段 6 条；修正 CONN-022 catalog 依赖注册）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器 + registry；无 UI 变更

**Interfaces:**
- Consumes: `map_trino_error`；`register_dialect`
- Produces: `TrinoConnector`；`register_builtin_dialects()` 含 gaussdb/dm/trino

- [ ] **Step 1: errors.py 追加 Trino 段**

```python
# Trino
TRINO_CONN_REFUSED = "TRINO_CONN_REFUSED"
TRINO_AUTH_FAILED = "TRINO_AUTH_FAILED"
TRINO_TIMEOUT = "TRINO_TIMEOUT"
TRINO_UNKNOWN_CATALOG = "TRINO_UNKNOWN_CATALOG"
TRINO_UNKNOWN = "TRINO_UNKNOWN"
TRINO_DRIVER_MISSING = "TRINO_DRIVER_MISSING"


def map_trino_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "no module named" in lowered and "trino" in lowered:
        return TRINO_DRIVER_MISSING, detail
    if "unauthorized" in lowered or "401" in detail or "access denied" in lowered:
        return TRINO_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return TRINO_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return TRINO_CONN_REFUSED, detail
    if "catalog" in lowered and ("not found" in lowered or "does not exist" in lowered):
        return TRINO_UNKNOWN_CATALOG, detail
    if type(exc).__name__ == "TrinoUserError":
        if "catalog" in lowered:
            return TRINO_UNKNOWN_CATALOG, detail
    return TRINO_UNKNOWN, detail
```

- [ ] **Step 2: 创建 trino.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import TRINO_DRIVER_MISSING, map_trino_error

TRINO_MAX_COLUMNS = 500


class TrinoConnector:
    type = "trino"
    category = "lake"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Trino"

    def _connect(self, **kwargs: Any) -> Any:
        try:
            import trino
        except ImportError as exc:
            raise ImportError("trino driver not installed") from exc
        catalog = kwargs.get("database") or kwargs.get("catalog")
        schema = (kwargs.get("connection_options") or {}).get("schema", "default")
        return trino.dbapi.connect(
            host=kwargs["host"],
            port=kwargs.get("port", 8080),
            user=kwargs["username"],
            catalog=catalog,
            schema=schema,
            http_scheme="http",
            auth=None if not kwargs.get("password") else trino.auth.BasicAuthentication(
                kwargs["username"], kwargs["password"],
            ),
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self._connect(**kwargs)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchall()
            finally:
                connection.close()
        except ImportError:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{TRINO_DRIVER_MISSING}] trino driver not installed",
                latency_ms=latency_ms,
                code=TRINO_DRIVER_MISSING,
            )
        except Exception as exc:
            code, detail = map_trino_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any, *, catalog: str | None = None) -> list[SchemaInfo]:
        if not catalog:
            return []
        cursor = connection.cursor()
        cursor.execute(f"SHOW SCHEMAS FROM {catalog}")
        return [SchemaInfo(name=row[0]) for row in cursor.fetchall() if row]

    def list_tables(self, connection: Any, schema: str, *, catalog: str | None = None) -> list[TableInfo]:
        if not catalog or not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(f"SHOW TABLES FROM {catalog}.{schema}")
        rows = cursor.fetchall()
        return [TableInfo(name=row[0], type="table") for row in rows if row] if rows else []

    def list_columns(self, connection: Any, schema: str, table: str, *, catalog: str | None = None) -> list[ColumnInfo]:
        if not catalog or not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(f"DESCRIBE {catalog}.{schema}.{table}")
        columns = [
            ColumnInfo(name=row[0], data_type=row[1], nullable=True)
            for row in cursor.fetchall()
            if row
        ]
        return columns[:TRINO_MAX_COLUMNS] if len(columns) > TRINO_MAX_COLUMNS else columns
```

- [ ] **Step 3: 注册三方言**

`backend/app/datasources/__init__.py`：

```python
from app.datasources.dialects.dm import DmConnector
from app.datasources.dialects.gaussdb import GaussdbConnector
from app.datasources.dialects.trino import TrinoConnector

# 在 register_builtin_dialects() 末尾追加：
    register_dialect(GaussdbConnector())
    register_dialect(DmConnector())
    register_dialect(TrinoConnector())
```

`backend/app/datasources/dialects/__init__.py` 追加导出（若项目有 re-export 惯例）：

```python
from app.datasources.dialects.dm import DmConnector, DM_MAX_COLUMNS
from app.datasources.dialects.gaussdb import GaussdbConnector
from app.datasources.dialects.trino import TrinoConnector, TRINO_MAX_COLUMNS
```

- [ ] **Step 4: 追加 CONN-010 测试**

```python
from app.datasources.dialects.trino import TrinoConnector


def test_conn_trino_catalog_r38():
    """T-CONN-R38-010-01: types catalog 含 trino，category=lake。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert "trino" in types
    assert types["trino"]["category"] == "lake"


@patch("trino.dbapi.connect")
def test_conn_trino_success_r38(mock_connect):
    """T-CONN-R38-010-02: mock coordinator 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [(1,)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = TrinoConnector().test_connection(
        host="coordinator", port=8080, database="hive", username="u", password="",
    )
    assert result.ok is True


@patch("trino.dbapi.connect")
def test_conn_trino_conn_refused_r38(mock_connect):
    """T-CONN-R38-010-03: mock 不可达 → TRINO_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("refused")
    result = TrinoConnector().test_connection(
        host="coordinator", port=8080, database="hive", username="u", password="",
    )
    assert result.ok is False
    assert result.code == "TRINO_CONN_REFUSED"


@patch("trino.dbapi.connect")
def test_conn_trino_unknown_catalog_r38(mock_connect):
    """T-CONN-R38-010-04: mock 非法 catalog → TRINO_UNKNOWN_CATALOG。"""
    mock_connect.side_effect = Exception("Catalog 'bad' not found")
    result = TrinoConnector().test_connection(
        host="coordinator", port=8080, database="bad", username="u", password="",
    )
    assert result.ok is False
    assert result.code == "TRINO_UNKNOWN_CATALOG"


@patch("trino.dbapi.connect")
def test_conn_trino_empty_schemas_r38(mock_connect):
    """T-CONN-R38-010-05: mock SHOW SCHEMAS 空 → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    opened = TrinoConnector().open_connection(
        host="h", port=8080, database="hive", username="u", password="",
    )
    assert TrinoConnector().list_schemas(opened, catalog="hive") == []


@patch("trino.dbapi.connect")
def test_conn_trino_unknown_schema_tables_r38(mock_connect):
    """T-CONN-R38-010-06: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    assert TrinoConnector().list_tables(conn, "unknown", catalog="hive") == []
```

- [ ] **Step 5: 运行连接器测试 + r37 回归**

Run: `cd backend && python3 -m ruff check app/datasources/ && python3 -m pytest tests/test_query_meta_conn_r38.py -k "conn_gaussdb or conn_dm or conn_trino" -v`
Expected: 19 passed（7+6+6）

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -v`
Expected: 40 passed（r37 无回归）

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/trino.py backend/app/datasources/dialects/__init__.py backend/app/datasources/__init__.py tests/test_query_meta_conn_r38.py
git commit -m "feat(r38): CONN-010 Trino + registry gaussdb/dm/trino"
```

---

### Task 7: META-003 — 维度字典 migration + 域模块 + API + 7 条测试

**Files:**
- Create: `backend/migrations/versions/0016_dimension_dict.py`
- Create: `backend/app/metadata/dimensions/models.py`
- Create: `backend/app/metadata/dimensions/schemas.py`
- Create: `backend/app/metadata/dimensions/service.py`
- Modify: `backend/app/api/v1/metadata.py`
- Modify: `tests/test_query_meta_conn_r38.py`（fixture 增 dimensions models import；追加 META-003 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端 META API；无 UI 变更

**Interfaces:**
- Consumes: glossary CRUD 模式（`GlossaryError`、分页 list、IntegrityError→409）
- Produces: `DimensionDict`/`DimensionValue` ORM；`DimensionError`；8 REST 路由；`dimension_service` CRUD + values 批量注册

- [ ] **Step 1: 创建 migration 0016**

```python
"""dimension dict tables

Revision ID: 0016
Revises: 0015
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dimension_dicts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "dimension_values",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("dimension_id", sa.Uuid(), sa.ForeignKey("dimension_dicts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("dimension_id", "code", name="uq_dimension_value_code"),
    )
    op.create_index("ix_dimension_values_dimension_id", "dimension_values", ["dimension_id"])


def downgrade() -> None:
    op.drop_table("dimension_values")
    op.drop_table("dimension_dicts")
```

- [ ] **Step 2: 创建 dimensions/models.py**

```python
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.datasources.models import Base


class DimensionDict(Base):
    __tablename__ = "dimension_dicts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    values: Mapped[list["DimensionValue"]] = relationship(
        back_populates="dimension", cascade="all, delete-orphan",
    )


class DimensionValue(Base):
    __tablename__ = "dimension_values"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("dimension_dicts.id", ondelete="CASCADE"), nullable=False,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    dimension: Mapped[DimensionDict] = relationship(back_populates="values")
```

- [ ] **Step 3: 创建 dimensions/schemas.py**

```python
from __future__ import annotations

import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

DIM_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
DIM_STATUS_VALUES = frozenset({"active", "inactive"})


class DimensionError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class DimensionCreate(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    status: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("code must not be blank")
        if not DIM_CODE_RE.match(v):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return v


class DimensionUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    status: str | None = None


class DimensionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    status: str


class DimensionListResponse(BaseModel):
    items: list[DimensionOut]
    total: int


class DimensionValueItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    code: str
    label: str
    sort_order: int = Field(default=0, alias="sortOrder")


class DimensionValuesRegister(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[DimensionValueItem] = Field(min_length=1)


class DimensionValueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int = Field(alias="sortOrder")
    status: str


class DimensionValueListResponse(BaseModel):
    items: list[DimensionValueOut]
    total: int
```

- [ ] **Step 4: 创建 dimensions/service.py**（镜像 glossary_service 分页/冲突模式）

实现 `list_dimensions`、`create_dimension`、`get_dimension`、`update_dimension`、`delete_dimension`、`list_values`、`register_values`、`delete_value`；空 code → `META_DIM_INVALID_CODE` 422；重复 code → `META_DIM_CODE_CONFLICT` 409；value 重复 → `META_DIM_VALUE_CODE_CONFLICT` 409；status 非法 → `META_DIM_INVALID_STATUS` 422。

- [ ] **Step 5: 扩展 metadata.py 路由**

追加 import、` _dimension_error`、`/dimensions` 八路由（GET list、POST create、GET/PUT/DELETE by id、GET/POST values、DELETE value），模式与 glossary 段一致。

- [ ] **Step 6: fixture 增 dimensions models**

在 `r38_sqlite_env` 的 import 区追加：

```python
    import app.metadata.dimensions.models  # noqa: F401
```

并在 `create_all` 前确保 dimensions 表被创建（`Base.metadata.create_all` 会自动包含已 import 的 models）。

- [ ] **Step 7: 追加 META-003 测试**

```python
def test_meta_dimension_create_and_list_r38(client):
    """T-META-R38-003-01: POST 合法维度 → 201；GET list 含该项。"""
    payload = {"code": "region", "name": "区域维度"}
    created = client.post("/api/v1/metadata/dimensions", headers=AUTH, json=payload)
    assert created.status_code == 201
    listed = client.get("/api/v1/metadata/dimensions", headers=AUTH)
    assert listed.status_code == 200
    codes = [d["code"] for d in listed.json()["items"]]
    assert "region" in codes


def test_meta_dimension_duplicate_code_r38(client):
    """T-META-R38-003-02: 重复 code → 409 META_DIM_CODE_CONFLICT。"""
    payload = {"code": "dup_dim", "name": "A"}
    assert client.post("/api/v1/metadata/dimensions", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/metadata/dimensions", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_DIM_CODE_CONFLICT"


def test_meta_dimension_invalid_code_r38(client):
    """T-META-R38-003-03: 空/非法 code → 422 META_DIM_INVALID_CODE。"""
    resp = client.post("/api/v1/metadata/dimensions", headers=AUTH, json={"code": "", "name": "X"})
    assert resp.status_code == 422


def test_meta_dimension_values_register_r38(client):
    """T-META-R38-003-04: POST 批量 values → GET values 含条目。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "status_dim", "name": "状态"},
    ).json()
    reg = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "open", "label": "开启"}, {"code": "closed", "label": "关闭"}]},
    )
    assert reg.status_code in (200, 201)
    values = client.get(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH)
    assert values.status_code == 200
    codes = [v["code"] for v in values.json()["items"]]
    assert "open" in codes and "closed" in codes


def test_meta_dimension_value_duplicate_r38(client):
    """T-META-R38-003-05: 重复 value code → 409 META_DIM_VALUE_CODE_CONFLICT。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "dup_val_dim", "name": "D"},
    ).json()
    body = {"items": [{"code": "a", "label": "A"}]}
    assert client.post(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH, json=body).status_code in (200, 201)
    dup = client.post(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH, json=body)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_DIM_VALUE_CODE_CONFLICT"


def test_meta_dimension_list_pagination_r38(client):
    """T-META-R38-003-06: list limit=1 分页 total 正确。"""
    for code in ("page_a", "page_b"):
        client.post("/api/v1/metadata/dimensions", headers=AUTH, json={"code": code, "name": code})
    resp = client.get("/api/v1/metadata/dimensions", headers=AUTH, params={"limit": 1, "offset": 0})
    body = resp.json()
    assert body["total"] >= 2
    assert len(body["items"]) == 1


def test_meta_dimension_delete_cascade_r38(client):
    """T-META-R38-003-07: DELETE 维度 → values 级联不可见。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "cascade_dim", "name": "C"},
    ).json()
    client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "v1", "label": "V1"}]},
    )
    assert client.delete(f"/api/v1/metadata/dimensions/{dim['id']}", headers=AUTH).status_code in (200, 204)
    values = client.get(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH)
    assert values.status_code == 404
```

- [ ] **Step 8: 运行 META 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r38.py -k "meta_dimension" -v`
Expected: 7 passed

- [ ] **Step 9: Commit**

```bash
git add backend/migrations/versions/0016_dimension_dict.py backend/app/metadata/dimensions/ backend/app/api/v1/metadata.py tests/test_query_meta_conn_r38.py
git commit -m "feat(r38): META-003 dimension dictionary CRUD + values API"
```

---

### Task 8: 文档同步 + 全量回归验证

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/datasources.md`
- Modify: `docs/services/metadata.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- 触及 `docs/` 时遵守 `.cursor/rules/prd-sync.mdc`（alwaysApply）

**UI skill:** none

**UI Acceptance:**
- N/A — 纯文档同步；无 UI 变更

**Interfaces:**
- Consumes: 已实现路由与三方言 type catalog
- Produces: API 登记簿更新；datasources/metadata 域附录状态 → 已实现

- [ ] **Step 1: 更新 docs/api/README.md**

在查询域段追加一行：

```markdown
| POST | `/api/v1/query/translate` | QUERY-008 | 已实现 | 可视化查询配置→参数化 SQL |
```

在 metadata 域段追加 dimensions 路由组（8 行：list/create/get/update/delete + values list/register/delete），状态 **已实现**。

- [ ] **Step 2: 更新 docs/services/datasources.md**

在方言登记表追加：

| type | display_name | category | driver | 状态 |
|------|--------------|----------|--------|------|
| gaussdb | GaussDB | relational | psycopg 3（PG 兼容委托） | 已实现 L1 |
| dm | 达梦 DM | relational | dmPython | 已实现 L1 |
| trino | Trino | lake | trino-python-client | 已实现 L1 |

错误码前缀：`GAUSSDB_*`、`DM_*`、`TRINO_*`。

- [ ] **Step 3: 更新 docs/services/metadata.md**

新增 **dimensions** 域小节：In（维度字典 CRUD、枚举值注册/列表/删除）；Out（物理字段映射 META-001 后续、RLS/报表运行时引用、Dataset 语义层）；错误码表 `META_DIM_*`；migration `0016_dimension_dict.py`。

- [ ] **Step 4: 全量验证**

Run: `cd backend && python3 -m ruff check .`
Expected: All checks passed

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r38.py tests/test_connectors_gov_r37.py -v --tb=short`
Expected: r38 ≥35 passed（33 设计断言 + 2 HTTP smoke）+ r37 40/40；合计新增套件全绿

Run: `cd backend && python3 -m pytest -q`
Expected: ≥884 passed, 4 skipped

- [ ] **Step 5: Commit**

```bash
git add docs/api/README.md docs/services/datasources.md docs/services/metadata.md
git commit -m "docs(r38): register translate API, dimensions routes, three dialects"
```

---

## Self-Review Checklist

| 设计子项 | 对应 Task | 测试 ID 覆盖 |
|----------|-----------|--------------|
| QUERY-008 翻译器 + API | Task 2–3 | T-QUERY-R38-008-01..09 |
| CONN-022 GaussDB | Task 4 | T-CONN-R38-022-01..07 |
| CONN-017 DM | Task 5 | T-CONN-R38-017-01..06 |
| CONN-010 Trino + registry | Task 6 | T-CONN-R38-010-01..06 |
| META-003 维度字典 | Task 7 | T-META-R38-003-01..07 |
| pyproject connectors-ext | Task 1 | — |
| 文档同步 | Task 8 | — |
| r37 回归 | Task 6 Step 5、Task 8 | 40/40 |

**执行模式（固定）：** subagent-driven-development (option 1) — P3 按 Task 1→8 顺序派发 subagent，任务间 two-stage review，不询问用户。
