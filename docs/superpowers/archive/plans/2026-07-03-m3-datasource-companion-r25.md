# M3 数据源平台 companion kickoff r25 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/`、`backend/app/api/v1/datasources.py`、`tests/test_datasources_companion_r25.py`、`docs/api/README.md`、`docs/services/datasources.md`
> **子项：** DS-008, DS-007, DS-004, CONN-002, DS-006
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 交付 M3 companion L1 五件套 — PostgreSQL 方言 + MySQL 元数据对称、`GET /types` 类型发现、按 `dataSourceId` 隔离连接池、schema/table/column 元数据 API、数据源级 ACL 守卫；约 25+ 项 `test_datasources_companion_r25.py` smoke + r24 回归全绿。

**Architecture:** 延续 r22–r24 分层 — entry（`api/v1/datasources.py`）薄层 + `service.py` 编排 + `dialects`/`registry`/`pool`/`metadata`/`acl` domain；元数据浏览经 `pool_manager.pooled_connection` + 方言 `list_*`；ACL 薄封装 M2 `auth/resources/service.py` + admin bypass；连通测试草稿路径保持直连不经池。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pymysql · psycopg 3 · pytest · ruff

## Global Constraints

- 纯后端 L1；**不修改** `fe/`、`main.py`；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；**不新增** Alembic migration
- 不含 Admin UI、M7 RLS 执行链、Dataset/QUERY 出数、TiDB/StarRocks
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": null}`
- `GET /api/v1/datasources/types` **须在** `/{data_source_id}` 之前注册
- 连通测试 HTTP 恒 200 + `ok` 字段（资源不存在 404 仅 `/{id}/test` 与元数据 404）
- 元数据错误凭据 → 502 `METADATA_CONNECTION_FAILED`；响应体无 `password` 子串
- 文件预算：新建 **6** + 修改 **9** + 测试 **1** + 文档 **2** = **18 ≤ 20**
- 验证基线：r24 `pytest` **476 passed** + 4 skipped；本轮目标 ≥501 passed
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: 方言协议扩展、PostgreSQL 连接器与 MySQL 元数据对称（CONN-002 + DS-004 方言层）

**Files:**
- Modify: `backend/app/datasources/dialects/base.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `backend/app/datasources/dialects/postgres.py`
- Modify: `backend/app/datasources/dialects/mysql.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`
- Test: `tests/test_datasources_companion_r25.py`（CONN 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `pymysql`, `psycopg`（已在 `pyproject.toml`）
- Produces: `SchemaInfo`, `TableInfo`, `ColumnInfo`, 扩展 `DialectConnector`（`display_name`, `open_connection`, `list_schemas`, `list_tables`, `list_columns`）, `PostgresConnector`, `map_postgres_operational_error`, `MysqlConnector` 增 `schema_browser` + `list_*`

- [ ] **Step 1: 扩展 `backend/app/datasources/dialects/base.py`**

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class TestConnectionResult:
    ok: bool
    message: str
    latency_ms: int | None
    code: str | None = None


@dataclass(frozen=True)
class SchemaInfo:
    name: str


@dataclass(frozen=True)
class TableInfo:
    name: str
    type: str


@dataclass(frozen=True)
class ColumnInfo:
    name: str
    data_type: str
    nullable: bool


class DialectConnector(Protocol):
    @property
    def type(self) -> str: ...

    @property
    def category(self) -> str: ...

    @property
    def capabilities(self) -> tuple[str, ...]: ...

    @property
    def display_name(self) -> str: ...

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        charset: str = "utf8mb4",
        collation: str | None = None,
        ssl_mode: str = "preferred",
        connect_timeout_sec: float | None = None,
        read_timeout_sec: float | None = None,
    ) -> TestConnectionResult: ...

    def open_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "preferred",
    ) -> Any: ...

    def list_schemas(self, connection: Any) -> list[SchemaInfo]: ...

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]: ...

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]: ...
```

- [ ] **Step 2: 扩展 `backend/app/datasources/dialects/errors.py` 增 PG 映射**

```python
PG_CONN_REFUSED = "PG_CONN_REFUSED"
PG_AUTH_FAILED = "PG_AUTH_FAILED"
PG_TIMEOUT = "PG_TIMEOUT"
PG_UNKNOWN_DATABASE = "PG_UNKNOWN_DATABASE"
PG_SSL_ERROR = "PG_SSL_ERROR"
PG_UNKNOWN = "PG_UNKNOWN"

_SSL_MODE_TO_PG = {
    "disabled": "disable",
    "preferred": "prefer",
    "required": "require",
}


def pg_sslmode(ssl_mode: str) -> str:
    return _SSL_MODE_TO_PG.get(ssl_mode, "prefer")


def map_postgres_operational_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    sqlstate = getattr(exc, "sqlstate", None) or getattr(exc, "pgcode", None)
    if sqlstate == "28P01":
        return PG_AUTH_FAILED, detail
    if sqlstate == "3D000":
        return PG_UNKNOWN_DATABASE, detail
    lowered = detail.lower()
    if "timeout" in lowered or "timed out" in lowered:
        return PG_TIMEOUT, detail
    if "ssl" in lowered:
        return PG_SSL_ERROR, detail
    if "connection refused" in lowered or "could not connect" in lowered:
        return PG_CONN_REFUSED, detail
    return PG_UNKNOWN, detail
```

- [ ] **Step 3: 创建 `backend/app/datasources/dialects/postgres.py`**

```python
from __future__ import annotations

import time
from typing import Any, Literal

import psycopg

from app.core.config import get_settings
from app.datasources.dialects.base import (
    ColumnInfo,
    SchemaInfo,
    TableInfo,
    TestConnectionResult,
)
from app.datasources.dialects.errors import map_postgres_operational_error, pg_sslmode

_SSL_MODES = frozenset({"disabled", "preferred", "required"})


class PostgresConnector:
    type = "postgresql"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "PostgreSQL"

    def _connect_kwargs(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float,
        ssl_mode: str,
    ) -> dict:
        settings = get_settings()
        clamped = max(1.0, min(float(connect_timeout_sec), float(min(30, settings.query_timeout_seconds))))
        return {
            "host": host,
            "port": port,
            "dbname": database,
            "user": username,
            "password": password,
            "connect_timeout": int(clamped),
            "sslmode": pg_sslmode(ssl_mode),
        }

    def open_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "preferred",
    ) -> Any:
        if ssl_mode not in _SSL_MODES:
            raise ValueError(f"invalid ssl_mode: {ssl_mode}")
        return psycopg.connect(**self._connect_kwargs(
            host=host, port=port, database=database, username=username, password=password,
            connect_timeout_sec=connect_timeout_sec, ssl_mode=ssl_mode,
        ))

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        charset: str = "utf8mb4",
        collation: str | None = None,
        ssl_mode: Literal["disabled", "preferred", "required"] = "preferred",
        connect_timeout_sec: float | None = None,
        read_timeout_sec: float | None = None,
    ) -> TestConnectionResult:
        raw = connect_timeout_sec if connect_timeout_sec is not None else timeout_sec
        started = time.perf_counter()
        try:
            conn = self.open_connection(
                host=host, port=port, database=database, username=username, password=password,
                connect_timeout_sec=raw, ssl_mode=ssl_mode,
            )
            try:
                conn.execute("SELECT 1")
            finally:
                conn.close()
        except psycopg.OperationalError as exc:
            code, detail = map_postgres_operational_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY 1"
            )
            return [SchemaInfo(name=row[0]) for row in cur.fetchall()]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT table_name, table_type FROM information_schema.tables "
                "WHERE table_schema = %s AND table_type IN ('BASE TABLE','VIEW') ORDER BY 1",
                (schema,),
            )
            return [
                TableInfo(name=row[0], type="view" if row[1] == "VIEW" else "table")
                for row in cur.fetchall()
            ]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
                "WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position",
                (schema, table),
            )
            return [
                ColumnInfo(name=row[0], data_type=row[1], nullable=row[2] == "YES")
                for row in cur.fetchall()
            ]
```

- [ ] **Step 4: 扩展 `backend/app/datasources/dialects/mysql.py` — `display_name`、`open_connection`、`list_*`、`capabilities`**

在 `MysqlConnector` 类中：
- 设 `display_name = "MySQL"`
- 将 `capabilities = ("connectivity_test", "schema_browser")`
- 抽取 `_build_connect_kwargs(...)` 供 `test_connection` 与 `open_connection` 共用
- 新增：

```python
    def open_connection(self, *, host, port, database, username, password,
                        connect_timeout_sec=5.0, ssl_mode="preferred", charset="utf8mb4",
                        collation=None, read_timeout_sec=None) -> Any:
        kwargs = self._build_connect_kwargs(...)
        return pymysql.connect(**kwargs)

    def list_schemas(self, connection) -> list[SchemaInfo]:
        with connection.cursor() as cur:
            cur.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY 1")
            return [SchemaInfo(name=row[0]) for row in cur.fetchall()]

    def list_tables(self, connection, schema: str) -> list[TableInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_SCHEMA = %s ORDER BY 1",
                (schema,),
            )
            return [
                TableInfo(name=row[0], type="view" if row[1] == "VIEW" else "table")
                for row in cur.fetchall()
            ]

    def list_columns(self, connection, schema: str, table: str) -> list[ColumnInfo]:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION",
                (schema, table),
            )
            return [
                ColumnInfo(name=row[0], data_type=row[1], nullable=row[2] == "YES")
                for row in cur.fetchall()
            ]
```

- [ ] **Step 5: 更新 `backend/app/datasources/dialects/__init__.py` 与 `backend/app/datasources/__init__.py`**

```python
# dialects/__init__.py
from app.datasources.dialects.base import (
    ColumnInfo, DialectConnector, SchemaInfo, TableInfo, TestConnectionResult,
)
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.dialects.postgres import PostgresConnector

__all__ = [
    "ColumnInfo", "DialectConnector", "MysqlConnector", "PostgresConnector",
    "SchemaInfo", "TableInfo", "TestConnectionResult",
]

# datasources/__init__.py
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.dialects.postgres import PostgresConnector
from app.datasources.registry import register_dialect

def register_builtin_dialects() -> None:
    register_dialect(MysqlConnector())
    register_dialect(PostgresConnector())

register_builtin_dialects()
```

- [ ] **Step 6: 写入 CONN 失败测试于 `tests/test_datasources_companion_r25.py`**

```python
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import psycopg
import pytest

from app.core.config import get_settings
from app.datasources import register_builtin_dialects
from app.datasources.dialects.errors import PG_AUTH_FAILED
from app.datasources.dialects.postgres import PostgresConnector
from app.datasources.registry import registry

_DS_SQLITE_URL = "sqlite+pysqlite:///file:ds_r25_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_r25_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DS_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import get_meta_engine
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture(autouse=True)
def reset_registry():
    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()


def test_registry_get_postgresql():
    """T-CONN-P01: registry.get('postgresql') 含 schema_browser。"""
    connector = registry.get("postgresql")
    assert connector.type == "postgresql"
    assert "schema_browser" in connector.capabilities


@patch("app.datasources.dialects.postgres.psycopg.connect")
def test_postgres_test_connection_ok(mock_connect):
    """T-CONN-P02: mock connect 成功 → ok=true。"""
    mock_conn = MagicMock()
    mock_connect.return_value = mock_conn
    result = PostgresConnector().test_connection(
        host="h", port=5432, database="d", username="u", password="p",
    )
    assert result.ok is True
    mock_conn.close.assert_called_once()


@patch("app.datasources.dialects.postgres.psycopg.connect")
def test_postgres_auth_failed_no_password_in_message(mock_connect):
    """T-CONN-P03: 认证失败 → PG_AUTH_FAILED，message 无密码。"""
    mock_connect.side_effect = psycopg.OperationalError("auth failed for user")
    mock_connect.side_effect.sqlstate = "28P01"
    result = PostgresConnector().test_connection(
        host="h", port=5432, database="d", username="u", password="secret",
    )
    assert result.ok is False
    assert result.code == PG_AUTH_FAILED
    assert "secret" not in result.message


@patch.object(PostgresConnector, "open_connection")
def test_postgres_list_schemas(mock_open):
    """T-CONN-P04: list_schemas mock cursor。"""
    cur = MagicMock()
    cur.fetchall.return_value = [("public",)]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    mock_open.return_value = conn
    items = PostgresConnector().list_schemas(conn)
    assert [s.name for s in items] == ["public"]
```

- [ ] **Step 7: 运行 CONN 测试**

Run: `cd backend && python3 -m pytest tests/test_datasources_companion_r25.py -k "CONN or postgres or postgresql" -v`
Expected: PASS（4 tests）

- [ ] **Step 8: Commit**

```bash
git add backend/app/datasources/dialects/ backend/app/datasources/__init__.py tests/test_datasources_companion_r25.py
git commit -m "feat(datasources): CONN-002 PostgreSQL connector + schema_browser protocol"
```

---

### Task 2: 已注册类型清单 API（DS-007）

**Files:**
- Modify: `backend/app/datasources/registry.py`
- Modify: `backend/app/datasources/schemas.py`
- Modify: `backend/app/api/v1/datasources.py`
- Test: `tests/test_datasources_companion_r25.py`（DS-TY 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `DialectConnector.display_name`, `registry.list_types()`
- Produces: `ConnectorDescriptor.display_name`, `export_type_catalog()`, `ConnectorTypeOut`, `ConnectorTypeListResponse`, `GET /api/v1/datasources/types`

- [ ] **Step 1: 扩展 `registry.py` — `ConnectorDescriptor.display_name` 与 `export_type_catalog`**

```python
@dataclass(frozen=True)
class ConnectorDescriptor:
    type: str
    category: str
    capabilities: tuple[str, ...]
    display_name: str

# list_types() 内：
ConnectorDescriptor(
    type=c.type,
    category=c.category,
    capabilities=c.capabilities,
    display_name=c.display_name,
)

def export_type_catalog() -> list[dict]:
    return [
        {
            "type": item.type,
            "displayName": item.display_name,
            "category": item.category,
            "capabilities": list(item.capabilities),
        }
        for item in registry.list_types()
    ]
```

- [ ] **Step 2: 在 `schemas.py` 追加 types DTO**

```python
class ConnectorTypeOut(BaseModel):
    type: str
    display_name: str = Field(serialization_alias="displayName")
    category: str
    capabilities: list[str]

    model_config = {"populate_by_name": True}


class ConnectorTypeListResponse(BaseModel):
    items: list[ConnectorTypeOut]
```

- [ ] **Step 3: 在 `api/v1/datasources.py` 注册 `GET /types`（置于 `/{data_source_id}` 之前）**

```python
from app.datasources.schemas import ConnectorTypeListResponse, ConnectorTypeOut
from app.datasources.registry import export_type_catalog

@router.get("/types", response_model=ConnectorTypeListResponse)
def list_connector_types(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ConnectorTypeListResponse:
    items = [ConnectorTypeOut.model_validate(item) for item in export_type_catalog()]
    return ConnectorTypeListResponse(items=items)
```

- [ ] **Step 4: 追加 types 测试**

```python
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

AUTH = {"Authorization": "Bearer dev"}


def test_types_lists_mysql_and_postgresql(client):
    """T-DS-TY01/TY02: GET /types 含 mysql 与 postgresql + capabilities。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    types = {item["type"]: item for item in resp.json()["items"]}
    assert "mysql" in types and "postgresql" in types
    for key in ("displayName", "category", "capabilities"):
        assert key in types["mysql"]
    assert "connectivity_test" in types["mysql"]["capabilities"]


def test_types_empty_registry(client):
    """T-DS-TY03: 清空注册表 → items: []。"""
    registry._connectors.clear()
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["items"] == []


def test_types_unauthenticated_401(client):
    """T-DS-TY04: 未认证 → 401。"""
    assert client.get("/api/v1/datasources/types").status_code == 401
```

- [ ] **Step 5: 运行 types 测试**

Run: `cd backend && python3 -m pytest tests/test_datasources_companion_r25.py -k "types" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/registry.py backend/app/datasources/schemas.py backend/app/api/v1/datasources.py tests/test_datasources_companion_r25.py
git commit -m "feat(datasources): DS-007 GET /datasources/types catalog API"
```

---

### Task 3: 连接池按 dataSourceId 隔离（DS-006）

**Files:**
- Create: `backend/app/datasources/pool.py`
- Modify: `backend/app/datasources/schemas.py`（`poolSize`）
- Modify: `backend/app/datasources/service.py`（`delete_data_source` 调用 `evict_pool`）
- Test: `tests/test_datasources_companion_r25.py`（DS-PL 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `DialectConnector.open_connection`
- Produces: `DataSourcePoolManager`, `pool_manager`, `pooled_connection`, `evict_pool`, `active_pool_count`, `ConnectionOptions.pool_size`

- [ ] **Step 1: 创建 `backend/app/datasources/pool.py`**

```python
from __future__ import annotations

import queue
import threading
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

from app.datasources.dialects.base import DialectConnector

DEFAULT_POOL_SIZE = 2


@dataclass
class _PoolEntry:
    queue: queue.Queue[Any] = field(default_factory=queue.Queue)
    pool_size: int = DEFAULT_POOL_SIZE
    connect_count: int = 0


class DataSourcePoolManager:
    def __init__(self) -> None:
        self._entries: dict[uuid.UUID, _PoolEntry] = {}
        self._lock = threading.RLock()

    def active_pool_count(self) -> int:
        with self._lock:
            return len(self._entries)

    def evict_pool(self, data_source_id: uuid.UUID) -> None:
        with self._lock:
            entry = self._entries.pop(data_source_id, None)
        if entry is None:
            return
        while True:
            try:
                conn = entry.queue.get_nowait()
            except queue.Empty:
                break
            try:
                conn.close()
            except Exception:
                pass

    @contextmanager
    def pooled_connection(
        self,
        data_source_id: uuid.UUID,
        *,
        connector: DialectConnector,
        connect_kwargs: dict,
        pool_size: int = DEFAULT_POOL_SIZE,
    ) -> Iterator[Any]:
        pool_size = max(1, min(pool_size, 10))
        with self._lock:
            entry = self._entries.get(data_source_id)
            if entry is None:
                entry = _PoolEntry(pool_size=pool_size)
                self._entries[data_source_id] = entry
            entry.pool_size = pool_size
        conn = None
        try:
            try:
                conn = entry.queue.get_nowait()
            except queue.Empty:
                conn = connector.open_connection(**connect_kwargs)
                entry.connect_count += 1
            yield conn
        finally:
            if conn is not None:
                try:
                    entry.queue.put_nowait(conn)
                except queue.Full:
                    try:
                        conn.close()
                    except Exception:
                        pass


pool_manager = DataSourcePoolManager()
```

- [ ] **Step 2: `schemas.py` — `ConnectionOptions` 增 `pool_size`**

```python
pool_size: int = Field(default=2, ge=1, le=10, alias="poolSize")
```

- [ ] **Step 3: `service.py` — `delete_data_source` 末尾调用 `evict_pool`**

```python
from app.datasources.pool import pool_manager

def delete_data_source(session: Session, data_source_id: uuid.UUID) -> None:
    # ... 现有逻辑 ...
    session.commit()
    pool_manager.evict_pool(data_source_id)
```

- [ ] **Step 4: 追加池测试**

```python
import threading
import uuid
from unittest.mock import MagicMock

from app.datasources.pool import DataSourcePoolManager


def test_pool_reuses_connection_same_id():
    """T-DS-PL01: 同一 dataSourceId 复用连接。"""
    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    conn1 = MagicMock()
    connector.open_connection.return_value = conn1
    kwargs = {"host": "a", "port": 5432, "database": "d", "username": "u", "password": "p"}
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs) as c1:
        pass
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs) as c2:
        pass
    assert connector.open_connection.call_count == 1
    assert c2 is conn1


def test_pool_isolates_different_ids():
    """T-DS-PL02: 不同 dataSourceId 不混用 connect 参数。"""
    mgr = DataSourcePoolManager()
    connector = MagicMock()
    connector.open_connection.side_effect = [MagicMock(name="a"), MagicMock(name="b")]
    with mgr.pooled_connection(uuid.uuid4(), connector=connector, connect_kwargs={"host": "a", "port": 1, "database": "d", "username": "u", "password": "p"}):
        pass
    with mgr.pooled_connection(uuid.uuid4(), connector=connector, connect_kwargs={"host": "b", "port": 2, "database": "d", "username": "u", "password": "p"}):
        pass
    assert connector.open_connection.call_count == 2


def test_evict_pool_closes_and_decrements():
    """T-DS-PL03: evict_pool 关闭连接并减计数。"""
    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    conn = MagicMock()
    connector.open_connection.return_value = conn
    kwargs = {"host": "h", "port": 1, "database": "d", "username": "u", "password": "p"}
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs):
        pass
    assert mgr.active_pool_count() == 1
    mgr.evict_pool(ds_id)
    assert mgr.active_pool_count() == 0
    conn.close.assert_called()


def test_pool_concurrent_smoke():
    """T-DS-PL04: 4 线程同一 id 无异常。"""
    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    connector.open_connection.return_value = MagicMock()
    kwargs = {"host": "h", "port": 1, "database": "d", "username": "u", "password": "p"}
    errors: list[Exception] = []

    def worker():
        try:
            with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs):
                pass
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []
```

- [ ] **Step 5: 运行池测试**

Run: `cd backend && python3 -m pytest tests/test_datasources_companion_r25.py -k "pool" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/pool.py backend/app/datasources/schemas.py backend/app/datasources/service.py tests/test_datasources_companion_r25.py
git commit -m "feat(datasources): DS-006 per-dataSourceId connection pool"
```

---

### Task 4: Schema 元数据浏览 API（DS-004）

**Files:**
- Create: `backend/app/datasources/metadata/__init__.py`
- Create: `backend/app/datasources/metadata/service.py`
- Modify: `backend/app/datasources/schemas.py`（元数据 DTO）
- Modify: `backend/app/datasources/service.py`（元数据入口函数）
- Modify: `backend/app/api/v1/datasources.py`（3 条元数据路由）
- Test: `tests/test_datasources_companion_r25.py`（DS-MD 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `pool_manager.pooled_connection`, `registry.get`, `decrypt_credential`, `acl.assert_visible`（Task 5 前可先 stub 或后接）
- Produces: `list_schemas`, `list_tables`, `list_columns` service 函数；`SchemaListResponse`, `TableListResponse`, `ColumnListResponse`；`GET .../schemas|tables|columns`

- [ ] **Step 1: `schemas.py` 元数据 DTO**

```python
class SchemaItemOut(BaseModel):
    name: str

class SchemaListResponse(BaseModel):
    items: list[SchemaItemOut]

class TableItemOut(BaseModel):
    name: str
    type: str

class TableListResponse(BaseModel):
    items: list[TableItemOut]

class ColumnItemOut(BaseModel):
    name: str
    data_type: str = Field(serialization_alias="dataType")
    nullable: bool

    model_config = {"populate_by_name": True}

class ColumnListResponse(BaseModel):
    items: list[ColumnItemOut]
```

- [ ] **Step 2: 创建 `metadata/__init__.py`（空或 re-export）**

```python
from app.datasources.metadata.service import list_columns, list_schemas, list_tables

__all__ = ["list_columns", "list_schemas", "list_tables"]
```

- [ ] **Step 3: 创建 `metadata/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.datasources.acl import assert_visible
from app.datasources.credentials import CredentialDecryptError, decrypt_credential
from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo
from app.datasources.models import DataSource
from app.datasources.pool import pool_manager
from app.datasources.registry import ConnectorNotFoundError, registry
from app.datasources.schemas import (
    ColumnItemOut, ColumnListResponse, ConnectionOptions,
    SchemaItemOut, SchemaListResponse, TableItemOut, TableListResponse,
)
from app.datasources.service import DataSourceError, _resolve_connection_options


def _load_row(session: Session, data_source_id: uuid.UUID) -> DataSource:
    row = session.get(DataSource, data_source_id)
    if row is None or row.deleted_at is not None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    return row


def _connector_and_kwargs(row: DataSource) -> tuple:
    try:
        connector = registry.get(row.type)
    except ConnectorNotFoundError as exc:
        raise DataSourceError("UNKNOWN_CONNECTOR_TYPE", f"Unknown connector type: {row.type}", 422) from exc
    if "schema_browser" not in connector.capabilities:
        raise DataSourceError("METADATA_NOT_SUPPORTED", "Connector does not support schema browsing", 422)
    try:
        password = decrypt_credential(row.password_encrypted)
    except CredentialDecryptError as exc:
        raise DataSourceError("CREDENTIAL_DECRYPT_FAILED", str(exc), 500) from exc
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


def _map_metadata_error(exc: Exception) -> DataSourceError:
    msg = str(exc)
    if "timeout" in msg.lower():
        return DataSourceError("METADATA_TIMEOUT", msg, 504)
    return DataSourceError("METADATA_CONNECTION_FAILED", msg, 502)


def list_schemas(session: Session, role_codes: list[str], data_source_id: uuid.UUID) -> SchemaListResponse:
    assert_visible(session, role_codes, data_source_id)
    row = _load_row(session, data_source_id)
    connector, kwargs, pool_size = _connector_and_kwargs(row)
    try:
        with pool_manager.pooled_connection(
            data_source_id, connector=connector, connect_kwargs=kwargs, pool_size=pool_size,
        ) as conn:
            items = connector.list_schemas(conn)
    except DataSourceError:
        raise
    except Exception as exc:
        raise _map_metadata_error(exc) from exc
    return SchemaListResponse(items=[SchemaItemOut(name=i.name) for i in items])


def list_tables(session: Session, role_codes: list[str], data_source_id: uuid.UUID, schema: str) -> TableListResponse:
    if not schema:
        raise DataSourceError("METADATA_INVALID_REQUEST", "schema query parameter is required", 400)
    assert_visible(session, role_codes, data_source_id)
    row = _load_row(session, data_source_id)
    connector, kwargs, pool_size = _connector_and_kwargs(row)
    try:
        with pool_manager.pooled_connection(
            data_source_id, connector=connector, connect_kwargs=kwargs, pool_size=pool_size,
        ) as conn:
            items = connector.list_tables(conn, schema)
    except DataSourceError:
        raise
    except Exception as exc:
        raise _map_metadata_error(exc) from exc
    return TableListResponse(items=[TableItemOut(name=i.name, type=i.type) for i in items])


def list_columns(
    session: Session, role_codes: list[str], data_source_id: uuid.UUID, schema: str, table: str,
) -> ColumnListResponse:
    if not schema or not table:
        raise DataSourceError("METADATA_INVALID_REQUEST", "schema and table query parameters are required", 400)
    assert_visible(session, role_codes, data_source_id)
    row = _load_row(session, data_source_id)
    connector, kwargs, pool_size = _connector_and_kwargs(row)
    try:
        with pool_manager.pooled_connection(
            data_source_id, connector=connector, connect_kwargs=kwargs, pool_size=pool_size,
        ) as conn:
            items = connector.list_columns(conn, schema, table)
    except DataSourceError:
        raise
    except Exception as exc:
        raise _map_metadata_error(exc) from exc
    return ColumnListResponse(
        items=[ColumnItemOut(name=i.name, data_type=i.data_type, nullable=i.nullable) for i in items]
    )
```

> **Note:** Task 4 Step 3 imports `acl.assert_visible` — 若 Task 5 未先完成，先创建最小 `acl.py` stub（`assert_visible` 为 no-op，`list_visible_ids` 返回 `None`），Task 5 再替换为完整实现。

- [ ] **Step 4: `api/v1/datasources.py` 追加元数据路由**

```python
from app.datasources.metadata import service as metadata_service

@router.get("/{data_source_id}/schemas", response_model=SchemaListResponse)
def get_schemas(data_source_id: uuid.UUID, user: Annotated[UserContext, Depends(get_current_user)], db: Annotated[Session, Depends(_db)]):
    try:
        return metadata_service.list_schemas(db, user.roles, data_source_id)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)

@router.get("/{data_source_id}/tables", response_model=TableListResponse)
def get_tables(data_source_id: uuid.UUID, schema: str, user: Annotated[UserContext, Depends(get_current_user)], db: Annotated[Session, Depends(_db)]):
    try:
        return metadata_service.list_tables(db, user.roles, data_source_id, schema)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)

@router.get("/{data_source_id}/columns", response_model=ColumnListResponse)
def get_columns(data_source_id: uuid.UUID, schema: str, table: str, user: Annotated[UserContext, Depends(get_current_user)], db: Annotated[Session, Depends(_db)]):
    try:
        return metadata_service.list_columns(db, user.roles, data_source_id, schema, table)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
```

- [ ] **Step 5: 元数据 API 测试（mock 方言 list_*）**

```python
from unittest.mock import patch
from app.datasources.models import DataSource, get_meta_session
from app.datasources.service import create_data_source
from app.datasources.schemas import DataSourceCreate

@pytest.fixture(autouse=True)
def ensure_ds_table():
    from app.datasources.models import Base, get_meta_engine
    from app.auth.models import Base as AuthBase
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    yield


def _create_ds():
    session = get_meta_session()
    try:
        return create_data_source(session, DataSourceCreate(
            name="Meta DS", code="meta-ds", type="postgresql",
            host="h", port=5432, database="d", username="u", password="p",
        ))
    finally:
        session.close()


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.postgres.PostgresConnector.list_schemas")
def test_metadata_schemas_200(mock_list, mock_pool, client):
    """T-DS-MD01: mock list_schemas → 200。"""
    from contextlib import contextmanager
    mock_list.return_value = [__import__("app.datasources.dialects.base", fromlist=["SchemaInfo"]).SchemaInfo(name="public")]
    @contextmanager
    def _cm(*a, **k):
        yield MagicMock()
    mock_pool.side_effect = _cm
    ds = _create_ds()
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["items"]


def test_metadata_tables_missing_schema_400(client):
    """T-DS-MD02: tables 无 schema → 400。"""
    ds = _create_ds()
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 6: 运行元数据测试**

Run: `cd backend && python3 -m pytest tests/test_datasources_companion_r25.py -k "metadata" -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/datasources/metadata/ backend/app/datasources/schemas.py backend/app/api/v1/datasources.py tests/test_datasources_companion_r25.py
git commit -m "feat(datasources): DS-004 schema metadata browse API"
```

---

### Task 5: 数据源授权守卫（DS-008）

**Files:**
- Create: `backend/app/datasources/acl.py`
- Modify: `backend/app/datasources/service.py`（列表过滤 + 单条守卫 + test 守卫）
- Modify: `backend/app/api/v1/datasources.py`（传入 `user.roles`）
- Test: `tests/test_datasources_companion_r25.py`（DS-AC 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `auth.resources.service.list_visible_resource_ids`, `ensure_resource_visible`, `VisibilityError`
- Produces: `ADMIN_BYPASS_ROLES`, `list_visible_ids`, `assert_visible`, `apply_list_filter`

- [ ] **Step 1: 创建 `backend/app/datasources/acl.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import false
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.auth.resources.service import (
    VisibilityError,
    ensure_resource_visible,
    list_visible_resource_ids,
)
from app.datasources.models import DataSource

ADMIN_BYPASS_ROLES = frozenset({"admin"})
RESOURCE_TYPE = "datasource"


def list_visible_ids(session: Session, role_codes: list[str]) -> list[uuid.UUID] | None:
    if ADMIN_BYPASS_ROLES.intersection(role_codes):
        return None
    return list_visible_resource_ids(session, role_codes, RESOURCE_TYPE)


def assert_visible(session: Session, role_codes: list[str], data_source_id: uuid.UUID) -> None:
    if ADMIN_BYPASS_ROLES.intersection(role_codes):
        return
    ensure_resource_visible(session, role_codes, RESOURCE_TYPE, data_source_id)


def apply_list_filter(stmt: Select, session: Session, role_codes: list[str]) -> Select:
    visible = list_visible_ids(session, role_codes)
    if visible is None:
        return stmt
    if not visible:
        return stmt.where(false())
    return stmt.where(DataSource.id.in_(visible))
```

- [ ] **Step 2: 修改 `service.py` — 所有读/写/测路径加 ACL**

```python
from app.datasources.acl import apply_list_filter, assert_visible

def list_data_sources(session, *, role_codes: list[str], limit=50, offset=0, type=None, q=None):
    base = select(DataSource)
    base = _active_filter(base)
    base = apply_list_filter(base, session, role_codes)
    # count_stmt 同样 apply_list_filter ...
    ...

def get_data_source(session, data_source_id, *, role_codes: list[str]):
    assert_visible(session, role_codes, data_source_id)
    ...

def update_data_source(session, data_source_id, payload, *, role_codes: list[str]):
    assert_visible(session, role_codes, data_source_id)
    ...

def patch_data_source(session, data_source_id, payload, *, role_codes: list[str]):
    assert_visible(session, role_codes, data_source_id)
    ...

def delete_data_source(session, data_source_id, *, role_codes: list[str]):
    assert_visible(session, role_codes, data_source_id)
    ...

def test_connection_by_id(session, data_source_id, *, role_codes: list[str]):
    assert_visible(session, role_codes, data_source_id)
    ...
```

- [ ] **Step 3: `api/v1/datasources.py` — 将 `user.roles` 传入 service**

示例：

```python
def list_data_sources(user: Annotated[UserContext, Depends(get_current_user)], db: ..., ...):
    return ds_service.list_data_sources(db, role_codes=user.roles, limit=limit, offset=offset, type=type, q=q)
```

对所有 `get/update/patch/delete/test_connection_saved` 同样传入 `role_codes=user.roles`。

- [ ] **Step 4: ACL 集成测试**

```python
def test_acl_admin_sees_all(client, auth_headers):
    """T-DS-AC01: admin 列表见全部。"""
    # 创建 2 个数据源；admin headers 列表 total>=2
    ...

def test_acl_viewer_only_granted(client, auth_headers):
    """T-DS-AC02: viewer 仅见 grant id。"""
    # 创建 viewer 角色 + grant 一个 id；另一 id 不可见
    ...

def test_acl_viewer_forbidden_detail(client, auth_headers):
    """T-DS-AC03: viewer GET 他人 id → 403 RESOURCE_FORBIDDEN。"""
    resp = client.get(f"/api/v1/datasources/{other_id}", headers=viewer_headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "RESOURCE_FORBIDDEN"

def test_acl_viewer_forbidden_test(client, auth_headers):
    """T-DS-AC04: viewer POST test 他人 id → 403。"""
    ...

def test_acl_revoke_grant_forbidden(client, auth_headers):
    """T-DS-AC05: 撤权后 403。"""
    # 参考 test_auth_rbac_l1 grant 生命周期
    ...
```

完整 fixture 模式：复用 `test_auth_rbac_l1.py` 的 `client`/`auth_headers`；通过 `POST /api/v1/roles` + `POST /api/v1/resource-grants` 建 viewer 与 grant；`Bearer dev` 默认 admin。

- [ ] **Step 5: 运行 ACL 测试**

Run: `cd backend && python3 -m pytest tests/test_datasources_companion_r25.py -k "acl" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/acl.py backend/app/datasources/service.py backend/app/api/v1/datasources.py tests/test_datasources_companion_r25.py
git commit -m "feat(datasources): DS-008 datasource ACL visibility guards"
```

---

### Task 6: 集成 smoke 补全与全量回归（五域验收）

**Files:**
- Modify: `tests/test_datasources_companion_r25.py`（补全 T-DS-MD03~05、T-DS-PL05、剩余边界）
- Modify: `backend/app/datasources/service.py`（确认 `delete_data_source` + `evict_pool` 路径）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 补全元数据失败路径测试**

```python
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
def test_metadata_bad_credential_502_no_password(mock_pool, client):
    """T-DS-MD04: 连接失败 502，响应无 password。"""
    mock_pool.side_effect = Exception("connection failed")
    ds = _create_ds()
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"
    assert "password" not in resp.text.lower()


@patch("app.datasources.dialects.postgres.PostgresConnector.list_columns")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
def test_metadata_columns_200(mock_pool, mock_cols, client):
    """T-DS-MD03: columns mock 返回列定义。"""
    from app.datasources.dialects.base import ColumnInfo
    mock_cols.return_value = [ColumnInfo(name="id", data_type="uuid", nullable=False)]
    # contextmanager mock + GET columns?schema=s&table=t → 200
    ...


def test_metadata_forbidden_403(client, auth_headers):
    """T-DS-MD05: 未授权用户 → 403。"""
    # viewer 无 grant 访问 schemas
    ...
```

- [ ] **Step 2: `test_delete_evicts_pool`（T-DS-PL05）**

```python
@patch("app.datasources.pool.pool_manager.evict_pool")
def test_delete_data_source_evicts_pool(mock_evict, client):
  ds = _create_ds()
  client.delete(f"/api/v1/datasources/{ds.id}", headers=AUTH)
  mock_evict.assert_called_once_with(ds.id)
```

- [ ] **Step 3: 全量 companion + 回归**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_datasources_companion_r25.py -v --tb=short`
Expected: ≥25 passed

Run: `cd backend && python3 -m pytest -q`
Expected: ≥501 passed, 4 skipped（不低于 r24 基线）

- [ ] **Step 4: Commit**

```bash
git add tests/test_datasources_companion_r25.py
git commit -m "test(datasources): r25 companion smoke suite complete"
```

---

### Task 7: 文档同步（API + 域附录）

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（触及 `docs/api` 与 `docs/services`）

**UI skill:** none

- [ ] **Step 1: 更新 `docs/api/README.md`**

将以下路由状态从「规划」改为「已实现」，补代码锚点 `backend/app/api/v1/datasources.py`：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/datasources/types` | 已注册连接器类型清单 |
| GET | `/api/v1/datasources/{id}/schemas` | Schema 列表 |
| GET | `/api/v1/datasources/{id}/tables` | 表列表（`schema` 必填） |
| GET | `/api/v1/datasources/{id}/columns` | 列列表（`schema`+`table` 必填） |

CONN-002：登记 `postgresql` 方言 `backend/app/datasources/dialects/postgres.py`。

- [ ] **Step 2: 更新 `docs/services/datasources.md`**

在职责表增：类型发现（DS-007）、元数据浏览（DS-004）、连接池隔离（DS-006）、ACL 可见性（DS-008）、PostgreSQL 方言（CONN-002）。

边界 In：上述 L1 API；Out：M7 RLS 执行、Admin UI、Dataset 元数据。

依赖：上游 `auth/resources`（grant 可见性）；下游 M4 query（消费元数据）。

实现状态 → M3 companion r25 已交付。

- [ ] **Step 3: 验证文档无断链**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -q`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/datasources.md
git commit -m "docs(datasources): sync API registry and services appendix for r25"
```

---

## Spec Self-Review

| 设计子项 | 对应 Task | 验收 ID |
|----------|-----------|---------|
| CONN-002 PostgreSQL | Task 1 | T-CONN-P01~P04 |
| DS-007 types API | Task 2 | T-DS-TY01~TY04 |
| DS-006 连接池 | Task 3, 6 | T-DS-PL01~PL05 |
| DS-004 元数据 | Task 4, 6 | T-DS-MD01~MD05 |
| DS-008 ACL | Task 5, 6 | T-DS-AC01~AC05 |

- [x] 7 Task，18 文件，无 TBD/TODO
- [x] 每 Task 含验证命令与 **UI skill: none**
- [x] 执行模式固定 subagent-driven-development (option 1)
- [x] 依赖链：方言 → types → pool → metadata → acl → smoke → docs
