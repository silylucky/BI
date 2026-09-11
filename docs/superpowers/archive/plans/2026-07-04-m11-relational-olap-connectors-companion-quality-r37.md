# M11 关系型/OLAP 连接器 companion 质量推分 r37 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/errors.py`、`oracle.py`、`doris.py`、`sqlserver.py`、`hive.py`、`clickhouse.py`、`dialects/__init__.py`、`tests/test_connectors_gov_r37.py`、`docs/services/datasources.md`
> **子项：** CONN-004, CONN-008, CONN-005, CONN-003, CONN-007
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** M11 companion 质量推分 — 闭合 r36 五方言 Hive/ClickHouse/SQL Server/Doris/Oracle 的 test_connection/schema/types 边界、结构化错误域上浮、列元数据 limit=500 与 registry HTTP 链；`test_connectors_gov_r37.py` ≥28 条 + r36 37/37 + r35 35/35 + r34 15/15 回归全绿；五 ID 加权总分破 90。

**Architecture:** 镜像 r35 companion 模式 — `errors.py` 集中导出 `HIVE_*`/`CLICKHOUSE_*`/`DORIS_*` 常量与 `map_*`；五 connector 补 `*_MAX_COLUMNS=500` 切片、timeout/unknown_database/ssl 全路径；`test_connectors_gov_r37.py` 独立 SQLite fixture + 每方言 ≥1 HTTP test 失败链 + ≥1 metadata 400/502 链；不修改 `ConnectorRegistry` 核心类。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pyhive · clickhouse-connect · pymssql · oracledb · pymysql（Doris 委托）· pytest · ruff

## Global Constraints

- 纯后端 companion 质量推分；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 Alembic migration；不触及 `fe/`
- `docs/automate/prd/F04-CONN.md` **P5 对账**（非 P3）
- 错误码前缀：`HIVE_*`、`CLICKHOUSE_*`、`SQLSERVER_*`、`DORIS_*`、`ORACLE_*`
- `test_connection` 失败：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`（与 r34/r36 契约一致）
- 列元数据 limit：**500**（与 `STARROCKS_MAX_COLUMNS`/`CLICKHOUSE_MAX_COLUMNS` 对称）
- 文件预算：新建 **1** + 修改 **8** = **9**（P3）；设计框定 16 含 P5 `F04-CONN.md`
- 验证基线：r36 后 **814 passed** + 4 skipped；本轮目标 **≥842 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py -v`

---

### Task 1: 错误域集中导出 + r37 测试脚手架

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Create: `tests/test_connectors_gov_r37.py`（module fixture + `test_r37_scaffold`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；本轮不触及 `fe/` 或壳层组件

**Interfaces:**
- Consumes: r36 `errors.py` 已有 `map_oracle_error` / `map_sqlserver_operational_error`；`hive.py`/`clickhouse.py`/`doris.py` 模块内 `_map_*`
- Produces: `map_hive_error`、`map_clickhouse_error`、`map_doris_operational_error`；`HIVE_*`/`CLICKHOUSE_*`/`DORIS_*` 常量；`map_oracle_error` 增 `ora-12505`；`_R37_SQLITE_URL` fixture

- [ ] **Step 1: 扩展 errors.py — 上浮 Hive/ClickHouse/Doris + Oracle ora-12505**

在 `backend/app/datasources/dialects/errors.py` 文件末尾追加（保留现有 MySQL/PG/TiDB/SQL Server/Oracle 段）：

```python
# Hive
HIVE_CONN_REFUSED = "HIVE_CONN_REFUSED"
HIVE_AUTH_FAILED = "HIVE_AUTH_FAILED"
HIVE_TIMEOUT = "HIVE_TIMEOUT"
HIVE_UNKNOWN_DATABASE = "HIVE_UNKNOWN_DATABASE"
HIVE_UNKNOWN = "HIVE_UNKNOWN"


def map_hive_error(exc: Exception) -> tuple[str, str]:
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


# ClickHouse
CLICKHOUSE_CONN_REFUSED = "CLICKHOUSE_CONN_REFUSED"
CLICKHOUSE_AUTH_FAILED = "CLICKHOUSE_AUTH_FAILED"
CLICKHOUSE_TIMEOUT = "CLICKHOUSE_TIMEOUT"
CLICKHOUSE_UNKNOWN_DATABASE = "CLICKHOUSE_UNKNOWN_DATABASE"
CLICKHOUSE_UNKNOWN = "CLICKHOUSE_UNKNOWN"


def map_clickhouse_error(exc: Exception) -> tuple[str, str]:
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


# Doris (MySQL protocol alias)
DORIS_TIMEOUT = "DORIS_TIMEOUT"
DORIS_CONN_REFUSED = "DORIS_CONN_REFUSED"
DORIS_AUTH_FAILED = "DORIS_AUTH_FAILED"
DORIS_UNKNOWN_DATABASE = "DORIS_UNKNOWN_DATABASE"
DORIS_UNKNOWN = "DORIS_UNKNOWN"


def map_doris_operational_error(exc: pymysql.err.OperationalError) -> tuple[str, str]:
    code, detail = map_mysql_operational_error(exc)
    mapping = {
        "MYSQL_TIMEOUT": DORIS_TIMEOUT,
        "MYSQL_CONN_REFUSED": DORIS_CONN_REFUSED,
        "MYSQL_AUTH_FAILED": DORIS_AUTH_FAILED,
        "MYSQL_UNKNOWN_DATABASE": DORIS_UNKNOWN_DATABASE,
    }
    return mapping.get(code, DORIS_UNKNOWN), detail
```

修改 `map_oracle_error` 中 service 判断行：

```python
    if "ora-12514" in lowered or "ora-12505" in lowered or "unknown service" in lowered:
        return ORACLE_UNKNOWN_SERVICE, detail
```

- [ ] **Step 2: 方言模块改 import — hive.py / clickhouse.py / doris.py**

`hive.py` — 删除模块内 `HIVE_*` 常量与 `_map_hive_error`，改为：

```python
from app.datasources.dialects.errors import map_hive_error
```

`test_connection` 异常处理中 `code, detail = map_hive_error(exc)`。

`clickhouse.py` — 删除 `_map_clickhouse_error` 与除 `CLICKHOUSE_MAX_COLUMNS` 外的错误常量，改为：

```python
from app.datasources.dialects.errors import map_clickhouse_error
```

`doris.py` — 删除模块内 `DORIS_*` 与 `_map_doris_error`，改为：

```python
from app.datasources.dialects.errors import map_doris_operational_error
```

`test_connection` 中 `code, detail = map_doris_operational_error(exc)`。

- [ ] **Step 3: 更新 dialects/__init__.py 导出（可选 re-export）**

在 `__init__.py` 追加（供外部测试直接 import 常量）：

```python
from app.datasources.dialects.errors import (
    CLICKHOUSE_MAX_COLUMNS as CLICKHOUSE_MAX_COLUMNS_CONST,
    DORIS_UNKNOWN_DATABASE,
    HIVE_UNKNOWN_DATABASE,
    ORACLE_MAX_COLUMNS,
)
```

若 `ORACLE_MAX_COLUMNS` 尚未定义（Task 2 添加），本步仅导出 errors 已有常量；完整导出在 Task 2 后补齐。

- [ ] **Step 4: 创建 test_connectors_gov_r37.py 脚手架**

```python
"""M11 关系型/OLAP 连接器 companion 质量推分 r37 — CONN-004/008/005/003/007."""
from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.models import get_meta_session
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app

_R37_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r37?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r37_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R37_SQLITE_URL
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


def _create_typed_ds(ds_type: str, name_suffix: str | None = None):
    suffix = name_suffix or uuid.uuid4().hex[:8]
    session = get_meta_session()
    try:
        defaults = {
            "mysql": dict(port=3306),
            "doris": dict(port=9030),
            "hive": dict(port=10000, database="default"),
            "clickhouse": dict(port=8123, database="default"),
            "sqlserver": dict(port=1433, database="master"),
            "oracle": dict(port=1521, database="ORCL"),
        }
        extra = defaults.get(ds_type, {})
        return create_data_source(
            session,
            DataSourceCreate(
                name=f"{ds_type}-{suffix}",
                code=f"{ds_type}-{suffix}",
                type=ds_type,
                host="127.0.0.1",
                port=extra.get("port", 5432),
                database=extra.get("database", "test"),
                username="user",
                password="secret",
            ),
        )
    finally:
        session.close()


def test_r37_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None
```

- [ ] **Step 5: 运行脚手架测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py::test_r37_scaffold -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/dialects/errors.py \
  backend/app/datasources/dialects/hive.py \
  backend/app/datasources/dialects/clickhouse.py \
  backend/app/datasources/dialects/doris.py \
  backend/app/datasources/dialects/__init__.py \
  tests/test_connectors_gov_r37.py
git commit -m "feat(r37): centralize HIVE/CLICKHOUSE/DORIS errors + test scaffold"
```

---

### Task 2: CONN-004 — Oracle companion 边界 + 7 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/oracle.py`
- Modify: `tests/test_connectors_gov_r37.py`（追加 CONN-004 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_oracle_error`（含 `ora-12505`）、`_SYSTEM_OWNERS`
- Produces: `ORACLE_MAX_COLUMNS = 500`；`list_columns` 超 500 切片

- [ ] **Step 1: 写失败测试（CONN-004 段 7 条）**

```python
import oracledb

from app.datasources.dialects.base import ColumnInfo
from app.datasources.dialects.oracle import ORACLE_MAX_COLUMNS, OracleConnector
from app.datasources.registry import export_type_catalog


@patch("oracledb.connect")
def test_oracle_unknown_service_r37(mock_connect):
    """T-CONN-R37-004-01: mock ORA-12505 → ORACLE_UNKNOWN_SERVICE。"""
    mock_connect.side_effect = Exception("ORA-12505: TNS:listener does not currently know of SID")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    assert result.ok is False
    assert result.code == "ORACLE_UNKNOWN_SERVICE"


@patch("oracledb.connect")
def test_oracle_timeout_r37(mock_connect):
    """T-CONN-R37-004-02: mock timeout → ORACLE_TIMEOUT。"""
    mock_connect.side_effect = Exception("ORA-12170: TNS:Connect timeout occurred")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    assert result.ok is False
    assert result.code == "ORACLE_TIMEOUT"


@patch("oracledb.connect")
def test_oracle_multi_owner_schemas_r37(mock_connect):
    """T-CONN-R37-004-03: mock 多 owner list_schemas 含 HR 不含 SYS。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("HR",), ("APP",), ("SYS",), ("SYSTEM",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    names = {s.name for s in connector.list_schemas(connection)}
    assert "HR" in names
    assert "APP" in names
    assert "SYS" not in names
    assert "SYSTEM" not in names


@patch("oracledb.connect")
def test_oracle_unknown_owner_tables_r37(mock_connect):
    """T-CONN-R37-004-04: mock 未知 owner list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    assert connector.list_tables(connection, "UNKNOWN_OWNER") == []


@patch("oracledb.connect")
def test_oracle_columns_limit_r37(mock_connect):
    """T-CONN-R37-004-05: mock 600 列 → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    rows = [(f"COL_{i}", "VARCHAR2", "Y") for i in range(600)]
    cursor.fetchall.return_value = rows
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    cols = connector.list_columns(connection, "HR", "EMPLOYEES")
    assert len(cols) == ORACLE_MAX_COLUMNS == 500
    assert cols[0].name == "COL_0"
    assert cols[-1].name == "COL_499"


def test_oracle_types_catalog_r37():
    """T-CONN-R37-004-06: types catalog oracle category=relational schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["oracle"]["category"] == "relational"
    assert "schema_browser" in types["oracle"]["capabilities"]
    assert types["oracle"]["displayName"]


@patch("oracledb.connect")
def test_oracle_http_auth_failed_r37(mock_connect, client):
    """T-CONN-R37-004-07: HTTP POST test mock ORA-01017 → 200 ok=false ORACLE_AUTH_FAILED traceId。"""
    mock_connect.side_effect = Exception("ORA-01017: invalid username/password")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "oracle",
            "name": "ora-test",
            "code": f"ora-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 1521,
            "database": "ORCL",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "ORACLE_AUTH_FAILED"
    assert body.get("traceId")
```

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -k "oracle" -v`
Expected: FAIL（`ORACLE_MAX_COLUMNS` 未定义或 limit 未实现）

- [ ] **Step 2: 实现 oracle.py 增量**

在 `oracle.py` 模块顶追加：

```python
ORACLE_MAX_COLUMNS = 500
```

修改 `list_columns` 返回前切片：

```python
        columns = [
            ColumnInfo(name=row[0], data_type=row[1], nullable=str(row[2]) == "Y")
            for row in cursor.fetchall()
            if row
        ]
        if len(columns) > ORACLE_MAX_COLUMNS:
            return columns[:ORACLE_MAX_COLUMNS]
        return columns
```

- [ ] **Step 3: 运行 Oracle 测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -k "oracle" -v`
Expected: 7 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/oracle.py tests/test_connectors_gov_r37.py
git commit -m "feat(r37): CONN-004 Oracle companion boundaries + 7 tests"
```

---

### Task 3: CONN-008 — Doris companion 边界 + 6 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/doris.py`
- Modify: `tests/test_connectors_gov_r37.py`（追加 CONN-008 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_doris_operational_error`（含 `DORIS_UNKNOWN_DATABASE`）
- Produces: `DORIS_MAX_COLUMNS = 500`；`list_columns` 切片

- [ ] **Step 1: 写失败测试（CONN-008 段 6 条）**

```python
import pymysql.err

from app.datasources.dialects.base import ColumnInfo
from app.datasources.dialects.doris import DORIS_MAX_COLUMNS, DorisConnector


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_unknown_database_r37(mock_connect):
    """T-CONN-R37-008-01: mock 1049 → DORIS_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="missing", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "DORIS_UNKNOWN_DATABASE"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_timeout_r37(mock_connect):
    """T-CONN-R37-008-02: mock 2013 → DORIS_TIMEOUT。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2013, "Lost connection: timeout")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "DORIS_TIMEOUT"


def test_doris_columns_limit_r37():
    """T-CONN-R37-008-03: mock 600 列 → list_columns 返回 500。"""
    connector = DorisConnector()
    connector._inner.list_columns = MagicMock(
        return_value=[
            ColumnInfo(name=f"col_{i}", data_type="varchar", nullable=True) for i in range(600)
        ]
    )
    cols = connector.list_columns(MagicMock(), "db", "wide_tbl")
    assert len(cols) == DORIS_MAX_COLUMNS == 500


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_empty_schemas_r37(mock_connect):
    """T-CONN-R37-008-04: mock 仅系统库 list_schemas → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("information_schema",), ("mysql",)]
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = DorisConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert connector.list_schemas(connection) == []


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_http_conn_refused_r37(mock_connect, client):
    """T-CONN-R37-008-05: HTTP POST test mock 2003 → 200 ok=false DORIS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "doris",
            "name": "doris-test",
            "code": f"doris-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "test",
            "username": "root",
            "password": "",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "DORIS_CONN_REFUSED"
    assert body.get("traceId")


def test_doris_metadata_tables_missing_schema_400_r37(client):
    """T-CONN-R37-008-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("doris")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 2: 实现 doris.py 增量**

```python
DORIS_MAX_COLUMNS = 500
```

修改 `list_columns`：

```python
    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        columns = self._inner.list_columns(connection, schema, table)
        if len(columns) > DORIS_MAX_COLUMNS:
            return columns[:DORIS_MAX_COLUMNS]
        return columns
```

- [ ] **Step 3: 运行 Doris 测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -k "doris" -v`
Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/doris.py tests/test_connectors_gov_r37.py
git commit -m "feat(r37): CONN-008 Doris companion boundaries + 6 tests"
```

---

### Task 4: CONN-005 — SQL Server companion 边界 + 8 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/sqlserver.py`
- Modify: `tests/test_connectors_gov_r37.py`（追加 CONN-005 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_sqlserver_operational_error`（errno 20002/20003 → `SQLSERVER_TIMEOUT`；ssl message → `SQLSERVER_SSL_ERROR`）
- Produces: `SQLSERVER_MAX_COLUMNS = 500`；`list_columns` 切片

- [ ] **Step 1: 写失败测试（CONN-005 段 8 条）**

```python
import pymssql

from app.datasources.dialects.base import ColumnInfo
from app.datasources.dialects.sqlserver import SQLSERVER_MAX_COLUMNS, SqlserverConnector


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_timeout_r37(mock_connect):
    """T-CONN-R37-005-01: mock 20002 → SQLSERVER_TIMEOUT。"""
    mock_connect.side_effect = pymssql.OperationalError(20002, b"timeout expired")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_TIMEOUT"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_ssl_error_r37(mock_connect):
    """T-CONN-R37-005-02: mock ssl error message → SQLSERVER_SSL_ERROR。"""
    mock_connect.side_effect = pymssql.OperationalError(0, b"SSL Provider: certificate verify failed")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_SSL_ERROR"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_dbo_and_custom_schemas_r37(mock_connect):
    """T-CONN-R37-005-03: mock list_schemas 含 dbo 与 sales。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("dbo",), ("sales",), ("guest",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    names = {s.name for s in connector.list_schemas(connection)}
    assert "dbo" in names
    assert "sales" in names


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_empty_schemas_r37(mock_connect):
    """T-CONN-R37-005-04: mock 空库 list_schemas → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert connector.list_schemas(connection) == []


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_unknown_schema_tables_r37(mock_connect):
    """T-CONN-R37-005-05: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert connector.list_tables(connection, "missing_schema") == []


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_columns_limit_r37(mock_connect):
    """T-CONN-R37-005-06: mock 600 列 → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    rows = [(f"col_{i}", "varchar", "YES") for i in range(600)]
    cursor.fetchall.return_value = rows
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    cols = connector.list_columns(connection, "dbo", "wide_tbl")
    assert len(cols) == SQLSERVER_MAX_COLUMNS == 500


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_ssl_disabled_encrypt_false_r37(mock_connect):
    """T-CONN-R37-005-07: ssl_mode=disabled → encrypt=False。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    SqlserverConnector().test_connection(
        host="127.0.0.1",
        port=1433,
        database="master",
        username="sa",
        password="pwd",
        ssl_mode="disabled",
    )
    _, kwargs = mock_connect.call_args
    assert kwargs.get("encrypt") is False


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_http_auth_failed_r37(mock_connect, client):
    """T-CONN-R37-005-08: HTTP POST test mock 18456 → 200 ok=false SQLSERVER_AUTH_FAILED。"""
    mock_connect.side_effect = pymssql.OperationalError(18456, b"Login failed for user")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "sqlserver",
            "name": "mssql-test",
            "code": f"mssql-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 1433,
            "database": "master",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "SQLSERVER_AUTH_FAILED"
    assert body.get("traceId")
```

- [ ] **Step 2: 实现 sqlserver.py 增量**

```python
SQLSERVER_MAX_COLUMNS = 500
```

修改 `list_columns` 返回前切片（镜像 oracle）：

```python
        columns = [
            ColumnInfo(name=row[0], data_type=row[1], nullable=str(row[2]).upper() == "YES")
            for row in cursor.fetchall()
            if row
        ]
        if len(columns) > SQLSERVER_MAX_COLUMNS:
            return columns[:SQLSERVER_MAX_COLUMNS]
        return columns
```

- [ ] **Step 3: 运行 SQL Server 测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -k "sqlserver" -v`
Expected: 8 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/sqlserver.py tests/test_connectors_gov_r37.py
git commit -m "feat(r37): CONN-005 SQL Server companion boundaries + 8 tests"
```

---

### Task 5: CONN-003 — Hive companion 边界 + 7 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/hive.py`
- Modify: `tests/test_connectors_gov_r37.py`（追加 CONN-003 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_hive_error`（`HIVE_UNKNOWN_DATABASE`）
- Produces: `HIVE_MAX_COLUMNS = 500`；`list_columns` DESCRIBE 结果切片

- [ ] **Step 1: 写失败测试（CONN-003 段 7 条）**

```python
from app.datasources.dialects.hive import HIVE_MAX_COLUMNS, HiveConnector
from app.datasources.registry import export_type_catalog


@patch("pyhive.hive.connect")
def test_hive_unknown_database_r37(mock_connect):
    """T-CONN-R37-003-01: mock unknown database → HIVE_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = Exception("Database X does not exist")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="X", username="hive", password=""
    )
    assert result.ok is False
    assert result.code == "HIVE_UNKNOWN_DATABASE"


@patch("pyhive.hive.connect")
def test_hive_empty_schemas_r37(mock_connect):
    """T-CONN-R37-003-02: mock 仅 information_schema → list_schemas []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("information_schema",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert connector.list_schemas(connection) == []


@patch("pyhive.hive.connect")
def test_hive_column_types_smoke_r37(mock_connect):
    """T-CONN-R37-003-03: mock DESCRIBE 类型枚举 ≥3 种 data_type。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ("id", "bigint", ""),
        ("name", "string", ""),
        ("amount", "double", ""),
    ]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    cols = connector.list_columns(connection, "default", "orders")
    dtypes = {c.data_type for c in cols}
    assert len(dtypes) >= 3


@patch("pyhive.hive.connect")
def test_hive_columns_limit_r37(mock_connect):
    """T-CONN-R37-003-04: mock 600 列 DESCRIBE → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [(f"col_{i}", "string", "") for i in range(600)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    cols = connector.list_columns(connection, "default", "wide_tbl")
    assert len(cols) == HIVE_MAX_COLUMNS == 500


def test_hive_types_catalog_r37():
    """T-CONN-R37-003-05: types catalog hive category=lake。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["hive"]["category"] == "lake"
    assert types["hive"]["displayName"]


@patch("pyhive.hive.connect")
def test_hive_http_auth_failed_r37(mock_connect, client):
    """T-CONN-R37-003-06: HTTP POST test mock auth fail → 200 ok=false HIVE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Authentication failed: invalid credentials")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "hive",
            "name": "hive-test",
            "code": f"hive-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 10000,
            "database": "default",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "HIVE_AUTH_FAILED"
    assert body.get("traceId")


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.hive.HiveConnector.list_schemas")
def test_hive_metadata_schemas_502_r37(mock_list, mock_pool, client):
    """T-CONN-R37-003-07: HTTP GET schemas list_schemas 失败 → 502 METADATA_CONNECTION_FAILED。"""
    mock_list.side_effect = Exception("connection failed")

    @contextmanager
    def _cm(*a, **k):
        yield MagicMock()

    mock_pool.side_effect = _cm
    ds = _create_typed_ds("hive")
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"
    assert "password" not in resp.text.lower()
```

- [ ] **Step 2: 实现 hive.py 增量**

```python
HIVE_MAX_COLUMNS = 500
```

修改 `list_columns` 末尾：

```python
        if len(columns) > HIVE_MAX_COLUMNS:
            return columns[:HIVE_MAX_COLUMNS]
        return columns
```

- [ ] **Step 3: 运行 Hive 测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -k "hive" -v`
Expected: 7 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/hive.py tests/test_connectors_gov_r37.py
git commit -m "feat(r37): CONN-003 Hive companion boundaries + 7 tests"
```

---

### Task 6: CONN-007 — ClickHouse companion 边界 + 7 条测试

**Files:**
- Modify: `backend/app/datasources/dialects/clickhouse.py`
- Modify: `tests/test_connectors_gov_r37.py`（追加 CONN-007 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器；无 UI 变更

**Interfaces:**
- Consumes: `map_clickhouse_error`；`CLICKHOUSE_MAX_COLUMNS`（已有）
- Produces: 非法 table `list_columns` 零行 → `[]`；perf smoke <0.1s

- [ ] **Step 1: 写失败测试（CONN-007 段 7 条）**

```python
import time

from app.datasources.dialects.clickhouse import CLICKHOUSE_MAX_COLUMNS, ClickhouseConnector
from app.datasources.registry import export_type_catalog
from app.query.dialects import get_sql_dialect


@patch("clickhouse_connect.get_client")
def test_clickhouse_timeout_r37(mock_get_client):
    """T-CONN-R37-007-01: mock timeout → CLICKHOUSE_TIMEOUT。"""
    mock_get_client.side_effect = Exception("Connection timed out")
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert result.ok is False
    assert result.code == "CLICKHOUSE_TIMEOUT"


@patch("clickhouse_connect.get_client")
def test_clickhouse_unknown_table_columns_r37(mock_get_client):
    """T-CONN-R37-007-02: mock 未知 table list_columns → []。"""
    client = MagicMock()
    client.query.return_value.result_rows = []
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert connector.list_columns(connection, "default", "missing_table") == []


@patch("clickhouse_connect.get_client")
def test_clickhouse_columns_limit_perf_r37(mock_get_client):
    """T-CONN-R37-007-03: mock 600 列 limit + perf <0.1s。"""
    rows = [(f"col_{i}", "String") for i in range(600)]
    client = MagicMock()
    client.query.return_value.result_rows = rows
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    started = time.perf_counter()
    cols = connector.list_columns(connection, "default", "wide_tbl")
    elapsed = time.perf_counter() - started
    assert len(cols) == CLICKHOUSE_MAX_COLUMNS == 500
    assert elapsed < 0.1


def test_clickhouse_types_catalog_r37():
    """T-CONN-R37-007-04: types catalog clickhouse category=olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["clickhouse"]["category"] == "olap"
    assert types["clickhouse"]["displayName"]


@patch("clickhouse_connect.get_client")
def test_clickhouse_http_conn_refused_r37(mock_get_client, client):
    """T-CONN-R37-007-05: HTTP POST test mock refused → 200 ok=false CLICKHOUSE_CONN_REFUSED。"""
    mock_get_client.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "clickhouse",
            "name": "ch-test",
            "code": f"ch-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8123,
            "database": "default",
            "username": "default",
            "password": "",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "CLICKHOUSE_CONN_REFUSED"
    assert body.get("traceId")


def test_clickhouse_metadata_tables_missing_schema_400_r37(client):
    """T-CONN-R37-007-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("clickhouse")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


def test_clickhouse_sql_dialect_regression_r37():
    """T-CONN-R37-007-07: get_sql_dialect('clickhouse') connector_type 回归。"""
    dialect = get_sql_dialect("clickhouse")
    assert dialect.connector_type == "clickhouse"
```

- [ ] **Step 2: 确认 clickhouse.py 无需额外实现**

`CLICKHOUSE_MAX_COLUMNS=500` 与零行 `list_columns` → `[]` 已在 r36 实现；本 Task 以测试驱动验证，若 perf 或边界失败再补守卫注释。

- [ ] **Step 3: 运行 ClickHouse 测试**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -k "clickhouse" -v`
Expected: 7 passed

- [ ] **Step 4: Commit**

```bash
git add tests/test_connectors_gov_r37.py
git commit -m "feat(r37): CONN-007 ClickHouse companion boundaries + 7 tests"
```

---

### Task 7: T-REG-R37 — Registry + HTTP 链 + 全量回归

**Files:**
- Modify: `tests/test_connectors_gov_r37.py`（追加 T-REG-R37 段）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；无 UI 变更

**Interfaces:**
- Consumes: 五 connector 全量测试；`export_type_catalog()`；`MysqlConnector`
- Produces: T-REG-R37-01~04 断言；r36+r35+r34 回归绿灯

- [ ] **Step 1: 追加 Registry 测试 4 条**

```python
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.registry import export_type_catalog, register_dialect


def test_registry_five_types_display_fields_r37():
    """T-REG-R37-01: export_type_catalog 五新 type 均含 displayName/category/capabilities。"""
    types = {item["type"]: item for item in export_type_catalog()}
    for t in ("hive", "clickhouse", "sqlserver", "doris", "oracle"):
        assert t in types
        entry = types[t]
        assert entry.get("displayName")
        assert entry.get("category")
        assert entry.get("capabilities")


def test_registry_create_five_types_visible_r37(client):
    """T-REG-R37-02: 创建五 type 各一 DataSource → GET /types 均可见。"""
    created_types = []
    for ds_type, patch_target in [
        ("hive", "pyhive.hive.connect"),
        ("clickhouse", "clickhouse_connect.get_client"),
        ("sqlserver", "app.datasources.dialects.sqlserver.pymssql.connect"),
        ("doris", "app.datasources.dialects.mysql.pymysql.connect"),
        ("oracle", "oracledb.connect"),
    ]:
        with patch(patch_target) as mock_conn:
            if ds_type == "clickhouse":
                m = MagicMock()
                m.command.return_value = 1
                mock_conn.return_value = m
            elif ds_type == "hive":
                m = MagicMock()
                m.cursor.return_value = MagicMock()
                mock_conn.return_value = m
            else:
                mock_conn.return_value = MagicMock()
            suffix = uuid.uuid4().hex[:8]
            resp = client.post(
                "/api/v1/datasources",
                headers=AUTH,
                json={
                    "type": ds_type,
                    "name": f"{ds_type}-{suffix}",
                    "code": f"{ds_type}-{suffix}",
                    "host": "127.0.0.1",
                    "port": {"hive": 10000, "clickhouse": 8123, "sqlserver": 1433, "doris": 9030, "oracle": 1521}[ds_type],
                    "database": "default" if ds_type in ("hive", "clickhouse") else ("master" if ds_type == "sqlserver" else ("ORCL" if ds_type == "oracle" else "test")),
                    "username": "user",
                    "password": "secret",
                },
            )
            assert resp.status_code in (200, 201)
            created_types.append(ds_type)
    types_resp = client.get("/api/v1/datasources/types", headers=AUTH)
    type_names = {item["type"] for item in types_resp.json()["items"]}
    for t in created_types:
        assert t in type_names


def test_r36_suite_import_no_conflict_r37():
    """T-REG-R37-03: r36 test_connectors_gov_r36 模块可导入无冲突。"""
    import tests.test_connectors_gov_r36 as r36_mod

    assert hasattr(r36_mod, "test_registry_ten_types_r36")


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_no_regression_r37(mock_connect):
    """T-REG-R37-04: mysql test_connection mock 成功不回归。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = MysqlConnector().test_connection(
        host="127.0.0.1", port=3306, database="test", username="root", password=""
    )
    assert result.ok is True
```

- [ ] **Step 2: 运行 r37 全套件**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r37.py -v --tb=short`
Expected: ≥35 passed（含 scaffold + 33 断言函数）

- [ ] **Step 3: 全量回归 r36+r35+r34**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py -v`
Expected: ruff clean；≥842 passed + 4 skipped；r36 37/37 + r35 35/35 + r34 15/15

- [ ] **Step 4: Commit**

```bash
git add tests/test_connectors_gov_r37.py
git commit -m "test(r37): T-REG-R37 registry HTTP + full connector regression"
```

---

### Task 8: 文档同步 — datasources.md §r37

**Files:**
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 域文档更新；无 UI 变更

**Interfaces:**
- Consumes: Task 1–7 全部实现与测试结果
- Produces: `datasources.md` §r37 companion 质量推分登记

- [ ] **Step 1: 在 datasources.md 追加 §r37 companion 质量推分**

在 `### r36 connector kickoff（2026-07-04）` 段之后追加：

```markdown
### r37 companion 质量推分（2026-07-04）

五方言 companion 边界闭合（CONN-003/004/005/007/008）：

| 方言 | 错误域上浮 | 列 limit | 边界闭合 |
|------|-----------|---------|---------|
| Oracle | `errors.map_oracle_error`（含 ORA-12505） | `ORACLE_MAX_COLUMNS=500` | 未知 owner → `[]`；多 owner schema 过滤 SYS/SYSTEM |
| Doris | `errors.map_doris_operational_error`（含 `DORIS_UNKNOWN_DATABASE`） | `DORIS_MAX_COLUMNS=500` | 空用户库 schemas → `[]` |
| SQL Server | `errors.map_sqlserver_operational_error` | `SQLSERVER_MAX_COLUMNS=500` | dbo/自定义 schema；`ssl_mode=disabled` → `encrypt=False` |
| Hive | `errors.map_hive_error` | `HIVE_MAX_COLUMNS=500` | 全空库 schemas → `[]`；unknown database |
| ClickHouse | `errors.map_clickhouse_error` | `CLICKHOUSE_MAX_COLUMNS=500`（r36） | 未知 table columns → `[]` |

- 测试套件：`tests/test_connectors_gov_r37.py`（≥28 条 T-CONN-R37-* / T-REG-R37-*）
- HTTP 契约：test_connection 失败 200 + `ok=false` + `{PREFIX}_*`；metadata 缺参 400 `METADATA_INVALID_REQUEST`；连接失败 502 `METADATA_CONNECTION_FAILED`
- 回归：r36 37/37 + r35 35/35 + r34 15/15 不删旧套件
```

更新域附录表格中五方言状态备注：`已实现（L1 r36 + companion r37）`。

- [ ] **Step 2: 最终验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py -q`
Expected: ruff clean；≥842 passed + 4 skipped

- [ ] **Step 3: Commit**

```bash
git add docs/services/datasources.md
git commit -m "docs(r37): datasources.md companion quality boundaries §r37"
```

---

## Self-Review（P2 完成前自检）

| 检查项 | 状态 |
|--------|------|
| design 五子项均有对应 Task | Task 2–6 各覆盖 CONN-004/008/005/003/007 |
| errors.py 集中导出 | Task 1 |
| ≥28 新测 | 33 断言函数 + scaffold |
| 无 TBD/TODO 占位 | 已逐条写明代码与命令 |
| 全 Task UI skill: none | 是 |
| 文件数 ≤20 | P3 新建 1 + 修改 8 = 9 |
| HTTP 链每方言 ≥1 失败 + metadata | Oracle/Doris/Hive/ClickHouse HTTP + Doris/ClickHouse metadata 400 + Hive metadata 502 |
| 回归 r36+r35+r34 | Task 7 Step 3 |
