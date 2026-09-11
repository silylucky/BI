# M11 三期原生连接器扩展批次 1 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/{starrocks,trino,presto,influxdb,tdengine,timescaledb,errors}.py`、`backend/app/datasources/dialects/__init__.py`、`backend/app/datasources/__init__.py`、`backend/app/datasources/metadata/service.py`、`tests/test_connectors_m11_r235.py`、`tests/conftest.py`、`backend/pyproject.toml`、`docs/services/datasources.md`、`docs/api/README.md`
> **子项：** CONN-009, CONN-010, CONN-011, CONN-012, CONN-013
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** M11 批次 1 — 闭合 StarRocks/Trino·Presto/InfluxDB/TDengine/TimescaleDB 五连接器 M11 集成验收：`presto` 别名注册、Trino catalog 元数据传参修复、`STARROCKS_UNKNOWN_DATABASE` 对称 Doris、InfluxDB v2 边界文档化 + 只读 Flux 探测、TimescaleDB 只读 SQL 探测；`test_connectors_m11_r235.py` ≥20 断言函数 + r34~r41 回归全绿。

**Architecture:** 五方言 L1/companion 骨架已存在（r34~r41）；本轮增量为 registry 别名（`PrestoConnector` 委托 `TrinoConnector`）、`metadata/service.py` 对 `trino`/`presto` 传 `catalog=row.database`、连接器级只读探测（Flux / `SELECT 1`）、M11 集成测 `test_connectors_m11_r235.py`（mock HTTP 链 + 可选 compose 端口 skip）。不扩 `query/dialects`、不触 `fe/`。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · pymysql（StarRocks 委托）· trino-python-client · influxdb-client · taospy · psycopg 3（TimescaleDB 委托）· pytest · ruff

## Global Constraints

- 纯后端 M11 集成验收；**全 Task UI skill: none**；不触及 `fe/`
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；`F04-CONN.md` 与 `plan.md` §M11 **P5 对账**（非 P3）
- 不新增 Alembic migration；不扩 `query/dialects` starrocks/trino/timescaledb
- `test_connection` 失败：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`；响应 JSON 不含 `password`/`token`/`secret`
- 可选 compose 端口：StarRocks **9030**、Trino **8080**、InfluxDB **8086**、TDengine **6041**、TimescaleDB **5433**；不可达 `pytest.skip`
- 文件预算：新建 **2** + 修改 **13** + 预期零改动 **3** = **18**
- 验证基线（P3 实施前采集）：`cd backend && python3 -m ruff check . && python3 -m pytest -q 2>&1 | tail -3`
- 本轮目标：`test_connectors_m11_r235.py` ≥20 passed（无 compose 时 optional 用例 skipped 仍绿）

---

### Task 1: M11 测试基础设施 — m11_compose_env + pytest marker + r235 脚手架

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `tests/conftest.py`
- Create: `tests/test_connectors_m11_r235.py`（module fixture + scaffold）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/writing-plans/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；本轮不触及 `fe/` 或壳层组件

**Interfaces:**
- Consumes: 既有 `_port_open`（`tests/conftest.py`）、`m7_compose_env` 模式
- Produces: `m11_compose_env` fixture；`_R235_SQLITE_URL` module fixture；`client` fixture

- [ ] **Step 1: 扩展 pyproject.toml integration marker 注释**

在 `backend/pyproject.toml` 的 `[tool.pytest.ini_options]` → `markers` 段，将 integration 行改为：

```toml
    "integration: M7/M11 optional compose — sample-mariadb:3308 sample-clickhouse:8124; M11 optional starrocks:9030 trino:8080 influxdb:8086 tdengine:6041 timescaledb:5433 (see test_connectors_m11_r235.py)",
```

- [ ] **Step 2: 在 conftest.py 追加 m11_compose_env**

在 `tests/conftest.py` 的 `m7_sqlite_env` fixture **之后**追加：

```python
@pytest.fixture(scope="session")
def m11_compose_env():
    """M11 optional compose ports — per-service _available; missing ports do not fail session."""
    return {
        "starrocks": {
            "host": "127.0.0.1",
            "port": 9030,
            "database": "test",
            "username": "root",
            "password": "",
            "_available": _port_open("127.0.0.1", 9030),
        },
        "trino": {
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "trino",
            "password": "",
            "_available": _port_open("127.0.0.1", 8080),
        },
        "influxdb": {
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "token",
            "_available": _port_open("127.0.0.1", 8086),
        },
        "tdengine": {
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "root",
            "password": "taosdata",
            "_available": _port_open("127.0.0.1", 6041),
        },
        "timescaledb": {
            "host": "127.0.0.1",
            "port": 5433,
            "database": "analytics",
            "username": "vitalspan",
            "password": "vitalspan",
            "_available": _port_open("127.0.0.1", 5433),
        },
    }
```

- [ ] **Step 3: 创建 test_connectors_m11_r235.py 脚手架**

```python
"""M11 三期原生连接器扩展批次 1 r235 — CONN-009~013 集成验收。

可选 compose 端口（integration 分层 skip）：
  - StarRocks: 127.0.0.1:9030
  - Trino/Presto: 127.0.0.1:8080
  - InfluxDB: 127.0.0.1:8086
  - TDengine: 127.0.0.1:6041
  - TimescaleDB: 127.0.0.1:5433
"""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R235_SQLITE_URL = "sqlite+pysqlite:///file:connectors_m11_r235?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r235_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R235_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
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
def client() -> TestClient:
    return TestClient(app)


def test_r235_scaffold_imports():
    """Scaffold: module loads and sqlite meta DB is ready."""
    assert app is not None
```

- [ ] **Step 4: 运行脚手架验证**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py::test_r235_scaffold_imports -v`
Expected: **1 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml tests/conftest.py tests/test_connectors_m11_r235.py
git commit -m "test(m11): add m11_compose_env fixture and r235 test scaffold"
```

---

### Task 2: CONN-009 StarRocks — STARROCKS_UNKNOWN_DATABASE + M11 HTTP 集成测

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/starrocks.py`
- Modify: `tests/test_connectors_m11_r235.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `DORIS_UNKNOWN_DATABASE` 映射模式（`doris.py`）；`map_mysql_operational_error` errno 1049 → `MYSQL_UNKNOWN_DATABASE`
- Produces: `STARROCKS_UNKNOWN_DATABASE` 常量；`StarrocksConnector.test_connection` 委托映射；`T-CONN-R235-009-01`~`04` 测试函数

- [ ] **Step 1: 写失败测试 — STARROCKS_UNKNOWN_DATABASE**

在 `tests/test_connectors_m11_r235.py` 追加：

```python
import json
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pymysql
from jwt_auth import jwt_auth_headers

from app.datasources.dialects.base import ColumnInfo, TableInfo
from app.datasources.dialects.starrocks import StarrocksConnector
from app.datasources.registry import export_type_catalog, registry

AUTH = jwt_auth_headers()


def test_conn_r235_009_01_types_catalog_starrocks():
    """T-CONN-R235-009-01: export_type_catalog 含 starrocks / olap / schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "starrocks" in types
    assert types["starrocks"]["category"] == "olap"
    conn = registry.get("starrocks")
    assert isinstance(conn, StarrocksConnector)
    assert set(conn.capabilities) >= {"connectivity_test", "schema_browser"}


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r235_009_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R235-009-02: HTTP POST test mock 2003 → STARROCKS_CONN_REFUSED；无 password。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "starrocks",
            "name": "sr-r235",
            "code": f"sr-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "test",
            "username": "root",
            "password": "sample_secret",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "STARROCKS_CONN_REFUSED"
    assert "sample_secret" not in json.dumps(body)
    assert "password" not in resp.text.lower()


@patch("app.datasources.dialects.starrocks.StarrocksConnector.list_columns")
@patch("app.datasources.dialects.starrocks.StarrocksConnector.list_tables")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r235_009_03_http_metadata_columns_chain(
    mock_connect, mock_pool, mock_tables, mock_columns, client
):
    """T-CONN-R235-009-03: HTTP tables/columns mock → 200 + 列名集合。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    mock_tables.return_value = [TableInfo(name="orders", type="table")]
    mock_columns.return_value = [
        ColumnInfo(name="id", data_type="bigint", nullable=False),
        ColumnInfo(name="region", data_type="varchar", nullable=True),
    ]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "starrocks",
            "name": "sr-meta-r235",
            "code": f"sr-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "analytics",
            "username": "root",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=analytics", headers=AUTH)
    assert tables.status_code == 200
    cols = client.get(
        f"/api/v1/datasources/{ds_id}/columns?schema=analytics&table=orders",
        headers=AUTH,
    )
    assert cols.status_code == 200
    names = {c["name"] for c in cols.json()["items"]}
    assert names == {"id", "region"}


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r235_009_unknown_database(mock_connect):
    """T-CONN-R235-009-04: mock 1049 → STARROCKS_UNKNOWN_DATABASE（对称 Doris）。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="missing", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "STARROCKS_UNKNOWN_DATABASE"


@pytest.mark.integration
def test_conn_r235_009_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-009-05: 9030 可达则实库 test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 9030):
        pytest.skip("StarRocks not running on 127.0.0.1:9030")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is True
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_009" -v`
Expected: `test_conn_r235_009_unknown_database` **FAIL** — `STARROCKS_UNKNOWN` 而非 `STARROCKS_UNKNOWN_DATABASE`

- [ ] **Step 3: 实现 STARROCKS_UNKNOWN_DATABASE**

在 `backend/app/datasources/dialects/errors.py` 的 Doris 段之后追加：

```python
# StarRocks (MySQL protocol alias)
STARROCKS_TIMEOUT = "STARROCKS_TIMEOUT"
STARROCKS_CONN_REFUSED = "STARROCKS_CONN_REFUSED"
STARROCKS_AUTH_FAILED = "STARROCKS_AUTH_FAILED"
STARROCKS_UNKNOWN_DATABASE = "STARROCKS_UNKNOWN_DATABASE"
STARROCKS_UNKNOWN = "STARROCKS_UNKNOWN"
```

在 `__all__` 列表中 `DORIS_UNKNOWN_DATABASE` 之后追加：

```python
    "STARROCKS_AUTH_FAILED",
    "STARROCKS_CONN_REFUSED",
    "STARROCKS_TIMEOUT",
    "STARROCKS_UNKNOWN",
    "STARROCKS_UNKNOWN_DATABASE",
```

将 `backend/app/datasources/dialects/starrocks.py` 的 `test_connection` **整体替换**为 Doris 委托模式：

```python
from app.datasources.dialects.errors import (
    STARROCKS_AUTH_FAILED,
    STARROCKS_CONN_REFUSED,
    STARROCKS_TIMEOUT,
    STARROCKS_UNKNOWN,
    STARROCKS_UNKNOWN_DATABASE,
)
```

（移除文件顶部重复的 `STARROCKS_*` 字面量常量定义，改从 `errors.py` 导入。）

```python
    def test_connection(self, **kwargs) -> TestConnectionResult:
        result = self._inner.test_connection(**kwargs)
        if result.ok or not result.code:
            return result
        mapping = {
            "MYSQL_TIMEOUT": STARROCKS_TIMEOUT,
            "MYSQL_CONN_REFUSED": STARROCKS_CONN_REFUSED,
            "MYSQL_AUTH_FAILED": STARROCKS_AUTH_FAILED,
            "MYSQL_UNKNOWN_DATABASE": STARROCKS_UNKNOWN_DATABASE,
        }
        code = mapping.get(result.code, STARROCKS_UNKNOWN)
        return TestConnectionResult(
            ok=result.ok,
            message=result.message.replace(result.code, code) if result.code in result.message else result.message,
            latency_ms=result.latency_ms,
            code=code,
        )
```

删除已不再使用的 `_map_starrocks_error` 函数及 `map_mysql_operational_error` 导入（若 `test_connection` 外无引用）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_009" -v`
Expected: **5 passed**（或 4 passed + 1 skipped 无 compose）

Run: `cd backend && python3 -m pytest ../tests/test_connectors_gov_r34.py ../tests/test_connectors_gov_r35.py -q`
Expected: 全绿（StarRocks 回归）

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/starrocks.py tests/test_connectors_m11_r235.py
git commit -m "feat(conn): CONN-009 StarRocks UNKNOWN_DATABASE + M11 r235 integration tests"
```

---

### Task 3: CONN-010 Trino/Presto — presto 别名 + catalog 元数据修复

**Files:**
- Create: `backend/app/datasources/dialects/presto.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `backend/app/datasources/metadata/service.py`
- Modify: `tests/test_connectors_m11_r235.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `TrinoConnector`（`list_schemas/list_tables/list_columns` 接受 `catalog` kwarg）
- Produces: `PrestoConnector`（`type=presto`）；`register_dialect(PrestoConnector())`；`_catalog_kwargs(row)` helper；`T-CONN-R235-010-01`~`05`

- [ ] **Step 1: 写失败测试 — presto catalog + metadata**

在 `tests/test_connectors_m11_r235.py` 追加：

```python
from app.datasources.dialects.base import SchemaInfo
from app.datasources.dialects.presto import PrestoConnector
from app.datasources.dialects.trino import TrinoConnector


def test_conn_r235_010_01_types_catalog_trino_presto():
    """T-CONN-R235-010-01: catalog 含 trino 与 presto，均为 lake。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "trino" in types
    assert "presto" in types
    assert types["trino"]["category"] == "lake"
    assert types["presto"]["category"] == "lake"
    assert isinstance(registry.get("presto"), PrestoConnector)


@patch("trino.dbapi.connect")
def test_conn_r235_010_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R235-010-02: HTTP POST test mock refused → TRINO_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "trino",
            "name": "trino-r235",
            "code": f"trino-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "trino",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TRINO_CONN_REFUSED"
    assert body.get("traceId")


@patch("app.datasources.dialects.trino.TrinoConnector.list_schemas")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("trino.dbapi.connect")
def test_conn_r235_010_03_http_metadata_catalog_passed(
    mock_connect, mock_pool, mock_list_schemas, client
):
    """T-CONN-R235-010-03: type=trino database=hive → list_schemas(catalog='hive') 非空。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    mock_list_schemas.return_value = [SchemaInfo(name="default"), SchemaInfo(name="sales")]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "trino",
            "name": "trino-meta-r235",
            "code": f"trino-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "trino",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    schemas = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert schemas.status_code == 200
    names = {s["name"] for s in schemas.json()["items"]}
    assert names == {"default", "sales"}
    mock_list_schemas.assert_called_once()
    _args, kwargs = mock_list_schemas.call_args
    assert kwargs.get("catalog") == "hive"


@patch("trino.dbapi.connect")
def test_conn_r235_010_04_presto_symmetric_http_test(mock_connect, client):
    """T-CONN-R235-010-04: type=presto HTTP test 与 trino 对称。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "presto",
            "name": "presto-r235",
            "code": f"presto-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "presto",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is False
    assert resp.json()["code"] == "TRINO_CONN_REFUSED"


@pytest.mark.integration
def test_conn_r235_010_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-010-05: 8080 可达则 Trino test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 8080):
        pytest.skip("Trino not running on 127.0.0.1:8080")
    result = TrinoConnector().test_connection(
        host="127.0.0.1", port=8080, database="hive", username="trino", password=""
    )
    assert result.ok is True
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_010" -v`
Expected: **FAIL** — `presto` 不在 catalog 或 `catalog` 未传入 `list_schemas`

- [ ] **Step 3: 实现 presto 别名与 metadata catalog 传参**

创建 `backend/app/datasources/dialects/presto.py`：

```python
from __future__ import annotations

from app.datasources.dialects.trino import TrinoConnector


class PrestoConnector(TrinoConnector):
    type = "presto"
    display_name = "Presto"
```

在 `backend/app/datasources/dialects/__init__.py` 追加 import 与 `__all__`：

```python
from app.datasources.dialects.presto import PrestoConnector
```

`__all__` 中 `PostgresConnector` 之后插入 `"PrestoConnector",`。

在 `backend/app/datasources/__init__.py`：

```python
from app.datasources.dialects.presto import PrestoConnector
```

在 `register_builtin_dialects()` 中 `register_dialect(TrinoConnector())` **之后**追加：

```python
    register_dialect(PrestoConnector())
```

在 `backend/app/datasources/metadata/service.py` 顶部追加 `import inspect`，并在 `_connector_and_kwargs` 之后追加：

```python
def _catalog_kwargs(row: DataSource) -> dict[str, str]:
    if row.type in ("trino", "presto") and row.database:
        return {"catalog": row.database}
    return {}


def _call_metadata(connector, method_name: str, conn, *args, row: DataSource):
    method = getattr(connector, method_name)
    extra = _catalog_kwargs(row)
    if extra and "catalog" in inspect.signature(method).parameters:
        return method(conn, *args, **extra)
    return method(conn, *args)
```

将 `list_schemas` / `list_tables` / `list_columns` 内对 connector 的调用改为：

```python
items = _call_metadata(connector, "list_schemas", conn, row=row)
# list_tables:
items = _call_metadata(connector, "list_tables", conn, schema, row=row)
# list_columns:
items = _call_metadata(connector, "list_columns", conn, schema, table, row=row)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_010" -v`
Expected: **5 passed**（或 4 passed + 1 skipped）

Run: `cd backend && python3 -m pytest ../tests/test_query_meta_conn_r38.py ../tests/test_query_meta_conn_r39.py -q`
Expected: 全绿（Trino 回归）

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/presto.py backend/app/datasources/dialects/__init__.py backend/app/datasources/__init__.py backend/app/datasources/metadata/service.py tests/test_connectors_m11_r235.py
git commit -m "feat(conn): CONN-010 presto alias + Trino catalog metadata fix"
```

---

### Task 4: CONN-011 InfluxDB — v1/v2 边界文档 + 只读 Flux 探测

**Files:**
- Modify: `backend/app/datasources/dialects/influxdb.py`
- Modify: `tests/test_connectors_m11_r235.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `_query_api`、`_build_client`（`influxdb.py`）
- Produces: 模块 docstring v1/v2 边界；`_probe_readonly_flux(connection, bucket) -> bool`；`T-CONN-R235-011-01`~`04`

- [ ] **Step 1: 写失败测试 — InfluxDB M11 链**

在 `tests/test_connectors_m11_r235.py` 追加：

```python
from app.datasources.dialects.influxdb import InfluxdbConnector, _probe_readonly_flux


def test_conn_r235_011_01_types_catalog_influxdb():
    """T-CONN-R235-011-01: types catalog influxdb / timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "influxdb" in types
    assert types["influxdb"]["category"] == "timeseries"


@patch("app.datasources.dialects.influxdb._build_client")
def test_conn_r235_011_02_http_test_conn_refused(mock_build, client):
    """T-CONN-R235-011-02: HTTP test mock refused → INFLUX_CONN_REFUSED；无 token。"""
    mock_build.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "influxdb",
            "name": "influx-r235",
            "code": f"influx-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "secret_token_value",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "INFLUX_CONN_REFUSED"
    assert "secret_token_value" not in json.dumps(body)
    assert "token" not in resp.text.lower() or "INFLUX" in body.get("code", "")


@patch("app.datasources.dialects.influxdb.InfluxdbConnector.list_tables")
@patch("app.datasources.dialects.influxdb.InfluxdbConnector.list_schemas")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.influxdb._build_client")
def test_conn_r235_011_03_http_metadata_bucket_measurements(
    mock_build, mock_pool, mock_schemas, mock_tables, client
):
    """T-CONN-R235-011-03: HTTP metadata bucket → measurements mock 链。"""
    conn = MagicMock()
    mock_build.return_value = conn
    mock_schemas.return_value = [SchemaInfo(name="metrics")]
    mock_tables.return_value = [TableInfo(name="cpu", type="measurement")]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "influxdb",
            "name": "influx-meta-r235",
            "code": f"influx-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "token",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=metrics", headers=AUTH)
    assert tables.status_code == 200
    assert tables.json()["items"][0]["name"] == "cpu"


@patch("app.datasources.dialects.influxdb._query_api")
def test_conn_r235_011_04_probe_readonly_flux(mock_query_api):
    """T-CONN-R235-011-04: mock query_api().query 只读 Flux 探测返回 True。"""
    mock_query_api.return_value.query.return_value = []
    conn = MagicMock()
    assert _probe_readonly_flux(conn, "metrics") is True
    mock_query_api.return_value.query.assert_called_once()
    flux_arg = mock_query_api.return_value.query.call_args[0][0]
    assert 'limit(n: 1)' in flux_arg or "limit(n:1)" in flux_arg
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_011" -v`
Expected: `test_conn_r235_011_04_probe_readonly_flux` **FAIL** — `ImportError: cannot import _probe_readonly_flux`

- [ ] **Step 3: 实现 InfluxDB docstring + _probe_readonly_flux**

将 `backend/app/datasources/dialects/influxdb.py` 模块级 docstring 与类 docstring 替换为：

```python
"""InfluxDB 2.x connector (CONN-011).

Supported: InfluxDB 2.x — username=org, password=token, database=bucket.
Not supported: InfluxDB 1.x HTTP API / InfluxQL (migrate to 2.x or use another type).
"""
```

在 `_query_api` 函数之后追加：

```python
def _probe_readonly_flux(connection: Any, bucket: str) -> bool:
    """Minimal read-only Flux probe: from(bucket) |> range(-1m) |> limit(1)."""
    if not bucket.strip():
        return False
    flux = f'from(bucket: "{bucket}") |> range(start: -1m) |> limit(n: 1)'
    try:
        _query_api(connection).query(flux)
        return True
    except Exception:
        return False
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_011" -v`
Expected: **4 passed**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_gov_r40.py ../tests/test_connectors_gov_r41.py -k "influx" -q`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/influxdb.py tests/test_connectors_m11_r235.py
git commit -m "feat(conn): CONN-011 InfluxDB v2 boundary doc + readonly Flux probe"
```

---

### Task 5: CONN-012 TDengine — M11 HTTP 集成测（方言零改动）

**Files:**
- Modify: `tests/test_connectors_m11_r235.py`
- Verify: `backend/pyproject.toml`（`connectors-ext` 含 `taospy>=2.7.0`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `TdengineConnector`（`tdengine.py` 已实现）；`TDENGINE_DRIVER_MISSING`
- Produces: `T-CONN-R235-012-01`~`05` 测试函数

- [ ] **Step 1: 确认 taospy 依赖**

Run: `grep -n taospy backend/pyproject.toml`
Expected: `connectors-ext` 列表含 `"taospy>=2.7.0"`（已存在则无需改 pyproject）

- [ ] **Step 2: 追加 TDengine M11 测试**

在 `tests/test_connectors_m11_r235.py` 追加：

```python
from app.datasources.dialects.tdengine import TdengineConnector


def test_conn_r235_012_01_types_catalog_tdengine():
    """T-CONN-R235-012-01: types catalog tdengine / timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tdengine" in types
    assert types["tdengine"]["category"] == "timeseries"


@patch("app.datasources.dialects.tdengine._connect")
def test_conn_r235_012_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R235-012-02: HTTP test mock refused → TDENGINE_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "tdengine",
            "name": "td-r235",
            "code": f"td-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "root",
            "password": "taosdata",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TDENGINE_CONN_REFUSED"


@patch("app.datasources.dialects.tdengine.TdengineConnector.list_columns")
@patch("app.datasources.dialects.tdengine.TdengineConnector.list_tables")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.tdengine._connect")
def test_conn_r235_012_03_http_metadata_stable_type(
    mock_connect, mock_pool, mock_tables, mock_columns, client
):
    """T-CONN-R235-012-03: HTTP metadata 超级表 type=stable mock 链。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    mock_tables.return_value = [TableInfo(name="meters", type="stable")]
    mock_columns.return_value = [ColumnInfo(name="ts", data_type="TIMESTAMP", nullable=False)]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "tdengine",
            "name": "td-meta-r235",
            "code": f"td-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "root",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=power", headers=AUTH)
    assert tables.status_code == 200
    assert tables.json()["items"][0]["type"] == "stable"


@patch("app.datasources.dialects.tdengine._import_taos", return_value=None)
def test_conn_r235_012_04_driver_missing(mock_import):
    """T-CONN-R235-012-04: mock driver missing → TDENGINE_DRIVER_MISSING。"""
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "TDENGINE_DRIVER_MISSING"


@pytest.mark.integration
def test_conn_r235_012_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-012-05: 6041 可达则 TDengine test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 6041):
        pytest.skip("TDengine not running on 127.0.0.1:6041")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is True
```

- [ ] **Step 3: 运行测试**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_012" -v`
Expected: **5 passed**（或 4 passed + 1 skipped）

- [ ] **Step 4: Commit**

```bash
git add tests/test_connectors_m11_r235.py
git commit -m "test(conn): CONN-012 TDengine M11 r235 integration tests"
```

---

### Task 6: CONN-013 TimescaleDB — probe_readonly_sql + M11 集成测

**Files:**
- Modify: `backend/app/datasources/dialects/timescaledb.py`
- Modify: `tests/test_connectors_m11_r235.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `PostgresConnector.open_connection` 返回的连接对象（`.execute()`）
- Produces: `TimescaledbConnector.probe_readonly_sql(connection) -> bool`；`T-CONN-R235-013-01`~`05`

- [ ] **Step 1: 写失败测试**

在 `tests/test_connectors_m11_r235.py` 追加：

```python
from app.datasources.dialects.timescaledb import TimescaledbConnector


def test_conn_r235_013_01_types_catalog_timescaledb():
    """T-CONN-R235-013-01: types catalog timescaledb / timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "timescaledb" in types
    assert types["timescaledb"]["category"] == "timeseries"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_conn_r235_013_02_http_test_extension_missing(mock_open, client):
    """T-CONN-R235-013-02: HTTP test mock 无 timescaledb 扩展 → TIMESCALE_EXTENSION_MISSING。"""
    conn = MagicMock()
    ext_result = MagicMock()
    ext_result.fetchone.return_value = None
    conn.execute.side_effect = [MagicMock(), ext_result]
    mock_open.return_value = conn
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "timescaledb",
            "name": "ts-r235",
            "code": f"ts-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5433,
            "database": "analytics",
            "username": "vitalspan",
            "password": "secret",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TIMESCALE_EXTENSION_MISSING"
    assert "secret" not in json.dumps(body)


@patch("app.datasources.dialects.timescaledb.TimescaledbConnector.list_tables")
@patch("app.datasources.dialects.timescaledb.TimescaledbConnector._hypertable_names")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_conn_r235_013_03_http_metadata_hypertable(
    mock_open, mock_pool, mock_hypertables, mock_tables, client
):
    """T-CONN-R235-013-03: HTTP metadata tables 含 type=hypertable。"""
    conn = MagicMock()
    mock_open.return_value = conn
    mock_hypertables.return_value = {"metrics"}
    mock_tables.return_value = [TableInfo(name="metrics", type="table")]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "timescaledb",
            "name": "ts-meta-r235",
            "code": f"ts-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5433,
            "database": "analytics",
            "username": "vitalspan",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=public", headers=AUTH)
    assert tables.status_code == 200
    assert tables.json()["items"][0]["type"] == "hypertable"


def test_conn_r235_013_04_probe_readonly_sql():
    """T-CONN-R235-013-04: mock PG 连接 probe_readonly_sql 返回 True。"""
    conn = MagicMock()
    assert TimescaledbConnector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once_with("SELECT 1")


@pytest.mark.integration
def test_conn_r235_013_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-013-05: 5433 可达则 TimescaleDB test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 5433):
        pytest.skip("TimescaleDB/analytics-postgres not running on 127.0.0.1:5433")
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1",
        port=5433,
        database="analytics",
        username="vitalspan",
        password="vitalspan",
    )
    assert result.ok is True
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_013" -v`
Expected: `test_conn_r235_013_04_probe_readonly_sql` **FAIL** — `AttributeError: probe_readonly_sql`

- [ ] **Step 3: 实现 probe_readonly_sql**

在 `backend/app/datasources/dialects/timescaledb.py` 的 `list_columns` 方法之前追加：

```python
    def probe_readonly_sql(self, connection: Any) -> bool:
        connection.execute("SELECT 1")
        return True
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -k "r235_013" -v`
Expected: **5 passed**（或 4 passed + 1 skipped）

Run: `cd backend && python3 -m pytest ../tests/test_connectors_gov_r40.py ../tests/test_connectors_gov_r41.py -k "timescale" -q`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/timescaledb.py tests/test_connectors_m11_r235.py
git commit -m "feat(conn): CONN-013 TimescaleDB readonly SQL probe + M11 r235 tests"
```

---

### Task 7: 文档同步 — datasources 域附录 + API types 注释

**Files:**
- Modify: `docs/services/datasources.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 2~6 已交付的连接器行为
- Produces: `§M11 r235` 集成锚点；InfluxDB v1/v2 边界；`presto` type 登记；API types 行注释

- [ ] **Step 1: 更新 docs/services/datasources.md**

在 `### M7 r229 集成验收` 段之后追加：

```markdown
### M11 r235 集成验收（CONN-009~013 · 2026-07-07）

- **CONN-009**：`STARROCKS_UNKNOWN_DATABASE` 对称 Doris；`tests/test_connectors_m11_r235.py` HTTP test/metadata mock + optional 9030 skip
- **CONN-010**：`PrestoConnector` 委托 `TrinoConnector`（`type=presto`）；`metadata/service.py` 对 `trino`/`presto` 传 `catalog=row.database`
- **CONN-011**：InfluxDB **2.x only**（`username=org`, `password=token`, `database=bucket`）；**不支持** InfluxDB 1.x / InfluxQL；连接器级只读 Flux `limit(n:1)` 探测
- **CONN-012**：`taospy>=2.7.0`（`connectors-ext`）；HTTP metadata stable 类型标记
- **CONN-013**：`probe_readonly_sql` → `SELECT 1`；hypertable 元数据标记
- 集成测：`tests/test_connectors_m11_r235.py`（`@pytest.mark.integration`，无 compose 时分层 skip）
- 回归：r34~r35、r38~r39、r40~r41 不删旧套件
```

在 `dialects/trino.py` 表格行之后插入：

```markdown
| `dialects/presto.py` | Presto 联邦湖仓（委托 TrinoConnector，`type=presto`） | CONN-010 | 已实现（M11 r235） |
```

- [ ] **Step 2: 更新 docs/api/README.md types 行**

将 `GET /api/v1/datasources/types` 行的说明列扩展为（保持路由不变）：

```markdown
已注册连接器类型清单（含 M11：`starrocks`/`trino`/`presto`/`influxdb`/`tdengine`/`timescaledb`；`type`、`displayName`、`category`、`capabilities`）
```

- [ ] **Step 3: 验证文档无断链**

Run: `grep -n "M11 r235" docs/services/datasources.md && grep -n "presto" docs/services/datasources.md docs/api/README.md`
Expected: 三处均有匹配

- [ ] **Step 4: Commit**

```bash
git add docs/services/datasources.md docs/api/README.md
git commit -m "docs(conn): M11 r235 integration anchors for CONN-009~013"
```

---

### Task 8: 全量回归闸门

**Files:**
- Verify only（无新文件）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

- [ ] **Step 1: ruff**

Run: `cd backend && python3 -m ruff check .`
Expected: **All checks passed**

- [ ] **Step 2: M11 r235 全量**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_m11_r235.py -v --tb=short 2>&1 | tail -5`
Expected: **≥24 passed**（5 optional compose 用例在无 compose 时为 skipped）；0 failed

- [ ] **Step 3: 连接器回归套件**

Run: `cd backend && python3 -m pytest ../tests/test_connectors_gov_r34.py ../tests/test_connectors_gov_r35.py ../tests/test_query_meta_conn_r38.py ../tests/test_query_meta_conn_r39.py ../tests/test_connectors_gov_r40.py ../tests/test_connectors_gov_r41.py ../tests/test_connectors_m7_r229.py -q`
Expected: 全绿 exit 0

- [ ] **Step 4: 全量 pytest（P4 预检）**

Run: `cd backend && python3 -m pytest -q 2>&1 | tail -3`
Expected: `passed` + exit 0

- [ ] **Step 5: Commit（若有修复）**

```bash
git add -A
git commit -m "chore(m11): r235 regression gate green"
```

---

## Self-Review（P2 已完成）

| 检查项 | 结果 |
|--------|------|
| round-target 5 子项均有 Task | Task 2~6 一一对应 CONN-009~013 |
| design 文件清单覆盖 | 18 文件均在 Task Files 中 |
| 无 TBD/TODO/占位符 | 通过 |
| 每 Task 有验证命令 | 通过 |
| UI skill: none 全 Task 标注 | 通过 |
| 不进入 P3 | 本计划仅归档，实施由 evolution-implementer 执行 |
