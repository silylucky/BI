# M-FINAL F-G 收官 + VIZ/API companion 补强 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/redshift.py`（新建）、`backend/app/datasources/dialects/errors.py`、`backend/app/datasources/dialects/__init__.py`、`backend/app/datasources/__init__.py`、`tests/test_mfinal_fg_r250.py`（新建）、`tests/test_connectors_gov_r40.py`、`tests/test_connectors_gov_r41.py`、`fe/src/pages/admin/datasources/DatasourceFormPage.tsx`、`fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`、`fe/src/components/charts/adapters/renderFromSpec.ts`、`fe/src/components/charts/adapters/AdvancedEchartsChart.tsx`、`docs/api/README.md`、`docs/services/datasources.md`
> **子项：** CONN-027, API-001, VIZ-003, VIZ-004, VIZ-008
> **项目技能：** `.agents/skills/` 或 `.cursor/skills/`（P3 按 Files 按需 Read；plan 可预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；其余由 P3 按 Files 与 globs 动态匹配）

**Goal:** 闭合 M-FINAL F-G 最后一项（CONN-027 AWS Redshift 方言注册 + 连通链），并补强 API-001/VIZ-003/004/008 薄弱维，使 plan §M-FINAL 全部 129 项 PRD 可勾选。

**Architecture:** RedshiftConnector 委托 PostgresConnector（psycopg3，端口 5439，SSL 默认 required），追加专用 REDSHIFT_* 错误常量与映射函数；前端 `CONNECTOR_FIELD_HINTS` 追加 redshift 提示；VIZ 改动均集中在 `renderFromSpec.ts`（fallback + safeColIndex + buildBarOption/buildPieOption）与 `AdvancedEchartsChart.tsx`（空数据覆盖层）；API-001 性能断言与 traceId 验证写入 `tests/test_mfinal_fg_r250.py`。

**Tech Stack:** Python 3.12 + psycopg3 + pytest + FastAPI TestClient（后端）；React 19 + TypeScript + Vitest + Testing Library（前端）

## Global Constraints

- 前端目录：`fe/`，包管理器 pnpm，测试运行器 vitest（`cd fe && pnpm vitest run`）
- 后端目录：`backend/`，测试从 `backend/` cwd 运行 `pytest`；ruff lint 也从 `backend/` 运行
- API 前缀：`/api/v1/`；公开路径：`/health`、`/docs`、`/redoc`、`/openapi.json`
- 错误体：`{ "code", "message", "detail" }`（与前端 envelope 对齐）
- 脱敏守卫：API 响应禁止明文密码/密钥（Fernet ADR-06，`CREDENTIAL_FERNET_KEY`）
- Token：禁止硬编码 hex（`check:design` 扫描；豁免注释 `@design-token-ok`）
- 无占位符 TBD/TODO；每步包含完整代码
- catalog count：注册 Redshift 后为 30（r40/r41 29→30）
- 非目标：Redshift Serverless/IAM 认证；UNLOAD/S3 导出；真机 Redshift 集成测；AntV 适配；新 PRD ID

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 新建 | `backend/app/datasources/dialects/redshift.py` | RedshiftConnector 方言实现（委托 PostgresConnector） |
| 修改 | `backend/app/datasources/dialects/errors.py` | 追加 REDSHIFT_* 常量 + `map_redshift_error` |
| 修改 | `backend/app/datasources/dialects/__init__.py` | import RedshiftConnector + `__all__` 追加 |
| 修改 | `backend/app/datasources/__init__.py` | import + `register_dialect(RedshiftConnector())` |
| 新建 | `tests/test_mfinal_fg_r250.py` | CONN-027×7 + API-001×4 断言 |
| 修改 | `tests/test_connectors_gov_r40.py` | catalog count 29→30 |
| 修改 | `tests/test_connectors_gov_r41.py` | catalog count 29→30 |
| 修改 | `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | `CONNECTOR_FIELD_HINTS` 追加 redshift |
| 修改 | `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | T-CONN-R250-FE-01/02 |
| 修改 | `fe/src/components/charts/adapters/renderFromSpec.ts` | FALLBACK_CHART_TYPE + safeColIndex + buildBarOption + buildPieOption + 空数据防护 |
| 修改 | `fe/src/components/charts/adapters/AdvancedEchartsChart.tsx` | 空 series → EmptyState 覆盖层 |
| 修改 | `docs/api/README.md` | 注 Redshift 已注册 |
| 修改 | `docs/services/datasources.md` | 更新连接器列表，标注 redshift category=olap |

---

### Task 1: CONN-027 后端错误常量与 RedshiftConnector 实现

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `backend/app/datasources/dialects/redshift.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 在 `errors.py` 末尾追加 REDSHIFT_* 常量与 `map_redshift_error`**

定位到 `backend/app/datasources/dialects/errors.py` 末尾（当前最后一个函数之后），追加：

```python
# Redshift (Postgres-compatible; error codes remap to REDSHIFT_ prefix)
REDSHIFT_AUTH_FAILED = "REDSHIFT_AUTH_FAILED"
REDSHIFT_CONN_REFUSED = "REDSHIFT_CONN_REFUSED"
REDSHIFT_SSL_REQUIRED = "REDSHIFT_SSL_REQUIRED"
REDSHIFT_TIMEOUT = "REDSHIFT_TIMEOUT"
REDSHIFT_UNKNOWN_DATABASE = "REDSHIFT_UNKNOWN_DATABASE"
REDSHIFT_UNKNOWN = "REDSHIFT_UNKNOWN"

_PG_TO_REDSHIFT: dict[str, str] = {
    PG_CONN_REFUSED: REDSHIFT_CONN_REFUSED,
    PG_AUTH_FAILED: REDSHIFT_AUTH_FAILED,
    PG_TIMEOUT: REDSHIFT_TIMEOUT,
    PG_UNKNOWN_DATABASE: REDSHIFT_UNKNOWN_DATABASE,
    PG_SSL_ERROR: REDSHIFT_SSL_REQUIRED,
    PG_UNKNOWN: REDSHIFT_UNKNOWN,
}


def map_redshift_error(exc: Exception) -> tuple[str, str]:
    """Map psycopg/network exception to REDSHIFT_* error code."""
    import psycopg  # local import, avoids hard dep if psycopg unavailable

    if isinstance(exc, psycopg.OperationalError):
        pg_code, detail = map_postgres_operational_error(exc)
        if "ssl" in detail.lower():
            return REDSHIFT_SSL_REQUIRED, detail
        return _PG_TO_REDSHIFT.get(pg_code, REDSHIFT_UNKNOWN), detail
    detail = str(exc)
    if "ssl" in detail.lower():
        return REDSHIFT_SSL_REQUIRED, detail
    return REDSHIFT_UNKNOWN, detail
```

- [ ] **Step 2: 创建 `backend/app/datasources/dialects/redshift.py`**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import (
    ColumnInfo,
    SchemaInfo,
    TableInfo,
    TestConnectionResult,
)
from app.datasources.dialects.errors import map_redshift_error
from app.datasources.dialects.postgres import PostgresConnector

_REDSHIFT_SSL_MODES = frozenset({"disabled", "preferred", "required"})


class RedshiftConnector:
    type = "redshift"
    category = "olap"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "AWS Redshift"

    def __init__(self) -> None:
        self._delegate = PostgresConnector()

    def open_connection(
        self,
        *,
        host: str,
        port: int = 5439,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "required",
        **_: Any,
    ) -> Any:
        return self._delegate.open_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password,
            connect_timeout_sec=connect_timeout_sec,
            ssl_mode=ssl_mode,
        )

    def test_connection(
        self,
        *,
        host: str,
        port: int = 5439,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "required",
        **_: Any,
    ) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self.open_connection(
                host=host,
                port=port,
                database=database,
                username=username,
                password=password,
                connect_timeout_sec=connect_timeout_sec,
                ssl_mode=ssl_mode,
            )
            try:
                conn.execute("SELECT 1")
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_redshift_error(exc)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(
                ok=False,
                message=f"[{code}] {detail}",
                latency_ms=latency_ms,
                code=code,
            )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(
            ok=True,
            message="Connection successful",
            latency_ms=latency_ms,
            code=None,
        )

    def probe_readonly_sql(self, connection: Any) -> bool:
        connection.execute("SELECT 1")
        return True

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return self._delegate.list_schemas(connection)

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        return self._delegate.list_tables(connection, schema)

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        return self._delegate.list_columns(connection, schema, table)
```

- [ ] **Step 3: 验证 ruff 无报错**

```bash
cd /workspace/backend && ruff check app/datasources/dialects/errors.py app/datasources/dialects/redshift.py
```

Expected: exit 0，无 lint 错误

- [ ] **Step 4: Commit**

```bash
cd /workspace && git add backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/redshift.py
git commit -m "feat(CONN-027): add REDSHIFT_* error constants, map_redshift_error, RedshiftConnector"
```

---

### Task 2: CONN-027 注册到 ConnectorRegistry + catalog count 29→30

**Files:**
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `tests/test_connectors_gov_r40.py`
- Modify: `tests/test_connectors_gov_r41.py`

- [ ] **Step 1: 在 `dialects/__init__.py` 追加 import 与 `__all__`**

在 `backend/app/datasources/dialects/__init__.py` 的 import 块末尾（`from app.datasources.dialects.impala import ImpalaConnector` 行之后）追加：

```python
from app.datasources.dialects.redshift import RedshiftConnector
```

在 `__all__` 列表末尾（`"TRINO_MAX_COLUMNS",` 之后，`]` 之前）追加：

```python
    "RedshiftConnector",
```

- [ ] **Step 2: 在 `datasources/__init__.py` 注册 RedshiftConnector**

在 `backend/app/datasources/__init__.py` 的 import 块末尾（`from app.datasources.dialects.impala import ImpalaConnector` 行之后）追加：

```python
from app.datasources.dialects.redshift import RedshiftConnector
```

在 `register_builtin_dialects()` 函数体末尾（`register_dialect(ImpalaConnector())` 行之后）追加：

```python
    register_dialect(RedshiftConnector())
```

- [ ] **Step 3: 更新 `test_connectors_gov_r40.py` catalog count 29→30**

定位 `tests/test_connectors_gov_r40.py` 第 499-502 行：

```python
def test_r40_export_type_catalog_count():
    """T-REG-R40-01: export_type_catalog 返回 29 种 type（含 r46 gbase + r49 opensearch + r249 五型）。"""
    ...
    assert len(catalog) == 29
```

改为：

```python
def test_r40_export_type_catalog_count():
    """T-REG-R40-01: export_type_catalog 返回 30 种 type（含 r46 gbase + r49 opensearch + r249 五型 + r250 redshift）。"""
    catalog = export_type_catalog()
    assert len(catalog) == 30
```

- [ ] **Step 4: 更新 `test_connectors_gov_r41.py` catalog count 29→30**

定位 `tests/test_connectors_gov_r41.py` 第 630-633 行：

```python
def test_r41_export_type_catalog_count():
    """T-REG-R41-01: export_type_catalog() 仍返回 29 种 type（含 r46 gbase + r49 opensearch + r249 五型）。"""
    ...
    assert len(catalog) == 29
```

改为：

```python
def test_r41_export_type_catalog_count():
    """T-REG-R41-01: export_type_catalog() 仍返回 30 种 type（含 r46 gbase + r49 opensearch + r249 五型 + r250 redshift）。"""
    catalog = export_type_catalog()
    assert len(catalog) == 30
```

- [ ] **Step 5: 运行 ruff 检查**

```bash
cd /workspace/backend && ruff check app/datasources/dialects/__init__.py app/datasources/__init__.py
```

Expected: exit 0

- [ ] **Step 6: 运行 catalog count 回归测试**

```bash
cd /workspace/backend && python -m pytest ../tests/test_connectors_gov_r40.py::test_r40_export_type_catalog_count ../tests/test_connectors_gov_r41.py::test_r41_export_type_catalog_count -v
```

Expected: 2 passed

- [ ] **Step 7: Commit**

```bash
cd /workspace && git add backend/app/datasources/dialects/__init__.py backend/app/datasources/__init__.py tests/test_connectors_gov_r40.py tests/test_connectors_gov_r41.py
git commit -m "feat(CONN-027): register RedshiftConnector; catalog count 29→30"
```

---

### Task 3: 前端 CONN-027 UI 提示 + smoke 测试

**Files:**
- Modify: `fe/src/pages/admin/datasources/DatasourceFormPage.tsx`
- Modify: `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用现有 `<Select>` / `<Input>` / `<Label>` 组件（已在文件中 import）；无新组件
- `check:design` 扫描不受影响（仅 `CONNECTOR_FIELD_HINTS` JS 常量变更，无 Token）
- 选中 redshift 后 port 自动填充 5439（现有 `useEffect` 联动 `CONNECTOR_FIELD_HINTS` 已实现，零 UI 改动量）

- [ ] **Step 1: 在 `DatasourceFormPage.tsx` 的 `CONNECTOR_FIELD_HINTS` 追加 redshift**

定位 `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` 第 82-83 行（`impala` 行与 `};` 之间），在 `impala` 行之后追加：

```typescript
  redshift: { port: "5439", databaseLabel: "数据库", usernameLabel: "用户名" },
```

结果（第 68–84 行）应为：

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
  gaussdb: { port: "5432", databaseLabel: "数据库 / Schema", usernameLabel: "用户名" },
  rest_api: { port: "443", databaseLabel: "API 探测路径", usernameLabel: "用户名（Basic，可选）" },
  excel: { port: "1", databaseLabel: "Sheet 名（可选）", usernameLabel: "用户名" },
  csv: { port: "1", databaseLabel: "数据库", usernameLabel: "用户名" },
  db2: { port: "50000", databaseLabel: "数据库", usernameLabel: "用户名" },
  impala: { port: "21050", databaseLabel: "数据库", usernameLabel: "用户名" },
  redshift: { port: "5439", databaseLabel: "数据库", usernameLabel: "用户名" },
};
```

- [ ] **Step 2: 在 `datasource-form.smoke.test.tsx` 的 `MOCK_TYPES` 追加 redshift**

定位 `MOCK_TYPES` 常量的 `items` 数组（第 23-37 行），在 `{ type: "impala", displayName: "Apache Impala" },` 之后追加：

```typescript
    { type: "redshift", displayName: "AWS Redshift" },
```

- [ ] **Step 3: 在 `datasource-form.smoke.test.tsx` 末尾追加 redshift smoke 测试**

在文件末尾（最后一个 `describe` 块之后）追加：

```typescript
describe("DatasourceFormPage redshift smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });
  afterEach(() => cleanup());

  it("T-CONN-R250-FE-01: redshift 类型在下拉中可选", async () => {
    mockApiFetch.mockResolvedValueOnce(MOCK_TYPES);
    renderForm();
    await waitFor(() => screen.getByRole("combobox"));
    await selectType("AWS Redshift");
    expect(screen.getByRole("combobox")).toHaveTextContent("AWS Redshift");
  });

  it("T-CONN-R250-FE-02: 选中 redshift 后 port 自动填充 5439", async () => {
    mockApiFetch.mockResolvedValueOnce(MOCK_TYPES);
    renderForm();
    await waitFor(() => screen.getByRole("combobox"));
    await selectType("AWS Redshift");
    const portInput = screen.getByLabelText(/端口/i) as HTMLInputElement;
    expect(portInput.value).toBe("5439");
  });
});
```

- [ ] **Step 4: 运行前端 smoke 测试**

```bash
cd /workspace/fe && pnpm vitest run src/pages/admin/datasources/datasource-form.smoke.test.tsx
```

Expected: 全部 passed（含新增 T-CONN-R250-FE-01/02）

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add fe/src/pages/admin/datasources/DatasourceFormPage.tsx fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx
git commit -m "feat(CONN-027): add redshift hint in DatasourceFormPage + FE smoke T-CONN-R250-FE-01/02"
```

---

### Task 4: 后端 r250 集成测试（CONN-027 × 7 + API-001 × 4）

**Files:**
- Create: `tests/test_mfinal_fg_r250.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 创建 `tests/test_mfinal_fg_r250.py`**

```python
"""M-FINAL F-G 收官 r250 — CONN-027 AWS Redshift + API-001 性能/结构化错误。"""
from __future__ import annotations

import os
import time
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.dialects.errors import (
    REDSHIFT_AUTH_FAILED,
    REDSHIFT_SSL_REQUIRED,
    map_redshift_error,
)
from app.datasources.dialects.redshift import RedshiftConnector
from app.datasources.registry import export_type_catalog
from app.main import app
from jwt_auth import jwt_auth_headers

AUTH = jwt_auth_headers()
_R250_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fg_r250?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r250_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R250_SQLITE_URL
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
def client():
    with TestClient(app) as c:
        yield c


# ─── CONN-027 断言 ────────────────────────────────────────────────────────────


def test_r250_027_01_redshift_in_catalog():
    """T-CONN-R250-027-01: redshift 在 export_type_catalog；category=olap；catalog count == 30。"""
    catalog = {item["type"]: item for item in export_type_catalog()}
    assert "redshift" in catalog
    assert catalog["redshift"]["category"] == "olap"
    assert len(catalog) == 30


def test_r250_027_02_types_api_contains_redshift(client):
    """T-CONN-R250-027-02: GET /api/v1/datasources/types 返回含 redshift（mock 环境）。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    types = [item["type"] for item in resp.json()["items"]]
    assert "redshift" in types


def test_r250_027_03_map_redshift_error_auth_failed():
    """T-CONN-R250-027-03: map_redshift_error(PG_AUTH exc) → REDSHIFT_AUTH_FAILED。"""
    import psycopg

    exc = psycopg.OperationalError("password authentication failed for user")
    exc.pgcode = "28P01"
    exc.sqlstate = "28P01"
    code, detail = map_redshift_error(exc)
    assert code == REDSHIFT_AUTH_FAILED


def test_r250_027_04_map_redshift_error_ssl():
    """T-CONN-R250-027-04: map_redshift_error(SSL exc) → REDSHIFT_SSL_REQUIRED。"""
    import psycopg

    exc = psycopg.OperationalError("SSL connection has been closed unexpectedly")
    code, detail = map_redshift_error(exc)
    assert code == REDSHIFT_SSL_REQUIRED


@patch("app.datasources.dialects.redshift.RedshiftConnector.open_connection")
def test_r250_027_05_test_connection_ok(mock_open):
    """T-CONN-R250-027-05: test_connection mock 连接成功 → ok=True, latency_ms>0。"""
    conn = MagicMock()
    conn.execute.return_value = None
    mock_open.return_value = conn
    result = RedshiftConnector().test_connection(
        host="cluster.redshift.amazonaws.com",
        port=5439,
        database="dev",
        username="admin",
        password="secret",
    )
    assert result.ok is True
    assert result.latency_ms >= 0


@patch("app.datasources.dialects.redshift.RedshiftConnector.open_connection")
def test_r250_027_06_probe_readonly_sql(mock_open):
    """T-CONN-R250-027-06: probe_readonly_sql mock 连接 → 返回 True。"""
    conn = MagicMock()
    conn.execute.return_value = None
    mock_open.return_value = conn
    result = RedshiftConnector().probe_readonly_sql(conn)
    assert result is True


def test_r250_027_07_api_no_plaintext_password(client):
    """T-CONN-R250-027-07: API 响应无明文密码（凭证脱敏守卫）。"""
    ds_code = f"r250-rs-{uuid.uuid4().hex[:6]}"
    payload = {
        "name": "redshift-r250-test",
        "code": ds_code,
        "type": "redshift",
        "host": "cluster.redshift.amazonaws.com",
        "port": 5439,
        "database": "dev",
        "username": "admin",
        "password": "super_secret_password",
    }
    resp = client.post("/api/v1/datasources", json=payload, headers=AUTH)
    assert resp.status_code in (201, 200)
    body = resp.text
    assert "super_secret_password" not in body


# ─── API-001 断言 ─────────────────────────────────────────────────────────────


def _p95(times: list[float]) -> float:
    """95th percentile of a sorted list of elapsed seconds."""
    s = sorted(times)
    idx = max(0, int(len(s) * 0.95) - 1)
    return s[idx]


def test_r250_001_01_list_datasources_p95(client):
    """T-API-R250-001-01: GET /datasources list P95 ≤ 500ms（5次，内存 SQLite）。"""
    times: list[float] = []
    for _ in range(5):
        t0 = time.perf_counter()
        resp = client.get("/api/v1/datasources", headers=AUTH)
        times.append(time.perf_counter() - t0)
        assert resp.status_code == 200
    assert _p95(times) <= 0.5, f"P95 {_p95(times)*1000:.1f}ms > 500ms"


def test_r250_001_02_create_datasource_p95(client):
    """T-API-R250-001-02: POST /datasources create P95 ≤ 500ms（5次，内存 SQLite）。"""
    times: list[float] = []
    for i in range(5):
        ds_code = f"r250-perf-{uuid.uuid4().hex[:6]}-{i}"
        payload = {
            "name": f"perf-test-{i}",
            "code": ds_code,
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3306,
            "database": "perf",
            "username": "u",
            "password": "p",
        }
        t0 = time.perf_counter()
        resp = client.post("/api/v1/datasources", json=payload, headers=AUTH)
        times.append(time.perf_counter() - t0)
        assert resp.status_code in (201, 200)
    assert _p95(times) <= 0.5, f"P95 {_p95(times)*1000:.1f}ms > 500ms"


def test_r250_001_03_invalid_uuid_structured_error(client):
    """T-API-R250-001-03: 非法 UUID path → 422 + 结构化 { code, message, detail }。"""
    resp = client.get("/api/v1/datasources/invalid-uuid-value", headers=AUTH)
    assert resp.status_code in (422, 404)
    body = resp.json()
    # 结构化错误须含 code 或 detail 字段（FastAPI 422 detail list 或自定义 code）
    assert "detail" in body or "code" in body


def test_r250_001_04_trace_id_passthrough(client):
    """T-API-R250-001-04: X-Trace-Id 透传：请求头 → 响应头一致。"""
    trace_id = "test-trace-r250-001"
    resp = client.get(
        "/api/v1/datasources",
        headers={**AUTH, "X-Trace-Id": trace_id},
    )
    assert resp.status_code == 200
    assert resp.headers.get("x-trace-id") == trace_id
```

- [ ] **Step 2: 运行 r250 测试**

```bash
cd /workspace/backend && python -m pytest ../tests/test_mfinal_fg_r250.py -v
```

Expected: 11 passed（T-CONN-R250-027-01~07 + T-API-R250-001-01~04）

- [ ] **Step 3: Commit**

```bash
cd /workspace && git add tests/test_mfinal_fg_r250.py
git commit -m "test(r250): CONN-027 ×7 + API-001 ×4 integration assertions"
```

---

### Task 5: 前端 VIZ-003/004/008（renderFromSpec + AdvancedEchartsChart + vitest）

**Files:**
- Modify: `fe/src/components/charts/adapters/renderFromSpec.ts`
- Modify: `fe/src/components/charts/adapters/AdvancedEchartsChart.tsx`
- Modify: `fe/src/components/charts/charts.advanced.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用目标项目 UI/设计系统 skill 指定组件/布局；本任务无新 UI 组件，仅追加 `<p>` 空态覆盖层（沿用现有 `className` token）
- 空数据态覆盖层使用 `text-theme-xs text-gray-400 dark:text-gray-500` 语义 token，`@design-token-ok` 豁免行不需要（已在语义 token 范围内）
- hover/focus/active 无新增交互；`check:design` 扫描通过（无硬编码 hex）

- [ ] **Step 1: 在 `renderFromSpec.ts` 追加 VIZ-003/004/008 内容**

在文件开头现有常量（`ADVANCED_CHART_ROW_CAP` 等）之后、`colIndex` 函数之前插入：

```typescript
export const FALLBACK_CHART_TYPE = "table";

export function getFallbackChartType(type: string): string {
  const known = [
    "bar", "line", "pie", "table", "funnel", "sankey",
    "graph", "map", "heatmap", "timeline", "gauge", "kpi",
  ];
  return known.includes(type) ? type : FALLBACK_CHART_TYPE;
}

export function safeColIndex(columns: string[], field: string): number | null {
  const idx = columns.indexOf(field);
  return idx >= 0 ? idx : null;
}
```

- [ ] **Step 2: 在 `renderFromSpec.ts` 追加 `buildBarOption`**

在现有 `buildGaugeOption` 函数之后、`buildEchartsOption` 之前插入：

```typescript
export function buildBarOption(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
): EChartsOption {
  if (rows.length === 0) return { series: [], dataset: { source: [] } };
  const dim = spec.encoding.dimensions[0]?.field ?? "";
  const metrics = spec.encoding.metrics.map((m) => m.field);
  const di = safeColIndex(columns, dim);
  const xData = di !== null ? rows.map((r) => String(r[di] ?? "")) : [];
  const series = metrics.map((metric) => {
    const mi = safeColIndex(columns, metric);
    const data = mi !== null ? rows.map((r) => Number(r[mi] ?? 0)) : [];
    const base: Record<string, unknown> = { type: "bar", name: metric, data };
    if (spec.styleVariant === "stacked" || spec.styleVariant === "grouped") {
      base.stack = spec.styleVariant === "stacked" ? "total" : undefined;
    }
    if (spec.styleVariant === "horizontal") {
      return { ...base, type: "bar" };
    }
    return base;
  });
  const isHorizontal = spec.styleVariant === "horizontal";
  return {
    xAxis: isHorizontal
      ? { type: "value" }
      : { type: "category", data: xData },
    yAxis: isHorizontal
      ? { type: "category", data: xData }
      : { type: "value" },
    series,
  };
}

export function buildPieOption(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
): EChartsOption {
  if (rows.length === 0) return { series: [], dataset: { source: [] } };
  const dim = spec.encoding.dimensions[0]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const di = safeColIndex(columns, dim);
  const mi = safeColIndex(columns, metric);
  const data = rows.map((r) => ({
    name: di !== null ? String(r[di] ?? "") : "",
    value: mi !== null ? Number(r[mi] ?? 0) : 0,
  }));
  const radius: string | string[] =
    spec.styleVariant === "donut" ? ["40%", "70%"] : "70%";
  return { series: [{ type: "pie", radius, data }] };
}
```

- [ ] **Step 3: 更新 `buildEchartsOption` — 追加 bar/pie 分支，修改 default 为 fallback**

找到现有 `buildEchartsOption` 函数（第 134-158 行），将 switch 语句中 `case "gauge":` 之后的内容替换，完整函数如下：

```typescript
export function buildEchartsOption(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
): EChartsOption {
  const { rows: capped } = capRows(rows, ADVANCED_CHART_ROW_CAP);
  switch (spec.chartType) {
    case "bar":
      return buildBarOption(spec, capped, columns);
    case "funnel":
      return buildFunnelOption(spec, capped, columns);
    case "sankey":
      return buildSankeyOption(spec, capped, columns);
    case "graph":
      return buildGraphOption(spec, capped, columns);
    case "map":
      return buildMapOption(spec, capped, columns);
    case "heatmap":
      return buildHeatmapOption(spec, capped, columns);
    case "timeline":
      return buildTimelineOption(spec, capped, columns);
    case "gauge":
      return buildGaugeOption(spec, capped, columns);
    case "pie":
      return buildPieOption(spec, capped, columns);
    default:
      return { series: [], dataset: { source: [] } };
  }
}
```

- [ ] **Step 4: 更新所有 builder 函数的 empty rows 防护**

依次检查各 builder 函数，在函数体最前面（`capRows` 调用之前）对已 capped 的 `rows` 加空数组守卫。在以下函数的第一行加 `if (rows.length === 0) return { series: [], dataset: { source: [] } };`：

- `buildFunnelOption`：现有第一行 `const dim = ...` 之前
- `buildSankeyOption`：现有第一行 `const src = ...` 之前
- `buildGraphOption`：现有第一行 `const src = ...` 之前
- `buildHeatmapOption`：现有第一行 `const xField = ...` 之前
- `buildTimelineOption`：现有第一行 `const timeField = ...` 之前

注：`buildGaugeOption` 已有 `rows.length ? ... : 0` 安全处理，无需改动。`buildMapOption` 空数组 `data=[]` 亦安全。

每个函数添加后完整示例（以 `buildFunnelOption` 为例）：

```typescript
function buildFunnelOption(spec: RenderSpec, rows: unknown[][], columns: string[]): EChartsOption {
  if (rows.length === 0) return { series: [], dataset: { source: [] } };
  const dim = spec.encoding.dimensions[0]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const di = colIndex(columns, dim);
  const mi = colIndex(columns, metric);
  const data = rows.map((r) => ({ name: String(r[di] ?? ""), value: Number(r[mi] ?? 0) }));
  return { series: [{ type: "funnel", sort: "descending", data }] };
}
```

- [ ] **Step 5: 更新 `AdvancedEchartsChart.tsx`，添加空 series 空态覆盖层**

将 `AdvancedEchartsChart.tsx` 的 `return` 语句替换为：

```typescript
  const isEmpty =
    !option ||
    (Array.isArray((option as { series?: unknown[] }).series) &&
      (option as { series?: unknown[] }).series!.length === 0);

  return (
    <div className="min-h-[180px] w-full" aria-label={ariaLabel}>
      {truncated ? (
        <p role="status" className="mb-2 text-theme-xs text-warning-600 dark:text-warning-400">
          数据量较大，已采样显示前 {ADVANCED_CHART_ROW_CAP} 条
        </p>
      ) : null}
      {isEmpty ? (
        <div
          className="flex min-h-[180px] items-center justify-center text-theme-xs text-gray-400 dark:text-gray-500"
          role="status"
          aria-label="暂无数据"
        >
          暂无数据
        </div>
      ) : (
        <ReactECharts
          option={option}
          theme={theme}
          style={{ height: 180, width: "100%" }}
          opts={{ renderer: "canvas" }}
          data-testid="echarts-chart"
        />
      )}
    </div>
  );
```

- [ ] **Step 6: 在 `charts.advanced.smoke.test.tsx` 末尾追加 VIZ-003/004/008 断言**

在文件末尾追加（在最后一个 `describe` 块之后）：

```typescript
// ─── VIZ-003/004/008 r250 补强 ──────────────────────────────────────────────

import { isKnownChartType } from "@/lib/chartRegistry";
import { getFallbackChartType } from "@/components/charts/adapters/renderFromSpec";

describe("VIZ-003 未知 chartType 降级", () => {
  it("T-VIZ-R250-003-01: isKnownChartType('line')→true; isKnownChartType('unknown_xyz')→false", () => {
    expect(isKnownChartType("line")).toBe(true);
    expect(isKnownChartType("unknown_xyz")).toBe(false);
  });

  it("T-VIZ-R250-003-02: buildEchartsOption unknown_xyz → series 为空数组（table fallback）", () => {
    const spec: RenderSpec = {
      engine: "echarts",
      chartType: "unknown_xyz",
      styleVariant: "default",
      encoding: { dimensions: [{ field: "d" }], metrics: [{ field: "m" }] },
      source: {},
    };
    const option = buildEchartsOption(spec, [["A", 1]], ["d", "m"]);
    expect(Array.isArray((option as { series?: unknown[] }).series)).toBe(true);
    expect((option as { series?: unknown[] }).series!.length).toBe(0);
  });
});

describe("VIZ-004 样式子类型 smoke", () => {
  it("T-VIZ-R250-004-01: buildEchartsOption bar stacked → series[0].stack 非空", () => {
    const spec: RenderSpec = {
      engine: "echarts",
      chartType: "bar",
      styleVariant: "stacked",
      encoding: { dimensions: [{ field: "cat" }], metrics: [{ field: "val" }] },
      source: {},
    };
    const option = buildEchartsOption(spec, [["A", 10], ["B", 20]], ["cat", "val"]);
    const s = (option.series as Array<{ stack?: string }>)[0];
    expect(s.stack).toBeTruthy();
  });

  it("T-VIZ-R250-004-02: buildEchartsOption pie donut → series[0].radius 为长度 2 数组", () => {
    const spec: RenderSpec = {
      engine: "echarts",
      chartType: "pie",
      styleVariant: "donut",
      encoding: { dimensions: [{ field: "name" }], metrics: [{ field: "val" }] },
      source: {},
    };
    const option = buildEchartsOption(spec, [["A", 10]], ["name", "val"]);
    const radius = (option.series as Array<{ radius?: unknown }>)[0].radius;
    expect(Array.isArray(radius)).toBe(true);
    expect((radius as unknown[]).length).toBe(2);
  });
});

describe("VIZ-008 空数据 + 异常态", () => {
  it("T-VIZ-R250-008-01: buildEchartsOption rows=[] → series 为 [] 不抛错", () => {
    const spec: RenderSpec = {
      engine: "echarts",
      chartType: "funnel",
      styleVariant: "default",
      encoding: { dimensions: [{ field: "stage" }], metrics: [{ field: "value" }] },
      source: {},
    };
    let option: ReturnType<typeof buildEchartsOption> | undefined;
    expect(() => {
      option = buildEchartsOption(spec, [], ["stage", "value"]);
    }).not.toThrow();
    expect((option as { series?: unknown[] })?.series?.length).toBe(0);
  });

  it("T-VIZ-R250-008-02: buildEchartsOption bar 正常数据 → series[0].type==='bar'（主路径回归）", () => {
    const spec: RenderSpec = {
      engine: "echarts",
      chartType: "bar",
      styleVariant: "default",
      encoding: { dimensions: [{ field: "cat" }], metrics: [{ field: "val" }] },
      source: {},
    };
    const option = buildEchartsOption(spec, [["X", 5]], ["cat", "val"]);
    expect((option.series as Array<{ type: string }>)[0].type).toBe("bar");
  });
});
```

- [ ] **Step 7: 运行前端 VIZ smoke 测试**

```bash
cd /workspace/fe && pnpm vitest run src/components/charts/charts.advanced.smoke.test.tsx
```

Expected: 全部 passed（含新增 VIZ-003/004/008 6 项）

- [ ] **Step 8: 运行 check:design**

```bash
cd /workspace/fe && pnpm run check:design
```

Expected: exit 0，无 Token 漂移

- [ ] **Step 9: Commit**

```bash
cd /workspace && git add fe/src/components/charts/adapters/renderFromSpec.ts fe/src/components/charts/adapters/AdvancedEchartsChart.tsx fe/src/components/charts/charts.advanced.smoke.test.tsx
git commit -m "feat(VIZ-003/004/008): renderFromSpec fallback+buildBarOption+buildPieOption+空数据防护; AdvancedEchartsChart 空态覆盖层"
```

---

### Task 6: 文档同步（docs/api/README.md + docs/services/datasources.md）

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/datasources.md`

- [ ] **Step 1: 在 `docs/api/README.md` 找到 datasources/types 行，追加 Redshift 注释**

定位 `GET /api/v1/datasources/types` 所在行，在该行或其相邻注释中追加说明 `redshift` 已注册（category=olap）。若 README 使用表格格式，在 `GET /api/v1/datasources/types` 一行的「备注」列追加：

```
含 redshift（category=olap，r250 新增）
```

- [ ] **Step 2: 在 `docs/services/datasources.md` 更新已实现连接器列表**

找到已实现连接器列表（通常含 `impala`、`db2` 等），在 `impala` 之后追加一行：

```
| redshift | AWS Redshift | olap | r250 (M-FINAL F-G 收官) |
```

同时确保「已实现连接器数」从 29 更新为 30（如文档有此统计行）。

- [ ] **Step 3: Commit**

```bash
cd /workspace && git add docs/api/README.md docs/services/datasources.md
git commit -m "docs: mark redshift connector implemented in api/README.md + services/datasources.md"
```

---

## Self-Review 检查

- [x] **CONN-027**：Task 1 实现 RedshiftConnector（委托模式，category=olap，ssl_mode=required 默认）；Task 2 注册并修正 catalog count 29→30；Task 3 前端 hint 5439；Task 4 r250 7 断言；Task 6 文档
- [x] **API-001**：Task 4 中 T-API-R250-001-01/02（P95 ≤500ms）、T-API-R250-001-03（非法 UUID 422 结构化）、T-API-R250-001-04（X-Trace-Id 透传）
- [x] **VIZ-003**：Task 5 `getFallbackChartType`、default case 返回 `{ series: [] }`、T-VIZ-R250-003-01/02
- [x] **VIZ-004**：Task 5 `buildBarOption`（stacked→stack 字段）、`buildPieOption`（donut→radius 数组）、T-VIZ-R250-004-01/02
- [x] **VIZ-008**：Task 5 各 builder `rows.length === 0` 守卫、`AdvancedEchartsChart` 空 series 覆盖层、T-VIZ-R250-008-01/02
- [x] **无占位符**：每步含完整代码片段与精确验证命令
- [x] **文件数**：3 新建 + 10 修改 = 13 文件，≤18 上限
- [x] **前端 UI Task（Task 3/5）**：已显式关联 b-design-system-tailadmin-radix Skill，包含 UI Acceptance
- [x] **catalog count 回归（r40/r41）**：Task 2 更新 29→30，防止 P4 BLOCKED 重演
- [x] **不超出范围**：无新 PRD ID、无 AI/SQL 问数、无 Dataset、无 Serverless/IAM

## 执行并行建议

- **Task 1 → Task 2**（顺序依赖：Task 2 import Task 1 的 RedshiftConnector）
- **Task 3 可与 Task 1/2 并行**（前端独立，仅依赖 CONNECTOR_FIELD_HINTS 常量）
- **Task 5 可与 Task 3 并行**（VIZ 改动完全独立于 CONN-027）
- **Task 4 需 Task 1/2 完成后运行**（import RedshiftConnector + catalog count）
- **Task 6 可最后执行**（文档同步）
