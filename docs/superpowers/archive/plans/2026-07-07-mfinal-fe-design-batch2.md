# M-FINAL · F-E 设计器收官 + 治理发布链前半段（批次 2）实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/designer/snapshot.py`、`backend/app/designer/workflow.py`、`backend/app/designer/sql_mode.py`、`backend/app/api/v1/designer.py`、`backend/app/governance/query_design/service.py`、`backend/app/governance/publish/service.py`、`backend/app/governance/openapi/service.py`、`backend/app/api/v1/gov.py`、`tests/test_mfinal_fe_design_r246.py`（新建）、`fe/src/pages/admin/designer/DesignerPage.tsx`、`fe/src/pages/admin/designer/designer-sql-panel.tsx`（新建）、`fe/src/pages/admin/designer/useDesignerWorkspace.ts`、`fe/src/pages/admin/governance/GovernanceWorkflowPage.tsx`、`fe/src/pages/admin/governance/GovernancePublishPage.tsx`、`fe/src/lib/queryKeys.ts`、`docs/api/README.md`、`docs/services/designer.md`、`docs/services/governance.md`
> **子项：** DESIGN-004、DESIGN-005、GOV-004、GOV-005、GOV-006
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端预指定 fastapi + TDD；UI 预指定 b-design-system-tailadmin-radix）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`；`fe-ui.mdc` 匹配 `fe/**`）

**Goal:** F-E 批次 2：补全设计器工单双向关联与快照 ACL；Admin 传统 SQL 模式；审批态可视化查询设计确认；from-workflow 查询服务发布；发布后 OpenAPI 3.1 文档生成与预览。

**Architecture:** `get_snapshot_for_actor` 在 config_store owner 基础上做 ACL；`workflow.py` 增加反向 link 查询与 draft 态撤回守卫；`design_mode` config_type 与既有 `sql_mode` 共享 `refId`；`submit_with_snapshot` 按 mode 分支完整性校验并写入 `snapshotRevision`；治理侧 `load_design_from_workflow` 投影 snapshot 为 `VisualQueryDesignOut`，`confirm_approved_design` 流转至 `pending_publish`；`publish_from_workflow` 创建 catalog entry 并链式 submit/approve，钩子触发 `generate_openapi_document`；FE 增加 Segmented SQL 模式、`GovernanceWorkflowPage` 工单实例 Tab、`GovernancePublishPage` 行内发布与 OpenAPI Sheet。

**Tech Stack:** Python 3.12 + FastAPI + SQLAlchemy + pytest；React 18 + TanStack Query + shadcn/ui + vitest。

## Global Constraints

- 不修改 `goal.md` / `docs/automate/plan.md` 结构；PRD 分片勾选留给 P5
- 单 Python 业务文件 ≤ 200 行；`DesignerPage.tsx` / `useDesignerWorkspace.ts` 各 ≤ 300 行
- 不引入 Monaco/CodeMirror 或新 npm SQL 编辑器依赖；`highlightSupported` 保持 false
- preview translate / sql validate / openapi validate probe ≤ **50ms**
- FSM 五态节点 id 固定（`draft`→`published`）；内置模板 `standard_query_release` 只读
- 角色白名单：`requester` | `approver` | `designer` | `publisher` | `admin`
- 错误码与 design 一致（`DESIGN_*`、`GOV_*`）
- 文档同步：`docs/api/README.md` + `docs/services/designer.md` + `docs/services/governance.md`（`prd-sync.mdc`）
- 提交格式：`feat:` / `test:` / `docs:` + 英文动词短语
- 分支建议：`feat/mfinal-fe-design-r246`（自 `dev-auto`）

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `backend/app/designer/snapshot.py` | **修改** | `get_snapshot_for_actor()`、`assert_snapshot_readable()` |
| `backend/app/designer/workflow.py` | **修改** | `get_link_by_instance()`、`delete_workflow_link()`、`snapshotRevision` 写入 |
| `backend/app/designer/sql_mode.py` | **修改** | `get_design_mode()`、`set_design_mode()` |
| `backend/app/api/v1/designer.py` | **修改** | snapshots GET、workflow-link 反向/DELETE、design-mode GET/PUT |
| `backend/app/governance/query_design/service.py` | **修改** | `load_design_from_workflow()`、`confirm_approved_design()` |
| `backend/app/governance/publish/service.py` | **修改** | `publish_from_workflow()`、`rollback_entry_skeleton()` |
| `backend/app/governance/openapi/service.py` | **修改** | `generate_openapi_document()`、`redact_openapi_fields()`、发布钩子 |
| `backend/app/api/v1/gov.py` | **修改** | instances 列表、approved-design、confirm-design、from-workflow、openapi GET |
| `tests/test_mfinal_fe_design_r246.py` | **新建** | ≥30 条 F-E 批次 2 pytest |
| `fe/src/pages/admin/designer/designer-sql-panel.tsx` | **新建** | 数据源 + SQL Textarea + 校验/保存 |
| `fe/src/pages/admin/designer/DesignerPage.tsx` | **修改** | Segmented 可视化/SQL 切换 |
| `fe/src/pages/admin/designer/useDesignerWorkspace.ts` | **修改** | `designMode`、sql-mode load/save、提交后 invalidate |
| `fe/src/pages/admin/governance/GovernanceWorkflowPage.tsx` | **修改** | 工单实例 Tab + 快照只读回看 |
| `fe/src/pages/admin/governance/GovernancePublishPage.tsx` | **修改** | 行内发布操作 + OpenAPI Sheet |
| `fe/src/lib/queryKeys.ts` | **修改** | designer.snapshot/designMode/sqlMode；gov.workflowInstances/publishOpenapi |
| `docs/api/README.md` | **修改** | 新路由登记 |
| `docs/services/designer.md` | **修改** | 快照 ACL、设计模式、SQL UI 锚点 |
| `docs/services/governance.md` | **修改** | 审批态设计、from-workflow 发布、OpenAPI GET |

---

### Task 1: DESIGN-004 — 快照 ACL + workflow-link 反向查询与撤回守卫

**Files:**
- Modify: `backend/app/designer/snapshot.py`
- Modify: `backend/app/designer/workflow.py`
- Create: `tests/test_mfinal_fe_design_r246.py`（module fixture + 004 区块前 4 条）

**Interfaces:**
- Produces: `get_snapshot_for_actor(session, snapshot_id, actor) -> dict`
- Produces: `assert_snapshot_readable(session, snapshot_id, actor) -> None`（403 `DESIGN_SNAPSHOT_FORBIDDEN`）
- Produces: `get_link_by_instance(session, workflow_instance_id) -> DesignerWorkflowLinkOut`
- Produces: `delete_workflow_link(session, designer_item_id, actor) -> None`（204 或 409 `DESIGN_WORKFLOW_LINK_NOT_REVOKABLE`）
- Produces: `submit_with_snapshot` 写入 instance payload `snapshotRevision`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

- [ ] **Step 1: 新建测试文件与 module fixture**

创建 `tests/test_mfinal_fe_design_r246.py`（复用 r245 SQLite fixture 模式，URL 改为 `mfinal_fe_r246`）：

```python
"""M-FINAL F-E r246 — DESIGN-004~005 + GOV-004~006 批次 2。"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import jwt_auth_headers

_R246_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fe_r246?mode=memory&cache=shared&uri=true"
REF_ID = "00000000-0000-4000-8000-000000000002"


@pytest.fixture(scope="module", autouse=True)
def r246_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R246_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
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
def admin_headers() -> dict[str, str]:
    return jwt_auth_headers(roles=["admin"])


@pytest.fixture
def viewer_headers() -> dict[str, str]:
    return jwt_auth_headers(roles=["viewer"])
```

- [ ] **Step 2: 写失败测试 T-DESIGN-R246-004-01 ~ 004-04**

```python
def test_design_r246_004_01_snapshot_get_admin(client, admin_headers):
    """capture + GET /snapshots/{id} 往返一致。"""
    # 先 PUT conditions/compute_rules/output_fields（复用 r245 VALID_* 常量或内联最小 payload）
    # POST /submit-workflow → 取 designSnapshotId
    # GET /api/v1/designer/snapshots/{id} → 200 含 conditions
    assert False  # 实现前失败


def test_design_r246_004_02_snapshot_forbidden_viewer(client, admin_headers, viewer_headers):
    """非 owner viewer GET snapshot → 403 DESIGN_SNAPSHOT_FORBIDDEN。"""
    assert False


def test_design_r246_004_03_link_by_instance(client, admin_headers):
    """GET /workflow-link?workflowInstanceId= 与 designerItemId 方向一致。"""
    assert False


def test_design_r246_004_04_delete_link_draft_only(client, admin_headers):
    """draft 态 DELETE link → 204；pending_approval 态 → 409。"""
    assert False
```

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py::test_design_r246_004_01 -v`
Expected: FAIL

- [ ] **Step 3: 实现 snapshot ACL**

在 `backend/app/designer/snapshot.py` 追加：

```python
from app.auth.deps import UserContext
from app.designer.schemas import DesignerError


def assert_snapshot_readable(session: Session, snapshot_id: uuid.UUID, actor: UserContext) -> None:
    if "admin" in actor.roles:
        return
    record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, snapshot_id)
    if record.owner_id is None:
        return
    try:
        actor_uuid = uuid.UUID(actor.id)
    except ValueError:
        raise DesignerError("DESIGN_SNAPSHOT_FORBIDDEN", "Snapshot access denied", 403)
    if record.owner_id != actor_uuid:
        raise DesignerError("DESIGN_SNAPSHOT_FORBIDDEN", "Snapshot access denied", 403)


def get_snapshot_for_actor(session: Session, snapshot_id: uuid.UUID, actor: UserContext) -> dict:
    assert_snapshot_readable(session, snapshot_id, actor)
    return get_snapshot(session, snapshot_id)
```

- [ ] **Step 4: 实现 workflow 反向查询与撤回**

在 `backend/app/designer/workflow.py` 追加：

```python
def get_link_by_instance(session: Session, workflow_instance_id: uuid.UUID) -> DesignerWorkflowLinkOut:
    records = config_store.list_configs_by_type(session, _CONFIG_TYPE)
    for rec in records:
        link = DesignerWorkflowLinkIn.model_validate(rec.payload)
        if link.workflow_instance_id == workflow_instance_id:
            return DesignerWorkflowLinkOut(
                **link.model_dump(),
                publishReady=_compute_publish_ready(session, link),
            )
    raise DesignerError("DESIGN_WORKFLOW_LINK_NOT_FOUND", "Workflow link not found", 404)


def delete_workflow_link(session: Session, designer_item_id: uuid.UUID, actor: UserContext) -> None:
    link = get_workflow_link(session, designer_item_id)
    status = _workflow_status(session, link.workflow_instance_id)
    if status != "draft":
        raise DesignerError(
            "DESIGN_WORKFLOW_LINK_NOT_REVOKABLE",
            "Link can only be revoked in draft status",
            409,
        )
    if not any(r in actor.roles for r in ("admin", "analyst")):
        raise DesignerError("DESIGN_SUBMIT_FORBIDDEN", "Revoke requires admin or analyst", 403)
    config_store.delete_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, designer_item_id)
```

修改 `submit_with_snapshot`：capture 后把 `snapshotRevision` 写入 instance payload：

```python
    snapshot_id, snap_payload = snapshot_service.capture_snapshot(session, payload.designer_item_id, owner_id)
    # ...
    body["designSnapshotId"] = str(snapshot_id)
    body["snapshotRevision"] = snap_payload.get("revisions", {})
```

若 `config_store` 无 `list_configs_by_type` / `delete_config_by_ref`，在同 PR 于 `app/query/config_store/service.py` 增加最小实现（仅本域使用）。

- [ ] **Step 5: 运行 004 前 4 条测试**

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py -k "004_0" -v`
Expected: PASS（4 passed）

- [ ] **Step 6: Commit**

```bash
git add backend/app/designer/snapshot.py backend/app/designer/workflow.py tests/test_mfinal_fe_design_r246.py
git commit -m "feat(designer): snapshot ACL and workflow link revoke guards"
```

---

### Task 2: DESIGN-004 — API 路由 + 工单实例列表 + pytest 004 余下用例

**Files:**
- Modify: `backend/app/api/v1/designer.py`
- Modify: `backend/app/governance/workflow/service.py`（`list_instances`）
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_mfinal_fe_design_r246.py`（004-05 ~ 004-08）

**Interfaces:**
- Produces: `GET /api/v1/designer/snapshots/{snapshotId}`
- Produces: `GET /api/v1/designer/workflow-link?workflowInstanceId=`
- Produces: `DELETE /api/v1/designer/workflow-link?designerItemId=`
- Produces: `GET /api/v1/gov/workflow/instances?limit&offset&status`
- Produces: tests `test_design_r246_004_05` ~ `test_design_r246_004_08`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: designer API 路由**

在 `backend/app/api/v1/designer.py` 追加：

```python
@router.get("/snapshots/{snapshot_id}")
def get_designer_snapshot(
    snapshot_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return snapshot_service.get_snapshot_for_actor(db, snapshot_id, actor)
    except DesignerError as exc:
        return _designer_error(exc)


@router.get("/workflow-link", response_model=DesignerWorkflowLinkOut)
def get_workflow_link_route(
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    designer_item_id: uuid.UUID | None = Query(default=None, alias="designerItemId"),
    workflow_instance_id: uuid.UUID | None = Query(default=None, alias="workflowInstanceId"),
):
    if designer_item_id is not None:
        return workflow_link_service.get_workflow_link(db, designer_item_id)
    if workflow_instance_id is not None:
        return workflow_link_service.get_link_by_instance(db, workflow_instance_id)
    return _designer_error(DesignerError("DESIGN_WORKFLOW_INVALID_ITEM", "designerItemId or workflowInstanceId required", 422))


@router.delete("/workflow-link", status_code=204)
def delete_workflow_link_route(
    designer_item_id: uuid.UUID = Query(alias="designerItemId"),
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        workflow_link_service.delete_workflow_link(db, designer_item_id, actor)
        return Response(status_code=204)
    except DesignerError as exc:
        return _designer_error(exc)
```

- [ ] **Step 2: workflow instances 列表**

在 `backend/app/governance/workflow/service.py` 增加：

```python
def list_instances(
    session: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
) -> WorkflowInstanceListOut:
    records = config_store.list_configs_by_type(session, "workflow_instance")
    items = []
    for rec in sorted(records, key=lambda r: r.payload.get("capturedAt", ""), reverse=True):
        inst = _to_instance_out(rec)
        if status and inst.status != status:
            continue
        items.append(inst)
    page = items[offset : offset + limit]
    return WorkflowInstanceListOut(items=page, total=len(items))
```

在 `gov.py` 注册 `GET /workflow/instances`（在现有 instance 路由之前）。

- [ ] **Step 3: 追加测试 004-05 ~ 004-08**

```python
def test_design_r246_004_05_instances_list(client, admin_headers):
    """GET /workflow/instances 含刚提交实例。"""
    ...

def test_design_r246_004_06_include_design_snapshot(client, admin_headers):
    """GET /workflow/instances/{id}?includeDesignSnapshot=true 含三块配置。"""
    ...

def test_design_r246_004_07_snapshot_revision(client, admin_headers):
    """submit 写入 snapshotRevision 与 revisions dict 一致。"""
    ...

def test_design_r246_004_08_immutable_snapshot(client, admin_headers):
    """capture 后修改 conditions，GET snapshot 内容不变。"""
    ...
```

- [ ] **Step 4: 验证**

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py -k "004" -v`
Expected: ≥8 passed

Run: `cd backend && pytest tests/test_mfinal_fe_design_r245.py -v`
Expected: 全绿（批次 1 不退化）

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/designer.py backend/app/governance/workflow/service.py backend/app/api/v1/gov.py tests/test_mfinal_fe_design_r246.py
git commit -m "feat(designer): snapshot GET and workflow instances list API"
```

---

### Task 3: DESIGN-005 — design_mode 后端 + submit 分支 + pytest 005

**Files:**
- Modify: `backend/app/designer/sql_mode.py`
- Modify: `backend/app/designer/workflow.py`（`_assert_design_complete` 分支）
- Modify: `backend/app/api/v1/designer.py`
- Modify: `tests/test_mfinal_fe_design_r246.py`（005 区块 ≥6 条）

**Interfaces:**
- Produces: `get_design_mode(session, ref_type, ref_id) -> Literal["visual", "sql"]`
- Produces: `set_design_mode(session, ref_id, mode, owner_id) -> dict`
- Produces: `GET/PUT /api/v1/designer/design-mode`
- Produces: `_assert_design_complete`：mode=sql 时断言 sql_mode 已保存；mode=visual 时断言三块

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 写失败测试 T-DESIGN-R246-005-01 ~ 005-06**

```python
def test_design_r246_005_01_design_mode_roundtrip(client, admin_headers):
    resp = client.put(
        "/api/v1/designer/design-mode",
        headers=admin_headers,
        json={"refId": REF_ID, "mode": "sql"},
    )
    assert resp.status_code == 200
    assert resp.json()["mode"] == "sql"


def test_design_r246_005_02_sql_validate_dml(client, admin_headers):
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=admin_headers,
        json={"dataSourceId": str(uuid.uuid4()), "sql": "DELETE FROM t", "refId": REF_ID},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design_r246_005_03_sql_mode_submit_incomplete(client, admin_headers):
    # PUT design-mode=sql，不保存 sql_mode，submit → 422 DESIGN_SUBMIT_INCOMPLETE
    ...


def test_design_r246_005_04_visual_submit_regression(client, admin_headers):
    # design-mode=visual，缺 output → 422（回归 r245）
    ...


def test_design_r246_005_05_sql_save_get_roundtrip(client, admin_headers):
    ...

def test_design_r246_005_06_probe_sql_validate_budget():
    from app.designer.sql_mode import probe_validate_sql_mode
    assert probe_validate_sql_mode().elapsed_ms <= 50
```

- [ ] **Step 2: 实现 design_mode**

在 `backend/app/designer/sql_mode.py` 追加：

```python
_DESIGN_MODE_TYPE = "design_mode"
_DEFAULT_MODE = "visual"


def get_design_mode(session: Session, ref_type: str, ref_id: uuid.UUID) -> str:
    try:
        record = config_store.get_config_by_ref(session, _DESIGN_MODE_TYPE, ref_type, ref_id)
        return record.payload.get("mode", _DEFAULT_MODE)
    except ConfigError:
        return _DEFAULT_MODE


def set_design_mode(
    session: Session,
    ref_type: str,
    ref_id: uuid.UUID,
    mode: str,
    owner_id: uuid.UUID | None = None,
) -> dict:
    if mode not in ("visual", "sql"):
        raise DesignerError("DESIGN_MODE_INVALID", "mode must be visual or sql", 422)
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_DESIGN_MODE_TYPE,
            schema_version="1.0",
            ref_type=ref_type,
            ref_id=ref_id,
            payload={"mode": mode},
        ),
        owner_id=owner_id,
    )
    return {"refId": str(ref_id), "mode": mode}
```

在 `ALLOWED_CONFIG_TYPES`（`config_store/schemas.py`）增加 `"design_mode"`。

- [ ] **Step 3: 修改 `_assert_design_complete`**

```python
def _assert_design_complete(session: Session, designer_item_id: uuid.UUID) -> None:
    from app.designer import sql_mode as sql_mode_service

    mode = sql_mode_service.get_design_mode(session, "design_draft", designer_item_id)
    if mode == "sql":
        try:
            sql_mode_service.get_sql_mode(session, "design_draft", designer_item_id)
        except ConfigError as exc:
            raise DesignerError("DESIGN_SUBMIT_INCOMPLETE", "SQL mode configuration incomplete", 422) from exc
        return
    # 原有 visual 三块校验
    ...
```

- [ ] **Step 4: API design-mode 路由**

```python
class DesignModeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    ref_id: uuid.UUID = Field(alias="refId")
    mode: Literal["visual", "sql"]


@router.get("/design-mode")
def get_design_mode_route(...):
    return {"refId": str(ref_id), "mode": sql_mode_service.get_design_mode(db, ref_type, ref_id)}


@router.put("/design-mode")
def put_design_mode_route(payload: DesignModeIn, actor, db):
    return sql_mode_service.set_design_mode(db, "design_draft", payload.ref_id, payload.mode, _owner_uuid(actor))
```

- [ ] **Step 5: 验证**

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py -k "005" -v`
Expected: ≥6 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/designer/sql_mode.py backend/app/designer/workflow.py backend/app/api/v1/designer.py backend/app/query/config_store/schemas.py tests/test_mfinal_fe_design_r246.py
git commit -m "feat(designer): design_mode and SQL submit path"
```

---

### Task 4: GOV-004 — 审批态可视化查询设计 + confirm + pytest

**Files:**
- Modify: `backend/app/governance/query_design/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_mfinal_fe_design_r246.py`（GOV-004 区块 ≥6 条）

**Interfaces:**
- Produces: `load_design_from_workflow(session, instance_id, actor) -> VisualQueryDesignOut`
- Produces: `confirm_approved_design(session, instance_id, actor) -> WorkflowInstanceOut`
- Produces: `GET /gov/workflow/instances/{id}/approved-design`
- Produces: `POST /gov/workflow/instances/{id}/confirm-design`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 写失败测试 T-GOV-R246-004-01 ~ 004-06**

覆盖：`pending_approval` → 404 `GOV_QUERY_DESIGN_NOT_APPROVED`；`designing` → 200；viewer confirm → 403；approver confirm → `pending_publish`；二次 confirm → 409；confirm 后 `GET /gov/query-design?refId=` 可读。

- [ ] **Step 2: 实现 load_design_from_workflow**

```python
def load_design_from_workflow(session: Session, instance_id: uuid.UUID, actor: UserContext) -> VisualQueryDesignOut:
    inst = workflow_service.get_instance(session, instance_id)
    if inst.status not in ("designing", "pending_publish", "published"):
        raise GovQueryDesignError("GOV_QUERY_DESIGN_NOT_APPROVED", "Design not in approved state", 404)
    snap_id = uuid.UUID(inst.design_snapshot_id)  # 从 instance payload 读取
    snap = snapshot_service.get_snapshot_for_actor(session, snap_id, actor)
    status_map = {"designing": "approved", "pending_publish": "ready", "published": "ready"}
    return VisualQueryDesignOut(
        schema_version="1.0",
        ref_type="design_draft",
        ref_id=inst.ref_id,
        title=f"设计 {str(inst.ref_id)[:8]}",
        status=status_map[inst.status],
        data_source_id=None,
        conditions=snap["conditions"],
        compute_rules=snap.get("computeRules"),
        revision=0,
    )
```

- [ ] **Step 3: 实现 confirm_approved_design**

```python
def confirm_approved_design(session: Session, instance_id: uuid.UUID, actor: UserContext):
    inst = workflow_service.get_instance(session, instance_id)
    if inst.status != "designing":
        raise GovQueryDesignError("GOV_QUERY_DESIGN_ALREADY_CONFIRMED", "Already confirmed", 409)
    if not any(r in actor.roles for r in ("admin", "approver")):
        raise GovQueryDesignError("GOV_WORKFLOW_FORBIDDEN_ROLE", "Confirm requires approver", 403)
    design = load_design_from_workflow(session, instance_id, actor)
    save_visual_query_design(
        session,
        VisualQueryDesignIn(
            schemaVersion="1.0",
            refType="design_draft",
            refId=design.ref_id,
            title=design.title,
            status="ready",
            conditions=design.conditions,
            computeRules=design.compute_rules,
        ),
        actor,
    )
    return workflow_service.transition_instance(session, instance_id, "complete_design", "approver")
```

- [ ] **Step 4: gov.py 路由注册**

```python
@router.get("/workflow/instances/{instance_id}/approved-design")
def get_approved_design(...):
    return query_design_service.load_design_from_workflow(db, instance_id, actor)

@router.post("/workflow/instances/{instance_id}/confirm-design")
def confirm_design(...):
    return query_design_service.confirm_approved_design(db, instance_id, actor)
```

- [ ] **Step 5: 验证**

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py -k "GOV-R246-004" -v`
Expected: ≥6 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/governance/query_design/service.py backend/app/api/v1/gov.py tests/test_mfinal_fe_design_r246.py
git commit -m "feat(gov): approved design load and confirm from workflow"
```

---

### Task 5: GOV-005 — from-workflow 发布 + 回滚骨架 + pytest

**Files:**
- Modify: `backend/app/governance/publish/service.py`
- Modify: `backend/app/governance/publish/schemas.py`（`PublishFromWorkflowOut`）
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_mfinal_fe_design_r246.py`（GOV-005 区块 ≥6 条）

**Interfaces:**
- Produces: `publish_from_workflow(db, workflow_instance_id, actor) -> PublishFromWorkflowOut`
- Produces: `rollback_entry_skeleton(db, entry_id) -> PublishActionOut`
- Produces: `POST /api/v1/gov/publish/from-workflow` body `{ workflowInstanceId }`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 写失败测试 T-GOV-R246-005-01 ~ 005-06**

覆盖：happy path confirm → publish → published；非 `pending_publish` → 400；viewer → 403；二次幂等 → 200 同 id；workflow-link `catalogEntryId` 填充；`rollback_entry_skeleton` 版本数组 +1。

- [ ] **Step 2: 实现 publish_from_workflow**

```python
def publish_from_workflow(db: Session, workflow_instance_id: uuid.UUID, actor: UserContext) -> PublishFromWorkflowOut:
    inst = workflow_service.get_instance(db, workflow_instance_id)
    if inst.status != "pending_publish":
        raise PublishError("GOV_PUBLISH_INVALID_STATE", "Instance must be pending_publish", 400)
    if not any(r in actor.roles for r in ("admin", "publisher")):
        raise PublishError("GOV_PUBLISH_FORBIDDEN", "Publish requires publisher or admin", 403)
    link = workflow_link_service.get_link_by_instance(db, workflow_instance_id)
    if link.catalog_entry_id is not None:
        return PublishFromWorkflowOut(
            catalogEntryId=link.catalog_entry_id,
            publishVersion=1,
            idempotent=True,
        )
    slug = f"query-{str(inst.ref_id)[:8]}"
    entry = catalog_service.create_entry(
        db,
        CatalogEntryCreate(
            name=f"Query {slug}",
            path=f"/api/v1/services/{slug}",
            httpMethod="POST",
            category="query",
        ),
    )
    # 更新 workflow-link catalogEntryId
    # submit_entry → approve_entry（admin 路径）
    publish_version = 1
    return PublishFromWorkflowOut(catalogEntryId=entry.id, publishVersion=publish_version, idempotent=False)
```

- [ ] **Step 3: rollback_entry_skeleton**

```python
def rollback_entry_skeleton(db: Session, entry_id: uuid.UUID) -> PublishActionOut:
    row = _get_row(db, entry_id)
    history = list(row.version_history or [])
    history.append({"publishVersion": len(history) + 1, "status": row.status})
    row.version_history = history
    row.status = "draft"
    db.commit()
    return PublishActionOut(id=row.id, status=row.status)
```

若 `CatalogEntry` 无 `version_history` JSON 列，用 config_store 侧车存储 `publish_version_history`。

- [ ] **Step 4: API + 验证**

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py -k "GOV-R246-005" -v`
Expected: ≥6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/publish/service.py backend/app/governance/publish/schemas.py backend/app/api/v1/gov.py tests/test_mfinal_fe_design_r246.py
git commit -m "feat(gov): publish from workflow with version skeleton"
```

---

### Task 6: GOV-006 — OpenAPI 文档生成 + GET 聚合 + pytest

**Files:**
- Modify: `backend/app/governance/openapi/service.py`
- Modify: `backend/app/governance/publish/service.py`（发布钩子调用 openapi）
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_mfinal_fe_design_r246.py`（GOV-006 区块 ≥6 条）

**Interfaces:**
- Produces: `generate_openapi_document(db, catalog_entry_id) -> dict`
- Produces: `redact_openapi_fields(schema: dict) -> dict`
- Produces: `GET /api/v1/gov/publish/entries/{entry_id}/openapi`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 写失败测试 T-GOV-R246-006-01 ~ 006-06**

覆盖：发布后 GET openapi → 200 含 `openapi: 3.1.0`；draft → 422 `GOV_OPENAPI_DOC_NOT_PUBLISHED`；`password_hash` 字段脱敏；probe ≤50ms；mapping 至少 1 条。

- [ ] **Step 2: 实现 generate_openapi_document**

```python
_REDACT_KEYS = frozenset({"password", "secret", "token", "credential"})

def redact_openapi_fields(schema: dict) -> dict:
    props = schema.get("properties", {})
    filtered = {k: v for k, v in props.items() if not any(r in k.lower() for r in _REDACT_KEYS)}
    return {**schema, "properties": filtered}


def generate_openapi_document(db: Session, catalog_entry_id: uuid.UUID) -> dict:
    status = publish_service.get_publish_status(db, catalog_entry_id)
    if status.status != "published":
        raise OpenApiMappingError("GOV_OPENAPI_DOC_NOT_PUBLISHED", "Entry not published", 422)
    entry = catalog_service.get_entry(db, catalog_entry_id)
    slug = entry.path.rsplit("/", 1)[-1]
    doc = {
        "openapi": "3.1.0",
        "info": {"title": entry.name, "version": "1"},
        "paths": {
            entry.path: {
                entry.http_method.lower(): {
                    "operationId": f"query_{slug}",
                    "responses": {"200": {"description": "Query result"}},
                }
            }
        },
    }
    register_mapping(
        db,
        OpenApiMappingCreate(
            catalogEntryId=catalog_entry_id,
            httpMethod=entry.http_method,
            path=entry.path,
            operationId=f"query_{slug}",
            apiVersion="v1",
        ),
    )
    return doc
```

在 `publish_from_workflow` 成功 approve 后调用 `generate_openapi_document`。

- [ ] **Step 3: GET openapi 路由**

```python
@router.get("/publish/entries/{entry_id}/openapi")
def get_publish_openapi(entry_id: uuid.UUID, db: Session = Depends(_db)):
    try:
        return openapi_service.generate_openapi_document(db, entry_id)
    except OpenApiMappingError as exc:
        return _openapi_mapping_error(exc)
```

- [ ] **Step 4: 全量 r246 套件 + 回归**

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py -v`
Expected: ≥30 passed

Run: `cd backend && ruff check backend/app/designer backend/app/governance/query_design backend/app/governance/publish backend/app/governance/openapi`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/openapi/service.py backend/app/governance/publish/service.py backend/app/api/v1/gov.py tests/test_mfinal_fe_design_r246.py
git commit -m "feat(gov): OpenAPI document generation on publish"
```

---

### Task 7: DESIGN-005 FE — SQL 模式面板 + DesignerPage Segmented 切换

**Files:**
- Create: `fe/src/pages/admin/designer/designer-sql-panel.tsx`
- Modify: `fe/src/pages/admin/designer/DesignerPage.tsx`
- Modify: `fe/src/pages/admin/designer/useDesignerWorkspace.ts`
- Modify: `fe/src/lib/queryKeys.ts`
- Create: `fe/src/pages/admin/designer/designer-sql.smoke.test.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/v1/designer/design-mode`、`GET/PUT /api/v1/designer/sql-mode`、`POST /sql-mode/validate`、`GET /api/v1/datasources`
- Produces: `DesignerSqlPanel` 组件；`useDesignerWorkspace.designMode`；`queryKeys.designer.designMode` / `sqlMode` / `snapshot`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin Segmented（`Button` group）与 `Textarea font-mono`；无 Monaco
- desktop 与 mobile：SQL 面板无横向溢出；`<lg` 预览并入 Tabs「预览」
- hover/focus/active/loading/empty/error：校验错误 `aria-invalid`；保存/校验 loading disabled
- `cd fe && pnpm run check:design` 无 drift（语义 token、无硬编码色、无原生 button）

- [ ] **Step 1: queryKeys 扩展**

```typescript
designer: {
  // ...existing...
  designMode: (refId: string) => ["designer", "designMode", refId] as const,
  sqlMode: (refId: string) => ["designer", "sqlMode", refId] as const,
  snapshot: (id: string) => ["designer", "snapshot", id] as const,
},
```

- [ ] **Step 2: useDesignerWorkspace 增加 designMode**

```typescript
const [designMode, setDesignMode] = useState<"visual" | "sql">("visual");

const designModeQuery = useQuery({
  queryKey: queryKeys.designer.designMode(designerItemId),
  queryFn: () =>
    apiFetch<{ mode: "visual" | "sql" }>(
      `/api/v1/designer/design-mode?refId=${designerItemId}`,
    ),
});

const setModeMutation = useMutation({
  mutationFn: (mode: "visual" | "sql") =>
    apiFetch("/api/v1/designer/design-mode", {
      method: "PUT",
      body: JSON.stringify({ refId: designerItemId, mode }),
    }),
  onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.designer.designMode(designerItemId) }),
});
```

`allBlocksSaved` 分支：`designMode === "sql"` 时检查 sqlMode 已保存；visual 时保持原逻辑。

- [ ] **Step 3: 新建 designer-sql-panel.tsx**

```tsx
import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export function DesignerSqlPanel({ refId, readOnly }: { refId: string; readOnly?: boolean }) {
  // useQuery datasources + sql-mode GET
  // validateMutation POST /sql-mode/validate
  // saveMutation PUT /sql-mode
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Code2 className="size-4 text-gray-500" />
        <span className="text-theme-sm font-medium">传统 SQL 模式</span>
      </div>
      {/* Select dataSource + Textarea min-h-[280px] font-mono */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm">校验 SQL</Button>
        <Button type="button" variant="primary" size="sm">保存 SQL</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: DesignerPage Segmented 切换**

顶栏增加两个 `Button`（`aria-pressed`），切换 `designMode`；`designMode === "sql"` 渲染 `DesignerSqlPanel`，否则渲染既有三面板 Tabs；SQL 模式下右栏 `PreviewPanel` 显示编辑器 SQL 文本（不调用 translate）。

提交成功 Dialog 增加复制快照链接：`/api/v1/designer/snapshots/{designSnapshotId}`。

- [ ] **Step 5: RTL smoke T-DESIGN-R246-FE-01 ~ FE-03**

```tsx
// designer-sql.smoke.test.tsx
it("T-DESIGN-R246-FE-01: switches to SQL mode", async () => { ... });
it("T-DESIGN-R246-FE-02: saves SELECT 1", async () => { ... });
it("T-DESIGN-R246-FE-03: shows validation error on DML", async () => { ... });
```

- [ ] **Step 6: 验证**

Run: `cd fe && pnpm exec vitest run src/pages/admin/designer/designer-sql.smoke.test.tsx -v`
Expected: 3 passed

Run: `cd fe && pnpm run check:design`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add fe/src/pages/admin/designer fe/src/lib/queryKeys.ts
git commit -m "feat(fe): designer SQL mode panel and segmented switch"
```

---

### Task 8: DESIGN-004/GOV FE — 工单实例 Tab + 发布流水线 + 文档同步

**Files:**
- Modify: `fe/src/pages/admin/governance/GovernanceWorkflowPage.tsx`
- Modify: `fe/src/pages/admin/governance/GovernancePublishPage.tsx`
- Modify: `fe/src/lib/queryKeys.ts`
- Create: `fe/src/pages/admin/governance/governance-batch2.smoke.test.tsx`
- Modify: `docs/api/README.md`
- Modify: `docs/services/designer.md`
- Modify: `docs/services/governance.md`

**Interfaces:**
- Consumes: `GET /gov/workflow/instances`、`GET /workflow/instances/{id}?includeDesignSnapshot=true`、`POST confirm-design`、`POST /publish/from-workflow`、`GET /publish/entries/{id}/openapi`、既有 publish submit/approve
- Produces: 工单实例 master-detail Tab；发布页行内操作 + OpenAPI Sheet

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 实例 Tab：`lg:grid-cols-[300px_1fr]` list-detail；快照面板 `readOnly` + `bg-gray-50/50`
- 发布页：`Sheet` + `Textarea readOnly font-mono` OpenAPI 预览；`AlertDialog` 确认发布
- desktop/mobile 截图级：实例列表堆叠可读；表格 `min-w` 不撑破壳层
- `check:design` PASS；smoke ≥4 条绿

- [ ] **Step 1: queryKeys gov 扩展**

```typescript
gov: {
  // ...existing...
  workflowInstances: (params?: { status?: string }) =>
    ["gov", "workflowInstances", params ?? {}] as const,
  workflowInstance: (id: string, withSnapshot?: boolean) =>
    ["gov", "workflowInstance", id, withSnapshot ? "snap" : "base"] as const,
  publishOpenapi: (entryId: string) => ["gov", "publishOpenapi", entryId] as const,
},
```

- [ ] **Step 2: GovernanceWorkflowPage 双 Tab**

```tsx
<Tabs defaultValue="templates">
  <TabsList>
    <TabsTrigger value="templates">流程模板</TabsTrigger>
    <TabsTrigger value="instances">工单实例</TabsTrigger>
  </TabsList>
  <TabsContent value="instances">
    {/* 左栏实例列表 status Badge；右栏详情 + ConditionsPanel/ComputeRulesPanel/OutputFieldsPanel readOnly */}
    {/* complete_design / approve / reject 按 allowedActions */}
  </TabsContent>
</Tabs>
```

- [ ] **Step 3: GovernancePublishPage 行内操作 + OpenAPI Sheet**

表格增加「操作」列：`提交发布` / `批准` / `驳回`（调 `POST /publish/entries/{id}/submit|approve|reject`）；`FileJson` 按钮打开 `Sheet` 加载 `GET /publish/entries/{id}/openapi`；工单实例详情链路的「发布服务」按钮调 `POST /publish/from-workflow`。

- [ ] **Step 4: 文档同步**

`docs/api/README.md` 登记：

- `GET /api/v1/designer/snapshots/{snapshotId}`
- `GET/DELETE /api/v1/designer/workflow-link`（扩展 query）
- `GET/PUT /api/v1/designer/design-mode`
- `GET /api/v1/gov/workflow/instances`
- `GET/POST /api/v1/gov/workflow/instances/{id}/approved-design|confirm-design`
- `POST /api/v1/gov/publish/from-workflow`
- `GET /api/v1/gov/publish/entries/{entryId}/openapi`

更新 `docs/services/designer.md`（快照 ACL、design_mode、SQL UI）与 `docs/services/governance.md`（审批态设计、from-workflow、OpenAPI GET）。

- [ ] **Step 5: smoke T-GOV-R246-FE-01 ~ FE-04**

```tsx
it("T-GOV-R246-FE-01: instances tab lists workflow instances", ...);
it("T-GOV-R246-FE-02: snapshot panels read-only", ...);
it("T-GOV-R246-FE-03: publish approve updates badge", ...);
it("T-GOV-R246-FE-04: openapi sheet shows JSON", ...);
```

- [ ] **Step 6: 全量 FE 验证**

Run: `cd fe && pnpm exec vitest run src/pages/admin/designer src/pages/admin/governance -v`
Expected: 全部 passed

Run: `cd fe && pnpm run build`
Expected: exit 0

- [ ] **Step 7: 最终回归门控**

Run: `cd backend && pytest tests/test_mfinal_fe_design_r246.py tests/test_mfinal_fe_design_r245.py -v`
Expected: 全绿

Run: `cd backend && pytest tests/test_design_conn_gov_query_r52.py -k sql -v`
Expected: 抽样绿

Run: `cd backend && pytest tests/test_rpt_gov_meta_conn_r55.py -k openapi -v`
Expected: 抽样绿

- [ ] **Step 8: Commit**

```bash
git add fe/src/pages/admin/governance fe/src/lib/queryKeys.ts docs/api/README.md docs/services/designer.md docs/services/governance.md
git commit -m "feat(fe): governance instances tab, publish actions, and docs sync"
```

---

## Self-Review（P2）

| 检查项 | 结果 |
|--------|------|
| DESIGN-004~005、GOV-004~006 各有 Task | Task 1~2 / 3+7 / 4+8 / 5+8 / 6+8 |
| 无 TBD/TODO 占位 | 通过 |
| 每 Task 含验证命令 | 通过 |
| FE Task 含 Skills + UI Acceptance | Task 7~8 |
| 预估文件数 ≤18 | 18 文件（与 design 一致） |
