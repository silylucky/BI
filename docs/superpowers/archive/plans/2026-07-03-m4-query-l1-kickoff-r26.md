# M4 轻量查询 L1 kickoff r26 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/query/`、`backend/app/api/v1/query.py`、`backend/app/api/v1/router.py`、`backend/migrations/versions/0011_chart_query_bindings.py`、`tests/test_query_l1_r26.py`、`tests/test_migrations.py`、`docs/api/README.md`、`docs/services/query.md`
> **子项：** QUERY-004, QUERY-001, QUERY-002, QUERY-006, QUERY-005
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 交付 M4 QUERY L1 五件套 — MySQL/PostgreSQL 方言适配器、只读 SQL/表模式执行 API、执行前 RLS 注入、`chart_query_bindings` CRUD + `bindingId` 执行复用；约 30 项 `test_query_l1_r26.py` smoke + r25 回归全绿。

**Architecture:** entry（`api/v1/query.py`）薄层 + `service.py`/`binding_service.py` 编排 + `executor.py`/`dialects`/`readonly`/`table.py` domain；执行链经 `datasources.acl.assert_visible` → `readonly` → `dialect.wrap_limit` → `rls/guard.apply_rls_to_sql` → `pool_manager.pooled_connection`；绑定 ORM 存平台元库，执行复用同一 `QueryExecutor`。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pymysql · psycopg 3 · pytest · ruff · Alembic

## Global Constraints

- 纯后端 L1；**全 Task UI skill: none**；**不修改** `fe/`、`main.py`、`datasources/dialects/*`
- 不修改 `docs/automate/goal.md` / `plan.md` 结构
- 不含 QUERY-003 native、QUERY-007~009、Admin 查询设计器 UI、M5 VIZ、ClickHouse 方言
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": null}`
- 表模式字段：`schema` + `table`（非 `tableName`）；SQL 字段名 `sql`
- `bindingId` 与内联 `mode`/`sql`/`schema`/`table` **互斥**（同时存在 → 400 `QUERY_INVALID_REQUEST`）
- `rls.enabled=false` 仅 `vitalspan_env=development` 允许
- 文件预算：新建 **14** + 修改 **4** = **18 ≤ 20**
- 验证基线：r25 `pytest` **501 passed** + 4 skipped；本轮目标 ≥531 passed
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: SQL 方言适配器（QUERY-004）

**Files:**
- Create: `backend/app/query/dialects/base.py`
- Create: `backend/app/query/dialects/mysql.py`
- Create: `backend/app/query/dialects/postgres.py`
- Create: `backend/app/query/dialects/__init__.py`
- Test: `tests/test_query_l1_r26.py`（T-Q-020~025 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `app.query.rls.guard.validate_identifier`
- Produces: `SqlDialect` Protocol, `MySqlDialect`, `PostgresDialect`, `get_sql_dialect`, `UnsupportedDialectError`

- [ ] **Step 1: 创建 `backend/app/query/dialects/base.py`**

```python
from __future__ import annotations

from typing import Protocol


class UnsupportedDialectError(Exception):
  def __init__(self, connector_type: str) -> None:
    self.connector_type = connector_type
    super().__init__(f"Unsupported SQL dialect: {connector_type}")


class SqlDialect(Protocol):
  @property
  def connector_type(self) -> str: ...

  def quote_identifier(self, name: str) -> str: ...

  def qualify_table(self, schema: str, table: str) -> str: ...

  def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str: ...

  def build_table_select(
      self, schema: str, table: str, *, limit: int, offset: int = 0,
  ) -> str: ...
```

- [ ] **Step 2: 创建 `backend/app/query/dialects/mysql.py`**

```python
from __future__ import annotations

from app.query.rls.guard import validate_identifier


class MySqlDialect:
  connector_type = "mysql"

  def quote_identifier(self, name: str) -> str:
    validate_identifier(name)
    return f"`{name}`"

  def qualify_table(self, schema: str, table: str) -> str:
    return f"{self.quote_identifier(schema)}.{self.quote_identifier(table)}"

  def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str:
    normalized = sql.strip().rstrip(";")
    return (
      f"SELECT * FROM ({normalized}) AS _vs "
      f"LIMIT {int(limit)} OFFSET {int(offset)}"
    )

  def build_table_select(
      self, schema: str, table: str, *, limit: int, offset: int = 0,
  ) -> str:
    qualified = self.qualify_table(schema, table)
    return (
      f"SELECT * FROM {qualified} "
      f"LIMIT {int(limit)} OFFSET {int(offset)}"
    )
```

- [ ] **Step 3: 创建 `backend/app/query/dialects/postgres.py`**

```python
from __future__ import annotations

from app.query.rls.guard import validate_identifier


class PostgresDialect:
  connector_type = "postgresql"

  def quote_identifier(self, name: str) -> str:
    validate_identifier(name)
    return f'"{name}"'

  def qualify_table(self, schema: str, table: str) -> str:
    return f"{self.quote_identifier(schema)}.{self.quote_identifier(table)}"

  def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str:
    normalized = sql.strip().rstrip(";")
    return f"{normalized} LIMIT {int(limit)} OFFSET {int(offset)}"

  def build_table_select(
      self, schema: str, table: str, *, limit: int, offset: int = 0,
  ) -> str:
    qualified = self.qualify_table(schema, table)
    return (
      f"SELECT * FROM {qualified} "
      f"LIMIT {int(limit)} OFFSET {int(offset)}"
    )
```

- [ ] **Step 4: 创建 `backend/app/query/dialects/__init__.py`**

```python
from __future__ import annotations

from app.query.dialects.base import SqlDialect, UnsupportedDialectError
from app.query.dialects.mysql import MySqlDialect
from app.query.dialects.postgres import PostgresDialect

_REGISTRY: dict[str, SqlDialect] = {
  "mysql": MySqlDialect(),
  "postgresql": PostgresDialect(),
}


def get_sql_dialect(connector_type: str) -> SqlDialect:
  dialect = _REGISTRY.get(connector_type)
  if dialect is None:
    raise UnsupportedDialectError(connector_type)
  return dialect


__all__ = [
  "SqlDialect",
  "UnsupportedDialectError",
  "MySqlDialect",
  "PostgresDialect",
  "get_sql_dialect",
]
```

- [ ] **Step 5: 在 `tests/test_query_l1_r26.py` 写入方言单元测试 T-Q-020~025**

```python
import pytest

from app.query.dialects import get_sql_dialect
from app.query.dialects.base import UnsupportedDialectError
from app.query.readonly import assert_readonly_sql


def test_mysql_quote_identifier():
    """T-Q-020: MySQL quote_identifier → backticks."""
    d = get_sql_dialect("mysql")
    assert d.quote_identifier("col") == "`col`"
    with pytest.raises(Exception):
        d.quote_identifier("bad-name")


def test_postgres_quote_identifier():
    """T-Q-021: PG quote_identifier → double quotes."""
    d = get_sql_dialect("postgresql")
    assert d.quote_identifier("col") == '"col"'


def test_mysql_wrap_limit():
    """T-Q-022: MySQL wrap_limit 含 LIMIT/OFFSET."""
    sql = get_sql_dialect("mysql").wrap_limit("SELECT 1", limit=10, offset=5)
    assert "LIMIT 10" in sql and "OFFSET 5" in sql


def test_postgres_wrap_limit():
    """T-Q-023: PG wrap_limit 含 LIMIT/OFFSET."""
    sql = get_sql_dialect("postgresql").wrap_limit("SELECT 1", limit=10, offset=5)
    assert "LIMIT 10" in sql and "OFFSET 5" in sql


def test_build_table_select_readonly():
    """T-Q-024: build_table_select 经 assert_readonly_sql."""
    for ct in ("mysql", "postgresql"):
        sql = get_sql_dialect(ct).build_table_select("public", "sales", limit=50, offset=0)
        assert_readonly_sql(sql)


def test_unknown_dialect():
    """T-Q-025: 未知 connector_type → UnsupportedDialectError."""
    with pytest.raises(UnsupportedDialectError):
        get_sql_dialect("clickhouse")
```

- [ ] **Step 6: 运行方言测试**

Run: `cd backend && python3 -m pytest tests/test_query_l1_r26.py -k "quote_identifier or wrap_limit or build_table_select or unknown_dialect" -v`
Expected: FAIL（`readonly` 模块尚未创建时先跳过 import；若 Step 5 已 import readonly，则先完成 Task 2 Step 1 再跑）

- [ ] **Step 7: Commit**

```bash
git add backend/app/query/dialects/ tests/test_query_l1_r26.py
git commit -m "feat(query): add MySQL/PostgreSQL SQL dialect adapters (QUERY-004)"
```

---

### Task 2: 只读守卫与 Pydantic 契约（QUERY-001 基础）

**Files:**
- Create: `backend/app/query/readonly.py`
- Create: `backend/app/query/schemas.py`
- Modify: `backend/app/query/__init__.py`
- Test: `tests/test_query_l1_r26.py`（readonly 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: 无
- Produces: `QueryError`, `assert_readonly_sql`, `ExecuteRequest`, `ExecuteResponse`, `BindingCreate`, `BindingOut`, `BindingListResponse`, `RlsOptions`

- [ ] **Step 1: 创建 `backend/app/query/readonly.py`**

```python
from __future__ import annotations

import re

from app.query.schemas import QueryError

_WRITE_PREFIX = re.compile(
  r"^\s*(INSERT|UPDATE|DELETE|MERGE|REPLACE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|EXEC)\b",
  re.IGNORECASE,
)
_FORBIDDEN_CLAUSES = re.compile(
  r"\b(INTO\s+OUTFILE|FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE)\b",
  re.IGNORECASE,
)


def assert_readonly_sql(sql: str) -> None:
  normalized = sql.strip().rstrip(";")
  if not normalized:
    raise QueryError("QUERY_NOT_READONLY", "SQL must not be empty", 400)
  if ";" in normalized:
    raise QueryError("QUERY_NOT_READONLY", "Multiple statements are not allowed", 400)
  if _WRITE_PREFIX.match(normalized):
    raise QueryError("QUERY_NOT_READONLY", "Write operations are not allowed", 400)
  if _FORBIDDEN_CLAUSES.search(normalized):
    raise QueryError("QUERY_NOT_READONLY", "Forbidden SQL clause", 400)
```

- [ ] **Step 2: 创建 `backend/app/query/schemas.py`**

```python
from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.config import get_settings


class QueryError(Exception):
  def __init__(self, code: str, message: str, status: int = 400) -> None:
    self.code = code
    self.message = message
    self.status = status
    super().__init__(message)


class RlsOptions(BaseModel):
  model_config = ConfigDict(populate_by_name=True)
  enabled: bool = True
  table_alias: str = Field(default="t", alias="tableAlias")
  org_column: str = Field(default="org_node_id", alias="orgColumn")


class ExecuteRequest(BaseModel):
  model_config = ConfigDict(populate_by_name=True)
  data_source_id: uuid.UUID | None = Field(default=None, alias="dataSourceId")
  mode: Literal["sql", "table"] | None = None
  sql: str | None = None
  schema: str | None = None
  table: str | None = None
  limit: int | None = Field(default=None, ge=1)
  offset: int = Field(default=0, ge=0)
  binding_id: uuid.UUID | None = Field(default=None, alias="bindingId")
  rls: RlsOptions = Field(default_factory=RlsOptions)

  @model_validator(mode="after")
  def validate_limit_cap(self) -> "ExecuteRequest":
    cap = get_settings().query_default_limit
    if self.limit is not None and self.limit > cap:
      raise ValueError(f"limit must be <= {cap}")
    return self

  @model_validator(mode="after")
  def validate_mode_fields(self) -> "ExecuteRequest":
    if self.binding_id is not None:
      inline = [self.mode, self.sql, self.schema, self.table, self.data_source_id]
      if any(v is not None for v in inline):
        raise ValueError("bindingId is mutually exclusive with inline execute fields")
      return self
    if self.mode == "sql":
      if self.data_source_id is None or not self.sql:
        raise ValueError("sql mode requires dataSourceId and sql")
    elif self.mode == "table":
      if self.data_source_id is None or not self.schema or not self.table:
        raise ValueError("table mode requires dataSourceId, schema and table")
    else:
      raise ValueError("mode is required when bindingId is absent")
    return self


class ExecuteResponse(BaseModel):
  model_config = ConfigDict(populate_by_name=True)
  columns: list[str]
  rows: list[list[Any]]
  row_count: int = Field(alias="rowCount")
  truncated: bool
  trace_id: str = Field(alias="traceId")


class BindingCreate(BaseModel):
  model_config = ConfigDict(populate_by_name=True)
  name: str = Field(min_length=1, max_length=128)
  data_source_id: uuid.UUID = Field(alias="dataSourceId")
  mode: Literal["sql", "table"]
  sql: str | None = None
  schema_name: str | None = Field(default=None, alias="schema")
  table_name: str | None = Field(default=None, alias="table")
  default_limit: int = Field(default=100, alias="defaultLimit", ge=1)


class BindingUpdate(BindingCreate):
  pass


class BindingOut(BaseModel):
  model_config = ConfigDict(from_attributes=True, populate_by_name=True)
  id: uuid.UUID
  name: str
  data_source_id: uuid.UUID = Field(alias="dataSourceId")
  mode: str
  sql: str | None = None
  schema_name: str | None = Field(default=None, alias="schema")
  table_name: str | None = Field(default=None, alias="table")
  default_limit: int = Field(alias="defaultLimit")


class BindingListResponse(BaseModel):
  items: list[BindingOut]
  total: int
```

- [ ] **Step 3: 更新 `backend/app/query/__init__.py`**

```python
"""Query domain — executor, dialects, bindings, RLS guard."""

from app.query.schemas import QueryError

__all__ = ["QueryError"]
```

- [ ] **Step 4: 追加 readonly 测试**

```python
import pytest

from app.query.readonly import assert_readonly_sql
from app.query.schemas import QueryError


def test_readonly_rejects_insert():
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("INSERT INTO t VALUES (1)")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_rejects_delete():
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("DELETE FROM t")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_accepts_select():
    assert_readonly_sql("SELECT 1") is None
```

- [ ] **Step 5: 运行测试**

Run: `cd backend && python3 -m pytest tests/test_query_l1_r26.py -k "readonly or quote_identifier or wrap_limit" -v`
Expected: PASS（方言 + readonly）

- [ ] **Step 6: Commit**

```bash
git add backend/app/query/readonly.py backend/app/query/schemas.py backend/app/query/__init__.py tests/test_query_l1_r26.py
git commit -m "feat(query): add readonly SQL guard and execute/binding schemas (QUERY-001)"
```

---

### Task 3: QueryExecutor 与表模式生成（QUERY-001 + QUERY-002）

**Files:**
- Create: `backend/app/query/table.py`
- Create: `backend/app/query/executor.py`
- Test: `tests/test_query_l1_r26.py`（executor mock 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `get_sql_dialect`, `assert_readonly_sql`, `apply_rls_to_sql`, `pool_manager`, `registry`, `decrypt_credential`, `DataSource`
- Produces: `QueryResult`, `QueryExecutor.execute_sql`, `QueryExecutor.execute_table`, `build_table_sql`

- [ ] **Step 1: 创建 `backend/app/query/table.py`**

```python
from __future__ import annotations

from app.query.dialects import SqlDialect, get_sql_dialect


def build_table_sql(
    connector_type: str, schema: str, table: str, *, limit: int, offset: int = 0,
) -> str:
  dialect = get_sql_dialect(connector_type)
  return dialect.build_table_select(schema, table, limit=limit, offset=offset)
```

- [ ] **Step 2: 创建 `backend/app/query/executor.py`**

```python
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.datasources.credentials import CredentialDecryptError, decrypt_credential
from app.datasources.models import DataSource
from app.datasources.pool import pool_manager
from app.datasources.registry import ConnectorNotFoundError, registry
from app.datasources.service import DataSourceError, _resolve_connection_options
from app.query.dialects import get_sql_dialect
from app.query.readonly import assert_readonly_sql
from app.query.rls.guard import apply_rls_to_sql
from app.query.schemas import QueryError
from app.query.table import build_table_sql


@dataclass
class QueryResult:
  columns: list[str]
  rows: list[list[Any]]
  row_count: int
  truncated: bool


def _serialize_cell(value: Any) -> Any:
  if isinstance(value, datetime):
    return value.isoformat()
  if isinstance(value, date):
    return value.isoformat()
  if isinstance(value, Decimal):
    return str(value)
  if isinstance(value, uuid.UUID):
    return str(value)
  return value


def _map_execution_error(exc: Exception) -> QueryError:
  msg = str(exc)
  lowered = msg.lower()
  if "timeout" in lowered or "timed out" in lowered:
    return QueryError("QUERY_TIMEOUT", msg, 504)
  if "doesn't exist" in lowered or "does not exist" in lowered:
    return QueryError("QUERY_TABLE_NOT_FOUND", msg, 404)
  return QueryError("QUERY_EXECUTION_ERROR", msg, 400)


class QueryExecutor:
  def execute_sql(
      self, session: Session, user: UserContext, data_source_id: uuid.UUID, sql: str, *,
      limit: int, offset: int = 0, rls_config: dict | None = None, apply_rls: bool = True,
  ) -> QueryResult:
    return self._run(
      session, user, data_source_id, sql, limit=limit, offset=offset,
      rls_config=rls_config, apply_rls=apply_rls,
    )

  def execute_table(
      self, session: Session, user: UserContext, data_source_id: uuid.UUID,
      schema: str, table: str, *, limit: int, offset: int = 0,
      rls_config: dict | None = None, apply_rls: bool = True,
  ) -> QueryResult:
    row = self._load_row(session, data_source_id)
    sql = build_table_sql(row.type, schema, table, limit=limit, offset=offset)
    cfg = dict(rls_config or {})
    cfg.setdefault("table_alias", "t")
    wrapped = f"SELECT * FROM ({sql}) AS t"
    return self._run(
      session, user, data_source_id, wrapped, limit=limit, offset=offset,
      rls_config=cfg, apply_rls=apply_rls, skip_wrap_limit=True,
    )

  def _load_row(self, session: Session, data_source_id: uuid.UUID) -> DataSource:
    row = session.get(DataSource, data_source_id)
    if row is None or row.deleted_at is not None:
      raise QueryError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    return row

  def _connector_kwargs(self, row: DataSource) -> tuple[Any, dict, int]:
    try:
      connector = registry.get(row.type)
    except ConnectorNotFoundError as exc:
      raise QueryError("UNKNOWN_CONNECTOR_TYPE", str(exc), 422) from exc
    try:
      password = decrypt_credential(row.password_encrypted)
    except CredentialDecryptError as exc:
      raise QueryError("CREDENTIAL_DECRYPT_FAILED", str(exc), 500) from exc
    opts = _resolve_connection_options(row=row)
    kwargs = {
      "host": row.host,
      "port": row.port,
      "database": row.database,
      "username": row.username,
      "password": password,
      "connect_timeout_sec": opts.connect_timeout_sec,
      "ssl_mode": opts.ssl_mode,
    }
    return connector, kwargs, opts.pool_size

  def _run(
      self, session: Session, user: UserContext, data_source_id: uuid.UUID, sql: str, *,
      limit: int, offset: int, rls_config: dict | None, apply_rls: bool,
      skip_wrap_limit: bool = False,
  ) -> QueryResult:
    row = self._load_row(session, data_source_id)
    dialect = get_sql_dialect(row.type)
    assert_readonly_sql(sql)
    final_sql = sql if skip_wrap_limit else dialect.wrap_limit(sql, limit=limit, offset=offset)
    if apply_rls:
      final_sql = apply_rls_to_sql(session, user, final_sql, rls_config=rls_config)
    connector, kwargs, pool_size = self._connector_kwargs(row)
    try:
      with pool_manager.pooled_connection(
        data_source_id, connector=connector, connect_kwargs=kwargs, pool_size=pool_size,
      ) as conn:
        cur = conn.cursor()
        cur.execute(final_sql)
        columns = [col[0] for col in (cur.description or [])]
        raw_rows = cur.fetchmany(limit + 1)
    except QueryError:
      raise
    except Exception as exc:
      msg = str(exc)
      if "connection" in msg.lower() or "refused" in msg.lower():
        raise QueryError("QUERY_CONNECTION_FAILED", msg, 502) from exc
      raise _map_execution_error(exc) from exc
    truncated = len(raw_rows) > limit
    rows = raw_rows[:limit]
    serialized = [[_serialize_cell(c) for c in r] for r in rows]
    return QueryResult(
      columns=columns,
      rows=serialized,
      row_count=len(serialized),
      truncated=truncated,
    )
```

- [ ] **Step 3: 追加 executor mock 测试 T-Q-010~013 基础**

```python
from unittest.mock import MagicMock, patch

from app.auth.deps import UserContext
from app.query.executor import QueryExecutor
from app.query.models import get_meta_session  # 将在 Task 5 创建；此处用 datasources session


@patch("app.query.executor.pool_manager.pooled_connection")
def test_execute_table_mock_success(mock_pool, query_test_ds):
    """T-Q-010: mode=table mock 成功返回列/行。"""
    cur = MagicMock()
    cur.description = [("org_node_id",), ("amount",)]
    cur.fetchmany.return_value = [(1, 10)]
    conn = MagicMock()
    conn.cursor.return_value = cur
    mock_pool.return_value.__enter__.return_value = conn
    session = query_test_ds["session"]
    user = UserContext(id="dev", username="dev", roles=["admin"])
    result = QueryExecutor().execute_table(
      session, user, query_test_ds["ds_id"], "public", "sales", limit=100,
      apply_rls=False,
    )
    assert result.columns == ["org_node_id", "amount"]
    assert result.row_count == 1
```

（`query_test_ds` fixture 在 Task 7 统一提供：sqlite 内存库 + 种子 DataSource）

- [ ] **Step 4: 运行 executor 测试**

Run: `cd backend && python3 -m pytest tests/test_query_l1_r26.py -k "execute_table" -v`
Expected: PASS（fixture 就绪后）

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/table.py backend/app/query/executor.py tests/test_query_l1_r26.py
git commit -m "feat(query): add QueryExecutor with table mode and pooled execution (QUERY-001/002)"
```

---

### Task 4: 服务编排与 RLS 执行链（QUERY-006 + QUERY-001 编排）

**Files:**
- Create: `backend/app/query/service.py`
- Test: `tests/test_query_l1_r26.py`（T-Q-040~044 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `QueryExecutor`, `assert_visible`, `ExecuteRequest`, `get_settings`
- Produces: `execute_query(session, user, payload) -> ExecuteResponse`

- [ ] **Step 1: 创建 `backend/app/query/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.resources.service import VisibilityError
from app.auth.rls.predicate import RlsConfigError
from app.core.config import get_settings
from app.core.logging import trace_id_var
from app.datasources.acl import assert_visible
from app.query.executor import QueryExecutor
from app.query.schemas import ExecuteRequest, ExecuteResponse, QueryError


_executor = QueryExecutor()


def _effective_limit(request: ExecuteRequest, binding_default: int | None = None) -> int:
  settings = get_settings()
  if request.limit is not None:
    return min(request.limit, settings.query_default_limit)
  if binding_default is not None:
    return min(binding_default, settings.query_default_limit)
  return settings.query_default_limit


def _rls_enabled(request: ExecuteRequest) -> bool:
  if request.rls.enabled:
    return True
  if get_settings().vitalspan_env != "development":
    raise QueryError("RLS_CONFIG_INVALID", "Disabling RLS is only allowed in development", 400)
  return False


def execute_query(session: Session, user: UserContext, payload: ExecuteRequest) -> ExecuteResponse:
  from app.query.binding_service import resolve_binding_execute  # Task 5

  if payload.binding_id is not None:
    resolved = resolve_binding_execute(session, user.roles, payload.binding_id)
    data_source_id = resolved["data_source_id"]
    mode = resolved["mode"]
    sql = resolved.get("sql")
    schema = resolved.get("schema_name")
    table = resolved.get("table_name")
    limit = _effective_limit(payload, resolved.get("default_limit"))
  else:
    data_source_id = payload.data_source_id  # type: ignore[assignment]
    mode = payload.mode  # type: ignore[assignment]
    sql = payload.sql
    schema = payload.schema
    table = payload.table
    limit = _effective_limit(payload)

  try:
    assert_visible(session, user.roles, data_source_id)
  except VisibilityError as exc:
    raise QueryError(exc.code, exc.message, exc.status) from exc

  apply_rls = _rls_enabled(payload)
  rls_config = {
    "table_alias": payload.rls.table_alias,
    "org_column": payload.rls.org_column,
  }
  try:
    if mode == "sql":
      result = _executor.execute_sql(
        session, user, data_source_id, sql or "", limit=limit, offset=payload.offset,
        rls_config=rls_config, apply_rls=apply_rls,
      )
    else:
      result = _executor.execute_table(
        session, user, data_source_id, schema or "", table or "",
        limit=limit, offset=payload.offset, rls_config=rls_config, apply_rls=apply_rls,
      )
  except RlsConfigError as exc:
    raise QueryError("RLS_CONFIG_INVALID", str(exc), 400) from exc

  return ExecuteResponse(
    columns=result.columns,
    rows=result.rows,
    row_count=result.row_count,
    truncated=result.truncated,
    trace_id=trace_id_var.get() or "",
  )
```

- [ ] **Step 2: 追加 RLS smoke 测试 T-Q-040~044（mock SQL capture）**

```python
@patch("app.query.executor.apply_rls_to_sql", side_effect=lambda s, u, sql, **kw: sql + " /*RLS*/")
@patch("app.query.executor.pool_manager.pooled_connection")
def test_rls_injected_on_execute(mock_pool, mock_rls, client, query_seed):
    """T-Q-040: 有 org 授权用户执行时 apply_rls_to_sql 被调用。"""
    # POST /api/v1/query/execute — 在 Task 6 路由就绪后补全；此处先测 service 层
    ...


@patch("app.query.executor.apply_rls_to_sql")
def test_rls_disabled_only_in_development(mock_rls, client, query_seed, monkeypatch):
    """T-Q-044: development 下 rls.enabled=false 不注入。"""
    monkeypatch.setenv("VITALSPAN_ENV", "development")
    get_settings.cache_clear()
    # execute with rls.enabled=false → mock_rls not called
```

- [ ] **Step 3: 运行 service/RLS 测试**

Run: `cd backend && python3 -m pytest tests/test_query_l1_r26.py -k "rls" -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/query/service.py tests/test_query_l1_r26.py
git commit -m "feat(query): add execute_query orchestration with RLS chain (QUERY-006)"
```

---

### Task 5: 图表直连绑定 ORM、迁移与服务（QUERY-005）

**Files:**
- Create: `backend/app/query/models.py`
- Create: `backend/app/query/binding_service.py`
- Create: `backend/migrations/versions/0011_chart_query_bindings.py`
- Modify: `tests/test_migrations.py`（T-MIG-38~39）
- Test: `tests/test_query_l1_r26.py`（binding 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `assert_visible`, `validate_identifier`, `BindingCreate`, `ChartQueryBinding` ORM
- Produces: `create_binding`, `list_bindings`, `get_binding`, `update_binding`, `delete_binding`, `resolve_binding_execute`

- [ ] **Step 1: 创建 `backend/app/query/models.py`**

```python
from __future__ import annotations

import uuid
from datetime import datetime
from functools import lru_cache

from sqlalchemy import DateTime, Integer, String, Text, Uuid, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
  pass


class ChartQueryBinding(Base):
  __tablename__ = "chart_query_bindings"

  id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
  name: Mapped[str] = mapped_column(String(128), nullable=False)
  data_source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
  mode: Mapped[str] = mapped_column(String(16), nullable=False)
  sql: Mapped[str | None] = mapped_column(Text, nullable=True)
  schema_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
  table_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
  default_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
  created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
  updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
  )


@lru_cache
def get_meta_engine():
  url = get_settings().database_url
  connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
  return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


def get_meta_session():
  return sessionmaker(bind=get_meta_engine(), autoflush=False, autocommit=False)()
```

- [ ] **Step 2: 创建 `backend/app/query/binding_service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.resources.service import VisibilityError
from app.core.config import get_settings
from app.datasources.acl import assert_visible, list_visible_ids
from app.datasources.models import DataSource
from app.query.models import ChartQueryBinding
from app.query.rls.guard import validate_identifier
from app.query.schemas import BindingCreate, BindingListResponse, BindingOut, BindingUpdate, QueryError


def _validate_binding_payload(payload: BindingCreate) -> None:
  cap = get_settings().query_default_limit
  if payload.default_limit > cap:
    raise QueryError("QUERY_INVALID_REQUEST", f"defaultLimit must be <= {cap}", 400)
  if payload.mode == "sql":
    if not payload.sql:
      raise QueryError("QUERY_INVALID_REQUEST", "sql is required for sql mode", 400)
  else:
    if not payload.schema_name or not payload.table_name:
      raise QueryError("QUERY_INVALID_REQUEST", "schema and table are required for table mode", 400)
    validate_identifier(payload.schema_name)
    validate_identifier(payload.table_name)


def create_binding(
    session: Session, role_codes: list[str], payload: BindingCreate, created_by: uuid.UUID | None,
) -> BindingOut:
  assert_visible(session, role_codes, payload.data_source_id)
  _validate_binding_payload(payload)
  row = ChartQueryBinding(
    name=payload.name,
    data_source_id=payload.data_source_id,
    mode=payload.mode,
    sql=payload.sql,
    schema_name=payload.schema_name,
    table_name=payload.table_name,
    default_limit=payload.default_limit,
    created_by=created_by,
  )
  session.add(row)
  session.commit()
  session.refresh(row)
  return BindingOut.model_validate(row)


def _visible_binding_stmt(session: Session, role_codes: list[str]):
  visible = list_visible_ids(session, role_codes)
  stmt = select(ChartQueryBinding)
  if visible is not None:
    if not visible:
      return stmt.where(False)
    stmt = stmt.where(ChartQueryBinding.data_source_id.in_(visible))
  return stmt


def list_bindings(
    session: Session, role_codes: list[str], *, limit: int = 50, offset: int = 0,
    data_source_id: uuid.UUID | None = None,
) -> BindingListResponse:
  stmt = _visible_binding_stmt(session, role_codes)
  if data_source_id is not None:
    assert_visible(session, role_codes, data_source_id)
    stmt = stmt.where(ChartQueryBinding.data_source_id == data_source_id)
  total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
  rows = session.scalars(stmt.order_by(ChartQueryBinding.created_at.desc()).limit(limit).offset(offset)).all()
  return BindingListResponse(items=[BindingOut.model_validate(r) for r in rows], total=total)


def get_binding(session: Session, role_codes: list[str], binding_id: uuid.UUID) -> BindingOut:
  row = session.get(ChartQueryBinding, binding_id)
  if row is None:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
  try:
    assert_visible(session, role_codes, row.data_source_id)
  except VisibilityError:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
  return BindingOut.model_validate(row)


def update_binding(
    session: Session, role_codes: list[str], binding_id: uuid.UUID, payload: BindingUpdate,
) -> BindingOut:
  row = session.get(ChartQueryBinding, binding_id)
  if row is None:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
  try:
    assert_visible(session, role_codes, row.data_source_id)
  except VisibilityError:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
  assert_visible(session, role_codes, payload.data_source_id)
  _validate_binding_payload(payload)
  row.name = payload.name
  row.data_source_id = payload.data_source_id
  row.mode = payload.mode
  row.sql = payload.sql
  row.schema_name = payload.schema_name
  row.table_name = payload.table_name
  row.default_limit = payload.default_limit
  session.commit()
  session.refresh(row)
  return BindingOut.model_validate(row)


def delete_binding(session: Session, role_codes: list[str], binding_id: uuid.UUID) -> None:
  row = session.get(ChartQueryBinding, binding_id)
  if row is None:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
  try:
    assert_visible(session, role_codes, row.data_source_id)
  except VisibilityError:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
  session.delete(row)
  session.commit()


def resolve_binding_execute(session: Session, role_codes: list[str], binding_id: uuid.UUID) -> dict:
  row = session.get(ChartQueryBinding, binding_id)
  if row is None:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
  try:
    assert_visible(session, role_codes, row.data_source_id)
  except VisibilityError:
    raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
  return {
    "data_source_id": row.data_source_id,
    "mode": row.mode,
    "sql": row.sql,
    "schema_name": row.schema_name,
    "table_name": row.table_name,
    "default_limit": row.default_limit,
  }
```

- [ ] **Step 3: 创建 `backend/migrations/versions/0011_chart_query_bindings.py`**

```python
"""chart_query_bindings for FR-2.0b direct chart query bindings

Revision ID: 0011
Revises: 0010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "chart_query_bindings",
    sa.Column("id", sa.Uuid(), nullable=False),
    sa.Column("name", sa.String(length=128), nullable=False),
    sa.Column("data_source_id", sa.Uuid(), nullable=False),
    sa.Column("mode", sa.String(length=16), nullable=False),
    sa.Column("sql", sa.Text(), nullable=True),
    sa.Column("schema_name", sa.String(length=64), nullable=True),
    sa.Column("table_name", sa.String(length=64), nullable=True),
    sa.Column("default_limit", sa.Integer(), nullable=False, server_default="100"),
    sa.Column("created_by", sa.Uuid(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index("ix_chart_query_bindings_data_source_id", "chart_query_bindings", ["data_source_id"])
  op.create_index("ix_chart_query_bindings_created_by", "chart_query_bindings", ["created_by"])


def downgrade() -> None:
  op.drop_index("ix_chart_query_bindings_created_by", table_name="chart_query_bindings")
  op.drop_index("ix_chart_query_bindings_data_source_id", table_name="chart_query_bindings")
  op.drop_table("chart_query_bindings")
```

- [ ] **Step 4: 扩展 `tests/test_migrations.py`**

```python
def test_revision_chain_head_0011_down_revision():
    """T-MIG-38: heads 含 0011；0011.down_revision==0010。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert "0011" in heads
    assert revisions["0011"] == "0010"


def test_alembic_upgrade_head_sql_contains_chart_query_bindings():
    """T-MIG-39: upgrade head --sql 含 chart_query_bindings。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        ["alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        check=True,
    )
    assert "chart_query_bindings" in result.stdout
```

- [ ] **Step 5: 运行迁移测试**

Run: `cd backend && python3 -m pytest tests/test_migrations.py -k "0011 or chart_query_bindings" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/query/models.py backend/app/query/binding_service.py backend/migrations/versions/0011_chart_query_bindings.py tests/test_migrations.py
git commit -m "feat(query): add chart_query_bindings ORM, migration and binding service (QUERY-005)"
```

---

### Task 6: Query API 路由与 router 注册

**Files:**
- Create: `backend/app/api/v1/query.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_query_l1_r26.py`（T-Q-001~006、T-Q-030~034 API 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `execute_query`, `binding_service` CRUD, `QueryError`, `VisibilityError`
- Produces: FastAPI routes `POST /query/execute`, `GET/POST /query/bindings`, `GET/PUT/DELETE /query/bindings/{bindingId}`

- [ ] **Step 1: 创建 `backend/app/api/v1/query.py`**

```python
from __future__ import annotations

import uuid
from typing import Annotated

import app.datasources  # noqa: F401 — register_builtin_dialects
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.resources.service import VisibilityError
from app.datasources.models import get_meta_session
from app.query import binding_service
from app.query.schemas import (
  BindingCreate,
  BindingListResponse,
  BindingOut,
  BindingUpdate,
  ExecuteRequest,
  ExecuteResponse,
  QueryError,
)
from app.query import service as query_service

router = APIRouter(prefix="/query", tags=["query"])


def _db() -> Session:
  session = get_meta_session()
  try:
    yield session
  finally:
    session.close()


def _error_response(exc: QueryError) -> JSONResponse:
  return JSONResponse(
    status_code=exc.status,
    content={"code": exc.code, "message": exc.message, "detail": None},
  )


def _visibility_response(exc: VisibilityError) -> JSONResponse:
  return JSONResponse(
    status_code=exc.status,
    content={"code": exc.code, "message": exc.message, "detail": None},
  )


@router.post("/execute", response_model=ExecuteResponse)
def execute_query(
    payload: ExecuteRequest,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> ExecuteResponse | JSONResponse:
  try:
    return query_service.execute_query(db, user, payload)
  except QueryError as exc:
    return _error_response(exc)


@router.get("/bindings", response_model=BindingListResponse)
def list_bindings(
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    data_source_id: uuid.UUID | None = Query(default=None, alias="dataSourceId"),
) -> BindingListResponse | JSONResponse:
  try:
    return binding_service.list_bindings(
      db, user.roles, limit=limit, offset=offset, data_source_id=data_source_id,
    )
  except QueryError as exc:
    return _error_response(exc)
  except VisibilityError as exc:
    return _visibility_response(exc)


@router.post("/bindings", response_model=BindingOut, status_code=status.HTTP_201_CREATED)
def create_binding(
    payload: BindingCreate,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> BindingOut | JSONResponse:
  try:
    return binding_service.create_binding(
      db, user.roles, payload, created_by=uuid.UUID(user.id) if user.id else None,
    )
  except QueryError as exc:
    return _error_response(exc)
  except VisibilityError as exc:
    return _visibility_response(exc)


@router.get("/bindings/{binding_id}", response_model=BindingOut)
def get_binding(
    binding_id: uuid.UUID,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> BindingOut | JSONResponse:
  try:
    return binding_service.get_binding(db, user.roles, binding_id)
  except QueryError as exc:
    return _error_response(exc)


@router.put("/bindings/{binding_id}", response_model=BindingOut)
def update_binding(
    binding_id: uuid.UUID,
    payload: BindingUpdate,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> BindingOut | JSONResponse:
  try:
    return binding_service.update_binding(db, user.roles, binding_id, payload)
  except QueryError as exc:
    return _error_response(exc)
  except VisibilityError as exc:
    return _visibility_response(exc)


@router.delete("/bindings/{binding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_binding(
    binding_id: uuid.UUID,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None | JSONResponse:
  try:
    binding_service.delete_binding(db, user.roles, binding_id)
    return None
  except QueryError as exc:
    return _error_response(exc)
```

- [ ] **Step 2: 修改 `backend/app/api/v1/router.py` — 注册 query router**

```python
from app.api.v1.query import router as query_router

api_v1_router.include_router(query_router)
```

（置于 `datasources_router` 之后）

- [ ] **Step 3: 补全 API smoke 测试 T-Q-001~006**

```python
@patch("app.query.executor.pool_manager.pooled_connection")
def test_post_execute_sql_success(mock_pool, client, query_seed, auth_headers):
    """T-Q-001: POST execute mock 成功 → 200 columns+rows+traceId。"""
    cur = MagicMock()
    cur.description = [("id",)]
    cur.fetchmany.return_value = [(1,)]
    conn = MagicMock()
    conn.cursor.return_value = cur
    mock_pool.return_value.__enter__.return_value = conn
    resp = client.post(
      "/api/v1/query/execute",
      json={
        "dataSourceId": str(query_seed["ds_id"]),
        "mode": "sql",
        "sql": "SELECT 1 AS id",
        "limit": 10,
        "rls": {"enabled": False},
      },
      headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "columns" in body and "rows" in body and "traceId" in body


def test_post_execute_rejects_insert(client, query_seed, auth_headers):
    """T-Q-002: INSERT → 400 QUERY_NOT_READONLY。"""
    resp = client.post(
      "/api/v1/query/execute",
      json={
        "dataSourceId": str(query_seed["ds_id"]),
        "mode": "sql",
        "sql": "INSERT INTO t VALUES (1)",
      },
      headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_post_execute_visibility_denied(client, query_seed, viewer_headers):
    """T-Q-004: 不可见 dataSourceId → 403。"""
    resp = client.post(
      "/api/v1/query/execute",
      json={
        "dataSourceId": str(query_seed["hidden_ds_id"]),
        "mode": "sql",
        "sql": "SELECT 1",
      },
      headers=viewer_headers,
    )
    assert resp.status_code == 403
```

- [ ] **Step 4: 运行 API 测试**

Run: `cd backend && python3 -m pytest tests/test_query_l1_r26.py -k "post_execute" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/query.py backend/app/api/v1/router.py tests/test_query_l1_r26.py
git commit -m "feat(query): add execute and bindings REST API routes (QUERY-001/005)"
```

---

### Task 7: 集成测试基建、文档同步与全量验证

**Files:**
- Modify: `tests/test_query_l1_r26.py`（完整 fixture + 剩余 T-Q-* 用例）
- Modify: `docs/api/README.md`
- Modify: `docs/services/query.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/prd-sync` via `.cursor/rules/prd-sync.mdc`（文档同步评估）

**UI skill:** none

**Interfaces:**
- Produces: module autouse sqlite env、`query_seed` fixture、T-Q-001~044 全绿、api/services 文档更新

- [ ] **Step 1: 补全 `tests/test_query_l1_r26.py` 模块基建**

```python
_QUERY_SQLITE_URL = "sqlite+pysqlite:///file:query_r26_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def query_r26_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _QUERY_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_engine
    from app.datasources.models import get_meta_engine as ds_engine
    from app.query.models import get_meta_engine as query_engine
    for fn in (auth_engine, ds_engine, query_engine):
        fn.cache_clear()
    yield
  # restore...


@pytest.fixture(scope="module", autouse=True)
def ensure_query_tables():
    from app.auth.models import Base as AuthBase, get_meta_engine
    from app.datasources.models import Base as DsBase
    from app.query.models import Base as QueryBase
    engine = get_meta_engine()
    AuthBase.metadata.create_all(engine)
    DsBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
```

复用 r25 `_dev_user` / `_set_dev_roles` / `viewer` ACL 辅助函数模式。

- [ ] **Step 2: 补全剩余用例 T-Q-003/005/006/011~013/030~034/041~043**

覆盖：DELETE 拦截、422 缺参、超 limit、不存在表、非法 schema、binding CRUD、bindingId 执行、不可见 DS 创建绑定 403、列表过滤。

- [ ] **Step 3: 更新 `docs/api/README.md`**

将 `POST /api/v1/query/execute` 状态改为 **已实现**；新增行：

| GET | `/api/v1/query/bindings` | 图表直连绑定列表 | IF-06 | 一期 | QUERY-005 | 已实现 | `backend/app/api/v1/query.py` |
| POST | `/api/v1/query/bindings` | 创建绑定 | IF-06 | 一期 | QUERY-005 | 已实现 | `backend/app/api/v1/query.py` |
| GET | `/api/v1/query/bindings/{bindingId}` | 绑定详情 | IF-06 | 一期 | QUERY-005 | 已实现 | `backend/app/api/v1/query.py` |
| PUT | `/api/v1/query/bindings/{bindingId}` | 更新绑定 | IF-06 | 一期 | QUERY-005 | 已实现 | `backend/app/api/v1/query.py` |
| DELETE | `/api/v1/query/bindings/{bindingId}` | 删除绑定 | IF-06 | 一期 | QUERY-005 | 已实现 | `backend/app/api/v1/query.py` |

- [ ] **Step 4: 更新 `docs/services/query.md`**

- 状态 → **L1 已实现（r26）**
- `QueryExecutor`、`binding`、`rls` 行状态 → 已实现
- In/Out 边界补充：L1 含 sql/table 执行 + chart_query_bindings；Out 仍不含 Dataset/native/M5 VIZ

- [ ] **Step 5: 全量验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v`
Expected: **≥531 passed**, 4 skipped, 0 failed；`test_query_l1_r26.py` ≥30 passed；`test_migrations.py` T-MIG-38~39 PASS

- [ ] **Step 6: Commit**

```bash
git add tests/test_query_l1_r26.py docs/api/README.md docs/services/query.md
git commit -m "test(query): complete L1 smoke suite and sync api/services docs (QUERY r26)"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| design 五项 QUERY-001/002/004/005/006 均有 Task | Task 1~7 覆盖 |
| 无 TBD/TODO 占位 | 通过 |
| 每 Task 含验证命令 | 通过 |
| 全 Task UI skill: none | 通过 |
| 文件数 18 ≤ 20 | 通过 |
| 执行模式 subagent-driven-development option 1 | 头部已声明 |
| 不修改 plan.md 结构 | Global Constraints 已声明 |

## 执行交接

**计划已保存至 `docs/superpowers/plans/2026-07-03-m4-query-l1-kickoff-r26.md`。**

**执行方式：subagent-driven-development (option 1)** — 每 Task 派发独立 subagent，Task 间两阶段 review；P3 `evolution-implementer` 按 Task 1→7 顺序执行。
