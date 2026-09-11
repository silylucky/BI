# M13 设计器 + M11 OpenSearch + 治理/查询 companion 质量推分 r52 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/designer/sql_mode.py` · `output_fields.py` · `schemas.py` · `backend/app/schemas/chart_view.py` · `backend/app/datasources/dialects/opensearch.py` · `errors.py` · `backend/app/governance/workflow/node_roles.py`（新建）· `service.py` · `schemas.py` · `errors.py` · `backend/app/query/native/guard.py` · `native/schemas.py` · `query/readonly.py` · `backend/app/api/v1/gov.py` · `query.py` · `tests/test_design_conn_gov_query_r52.py` · `docs/services/{designer,governance,datasources,query}.md` · `docs/api/README.md`
> **子项：** GOV-003, DESIGN-005, QUERY-003, DESIGN-003, CONN-016
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 在 r49 L1 骨架上闭合 companion 质量推分——治理 FSM 节点角色/并发幂等、SQL 模式校验链+chart_view 联动、native 注入+readonly-guard、output_fields 数量边界、OpenSearch HTTP/空索引边界；≥32 条 `test_design_conn_gov_query_r52`；五 PRD ID 加权总分破 **≥90**。

**Architecture:** 域逻辑留在 `governance/workflow/`、`designer/`、`query/native/`+`readonly.py`、`datasources/dialects/`；`api/v1/gov.py` 与 `query.py` 仅薄 entry；各域 probe 同进程 mock 计时（50–100ms 预算）；`chart_view.py` sql 模式委托 `assert_readonly_sql`；OpenSearch 异常统一经 `map_opensearch_error`。纯后端、无 Alembic、不修改 `ConnectorRegistry.register/get` 方法体。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / opensearch-py / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不修改** `backend/app/datasources/registry.py` 的 `ConnectorRegistry.register` / `get` 方法体。
- **分层纪律**（`common.mdc`）：domain 写业务；`api/v1/*.py` = entry。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；并发冲突 409。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/api/README.md`。
- **验证基线**（r51 P5）：`cd backend && python3 -m pytest -q` ≈ **1248 passed** / 4 skipped；本轮目标 **≥1280 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_design_conn_gov_query_r52.py \
    ../tests/test_design_conn_gov_query_r49.py \
    ../tests/test_nfr_gov_conn_r51.py \
    ../tests/test_nfr_gov_conn_r46.py \
    -v
  ```
  Expected: r52 **≥32/32** + r49 **35/35** + r51 **43/43** + r46 **36/36**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/governance/workflow/node_roles.py` | GOV-003 节点角色描述 + probe | 新建 |
| `backend/app/governance/workflow/service.py` | 并发/幂等 + 模板节点覆盖 | 修改 |
| `backend/app/governance/workflow/schemas.py` | `NodeRoleOut` / `WorkflowNodeRolesOut` | 修改 |
| `backend/app/governance/workflow/errors.py` | `GOV_WORKFLOW_CONFLICT` / `ALREADY_TERMINAL` | 修改 |
| `backend/app/api/v1/gov.py` | GET `workflow/templates/{id}/node-roles` | 修改 |
| `backend/app/designer/sql_mode.py` | probe + remediation detail | 修改 |
| `backend/app/designer/schemas.py` | `MAX_OUTPUT_FIELDS` / `MAX_AGGREGATES` + `DesignerError.remediation` | 修改 |
| `backend/app/designer/output_fields.py` | 数量/重复边界 + probe | 修改 |
| `backend/app/schemas/chart_view.py` | sql 模式只读联动 `CHART_SQL_NOT_READONLY` | 修改 |
| `backend/app/query/readonly.py` | `assert_safe_sql_parameters` | 修改 |
| `backend/app/query/native/schemas.py` | `parameters` / `ReadonlyGuardIn` / `ReadonlyGuardOut` | 修改 |
| `backend/app/query/native/guard.py` | 注入 smoke + readonly 路由 + probe | 修改 |
| `backend/app/api/v1/query.py` | POST `query/readonly-guard` | 修改 |
| `backend/app/datasources/dialects/errors.py` | `OPENSEARCH_INDEX_NOT_FOUND` + 映射 | 修改 |
| `backend/app/datasources/dialects/opensearch.py` | `map_opensearch_error` 统一 + 空索引边界 + probe | 修改 |
| `backend/app/api/v1/designer.py` | `_designer_error` 输出 `detail.remediation` | 修改 |
| `tests/test_design_conn_gov_query_r52.py` | 新套件 ≥32 断言函数 | 新建 |
| `docs/services/designer.md` | companion 边界登记 | 修改 |
| `docs/services/governance.md` | 节点角色钩子登记 | 修改 |
| `docs/services/datasources.md` | OpenSearch 空索引/HTTP 链 | 修改 |
| `docs/services/query.md` | native 注入守卫 | 修改 |
| `docs/api/README.md` | 2 新路由登记 | 修改 |

预估 **P3 生产代码文件 16** + **测试 1** + **docs 5** = **22**（生产+测试 **17 ≤ 20**；docs 不计入 round-target 文件上限）。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_design_conn_gov_query_r52.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""M13 设计器 + M11 OpenSearch + 治理/查询 companion 质量推分 r52."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R52_SQLITE_URL = "sqlite+pysqlite:///file:design_conn_gov_query_r52?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r52_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R52_SQLITE_URL
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


def _ref_id() -> str:
    return str(uuid.uuid4())


def _designer_ref_payload(ref_id: str | None = None) -> dict:
    rid = ref_id or _ref_id()
    return {"refType": "design_draft", "refId": rid}


def _create_workflow_instance(client: TestClient) -> dict:
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
```

---

### Task 1: r52 测试夹具 + GOV-003 节点角色与并发幂等

**Files:**
- Create: `backend/app/governance/workflow/node_roles.py`
- Modify: `backend/app/governance/workflow/errors.py`
- Modify: `backend/app/governance/workflow/schemas.py`
- Modify: `backend/app/governance/workflow/service.py`
- Modify: `backend/app/api/v1/gov.py`
- Create: `tests/test_design_conn_gov_query_r52.py`（夹具 + GOV ≥8 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `describe_node_roles(template_id) -> list[NodeRoleDescriptor]`、`resolve_required_role(template_id, status) -> str`、`probe_transition_path() -> WorkflowProbeResult`
- Produces: `WorkflowError` codes `GOV_WORKFLOW_CONFLICT`、`GOV_WORKFLOW_ALREADY_TERMINAL`
- Produces: `GET /api/v1/gov/workflow/templates/{template_id}/node-roles`

- [ ] **Step 1: Write the failing tests**

在 `tests/test_design_conn_gov_query_r52.py` 写入上文 **Shared Test Fixtures** 全文，并追加：

```python
from app.governance.workflow.node_roles import probe_transition_path, resolve_required_role


def test_r52_fixture_bootstraps(client):
    """T-R52-000-01: r52 sqlite 环境 health 可达。"""
    assert client.get("/health").status_code == 200


def test_gov_r52_node_roles_standard_template(client):
    """T-GOV-R52-003-01: GET node-roles standard_query_release → 5 项含 requester/approver/designer/publisher。"""
    resp = client.get(
        "/api/v1/gov/workflow/templates/standard_query_release/node-roles",
        headers=AUTH,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 5
    roles = {i["role"] for i in items}
    assert {"requester", "approver", "designer", "publisher"}.issubset(roles)


def test_gov_r52_resolve_required_role_pending_approval():
    """T-GOV-R52-003-02: resolve_required_role pending_approval == approver。"""
    assert resolve_required_role("standard_query_release", "pending_approval") == "approver"


def test_gov_r52_validate_template_missing_published_node(client):
    """T-GOV-R52-003-03: validate 模板缺 published 节点 → 422 GOV_WORKFLOW_INVALID_TEMPLATE。"""
    resp = client.post(
        "/api/v1/gov/workflow/templates/validate",
        headers=AUTH,
        json={
            "id": "bad_tpl",
            "name": "Bad",
            "nodes": [
                {"id": "draft", "role": "requester"},
                {"id": "pending_approval", "role": "approver"},
            ],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_WORKFLOW_INVALID_TEMPLATE"
    assert "missingNodes" in (resp.json().get("detail") or {})


def test_gov_r52_double_submit_conflict(client):
    """T-GOV-R52-003-04: draft 双 submit → 第二次 409 GOV_WORKFLOW_CONFLICT。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    first = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    assert second.status_code == 409
    assert second.json()["code"] == "GOV_WORKFLOW_CONFLICT"


def test_gov_r52_published_terminal_conflict(client):
    """T-GOV-R52-003-05: published 再 publish → 409 GOV_WORKFLOW_ALREADY_TERMINAL。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    path = [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]
    for action, role in path:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text
    again = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "publish", "actorRole": "publisher"},
    )
    assert again.status_code == 409
    assert again.json()["code"] == "GOV_WORKFLOW_ALREADY_TERMINAL"


def test_gov_r52_reject_path_regression(client):
    """T-GOV-R52-003-06: reject 路径 pending_approval → draft（r49 回归）。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    reject = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "reject", "actorRole": "approver"},
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "draft"


def test_gov_r52_probe_transition_path_budget():
    """T-GOV-R52-003-07: probe_transition_path elapsed < 50ms。"""
    result = probe_transition_path()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_gov_r52_node_roles_unknown_template(client):
    """T-GOV-R52-003-08: HTTP node-roles 404 未知模板。"""
    resp = client.get(
        "/api/v1/gov/workflow/templates/unknown_tpl/node-roles",
        headers=AUTH,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "GOV_WORKFLOW_TEMPLATE_NOT_FOUND"


def test_gov_r52_happy_path_fsm_regression(client):
    """T-GOV-R52-003-09: r49 happy path FSM 仍 200。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    for action, role in [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text
    assert r.json()["status"] == "published"


def test_gov_r52_forbidden_role_regression(client):
    """T-GOV-R52-003-10: forbidden role 仍 403 GOV_WORKFLOW_FORBIDDEN_ROLE。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "approver"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_WORKFLOW_FORBIDDEN_ROLE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "gov_r52" --tb=short`
Expected: FAIL — `ModuleNotFoundError: app.governance.workflow.node_roles` 或路由 404

- [ ] **Step 3: Write minimal implementation**

`backend/app/governance/workflow/errors.py` — 在文件末尾前追加常量（供文档/测试引用）：

```python
GOV_WORKFLOW_CONFLICT = "GOV_WORKFLOW_CONFLICT"
GOV_WORKFLOW_ALREADY_TERMINAL = "GOV_WORKFLOW_ALREADY_TERMINAL"
```

`backend/app/governance/workflow/schemas.py` — 追加：

```python
class NodeRoleOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    node_id: str = Field(alias="nodeId")
    role: str
    description: str


class WorkflowNodeRolesOut(BaseModel):
    items: list[NodeRoleOut]
```

`backend/app/governance/workflow/node_roles.py` — 新建全文（**惰性 import `service` 避免循环依赖**）：

```python
from __future__ import annotations

import time
from dataclasses import dataclass

from app.governance.workflow.errors import WorkflowError

probe_workflow_transition_budget_ms = 50

_REQUIRED_TEMPLATE_NODES = frozenset({"draft", "published"})


@dataclass(frozen=True)
class NodeRoleDescriptor:
    node_id: str
    role: str
    description: str


@dataclass(frozen=True)
class WorkflowProbeResult:
    elapsed_ms: float
    ok: bool


_ROLE_DESCRIPTIONS: dict[str, str] = {
    "draft": "起草节点，由 requester 提交",
    "pending_approval": "待审批，由 approver 审批或驳回",
    "designing": "设计中，由 designer 完成设计",
    "pending_publish": "待发布，由 publisher 发布",
    "published": "已发布终态",
}


def describe_node_roles(template_id: str) -> list[NodeRoleDescriptor]:
    from app.governance.workflow.service import _BUILTIN_TEMPLATES

    template = _BUILTIN_TEMPLATES.get(template_id)
    if template is None:
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_NOT_FOUND", "Template not found", 404)
    return [
        NodeRoleDescriptor(
            node_id=node.id,
            role=node.role,
            description=_ROLE_DESCRIPTIONS.get(node.id, node.id),
        )
        for node in template.nodes
    ]


def resolve_required_role(template_id: str, status: str) -> str:
    from app.governance.workflow.service import _BUILTIN_TEMPLATES

    template = _BUILTIN_TEMPLATES.get(template_id)
    if template is None:
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_NOT_FOUND", "Template not found", 404)
    for node in template.nodes:
        if node.id == status:
            return node.role
    raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", f"Unknown status node: {status}", 422)


def probe_transition_path() -> WorkflowProbeResult:
    from app.governance.workflow.service import _TRANSITIONS

    started = time.perf_counter()
    status = "draft"
    actions = [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]
    ok = True
    for action, role in actions:
        rules = _TRANSITIONS.get(status, {})
        if action not in rules:
            ok = False
            break
        next_status, required_role = rules[action]
        if role != required_role:
            ok = False
            break
        status = next_status
    elapsed_ms = (time.perf_counter() - started) * 1000
    return WorkflowProbeResult(elapsed_ms=elapsed_ms, ok=ok and status == "published")
```

`backend/app/governance/workflow/service.py` — 修改 `validate_template` 与 `transition_instance`：

```python
from app.governance.workflow.node_roles import _REQUIRED_TEMPLATE_NODES

# validate_template 末尾 return 之前追加：
node_ids = {n.id for n in payload.nodes}
missing = sorted(_REQUIRED_TEMPLATE_NODES - node_ids)
if missing:
    raise WorkflowError(
        "GOV_WORKFLOW_INVALID_TEMPLATE",
        "Template missing required nodes",
        422,
    )

# transition_instance 在读取 status 后、rules 检查前追加：
if status == "published":
    raise WorkflowError("GOV_WORKFLOW_ALREADY_TERMINAL", "Workflow already published", 409)
if action == "submit" and status != "draft":
    raise WorkflowError("GOV_WORKFLOW_CONFLICT", "Instance already submitted", 409)
```

同时将 `validate_template` 的 `WorkflowError` 抛出改为带 `detail`：扩展 `WorkflowError` 类：

```python
class WorkflowError(Exception):
    def __init__(self, code: str, message: str, status: int, detail: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.detail = detail
        super().__init__(message)
```

`validate_template` 缺节点时：

```python
raise WorkflowError(
    "GOV_WORKFLOW_INVALID_TEMPLATE",
    "Template missing required nodes",
    422,
    detail={"missingNodes": missing},
)
```

`backend/app/api/v1/gov.py` — 更新 `_workflow_error` 并新增路由：

```python
from app.governance.workflow.node_roles import describe_node_roles
from app.governance.workflow.schemas import WorkflowNodeRolesOut, NodeRoleOut

def _workflow_error(exc: WorkflowError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": exc.detail},
    )


@router.get("/workflow/templates/{template_id}/node-roles", response_model=WorkflowNodeRolesOut)
def get_workflow_node_roles(
    template_id: str,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> WorkflowNodeRolesOut | JSONResponse:
    try:
        items = describe_node_roles(template_id)
        return WorkflowNodeRolesOut(
            items=[
                NodeRoleOut(nodeId=i.node_id, role=i.role, description=i.description)
                for i in items
            ]
        )
    except WorkflowError as exc:
        return _workflow_error(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "gov_r52 or r52_fixture" --tb=short`
Expected: **11 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/workflow/ backend/app/api/v1/gov.py tests/test_design_conn_gov_query_r52.py
git commit -m "feat(gov): GOV-003 r52 node roles API + FSM concurrency guards"
```

---

### Task 2: DESIGN-005 SQL 模式校验链 + chart_view 只读联动

**Files:**
- Modify: `backend/app/designer/schemas.py`
- Modify: `backend/app/designer/sql_mode.py`
- Modify: `backend/app/api/v1/designer.py`
- Modify: `backend/app/schemas/chart_view.py`
- Modify: `tests/test_design_conn_gov_query_r52.py`（追加 DESIGN-005 ≥8 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `assert_readonly_sql` from `app.query.readonly`
- Produces: `probe_validate_sql_mode() -> SqlModeProbeResult`；`DesignerError` 含 `detail.remediation`
- Produces: `ChartViewError` code `CHART_SQL_NOT_READONLY`

- [ ] **Step 1: Write the failing tests**

追加到 `tests/test_design_conn_gov_query_r52.py`：

```python
from app.designer.sql_mode import probe_validate_sql_mode


def test_design_r52_005_select_ok_regression(client):
    """T-DESIGN-R52-005-01: SELECT 1 validate 200（r49 回归）。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "sql": "SELECT 1", **_designer_ref_payload()},
    )
    assert resp.status_code == 200


def test_design_r52_005_insert_remediation(client):
    """T-DESIGN-R52-005-02: INSERT → 422 + detail.remediation 非空。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "INSERT INTO t VALUES(1)",
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "DESIGN_SQL_NOT_READONLY"
    assert body.get("detail", {}).get("remediation")


def test_design_r52_005_comment_hidden_dml(client):
    """T-DESIGN-R52-005-03: 注释隐藏 DML 多语句 → 422 DESIGN_SQL_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1; INSERT INTO t VALUES(1)",
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design_r52_005_for_update_clause(client):
    """T-DESIGN-R52-005-04: FOR UPDATE 子句 → 422 只读拦截。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT * FROM t FOR UPDATE",
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design_r52_005_sql_too_long(client):
    """T-DESIGN-R52-005-05: SQL 长度 65537 → DESIGN_SQL_TOO_LONG。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT " + "x" * 65530,
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_TOO_LONG"


def test_design_r52_005_probe_budget():
    """T-DESIGN-R52-005-06: probe_validate_sql_mode < 50ms。"""
    result = probe_validate_sql_mode()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_design_r52_005_chart_render_spec_insert(client):
    """T-DESIGN-R52-005-07: POST /charts/render-spec sql 模式 + INSERT → 422 CHART_SQL_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/charts/render-spec",
        headers=AUTH,
        json={
            "chartType": "table",
            "mode": "sql",
            "dataSourceId": str(uuid.uuid4()),
            "sql": "INSERT INTO t VALUES(1)",
            "dimensions": [{"field": "id"}],
            "metrics": [{"field": "amount"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CHART_SQL_NOT_READONLY"


def test_design_r52_005_chart_render_spec_select_ok(client):
    """T-DESIGN-R52-005-08: POST /charts/render-spec sql 模式 + SELECT 1 → 200。"""
    resp = client.post(
        "/api/v1/charts/render-spec",
        headers=AUTH,
        json={
            "chartType": "table",
            "mode": "sql",
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1",
            "dimensions": [{"field": "id"}],
            "metrics": [{"field": "amount"}],
        },
    )
    assert resp.status_code == 200


def test_design_r52_005_put_get_roundtrip_regression(client):
    """T-DESIGN-R52-005-09: PUT sql-mode + GET 往返（r49 回归）。"""
    ref = _ref_id()
    payload = {
        "dataSourceId": str(uuid.uuid4()),
        "sql": "SELECT id FROM orders",
        **_designer_ref_payload(ref),
    }
    assert client.put("/api/v1/designer/sql-mode", headers=AUTH, json=payload).status_code == 200
    got = client.get("/api/v1/designer/sql-mode", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200
    assert got.json()["sql"] == payload["sql"]


def test_design_r52_005_capabilities_regression(client):
    """T-DESIGN-R52-005-10: capabilities maxSqlLength=65536（r49 回归）。"""
    resp = client.get("/api/v1/designer/sql-mode/capabilities", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["maxSqlLength"] == 65536
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "design_r52_005" --tb=short`
Expected: FAIL — `probe_validate_sql_mode` 未定义 / `detail.remediation` 缺失 / `CHART_SQL_NOT_READONLY` 未映射

- [ ] **Step 3: Write minimal implementation**

`backend/app/designer/schemas.py` — 扩展 `DesignerError`：

```python
class DesignerError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        fields: list[dict[str, str]] | None = None,
        remediation: str | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        self.remediation = remediation
        super().__init__(message)
```

`backend/app/api/v1/designer.py` — 更新 `_designer_error`：

```python
def _designer_error(exc: DesignerError) -> JSONResponse:
    detail: dict[str, object] = {}
    if exc.fields:
        detail["fields"] = exc.fields
    if exc.remediation:
        detail["remediation"] = exc.remediation
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail or None},
    )
```

`backend/app/designer/sql_mode.py` — 追加 remediation 映射与 probe：

```python
import time
import uuid
from dataclasses import dataclass

_REMEDIATION: dict[str, str] = {
    "DESIGN_SQL_NOT_READONLY": "Use SELECT-only SQL; remove DML/DDL clauses",
    "DESIGN_SQL_EMPTY": "Provide a non-empty SELECT statement",
    "DESIGN_SQL_TOO_LONG": "Reduce SQL length below 65536 characters",
}

probe_sql_mode_validate_budget_ms = 50


@dataclass(frozen=True)
class SqlModeProbeResult:
    elapsed_ms: float
    ok: bool


def _raise_sql_error(code: str, message: str, status: int = 422) -> None:
    raise DesignerError(code, message, status, remediation=_REMEDIATION.get(code))


def validate_sql_mode(spec: SqlModeSpec) -> SqlModeSpec:
    if not spec.sql.strip():
        _raise_sql_error("DESIGN_SQL_EMPTY", "SQL must not be empty")
    try:
        assert_readonly_sql(spec.sql)
    except QueryError as exc:
        if exc.code == "QUERY_SQL_TOO_LONG":
            _raise_sql_error("DESIGN_SQL_TOO_LONG", exc.message, exc.status)
        _raise_sql_error("DESIGN_SQL_NOT_READONLY", exc.message)
    return spec


def probe_validate_sql_mode(sql: str = "SELECT 1") -> SqlModeProbeResult:
    started = time.perf_counter()
    dummy = SqlModeSpec(
        dataSourceId=uuid.uuid4(),
        sql=sql,
        refId=uuid.uuid4(),
    )
    try:
        validate_sql_mode(dummy)
        ok = True
    except DesignerError:
        ok = False
    return SqlModeProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
```

`backend/app/schemas/chart_view.py` — 在 `validate_l1_rules` 中 `if self.mode == "sql" and not self.sql` 检查之后追加：

```python
if self.mode == "sql" and self.sql:
    from app.query.readonly import assert_readonly_sql
    from app.query.schemas import QueryError

    try:
        assert_readonly_sql(self.sql)
    except QueryError as exc:
        raise ValueError(f"CHART_SQL_NOT_READONLY:{exc.message}") from exc
```

并在 `_CODE_FIELD_HINTS` 追加：

```python
"CHART_SQL_NOT_READONLY": ["sql"],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "design_r52_005" --tb=short`
Expected: **10 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/ backend/app/schemas/chart_view.py backend/app/api/v1/designer.py tests/test_design_conn_gov_query_r52.py
git commit -m "feat(designer): DESIGN-005 r52 sql_mode remediation + chart_view readonly link"
```

---

### Task 3: QUERY-003 Native 注入守卫 + readonly-guard 路由

**Files:**
- Modify: `backend/app/query/readonly.py`
- Modify: `backend/app/query/native/schemas.py`
- Modify: `backend/app/query/native/guard.py`
- Modify: `backend/app/api/v1/query.py`
- Modify: `tests/test_design_conn_gov_query_r52.py`（追加 QUERY-003 ≥8 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `assert_safe_sql_parameters(parameters)`、`guard_native_injection(body, parameters)`、`assert_readonly_route_guard(ReadonlyGuardIn) -> ReadonlyGuardOut`、`probe_list_routing_modes() -> NativeProbeResult`
- Produces: `POST /api/v1/query/readonly-guard`

- [ ] **Step 1: Write the failing tests**

追加到 `tests/test_design_conn_gov_query_r52.py`：

```python
from app.query.native.guard import probe_list_routing_modes


def test_query_r52_003_opensearch_validate_regression(client):
    """T-QUERY-R52-003-01: opensearch validate 200（r49 回归）。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "opensearch", "body": {"query": {"match_all": {}}}},
    )
    assert resp.status_code == 200
    assert resp.json()["resolvedMode"] == "native"


def test_query_r52_003_mysql_wrong_mode_regression(client):
    """T-QUERY-R52-003-02: mysql + body 无 sql → QUERY_NATIVE_WRONG_MODE（回归）。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "mysql", "body": {"q": 1}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_WRONG_MODE"


def test_query_r52_003_native_body_injection(client):
    """T-QUERY-R52-003-03: native body 含 DROP → QUERY_NATIVE_INJECTION_SUSPECT。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={
            "connectorType": "opensearch",
            "body": {"query": "1; DROP TABLE users"},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_INJECTION_SUSPECT"


def test_query_r52_003_parameters_injection(client):
    """T-QUERY-R52-003-04: parameters id=1; DROP → QUERY_PARAM_INJECTION_SUSPECT。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={
            "connectorType": "mysql",
            "sql": "SELECT :id",
            "parameters": {"id": "1; DROP"},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_PARAM_INJECTION_SUSPECT"


def test_query_r52_003_readonly_guard_mysql_select(client):
    """T-QUERY-R52-003-05: readonly-guard mysql + SELECT 1 → ok=true mode=sql。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "mysql", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["mode"] == "sql"


def test_query_r52_003_readonly_guard_delete(client):
    """T-QUERY-R52-003-06: readonly-guard mysql + DELETE → 422 QUERY_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "mysql", "sql": "DELETE FROM t"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_query_r52_003_readonly_guard_opensearch_sql_disguise(client):
    """T-QUERY-R52-003-07: readonly-guard opensearch + sql → QUERY_NATIVE_SQL_DISGUISE。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "opensearch", "sql": "SELECT 1"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_SQL_DISGUISE"


def test_query_r52_003_probe_routing_budget():
    """T-QUERY-R52-003-08: probe_list_routing_modes < 50ms。"""
    result = probe_list_routing_modes()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_query_r52_003_routing_modes_regression(client):
    """T-QUERY-R52-003-09: routing modes opensearch=native mysql=sql（回归）。"""
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes["opensearch"] == "native"
    assert modes["mysql"] == "sql"


def test_query_r52_003_binding_insert_regression(client):
    """T-QUERY-R52-003-10: binding sql 模式 INSERT 仍 400（QUERY-001 对齐）。"""
    resp = client.post(
        "/api/v1/query/bindings",
        headers=AUTH,
        json={
            "name": "r52-binding",
            "dataSourceId": str(uuid.uuid4()),
            "mode": "sql",
            "sql": "INSERT INTO t VALUES(1)",
        },
    )
    assert resp.status_code in (400, 422)
    assert resp.json()["code"] in ("QUERY_NOT_READONLY", "QUERY_BINDING_INVALID")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "query_r52_003" --tb=short`
Expected: FAIL — `readonly-guard` 404 / 注入 code 未定义

- [ ] **Step 3: Write minimal implementation**

`backend/app/query/readonly.py` — 文件末尾追加：

```python
_UNSAFE_PARAM_PATTERN = re.compile(r"(--|/\*|;|\bDROP\b|\bUNION\b)", re.IGNORECASE)


def assert_safe_sql_parameters(parameters: dict[str, object]) -> None:
    for key, value in parameters.items():
        if isinstance(value, str) and _UNSAFE_PARAM_PATTERN.search(value):
            raise QueryError(
                "QUERY_PARAM_INJECTION_SUSPECT",
                f"Unsafe value in parameter {key}",
                422,
            )
```

`backend/app/query/native/schemas.py` — 扩展 `NativeQuerySpec` 并新增：

```python
from typing import Literal

class NativeQuerySpec(BaseModel):
    ...
    parameters: dict[str, object] | None = None


class ReadonlyGuardIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    connector_type: str = Field(alias="connectorType")
    sql: str = Field(min_length=1)
    parameters: dict[str, object] | None = None


class ReadonlyGuardOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    ok: bool
    mode: Literal["sql", "native"]
```

`backend/app/query/native/guard.py` — 追加注入守卫、readonly 路由与 probe：

```python
import time
from dataclasses import dataclass

from app.query.readonly import assert_readonly_sql, assert_safe_sql_parameters
from app.query.native.schemas import ReadonlyGuardIn, ReadonlyGuardOut

probe_native_routing_budget_ms = 50


@dataclass(frozen=True)
class NativeProbeResult:
    elapsed_ms: float
    ok: bool


def _iter_string_leaves(obj: object):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_string_leaves(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from _iter_string_leaves(item)


def guard_native_injection(body: dict, parameters: dict[str, object] | None = None) -> None:
    for leaf in _iter_string_leaves(body):
        if '"; DROP' in leaf or "$where" in leaf:
            raise QueryError("QUERY_NATIVE_INJECTION_SUSPECT", "Suspicious native query body", 422)
    if parameters:
        assert_safe_sql_parameters(parameters)


def validate_native_spec(spec: NativeQuerySpec) -> NativeValidateOut:
    guard_native_injection(spec.body, spec.parameters)
    ...  # 保持既有逻辑


def assert_readonly_route_guard(spec: ReadonlyGuardIn) -> ReadonlyGuardOut:
    mode = resolve_query_mode(spec.connector_type)
    if mode == "sql":
        assert_readonly_sql(spec.sql)
        if spec.parameters:
            assert_safe_sql_parameters(spec.parameters)
        return ReadonlyGuardOut(ok=True, mode="sql")
    if spec.sql:
        raise QueryError("QUERY_NATIVE_SQL_DISGUISE", "sql field is not allowed in native mode", 422)
    return ReadonlyGuardOut(ok=True, mode="native")


def probe_list_routing_modes() -> NativeProbeResult:
    started = time.perf_counter()
    try:
        out = list_routing_modes()
        ok = len(out.modes) > 0
    except Exception:
        ok = False
    return NativeProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
```

`backend/app/api/v1/query.py` — 追加路由：

```python
from app.query.native.guard import assert_readonly_route_guard
from app.query.native.schemas import ReadonlyGuardIn, ReadonlyGuardOut

@router.post("/readonly-guard", response_model=ReadonlyGuardOut)
def readonly_route_guard(
    payload: ReadonlyGuardIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ReadonlyGuardOut | JSONResponse:
    try:
        return assert_readonly_route_guard(payload)
    except QueryError as exc:
        return _error_response(exc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "query_r52_003" --tb=short`
Expected: **10 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/ backend/app/api/v1/query.py tests/test_design_conn_gov_query_r52.py
git commit -m "feat(query): QUERY-003 r52 injection smoke + readonly-guard route"
```

---

### Task 4: DESIGN-003 输出字段数量/重复边界 + probe

**Files:**
- Modify: `backend/app/designer/schemas.py`
- Modify: `backend/app/designer/output_fields.py`
- Modify: `tests/test_design_conn_gov_query_r52.py`（追加 DESIGN-003 ≥6 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `MAX_OUTPUT_FIELDS = 64`、`MAX_AGGREGATES = 16`、`probe_validate_output_fields(session) -> OutputFieldsProbeResult`

- [ ] **Step 1: Write the failing tests**

追加到 `tests/test_design_conn_gov_query_r52.py`：

```python
from app.designer.output_fields import probe_validate_output_fields
from app.designer.schemas import OutputFieldItem, OutputFieldsConfig, AggregateItem


def _valid_output_fields(n_fields: int = 1, n_aggs: int = 0) -> OutputFieldsConfig:
    fields = [
        OutputFieldItem(fieldId="order_amount") for _ in range(n_fields)
    ]
  # 重复 fieldId 测试用自定义列表
    return OutputFieldsConfig(
        fields=fields,
        aggregates=[
            AggregateItem(fn="sum", fieldId="order_amount", groupBy=[])
            for _ in range(n_aggs)
        ],
        refId=uuid.uuid4(),
    )


def test_design_r52_003_put_get_regression(client):
    """T-DESIGN-R52-003-01: 合法 PUT/GET 往返（r49 回归）。"""
    ref = _ref_id()
    payload = {
        "fields": [{"fieldId": "order_amount"}],
        "aggregates": [],
        **_designer_ref_payload(ref),
    }
    assert client.put("/api/v1/designer/output-fields", headers=AUTH, json=payload).status_code == 200
    got = client.get("/api/v1/designer/output-fields", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200


def test_design_r52_003_empty_fields_regression(client):
    """T-DESIGN-R52-003-02: 空 fields → DESIGN_EMPTY_OUTPUT_FIELDS（回归）。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={"fields": [], "aggregates": [], **_designer_ref_payload()},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_OUTPUT_FIELDS"


def test_design_r52_003_too_many_fields(client):
    """T-DESIGN-R52-003-03: 65 个 fields → DESIGN_TOO_MANY_OUTPUT_FIELDS。"""
    fields = [{"fieldId": "order_amount", "alias": f"f{i}"} for i in range(65)]
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={"fields": fields, "aggregates": [], **_designer_ref_payload()},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_TOO_MANY_OUTPUT_FIELDS"


def test_design_r52_003_duplicate_field_id(client):
    """T-DESIGN-R52-003-04: 重复 fieldId → DESIGN_DUPLICATE_OUTPUT_FIELD。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "order_amount"}, {"fieldId": "order_amount"}],
            "aggregates": [],
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_DUPLICATE_OUTPUT_FIELD"


def test_design_r52_003_too_many_aggregates(client):
    """T-DESIGN-R52-003-05: 17 aggregates → DESIGN_TOO_MANY_AGGREGATES。"""
    aggs = [{"fn": "sum", "fieldId": "order_amount", "groupBy": []} for _ in range(17)]
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "order_amount"}],
            "aggregates": aggs,
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_TOO_MANY_AGGREGATES"


def test_design_r52_003_unknown_field_regression(client):
    """T-DESIGN-R52-003-06: 未知 fieldId（回归）。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "not_in_registry"}],
            "aggregates": [],
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"


def test_design_r52_003_invalid_aggregate_regression(client):
    """T-DESIGN-R52-003-07: 非法 aggregate fn（回归）。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "order_amount"}],
            "aggregates": [{"fn": "median", "fieldId": "order_amount", "groupBy": []}],
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design_r52_003_probe_budget(client):
    """T-DESIGN-R52-003-08: probe_validate_output_fields < 50ms。"""
    from app.datasources.models import get_meta_engine
    from sqlalchemy.orm import Session

    engine = get_meta_engine()
    with Session(engine) as session:
        result = probe_validate_output_fields(session)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_design_r52_003_sql_mode_coexist_regression(client):
    """T-DESIGN-R52-003-09: 同 ref sql_mode + output_fields 并存（回归）。"""
    ref = _ref_id()
    base = _designer_ref_payload(ref)
    assert client.put(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "sql": "SELECT 1", **base},
    ).status_code == 200
    assert client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={"fields": [{"fieldId": "order_amount"}], "aggregates": [], **base},
    ).status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "design_r52_003" --tb=short`
Expected: FAIL — `DESIGN_TOO_MANY_OUTPUT_FIELDS` / `probe_validate_output_fields` 未定义

- [ ] **Step 3: Write minimal implementation**

`backend/app/designer/schemas.py` — 在 `ALLOWED_OUTPUT_AGGREGATES` 后追加：

```python
MAX_OUTPUT_FIELDS = 64
MAX_AGGREGATES = 16
```

`backend/app/designer/output_fields.py` — 在 `validate_output_fields_config` 开头追加边界检查与 probe：

```python
import time
from dataclasses import dataclass

from app.designer.schemas import MAX_AGGREGATES, MAX_OUTPUT_FIELDS

probe_output_fields_validate_budget_ms = 50


@dataclass(frozen=True)
class OutputFieldsProbeResult:
    elapsed_ms: float
    ok: bool


def validate_output_fields_config(session: Session, config: OutputFieldsConfig) -> OutputFieldsConfig:
    if not config.fields:
        raise DesignerError(...)  # 保持既有
    if len(config.fields) > MAX_OUTPUT_FIELDS:
        raise DesignerError(
            "DESIGN_TOO_MANY_OUTPUT_FIELDS",
            f"At most {MAX_OUTPUT_FIELDS} output fields allowed",
            422,
            fields=[{"field": "fields", "message": f"max {MAX_OUTPUT_FIELDS}"}],
        )
    field_ids = [f.field_id for f in config.fields]
    if len(field_ids) != len(set(field_ids)):
        raise DesignerError(
            "DESIGN_DUPLICATE_OUTPUT_FIELD",
            "Duplicate fieldId in output fields",
            422,
            fields=[{"field": "fields", "message": "duplicate fieldId"}],
        )
    if len(config.aggregates) > MAX_AGGREGATES:
        raise DesignerError(
            "DESIGN_TOO_MANY_AGGREGATES",
            f"At most {MAX_AGGREGATES} aggregates allowed",
            422,
            fields=[{"field": "aggregates", "message": f"max {MAX_AGGREGATES}"}],
        )
    ...  # 保持既有 glossary/registry 校验


def probe_validate_output_fields(session: Session) -> OutputFieldsProbeResult:
    started = time.perf_counter()
    cfg = OutputFieldsConfig(
        fields=[OutputFieldItem(fieldId="order_amount")],
        refId=uuid.uuid4(),
    )
    try:
        validate_output_fields_config(session, cfg)
        ok = True
    except DesignerError:
        ok = False
    return OutputFieldsProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "design_r52_003" --tb=short`
Expected: **9 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/ tests/test_design_conn_gov_query_r52.py
git commit -m "feat(designer): DESIGN-003 r52 output_fields count/duplicate bounds + probe"
```

---

### Task 5: CONN-016 OpenSearch HTTP 链 + 空索引/limit 边界

**Files:**
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/opensearch.py`
- Modify: `tests/test_design_conn_gov_query_r52.py`（追加 CONN-016 ≥8 测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `OPENSEARCH_INDEX_NOT_FOUND`；`map_opensearch_error` 识别 index not found
- Produces: `probe_list_columns_mock(client) -> OpensearchProbeResult`

- [ ] **Step 1: Write the failing tests**

追加到 `tests/test_design_conn_gov_query_r52.py`：

```python
from unittest.mock import MagicMock, patch

from app.datasources.dialects.opensearch import OpensearchConnector, probe_list_columns_mock
from app.datasources.registry import export_type_catalog


def test_conn_r52_016_catalog_regression():
    """T-CONN-R52-016-01: catalog 含 opensearch（回归）。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "opensearch" in types


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_mock_info_ok(mock_os_cls):
    """T-CONN-R52-016-02: mock info 成功（回归）。"""
    mock_os_cls.return_value.info.return_value = {"version": {"number": "2.11.0"}}
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="", password="")
    assert result.ok is True


def test_conn_r52_016_empty_host_regression():
    """T-CONN-R52-016-03: 空 host OPENSEARCH_INVALID_HOST（回归）。"""
    conn = OpensearchConnector()
    result = conn.test_connection(host="  ", port=9200, database="", username="", password="")
    assert result.ok is False
    assert result.code == "OPENSEARCH_INVALID_HOST"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_auth_failed_regression(mock_os_cls):
    """T-CONN-R52-016-04: mock 401 OPENSEARCH_AUTH_FAILED（回归）。"""
    mock_os_cls.return_value.info.side_effect = Exception("authentication failed 401")
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="u", password="p")
    assert result.ok is False
    assert result.code == "OPENSEARCH_AUTH_FAILED"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_empty_indices(mock_os_cls):
    """T-CONN-R52-016-05: mock 空 indices list_schemas → []。"""
    mock_os_cls.return_value.cat.indices.return_value = []
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    assert conn.list_schemas(client) == []


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_empty_properties(mock_os_cls):
    """T-CONN-R52-016-06: mock 空 properties list_columns → []。"""
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {}}}
    mock_os_cls.return_value = mock_client
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    assert conn.list_columns(client, "idx", "_doc") == []


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_truncate_500_regression(mock_os_cls):
    """T-CONN-R52-016-07: 501 字段 truncate 500（回归）。"""
    props = {f"f{i}": {"type": "keyword"} for i in range(510)}
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    mock_os_cls.return_value = mock_client
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    assert len(conn.list_columns(client, "idx", "_doc")) == 500


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_http_test_auth_fail_trace(client, mock_os_cls):
    """T-CONN-R52-016-08: HTTP POST test auth fail → code + traceId。"""
    mock_os_cls.return_value.info.side_effect = Exception("authentication failed 401")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "opensearch",
            "host": "localhost",
            "port": 9200,
            "database": "",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "OPENSEARCH_AUTH_FAILED"
    assert body.get("traceId")


def test_conn_r52_016_http_schemas_connection_failed(client):
    """T-CONN-R52-016-09: HTTP GET schemas 连接失败 → 502 METADATA_CONNECTION_FAILED。"""
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": f"os-r52-{uuid.uuid4().hex[:8]}",
            "type": "opensearch",
            "host": "localhost",
            "port": 9200,
            "database": "",
            "username": "",
            "password": "",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    with patch("app.datasources.dialects.opensearch.OpenSearch") as mock_os:
        mock_os.return_value.cat.indices.side_effect = Exception("connection refused")
        resp = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_probe_budget(mock_os_cls):
    """T-CONN-R52-016-10: probe_list_columns_mock < 100ms。"""
    props = {f"f{i}": {"type": "keyword"} for i in range(510)}
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    conn = OpensearchConnector()
    result = probe_list_columns_mock(mock_client, "idx")
    assert result.ok is True
    assert result.elapsed_ms < 100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "conn_r52_016" --tb=short`
Expected: FAIL — 空 indices/properties 未处理 / `probe_list_columns_mock` 未定义

- [ ] **Step 3: Write minimal implementation**

`backend/app/datasources/dialects/errors.py` — 在 `OPENSEARCH_UNKNOWN` 后追加并更新 `map_opensearch_error`：

```python
OPENSEARCH_INDEX_NOT_FOUND = "OPENSEARCH_INDEX_NOT_FOUND"


def map_opensearch_error(exc: Exception) -> tuple[str, str]:
    msg = str(exc).lower()
    if "index_not_found" in msg or "index not found" in msg or "404" in msg:
        return OPENSEARCH_INDEX_NOT_FOUND, str(exc)
    if "timeout" in msg or "timed out" in msg:
        return OPENSEARCH_TIMEOUT, str(exc)
    if "connection refused" in msg or "failed to establish" in msg:
        return OPENSEARCH_CONNECTION_REFUSED, str(exc)
    if "authentication" in msg or "401" in msg or "403" in msg:
        return OPENSEARCH_AUTH_FAILED, str(exc)
    if "host is required" in msg:
        return OPENSEARCH_INVALID_HOST, str(exc)
    return OPENSEARCH_UNKNOWN, str(exc)
```

`backend/app/datasources/dialects/opensearch.py` — 重构异常路径并追加边界/probe：

```python
from app.datasources.dialects.errors import map_opensearch_error

probe_opensearch_metadata_budget_ms = 100


@dataclass(frozen=True)
class OpensearchProbeResult:
    elapsed_ms: float
    ok: bool


# test_connection except Exception 分支改为：
except Exception as exc:
    code, detail = map_opensearch_error(exc)
    latency_ms = int((time.perf_counter() - started) * 1000)
    return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)


def list_schemas(self, connection: OpenSearch) -> list[SchemaInfo]:
    rows = connection.cat.indices(format="json") or []
    names = [row["index"] for row in rows if not str(row["index"]).startswith(".")]
    return [SchemaInfo(name=n) for n in sorted(names)]


def list_columns(self, connection: OpenSearch, schema: str, table: str) -> list[ColumnInfo]:
    try:
        mapping = connection.indices.get_mapping(index=schema)
    except Exception as exc:
        code, _ = map_opensearch_error(exc)
        if code == "OPENSEARCH_INDEX_NOT_FOUND":
            raise ValueError(f"[{code}] index not found: {schema}") from exc
        raise
    props = mapping.get(schema, {}).get("mappings", {}).get("properties") or {}
    ...  # 保持既有列构建与 500 truncate


def probe_list_columns_mock(client: OpenSearch, index: str = "idx") -> OpensearchProbeResult:
    started = time.perf_counter()
    conn = OpensearchConnector()
    try:
        cols = conn.list_columns(client, index, "_doc")
        ok = isinstance(cols, list)
    except Exception:
        ok = False
    return OpensearchProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
```

移除 `opensearch.py` 顶部重复的 `OPENSEARCH_*` 常量，改从 `errors.py` import（避免漂移）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v -k "conn_r52_016" --tb=short`
Expected: **10 passed**

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/ tests/test_design_conn_gov_query_r52.py
git commit -m "feat(conn): CONN-016 r52 opensearch error map + empty index bounds + probe"
```

---

### Task 6: 跨项联动断言 + 全量回归门控

**Files:**
- Modify: `tests/test_design_conn_gov_query_r52.py`（追加跨项联动 ≥2 测）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**UI skill:** none

- [ ] **Step 1: Write cross-link tests**

追加到 `tests/test_design_conn_gov_query_r52.py`：

```python
def test_r52_cross_designer_sql_and_chart_readonly_aligned(client):
    """T-R52-X-01: designer validate 与 chart render-spec 对同一 INSERT SQL 均拒绝。"""
    bad_sql = "INSERT INTO t VALUES(1)"
    ds = str(uuid.uuid4())
    ref = _designer_ref_payload()
    d_resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={"dataSourceId": ds, "sql": bad_sql, **ref},
    )
    c_resp = client.post(
        "/api/v1/charts/render-spec",
        headers=AUTH,
        json={
            "chartType": "table",
            "mode": "sql",
            "dataSourceId": ds,
            "sql": bad_sql,
            "dimensions": [{"field": "id"}],
            "metrics": [{"field": "amount"}],
        },
    )
    assert d_resp.status_code == 422
    assert c_resp.status_code == 422
    assert d_resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"
    assert c_resp.json()["code"] == "CHART_SQL_NOT_READONLY"


def test_r52_cross_gov_workflow_and_designer_same_ref(client):
    """T-R52-X-02: 同一 design_draft ref 可并存 workflow instance + sql_mode。"""
    ref = str(uuid.uuid4())
    wf = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": ref},
    )
    sql = client.put(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        json={
            "refType": "design_draft",
            "refId": ref,
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1",
        },
    )
    assert wf.status_code == 201
    assert sql.status_code == 200
```

- [ ] **Step 2: Run full r52 suite**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -v --tb=short`
Expected: **≥32 passed**（当前约 42 条）

- [ ] **Step 3: Run regression gate**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_design_conn_gov_query_r52.py \
  ../tests/test_design_conn_gov_query_r49.py \
  ../tests/test_nfr_gov_conn_r51.py \
  ../tests/test_nfr_gov_conn_r46.py \
  -q
```
Expected: r52 ≥32 + r49 35/35 + r51 43/43 + r46 36/36；ruff exit 0

- [ ] **Step 4: Commit**

```bash
git add tests/test_design_conn_gov_query_r52.py
git commit -m "test: r52 cross-link assertions + regression gate green"
```

---

### Task 7: 文档同步（prd-sync 评估落地）

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/designer.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/services/datasources.md`
- Modify: `docs/services/query.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

触及 `docs/**` 域 — P3 动态 `@` `.cursor/rules/docs-layer.mdc` 与 `prd-sync.mdc`。

- [ ] **Step 1: 登记 API 路由**

`docs/api/README.md` 追加两行（状态：已实现）：

| Method | Path | 说明 | 里程碑 |
|--------|------|------|--------|
| GET | `/api/v1/gov/workflow/templates/{template_id}/node-roles` | 工单模板节点角色配置 | M13/GOV-003 r52 |
| POST | `/api/v1/query/readonly-guard` | 只读 SQL / native 路由守卫 smoke | M12/QUERY-003 r52 |

- [ ] **Step 2: 更新域附录**

`docs/services/governance.md` — 在 workflow 小节登记：`node_roles.describe_node_roles`、`GOV_WORKFLOW_CONFLICT`/`ALREADY_TERMINAL` 并发契约、`probe_transition_path` 性能 smoke。

`docs/services/designer.md` — 登记：`sql_mode` remediation detail、`MAX_OUTPUT_FIELDS=64`/`MAX_AGGREGATES=16`、`chart_view` sql 只读联动 `CHART_SQL_NOT_READONLY`。

`docs/services/datasources.md` — 登记：OpenSearch `map_opensearch_error` 单出口、`OPENSEARCH_INDEX_NOT_FOUND`、空 indices/空 properties 语义。

`docs/services/query.md` — 登记：`assert_safe_sql_parameters`、`guard_native_injection`、`readonly-guard` 路由、`QUERY_NATIVE_INJECTION_SUSPECT`/`QUERY_PARAM_INJECTION_SUSPECT`。

- [ ] **Step 3: Verify docs only — no test regression**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r52.py -q`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/designer.md docs/services/governance.md docs/services/datasources.md docs/services/query.md
git commit -m "docs: r52 companion boundaries + API routes for GOV-003/QUERY-003"
```

---

### Task 8: P3 收尾 — ruff + 全量 pytest + branch 记录

**Files:**（无新文件；验证 only）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/finishing-a-development-branch/SKILL.md`

**UI skill:** none

- [ ] **Step 1: Full verification（P4 同命令预跑）**

```bash
cd backend && python3 -m ruff check . && python3 -m pytest -q
```
Expected: exit_code 0；passed ≥1280 / skipped 4

- [ ] **Step 2: 确认 r49 无回归**

Run: `cd backend && python3 -m pytest ../tests/test_design_conn_gov_query_r49.py -q`
Expected: **35 passed**

- [ ] **Step 3: 记录 branch（P3 完成时写入 evolution-state）**

Branch 命名建议：`feat/evolution-r52-m13-design-opensearch-gov-query-companion-quality`；`base_branch=dev-auto`。

- [ ] **Step 4: Final commit if needed**

```bash
git status
# 工作区干净后无需额外 commit
```

---

## Spec Self-Review（P2 完成检查）

| 检查项 | 状态 |
|--------|------|
| GOV-003 节点角色 + 并发/幂等 + probe | Task 1 |
| DESIGN-005 remediation + chart_view + probe | Task 2 |
| QUERY-003 注入 + readonly-guard + probe | Task 3 |
| DESIGN-003 数量/重复边界 + probe | Task 4 |
| CONN-016 HTTP 链 + 空索引 + probe | Task 5 |
| r52 ≥32 测 + r49/r51/r46 回归 | Task 6–8 |
| 无 TBD/TODO 占位 | ✓ |
| 全 Task UI skill: none | ✓ |
| 生产文件 16 + 测试 1 ≤ 20（docs 另计） | ✓ |

---

## Execution Handoff

**Plan complete.** 固定使用 **subagent-driven-development (option 1)** — 每 Task 派发独立 subagent + 双 review；不询问用户。

**REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`
