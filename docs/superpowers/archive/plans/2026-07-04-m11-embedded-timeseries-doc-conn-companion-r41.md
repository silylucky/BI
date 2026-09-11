# M11 嵌入式/时序/文档连接器 companion 质量推分 r41 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/errors.py`、`mongodb.py`、`influxdb.py`、`tdengine.py`、`sqlite.py`、`timescaledb.py`、`dialects/__init__.py`、`tests/test_connectors_gov_r41.py`、`docs/services/datasources.md`
> **子项：** CONN-014, CONN-011, CONN-012, CONN-006, CONN-013
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** M11 companion 质量推分 — 闭合 r40 五方言 MongoDB/InfluxDB/TDengine/SQLite/TimescaleDB 的 test_connection/schema/types 边界、结构化 `MONGODB_*`/`INFLUX_*`/`TDENGINE_*`/`SQLITE_*`/`TIMESCALE_*` 错误域完整度与 registry HTTP 链；`test_connectors_gov_r41.py` ≥28 条（目标 35）+ r40 43/43 + r39 33/33 + r37 40/40 + r36 37/37 回归全绿；五 ID 加权总分破 90。

**Architecture:** 镜像 r37/r39 companion 模式 — `errors.py` 补 `map_mongodb_error` → `MONGODB_UNKNOWN_DATABASE` 悬空常量映射；五 connector 巩固空库/空 collection/空 bucket、列 limit=500 切片、`open_connection` 与 `test_connection` 对称守卫；`test_connectors_gov_r41.py` 独立 SQLite fixture（`connectors_gov_r41` 内存库隔离）+ 每方言 ≥1 HTTP test 失败链 + ≥1 metadata 400/502 链；不修改 `ConnectorRegistry` 核心类。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pymongo · influxdb-client · taospy · psycopg 3 · sqlite3（stdlib）· pytest · ruff

## Global Constraints

- 纯后端 companion 质量推分；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 Alembic migration；不触及 `fe/`
- `docs/automate/prd/F04-CONN.md` **P5 对账**（非 P3）
- 错误码前缀：`MONGODB_*`、`INFLUX_*`、`TDENGINE_*`、`SQLITE_*`、`TIMESCALE_*`
- `test_connection` 失败：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`（与 r37/r40 契约一致）
- metadata 路由：`GET /api/v1/datasources/{id}/tables` 缺 `schema` → 400 `METADATA_INVALID_REQUEST`；`GET /api/v1/datasources/{id}/schemas` 连接失败 → 502 `METADATA_CONNECTION_FAILED`
- 列/字段枚举 limit：**500**（`MONGODB_MAX_FIELDS`/`TDENGINE_MAX_COLUMNS`/`TIMESCALE_MAX_COLUMNS`）
- 文件预算：新建 **1** + 修改 **8** = **9**（P3）；设计框定 16 含 P5 `F04-CONN.md`
- 验证基线：r40 后 **967 passed** + 4 skipped；本轮目标 **≥1002 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r41.py tests/test_connectors_gov_r40.py tests/test_query_meta_conn_r39.py tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py -v`

---

### Task 1: 错误域补全 + r41 测试脚手架

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `tests/test_connectors_gov_r41.py`（module fixture + `_create_typed_ds` + `test_r41_scaffold`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；本轮不触及 `fe/` 或壳层组件

**Interfaces:**
- Consumes: r40 `map_mongodb_error` / `map_influx_error` / `map_tdengine_error` / `map_sqlite_error` / `map_timescale_error` 既有实现
- Produces: `map_mongodb_error` 增 `MONGODB_UNKNOWN_DATABASE` 路径；`_R41_SQLITE_URL` fixture；`_create_typed_ds(ds_type)` 辅助

- [ ] **Step 1: 写失败测试 — T-CONN-R41-014-01**

在 `tests/test_connectors_gov_r41.py` 创建文件并追加：

```python
"""M11 嵌入式/时序/文档连接器 companion 质量推分 r41 — CONN-014/011/012/006/013."""
from __future__ import annotations

import os
import sqlite3
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.dialects.errors import map_mongodb_error
from app.datasources.dialects.mongodb import MongodbConnector
from app.datasources.models import get_meta_session
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app

_R41_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r41?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r41_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R41_SQLITE_URL
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


def _create_typed_ds(ds_type: str, *, host: str | None = None, name_suffix: str | None = None):
    suffix = name_suffix or uuid.uuid4().hex[:8]
    session = get_meta_session()
    try:
        defaults = {
            "mongodb": dict(port=27017, database="app", username="", password=""),
            "influxdb": dict(port=8086, database="metrics", username="myorg", password="token"),
            "tdengine": dict(port=6041, database="power", username="root", password="taosdata"),
            "sqlite": dict(port=1, database="main", username="sqlite", password="x"),
            "timescaledb": dict(port=5432, database="metrics", username="ts", password="secret"),
        }
        extra = defaults.get(ds_type, {})
        return create_data_source(
            session,
            DataSourceCreate(
                name=f"{ds_type}-{suffix}",
                code=f"{ds_type}-{suffix}",
                type=ds_type,
                host=host or "127.0.0.1",
                port=extra.get("port", 5432),
                database=extra.get("database", "test"),
                username=extra.get("username", "user"),
                password=extra.get("password", "secret"),
            ),
        )
    finally:
        session.close()


def test_r41_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None


def test_mongodb_unknown_database_r41():
    """T-CONN-R41-014-01: mock database missing → MONGODB_UNKNOWN_DATABASE。"""
    from pymongo.errors import OperationFailure

    exc = OperationFailure('database "missing" does not exist', code=26)
    code, _ = map_mongodb_error(exc)
    assert code == "MONGODB_UNKNOWN_DATABASE"
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="missing", username="", password=""
    )
    # test_connection 路径经 map_mongodb_error；先测 map 再测 connector patch
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py::test_mongodb_unknown_database_r41 -v`
Expected: FAIL — `assert code == "MONGODB_UNKNOWN_DATABASE"` 得 `MONGODB_UNKNOWN`

- [ ] **Step 3: 修改 map_mongodb_error**

将 `backend/app/datasources/dialects/errors.py` 中 `map_mongodb_error` 替换为：

```python
def map_mongodb_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    name = type(exc).__name__
    lowered = detail.lower()
    if "ServerSelectionTimeout" in name or "timeout" in lowered or "timed out" in lowered:
        return MONGODB_TIMEOUT, detail
    # NamespaceNotFound / unknown database — 须在 auth 泛化匹配之前
    exc_code = getattr(exc, "code", None)
    if exc_code == 26:
        return MONGODB_UNKNOWN_DATABASE, detail
    if "database" in lowered and (
        "not found" in lowered or "does not exist" in lowered or "ns not found" in lowered
    ):
        return MONGODB_UNKNOWN_DATABASE, detail
    if "OperationFailure" in name or "authentication" in lowered or "code: 18" in lowered or "code: 13" in lowered:
        return MONGODB_AUTH_FAILED, detail
    if "refused" in lowered or isinstance(exc, ConnectionRefusedError):
        return MONGODB_CONN_REFUSED, detail
    if "invalid" in lowered and "host" in lowered:
        return MONGODB_INVALID_HOST, detail
    return MONGODB_UNKNOWN, detail
```

在 r39 companion 注释块后追加一行文档注释：

```python
# r41 companion: MONGODB_/INFLUX_/TDENGINE_/SQLITE_/TIMESCALE_ timeout/auth/unknown_database
# 映射由 map_* 统一出口；connector test_connection 与 HTTP test 链均消费本模块常量。
```

- [ ] **Step 4: 完善 T-CONN-R41-014-01 connector 路径**

将 `test_mongodb_unknown_database_r41` 改为：

```python
@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_unknown_database_r41(mock_get_client):
    """T-CONN-R41-014-01: mock database missing → MONGODB_UNKNOWN_DATABASE。"""
    from pymongo.errors import OperationFailure

    mock_get_client.side_effect = OperationFailure('database "missing" does not exist', code=26)
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="missing", username="", password=""
    )
    assert result.ok is False
    assert result.code == "MONGODB_UNKNOWN_DATABASE"
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py::test_mongodb_unknown_database_r41 -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/dialects/errors.py tests/test_connectors_gov_r41.py
git commit -m "fix(r41): map_mongodb_error MONGODB_UNKNOWN_DATABASE + r41 scaffold"
```

---

### Task 2: MongoDB companion 边界 + HTTP 链

**Files:**
- Modify: `backend/app/datasources/dialects/mongodb.py`
- Modify: `tests/test_connectors_gov_r41.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1 `map_mongodb_error` + `MONGODB_UNKNOWN_DATABASE`
- Produces: `MongodbConnector.list_columns` 空文档显式 `[]`；`list_tables` 空库 `[]`；BSON 六类型枚举；7 条 T-CONN-R41-014-*

- [ ] **Step 1: 巩固 mongodb.py 边界注释（行为已满足则仅补 docstring）**

在 `list_columns` 的 `if not doc:` 分支上方追加注释：

```python
        # r41: 空 collection（find_one None）→ []，与未知 database 区分
```

在 `list_tables` 的 `if not schema.strip():` 后追加注释：

```python
        # r41: 空库 list_collection_names → []（mock 或真实零 collection）
```

无需改逻辑（r40 已实现 `find_one` None → `[]`）。

- [ ] **Step 2: 追加 MongoDB 测试 T-CONN-R41-014-02 ~ 014-07**

```python
from app.datasources.dialects.mongodb import MONGODB_MAX_FIELDS
from app.datasources.registry import export_type_catalog


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_empty_collection_columns_r41(mock_get_client):
    """T-CONN-R41-014-02: mock 空 collection list_columns → []。"""
    client = MagicMock()
    collection = MagicMock()
    collection.find_one.return_value = None
    db = MagicMock()
    db.__getitem__.return_value = collection
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert connector.list_columns(connection, "app", "events") == []


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_empty_database_tables_r41(mock_get_client):
    """T-CONN-R41-014-03: mock 空库 list_tables → []。"""
    client = MagicMock()
    db = MagicMock()
    db.list_collection_names.return_value = []
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert connector.list_tables(connection, "app") == []


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_bson_type_enum_r41(mock_get_client):
    """T-CONN-R41-014-04: mock BSON 六类型 data_type 枚举。"""
    from datetime import datetime

    client = MagicMock()
    collection = MagicMock()
    collection.find_one.return_value = {
        "s": "x",
        "n": 1,
        "b": True,
        "dt": datetime(2026, 1, 1),
        "j": {"a": 1},
        "arr": [1, 2],
    }
    db = MagicMock()
    db.__getitem__.return_value = collection
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    types = {c.name: c.data_type for c in connector.list_columns(connection, "app", "events")}
    assert types["s"] == "string"
    assert types["n"] == "number"
    assert types["b"] == "boolean"
    assert types["dt"] == "datetime"
    assert types["j"] == "json"
    assert types["arr"] == "json"


def test_mongodb_types_catalog_r41():
    """T-CONN-R41-014-05: types catalog mongodb category=document + schema_browser + displayName。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["mongodb"]["category"] == "document"
    assert "schema_browser" in types["mongodb"]["capabilities"]
    assert types["mongodb"]["displayName"] == "MongoDB"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_http_auth_failed_r41(mock_get_client, client):
    """T-CONN-R41-014-06: HTTP POST test mock auth fail → 200 ok=false MONGODB_AUTH_FAILED traceId。"""
    from pymongo.errors import OperationFailure

    mock_get_client.side_effect = OperationFailure("Authentication failed", code=18)
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "mongodb",
            "name": "mongo-test",
            "code": f"mongo-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 27017,
            "database": "app",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "MONGODB_AUTH_FAILED"
    assert body.get("traceId")


def test_mongodb_metadata_tables_missing_schema_400_r41(client):
    """T-CONN-R41-014-07: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("mongodb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 3: 运行 MongoDB 段测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py -k "mongodb or r41_scaffold or unknown_database" -v`
Expected: 8 passed（scaffold + 014-01~07）

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/mongodb.py tests/test_connectors_gov_r41.py
git commit -m "feat(r41): CONN-014 MongoDB companion boundary + HTTP chain"
```

---

### Task 3: InfluxDB companion 边界 + HTTP 链

**Files:**
- Modify: `backend/app/datasources/dialects/influxdb.py`
- Modify: `tests/test_connectors_gov_r41.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1 `map_influx_error`（`INFLUX_TIMEOUT`/`INFLUX_UNKNOWN_BUCKET` 已有映射）
- Produces: 6 条 T-CONN-R41-011-*

- [ ] **Step 1: influxdb.py 空 bucket 边界注释**

在 `list_tables` 的 `except Exception:` 上方追加：

```python
        # r41: 空 bucket Flux 零行 → []（与 query 异常抛错区分，异常仍 → []）
```

- [ ] **Step 2: 追加 InfluxDB 测试 T-CONN-R41-011-01 ~ 011-06**

```python
from app.datasources.dialects.influxdb import InfluxdbConnector


@patch("app.datasources.dialects.influxdb._build_client")
def test_influx_timeout_r41(mock_build):
    """T-CONN-R41-011-01: mock timeout → INFLUX_TIMEOUT。"""
    mock_build.side_effect = Exception("Connection timed out")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_TIMEOUT"


@patch("app.datasources.dialects.influxdb._build_client")
def test_influx_unknown_bucket_r41(mock_build):
    """T-CONN-R41-011-02: mock bucket not found → INFLUX_UNKNOWN_BUCKET。"""
    mock_build.side_effect = Exception("bucket not found: metrics")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_UNKNOWN_BUCKET"


@patch("app.datasources.dialects.influxdb._query_api")
def test_influx_empty_bucket_tables_r41(mock_query_api):
    """T-CONN-R41-011-03: mock 空 bucket measurements → list_tables []。"""
    mock_query_api.return_value.query.return_value = []
    connector = InfluxdbConnector()
    assert connector.list_tables(MagicMock(), "metrics") == []


@patch("app.datasources.dialects.influxdb._query_api")
def test_influx_field_tag_type_enum_r41(mock_query_api):
    """T-CONN-R41-011-04: mock fieldKeys/tagKeys → number+string 各 ≥1。"""
    field_tbl = MagicMock()
    field_tbl.records = [MagicMock(get_value=lambda: "temperature")]
    tag_tbl = MagicMock()
    tag_tbl.records = [MagicMock(get_value=lambda: "host")]
    mock_query_api.return_value.query.side_effect = [[field_tbl], [tag_tbl]]
    connector = InfluxdbConnector()
    cols = connector.list_columns(MagicMock(), "metrics", "cpu")
    kinds = {c.data_type for c in cols}
    assert "number" in kinds
    assert "string" in kinds


@patch("app.datasources.dialects.influxdb._build_client")
def test_influx_http_auth_failed_r41(mock_build, client):
    """T-CONN-R41-011-05: HTTP POST test mock 401 → 200 ok=false INFLUX_AUTH_FAILED traceId。"""
    mock_build.side_effect = Exception("401 Unauthorized")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "influxdb",
            "name": "influx-test",
            "code": f"influx-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "badtoken",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "INFLUX_AUTH_FAILED"
    assert body.get("traceId")


def test_influx_metadata_tables_missing_schema_400_r41(client):
    """T-CONN-R41-011-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("influxdb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 3: 运行 InfluxDB 段测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py -k "influx" -v`
Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/influxdb.py tests/test_connectors_gov_r41.py
git commit -m "feat(r41): CONN-011 InfluxDB companion boundary + HTTP chain"
```

---

### Task 4: TDengine companion 边界 + HTTP 502 链

**Files:**
- Modify: `backend/app/datasources/dialects/tdengine.py`
- Modify: `tests/test_connectors_gov_r41.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1 `map_tdengine_error`；`TDENGINE_MAX_COLUMNS=500`
- Produces: 7 条 T-CONN-R41-012-*

- [ ] **Step 1: tdengine.py list_columns limit 注释巩固**

在 `list_columns` 切片行上方追加：

```python
            # r41: DESCRIBE 结果超 TDENGINE_MAX_COLUMNS 时切片（与 Oracle/ClickHouse 对称）
```

- [ ] **Step 2: 追加 TDengine 测试 T-CONN-R41-012-01 ~ 012-07**

```python
from app.datasources.dialects.tdengine import TDENGINE_MAX_COLUMNS, TdengineConnector


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_timeout_r41(mock_connect):
    """T-CONN-R41-012-01: mock timeout → TDENGINE_TIMEOUT。"""
    mock_connect.side_effect = Exception("Connection timed out")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_TIMEOUT"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_unknown_database_r41(mock_connect):
    """T-CONN-R41-012-02: mock database not exist → TDENGINE_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = Exception("database not exist")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="missing", username="root", password="taosdata"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_UNKNOWN_DATABASE"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_empty_database_tables_r41(mock_connect):
    """T-CONN-R41-012-03: mock 空库 list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [[], []]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert connector.list_tables(connection, "power") == []


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_describe_type_enum_r41(mock_connect):
    """T-CONN-R41-012-04: mock DESCRIBE 类型枚举 ≥3 种 data_type。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ("ts", "TIMESTAMP"),
        ("val", "INT"),
        ("name", "NCHAR"),
    ]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    types = {c.data_type for c in connector.list_columns(connection, "power", "meters")}
    assert types == {"TIMESTAMP", "INT", "NCHAR"}


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_columns_limit_r41(mock_connect):
    """T-CONN-R41-012-05: mock 600 列 → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [(f"col_{i}", "INT") for i in range(600)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    cols = connector.list_columns(connection, "power", "wide")
    assert len(cols) == TDENGINE_MAX_COLUMNS == 500


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_http_auth_failed_r41(mock_connect, client):
    """T-CONN-R41-012-06: HTTP POST test mock auth fail → 200 ok=false TDENGINE_AUTH_FAILED traceId。"""
    mock_connect.side_effect = Exception("Authentication failure")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "tdengine",
            "name": "td-test",
            "code": f"td-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TDENGINE_AUTH_FAILED"
    assert body.get("traceId")


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.tdengine.TdengineConnector.list_schemas")
def test_tdengine_metadata_schemas_502_r41(mock_list, mock_pool, client):
    """T-CONN-R41-012-07: HTTP GET schemas list_schemas 失败 → 502 METADATA_CONNECTION_FAILED。"""
    mock_list.side_effect = Exception("connection failed")

    @contextmanager
    def _cm(*_a, **_k):
        yield MagicMock()

    mock_pool.side_effect = _cm
    ds = _create_typed_ds("tdengine")
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"
    assert "password" not in resp.text.lower()
```

- [ ] **Step 3: 运行 TDengine 段测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py -k "tdengine" -v`
Expected: 7 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/tdengine.py tests/test_connectors_gov_r41.py
git commit -m "feat(r41): CONN-012 TDengine companion boundary + HTTP 502 chain"
```

---

### Task 5: SQLite 只读/路径守卫对称 + HTTP 链

**Files:**
- Modify: `backend/app/datasources/dialects/sqlite.py`
- Modify: `tests/test_connectors_gov_r41.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1 `map_sqlite_error`（`SQLITE_READONLY` 已有映射）；`_validate_db_path`
- Produces: `open_connection` 路径穿越 `ValueError(SQLITE_PATH_TRAVERSAL)` 对称守卫；6 条 T-CONN-R41-006-*

- [ ] **Step 1: sqlite.py open_connection 文档化只读对称**

在 `open_connection` 方法 docstring 或紧上方追加：

```python
    # r41: open_connection 与 test_connection 共用 _validate_db_path；只读 OperationalError → SQLITE_READONLY
```

确认 `open_connection` 已在非法路径时 `raise ValueError(err_code)`（r40 已有，无需改逻辑）。

- [ ] **Step 2: 追加 SQLite 测试 T-CONN-R41-006-01 ~ 006-06**

```python
from app.datasources.dialects.sqlite import SqliteConnector


@patch("app.datasources.dialects.sqlite.sqlite3.connect")
def test_sqlite_readonly_r41(mock_connect):
    """T-CONN-R41-006-01: mock readonly OperationalError → SQLITE_READONLY。"""
    mock_connect.side_effect = sqlite3.OperationalError("attempt to write a readonly database")
    result = SqliteConnector().test_connection(
        host="/tmp/sample.db", port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_READONLY"


def test_sqlite_open_connection_path_traversal_r41():
    """T-CONN-R41-006-02: open_connection 路径穿越 → ValueError SQLITE_PATH_TRAVERSAL。"""
    connector = SqliteConnector()
    with pytest.raises(ValueError) as exc_info:
        connector.open_connection(host="../../etc/passwd", port=1, database="main", username="sqlite", password="x")
    assert "SQLITE_PATH_TRAVERSAL" in str(exc_info.value)


def test_sqlite_pragma_type_enum_r41(tmp_path):
    """T-CONN-R41-006-03: mock PRAGMA 类型枚举 integer/text/real。"""
    db_path = tmp_path / "types.db"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE t (id INTEGER, name TEXT, score REAL)")
    conn.commit()
    conn.close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    types = {c.name: c.data_type for c in connector.list_columns(connection, "main", "t")}
    assert types["id"] == "INTEGER"
    assert types["name"] == "TEXT"
    assert types["score"] == "REAL"


def test_sqlite_empty_database_tables_r41(tmp_path):
    """T-CONN-R41-006-04: 空库 list_tables → []。"""
    db_path = tmp_path / "empty.db"
    sqlite3.connect(db_path).close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    assert connector.list_tables(connection, "main") == []


def test_sqlite_http_file_not_found_r41(client):
    """T-CONN-R41-006-05: HTTP POST test 缺失文件 → 200 ok=false SQLITE_FILE_NOT_FOUND traceId。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "sqlite",
            "name": "sqlite-test",
            "code": f"sqlite-{uuid.uuid4().hex[:8]}",
            "host": "/tmp/vitalspan_missing_r41.db",
            "port": 1,
            "database": "main",
            "username": "sqlite",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "SQLITE_FILE_NOT_FOUND"
    assert body.get("traceId")


def test_sqlite_metadata_tables_missing_schema_400_r41(client, tmp_path):
    """T-CONN-R41-006-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    db_path = tmp_path / "app.db"
    sqlite3.connect(db_path).close()
    ds = _create_typed_ds("sqlite", host=str(db_path))
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 3: 运行 SQLite 段测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py -k "sqlite" -v`
Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/sqlite.py tests/test_connectors_gov_r41.py
git commit -m "feat(r41): CONN-006 SQLite readonly/path guard symmetry + HTTP chain"
```

---

### Task 6: TimescaleDB hypertable 边界 + columns limit + HTTP 链

**Files:**
- Modify: `backend/app/datasources/dialects/timescaledb.py`
- Modify: `tests/test_connectors_gov_r41.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1 `map_timescale_error`；`PostgresConnector` 委托；`TIMESCALE_MAX_COLUMNS=500`
- Produces: 7 条 T-CONN-R41-013-*

- [ ] **Step 1: timescaledb.py list_columns 切片注释**

在 `list_columns` 方法内切片行上方追加：

```python
        # r41: 委托 PG list_columns 后按 TIMESCALE_MAX_COLUMNS 切片
```

- [ ] **Step 2: 追加 TimescaleDB 测试 T-CONN-R41-013-01 ~ 013-07**

```python
from app.datasources.dialects.base import ColumnInfo, TableInfo
from app.datasources.dialects.timescaledb import TIMESCALE_MAX_COLUMNS, TimescaledbConnector


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescale_timeout_r41(mock_open):
    """T-CONN-R41-013-01: mock timeout → TIMESCALE_TIMEOUT。"""
    import psycopg

    exc = psycopg.OperationalError("timeout expired")
    exc.pgcode = None
    mock_open.side_effect = exc
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_TIMEOUT"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescale_conn_refused_r41(mock_open):
    """T-CONN-R41-013-02: mock connection refused → TIMESCALE_CONN_REFUSED。"""
    mock_open.side_effect = ConnectionRefusedError("Connection refused")
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_CONN_REFUSED"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_tables")
@patch("app.datasources.dialects.timescaledb.TimescaledbConnector._hypertable_names")
def test_timescale_empty_schema_tables_r41(mock_hypertables, mock_list_tables):
    """T-CONN-R41-013-03: mock 空 schema list_tables → []。"""
    mock_list_tables.return_value = []
    mock_hypertables.return_value = set()
    connector = TimescaledbConnector()
    assert connector.list_tables(MagicMock(), "public") == []


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_columns")
def test_timescale_columns_limit_r41(mock_list_columns):
    """T-CONN-R41-013-04: mock 600 列 → list_columns 返回 500。"""
    mock_list_columns.return_value = [
        ColumnInfo(name=f"col_{i}", data_type="varchar", nullable=True) for i in range(600)
    ]
    connector = TimescaledbConnector()
    cols = connector.list_columns(MagicMock(), "public", "wide")
    assert len(cols) == TIMESCALE_MAX_COLUMNS == 500


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_columns")
def test_timescale_pg_type_enum_r41(mock_list_columns):
    """T-CONN-R41-013-05: mock PG 类型枚举 ≥3 种。"""
    mock_list_columns.return_value = [
        ColumnInfo(name="name", data_type="varchar", nullable=True),
        ColumnInfo(name="value", data_type="int4", nullable=True),
        ColumnInfo(name="ts", data_type="timestamptz", nullable=False),
    ]
    connector = TimescaledbConnector()
    types = {c.data_type for c in connector.list_columns(MagicMock(), "public", "events")}
    assert types == {"varchar", "int4", "timestamptz"}


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescale_http_auth_failed_r41(mock_open, client):
    """T-CONN-R41-013-06: HTTP POST test mock 28P01 → 200 ok=false TIMESCALE_AUTH_FAILED traceId。"""
    import psycopg

    exc = psycopg.OperationalError("password authentication failed")
    exc.pgcode = "28P01"
    mock_open.side_effect = exc
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "timescaledb",
            "name": "ts-test",
            "code": f"ts-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5432,
            "database": "metrics",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TIMESCALE_AUTH_FAILED"
    assert body.get("traceId")


def test_timescale_metadata_tables_missing_schema_400_r41(client):
    """T-CONN-R41-013-07: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("timescaledb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 3: 运行 TimescaleDB 段测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py -k "timescale" -v`
Expected: 7 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/timescaledb.py tests/test_connectors_gov_r41.py
git commit -m "feat(r41): CONN-013 TimescaleDB companion boundary + HTTP chain"
```

---

### Task 7: 注册表回归 + 全量回归门控

**Files:**
- Modify: `tests/test_connectors_gov_r41.py`
- Verify: `backend/app/datasources/dialects/__init__.py`（无变更则跳过）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1–6 全部实现
- Produces: T-REG-R41-01/02；r40+r39+r37+r36 回归全绿

- [ ] **Step 1: 追加注册表回归 T-REG-R41-01 ~ R41-02**

```python
from app.datasources.registry import export_type_catalog

_R41_TYPES = ("mongodb", "influxdb", "tdengine", "sqlite", "timescaledb")


def test_r41_export_type_catalog_count():
    """T-REG-R41-01: export_type_catalog() 仍返回 18 种 type。"""
    catalog = export_type_catalog()
    assert len(catalog) == 18
    for t in _R41_TYPES:
        assert t in {item["type"] for item in catalog}


def test_r41_five_types_capabilities_complete():
    """T-REG-R41-02: 五 type connectivity_test + schema_browser capabilities 完整。"""
    types = {item["type"]: item for item in export_type_catalog()}
    for t in _R41_TYPES:
        assert "connectivity_test" in types[t]["capabilities"]
        assert "schema_browser" in types[t]["capabilities"]
        assert types[t]["displayName"]
```

- [ ] **Step 2: 运行 r41 全套件**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r41.py -v --tb=short`
Expected: 35 passed（scaffold + 33 断言函数 + 2 REG）

- [ ] **Step 3: 全量回归 r40 + r39 + r37 + r36**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r41.py tests/test_connectors_gov_r40.py tests/test_query_meta_conn_r39.py tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py -v`
Expected: ruff clean；≥1002 passed + 4 skipped；r40 43/43 + r39 33/33 + r37 40/40 + r36 37/37

- [ ] **Step 4: Commit**

```bash
git add tests/test_connectors_gov_r41.py
git commit -m "test(r41): T-REG-R41 registry + full connector regression gate"
```

---

### Task 8: 文档同步 — datasources.md §r41

**Files:**
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 域文档更新；无 UI 变更

**Interfaces:**
- Consumes: Task 1–7 全部实现与测试结果
- Produces: `datasources.md` §r41 companion 质量推分登记

- [ ] **Step 1: 在 datasources.md 追加 §r41 companion 质量推分**

在 `### r40 connector kickoff（2026-07-04）` 段之后追加：

```markdown
### r41 companion 质量推分（2026-07-04）

五方言 companion 边界闭合（CONN-006/011/012/013/014）：

| 方言 | 错误域闭合 | 列 limit | 边界闭合 |
|------|-----------|---------|---------|
| MongoDB | `map_mongodb_error` 补 `MONGODB_UNKNOWN_DATABASE`（code 26 / ns not found） | `MONGODB_MAX_FIELDS=500` | 空库/空 collection → `[]`；BSON 六类型枚举 |
| InfluxDB | `INFLUX_TIMEOUT`/`INFLUX_UNKNOWN_BUCKET` test_connection 全路径 | `INFLUX_MAX_MEASUREMENTS=500` | 空 bucket measurements → `[]`；fieldKeys/tagKeys 类型枚举 |
| TDengine | `TDENGINE_TIMEOUT`/`TDENGINE_UNKNOWN_DATABASE` test_connection 全路径 | `TDENGINE_MAX_COLUMNS=500` | 空库 SHOW 零行 → `[]`；DESCRIBE 类型枚举 |
| SQLite | `SQLITE_READONLY` + `open_connection` 路径穿越对称 | `SQLITE_MAX_COLUMNS=500` | 只读/非法路径/空库边界 |
| TimescaleDB | `TIMESCALE_TIMEOUT`/`TIMESCALE_CONN_REFUSED` test_connection 全路径 | `TIMESCALE_MAX_COLUMNS=500` | 空 schema → `[]`；hypertable 标记保留 r40 |

- 测试套件：`tests/test_connectors_gov_r41.py`（35 条 T-CONN-R41-* / T-REG-R41-*）
- HTTP 契约：test_connection 失败 200 + `ok=false` + `{PREFIX}_*` + `traceId`；metadata tables 缺 schema 400 `METADATA_INVALID_REQUEST`；schemas 连接失败 502 `METADATA_CONNECTION_FAILED`
- 回归：r40 43/43 + r39 33/33 + r37 40/40 + r36 37/37 不删旧套件
- PRD 对账：`F04-CONN.md` CONN-006/011/012/013/014 验收 P5 重评（非 P3）
```

更新域附录表格中五方言状态备注：`已实现 L1 r40 + companion r41`。

- [ ] **Step 2: 最终验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r41.py tests/test_connectors_gov_r40.py tests/test_query_meta_conn_r39.py tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py -q`
Expected: ruff clean；≥1002 passed + 4 skipped

- [ ] **Step 3: Commit**

```bash
git add docs/services/datasources.md
git commit -m "docs(r41): datasources.md companion quality push CONN-006/011/012/013/014"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| design 五子项均有 Task | Task 2–6 对应 CONN-014/011/012/006/013 |
| `MONGODB_UNKNOWN_DATABASE` 映射 | Task 1 Step 3 |
| ≥28 新测 | 35 条（7+6+7+6+7+2） |
| HTTP 链每方言 ≥1 test + metadata | 五方言 POST test + tables 400；TDengine schemas 502 |
| 无 TBD/TODO 占位 | 已扫描 |
| 文件数 ≤16 | P3 修改 9 文件（含新建 test） |
| 全 Task UI skill: none | 已标注 |
| r40/r39/r37/r36 回归 | Task 7 Step 3 |

## 执行说明

**执行模式固定为 subagent-driven-development (option 1)** — P3 由 `evolution-implementer` 按 Task 1→8 顺序派发子 agent，每 Task 完成后 code review gate，不询问用户选择 inline execution。
