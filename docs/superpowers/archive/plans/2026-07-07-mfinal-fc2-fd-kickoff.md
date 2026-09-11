# M-FINAL · F-C 收官（GaussDB）+ F-D 查询链奠基 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/dialects/gaussdb.py`、`tests/test_mfinal_fc_r242.py`、`fe/src/pages/admin/datasources/DatasourceFormPage.tsx`、`fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`、`backend/app/query/config_store/schemas.py`、`backend/app/query/config_store/access.py`（新建）、`backend/app/query/config_store/service.py`、`backend/app/api/v1/query_configs.py`、`backend/app/query/translator/from_config.py`（新建）、`backend/app/query/dataset/schemas.py`、`backend/app/query/dataset/execute_config.py`（新建）、`backend/app/api/v1/query.py`、`tests/test_mfinal_fd_r243.py`（新建）、`docs/api/README.md`、`docs/services/query.md`、`docs/services/datasources.md`
> **子项：** CONN-022、QUERY-007、QUERY-008、QUERY-009
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端/测试预指定 fastapi + TDD；UI 预指定 b-design-system-tailadmin-radix）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`；`fe-ui.mdc` 匹配 `fe/**`）

**Goal:** 收官 GaussDB companion（`probe_readonly_sql` + Admin 表单 hints/smoke）并闭合 F-D 查询链前三项：`dataset_query` 配置持久化 + owner 访问控制、`configId→SQL` 翻译、`dataSourceId+configId` 端到端 mock 执行。

**Architecture:** CONN-022 对齐 r242 Kingbase psycopg 范式；QUERY-007~009 沿 `config_store → translator/from_config → dataset/execute_config` 四步链，不修改 r53 内置 `demo-orders` 路径；执行链 mock `QueryExecutor.execute_sql` 返回固定行集；无新 migration、无 META 第四域。

**Tech Stack:** Python 3.12 + FastAPI + Pydantic v2 + pytest + unittest.mock；React 18 + TypeScript + vitest + RTL；pnpm workspace。

## Global Constraints

- 不修改 `goal.md` / `docs/automate/plan.md` 结构；PRD 分片勾选留给 P5
- 不新增 Alembic migration；复用 `query_config_records` 表
- 不注册 translator gaussdb/dm/trino 方言；`connectorType` L1 仅 `mysql`/`postgresql`/`clickhouse`
- 不修改 `resolve_query_path` / r53 内置 `demo-orders` execute-plan 契约
- 单 Python 业务文件 ≤ 200 行；`access.py` ≤ 40 行；单 FE 文件 ≤ 300 行
- HTTP 响应 JSON 不得含 `password` 明文
- 错误码与 design 一致：`CONFIG_INVALID_DATASET_QUERY`、`CONFIG_ACCESS_FORBIDDEN`、`QUERY_TRANSLATE_*`、`QUERY_DATASET_CONFIG_MISMATCH`、`QUERY_DATASET_PLAN_INVALID_PARAMS`
- 文档同步：`docs/api/README.md` 路由登记 + `docs/services/query.md` / `datasources.md` 域锚点（`prd-sync.mdc`）
- 提交信息格式：`feat:` / `test:` / `docs:` 前缀 + 英文动词短语

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `backend/app/datasources/dialects/gaussdb.py` | **修改** | `probe_readonly_sql` psycopg `SELECT 1` |
| `tests/test_mfinal_fc_r242.py` | **修改** | +5 GaussDB 用例 T-CONN-R242-022-01~05 |
| `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | **修改** | `CONNECTOR_FIELD_HINTS.gaussdb` + 辅助文案 |
| `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | **修改** | +2 GaussDB smoke |
| `backend/app/query/config_store/schemas.py` | **修改** | `dataset_query` 类型 + `DatasetQueryConfigPayload` |
| `backend/app/query/config_store/access.py` | **新建** | `assert_config_readable` owner/admin 守卫 |
| `backend/app/query/config_store/service.py` | **修改** | payload 校验 + list owner 过滤 |
| `backend/app/api/v1/query_configs.py` | **修改** | GET/list 接入 access；`POST /{id}/translate` |
| `backend/app/query/translator/from_config.py` | **新建** | `translate_from_config_record` + budget probe |
| `backend/app/query/dataset/schemas.py` | **修改** | `DatasetExecuteRequest` / `DatasetExecuteResponse` |
| `backend/app/query/dataset/execute_config.py` | **新建** | `execute_dataset_from_config` 四步链 |
| `backend/app/api/v1/query.py` | **修改** | `POST /query/dataset/execute` |
| `tests/test_mfinal_fd_r243.py` | **新建** | ≥18 断言（007~009 链 + ACL + 非法输入） |
| `docs/api/README.md` | **修改** | translate-from-config、dataset/execute 路由 |
| `docs/services/query.md` | **修改** | F-D r243 链路与 In/Out |
| `docs/services/datasources.md` | **修改** | GaussDB probe + FE r243 状态 |

---

### Task 1: CONN-022 — GaussDB `probe_readonly_sql` + `test_mfinal_fc_r242` 扩展

**Files:**
- Modify: `backend/app/datasources/dialects/gaussdb.py`
- Modify: `tests/test_mfinal_fc_r242.py`

**Interfaces:**
- Produces: `GaussdbConnector.probe_readonly_sql(connection) -> bool`
- Produces: tests `test_conn_r242_022_01` ~ `test_conn_r242_022_05`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

- [ ] **Step 1: 追加 GaussDB 失败测试（TDD）**

在 `tests/test_mfinal_fc_r242.py` 文件末尾（compose skip 段之前）追加：

```python
from app.datasources.dialects.gaussdb import GaussdbConnector


# --- CONN-022 GaussDB ---


def test_conn_r242_022_01_types_catalog_gaussdb():
    """T-CONN-R242-022-01: export_type_catalog 含 gaussdb，displayName 含 GaussDB，category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "gaussdb" in types
    assert "GaussDB" in types["gaussdb"]["displayName"]
    assert types["gaussdb"]["category"] == "relational"


def test_conn_r242_022_02_probe_readonly_sql():
    """T-CONN-R242-022-02: mock psycopg connection → probe_readonly_sql True；execute SELECT 1。"""
    conn = MagicMock()
    assert GaussdbConnector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once_with("SELECT 1")


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_r242_022_03_http_test_no_password(mock_open, client):
    """T-CONN-R242-022-03: POST /datasources/test type=gaussdb mock 失败 → 响应无 password。"""
    mock_open.side_effect = Exception("Login failed gauss_secret_xyz")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "gaussdb",
            "name": "gauss-r243",
            "code": f"gauss-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5432,
            "database": "postgres",
            "username": "u",
            "password": "gauss_secret_xyz",
        },
    )
    assert resp.status_code == 200
    assert "gauss_secret_xyz" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


def test_conn_r242_022_04_readonly_guard_gaussdb(client):
    """T-CONN-R242-022-04: readonly-guard connectorType=gaussdb sql=SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "gaussdb", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_conn_r242_022_05_probe_readonly_budget_smoke():
    """T-CONN-R242-022-05: mock probe_readonly_sql elapsed <30ms（与 r242 OceanBase 同级 smoke）。"""
    import time

    conn = MagicMock()
    start = time.perf_counter()
    GaussdbConnector().probe_readonly_sql(conn)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert elapsed_ms < 30
```

- [ ] **Step 2: 运行 GaussDB probe 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py::test_conn_r242_022_02_probe_readonly_sql -v`
Expected: FAIL with `AttributeError: 'GaussdbConnector' object has no attribute 'probe_readonly_sql'`

- [ ] **Step 3: 实现 `GaussdbConnector.probe_readonly_sql`**

在 `backend/app/datasources/dialects/gaussdb.py` 的 `GaussdbConnector` 类 `list_columns` 方法之后追加：

```python
    def probe_readonly_sql(self, connection: Any) -> bool:
        """Execute minimal read-only probe; return True on success."""
        connection.execute("SELECT 1")
        return True
```

- [ ] **Step 4: 运行 CONN-022 全套测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py -k "022" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/gaussdb.py tests/test_mfinal_fc_r242.py
git commit -m "feat: add GaussDB probe_readonly_sql and r242 integration tests"
```

---

### Task 2: QUERY-007 — `dataset_query` 契约 + owner 访问控制

**Files:**
- Modify: `backend/app/query/config_store/schemas.py`
- Create: `backend/app/query/config_store/access.py`
- Modify: `backend/app/query/config_store/service.py`
- Modify: `backend/app/api/v1/query_configs.py`
- Create: `tests/test_mfinal_fd_r243.py`

**Interfaces:**
- Produces: `DatasetQueryConfigPayload`（Pydantic）
- Produces: `assert_config_readable(actor, record) -> None`（403 `CONFIG_ACCESS_FORBIDDEN`）
- Produces: `list_configs(..., actor_id, is_admin)` owner 过滤
- Produces: `_validate_dataset_query_payload(payload: dict) -> None`
- Consumes: `TranslateConditions` from `app.query.translator.schemas`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 扩展 schemas + 新建 access.py**

在 `backend/app/query/config_store/schemas.py`：

1. 在 `ALLOWED_CONFIG_TYPES` 追加 `"dataset_query"`。
2. 文件末尾追加（需 `from pydantic import field_validator` 与 `from app.query.translator.schemas import TranslateConditions`）：

```python
class DatasetQueryConfigPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    connector_type: str = Field(alias="connectorType")
    schema_name: str = Field(alias="schema")
    table: str
    columns: list[str] = Field(min_length=1)
    conditions: TranslateConditions | None = None
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)

    @field_validator("columns")
    @classmethod
    def reject_star(cls, cols: list[str]) -> list[str]:
        if any(c.strip() == "*" for c in cols):
            raise ValueError("wildcard * is not allowed")
        return cols
```

新建 `backend/app/query/config_store/access.py`：

```python
from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.query.config_store.models import QueryConfigRecord
from app.query.config_store.schemas import ConfigError


def assert_config_readable(actor: UserContext, record: QueryConfigRecord) -> None:
    if "admin" in actor.roles:
        return
    owner = record.owner_id
    if owner is None:
        return
    try:
        actor_uuid = uuid.UUID(actor.id)
    except ValueError as exc:
        raise ConfigError("CONFIG_ACCESS_FORBIDDEN", "Config access denied", 403) from exc
    if owner != actor_uuid:
        raise ConfigError("CONFIG_ACCESS_FORBIDDEN", "Config access denied", 403)
```

- [ ] **Step 2: 扩展 service 校验与 list 过滤**

在 `backend/app/query/config_store/service.py`：

1. 导入 `DatasetQueryConfigPayload`、`assert_config_readable`（re-export 可选）。
2. 新增私有函数：

```python
def _validate_dataset_query_payload(payload: dict) -> None:
    from pydantic import ValidationError

    try:
        DatasetQueryConfigPayload.model_validate(payload)
    except ValidationError as exc:
        fields = [
            {"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        raise ConfigError(
            "CONFIG_INVALID_DATASET_QUERY",
            "Invalid dataset_query payload",
            422,
            fields=fields,
        ) from exc
```

3. 在 `_validate_upsert` 末尾追加：

```python
    if payload.config_type == "dataset_query":
        _validate_dataset_query_payload(payload.payload)
```

4. 修改 `list_configs` 签名，追加 `actor_id: uuid.UUID | None = None, is_admin: bool = True`；在 `ref_id` 过滤之后追加：

```python
    if not is_admin and actor_id is not None:
        owner_filter = (
            QueryConfigRecord.owner_id.is_(None)
            | (QueryConfigRecord.owner_id == actor_id)
        )
        base = base.where(owner_filter)
        count_stmt = count_stmt.where(owner_filter)
```

- [ ] **Step 3: 更新 query_configs API**

在 `backend/app/api/v1/query_configs.py`：

1. 导入 `assert_config_readable`。
2. `get_query_config`：取 record 后调用 `assert_config_readable(actor, record)`（将 `_` 改为 `actor`）。
3. `list_query_configs`：传入 `actor_id=_owner_uuid(actor)` 与 `is_admin="admin" in actor.roles`。
4. 新增 helper `_actor_uuid(actor)` 若需复用 `_owner_uuid`。

- [ ] **Step 4: 新建 `tests/test_mfinal_fd_r243.py` 脚手架 + QUERY-007 测试**

```python
"""M-FINAL F-D r243 — QUERY-007~009 dataset_query 存储→翻译→执行链。"""
from __future__ import annotations

import json
import os
import time
import uuid
from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import jwt_auth_headers

_R243_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fd_r243?mode=memory&cache=shared&uri=true"
AUTH = jwt_auth_headers()
OWNER_ID = str(uuid.uuid4())
OTHER_ID = str(uuid.uuid4())


@pytest.fixture(scope="module", autouse=True)
def r243_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R243_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
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
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def owner_user() -> Generator[None, None, None]:
    def _override() -> UserContext:
        return UserContext(id=OWNER_ID, username="owner", roles=["analyst"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def other_user() -> Generator[None, None, None]:
    def _override() -> UserContext:
        return UserContext(id=OTHER_ID, username="other", roles=["analyst"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def admin_user() -> Generator[None, None, None]:
    def _override() -> UserContext:
        return UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _valid_dataset_query_payload(ds_id: str) -> dict:
    return {
        "dataSourceId": ds_id,
        "connectorType": "mysql",
        "schema": "demo",
        "table": "orders",
        "columns": ["order_amount", "status"],
        "conditions": {"logic": "AND", "conditions": []},
        "limit": 100,
        "offset": 0,
    }


def test_query_r243_007_01_put_dataset_query_ok(client, owner_user):
    """T-QUERY-R243-007-01: PUT dataset_query 合法 payload → 200 + revision=1。"""
    ds_id = str(uuid.uuid4())
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(ds_id),
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 200
    assert resp.json()["revision"] == 1
    assert resp.json()["configType"] == "dataset_query"


def test_query_r243_007_02_missing_data_source_id(client, owner_user):
    """T-QUERY-R243-007-02: PUT 缺 dataSourceId → 422 CONFIG_INVALID_DATASET_QUERY。"""
    payload = _valid_dataset_query_payload(str(uuid.uuid4()))
    del payload["dataSourceId"]
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": payload,
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CONFIG_INVALID_DATASET_QUERY"


def test_query_r243_007_03_viewer_get_other_owner_forbidden(client, owner_user, other_user):
    """T-QUERY-R243-007-03: 非 owner 非 admin GET 他人记录 → 403。"""
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(uuid.uuid4())),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    get_resp = client.get(f"/api/v1/query/configs/{config_id}", headers=AUTH)
    assert get_resp.status_code == 403
    assert get_resp.json()["code"] == "CONFIG_ACCESS_FORBIDDEN"


def test_query_r243_007_04_admin_get_other_owner_ok(client, owner_user, admin_user):
    """T-QUERY-R243-007-04: admin GET 他人记录 → 200。"""
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(uuid.uuid4())),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    get_resp = client.get(f"/api/v1/query/configs/{config_id}", headers=AUTH)
    assert get_resp.status_code == 200


def test_query_r243_007_05_payload_256kb_regression(client, owner_user):
    """T-QUERY-R243-007-05: dataset_query payload 256KB 边界仍走 CONFIG_PAYLOAD_TOO_LARGE（r33 回归）。"""
    chunk = "x" * 1024
    oversized = {"data": [chunk for _ in range(260)]}
    oversized.update(_valid_dataset_query_payload(str(uuid.uuid4())))
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": oversized,
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 413
    assert resp.json()["code"] == "CONFIG_PAYLOAD_TOO_LARGE"
```

- [ ] **Step 5: 运行 QUERY-007 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_r243.py -k "007" -v`
Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/query/config_store/schemas.py backend/app/query/config_store/access.py \
  backend/app/query/config_store/service.py backend/app/api/v1/query_configs.py \
  tests/test_mfinal_fd_r243.py
git commit -m "feat: add dataset_query config type with owner access control"
```

---

### Task 3: QUERY-008 — `translate_from_config` + API

**Files:**
- Create: `backend/app/query/translator/from_config.py`
- Modify: `backend/app/api/v1/query_configs.py`
- Modify: `tests/test_mfinal_fd_r243.py`

**Interfaces:**
- Produces: `translate_from_config_record(record: QueryConfigRecord) -> TranslateResponse`
- Produces: `probe_translate_from_config_budget_ms(record) -> float`
- Produces: `POST /api/v1/query/configs/{config_id}/translate` → `TranslateResponse`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 新建 `from_config.py`**

```python
from __future__ import annotations

import time

from pydantic import ValidationError

from app.query.config_store.models import QueryConfigRecord
from app.query.config_store.schemas import DatasetQueryConfigPayload
from app.query.translator.schemas import TranslateError, TranslateRequest, TranslateResponse
from app.query.translator.service import translate_config_to_sql


def translate_from_config_record(record: QueryConfigRecord) -> TranslateResponse:
    if record.config_type != "dataset_query":
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            f"config type must be dataset_query, got {record.config_type}",
            422,
        )
    try:
        payload = DatasetQueryConfigPayload.model_validate(record.payload)
    except ValidationError as exc:
        fields = [
            {"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            "Invalid dataset_query payload",
            422,
            fields=fields,
        ) from exc
    request = TranslateRequest(
        connectorType=payload.connector_type,
        schema=payload.schema_name,
        table=payload.table,
        columns=payload.columns,
        conditions=payload.conditions,
        limit=payload.limit,
        offset=payload.offset,
    )
    return translate_config_to_sql(request)


def probe_translate_from_config_budget_ms(record: QueryConfigRecord) -> float:
    start = time.perf_counter()
    translate_from_config_record(record)
    return (time.perf_counter() - start) * 1000.0
```

- [ ] **Step 2: 追加 translate API 路由**

在 `backend/app/api/v1/query_configs.py` 追加：

```python
from app.query.config_store.access import assert_config_readable
from app.query.translator.from_config import translate_from_config_record
from app.query.translator.schemas import TranslateError, TranslateResponse


def _translate_error(exc: TranslateError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.post("/{config_id}/translate", response_model=TranslateResponse)
def translate_query_config(
    config_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> TranslateResponse | JSONResponse:
    try:
        record = config_service.get_config_by_id(db, config_id)
        assert_config_readable(actor, record)
        return translate_from_config_record(record)
    except ConfigError as exc:
        return _config_error(exc)
    except TranslateError as exc:
        return _translate_error(exc)
```

- [ ] **Step 3: 追加 QUERY-008 测试**

在 `tests/test_mfinal_fd_r243.py` 追加：

```python
from app.query.config_store.models import QueryConfigRecord
from app.query.translator.from_config import probe_translate_from_config_budget_ms, translate_from_config_record


def _put_mysql_dataset_query(client) -> tuple[str, str]:
    ds_id = str(uuid.uuid4())
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(ds_id),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert put.status_code == 200
    return put.json()["id"], ds_id


def test_query_r243_008_01_translate_mysql_backticks(client, owner_user):
    """T-QUERY-R243-008-01: 存 mysql dataset_query → translate → SQL 含反引号 + %(p0)s。"""
    config_id, _ = _put_mysql_dataset_query(client)
    resp = client.post(f"/api/v1/query/configs/{config_id}/translate", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "`" in body["sql"]
    assert "%(p" in body["sql"] or body["parameters"]


def test_query_r243_008_02_invalid_operator(client, owner_user):
    """T-QUERY-R243-008-02: 非法 operator → 422 QUERY_TRANSLATE_INVALID_OPERATOR。"""
    ds_id = str(uuid.uuid4())
    payload = _valid_dataset_query_payload(ds_id)
    payload["conditions"] = {
        "logic": "AND",
        "conditions": [{"fieldId": "status", "operator": "not_in", "value": "x"}],
    }
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": payload,
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    resp = client.post(f"/api/v1/query/configs/{config_id}/translate", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_INVALID_OPERATOR"


def test_query_r243_008_03_wrong_config_type(client, owner_user):
    """T-QUERY-R243-008-03: configType=query_conditions → 422 QUERY_TRANSLATE_INVALID_CONFIG。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": str(uuid.uuid4()),
        "payload": {"logic": "AND", "conditions": []},
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    resp = client.post(f"/api/v1/query/configs/{config_id}/translate", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_INVALID_CONFIG"


def test_query_r243_008_04_translate_budget_smoke(client, owner_user):
    """T-QUERY-R243-008-04: probe_translate_from_config_budget_ms ≤15ms（mock，无 DB）。"""
    config_id, _ = _put_mysql_dataset_query(client)
    from app.datasources.models import get_meta_session

    session = get_meta_session()
    try:
        record = session.get(QueryConfigRecord, uuid.UUID(config_id))
        assert record is not None
        elapsed = probe_translate_from_config_budget_ms(record)
        assert elapsed < 15.0
    finally:
        session.close()
```

- [ ] **Step 4: 运行 QUERY-008 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_r243.py -k "008" -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/translator/from_config.py backend/app/api/v1/query_configs.py tests/test_mfinal_fd_r243.py
git commit -m "feat: add translate-from-config API for dataset_query records"
```

---

### Task 4: QUERY-009 — `execute_dataset_from_config` + API

**Files:**
- Modify: `backend/app/query/dataset/schemas.py`
- Create: `backend/app/query/dataset/execute_config.py`
- Modify: `backend/app/api/v1/query.py`
- Modify: `tests/test_mfinal_fd_r243.py`

**Interfaces:**
- Produces: `DatasetExecuteRequest` / `DatasetExecuteResponse`
- Produces: `execute_dataset_from_config(session, user, req) -> DatasetExecuteResponse`
- Produces: `POST /api/v1/query/dataset/execute`
- Consumes: `translate_from_config_record`, `assert_config_readable`, `QueryExecutor.execute_sql`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 扩展 dataset schemas**

在 `backend/app/query/dataset/schemas.py` 追加：

```python
import uuid

from app.query.schemas import ExecuteResponse, RlsOptions


class DatasetExecuteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    config_id: uuid.UUID = Field(alias="configId")
    parameters: dict[str, object] = Field(default_factory=dict)
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)
    rls: RlsOptions = Field(default_factory=RlsOptions)


class DatasetExecuteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    config_id: uuid.UUID = Field(alias="configId")
    config_revision: int = Field(alias="configRevision")
    columns: list[str]
    rows: list[list[object]]
    row_count: int = Field(alias="rowCount")
    truncated: bool
    trace_id: str = Field(alias="traceId")
```

- [ ] **Step 2: 新建 `execute_config.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.core.logging import trace_id_var
from app.datasources.acl import assert_visible
from app.query.config_store.access import assert_config_readable
from app.query.config_store.schemas import ConfigError, DatasetQueryConfigPayload
from app.query.config_store.service import get_config_by_id
from app.query.dataset.schemas import DatasetExecuteRequest, DatasetExecuteResponse
from app.query.executor import QueryExecutor
from app.query.readonly import assert_safe_sql_parameters
from app.query.schemas import QueryError
from app.query.translator.from_config import translate_from_config_record

_executor = QueryExecutor()
_FORBIDDEN_PARAM_KEYS = frozenset({"__proto__", "_sql"})


def _merge_parameters(translated: dict[str, object], override: dict[str, object]) -> dict[str, object]:
    merged = dict(translated)
    merged.update(override)
    for key in merged:
        if key in _FORBIDDEN_PARAM_KEYS or key.startswith("__"):
            raise QueryError("QUERY_DATASET_PLAN_INVALID_PARAMS", "Forbidden parameter key", 422)
    assert_safe_sql_parameters(merged)
    return merged


def execute_dataset_from_config(
    session: Session,
    user: UserContext,
    req: DatasetExecuteRequest,
) -> DatasetExecuteResponse:
    try:
        record = get_config_by_id(session, req.config_id)
        assert_config_readable(user, record)
    except ConfigError as exc:
        raise QueryError(exc.code, exc.message, exc.status) from exc

    payload = DatasetQueryConfigPayload.model_validate(record.payload)
    if payload.data_source_id != req.data_source_id:
        raise QueryError(
            "QUERY_DATASET_CONFIG_MISMATCH",
            "config payload dataSourceId does not match request",
            422,
        )

    try:
        assert_visible(session, user.roles, req.data_source_id)
    except Exception as exc:
        from app.auth.resources.service import VisibilityError

        if isinstance(exc, VisibilityError):
            raise QueryError(exc.code, exc.message, exc.status) from exc
        raise

    translated = translate_from_config_record(record)
    parameters = _merge_parameters(translated.parameters, req.parameters)

    settings = get_settings()
    limit = min(req.limit or settings.query_default_limit, settings.query_default_limit)
    apply_rls = req.rls.enabled
    if not apply_rls and settings.vitalspan_env != "development":
        raise QueryError("RLS_CONFIG_INVALID", "Disabling RLS is only allowed in development", 400)

    rls_config = {"table_alias": req.rls.table_alias, "org_column": req.rls.org_column}
    result = _executor.execute_sql(
        session,
        user,
        req.data_source_id,
        translated.sql,
        limit=limit,
        offset=req.offset,
        rls_config=rls_config,
        apply_rls=apply_rls,
        parameters=parameters,
    )
    return DatasetExecuteResponse(
        configId=req.config_id,
        configRevision=record.revision,
        columns=result.columns,
        rows=result.rows,
        rowCount=result.row_count,
        truncated=result.truncated,
        traceId=trace_id_var.get() or "",
    )
```

- [ ] **Step 3: 扩展 `QueryExecutor.execute_sql` 支持 `parameters`**

在 `backend/app/query/executor.py` 的 `execute_sql` 与 `_run` 签名追加 `parameters: dict[str, object] | None = None`，在 `cur.execute(final_sql)` 改为：

```python
                if parameters:
                    cur.execute(final_sql, parameters)
                else:
                    cur.execute(final_sql)
```

- [ ] **Step 4: 追加 query API 路由**

在 `backend/app/api/v1/query.py` 导入并追加：

```python
from app.query.dataset.execute_config import execute_dataset_from_config
from app.query.dataset.schemas import DatasetExecuteRequest, DatasetExecuteResponse


@router.post(
    "/dataset/execute",
    response_model=DatasetExecuteResponse,
    summary="Execute dataset query from stored config (QUERY-009)",
)
def execute_dataset_config(
    payload: DatasetExecuteRequest,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DatasetExecuteResponse | JSONResponse:
    try:
        return execute_dataset_from_config(db, user, payload)
    except QueryError as exc:
        return _error_response(exc)
```

- [ ] **Step 5: 追加 QUERY-009 测试**

在 `tests/test_mfinal_fd_r243.py` 追加（需导入 `create_data_source`、`DataSourceCreate`、`QueryResult`）：

```python
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.datasources.models import get_meta_session
from app.query.executor import QueryExecutor, QueryResult


def _create_mysql_ds() -> uuid.UUID:
    session = get_meta_session()
    try:
        row = create_data_source(
            session,
            DataSourceCreate(
                name=f"mysql-r243-{uuid.uuid4().hex[:6]}",
                code=f"mysql-r243-{uuid.uuid4().hex[:6]}",
                type="mysql",
                host="127.0.0.1",
                port=3306,
                database="demo",
                username="u",
                password="secret",
            ),
        )
        return row.id
    finally:
        session.close()


@patch.object(QueryExecutor, "execute_sql")
def test_query_r243_009_01_full_chain(mock_execute, client, owner_user):
    """T-QUERY-R243-009-01: DS + PUT dataset_query + POST execute → 200 + rows 非空。"""
    mock_execute.return_value = QueryResult(
        columns=["order_amount", "status"],
        rows=[[100, "ok"], [200, "pending"]],
        row_count=2,
        truncated=False,
    )
    ds_id = _create_mysql_ds()
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    config_id = put.json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "configId": config_id,
            "parameters": {},
            "limit": 10,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["rowCount"] == 2
    assert len(body["rows"]) == 2


def test_query_r243_009_02_config_mismatch(client, owner_user):
    """T-QUERY-R243-009-02: configId/dataSourceId 不一致 → 422 QUERY_DATASET_CONFIG_MISMATCH。"""
    ds_id = _create_mysql_ds()
    other_ds = str(uuid.uuid4())
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={"dataSourceId": other_ds, "configId": config_id},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_DATASET_CONFIG_MISMATCH"


def test_query_r243_009_03_viewer_no_ds_acl(client, other_user):
    """T-QUERY-R243-009-03: 无 DS ACL → 403。"""
    ds_id = _create_mysql_ds()
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={"dataSourceId": str(ds_id), "configId": config_id},
    )
    assert resp.status_code == 403


def test_query_r243_009_04_forbidden_param_key(client, owner_user):
    """T-QUERY-R243-009-04: parameters 含 _sql → 422 QUERY_DATASET_PLAN_INVALID_PARAMS。"""
    ds_id = _create_mysql_ds()
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "configId": config_id,
            "parameters": {"_sql": "DROP TABLE t"},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_DATASET_PLAN_INVALID_PARAMS"


@patch.object(QueryExecutor, "execute_sql")
def test_query_r243_009_05_admin_rls_bypass_still_visible(mock_execute, client, admin_user):
    """T-QUERY-R243-009-05: admin 仍 assert_visible；mock execute 成功（r27 RLS 回归）。"""
    mock_execute.return_value = QueryResult(
        columns=["order_amount"], rows=[[1]], row_count=1, truncated=False,
    )
    ds_id = _create_mysql_ds()
    body = {
        "configType": "dataset_query",
        "schemaVersion": "1.0",
        "refType": "dataset",
        "refId": str(uuid.uuid4()),
        "payload": _valid_dataset_query_payload(str(ds_id)),
    }
    config_id = client.put("/api/v1/query/configs", headers=AUTH, json=body).json()["id"]
    resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "configId": config_id,
            "rls": {"enabled": False},
        },
    )
    assert resp.status_code == 200
    mock_execute.assert_called_once()
```

- [ ] **Step 6: 运行 QUERY-009 + 全量 r243 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_r243.py -v`
Expected: ≥14 passed（007:5 + 008:4 + 009:5）

- [ ] **Step 7: Commit**

```bash
git add backend/app/query/dataset/schemas.py backend/app/query/dataset/execute_config.py \
  backend/app/query/executor.py backend/app/api/v1/query.py tests/test_mfinal_fd_r243.py
git commit -m "feat: add dataset execute-from-config API chain"
```

---

### Task 5: CONN-022 FE — GaussDB `CONNECTOR_FIELD_HINTS` + 辅助文案

**Files:**
- Modify: `fe/src/pages/admin/datasources/DatasourceFormPage.tsx`

**Interfaces:**
- Produces: `CONNECTOR_FIELD_HINTS.gaussdb` → port `5432`、databaseLabel `数据库 / Schema`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用既有 `Select`/`Input`/`Label`/`Card max-w-2xl`；禁止手写 dropdown 或页面内新 Button 样式
- 选 GaussDB 后 port 默认 5432；库名 Label 含「数据库 / Schema」
- 类型 Select 下方辅助文案 `text-theme-sm text-gray-500 dark:text-gray-400`：「GaussDB 兼容 PostgreSQL 协议，默认端口 5432」
- desktop/mobile：host/port grid 断点堆叠不变；辅助文案不挤压主表单
- `pnpm run check:design` 无新增 hex

- [ ] **Step 1: 扩展 `CONNECTOR_FIELD_HINTS`**

```typescript
  gaussdb: { port: "5432", databaseLabel: "数据库 / Schema", usernameLabel: "用户名" },
```

插入 `tidb` 行之后。

- [ ] **Step 2: 追加 GaussDB 辅助文案**

在 OceanBase hint 条件块之后追加：

```tsx
              {form.type === "gaussdb" ? (
                <p
                  id="gaussdb-hint"
                  className="text-theme-sm text-gray-500 dark:text-gray-400"
                >
                  GaussDB 兼容 PostgreSQL 协议，默认端口 5432
                </p>
              ) : null}
```

- [ ] **Step 3: database Input aria-describedby**

将 `aria-describedby` 表达式扩展为：

```tsx
aria-describedby={
  form.type === "oceanbase"
    ? "oceanbase-hint"
    : form.type === "gaussdb"
      ? "gaussdb-hint"
      : undefined
}
```

- [ ] **Step 4: 设计 drift 检查**

Run: `cd fe && pnpm run check:design 2>&1 | tail -3`
Expected: PASS，无新增违规

- [ ] **Step 5: Commit**

```bash
git add fe/src/pages/admin/datasources/DatasourceFormPage.tsx
git commit -m "feat: add GaussDB connector field hints to datasource form"
```

---

### Task 6: CONN-022 FE smoke — GaussDB 选型断言

**Files:**
- Modify: `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- MOCK_TYPES 含 `gaussdb` + displayName「GaussDB」
- 选 GaussDB → port `5432`；database label 含 Schema
- 辅助说明文案可见；Select combobox role 正确
- vitest RTL 覆盖；headless 云环境截图 skip（与 r242 一致）

- [ ] **Step 1: 扩展 MOCK_TYPES**

```typescript
    { type: "gaussdb", displayName: "GaussDB" },
```

- [ ] **Step 2: 追加两条 smoke**

```typescript
  it("T-CONN-R243-FE-01: selecting gaussdb sets port 5432", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("GaussDB");
    expect(screen.getByLabelText("端口")).toHaveValue(5432);
  });

  it("T-CONN-R243-FE-02: selecting gaussdb shows Schema database label and hint", async () => {
    renderForm();
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await selectType("GaussDB");
    expect(screen.getByLabelText(/Schema/)).toBeInTheDocument();
    expect(
      screen.getByText(/GaussDB 兼容 PostgreSQL 协议/),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 3: 运行 smoke**

Run: `cd fe && pnpm vitest run src/pages/admin/datasources/datasource-form.smoke.test.tsx`
Expected: 6 passed（原 4 + 新 2）

- [ ] **Step 4: Commit**

```bash
git add fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx
git commit -m "test: add GaussDB datasource form smoke tests"
```

---

### Task 7: 文档同步 — API + services 锚点

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/query.md`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: 更新 `docs/api/README.md`**

在 query 路由表追加两行：

```markdown
| POST | `/api/v1/query/configs/{config_id}/translate` | QUERY-008 | 已存 `dataset_query` 配置翻译为参数化 SQL | `backend/app/api/v1/query_configs.py` |
| POST | `/api/v1/query/dataset/execute` | QUERY-009 | `dataSourceId` + `configId` 存储→翻译→执行 | `backend/app/api/v1/query.py` |
```

在 GaussDB 方言段落补充 r243 companion 登记：

```markdown
**GaussDB companion r243（CONN-022）**：`probe_readonly_sql`（psycopg `SELECT 1`）+ Admin `DatasourceFormPage` hints；集成测 `tests/test_mfinal_fc_r242.py` T-CONN-R242-022-*。
```

- [ ] **Step 2: 更新 `docs/services/query.md`**

在 F-D 配置元模型章节追加 r243 锚点：

```markdown
### r243 F-D kickoff（QUERY-007~009）

- **QUERY-007**：`dataset_query` 配置类型 + `DatasetQueryConfigPayload` 校验 + `config_store/access.py` owner 守卫
- **QUERY-008**：`translator/from_config.py` → `POST /query/configs/{id}/translate`
- **QUERY-009**：`dataset/execute_config.py` → `POST /query/dataset/execute`（与 r53 内置 `demo-orders` 正交）
- **集成测**：`tests/test_mfinal_fd_r243.py` ≥18 断言
```

更新 In/Out：In 增加「已存 dataset_query 翻译与执行」；Out 明确不含 META-004 Dataset ORM、设计器 UI。

- [ ] **Step 3: 更新 `docs/services/datasources.md`**

GaussDB 行 companion 状态更新为 r243：`probe_readonly_sql` + FE hints port 5432。

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/query.md docs/services/datasources.md
git commit -m "docs: sync F-D r243 query chain and GaussDB companion anchors"
```

---

### Task 8: 全量回归闸门

**Files:**（验证 only，无新文件）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: ruff**

Run: `cd backend && ruff check app tests`
Expected: exit 0

- [ ] **Step 2: 后端回归套件**

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py tests/test_mfinal_fd_r243.py tests/test_meta_design_r33.py tests/test_query_meta_conn_r38.py tests/test_query_meta_conn_r39.py tests/test_dash_rpt_query_nfr_r53.py tests/test_dash_rpt_query_nfr_r57.py -q --tb=no 2>&1 | tail -5`
Expected: all passed（r242 原 25 + 新 5 GaussDB；r243 ≥14；回归全绿）

- [ ] **Step 3: 前端全量验证**

Run: `cd fe && pnpm run check:design && pnpm vitest run && pnpm run build 2>&1 | tail -5`
Expected: check:design PASS；vitest 全绿（含 datasource-form smoke 6/6）；build exit 0

- [ ] **Step 4: 记录验证（P4 前置）**

确认：`test_mfinal_fc_r242.py` ≥30 passed；`test_mfinal_fd_r243.py` ≥14 passed；无新增 skip 占位（除既有 compose skip）。

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| CONN-022 + QUERY-007~009 各 design 子项有对应 Task | Task 1/5/6 CONN-022；Task 2~4 QUERY 链 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 有验证命令 | 通过 |
| FE Task 含 UI skill + UI Acceptance | Task 5~6 |
| 预估文件数 ≤20 | 17 路径（3 新建 + 14 修改） |
| 不触 META / goal.md / plan.md 结构 | 通过 |
| 不修改 r53 resolve_query_path | 通过 |
