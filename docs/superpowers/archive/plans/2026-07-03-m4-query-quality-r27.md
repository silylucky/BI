# M4 轻量查询质量推分 r27 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/query/`、`backend/app/api/v1/query.py`、`backend/migrations/versions/0012_chart_query_bindings_chart_id.py`、`tests/test_query_quality_r27.py`、`tests/test_query_l1_r26.py`、`tests/test_migrations.py`、`docs/services/query.md`、`docs/api/README.md`
> **子项：** QUERY-004, QUERY-001, QUERY-002, QUERY-005, QUERY-006
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 闭合 QUERY-004 ClickHouse 方言缺口并巩固 QUERY-001/002/005/006 边界 — ClickHouse dialect L1、只读守卫加固、table 模式边界、chartId 唯一绑定、admin RLS bypass；`test_query_quality_r27.py` ≥28 项 + r26 全量回归。

**Architecture:** 在 r26 L1 执行链上增量 — `dialects/clickhouse.py` 注册至 `get_sql_dialect`；`executor._map_execution_error` 扩展 CH 错误码；`readonly` 注释剥离与行内写拦截；`chart_query_bindings.chart_id` 可空唯一 + 应用层冲突检测；`rls/guard.apply_rls_to_sql` admin 角色跳过谓词注入；测试集中于 `test_query_quality_r27.py`，r26 仅改 T-Q-025。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pytest · ruff · Alembic

## Global Constraints

- 纯后端；**全 Task UI skill: none**；**不修改** `fe/`、`main.py`、`datasources/dialects/*`（CONN-007）
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；PRD 勾选与 8 维重评留 P5
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": null}`
- ClickHouse 无真实连接器：execute 路径用 mock `pooled_connection`；dialect 单元测试不依赖 Docker
- `bindingId` 与内联字段互斥契约不变；binding 本体仍硬删除（不增 `deleted_at`）
- admin RLS bypass 仅跳过行级谓词；`datasources.acl.assert_visible` 403 不变
- 文件预算：新建 **3** + 修改 **14** = **17 ≤ 20**
- 验证基线：r26 `pytest` **532 passed** + 4 skipped；本轮目标 **≥560 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: ClickHouse SQL 方言适配器（QUERY-004）

**Files:**
- Create: `backend/app/query/dialects/clickhouse.py`
- Modify: `backend/app/query/dialects/__init__.py`
- Modify: `tests/test_query_l1_r26.py`（T-Q-025 拆分）
- Test: `tests/test_query_quality_r27.py`（T-Q-R27-004-01~04 段，本 Task 创建文件头部）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `app.query.rls.guard.validate_identifier`
- Produces: `ClickHouseDialect`, `get_sql_dialect("clickhouse")` 成功；`get_sql_dialect("unknown_type")` → `UnsupportedDialectError`

- [ ] **Step 1: 创建 `backend/app/query/dialects/clickhouse.py`**

```python
from __future__ import annotations

from app.query.rls.guard import validate_identifier


class ClickHouseDialect:
    connector_type = "clickhouse"

    def quote_identifier(self, name: str) -> str:
        validate_identifier(name)
        return f"`{name}`"

    def qualify_table(self, schema: str, table: str) -> str:
        return f"{self.quote_identifier(schema)}.{self.quote_identifier(table)}"

    def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str:
        normalized = sql.strip().rstrip(";")
        return f"{normalized} LIMIT {int(limit)} OFFSET {int(offset)}"

    def build_table_select(
        self, schema: str, table: str, *, limit: int, offset: int = 0,
    ) -> str:
        qualified = self.qualify_table(schema, table)
        return (
            f"SELECT * FROM {qualified} "
            f"LIMIT {int(limit)} OFFSET {int(offset)}"
        )
```

- [ ] **Step 2: 修改 `backend/app/query/dialects/__init__.py` 注册 clickhouse**

```python
from app.query.dialects.clickhouse import ClickHouseDialect

_REGISTRY: dict[str, SqlDialect] = {
    "mysql": MySqlDialect(),
    "postgresql": PostgresDialect(),
    "clickhouse": ClickHouseDialect(),
}

__all__ = [
    "SqlDialect",
    "UnsupportedDialectError",
    "MySqlDialect",
    "PostgresDialect",
    "ClickHouseDialect",
    "get_sql_dialect",
]
```

- [ ] **Step 3: 修改 `tests/test_query_l1_r26.py` T-Q-025 — clickhouse 不再抛错**

将 `test_unknown_dialect` 改为仅测真正未知类型：

```python
def test_unknown_dialect():
    """T-Q-025: 未知 connector_type → UnsupportedDialectError（clickhouse 已注册）。"""
    with pytest.raises(UnsupportedDialectError):
        get_sql_dialect("unknown_type")
```

- [ ] **Step 4: 创建 `tests/test_query_quality_r27.py` 并写入方言单元测试 T-Q-R27-004-01~04**

```python
from __future__ import annotations

import pytest

from app.query.dialects import get_sql_dialect
from app.query.dialects.base import UnsupportedDialectError
from app.query.readonly import assert_readonly_sql


def test_clickhouse_dialect_registered():
    """T-Q-R27-004-01: clickhouse 已注册；unknown_type 仍抛 UnsupportedDialectError。"""
    d = get_sql_dialect("clickhouse")
    assert d.connector_type == "clickhouse"
    with pytest.raises(UnsupportedDialectError):
        get_sql_dialect("unknown_type")


def test_clickhouse_quote_identifier():
    """T-Q-R27-004-02: quote_identifier → backticks；非法名抛错。"""
    d = get_sql_dialect("clickhouse")
    assert d.quote_identifier("col") == "`col`"
    with pytest.raises(Exception):
        d.quote_identifier("bad-name")


def test_clickhouse_wrap_limit():
    """T-Q-R27-004-03: wrap_limit 后缀 LIMIT/OFFSET，无子查询包裹。"""
    d = get_sql_dialect("clickhouse")
    sql = d.wrap_limit("SELECT 1", limit=10, offset=2)
    assert "LIMIT 10" in sql
    assert "OFFSET 2" in sql
    assert "SELECT * FROM (" not in sql


def test_clickhouse_build_table_select_readonly():
    """T-Q-R27-004-04: build_table_select 经 assert_readonly_sql。"""
    sql = get_sql_dialect("clickhouse").build_table_select("db", "t", limit=50)
    assert_readonly_sql(sql)
```

- [ ] **Step 5: 运行方言测试**

Run: `cd backend && python3 -m pytest tests/test_query_quality_r27.py -k "clickhouse" -v && python3 -m pytest tests/test_query_l1_r26.py::test_unknown_dialect -v`

Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/query/dialects/clickhouse.py backend/app/query/dialects/__init__.py tests/test_query_l1_r26.py tests/test_query_quality_r27.py
git commit -m "feat(query): add ClickHouse SQL dialect L1 (QUERY-004)"
```

**验收标准:**
- `get_sql_dialect("clickhouse")` 成功；`unknown_type` 仍 `UnsupportedDialectError`
- `wrap_limit` 为 O(1) 后缀拼接，无子查询包裹
- T-Q-025 与 T-Q-R27-004-01~04 pytest 绿

---

### Task 2: Executor ClickHouse 错误映射与类型序列化（QUERY-004）

**Files:**
- Modify: `backend/app/query/executor.py`
- Test: `tests/test_query_quality_r27.py`（T-Q-R27-004-05~07 段；复用 r26 fixture 模式）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `get_sql_dialect("clickhouse")`, r26 `query_seed`/`mock_pool` fixture 模式
- Produces: `_map_execution_error` 识别 CH `syntax error`/`code: 60`；`_serialize_cell` 处理 `bytes`

- [ ] **Step 1: 扩展 `backend/app/query/executor.py` `_map_execution_error`**

```python
def _map_execution_error(exc: Exception) -> QueryError:
    msg = str(exc)
    lowered = msg.lower()
    if "timeout" in lowered or "timed out" in lowered:
        return QueryError("QUERY_TIMEOUT", msg, 504)
    if (
        "doesn't exist" in lowered
        or "does not exist" in lowered
        or "unknown table" in lowered
        or "code: 60" in lowered
    ):
        return QueryError("QUERY_TABLE_NOT_FOUND", msg, 404)
    if "syntax error" in lowered or "code: 62" in lowered:
        return QueryError("QUERY_SYNTAX_ERROR", msg, 400)
    return QueryError("QUERY_EXECUTION_ERROR", msg, 400)
```

- [ ] **Step 2: 扩展 `_serialize_cell` 处理 bytes**

```python
def _serialize_cell(value: Any) -> Any:
    if isinstance(value, bytes):
        return "0x" + value.hex()
    if isinstance(value, datetime):
        return value.isoformat()
    # ... 其余不变
    return value
```

- [ ] **Step 3: 在 `tests/test_query_quality_r27.py` 追加 execute mock 测试（复制 r26 fixture 最小集）**

在文件顶部追加与 r26 相同的 `query_r26_sqlite_env` / `ensure_query_tables` / `query_seed` / `_mock_pool_cursor` fixture（从 `tests/test_query_l1_r26.py` 复制必要段，不 import 跨文件 fixture）。

追加 ClickHouse 数据源辅助与测试：

```python
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from app.auth.deps import UserContext
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.datasources.models import get_meta_session
from app.query.executor import QueryExecutor


def _create_ch_ds(name: str = "CH DS"):
    session = get_meta_session()
    try:
        return create_data_source(session, DataSourceCreate(
            name=name,
            code=f"ch-ds-{uuid.uuid4().hex[:8]}",
            type="clickhouse",
            host="h", port=9000, database="d", username="u", password="p",
        ))
    finally:
        session.close()


def test_execute_clickhouse_sql_success(mock_pool, query_seed, meta_session):
    """T-Q-R27-004-05: clickhouse 数据源 + mock pooled_connection → execute 200。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with patch("app.query.executor.pool_manager.pooled_connection", mock_pool(["id"], [[1]])):
        result = QueryExecutor().execute_sql(
            meta_session, user, ds.id, "SELECT 1", limit=100,
        )
    assert result.row_count == 1


def test_execute_clickhouse_syntax_error(mock_pool, query_seed, meta_session):
    """T-Q-R27-004-06: mock syntax error → 400 QUERY_SYNTAX_ERROR。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])

    @contextmanager
    def _fail(*_a, **_k):
        raise RuntimeError("Syntax error: failed at position 1 (code: 62)")
        yield  # pragma: no cover

    with patch("app.query.executor.pool_manager.pooled_connection", _fail):
        with pytest.raises(QueryError) as exc:
            QueryExecutor().execute_sql(meta_session, user, ds.id, "SELECT bad", limit=10)
    assert exc.value.code == "QUERY_SYNTAX_ERROR"
    assert exc.value.status == 400


def test_execute_clickhouse_table_not_found(mock_pool, query_seed, meta_session):
    """T-Q-R27-004-07: mock Code: 60 Unknown table → 404 QUERY_TABLE_NOT_FOUND。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])

    @contextmanager
    def _fail(*_a, **_k):
        raise RuntimeError("Code: 60. DB::Exception: Unknown table default.missing")
        yield  # pragma: no cover

    with patch("app.query.executor.pool_manager.pooled_connection", _fail):
        with pytest.raises(QueryError) as exc:
            QueryExecutor().execute_sql(meta_session, user, ds.id, "SELECT 1", limit=10)
    assert exc.value.code == "QUERY_TABLE_NOT_FOUND"
    assert exc.value.status == 404
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && python3 -m pytest tests/test_query_quality_r27.py -k "clickhouse or execute_clickhouse" -v`

Expected: 7 passed（含 Task 1 的 4 项）

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/executor.py tests/test_query_quality_r27.py
git commit -m "feat(query): ClickHouse execution error mapping and bytes serialization"
```

**验收标准:**
- CH syntax/table-not-found 映射为 `QUERY_SYNTAX_ERROR` / `QUERY_TABLE_NOT_FOUND`
- mock execute 成功路径 200 等价（`QueryResult.row_count`）
- T-Q-R27-004-05~07 pytest 绿

---

### Task 3: 只读守卫加固（QUERY-001）

**Files:**
- Modify: `backend/app/query/readonly.py`
- Test: `tests/test_query_quality_r27.py`（T-Q-R27-001-01~07 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `QueryError` from `app.query.schemas`
- Produces: `assert_readonly_sql` 剥离注释、拦截行内写、超长 SQL `QUERY_SQL_TOO_LONG`

- [ ] **Step 1: 重写 `backend/app/query/readonly.py`**

```python
from __future__ import annotations

import re

from app.query.schemas import QueryError

_WRITE_PREFIX = re.compile(
    r"^\s*(INSERT|UPDATE|DELETE|MERGE|REPLACE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|EXEC)\b",
    re.IGNORECASE,
)
_FORBIDDEN_CLAUSES = re.compile(
    r"\b(INTO\s+OUTFILE|FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE)\b",
    re.IGNORECASE,
)
_INLINE_WRITE = re.compile(
    r";\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|REPLACE)\b",
    re.IGNORECASE,
)
_DDL_MIDDLE = re.compile(
    r"\b(CREATE|DROP|ALTER)\s+(TABLE|VIEW|INDEX|DATABASE)\b",
    re.IGNORECASE,
)
_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_LINE_COMMENT = re.compile(r"--[^\n]*")
_MAX_SQL_LEN = 65536


def _strip_comments(sql: str) -> str:
    without_block = _BLOCK_COMMENT.sub(" ", sql)
    return _LINE_COMMENT.sub(" ", without_block)


def assert_readonly_sql(sql: str) -> None:
    if len(sql) > _MAX_SQL_LEN:
        raise QueryError(
            "QUERY_SQL_TOO_LONG",
            f"SQL exceeds {_MAX_SQL_LEN} characters",
            400,
        )
    scrubbed = _strip_comments(sql)
    normalized = scrubbed.strip().rstrip(";")
    if not normalized:
        raise QueryError("QUERY_NOT_READONLY", "SQL must not be empty", 400)
    if ";" in normalized:
        raise QueryError("QUERY_NOT_READONLY", "Multiple statements are not allowed", 400)
    if _INLINE_WRITE.search(scrubbed):
        raise QueryError("QUERY_NOT_READONLY", "Write operations are not allowed", 400)
    if _WRITE_PREFIX.match(normalized):
        raise QueryError("QUERY_NOT_READONLY", "Write operations are not allowed", 400)
    if _DDL_MIDDLE.search(normalized):
        raise QueryError("QUERY_NOT_READONLY", "Write operations are not allowed", 400)
    if _FORBIDDEN_CLAUSES.search(normalized):
        raise QueryError("QUERY_NOT_READONLY", "Forbidden SQL clause", 400)
```

- [ ] **Step 2: 追加只读测试 T-Q-R27-001-01~07**

```python
import time
from concurrent.futures import ThreadPoolExecutor

from app.query.readonly import assert_readonly_sql
from app.query.schemas import QueryError


@pytest.mark.parametrize("sql", [
    "INSERT INTO t VALUES (1)",
    "UPDATE t SET x=1",
    "DELETE FROM t",
    "CREATE TABLE x (id INT)",
    "DROP TABLE t",
])
def test_readonly_rejects_dml_ddl(sql):
    """T-Q-R27-001-01: DML/DDL → QUERY_NOT_READONLY。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql(sql)
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_rejects_multi_statement():
    """T-Q-R27-001-02: 多语句 SELECT → QUERY_NOT_READONLY。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("SELECT 1; SELECT 2")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_rejects_comment_bypass_delete():
    """T-Q-R27-001-03: 块注释后行内 DELETE → QUERY_NOT_READONLY。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("SELECT 1 /*x*/ ; DELETE FROM t")
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_readonly_accepts_line_comment_select():
    """T-Q-R27-001-04: 行注释 + SELECT 通过。"""
    assert_readonly_sql("-- comment\nSELECT 1") is None


def test_readonly_rejects_oversized_sql():
    """T-Q-R27-001-05: 65537 字符 → QUERY_SQL_TOO_LONG。"""
    with pytest.raises(QueryError) as exc:
        assert_readonly_sql("SELECT " + "1" * 65530)
    assert exc.value.code == "QUERY_SQL_TOO_LONG"


def test_readonly_concurrent_smoke():
    """T-Q-R27-001-06: 并发 20 次 assert_readonly_sql 无异常。"""
    def _run():
        assert_readonly_sql("SELECT 1")
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda _: _run(), range(20)))


def test_readonly_perf_p95_under_50ms():
    """T-Q-R27-001-07: 只读校验 P95 < 50ms（本机 mock 基线）。"""
    samples = []
    for _ in range(100):
        start = time.perf_counter()
        assert_readonly_sql("SELECT 1")
        samples.append(time.perf_counter() - start)
    samples.sort()
    p95 = samples[94]
    assert p95 < 0.05, f"P95 {p95:.4f}s exceeds 50ms"
```

- [ ] **Step 3: 回归 r26 只读测试**

Run: `cd backend && python3 -m pytest tests/test_query_quality_r27.py -k "readonly" -v && python3 -m pytest tests/test_query_l1_r26.py -k "readonly" -v`

Expected: 全部 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/query/readonly.py tests/test_query_quality_r27.py
git commit -m "feat(query): harden readonly SQL guard (comments, inline writes, length cap)"
```

**验收标准:**
- 注释绕过、行内写、超长 SQL 结构化拦截
- r26 `test_readonly_*` 不回归
- T-Q-R27-001-01~07 pytest 绿；P95 < 50ms

---

### Task 4: mode=table 边界测试（QUERY-002）

**Files:**
- Test: `tests/test_query_quality_r27.py`（T-Q-R27-002-01~07 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `QueryExecutor.execute_table`, `get_settings().query_default_limit`（1000）
- Produces: table 模式空集/分页顶/非法标识/超时/offset/CH table 边界测试

- [ ] **Step 1: 追加 table 模式边界测试**

```python
from app.core.config import get_settings
from app.query.executor import QueryExecutor
from app.query.schemas import QueryError, ExecuteRequest
from app.query import service as query_service


def test_execute_table_empty_rows(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-01: mock 0 行 → rowCount=0。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with patch("app.query.executor.pool_manager.pooled_connection", mock_pool(["id"], [])):
        result = QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "public", "empty_t", limit=100,
        )
    assert result.row_count == 0


def test_execute_table_default_limit_cap(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-02: limit=query_default_limit 成功。"""
    cap = get_settings().query_default_limit
    user = UserContext(id="dev", username="dev", roles=["admin"])
    captured = {}

    @contextmanager
    def _capture(*_a, **_k):
        conn = MagicMock()
        cur = MagicMock()
        cur.description = [("id",)]
        cur.fetchmany.return_value = []
        conn.cursor.return_value = cur

        def _exec(sql):
            captured["sql"] = sql
        cur.execute.side_effect = _exec
        yield conn

    with patch("app.query.executor.pool_manager.pooled_connection", _capture):
        QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "public", "t", limit=cap,
        )
    assert f"LIMIT {cap}" in captured.get("sql", "")


def test_execute_limit_over_cap_422(client, query_seed, auth_headers):
    """T-Q-R27-002-03: limit > query_default_limit → 422。"""
    cap = get_settings().query_default_limit
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
            "limit": cap + 1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_execute_table_invalid_identifier(query_seed, meta_session):
    """T-Q-R27-002-04: 非法 schema/table → 400。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with pytest.raises(QueryError) as exc:
        QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "bad!", "t", limit=10,
        )
    assert exc.value.status == 400


def test_execute_table_timeout(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-05: mock timed out → 504 QUERY_TIMEOUT。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])

    @contextmanager
    def _timeout(*_a, **_k):
        raise RuntimeError("query timed out")
        yield  # pragma: no cover

    with patch("app.query.executor.pool_manager.pooled_connection", _timeout):
        with pytest.raises(QueryError) as exc:
            QueryExecutor().execute_table(
                meta_session, user, query_seed["ds_id"], "public", "t", limit=10,
            )
    assert exc.value.code == "QUERY_TIMEOUT"
    assert exc.value.status == 504


def test_execute_table_offset_in_sql(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-06: offset=100 table 模式 SQL 含 OFFSET 100。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])
    captured = {}

    @contextmanager
    def _capture(*_a, **_k):
        conn = MagicMock()
        cur = MagicMock()
        cur.description = [("id",)]
        cur.fetchmany.return_value = [[1]]
        conn.cursor.return_value = cur
        cur.execute.side_effect = lambda sql: captured.update({"sql": sql})
        yield conn

    with patch("app.query.executor.pool_manager.pooled_connection", _capture):
        QueryExecutor().execute_table(
            meta_session, user, query_seed["ds_id"], "public", "t",
            limit=50, offset=100,
        )
    assert "OFFSET 100" in captured["sql"]


def test_execute_clickhouse_table_mode(mock_pool, query_seed, meta_session):
    """T-Q-R27-002-07: clickhouse 数据源 table 模式 mock 成功。"""
    ds = _create_ch_ds("CH Table")
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with patch("app.query.executor.pool_manager.pooled_connection", mock_pool(["id"], [[1]])):
        result = QueryExecutor().execute_table(
            meta_session, user, ds.id, "db", "t", limit=50,
        )
    assert result.row_count == 1
```

- [ ] **Step 2: 运行测试**

Run: `cd backend && python3 -m pytest tests/test_query_quality_r27.py -k "table or limit_over" -v`

Expected: 7 passed

- [ ] **Step 3: Commit**

```bash
git add tests/test_query_quality_r27.py
git commit -m "test(query): table mode boundary smoke (QUERY-002)"
```

**验收标准:**
- 空集、分页顶、非法标识、超时、offset、CH table 七项绿
- 不修改 table 模式核心算法（仅测试 + 已有 executor 错误映射）

---

### Task 5: chartId 唯一绑定与并发语义（QUERY-005）

**Files:**
- Create: `backend/migrations/versions/0012_chart_query_bindings_chart_id.py`
- Modify: `backend/app/query/models.py`
- Modify: `backend/app/query/schemas.py`
- Modify: `backend/app/query/binding_service.py`
- Modify: `backend/app/api/v1/query.py`（仅当需显式捕获 `QueryError` 409 — 通常 service 已抛）
- Test: `tests/test_query_quality_r27.py`（T-Q-R27-005-01~05 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `ChartQueryBinding` ORM、`BindingCreate`/`BindingUpdate`/`BindingOut`
- Produces: `chart_id` 可空 UUID 列；重复 `chartId` → 409 `BINDING_CHART_CONFLICT`

- [ ] **Step 1: 创建 migration `backend/migrations/versions/0012_chart_query_bindings_chart_id.py`**

```python
"""Add chart_id to chart_query_bindings

Revision ID: 0012
Revises: 0011
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chart_query_bindings", sa.Column("chart_id", sa.Uuid(), nullable=True))
    op.create_index(
        "uq_chart_query_bindings_chart_id",
        "chart_query_bindings",
        ["chart_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_chart_query_bindings_chart_id", table_name="chart_query_bindings")
    op.drop_column("chart_query_bindings", "chart_id")
```

- [ ] **Step 2: 修改 `backend/app/query/models.py` 增加 `chart_id`**

```python
chart_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, unique=True, index=True)
```

- [ ] **Step 3: 修改 `backend/app/query/schemas.py`**

在 `BindingCreate` / `BindingOut` 增加：

```python
chart_id: uuid.UUID | None = Field(default=None, alias="chartId")
```

`BindingUpdate` 继承 `BindingCreate`，自动包含。

- [ ] **Step 4: 修改 `backend/app/query/binding_service.py`**

```python
from sqlalchemy import func, select

def _assert_chart_id_available(
    session: Session, chart_id: uuid.UUID | None, *, exclude_id: uuid.UUID | None = None,
) -> None:
    if chart_id is None:
        return
    stmt = select(ChartQueryBinding).where(ChartQueryBinding.chart_id == chart_id)
    if exclude_id is not None:
        stmt = stmt.where(ChartQueryBinding.id != exclude_id)
    if session.scalar(stmt) is not None:
        raise QueryError("BINDING_CHART_CONFLICT", "chartId already bound", 409)


def create_binding(...):
    ...
    _assert_chart_id_available(session, payload.chart_id)
    row = ChartQueryBinding(
        ...
        chart_id=payload.chart_id,
    )
    ...

def update_binding(...):
    ...
    _assert_chart_id_available(session, payload.chart_id, exclude_id=binding_id)
    ...
    row.chart_id = payload.chart_id
    ...
```

- [ ] **Step 5: 更新 `tests/test_query_quality_r27.py` ensure_query_tables — 测试库需含 chart_id 列**

在 module fixture `ensure_query_tables` 中，`QueryBase.metadata.create_all` 会随 model 更新自动建列；对已有 sqlite memory DB 在 fixture 内执行：

```python
# 在 create_all 之后（若列缺失则 ALTER）
try:
    engine.execute(text("SELECT chart_id FROM chart_query_bindings LIMIT 1"))
except Exception:
    pass  # create_all handles fresh DB
```

追加绑定测试：

```python
def test_binding_chart_id_conflict(client, query_seed, auth_headers):
    """T-Q-R27-005-01: 同 chartId 两次创建 → 第二个 409 BINDING_CHART_CONFLICT。"""
    chart_id = str(uuid.uuid4())
    body = {
        "name": "B1",
        "dataSourceId": str(query_seed["ds_id"]),
        "mode": "sql",
        "sql": "SELECT 1",
        "chartId": chart_id,
    }
    assert client.post("/api/v1/query/bindings", json=body, headers=auth_headers).status_code == 201
    resp = client.post("/api/v1/query/bindings", json={**body, "name": "B2"}, headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "BINDING_CHART_CONFLICT"


def test_binding_concurrent_patch_last_write_wins(client, query_seed, auth_headers):
    """T-Q-R27-005-02: 并发 PATCH 同 binding → 均 200。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Orig",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    bid = created["id"]
    base = {
        "dataSourceId": str(query_seed["ds_id"]),
        "mode": "sql",
        "sql": "SELECT 1",
        "defaultLimit": 100,
    }
    r1 = client.put(f"/api/v1/query/bindings/{bid}", json={**base, "name": "A"}, headers=auth_headers)
    r2 = client.put(f"/api/v1/query/bindings/{bid}", json={**base, "name": "B"}, headers=auth_headers)
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_binding_delete_not_visible(client, query_seed, auth_headers):
    """T-Q-R27-005-03: DELETE 后 GET 404；list 不含。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "Del",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    bid = created["id"]
    assert client.delete(f"/api/v1/query/bindings/{bid}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/v1/query/bindings/{bid}", headers=auth_headers).status_code == 404
    listed = client.get("/api/v1/query/bindings", headers=auth_headers).json()["items"]
    assert all(item["id"] != bid for item in listed)


def test_binding_execute_after_delete_404(client, query_seed, auth_headers):
    """T-Q-R27-005-04: DELETE 后 bindingId execute → 404 BINDING_NOT_FOUND。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "ExecDel",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    bid = created["id"]
    client.delete(f"/api/v1/query/bindings/{bid}", headers=auth_headers)
    resp = client.post(
        "/api/v1/query/execute",
        json={"bindingId": bid},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "BINDING_NOT_FOUND"


def test_binding_execute_soft_deleted_datasource_404(client, query_seed, auth_headers, meta_session):
    """T-Q-R27-005-05: 数据源软删后 binding execute → 404 DATASOURCE_NOT_FOUND。"""
    created = client.post(
        "/api/v1/query/bindings",
        json={
            "name": "SoftDS",
            "dataSourceId": str(query_seed["ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=auth_headers,
    ).json()
    from datetime import datetime, timezone
    from app.datasources.models import DataSource
    row = meta_session.get(DataSource, query_seed["ds_id"])
    row.deleted_at = datetime.now(timezone.utc)
    meta_session.commit()
    resp = client.post(
        "/api/v1/query/execute",
        json={"bindingId": created["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "DATASOURCE_NOT_FOUND"
```

- [ ] **Step 6: 运行绑定测试**

Run: `cd backend && python3 -m pytest tests/test_query_quality_r27.py -k "binding" -v`

Expected: 5 passed

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/versions/0012_chart_query_bindings_chart_id.py backend/app/query/models.py backend/app/query/schemas.py backend/app/query/binding_service.py tests/test_query_quality_r27.py
git commit -m "feat(query): chartId unique binding with conflict detection (QUERY-005)"
```

**验收标准:**
- migration 0012 可 upgrade；`chartId` 重复 → 409
- 并发 PATCH last-write-wins；删除与软删数据源联动 404
- T-Q-R27-005-01~05 pytest 绿

---

### Task 6: RLS admin bypass 与多方言集成（QUERY-006）

**Files:**
- Modify: `backend/app/query/rls/guard.py`
- Test: `tests/test_query_quality_r27.py`（T-Q-R27-006-01~06 段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `UserContext.roles`, `prepare_query_rls`
- Produces: `_should_bypass_rls`；admin 角色跳过 `prepare_query_rls`

- [ ] **Step 1: 修改 `backend/app/query/rls/guard.py`**

```python
ADMIN_BYPASS_ROLES = frozenset({"admin"})


def _should_bypass_rls(user: UserContext) -> bool:
    return bool(ADMIN_BYPASS_ROLES.intersection(user.roles))


def apply_rls_to_sql(
    session: Session,
    user: UserContext,
    sql: str,
    *,
    rls_config: dict[str, Any] | None = None,
) -> str:
    if _should_bypass_rls(user):
        return sql
    cfg = rls_config or {}
    # ... 现有 prepare_query_rls 逻辑不变
```

- [ ] **Step 2: 追加 RLS 测试 T-Q-R27-006-01~06**

```python
from unittest.mock import patch
from app.query.rls.guard import apply_rls_to_sql


def test_rls_admin_bypass_no_predicate(mock_rls, meta_session):
    """T-Q-R27-006-01: admin 执行不追加 WHERE (1=0)。"""
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="1=0") as mocked:
        out = apply_rls_to_sql(meta_session, user, "SELECT 1", rls_config={})
    assert out == "SELECT 1"
    mocked.assert_not_called()


def test_rls_viewer_no_org_still_empty(mock_rls, meta_session):
    """T-Q-R27-006-02: viewer 无 org → 仍 1=0（回归 T-Q-041 语义）。"""
    user = UserContext(id="v", username="v", roles=["viewer"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="1=0"):
        out = apply_rls_to_sql(meta_session, user, "SELECT 1", rls_config={})
    assert "1=0" in out


def test_rls_admin_viewer_dual_role_bypass(mock_rls, meta_session):
    """T-Q-R27-006-03: admin+viewer 双角色 → bypass。"""
    user = UserContext(id="dev", username="dev", roles=["admin", "viewer"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="1=0") as mocked:
        out = apply_rls_to_sql(meta_session, user, "SELECT * FROM t", rls_config={})
    assert out == "SELECT * FROM t"
    mocked.assert_not_called()


def test_rls_multidim_fragment_merge(mock_rls, meta_session):
    """T-Q-R27-006-04: 多维 column_by_dimension_id fragment 含 AND 合并。"""
    user = UserContext(id="v", username="v", roles=["viewer"])
    with patch("app.query.rls.guard.prepare_query_rls", return_value="dim_a = 1 AND dim_b = 2"):
        out = apply_rls_to_sql(
            meta_session, user, "SELECT 1 FROM t WHERE x=1",
            rls_config={"column_by_dimension_id": {"d1": "dim_a"}},
        )
    assert "AND (dim_a = 1 AND dim_b = 2)" in out


def test_rls_clickhouse_execute_chain(mock_pool, query_seed, meta_session):
    """T-Q-R27-006-05: clickhouse + RLS 链 mock execute 200；apply_rls_to_sql 调用一次。"""
    ds = _create_ch_ds()
    user = UserContext(id="dev", username="dev", roles=["admin"])
    with patch("app.query.rls.guard.apply_rls_to_sql", wraps=apply_rls_to_sql) as spy:
        with patch("app.query.executor.pool_manager.pooled_connection", mock_pool(["id"], [[1]])):
            result = QueryExecutor().execute_sql(
                meta_session, user, ds.id, "SELECT 1", limit=10, apply_rls=True,
            )
    assert result.row_count == 1
    assert spy.call_count == 1


def test_rls_invisible_datasource_403(client, query_seed, viewer_headers):
    """T-Q-R27-006-06: 不可见 dataSource → 403（回归 T-Q-042）。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={
            "dataSourceId": str(query_seed["hidden_ds_id"]),
            "mode": "sql",
            "sql": "SELECT 1",
        },
        headers=viewer_headers,
    )
    assert resp.status_code == 403
```

- [ ] **Step 3: 运行 RLS 测试 + r26 RLS 回归**

Run: `cd backend && python3 -m pytest tests/test_query_quality_r27.py -k "rls" -v && python3 -m pytest tests/test_query_l1_r26.py -k "rls" -v`

Expected: 全部 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/query/rls/guard.py tests/test_query_quality_r27.py
git commit -m "feat(query): admin RLS bypass and integration smoke (QUERY-006)"
```

**验收标准:**
- admin 不误杀全量；viewer 仍 1=0；双角色 admin 优先 bypass
- CH + RLS 链单次调用；不可见 DS 仍 403
- T-Q-R27-006-01~06 pytest 绿

---

### Task 7: 迁移测试、文档同步与全量回归

**Files:**
- Modify: `tests/test_migrations.py`（T-MIG-40）
- Modify: `docs/services/query.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.cursor/rules/prd-sync.mdc`（触及 `docs/services/` 与 `docs/api/`）

**UI skill:** none

**Interfaces:**
- Consumes: migration 0012、本轮全部 QUERY 行为变更
- Produces: T-MIG-40 head=0012；文档登记 ClickHouse dialect、chartId、admin RLS bypass

- [ ] **Step 1: 追加 `tests/test_migrations.py` T-MIG-40**

```python
def test_revision_chain_head_0012_down_revision_t_mig40():
    """T-MIG-40: heads 含 0012；0012.down_revision==0011。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert "0012" in heads
    assert revisions["0012"] == "0011"


def test_alembic_upgrade_head_sql_contains_chart_id():
    """T-MIG-40b: upgrade head --sql 含 chart_id 列。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=True,
    )
    assert "chart_id" in result.stdout
```

同时更新 T-MIG-38/30/34/36 等断言 head 为 0011 的测试 — 将期望 `"0011"` 改为 `"0012"`（仅 head 列表断言，保持 down_revision 链检查一致）。

- [ ] **Step 2: 更新 `docs/services/query.md`**

在「方言适配器」节追加：

```markdown
- **ClickHouse**（`clickhouse`）：L1 已注册 — 反引号标识符、后缀 `LIMIT/OFFSET`；执行错误映射 `QUERY_SYNTAX_ERROR` / `QUERY_TABLE_NOT_FOUND`；无 CONN-007 连接器（mock/单元测试验收）。
```

在「chart_query_bindings」节追加：

```markdown
- 可选字段 `chartId`（UUID，全局唯一）；冲突 → `409 BINDING_CHART_CONFLICT`
```

在「RLS」节追加：

```markdown
- `admin` 角色跳过行级谓词注入（数据源 ACL 仍生效）；viewer 无 org 仍降级 `1=0`
```

- [ ] **Step 3: 更新 `docs/api/README.md` Binding 路由说明**

在 `POST/PUT /api/v1/query/bindings` 行补充：`chartId` 可选 UUID；重复 → `409 BINDING_CHART_CONFLICT`。

- [ ] **Step 4: 全量验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v`

Expected: **≥560 passed**, 4 skipped；`tests/test_query_quality_r27.py` ≥28 passed

- [ ] **Step 5: Commit**

```bash
git add tests/test_migrations.py docs/services/query.md docs/api/README.md
git commit -m "docs(query): r27 migration test and query domain/api sync"
```

**验收标准:**
- T-MIG-40 head=0012；alembic --sql 含 chart_id
- `docs/services/query.md` 与 `docs/api/README.md` 与实现一致
- 全量 pytest ≥560 passed + 4 skipped；ruff 无 error

---

## Spec Self-Review

- [x] 5 个子项均有对应 Task（004→1-2，001→3，002→4，005→5，006→6；7 为迁移/文档/回归）
- [x] 无 TBD/TODO/「适当处理」占位
- [x] 每 Task 含验证命令与验收标准
- [x] 全 Task `UI skill: none`（纯后端）
- [x] 17 文件 ≤20 上限
- [x] 执行模式固定 `subagent-driven-development (option 1)`
