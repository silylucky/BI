# M11 META + M12 query/design companion 质量推分 r33 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/metadata/glossary/`、`backend/app/metadata/themes/`、`backend/app/query/config_store/`、`backend/app/designer/`、`backend/app/api/v1/metadata.py`、`backend/app/api/v1/query_configs.py`、`backend/app/api/v1/designer.py`、`tests/test_meta_design_r33.py`、`docs/services/metadata.md`、`docs/services/query.md`、`docs/services/designer.md`、`docs/api/README.md`；`backend/migrations/versions/0015_meta_design_config.py` 只读回归
> **子项：** META-001, META-002, QUERY-007, DESIGN-001, DESIGN-002
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 闭合 r32 L1 遗留边界 — glossary 文本/status 守卫与 list perf、theme MAX_DEPTH=8 与宽树 perf、config_store 256KB 上限与 expectedRevision 乐观锁、designer 字段注册表/跨字段/规则链校验与 `detail.fields` 全覆盖；`test_meta_design_r33.py` 18 条 + r32 21/21 回归全绿。

**Architecture:** 在 r32 骨架上增量加固：Pydantic `max_length`/枚举 + service 层二次校验与结构化 `fields`；theme 深度用 `_node_depth`/`_subtree_height` 在 create/move 前拦截；config_store 用 `json.dumps` 字节计数与 revision 比对；designer 用模块级 `DESIGNER_FIELD_REGISTRY` frozenset 驱动条件/规则校验，save 前校验失败不写 store。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · pytest · ruff

## Global Constraints

- 纯后端质量推分；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构；不新增 migration（0015 只读回归）
- 不含 `fe/`、META-003~006、DESIGN-003~005、QUERY-008/009、locale 列、config 分片存储
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": {"fields": [...]}|null}`
- API 前缀 `/api/v1/`；鉴权 `Authorization: Bearer dev`
- 常量：`MAX_THEME_DEPTH=8`、`MAX_CONFIG_PAYLOAD_BYTES=262_144`、`TERM_MAX_TEXT_LENGTH=4000`
- 文件预算：新建 **1** + 修改 **16** = **17**（migration 0015 只读，不计修改）
- 验证基线：r32 `pytest` **708 passed** + 4 skipped；本轮目标 **≥726 passed** + 4 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: META-001 — glossary 文本边界、status 枚举与 list perf

**Files:**
- Modify: `backend/app/metadata/glossary/schemas.py`
- Modify: `backend/app/metadata/glossary/service.py`
- Create: `tests/test_meta_design_r33.py`（META-001 段 4 条；含 module fixture）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `GlossaryTerm`, `GlossaryError`, `TERM_CODE_RE`
- Produces: `TERM_MAX_TEXT_LENGTH`, `TERM_STATUS_VALUES`, `TermCreate`/`TermUpdate` strip+max_length 校验；`create_term`/`update_term` status 枚举守卫；`list_terms` capped limit 不变

- [ ] **Step 1: 写失败测试（META-001 段 4 条）**

在 `tests/test_meta_design_r33.py` 写入 fixture 与 META-001 段（复用 r32 `_R32_SQLITE_URL` 模式，独立 DB 名 `meta_design_r33`）：

```python
"""M11 META + M12 query/design companion 质量推分 r33 — META-001/002 + QUERY-007 + DESIGN-001/002."""
from __future__ import annotations

import os
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R33_SQLITE_URL = "sqlite+pysqlite:///file:meta_design_r33?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r33_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R33_SQLITE_URL
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


def test_meta_glossary_definition_too_long_r33(client):
    """T-META-R33-001-01: definition 4001 字符 → 422。"""
    payload = {"code": "long_def", "name": "长定义", "definition": "x" * 4001}
    resp = client.post("/api/v1/metadata/glossary", headers=AUTH, json=payload)
    assert resp.status_code == 422


def test_meta_glossary_blank_name_r33(client):
    """T-META-R33-001-02: name 仅空格 → 422 META_TERM_INVALID_NAME + detail.fields。"""
    resp = client.post(
        "/api/v1/metadata/glossary", headers=AUTH, json={"code": "blank_name", "name": "   "}
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "META_TERM_INVALID_NAME"
    assert body["detail"]["fields"][0]["field"] == "name"


def test_meta_glossary_list_pagination_offset_r33(client):
    """T-META-R33-001-03: limit=50 offset=100 分页正确。"""
    for i in range(120):
        client.post(
            "/api/v1/metadata/glossary",
            headers=AUTH,
            json={"code": f"page_g_{i:03d}", "name": f"术语{i}"},
        )
    resp = client.get(
        "/api/v1/metadata/glossary", headers=AUTH, params={"limit": 50, "offset": 100}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 20
    assert body["total"] >= 120


def test_meta_glossary_list_pagination_perf_r33(client):
    """T-META-R33-001-04: 120 术语 list limit=50 elapsed <0.5s。"""
    for i in range(120):
        client.post(
            "/api/v1/metadata/glossary",
            headers=AUTH,
            json={"code": f"perf_g_{i:03d}", "name": f"P{i}"},
        )
    start = time.perf_counter()
    resp = client.get(
        "/api/v1/metadata/glossary", headers=AUTH, params={"limit": 50, "offset": 0}
    )
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 50
    assert resp.json()["total"] >= 120
    assert elapsed < 0.5
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "glossary" -v`
Expected: FAIL（`META_TERM_INVALID_NAME` 未实现、definition 超长未拦截）

- [ ] **Step 3: 实现 glossary schemas + service**

`backend/app/metadata/glossary/schemas.py` 增补：

```python
TERM_MAX_TEXT_LENGTH = 4000
TERM_STATUS_VALUES = frozenset({"active", "inactive"})


def _strip_non_empty(v: str) -> str:
    stripped = v.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


class TermCreate(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=120)
    definition: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    description: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    status: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _strip_non_empty(v)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not TERM_CODE_RE.match(v):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in TERM_STATUS_VALUES:
            raise ValueError(f"status must be one of {sorted(TERM_STATUS_VALUES)}")
        return v


class TermUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    definition: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    description: str | None = Field(default=None, max_length=TERM_MAX_TEXT_LENGTH)
    status: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _strip_non_empty(v)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in TERM_STATUS_VALUES:
            raise ValueError(f"status must be one of {sorted(TERM_STATUS_VALUES)}")
        return v
```

`backend/app/metadata/glossary/service.py` 增补 `create_term`/`update_term`：

```python
def _validate_status(status: str | None) -> str:
    if status is not None and status not in TERM_STATUS_VALUES:
        raise GlossaryError(
            "META_TERM_INVALID_STATUS",
            "Invalid term status",
            422,
            fields=[{"field": "status", "message": f"Must be one of {sorted(TERM_STATUS_VALUES)}"}],
        )
    return status or "active"


def create_term(session: Session, payload: TermCreate) -> GlossaryTerm:
    status = _validate_status(payload.status)
    term = GlossaryTerm(
        code=payload.code,
        name=payload.name,
        definition=payload.definition,
        description=payload.description,
        status=status,
    )
    # ... 其余不变
```

`update_term` 在赋值后若 `payload.status is not None` 则 `term.status = _validate_status(payload.status)`。

`metadata.py` entry：在 `create_glossary_term` 捕获 Pydantic 422 之外，对 service 抛出的空白 name 需在 schema validator 已覆盖；若 FastAPI 返回通用 422 而非 `META_TERM_INVALID_NAME`，在 `TermCreate.validate_name` 改用 `model_validator` 抛 `GlossaryError` 不现实——保持 Pydantic 422 对超长 definition；空白 name 用自定义 validator 在 API 层包装：

在 `api/v1/metadata.py` `create_glossary_term` 增加对 `ValueError` 的捕获不必要；改为在 `TermCreate` 用：

```python
@field_validator("name")
@classmethod
def validate_name(cls, v: str) -> str:
    stripped = v.strip()
    if not stripped:
        raise ValueError("META_TERM_INVALID_NAME")
    return stripped
```

测试 `test_meta_glossary_blank_name_r33` 期望 `code==META_TERM_INVALID_NAME`——需在 API entry 将 Pydantic 422 映射为业务码，或在 service `create_term` 二次校验：

```python
def create_term(session: Session, payload: TermCreate) -> GlossaryTerm:
    if not payload.name.strip():
        raise GlossaryError(
            "META_TERM_INVALID_NAME",
            "Term name must not be blank",
            422,
            fields=[{"field": "name", "message": "must not be blank"}],
        )
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "glossary" -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/glossary/ tests/test_meta_design_r33.py
git commit -m "feat(meta): META-001 glossary text bounds, status enum, list perf smoke r33"
```

---

### Task 2: META-002 — theme MAX_DEPTH 守卫与宽树 list perf

**Files:**
- Modify: `backend/app/metadata/themes/schemas.py`
- Modify: `backend/app/metadata/themes/service.py`
- Modify: `tests/test_meta_design_r33.py`（META-002 段 3 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `ThemeNode`, `ThemeError`, `_collect_descendant_ids`
- Produces: `MAX_THEME_DEPTH=8`；`_node_depth(session, node_id) -> int`；`_subtree_height(session, node_id) -> int`；`create_theme_node`/`move_theme_node` 深度校验抛 `META_THEME_MAX_DEPTH`

- [ ] **Step 1: 写失败测试（META-002 段 3 条）**

追加到 `tests/test_meta_design_r33.py`：

```python
def test_meta_theme_max_depth_create_r33(client):
    """T-META-R33-002-01: 8 层深链 create 第 9 层 → 422 META_THEME_MAX_DEPTH。"""
    parent_id = None
    for depth in range(8):
        payload = {"name": f"L{depth}"}
        if parent_id:
            payload["parentId"] = parent_id
        resp = client.post("/api/v1/metadata/themes", headers=AUTH, json=payload)
        assert resp.status_code == 201
        parent_id = resp.json()["id"]
    too_deep = client.post(
        "/api/v1/metadata/themes", headers=AUTH, json={"name": "L9", "parentId": parent_id}
    )
    assert too_deep.status_code == 422
    assert too_deep.json()["code"] == "META_THEME_MAX_DEPTH"
    assert too_deep.json()["detail"]["fields"][0]["field"] == "parentId"


def test_meta_theme_move_within_depth_r33(client):
    """T-META-R33-002-02: move 子树到浅层使深度合法 → 200。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "R"}).json()
    deep_parent = root["id"]
    for i in range(6):
        node = client.post(
            "/api/v1/metadata/themes",
            headers=AUTH,
            json={"name": f"D{i}", "parentId": deep_parent},
        ).json()
        deep_parent = node["id"]
    leaf = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "Leaf", "parentId": deep_parent},
    ).json()
    move = client.post(
        f"/api/v1/metadata/themes/{leaf['id']}/move",
        headers=AUTH,
        json={"parentId": root["id"]},
    )
    assert move.status_code == 200


def test_meta_theme_list_children_perf_r33(client):
    """T-META-R33-002-03: 80 子节点 list elapsed <0.5s。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "PerfRoot"}).json()
    for i in range(80):
        client.post(
            "/api/v1/metadata/themes",
            headers=AUTH,
            json={"name": f"C{i}", "parentId": root["id"], "sortOrder": i},
        )
    start = time.perf_counter()
    resp = client.get(
        "/api/v1/metadata/themes",
        headers=AUTH,
        params={"parent_id": root["id"], "limit": 100},
    )
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 80
    assert elapsed < 0.5
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "theme" -v`
Expected: FAIL（第 9 层未拒绝）

- [ ] **Step 3: 实现 theme 深度守卫**

`backend/app/metadata/themes/schemas.py` 顶部：

```python
MAX_THEME_DEPTH = 8
```

`backend/app/metadata/themes/service.py`：

```python
from app.metadata.themes.schemas import MAX_THEME_DEPTH, ThemeCreate, ThemeError, ThemeUpdate


def _node_depth(session: Session, node_id: uuid.UUID | None) -> int:
    if node_id is None:
        return 0
    depth = 0
    current: uuid.UUID | None = node_id
    seen: set[uuid.UUID] = set()
    while current is not None:
        if current in seen:
            break
        seen.add(current)
        depth += 1
        if depth > MAX_THEME_DEPTH:
            break
        node = session.get(ThemeNode, current)
        if node is None:
            break
        current = node.parent_id
    return depth


def _subtree_height(session: Session, node_id: uuid.UUID) -> int:
    height = 1
    frontier = [node_id]
    while frontier:
        current = frontier.pop()
        children = list(session.scalars(select(ThemeNode.id).where(ThemeNode.parent_id == current)))
        if children:
            height = max(height, 1 + _subtree_height(session, children[0]) if len(children) == 1 else 0)
        for child_id in children:
            frontier.append(child_id)
    # BFS 层数计算
    max_h = 0
    level = [node_id]
    while level:
        max_h += 1
        if max_h > MAX_THEME_DEPTH:
            break
        next_level = []
        for nid in level:
            next_level.extend(
                session.scalars(select(ThemeNode.id).where(ThemeNode.parent_id == nid))
            )
        level = list(next_level)
    return max_h


def _assert_depth_allowed(session: Session, parent_id: uuid.UUID | None, subtree_root: uuid.UUID | None = None) -> None:
    parent_depth = _node_depth(session, parent_id)
    extra = _subtree_height(session, subtree_root) if subtree_root else 1
    if parent_depth + extra > MAX_THEME_DEPTH:
        raise ThemeError(
            "META_THEME_MAX_DEPTH",
            f"Theme tree depth cannot exceed {MAX_THEME_DEPTH}",
            422,
            fields=[{"field": "parentId", "message": f"max depth is {MAX_THEME_DEPTH}"}],
        )
```

`create_theme_node` 在插入前调用 `_assert_depth_allowed(session, payload.parent_id)`。

`move_theme_node` 在赋值前调用 `_assert_depth_allowed(session, parent_id, node_id)`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "theme" -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/metadata/themes/ tests/test_meta_design_r33.py
git commit -m "feat(meta): META-002 theme MAX_DEPTH=8 guard and list perf smoke r33"
```

---

### Task 3: QUERY-007 — config_store payload 上限与 expectedRevision 乐观锁

**Files:**
- Modify: `backend/app/query/config_store/schemas.py`
- Modify: `backend/app/query/config_store/service.py`
- Modify: `tests/test_meta_design_r33.py`（QUERY-007 段 3 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `QueryConfigRecord`, `ConfigError`, `ALLOWED_CONFIG_TYPES`
- Produces: `MAX_CONFIG_PAYLOAD_BYTES=262_144`；`ConfigUpsert.expected_revision: int | None`（alias `expectedRevision`）；`upsert_config` 超大 payload → 413 `CONFIG_PAYLOAD_TOO_LARGE`；revision 冲突 → 409 `CONFIG_VERSION_CONFLICT`

- [ ] **Step 1: 写失败测试（QUERY-007 段 3 条）**

追加到 `tests/test_meta_design_r33.py`：

```python
REF_ID = str(uuid.uuid4())


def _oversized_payload() -> dict:
    chunk = "x" * 1024
    return {"data": [chunk for _ in range(260)]}


def test_query_config_payload_too_large_r33(client):
    """T-QUERY-R33-007-01: payload >256KB → 413 CONFIG_PAYLOAD_TOO_LARGE。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": REF_ID,
        "payload": _oversized_payload(),
    }
    resp = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert resp.status_code == 413
    assert resp.json()["code"] == "CONFIG_PAYLOAD_TOO_LARGE"
    assert resp.json()["detail"]["fields"][0]["field"] == "payload"


def test_query_config_revision_conflict_r33(client):
    """T-QUERY-R33-007-02: expectedRevision 过期 → 409 CONFIG_VERSION_CONFLICT。"""
    body = {
        "configType": "query_conditions",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": str(uuid.uuid4()),
        "payload": {"logic": "AND", "conditions": []},
    }
    first = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert first.status_code == 200
    assert first.json()["revision"] == 1
    body["expectedRevision"] = 0
    conflict = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "CONFIG_VERSION_CONFLICT"


def test_query_config_large_roundtrip_perf_r33(client):
    """T-QUERY-R33-007-03: ~200KB payload PUT+GET elapsed <1.0s。"""
    ref = str(uuid.uuid4())
    payload = {"blob": "y" * 200_000}
    body = {
        "configType": "compute_rules",
        "schemaVersion": "1.0",
        "refType": "design_draft",
        "refId": ref,
        "payload": payload,
    }
    start = time.perf_counter()
    put = client.put("/api/v1/query/configs", headers=AUTH, json=body)
    got = client.get(f"/api/v1/query/configs/{put.json()['id']}", headers=AUTH)
    elapsed = time.perf_counter() - start
    assert put.status_code == 200
    assert got.status_code == 200
    assert got.json()["payload"]["blob"] == payload["blob"]
    assert elapsed < 1.0
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "query_config" -v`
Expected: FAIL

- [ ] **Step 3: 实现 config_store 守卫**

`backend/app/query/config_store/schemas.py`：

```python
MAX_CONFIG_PAYLOAD_BYTES = 262_144


class ConfigUpsert(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    config_type: str = Field(alias="configType")
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    ref_type: str | None = Field(default=DEFAULT_REF_TYPE, alias="refType")
    ref_id: uuid.UUID | None = Field(default=None, alias="refId")
    payload: Any
    expected_revision: int | None = Field(default=None, alias="expectedRevision")
```

`backend/app/query/config_store/service.py`：

```python
import json

from app.query.config_store.schemas import MAX_CONFIG_PAYLOAD_BYTES, ...


def _payload_byte_size(payload: object) -> int:
    return len(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def _validate_upsert(payload: ConfigUpsert) -> None:
    # ... 既有 type/schema/payload object 校验
    size = _payload_byte_size(payload.payload)
    if size > MAX_CONFIG_PAYLOAD_BYTES:
        raise ConfigError(
            "CONFIG_PAYLOAD_TOO_LARGE",
            f"Payload exceeds {MAX_CONFIG_PAYLOAD_BYTES} bytes",
            413,
            fields=[{"field": "payload", "message": f"size {size} exceeds limit"}],
        )


def upsert_config(session: Session, payload: ConfigUpsert, owner_id: uuid.UUID | None = None) -> QueryConfigRecord:
    _validate_upsert(payload)
    # ... select existing
    if existing is not None:
        if payload.expected_revision is not None and payload.expected_revision != existing.revision:
            raise ConfigError(
                "CONFIG_VERSION_CONFLICT",
                "Config revision conflict",
                409,
                fields=[
                    {
                        "field": "expectedRevision",
                        "message": f"expected {payload.expected_revision} but current is {existing.revision}",
                    }
                ],
            )
        existing.payload = payload.payload
        existing.revision += 1
        # ...
    else:
        if payload.expected_revision is not None and payload.expected_revision != 0:
            raise ConfigError(
                "CONFIG_VERSION_CONFLICT",
                "Config revision conflict",
                409,
                fields=[{"field": "expectedRevision", "message": "expected 0 for new config"}],
            )
        # create revision=1
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "query_config" -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/query/config_store/ tests/test_meta_design_r33.py
git commit -m "feat(query): QUERY-007 config payload limit and optimistic revision r33"
```

---

### Task 4: DESIGN-001 — 字段注册表、跨字段引用与 conditions fields 填充

**Files:**
- Modify: `backend/app/designer/schemas.py`
- Modify: `backend/app/designer/service.py`
- Modify: `tests/test_meta_design_r33.py`（DESIGN-001 段 4 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `ConditionItem`, `QueryConditionsConfig`, `DesignerError`, `ConfigUpsert`
- Produces: `DESIGNER_FIELD_REGISTRY` frozenset；`validate_conditions_config` 填充 `fields`；`QueryConditionsConfig.expected_revision` 可选字段；`save_conditions` 透传 `expectedRevision`

- [ ] **Step 1: 写失败测试（DESIGN-001 段 4 条）**

追加到 `tests/test_meta_design_r33.py`：

```python
def _valid_conditions(ref_id: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "logic": "AND",
        "conditions": [
            {"fieldId": "order_amount", "operator": "gte", "value": 100, "valueType": "number"}
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }


def test_design_unknown_field_r33(client):
    """T-DESIGN-R33-001-01: unknown fieldId → 422 DESIGN_UNKNOWN_FIELD + detail.fields。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["fieldId"] = "order_amt"
    resp = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"
    assert "conditions[0].fieldId" in resp.json()["detail"]["fields"][0]["field"]


def test_design_cross_field_self_ref_r33(client):
    """T-DESIGN-R33-001-02: 跨字段自引用 value → 422 DESIGN_INVALID_CROSS_FIELD。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["value"] = "order_amount"
    body["conditions"][0]["valueType"] = "string"
    resp = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_CROSS_FIELD"


def test_design_validate_returns_fields_r33(client):
    """T-DESIGN-R33-001-03: validate 端点返回 detail.fields。"""
    ref = str(uuid.uuid4())
    body = _valid_conditions(ref)
    body["conditions"][0]["fieldId"] = "bad_field"
    resp = client.post("/api/v1/designer/conditions/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["fields"]


def test_design_conditions_save_revision_conflict_r33(client):
    """T-DESIGN-R33-001-04: save 后 revision=1；带 expectedRevision=0 再 save → 409。"""
    ref = str(uuid.uuid4())
    first = client.put("/api/v1/designer/conditions", headers=AUTH, json=_valid_conditions(ref))
    assert first.status_code == 200
    body = _valid_conditions(ref)
    body["expectedRevision"] = 0
    conflict = client.put("/api/v1/designer/conditions", headers=AUTH, json=body)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "CONFIG_VERSION_CONFLICT"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "design_unknown or design_cross or design_validate or design_conditions_save" -v`
Expected: FAIL

- [ ] **Step 3: 实现 DESIGN-001 校验链**

`backend/app/designer/schemas.py`：

```python
DESIGNER_FIELD_REGISTRY = frozenset({
    "order_amount", "order_date", "customer_id", "status", "region_code",
})


class QueryConditionsConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    logic: str
    conditions: list[ConditionItem]
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
    expected_revision: int | None = Field(default=None, alias="expectedRevision")
```

`backend/app/designer/service.py` 重写 `validate_conditions_config`：

```python
from app.designer.schemas import DESIGNER_FIELD_REGISTRY, ...


def validate_conditions_config(config: QueryConditionsConfig) -> QueryConditionsConfig:
    if config.logic not in ALLOWED_LOGIC:
        raise DesignerError(
            "DESIGN_INVALID_LOGIC",
            f"Unknown logic: {config.logic}",
            422,
            fields=[{"field": "logic", "message": f"unknown logic {config.logic}"}],
        )
    if not config.conditions:
        raise DesignerError(
            "DESIGN_EMPTY_CONDITIONS",
            "At least one condition is required",
            422,
            fields=[{"field": "conditions", "message": "must not be empty"}],
        )
    field_ids = {c.field_id for c in config.conditions}
    for idx, item in enumerate(config.conditions):
        prefix = f"conditions[{idx}]"
        if item.field_id not in DESIGNER_FIELD_REGISTRY:
            raise DesignerError(
                "DESIGN_UNKNOWN_FIELD",
                "Unknown field in condition",
                422,
                fields=[{"field": f"{prefix}.fieldId", "message": f"{item.field_id} is not a registered field"}],
            )
        if item.operator not in ALLOWED_OPERATORS:
            raise DesignerError(
                "DESIGN_INVALID_OPERATOR",
                f"Unknown operator: {item.operator}",
                422,
                fields=[{"field": f"{prefix}.operator", "message": f"unknown operator {item.operator}"}],
            )
        try:
            _check_value_type(item)
        except DesignerError as exc:
            exc.fields = [{"field": f"{prefix}.value", "message": exc.message}]
            raise
        if isinstance(item.value, str) and item.value in field_ids and item.value != item.field_id:
            raise DesignerError(
                "DESIGN_INVALID_CROSS_FIELD",
                "Cross-field reference is not allowed",
                422,
                fields=[{"field": f"{prefix}.value", "message": "cannot reference another fieldId"}],
            )
        if str(item.value) == item.field_id:
            raise DesignerError(
                "DESIGN_INVALID_CROSS_FIELD",
                "Field cannot reference itself",
                422,
                fields=[{"field": f"{prefix}.value", "message": "self-reference not allowed"}],
            )
    return config


def save_conditions(session: Session, config: QueryConditionsConfig, owner_id: uuid.UUID | None = None):
    validate_conditions_config(config)
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="query_conditions",
            schema_version=config.schema_version,
            ref_type=config.ref_type,
            ref_id=config.ref_id,
            payload=_conditions_payload(config),
            expected_revision=config.expected_revision,
        ),
        owner_id=owner_id,
    )
    return config, record
```

`api/v1/designer.py`：`save_conditions` 捕获 `ConfigError` 并映射 `_config_error`（从 query_configs 复用模式或内联 JSONResponse）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "design_unknown or design_cross or design_validate or design_conditions_save" -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/ backend/app/api/v1/designer.py tests/test_meta_design_r33.py
git commit -m "feat(designer): DESIGN-001 field registry and conditions validation chain r33"
```

---

### Task 5: DESIGN-002 — 运算规则聚合、断链守卫与非法 save 不污染存储

**Files:**
- Modify: `backend/app/designer/schemas.py`（`FORMAT_EXPR_RE`、聚合正则扩展）
- Modify: `backend/app/designer/service.py`
- Modify: `tests/test_meta_design_r33.py`（DESIGN-002 段 4 条 + 联合 save 1 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `ComputeRuleItem`, `ComputeRulesConfig`, `EXPR_RE`, `detect_rule_cycle`
- Produces: `validate_compute_rules_config` 增 `DESIGN_RULE_TYPE_MISMATCH`/`DESIGN_RULE_BROKEN_CHAIN`/`DESIGN_INVALID_AGGREGATE`/`DESIGN_UNKNOWN_TARGET_FIELD`；`save_compute_rules` 校验失败不写 store

- [ ] **Step 1: 写失败测试（DESIGN-002 段 4 条 + 联合 save）**

追加到 `tests/test_meta_design_r33.py`：

```python
def _valid_compute_rules(ref_id: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "rules": [
            {
                "id": "total_amount",
                "name": "合计",
                "ruleType": "sum",
                "targetField": "order_amount",
                "expression": "sum(order_amount)",
                "dependsOn": [],
            }
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }


def test_design_rule_type_mismatch_r33(client):
    """T-DESIGN-R33-002-01: ruleType=sum expression=avg(x) → 422 DESIGN_RULE_TYPE_MISMATCH。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"][0]["expression"] = "avg(order_amount)"
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_TYPE_MISMATCH"


def test_design_rule_broken_chain_r33(client):
    """T-DESIGN-R33-002-02: dependsOn 未知 id → 422 DESIGN_RULE_BROKEN_CHAIN。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"][0]["dependsOn"] = ["missing_rule"]
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_BROKEN_CHAIN"


def test_design_invalid_aggregate_r33(client):
    """T-DESIGN-R33-002-03: median(x) → 422 DESIGN_INVALID_AGGREGATE。"""
    ref = str(uuid.uuid4())
    body = _valid_compute_rules(ref)
    body["rules"][0]["expression"] = "median(order_amount)"
    resp = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design_invalid_rules_no_store_pollution_r33(client):
    """T-DESIGN-R33-002-04: 非法规则 save 后 GET config revision 未变。"""
    ref = str(uuid.uuid4())
    ok = client.put("/api/v1/designer/compute-rules", headers=AUTH, json=_valid_compute_rules(ref))
    assert ok.status_code == 200
    listed = client.get(
        "/api/v1/query/configs",
        headers=AUTH,
        params={"config_type": "compute_rules", "ref_type": "design_draft", "ref_id": ref},
    )
    before_rev = listed.json()["items"][0]["revision"]
    bad = _valid_compute_rules(ref)
    bad["rules"][0]["expression"] = "median(order_amount)"
    assert client.put("/api/v1/designer/compute-rules", headers=AUTH, json=bad).status_code == 422
    after = client.get(
        "/api/v1/query/configs",
        headers=AUTH,
        params={"config_type": "compute_rules", "ref_type": "design_draft", "ref_id": ref},
    )
    assert after.json()["items"][0]["revision"] == before_rev


def test_design_conditions_and_compute_joint_save_r33(client):
    """联合回归: 同 ref save conditions + compute_rules 均 200。"""
    ref = str(uuid.uuid4())
    assert client.put("/api/v1/designer/conditions", headers=AUTH, json=_valid_conditions(ref)).status_code == 200
    assert client.put("/api/v1/designer/compute-rules", headers=AUTH, json=_valid_compute_rules(ref)).status_code == 200
    cond = client.get("/api/v1/designer/conditions", headers=AUTH, params={"ref_type": "design_draft", "ref_id": ref})
    comp = client.get("/api/v1/designer/compute-rules", headers=AUTH, params={"ref_type": "design_draft", "ref_id": ref})
    assert cond.status_code == 200 and comp.status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "design_rule or design_invalid or joint_save" -v`
Expected: FAIL

- [ ] **Step 3: 实现 DESIGN-002 校验链**

`backend/app/designer/schemas.py`：

```python
FORMAT_EXPR_RE = re.compile(r"^format\([a-zA-Z_][a-zA-Z0-9_]*,'[^']*'\)$")
AGG_EXPR_RE = re.compile(r"^(sum|avg|count)\([a-zA-Z_][a-zA-Z0-9_]*\)$")
ARITH_EXPR_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*[+\-*/][a-zA-Z_][a-zA-Z0-9_]*$")
```

`validate_compute_rules_config` 扩展：

```python
def _expression_matches_rule_type(rule: ComputeRuleItem) -> bool:
    expr = rule.expression
    rt = rule.rule_type
    if rt in ("sum", "avg"):
        return bool(AGG_EXPR_RE.match(expr)) and expr.startswith(f"{rt}(")
    if rt in ("add", "sub", "mul", "div"):
        return bool(ARITH_EXPR_RE.match(expr))
    if rt == "format":
        return bool(FORMAT_EXPR_RE.match(expr))
    return False


def validate_compute_rules_config(config: ComputeRulesConfig) -> ComputeRulesConfig:
    if not config.rules:
        raise DesignerError("DESIGN_EMPTY_RULES", "At least one rule is required", 422,
            fields=[{"field": "rules", "message": "must not be empty"}])
    rule_ids = {r.id for r in config.rules}
    for idx, rule in enumerate(config.rules):
        prefix = f"rules[{idx}]"
        if rule.rule_type not in ALLOWED_RULE_TYPES:
            raise DesignerError(..., fields=[{"field": f"{prefix}.ruleType", ...}])
        if rule.target_field not in DESIGNER_FIELD_REGISTRY:
            raise DesignerError("DESIGN_UNKNOWN_TARGET_FIELD", ..., fields=[{"field": f"{prefix}.targetField", ...}])
        if rule.expression.startswith("median(") or rule.expression.startswith("min("):
            raise DesignerError("DESIGN_INVALID_AGGREGATE", "Aggregate function not allowed", 422,
                fields=[{"field": f"{prefix}.expression", "message": "unsupported aggregate"}])
        if not _expression_matches_rule_type(rule):
            if not EXPR_RE.match(rule.expression) and not FORMAT_EXPR_RE.match(rule.expression):
                raise DesignerError("DESIGN_INVALID_EXPRESSION", ..., fields=[{"field": f"{prefix}.expression", ...}])
            raise DesignerError("DESIGN_RULE_TYPE_MISMATCH", "ruleType does not match expression", 422,
                fields=[{"field": f"{prefix}.expression", "message": f"does not match ruleType {rule.rule_type}"}])
        for j, dep in enumerate(rule.depends_on):
            if dep not in rule_ids:
                raise DesignerError("DESIGN_RULE_BROKEN_CHAIN", "Broken rule dependency", 422,
                    fields=[{"field": f"{prefix}.dependsOn[{j}]", "message": f"unknown rule id {dep}"}])
    detect_rule_cycle(config.rules)
    return config
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -k "design_rule or design_invalid or joint_save" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/designer/ tests/test_meta_design_r33.py
git commit -m "feat(designer): DESIGN-002 compute rules aggregate and chain guards r33"
```

---

### Task 6: 全量回归 — r33 18 条 + r32 21/21 + ruff

**Files:**
- Modify: `tests/test_meta_design_r33.py`（确认 18 条齐全）
- Read-only: `tests/test_meta_design_r32.py`、`backend/migrations/versions/0015_meta_design_config.py`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**UI skill:** none

- [ ] **Step 1: r33 全量测试**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r33.py -v`
Expected: **18 passed**

- [ ] **Step 2: r32 回归**

Run: `cd backend && python3 -m pytest tests/test_meta_design_r32.py -v`
Expected: **21 passed**（不删不改 r32 文件）

- [ ] **Step 3: ruff + 全量 pytest**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -q`
Expected: ruff clean；**≥726 passed**, 4 skipped

- [ ] **Step 4: Commit（若有遗漏修复）**

```bash
git add -A
git commit -m "test: META/DESIGN r33 full regression green with r32 compat"
```

---

### Task 7: 文档同步 — services + API 登记簿

**Files:**
- Modify: `docs/services/metadata.md`
- Modify: `docs/services/query.md`
- Modify: `docs/services/designer.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（触及 `docs/services/` 与 `docs/api/`）

**UI skill:** none

- [ ] **Step 1: 更新 metadata.md 错误码表**

在 `docs/services/metadata.md`「错误码（L1）」追加：

| code | 场景 |
|------|------|
| `META_TERM_INVALID_NAME` | name 仅空白 |
| `META_TERM_INVALID_STATUS` | status 非 active/inactive |
| `META_THEME_MAX_DEPTH` | 主题树深度超过 8 |

注明 `MAX_THEME_DEPTH=8`、`TERM_MAX_TEXT_LENGTH=4000`。

- [ ] **Step 2: 更新 query.md**

在 `docs/services/query.md` config_store 节追加 `MAX_CONFIG_PAYLOAD_BYTES=262144`、`expectedRevision` 乐观锁语义、`CONFIG_PAYLOAD_TOO_LARGE`（413）、`CONFIG_VERSION_CONFLICT`（409）。

- [ ] **Step 3: 更新 designer.md**

追加 `DESIGNER_FIELD_REGISTRY` stub 字段列表；错误码 `DESIGN_UNKNOWN_FIELD`、`DESIGN_INVALID_CROSS_FIELD`、`DESIGN_RULE_TYPE_MISMATCH`、`DESIGN_RULE_BROKEN_CHAIN`、`DESIGN_INVALID_AGGREGATE`、`DESIGN_UNKNOWN_TARGET_FIELD`。

- [ ] **Step 4: 更新 docs/api/README.md**

在 QUERY-007 行补 `expectedRevision` 可选字段与 413/409 错误码；META/DESIGN 相关路由备注新错误码（各一行，状态保持已实现）。

- [ ] **Step 5: 验证文档存在且无断链**

Run: `grep -E "META_THEME_MAX_DEPTH|CONFIG_VERSION_CONFLICT|DESIGN_UNKNOWN_FIELD" docs/services/*.md docs/api/README.md`
Expected: 各至少 1 处命中

- [ ] **Step 6: Commit**

```bash
git add docs/services/metadata.md docs/services/query.md docs/services/designer.md docs/api/README.md
git commit -m "docs: r33 META/QUERY/DESIGN companion error codes and limits"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| design 五子项均有 Task | Task 1–5 对应 META-001/002、QUERY-007、DESIGN-001/002 |
| 无 TBD/TODO/placeholder | 通过 |
| 每 Task 有验证命令 | 通过 |
| 全 Task UI skill: none | 通过 |
| 文件数 17 ≤ 20 | 通过 |
| r32 21/21 回归 | Task 6 显式 |
| subagent-driven-development option 1 | 头部已声明 |
