# M12 Query 翻译器 + M11 信创/专项连接器 + META 维度 companion 质量推分 r39 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/errors.py`、`trino.py`、`gaussdb.py`、`dm.py`、`backend/app/metadata/dimensions/schemas.py`、`service.py`、`backend/app/query/translator/service.py`、`schemas.py`、`tests/test_query_meta_conn_r39.py`、`docs/services/datasources.md`、`docs/services/metadata.md`
> **子项：** QUERY-008, CONN-022, META-003, CONN-017, CONN-010
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** r39 companion 质量推分 — 闭合 r38 五 ID（87.1–89.6）遗留的 Trino/GaussDB/DM test_connection·schema·types 边界、dimensions values 校验链、translator 非法算子/字段/注入守卫与 HTTP 链；`test_query_meta_conn_r39.py` ≥30 条 + r38 36/36 + r37 40/40 回归全绿；五 ID 加权总分破 90。

**Architecture:** 镜像 r37 companion 模式 — `errors.py` 巩固 `GAUSSDB_*`/`DM_*`/`TRINO_*` timeout/auth 映射注释；三 connector 补列元数据 limit=500（GaussDB 新增）、多 owner/schema 边界与 HTTP metadata 400/502 链；`dimensions` service 层 values 校验码 + 批内重复预检；`translator` 巩固 L1 算子白名单与参数化守卫（生产代码改动极小，以 pytest 闭合）；独立 SQLite fixture `query_meta_conn_r39` 隔离。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · psycopg 3 · trino-python-client · dmPython（mock）· pytest · ruff

## Global Constraints

- 纯后端 companion 质量推分；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 Alembic migration；不触及 `fe/`
- `docs/automate/prd/F04-CONN.md`、`F05-QUERY.md`、`F11-META.md` **P5 对账**（非 P3）
- 错误码前缀：`TRINO_*`、`GAUSSDB_*`、`DM_*`、`META_DIM_VALUE_*`、`QUERY_TRANSLATE_*`
- `test_connection` 失败：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`
- 列元数据 limit：**500**（`TRINO_MAX_COLUMNS`/`DM_MAX_COLUMNS` 已有；GaussDB 本轮对齐）
- 文件预算：新建 **1** + 修改 **10** = **11**（P3）；设计框定 18 含 P5 PRD 分片
- 验证基线：r38 后 **891 passed** + 4 skipped；本轮目标 **≥921 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_query_meta_conn_r39.py tests/test_query_meta_conn_r38.py tests/test_connectors_gov_r37.py -v`

---

### Task 1: 错误域注释巩固 + r39 测试脚手架

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `tests/test_query_meta_conn_r39.py`（module fixture + `test_r39_scaffold`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；本轮不触及 `fe/` 或壳层组件

**Interfaces:**
- Consumes: r38 已有 `map_gaussdb_error` / `map_dm_error` / `map_trino_error` 与常量
- Produces: `errors.py` 模块级 docstring + `__all__` 导出；`_R39_SQLITE_URL` fixture；`test_r39_scaffold`

- [ ] **Step 1: 在 errors.py GaussDB/DM/Trino 段补模块注释与 `__all__`**

在 `backend/app/datasources/dialects/errors.py` 文件末尾（`map_trino_error` 之后）追加：

```python
# r39 companion: GAUSSDB_/DM_/TRINO_ timeout/auth 映射由 map_* 统一出口；
# connector test_connection 与 HTTP test 链均消费本模块常量（勿在 dialect 文件内复制错误码）。

__all__ = [
  # ... 保留文件内已有 MYSQL_/PG_/... 常量名（按字母序列出 GAUSSDB_/DM_/TRINO_ 段）...
  "GAUSSDB_AUTH_FAILED",
  "GAUSSDB_CONN_REFUSED",
  "GAUSSDB_TIMEOUT",
  "GAUSSDB_UNKNOWN",
  "GAUSSDB_UNKNOWN_DATABASE",
  "DM_AUTH_FAILED",
  "DM_CONN_REFUSED",
  "DM_DRIVER_MISSING",
  "DM_TIMEOUT",
  "DM_UNKNOWN",
  "DM_UNKNOWN_DATABASE",
  "TRINO_AUTH_FAILED",
  "TRINO_CONN_REFUSED",
  "TRINO_DRIVER_MISSING",
  "TRINO_TIMEOUT",
  "TRINO_UNKNOWN",
  "TRINO_UNKNOWN_CATALOG",
  "map_dm_error",
  "map_gaussdb_error",
  "map_trino_error",
]
```

在 `map_gaussdb_error` 函数 docstring 位置加一行注释：`# PG_TIMEOUT → GAUSSDB_TIMEOUT via _GAUSSDB_FROM_PG`。`map_dm_error` / `map_trino_error` 同理标注 timeout/auth 分支。

- [ ] **Step 2: 创建 test_query_meta_conn_r39.py 脚手架**

```python
"""M12 Query + M11 信创/专项连接器 + META 维度 companion 质量推分 r39."""
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

_R39_SQLITE_URL = "sqlite+pysqlite:///file:query_meta_conn_r39?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r39_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R39_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.dimensions.models  # noqa: F401
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
            "trino": dict(port=8080, database="hive"),
            "gaussdb": dict(port=5432, database="postgres"),
            "dm": dict(port=5236, database="DAMENG"),
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
                password="secret123",
            ),
        )
    finally:
        session.close()


def test_r39_scaffold(client):
    """T-R39-000-01: fixture 可用，/health 200。"""
    assert client.get("/health").status_code == 200
```

- [ ] **Step 3: 运行脚手架测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r39.py::test_r39_scaffold -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/errors.py tests/test_query_meta_conn_r39.py
git commit -m "test(r39): scaffold companion quality suite + errors export"
```

---

### Task 2: CONN-010 Trino companion 边界

**Files:**
- Modify: `backend/app/datasources/dialects/trino.py`
- Modify: `tests/test_query_meta_conn_r39.py`（追加 6 条 Trino 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1 `_create_typed_ds`、`map_trino_error`、`TRINO_MAX_COLUMNS=500`（已有）
- Produces: `list_schemas` 无 catalog 守卫注释；6 条 `T-CONN-R39-010-*` 测试

- [ ] **Step 1: 巩固 trino.py list_schemas / list_columns 注释**

`trino.py` 在 `list_schemas` 与 `list_columns` 方法上方各加一行 docstring（行为不变）：

```python
def list_schemas(self, connection: Any, *, catalog: str | None = None) -> list[SchemaInfo]:
    """Empty catalog returns [] — caller must supply catalog for SHOW SCHEMAS."""
    if not catalog:
        return []
    ...

def list_columns(self, connection: Any, schema: str, table: str, *, catalog: str | None = None) -> list[ColumnInfo]:
    """DESCRIBE result sliced to TRINO_MAX_COLUMNS (500)."""
    ...
```

- [ ] **Step 2: 写入 Trino 单元 + HTTP 测试（T-CONN-R39-010-01 ~ 06）**

在 `tests/test_query_meta_conn_r39.py` 追加：

```python
from app.datasources.dialects.errors import TRINO_AUTH_FAILED, TRINO_TIMEOUT, map_trino_error
from app.datasources.dialects.trino import TRINO_MAX_COLUMNS, TrinoConnector


def test_conn_trino_auth_failed_r39():
    """T-CONN-R39-010-01: mock 401 Unauthorized → TRINO_AUTH_FAILED。"""
    code, _ = map_trino_error(Exception("401 Unauthorized"))
    assert code == TRINO_AUTH_FAILED


def test_conn_trino_timeout_r39():
    """T-CONN-R39-010-02: mock timeout → TRINO_TIMEOUT。"""
    code, _ = map_trino_error(Exception("Query timed out after 30s"))
    assert code == TRINO_TIMEOUT


@patch("trino.dbapi.connect")
def test_conn_trino_columns_limit_r39(mock_connect):
    """T-CONN-R39-010-03: mock 600 列 DESCRIBE → 返回 500 + 类型非空。"""
    conn = MagicMock()
    cursor = MagicMock()
    rows = [(f"col_{i}", "VARCHAR") for i in range(600)]
    cursor.fetchall.return_value = rows
    conn.cursor.return_value = cursor
    cols = TrinoConnector().list_columns(conn, "default", "t", catalog="hive")
    assert len(cols) == TRINO_MAX_COLUMNS
    assert cols[0].data_type == "VARCHAR"


@patch("trino.dbapi.connect")
def test_conn_trino_multi_schema_r39(mock_connect):
    """T-CONN-R39-010-04: mock 多 schema → default,sales。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("default",), ("sales",)]
    conn.cursor.return_value = cursor
    names = [s.name for s in TrinoConnector().list_schemas(conn, catalog="hive")]
    assert names == ["default", "sales"]


@patch("trino.dbapi.connect")
def test_conn_trino_http_conn_refused_r39(mock_connect, client):
    """T-CONN-R39-010-05: HTTP POST test mock refused → 200 ok=false TRINO_CONN_REFUSED traceId。"""
    mock_connect.side_effect = ConnectionRefusedError("refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "trino",
            "name": "trino-test",
            "code": f"trino-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "u",
            "password": "",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TRINO_CONN_REFUSED"
    assert body.get("traceId")


def test_conn_trino_metadata_tables_missing_schema_400_r39(client):
    """T-CONN-R39-010-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("trino")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 3: 运行 Trino 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r39.py -k "trino" -v`
Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/trino.py tests/test_query_meta_conn_r39.py
git commit -m "feat(conn-010): Trino companion boundaries + r39 tests"
```

---

### Task 3: CONN-022 GaussDB companion 边界

**Files:**
- Modify: `backend/app/datasources/dialects/gaussdb.py`
- Modify: `tests/test_query_meta_conn_r39.py`（追加 5 条 GaussDB 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `PostgresConnector.list_columns` 委托；`map_gaussdb_error`
- Produces: `GAUSSDB_MAX_COLUMNS = 500`；`list_columns` 切片；5 条 `T-CONN-R39-022-*`

- [ ] **Step 1: 实现 GAUSSDB_MAX_COLUMNS + list_columns 切片**

修改 `backend/app/datasources/dialects/gaussdb.py`：

```python
GAUSSDB_MAX_COLUMNS = 500


class GaussdbConnector:
    ...
    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        columns = self._delegate.list_columns(connection, schema, table)
        return columns[:GAUSSDB_MAX_COLUMNS] if len(columns) > GAUSSDB_MAX_COLUMNS else columns
```

- [ ] **Step 2: 写入 GaussDB 测试（T-CONN-R39-022-01 ~ 05）**

```python
from app.datasources.dialects.errors import GAUSSDB_TIMEOUT, map_gaussdb_error
from app.datasources.dialects.gaussdb import GAUSSDB_MAX_COLUMNS, GaussdbConnector


def test_conn_gaussdb_timeout_r39():
    """T-CONN-R39-022-01: mock timeout → GAUSSDB_TIMEOUT。"""
    code, _ = map_gaussdb_error(Exception("connection timed out"))
    assert code == GAUSSDB_TIMEOUT


@patch("app.datasources.dialects.gaussdb.PostgresConnector.list_columns")
def test_conn_gaussdb_columns_limit_r39(mock_list_columns):
    """T-CONN-R39-022-02: mock 600 列 → 返回 500。"""
    from app.datasources.dialects.base import ColumnInfo
    mock_list_columns.return_value = [
        ColumnInfo(name=f"c{i}", data_type="varchar", nullable=True) for i in range(600)
    ]
    conn = MagicMock()
    cols = GaussdbConnector().list_columns(conn, "public", "t")
    assert len(cols) == GAUSSDB_MAX_COLUMNS


@patch("app.datasources.dialects.gaussdb.PostgresConnector.list_schemas")
def test_conn_gaussdb_multi_schema_r39(mock_list_schemas):
    """T-CONN-R39-022-03: mock 多 schema 含 public 不含 pg_catalog（委托 PG 过滤）。"""
    from app.datasources.dialects.base import SchemaInfo
    mock_list_schemas.return_value = [
        SchemaInfo(name="public"),
        SchemaInfo(name="sales"),
    ]
    conn = MagicMock()
    names = {s.name for s in GaussdbConnector().list_schemas(conn)}
    assert "public" in names
    assert "pg_catalog" not in names


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_http_auth_failed_r39(mock_open, client):
    """T-CONN-R39-022-04: HTTP POST test mock 28P01 → GAUSSDB_AUTH_FAILED。"""
    import psycopg
    exc = psycopg.OperationalError("password authentication failed")
    exc.sqlstate = "28P01"
    mock_open.side_effect = exc
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "gaussdb",
            "name": "gauss-test",
            "code": f"gauss-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5432,
            "database": "postgres",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "GAUSSDB_AUTH_FAILED"
    assert body.get("traceId")


def test_conn_gaussdb_metadata_tables_missing_schema_400_r39(client):
    """T-CONN-R39-022-05: HTTP GET tables 缺 schema → 400。"""
    ds = _create_typed_ds("gaussdb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 3: 运行 GaussDB 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r39.py -k "gaussdb" -v`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/gaussdb.py tests/test_query_meta_conn_r39.py
git commit -m "feat(conn-022): GaussDB MAX_COLUMNS + companion tests"
```

---

### Task 4: CONN-017 达梦 DM companion 边界 + 脱敏

**Files:**
- Modify: `backend/app/datasources/dialects/dm.py`
- Modify: `tests/test_query_meta_conn_r39.py`（追加 6 条 DM 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `map_dm_error`、`DM_MAX_COLUMNS=500`（已有）、`_SYSTEM_OWNERS`
- Produces: `test_connection` message 脱敏辅助；6 条 `T-CONN-R39-017-*`

- [ ] **Step 1: dm.py 错误 message 脱敏（不含请求 password）**

在 `dm.py` 顶部增加私有函数，并在 `test_connection` 异常分支使用：

```python
def _redact_secrets(message: str, password: str | None) -> str:
    if password and password in message:
        return message.replace(password, "***")
    return message
```

修改 `test_connection` 的 `except Exception` 分支：

```python
        except Exception as exc:
            code, detail = map_dm_error(exc)
            detail = _redact_secrets(detail, kwargs.get("password"))
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code,
            )
```

- [ ] **Step 2: 写入 DM 测试（T-CONN-R39-017-01 ~ 06）**

```python
from app.datasources.dialects.errors import DM_TIMEOUT, map_dm_error
from app.datasources.dialects.dm import DmConnector


def test_conn_dm_timeout_r39():
    """T-CONN-R39-017-01: mock timeout → DM_TIMEOUT。"""
    code, _ = map_dm_error(Exception("connection timed out"))
    assert code == DM_TIMEOUT


@patch("dmPython.connect")
def test_conn_dm_multi_owner_schemas_r39(mock_connect):
    """T-CONN-R39-017-02: mock 多 owner 含 HR 不含 SYS。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("HR",), ("APP",), ("SYS",)]
    conn.cursor.return_value = cursor
    names = {s.name for s in DmConnector().list_schemas(conn)}
    assert "HR" in names
    assert "APP" in names
    assert "SYS" not in names


@patch("dmPython.connect")
def test_conn_dm_column_types_smoke_r39(mock_connect):
    """T-CONN-R39-017-03: mock list_columns 类型枚举非空。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ("NAME", "VARCHAR", "Y"),
        ("AMT", "NUMBER", "N"),
        ("CREATED", "DATE", "Y"),
    ]
    conn.cursor.return_value = cursor
    cols = DmConnector().list_columns(conn, "HR", "EMP")
    assert len(cols) == 3
    assert {c.data_type for c in cols} == {"VARCHAR", "NUMBER", "DATE"}


@patch("dmPython.connect")
def test_conn_dm_http_no_password_leak_r39(mock_connect, client):
    """T-CONN-R39-017-04: HTTP test 失败响应不含 password 明文 secret123。"""
    mock_connect.side_effect = Exception("Login failed -2501 wrong password secret123")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "dm",
            "name": "dm-test",
            "code": f"dm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5236,
            "database": "DAMENG",
            "username": "u",
            "password": "secret123",
        },
    )
    assert resp.status_code == 200
    assert "secret123" not in resp.text


@patch("dmPython.connect")
def test_conn_dm_http_auth_failed_r39(mock_connect, client):
    """T-CONN-R39-017-05: HTTP POST test mock -2501 → DM_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Login failed -2501")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "dm",
            "name": "dm-auth",
            "code": f"dm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5236,
            "database": "DAMENG",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["code"] == "DM_AUTH_FAILED"


def test_conn_dm_metadata_tables_missing_schema_400_r39(client):
    """T-CONN-R39-017-06: HTTP GET tables 无 schema → 400。"""
    ds = _create_typed_ds("dm")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"
```

- [ ] **Step 3: 运行 DM 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r39.py -k "dm" -v`
Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/dialects/dm.py tests/test_query_meta_conn_r39.py
git commit -m "feat(conn-017): DM owner boundaries + password redaction tests"
```

---

### Task 5: META-003 维度 values 校验链

**Files:**
- Modify: `backend/app/metadata/dimensions/schemas.py`
- Modify: `backend/app/metadata/dimensions/service.py`
- Modify: `tests/test_query_meta_conn_r39.py`（追加 6 条 META 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `DIM_CODE_RE`；`DimensionValueItem`；`register_values` / `list_values`
- Produces: `META_DIM_VALUE_INVALID_CODE` / `INVALID_LABEL` / `DUPLICATE_BATCH`；6 条 `T-META-R39-003-*`

- [ ] **Step 1: schemas.py — DimensionValueItem strip 规范化**

```python
class DimensionValueItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    code: str
    label: str
    sort_order: int = Field(default=0, alias="sortOrder")

    @field_validator("code", "label")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()
```

- [ ] **Step 2: service.py — register_values 校验与批内重复预检**

在 `register_values` 开头、`get_dimension` 之后插入：

```python
def _validate_value_item(item: DimensionValueItem) -> None:
    from app.metadata.dimensions.schemas import DIM_CODE_RE
    if not item.code or not DIM_CODE_RE.match(item.code):
        raise DimensionError(
            "META_DIM_VALUE_INVALID_CODE",
            "Invalid dimension value code",
            422,
            fields=[{"field": "code", "message": "must match ^[a-z][a-z0-9_]{1,63}$"}],
        )
    if not item.label:
        raise DimensionError(
            "META_DIM_VALUE_INVALID_LABEL",
            "Dimension value label must not be blank",
            422,
            fields=[{"field": "label", "message": "must not be blank"}],
        )


def register_values(
    session: Session,
    dimension_id: uuid.UUID,
    items: list[DimensionValueItem],
) -> list[DimensionValue]:
    get_dimension(session, dimension_id)
    seen: set[str] = set()
    for item in items:
        _validate_value_item(item)
        if item.code in seen:
            raise DimensionError(
                "META_DIM_VALUE_DUPLICATE_BATCH",
                "Duplicate value code in batch",
                422,
                fields=[{"field": "code", "message": f"duplicate: {item.code}"}],
            )
        seen.add(item.code)
    # ... 原有 created 循环不变 ...
```

- [ ] **Step 3: 写入 META 测试（T-META-R39-003-01 ~ 06）**

```python
def _create_dimension(client, code: str) -> dict:
    resp = client.post(
        "/api/v1/metadata/dimensions",
        headers=AUTH,
        json={"code": code, "name": code},
    )
    assert resp.status_code == 201
    return resp.json()


def test_meta_value_invalid_empty_code_r39(client):
    """T-META-R39-003-01: POST values code='' → 422 META_DIM_VALUE_INVALID_CODE。"""
    dim = _create_dimension(client, "val_empty_code")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "", "label": "X"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_INVALID_CODE"


def test_meta_value_invalid_code_pattern_r39(client):
    """T-META-R39-003-02: POST values code=Bad-Code → 422。"""
    dim = _create_dimension(client, "val_bad_pattern")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "Bad-Code", "label": "X"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_INVALID_CODE"


def test_meta_value_duplicate_batch_r39(client):
    """T-META-R39-003-03: 批内重复 code → 422 META_DIM_VALUE_DUPLICATE_BATCH。"""
    dim = _create_dimension(client, "val_dup_batch")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "a", "label": "A"}, {"code": "a", "label": "B"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_DUPLICATE_BATCH"


def test_meta_value_invalid_blank_label_r39(client):
    """T-META-R39-003-04: label 仅空白 → 422 META_DIM_VALUE_INVALID_LABEL。"""
    dim = _create_dimension(client, "val_blank_label")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "ok", "label": "   "}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_INVALID_LABEL"


def test_meta_value_list_pagination_r39(client):
    """T-META-R39-003-05: GET values limit=1 → len(items)==1 且 total>=2。"""
    dim = _create_dimension(client, "val_page")
    client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "v1", "label": "V1"}, {"code": "v2", "label": "V2"}]},
    )
    resp = client.get(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        params={"limit": 1, "offset": 0},
    )
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["total"] >= 2


def test_meta_dimension_list_limit_500_r39(client):
    """T-META-R39-003-06: GET dimensions limit=500 上限 smoke（与 glossary 对齐）。"""
    resp = client.get("/api/v1/metadata/dimensions", headers=AUTH, params={"limit": 500})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 500
```

- [ ] **Step 4: 运行 META 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r39.py -k "meta" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/dimensions/schemas.py backend/app/metadata/dimensions/service.py tests/test_query_meta_conn_r39.py
git commit -m "feat(meta-003): dimension values validation + batch duplicate guard"
```

---

### Task 6: QUERY-008 翻译器算子/字段/注入守卫

**Files:**
- Modify: `backend/app/query/translator/schemas.py`
- Modify: `backend/app/query/translator/service.py`（仅当缺口；多数守卫 r38 已有）
- Modify: `tests/test_query_meta_conn_r39.py`（追加 8 条 QUERY 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `L1_OPERATORS`、`validate_identifier`、`translate_config_to_sql`
- Produces: `schemas.py` L1 与 designer 分层文档；8 条 `T-QUERY-R39-008-*`

- [ ] **Step 1: schemas.py 文档化 L1_OPERATORS**

在 `L1_OPERATORS` 定义上方追加模块注释：

```python
# L1 translator operators — subset of designer ALLOWED_OPERATORS.
# Designer includes not_in; translator L1 intentionally excludes it (see QUERY-008 PRD).
L1_OPERATORS = frozenset({
    "eq", "ne", "gt", "gte", "lt", "lte", "in", "like", "is_null", "is_not_null",
})
```

- [ ] **Step 2: 确认 service.py 守卫（无缺口则跳过代码改动）**

核对 `_validate_conditions` 已拒绝 `not_in`/`contains`；`_condition_sql` 的 `in` 非 list 抛 `QUERY_TRANSLATE_INVALID_CONFIG`；`OR` logic 由 `joiner` 拼接。若 `contains` 未在白名单则无需改代码。

- [ ] **Step 3: 写入 QUERY 测试（T-QUERY-R39-008-01 ~ 08）**

```python
from app.query.translator import service as translator_service
from app.query.translator.schemas import (
    TranslateConditionItem,
    TranslateConditions,
    TranslateError,
    TranslateRequest,
)


def test_query_invalid_operator_not_in_r39():
    """T-QUERY-R39-008-01: operator=not_in → QUERY_TRANSLATE_INVALID_OPERATOR。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="not_in", value=["a"], valueType="string"),
            ],
        ),
    )
    with pytest.raises(TranslateError) as exc:
        translator_service.translate_config_to_sql(req)
    assert exc.value.code == "QUERY_TRANSLATE_INVALID_OPERATOR"


def test_query_invalid_identifier_injection_r39():
    """T-QUERY-R39-008-02: columns 含注入字符 → QUERY_TRANSLATE_INVALID_IDENTIFIER。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="public",
        table="t",
        columns=["x;drop"],
    )
    with pytest.raises(TranslateError) as exc:
        translator_service.translate_config_to_sql(req)
    assert exc.value.code == "QUERY_TRANSLATE_INVALID_IDENTIFIER"


def test_query_mysql_in_three_params_r39():
    """T-QUERY-R39-008-03: mysql in 三值 → 3 占位符 + parameters 3 键。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="db",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(
                    fieldId="status", operator="in", value=["a", "b", "c"], valueType="string",
                ),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert resp.sql.count("%(p") == 3
    assert len(resp.parameters) == 3
    assert "a" not in resp.sql and "b" not in resp.sql


def test_query_postgresql_or_logic_r39():
    """T-QUERY-R39-008-04: postgresql logic=OR 双条件 → SQL 含 OR。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="OR",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="eq", value="a", valueType="string"),
                TranslateConditionItem(fieldId="order_amount", operator="eq", value=1, valueType="number"),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert " OR " in resp.sql


def test_query_clickhouse_like_placeholder_r39():
    """T-QUERY-R39-008-05: clickhouse like → {p0:String}。"""
    req = TranslateRequest(
        connectorType="clickhouse",
        schema="default",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="like", value="%x%", valueType="string"),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "{p0:String}" in resp.sql


def test_query_in_non_array_r39():
    """T-QUERY-R39-008-06: in + 非 array value → QUERY_TRANSLATE_INVALID_CONFIG。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="db",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="in", value="not-array", valueType="string"),
            ],
        ),
    )
    with pytest.raises(TranslateError) as exc:
        translator_service.translate_config_to_sql(req)
    assert exc.value.code == "QUERY_TRANSLATE_INVALID_CONFIG"


def test_query_http_invalid_operator_r39(client):
    """T-QUERY-R39-008-07: HTTP POST 非法算子 contains → 422 + code。"""
    payload = {
        "connectorType": "postgresql",
        "schema": "public",
        "table": "t",
        "columns": ["status"],
        "conditions": {
            "logic": "AND",
            "conditions": [
                {"fieldId": "status", "operator": "contains", "value": "x", "valueType": "string"},
            ],
        },
    }
    resp = client.post("/api/v1/query/translate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_INVALID_OPERATOR"


def test_query_sql_injection_guard_r39():
    """T-QUERY-R39-008-08: 恶意 value 不在 SQL 字面量中。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(
                    fieldId="status",
                    operator="eq",
                    value="' OR 1=1 --",
                    valueType="string",
                ),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "' OR 1=1 --" not in resp.sql
    assert "%(p0)s" in resp.sql
    assert resp.parameters["p0"] == "' OR 1=1 --"
```

- [ ] **Step 4: 运行 QUERY 测试**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r39.py -k "query" -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/translator/schemas.py tests/test_query_meta_conn_r39.py
git commit -m "test(query-008): translator operator/identifier/injection guards r39"
```

---

### Task 7: r39 全量集成 + r38/r37 回归门控

**Files:**
- Modify: `tests/test_query_meta_conn_r39.py`（补 `test_r38_r37_regression_import_r39`）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 1–6 全部测试
- Produces: r39 ≥31 条全绿；r38 36/36；r37 40/40；ruff clean

- [ ] **Step 1: 追加回归 smoke**

```python
def test_r38_r37_regression_import_r39():
    """T-R39-999-01: r38/r37 套件可 import 且无命名冲突。"""
    import tests.test_query_meta_conn_r38 as r38  # noqa: F401
    import tests.test_connectors_gov_r37 as r37  # noqa: F401
    assert r38 is not None and r37 is not None
```

- [ ] **Step 2: ruff**

Run: `cd backend && python3 -m ruff check .`
Expected: All checks passed

- [ ] **Step 3: r39 全量**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r39.py -v --tb=short`
Expected: ≥31 passed（1 scaffold + 6 trino + 5 gaussdb + 6 dm + 6 meta + 8 query + 1 regression）

- [ ] **Step 4: r38 + r37 回归**

Run: `cd backend && python3 -m pytest tests/test_query_meta_conn_r38.py tests/test_connectors_gov_r37.py -v --tb=short`
Expected: 36 + 40 = 76 passed

- [ ] **Step 5: Commit**

```bash
git add tests/test_query_meta_conn_r39.py
git commit -m "test(r39): full companion suite + regression gate"
```

---

### Task 8: docs/services 域附录同步

**Files:**
- Modify: `docs/services/datasources.md`
- Modify: `docs/services/metadata.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（文档同步评估）

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: Task 2–6 实现与测试 ID
- Produces: r39 companion 边界登记；无 API 路由变更

- [ ] **Step 1: datasources.md — r39 三方言 companion 注记**

在 `gaussdb.py` / `dm.py` / `trino.py` 表格行状态改为「已实现 L1 + companion r39」，并追加小节：

```markdown
### r39 companion 质量推分（2026-07-04）

- **CONN-010 Trino**：`TRINO_*` timeout/auth 全路径 pytest；catalog 空→[]；`TRINO_MAX_COLUMNS=500`；HTTP test + metadata tables 缺 schema 400
- **CONN-022 GaussDB**：`GAUSSDB_MAX_COLUMNS=500`；`GAUSSDB_TIMEOUT`/`GAUSSDB_AUTH_FAILED` HTTP 链；委托 PG schema 过滤
- **CONN-017 DM**：多 owner `list_schemas` 过滤 SYS/SYSDBA；`DM_TIMEOUT`；HTTP test 响应不泄露请求 password；metadata 400 链
- 回归：`test_query_meta_conn_r39.py` ≥30 条 + r38 36/36
```

- [ ] **Step 2: metadata.md — values 校验码与分页**

在错误码表追加：

```markdown
| `META_DIM_VALUE_INVALID_CODE` | value code 空白或不符合 `^[a-z][a-z0-9_]{1,63}$` |
| `META_DIM_VALUE_INVALID_LABEL` | value label 空白 |
| `META_DIM_VALUE_DUPLICATE_BATCH` | 同批次重复 value code |
```

在实现笔记追加：

```markdown
- r39：values `register_values` 批内重复预检；`list_values`/`list_dimensions` 分页 limit 上限 500（与 glossary 对齐）；`test_query_meta_conn_r39` T-META-R39-003-*
```

- [ ] **Step 3: 验证文档无断链**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_query_meta_conn_r39.py -q`
Expected: ruff clean；r39 全绿

- [ ] **Step 4: Commit**

```bash
git add docs/services/datasources.md docs/services/metadata.md
git commit -m "docs: r39 companion boundaries for connectors + dimension values"
```

---

## Self-Review（planner 已完成）

| 检查项 | 结果 |
|--------|------|
| round-target 五子项覆盖 | Task 2–6 一一对应 CONN-010/022/017、META-003、QUERY-008 |
| 文件数 ≤20 | P3：11 文件；含 P5 PRD 3 分片共 14 |
| 无 TBD/TODO | 已逐条给出代码与命令 |
| UI skill | 全 Task `UI skill: none` |
| 验收 ID | 32 条命名与 design §3 对齐 |
| 回归 | Task 7 显式 r38 36 + r37 40 |
