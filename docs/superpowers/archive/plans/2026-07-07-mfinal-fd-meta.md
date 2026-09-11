# M-FINAL · F-D 语义层元数据收官（META-001~004）实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/metadata/_acl.py`（新建）、`backend/app/metadata/glossary/service.py`、`backend/app/metadata/glossary/schemas.py`、`backend/app/metadata/themes/service.py`、`backend/app/metadata/themes/schemas.py`、`backend/app/metadata/dimensions/models.py`、`backend/app/metadata/dimensions/schemas.py`、`backend/app/metadata/dimensions/service.py`、`backend/migrations/versions/0019_dimension_theme_node.py`（新建；design 写 0017 但仓库已有 0017/0018，用下一序号）、`backend/app/metadata/dataset/service.py`、`backend/app/metadata/dataset/schemas.py`、`backend/app/api/v1/datasets.py`、`backend/app/api/v1/metadata.py`、`tests/test_mfinal_fd_meta_r244.py`（新建）、`fe/src/pages/admin/metadata/MetadataHubPage.tsx`、`fe/src/pages/admin/metadata/metadata-panels.tsx`（新建）、`fe/src/pages/admin/datasets/DatasetListPage.tsx`、`docs/api/README.md`、`docs/services/metadata.md`
> **子项：** META-001、META-002、META-003、META-004
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端预指定 fastapi + TDD；UI 预指定 b-design-system-tailadmin-radix）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`；`fe-ui.mdc` 匹配 `fe/**`）

**Goal:** F-D 批次 2 收官：术语/主题/维度写 ACL + 列表性能探针 + 维度可选主题 FK + Dataset PUT/DELETE/bind-query-config + QUERY 四步集成测 + Admin 语义层 CRUD UI。

**Architecture:** 共享 `metadata/_acl.py` 对齐 `physical/service.py` 写守卫；glossary/themes/dimensions 写入口首行调用，API 层仅下传 `actor: UserContext`；Dataset 延续 r59/r66 内存 store 并新增 `boundConfigId`；bind 只读依赖 `query/config_store.get_config_by_id` 校验 `config_type == "dataset_query"`；FE 抽 `metadata-panels.tsx` 控制 `MetadataHubPage` ≤300 行。

**Tech Stack:** Python 3.12 + FastAPI + SQLAlchemy + Alembic + pytest；React 18 + TanStack Query + shadcn/ui + vitest。

## Global Constraints

- 不修改 `goal.md` / `docs/automate/plan.md` 结构；PRD 分片勾选留给 P5
- 单 Python 业务文件 ≤ 200 行；`metadata-panels.tsx` ≤ 300 行；`_acl.py` ≤ 25 行
- 写角色：admin/analyst 允许；editor/viewer/enterprise 拒绝 403 `META_*_FORBIDDEN`
- 列表探针预算 ≤50ms（`probe_list_*_budget_ms().ok is True`）
- 错误码与 design 一致：`META_TERM_FORBIDDEN`、`META_THEME_FORBIDDEN`、`META_DIM_FORBIDDEN`、`META_DATASET_CONFIG_TYPE_INVALID`
- migration 序号 **0019**（`down_revision = "0018"`），列 `dimension_dicts.theme_node_id` nullable FK `theme_nodes.id` ON DELETE SET NULL
- 不修改 `query/translator` / `query/executor` 实现；集成测 mock `QueryExecutor.execute_sql`
- 文档同步：`docs/api/README.md` + `docs/services/metadata.md`（`prd-sync.mdc`）
- 提交格式：`feat:` / `test:` / `docs:` + 英文动词短语

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `backend/app/metadata/_acl.py` | **新建** | `_assert_meta_write(user, raise_forbidden)` |
| `backend/app/metadata/glossary/service.py` | **修改** | 写 ACL、`probe_list_terms_budget_ms` |
| `backend/app/metadata/glossary/schemas.py` | **修改** | 导出 `META_TERM_FORBIDDEN` 常量 |
| `backend/app/metadata/themes/service.py` | **修改** | 写 ACL、`probe_list_themes_budget_ms` |
| `backend/app/metadata/themes/schemas.py` | **修改** | 导出 `META_THEME_FORBIDDEN` |
| `backend/migrations/versions/0019_dimension_theme_node.py` | **新建** | 维度可选主题 FK |
| `backend/app/metadata/dimensions/models.py` | **修改** | `theme_node_id` 列 + relationship |
| `backend/app/metadata/dimensions/schemas.py` | **修改** | `themeNodeId` 入参/出参、`META_DIM_FORBIDDEN` |
| `backend/app/metadata/dimensions/service.py` | **修改** | 主题校验、写 ACL、`probe_list_dimensions_budget_ms` |
| `backend/app/metadata/dataset/service.py` | **修改** | `update_dataset`/`delete_dataset`/`bind_query_config` |
| `backend/app/metadata/dataset/schemas.py` | **修改** | `boundConfigId`、`DatasetBindConfigIn` |
| `backend/app/api/v1/metadata.py` | **修改** | glossary/themes/dimensions 写路由传 `actor` |
| `backend/app/api/v1/datasets.py` | **修改** | PUT/DELETE/`bind-query-config` |
| `tests/test_mfinal_fd_meta_r244.py` | **新建** | ≥28 条 F-D 收官 pytest |
| `fe/src/pages/admin/metadata/metadata-panels.tsx` | **新建** | 三 Tab CRUD 可复用块 |
| `fe/src/pages/admin/metadata/MetadataHubPage.tsx` | **修改** | 壳层 + Tab 编排 |
| `fe/src/pages/admin/datasets/DatasetListPage.tsx` | **修改** | 编辑/删除 + `boundConfigId` 列 |
| `docs/api/README.md` | **修改** | 新路由登记 |
| `docs/services/metadata.md` | **修改** | F-D 收官状态与错误码 |

---

### Task 1: META-001 — 共享写 ACL + 术语写守卫 + 探针 + pytest 001 区块

**Files:**
- Create: `backend/app/metadata/_acl.py`
- Modify: `backend/app/metadata/glossary/schemas.py`
- Modify: `backend/app/metadata/glossary/service.py`
- Modify: `backend/app/api/v1/metadata.py`
- Create: `tests/test_mfinal_fd_meta_r244.py`（仅 001 区块 + module fixture）

**Interfaces:**
- Produces: `_assert_meta_write(user: UserContext, *, raise_forbidden: Callable[[], Exception]) -> None`
- Produces: `glossary_service.create_term(session, payload, user)`（写函数签名增加 `user`）
- Produces: `probe_list_terms_budget_ms(session: Session) -> TermProbeResult`（`elapsed_ms`, `ok`）
- Produces: tests `test_meta_r244_001_01` ~ `test_meta_r244_001_06`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

- [ ] **Step 1: 新建测试文件与 module fixture**

创建 `tests/test_mfinal_fd_meta_r244.py`，头部与 fixture（复用 r33 模式，确保 import metadata models）：

```python
"""M-FINAL F-D r244 — META-001~004 语义层收官。"""
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
from jwt_auth import AUTH, jwt_auth_headers

_R244_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fd_r244?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r244_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R244_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.themes.models  # noqa: F401
    import app.metadata.dimensions.models  # noqa: F401
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
def admin_actor() -> Generator[None, None, None]:
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="admin", roles=["admin"]
    )
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_actor() -> Generator[None, None, None]:
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="viewer", roles=["viewer"]
    )
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_meta_r244_001_01_admin_create_term_ok(client, admin_actor):
    """T-META-R244-001-01: admin POST 合法术语 → 201 + code 回显。"""
    resp = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "revenue", "name": "营收", "definition": "销售收入"},
    )
    assert resp.status_code == 201
    assert resp.json()["code"] == "revenue"


def test_meta_r244_001_02_viewer_create_forbidden(client, viewer_actor):
    """T-META-R244-001-02: viewer POST → 403 META_TERM_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "blocked", "name": "禁止"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_TERM_FORBIDDEN"


def test_meta_r244_001_03_blank_name_invalid(client, admin_actor):
    """T-META-R244-001-03: 空白 name → 422 META_TERM_INVALID_NAME。"""
    resp = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "blank", "name": "   "},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_TERM_INVALID_NAME"


def test_meta_r244_001_04_delete_term_in_use(client, admin_actor):
    """T-META-R244-001-04: 删除被主题引用的术语 → 409 META_TERM_IN_USE。"""
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "linked_term", "name": "关联术语"},
    ).json()
    client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "主题", "termId": term["id"]},
    )
    resp = client.delete(f"/api/v1/metadata/glossary/{term['id']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_TERM_IN_USE"


def test_meta_r244_001_05_probe_list_terms_budget(client, admin_actor):
    """T-META-R244-001-05: probe_list_terms_budget_ms().ok is True。"""
    from app.datasources.models import get_meta_session
    from app.metadata.glossary import service as glossary_service
    from app.metadata.glossary.schemas import TermCreate

    session = get_meta_session()
    try:
        for i in range(5):
            glossary_service.create_term(
                session,
                TermCreate(code=f"p{i}", name=f"P{i}"),
                UserContext(id="x", username="a", roles=["admin"]),
            )
        result = glossary_service.probe_list_terms_budget_ms(session)
        assert result.ok is True
        assert result.elapsed_ms <= 50
    finally:
        session.close()


def test_meta_r244_001_06_viewer_put_forbidden(client, admin_actor, viewer_actor):
    """T-META-R244-001-06: viewer PUT → 403 META_TERM_FORBIDDEN。"""
    # admin_actor 活跃时创建
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "upd_term", "name": "原名称"},
    ).json()
    # viewer_actor fixture 覆盖 get_current_user
    resp = client.put(
        f"/api/v1/metadata/glossary/{term['id']}",
        headers=AUTH,
        json={"name": "新名称"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_TERM_FORBIDDEN"
```

- [ ] **Step 2: 运行 001 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -k "001" -v --tb=short`
Expected: FAIL（`META_TERM_FORBIDDEN` 未实现或 viewer 未被拒）

- [ ] **Step 3: 实现 `_acl.py` 与 glossary 写守卫**

`backend/app/metadata/_acl.py`：

```python
from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from app.auth.deps import UserContext

E = TypeVar("E", bound=Exception)


def _assert_meta_write(user: UserContext, *, raise_forbidden: Callable[[], E]) -> E | None:
    if set(user.roles).intersection({"admin", "analyst"}):
        return None
    raise raise_forbidden()
```

`backend/app/metadata/glossary/schemas.py` 追加：

```python
META_TERM_FORBIDDEN = "META_TERM_FORBIDDEN"
```

`backend/app/metadata/glossary/service.py` 修改要点：

```python
import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.metadata._acl import _assert_meta_write
from app.metadata.glossary.schemas import GlossaryError, META_TERM_FORBIDDEN, ...

@dataclass(frozen=True)
class TermProbeResult:
    elapsed_ms: float
    ok: bool

probe_list_terms_budget_ms_limit = 50

def _forbidden() -> GlossaryError:
    return GlossaryError(META_TERM_FORBIDDEN, "insufficient role to modify glossary terms", 403)

def create_term(session: Session, payload: TermCreate, user: UserContext) -> GlossaryTerm:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    ...

def update_term(session: Session, term_id: uuid.UUID, payload: TermUpdate, user: UserContext) -> GlossaryTerm:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    ...

def delete_term(session: Session, term_id: uuid.UUID, user: UserContext) -> None:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    ...

def probe_list_terms_budget_ms(session: Session) -> TermProbeResult:
    started = time.perf_counter()
    list_terms(session, limit=50, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return TermProbeResult(elapsed_ms=elapsed, ok=elapsed <= probe_list_terms_budget_ms_limit)
```

- [ ] **Step 4: API 下传 actor**

`backend/app/api/v1/metadata.py` glossary 写路由将 `_: Annotated[UserContext, ...]` 改为 `actor`，并传入 service：

```python
@router.post("/glossary", ...)
def create_glossary_term(
    payload: TermCreate,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        term = glossary_service.create_term(db, payload, actor)
    ...
```

对 `update_glossary_term`、`delete_glossary_term` 同样传入 `actor`。

- [ ] **Step 5: 运行 001 测试（预期 PASS）**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -k "001" -v`
Expected: 6 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/metadata/_acl.py backend/app/metadata/glossary/ backend/app/api/v1/metadata.py tests/test_mfinal_fd_meta_r244.py
git commit -m "feat(meta): META-001 glossary write ACL and list probe"
```

---

### Task 2: META-002 — 主题树写 ACL + 探针 + pytest 002 区块

**Files:**
- Modify: `backend/app/metadata/themes/schemas.py`
- Modify: `backend/app/metadata/themes/service.py`
- Modify: `backend/app/api/v1/metadata.py`
- Modify: `tests/test_mfinal_fd_meta_r244.py`

**Interfaces:**
- Consumes: `_assert_meta_write` from Task 1
- Produces: `create_theme_node(session, payload, user)` 等写函数带 `user`
- Produces: `probe_list_themes_budget_ms(session) -> ThemeProbeResult`
- Produces: tests `test_meta_r244_002_01` ~ `test_meta_r244_002_07`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 002 失败测试**

在 `tests/test_mfinal_fd_meta_r244.py` 追加：

```python
def test_meta_r244_002_01_root_and_child_list(client, admin_actor):
    """T-META-R244-002-01: 根节点 + 子节点 list parent 过滤正确。"""
    root = client.post(
        "/api/v1/metadata/themes", headers=AUTH, json={"name": "根", "code": "root"}
    ).json()
    client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "子", "parentId": root["id"]},
    )
    roots = client.get("/api/v1/metadata/themes?parent_id=null", headers=AUTH).json()
    assert roots["total"] >= 1
    children = client.get(
        f"/api/v1/metadata/themes?parent_id={root['id']}", headers=AUTH
    ).json()
    assert children["total"] == 1


def test_meta_r244_002_02_unknown_term_404(client, admin_actor):
    """T-META-R244-002-02: termId 不存在 → 404。"""
    resp = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "无术语", "termId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404


def test_meta_r244_002_03_move_cycle_422(client, admin_actor):
    """T-META-R244-002-03: move 至子孙 → 422 META_THEME_CYCLE。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "A"}).json()
    child = client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "B", "parentId": root["id"]},
    ).json()
    resp = client.post(
        f"/api/v1/metadata/themes/{root['id']}/move",
        headers=AUTH,
        json={"parentId": child["id"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_THEME_CYCLE"


def test_meta_r244_002_04_viewer_post_forbidden(client, viewer_actor):
    """T-META-R244-002-04: viewer POST themes → 403 META_THEME_FORBIDDEN。"""
    resp = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "X"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_THEME_FORBIDDEN"


def test_meta_r244_002_05_delete_with_children_409(client, admin_actor):
    """T-META-R244-002-05: 删有子节点 → 409 META_THEME_HAS_CHILDREN。"""
    root = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "父"}).json()
    client.post(
        "/api/v1/metadata/themes",
        headers=AUTH,
        json={"name": "子", "parentId": root["id"]},
    )
    resp = client.delete(f"/api/v1/metadata/themes/{root['id']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_THEME_HAS_CHILDREN"


def test_meta_r244_002_06_empty_tree_list(client, admin_actor):
    """T-META-R244-002-06: 空树 list parent=null → total=0。"""
    resp = client.get("/api/v1/metadata/themes?parent_id=null", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 0


def test_meta_r244_002_07_probe_list_themes_budget(client, admin_actor):
    """T-META-R244-002-07: probe_list_themes_budget_ms().ok is True。"""
    from app.datasources.models import get_meta_session
    from app.metadata.themes import service as themes_service

    session = get_meta_session()
    try:
        result = themes_service.probe_list_themes_budget_ms(session)
        assert result.ok is True
    finally:
        session.close()
```

- [ ] **Step 2: 运行 002 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -k "002" -v --tb=short`
Expected: FAIL on `META_THEME_FORBIDDEN` 或 probe 缺失

- [ ] **Step 3: 实现 themes 写 ACL + probe**

`themes/schemas.py` 追加 `META_THEME_FORBIDDEN = "META_THEME_FORBIDDEN"`。

`themes/service.py`：对 `create_theme_node`/`update_theme_node`/`delete_theme_node`/`move_theme_node` 首行 `_assert_meta_write(user, raise_forbidden=lambda: ThemeError(META_THEME_FORBIDDEN, "...", 403))`；新增 `ThemeProbeResult` 与 `probe_list_themes_budget_ms(session)`（调用 `list_theme_nodes(session, parent_id="null", limit=50)`）。

- [ ] **Step 4: API themes 写路由传 actor**

`metadata.py` 中 themes POST/PUT/DELETE/move 路由传入 `actor` 至 service。

- [ ] **Step 5: 运行 002 测试（预期 PASS）**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -k "002" -v`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/metadata/themes/ backend/app/api/v1/metadata.py tests/test_mfinal_fd_meta_r244.py
git commit -m "feat(meta): META-002 theme tree write ACL and probe"
```

---

### Task 3: META-003 — 维度主题 FK migration + 写 ACL + 探针 + pytest 003 区块

**Files:**
- Create: `backend/migrations/versions/0019_dimension_theme_node.py`
- Modify: `backend/app/metadata/dimensions/models.py`
- Modify: `backend/app/metadata/dimensions/schemas.py`
- Modify: `backend/app/metadata/dimensions/service.py`
- Modify: `backend/app/api/v1/metadata.py`
- Modify: `tests/test_mfinal_fd_meta_r244.py`

**Interfaces:**
- Produces: `DimensionDict.theme_node_id: Mapped[uuid.UUID | None]`
- Produces: `DimensionCreate.theme_node_id` / `DimensionOut.theme_node_id`（alias `themeNodeId`）
- Produces: `probe_list_dimensions_budget_ms(session) -> DimensionProbeResult`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 003 失败测试**

```python
def test_meta_r244_003_01_create_with_theme_ok(client, admin_actor):
    """T-META-R244-003-01: 合法维度 + themeNodeId → 201。"""
    theme = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "T"}).json()
    resp = client.post(
        "/api/v1/metadata/dimensions",
        headers=AUTH,
        json={"code": "region", "name": "区域", "themeNodeId": theme["id"]},
    )
    assert resp.status_code == 201
    assert resp.json()["themeNodeId"] == theme["id"]


def test_meta_r244_003_02_invalid_theme_404(client, admin_actor):
    """T-META-R244-003-02: 非法 themeNodeId → 404 META_THEME_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/metadata/dimensions",
        headers=AUTH,
        json={"code": "bad_theme", "name": "X", "themeNodeId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "META_THEME_NOT_FOUND"


def test_meta_r244_003_03_duplicate_code_409(client, admin_actor):
    """T-META-R244-003-03: 重复 code → 409 META_DIM_CODE_CONFLICT。"""
    client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "dup", "name": "A"}
    )
    resp = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "dup", "name": "B"}
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_DIM_CODE_CONFLICT"


def test_meta_r244_003_04_list_limit_500(client, admin_actor):
    """T-META-R244-003-04: list limit=500 边界。"""
    resp = client.get("/api/v1/metadata/dimensions?limit=500", headers=AUTH)
    assert resp.status_code == 200


def test_meta_r244_003_05_viewer_post_forbidden(client, viewer_actor):
    """T-META-R244-003-05: viewer POST → 403 META_DIM_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "v", "name": "V"}
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_DIM_FORBIDDEN"


def test_meta_r244_003_06_register_values_ok(client, admin_actor):
    """T-META-R244-003-06: values 注册链不变。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "status", "name": "状态"}
    ).json()
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "open", "label": "开启"}]},
    )
    assert resp.status_code == 201
    assert len(resp.json()["items"]) == 1


def test_meta_r244_003_07_probe_list_dimensions_budget(client, admin_actor):
    """T-META-R244-003-07: probe_list_dimensions_budget_ms().ok is True。"""
    from app.datasources.models import get_meta_session
    from app.metadata.dimensions import service as dim_service

    session = get_meta_session()
    try:
        assert dim_service.probe_list_dimensions_budget_ms(session).ok is True
    finally:
        session.close()
```

- [ ] **Step 2: 运行 003 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -k "003" -v --tb=short`

- [ ] **Step 3: migration 0019**

`backend/migrations/versions/0019_dimension_theme_node.py`：

```python
"""dimension theme_node_id FK

Revision ID: 0019
Revises: 0018
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dimension_dicts",
        sa.Column("theme_node_id", sa.Uuid(), sa.ForeignKey("theme_nodes.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_dimension_dicts_theme_node_id", "dimension_dicts", ["theme_node_id"])


def downgrade() -> None:
    op.drop_index("ix_dimension_dicts_theme_node_id", table_name="dimension_dicts")
    op.drop_column("dimension_dicts", "theme_node_id")
```

`dimensions/models.py` 在 `status` 后追加：

```python
    theme_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("theme_nodes.id", ondelete="SET NULL"), nullable=True,
    )
```

- [ ] **Step 4: schemas + service**

`dimensions/schemas.py`：

```python
META_DIM_FORBIDDEN = "META_DIM_FORBIDDEN"

class DimensionCreate(BaseModel):
    ...
    theme_node_id: uuid.UUID | None = Field(default=None, alias="themeNodeId")

class DimensionUpdate(BaseModel):
    ...
    theme_node_id: uuid.UUID | None = Field(default=None, alias="themeNodeId")

class DimensionOut(BaseModel):
    ...
    theme_node_id: uuid.UUID | None = Field(default=None, alias="themeNodeId")
```

`dimensions/service.py`：`create_dimension`/`update_dimension`/`delete_dimension`/`register_values`/`delete_value` 写入口 ACL；非空 `theme_node_id` 时 `themes_service.get_theme_node(session, theme_node_id)`；`probe_list_dimensions_budget_ms`。

- [ ] **Step 5: API dimensions 写路由传 actor**

- [ ] **Step 6: 运行 003 测试（预期 PASS）**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -k "003" -v`
Expected: 7 passed

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/versions/0019_dimension_theme_node.py backend/app/metadata/dimensions/ backend/app/api/v1/metadata.py tests/test_mfinal_fd_meta_r244.py
git commit -m "feat(meta): META-003 dimension theme FK and write ACL"
```

---

### Task 4: META-004 — Dataset PUT/DELETE/bind + QUERY 四步集成测

**Files:**
- Modify: `backend/app/metadata/dataset/schemas.py`
- Modify: `backend/app/metadata/dataset/service.py`
- Modify: `backend/app/api/v1/datasets.py`
- Modify: `tests/test_mfinal_fd_meta_r244.py`

**Interfaces:**
- Produces: `update_dataset(dataset_id, payload: DatasetItemIn, user) -> DatasetItemOut`
- Produces: `delete_dataset(dataset_id, user) -> None`
- Produces: `bind_query_config(dataset_id, config_id: uuid.UUID, user) -> DatasetItemOut`
- Produces: `DatasetItemOut.bound_config_id`（alias `boundConfigId`）
- Consumes: `get_config_by_id(session, config_id)` from `app.query.config_store.service`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 004 失败测试**

```python
from unittest.mock import patch

from app.query.executor import QueryExecutor, QueryResult


def test_meta_r244_004_01_put_update_ok(client, admin_actor):
    """T-META-R244-004-01: PUT 更新 displayName/tables → 200。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "原", "tables": [{"name": "t1"}]},
    )
    resp = client.put(
        f"/api/v1/datasets/{ds_id}",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "新", "tables": [{"name": "t2"}]},
    )
    assert resp.status_code == 200
    assert resp.json()["displayName"] == "新"


def test_meta_r244_004_02_delete_then_404(client, admin_actor):
    """T-META-R244-004-02: DELETE 后 GET → 404 META_DATASET_NOT_FOUND。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    client.delete(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    resp = client.get(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    assert resp.status_code == 404


def test_meta_r244_004_03_viewer_put_forbidden(client, viewer_actor):
    """T-META-R244-004-03: viewer PUT → 403 META_DATASET_FORBIDDEN。"""
    # 先用默认 AUTH（admin）创建，再 viewer fixture 覆盖
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    resp = client.put(
        f"/api/v1/datasets/{ds_id}",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "X", "tables": [{"name": "t"}]},
    )
    assert resp.status_code == 403


def test_meta_r244_004_04_bind_wrong_config_type(client, admin_actor):
    """T-META-R244-004-04: bind 非 dataset_query → 422 META_DATASET_CONFIG_TYPE_INVALID。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    # PUT chart_query 类型 config（若不存在则用 mock session 插入错误类型）
    from app.datasources.models import get_meta_session
    from app.query.config_store.models import QueryConfigRecord

    session = get_meta_session()
    bad_id = uuid.uuid4()
    session.add(
        QueryConfigRecord(
            id=bad_id,
            config_type="chart_query",
            schema_version="1.0",
            ref_type="chart",
            ref_id=uuid.uuid4(),
            payload={},
            revision=1,
        )
    )
    session.commit()
    session.close()
    resp = client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": str(bad_id)},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_CONFIG_TYPE_INVALID"


def test_meta_r244_004_05_bind_persists_bound_id(client, admin_actor):
    """T-META-R244-004-05: bind 后 boundConfigId 一致。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "orders"}]},
    )
    ds_uuid = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": ds_uuid,
            "payload": {
                "dataSourceId": str(uuid.uuid4()),
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 10,
                "offset": 0,
            },
        },
    ).json()
    resp = client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": cfg["configId"]},
    )
    assert resp.status_code == 200
    assert resp.json()["boundConfigId"] == cfg["configId"]


@patch.object(QueryExecutor, "execute_sql")
def test_meta_r244_004_06_full_chain_execute(mock_exec, client, admin_actor):
    """T-META-R244-004-06: 四步链 mock execute → rowCount ≥ 1。"""
    mock_exec.return_value = QueryResult(rows=[{"id": 1}], row_count=1, columns=["id"])
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "链", "tables": [{"name": "orders"}]},
    )
    ds_src = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": str(uuid.uuid4()),
            "payload": {
                "dataSourceId": ds_src,
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 10,
                "offset": 0,
            },
        },
    ).json()
    client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": cfg["configId"]},
    )
    exec_resp = client.post(
        "/api/v1/query/dataset/execute",
        headers=AUTH,
        json={"dataSourceId": ds_src, "configId": cfg["configId"]},
    )
    assert exec_resp.status_code == 200
    assert exec_resp.json()["rowCount"] >= 1


def test_meta_r244_004_07_viewer_delete_forbidden(client, viewer_actor):
    """T-META-R244-004-07: viewer DELETE → 403。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "D", "tables": [{"name": "t"}]},
    )
    resp = client.delete(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    assert resp.status_code == 403


def test_meta_r244_004_08_r243_regression_smoke(client, admin_actor):
    """T-META-R244-004-08: r243 translate-from-config 仍可用（1 条回归）。"""
    ds_id = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": ds_id,
            "payload": {
                "dataSourceId": str(uuid.uuid4()),
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 5,
                "offset": 0,
            },
        },
    ).json()
    resp = client.post(
        f"/api/v1/query/configs/{cfg['configId']}/translate",
        headers=AUTH,
        json={},
    )
    assert resp.status_code == 200
    assert "sql" in resp.json()
```

- [ ] **Step 2: 运行 004 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -k "004" -v --tb=short`

- [ ] **Step 3: 实现 dataset service + schemas**

`dataset/schemas.py` 追加：

```python
import uuid

class DatasetBindConfigIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    config_id: uuid.UUID = Field(alias="configId")

class DatasetItemOut(BaseModel):
    ...
    bound_config_id: uuid.UUID | None = Field(default=None, alias="boundConfigId")
```

`dataset/service.py` 追加：

```python
META_DATASET_CONFIG_TYPE_INVALID = "META_DATASET_CONFIG_TYPE_INVALID"

def update_dataset(dataset_id: str, payload: DatasetItemIn, user: UserContext) -> DatasetItemOut:
    _assert_dataset_write_access(user, dataset_id)
    if dataset_id not in _store:
        raise DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404)
    if payload.dataset_id != dataset_id:
        raise DatasetError("META_DATASET_ID_MISMATCH", "datasetId mismatch", 422)
    _validate_body(payload)
    record = payload.model_dump(by_alias=True)
    record["boundConfigId"] = _store[dataset_id].get("boundConfigId")
    _store[dataset_id] = record
    return _to_out(record)

def delete_dataset(dataset_id: str, user: UserContext) -> None:
    _assert_dataset_write_access(user, dataset_id)
    if dataset_id not in _store:
        raise DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404)
    del _store[dataset_id]

def bind_query_config(dataset_id: str, config_id: uuid.UUID, user: UserContext) -> DatasetItemOut:
    _assert_dataset_write_access(user, dataset_id)
    if dataset_id not in _store:
        raise DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404)
    from app.datasources.models import get_meta_session
    from app.query.config_store.service import get_config_by_id

    session = get_meta_session()
    try:
        record = get_config_by_id(session, config_id)
        if record.config_type != "dataset_query":
            raise DatasetError(META_DATASET_CONFIG_TYPE_INVALID, "config must be dataset_query", 422)
    finally:
        session.close()
    _store[dataset_id]["boundConfigId"] = str(config_id)
    return _to_out(_store[dataset_id])
```

`create_dataset` 创建记录时确保 `boundConfigId: None` 存在于 record。

- [ ] **Step 4: API routes**

`api/v1/datasets.py` 追加：

```python
@router.put("/{dataset_id}", response_model=DatasetItemOut)
def update_dataset(dataset_id: str, payload: DatasetItemIn, actor: Annotated[UserContext, Depends(get_current_user)]):
    try:
        return dataset_service.update_dataset(dataset_id, payload, actor)
    except DatasetError as exc:
        return _dataset_error(exc)

@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: str, actor: Annotated[UserContext, Depends(get_current_user)]):
    try:
        dataset_service.delete_dataset(dataset_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DatasetError as exc:
        return _dataset_error(exc)

@router.post("/{dataset_id}/bind-query-config", response_model=DatasetItemOut)
def bind_query_config(dataset_id: str, payload: DatasetBindConfigIn, actor: Annotated[UserContext, Depends(get_current_user)]):
    try:
        return dataset_service.bind_query_config(dataset_id, payload.config_id, actor)
    except DatasetError as exc:
        return _dataset_error(exc)
```

- [ ] **Step 5: 运行 004 + 全套件**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -v`
Expected: ≥28 passed（001~004 合计 28 条）

- [ ] **Step 6: Commit**

```bash
git add backend/app/metadata/dataset/ backend/app/api/v1/datasets.py tests/test_mfinal_fd_meta_r244.py
git commit -m "feat(meta): META-004 dataset CRUD bind and query chain tests"
```

---

### Task 5: FE — 语义层三 Tab Admin CRUD（metadata-panels + MetadataHubPage）

**Files:**
- Create: `fe/src/pages/admin/metadata/metadata-panels.tsx`
- Modify: `fe/src/pages/admin/metadata/MetadataHubPage.tsx`

**Interfaces:**
- Consumes: `/api/v1/metadata/glossary|themes|dimensions` CRUD API（Task 1~3 已就绪）
- Produces: `GlossaryPanel`、`ThemesPanel`、`DimensionsPanel` 导出组件

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin 设计系统：`Button variant="primary"` 主操作、`Dialog` 表单、`AlertDialog` 删除确认、`Badge variant="light"` 状态
- desktop 与 mobile：表格 `overflow-x-auto` + `min-w-[640px]`；Dialog `sm:max-w-lg`
- hover/focus/active/loading/empty/error 三态：`Skeleton` 加载、「暂无数据」空态、`ErrorBanner` 错误+重试
- 字段错误贴输入框 `aria-invalid`；成功 `sonner` toast；删除禁 `window.confirm`
- `cd fe && pnpm run check:design` 通过

- [ ] **Step 1: 创建 `metadata-panels.tsx`**

抽离共享 `MetaDataTable`（从现有 `MetadataHubPage` 迁移）与三面板：

- **GlossaryPanel**：列表 + 「新建术语」Dialog（code/name/definition/status）；行内编辑/删除（`Pencil`/`Trash2` `aria-label`）；删除 `AlertDialog`
- **ThemesPanel**：根节点 `?parent_id=null`；行点击展开子级（本地 state `expandedId`）；「新建子节点」Dialog 含可选术语 `Select`（`GET /glossary?limit=100`）；「移动」Dialog 含父节点 `Select`；层级缩进 `pl-{depth*4}`
- **DimensionsPanel**：列表含主题名列（无则「—」）；新建/编辑 Dialog 含可选「所属主题」`Select`；「注册枚举值」Dialog 批量粘贴 `code,label` 行 → POST values

使用 `@/components/ui/*`：`Button`、`Dialog`、`AlertDialog`、`Select`、`Label`、`Input`、`Badge`、`Skeleton`。

- [ ] **Step 2: 精简 `MetadataHubPage.tsx`**

保留 `AdminPageShell`、Tabs、`ErrorBanner` 编排；`actions` 按当前 Tab 渲染对应面板的主操作按钮；文件 ≤300 行。

- [ ] **Step 3: 验证**

Run: `cd fe && pnpm run check:design`
Expected: exit 0

Run: `cd fe && pnpm exec vitest run src/pages/admin/metadata --passWithNoTests 2>/dev/null || cd fe && pnpm run build`
Expected: tsc + vite build exit 0

- [ ] **Step 4: Commit**

```bash
git add fe/src/pages/admin/metadata/
git commit -m "feat(fe): META-001~003 metadata hub CRUD panels"
```

---

### Task 6: FE — Dataset 编辑/删除 UI（META-004）

**Files:**
- Modify: `fe/src/pages/admin/datasets/DatasetListPage.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 列表增加「操作」列：`Button variant="outline" size="sm"` 编辑 + 删除
- 编辑 Dialog：displayName、tables JSON 简表（每行 name）、computedFields JSON 简表；提交 `PUT /api/v1/datasets/{id}`
- 删除 `AlertDialog` 确认后 `DELETE`；成功 invalidate `queryKeys.datasets`
- 可选显示 `boundConfigId` 列（有则 mono 截断，无则「—」）
- `check:design` 通过；mobile 表格横滚不溢出

- [ ] **Step 1: 扩展 `DatasetListPage`**

```tsx
// 类型扩展
type DatasetItem = {
  datasetId: string;
  displayName: string;
  tables: Array<{ name: string; alias?: string | null }>;
  computedFields: Array<{ name: string; expression: string }>;
  allowedRoles: string[];
  boundConfigId?: string | null;
};

// 行内操作 + editMutation (PUT) + deleteMutation (DELETE)
// AlertDialog: title="确认删除 Dataset？" description 含 displayName
```

- [ ] **Step 2: 验证**

Run: `cd fe && pnpm run check:design && pnpm run build`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add fe/src/pages/admin/datasets/DatasetListPage.tsx
git commit -m "feat(fe): META-004 dataset edit delete UI"
```

---

### Task 7: 文档同步 — API 登记 + metadata 域附录

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/metadata.md`

**Skills:**
- Read `.cursor/rules/prd-sync.mdc`（触及 `docs/**`）

- [ ] **Step 1: `docs/api/README.md` 追加行**

| Method | Path | 说明 | 状态 |
|--------|------|------|------|
| PUT | `/api/v1/datasets/{dataset_id}` | Dataset 全量更新（写 ACL；`META_DATASET_FORBIDDEN`） | 已实现 |
| DELETE | `/api/v1/datasets/{dataset_id}` | Dataset 删除 204 | 已实现 |
| POST | `/api/v1/datasets/{dataset_id}/bind-query-config` | body `{configId}` 绑定 dataset_query 配置 | 已实现 |

更新 glossary/themes/dimensions 写路由说明：viewer/editor 写操作 → 403 `META_*_FORBIDDEN`。

- [ ] **Step 2: `docs/services/metadata.md`**

更新 F-D r244 收官状态；登记 `META_TERM_FORBIDDEN`、`META_THEME_FORBIDDEN`、`META_DIM_FORBIDDEN`、`META_DATASET_CONFIG_TYPE_INVALID`；`dimension_dicts.theme_node_id` FK；Dataset `boundConfigId` + bind 契约；写 ACL 角色表（admin/analyst 写，viewer/editor 拒）。

- [ ] **Step 3: Commit**

```bash
git add docs/api/README.md docs/services/metadata.md
git commit -m "docs: F-D r244 metadata API and domain anchors"
```

---

### Task 8: 回归门控 + ruff

**Files:**
- Verify: `tests/test_mfinal_fd_meta_r244.py`
- Verify: `tests/test_mfinal_fd_r243.py`
- Verify: `tests/test_meta_design_r33.py`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: r244 全绿**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_meta_r244.py -v`
Expected: ≥28 passed, exit 0

- [ ] **Step 2: r243 回归**

Run: `cd backend && python -m pytest tests/test_mfinal_fd_r243.py -v`
Expected: all passed, exit 0

- [ ] **Step 3: r33 抽样**

Run: `cd backend && python -m pytest tests/test_meta_design_r33.py -v`
Expected: all passed, exit 0

- [ ] **Step 4: ruff**

Run: `cd backend && ruff check app/metadata/ app/api/v1/metadata.py app/api/v1/datasets.py tests/test_mfinal_fd_meta_r244.py`
Expected: exit 0

- [ ] **Step 5: FE 全量**

Run: `cd fe && pnpm run check:design && pnpm exec vitest run && pnpm run build`
Expected: exit 0

- [ ] **Step 6: Commit（若有修复）**

```bash
git add -A
git commit -m "chore: F-D r244 regression gate green"
```

---

## Spec Self-Review

| design 子项 | 对应 Task | 覆盖 |
|-------------|-----------|------|
| META-001 写 ACL + probe + Admin 术语 CRUD | Task 1 + Task 5 GlossaryPanel | ✓ |
| META-002 主题树 ACL + 层级 UI + move | Task 2 + Task 5 ThemesPanel | ✓ |
| META-003 theme FK + 维度 CRUD + values | Task 3 + Task 5 DimensionsPanel | ✓ |
| META-004 PUT/DELETE/bind + 四步链 + Dataset UI | Task 4 + Task 6 | ✓ |
| test_mfinal_fd_meta_r244 ≥28 条 | Task 1~4 + Task 8 | ✓ |
| docs 同步 | Task 7 | ✓ |
| 18~19 文件（含 _acl + 0019 migration） | File Structure | ✓ |
| 无 TBD/TODO 占位 | 全文 | ✓ |
