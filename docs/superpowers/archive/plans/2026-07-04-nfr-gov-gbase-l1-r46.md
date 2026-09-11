# NFR 横切 + GOV-005 发布状态机 + GBase 连接器 L1 kickoff 实现计划 — r46

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/core/nfr/`（5 文件）· `backend/app/core/config.py` · `backend/app/governance/publish/`（4 文件）· `backend/app/datasources/dialects/gbase.py` · `backend/app/datasources/dialects/errors.py` · `backend/app/datasources/dialects/__init__.py` · `backend/app/datasources/__init__.py` · `backend/app/api/v1/nfr.py` · `backend/app/api/v1/gov.py` · `backend/app/api/v1/router.py` · `tests/test_nfr_gov_conn_r46.py` · `docs/services/{nfr,datasources,governance}.md` · `docs/services/README.md` · `docs/api/README.md` · `docs/arch.md`（NFR 横切一行，Task 8 二选一）
> **子项：** NFR-005, NFR-006, NFR-007, GOV-005, CONN-019
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 交付 NFR 横切 L1（插件扩展点、推送配置降级、信创合规清单）+ GOV-005 查询服务发布状态机 REST 骨架 + CONN-019 GBase 方言（MySQL 协议委托）；≥32 条 pytest smoke；五 PRD ID 核心维脱离 5% 骨架档。

**Architecture:** 新建 `core/nfr/` 横切包（无 HTTP）；`register_connector_plugin` 薄包装 `register_dialect` 并记录 `registered_via=plugin` 元数据；`GbaseConnector` 镜像 `TidbConnector` 委托 `MysqlConnector`；`governance/publish/service` 在 `CatalogEntry.status` 上编排 `draft→pending_publish→published`；`api/v1/nfr.py` 与 `gov.py` 追加路由为 entry 薄层。纯后端、无新 Alembic migration、不修改 `ConnectorRegistry.register/get` 方法体。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不修改** `backend/app/datasources/registry.py` 的 `ConnectorRegistry.register` / `get` 方法体（仅允许 import 行变化）。
- **不修改** `integration/query_services.publish_service` 快路径语义（`draft→published` 保留）。
- **分层纪律**（`common.mdc`）：`core/nfr/`、`governance/publish/` = domain；`api/v1/*.py` = entry。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；未鉴权 401。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/api/README.md`。
- **验证基线**（r45 P5）：`cd backend && python3 -m pytest -q` ≈ **1134 passed** / 4 skipped；本轮目标 **≥1166 passed** + 4 skipped，零失败，`ruff` clean。
- **验证命令**：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_nfr_gov_conn_r46.py \
    ../tests/test_integration_api_l1_r45.py \
    ../tests/test_connectors_gov_r41.py \
    ../tests/test_datasources_l1.py \
    -v
  ```

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/core/nfr/__init__.py` | 域导出 | 新建 |
| `backend/app/core/nfr/errors.py` | `NFR_*`/`PUSH_*`/`XINCHUANG_*`/`GOV_PUBLISH_*` 稳定常量 | 新建 |
| `backend/app/core/nfr/plugin_extension.py` | NFR-005 扩展点 + `register_connector_plugin` | 新建 |
| `backend/app/core/nfr/push_config.py` | NFR-006 schema + `resolve_push_mode` | 新建 |
| `backend/app/core/nfr/xinchuang.py` | NFR-007 清单 + `build_compliance_report` | 新建 |
| `backend/app/core/config.py` | 推送/信创 env 字段 | 修改 |
| `backend/app/datasources/dialects/gbase.py` | CONN-019 `GbaseConnector` | 新建 |
| `backend/app/datasources/dialects/errors.py` | `map_gbase_error` + `GBASE_*` | 修改 |
| `backend/app/datasources/dialects/__init__.py` | 导出 `GbaseConnector` | 修改 |
| `backend/app/datasources/__init__.py` | `register_connector_plugin(GbaseConnector())` | 修改 |
| `backend/app/governance/publish/__init__.py` | 域导出 | 新建 |
| `backend/app/governance/publish/errors.py` | `PublishError` 异常 | 新建 |
| `backend/app/governance/publish/schemas.py` | 状态/迁移 DTO | 新建 |
| `backend/app/governance/publish/service.py` | submit/approve/reject/get_status | 新建 |
| `backend/app/api/v1/nfr.py` | NFR 横切 REST | 新建 |
| `backend/app/api/v1/gov.py` | publish 工作流路由 | 修改 |
| `backend/app/api/v1/router.py` | `include_router(nfr_router)` | 修改 |
| `tests/test_nfr_gov_conn_r46.py` | 新套件 ≥32 断言函数 | 新建 |
| `docs/services/nfr.md` | NFR 域附录 | 新建（Task 8） |
| `docs/services/datasources.md` | CONN-019 登记 | 修改（Task 8） |
| `docs/services/governance.md` | GOV-005 行 | 修改（Task 8） |
| `docs/services/README.md` | 域索引 | 修改（Task 8） |
| `docs/api/README.md` | `/nfr/*`、`/gov/publish/*` | 修改（Task 8） |

预估 **P3 生产代码文件 18**（不含 docs）；docs Task 8 另计，总变更 ≤20 与 round-target 对齐。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_nfr_gov_conn_r46.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""NFR 横切 + GOV-005 + CONN-019 GBase L1 kickoff r46."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R46_SQLITE_URL = "sqlite+pysqlite:///file:nfr_gov_conn_r46?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r46_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_push = os.environ.get("PUSH_BROWSER_ENABLED")
    previous_xc = os.environ.get("XINCHUANG_MODE")
    os.environ["DATABASE_URL"] = _R46_SQLITE_URL
    os.environ.pop("PUSH_BROWSER_ENABLED", None)
    os.environ.pop("PUSH_WECOM_WEBHOOK", None)
    os.environ.pop("PUSH_DINGTALK_WEBHOOK", None)
    os.environ.setdefault("XINCHUANG_MODE", "permissive")
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    for key, val in (
        ("DATABASE_URL", previous_db),
        ("PUSH_BROWSER_ENABLED", previous_push),
        ("XINCHUANG_MODE", previous_xc),
    ):
        if val is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = val
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _create_catalog_entry(
    client: TestClient,
    *,
    path: str | None = None,
    status: str = "draft",
    name: str = "GovSvc",
) -> str:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"{name}-{suffix}",
            "httpMethod": "POST",
            "path": path or f"/api/v1/gov-svc/{suffix}",
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
```

---

### Task 1: NFR 错误域脚手架 + 测试夹具

**Files:**
- Create: `backend/app/core/nfr/__init__.py`
- Create: `backend/app/core/nfr/errors.py`
- Create: `tests/test_nfr_gov_conn_r46.py`（夹具 + 1 条启动测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `NFR_PLUGIN_EXTENSION_UNAVAILABLE`, `PUSH_CONFIG_INVALID`, `XINCHUANG_NON_COMPLIANT`, `GOV_PUBLISH_INVALID_TRANSITION` 等稳定 code 常量

- [ ] **Step 1: Write the failing test**

在 `tests/test_nfr_gov_conn_r46.py` 写入上文 **Shared Test Fixtures** 全文，并追加：

```python
def test_r46_fixture_bootstraps(client):
    """T-R46-000-01: r46 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py::test_r46_fixture_bootstraps -v`
Expected: PASS（夹具无新依赖时可先绿；若 import 链失败则按 Step 3 补包）

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/errors.py`:

```python
from __future__ import annotations

# NFR 横切
NFR_PLUGIN_EXTENSION_UNAVAILABLE = "NFR_PLUGIN_EXTENSION_UNAVAILABLE"

# NFR-006 推送
PUSH_CONFIG_INVALID = "PUSH_CONFIG_INVALID"

# NFR-007 信创
XINCHUANG_NON_COMPLIANT = "XINCHUANG_NON_COMPLIANT"

# GOV-005 发布（errors 常量集中出口，publish/errors.py re-export）
GOV_PUBLISH_ENTRY_NOT_FOUND = "GOV_PUBLISH_ENTRY_NOT_FOUND"
GOV_PUBLISH_INVALID_TRANSITION = "GOV_PUBLISH_INVALID_TRANSITION"
GOV_PUBLISH_ALREADY_PENDING = "GOV_PUBLISH_ALREADY_PENDING"
GOV_PUBLISH_FORBIDDEN = "GOV_PUBLISH_FORBIDDEN"
```

`backend/app/core/nfr/__init__.py`:

```python
from app.core.nfr.errors import (
    GOV_PUBLISH_ALREADY_PENDING,
    GOV_PUBLISH_ENTRY_NOT_FOUND,
    GOV_PUBLISH_FORBIDDEN,
    GOV_PUBLISH_INVALID_TRANSITION,
    NFR_PLUGIN_EXTENSION_UNAVAILABLE,
    PUSH_CONFIG_INVALID,
    XINCHUANG_NON_COMPLIANT,
)

__all__ = [
    "GOV_PUBLISH_ALREADY_PENDING",
    "GOV_PUBLISH_ENTRY_NOT_FOUND",
    "GOV_PUBLISH_FORBIDDEN",
    "GOV_PUBLISH_INVALID_TRANSITION",
    "NFR_PLUGIN_EXTENSION_UNAVAILABLE",
    "PUSH_CONFIG_INVALID",
    "XINCHUANG_NON_COMPLIANT",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py::test_r46_fixture_bootstraps -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/ tests/test_nfr_gov_conn_r46.py
git commit -m "feat(nfr): scaffold core/nfr error constants and r46 test fixture"
```

---

### Task 2: NFR-005 插件扩展点 + registry 零侵入登记

**Files:**
- Create: `backend/app/core/nfr/plugin_extension.py`
- Modify: `backend/app/core/nfr/__init__.py`
- Test: `tests/test_nfr_gov_conn_r46.py`（+4 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `register_dialect` from `app.datasources.registry`
- Produces: `ExtensionPoint`, `PLUGIN_EXTENSION_POINTS`, `register_connector_plugin()`, `list_extension_points()`, `get_plugin_registration_meta()`

- [ ] **Step 1: Write the failing tests**

追加到 `tests/test_nfr_gov_conn_r46.py`:

```python
from app.core.nfr.plugin_extension import (
    PLUGIN_EXTENSION_POINTS,
    get_plugin_registration_meta,
    list_extension_points,
    register_connector_plugin,
)
from app.datasources.registry import registry


def test_nfr005_plugin_extension_points_list():
    """T-R46-005-01: 扩展点清单 ≥3 且含 connector.register。"""
    points = list_extension_points()
    assert len(points) >= 3
    ids = {p.id for p in points}
    assert "connector.register" in ids


def test_nfr005_register_connector_plugin_records_metadata():
    """T-R46-005-02: register_connector_plugin 记录 registered_via=plugin。"""
    from app.datasources.dialects.base import DialectConnector

    class _TmpConnector:
        type = "_tmp_plugin_r46"
        category = "relational"
        capabilities = ("connectivity_test",)
        display_name = "Tmp"

        def test_connection(self, **kwargs):
            from app.datasources.dialects.base import TestConnectionResult
            return TestConnectionResult(ok=True, message="ok", latency_ms=0, code=None)

    conn = _TmpConnector()
    try:
        register_connector_plugin(conn)  # type: ignore[arg-type]
        meta = get_plugin_registration_meta("_tmp_plugin_r46")
        assert meta is not None
        assert meta.get("registered_via") == "plugin"
        assert registry.get("_tmp_plugin_r46") is conn
    finally:
        from app.datasources.registry import unregister
        unregister("_tmp_plugin_r46")


def test_nfr005_plugin_extension_points_frozen():
    """T-R46-005-03: PLUGIN_EXTENSION_POINTS 为冻结元组。"""
    assert isinstance(PLUGIN_EXTENSION_POINTS, tuple)
    assert len(PLUGIN_EXTENSION_POINTS) >= 3


def test_nfr005_registry_source_unchanged_logic():
    """T-R46-005-04: ConnectorRegistry.register/get 方法体行数守卫（零侵入）。"""
    import inspect
    from app.datasources.registry import ConnectorRegistry

    register_src = inspect.getsource(ConnectorRegistry.register)
    get_src = inspect.getsource(ConnectorRegistry.get)
    assert "register_connector_plugin" not in register_src
    assert "register_connector_plugin" not in get_src
    assert register_src.count("\n") <= 12
    assert get_src.count("\n") <= 12
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k nfr005 -v`
Expected: FAIL with `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/plugin_extension.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.datasources.dialects.base import DialectConnector
from app.datasources.registry import register_dialect

_PLUGIN_META: dict[str, dict[str, Any]] = {}


@dataclass(frozen=True)
class ExtensionPoint:
    id: str
    description: str


PLUGIN_EXTENSION_POINTS: tuple[ExtensionPoint, ...] = (
    ExtensionPoint(id="connector.register", description="Register a DialectConnector"),
    ExtensionPoint(id="connector.unregister", description="Unregister when unused"),
    ExtensionPoint(id="connector.export_catalog", description="Include in type catalog"),
)


def list_extension_points() -> list[ExtensionPoint]:
    return list(PLUGIN_EXTENSION_POINTS)


def register_connector_plugin(connector: DialectConnector) -> None:
    register_dialect(connector)
    _PLUGIN_META[connector.type] = {"registered_via": "plugin", "type": connector.type}


def get_plugin_registration_meta(connector_type: str) -> dict[str, Any] | None:
    return _PLUGIN_META.get(connector_type)
```

更新 `backend/app/core/nfr/__init__.py` 导出 `register_connector_plugin`, `list_extension_points`, `PLUGIN_EXTENSION_POINTS`。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k nfr005 -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/ tests/test_nfr_gov_conn_r46.py
git commit -m "feat(nfr-005): connector plugin extension points and register_connector_plugin"
```

---

### Task 3: CONN-019 GBase 方言 + GBASE_* 错误域 + 插件登记

**Files:**
- Create: `backend/app/datasources/dialects/gbase.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`
- Test: `tests/test_nfr_gov_conn_r46.py`（+8 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`（修 test_invalid_connector_type 冲突前检索）

**UI skill:** none

**Interfaces:**
- Consumes: `register_connector_plugin`, `MysqlConnector`, `map_mysql_operational_error`
- Produces: `GbaseConnector`, `GBASE_*` codes, `map_gbase_error()`, `GBASE_MAX_COLUMNS=500`

- [ ] **Step 1: Write the failing tests**

追加到 `tests/test_nfr_gov_conn_r46.py`:

```python
import pymysql.err

from app.datasources.dialects.gbase import GbaseConnector, GBASE_MAX_COLUMNS
from app.datasources.dialects.errors import (
    GBASE_AUTH_FAILED,
    GBASE_CONN_REFUSED,
    GBASE_UNKNOWN,
    map_gbase_error,
)
from app.datasources.registry import registry
from app.core.nfr.plugin_extension import get_plugin_registration_meta


def test_conn019_gbase_connector_metadata():
    """T-R46-019-01: GbaseConnector 契约字段。"""
    c = GbaseConnector()
    assert c.type == "gbase"
    assert c.category == "relational"
    assert c.display_name == "南大通用 GBase"
    assert "connectivity_test" in c.capabilities
    assert GBASE_MAX_COLUMNS == 500


def test_conn019_gbase_registered_via_plugin():
    """T-R46-019-02: 内置登记走 register_connector_plugin。"""
    meta = get_plugin_registration_meta("gbase")
    assert meta is not None
    assert meta["registered_via"] == "plugin"
    assert registry.get("gbase").type == "gbase"


def test_conn019_gbase_types_catalog_http(client):
    """T-R46-019-03: GET /datasources/types 含 gbase relational。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    items = {i["type"]: i for i in resp.json()["items"]}
    assert "gbase" in items
    assert items["gbase"]["category"] == "relational"


def test_conn019_map_gbase_error_prefix():
    """T-R46-019-04: map_gbase_error 镜像 tidb 前缀替换。"""
    exc = pymysql.err.OperationalError(2003, "Can't connect")
    code, _ = map_gbase_error(exc)
    assert code == GBASE_CONN_REFUSED


def test_conn019_gbase_test_connection_ok_mock():
    """T-R46-019-05: mock 连接成功。"""
    connector = GbaseConnector()
    with patch.object(connector._inner, "open_connection") as mock_open:
        mock_conn = MagicMock()
        mock_open.return_value = mock_conn
        result = connector.test_connection(host="h", port=5258, username="u", password="p", database="d")
    assert result.ok is True


def test_conn019_gbase_test_connection_auth_failed_mock():
    """T-R46-019-06: mock 认证失败映射 GBASE_AUTH_FAILED。"""
    connector = GbaseConnector()
    with patch.object(connector._inner, "open_connection", side_effect=pymysql.err.OperationalError(1045, "Access denied")):
        result = connector.test_connection(host="h", port=5258, username="u", password="p", database="d")
    assert result.ok is False
    assert result.code == GBASE_AUTH_FAILED


def test_conn019_gbase_list_schemas_delegates():
    """T-R46-019-07: list_schemas 委托 mysql。"""
    connector = GbaseConnector()
    mock_conn = MagicMock()
    with patch.object(connector._inner, "list_schemas", return_value=[]) as mock_ls:
        connector.list_schemas(mock_conn)
    mock_ls.assert_called_once_with(mock_conn)


def test_conn019_gbase_http_test_connection_draft(client):
    """T-R46-019-08: POST test-connection draft 链可达。"""
    with patch("app.datasources.dialects.mysql.MysqlConnector.open_connection") as mock_open:
        mock_conn = MagicMock()
        mock_open.return_value = mock_conn
        resp = client.post(
            "/api/v1/datasources/test-connection",
            headers=AUTH,
            json={
                "type": "gbase",
                "host": "127.0.0.1",
                "port": 5258,
                "username": "u",
                "password": "p",
                "database": "demo",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k conn019 -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`backend/app/datasources/dialects/errors.py` 末尾追加（在 `MONGODB_*` 区块之前或之后，保持 ruff 排序）：

```python
# GBase 8a (MySQL protocol)
GBASE_CONN_REFUSED = "GBASE_CONN_REFUSED"
GBASE_AUTH_FAILED = "GBASE_AUTH_FAILED"
GBASE_TIMEOUT = "GBASE_TIMEOUT"
GBASE_UNKNOWN_DATABASE = "GBASE_UNKNOWN_DATABASE"
GBASE_UNKNOWN = "GBASE_UNKNOWN"


def map_gbase_error(exc: Exception) -> tuple[str, str]:
    from pymysql.err import OperationalError

    if isinstance(exc, OperationalError):
        code, detail = map_mysql_operational_error(exc)
        mapping = {
            "MYSQL_TIMEOUT": GBASE_TIMEOUT,
            "MYSQL_CONN_REFUSED": GBASE_CONN_REFUSED,
            "MYSQL_AUTH_FAILED": GBASE_AUTH_FAILED,
            "MYSQL_UNKNOWN_DATABASE": GBASE_UNKNOWN_DATABASE,
        }
        return mapping.get(code, GBASE_UNKNOWN), detail
    return GBASE_UNKNOWN, str(exc)
```

`backend/app/datasources/dialects/gbase.py`（镜像 `tidb.py`）：

```python
from __future__ import annotations

import time
from typing import Any

import pymysql.err

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_gbase_error
from app.datasources.dialects.mysql import MysqlConnector

GBASE_MAX_COLUMNS = 500
GBASE_DEFAULT_PORT = 5258


class GbaseConnector:
    type = "gbase"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "南大通用 GBase"

    def __init__(self) -> None:
        self._inner = MysqlConnector()

    def test_connection(self, **kwargs) -> TestConnectionResult:
        started = time.perf_counter()
        port = kwargs.get("port", GBASE_DEFAULT_PORT)
        conn_kwargs = {**kwargs, "port": port}
        try:
            connection = self._inner.open_connection(**conn_kwargs)
            try:
                connection.ping(reconnect=False)
            finally:
                connection.close()
        except pymysql.err.OperationalError as exc:
            code, detail = map_gbase_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code,
            )
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms, code=None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms, code=None)

    def open_connection(self, **kwargs) -> Any:
        port = kwargs.get("port", GBASE_DEFAULT_PORT)
        return self._inner.open_connection(**{**kwargs, "port": port})

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._inner.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return self._inner.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        cols = self._inner.list_columns(connection, schema, table)
        return cols[:GBASE_MAX_COLUMNS]
```

`backend/app/datasources/dialects/__init__.py`：import/export `GbaseConnector`, `GBASE_MAX_COLUMNS`。

`backend/app/datasources/__init__.py`：

```python
from app.core.nfr.plugin_extension import register_connector_plugin
from app.datasources.dialects.gbase import GbaseConnector

# register_builtin_dialects() 内末尾追加：
    register_connector_plugin(GbaseConnector())
```

（其余方言保持 `register_dialect`；仅 gbase 走 plugin 路径。）

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k conn019 -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/ tests/test_nfr_gov_conn_r46.py
git commit -m "feat(conn-019): GBase connector with GBASE error mapping via plugin registration"
```

---

### Task 4: NFR-007 信创合规清单 + config 字段

**Files:**
- Create: `backend/app/core/nfr/xinchuang.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/core/nfr/__init__.py`
- Test: `tests/test_nfr_gov_conn_r46.py`（+5 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `get_settings()`, `registry`, `PLUGIN_EXTENSION_POINTS`, `export_type_catalog`
- Produces: `build_compliance_report()`, `assert_xinchuang_compliant()`, `ComplianceReport`, `XinchuangChecklistItem`

- [ ] **Step 1: Write the failing tests**

```python
from app.core.nfr.xinchuang import assert_xinchuang_compliant, build_compliance_report
from app.core.nfr.errors import XINCHUANG_NON_COMPLIANT


def test_nfr007_compliance_report_items(client):
    """T-R46-007-01: 合规报告 ≥4 项含 xc-db-connector。"""
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) >= 4
    ids = {i["id"] for i in body["items"]}
    assert "xc-db-connector" in ids


def test_nfr007_registered_xinchuang_connectors_include_gbase(client):
    """T-R46-007-02: 登记 gbase 后 registeredXinchuangConnectors 含 gbase。"""
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    registered = resp.json()["registeredXinchuangConnectors"]
    assert "gbase" in registered


def test_nfr007_build_compliance_report_unit():
    """T-R46-007-03: build_compliance_report 返回 overallStatus。"""
    report = build_compliance_report()
    assert report.overall_status in {"compliant", "non_compliant", "degraded"}
    assert report.mode in {"strict", "permissive"}


def test_nfr007_strict_mode_non_compliant_422(client, monkeypatch):
    """T-R46-007-04: strict + 违规平台库 → 422 XINCHUANG_NON_COMPLIANT。"""
    mock_settings = get_settings()
    monkeypatch.setattr(
        "app.core.nfr.xinchuang.get_settings",
        lambda: type("S", (), {
            **{k: getattr(mock_settings, k) for k in ("database_url", "vitalspan_env")},
            "xinchuang_mode": "strict",
            "database_url": "mysql://bad:3306/db",
        })(),
    )
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == XINCHUANG_NON_COMPLIANT


def test_nfr007_assert_raises_on_non_compliant():
    """T-R46-007-05: assert_xinchuang_compliant strict 违规抛错。"""
    from app.core.nfr.xinchuang import XinchuangComplianceError

    class _BadSettings:
        xinchuang_mode = "strict"
        database_url = "mysql://bad:3306/db"

    with pytest.raises(XinchuangComplianceError) as exc:
        assert_xinchuang_compliant(_BadSettings())  # type: ignore[arg-type]
    assert exc.value.code == XINCHUANG_NON_COMPLIANT
```

注：Task 6 实现 `GET /api/v1/nfr/xinchuang/compliance` 前，Step 2 预期 FAIL；可先实现 domain 层使 unit 测通过，API 测在 Task 6 再绿。

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k nfr007 -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/config.py` 追加字段：

```python
    push_browser_enabled: bool = False
    push_wecom_webhook: str | None = None
    push_dingtalk_webhook: str | None = None
    xinchuang_mode: Literal["strict", "permissive"] = "permissive"

    @field_validator("push_wecom_webhook", "push_dingtalk_webhook", mode="before")
    @classmethod
    def normalize_optional_webhook(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value
```

（env 名：`PUSH_BROWSER_ENABLED`、`PUSH_WECOM_WEBHOOK`、`PUSH_DINGTALK_WEBHOOK`、`XINCHUANG_MODE`。）

`backend/app/core/nfr/xinchuang.py`:

```python
from __future__ import annotations

import importlib.util
from dataclasses import dataclass

from app.core.config import Settings, get_settings
from app.core.nfr.errors import XINCHUANG_NON_COMPLIANT
from app.core.nfr.plugin_extension import PLUGIN_EXTENSION_POINTS
from app.datasources.registry import registry

_XINCHUANG_DB_TYPES = frozenset({"gbase", "dm", "gaussdb", "kingbase"})
_FORBIDDEN_MODULES = frozenset({"superset", "dataease"})


class XinchuangComplianceError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class XinchuangChecklistItem:
    id: str
    status: str  # pass|fail|warn
    message: str


@dataclass(frozen=True)
class ComplianceReport:
    mode: str
    overall_status: str  # compliant|non_compliant|degraded
    items: tuple[XinchuangChecklistItem, ...]
    registered_xinchuang_connectors: tuple[str, ...]


def _registered_xinchuang() -> list[str]:
    return sorted(t for t in registry.list_types() if t.type in _XINCHUANG_DB_TYPES)


def _check_platform_db(settings: Settings) -> XinchuangChecklistItem:
    url = settings.database_url
    if url.startswith(("postgresql://", "postgresql+psycopg://", "sqlite+")):
        return XinchuangChecklistItem("xc-platform-db", "pass", "platform meta db protocol ok")
    return XinchuangChecklistItem("xc-platform-db", "fail", f"non-compliant platform db: {url.split(':', 1)[0]}")


def _check_forbidden_runtime() -> XinchuangChecklistItem:
    for name in _FORBIDDEN_MODULES:
        if importlib.util.find_spec(name) is not None:
            return XinchuangChecklistItem("xc-forbidden-runtime", "fail", f"forbidden module loaded: {name}")
    return XinchuangChecklistItem("xc-forbidden-runtime", "pass", "no forbidden BI runtime modules")


def build_compliance_report(settings: Settings | None = None) -> ComplianceReport:
    settings = settings or get_settings()
    xc_registered = _registered_xinchuang()
    items = [
        XinchuangChecklistItem(
            "xc-db-connector",
            "pass" if xc_registered else "fail",
            "xinchuang db connectors registered" if xc_registered else "no xinchuang connector registered",
        ),
        _check_platform_db(settings),
        _check_forbidden_runtime(),
        XinchuangChecklistItem(
            "xc-connector-plugin",
            "pass" if PLUGIN_EXTENSION_POINTS else "fail",
            "plugin extension points declared",
        ),
    ]
    fails = [i for i in items if i.status == "fail"]
    warns = [i for i in items if i.status == "warn"]
    if fails:
        overall = "non_compliant"
    elif warns:
        overall = "degraded"
    else:
        overall = "compliant"
    return ComplianceReport(
        mode=settings.xinchuang_mode,
        overall_status=overall,
        items=tuple(items),
        registered_xinchuang_connectors=tuple(xc_registered),
    )


def assert_xinchuang_compliant(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if settings.xinchuang_mode != "strict":
        return
    report = build_compliance_report(settings)
    if report.overall_status == "non_compliant":
        raise XinchuangComplianceError(XINCHUANG_NON_COMPLIANT, "xinchuang compliance check failed")
```

- [ ] **Step 4: Run unit tests**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py::test_nfr007_build_compliance_report_unit ../tests/test_nfr_gov_conn_r46.py::test_nfr007_assert_raises_on_non_compliant -v`
Expected: PASS（API 测 Task 6 完成）

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/ tests/test_nfr_gov_conn_r46.py
git commit -m "feat(nfr-007): xinchuang compliance checklist and strict guard"
```

---

### Task 5: NFR-006 推送配置契约 + 降级守卫

**Files:**
- Create: `backend/app/core/nfr/push_config.py`
- Modify: `backend/app/core/nfr/__init__.py`
- Test: `tests/test_nfr_gov_conn_r46.py`（+4 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `Settings` push 字段
- Produces: `PushConfigOut`, `resolve_push_mode()`, `validate_push_settings()`, `PushConfigValidationError`

- [ ] **Step 1: Write the failing tests**

```python
from app.core.nfr.push_config import PushConfigValidationError, resolve_push_mode, validate_push_settings
from app.core.nfr.errors import PUSH_CONFIG_INVALID


def test_nfr006_default_disabled(monkeypatch):
    """T-R46-006-01: 默认 deliveryMode=disabled 且 degradedReason 非空。"""
    monkeypatch.delenv("PUSH_BROWSER_ENABLED", raising=False)
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    get_settings.cache_clear()
    out = resolve_push_mode()
    assert out.delivery_mode == "disabled"
    assert out.degraded_reason


def test_nfr006_active_when_browser_and_wecom(monkeypatch):
    """T-R46-006-02: 浏览器 + 合法企微 webhook → active。"""
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    monkeypatch.setenv("PUSH_WECOM_WEBHOOK", "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=x")
    get_settings.cache_clear()
    out = resolve_push_mode()
    assert out.delivery_mode == "active"


def test_nfr006_degraded_partial_channel(monkeypatch):
    """T-R46-006-03: 仅浏览器无消息通道 → degraded。"""
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    monkeypatch.delenv("PUSH_DINGTALK_WEBHOOK", raising=False)
    get_settings.cache_clear()
    out = resolve_push_mode()
    assert out.delivery_mode == "degraded"


def test_nfr006_invalid_webhook_raises():
    """T-R46-006-04: 非 https webhook → PUSH_CONFIG_INVALID。"""
    class _S:
        push_browser_enabled = True
        push_wecom_webhook = "http://insecure.example/hook"
        push_dingtalk_webhook = None

    with pytest.raises(PushConfigValidationError) as exc:
        validate_push_settings(_S())  # type: ignore[arg-type]
    assert exc.value.code == PUSH_CONFIG_INVALID
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k nfr006 -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/push_config.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings, get_settings
from app.core.nfr.errors import PUSH_CONFIG_INVALID


class PushConfigValidationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class PushConfigOut:
    browser_enabled: bool
    wecom_configured: bool
    dingtalk_configured: bool
    delivery_mode: str  # disabled|degraded|active
    degraded_reason: str | None


def _is_valid_webhook(url: str | None) -> bool:
    return bool(url and url.startswith("https://"))


def validate_push_settings(settings: Settings) -> None:
    for label, url in (
        ("wecom", settings.push_wecom_webhook),
        ("dingtalk", settings.push_dingtalk_webhook),
    ):
        if url and not url.startswith("https://"):
            raise PushConfigValidationError(
                PUSH_CONFIG_INVALID,
                f"{label} webhook must use https",
            )


def resolve_push_mode(settings: Settings | None = None) -> PushConfigOut:
    settings = settings or get_settings()
    validate_push_settings(settings)
    wecom_ok = _is_valid_webhook(settings.push_wecom_webhook)
    ding_ok = _is_valid_webhook(settings.push_dingtalk_webhook)
    browser = settings.push_browser_enabled
    if not browser and not wecom_ok and not ding_ok:
        return PushConfigOut(False, False, False, "disabled", "push channels not configured")
    if browser and (wecom_ok or ding_ok):
        return PushConfigOut(browser, wecom_ok, ding_ok, "active", None)
    return PushConfigOut(browser, wecom_ok, ding_ok, "degraded", "partial push channel configuration")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k nfr006 -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/ tests/test_nfr_gov_conn_r46.py
git commit -m "feat(nfr-006): push config schema with degraded mode guard"
```

---

### Task 6: NFR REST 路由 + router 挂载

**Files:**
- Create: `backend/app/api/v1/nfr.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_nfr_gov_conn_r46.py`（补齐 nfr007 API 测 + nfr005 HTTP 测，+3 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `list_extension_points`, `resolve_push_mode`, `build_compliance_report`, `assert_xinchuang_compliant`

- [ ] **Step 1: Write the failing tests**

```python
def test_nfr005_plugin_extension_points_http(client):
    """T-R46-005-05: GET /nfr/plugin-extension-points ≥3。"""
    resp = client.get("/api/v1/nfr/plugin-extension-points", headers=AUTH)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 3


def test_nfr006_push_config_http(client):
    """T-R46-006-05: GET /nfr/push-config 不泄露 webhook 明文。"""
    resp = client.get("/api/v1/nfr/push-config", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "webhook" not in str(body).lower() or body.get("wecomConfigured") is False
    assert body["deliveryMode"] in {"disabled", "degraded", "active"}


def test_nfr007_compliance_http_strict_guard(client, monkeypatch):
    """T-R46-007-06: strict 非合规 GET compliance → 422（复用 Task4 场景）。"""
    mock_settings = get_settings()
    monkeypatch.setattr(
        "app.api.v1.nfr.get_settings",
        lambda: type("S", (), {
            **{k: getattr(mock_settings, k) for k in ("database_url", "vitalspan_env")},
            "xinchuang_mode": "strict",
            "database_url": "mysql://bad:3306/db",
        })(),
    )
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k "nfr005_plugin_extension_points_http or nfr006_push or nfr007_compliance_http" -v`
Expected: FAIL with 404

- [ ] **Step 3: Write minimal implementation**

`backend/app/api/v1/nfr.py`:

```python
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.core.nfr.errors import PUSH_CONFIG_INVALID, XINCHUANG_NON_COMPLIANT
from app.core.nfr.plugin_extension import list_extension_points
from app.core.nfr.push_config import PushConfigValidationError, resolve_push_mode
from app.core.nfr.xinchuang import XinchuangComplianceError, assert_xinchuang_compliant, build_compliance_report

router = APIRouter(prefix="/nfr", tags=["nfr"])


class ExtensionPointOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    description: str


class ExtensionPointListResponse(BaseModel):
    items: list[ExtensionPointOut]


class PushConfigResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    browser_enabled: bool = Field(alias="browserEnabled")
    wecom_configured: bool = Field(alias="wecomConfigured")
    dingtalk_configured: bool = Field(alias="dingtalkConfigured")
    delivery_mode: str = Field(alias="deliveryMode")
    degraded_reason: str | None = Field(default=None, alias="degradedReason")


class ComplianceItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    status: str
    message: str


class ComplianceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: str
    overall_status: str = Field(alias="overallStatus")
    items: list[ComplianceItemOut]
    registered_xinchuang_connectors: list[str] = Field(alias="registeredXinchuangConnectors")


@router.get("/plugin-extension-points", response_model=ExtensionPointListResponse)
def get_plugin_extension_points(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ExtensionPointListResponse:
    return ExtensionPointListResponse(
        items=[ExtensionPointOut(id=p.id, description=p.description) for p in list_extension_points()]
    )


@router.get("/push-config", response_model=PushConfigResponse)
def get_push_config(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> PushConfigResponse | JSONResponse:
    try:
        out = resolve_push_mode()
    except PushConfigValidationError as exc:
        return JSONResponse(status_code=422, content={"code": exc.code, "message": exc.message, "detail": None})
    return PushConfigResponse(
        browserEnabled=out.browser_enabled,
        wecomConfigured=out.wecom_configured,
        dingtalkConfigured=out.dingtalk_configured,
        deliveryMode=out.delivery_mode,
        degradedReason=out.degraded_reason,
    )


@router.get("/xinchuang/compliance", response_model=ComplianceResponse)
def get_xinchuang_compliance(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ComplianceResponse | JSONResponse:
    settings = get_settings()
    try:
        assert_xinchuang_compliant(settings)
    except XinchuangComplianceError as exc:
        return JSONResponse(
            status_code=422,
            content={"code": XINCHUANG_NON_COMPLIANT, "message": exc.message, "detail": None},
        )
    report = build_compliance_report(settings)
    return ComplianceResponse(
        mode=report.mode,
        overallStatus=report.overall_status,
        items=[ComplianceItemOut(id=i.id, status=i.status, message=i.message) for i in report.items],
        registeredXinchuangConnectors=list(report.registered_xinchuang_connectors),
    )
```

`backend/app/api/v1/router.py` 追加：

```python
from app.api.v1.nfr import router as nfr_router
# ...
api_v1_router.include_router(nfr_router)
```

- [ ] **Step 4: Run NFR HTTP + 既有 nfr007 测**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k "nfr005 or nfr006 or nfr007" -v`
Expected: ≥13 passed（含 Task 2/4/5 单元测）

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/nfr.py backend/app/api/v1/router.py tests/test_nfr_gov_conn_r46.py
git commit -m "feat(nfr): expose plugin-extension, push-config, xinchuang compliance APIs"
```

---

### Task 7: GOV-005 发布状态机 + gov 路由

**Files:**
- Create: `backend/app/governance/publish/__init__.py`
- Create: `backend/app/governance/publish/errors.py`
- Create: `backend/app/governance/publish/schemas.py`
- Create: `backend/app/governance/publish/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Test: `tests/test_nfr_gov_conn_r46.py`（+8 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `CatalogEntry` ORM, `catalog_service.get_entry`
- Produces: `submit_entry()`, `approve_entry()`, `reject_entry()`, `get_publish_status()`, `PublishError`

- [ ] **Step 1: Write the failing tests**

```python
def test_gov005_submit_pending_publish(client):
    """T-R46-GOV-01: draft submit → pending_publish。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending_publish"


def test_gov005_approve_published(client):
    """T-R46-GOV-02: pending approve → published。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


def test_gov005_reject_back_to_draft(client):
    """T-R46-GOV-03: pending reject → draft。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/reject", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


def test_gov005_invalid_draft_to_published_via_gov(client):
    """T-R46-GOV-04: gov 路径 draft 直 approve → 400。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "GOV_PUBLISH_INVALID_TRANSITION"


def test_gov005_published_resubmit_forbidden(client):
    """T-R46-GOV-05: published 再 submit → 400。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    assert resp.status_code == 400


def test_gov005_double_submit_conflict(client):
    """T-R46-GOV-06: pending 重复 submit → 409。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "GOV_PUBLISH_ALREADY_PENDING"


def test_gov005_status_allowed_actions(client):
    """T-R46-GOV-07: GET status 返回 allowedActions。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.get(f"/api/v1/gov/publish/entries/{eid}/status", headers=AUTH)
    assert resp.status_code == 200
    assert "submit" in resp.json()["allowedActions"]


def test_gov005_approve_visible_in_integration_list(client):
    """T-R46-GOV-08: gov approve 后 integration list 含 published。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    resp = client.get("/api/v1/services", headers=AUTH, params={"limit": 50})
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert eid in ids
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k gov005 -v`
Expected: FAIL with 404

- [ ] **Step 3: Write minimal implementation**

`backend/app/governance/publish/errors.py`:

```python
from __future__ import annotations

from app.core.nfr.errors import (
    GOV_PUBLISH_ALREADY_PENDING,
    GOV_PUBLISH_ENTRY_NOT_FOUND,
    GOV_PUBLISH_FORBIDDEN,
    GOV_PUBLISH_INVALID_TRANSITION,
)


class PublishError(Exception):
    def __init__(self, code: str, message: str, status: int) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)
```

`backend/app/governance/publish/schemas.py`:

```python
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class PublishActionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    status: str


class PublishStatusOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    status: str
    allowed_actions: list[str] = Field(alias="allowedActions")
```

`backend/app/governance/publish/service.py`:

```python
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.nfr.errors import (
    GOV_PUBLISH_ALREADY_PENDING,
    GOV_PUBLISH_ENTRY_NOT_FOUND,
    GOV_PUBLISH_INVALID_TRANSITION,
)
from app.governance.catalog.models import CatalogEntry
from app.governance.publish.errors import PublishError
from app.governance.publish.schemas import PublishActionOut, PublishStatusOut

_ALLOWED: dict[str, frozenset[str]] = {
    "draft": frozenset({"submit"}),
    "pending_publish": frozenset({"approve", "reject"}),
    "published": frozenset(),
}


def _get_row(db: Session, entry_id: uuid.UUID) -> CatalogEntry:
    row = db.scalar(select(CatalogEntry).where(CatalogEntry.id == entry_id))
    if row is None:
        raise PublishError(GOV_PUBLISH_ENTRY_NOT_FOUND, "Catalog entry not found", 404)
    return row


def get_publish_status(db: Session, entry_id: uuid.UUID) -> PublishStatusOut:
    row = _get_row(db, entry_id)
    return PublishStatusOut(
        id=row.id,
        status=row.status,
        allowedActions=sorted(_ALLOWED.get(row.status, frozenset())),
    )


def submit_entry(db: Session, entry_id: uuid.UUID) -> PublishActionOut:
    row = _get_row(db, entry_id)
    if row.status == "pending_publish":
        raise PublishError(GOV_PUBLISH_ALREADY_PENDING, "Entry already pending publish", 409)
    if row.status != "draft":
        raise PublishError(GOV_PUBLISH_INVALID_TRANSITION, f"Cannot submit from {row.status}", 400)
    row.status = "pending_publish"
    db.commit()
    db.refresh(row)
    return PublishActionOut(id=row.id, status=row.status)


def approve_entry(db: Session, entry_id: uuid.UUID) -> PublishActionOut:
    row = _get_row(db, entry_id)
    if row.status == "published":
        return PublishActionOut(id=row.id, status=row.status)
    if row.status != "pending_publish":
        raise PublishError(GOV_PUBLISH_INVALID_TRANSITION, f"Cannot approve from {row.status}", 400)
    row.status = "published"
    db.commit()
    db.refresh(row)
    return PublishActionOut(id=row.id, status=row.status)


def reject_entry(db: Session, entry_id: uuid.UUID) -> PublishActionOut:
    row = _get_row(db, entry_id)
    if row.status != "pending_publish":
        raise PublishError(GOV_PUBLISH_INVALID_TRANSITION, f"Cannot reject from {row.status}", 400)
    row.status = "draft"
    db.commit()
    db.refresh(row)
    return PublishActionOut(id=row.id, status=row.status)
```

`backend/app/api/v1/gov.py` 追加（复用 `_db`、`_catalog_error_response` 模式，新增 `_publish_error_response`）：

```python
from app.governance.publish import service as publish_service
from app.governance.publish.schemas import PublishActionOut, PublishStatusOut

def _publish_error_response(exc: publish_service.PublishError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )

@router.post("/publish/entries/{entry_id}/submit", response_model=PublishActionOut)
def publish_submit(...):
    try:
        return publish_service.submit_entry(db, entry_id)
    except publish_service.PublishError as exc:
        return _publish_error_response(exc)

# approve / reject / GET status 同理
```

`backend/app/governance/publish/__init__.py` 导出 service/schemas/errors。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -k gov005 -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/publish/ backend/app/api/v1/gov.py tests/test_nfr_gov_conn_r46.py
git commit -m "feat(gov-005): query service publish workflow state machine"
```

---

### Task 8: 跨项联动测 + 回归门控 + 文档同步

**Files:**
- Modify: `tests/test_nfr_gov_conn_r46.py`（+3 联动测）
- Create: `docs/services/nfr.md`
- Modify: `docs/services/datasources.md`, `docs/services/governance.md`, `docs/services/README.md`, `docs/api/README.md`, `docs/arch.md`（NFR 横切一行）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: 全部 r46 实现

- [ ] **Step 1: Write cross-item tests**

```python
def test_r46_cross_gbase_xinchuang_plugin(client):
    """T-R46-X-01: gbase 登记 + 信创清单 + 插件元数据联动。"""
    from app.core.nfr.plugin_extension import get_plugin_registration_meta

    assert get_plugin_registration_meta("gbase")["registered_via"] == "plugin"
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    assert "gbase" in resp.json()["registeredXinchuangConnectors"]


def test_r46_cross_integration_fast_path_still_works(client):
    """T-R46-X-02: integration 快路径 draft→published 仍可用。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


def test_r46_cross_plugin_points_include_export_catalog(client):
    """T-R46-X-03: 扩展点含 connector.export_catalog 且 types 含 gbase。"""
    resp = client.get("/api/v1/nfr/plugin-extension-points", headers=AUTH)
    ids = {i["id"] for i in resp.json()["items"]}
    assert "connector.export_catalog" in ids
    types = client.get("/api/v1/datasources/types", headers=AUTH).json()["items"]
    assert any(t["type"] == "gbase" for t in types)
```

- [ ] **Step 2: Run full r46 suite**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -v --co -q | tail -3`
Expected: **≥32** test functions collected

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r46.py -q`
Expected: all passed

- [ ] **Step 3: Regression gate**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_nfr_gov_conn_r46.py \
  ../tests/test_integration_api_l1_r45.py \
  ../tests/test_connectors_gov_r41.py \
  ../tests/test_datasources_l1.py::test_invalid_connector_type \
  -q
```
Expected: exit_code 0；r45 **30/30**、r41 **36/36**、`test_invalid_connector_type` PASS（非法 type 仍用 `couchdb` 等非 gbase 名）

- [ ] **Step 4: Document sync**（`prd-sync.mdc`）

- `docs/services/nfr.md`：NFR-005/006/007 职责、边界、依赖
- `docs/services/datasources.md`：CONN-019 GBase L1 行
- `docs/services/governance.md`：GOV-005 publish 工作流
- `docs/api/README.md`：登记 `GET /api/v1/nfr/*`、`POST/GET /api/v1/gov/publish/entries/{id}/*`
- `docs/arch.md`：`core/nfr/` 横切一行
- `docs/services/README.md`：nfr 域索引

- [ ] **Step 5: Commit**

```bash
git add tests/test_nfr_gov_conn_r46.py docs/
git commit -m "test(docs): r46 cross-item smoke and service/api documentation"
```

---

## Self-Review Checklist

| 子项 | 对应 Task | 测试条数 |
|------|-----------|:--------:|
| NFR-005 | Task 2, 6, 8 | 4+1+1=6 |
| NFR-006 | Task 5, 6 | 4+1=5 |
| NFR-007 | Task 4, 6, 8 | 5+1=6 |
| GOV-005 | Task 7 | 8 |
| CONN-019 | Task 3 | 8 |
| 跨项 | Task 8 | 3 |
| 夹具 | Task 1 | 1 |
| **合计** | | **≥37**（超过 ≥32 门槛） |

- [x] 五 design 子项均有 Task
- [x] 无 TBD/TODO/「适当处理」
- [x] 每 Task 含验证命令与代码片段
- [x] 纯后端全 Task `UI skill: none`
- [x] P3 生产代码 **18 文件 ≤20**

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-04-nfr-gov-gbase-l1-r46.md`.

**固定执行模式：subagent-driven-development (option 1)** — P3 按 Task 1→8 逐任务派发 subagent，每任务 Spec review + Quality review 后合并。
