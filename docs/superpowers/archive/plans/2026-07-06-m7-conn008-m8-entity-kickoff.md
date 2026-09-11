# M7 Doris 收官 + M8 实体元数据 kickoff 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_connectors_m7_r229.py`、`backend/app/datasources/dialects/doris.py`、`backend/app/metadata/physical/schemas.py`、`backend/app/metadata/physical/service.py`、`backend/app/metadata/entity/schemas.py`、`backend/app/metadata/entity/service.py`、`backend/app/api/v1/metadata.py`、`backend/app/query/sql_parameters.py`、`backend/app/dashboard/global_filters/execute.py`、`backend/app/dashboard/global_filters/service.py`、`backend/app/api/v1/dashboards.py`、`tests/test_meta_dash_m8_r231.py`、`tests/test_cat_dash_viz_nfr_r61.py`、`fe/src/pages/admin/entities/EntityOverviewPage.tsx`、`fe/src/pages/admin/entities/entities-overview.smoke.test.tsx`、`fe/src/routes.tsx`、`fe/src/config/admin-nav.tsx`、`fe/src/lib/queryKeys.ts`、`docs/api/README.md`、`docs/services/datasources.md`、`docs/services/metadata.md`、`docs/services/dashboard.md`
> **子项：** CONN-008, META-005, META-006, DASH-004, DASH-005
> **续作分支：** `feat/m7-conn008-m8-entity-kickoff-r231`（rebase 至 `dev-auto` 后修复 ACL；禁止从零重复方言/页面骨架）
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` → `backend-fastapi.mdc`；触及 `fe/**` → `fe-ui.mdc`）

**Goal:** M7 闭合 CONN-008 Doris 集成验收；M8 kickoff 交付 META-005 `register-from-schema`、META-006 `physicalTableFqn` 映射、DASH-004 BE widget execute 全局筛选器链（含 §7.4.1 ACL 修复）、DASH-005 Admin 实体总览页 FR-6.2。

**Architecture:** 优先 rebase 孤儿分支已交付实现；CONN-008 仅补 `test_connectors_m7_r229.py` mock 分层；META-005 经 `datasources.metadata.list_columns` 编排登记；DASH-004 新增 `sql_parameters.py` + `execute.py`，管理 API `get_linkage` 保持 dev-auto 严格 owner/admin ACL，execute 消费链走无 actor ACL 的 `_load_linkage_payload`；DASH-005 FE 复用 TailAdmin 壳层与 shadcn 组件。

**Tech Stack:** FastAPI · Pydantic v2 · SQLAlchemy 2.x · pytest · ruff · React 19 · TanStack Query · Vitest · TailAdmin/shadcn · lucide-react

## Global Constraints

- **不修改** `docs/automate/goal.md` / `plan.md` 结构；PRD/plan 勾选 **P5 对账**（非 P3）
- **不新增** Alembic migration；physical/entity 仍为内存 store L1
- **不含** M9 DASH-006、M13 Dataset/META-001~004、M11 CONN-009、FE GlobalFilterBar 重写、Playwright E2E
- Doris 无 compose 时 integration skip（对齐 r228）；HTTP test 失败体 `ok=false` + `{PREFIX}_*` + 无 password 泄露
- ACL：管理 API `GET .../global-filters` 非 owner viewer → **403 `DASH_FILTER_FORBIDDEN`**（先于 config 查找）；execute 允许 viewer 消费已配置 linkage
- 文件预算：新建 **6** + 修改 **14** = **20**（`doris.py` 预期零改动）
- 验证基线（P3 开始前）：`cd backend && python3 -m pytest -q --co 2>/dev/null | tail -1`

---

### Task 0: 续作分支 rebase 与冲突策略

**Files:**
- Git: `feat/m7-conn008-m8-entity-kickoff-r231` ← `origin/dev-auto`

**Skills:**
- Read `.agents/skills/using-git-worktrees/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯 git 操作

**Interfaces:**
- Consumes: `origin/feat/m7-conn008-m8-entity-kickoff-r231`（含 CONN-008/META/DASH/FE 主体）
- Produces: 基于 `dev-auto` 的工作分支，后续 Task 在其上增量修复

- [ ] **Step 1: 检出续作分支并 rebase**

```bash
cd /workspace
git fetch origin dev-auto feat/m7-conn008-m8-entity-kickoff-r231
git checkout -B feat/m7-conn008-m8-entity-kickoff-r231 origin/feat/m7-conn008-m8-entity-kickoff-r231
git rebase origin/dev-auto
```

Expected: rebase 完成或列出冲突文件

- [ ] **Step 2: 冲突解决优先级（若 `backend/app/dashboard/global_filters/service.py` 冲突）**

保留 **dev-auto** 的 `_assert_access`（admin bypass；非 admin 须 `created_by == actor.id`）。**删除**孤儿分支 `_assert_read_access` 中对 `viewer`/`analyst` 的无条件 `return`。合并孤儿分支新增的 `execute` 相关导入与 `_load_linkage_payload`（Task 4 实现）。

`get_linkage` 必须调用 `_assert_access(actor, dashboard.created_by)`，**禁止** viewer blanket 放行。

- [ ] **Step 3: rebase 后继续**

```bash
git rebase --continue   # 若 Step 1 有冲突且已解决
git log --oneline -5
```

Expected: HEAD 基于最新 `origin/dev-auto`；工作区干净

- [ ] **Step 4: Commit（仅当冲突解决产生未提交变更时）**

```bash
git add backend/app/dashboard/global_filters/service.py
git commit -m "fix(dash): rebase dev-auto ACL baseline for global filter linkage"
```

---

### Task 1: CONN-008 — Doris M7 集成验收 r229

**Files:**
- Create: `tests/test_connectors_m7_r229.py`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端连接器集成测

**Interfaces:**
- Consumes: `DorisConnector`（`backend/app/datasources/dialects/doris.py` 已注册）、`export_type_catalog`、`registry.get("doris")`
- Produces: `test_conn_r229_008_01`~`04` 四条 CONN-008 断言；`docs/services/datasources.md` M7 r229 锚点

- [ ] **Step 1: 创建 `tests/test_connectors_m7_r229.py`**

```python
"""M7 CONN-008 Apache Doris r229 — M7 收官集成验收。

可选 compose：127.0.0.1:9030 可达时实库 test+schema；否则 skip。
"""
from __future__ import annotations

import json
import os
import socket
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pymysql
import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources.dialects.base import ColumnInfo, TableInfo
from app.datasources.dialects.doris import DorisConnector
from app.datasources.registry import export_type_catalog, registry
from app.main import app

AUTH = jwt_auth_headers()
_R229_SQLITE_URL = "sqlite+pysqlite:///file:connectors_m7_r229?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r229_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R229_SQLITE_URL
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


def test_conn_r229_008_01_types_catalog_doris():
    """T-CONN-R229-008-01: export_type_catalog 含 doris olap + schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "doris" in types
    assert types["doris"]["category"] == "olap"
    conn = registry.get("doris")
    assert isinstance(conn, DorisConnector)
    assert set(conn.capabilities) >= {"connectivity_test", "schema_browser"}


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r229_008_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R229-008-02: HTTP POST test mock 2003 → DORIS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "doris",
            "name": "doris-r229",
            "code": f"doris-{uuid.uuid4().hex[:8]}",
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
    assert body["code"] == "DORIS_CONN_REFUSED"
    assert "sample_secret" not in json.dumps(body)
    assert "password" not in resp.text.lower()


@patch("app.datasources.dialects.doris.DorisConnector.list_columns")
@patch("app.datasources.dialects.doris.DorisConnector.list_tables")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r229_008_03_http_metadata_columns_chain(
    mock_connect, mock_pool, mock_tables, mock_columns, client
):
    """T-CONN-R229-008-03: HTTP tables/columns mock → 200 + 列列表。"""
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
            "type": "doris",
            "name": "doris-meta-r229",
            "code": f"doris-meta-{uuid.uuid4().hex[:8]}",
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


def _port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


@pytest.mark.integration
def test_conn_r229_008_04_optional_live_doris(client):
    """T-CONN-R229-008-04: 127.0.0.1:9030 可达则实库连通；否则 skip。"""
    if not _port_open("127.0.0.1", 9030):
        pytest.skip("sample-doris not running on 127.0.0.1:9030")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "doris",
            "name": "doris-live-r229",
            "code": f"doris-live-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "information_schema",
            "username": "root",
            "password": "",
        },
    )
    assert resp.status_code == 200
    assert "password" not in resp.text.lower()
```

- [ ] **Step 2: 运行 CONN-008 子集**

Run: `cd backend && python3 -m pytest tests/test_connectors_m7_r229.py -v`
Expected: ≥3 passed, 0 failed（`008_04` skipped 无 Doris 时仍绿）

- [ ] **Step 3: 回归 r36/r37 Doris mock**

Run: `cd backend && python3 -m pytest tests/test_connectors_gov_r36.py tests/test_connectors_gov_r37.py -k doris -v`
Expected: PASS

- [ ] **Step 4: 更新 `docs/services/datasources.md`**

在「实现状态」或 M7 锚点表追加一行：

```markdown
| M7 r229 CONN-008 | `tests/test_connectors_m7_r229.py` | Doris 集成验收（mock + optional 9030 skip） | 已实现 |
```

- [ ] **Step 5: Commit**

```bash
git add tests/test_connectors_m7_r229.py docs/services/datasources.md
git commit -m "test(conn): M7 r229 Doris integration acceptance (CONN-008)"
```

---

### Task 2: META-005 — 物理表 register-from-schema

**Files:**
- Modify: `backend/app/metadata/physical/schemas.py`
- Modify: `backend/app/metadata/physical/service.py`
- Modify: `backend/app/api/v1/metadata.py`
- Create: `tests/test_meta_dash_m8_r231.py`（META-005 段；Task 4 扩展 DASH 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端元数据 API

**Interfaces:**
- Consumes: `app.datasources.metadata.service.list_columns`、`entity_service.get_entity_type`、`physical_service.register_physical_table`
- Produces: `PhysicalTableRegisterFromSchemaIn`；`register_from_schema(session, roles, payload, user)`；`GET /physical-tables?entityTypeCode=`；`POST /physical-tables/register-from-schema`

- [ ] **Step 1: 在 `physical/schemas.py` 追加 schema**

```python
class PhysicalTableRegisterFromSchemaIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    schema_name: str = Field(alias="schema", min_length=1, max_length=128)
    table: str = Field(min_length=1, max_length=128)
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    entity_type_code: str | None = Field(default=None, alias="entityTypeCode", max_length=64)
    table_fqn: str | None = Field(default=None, alias="tableFqn")
```

（文件顶部确保 `import uuid`）

- [ ] **Step 2: 在 `physical/service.py` 实现 `register_from_schema`**

```python
from app.datasources import metadata as ds_metadata_service
from app.datasources.service import DataSourceError
from app.metadata.entity import service as entity_service
from app.metadata.entity.errors import EntityTypeError
from app.metadata.physical.schemas import PhysicalTableRegisterFromSchemaIn

def _normalize_fqn(schema: str, table: str, explicit: str | None) -> str:
    if explicit:
        return explicit.lower()
    return f"{schema.lower()}.{table.lower()}"


def register_from_schema(
    session,
    roles: list[str],
    payload: PhysicalTableRegisterFromSchemaIn,
    user: UserContext,
) -> PhysicalTableOut:
    _assert_physical_write_access(user)
    if payload.entity_type_code:
        try:
            entity_service.get_entity_type(payload.entity_type_code)
        except EntityTypeError as exc:
            if exc.code == "META_ENTITY_TYPE_NOT_FOUND":
                raise PhysicalTableError("META_ENTITY_TYPE_NOT_FOUND", exc.message, 422) from exc
            raise
    try:
        columns_resp = ds_metadata_service.list_columns(
            session, roles, payload.data_source_id, payload.schema_name, payload.table
        )
    except DataSourceError as exc:
        if exc.code == "DATASOURCE_NOT_FOUND":
            raise PhysicalTableError("DATASOURCE_NOT_FOUND", exc.message, 404) from exc
        raise PhysicalTableError(exc.code, exc.message, exc.status) from exc
    table_fqn = _normalize_fqn(payload.schema_name, payload.table, payload.table_fqn)
    register_in = PhysicalTableRegisterIn(
        tableFqn=table_fqn,
        dataSourceId=payload.data_source_id,
        displayName=payload.display_name,
        entityTypeCode=payload.entity_type_code,
        columns=[
            {"name": c.name, "dataType": c.data_type, "nullable": c.nullable}
            for c in columns_resp.items
        ],
    )
    out = register_physical_table(register_in, user)
    if payload.entity_type_code:
        entity_service.increment_reference(payload.entity_type_code)
    return out


def list_physical_tables(
    limit: int = 50,
    offset: int = 0,
    entity_type_code: str | None = None,
) -> PhysicalTableListResponse:
    items = list(_store.values())
    if entity_type_code:
        items = [i for i in items if i.get("entityTypeCode") == entity_type_code]
    page = items[offset : offset + limit]
    return PhysicalTableListResponse(
        items=[PhysicalTableOut.model_validate(i) for i in page],
        total=len(items),
    )
```

- [ ] **Step 3: 在 `api/v1/metadata.py` 注册路由**

```python
from app.metadata.physical.schemas import PhysicalTableRegisterFromSchemaIn, PhysicalTableListResponse

@router.get("/physical-tables", response_model=PhysicalTableListResponse)
def list_physical_tables(
    entity_type_code: str | None = Query(default=None, alias="entityTypeCode"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Annotated[UserContext, Depends(get_current_user)] = None,
):
    return physical_service.list_physical_tables(limit=limit, offset=offset, entity_type_code=entity_type_code)


@router.post(
    "/physical-tables/register-from-schema",
    response_model=PhysicalTableOut,
    status_code=status.HTTP_201_CREATED,
)
def register_physical_from_schema(
    payload: PhysicalTableRegisterFromSchemaIn,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return physical_service.register_from_schema(db, user.roles, payload, user)
    except PhysicalTableError as exc:
        return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": exc.detail})
```

- [ ] **Step 4: 创建 `tests/test_meta_dash_m8_r231.py` META-005 用例**

```python
@patch("app.datasources.metadata.service.list_columns")
def test_meta_r231_005_01_register_from_schema_201(mock_list_columns, client):
    mock_list_columns.return_value = ColumnListResponse(items=[
        ColumnItemOut(name="id", data_type="bigint", nullable=False),
        ColumnItemOut(name="amount", data_type="decimal", nullable=True),
        ColumnItemOut(name="region", data_type="string", nullable=True),
    ])
    client.post("/api/v1/metadata/entity-types", headers=AUTH, json={"typeCode": "order", "displayName": "订单", "attributes": []})
    resp = client.post("/api/v1/metadata/physical-tables/register-from-schema", headers=AUTH, json={
        "dataSourceId": str(uuid.uuid4()), "schema": "sales", "table": "orders",
        "displayName": "订单表", "entityTypeCode": "order",
    })
    assert resp.status_code == 201
    assert resp.json()["tableFqn"] == "sales.orders"
    assert len(resp.json()["columns"]) == 3


def test_meta_r231_005_02_unknown_datasource_404(client):
    with patch("app.datasources.metadata.service.list_columns", side_effect=DataSourceError("DATASOURCE_NOT_FOUND", "missing", 404)):
        resp = client.post("/api/v1/metadata/physical-tables/register-from-schema", headers=AUTH, json={
            "dataSourceId": str(uuid.uuid4()), "schema": "s", "table": "t", "displayName": "x",
        })
    assert resp.status_code == 404
    assert resp.json()["code"] == "DATASOURCE_NOT_FOUND"
```

（文件需含 `r231_sqlite_env` module fixture，对齐 `test_cat_dash_viz_nfr_r61.py` 模式；`viewer_user` fixture 用于 005_03）

- [ ] **Step 5: 运行 META-005 子集**

Run: `cd backend && python3 -m pytest tests/test_meta_dash_m8_r231.py -k "005" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/metadata/physical/ backend/app/api/v1/metadata.py tests/test_meta_dash_m8_r231.py
git commit -m "feat(meta): physical table register-from-schema chain (META-005)"
```

---

### Task 3: META-006 — 实体类型 physicalTableFqn 映射

**Files:**
- Modify: `backend/app/metadata/entity/schemas.py`
- Modify: `backend/app/metadata/entity/service.py`
- Modify: `tests/test_meta_dash_m8_r231.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端

**Interfaces:**
- Consumes: `physical_service.get_physical_table`、`increment_reference`
- Produces: `physicalTableFqn` on create/update/out；delete 时 `META_ENTITY_TYPE_IN_USE` 当 ref>0

- [ ] **Step 1: 扩展 `entity/schemas.py`**

在 `EntityTypeCreate`、`EntityTypeUpdate`、`EntityTypeOut` 各加：

```python
_FQN_PATTERN = r"^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{1,63}$"
physical_table_fqn: str | None = Field(default=None, alias="physicalTableFqn", pattern=_FQN_PATTERN)
```

（`EntityTypeOut` 的 pattern 可省略，仅 alias）

- [ ] **Step 2: 在 `entity/service.py` 实现映射校验**

```python
from app.metadata.physical import service as physical_service
from app.metadata.physical.errors import PhysicalTableError

def _apply_physical_mapping(type_code: str, physical_fqn: str | None) -> None:
    if physical_fqn is None:
        return
    try:
        physical_service.get_physical_table(physical_fqn)
    except PhysicalTableError as exc:
        if exc.code == "META_PHYSICAL_NOT_FOUND":
            raise EntityTypeError("META_PHYSICAL_NOT_FOUND", exc.message, 422) from exc
        raise
    increment_reference(type_code)
```

在 `create_entity_type` record 写入 `"physicalTableFqn": payload.physical_table_fqn`，并调用 `_apply_physical_mapping`。

在 `update_entity_type`：若 `payload.physical_table_fqn is not None`，调用 `_apply_physical_mapping`。

- [ ] **Step 3: 追加 pytest 主链**

```python
def test_meta_r231_006_chain_register_type_bindings(client):
    """登记→类型配置→query-bindings 主链。"""
    ds_id = str(uuid.uuid4())
    with patch("app.datasources.metadata.service.list_columns") as mock_cols:
        mock_cols.return_value = ColumnListResponse(items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)])
        reg = client.post("/api/v1/metadata/physical-tables/register-from-schema", headers=AUTH, json={
            "dataSourceId": ds_id, "schema": "sales", "table": "orders", "displayName": "订单",
        })
    assert reg.status_code == 201
    fqn = reg.json()["tableFqn"]
    create = client.post("/api/v1/metadata/entity-types", headers=AUTH, json={
        "typeCode": "order", "displayName": "订单", "attributes": [], "physicalTableFqn": fqn,
    })
    assert create.status_code == 201
    bindings = client.get("/api/v1/metadata/entity-types/order/query-bindings", headers=AUTH)
    assert bindings.status_code == 200
```

- [ ] **Step 4: 运行 META-006 子集 + r54/r55 回归**

Run: `cd backend && python3 -m pytest tests/test_meta_dash_m8_r231.py -k "006" tests/test_meta_entity_r54.py tests/test_meta_entity_r55.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/entity/ tests/test_meta_dash_m8_r231.py
git commit -m "feat(meta): entity type physicalTableFqn mapping (META-006)"
```

---

### Task 4: DASH-004 — BE execute 链 + ACL 修复（§7.4.1）

**Files:**
- Create: `backend/app/query/sql_parameters.py`
- Create: `backend/app/dashboard/global_filters/execute.py`
- Modify: `backend/app/dashboard/global_filters/service.py`
- Modify: `backend/app/api/v1/dashboards.py`
- Modify: `tests/test_meta_dash_m8_r231.py`
- Modify: `tests/test_cat_dash_viz_nfr_r61.py`（确认 `test_dash_r61_004_forbidden_viewer` 绿）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端；FE GlobalFilterBar 已由 M-FE-3 交付，本轮不改

**Interfaces:**
- Consumes: `config_store.get_config_by_ref`、`query_service.execute_query`、`build_widget_filter_params`、`inject_sql_parameters`
- Produces: `POST /api/v1/dashboards/{dashboard_id}/widgets/{widget_id}/execute`；`_load_linkage_payload(session, dashboard_id) -> GlobalFilterLinkageItem`

- [ ] **Step 1: 创建 `backend/app/query/sql_parameters.py`**

```python
"""SQL {{key}} 参数注入 — 与 FE dashboardFilterUtils.injectSqlParameters 对称。"""
from __future__ import annotations

import re

from app.query.schemas import QueryError

_UNSAFE = re.compile(r"[;]|--|/\*")
_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


def inject_sql_parameters(sql: str, params: dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        value = params.get(key)
        if value is None:
            return match.group(0)
        if _UNSAFE.search(value):
            raise QueryError("QUERY_FILTER_UNSAFE", "Unsafe filter value", 422)
        return value.replace("'", "''")

    return _PLACEHOLDER.sub(repl, sql)


def build_widget_filter_params(
    widget_id: str,
    linkage: dict,
    filter_values: dict[str, str],
) -> dict[str, str]:
    out: dict[str, str] = {}
    for rule in linkage.get("linkageRules") or []:
        if widget_id not in rule.get("targetWidgetIds") or []:
            continue
        src = rule.get("sourceFilterId")
        key = rule.get("parameterKey")
        if not src or not key:
            continue
        value = filter_values.get(src)
        if value not in (None, ""):
            out[key] = value
    return out
```

- [ ] **Step 2: 修复 `global_filters/service.py` ACL + 新增 `_load_linkage_payload`**

确保 `_assert_access` **不含** viewer blanket 放行：

```python
def _assert_access(actor: UserContext, dashboard_created_by: uuid.UUID | None) -> None:
    if "admin" in actor.roles:
        return
    try:
        actor_uuid = uuid.UUID(actor.id)
    except ValueError:
        raise GlobalFilterError("DASH_FILTER_FORBIDDEN", "Access denied", 403) from None
    if dashboard_created_by is None or dashboard_created_by != actor_uuid:
        raise GlobalFilterError("DASH_FILTER_FORBIDDEN", "Access denied", 403)


def _load_linkage_payload(session: Session, dashboard_id: uuid.UUID) -> GlobalFilterLinkageItem:
    try:
        record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, dashboard_id)
    except ConfigError as exc:
        raise GlobalFilterError("DASH_FILTER_NOT_FOUND", "Global filter linkage not configured", 404) from exc
    return GlobalFilterLinkageItem.model_validate(record.payload)
```

`get_linkage` 保持：`_assert_enterprise_scope` → `_assert_access(actor, dashboard.created_by)` → config 查找。

**删除**若存在的 `_assert_read_access` 及对 `viewer`/`analyst` 的无条件 return。

- [ ] **Step 3: 创建 `global_filters/execute.py`**

```python
def execute_widget_with_filters(
    session: Session,
    dashboard_id: uuid.UUID,
    widget_id: str,
    filter_values: dict[str, str],
    actor: UserContext,
) -> ExecuteResponse:
    dashboard = dash_service.get_dashboard(session, dashboard_id)
    widget = _find_widget(dashboard.layout_json or {}, widget_id)
    chart = widget.get("chartConfig") or {}
    linkage_item = global_filter_service._load_linkage_payload(session, dashboard_id)
    linkage = linkage_item.model_dump(by_alias=True)
    params = build_widget_filter_params(widget_id, linkage, filter_values)
    sql = chart.get("sql") or ""
    injected = inject_sql_parameters(sql, params)
    req = ExecuteRequest(dataSourceId=chart.get("dataSourceId"), mode="sql", sql=injected, limit=100)
    return query_service.execute_query(session, actor, req)
```

- [ ] **Step 4: 在 `api/v1/dashboards.py` 注册 execute 路由**

```python
class WidgetExecuteIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    filter_values: dict[str, str] = Field(default_factory=dict, alias="filterValues")

@router.post("/{dashboard_id}/widgets/{widget_id}/execute", response_model=None)
def execute_dashboard_widget(
    dashboard_id: uuid.UUID,
    widget_id: str,
    payload: WidgetExecuteIn,
    user: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    from app.dashboard.global_filters.execute import execute_widget_with_filters
    try:
        return execute_widget_with_filters(db, dashboard_id, widget_id, payload.filter_values, user)
    except GlobalFilterError as exc:
        return _filter_error(exc)
    except QueryError as exc:
        return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": None})
```

- [ ] **Step 5: 追加 `test_meta_dash_m8_r231.py` DASH-004 用例**

含：`test_dash_r231_004_sql_parameters_mirror_fe`、`test_dash_r231_004_execute_merges_linkage`（mock execute_query）、`test_dash_r231_004_unsafe_filter_422`、`test_dash_r231_004_acl_forbidden_403`、`test_dash_r231_004_viewer_execute_200`。

- [ ] **Step 6: 验证 ACL 回归**

Run: `cd backend && python3 -m pytest tests/test_cat_dash_viz_nfr_r61.py::test_dash_r61_004_forbidden_viewer -v`
Expected: PASS，`code == DASH_FILTER_FORBIDDEN`（**403 非 404**）

Run: `cd backend && python3 -m pytest tests/test_meta_dash_m8_r231.py -k "004" tests/test_cat_dash_viz_nfr_r61.py -k "r61_004" -v`
Expected: 全绿

- [ ] **Step 7: Commit**

```bash
git add backend/app/query/sql_parameters.py backend/app/dashboard/global_filters/ backend/app/api/v1/dashboards.py tests/
git commit -m "feat(dash): widget execute with global filter merge + ACL split (DASH-004)"
```

---

### Task 5: DASH-005 — 实体总览页 Admin FE

**Files:**
- Create: `fe/src/pages/admin/entities/EntityOverviewPage.tsx`
- Create: `fe/src/pages/admin/entities/entities-overview.smoke.test.tsx`
- Modify: `fe/src/routes.tsx`
- Modify: `fe/src/config/admin-nav.tsx`
- Modify: `fe/src/lib/queryKeys.ts`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `AdminPageShell`、`Card`、`Button`、`Select`、`Skeleton`、`ScrollArea`；禁止原生 button/input
- desktop 与 mobile：统计 `grid-cols-2 md:grid-cols-4`；表格 `overflow-x-auto`；Tab 窄屏不叠压
- loading：`Skeleton` 卡片+表格行；empty：「暂无登记的实体表」/「请先配置实体类型」；error：`ErrorBanner`+重试；403：「无权查看实体总览」
- `pnpm run check:design` 无 hex 硬编码；侧栏 `Boxes` icon `size-6`

**Interfaces:**
- Consumes: `GET /api/v1/metadata/entity-types`、`GET /api/v1/metadata/physical-tables?entityTypeCode=`、`GET /api/v1/dashboards`、`GET .../entity-overview`
- Produces: 路由 `/admin/entities/overview`；侧栏「主题与实体」→「实体总览」

- [ ] **Step 1: 扩展 `fe/src/lib/queryKeys.ts`**

```typescript
export const queryKeys = {
  // ...existing...
  metadata: {
    entityTypes: ["metadata", "entity-types"] as const,
    physicalTables: (entityTypeCode?: string) =>
      ["metadata", "physical-tables", entityTypeCode ?? "all"] as const,
  },
};
```

- [ ] **Step 2: 更新 `fe/src/config/admin-nav.tsx`**

在「分析」与「系统」之间插入分组：

```typescript
import { Boxes, /* existing */ } from "lucide-react";

{
  title: "主题与实体",
  items: [
    {
      name: "实体总览",
      icon: <Boxes className="size-6" aria-hidden />,
      path: "/admin/entities/overview",
    },
  ],
},
```

- [ ] **Step 3: 注册路由 `fe/src/routes.tsx`**

```typescript
import { EntityOverviewPage } from "@/pages/admin/entities/EntityOverviewPage";

// 在 admin children 内：
{ path: "entities/overview", element: <EntityOverviewPage /> },
```

- [ ] **Step 4: 实现 `EntityOverviewPage.tsx`**

页面结构（对齐 design §7.5 / §8）：
- `AdminPageShell` title="实体总览"
- 权限：`canViewEntityOverview` = admin/analyst；否则渲染「无权查看实体总览」+ 返回 `/admin`
- 类型 Tab：手写 button row 或 `@/components/ui/tabs`；`activeType` state
- `useQuery` entity-types → 默认选中首项
- `useQuery` physical-tables filtered by tab
- 可选 Dashboard `Select` + entity-overview config 统计卡片 `grid grid-cols-2 md:grid-cols-4 gap-4`
- 表格 `Card` + `overflow-x-auto`；行「下钻」`Button variant="outline" size="sm"` → `navigate(/admin/dashboards/${targetDashboardId})`
- 错误态复用 `ErrorBanner` 模式（见孤儿分支实现，≤300 行；超出抽 `useEntityOverview.ts`）

- [ ] **Step 5: 创建 `entities-overview.smoke.test.tsx`**

Mock `apiFetch` 返回 entity-types + physical-tables + dashboards + entity-overview；断言：
- 渲染「实体总览」标题
- Tab「订单」可见
- 表格含「订单表」
- 下钻按钮存在

- [ ] **Step 6: FE 验证**

Run: `cd fe && pnpm run check:design`
Expected: PASS

Run: `cd fe && pnpm exec vitest run src/pages/admin/entities/entities-overview.smoke.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add fe/src/pages/admin/entities/ fe/src/routes.tsx fe/src/config/admin-nav.tsx fe/src/lib/queryKeys.ts
git commit -m "feat(fe): admin entity overview page with nav and smoke tests (DASH-005)"
```

---

### Task 6: API/域文档登记 + 全量回归门控

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/metadata.md`
- Modify: `docs/services/dashboard.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 文档与回归

**Interfaces:**
- Produces: API 登记行；services M8 锚点；P3 完成证据

- [ ] **Step 1: 登记 `docs/api/README.md`**

追加行（状态：已实现）：

```markdown
| POST | `/api/v1/metadata/physical-tables/register-from-schema` | M8 META-005 | 从数据源 schema 登记物理表 |
| GET | `/api/v1/metadata/physical-tables?entityTypeCode=` | M8 META-005 | 物理表列表过滤 |
| POST | `/api/v1/dashboards/{id}/widgets/{widgetId}/execute` | M8 DASH-004 | 全局筛选器驱动 widget 查询 |
```

- [ ] **Step 2: 更新 `docs/services/metadata.md` 与 `dashboard.md`**

metadata.md：META-005 `register_from_schema`、META-006 `physicalTableFqn` 锚点。

dashboard.md：DASH-004 `_load_linkage_payload` / execute 消费链说明。

- [ ] **Step 3: 后端全量回归**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -q`
Expected: exit 0；`test_dash_r61_004_forbidden_viewer` 与 `test_meta_dash_m8_r231` 全绿

- [ ] **Step 4: 前端回归**

Run: `cd fe && pnpm run check:design && pnpm exec vitest run && pnpm run build`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add docs/api/README.md docs/services/metadata.md docs/services/dashboard.md
git commit -m "docs: register M7/M8 API and service anchors for CONN-008/META/DASH kickoff"
```

---

## Self-Review（Planner）

| 检查项 | 结果 |
|--------|------|
| CONN-008 / META-005 / META-006 / DASH-004 / DASH-005 各有 Task | Task 1–5 覆盖 |
| ACL §7.4.1 显式 Task 4 Step 2 + Step 6 | ✓ |
| 续作 rebase Task 0 | ✓ |
| 无 TBD/TODO/适当处理 | ✓ |
| FE Task 5 含 UI skill + UI Acceptance | ✓ |
| 文件数 ≤20 | 20 |
| 每 Task 含验证命令 | ✓ |

## 执行说明（Automation）

**不询问用户** — P3 直接采用 **subagent-driven-development (option 1)**：按 Task 0→6 顺序派发子 agent，Task 间做两阶段 review。
