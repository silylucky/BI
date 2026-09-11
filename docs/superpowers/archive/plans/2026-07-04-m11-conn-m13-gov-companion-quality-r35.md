# M11 连接器 + M13 治理 companion 质量推分 r35 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/tidb.py`、`starrocks.py`、`elasticsearch.py`、`errors.py`、`backend/app/governance/acl.py`、`backend/app/governance/query_design/service.py`、`backend/app/governance/query_design/schemas.py`、`backend/app/api/v1/gov.py`、`tests/test_connectors_gov_r35.py`、`docs/services/datasources.md`、`docs/services/governance.md`、`docs/api/README.md`
> **子项：** CONN-021, CONN-009, GOV-008, GOV-004, CONN-015
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 闭合 r34 L1 遗留边界 — TiDB `TIDB_*` 错误域与 schema 空/未知表、StarRocks 拒绝/凭证与列元数据 500 limit、GOV-008 `preview-execute` ACL/RLS 链与 bypass 审计、GOV-004 validate/save/get `detail.fields` 全覆盖含 computeRules、ES 多索引/mapping 归一/字段 limit/TLS；`test_connectors_gov_r35.py` ≥18 条 + r34 15/15 + r33 19/19 回归全绿。

**Architecture:** 方言层镜像 r34 StarRocks 模式（TiDB 自有 `test_connection` + `_map_tidb_error`）；StarRocks/ES `list_columns` 查询后切片至 500；治理层在 `acl.py` 增 `assert_query_design_execute` + `service.preview_query_design_execute`，薄 API `POST /gov/query-design/preview-execute`；GOV-004 不复制 designer 规则，仅巩固 gov 路径错误透传与 pytest 覆盖。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pymysql · elasticsearch-py · pytest · ruff

## Global Constraints

- 纯后端质量推分；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 Alembic migration
- 不含 `fe/`、CONN-003~008 远期方言、META/DESIGN 远期项、真实 TiDB/StarRocks/ES 容器集成
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": {"fields": [...]}|null}`
- API 前缀 `/api/v1/`；鉴权 `Authorization: Bearer dev`
- 常量：`TIDB_*`、`STARROCKS_MAX_COLUMNS=500`、`ES_MAX_MAPPING_FIELDS=500`
- 文件预算：新建 **1** + 修改 **12** = **13**（PRD 分片 P5 对账不计 P3）
- 验证基线：r34 `pytest` **742 passed** + 4 skipped；本轮目标 **≥760 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py tests/test_meta_design_r33.py -v`

---

### Task 1: CONN-021 — TiDB `TIDB_*` test_connection 与 schema 边界

**Files:**
- Modify: `backend/app/datasources/dialects/tidb.py`
- Modify: `backend/app/datasources/dialects/errors.py`（导出 `TIDB_*` 别名）
- Create: `tests/test_connectors_gov_r35.py`（CONN-021 段 7 条 + module fixture）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `MysqlConnector`, `map_mysql_operational_error`, `TestConnectionResult`
- Produces: `TIDB_TIMEOUT`、`TIDB_CONN_REFUSED`、`TIDB_AUTH_FAILED`、`TIDB_UNKNOWN_DATABASE`、`TIDB_UNKNOWN`；`TidbConnector.test_connection` 返回 `code=TIDB_*`；`list_schemas`/`list_columns` 委托不变

- [ ] **Step 1: 写失败测试（CONN-021 段 7 条）**

在 `tests/test_connectors_gov_r35.py` 写入 fixture 与 CONN-021 段（复用 r34 SQLite 模式，独立 DB 名 `connectors_gov_r35`）：

```python
"""M11 连接器 + M13 治理 companion 质量推分 r35 — CONN-021/009/015 + GOV-004/008."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pymysql.err
import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.datasources.dialects.tidb import TidbConnector
from app.datasources.registry import export_type_catalog
from app.main import app

_R35_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r35?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r35_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R35_SQLITE_URL
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


def test_tidb_types_catalog_r35():
    """T-CONN-R35-021-01: types 含 tidb relational schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tidb" in types
    assert types["tidb"]["category"] == "relational"
    assert "schema_browser" in types["tidb"]["capabilities"]


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_test_connection_ok_r35(mock_connect):
    """T-CONN-R35-021-02: mock ping 成功 → ok=True。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert result.ok is True
    conn.ping.assert_called_once_with(reconnect=False)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_auth_failed_r35(mock_connect):
    """T-CONN-R35-021-03: mock 1045 → TIDB_AUTH_FAILED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TIDB_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_conn_refused_r35(mock_connect):
    """T-CONN-R35-021-04: mock 2003 → TIDB_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "TIDB_CONN_REFUSED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_timeout_r35(mock_connect):
    """T-CONN-R35-021-05: mock 2013 → TIDB_TIMEOUT。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2013, "Lost connection: timeout")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "TIDB_TIMEOUT"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_empty_schemas_r35(mock_connect):
    """T-CONN-R35-021-06: mock 空 schemas → list_schemas []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = TidbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert connector.list_schemas(connection) == []


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_unknown_table_columns_r35(mock_connect):
    """T-CONN-R35-021-07: mock 未知表零行 → list_columns []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = TidbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert connector.list_columns(connection, "missing_db", "missing_tbl") == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "tidb" -v`
Expected: FAIL（`TIDB_AUTH_FAILED` 等未实现，当前返回 `MYSQL_*` 或 `code=None`）

- [ ] **Step 3: 实现 tidb.py + errors.py 导出**

`backend/app/datasources/dialects/tidb.py` 替换为（镜像 `starrocks.py` 结构）：

```python
from __future__ import annotations

import time
from typing import Any

import pymysql
import pymysql.err

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_mysql_operational_error
from app.datasources.dialects.mysql import MysqlConnector

TIDB_TIMEOUT = "TIDB_TIMEOUT"
TIDB_CONN_REFUSED = "TIDB_CONN_REFUSED"
TIDB_AUTH_FAILED = "TIDB_AUTH_FAILED"
TIDB_UNKNOWN_DATABASE = "TIDB_UNKNOWN_DATABASE"
TIDB_UNKNOWN = "TIDB_UNKNOWN"


def _map_tidb_error(exc: pymysql.err.OperationalError) -> tuple[str, str]:
    code, detail = map_mysql_operational_error(exc)
    mapping = {
        "MYSQL_TIMEOUT": TIDB_TIMEOUT,
        "MYSQL_CONN_REFUSED": TIDB_CONN_REFUSED,
        "MYSQL_AUTH_FAILED": TIDB_AUTH_FAILED,
        "MYSQL_UNKNOWN_DATABASE": TIDB_UNKNOWN_DATABASE,
    }
    return mapping.get(code, TIDB_UNKNOWN), detail


class TidbConnector:
    type = "tidb"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "TiDB"

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
            code, detail = _map_tidb_error(exc)
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
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        return self._inner.list_columns(connection, schema, table)
```

`backend/app/datasources/dialects/errors.py` 文件末尾追加：

```python
# TiDB aliases (mapped from MYSQL_* at connector layer)
TIDB_CONN_REFUSED = "TIDB_CONN_REFUSED"
TIDB_AUTH_FAILED = "TIDB_AUTH_FAILED"
TIDB_TIMEOUT = "TIDB_TIMEOUT"
TIDB_UNKNOWN_DATABASE = "TIDB_UNKNOWN_DATABASE"
TIDB_UNKNOWN = "TIDB_UNKNOWN"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "tidb" -v`
Expected: **7 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/tidb.py backend/app/datasources/dialects/errors.py tests/test_connectors_gov_r35.py
git commit -m "feat(conn): CONN-021 TiDB TIDB_* errors and schema boundary r35"
```

---

### Task 2: CONN-009 — StarRocks 连通扩展与列元数据 limit

**Files:**
- Modify: `backend/app/datasources/dialects/starrocks.py`
- Modify: `tests/test_connectors_gov_r35.py`（CONN-009 段 5 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `StarrocksConnector._inner.list_columns`
- Produces: `STARROCKS_MAX_COLUMNS = 500`；`list_tables(conn, "")` 返回 `[]`；`list_columns` 超 500 切片

- [ ] **Step 1: 写失败测试（CONN-009 段 5 条）**

追加到 `tests/test_connectors_gov_r35.py`：

```python
from app.datasources.dialects.starrocks import StarrocksConnector


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_starrocks_conn_refused_r35(mock_connect):
    """T-CONN-R35-009-01: mock 2003 → STARROCKS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "STARROCKS_CONN_REFUSED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_starrocks_auth_failed_r35(mock_connect):
    """T-CONN-R35-009-02: mock 1045 → STARROCKS_AUTH_FAILED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "STARROCKS_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_starrocks_empty_schema_tables_r35(mock_connect):
    """T-CONN-R35-009-03: schema='' → list_tables []。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    connector = StarrocksConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert connector.list_tables(connection, "") == []


def test_starrocks_columns_limit_r35():
    """T-CONN-R35-009-04: 600 列 mock → 返回 500。"""
    from app.datasources.dialects.base import ColumnInfo

    connector = StarrocksConnector()
    connector._inner.list_columns = MagicMock(
        return_value=[
            ColumnInfo(name=f"col_{i}", data_type="varchar", nullable=True) for i in range(600)
        ]
    )
    cols = connector.list_columns(MagicMock(), "db", "wide_tbl")
    assert len(cols) == 500
    assert cols[0].name == "col_0"
    assert cols[-1].name == "col_499"


def test_starrocks_types_catalog_r35():
    """T-CONN-R35-009-05: types 含 starrocks category olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["starrocks"]["category"] == "olap"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "starrocks" -v`
Expected: FAIL（`list_tables("", ...)` 未守卫、`list_columns` 无 limit）

- [ ] **Step 3: 实现 starrocks.py limit 与空 schema 守卫**

在 `backend/app/datasources/dialects/starrocks.py` 增补：

```python
STARROCKS_MAX_COLUMNS = 500

# list_tables 方法替换：
def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
    if not schema.strip():
        return []
    return self._inner.list_tables(connection, schema)

# list_columns 方法替换：
def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
    columns = self._inner.list_columns(connection, schema, table)
    if len(columns) > STARROCKS_MAX_COLUMNS:
        return columns[:STARROCKS_MAX_COLUMNS]
    return columns
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "starrocks" -v`
Expected: **5 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/starrocks.py tests/test_connectors_gov_r35.py
git commit -m "feat(conn): CONN-009 StarRocks auth/refused and columns limit r35"
```

---

### Task 3: GOV-008 — ACL execute 守卫与 preview-execute API

**Files:**
- Modify: `backend/app/governance/acl.py`
- Modify: `backend/app/governance/query_design/service.py`
- Modify: `backend/app/governance/query_design/schemas.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_connectors_gov_r35.py`（GOV-008 段 6 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `resolve_user_org_node_ids`, `get_query_rls_fragment`, `UserContext`, `GovAclError`
- Produces: `assert_query_design_execute(session, actor, *, data_source_id) -> str`；`preview_query_design_execute(...)`；`POST /api/v1/gov/query-design/preview-execute`

- [ ] **Step 1: 写失败测试（GOV-008 段 6 条）**

追加到 `tests/test_connectors_gov_r35.py`：

```python
def _valid_visual_query_design(ref_id: str | None = None) -> dict:
    rid = ref_id or str(uuid.uuid4())
    return {
        "schemaVersion": "1.0",
        "refType": "gov_query_design",
        "refId": rid,
        "title": "销售分析",
        "status": "draft",
        "conditions": {
            "schemaVersion": "1.0",
            "logic": "AND",
            "conditions": [
                {"fieldId": "order_amount", "operator": "gte", "value": 100, "valueType": "number"}
            ],
            "refType": "design_draft",
            "refId": rid,
        },
    }


def test_gov_preview_execute_viewer_forbidden_r35(client):
    """T-GOV-R35-008-01: viewer POST preview-execute → 403 GOV_ACL_FORBIDDEN。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-1", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "GOV_ACL_FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.resolve_user_org_node_ids", return_value=set())
def test_gov_preview_execute_designer_no_binding_r35(_mock_org, client):
    """T-GOV-R35-008-02: designer 无 org → 403 GOV_RLS_BINDING_REQUIRED。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="designer-1", username="designer", roles=["designer"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "GOV_RLS_BINDING_REQUIRED"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="t.org_node_id IN ('n1')")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_preview_execute_admin_ok_r35(_mock_org, _mock_rls, client):
    """T-GOV-R35-008-03: admin → 200 且 rlsFragment 非空。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 200
        assert resp.json()["rlsFragment"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="t.org_node_id IN ('n1')")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_preview_execute_admin_bypass_audit_r35(_mock_org, _mock_rls, client, caplog):
    """T-GOV-R35-008-04: admin bypass 触发 gov_acl_bypass 日志。"""
    import logging

    caplog.set_level(logging.INFO, logger="app.governance.acl")
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 200
        assert any("gov_acl_bypass" in r.message for r in caplog.records)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="1=0")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_preview_execute_empty_rls_chain_r35(_mock_org, _mock_rls, client):
    """T-GOV-R35-008-05: 空 RLS 链 → 200 且 rlsFragment == '1=0'。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 200
        assert resp.json()["rlsFragment"] == "1=0"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="1=1")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_save_then_preview_execute_r35(_mock_org, _mock_rls, client):
    """T-GOV-R35-008-06: save draft 后 preview-execute 联合 200。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        ref = str(uuid.uuid4())
        save = client.put(
            "/api/v1/gov/query-design", headers=AUTH, json=_valid_visual_query_design(ref)
        )
        assert save.status_code == 200
        preview = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert preview.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "preview_execute or save_then_preview" -v`
Expected: FAIL（404 路由不存在）

- [ ] **Step 3: 实现 acl + service + schemas + API**

`backend/app/governance/acl.py` 追加：

```python
import logging

logger = logging.getLogger(__name__)


def assert_query_design_execute(
    session: Session,
    actor: UserContext,
    *,
    data_source_id: uuid.UUID | None,
) -> str:
    if "admin" not in actor.roles and "designer" not in actor.roles:
        raise GovAclError("GOV_ACL_FORBIDDEN", "execute requires designer or admin", 403)
    if "admin" in actor.roles:
        logger.info(
            "gov_acl_bypass",
            extra={"actor_id": actor.id, "action": "execute", "data_source_id": str(data_source_id)},
        )
        return get_query_rls_fragment(session, actor)
    _assert_rls_binding(session, actor)
    return get_query_rls_fragment(session, actor)
```

`backend/app/governance/query_design/schemas.py` 追加：

```python
class PreviewExecuteIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID | None = Field(default=None, alias="dataSourceId")


class PreviewExecuteOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    rls_fragment: str = Field(alias="rlsFragment")
```

`backend/app/governance/query_design/service.py` 追加：

```python
from app.datasources import acl as datasource_acl
from app.datasources.acl import VisibilityError
from app.governance.query_design.schemas import PreviewExecuteOut


def preview_query_design_execute(
    session: Session,
    actor: UserContext,
    *,
    data_source_id: uuid.UUID | None,
) -> PreviewExecuteOut:
    try:
        fragment = gov_acl.assert_query_design_execute(
            session, actor, data_source_id=data_source_id
        )
    except gov_acl.GovAclError as exc:
        raise GovQueryDesignError(exc.code, exc.message, exc.status) from exc
    if data_source_id is not None:
        try:
            datasource_acl.assert_visible(session, list(actor.roles), data_source_id)
        except VisibilityError as exc:
            raise GovQueryDesignError(
                "GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE",
                str(exc),
                403,
            ) from exc
    return PreviewExecuteOut(rls_fragment=fragment)
```

`backend/app/api/v1/gov.py` 追加：

```python
from app.governance.query_design.schemas import PreviewExecuteIn, PreviewExecuteOut

@router.post("/query-design/preview-execute", response_model=PreviewExecuteOut)
def preview_execute_query_design(
    payload: PreviewExecuteIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> PreviewExecuteOut | JSONResponse:
    try:
        return query_design_service.preview_query_design_execute(
            db, actor, data_source_id=payload.data_source_id
        )
    except GovQueryDesignError as exc:
        return _gov_query_design_error(exc)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "preview_execute or save_then_preview" -v`
Expected: **6 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/acl.py backend/app/governance/query_design/service.py backend/app/governance/query_design/schemas.py backend/app/api/v1/gov.py tests/test_connectors_gov_r35.py
git commit -m "feat(gov): GOV-008 preview-execute ACL/RLS chain r35"
```

---

### Task 4: GOV-004 — query-design validate/save/get 边界与 computeRules

**Files:**
- Modify: `tests/test_connectors_gov_r35.py`（GOV-004 段 7 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `validate_visual_query_design`、`save_visual_query_design`、`get_visual_query_design`（r34 已实现）
- Produces: pytest 覆盖 `DESIGN_EMPTY_CONDITIONS`、`DESIGN_INVALID_AGGREGATE`、`GOV_QUERY_DESIGN_INVALID`、`GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE`、`GOV_QUERY_DESIGN_NOT_FOUND`、`CONFIG_VERSION_CONFLICT`、save+get round-trip

- [ ] **Step 1: 写失败测试（GOV-004 段 7 条）**

追加到 `tests/test_connectors_gov_r35.py`：

```python
def _valid_compute_rules_embedded(ref_id: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "rules": [
            {
                "id": "total_amount",
                "name": "合计",
                "ruleType": "sum",
                "targetField": "order_amount",
                "expression": "sum(order_amount)",
                "dependsOn": [],
            }
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }


def test_gov_validate_empty_conditions_r35(client):
    """T-GOV-R35-004-01: conditions:[] → 422 DESIGN_EMPTY_CONDITIONS + fields。"""
    body = _valid_visual_query_design()
    body["conditions"]["conditions"] = []
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_CONDITIONS"
    assert resp.json()["detail"]["fields"]


def test_gov_validate_invalid_aggregate_r35(client):
    """T-GOV-R35-004-02: computeRules median(x) → 422 DESIGN_INVALID_AGGREGATE。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    rules = _valid_compute_rules_embedded(ref)
    rules["rules"][0]["expression"] = "median(order_amount)"
    body["computeRules"] = rules
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"
    assert resp.json()["detail"]["fields"]


def test_gov_validate_blank_title_r35(client):
    """T-GOV-R35-004-03: blank title → 422 GOV_QUERY_DESIGN_INVALID。"""
    body = _valid_visual_query_design()
    body["title"] = "   "
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_QUERY_DESIGN_INVALID"
    assert resp.json()["detail"]["fields"][0]["field"] == "title"


def test_gov_validate_unknown_datasource_r35(client):
    """T-GOV-R35-004-04: 随机 dataSourceId → 422 GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE。"""
    body = _valid_visual_query_design()
    body["dataSourceId"] = str(uuid.uuid4())
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE"
    assert resp.json()["detail"]["fields"][0]["field"] == "dataSourceId"


def test_gov_get_not_found_r35(client):
    """T-GOV-R35-004-05: 随机 ref → 404 GOV_QUERY_DESIGN_NOT_FOUND。"""
    resp = client.get(
        "/api/v1/gov/query-design",
        headers=AUTH,
        params={"refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "GOV_QUERY_DESIGN_NOT_FOUND"


def test_gov_revision_conflict_r35(client):
    """T-GOV-R35-004-06: expectedRevision 冲突 → 409 CONFIG_VERSION_CONFLICT。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    first = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert first.status_code == 200
    body["expectedRevision"] = 0
    conflict = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "CONFIG_VERSION_CONFLICT"


def test_gov_save_get_roundtrip_r35(client):
    """T-GOV-R35-004-07: 合法 save + get revision 一致。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    save = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert save.status_code == 200
    rev = save.json()["revision"]
    got = client.get("/api/v1/gov/query-design", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200
    assert got.json()["revision"] == rev
```

- [ ] **Step 2: 运行测试确认失败（若有缺口）**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "gov_validate or gov_get or gov_revision or gov_save_get" -v`
Expected: 多数应 PASS（r34 已覆盖部分）；若 `DESIGN_EMPTY_CONDITIONS` 或 `computeRules` 路径失败则修复 service 透传

- [ ] **Step 3: 必要时加固 service.py 空 conditions 透传**

确认 `validate_visual_query_design` 在 `payload.conditions.conditions` 为空时 designer 抛出 `DESIGN_EMPTY_CONDITIONS` 且 `_wrap_designer_error` 保留 `fields`。若 `VisualQueryDesignIn.title` Pydantic `min_length=1` 拦截空格 title 导致非 `GOV_QUERY_DESIGN_INVALID`，在 service 入口保留 strip 检查（r34 已有）。**仅当测试失败时**修改 `service.py`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "gov_validate or gov_get or gov_revision or gov_save_get" -v`
Expected: **7 passed**

- [ ] **Step 5: Commit**

```bash
git add tests/test_connectors_gov_r35.py
git commit -m "test(gov): GOV-004 validate/save/get boundary coverage r35"
```

---

### Task 5: CONN-015 — Elasticsearch 连接、mapping 与字段 limit

**Files:**
- Modify: `backend/app/datasources/dialects/elasticsearch.py`
- Modify: `tests/test_connectors_gov_r35.py`（CONN-015 段 8 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `_build_client`, `Elasticsearch`
- Produces: `_normalize_es_type(es_type: str) -> str`；`ES_MAX_MAPPING_FIELDS = 500`；`list_columns` 归一化 BI 类型并 limit

- [ ] **Step 1: 写失败测试（CONN-015 段 8 条）**

追加到 `tests/test_connectors_gov_r35.py`：

```python
from app.datasources.dialects.elasticsearch import ElasticsearchConnector, _build_client


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_auth_failed_r35(mock_es_cls):
    """T-CONN-R35-015-01: mock 401 → ES_AUTH_FAILED。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.info.side_effect = Exception("authentication failed 401")
    result = ElasticsearchConnector().test_connection(
        host="127.0.0.1", port=9200, database="", username="u", password="p"
    )
    assert result.ok is False
    assert result.code == "ES_AUTH_FAILED"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_connection_refused_r35(mock_es_cls):
    """T-CONN-R35-015-02: connection refused → ES_CONNECTION_REFUSED。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.info.side_effect = Exception("Connection refused")
    result = ElasticsearchConnector().test_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    assert result.ok is False
    assert result.code == "ES_CONNECTION_REFUSED"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_timeout_r35(mock_es_cls):
    """T-CONN-R35-015-03: timeout → ES_TIMEOUT。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.info.side_effect = Exception("Connection timed out")
    result = ElasticsearchConnector().test_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    assert result.ok is False
    assert result.code == "ES_TIMEOUT"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_multi_index_schemas_r35(mock_es_cls):
    """T-CONN-R35-015-04: 多索引 list_schemas 含 2 个非系统 index。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.cat.indices.return_value = [
        {"index": "orders"},
        {"index": "events"},
        {"index": ".system"},
    ]
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    names = [s.name for s in ElasticsearchConnector().list_schemas(conn)]
    assert names == ["events", "orders"]


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_empty_mapping_columns_r35(mock_es_cls):
    """T-CONN-R35-015-05: 空 mapping → list_columns []。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": {}}}}
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    assert ElasticsearchConnector().list_columns(conn, "idx", "_doc") == []


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_type_normalization_r35(mock_es_cls):
    """T-CONN-R35-015-06: keyword/long → string/number。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.indices.get_mapping.return_value = {
        "idx": {"mappings": {"properties": {"status": {"type": "keyword"}, "amount": {"type": "long"}}}}
    }
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    cols = {c.name: c.data_type for c in ElasticsearchConnector().list_columns(conn, "idx", "_doc")}
    assert cols["status"] == "string"
    assert cols["amount"] == "number"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_columns_limit_r35(mock_es_cls):
    """T-CONN-R35-015-07: 600 fields → 返回 500。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    props = {f"f{i}": {"type": "keyword"} for i in range(600)}
    client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    cols = ElasticsearchConnector().list_columns(conn, "idx", "_doc")
    assert len(cols) == 500


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_https_port_443_r35(mock_es_cls):
    """T-CONN-R35-015-08: port 443 → hosts 含 https://。"""
    mock_es_cls.return_value = MagicMock()
    _build_client(host="es.example.com", port=443, username="", password="", timeout_sec=5.0)
    kwargs = mock_es_cls.call_args.kwargs
    assert kwargs["hosts"][0].startswith("https://")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "es_" -v`
Expected: FAIL（类型归一化、limit 未实现）

- [ ] **Step 3: 实现 elasticsearch.py 归一化与 limit**

在 `backend/app/datasources/dialects/elasticsearch.py` 增补：

```python
ES_MAX_MAPPING_FIELDS = 500

_ES_TYPE_MAP = {
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


def _normalize_es_type(es_type: str) -> str:
    return _ES_TYPE_MAP.get(es_type, "unknown")

# list_columns 替换：
def list_columns(self, connection: Elasticsearch, schema: str, table: str) -> list[ColumnInfo]:
    mapping = connection.indices.get_mapping(index=schema)
    props = mapping.get(schema, {}).get("mappings", {}).get("properties", {})
    columns = [
        ColumnInfo(
            name=name,
            data_type=_normalize_es_type(str(meta.get("type", "object"))),
            nullable=True,
        )
        for name, meta in sorted(props.items())
    ]
    if len(columns) > ES_MAX_MAPPING_FIELDS:
        return columns[:ES_MAX_MAPPING_FIELDS]
    return columns
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r35.py -k "es_" -v`
Expected: **8 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/elasticsearch.py tests/test_connectors_gov_r35.py
git commit -m "feat(conn): CONN-015 ES mapping normalization and field limit r35"
```

---

### Task 6: 集成回归 — r35 全量 + r34/r33 回归

**Files:**
- Modify: `tests/test_connectors_gov_r35.py`（T-REG-R35-001/002 回归桩）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 追加回归桩**

```python
def test_registry_core_types_r35():
    """T-REG-R35-001: mysql/postgresql/tidb/starrocks/elasticsearch 均在 catalog。"""
    types = {item["type"] for item in export_type_catalog()}
    assert {"mysql", "postgresql", "tidb", "starrocks", "elasticsearch"}.issubset(types)


def test_meta_design_r33_regression_r35():
    """T-REG-R35-002: r33 套件可导入（完整回归在本 Task）。"""
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "test_meta_design_r33",
        Path(__file__).resolve().parent / "test_meta_design_r33.py",
    )
    assert spec is not None and spec.loader is not None
    r33 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r33)
    assert hasattr(r33, "test_design_invalid_aggregate_r33")
```

- [ ] **Step 2: ruff + 全量回归**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py tests/test_meta_design_r33.py -v`
Expected: r35 **≥33 passed**（7+5+6+7+8+2）；r34 **15 passed**；r33 **19 passed**；总计 **≥760 passed** + 4 skipped（全量 `pytest` 时）

- [ ] **Step 3: 修复任何失败直至全绿**

- [ ] **Step 4: Commit**

```bash
git add tests/test_connectors_gov_r35.py
git commit -m "test: r35 integration regression r34+r33"
```

---

### Task 7: 文档同步 — datasources/governance/api

**Files:**
- Modify: `docs/services/datasources.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域:** `docs/**` — P3 动态匹配 `docs-layer.mdc`、`prd-sync.mdc`

- [ ] **Step 1: 更新 datasources.md §r35**

在 `docs/services/datasources.md` 追加小节：

```markdown
### r35 companion 质量推分（CONN-021/009/015）

- **TiDB**：`test_connection` 返回 `TIDB_TIMEOUT`/`TIDB_CONN_REFUSED`/`TIDB_AUTH_FAILED`/`TIDB_UNKNOWN_DATABASE`；空库 `list_schemas` 与未知表 `list_columns` 返回 `[]`
- **StarRocks**：补全 `STARROCKS_CONN_REFUSED`/`STARROCKS_AUTH_FAILED` pytest；`list_tables(schema="")` 返回 `[]`；`list_columns` 宽表切片 `STARROCKS_MAX_COLUMNS=500`
- **Elasticsearch**：`ES_AUTH_FAILED`/`ES_CONNECTION_REFUSED`/`ES_TIMEOUT`；`list_schemas` 多索引过滤 `.` 前缀；`_normalize_es_type` 映射 BI 类型；`ES_MAX_MAPPING_FIELDS=500`；port 443 使用 https
```

- [ ] **Step 2: 更新 governance.md §r35**

```markdown
### r35 companion 质量推分（GOV-004/008）

- **GOV-008**：`assert_query_design_execute` + `POST /api/v1/gov/query-design/preview-execute`；viewer 403 `GOV_ACL_FORBIDDEN`；designer 无 org 403 `GOV_RLS_BINDING_REQUIRED`；admin bypass 审计日志 `gov_acl_bypass`；空 RLS 链返回 `rlsFragment: "1=0"`
- **GOV-004**：gov validate 覆盖 `DESIGN_EMPTY_CONDITIONS`、`DESIGN_INVALID_AGGREGATE`（computeRules）、`GOV_QUERY_DESIGN_INVALID`、`GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE`、`GOV_QUERY_DESIGN_NOT_FOUND`、`CONFIG_VERSION_CONFLICT` 均含 `detail.fields`（适用时）
```

- [ ] **Step 3: 登记 API 路由**

在 `docs/api/README.md` 治理段追加一行：

```markdown
| POST | `/api/v1/gov/query-design/preview-execute` | 查询设计执行预览（RLS fragment；GOV-008） | 内部 | 一期 | GOV-008 | 已实现 | `backend/app/api/v1/gov.py` |
```

- [ ] **Step 4: 验证无代码回归**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r35.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/services/datasources.md docs/services/governance.md docs/api/README.md
git commit -m "docs: r35 CONN/GOV companion quality sync"
```

---

## Self-Review（P2 完成核对）

| 检查项 | 状态 |
|--------|------|
| CONN-021/009/015 + GOV-004/008 各有 Task | Task 1–5 |
| 无 TBD/TODO 占位 | ✓ |
| 每 Task 有验证命令 | ✓ |
| 全 Task UI skill: none | ✓ |
| 文件数 13 ≤ 20 | ✓ |
| 新测 ≥18（合计 33） | ✓ |
| subagent-driven-development option 1 | 头部已声明 |
