# M11 关系型/OLAP 连接器 L1 kickoff r36 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/hive.py`、`clickhouse.py`、`sqlserver.py`、`doris.py`、`oracle.py`、`errors.py`、`dialects/__init__.py`、`backend/app/datasources/__init__.py`、`backend/pyproject.toml`、`tests/test_connectors_gov_r36.py`、`docs/services/datasources.md`
> **子项：** CONN-003, CONN-007, CONN-005, CONN-008, CONN-004
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** M11 L1 kickoff — 五方言 Hive/ClickHouse/SQL Server/Doris/Oracle 注册至 `ConnectorRegistry`，实现 `test_connection` + schema 自省 + `export_type_catalog()` 可见；`test_connectors_gov_r36.py` ≥25 条 + r35 35/35 + r34 15/15 回归全绿。

**Architecture:** 镜像 r34/r35 方言插件模式 — Doris/StarRocks 对称 MySQL 协议委托；Hive/ClickHouse/Oracle/SQL Server 独立驱动模块 + lazy import；`errors.py` 增 `map_sqlserver_operational_error` / `map_oracle_error`；`register_builtin_dialects()` 追加五 `register_dialect` 调用，不修改 `ConnectorRegistry` 核心类（NFR-04）。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pyhive · clickhouse-connect · pymssql · oracledb · pymysql（Doris 委托）· pytest · ruff

## Global Constraints

- 纯后端 L1 kickoff；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 Alembic migration；不触及 `fe/`
- `docs/automate/prd/F04-CONN.md` **P5 对账**（非 P3）
- 错误码前缀：`HIVE_*`、`CLICKHOUSE_*`、`SQLSERVER_*`、`DORIS_*`、`ORACLE_*`
- `test_connection` 失败：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`（与 DS-003 一致）
- 常量：`CLICKHOUSE_MAX_COLUMNS=500`；Doris 默认 port 9030；Hive 10000；ClickHouse 8123；SQL Server 1433；Oracle 1521
- 文件预算：新建 **6** + 修改 **5** = **11**（P3）；设计框定 16 含 P5 `F04-CONN.md`
- 验证基线：r35 后 **777 passed** + 4 skipped；本轮目标 **≥802 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r36.py tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py -v`

---

### Task 1: 基础设施 — `connectors-ext` 可选依赖 + r36 测试脚手架

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `tests/test_connectors_gov_r36.py`（module fixture + 空占位 `test_r36_scaffold`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/writing-plans/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；本轮不触及 `fe/` 或壳层组件

**Interfaces:**
- Consumes: r34/r35 `test_connectors_gov_r34.py` fixture 模式
- Produces: `[project.optional-dependencies] connectors-ext` 四包；`_R36_SQLITE_URL` fixture；`client` fixture

- [ ] **Step 1: 修改 pyproject.toml 增 connectors-ext**

在 `backend/pyproject.toml` 的 `[project.optional-dependencies]` 段追加（保留现有 `dev`）：

```toml
connectors-ext = [
    "pyhive>=0.7.0",
    "pymssql>=2.3.0",
    "oracledb>=2.5.0",
    "clickhouse-connect>=0.7.0",
]
```

- [ ] **Step 2: 创建 test_connectors_gov_r36.py 脚手架**

```python
"""M11 关系型/OLAP 连接器 L1 kickoff r36 — CONN-003/007/005/008/004."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R36_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r36?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r36_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R36_SQLITE_URL
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


def test_r36_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None
```

- [ ] **Step 3: 运行脚手架测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py::test_r36_scaffold -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml tests/test_connectors_gov_r36.py
git commit -m "chore(r36): connectors-ext optional deps + test scaffold"
```

---

### Task 2: CONN-003 — Hive 连接器 + 7 条测试

**Files:**
- Create: `backend/app/datasources/dialects/hive.py`
- Modify: `tests/test_connectors_gov_r36.py`（追加 CONN-003 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `TestConnectionResult`, `SchemaInfo`, `TableInfo`, `ColumnInfo`, `DialectConnector` 协议
- Produces: `HiveConnector`（`type=hive`, `category=lake`）；`HIVE_CONN_REFUSED` / `HIVE_AUTH_FAILED` / `HIVE_TIMEOUT` / `HIVE_UNKNOWN_DATABASE` / `HIVE_UNKNOWN`

- [ ] **Step 1: 写失败测试（CONN-003 段 7 条）**

在 `tests/test_connectors_gov_r36.py` 追加：

```python
from unittest.mock import MagicMock, patch

from app.datasources.dialects.hive import HiveConnector
from app.datasources.registry import export_type_catalog


def test_hive_types_catalog_r36():
    """T-CONN-R36-003-01: types 含 hive category=lake schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "hive" in types
    assert types["hive"]["category"] == "lake"
    assert "schema_browser" in types["hive"]["capabilities"]


@patch("pyhive.hive.connect")
def test_hive_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-003-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert result.ok is True
    cursor.execute.assert_called()


@patch("pyhive.hive.connect")
def test_hive_auth_failed_r36(mock_connect):
    """T-CONN-R36-003-03: mock 认证失败 → HIVE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Authentication failed: invalid credentials")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "HIVE_AUTH_FAILED"


@patch("pyhive.hive.connect")
def test_hive_conn_refused_r36(mock_connect):
    """T-CONN-R36-003-04: mock 连接拒绝 → HIVE_CONN_REFUSED。"""
    mock_connect.side_effect = Exception("Connection refused")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert result.ok is False
    assert result.code == "HIVE_CONN_REFUSED"


@patch("pyhive.hive.connect")
def test_hive_timeout_r36(mock_connect):
    """T-CONN-R36-003-05: mock 超时 → HIVE_TIMEOUT。"""
    mock_connect.side_effect = Exception("timed out waiting for response")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert result.ok is False
    assert result.code == "HIVE_TIMEOUT"


@patch("pyhive.hive.connect")
def test_hive_empty_schemas_r36(mock_connect):
    """T-CONN-R36-003-06: mock 仅 default 库 → list_schemas 过滤 information_schema。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("default",), ("information_schema",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    schemas = connector.list_schemas(connection)
    names = {s.name for s in schemas}
    assert "information_schema" not in names
    assert "default" in names


@patch("pyhive.hive.connect")
def test_hive_unknown_database_tables_r36(mock_connect):
    """T-CONN-R36-003-07: mock 未知库 list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert connector.list_tables(connection, "missing_db") == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "hive" -v`
Expected: FAIL（`ModuleNotFoundError: app.datasources.dialects.hive` 或 `hive` 不在 catalog）

- [ ] **Step 3: 实现 hive.py**

创建 `backend/app/datasources/dialects/hive.py`：

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult

HIVE_CONN_REFUSED = "HIVE_CONN_REFUSED"
HIVE_AUTH_FAILED = "HIVE_AUTH_FAILED"
HIVE_TIMEOUT = "HIVE_TIMEOUT"
HIVE_UNKNOWN_DATABASE = "HIVE_UNKNOWN_DATABASE"
HIVE_UNKNOWN = "HIVE_UNKNOWN"

_SYSTEM_SCHEMAS = frozenset({"information_schema"})


def _map_hive_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "denied" in lowered or "password" in lowered:
        return HIVE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return HIVE_TIMEOUT, detail
    if "refused" in lowered or "could not connect" in lowered:
        return HIVE_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return HIVE_UNKNOWN_DATABASE, detail
    return HIVE_UNKNOWN, detail


class HiveConnector:
    type = "hive"
    category = "lake"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Apache Hive"

    def _connect(self, **kwargs: Any) -> Any:
        import pyhive.hive

        host = kwargs["host"]
        port = kwargs.get("port", 10000)
        username = kwargs["username"]
        password = kwargs["password"]
        database = kwargs.get("database") or "default"
        return pyhive.hive.connect(
            host=host,
            port=port,
            username=username,
            password=password,
            database=database,
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
            finally:
                connection.close()
        except Exception as exc:
            code, detail = _map_hive_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cursor = connection.cursor()
        cursor.execute("SHOW DATABASES")
        rows = cursor.fetchall()
        return [
            SchemaInfo(name=row[0])
            for row in rows
            if row and row[0] not in _SYSTEM_SCHEMAS
        ]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(f"SHOW TABLES IN {schema}")
        rows = cursor.fetchall()
        return [TableInfo(name=row[0], type="TABLE") for row in rows if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(f"DESCRIBE {schema}.{table}")
        rows = cursor.fetchall()
        columns: list[ColumnInfo] = []
        for row in rows:
            if not row or not row[0] or str(row[0]).startswith("#"):
                continue
            columns.append(ColumnInfo(name=str(row[0]), data_type=str(row[1]), nullable=True))
        return columns
```

- [ ] **Step 4: 临时注册 hive（Task 7 前仅测方言类）**

在测试文件顶部或 Task 7 前，CONN-003 测试依赖 `export_type_catalog` 含 hive — **Task 7 统一注册**；本 Task 先测 `HiveConnector` 直接实例（T-003-02~07 不依赖 registry）。T-003-01 在 Task 7 后绿；本步先运行 `-k "hive and not catalog"`：

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "hive and not catalog" -v`
Expected: PASS（6/7）

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/hive.py tests/test_connectors_gov_r36.py
git commit -m "feat(conn-003): Hive connector L1 + r36 tests"
```

---

### Task 3: CONN-007 — ClickHouse 连接器 + 7 条测试

**Files:**
- Create: `backend/app/datasources/dialects/clickhouse.py`
- Modify: `tests/test_connectors_gov_r36.py`（追加 CONN-007 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `TestConnectionResult`, `ColumnInfo`, `SchemaInfo`, `TableInfo`
- Produces: `ClickhouseConnector`（`type=clickhouse`, `category=olap`）；`CLICKHOUSE_*` 错误码；`CLICKHOUSE_MAX_COLUMNS=500`

- [ ] **Step 1: 写失败测试（CONN-007 段 7 条）**

```python
from app.datasources.dialects.clickhouse import CLICKHOUSE_MAX_COLUMNS, ClickhouseConnector
from app.query.dialects import get_sql_dialect


def test_clickhouse_types_catalog_r36():
    """T-CONN-R36-007-01: types 含 clickhouse category=olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "clickhouse" in types
    assert types["clickhouse"]["category"] == "olap"


@patch("clickhouse_connect.get_client")
def test_clickhouse_test_connection_ok_r36(mock_get_client):
    """T-CONN-R36-007-02: mock ping 成功 → ok=True。"""
    client = MagicMock()
    client.command.return_value = 1
    mock_get_client.return_value = client
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert result.ok is True


@patch("clickhouse_connect.get_client")
def test_clickhouse_auth_failed_r36(mock_get_client):
    """T-CONN-R36-007-03: mock 401 → CLICKHOUSE_AUTH_FAILED。"""
    mock_get_client.side_effect = Exception("HTTP 401 Unauthorized")
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "CLICKHOUSE_AUTH_FAILED"


@patch("clickhouse_connect.get_client")
def test_clickhouse_conn_refused_r36(mock_get_client):
    """T-CONN-R36-007-04: mock connection refused → CLICKHOUSE_CONN_REFUSED。"""
    mock_get_client.side_effect = ConnectionRefusedError("Connection refused")
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert result.ok is False
    assert result.code == "CLICKHOUSE_CONN_REFUSED"


@patch("clickhouse_connect.get_client")
def test_clickhouse_unknown_database_tables_r36(mock_get_client):
    """T-CONN-R36-007-05: mock 未知 database tables → []。"""
    client = MagicMock()
    client.query.return_value.result_rows = []
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert connector.list_tables(connection, "missing_db") == []


@patch("clickhouse_connect.get_client")
def test_clickhouse_column_limit_r36(mock_get_client):
    """T-CONN-R36-007-06: mock 600 列 → list_columns 返回 500。"""
    client = MagicMock()
    rows = [(f"col_{i}", "String") for i in range(600)]
    client.query.return_value.result_rows = rows
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    columns = connector.list_columns(connection, "db", "wide")
    assert len(columns) == CLICKHOUSE_MAX_COLUMNS
    assert CLICKHOUSE_MAX_COLUMNS == 500


def test_clickhouse_query_dialect_unchanged_r36():
    """T-CONN-R36-007-07: get_sql_dialect(clickhouse) 仍成功（QUERY-004 回归）。"""
    dialect = get_sql_dialect("clickhouse")
    assert dialect.connector_type == "clickhouse"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "clickhouse" -v`
Expected: FAIL

- [ ] **Step 3: 实现 clickhouse.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult

CLICKHOUSE_CONN_REFUSED = "CLICKHOUSE_CONN_REFUSED"
CLICKHOUSE_AUTH_FAILED = "CLICKHOUSE_AUTH_FAILED"
CLICKHOUSE_TIMEOUT = "CLICKHOUSE_TIMEOUT"
CLICKHOUSE_UNKNOWN_DATABASE = "CLICKHOUSE_UNKNOWN_DATABASE"
CLICKHOUSE_UNKNOWN = "CLICKHOUSE_UNKNOWN"
CLICKHOUSE_MAX_COLUMNS = 500

_SYSTEM_DATABASES = frozenset({"system", "INFORMATION_SCHEMA"})


def _map_clickhouse_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "401" in detail or "unauthorized" in lowered or "auth" in lowered:
        return CLICKHOUSE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return CLICKHOUSE_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return CLICKHOUSE_CONN_REFUSED, detail
    if "database" in lowered and ("unknown" in lowered or "doesn't exist" in lowered):
        return CLICKHOUSE_UNKNOWN_DATABASE, detail
    return CLICKHOUSE_UNKNOWN, detail


class ClickhouseConnector:
    type = "clickhouse"
    category = "olap"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "ClickHouse"

    def _client(self, **kwargs: Any) -> Any:
        import clickhouse_connect

        return clickhouse_connect.get_client(
            host=kwargs["host"],
            port=kwargs.get("port", 8123),
            username=kwargs["username"],
            password=kwargs["password"],
            database=kwargs.get("database") or "default",
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._client(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            client = self._client(**kwargs)
            client.command("SELECT 1")
        except Exception as exc:
            code, detail = _map_clickhouse_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        rows = connection.query(
            "SELECT name FROM system.databases WHERE name NOT IN ('system','INFORMATION_SCHEMA')"
        ).result_rows
        return [SchemaInfo(name=row[0]) for row in rows if row]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        rows = connection.query(
            "SELECT name, engine FROM system.tables WHERE database = {db:String}",
            parameters={"db": schema},
        ).result_rows
        return [TableInfo(name=row[0], type=row[1] or "TABLE") for row in rows if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        rows = connection.query(
            "SELECT name, type FROM system.columns WHERE database = {db:String} AND table = {tbl:String}",
            parameters={"db": schema, "tbl": table},
        ).result_rows
        columns = [
            ColumnInfo(name=str(row[0]), data_type=str(row[1]), nullable=True) for row in rows if row
        ]
        if len(columns) > CLICKHOUSE_MAX_COLUMNS:
            return columns[:CLICKHOUSE_MAX_COLUMNS]
        return columns
```

- [ ] **Step 4: 运行 clickhouse 测试（除 catalog 外）**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "clickhouse and not catalog" -v`
Expected: PASS（含 T-007-07 QUERY 回归）

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/clickhouse.py tests/test_connectors_gov_r36.py
git commit -m "feat(conn-007): ClickHouse connector L1 + r36 tests"
```

---

### Task 4: CONN-005 — SQL Server 连接器 + errors 映射 + 6 条测试

**Files:**
- Create: `backend/app/datasources/dialects/sqlserver.py`
- Modify: `backend/app/datasources/dialects/errors.py`（`map_sqlserver_operational_error` + `SQLSERVER_*` 常量）
- Modify: `tests/test_connectors_gov_r36.py`（追加 CONN-005 段 6 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_sqlserver_operational_error`, `TestConnectionResult`
- Produces: `SqlserverConnector`（`type=sqlserver`）；`SQLSERVER_CONN_REFUSED` / `SQLSERVER_AUTH_FAILED` / `SQLSERVER_TIMEOUT` / `SQLSERVER_UNKNOWN_DATABASE` / `SQLSERVER_SSL_ERROR` / `SQLSERVER_UNKNOWN`

- [ ] **Step 1: 写失败测试（CONN-005 段 6 条）**

```python
import pymssql

from app.datasources.dialects.sqlserver import SqlserverConnector


def test_sqlserver_types_catalog_r36():
    """T-CONN-R36-005-01: types 含 sqlserver category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "sqlserver" in types
    assert types["sqlserver"]["category"] == "relational"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-005-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password=""
    )
    assert result.ok is True
    conn.close.assert_called_once()


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_auth_failed_r36(mock_connect):
    """T-CONN-R36-005-03: mock 18456 → SQLSERVER_AUTH_FAILED。"""
    mock_connect.side_effect = pymssql.OperationalError(18456, b"Login failed")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_AUTH_FAILED"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_conn_refused_r36(mock_connect):
    """T-CONN-R36-005-04: mock 连接拒绝 → SQLSERVER_CONN_REFUSED。"""
    mock_connect.side_effect = pymssql.OperationalError(20009, b"Unable to connect")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password=""
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_CONN_REFUSED"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_unknown_database_r36(mock_connect):
    """T-CONN-R36-005-05: mock 未知库 → SQLSERVER_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = pymssql.OperationalError(4060, b"Cannot open database")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="missing", username="sa", password=""
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_UNKNOWN_DATABASE"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_ssl_required_r36(mock_connect):
    """T-CONN-R36-005-06: ssl_mode=required → encrypt=True 传入。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    SqlserverConnector().test_connection(
        host="127.0.0.1",
        port=1433,
        database="master",
        username="sa",
        password="",
        ssl_mode="required",
    )
    assert mock_connect.call_args.kwargs.get("encrypt") is True
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "sqlserver" -v`
Expected: FAIL

- [ ] **Step 3: 扩展 errors.py**

在 `backend/app/datasources/dialects/errors.py` 末尾追加：

```python
SQLSERVER_CONN_REFUSED = "SQLSERVER_CONN_REFUSED"
SQLSERVER_AUTH_FAILED = "SQLSERVER_AUTH_FAILED"
SQLSERVER_TIMEOUT = "SQLSERVER_TIMEOUT"
SQLSERVER_UNKNOWN_DATABASE = "SQLSERVER_UNKNOWN_DATABASE"
SQLSERVER_SSL_ERROR = "SQLSERVER_SSL_ERROR"
SQLSERVER_UNKNOWN = "SQLSERVER_UNKNOWN"

_SQLSERVER_CODE_MAP: dict[int, str] = {
    20009: SQLSERVER_CONN_REFUSED,
    18456: SQLSERVER_AUTH_FAILED,
    4060: SQLSERVER_UNKNOWN_DATABASE,
}


def map_sqlserver_operational_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    errno = int(exc.args[0]) if getattr(exc, "args", None) and exc.args else 0
    if errno in (20002, 20003):
        return SQLSERVER_TIMEOUT, detail
    if "ssl" in detail.lower() or "encrypt" in detail.lower():
        return SQLSERVER_SSL_ERROR, detail
    code = _SQLSERVER_CODE_MAP.get(errno, SQLSERVER_UNKNOWN)
    if "timeout" in detail.lower():
        return SQLSERVER_TIMEOUT, detail
    return code, detail
```

- [ ] **Step 4: 实现 sqlserver.py**

```python
from __future__ import annotations

import time
from typing import Any

import pymssql

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_sqlserver_operational_error

_SSL_MODES = frozenset({"disabled", "preferred", "required"})


class SqlserverConnector:
    type = "sqlserver"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "SQL Server"

    def _build_connect_kwargs(self, **kwargs: Any) -> dict:
        ssl_mode = kwargs.get("ssl_mode", "preferred")
        if ssl_mode not in _SSL_MODES:
            raise ValueError(f"invalid ssl_mode: {ssl_mode}")
        connect_kwargs: dict = {
            "server": kwargs["host"],
            "port": kwargs.get("port", 1433),
            "user": kwargs["username"],
            "password": kwargs["password"],
            "database": kwargs.get("database") or "master",
            "login_timeout": int(kwargs.get("connect_timeout_sec", 5)),
        }
        if ssl_mode == "required":
            connect_kwargs["encrypt"] = True
        elif ssl_mode == "disabled":
            connect_kwargs["encrypt"] = False
        return connect_kwargs

    def open_connection(self, **kwargs: Any) -> Any:
        return pymssql.connect(**self._build_connect_kwargs(**kwargs))

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self.open_connection(**kwargs)
            try:
                cursor = connection.cursor()
                cursor.execute("SELECT 1")
            finally:
                connection.close()
        except pymssql.Error as exc:
            code, detail = map_sqlserver_operational_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cursor = connection.cursor()
        cursor.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY 1")
        return [SchemaInfo(name=row[0]) for row in cursor.fetchall() if row]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s",
            (schema,),
        )
        return [
            TableInfo(name=row[0], type=row[1] or "TABLE")
            for row in cursor.fetchall()
            if row
        ]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
            """,
            (schema, table),
        )
        return [
            ColumnInfo(name=row[0], data_type=row[1], nullable=str(row[2]).upper() == "YES")
            for row in cursor.fetchall()
            if row
        ]
```

- [ ] **Step 5: 运行 sqlserver 测试（除 catalog）**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "sqlserver and not catalog" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/dialects/sqlserver.py backend/app/datasources/dialects/errors.py tests/test_connectors_gov_r36.py
git commit -m "feat(conn-005): SQL Server connector L1 + SQLSERVER_* errors"
```

---

### Task 5: CONN-008 — Doris 连接器（StarRocks 对称）+ 6 条测试

**Files:**
- Create: `backend/app/datasources/dialects/doris.py`
- Modify: `tests/test_connectors_gov_r36.py`（追加 CONN-008 段 6 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `MysqlConnector`, `map_mysql_operational_error`, `StarrocksConnector` 模式
- Produces: `DorisConnector`（`type=doris`, `category=olap`）；`DORIS_TIMEOUT` / `DORIS_CONN_REFUSED` / `DORIS_AUTH_FAILED` / `DORIS_UNKNOWN`

- [ ] **Step 1: 写失败测试（CONN-008 段 6 条）**

```python
import pymysql.err

from app.datasources.dialects.doris import DorisConnector
from app.datasources.registry import ConnectorRegistry, register_dialect


def test_doris_types_catalog_r36():
    """T-CONN-R36-008-01: types 含 doris category=olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "doris" in types
    assert types["doris"]["category"] == "olap"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-008-02: mock ping 成功 → ok=True。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is True
    conn.ping.assert_called_once_with(reconnect=False)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_conn_refused_r36(mock_connect):
    """T-CONN-R36-008-03: mock 2003 → DORIS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "DORIS_CONN_REFUSED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_auth_failed_r36(mock_connect):
    """T-CONN-R36-008-04: mock 1045 → DORIS_AUTH_FAILED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "DORIS_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_unknown_catalog_tables_r36(mock_connect):
    """T-CONN-R36-008-05: mock 非法 catalog list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = DorisConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert connector.list_tables(connection, "") == []
    assert connector.list_tables(connection, "missing") == []


def test_doris_registry_nfr04_r36():
    """T-CONN-R36-008-06: register_dialect 不替换 ConnectorRegistry 核心类。"""
    from app.datasources.registry import ConnectorRegistry as RegistryClass

    before = RegistryClass
    register_dialect(DorisConnector())
    assert RegistryClass is before
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "doris" -v`
Expected: FAIL

- [ ] **Step 3: 实现 doris.py（镜像 starrocks.py）**

```python
from __future__ import annotations

import time
from typing import Any

import pymysql
import pymysql.err

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_mysql_operational_error
from app.datasources.dialects.mysql import MysqlConnector

DORIS_TIMEOUT = "DORIS_TIMEOUT"
DORIS_CONN_REFUSED = "DORIS_CONN_REFUSED"
DORIS_AUTH_FAILED = "DORIS_AUTH_FAILED"
DORIS_UNKNOWN = "DORIS_UNKNOWN"


def _map_doris_error(exc: pymysql.err.OperationalError) -> tuple[str, str]:
    code, detail = map_mysql_operational_error(exc)
    mapping = {
        "MYSQL_TIMEOUT": DORIS_TIMEOUT,
        "MYSQL_CONN_REFUSED": DORIS_CONN_REFUSED,
        "MYSQL_AUTH_FAILED": DORIS_AUTH_FAILED,
    }
    return mapping.get(code, DORIS_UNKNOWN), detail


class DorisConnector:
    type = "doris"
    category = "olap"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Apache Doris"

    def __init__(self) -> None:
        self._inner = MysqlConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            connection = self._inner.open_connection(**kwargs)
            try:
                connection.ping(reconnect=False)
            finally:
                connection.close()
        except pymysql.err.OperationalError as exc:
            code, detail = _map_doris_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs) -> Any:
        return self._inner.open_connection(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._inner.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        return self._inner.list_columns(connection, schema, table)
```

- [ ] **Step 4: 运行 doris 测试（除 catalog）**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "doris and not catalog" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/doris.py tests/test_connectors_gov_r36.py
git commit -m "feat(conn-008): Doris connector L1 + r36 tests"
```

---

### Task 6: CONN-004 — Oracle 连接器 + errors 映射 + 6 条测试

**Files:**
- Create: `backend/app/datasources/dialects/oracle.py`
- Modify: `backend/app/datasources/dialects/errors.py`（`map_oracle_error` + `ORACLE_*` 常量）
- Modify: `tests/test_connectors_gov_r36.py`（追加 CONN-004 段 6 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_oracle_error`, `TestConnectionResult`
- Produces: `OracleConnector`（`type=oracle`）；`ORACLE_CONN_REFUSED` / `ORACLE_AUTH_FAILED` / `ORACLE_TIMEOUT` / `ORACLE_UNKNOWN_SERVICE` / `ORACLE_UNKNOWN`

- [ ] **Step 1: 写失败测试（CONN-004 段 6 条）**

```python
from app.datasources.dialects.oracle import OracleConnector


def test_oracle_types_catalog_r36():
    """T-CONN-R36-004-01: types 含 oracle category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "oracle" in types
    assert types["oracle"]["category"] == "relational"


@patch("oracledb.connect")
def test_oracle_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-004-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="system", password=""
    )
    assert result.ok is True
    cursor.execute.assert_called()


@patch("oracledb.connect")
def test_oracle_auth_failed_r36(mock_connect):
    """T-CONN-R36-004-03: mock ORA-01017 → ORACLE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("ORA-01017: invalid username/password")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "ORACLE_AUTH_FAILED"


@patch("oracledb.connect")
def test_oracle_unknown_service_r36(mock_connect):
    """T-CONN-R36-004-04: mock ORA-12514 → ORACLE_UNKNOWN_SERVICE。"""
    mock_connect.side_effect = Exception("ORA-12514: TNS:listener does not know of service")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="BAD_SVC", username="system", password=""
    )
    assert result.ok is False
    assert result.code == "ORACLE_UNKNOWN_SERVICE"


@patch("oracledb.connect")
def test_oracle_conn_refused_r36(mock_connect):
    """T-CONN-R36-004-05: mock 连接拒绝 → ORACLE_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="system", password=""
    )
    assert result.ok is False
    assert result.code == "ORACLE_CONN_REFUSED"


@patch("oracledb.connect")
def test_oracle_empty_owner_columns_r36(mock_connect):
    """T-CONN-R36-004-06: mock 空 owner list_columns → []。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="system", password=""
    )
    assert connector.list_columns(connection, "", "T1") == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "oracle" -v`
Expected: FAIL

- [ ] **Step 3: 扩展 errors.py（Oracle 段）**

```python
ORACLE_CONN_REFUSED = "ORACLE_CONN_REFUSED"
ORACLE_AUTH_FAILED = "ORACLE_AUTH_FAILED"
ORACLE_TIMEOUT = "ORACLE_TIMEOUT"
ORACLE_UNKNOWN_SERVICE = "ORACLE_UNKNOWN_SERVICE"
ORACLE_UNKNOWN = "ORACLE_UNKNOWN"

_SYSTEM_OWNERS = frozenset({"SYS", "SYSTEM"})


def map_oracle_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "ora-01017" in lowered:
        return ORACLE_AUTH_FAILED, detail
    if "ora-12514" in lowered or "unknown service" in lowered:
        return ORACLE_UNKNOWN_SERVICE, detail
    if "timeout" in lowered or "timed out" in lowered:
        return ORACLE_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return ORACLE_CONN_REFUSED, detail
    return ORACLE_UNKNOWN, detail
```

- [ ] **Step 4: 实现 oracle.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import _SYSTEM_OWNERS, map_oracle_error


class OracleConnector:
    type = "oracle"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Oracle"

    def _connect(self, **kwargs: Any) -> Any:
        import oracledb

        dsn = oracledb.makedsn(kwargs["host"], kwargs.get("port", 1521), service_name=kwargs["database"])
        return oracledb.connect(user=kwargs["username"], password=kwargs["password"], dsn=dsn)

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
        except Exception as exc:
            code, detail = map_oracle_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT DISTINCT OWNER FROM ALL_TABLES
            WHERE OWNER NOT IN ('SYS','SYSTEM')
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
            "SELECT TABLE_NAME, 'TABLE' FROM ALL_TABLES WHERE OWNER = :owner ORDER BY 1",
            owner=schema.upper(),
        )
        return [TableInfo(name=row[0], type=row[1]) for row in cursor.fetchall() if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COLUMN_NAME, DATA_TYPE, NULLABLE
            FROM ALL_TAB_COLUMNS
            WHERE OWNER = :owner AND TABLE_NAME = :table_name
            ORDER BY COLUMN_ID
            """,
            owner=schema.upper(),
            table_name=table.upper(),
        )
        return [
            ColumnInfo(name=row[0], data_type=row[1], nullable=str(row[2]) == "Y")
            for row in cursor.fetchall()
            if row
        ]
```

- [ ] **Step 5: 运行 oracle 测试（除 catalog）**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "oracle and not catalog" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/dialects/oracle.py backend/app/datasources/dialects/errors.py tests/test_connectors_gov_r36.py
git commit -m "feat(conn-004): Oracle connector L1 + ORACLE_* errors"
```

---

### Task 7: Registry 联合注册 + HTTP 集成回归（T-REG-R36）

**Files:**
- Modify: `backend/app/datasources/__init__.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `tests/test_connectors_gov_r36.py`（追加 T-REG-R36 段 4 条 + 启用全部 catalog 测试）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端 registry/API 链；无 UI 变更

**Interfaces:**
- Consumes: 五 `*Connector` 类、`register_dialect`, `export_type_catalog`
- Produces: `register_builtin_dialects()` 注册 10 项 type；HTTP `POST /api/v1/datasources/test` + `GET /types` 五新 type 可见

- [ ] **Step 1: 写失败测试（T-REG-R36 段 4 条）**

```python
import uuid

from app.datasources.dialects.mysql import MysqlConnector


def test_registry_ten_types_r36():
    """T-REG-R36-01: export_type_catalog 含 mysql/tidb/starrocks/elasticsearch + 五新 type。"""
    types = {item["type"] for item in export_type_catalog()}
    expected = {
        "mysql",
        "postgresql",
        "tidb",
        "starrocks",
        "elasticsearch",
        "hive",
        "clickhouse",
        "sqlserver",
        "doris",
        "oracle",
    }
    assert expected.issubset(types)
    assert len(types) >= 10


@patch("pyhive.hive.connect")
def test_hive_http_test_connection_r36(mock_connect, client):
    """T-REG-R36-02: POST /datasources/test type=hive mock 成功 → 200 ok=true traceId。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "hive",
            "name": "hive-test",
            "host": "127.0.0.1",
            "port": 10000,
            "database": "default",
            "username": "hive",
            "password": "secret",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body.get("traceId")


def test_clickhouse_create_and_types_r36(client):
    """T-REG-R36-03: POST /datasources type=clickhouse 创建；GET /types 含五新 type。"""
    with patch("clickhouse_connect.get_client") as mock_get:
        client_mock = MagicMock()
        client_mock.command.return_value = 1
        mock_get.return_value = client_mock
        create = client.post(
            "/api/v1/datasources",
            headers=AUTH,
            json={
                "type": "clickhouse",
                "name": f"ch-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 8123,
                "database": "default",
                "username": "default",
                "password": "",
            },
        )
        assert create.status_code in (200, 201)
    types_resp = client.get("/api/v1/datasources/types", headers=AUTH)
    type_names = {item["type"] for item in types_resp.json()}
    for t in ("hive", "clickhouse", "sqlserver", "doris", "oracle"):
        assert t in type_names


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_no_regression_r36(mock_connect, client):
    """T-REG-R36-04: mysql test_connection mock 成功不回归。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = MysqlConnector().test_connection(
        host="127.0.0.1", port=3306, database="test", username="root", password=""
    )
    assert result.ok is True
```

- [ ] **Step 2: 运行 registry 测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -k "registry or REG" -v`
Expected: FAIL（五新 type 未注册）

- [ ] **Step 3: 修改 datasources/__init__.py**

```python
from app.datasources.dialects.clickhouse import ClickhouseConnector
from app.datasources.dialects.doris import DorisConnector
from app.datasources.dialects.elasticsearch import ElasticsearchConnector
from app.datasources.dialects.hive import HiveConnector
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.dialects.oracle import OracleConnector
from app.datasources.dialects.postgres import PostgresConnector
from app.datasources.dialects.sqlserver import SqlserverConnector
from app.datasources.dialects.starrocks import StarrocksConnector
from app.datasources.dialects.tidb import TidbConnector
from app.datasources.registry import register_dialect


def register_builtin_dialects() -> None:
    register_dialect(MysqlConnector())
    register_dialect(PostgresConnector())
    register_dialect(TidbConnector())
    register_dialect(StarrocksConnector())
    register_dialect(ElasticsearchConnector())
    register_dialect(HiveConnector())
    register_dialect(ClickhouseConnector())
    register_dialect(SqlserverConnector())
    register_dialect(DorisConnector())
    register_dialect(OracleConnector())


register_builtin_dialects()
```

- [ ] **Step 4: 修改 dialects/__init__.py 导出**

在 `__all__` 追加：`HiveConnector`, `ClickhouseConnector`, `SqlserverConnector`, `DorisConnector`, `OracleConnector` 及对应 import。

- [ ] **Step 5: 运行全部 r36 测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py -v`
Expected: PASS（≥32 条含 scaffold 替换为 ≥31 业务测；删除 `test_r36_scaffold` 或保留均可）

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/__init__.py backend/app/datasources/dialects/__init__.py tests/test_connectors_gov_r36.py
git commit -m "feat(r36): register five L1 connectors + registry HTTP smoke"
```

---

### Task 8: 文档同步 + r34/r35/r36 全量回归

**Files:**
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.cursor/rules/prd-sync.mdc`（评估文档同步）

**UI skill:** none

**UI Acceptance:**
- N/A — 仅更新 `docs/services/datasources.md` 域附录；无 UI 变更

**Interfaces:**
- Consumes: 五 connector 实现完成
- Produces: `datasources.md` r36 kickoff 笔记 + 主要类型表五行

- [ ] **Step 1: 更新 docs/services/datasources.md**

在「主要类型 / 入口」表追加：

| `dialects/hive.py` | Apache Hive 湖仓方言（HiveServer2，port 10000，`category=lake`） | CONN-003 | 已实现（L1 r36） |
| `dialects/clickhouse.py` | ClickHouse OLAP 方言（HTTP，port 8123，`CLICKHOUSE_MAX_COLUMNS=500`） | CONN-007 | 已实现（L1 r36） |
| `dialects/sqlserver.py` | SQL Server 关系型（pymssql，TLS L1，`category=relational`） | CONN-005 | 已实现（L1 r36） |
| `dialects/doris.py` | Apache Doris OLAP（MySQL 协议委托，port 9030） | CONN-008 | 已实现（L1 r36） |
| `dialects/oracle.py` | Oracle 关系型（oracledb thin，service name，`category=relational`） | CONN-004 | 已实现（L1 r36） |

在「实现笔记」追加 `### r36 connector kickoff（2026-07-04）` 小节，说明五方言 L1、`connectors-ext` 可选依赖、PRD F04 漂移 P5 对账。

- [ ] **Step 2: ruff + 全量回归**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r36.py tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py -v`
Expected: ruff clean；r36 ≥25 passed；r35 35/35；r34 15/15；合计 **≥75** connector gov 测全绿

- [ ] **Step 3: 全量 pytest 基线（可选 P4 门禁）**

Run: `cd backend && python3 -m pytest -q`
Expected: **≥802 passed**, 4 skipped（相对 r35 基线 777 + ≥25 新测）

- [ ] **Step 4: Commit**

```bash
git add docs/services/datasources.md
git commit -m "docs(r36): datasources.md five connector L1 kickoff"
```

---

## Self-Review Checklist

| 设计子项 | 对应 Task | 测试 ID |
|----------|-----------|---------|
| CONN-003 Hive | Task 2 | T-CONN-R36-003-01~07 |
| CONN-007 ClickHouse | Task 3 | T-CONN-R36-007-01~07 |
| CONN-005 SQL Server | Task 4 | T-CONN-R36-005-01~06 |
| CONN-008 Doris | Task 5 | T-CONN-R36-008-01~06 |
| CONN-004 Oracle | Task 6 | T-CONN-R36-004-01~06 |
| 联合 registry | Task 7 | T-REG-R36-01~04 |
| pyproject connectors-ext | Task 1 | — |
| docs/services/datasources.md | Task 8 | — |

**占位符扫描：** 无 TBD/TODO/适当处理。

**文件计数：** 新建 6 + 修改 5 = 11（P3）；≤ round-target 20 上限。

**执行模式：** subagent-driven-development (option 1) — 每 Task 独立 subagent + 两阶段 review。
