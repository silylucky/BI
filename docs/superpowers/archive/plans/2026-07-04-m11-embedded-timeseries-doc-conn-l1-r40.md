# M11 嵌入式/时序/文档连接器 L1 kickoff r40 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/mongodb.py`、`influxdb.py`、`tdengine.py`、`sqlite.py`、`timescaledb.py`、`errors.py`、`dialects/__init__.py`、`backend/app/datasources/__init__.py`、`backend/pyproject.toml`、`tests/test_connectors_gov_r40.py`、`tests/test_datasources_l1.py`、`docs/services/datasources.md`
> **子项：** CONN-014, CONN-011, CONN-012, CONN-006, CONN-013
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** M11 L1 kickoff — 五方言 MongoDB/InfluxDB/TDengine/SQLite/TimescaleDB 注册至 `ConnectorRegistry`，实现 `test_connection` + schema 自省 + `export_type_catalog()` 可见（18 types）；`test_connectors_gov_r40.py` ≥35 条 + r39 33/33 + r37 40/40 + r36 37/37 回归 + `test_invalid_connector_type` 修复全绿。

**Architecture:** 镜像 r36 L1 方言插件模式 — MongoDB/InfluxDB/TDengine 独立驱动 + lazy import；SQLite 使用 stdlib `sqlite3`（`host` 存文件路径，`category=embedded`）；TimescaleDB 委托 `PostgresConnector` + `timescaledb_information.hypertables` 标记（对齐 GaussDB）；`errors.py` 集中五前缀 `map_*`；`register_builtin_dialects()` 追加五 `register_dialect`，不修改 `ConnectorRegistry` 核心类（NFR-04）。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pymongo · influxdb-client · taospy · psycopg 3 · sqlite3（stdlib）· pytest · ruff

## Global Constraints

- 纯后端 L1 kickoff；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 Alembic migration；不触及 `fe/`
- `docs/automate/prd/F04-CONN.md` **P5 对账**（非 P3）
- 错误码前缀：`MONGODB_*`、`INFLUX_*`、`TDENGINE_*`、`SQLITE_*`、`TIMESCALE_*`
- `test_connection` 失败：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`（与 DS-003 一致）
- 列/字段枚举 limit：**500**（与 ES/ClickHouse/Oracle 对称）
- 连接参数语义：`host`/`port`/`database`/`username`/`password` 不扩 `ConnectionOptions`；InfluxDB `username=org`、`password=token`、`database=bucket`；SQLite `host=文件路径`、`port=1`
- 文件预算：新建 **6** + 修改 **5** = **11**（P3）；设计框定 17 含 P5 `F04-CONN.md`
- 验证基线：r39 后 **924 passed** + 4 skipped；本轮目标 **≥959 passed** + 4 skipped
- P3 若分支已有五方言实现：以本 spec 验收表对账补缺，勿重复造轮子
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r40.py tests/test_query_meta_conn_r39.py tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py tests/test_datasources_l1.py::test_invalid_connector_type -v`

---

### Task 1: 错误域 + connectors-ext 可选依赖 + r40 测试脚手架

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/pyproject.toml`
- Create: `tests/test_connectors_gov_r40.py`（module fixture + `test_r40_scaffold`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；本轮不触及 `fe/` 或壳层组件

**Interfaces:**
- Consumes: r36/r37 `errors.py` 既有 `map_postgres_operational_error` / `map_gaussdb_error` 委托模式
- Produces: `MONGODB_*`/`INFLUX_*`/`TDENGINE_*`/`SQLITE_*`/`TIMESCALE_*` 常量与 `map_mongodb_error`/`map_influx_error`/`map_tdengine_error`/`map_sqlite_error`/`map_timescale_error`；`_R40_SQLITE_URL` fixture

- [ ] **Step 1: 扩展 errors.py — 五前缀错误域**

在 `backend/app/datasources/dialects/errors.py` 的 `__all__` 段**之前**追加：

```python
# MongoDB
MONGODB_CONN_REFUSED = "MONGODB_CONN_REFUSED"
MONGODB_AUTH_FAILED = "MONGODB_AUTH_FAILED"
MONGODB_TIMEOUT = "MONGODB_TIMEOUT"
MONGODB_UNKNOWN_DATABASE = "MONGODB_UNKNOWN_DATABASE"
MONGODB_INVALID_HOST = "MONGODB_INVALID_HOST"
MONGODB_DRIVER_MISSING = "MONGODB_DRIVER_MISSING"
MONGODB_UNKNOWN = "MONGODB_UNKNOWN"


def map_mongodb_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    name = type(exc).__name__
    lowered = detail.lower()
    if "ServerSelectionTimeout" in name or "timeout" in lowered or "timed out" in lowered:
        return MONGODB_TIMEOUT, detail
    if "OperationFailure" in name or "authentication" in lowered or "code: 18" in lowered or "code: 13" in lowered:
        return MONGODB_AUTH_FAILED, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return MONGODB_CONN_REFUSED, detail
    if "invalid" in lowered and "host" in lowered:
        return MONGODB_INVALID_HOST, detail
    return MONGODB_UNKNOWN, detail


# InfluxDB 2.x
INFLUX_CONN_REFUSED = "INFLUX_CONN_REFUSED"
INFLUX_AUTH_FAILED = "INFLUX_AUTH_FAILED"
INFLUX_TIMEOUT = "INFLUX_TIMEOUT"
INFLUX_UNKNOWN_ORG = "INFLUX_UNKNOWN_ORG"
INFLUX_UNKNOWN_BUCKET = "INFLUX_UNKNOWN_BUCKET"
INFLUX_DRIVER_MISSING = "INFLUX_DRIVER_MISSING"
INFLUX_UNKNOWN = "INFLUX_UNKNOWN"


def map_influx_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "401" in detail or "403" in detail or "unauthorized" in lowered or "forbidden" in lowered:
        return INFLUX_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return INFLUX_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return INFLUX_CONN_REFUSED, detail
    if "org" in lowered and ("not found" in lowered or "unknown" in lowered):
        return INFLUX_UNKNOWN_ORG, detail
    if "bucket" in lowered and ("not found" in lowered or "unknown" in lowered):
        return INFLUX_UNKNOWN_BUCKET, detail
    return INFLUX_UNKNOWN, detail


# TDengine (taospy REST)
TDENGINE_CONN_REFUSED = "TDENGINE_CONN_REFUSED"
TDENGINE_AUTH_FAILED = "TDENGINE_AUTH_FAILED"
TDENGINE_TIMEOUT = "TDENGINE_TIMEOUT"
TDENGINE_UNKNOWN_DATABASE = "TDENGINE_UNKNOWN_DATABASE"
TDENGINE_DRIVER_MISSING = "TDENGINE_DRIVER_MISSING"
TDENGINE_UNKNOWN = "TDENGINE_UNKNOWN"


def map_tdengine_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered or "login" in lowered:
        return TDENGINE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return TDENGINE_TIMEOUT, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return TDENGINE_CONN_REFUSED, detail
    if "database" in lowered and ("not" in lowered or "unknown" in lowered):
        return TDENGINE_UNKNOWN_DATABASE, detail
    return TDENGINE_UNKNOWN, detail


# SQLite (file path)
SQLITE_FILE_NOT_FOUND = "SQLITE_FILE_NOT_FOUND"
SQLITE_PATH_TRAVERSAL = "SQLITE_PATH_TRAVERSAL"
SQLITE_PERMISSION_DENIED = "SQLITE_PERMISSION_DENIED"
SQLITE_READONLY = "SQLITE_READONLY"
SQLITE_CORRUPT = "SQLITE_CORRUPT"
SQLITE_UNKNOWN = "SQLITE_UNKNOWN"


def map_sqlite_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "unable to open" in lowered or "no such file" in lowered:
        return SQLITE_FILE_NOT_FOUND, detail
    if "readonly" in lowered or "read-only" in lowered:
        return SQLITE_READONLY, detail
    if "malformed" in lowered or "corrupt" in lowered:
        return SQLITE_CORRUPT, detail
    if "permission" in lowered or "denied" in lowered:
        return SQLITE_PERMISSION_DENIED, detail
    return SQLITE_UNKNOWN, detail


# TimescaleDB (PG delegate)
TIMESCALE_CONN_REFUSED = "TIMESCALE_CONN_REFUSED"
TIMESCALE_AUTH_FAILED = "TIMESCALE_AUTH_FAILED"
TIMESCALE_TIMEOUT = "TIMESCALE_TIMEOUT"
TIMESCALE_UNKNOWN_DATABASE = "TIMESCALE_UNKNOWN_DATABASE"
TIMESCALE_EXTENSION_MISSING = "TIMESCALE_EXTENSION_MISSING"
TIMESCALE_UNKNOWN = "TIMESCALE_UNKNOWN"

_TIMESCALE_FROM_PG = {
    PG_CONN_REFUSED: TIMESCALE_CONN_REFUSED,
    PG_AUTH_FAILED: TIMESCALE_AUTH_FAILED,
    PG_TIMEOUT: TIMESCALE_TIMEOUT,
    PG_UNKNOWN_DATABASE: TIMESCALE_UNKNOWN_DATABASE,
    PG_SSL_ERROR: TIMESCALE_UNKNOWN,
    PG_UNKNOWN: TIMESCALE_UNKNOWN,
}


def map_timescale_error(exc: Exception) -> tuple[str, str]:
    if hasattr(exc, "sqlstate") or "OperationalError" in type(exc).__name__:
        pg_code, detail = map_postgres_operational_error(exc)
        return _TIMESCALE_FROM_PG.get(pg_code, TIMESCALE_UNKNOWN), detail
    detail = str(exc)
    lowered = detail.lower()
    if "auth" in lowered or "password" in lowered:
        return TIMESCALE_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return TIMESCALE_TIMEOUT, detail
    if "refused" in lowered:
        return TIMESCALE_CONN_REFUSED, detail
    if "database" in lowered and "not" in lowered:
        return TIMESCALE_UNKNOWN_DATABASE, detail
    return TIMESCALE_UNKNOWN, detail
```

同步扩展 `__all__` 列表，追加以上常量与五个 `map_*` 函数名。

- [ ] **Step 2: 修改 pyproject.toml 增 connectors-ext 三驱动**

在 `backend/pyproject.toml` 的 `connectors-ext` 数组末尾追加（保留现有 pyhive/pymssql/oracledb/clickhouse-connect/dmPython/trino）：

```toml
    "pymongo>=4.6.0",
    "influxdb-client>=1.40.0",
    "taospy>=2.7.0",
```

- [ ] **Step 3: 创建 test_connectors_gov_r40.py 脚手架**

```python
"""M11 嵌入式/时序/文档连接器 L1 kickoff r40 — CONN-014/011/012/006/013."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R40_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r40?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r40_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R40_SQLITE_URL
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


def test_r40_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None
```

- [ ] **Step 4: 运行脚手架测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py::test_r40_scaffold -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/errors.py backend/pyproject.toml tests/test_connectors_gov_r40.py
git commit -m "chore(r40): five-prefix error mappers + connectors-ext + test scaffold"
```

---

### Task 2: CONN-014 — MongoDB 连接器 + 8 条测试

**Files:**
- Create: `backend/app/datasources/dialects/mongodb.py`
- Modify: `tests/test_connectors_gov_r40.py`（追加 CONN-014 段 8 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_mongodb_error`、`MONGODB_*` 常量；`TestConnectionResult`/`SchemaInfo`/`TableInfo`/`ColumnInfo`
- Produces: `MongodbConnector`（`type=mongodb`, `category=document`）；`MONGODB_MAX_FIELDS=500`

- [ ] **Step 1: 写失败测试（CONN-014 段 8 条）**

在 `tests/test_connectors_gov_r40.py` 追加：

```python
from unittest.mock import MagicMock, patch

from app.datasources.dialects.mongodb import MONGODB_MAX_FIELDS, MongodbConnector
from app.datasources.registry import export_type_catalog


def test_mongodb_types_catalog_r40():
    """T-CONN-R40-014-01: types 含 mongodb category=document schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "mongodb" in types
    assert types["mongodb"]["category"] == "document"
    assert "schema_browser" in types["mongodb"]["capabilities"]


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_test_connection_ok_r40(mock_get_client):
    """T-CONN-R40-014-02: mock ping 成功 → ok=True。"""
    client = MagicMock()
    client.admin.command.return_value = {"ok": 1}
    mock_get_client.return_value = client
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert result.ok is True
    client.admin.command.assert_called_with("ping")


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_auth_failed_r40(mock_get_client):
    """T-CONN-R40-014-03: mock 认证失败 → MONGODB_AUTH_FAILED。"""
    from pymongo.errors import OperationFailure

    mock_get_client.side_effect = OperationFailure("Authentication failed", code=18)
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "MONGODB_AUTH_FAILED"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_conn_refused_r40(mock_get_client):
    """T-CONN-R40-014-04: mock 连接拒绝 → MONGODB_CONN_REFUSED。"""
    mock_get_client.side_effect = ConnectionRefusedError("Connection refused")
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert result.ok is False
    assert result.code == "MONGODB_CONN_REFUSED"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_timeout_r40(mock_get_client):
    """T-CONN-R40-014-05: mock 超时 → MONGODB_TIMEOUT。"""
    from pymongo.errors import ServerSelectionTimeoutError

    mock_get_client.side_effect = ServerSelectionTimeoutError("timed out")
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert result.ok is False
    assert result.code == "MONGODB_TIMEOUT"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_list_schemas_filters_system_r40(mock_get_client):
    """T-CONN-R40-014-06: mock 库列表过滤 admin/local/config。"""
    client = MagicMock()
    client.list_database_names.return_value = ["app", "admin", "local", "config"]
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    schemas = connector.list_schemas(connection)
    names = {s.name for s in schemas}
    assert names == {"app"}
    assert "admin" not in names


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_unknown_database_tables_r40(mock_get_client):
    """T-CONN-R40-014-07: mock 未知 database list_tables → []。"""
    client = MagicMock()
    client.__getitem__.side_effect = KeyError("unknown")
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert connector.list_tables(connection, "missing_db") == []


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_list_columns_limit_r40(mock_get_client):
    """T-CONN-R40-014-08: mock 600 字段文档 → list_columns 返回 500。"""
    client = MagicMock()
    collection = MagicMock()
    doc = {f"field_{i}": i for i in range(600)}
    collection.find_one.return_value = doc
    db = MagicMock()
    db.__getitem__.return_value = collection
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    columns = connector.list_columns(connection, "app", "events")
    assert len(columns) == MONGODB_MAX_FIELDS
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k mongodb -v`
Expected: FAIL（`MongodbConnector` 未定义或 types catalog 无 mongodb）

- [ ] **Step 3: 实现 mongodb.py**

创建 `backend/app/datasources/dialects/mongodb.py`：

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import MONGODB_DRIVER_MISSING, map_mongodb_error

MONGODB_MAX_FIELDS = 500
_SYSTEM_DBS = frozenset({"admin", "local", "config"})
_BSON_TYPE_MAP = {
    "str": "string",
    "int": "number",
    "float": "number",
    "bool": "boolean",
    "datetime": "datetime",
    "dict": "json",
    "list": "json",
}


def _import_pymongo():
    try:
        from pymongo import MongoClient
        from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

        return MongoClient, OperationFailure, ServerSelectionTimeoutError
    except ImportError:
        return None, None, None


def _mongo_uri(*, host: str, port: int, username: str, password: str, database: str) -> str:
    auth = f"{username}:{password}@" if username or password else ""
    db = database or "admin"
    return f"mongodb://{auth}{host}:{port}/{db}"


def _get_client(**kwargs: Any) -> Any:
    MongoClient, _, _ = _import_pymongo()
    if MongoClient is None:
        raise ImportError("pymongo not installed")
    timeout_ms = int(max(1.0, float(kwargs.get("timeout_sec", 5.0))) * 1000)
    return MongoClient(
        _mongo_uri(
            host=kwargs["host"],
            port=kwargs.get("port", 27017),
            username=kwargs.get("username", ""),
            password=kwargs.get("password", ""),
            database=kwargs.get("database", ""),
        ),
        serverSelectionTimeoutMS=timeout_ms,
    )


def _normalize_bson_type(value: Any) -> str:
    return _BSON_TYPE_MAP.get(type(value).__name__, "unknown")


class MongodbConnector:
    type = "mongodb"
    category = "document"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "MongoDB"

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
        MongoClient, OperationFailure, ServerSelectionTimeoutError = _import_pymongo()
        if MongoClient is None:
            return TestConnectionResult(
                ok=False,
                message=f"[{MONGODB_DRIVER_MISSING}] pymongo not installed",
                latency_ms=0,
                code=MONGODB_DRIVER_MISSING,
            )
        try:
            client = _get_client(
                host=host, port=port, database=database, username=username,
                password=password, timeout_sec=timeout_sec,
            )
            try:
                client.admin.command("ping")
            finally:
                client.close()
        except (OperationFailure, ServerSelectionTimeoutError, Exception) as exc:
            code, detail = map_mongodb_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        return _get_client(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        names = [n for n in connection.list_database_names() if n not in _SYSTEM_DBS]
        return [SchemaInfo(name=n) for n in sorted(names)]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        try:
            db = connection[schema]
            return [TableInfo(name=n, type="collection") for n in sorted(db.list_collection_names())]
        except Exception:
            return []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        try:
            doc = connection[schema][table].find_one()
        except Exception:
            return []
        if not doc:
            return []
        columns = [
            ColumnInfo(name=k, data_type=_normalize_bson_type(v), nullable=True)
            for k, v in sorted(doc.items())
        ]
        return columns[:MONGODB_MAX_FIELDS] if len(columns) > MONGODB_MAX_FIELDS else columns
```

- [ ] **Step 4: 临时注册以便 types catalog 测试通过**

在 `backend/app/datasources/__init__.py` 追加（Task 7 会补齐其余四方言）：

```python
from app.datasources.dialects.mongodb import MongodbConnector
# ...
register_dialect(MongodbConnector())
```

- [ ] **Step 5: 运行 MongoDB 测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k mongodb -v`
Expected: 8 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/dialects/mongodb.py backend/app/datasources/__init__.py tests/test_connectors_gov_r40.py
git commit -m "feat(r40): CONN-014 MongoDB connector L1 + 8 tests"
```

---

### Task 3: CONN-011 — InfluxDB 连接器 + 7 条测试

**Files:**
- Create: `backend/app/datasources/dialects/influxdb.py`
- Modify: `backend/app/datasources/__init__.py`（追加 `register_dialect(InfluxdbConnector())`）
- Modify: `tests/test_connectors_gov_r40.py`（追加 CONN-011 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_influx_error`、`INFLUX_*`；连接参数 `username=org`、`password=token`、`database=bucket`
- Produces: `InfluxdbConnector`（`type=influxdb`, `category=timeseries`）；`INFLUX_MAX_MEASUREMENTS=500`

- [ ] **Step 1: 写失败测试（CONN-011 段 7 条）**

```python
from app.datasources.dialects.influxdb import INFLUX_MAX_MEASUREMENTS, InfluxdbConnector


def test_influxdb_types_catalog_r40():
    """T-CONN-R40-011-01: types 含 influxdb category=timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "influxdb" in types
    assert types["influxdb"]["category"] == "timeseries"
    assert "schema_browser" in types["influxdb"]["capabilities"]


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_test_connection_ok_r40(mock_build):
    """T-CONN-R40-011-02: mock ping 成功 → ok=True。"""
    client = MagicMock()
    client.ping.return_value = True
    mock_build.return_value = client
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is True


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_auth_failed_r40(mock_build):
    """T-CONN-R40-011-03: mock 401 → INFLUX_AUTH_FAILED。"""
    mock_build.side_effect = Exception("401 Unauthorized")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="badorg", password="bad"
    )
    assert result.ok is False
    assert result.code == "INFLUX_AUTH_FAILED"


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_conn_refused_r40(mock_build):
    """T-CONN-R40-011-04: mock connection refused → INFLUX_CONN_REFUSED。"""
    mock_build.side_effect = ConnectionRefusedError("Connection refused")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_CONN_REFUSED"


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_unknown_org_r40(mock_build):
    """T-CONN-R40-011-05: mock 非法 org → INFLUX_UNKNOWN_ORG。"""
    mock_build.side_effect = Exception("org not found: badorg")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="badorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_UNKNOWN_ORG"


@patch("app.datasources.dialects.influxdb._query_api")
def test_influxdb_unknown_bucket_tables_r40(mock_query_api):
    """T-CONN-R40-011-06: mock 未知 bucket measurements → []。"""
    mock_query_api.return_value.query.return_value = []
    connector = InfluxdbConnector()
    connection = MagicMock()
    assert connector.list_tables(connection, "missing_bucket") == []


@patch("app.datasources.dialects.influxdb._query_api")
def test_influxdb_list_tables_limit_r40(mock_query_api):
    """T-CONN-R40-011-07: mock 600 measurements → list_tables 返回 500。"""
    tables = MagicMock()
    tables.records = [MagicMock(get_value=lambda: f"m{i}") for i in range(600)]
    mock_query_api.return_value.query.return_value = tables
    connector = InfluxdbConnector()
    connection = MagicMock()
    result = connector.list_tables(connection, "metrics")
    assert len(result) == INFLUX_MAX_MEASUREMENTS
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k influxdb -v`
Expected: FAIL

- [ ] **Step 3: 实现 influxdb.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import INFLUX_DRIVER_MISSING, map_influx_error

INFLUX_MAX_MEASUREMENTS = 500


def _import_influx():
    try:
        from influxdb_client import InfluxDBClient

        return InfluxDBClient
    except ImportError:
        return None


def _build_client(**kwargs: Any) -> Any:
    InfluxDBClient = _import_influx()
    if InfluxDBClient is None:
        raise ImportError("influxdb-client not installed")
    host = kwargs["host"]
    port = kwargs.get("port", 8086)
    org = kwargs.get("username", "")
    token = kwargs.get("password", "")
    url = f"http://{host}:{port}"
    return InfluxDBClient(url=url, token=token, org=org)


def _query_api(connection: Any) -> Any:
    return connection.query_api()


class InfluxdbConnector:
    """InfluxDB 2.x: username=org, password=token, database=bucket."""

    type = "influxdb"
    category = "timeseries"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "InfluxDB"

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
        if _import_influx() is None:
            return TestConnectionResult(
                ok=False,
                message=f"[{INFLUX_DRIVER_MISSING}] influxdb-client not installed",
                latency_ms=0,
                code=INFLUX_DRIVER_MISSING,
            )
        try:
            client = _build_client(
                host=host, port=port, username=username, password=password, database=database,
            )
            try:
                if not client.ping():
                    raise RuntimeError("ping failed")
            finally:
                client.close()
        except Exception as exc:
            code, detail = map_influx_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        return _build_client(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        buckets_api = connection.buckets_api()
        buckets = buckets_api.find_buckets().buckets or []
        return [SchemaInfo(name=b.name) for b in sorted(buckets, key=lambda x: x.name)]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        try:
            flux = f'import "influxdata/influxdb/schema" schema.measurements(bucket: "{schema}")'
            tables = _query_api(connection).query(flux)
            names: list[str] = []
            for table in tables:
                for record in table.records:
                    val = record.get_value()
                    if val:
                        names.append(str(val))
            unique = sorted(set(names))
            sliced = unique[:INFLUX_MAX_MEASUREMENTS]
            return [TableInfo(name=n, type="measurement") for n in sliced]
        except Exception:
            return []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        columns: list[ColumnInfo] = []
        try:
            for kind, flux_tpl in (
                ("number", f'import "influxdata/influxdb/schema" schema.fieldKeys(bucket: "{schema}", measurement: "{table}")'),
                ("string", f'import "influxdata/influxdb/schema" schema.tagKeys(bucket: "{schema}", measurement: "{table}")'),
            ):
                result = _query_api(connection).query(flux_tpl)
                for tbl in result:
                    for record in tbl.records:
                        val = record.get_value()
                        if val:
                            columns.append(ColumnInfo(name=str(val), data_type=kind, nullable=True))
        except Exception:
            return []
        return columns
```

- [ ] **Step 4: 注册并运行测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k influxdb -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/influxdb.py backend/app/datasources/__init__.py tests/test_connectors_gov_r40.py
git commit -m "feat(r40): CONN-011 InfluxDB connector L1 + 7 tests"
```

---

### Task 4: CONN-012 — TDengine 连接器 + 7 条测试

**Files:**
- Create: `backend/app/datasources/dialects/tdengine.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `tests/test_connectors_gov_r40.py`（追加 CONN-012 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_tdengine_error`、`TDENGINE_*`
- Produces: `TdengineConnector`（`type=tdengine`, `category=timeseries`）；`TDENGINE_MAX_COLUMNS=500`

- [ ] **Step 1: 写失败测试（CONN-012 段 7 条）**

```python
from app.datasources.dialects.tdengine import TDENGINE_MAX_COLUMNS, TdengineConnector
from app.datasources.registry import ConnectorRegistry


def test_tdengine_types_catalog_r40():
    """T-CONN-R40-012-01: types 含 tdengine category=timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tdengine" in types
    assert types["tdengine"]["category"] == "timeseries"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_test_connection_ok_r40(mock_connect):
    """T-CONN-R40-012-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = ("3.0.0",)
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is True


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_auth_failed_r40(mock_connect):
    """T-CONN-R40-012-03: mock 认证失败 → TDENGINE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Authentication failure")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_AUTH_FAILED"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_conn_refused_r40(mock_connect):
    """T-CONN-R40-012-04: mock 端点不可达 → TDENGINE_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_CONN_REFUSED"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_unknown_database_tables_r40(mock_connect):
    """T-CONN-R40-012-05: mock 未知 database list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.side_effect = Exception("database not exist")
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert connector.list_tables(connection, "missing") == []


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_stable_table_types_r40(mock_connect):
    """T-CONN-R40-012-06: mock stable+table 列表含 type 区分。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [("meters",)],  # SHOW STABLES
        [("d001",)],    # SHOW TABLES
    ]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    tables = {t.name: t.type for t in connector.list_tables(connection, "power")}
    assert tables.get("meters") == "stable"
    assert tables.get("d001") == "table"


def test_tdengine_registry_plugin_r40():
    """T-CONN-R40-012-07: registry 插件注册不修改 ConnectorRegistry 核心类（NFR-04）。"""
    registry = ConnectorRegistry()
    assert hasattr(registry, "register")
    assert hasattr(registry, "get")
    assert "tdengine" in {item["type"] for item in export_type_catalog()}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k tdengine -v`
Expected: FAIL

- [ ] **Step 3: 实现 tdengine.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import TDENGINE_DRIVER_MISSING, map_tdengine_error

TDENGINE_MAX_COLUMNS = 500
_SYSTEM_DBS = frozenset({"information_schema"})


def _import_taos():
    try:
        import taos

        return taos
    except ImportError:
        return None


def _connect(**kwargs: Any) -> Any:
    taos = _import_taos()
    if taos is None:
        raise ImportError("taospy not installed")
    return taos.connect(
        host=kwargs["host"],
        port=kwargs.get("port", 6041),
        user=kwargs.get("username", "root"),
        password=kwargs.get("password", ""),
        database=kwargs.get("database", ""),
    )


class TdengineConnector:
    type = "tdengine"
    category = "timeseries"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "TDengine"

    def test_connection(self, *, host: str, port: int, database: str, username: str, password: str, timeout_sec: float = 5.0, **_: object) -> TestConnectionResult:
        started = time.perf_counter()
        if _import_taos() is None:
            return TestConnectionResult(ok=False, message=f"[{TDENGINE_DRIVER_MISSING}] taospy not installed", latency_ms=0, code=TDENGINE_DRIVER_MISSING)
        try:
            conn = _connect(host=host, port=port, database=database, username=username, password=password)
            try:
                cur = conn.cursor()
                cur.execute("SELECT server_version()")
                cur.fetchone()
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_tdengine_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        return _connect(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cur = connection.cursor()
        cur.execute("SHOW DATABASES")
        names = [row[0] for row in cur.fetchall() if row[0] not in _SYSTEM_DBS]
        return [SchemaInfo(name=n) for n in sorted(names)]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        try:
            cur = connection.cursor()
            cur.execute(f"USE {schema}")
            cur.execute("SHOW STABLES")
            stables = {row[0]: "stable" for row in cur.fetchall()}
            cur.execute("SHOW TABLES")
            tables = {row[0]: "table" for row in cur.fetchall()}
            merged = {**tables, **stables}
            return [TableInfo(name=n, type=t) for n, t in sorted(merged.items())]
        except Exception:
            return []

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        try:
            cur = connection.cursor()
            cur.execute(f"DESCRIBE {schema}.{table}")
            columns = [
                ColumnInfo(name=row[0], data_type=str(row[1]), nullable=True)
                for row in cur.fetchall()
            ]
            return columns[:TDENGINE_MAX_COLUMNS] if len(columns) > TDENGINE_MAX_COLUMNS else columns
        except Exception:
            return []
```

- [ ] **Step 4: 注册并运行测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k tdengine -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/tdengine.py backend/app/datasources/__init__.py tests/test_connectors_gov_r40.py
git commit -m "feat(r40): CONN-012 TDengine connector L1 + 7 tests"
```

---

### Task 5: CONN-006 — SQLite 连接器 + 7 条测试

**Files:**
- Create: `backend/app/datasources/dialects/sqlite.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `tests/test_connectors_gov_r40.py`（追加 CONN-006 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `SQLITE_*` 常量（路径校验在 connector 内直接返回，不经 DB 异常）
- Produces: `SqliteConnector`（`type=sqlite`, `category=embedded`）；`_validate_db_path(host) -> Path`

- [ ] **Step 1: 写失败测试（CONN-006 段 7 条）**

```python
import os
import sqlite3
import tempfile

from app.datasources.dialects.sqlite import SqliteConnector


def test_sqlite_types_catalog_r40():
    """T-CONN-R40-006-01: types 含 sqlite category=embedded。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "sqlite" in types
    assert types["sqlite"]["category"] == "embedded"


def test_sqlite_test_connection_ok_r40(tmp_path):
    """T-CONN-R40-006-02: tmp 文件 → ok=True。"""
    db_path = tmp_path / "sample.db"
    sqlite3.connect(db_path).close()
    result = SqliteConnector().test_connection(
        host=str(db_path), port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is True


def test_sqlite_file_not_found_r40():
    """T-CONN-R40-006-03: 不存在路径 → SQLITE_FILE_NOT_FOUND。"""
    result = SqliteConnector().test_connection(
        host="/tmp/vitalspan_missing_r40.db", port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_FILE_NOT_FOUND"


def test_sqlite_path_traversal_r40():
    """T-CONN-R40-006-04: ../../etc/passwd 样式 → SQLITE_PATH_TRAVERSAL。"""
    result = SqliteConnector().test_connection(
        host="../../etc/passwd", port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_PATH_TRAVERSAL"


def test_sqlite_permission_denied_r40(tmp_path, monkeypatch):
    """T-CONN-R40-006-05: mock 无读权限 → SQLITE_PERMISSION_DENIED。"""
    db_path = tmp_path / "locked.db"
    sqlite3.connect(db_path).close()
    monkeypatch.setattr(os, "access", lambda *_a, **_k: False)
    result = SqliteConnector().test_connection(
        host=str(db_path), port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_PERMISSION_DENIED"


def test_sqlite_list_schemas_main_r40(tmp_path):
    """T-CONN-R40-006-06: list_schemas 返回 main。"""
    db_path = tmp_path / "app.db"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE t1 (id INTEGER)")
    conn.commit()
    conn.close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    schemas = connector.list_schemas(connection)
    assert [s.name for s in schemas] == ["main"]


def test_sqlite_unknown_table_columns_r40(tmp_path):
    """T-CONN-R40-006-07: 未知表 list_columns → []。"""
    db_path = tmp_path / "app.db"
    sqlite3.connect(db_path).close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    assert connector.list_columns(connection, "main", "missing_table") == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k sqlite -v`
Expected: FAIL

- [ ] **Step 3: 实现 sqlite.py**

```python
from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    SQLITE_FILE_NOT_FOUND,
    SQLITE_PATH_TRAVERSAL,
    SQLITE_PERMISSION_DENIED,
    map_sqlite_error,
)

SQLITE_MAX_COLUMNS = 500


def _validate_db_path(host: str) -> tuple[Path | None, str | None]:
    if ".." in host.replace("\\", "/").split("/"):
        return None, SQLITE_PATH_TRAVERSAL
    path = Path(host).expanduser().resolve()
    if not path.is_file():
        return None, SQLITE_FILE_NOT_FOUND
    if not os.access(path, os.R_OK):
        return None, SQLITE_PERMISSION_DENIED
    return path, None


class SqliteConnector:
    """SQLite 文件型源：host=文件系统路径，port 忽略（存 1 满足校验）。"""

    type = "sqlite"
    category = "embedded"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "SQLite"

    def test_connection(self, *, host: str, port: int, database: str, username: str, password: str, timeout_sec: float = 5.0, **_: object) -> TestConnectionResult:
        started = time.perf_counter()
        path, err_code = _validate_db_path(host)
        if err_code:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{err_code}] invalid sqlite path", latency_ms=latency_ms, code=err_code)
        try:
            conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            try:
                conn.execute("SELECT 1")
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_sqlite_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        path, err_code = _validate_db_path(kwargs["host"])
        if err_code or path is None:
            raise ValueError(err_code or SQLITE_FILE_NOT_FOUND)
        return sqlite3.connect(f"file:{path}?mode=ro", uri=True)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return [SchemaInfo(name="main")]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cur = connection.execute(
            "SELECT name, type FROM sqlite_master "
            "WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        return [TableInfo(name=row[0], type=row[1]) for row in cur.fetchall()]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        try:
            cur = connection.execute(f'PRAGMA table_info("{table}")')
            columns = [
                ColumnInfo(name=row[1], data_type=str(row[2]), nullable=not bool(row[3]))
                for row in cur.fetchall()
            ]
            return columns[:SQLITE_MAX_COLUMNS] if len(columns) > SQLITE_MAX_COLUMNS else columns
        except sqlite3.Error:
            return []
```

- [ ] **Step 4: 注册并运行测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k sqlite -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/sqlite.py backend/app/datasources/__init__.py tests/test_connectors_gov_r40.py
git commit -m "feat(r40): CONN-006 SQLite connector L1 + path guards + 7 tests"
```

---

### Task 6: CONN-013 — TimescaleDB 连接器 + 7 条测试

**Files:**
- Create: `backend/app/datasources/dialects/timescaledb.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `tests/test_connectors_gov_r40.py`（追加 CONN-013 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `PostgresConnector`、`map_timescale_error`、`TIMESCALE_*`
- Produces: `TimescaledbConnector`（`type=timescaledb`, `category=timeseries`）；`TIMESCALE_MAX_COLUMNS=500`

- [ ] **Step 1: 写失败测试（CONN-013 段 7 条）**

```python
from app.datasources.dialects.timescaledb import TIMESCALE_MAX_COLUMNS, TimescaledbConnector


def test_timescaledb_types_catalog_r40():
    """T-CONN-R40-013-01: types 含 timescaledb category=timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "timescaledb" in types
    assert types["timescaledb"]["category"] == "timeseries"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_test_connection_ok_r40(mock_open):
    """T-CONN-R40-013-02: mock PG ping + 扩展存在 → ok=True。"""
    conn = MagicMock()
    ext_cur = MagicMock()
    ext_cur.fetchone.return_value = (1,)
    conn.execute.side_effect = [MagicMock(), ext_cur]
    mock_open.return_value = conn
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is True


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_auth_failed_r40(mock_open):
    """T-CONN-R40-013-03: mock 认证失败 → TIMESCALE_AUTH_FAILED。"""
    import psycopg

    mock_open.side_effect = psycopg.OperationalError("password authentication failed")
    mock_open.side_effect.pgcode = "28P01"
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_AUTH_FAILED"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_extension_missing_r40(mock_open):
    """T-CONN-R40-013-04: mock 扩展缺失 → TIMESCALE_EXTENSION_MISSING。"""
    conn = MagicMock()
    ext_cur = MagicMock()
    ext_cur.fetchone.return_value = None
    conn.execute.side_effect = [MagicMock(), ext_cur]
    mock_open.return_value = conn
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_EXTENSION_MISSING"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_tables")
@patch("app.datasources.dialects.timescaledb.TimescaledbConnector._hypertable_names")
def test_timescaledb_hypertable_mark_r40(mock_hypertables, mock_list_tables):
    """T-CONN-R40-013-06: mock tables 含 hypertable 标记 type=hypertable。"""
    from app.datasources.dialects.base import TableInfo

    mock_list_tables.return_value = [
        TableInfo(name="events", type="table"),
        TableInfo(name="metrics", type="table"),
    ]
    mock_hypertables.return_value = {"metrics"}
    connector = TimescaledbConnector()
    tables = {t.name: t.type for t in connector.list_tables(MagicMock(), "public")}
    assert tables["metrics"] == "hypertable"
    assert tables["events"] == "table"


def test_timescaledb_postgresql_still_registered_r40():
    """T-CONN-R40-013-07: postgresql types catalog 仍独立存在。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "postgresql" in types
    assert "timescaledb" in types
    assert types["postgresql"]["type"] == "postgresql"
```

注：T-CONN-R40-013-05（未知 database）由 `map_timescale_error` 委托 PG `TIMESCALE_UNKNOWN_DATABASE` 覆盖，合入 Step 3 实现后通过 auth/unknown database 单测或 Task 7 联合回归断言。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k timescaledb -v`
Expected: FAIL

- [ ] **Step 3: 实现 timescaledb.py**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import TIMESCALE_EXTENSION_MISSING, map_timescale_error
from app.datasources.dialects.postgres import PostgresConnector

TIMESCALE_MAX_COLUMNS = 500


class TimescaledbConnector:
    type = "timescaledb"
    category = "timeseries"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "TimescaleDB"

    def __init__(self) -> None:
        self._delegate = PostgresConnector()

    def _hypertable_names(self, connection: Any, schema: str) -> set[str]:
        try:
            cur = connection.execute(
                "SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_schema = %s",
                (schema,),
            )
            return {row[0] for row in cur.fetchall()}
        except Exception:
            return set()

    def test_connection(self, *, host: str, port: int, database: str, username: str, password: str, timeout_sec: float = 5.0, **kwargs: object) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self._delegate.open_connection(
                host=host, port=port, database=database, username=username, password=password,
                connect_timeout_sec=timeout_sec, ssl_mode=kwargs.get("ssl_mode", "preferred"),
            )
            try:
                conn.execute("SELECT 1")
                ext = conn.execute("SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'")
                if ext.fetchone() is None:
                    latency_ms = int((time.perf_counter() - started) * 1000)
                    return TestConnectionResult(
                        ok=False,
                        message=f"[{TIMESCALE_EXTENSION_MISSING}] timescaledb extension not installed",
                        latency_ms=latency_ms,
                        code=TIMESCALE_EXTENSION_MISSING,
                    )
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_timescale_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        return self._delegate.open_connection(**kwargs)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._delegate.list_schemas(connection) or []

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        tables = self._delegate.list_tables(connection, schema) or []
        hypertables = self._hypertable_names(connection, schema)
        return [
            TableInfo(name=t.name, type="hypertable" if t.name in hypertables else t.type)
            for t in tables
        ]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        columns = self._delegate.list_columns(connection, schema, table)
        return columns[:TIMESCALE_MAX_COLUMNS] if len(columns) > TIMESCALE_MAX_COLUMNS else columns
```

- [ ] **Step 4: 注册并运行测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -k timescaledb -v`
Expected: 6+ passed（013-05 可 Task 7 补断言）

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/timescaledb.py backend/app/datasources/__init__.py tests/test_connectors_gov_r40.py
git commit -m "feat(r40): CONN-013 TimescaleDB connector L1 + hypertable mark + 7 tests"
```

---

### Task 7: 注册汇总 + dialects/__init__.py 导出 + types catalog 联合断言

**Files:**
- Modify: `backend/app/datasources/__init__.py`（五方言完整注册顺序）
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `tests/test_connectors_gov_r40.py`（追加 T-REG-R40-* 段）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端 registry；无 UI 变更

**Interfaces:**
- Consumes: 五 `*Connector` 类
- Produces: `export_type_catalog()` 返回 **18** types；五新 type 均含 `connectivity_test` + `schema_browser`

- [ ] **Step 1: 确认 register_builtin_dialects 完整注册**

`backend/app/datasources/__init__.py` 应包含（顺序与 design 一致）：

```python
from app.datasources.dialects.influxdb import InfluxdbConnector
from app.datasources.dialects.mongodb import MongodbConnector
from app.datasources.dialects.sqlite import SqliteConnector
from app.datasources.dialects.tdengine import TdengineConnector
from app.datasources.dialects.timescaledb import TimescaledbConnector

def register_builtin_dialects() -> None:
    # ... 既有 13 种 ...
    register_dialect(MongodbConnector())
    register_dialect(InfluxdbConnector())
    register_dialect(TdengineConnector())
    register_dialect(SqliteConnector())
    register_dialect(TimescaledbConnector())
```

- [ ] **Step 2: 更新 dialects/__init__.py 导出**

```python
from app.datasources.dialects.influxdb import INFLUX_MAX_MEASUREMENTS, InfluxdbConnector
from app.datasources.dialects.mongodb import MONGODB_MAX_FIELDS, MongodbConnector
from app.datasources.dialects.sqlite import SqliteConnector
from app.datasources.dialects.tdengine import TDENGINE_MAX_COLUMNS, TdengineConnector
from app.datasources.dialects.timescaledb import TIMESCALE_MAX_COLUMNS, TimescaledbConnector

__all__ = [
    # ... 既有导出 ...
    "INFLUX_MAX_MEASUREMENTS",
    "InfluxdbConnector",
    "MONGODB_MAX_FIELDS",
    "MongodbConnector",
    "SqliteConnector",
    "TDENGINE_MAX_COLUMNS",
    "TdengineConnector",
    "TIMESCALE_MAX_COLUMNS",
    "TimescaledbConnector",
]
```

- [ ] **Step 3: 追加联合 registry 测试**

```python
_R40_NEW_TYPES = ("mongodb", "influxdb", "tdengine", "sqlite", "timescaledb")


def test_r40_export_type_catalog_count():
    """T-REG-R40-01: export_type_catalog 返回 18 种 type。"""
    catalog = export_type_catalog()
    assert len(catalog) == 18


@pytest.mark.parametrize("connector_type", _R40_NEW_TYPES)
def test_r40_new_types_capabilities(connector_type):
    """T-REG-R40-02: 五新 type 均含 connectivity_test + schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert connector_type in types
    caps = set(types[connector_type]["capabilities"])
    assert "connectivity_test" in caps
    assert "schema_browser" in caps


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_unknown_database_r40(mock_open):
    """T-CONN-R40-013-05: mock 未知 database → TIMESCALE_UNKNOWN_DATABASE。"""
    import psycopg

    exc = psycopg.OperationalError('database "missing" does not exist')
    exc.pgcode = "3D000"
    mock_open.side_effect = exc
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="missing", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_UNKNOWN_DATABASE"
```

- [ ] **Step 4: 运行 r40 全套件**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r40.py -v --tb=short`
Expected: ≥37 passed（36 方言断言 + 1 scaffold + 2 registry）

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/__init__.py backend/app/datasources/dialects/__init__.py tests/test_connectors_gov_r40.py
git commit -m "feat(r40): register five M11 dialects + types catalog regression"
```

---

### Task 8: 回归门控 + test_invalid_connector_type 修复 + 域文档

**Files:**
- Modify: `tests/test_datasources_l1.py`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端回归与文档；无 UI 变更

**Interfaces:**
- Consumes: 五方言已注册；r39/r37/r36 套件不变
- Produces: `test_invalid_connector_type` 使用 `couchdb`；`datasources.md` r40 kickoff 笔记

- [ ] **Step 1: 修复 test_invalid_connector_type（P4 blocker）**

在 `tests/test_datasources_l1.py` 将 `test_invalid_connector_type` 改为：

```python
def test_invalid_connector_type(client, auth_headers):
    """T-DS-C08: 非法 type → 422。"""
    bad = {**_payload(), "type": "couchdb", "code": "couch_ds"}
    resp = client.post("/api/v1/datasources", json=bad, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "UNKNOWN_CONNECTOR_TYPE"
```

- [ ] **Step 2: 更新 docs/services/datasources.md**

在「主要类型 / 入口」表追加五行：

| `dialects/mongodb.py` | MongoDB 文档型（pymongo，`category=document`） | CONN-014 | 已实现 L1 r40 |
| `dialects/influxdb.py` | InfluxDB 2.x 时序（influxdb-client，org/bucket 语义映射） | CONN-011 | 已实现 L1 r40 |
| `dialects/tdengine.py` | TDengine 时序（taospy REST，stable 标记） | CONN-012 | 已实现 L1 r40 |
| `dialects/sqlite.py` | SQLite 嵌入式文件源（`host=路径`，路径穿越守卫） | CONN-006 | 已实现 L1 r40 |
| `dialects/timescaledb.py` | TimescaleDB 时序（PG 委托 + hypertable 标记） | CONN-013 | 已实现 L1 r40 |

追加小节 `### r40 connector kickoff（2026-07-04）`：

- 五方言 L1 — MongoDB/InfluxDB/TDengine/SQLite/TimescaleDB；`export_type_catalog()` 18 types
- 错误码前缀：`MONGODB_*` / `INFLUX_*` / `TDENGINE_*` / `SQLITE_*` / `TIMESCALE_*`
- 可选依赖：`connectors-ext` 增 pymongo、influxdb-client、taospy
- 测试套件：`tests/test_connectors_gov_r40.py`（≥35 条 T-CONN-R40-* / T-REG-R40-*）
- 回归修复：`test_datasources_l1.py::test_invalid_connector_type` 改用未注册 `couchdb`（CONN-014 注册后 `mongodb` 为合法 type）
- PRD 对账：`F04-CONN.md` 验收条款 P5 重评（非 P3）

- [ ] **Step 3: 全量回归验证**

Run:

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  tests/test_connectors_gov_r40.py \
  tests/test_query_meta_conn_r39.py \
  tests/test_connectors_gov_r37.py \
  tests/test_connectors_gov_r36.py \
  tests/test_datasources_l1.py::test_invalid_connector_type \
  -v
```

Expected:
- ruff: All checks passed
- r40: ≥37 passed
- r39: 33/33 passed
- r37: 40/40 passed
- r36: 37/37 passed
- test_invalid_connector_type: PASS

Run full baseline:

```bash
cd backend && python3 -m pytest -q
```

Expected: ≥959 passed, 4 skipped, 0 failed

- [ ] **Step 4: Commit**

```bash
git add tests/test_datasources_l1.py docs/services/datasources.md
git commit -m "fix(r40): couchdb invalid type regression + datasources.md r40 kickoff"
```

---

## Self-Review Checklist

| design 子项 | 对应 Task |
|-------------|-----------|
| CONN-014 MongoDB | Task 2 |
| CONN-011 InfluxDB | Task 3 |
| CONN-012 TDengine | Task 4 |
| CONN-006 SQLite | Task 5 |
| CONN-013 TimescaleDB | Task 6 |
| errors.py 五前缀 | Task 1 |
| register_builtin_dialects +18 types | Task 7 |
| test_connectors_gov_r40 ≥35 | Tasks 2–7 |
| test_invalid_connector_type → couchdb | Task 8 |
| r39/r37/r36 回归 | Task 8 |
| docs/services/datasources.md | Task 8 |
| pyproject.toml connectors-ext | Task 1 |

**占位符扫描：** 无 TBD/TODO/适当处理。

**类型一致性：** 五 connector 均实现 `DialectConnector` 协议；`map_*` 与 `{PREFIX}_*` 常量均在 `errors.py` 定义，方言文件仅 import。
