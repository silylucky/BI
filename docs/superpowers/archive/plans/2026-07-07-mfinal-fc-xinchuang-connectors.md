# M-FINAL · F-C 批次 1 — 信创连接器 companion 收官 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/dm.py`、`backend/app/datasources/dialects/kingbase/connector.py`、`backend/app/datasources/dialects/gbase.py`、`backend/app/datasources/dialects/oceanbase.py`、`backend/app/datasources/dialects/tidb.py`、`tests/test_mfinal_fc_r242.py`（新建）、`fe/src/pages/admin/datasources/DatasourceFormPage.tsx`、`fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`（新建）、`docs/api/README.md`、`docs/services/datasources.md`
> **子项：** CONN-017、CONN-018、CONN-019、CONN-020、CONN-021
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端/测试任务预指定 fastapi + TDD；UI 任务预指定 b-design-system-tailadmin-radix）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`；`fe-ui.mdc` 匹配 `fe/**`）

**Goal:** 为达梦/金仓/GBase/OceanBase/TiDB 五型信创连接器补齐 `probe_readonly_sql`、集成测套件、Admin 数据源表单字段 hints 与 smoke，使浏览器可选验收与只读探针 pytest 可勾选。

**Architecture:** 对齐 r235 TimescaleDB companion 范式——方言级 `probe_readonly_sql`（不触 `query/dialects`）；`test_mfinal_fc_r242.py` 复用 module 级 sqlite meta env；FE 仅扩展 `CONNECTOR_FIELD_HINTS` 常量 + OceanBase 辅助文案；compose 真机用 `pytest.skip` 占位。

**Tech Stack:** Python 3.12 + FastAPI + pytest + unittest.mock；React 18 + TypeScript + vitest + RTL + Radix Select；pnpm workspace。

## Global Constraints

- 不修改 `query/dialects`、`ingestion/`、`auth/` 或新增 HTTP 路由
- 不引入新第三方依赖
- 单 Python 业务文件 ≤ 200 行；单 FE 文件 ≤ 300 行（`common.mdc`）
- `probe_readonly_sql` 内不吞异常；成功路径返回 `True`
- HTTP test/create 响应 JSON 不得含 `password` 明文
- compose 信创库无标准端口：live 用例必须 `pytest.skip("xinchuang DB not in compose")`，禁止 CI 红
- 提交信息格式：`feat: <动词> <主体>`
- 文档同步：`docs/api/README.md` 一行锚点 + `docs/services/datasources.md` companion r242 状态（`prd-sync.mdc`）
- PRD 分片 `docs/automate/prd/F04-CONN.md` 勾选留给 P5，P3 不改

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `backend/app/datasources/dialects/dm.py` | **修改** | `DmConnector.probe_readonly_sql` — `SELECT 1 FROM DUAL` |
| `backend/app/datasources/dialects/kingbase/connector.py` | **修改** | `KingbaseConnector.probe_readonly_sql` — psycopg `execute` |
| `backend/app/datasources/dialects/gbase.py` | **修改** | `GbaseConnector.probe_readonly_sql` — pymysql cursor |
| `backend/app/datasources/dialects/oceanbase.py` | **修改** | `OceanbaseConnector.probe_readonly_sql` — pymysql cursor |
| `backend/app/datasources/dialects/tidb.py` | **修改** | `TidbConnector.probe_readonly_sql` — pymysql cursor |
| `tests/test_mfinal_fc_r242.py` | **新建** | ≥25 集成用例：types + probe + readonly-guard + HTTP 无密码 |
| `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | **修改** | 五型 `CONNECTOR_FIELD_HINTS` + OceanBase 辅助文案 |
| `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | **新建** | T-CONN-R242-FE-01~04 |
| `docs/api/README.md` | **修改** | 五型 FE 可选 + probe 锚点 |
| `docs/services/datasources.md` | **修改** | companion r242 probe 登记 |

---

### Task 1: 测试脚手架 + CONN-017 达梦 DM `probe_readonly_sql`

**Files:**
- Create: `tests/test_mfinal_fc_r242.py`
- Modify: `backend/app/datasources/dialects/dm.py`

**Interfaces:**
- Produces: `DmConnector.probe_readonly_sql(connection) -> bool`
- Produces: `r242_sqlite_env` module fixture、`client` fixture
- Produces: tests `test_conn_r242_017_01` ~ `test_conn_r242_017_04`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 新建 `tests/test_mfinal_fc_r242.py` 脚手架**

```python
"""M-FINAL F-C 批次 1 r242 — CONN-017~021 信创连接器 companion。"""
from __future__ import annotations

import json
import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources.dialects.dm import DmConnector
from app.datasources.registry import export_type_catalog
from app.main import app

AUTH = jwt_auth_headers()
_R242_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fc_r242?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r242_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R242_SQLITE_URL
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


def test_conn_r242_scaffold_imports():
  """Scaffold: module loads."""
  assert app is not None


# --- CONN-017 DM ---


def test_conn_r242_017_01_types_catalog_dm():
    """T-CONN-R242-017-01: export_type_catalog 含 dm，displayName 含达梦，category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "dm" in types
    assert "达梦" in types["dm"]["displayName"]
    assert types["dm"]["category"] == "relational"


def test_conn_r242_017_02_probe_readonly_sql():
    """T-CONN-R242-017-02: mock dmPython cursor → probe_readonly_sql True；execute SELECT 1 FROM DUAL。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert DmConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1 FROM DUAL")


@patch("dmPython.connect")
def test_conn_r242_017_03_http_test_no_password(mock_connect, client):
    """T-CONN-R242-017-03: POST /datasources/test type=dm mock 失败 → 响应无 password。"""
    mock_connect.side_effect = Exception("Login failed secret_token_xyz")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "dm",
            "name": "dm-r242",
            "code": f"dm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5236,
            "database": "DAMENG",
            "username": "u",
            "password": "secret_token_xyz",
        },
    )
    assert resp.status_code == 200
    assert "secret_token_xyz" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


def test_conn_r242_017_04_readonly_guard_dm(client):
    """T-CONN-R242-017-04: readonly-guard connectorType=dm sql=SELECT 1 → 200 ok mode=sql。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "dm", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["mode"] == "sql"
```

- [ ] **Step 2: 运行 DM 测试（预期 FAIL — probe 未实现）**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py::test_conn_r242_017_02_probe_readonly_sql -v`
Expected: FAIL with `AttributeError: 'DmConnector' object has no attribute 'probe_readonly_sql'`

- [ ] **Step 3: 实现 `DmConnector.probe_readonly_sql`**

在 `backend/app/datasources/dialects/dm.py` 的 `DmConnector` 类末尾（`list_columns` 之后）添加：

```python
    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        cursor = connection.cursor()
        cursor.execute("SELECT 1 FROM DUAL")
        return True
```

- [ ] **Step 4: 运行 CONN-017 全套测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py -k "017 or scaffold" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/dm.py tests/test_mfinal_fc_r242.py
git commit -m "feat: add DM probe_readonly_sql and r242 test scaffold"
```

---

### Task 2: CONN-018 人大金仓 `probe_readonly_sql` + 集成测

**Files:**
- Modify: `backend/app/datasources/dialects/kingbase/connector.py`
- Modify: `tests/test_mfinal_fc_r242.py`（追加 kingbase 段）

**Interfaces:**
- Produces: `KingbaseConnector.probe_readonly_sql(connection) -> bool`
- Produces: tests `test_conn_r242_018_01` ~ `test_conn_r242_018_04`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 kingbase 测试到 `test_mfinal_fc_r242.py`**

在文件 import 区追加：

```python
from app.datasources.dialects.kingbase.connector import KingbaseConnector
```

在 DM 段之后追加：

```python
# --- CONN-018 Kingbase ---


def test_conn_r242_018_01_types_catalog_kingbase():
    """T-CONN-R242-018-01: types 含 kingbase relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "kingbase" in types
    assert types["kingbase"]["category"] == "relational"
    assert "金仓" in types["kingbase"]["displayName"] or "Kingbase" in types["kingbase"]["displayName"]


def test_conn_r242_018_02_probe_readonly_sql():
    """T-CONN-R242-018-02: mock psycopg 连接 probe_readonly_sql True。"""
    conn = MagicMock()
    assert KingbaseConnector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once_with("SELECT 1")


def test_conn_r242_018_03_http_missing_host_422(client):
    """T-CONN-R242-018-03: 缺 host → 422 KINGBASE_INVALID_PARAMS（r67 回归）。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "kingbase",
            "name": "kb-r242",
            "code": f"kb-{uuid.uuid4().hex[:8]}",
            "host": "",
            "port": 54321,
            "database": "db",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "KINGBASE_INVALID_PARAMS"


def test_conn_r242_018_04_readonly_guard_kingbase(client):
    """T-CONN-R242-018-04: readonly-guard kingbase + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "kingbase", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
```

- [ ] **Step 2: 运行 kingbase probe 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py::test_conn_r242_018_02_probe_readonly_sql -v`
Expected: FAIL `AttributeError`

- [ ] **Step 3: 实现 `KingbaseConnector.probe_readonly_sql`**

在 `backend/app/datasources/dialects/kingbase/connector.py` 的 `KingbaseConnector` 类末尾添加：

```python
    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        connection.execute("SELECT 1")
        return True
```

- [ ] **Step 4: 运行 CONN-018 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py -k "018" -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/kingbase/connector.py tests/test_mfinal_fc_r242.py
git commit -m "feat: add Kingbase probe_readonly_sql and r242 integration tests"
```

---

### Task 3: CONN-019 南大通用 GBase `probe_readonly_sql` + 集成测

**Files:**
- Modify: `backend/app/datasources/dialects/gbase.py`
- Modify: `tests/test_mfinal_fc_r242.py`（追加 gbase 段）

**Interfaces:**
- Produces: `GbaseConnector.probe_readonly_sql(connection) -> bool`
- Produces: tests `test_conn_r242_019_01` ~ `test_conn_r242_019_04`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 gbase 测试**

import 追加：

```python
import pymysql
from app.datasources.dialects.gbase import GbaseConnector
```

测试段：

```python
# --- CONN-019 GBase ---


def test_conn_r242_019_01_types_catalog_gbase():
    """T-CONN-R242-019-01: types 含 gbase relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "gbase" in types
    assert types["gbase"]["category"] == "relational"


def test_conn_r242_019_02_probe_readonly_sql():
    """T-CONN-R242-019-02: mock pymysql cursor probe_readonly_sql True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert GbaseConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1")


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r242_019_03_http_test_no_password(mock_connect, client):
    """T-CONN-R242-019-03: HTTP test gbase mock 失败无 password。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "gbase",
            "name": "gb-r242",
            "code": f"gb-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5258,
            "database": "test",
            "username": "u",
            "password": "gbase_secret",
        },
    )
    assert resp.status_code == 200
    assert "gbase_secret" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


def test_conn_r242_019_04_readonly_guard_gbase(client):
    """T-CONN-R242-019-04: readonly-guard gbase + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "gbase", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
```

- [ ] **Step 2: 运行 probe 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py::test_conn_r242_019_02_probe_readonly_sql -v`
Expected: FAIL `AttributeError`

- [ ] **Step 3: 实现 `GbaseConnector.probe_readonly_sql`**

在 `backend/app/datasources/dialects/gbase.py` 类末尾添加：

```python
    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        return True
```

- [ ] **Step 4: 运行 CONN-019 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py -k "019" -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/gbase.py tests/test_mfinal_fc_r242.py
git commit -m "feat: add GBase probe_readonly_sql and r242 integration tests"
```

---

### Task 4: CONN-020 OceanBase `probe_readonly_sql` + 集成测

**Files:**
- Modify: `backend/app/datasources/dialects/oceanbase.py`
- Modify: `tests/test_mfinal_fc_r242.py`（追加 oceanbase 段）

**Interfaces:**
- Produces: `OceanbaseConnector.probe_readonly_sql(connection) -> bool`
- Produces: tests `test_conn_r242_020_01` ~ `test_conn_r242_020_05`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 oceanbase 测试**

import 追加：

```python
from app.datasources.dialects.oceanbase import OceanbaseConnector, probe_test_connection_budget_ms
```

测试段：

```python
# --- CONN-020 OceanBase ---


def test_conn_r242_020_01_types_catalog_oceanbase():
    """T-CONN-R242-020-01: types 含 oceanbase relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "oceanbase" in types
    assert types["oceanbase"]["category"] == "relational"


def test_conn_r242_020_02_probe_readonly_sql():
    """T-CONN-R242-020-02: mock pymysql cursor probe_readonly_sql True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert OceanbaseConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1")


@patch.object(OceanbaseConnector, "list_schemas", return_value=[])
def test_conn_r242_020_03_empty_schema_regression(_mock_list):
    """T-CONN-R242-020-03: 空 schema 回归 r55 → []。"""
    assert OceanbaseConnector().list_schemas(MagicMock()) == []


def test_conn_r242_020_04_readonly_guard_oceanbase(client):
    """T-CONN-R242-020-04: readonly-guard oceanbase + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "oceanbase", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_conn_r242_020_05_probe_budget_constant_exists():
    """T-CONN-R242-020-05: probe_test_connection_budget_ms 常量存在（r55 回归）。"""
    assert probe_test_connection_budget_ms == 100
```

- [ ] **Step 2: 运行 probe 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py::test_conn_r242_020_02_probe_readonly_sql -v`
Expected: FAIL `AttributeError`

- [ ] **Step 3: 实现 `OceanbaseConnector.probe_readonly_sql`**

在 `backend/app/datasources/dialects/oceanbase.py` 类末尾添加：

```python
    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        return True
```

- [ ] **Step 4: 运行 CONN-020 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py -k "020" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/oceanbase.py tests/test_mfinal_fc_r242.py
git commit -m "feat: add OceanBase probe_readonly_sql and r242 integration tests"
```

---

### Task 5: CONN-021 TiDB `probe_readonly_sql` + 集成测 + compose skip 占位

**Files:**
- Modify: `backend/app/datasources/dialects/tidb.py`
- Modify: `tests/test_mfinal_fc_r242.py`（追加 tidb 段 + 五型 compose skip）

**Interfaces:**
- Produces: `TidbConnector.probe_readonly_sql(connection) -> bool`
- Produces: tests `test_conn_r242_021_01` ~ `test_conn_r242_021_05` + 五型 optional live skip

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 tidb 测试**

import 追加：

```python
from app.datasources.dialects.tidb import TidbConnector
```

测试段：

```python
# --- CONN-021 TiDB ---


def test_conn_r242_021_01_types_catalog_tidb_distinct_from_mysql():
    """T-CONN-R242-021-01: types 含独立 tidb（非 mysql）。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tidb" in types
    assert "mysql" in types
    assert types["tidb"]["type"] == "tidb"
    assert types["tidb"]["category"] == "relational"


def test_conn_r242_021_02_probe_readonly_sql():
    """T-CONN-R242-021-02: mock pymysql cursor probe_readonly_sql True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert TidbConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1")


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r242_021_03_tidb_auth_failed_regression(mock_connect):
    """T-CONN-R242-021-03: mock 1045 → TIDB_AUTH_FAILED（r35 回归）。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TIDB_AUTH_FAILED"


def test_conn_r242_021_04_readonly_guard_tidb(client):
    """T-CONN-R242-021-04: readonly-guard tidb + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "tidb", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.integration
def test_conn_r242_021_05_optional_compose_live():
    """T-CONN-R242-021-05: 信创 TiDB 无 compose 镜像 → skip。"""
    pytest.skip("xinchuang DB not in compose")


# --- 五型 compose skip 占位 ---


@pytest.mark.parametrize(
    "connector_type",
    ["dm", "kingbase", "gbase", "oceanbase", "tidb"],
)
@pytest.mark.integration
def test_conn_r242_optional_xinchuang_compose_live(connector_type: str):
    """每型 1 条 live 占位：无信创 compose 环境一律 skip。"""
    pytest.skip("xinchuang DB not in compose")
```

- [ ] **Step 2: 运行 probe 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py::test_conn_r242_021_02_probe_readonly_sql -v`
Expected: FAIL `AttributeError`

- [ ] **Step 3: 实现 `TidbConnector.probe_readonly_sql`**

在 `backend/app/datasources/dialects/tidb.py` 类末尾添加：

```python
    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        return True
```

- [ ] **Step 4: 运行完整 r242 套件**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py -v --tb=short 2>&1 | tail -5`
Expected: ≥25 passed, ≥6 skipped（compose 占位）, 0 failed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/tidb.py tests/test_mfinal_fc_r242.py
git commit -m "feat: add TiDB probe_readonly_sql and complete r242 integration suite"
```

---

### Task 6: FE `DatasourceFormPage` 五型 hints + OceanBase 辅助文案

**Files:**
- Modify: `fe/src/pages/admin/datasources/DatasourceFormPage.tsx`

**Interfaces:**
- Produces: `CONNECTOR_FIELD_HINTS` 含 `dm`/`kingbase`/`gbase`/`oceanbase`/`tidb`
- Produces: `form.type === "oceanbase"` 时辅助文案行

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `AdminPageShell`、`Card`、`Input`、`Select`、`Label`；辅助文案 `text-theme-sm text-gray-500 dark:text-gray-400`
- desktop 与 mobile 字段无横向溢出；`max-w-2xl` 居中不变
- 类型切换时 port 随 hints 重置；OceanBase 辅助文案仅 oceanbase 类型显示
- hover/focus 保留 Radix 默认 ring；提交中「保存中…」disabled 不变
- `pnpm run check:design` 无新增 hex 硬编码

- [ ] **Step 1: 扩展 `CONNECTOR_FIELD_HINTS`**

将 `CONNECTOR_FIELD_HINTS` 对象替换为：

```typescript
const CONNECTOR_FIELD_HINTS: Record<string, { port: string; databaseLabel: string; usernameLabel: string }> = {
  mongodb: { port: "27017", databaseLabel: "认证库", usernameLabel: "用户名" },
  elasticsearch: { port: "9200", databaseLabel: "默认索引（可选）", usernameLabel: "用户名" },
  opensearch: { port: "9200", databaseLabel: "默认索引（可选）", usernameLabel: "用户名" },
  dm: { port: "5236", databaseLabel: "库/模式（OWNER）", usernameLabel: "用户名" },
  kingbase: { port: "54321", databaseLabel: "数据库", usernameLabel: "用户名" },
  gbase: { port: "5258", databaseLabel: "数据库", usernameLabel: "用户名" },
  oceanbase: { port: "2881", databaseLabel: "租户/数据库", usernameLabel: "用户名" },
  tidb: { port: "4000", databaseLabel: "数据库", usernameLabel: "用户名" },
};
```

- [ ] **Step 2: 在类型 Select 下方添加 OceanBase 辅助文案**

在 `</Select>` 闭合标签之后、`</div>`（类型字段 grid）之前插入：

```tsx
              {form.type === "oceanbase" ? (
                <p
                  id="oceanbase-hint"
                  className="text-theme-sm text-gray-500 dark:text-gray-400"
                >
                  使用 MySQL 兼容协议连接；集群部署请填写 OBProxy 主机与租户名。
                </p>
              ) : null}
```

- [ ] **Step 3: 为 database Input 挂 `aria-describedby`（仅 oceanbase）**

将 database 字段的 `Input` 改为：

```tsx
              <Input
                id="database"
                value={form.database}
                onChange={(e) => setField("database", e.target.value)}
                required
                aria-describedby={form.type === "oceanbase" ? "oceanbase-hint" : undefined}
              />
```

- [ ] **Step 4: 设计 drift 检查**

Run: `cd fe && pnpm run check:design 2>&1 | tail -3`
Expected: PASS，无新增违规

- [ ] **Step 5: Commit**

```bash
git add fe/src/pages/admin/datasources/DatasourceFormPage.tsx
git commit -m "feat: add xinchuang connector field hints to datasource form"
```

---

### Task 7: FE smoke `datasource-form.smoke.test.tsx`

**Files:**
- Create: `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`

**Interfaces:**
- Consumes: `DatasourceFormPage` from `./DatasourceFormPage`
- Produces: T-CONN-R242-FE-01~04 四条 smoke

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- mock types API 含五型 + mysql；Select 渲染 displayName
- 选 tidb → port `4000`；选 dm → database label 含 OWNER；选 oceanbase → 辅助文案可见
- vitest + RTL；无 E2E 浏览器
- `pnpm vitest run datasource-form.smoke` 全绿

- [ ] **Step 1: 新建 smoke 测试文件**

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { DatasourceFormPage } from "./DatasourceFormPage";

const MOCK_TYPES = {
  items: [
    { type: "mysql", displayName: "MySQL" },
    { type: "dm", displayName: "达梦 DM" },
    { type: "kingbase", displayName: "人大金仓 KingbaseES" },
    { type: "gbase", displayName: "南大通用 GBase" },
    { type: "oceanbase", displayName: "OceanBase" },
    { type: "tidb", displayName: "TiDB" },
  ],
};

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/datasources/new"]}>
        <Routes>
          <Route path="/admin/datasources/new" element={<DatasourceFormPage mode="create" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function selectType(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("DatasourceFormPage xinchuang smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources/types") return MOCK_TYPES;
      throw new Error(`unexpected path ${path}`);
    });
  });
  afterEach(() => cleanup());

  it("T-CONN-R242-FE-01: renders five xinchuang types plus mysql", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/datasources/types"));
    await selectType("达梦 DM");
    expect(screen.getByText("达梦 DM")).toBeInTheDocument();
  });

  it("T-CONN-R242-FE-02: selecting tidb sets port 4000", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("TiDB");
    expect(screen.getByLabelText("端口")).toHaveValue(4000);
  });

  it("T-CONN-R242-FE-03: selecting dm shows OWNER database label", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("达梦 DM");
    expect(screen.getByLabelText(/OWNER/)).toBeInTheDocument();
  });

  it("T-CONN-R242-FE-04: selecting oceanbase shows compatibility hint", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("OceanBase");
    expect(
      screen.getByText(/使用 MySQL 兼容协议连接/),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行 smoke（预期 FAIL 若 Task 6 未完成）**

Run: `cd fe && pnpm vitest run src/pages/admin/datasources/datasource-form.smoke.test.tsx`
Expected: 4 passed

- [ ] **Step 3: Commit**

```bash
git add fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx
git commit -m "test: add datasource form xinchuang connector smoke tests"
```

---

### Task 8: 文档同步 + 全量回归闸门

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: 更新 `docs/api/README.md`**

在「方言实现」段落（含 `gbase`/`kingbase` 行附近）追加一行：

```markdown
**信创 companion r242（CONN-017~021）**：`dm`/`kingbase`/`gbase`/`oceanbase`/`tidb` — Admin `DatasourceFormPage` 可选五型 + `probe_readonly_sql` 只读探针；集成测 `tests/test_mfinal_fc_r242.py`。
```

- [ ] **Step 2: 更新 `docs/services/datasources.md`**

在五型方言表各行 companion 状态后补充 r242 登记。在 CONN-017~021 对应行追加 probe 说明，并在文件末尾「Companion 登记」区追加：

```markdown
- **r242 companion（CONN-017~021）**：五型 `probe_readonly_sql`（DM `SELECT 1 FROM DUAL`；Kingbase psycopg `SELECT 1`；GBase/OceanBase/TiDB pymysql `SELECT 1`）；FE `CONNECTOR_FIELD_HINTS` 默认端口 5236/54321/5258/2881/4000；集成测 `tests/test_mfinal_fc_r242.py` ≥25 断言
```

- [ ] **Step 3: 后端回归闸门**

Run: `cd backend && ruff check backend tests && python -m pytest tests/test_mfinal_fc_r242.py tests/test_query_meta_conn_r38.py tests/test_meta_cat_dash_conn_design_r59.py tests/test_nfr_gov_conn_r46.py tests/test_rpt_gov_meta_conn_r55.py tests/test_connectors_gov_r34.py -q --tb=no 2>&1 | tail -3`
Expected: all passed（r242 skipped 计入 skip）

- [ ] **Step 4: 前端全量验证**

Run: `cd fe && pnpm run check:design && pnpm vitest run && pnpm run build 2>&1 | tail -5`
Expected: check:design PASS；vitest 全绿（含新 smoke）；build exit 0

- [ ] **Step 5: Commit**

```bash
git add docs/api/README.md docs/services/datasources.md
git commit -m "docs: sync xinchuang connector companion r242 anchors"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| CONN-017~021 各 design 子项有对应 Task | Task 1~5 后端 + Task 6~7 FE |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 有验证命令 | 通过 |
| FE Task 含 UI skill + UI Acceptance | Task 6~7 |
| 预估文件数 ≤20 | 10 路径（5 修改 dialect + 1 新建 test + 2 FE + 2 docs） |
| 不触 query/dialects / ingestion | 通过 |
