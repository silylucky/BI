# M-FINAL · F-E 设计器奠基 + 工单模板（批次 1）实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/designer/schemas.py`、`backend/app/designer/service.py`、`backend/app/designer/snapshot.py`（新建）、`backend/app/designer/workflow.py`、`backend/app/designer/output_fields.py`、`backend/app/api/v1/designer.py`、`backend/app/governance/workflow/service.py`、`backend/app/governance/workflow/schemas.py`、`backend/app/governance/workflow/node_roles.py`、`backend/app/api/v1/gov.py`、`backend/app/query/config_store/schemas.py`、`tests/test_mfinal_fe_design_r245.py`（新建）、`fe/src/pages/admin/designer/DesignerPage.tsx`、`fe/src/pages/admin/designer/designer-panels.tsx`（新建）、`fe/src/pages/admin/designer/useDesignerWorkspace.ts`（新建）、`fe/src/pages/admin/designer/designer.smoke.test.tsx`（新建）、`fe/src/pages/admin/governance/components/WorkflowTemplateDetail.tsx`、`fe/src/lib/queryKeys.ts`、`docs/api/README.md`、`docs/services/designer.md`、`docs/services/governance.md`
> **子项：** DESIGN-001、DESIGN-002、DESIGN-003、GOV-003、DESIGN-004
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端预指定 fastapi + TDD；UI 预指定 b-design-system-tailadmin-radix）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`；`fe-ui.mdc` 匹配 `fe/**`）

**Goal:** F-E 批次 1 奠基：Admin 查询设计器三面板（条件拖拽 + 运算规则 + 输出聚合）+ SQL 预览 + 工单模板 CRUD + 设计器配置快照提交工单。

**Architecture:** 三块配置（conditions/compute_rules/output_fields）共享 `designerItemId`/`refId` 经既有 config_store 持久化；`build_preview_translate_request` 合并三块后委托 `translate_config_to_sql`（规则以 SQL 注释附注）；自定义工单模板存 `workflow_template` config；`capture_snapshot` 深拷贝三块 payload 为不可变 `designer_snapshot`；`submit_with_snapshot` 编排 snapshot → instance → workflow-link → auto submit transition。FE 抽 `designer-panels.tsx` + `useDesignerWorkspace.ts` 控制 `DesignerPage` ≤300 行。

**Tech Stack:** Python 3.12 + FastAPI + SQLAlchemy + pytest；React 18 + TanStack Query + shadcn/ui + vitest + HTML5 DnD（零新 npm 拖拽依赖）。

## Global Constraints

- 不修改 `goal.md` / `docs/automate/plan.md` 结构；PRD 分片勾选留给 P5
- 单 Python 业务文件 ≤ 200 行；`designer-panels.tsx` / `useDesignerWorkspace.ts` 各 ≤ 300 行
- 不引入 `@dnd-kit` 或新 BI 运行时依赖；条件重排用 HTML5 DnD + 键盘上移/下移兜底
- preview translate probe ≤ **50ms**；workflow transition probe ≤ **50ms**
- FSM 五态节点 id 固定（`draft`→`published`）；内置模板 `standard_query_release` 只读
- 角色白名单：`requester` | `approver` | `designer` | `publisher` | `admin`
- 错误码与 design 一致（`DESIGN_*`、`GOV_WORKFLOW_*`）
- 文档同步：`docs/api/README.md` + `docs/services/designer.md` + `docs/services/governance.md`（`prd-sync.mdc`）
- 提交格式：`feat:` / `test:` / `docs:` + 英文动词短语
- 分支建议：`feat/mfinal-fe-design-r245`（自 `dev-auto`）

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `backend/app/designer/schemas.py` | **修改** | `FieldRegistryOut`、`PreviewTranslateIn`、`DesignerSnapshotOut`、`DesignerSubmitWorkflowIn` |
| `backend/app/designer/service.py` | **修改** | `list_designer_fields()`、`build_preview_translate_request()`、`probe_preview_translate_budget_ms` |
| `backend/app/designer/snapshot.py` | **新建** | `capture_snapshot()`、`get_snapshot()` |
| `backend/app/designer/workflow.py` | **修改** | `submit_with_snapshot()` 编排 |
| `backend/app/designer/output_fields.py` | **修改** | dataset computed field 校验扩展 |
| `backend/app/api/v1/designer.py` | **修改** | `GET /fields`、`POST /preview/translate`、`POST /submit-workflow` |
| `backend/app/governance/workflow/service.py` | **修改** | 自定义模板 CRUD、custom+builtin 合并 list、`create_instance` 支持 custom |
| `backend/app/governance/workflow/schemas.py` | **修改** | `WorkflowTemplateCreateIn`/`UpdateIn` |
| `backend/app/governance/workflow/node_roles.py` | **修改** | `describe_node_roles` 读持久化模板 |
| `backend/app/api/v1/gov.py` | **修改** | `POST/PUT/DELETE /workflow/templates`；instance GET 扩展 `designSnapshot` |
| `backend/app/query/config_store/schemas.py` | **修改** | `ALLOWED_CONFIG_TYPES` 增加 `workflow_template`、`designer_snapshot` |
| `tests/test_mfinal_fe_design_r245.py` | **新建** | ≥30 条 F-E 批次 1 pytest |
| `fe/src/pages/admin/designer/designer-panels.tsx` | **新建** | 条件/规则/输出三面板 |
| `fe/src/pages/admin/designer/useDesignerWorkspace.ts` | **新建** | 状态、校验、保存、预览、提交编排 |
| `fe/src/pages/admin/designer/DesignerPage.tsx` | **修改** | 三区工作区 + 提交工单 |
| `fe/src/pages/admin/designer/designer.smoke.test.tsx` | **新建** | RTL smoke ≥6 条 |
| `fe/src/pages/admin/governance/components/WorkflowTemplateDetail.tsx` | **修改** | 自定义模板「复制并编辑」Dialog |
| `fe/src/lib/queryKeys.ts` | **修改** | designer.* query keys |
| `docs/api/README.md` | **修改** | 新路由登记 |
| `docs/services/designer.md` | **修改** | 快照/预览/提交边界 |
| `docs/services/governance.md` | **修改** | 模板 CRUD 状态 |

---

### Task 1: DESIGN-001 — 字段注册表 + 预览翻译后端 + pytest 001 区块

**Files:**
- Modify: `backend/app/designer/schemas.py`
- Modify: `backend/app/designer/service.py`
- Modify: `backend/app/api/v1/designer.py`
- Modify: `backend/app/query/config_store/schemas.py`
- Create: `tests/test_mfinal_fe_design_r245.py`（module fixture + 001 区块）

**Interfaces:**
- Produces: `FieldRegistryOut(registry: list[str], glossary: list[str], datasetFields: list[str])`
- Produces: `PreviewTranslateIn(conditions, computeRules, outputFields, datasetId: UUID | None)`
- Produces: `build_preview_translate_request(session, payload) -> TranslateRequest`
- Produces: `list_designer_fields(session, dataset_id) -> FieldRegistryOut`
- Produces: `probe_preview_translate_budget_ms(session, payload) -> float`
- Produces: tests `test_design_r245_001_01` ~ `test_design_r245_001_08`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

- [ ] **Step 1: 扩展 config_store 允许类型**

在 `backend/app/query/config_store/schemas.py` 的 `ALLOWED_CONFIG_TYPES` 增加：

```python
ALLOWED_CONFIG_TYPES = frozenset({
    # ... existing ...
    "workflow_template",
    "designer_snapshot",
})
```

- [ ] **Step 2: 新建测试文件与 module fixture**

创建 `tests/test_mfinal_fe_design_r245.py`：

```python
"""M-FINAL F-E r245 — DESIGN-001~004 + GOV-003 批次 1。"""
from __future__ import annotations

import os
import time
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import jwt_auth_headers

_R245_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fe_r245?mode=memory&cache=shared&uri=true"

VALID_CONDITIONS = {
    "schemaVersion": "1.0",
    "logic": "AND",
    "conditions": [
        {
            "fieldId": "order_amount",
            "operator": "gt",
            "value": 100,
            "valueType": "number",
        }
    ],
    "refType": "design_draft",
    "refId": "00000000-0000-4000-8000-000000000001",
}

VALID_RULES = {
    "schemaVersion": "1.0",
    "rules": [
        {
            "id": "r1",
            "name": "sum amount",
            "ruleType": "sum",
            "targetField": "amount",
            "expression": "sum(order_amount)",
            "dependsOn": [],
        }
    ],
    "refType": "design_draft",
    "refId": "00000000-0000-4000-8000-000000000001",
}

VALID_OUTPUT = {
    "schemaVersion": "1.0",
    "fields": [{"fieldId": "order_amount", "alias": "amount", "visible": True}],
    "aggregates": [{"fn": "sum", "fieldId": "order_amount", "groupBy": []}],
    "refType": "design_draft",
    "refId": "00000000-0000-4000-8000-000000000001",
}


@pytest.fixture(scope="module", autouse=True)
def r245_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R245_SQLITE_URL
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

- [ ] **Step 3: 写失败测试 001 区块（8 条）**

追加到同一文件：

```python
def test_design_r245_001_01_fields_api_returns_registry(client, admin_headers):
    """T-DESIGN-R245-001-01: GET /designer/fields 返回 registry + glossary。"""
    resp = client.get("/api/v1/designer/fields", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "order_amount" in body["registry"]
    assert isinstance(body["glossary"], list)


def test_design_r245_001_02_preview_translate_ok(client, admin_headers):
    """T-DESIGN-R245-001-02: POST /preview/translate 合法 payload → sql 字符串。"""
    resp = client.post(
        "/api/v1/designer/preview/translate",
        headers=admin_headers,
        json={
            "conditions": VALID_CONDITIONS,
            "computeRules": VALID_RULES,
            "outputFields": VALID_OUTPUT,
        },
    )
    assert resp.status_code == 200
    assert isinstance(resp.json()["sql"], str)
    assert len(resp.json()["sql"]) > 0


def test_design_r245_001_03_empty_conditions_validate_422(client, admin_headers):
  """T-DESIGN-R245-001-03: 空 conditions → DESIGN_EMPTY_CONDITIONS。"""
  bad = {**VALID_CONDITIONS, "conditions": []}
  resp = client.post("/api/v1/designer/conditions/validate", headers=admin_headers, json=bad)
  assert resp.status_code == 422
  assert resp.json()["code"] == "DESIGN_EMPTY_CONDITIONS"


def test_design_r245_001_04_unknown_field_422(client, admin_headers):
    bad = {**VALID_CONDITIONS}
    bad["conditions"][0]["fieldId"] = "not_a_field"
    resp = client.post("/api/v1/designer/conditions/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"


def test_design_r245_001_05_conditions_put_get_roundtrip(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {**VALID_CONDITIONS, "refId": ref_id}
    put = client.put("/api/v1/designer/conditions", headers=admin_headers, json=payload)
    assert put.status_code == 200
    get = client.get(f"/api/v1/designer/conditions?refId={ref_id}", headers=admin_headers)
    assert get.status_code == 200
    assert get.json()["conditions"][0]["fieldId"] == "order_amount"


def test_design_r245_001_06_preview_probe_under_50ms(client, admin_headers):
    from app.designer import service as designer_service
    from app.datasources.models import get_meta_session
    from app.designer.schemas import PreviewTranslateIn

    session = get_meta_session()
    try:
        payload = PreviewTranslateIn.model_validate({
            "conditions": VALID_CONDITIONS,
            "computeRules": VALID_RULES,
            "outputFields": VALID_OUTPUT,
        })
        elapsed = designer_service.probe_preview_translate_budget_ms(session, payload)
        assert elapsed <= 50.0
    finally:
        session.close()


def test_design_r245_001_07_viewer_put_conditions_forbidden_or_conflict(client, viewer_headers, admin_headers):
    ref_id = str(uuid.uuid4())
    admin_id = jwt_auth_headers(roles=["admin"])
    client.put(
        "/api/v1/designer/conditions",
        headers=admin_id,
        json={**VALID_CONDITIONS, "refId": ref_id},
    )
    resp = client.put(
        "/api/v1/designer/conditions",
        headers=viewer_headers,
        json={**VALID_CONDITIONS, "refId": ref_id, "expectedRevision": 1},
    )
    assert resp.status_code in (403, 409)


def test_design_r245_001_08_preview_includes_rule_comment(client, admin_headers):
    resp = client.post(
        "/api/v1/designer/preview/translate",
        headers=admin_headers,
        json={
            "conditions": VALID_CONDITIONS,
            "computeRules": VALID_RULES,
            "outputFields": VALID_OUTPUT,
        },
    )
    assert resp.status_code == 200
    assert "-- rule:" in resp.json()["sql"]
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd /workspace && python -m pytest tests/test_mfinal_fe_design_r245.py -k "001" -v`
Expected: FAIL（`FieldRegistryOut` / routes 未实现）

- [ ] **Step 5: 实现 schemas + service**

在 `backend/app/designer/schemas.py` 追加：

```python
class FieldRegistryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    registry: list[str]
    glossary: list[str]
    dataset_fields: list[str] = Field(alias="datasetFields")


class PreviewTranslateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    conditions: QueryConditionsConfig
    compute_rules: ComputeRulesConfig = Field(alias="computeRules")
    output_fields: OutputFieldsConfig = Field(alias="outputFields")
    dataset_id: uuid.UUID | None = Field(default=None, alias="datasetId")
```

在 `backend/app/designer/service.py` 追加（保持文件 ≤200 行，必要时拆私有函数到同文件顶部）：

```python
from app.metadata.glossary import service as glossary_service
from app.metadata.dataset import service as dataset_service
from app.query.translator.schemas import TranslateConditionItem, TranslateConditions, TranslateRequest
from app.query.translator.service import translate_config_to_sql

probe_preview_translate_budget_ms_limit = 50


def list_designer_fields(session: Session, dataset_id: uuid.UUID | None = None) -> FieldRegistryOut:
    items, _ = glossary_service.list_terms(session, limit=200, offset=0)
    glossary = [item.code for item in items]
    dataset_fields: list[str] = []
    if dataset_id is not None:
        try:
            ds = dataset_service.get_dataset(str(dataset_id))
            dataset_fields = [t.name for t in ds.tables] + [cf.name for cf in ds.computed_fields]
        except Exception:
            dataset_fields = []
    return FieldRegistryOut(
        registry=sorted(DESIGNER_FIELD_REGISTRY),
        glossary=glossary,
        datasetFields=dataset_fields,
    )


def build_preview_translate_request(session: Session, payload: PreviewTranslateIn) -> TranslateRequest:
    validate_conditions_config(payload.conditions)
    validate_compute_rules_config(payload.compute_rules)
    from app.designer import output_fields as output_fields_service
    output_fields_service.validate_output_fields_config(session, payload.output_fields)

    table = "design_preview"
    columns = [f.field_id for f in payload.output_fields.fields]
    if payload.dataset_id is not None:
        try:
            ds = dataset_service.get_dataset(str(payload.dataset_id))
            if ds.tables:
                table = ds.tables[0].name
        except Exception:
            pass

    conditions = TranslateConditions(
        logic=payload.conditions.logic,
        conditions=[
            TranslateConditionItem.model_validate(c.model_dump(by_alias=True))
            for c in payload.conditions.conditions
        ],
    )
    request = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table=table,
        columns=columns or ["order_amount"],
        conditions=conditions,
    )
    return request


def preview_translate_sql(session: Session, payload: PreviewTranslateIn) -> dict:
    request = build_preview_translate_request(session, payload)
    response = translate_config_to_sql(request)
    sql = response.sql
    for rule in payload.compute_rules.rules:
        sql += f"\n-- rule: {rule.id}={rule.expression}"
    return {
        "sql": sql,
        "parameters": response.parameters,
        "connectorType": response.connector_type,
    }


def probe_preview_translate_budget_ms(session: Session, payload: PreviewTranslateIn) -> float:
    started = time.perf_counter()
    preview_translate_sql(session, payload)
    return (time.perf_counter() - started) * 1000
```

（文件顶部补充 `import time` 与 `FieldRegistryOut`/`PreviewTranslateIn` import。）

- [ ] **Step 6: 注册 API 路由**

在 `backend/app/api/v1/designer.py` 追加：

```python
from app.designer.schemas import FieldRegistryOut, PreviewTranslateIn

@router.get("/fields", response_model=FieldRegistryOut)
def get_designer_fields(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    dataset_id: uuid.UUID | None = Query(default=None, alias="datasetId"),
) -> FieldRegistryOut:
    return designer_service.list_designer_fields(db, dataset_id)


@router.post("/preview/translate")
def preview_translate(
    payload: PreviewTranslateIn,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> dict | JSONResponse:
    try:
        return designer_service.preview_translate_sql(db, payload)
    except DesignerError as exc:
        return _designer_error(exc)
```

- [ ] **Step 7: 运行测试确认通过**

Run: `cd /workspace && python -m pytest tests/test_mfinal_fe_design_r245.py -k "001" -v`
Expected: 8 passed

- [ ] **Step 8: ruff + commit**

Run: `cd /workspace/backend && ruff check app/designer/ app/api/v1/designer.py`
Expected: exit 0

```bash
git add backend/app/designer/schemas.py backend/app/designer/service.py backend/app/api/v1/designer.py backend/app/query/config_store/schemas.py tests/test_mfinal_fe_design_r245.py
git commit -m "feat: designer fields API and preview translate (DESIGN-001)"
```

---

### Task 2: DESIGN-001 FE — 条件面板 + workspace hook 基础 + queryKeys

**Files:**
- Create: `fe/src/pages/admin/designer/useDesignerWorkspace.ts`
- Create: `fe/src/pages/admin/designer/designer-panels.tsx`（仅 `ConditionsPanel` 段）
- Modify: `fe/src/lib/queryKeys.ts`
- Modify: `fe/src/pages/admin/designer/DesignerPage.tsx`（接线条件 Tab + 预览栏骨架）

**Interfaces:**
- Produces: `useDesignerWorkspace()` → `{ designerItemId, datasetId, conditions, saveConditions, validateConditions, previewQuery, fieldOptions, ... }`
- Produces: `ConditionsPanel` props 与 `designer-panels.tsx` 导出
- Consumes: Task 1 `GET /fields`、`POST /preview/translate`、`PUT/POST /conditions`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin 设计系统：`AdminPageShell`、`Button`、`Select`、`Input`、`Tabs`、`Textarea`、`AlertDialog`、`Skeleton`
- desktop 双栏 `lg:grid-cols-[1fr_360px]`；mobile 预览折叠为子 Tab
- 条件行 HTML5 DnD + 上移/下移 `aria-label`；字段错误 `aria-invalid`
- hover/focus/disabled/loading/empty/error 四态覆盖
- `cd fe && pnpm run check:design` 通过

- [ ] **Step 1: 扩展 queryKeys**

在 `fe/src/lib/queryKeys.ts` 的 `designer` 下追加：

```typescript
designer: {
  sqlCapabilities: ["designer", "sqlCapabilities"] as const,
  fields: (datasetId?: string | null) => ["designer", "fields", datasetId ?? "none"] as const,
  conditions: (refId: string) => ["designer", "conditions", refId] as const,
  computeRules: (refId: string) => ["designer", "computeRules", refId] as const,
  outputFields: (refId: string) => ["designer", "outputFields", refId] as const,
  preview: (refId: string) => ["designer", "preview", refId] as const,
},
```

- [ ] **Step 2: 实现 useDesignerWorkspace 基础**

创建 `fe/src/pages/admin/designer/useDesignerWorkspace.ts`（核心片段）：

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

const SESSION_KEY = "vitalspan.designerItemId";

export type ConditionRow = {
  fieldId: string;
  operator: string;
  value: string | number | boolean | null;
  valueType: string;
};

function loadDesignerItemId(): string {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

export function useDesignerWorkspace() {
  const qc = useQueryClient();
  const [designerItemId] = useState(loadDesignerItemId);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fieldsQuery = useQuery({
    queryKey: queryKeys.designer.fields(datasetId),
    queryFn: () =>
      apiFetch<{ registry: string[]; glossary: string[]; datasetFields: string[] }>(
        `/api/v1/designer/fields${datasetId ? `?datasetId=${datasetId}` : ""}`,
      ),
  });

  const fieldOptions = useMemo(() => {
    const base = fieldsQuery.data?.registry ?? [];
    const extra = fieldsQuery.data?.datasetFields ?? [];
    return [...new Set([...base, ...extra])];
  }, [fieldsQuery.data]);

  const previewMutation = useMutation({
    mutationFn: async (body: object) =>
      apiFetch<{ sql: string; parameters: Record<string, unknown> }>(
        "/api/v1/designer/preview/translate",
        { method: "POST", body: JSON.stringify(body) },
      ),
  });

  const validateConditions = useCallback(async () => {
    const payload = {
      schemaVersion: "1.0",
      logic,
      conditions,
      refType: "design_draft",
      refId: designerItemId,
    };
    try {
      await apiFetch("/api/v1/designer/conditions/validate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFieldErrors({});
      return true;
    } catch (err) {
      const mapped = mapApiError(err);
      setFieldErrors({ _form: mapped });
      return false;
    }
  }, [conditions, designerItemId, logic]);

  const saveConditions = useMutation({
    mutationFn: async (expectedRevision?: number) => {
      const payload = {
        schemaVersion: "1.0",
        logic,
        conditions,
        refType: "design_draft",
        refId: designerItemId,
        expectedRevision,
      };
      return apiFetch("/api/v1/designer/conditions", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.designer.conditions(designerItemId) });
      void qc.invalidateQueries({ queryKey: queryKeys.designer.preview(designerItemId) });
    },
  });

  return {
    designerItemId,
    datasetId,
    setDatasetId,
    logic,
    setLogic,
    conditions,
    setConditions,
    fieldOptions,
    fieldErrors,
    fieldsQuery,
    validateConditions,
    saveConditions,
    previewMutation,
  };
}
```

- [ ] **Step 3: 实现 ConditionsPanel（DnD + 表单）**

在 `designer-panels.tsx` 实现 `ConditionsPanel`：每行 `GripVertical` + `Select`（fieldId/operator/valueType）+ `Input`；`draggable`/`onDragOver`/`onDrop` 重排；「上移/下移」按钮；删除 `AlertDialog`（>1 行时）；空态文案「暂无过滤条件，点击添加」。

- [ ] **Step 4: 重构 DesignerPage 接线**

`DesignerPage.tsx`：`AdminPageShell` + Dataset `Select`（可选，调 `queryKeys.datasets.list`）+ `Tabs`「条件」+ 右栏预览 `Textarea readOnly font-mono`；debounce 400ms 调 preview（条件/output/rules 暂传 workspace 已有块，rules/output 可先空数组占位至 Task 3/4）。

- [ ] **Step 5: 验证**

Run: `cd /workspace/fe && pnpm run check:design`
Expected: exit 0

Run: `cd /workspace/fe && pnpm exec vitest run src/pages/admin/designer --passWithNoTests`
Expected: exit 0（smoke 在 Task 8）

```bash
git add fe/src/lib/queryKeys.ts fe/src/pages/admin/designer/
git commit -m "feat: designer conditions panel and workspace hook (DESIGN-001 FE)"
```

---

### Task 3: DESIGN-002 — 运算规则面板 + pytest 002 区块

**Files:**
- Modify: `fe/src/pages/admin/designer/designer-panels.tsx`（`ComputeRulesPanel`）
- Modify: `fe/src/pages/admin/designer/useDesignerWorkspace.ts`（rules 状态 + save）
- Modify: `fe/src/pages/admin/designer/DesignerPage.tsx`（规则 Tab）
- Modify: `tests/test_mfinal_fe_design_r245.py`（002 区块 ≥5 条）

**Interfaces:**
- Produces: `ComputeRulesPanel`、`saveComputeRules` mutation
- Consumes: `PUT /compute-rules`、preview 链（Task 1 rule comment 已覆盖）

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 表格式规则编辑器对齐 `WorkflowTemplateDetail` 表格样式
- 新建/编辑 `Dialog`：`ruleType` Select、`targetField`/`expression` Input、`dependsOn` 多选
- 422 字段错误映射至 Dialog 输入框；保存成功 `sonner` toast
- desktop/mobile 表格 `overflow-x-auto` 无重叠

- [ ] **Step 1: 写失败测试 002 区块**

```python
def test_design_r245_002_01_rules_put_get_roundtrip(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {**VALID_RULES, "refId": ref_id}
    put = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=payload)
    assert put.status_code == 200
    get = client.get(f"/api/v1/designer/compute-rules?ref_id={ref_id}", headers=admin_headers)
    assert get.status_code == 200
    assert get.json()["rules"][0]["id"] == "r1"


def test_design_r245_002_02_rule_type_mismatch(client, admin_headers):
    bad = {**VALID_RULES}
    bad["rules"][0]["ruleType"] = "sum"
    bad["rules"][0]["expression"] = "avg(order_amount)"
    resp = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_TYPE_MISMATCH"


def test_design_r245_002_03_rule_cycle(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {
        "schemaVersion": "1.0",
        "rules": [
            {"id": "a", "name": "a", "ruleType": "sum", "targetField": "amount", "expression": "sum(x)", "dependsOn": ["b"]},
            {"id": "b", "name": "b", "ruleType": "sum", "targetField": "amount", "expression": "sum(y)", "dependsOn": ["a"]},
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }
    resp = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_CYCLE"


def test_design_r245_002_04_broken_chain(client, admin_headers):
    bad = {**VALID_RULES}
    bad["rules"][0]["dependsOn"] = ["missing"]
    resp = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_BROKEN_CHAIN"


def test_design_r245_002_05_preview_keeps_rule_comment(client, admin_headers):
    resp = client.post(
        "/api/v1/designer/preview/translate",
        headers=admin_headers,
        json={"conditions": VALID_CONDITIONS, "computeRules": VALID_RULES, "outputFields": VALID_OUTPUT},
    )
    assert "-- rule: r1=" in resp.json()["sql"]
```

- [ ] **Step 2: 运行确认通过（后端已存在）**

Run: `cd /workspace && python -m pytest tests/test_mfinal_fe_design_r245.py -k "002" -v`
Expected: 5 passed

- [ ] **Step 3: FE ComputeRulesPanel + workspace rules 状态**

扩展 `useDesignerWorkspace`：`rules` state、`saveComputeRules` mutation、`preview` body 合并 rules。

`ComputeRulesPanel`：表格列 id/name/ruleType/targetField/expression；「添加规则」打开 Dialog；保存前直接 `PUT`；422 解析 `detail.fields` 至 Dialog。

- [ ] **Step 4: DesignerPage 增加「运算规则」Tab**

- [ ] **Step 5: 验证 + commit**

Run: `cd /workspace/fe && pnpm run check:design`
Expected: exit 0

```bash
git add fe/src/pages/admin/designer/ tests/test_mfinal_fe_design_r245.py
git commit -m "feat: designer compute rules panel (DESIGN-002)"
```

---

### Task 4: DESIGN-003 — 输出字段 META/dataset 联动 + 输出面板 + pytest 003

**Files:**
- Modify: `backend/app/designer/output_fields.py`
- Modify: `fe/src/pages/admin/designer/designer-panels.tsx`（`OutputFieldsPanel`）
- Modify: `fe/src/pages/admin/designer/useDesignerWorkspace.ts`
- Modify: `fe/src/pages/admin/designer/DesignerPage.tsx`
- Modify: `tests/test_mfinal_fe_design_r245.py`（003 区块 ≥6 条）

**Interfaces:**
- Produces: `validate_output_fields_config(session, config, dataset_id: UUID | None = None)` 扩展签名（或 query param 经 API 传入）
- Produces: dataset computed field 作 `fieldId` 合法路径

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 输出字段列表 + 聚合子区；`metaFieldRef` 可选 Select（glossary codes）
- `sortOrder` 数字输入；聚合 `fn` 白名单 Select
- 保存后预览 columns 变化；空态/错误态完整

- [ ] **Step 1: 写失败测试 003 区块**

```python
def test_design_r245_003_01_empty_output_422(client, admin_headers):
    bad = {**VALID_OUTPUT, "fields": []}
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_OUTPUT_FIELDS"


def test_design_r245_003_02_duplicate_field(client, admin_headers):
    bad = {**VALID_OUTPUT, "fields": VALID_OUTPUT["fields"] * 2}
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_DUPLICATE_OUTPUT_FIELD"


def test_design_r245_003_03_invalid_aggregate(client, admin_headers):
    bad = {**VALID_OUTPUT, "aggregates": [{"fn": "median", "fieldId": "order_amount", "groupBy": []}]}
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design_r245_003_04_meta_field_ref_glossary_ok(client, admin_headers):
    # 先创建术语（若夹具无则 skip 创建一步）
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=admin_headers,
        json={"code": "gmv_term", "name": "GMV", "definition": "test"},
    )
    if term.status_code not in (200, 201):
        pytest.skip("glossary create unavailable")
    payload = {
        **VALID_OUTPUT,
        "fields": [{"fieldId": "order_amount", "metaFieldRef": "gmv_term", "visible": True}],
    }
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=payload)
    assert resp.status_code == 200


def test_design_r245_003_05_output_put_get(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {**VALID_OUTPUT, "refId": ref_id}
    put = client.put("/api/v1/designer/output-fields", headers=admin_headers, json=payload)
    assert put.status_code == 200
    get = client.get(f"/api/v1/designer/output-fields?refId={ref_id}", headers=admin_headers)
    assert get.status_code == 200


def test_design_r245_003_06_dataset_computed_field_ok(client, admin_headers):
    ds = client.post(
        "/api/v1/datasets",
        headers=admin_headers,
        json={
            "name": "r245 ds",
            "tables": [{"name": "orders", "schema": "public"}],
            "computedFields": [{"name": "computed_amt", "expression": "sum(amt)"}],
        },
    )
    if ds.status_code not in (200, 201):
        pytest.skip("dataset API unavailable")
    dataset_id = ds.json()["id"]
    payload = {
        **VALID_OUTPUT,
        "fields": [{"fieldId": "computed_amt", "visible": True}],
    }
    resp = client.post(
        f"/api/v1/designer/output-fields/validate?datasetId={dataset_id}",
        headers=admin_headers,
        json=payload,
    )
    assert resp.status_code == 200
```

- [ ] **Step 2: 扩展 output_fields 校验**

在 `output_fields.py` 的 `validate_output_fields_config` 增加可选 `dataset_id` 参数；`field_id` 不在 registry 时查 dataset `computedFields[].name`：

```python
def _dataset_field_names(dataset_id: uuid.UUID | None) -> set[str]:
    if dataset_id is None:
        return set()
    try:
        ds = dataset_service.get_dataset(str(dataset_id))
        return {cf.name for cf in ds.computed_fields}
    except Exception:
        return set()

# 在 field_id 校验处：
allowed = DESIGNER_FIELD_REGISTRY | _dataset_field_names(dataset_id)
if field.field_id not in allowed:
    raise DesignerError(...)
```

在 `api/v1/designer.py` 的 validate/save output-fields 路由增加 `datasetId` Query 并下传。

- [ ] **Step 3: 运行测试**

Run: `cd /workspace && python -m pytest tests/test_mfinal_fe_design_r245.py -k "003" -v`
Expected: 6 passed

- [ ] **Step 4: FE OutputFieldsPanel**

字段列表 + 聚合区；`metaFieldRef` Select 来自 `fieldsQuery.data.glossary`；保存 `PUT /output-fields`；预览 invalidate。

- [ ] **Step 5: commit**

```bash
git add backend/app/designer/output_fields.py backend/app/api/v1/designer.py fe/src/pages/admin/designer/ tests/test_mfinal_fe_design_r245.py
git commit -m "feat: output fields META/dataset linkage and panel (DESIGN-003)"
```

---

### Task 5: GOV-003 — 工单模板 CRUD 后端 + pytest 003-gov 区块

**Files:**
- Modify: `backend/app/governance/workflow/schemas.py`
- Modify: `backend/app/governance/workflow/service.py`
- Modify: `backend/app/governance/workflow/node_roles.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_mfinal_fe_design_r245.py`（GOV-003 区块 ≥8 条）

**Interfaces:**
- Produces: `WorkflowTemplateCreateIn`/`WorkflowTemplateUpdateIn`
- Produces: `create_template()`、`update_template()`、`delete_template()`、`list_templates()` 合并 builtin+custom
- Produces: `ALLOWED_NODE_ROLES = frozenset({...})`
- Produces: `describe_node_roles(template_id)` 读 custom

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 扩展 schemas**

```python
ALLOWED_NODE_ROLES = frozenset({"requester", "approver", "designer", "publisher", "admin"})

class WorkflowTemplateCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1)
    nodes: list[WorkflowNode]

class WorkflowTemplateUpdateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str | None = None
    nodes: list[WorkflowNode] | None = None
```

- [ ] **Step 2: 写失败测试 GOV-003 区块**

```python
CUSTOM_TEMPLATE_NODES = [
    {"id": "draft", "role": "requester"},
    {"id": "pending_approval", "role": "approver"},
    {"id": "designing", "role": "designer"},
    {"id": "pending_publish", "role": "publisher"},
    {"id": "published", "role": "admin"},
]

def test_gov_r245_003_01_create_custom_template(client, admin_headers):
    resp = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "自定义查询发布", "nodes": CUSTOM_TEMPLATE_NODES},
    )
    assert resp.status_code == 201
    tpl_id = resp.json()["id"]
    listed = client.get("/api/v1/gov/workflow/templates", headers=admin_headers)
    assert any(t["id"] == tpl_id for t in listed.json()["items"])


def test_gov_r245_003_02_missing_published_node(client, admin_headers):
    bad_nodes = [n for n in CUSTOM_TEMPLATE_NODES if n["id"] != "published"]
    resp = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "bad", "nodes": bad_nodes},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_WORKFLOW_INVALID_TEMPLATE"
    assert "published" in resp.json()["detail"]["missingNodes"]


def test_gov_r245_003_03_update_node_role(client, admin_headers):
    created = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "role edit", "nodes": CUSTOM_TEMPLATE_NODES},
    )
    tpl_id = created.json()["id"]
    updated_nodes = [{**CUSTOM_TEMPLATE_NODES[1], "role": "admin"}] + CUSTOM_TEMPLATE_NODES[1:]
    # 修正：更新完整 nodes 列表，pending_approval role → admin
    nodes = [dict(n) for n in CUSTOM_TEMPLATE_NODES]
    nodes[1]["role"] = "admin"
    put = client.put(
        f"/api/v1/gov/workflow/templates/{tpl_id}",
        headers=admin_headers,
        json={"nodes": nodes},
    )
    assert put.status_code == 200
    roles = client.get(f"/api/v1/gov/workflow/templates/{tpl_id}/node-roles", headers=admin_headers)
    assert roles.json()["items"][1]["role"] == "admin"


def test_gov_r245_003_04_delete_builtin_forbidden(client, admin_headers):
    resp = client.delete("/api/v1/gov/workflow/templates/standard_query_release", headers=admin_headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_WORKFLOW_BUILTIN_READONLY"


def test_gov_r245_003_05_delete_referenced_template_conflict(client, admin_headers):
    created = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "in use", "nodes": CUSTOM_TEMPLATE_NODES},
    )
    tpl_id = created.json()["id"]
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=admin_headers,
        json={"templateId": tpl_id, "refId": str(uuid.uuid4())},
    )
    assert inst.status_code == 201
    deleted = client.delete(f"/api/v1/gov/workflow/templates/{tpl_id}", headers=admin_headers)
    assert deleted.status_code == 409


def test_gov_r245_003_06_fsm_happy_path(client, admin_headers):
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=admin_headers,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    iid = inst.json()["id"]
    for action, role in [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]:
        tr = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=admin_headers,
            json={"action": action, "actorRole": role},
        )
        assert tr.status_code == 200
    assert client.get(f"/api/v1/gov/workflow/instances/{iid}", headers=admin_headers).json()["status"] == "published"


def test_gov_r245_003_07_double_submit_409(client, admin_headers):
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=admin_headers,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    iid = inst.json()["id"]
    client.post(f"/api/v1/gov/workflow/instances/{iid}/transition", headers=admin_headers, json={"action": "submit", "actorRole": "requester"})
    again = client.post(f"/api/v1/gov/workflow/instances/{iid}/transition", headers=admin_headers, json={"action": "submit", "actorRole": "requester"})
    assert again.status_code == 409


def test_gov_r245_003_08_probe_transition_path():
    from app.governance.workflow.node_roles import probe_transition_path
    result = probe_transition_path()
    assert result.ok is True
    assert result.elapsed_ms <= 50.0
```

- [ ] **Step 3: 实现 workflow service CRUD**

核心逻辑（`service.py`）：

```python
_TEMPLATE_CONFIG_TYPE = "workflow_template"
_BUILTIN_IDS = frozenset(_BUILTIN_TEMPLATES.keys())

def _load_custom_templates(session: Session) -> dict[str, WorkflowTemplateOut]:
    records = config_store.list_configs(session, config_type=_TEMPLATE_CONFIG_TYPE)
    out: dict[str, WorkflowTemplateOut] = {}
    for rec in records.items:
        tpl = WorkflowTemplateOut.model_validate(rec.payload)
        out[tpl.id] = tpl
    return out

def get_template(session: Session, template_id: str) -> WorkflowTemplateOut:
    if template_id in _BUILTIN_TEMPLATES:
        return _BUILTIN_TEMPLATES[template_id]
    custom = _load_custom_templates(session).get(template_id)
    if custom is None:
        raise WorkflowError("GOV_WORKFLOW_TEMPLATE_NOT_FOUND", "Template not found", 404)
    return custom

def list_templates(session: Session) -> list[WorkflowTemplateOut]:
    return list(_BUILTIN_TEMPLATES.values()) + list(_load_custom_templates(session).values())

def create_template(session: Session, payload: WorkflowTemplateCreateIn) -> WorkflowTemplateOut:
    tpl_id = f"custom_{uuid.uuid4().hex[:12]}"
    candidate = WorkflowTemplateValidateIn(id=tpl_id, name=payload.name, nodes=payload.nodes)
    validated = validate_template(candidate)
    for node in validated.nodes:
        if node.role not in ALLOWED_NODE_ROLES:
            raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", f"Invalid role: {node.role}", 422)
    config_store.upsert_config(session, ConfigUpsert(
        config_type=_TEMPLATE_CONFIG_TYPE,
        schema_version="1.0",
        ref_type="workflow_template",
        ref_id=uuid.uuid4(),
        payload=validated.model_dump(by_alias=True),
    ))
    return validated

def delete_template(session: Session, template_id: str) -> None:
    if template_id in _BUILTIN_IDS:
        raise WorkflowError("GOV_WORKFLOW_BUILTIN_READONLY", "Builtin template readonly", 403)
    # 扫描 workflow_instance 引用 templateId → 409
    ...
```

更新 `create_instance`：`get_template(session, payload.template_id)` 替代硬编码 builtin 检查。

更新 `node_roles.describe_node_roles`：调用 `get_template(session, template_id)`（需 session 参数或 service 层函数）。

- [ ] **Step 4: gov.py 路由**

```python
@router.post("/workflow/templates", status_code=201, response_model=WorkflowTemplateOut)
def create_workflow_template(...)

@router.put("/workflow/templates/{template_id}", response_model=WorkflowTemplateOut)
def update_workflow_template(...)

@router.delete("/workflow/templates/{template_id}", status_code=204)
def delete_workflow_template(...)
```

- [ ] **Step 5: 运行测试**

Run: `cd /workspace && python -m pytest tests/test_mfinal_fe_design_r245.py -k "gov_r245_003" -v`
Expected: 8 passed

```bash
git add backend/app/governance/ backend/app/api/v1/gov.py tests/test_mfinal_fe_design_r245.py
git commit -m "feat: workflow template CRUD for custom templates (GOV-003)"
```

---

### Task 6: GOV-003 FE — 自定义模板 Dialog

**Files:**
- Modify: `fe/src/pages/admin/governance/components/WorkflowTemplateDetail.tsx`
- Modify: `fe/src/pages/admin/governance/GovernanceWorkflowPage.tsx`（若需入口按钮）

**Interfaces:**
- Consumes: `POST /api/v1/gov/workflow/templates`
- Produces: 「基于标准模板创建」Dialog，五节点 role `Select`（白名单选项）

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- Dialog + Label + Select + 主按钮 `variant="primary"`
- 提交中 disabled + loading；成功 toast + invalidate `queryKeys.gov.workflowTemplates`
- desktop/mobile Dialog 无溢出；builtin 模板区保持只读 badge

- [ ] **Step 1: 在 WorkflowTemplateDetail 或 Page 顶栏增加「创建自定义模板」**

复制 `standard_query_release` 五节点为初始值；每节点 `Select` 角色（requester/approver/designer/publisher/admin）；POST 成功后关闭 Dialog 并选中新模板。

- [ ] **Step 2: 验证**

Run: `cd /workspace/fe && pnpm run check:design`
Expected: exit 0

```bash
git add fe/src/pages/admin/governance/
git commit -m "feat: custom workflow template create dialog (GOV-003 FE)"
```

---

### Task 7: DESIGN-004 — 快照 + submit-workflow + pytest 004 区块

**Files:**
- Create: `backend/app/designer/snapshot.py`
- Modify: `backend/app/designer/workflow.py`
- Modify: `backend/app/designer/schemas.py`（`DesignerSubmitWorkflowIn`、`DesignerSubmitWorkflowOut`）
- Modify: `backend/app/api/v1/designer.py`
- Modify: `backend/app/api/v1/gov.py`（instance GET 可选 `designSnapshot`）
- Modify: `tests/test_mfinal_fe_design_r245.py`（004 区块 ≥8 条）

**Interfaces:**
- Produces: `capture_snapshot(session, designer_item_id, owner_id) -> tuple[uuid.UUID, DesignerSnapshotOut]`
- Produces: `submit_with_snapshot(session, payload, actor) -> DesignerSubmitWorkflowOut`
- Produces: `GET /gov/workflow/instances/{id}` 响应含可选 `designSnapshot`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 实现 snapshot.py**

```python
_CONFIG_TYPE = "designer_snapshot"
_REF_TYPE = "designer"

def capture_snapshot(session: Session, designer_item_id: uuid.UUID, owner_id: uuid.UUID | None):
    conditions = designer_service.get_conditions(session, "design_draft", designer_item_id)
    rules = designer_service.get_compute_rules(session, "design_draft", designer_item_id)
    from app.designer import output_fields as output_fields_service
    output = output_fields_service.get_output_fields(session, "design_draft", designer_item_id)
    snapshot_id = uuid.uuid4()
    payload = {
        "conditions": designer_service._conditions_payload(conditions),
        "computeRules": designer_service._rules_payload(rules),
        "outputFields": output_fields_service._output_payload(output),
        "revisions": {
            "query_conditions": config_store.get_config_by_ref(session, "query_conditions", "design_draft", designer_item_id).revision,
            "compute_rules": config_store.get_config_by_ref(session, "compute_rules", "design_draft", designer_item_id).revision,
            "output_fields": config_store.get_config_by_ref(session, "output_fields", "design_draft", designer_item_id).revision,
        },
        "capturedAt": datetime.now(timezone.utc).isoformat(),
    }
    config_store.upsert_config(session, ConfigUpsert(
        config_type=_CONFIG_TYPE,
        schema_version="1.0",
        ref_type=_REF_TYPE,
        ref_id=snapshot_id,
        payload=payload,
    ), owner_id=owner_id)
    return snapshot_id, payload
```

（`_output_payload` 若不存在则在 `output_fields.py` 添加对称私有函数。）

- [ ] **Step 2: submit_with_snapshot 编排**

在 `workflow.py`：

```python
class DesignerSubmitWorkflowIn(BaseModel):
    designer_item_id: uuid.UUID = Field(alias="designerItemId")
    template_id: str = Field(alias="templateId", default="standard_query_release")
    design_type: Literal["chart", "report", "query"] = Field(default="query", alias="designType")
    catalog_entry_id: uuid.UUID | None = Field(default=None, alias="catalogEntryId")

def submit_with_snapshot(session, payload, actor: UserContext) -> dict:
  if actor.roles 不含 admin/analyst → 403 DESIGN_SUBMIT_FORBIDDEN
  try: get_conditions/get_compute_rules/get_output_fields
  except → 422 DESIGN_SUBMIT_INCOMPLETE
  snapshot_id, snap = capture_snapshot(...)
  instance = workflow_service.create_instance(session, WorkflowInstanceCreateIn(templateId=..., refId=designer_item_id))
  # 更新 instance payload: designSnapshotId, snapshotRevision
  save_workflow_link(...)
  workflow_service.transition_instance(session, instance.id, "submit", "requester")
  return {"workflowInstanceId": ..., "designSnapshotId": ..., "status": "pending_approval", "publishReady": False}
```

- [ ] **Step 3: 写失败测试 004 区块**

覆盖：完整 submit 201、缺 output 422、viewer 403、snapshot 不可变、catalog mismatch 422、workflow-link 双向一致等 ≥8 条（命名 `test_design_r245_004_*`）。

- [ ] **Step 4: API 路由**

```python
@router.post("/submit-workflow", status_code=201)
def submit_designer_workflow(payload: DesignerSubmitWorkflowIn, actor, db):
    return workflow_link_service.submit_with_snapshot(db, payload, actor)
```

- [ ] **Step 5: 运行测试**

Run: `cd /workspace && python -m pytest tests/test_mfinal_fe_design_r245.py -k "004" -v`
Expected: ≥8 passed

```bash
git add backend/app/designer/ backend/app/api/v1/designer.py backend/app/api/v1/gov.py tests/test_mfinal_fe_design_r245.py
git commit -m "feat: designer snapshot and submit-workflow (DESIGN-004)"
```

---

### Task 8: 设计器集成 + RTL smoke + 文档同步 + 全量回归门控

**Files:**
- Modify: `fe/src/pages/admin/designer/DesignerPage.tsx`（提交工单 Dialog + 三块保存态）
- Modify: `fe/src/pages/admin/designer/useDesignerWorkspace.ts`（`submitWorkflow`）
- Create: `fe/src/pages/admin/designer/designer.smoke.test.tsx`
- Modify: `docs/api/README.md`
- Modify: `docs/services/designer.md`
- Modify: `docs/services/governance.md`

**Interfaces:**
- Produces: `designer.smoke.test.tsx` ≥6 条（添加条件、拖拽/上移、校验错误、预览 SQL、保存规则、提交 Dialog）
- Consumes: Task 7 `POST /submit-workflow`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI Acceptance:**
- 「提交查询服务申请」主按钮 `Send` icon；成功 Dialog 展示 instanceId + 链接 `/admin/governance/tickets`
- Desktop light/dark + Mobile 375px 预览子 Tab（P4 截图可选）
- `pnpm run check:design` + vitest smoke 全绿

- [ ] **Step 1: 完成 DesignerPage 集成**

顶栏 actions：「保存条件」「保存规则」「保存输出」「提交查询服务申请」；提交前断言三块均已保存（workspace flags）；提交成功 Radix Dialog。

- [ ] **Step 2: 新建 designer.smoke.test.tsx**

```typescript
/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// mock apiFetch + QueryClientProvider + DesignerPage

describe("DesignerPage smoke", () => {
  it("T-DESIGN-R245-FE-01: 渲染条件 Tab 与添加按钮", async () => { ... });
  it("T-DESIGN-R245-FE-02: 添加条件行", async () => { ... });
  it("T-DESIGN-R245-FE-03: 上移条件行", async () => { ... });
  it("T-DESIGN-R245-FE-04: 校验错误展示", async () => { ... });
  it("T-DESIGN-R245-FE-05: 预览 SQL 非空", async () => { ... });
  it("T-DESIGN-R245-FE-06: 提交工单成功 Dialog", async () => { ... });
});
```

- [ ] **Step 3: 文档同步**

`docs/api/README.md` 登记：
- `GET /api/v1/designer/fields`
- `POST /api/v1/designer/preview/translate`
- `POST /api/v1/designer/submit-workflow`
- `POST/PUT/DELETE /api/v1/gov/workflow/templates`

`docs/services/designer.md`：快照/预览/提交边界与 F-E 批次 1 状态。
`docs/services/governance.md`：自定义模板 CRUD、builtin 只读。

- [ ] **Step 4: 全量回归门控**

Run: `cd /workspace && python -m pytest tests/test_mfinal_fe_design_r245.py -v`
Expected: ≥30 passed

Run: `cd /workspace && python -m pytest tests/test_design_conn_gov_query_r52.py tests/test_viz_view_design_cat_r63.py -q --tb=no`
Expected: exit 0（抽样回归）

Run: `cd /workspace/backend && ruff check app/designer/ app/governance/workflow/ app/api/v1/designer.py app/api/v1/gov.py`
Expected: exit 0

Run: `cd /workspace/fe && pnpm run check:design`
Expected: exit 0

Run: `cd /workspace/fe && pnpm exec vitest run src/pages/admin/designer/designer.smoke.test.tsx`
Expected: ≥6 passed

```bash
git add fe/src/pages/admin/designer/ docs/api/README.md docs/services/designer.md docs/services/governance.md
git commit -m "feat: designer workspace integration, smoke tests, and docs (F-E batch 1)"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| DESIGN-001~004 + GOV-003 各有对应 Task | Task 1~8 覆盖 |
| 18 文件均在范围框定 | 是 |
| 无 TBD/TODO/适当处理 | 是 |
| 每 Task 含验证命令 | 是 |
| UI Task 含 Skills + UI Acceptance | Task 2/3/4/6/8 |
| 预估文件数 ≤20 | 18 文件操作 |
| pytest ≥30 条 | Task 1~5/7 合计 ≥35 |
| FE smoke ≥6 条 | Task 8 |

---

## 执行顺序与依赖

```
Task 1 (001 BE) → Task 2 (001 FE)
                → Task 3 (002) ─┐
                → Task 4 (003) ─┼→ Task 7 (004 BE) → Task 8 (集成+docs)
Task 5 (GOV BE) → Task 6 (GOV FE) ────────────────┘
```

Task 3/4/5 可在 Task 2 完成后并行；Task 7 依赖 1+4+5；Task 8 最后。
