# M8 实体元数据与总览页收官实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/metadata/physical/schemas.py`、`backend/app/metadata/physical/errors.py`、`backend/app/metadata/physical/service.py`、`backend/app/api/v1/metadata.py`、`tests/test_meta_dash_m8_r232.py`、`fe/src/pages/admin/entities/useEntityOverview.ts`、`fe/src/pages/admin/entities/EntityDetailSheet.tsx`、`fe/src/pages/admin/entities/EntityOverviewPage.tsx`、`fe/src/pages/admin/entities/entities-overview.smoke.test.tsx`、`docs/api/README.md`、`docs/services/metadata.md`、`docs/services/dashboard.md`
> **子项：** META-005, META-006, DASH-005
> **续作基线：** `dev-auto`（PR #215 kickoff 已合并；禁止重复 register-from-schema / EntityOverviewPage 骨架）
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` → `backend-fastapi.mdc`；触及 `fe/**` → `fe-ui.mdc`）

**Goal:** M8 收官闭合 META-005 物理表 PUT/DELETE + `(dataSourceId,schema,table)` 复合唯一、META-006 `_ref_counts` 删/改绑对称、DASH-005 实体总览页详情 Sheet/空态引导/vitest ≥7 用例。

**Architecture:** 内存 store L1 增 `_ds_table_index` 与 `update_physical_table`/`delete_physical_table` 单点维护引用计数；FE 抽 `useEntityOverview` + `EntityDetailSheet` 使 `EntityOverviewPage` ≤300 行；pytest 新建 `test_meta_dash_m8_r232.py` 不修改 r231 回归文件。

**Tech Stack:** FastAPI · Pydantic v2 · pytest · ruff · React 19 · TanStack Query · Vitest · TailAdmin/shadcn · lucide-react

## Global Constraints

- **不修改** `docs/automate/goal.md` / `plan.md` 结构；PRD/plan 勾选 **P5 对账**（非 P3）
- **不新增** Alembic migration；physical/entity 仍为内存 store L1
- **不含** M9 DASH-006、M13 Dataset/META-001~004、GOV catalog 引用释放、Playwright E2E、Admin 实体类型/物理表编辑表单页
- 直登 `POST /physical-tables` **不参与** `(dataSourceId,schema,table)` 复合唯一（仅 register-from-schema 写 `_ds_table_index`）
- 文件预算：新建 **3** + 修改 **11** = **14**
- 验证基线（P3 开始前）：`cd backend && python3 -m pytest tests/test_meta_dash_m8_r231.py -q`

---

### Task 1: META-005 — schemas、errors 与 physical service 收官

**Files:**
- Modify: `backend/app/metadata/physical/schemas.py`
- Modify: `backend/app/metadata/physical/errors.py`
- Modify: `backend/app/metadata/physical/service.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 纯后端域服务

**Interfaces:**
- Consumes: `entity_service.increment_reference` / `decrement_reference` / `get_entity_type` / `bind_entity_type_code`（已有）
- Produces: `PhysicalTableUpdateIn`、`META_PHYSICAL_DS_TABLE_CONFLICT`、`_ds_table_index`、`update_physical_table(fqn, payload, user) -> PhysicalTableOut`、`delete_physical_table(fqn, user) -> None`；`register_from_schema` 写入 `sourceSchema`/`sourceTable` 并维护索引

- [ ] **Step 1: 扩展 schemas**

在 `backend/app/metadata/physical/schemas.py` 末尾追加 `PhysicalTableUpdateIn`，并将 `PhysicalTableOut` 改为带可选 source 字段：

```python
class PhysicalTableUpdateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    display_name: str | None = Field(default=None, alias="displayName", min_length=1, max_length=120)
    entity_type_code: str | None = Field(default=None, alias="entityTypeCode", max_length=64)


class PhysicalTableOut(PhysicalTableRegisterIn):
    source_schema: str | None = Field(default=None, alias="sourceSchema", max_length=128)
    source_table: str | None = Field(default=None, alias="sourceTable", max_length=128)
```

- [ ] **Step 2: 新增错误码常量**

在 `backend/app/metadata/physical/errors.py`：

```python
META_PHYSICAL_DS_TABLE_CONFLICT = "META_PHYSICAL_DS_TABLE_CONFLICT"
```

- [ ] **Step 3: 实现 `_ds_table_index` 与 CRUD 方法**

在 `backend/app/metadata/physical/service.py` 顶部 `_store` 旁新增：

```python
_ds_table_index: dict[tuple[str, str, str], str] = {}


def _ds_key(data_source_id, schema: str, table: str) -> tuple[str, str, str]:
    return (str(data_source_id).lower(), schema.lower(), table.lower())


def _remove_ds_index(record: dict) -> None:
    schema = record.get("sourceSchema")
    table = record.get("sourceTable")
    ds_id = record.get("dataSourceId")
    if schema and table and ds_id:
        _ds_table_index.pop(_ds_key(ds_id, schema, table), None)
```

修改 `register_from_schema`：在 `table_fqn = _normalize_fqn(...)` 之后、`register_in = ...` 之前插入复合唯一检查；在 `out = register_physical_table(...)` 成功后写入 source 字段与索引：

```python
    ds_key = _ds_key(payload.data_source_id, payload.schema_name, payload.table)
    if ds_key in _ds_table_index:
        raise PhysicalTableError(
            META_PHYSICAL_DS_TABLE_CONFLICT,
            "dataSourceId+schema+table already registered",
            409,
        )
    # ... existing register_in / register_physical_table ...
    _store[table_fqn]["sourceSchema"] = payload.schema_name
    _store[table_fqn]["sourceTable"] = payload.table
    _ds_table_index[ds_key] = table_fqn
```

在文件末尾追加（import `PhysicalTableUpdateIn` 与 `META_PHYSICAL_DS_TABLE_CONFLICT`）：

```python
def update_physical_table(fqn: str, payload: PhysicalTableUpdateIn, user: UserContext) -> PhysicalTableOut:
    _assert_physical_write_access(user)
    if fqn not in _store:
        raise PhysicalTableError("META_PHYSICAL_NOT_FOUND", f"tableFqn not found: {fqn}", 404)
    record = _store[fqn]
    if payload.display_name is not None:
        record["displayName"] = payload.display_name
    if payload.entity_type_code is not None:
        old_type = record.get("entityTypeCode")
        new_type = payload.entity_type_code or None
        if new_type:
            try:
                entity_service.get_entity_type(new_type)
            except EntityTypeError as exc:
                if exc.code == "META_ENTITY_TYPE_NOT_FOUND":
                    raise PhysicalTableError("META_ENTITY_TYPE_NOT_FOUND", exc.message, 422) from exc
                raise
        if old_type and old_type != new_type:
            entity_service.decrement_reference(old_type)
        if new_type and new_type != old_type:
            entity_service.increment_reference(new_type)
        record["entityTypeCode"] = new_type
        if new_type:
            bind_entity_type_code(fqn, new_type)
    return PhysicalTableOut.model_validate(record)


def delete_physical_table(fqn: str, user: UserContext) -> None:
    _assert_physical_write_access(user)
    if fqn not in _store:
        raise PhysicalTableError("META_PHYSICAL_NOT_FOUND", f"tableFqn not found: {fqn}", 404)
    record = _store[fqn]
    type_code = record.get("entityTypeCode")
    if type_code:
        entity_service.decrement_reference(type_code)
    _remove_ds_index(record)
    del _store[fqn]
```

- [ ] **Step 4: 验证 import 与 ruff**

```bash
cd /workspace/backend && python3 -c "from app.metadata.physical.service import update_physical_table, delete_physical_table; print('ok')"
cd /workspace/backend && python3 -m ruff check app/metadata/physical/
```

Expected: `ok` + ruff clean

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/physical/schemas.py backend/app/metadata/physical/errors.py backend/app/metadata/physical/service.py
git commit -m "feat(meta): META-005 physical table update/delete and ds-table uniqueness"
```

---

### Task 2: META-005/006 — API 路由 PUT/DELETE

**Files:**
- Modify: `backend/app/api/v1/metadata.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — API entry 薄层

**Interfaces:**
- Consumes: Task 1 的 `update_physical_table`、`delete_physical_table`、`PhysicalTableUpdateIn`
- Produces: `PUT /api/v1/metadata/physical-tables/{fqn}` → 200 `PhysicalTableOut`；`DELETE ...` → 204

- [ ] **Step 1: 追加 import**

在 `metadata.py` imports 中增加 `PhysicalTableUpdateIn`：

```python
from app.metadata.physical.schemas import (
    PhysicalTableOut,
    PhysicalTableRegisterFromSchemaIn,
    PhysicalTableRegisterIn,
    PhysicalTableUpdateIn,
    PhysicalTableValidateOut,
)
```

- [ ] **Step 2: 注册 PUT/DELETE 路由**

在 `physical_tables_validate` 之后追加：

```python
@router.put("/physical-tables/{fqn}", response_model=None)
def physical_tables_update(
    fqn: str,
    payload: PhysicalTableUpdateIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
):
    try:
        return physical_service.update_physical_table(fqn, payload, actor)
    except PhysicalTableError as exc:
        return _physical_error(exc)


@router.delete("/physical-tables/{fqn}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def physical_tables_delete(
    fqn: str,
    actor: Annotated[UserContext, Depends(get_current_user)],
):
    try:
        physical_service.delete_physical_table(fqn, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except PhysicalTableError as exc:
        return _physical_error(exc)
```

- [ ] **Step 3: 冒烟验证路由注册**

```bash
cd /workspace/backend && python3 -c "
from app.main import app
paths = {getattr(r,'path',None) for r in app.routes}
assert '/api/v1/metadata/physical-tables/{fqn}' in paths or any('physical-tables' in str(r) for r in app.routes)
print('routes ok')
"
cd /workspace/backend && python3 -m ruff check app/api/v1/metadata.py
```

Expected: `routes ok` + ruff clean

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/metadata.py
git commit -m "feat(api): add PUT/DELETE physical-tables endpoints for META-005"
```

---

### Task 3: META-005/006 — pytest 收官 `test_meta_dash_m8_r232.py`

**Files:**
- Create: `tests/test_meta_dash_m8_r232.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 后端 pytest

**Interfaces:**
- Consumes: Task 1–2 HTTP 路由；`physical_service._ds_table_index`（测试 teardown 须 `clear()`）
- Produces: ≥8 用例覆盖 register 复合唯一、PUT/DELETE、ref 计数链、viewer 403、r54/r65 回归锚点

- [ ] **Step 1: 创建测试文件**

```python
"""M8 r232 — META-005/006 收官 pytest。"""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.datasources.schemas import ColumnItemOut, ColumnListResponse
from app.main import app as fastapi_app
from app.metadata.entity import service as entity_service
from app.metadata.physical import service as physical_service
from jwt_auth import AUTH

_R232_SQLITE_URL = "sqlite+pysqlite:///file:meta_dash_m8_r232?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r232_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R232_SQLITE_URL
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
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clear_meta_stores():
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    yield
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r232", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _register_schema_payload(ds_id: str | None = None) -> dict:
    return {
        "dataSourceId": ds_id or str(uuid.uuid4()),
        "schema": "sales",
        "table": "orders",
        "displayName": "订单表",
        "entityTypeCode": "order",
    }


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_005_01_register_from_schema_has_source_fields(mock_list_columns, client):
    """T-META-R232-005-01: register-from-schema 含 sourceSchema/sourceTable。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    resp = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["sourceSchema"] == "sales"
    assert body["sourceTable"] == "orders"
    got = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"fqn": "sales.orders"})
    assert got.status_code == 200
    assert got.json()["sourceSchema"] == "sales"


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_005_02_ds_table_conflict_409(mock_list_columns, client):
    """T-META-R232-005-02: 同 dataSourceId+schema+table 二次登记 → 409。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    ds_id = str(uuid.uuid4())
    payload = _register_schema_payload(ds_id)
    first = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=payload,
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json={**payload, "tableFqn": "other.orders"},
    )
    assert second.status_code == 409
    assert second.json()["code"] == "META_PHYSICAL_DS_TABLE_CONFLICT"


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_005_03_put_delete_crud(mock_list_columns, client):
    """T-META-R232-005-03: PUT displayName + DELETE 204 + GET 404。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    reg = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert reg.status_code == 201
    put = client.put(
        "/api/v1/metadata/physical-tables/sales.orders",
        headers=AUTH,
        json={"displayName": "订单实体表"},
    )
    assert put.status_code == 200
    assert put.json()["displayName"] == "订单实体表"
    delete = client.delete("/api/v1/metadata/physical-tables/sales.orders", headers=AUTH)
    assert delete.status_code == 204
    got = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"fqn": "sales.orders"})
    assert got.status_code == 404
    assert got.json()["code"] == "META_PHYSICAL_NOT_FOUND"


def test_meta_r232_005_04_viewer_put_delete_forbidden(client, viewer_user):
    """T-META-R232-005-04: viewer PUT/DELETE → 403 META_PHYSICAL_FORBIDDEN。"""
    client.post(
        "/api/v1/metadata/physical-tables",
        headers=AUTH,
        json={
            "tableFqn": "sales.orders",
            "dataSourceId": str(uuid.uuid4()),
            "displayName": "订单",
            "columns": [{"name": "id", "dataType": "bigint", "nullable": False}],
        },
    )
    put = client.put(
        "/api/v1/metadata/physical-tables/sales.orders",
        headers=AUTH,
        json={"displayName": "x"},
    )
    assert put.status_code == 403
    assert put.json()["code"] == "META_PHYSICAL_FORBIDDEN"
    delete = client.delete("/api/v1/metadata/physical-tables/sales.orders", headers=AUTH)
    assert delete.status_code == 403


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_006_01_lifecycle_chain_delete_type(mock_list_columns, client):
    """T-META-R232-006-01: 登记→删 physical→删 type 全链 204。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    reg = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert reg.status_code == 201
    assert client.delete("/api/v1/metadata/physical-tables/sales.orders", headers=AUTH).status_code == 204
    del_type = client.delete("/api/v1/metadata/entity-types/order", headers=AUTH)
    assert del_type.status_code == 204


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_006_02_delete_type_in_use_409(mock_list_columns, client):
    """T-META-R232-006-02: 有登记引用时删 type → 409 META_ENTITY_TYPE_IN_USE。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    assert client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    ).status_code == 201
    resp = client.delete("/api/v1/metadata/entity-types/order", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_ENTITY_TYPE_IN_USE"


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_006_03_put_rebind_entity_type(mock_list_columns, client):
    """T-META-R232-006-03: PUT 改绑 entityTypeCode 后 list filter 正确。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "customer", "displayName": "客户", "attributes": []},
    )
    client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json={**_register_schema_payload(), "entityTypeCode": "order"},
    )
    put = client.put(
        "/api/v1/metadata/physical-tables/sales.orders",
        headers=AUTH,
        json={"entityTypeCode": "customer"},
    )
    assert put.status_code == 200
    listed = client.get(
        "/api/v1/metadata/physical-tables",
        headers=AUTH,
        params={"entityTypeCode": "customer"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["entityTypeCode"] == "customer"


def test_meta_r232_006_04_validate_invalid_attr_422(client):
    """T-META-R232-006-04: POST validate 非法 attribute → 422（r54 回归）。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "bad",
            "displayName": "Bad",
            "attributes": [{"name": "1invalid", "dataType": "string"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_ENTITY_TYPE_INVALID_ATTR"


def test_meta_r232_005_05_probe_budget_regression(client):
    """T-META-R232-005-05: probe_validate/list 预算回归（r65 锚点）。"""
    from app.metadata.physical.service import (
        probe_list_physical_tables_budget_ms,
        probe_validate_physical_budget_ms,
    )

    assert probe_validate_physical_budget_ms().ok is True
    assert probe_list_physical_tables_budget_ms().ok is True
```

- [ ] **Step 2: 运行 pytest**

```bash
cd /workspace/backend && python3 -m pytest tests/test_meta_dash_m8_r232.py -v
```

Expected: 9 passed（或 ≥8 passed，视实现微调）

- [ ] **Step 3: r231 回归不破坏**

```bash
cd /workspace/backend && python3 -m pytest tests/test_meta_dash_m8_r231.py -q
```

Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add tests/test_meta_dash_m8_r232.py
git commit -m "test(meta): META-005/006 M8 completion pytest r232"
```

---

### Task 4: DASH-005 — `useEntityOverview` 与 `EntityDetailSheet`

**Files:**
- Create: `fe/src/pages/admin/entities/useEntityOverview.ts`
- Create: `fe/src/pages/admin/entities/EntityDetailSheet.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `AdminPageShell`、`@/components/ui/sheet`、`Card`、`Badge`、`Button`；无 hex 硬编码
- desktop 与 mobile：`Sheet` 使用 `sm:max-w-lg`；columns 区 loading Skeleton
- hover/focus：`Button` `focus-visible:ring-2`；Sheet 关闭按钮可 Tab 聚焦
- `pnpm run check:design` 对新建文件 PASS

**Interfaces:**
- Consumes: `queryKeys.metadata.*`、`apiFetch`、`useAuth`
- Produces: `useEntityOverview()` 返回 `{ canRead, activeType, setActiveType, dashboardId, setDashboardId, selectedRow, setSelectedRow, entityTypesQuery, physicalQuery, dashboardsQuery, overviewQuery, drillTargetId, entityTypeMismatch }`；`EntityDetailSheet` props `{ open, onOpenChange, row, entityType, drillTargetId, onDrill }`

- [ ] **Step 1: 创建 `useEntityOverview.ts`**

```typescript
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export type EntityTypeOut = {
  typeCode: string;
  displayName: string;
  attributes: { name: string; dataType: string }[];
  lifecycleStates: string[];
};

export type PhysicalTableOut = {
  tableFqn: string;
  displayName: string;
  dataSourceId: string;
  columns: { name: string; dataType: string; nullable?: boolean }[];
  entityTypeCode?: string | null;
};

export type EntityOverviewOut = {
  dashboardId: string;
  entityTypeRef: string;
  statCards: { metricKey: string; label: string }[];
  filters: unknown[];
  drillTargets: { widgetId: string; targetDashboardId?: string | null }[];
};

function canViewEntityOverview(roles: string[]): boolean {
  return roles.some((r) => r === "admin" || r === "analyst");
}

export function useEntityOverview() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canRead = canViewEntityOverview(roles);

  const [activeType, setActiveType] = useState<string | null>(null);
  const [dashboardId, setDashboardId] = useState<string>("");
  const [selectedRow, setSelectedRow] = useState<PhysicalTableOut | null>(null);

  const entityTypesQuery = useQuery({
    queryKey: queryKeys.metadata.entityTypes,
    queryFn: () => apiFetch<{ items: EntityTypeOut[] }>("/api/v1/metadata/entity-types"),
    enabled: canRead,
  });

  useEffect(() => {
    const first = entityTypesQuery.data?.items[0]?.typeCode;
    if (first && !activeType) setActiveType(first);
  }, [entityTypesQuery.data, activeType]);

  const physicalQuery = useQuery({
    queryKey: queryKeys.metadata.physicalTables(activeType ?? undefined),
    enabled: Boolean(activeType) && canRead,
    queryFn: () =>
      apiFetch<{ items: PhysicalTableOut[]; total: number }>(
        `/api/v1/metadata/physical-tables?entityTypeCode=${encodeURIComponent(activeType!)}`,
      ),
  });

  const dashboardsQuery = useQuery({
    queryKey: queryKeys.dashboards.list(),
    queryFn: () => apiFetch<{ items: { id: string; name: string }[] }>("/api/v1/dashboards"),
    enabled: canRead,
  });

  useEffect(() => {
    const first = dashboardsQuery.data?.items[0]?.id;
    if (first && !dashboardId) setDashboardId(first);
  }, [dashboardsQuery.data, dashboardId]);

  const overviewQuery = useQuery({
    queryKey: queryKeys.metadata.entityOverview(dashboardId),
    enabled: Boolean(dashboardId) && canRead,
    queryFn: () => apiFetch<EntityOverviewOut>(`/api/v1/dashboards/${dashboardId}/entity-overview`),
  });

  const drillTargetId = useMemo(() => {
    const targets = overviewQuery.data?.drillTargets ?? [];
    return targets.find((t) => t.targetDashboardId)?.targetDashboardId ?? null;
  }, [overviewQuery.data]);

  const entityTypeMismatch =
    Boolean(activeType && overviewQuery.data?.entityTypeRef) &&
    overviewQuery.data!.entityTypeRef !== activeType;

  const activeEntityType = entityTypesQuery.data?.items.find((t) => t.typeCode === activeType) ?? null;

  return {
    canRead,
    activeType,
    setActiveType,
    dashboardId,
    setDashboardId,
    selectedRow,
    setSelectedRow,
    entityTypesQuery,
    physicalQuery,
    dashboardsQuery,
    overviewQuery,
    drillTargetId,
    entityTypeMismatch,
    activeEntityType,
    entityTypes: entityTypesQuery.data?.items ?? [],
    physicalItems: physicalQuery.data?.items ?? [],
    statCards: overviewQuery.data?.statCards ?? [],
  };
}
```

- [ ] **Step 2: 创建 `EntityDetailSheet.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { EntityTypeOut, PhysicalTableOut } from "./useEntityOverview";

type EntityDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PhysicalTableOut | null;
  entityType: EntityTypeOut | null;
  drillTargetId: string | null;
  onDrill: () => void;
  loading?: boolean;
};

export function EntityDetailSheet({
  open,
  onOpenChange,
  row,
  entityType,
  drillTargetId,
  onDrill,
  loading = false,
}: EntityDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg" aria-labelledby="entity-detail-title">
        <SheetHeader>
          <SheetTitle id="entity-detail-title" className="text-title-sm">
            {row?.displayName ?? "实体详情"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {loading || !row ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">tableFqn</p>
                <p className="truncate font-mono text-theme-sm text-gray-800 dark:text-white/90" title={row.tableFqn}>
                  {row.tableFqn}
                </p>
              </div>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">dataSourceId</p>
                <p className="truncate font-mono text-theme-sm text-gray-800 dark:text-white/90" title={row.dataSourceId}>
                  {row.dataSourceId}
                </p>
              </div>
              <div>
                <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">字段列</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  {row.columns.length === 0 ? (
                    <li className="text-theme-sm text-gray-500">暂无列信息</li>
                  ) : (
                    row.columns.map((c) => (
                      <li key={c.name} className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                        {c.name} <span className="text-gray-400">({c.dataType})</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              {entityType ? (
                <div>
                  <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">类型属性</p>
                  <ul className="space-y-1 text-theme-sm text-gray-600 dark:text-gray-400">
                    {entityType.attributes.length === 0 ? (
                      <li>暂无属性定义</li>
                    ) : (
                      entityType.attributes.map((a) => (
                        <li key={a.name}>
                          {a.name} ({a.dataType})
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
        <SheetFooter className="border-t border-gray-200 p-4 dark:border-gray-800">
          <Button
            type="button"
            disabled={!drillTargetId}
            title={drillTargetId ? undefined : "请先在 Dashboard 配置实体总览下钻目标"}
            onClick={onDrill}
          >
            下钻至 Dashboard
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: 设计 drift 检查**

```bash
cd /workspace/fe && pnpm run check:design
```

Expected: PASS（含新建文件）

- [ ] **Step 4: Commit**

```bash
git add fe/src/pages/admin/entities/useEntityOverview.ts fe/src/pages/admin/entities/EntityDetailSheet.tsx
git commit -m "feat(fe): DASH-005 entity overview hook and detail sheet"
```

---

### Task 5: DASH-005 — `EntityOverviewPage` 收官与 vitest

**Files:**
- Modify: `fe/src/pages/admin/entities/EntityOverviewPage.tsx`
- Modify: `fe/src/pages/admin/entities/entities-overview.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 空 physical 态含 `Link` 至 `/admin/datasources`；`entityTypeRef` 不一致显示 warning `Badge`
- 表格行「详情」+「下钻」；`aria-label="登记物理表"`
- desktop/mobile 无重叠溢出；`EntityOverviewPage.tsx` ≤300 行
- vitest ≥7 用例全绿；`pnpm run check:design` PASS

**Interfaces:**
- Consumes: Task 4 的 `useEntityOverview`、`EntityDetailSheet`
- Produces: 收官页面 + T-DASH-005-04~07 vitest

- [ ] **Step 1: 重写 `EntityOverviewPage.tsx` 使用 hook**

将页面改为导入 hook 与 Sheet，核心结构：

```tsx
import { Link, useNavigate } from "react-router";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { mapApiError } from "@/lib/apiError";
import { EntityDetailSheet } from "./EntityDetailSheet";
import { useEntityOverview } from "./useEntityOverview";

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-error-500 bg-error-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-error-500/30 dark:bg-error-500/15">
      <p className="text-theme-sm text-error-700 dark:text-error-400">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

export function EntityOverviewPage() {
  const navigate = useNavigate();
  const {
    canRead,
    activeType,
    setActiveType,
    dashboardId,
    setDashboardId,
    selectedRow,
    setSelectedRow,
    entityTypesQuery,
    physicalQuery,
    dashboardsQuery,
    overviewQuery,
    drillTargetId,
    entityTypeMismatch,
    activeEntityType,
    entityTypes,
    physicalItems,
    statCards,
  } = useEntityOverview();

  const [detailOpen, setDetailOpen] = useState(false);

  if (!canRead) {
    return (
      <AdminPageShell title="实体总览" description="按实体类型浏览登记物理表并下钻至 Dashboard。">
        <Card>
          <CardContent className="py-10 text-center text-theme-sm text-gray-600 dark:text-gray-400">
            无权查看实体总览
          </CardContent>
        </Card>
      </AdminPageShell>
    );
  }

  // ... 保留 ErrorBanner、类型 pill、Dashboard Select、entityTypeMismatch Badge warning
  // statCards count 使用 physicalQuery.data?.total
  // empty physical: Link to="/admin/datasources" 文案「前往数据源浏览 schema」
  // 表格每行: 「详情」onClick setSelectedRow+setDetailOpen(true); 「下钻」navigate
  // <EntityDetailSheet open={detailOpen} onOpenChange={setDetailOpen} row={selectedRow} ... />
}
```

完整实现须包含：`import { useState } from "react"`；`entityTypeMismatch` 时渲染：

```tsx
{entityTypeMismatch ? (
  <Badge variant="light" color="warning" size="sm">
    配置实体类型与当前 Tab 不一致
  </Badge>
) : null}
```

空 physical 态：

```tsx
<div className="space-y-3 p-6 text-center">
  <p className="text-theme-sm text-gray-600 dark:text-gray-400">暂无登记的实体表</p>
  <Button variant="outline" size="sm" asChild>
    <Link to="/admin/datasources">前往数据源浏览 schema</Link>
  </Button>
</div>
```

表格 `aria-label="登记物理表"`；下钻 disabled 时 `title="请先在 Dashboard 配置实体总览下钻目标"`。

- [ ] **Step 2: 扩展 vitest（+4 用例）**

在 `entities-overview.smoke.test.tsx` 追加：

```typescript
import userEvent from "@testing-library/user-event";
import { useNavigate } from "react-router";

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// T-DASH-005-04: viewer 权限
it("T-DASH-005-04: viewer role shows forbidden message", async () => {
  vi.doMock("@/context/auth-context", () => ({
    useAuth: () => ({
      user: { id: "v1", username: "viewer", roles: ["viewer"] },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  }));
  const { EntityOverviewPage: ViewerPage } = await import("./EntityOverviewPage");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ViewerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("无权查看实体总览")).toBeInTheDocument();
});

// T-DASH-005-05: empty physical + datasources link
it("T-DASH-005-05: empty physical shows datasources link", async () => {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === "/api/v1/metadata/entity-types") {
      return { items: [{ typeCode: "order", displayName: "订单", attributes: [], lifecycleStates: [] }] };
    }
    if (path.includes("physical-tables")) return { items: [], total: 0 };
    if (path.startsWith("/api/v1/dashboards") && !path.includes("entity-overview")) {
      return { items: [{ id: "d1", name: "看板" }] };
    }
    if (path.includes("entity-overview")) {
      return { dashboardId: "d1", entityTypeRef: "order", statCards: [], filters: [], drillTargets: [] };
    }
    return { items: [] };
  });
  renderOverview();
  expect(await screen.findByText("暂无登记的实体表")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "前往数据源浏览 schema" })).toHaveAttribute("href", "/admin/datasources");
});

// T-DASH-005-06: 详情 Sheet
it("T-DASH-005-06: detail sheet shows tableFqn", async () => {
  const user = userEvent.setup();
  renderOverview();
  await user.click(await screen.findByRole("button", { name: "详情" }));
  expect(await screen.findByText("sales.orders")).toBeInTheDocument();
});

// T-DASH-005-07: 下钻 navigate
it("T-DASH-005-07: drill navigates to dashboard", async () => {
  const user = userEvent.setup();
  mockNavigate.mockClear();
  renderOverview();
  await user.click(await screen.findByRole("button", { name: "下钻" }));
  expect(mockNavigate).toHaveBeenCalledWith("/admin/dashboards/d2");
});
```

注：T-DASH-005-04 若 `vi.doMock` 与顶层 mock 冲突，可改为单独 `describe` 文件内 `beforeEach` 覆盖 `useAuth` mock 工厂；须保证 7 用例全绿。

- [ ] **Step 3: 运行 vitest 与设计检查**

```bash
cd /workspace/fe && pnpm exec vitest run src/pages/admin/entities/entities-overview.smoke.test.tsx
cd /workspace/fe && pnpm run check:design
wc -l src/pages/admin/entities/EntityOverviewPage.tsx
```

Expected: vitest ≥7 passed；check:design PASS；页面 ≤300 行

- [ ] **Step 4: Commit**

```bash
git add fe/src/pages/admin/entities/EntityOverviewPage.tsx fe/src/pages/admin/entities/entities-overview.smoke.test.tsx
git commit -m "feat(fe): DASH-005 entity overview completion UX and vitest"
```

---

### Task 6: 文档锚点回写（api + services）

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/metadata.md`
- Modify: `docs/services/dashboard.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**UI Acceptance:**
- N/A — 文档同步

**Interfaces:**
- Consumes: Task 1–5 已实现路由与 FE 锚点
- Produces: API 登记 PUT/DELETE + 错误码；services M8 r232 收官锚点

- [ ] **Step 1: 更新 `docs/api/README.md`**

在现有 `physical-tables/register-from-schema` 行之后插入：

```markdown
| POST | `/api/v1/metadata/physical-tables` | M8 META-005 直登物理表（`tableFqn` 唯一） | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET | `/api/v1/metadata/physical-tables?fqn=` | M8 META-005 单条 physical 详情 | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| PUT | `/api/v1/metadata/physical-tables/{fqn}` | M8 META-005 更新 displayName/entityTypeCode | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| DELETE | `/api/v1/metadata/physical-tables/{fqn}` | M8 META-005 删除登记（204） | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
```

在 metadata 错误码表（若 README 有附录）补充 `META_PHYSICAL_DS_TABLE_CONFLICT`。

- [ ] **Step 2: 更新 `docs/services/metadata.md`**

在 `physical/service` 行改为：

```markdown
| `physical/service` | 物理表 validate/register/list/update/delete + register-from-schema + `_ds_table_index` 复合唯一 | META-005 | L1 M8 r232 收官 |
```

错误码表追加：

```markdown
| `META_PHYSICAL_DS_TABLE_CONFLICT` | 同 dataSourceId+schema+table 重复 register-from-schema |
```

- [ ] **Step 3: 更新 `docs/services/dashboard.md`**

在 entity_overview 或 FE 消费段追加：

```markdown
- **FE 消费**：`fe/src/pages/admin/entities/EntityOverviewPage.tsx` + `useEntityOverview.ts` + `EntityDetailSheet.tsx`（DASH-005 M8 r232 收官：详情 Sheet、空态引导、权限/下钻 vitest）
```

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/metadata.md docs/services/dashboard.md
git commit -m "docs: M8 META-005/006/DASH-005 completion anchors"
```

---

## 回归门控（P3 收官自检）

```bash
cd /workspace/backend && python3 -m ruff check .
cd /workspace/backend && python3 -m pytest tests/test_meta_dash_m8_r232.py tests/test_meta_dash_m8_r231.py -q
cd /workspace/fe && pnpm run check:design
cd /workspace/fe && pnpm exec vitest run src/pages/admin/entities/entities-overview.smoke.test.tsx
cd /workspace/fe && pnpm run build
```

Expected: ruff clean；pytest 全 PASS；vitest ≥7；build exit 0

---

## Self-Review（P2 已完成）

| 检查项 | 结果 |
|--------|------|
| META-005 design §7.1 全覆盖 | Task 1–3 |
| META-006 ref 生命周期 | Task 1 + Task 3 链式用例 |
| DASH-005 Sheet/hook/vitest | Task 4–5 |
| 文件数 14 | 3 新建 + 11 修改 |
| 无 TBD/TODO | ✓ |
| FE UI skill + UI Acceptance | Task 4–5 |
| 非目标未纳入 | ✓ |
