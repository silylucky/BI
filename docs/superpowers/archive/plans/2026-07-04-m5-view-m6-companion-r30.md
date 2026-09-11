# M5 VIEW-001 L1 + M6 companion kickoff r30 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/views/`、`backend/app/governance/`、`backend/app/openapi/`、`backend/app/api/v1/`、`backend/app/dashboard/service.py`、`backend/app/main.py`、`backend/migrations/versions/0014_gov_catalog.py`、`tests/test_view_gov_api_r30.py`、`docs/services/views.md`、`docs/services/governance.md`、`docs/api/README.md`
> **子项：** VIEW-001, GOV-001, GOV-002, API-001, API-002
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 交付 M5 收官 VIEW-001 DashboardView 协议 L1 + M6 P1-SMOKE companion — 三分法 catalog、总线 PoC 半自动注册、IF-06 OpenAPI 登记；`test_view_gov_api_r30.py` ≥30 smoke + r29 回归全绿。

**Architecture:** 独立 `views/` 协议层包装 `DashboardLayout`，`dashboard.service.validate_layout` 委托 `views.validate`；`governance/catalog` ORM + seed CAT-01~03，`governance/bus/poc` 内存 adapter；`openapi/extensions.py` 后处理 IF-06 tag/示例；entry 薄层 `api/v1/views.py` + `api/v1/gov.py`。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Pydantic v2 · Alembic · pytest · ruff

## Global Constraints

- 纯后端 L1；**不修改** `fe/`；**全 Task UI skill: none**
- 不修改 `docs/automate/goal.md` / `plan.md` 结构
- 不含 VIEW-002/003、GOV-003~008、CAT-04~07、API-003~007、Admin 治理 UI、真实总线 HTTP
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": {...}|null}`
- API 前缀 `/api/v1/`；治理路由 prefix `/gov`（包名 `governance/`）
- migration **0014**（`0013` 已被 `dashboards` 占用）；`down_revision = "0013"`
- traceId 取自 `trace_id_var.get()`（与 `query/service.py` 一致），非 `request.state`
- 文件预算：新建 **11** + 修改 **9** = **20 ≤ 20**
- 验证基线：r29 `pytest` **632 passed** + 2 skipped；本轮目标 **≥660 passed** + 2 skipped
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: VIEW-001 — DashboardView schema + validate 服务（VIEW-001 域层）

**Files:**
- Create: `backend/app/views/__init__.py`
- Create: `backend/app/views/schemas.py`
- Create: `backend/app/views/validate.py`
- Test: `tests/test_view_gov_api_r30.py`（VIEW 单元段，Step 1 先写 4 条）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `app.dashboard.schemas.DashboardLayout`, `app.dashboard.service.DashboardError`, `app.schemas.chart_view.ChartViewError`
- Produces: `DashboardView`, `ViewError`, `validate_dashboard_view(data) -> DashboardView`, `validate_layout_dict(layout) -> dict`

- [ ] **Step 1: 写失败测试（VIEW 校验 4 条）**

在 `tests/test_view_gov_api_r30.py` 顶部写入 fixture 与 VIEW 段：

```python
"""M5 VIEW-001 + M6 GOV/API companion r30 — VIEW-001/GOV-001/GOV-002/API-001/API-002."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view

_R30_SQLITE_URL = "sqlite+pysqlite:///file:view_gov_r30?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


def _valid_layout(widget_id: str | None = None) -> dict:
    wid = widget_id or str(uuid.uuid4())
    return {
        "version": 1,
        "widgets": [
            {
                "id": wid,
                "type": "chart",
                "title": "KPI",
                "colSpan": 12,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": "SELECT 1",
                },
            }
        ],
        "globalFilters": [],
    }


def test_view_valid_layout_and_name():
    """T-VIEW-R30-001-01: 合法 layout + name → validate_dashboard_view 成功。"""
    view = validate_dashboard_view({"name": "Main", "layout": _valid_layout()})
    assert view.name == "Main"
    assert view.layout.version == 1


def test_view_empty_widgets_allowed():
    """T-VIEW-R30-001-02: layout.widgets=[] → 200。"""
    view = validate_dashboard_view({"name": "Empty", "layout": {"version": 1, "widgets": [], "globalFilters": []}})
    assert view.layout.widgets == []


def test_view_invalid_chart_type():
    """T-VIEW-R30-001-03: 非法 chartType → 422。"""
    layout = _valid_layout()
    layout["widgets"][0]["chartConfig"]["chartType"] = "pie"
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Bad", "layout": layout})
    assert exc.value.status == 422


def test_view_unknown_chart_ref_via_chart_id():
    """T-VIEW-R30-001-04: chartConfig.chartId 指向不存在 widget → VIEW_UNKNOWN_CHART_REF。"""
    other = str(uuid.uuid4())
    layout = _valid_layout()
    layout["widgets"][0]["chartConfig"]["chartId"] = other
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Ref", "layout": layout})
    assert exc.value.code == "VIEW_UNKNOWN_CHART_REF"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_view_valid or test_view_empty or test_view_invalid_chart or test_view_unknown" -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.views'`

- [ ] **Step 3: 创建 `backend/app/views/schemas.py`**

```python
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.dashboard.schemas import DashboardLayout


class ViewError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 422,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class DashboardView(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    dashboard_id: uuid.UUID | None = Field(default=None, alias="dashboardId")
    default_view_id: uuid.UUID | None = Field(default=None, alias="defaultViewId")
    layout: DashboardLayout
```

- [ ] **Step 4: 创建 `backend/app/views/validate.py`**

```python
from __future__ import annotations

import uuid
from typing import Any

from pydantic import ValidationError

from app.dashboard.schemas import DashboardLayout
from app.dashboard.service import DashboardError, validate_layout
from app.views.schemas import DashboardView, ViewError


def _widget_id_set(layout: DashboardLayout) -> set[str]:
    return {str(w.id) for w in layout.widgets}


def _check_chart_refs(layout: DashboardLayout, raw_widgets: list[dict[str, Any]]) -> None:
    ids = _widget_id_set(layout)
    for widget, raw in zip(layout.widgets, raw_widgets, strict=False):
        chart_ref = raw.get("chartRef")
        if chart_ref is not None and str(chart_ref) not in ids:
            raise ViewError("VIEW_UNKNOWN_CHART_REF", "Unknown chartRef", 422, [{"field": "chartRef", "message": "Unknown chartRef"}])
        if widget.chart_config and widget.chart_config.chart_id is not None:
            cid = str(widget.chart_config.chart_id)
            wid = str(widget.id)
            if cid != wid and cid not in ids:
                raise ViewError(
                    "VIEW_UNKNOWN_CHART_REF",
                    "chartConfig.chartId references unknown widget",
                    422,
                    [{"field": "chartConfig.chartId", "message": "Unknown chart reference"}],
                )


def _check_default_view_id(view_id: uuid.UUID | None, default_view_id: uuid.UUID | None) -> None:
    if default_view_id is None:
        return
    if view_id is not None and default_view_id == view_id:
        raise ViewError(
            "VIEW_DEFAULT_SELF_REF",
            "defaultViewId cannot equal id",
            422,
            [{"field": "defaultViewId", "message": "Cannot reference self"}],
        )


def validate_layout_dict(layout: dict[str, Any]) -> dict[str, Any]:
    """Delegate to dashboard layout rules; used by dashboard.service."""
    return validate_layout(layout)


def validate_dashboard_view(data: dict[str, Any]) -> DashboardView:
    try:
        view = DashboardView.model_validate(data)
    except ValidationError as exc:
        fields = [{"field": ".".join(str(p) for p in err.get("loc", ())), "message": str(err.get("msg", ""))} for err in exc.errors()]
        raise ViewError("VIEW_INVALID_LAYOUT", "Invalid dashboard view", 422, fields) from exc

    _check_default_view_id(view.id, view.default_view_id)

    raw_widgets = data.get("layout", {}).get("widgets", [])
    try:
        normalized_layout = validate_layout(view.layout.model_dump(by_alias=True, mode="json"))
    except DashboardError as exc:
        raise ViewError(exc.code, exc.message, exc.status) from exc
    except Exception as exc:
        raise ViewError("VIEW_INVALID_LAYOUT", "Invalid layout", 422) from exc

    parsed_layout = DashboardLayout.model_validate(normalized_layout)
    _check_chart_refs(parsed_layout, raw_widgets if isinstance(raw_widgets, list) else [])
    return view.model_copy(update={"layout": parsed_layout})
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_view_valid or test_view_empty or test_view_invalid_chart or test_view_unknown" -v`
Expected: **4 passed**

- [ ] **Step 6: ruff**

Run: `cd backend && python3 -m ruff check app/views/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/views/ tests/test_view_gov_api_r30.py
git commit -m "feat(views): add DashboardView schema and validate service (VIEW-001)"
```

---

### Task 2: VIEW-001 — API 路由 + dashboard 委托 + defaultViewId 规则（VIEW-001 entry）

**Files:**
- Create: `backend/app/api/v1/views.py`
- Modify: `backend/app/dashboard/service.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_view_gov_api_r30.py`（VIEW API + DASH 回归段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: Task 1 `validate_dashboard_view`, `validate_layout_dict`
- Produces: `POST /api/v1/views/validate`；`dashboard.service.validate_layout` 改调 `views.validate.validate_layout_dict`

- [ ] **Step 1: 写失败测试**

追加到 `tests/test_view_gov_api_r30.py`：

```python
from app.main import app


@pytest.fixture(scope="module", autouse=True)
def r30_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R30_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
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


def test_view_default_view_self_ref():
    """T-VIEW-R30-001-05: defaultViewId == id → VIEW_DEFAULT_SELF_REF。"""
    vid = uuid.uuid4()
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(
            {"id": str(vid), "name": "Self", "defaultViewId": str(vid), "layout": _valid_layout()}
        )
    assert exc.value.code == "VIEW_DEFAULT_SELF_REF"


def test_views_validate_api_invalid(client):
    """T-VIEW-R30-001-06: POST /views/validate 非法 → 422 结构化 body。"""
    resp = client.post(
        "/api/v1/views/validate",
        headers=AUTH,
        json={"name": "Bad", "layout": {"version": 1, "widgets": [{"id": str(uuid.uuid4()), "type": "chart", "title": "X", "colSpan": 12}]}},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert "code" in body and "message" in body


def test_dashboard_layout_put_regression(client, db_session_unused=None):
    """T-VIEW-R30-001-07/08: PUT layout 合法 200；重复 widget → DASH_DUPLICATE_WIDGET。"""
    from app.dashboard.service import create_dashboard, update_layout

    dash = create_dashboard(name="R30 Dash")
    layout = _valid_layout()
    out = update_layout(dash.id, layout)
    assert out.layout_json["widgets"]
    dup = layout.copy()
    dup["widgets"] = [layout["widgets"][0], layout["widgets"][0]]
    resp = client.put(
        f"/api/v1/dashboards/{dash.id}/layout",
        headers=AUTH,
        json={"layoutJson": dup},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_DUPLICATE_WIDGET"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_view_default or test_views_validate_api or test_dashboard_layout_put" -v`
Expected: FAIL — 404 on `/api/v1/views/validate`

- [ ] **Step 3: 创建 `backend/app/api/v1/views.py`**

```python
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, get_current_user
from app.views.schemas import DashboardView, ViewError
from app.views.validate import validate_dashboard_view

router = APIRouter(prefix="/views", tags=["views", "IF-06"])


def _error_response(exc: ViewError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.post("/validate", response_model=DashboardView)
def validate_view(
    payload: dict,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DashboardView | JSONResponse:
    try:
        return validate_dashboard_view(payload)
    except ViewError as exc:
        return _error_response(exc)
```

- [ ] **Step 4: 修改 `dashboard/service.py` — 委托 views 层**

将 `validate_layout` 函数体替换为：

```python
from app.views.validate import validate_layout_dict as _views_validate_layout_dict


def validate_layout(layout: dict[str, Any]) -> dict[str, Any]:
    return _views_validate_layout_dict(layout)
```

删除 `_validate_layout_business` 的重复调用链已由 `validate_layout_dict` → `validate_layout` 保留；**保留** `_validate_layout_business` 与 `_normalize_widget_orders` 在 `validate_layout` 原实现中 — 实际委托方案：`validate_layout_dict` 内部调用现有 `validate_layout` 逻辑。修正 Task 1 validate.py：

`validate_layout_dict` 应包含原 `dashboard/service.py` 的完整逻辑（提取 `_validate_layout_business` 调用），`dashboard.service.validate_layout` 仅 `return validate_layout_dict(layout)`。

在 Task 2 Step 4 同时更新 `views/validate.py`：

```python
def validate_layout_dict(layout: dict[str, Any]) -> dict[str, Any]:
    from app.dashboard.service import _normalize_widget_orders, _validate_layout_business
    from app.schemas.chart_view import ChartViewError, validate_chart_view_config

    parsed = DashboardLayout.model_validate(layout)
    _validate_layout_business(parsed)
    parsed.widgets = _normalize_widget_orders(list(parsed.widgets))
    for widget in parsed.widgets:
        if widget.type == "chart" and widget.chart_config is not None:
            validate_chart_view_config(
                widget.chart_config.model_dump(by_alias=True, mode="json"),
            )
    return parsed.model_dump(by_alias=True, mode="json")
```

`dashboard/service.py` 中 `validate_layout` 改为：

```python
from app.views.validate import validate_layout_dict

def validate_layout(layout: dict[str, Any]) -> dict[str, Any]:
    return validate_layout_dict(layout)
```

- [ ] **Step 5: 注册路由 `router.py`**

```python
from app.api.v1.views import router as views_router
# ...
api_v1_router.include_router(views_router)
```

- [ ] **Step 6: 运行 VIEW + r29 回归**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "view" -v && python3 -m pytest tests/test_viz_dash_quality_r29.py -v`
Expected: VIEW 7 passed；r29 全绿

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/v1/views.py backend/app/api/v1/router.py backend/app/dashboard/service.py backend/app/views/validate.py tests/test_view_gov_api_r30.py
git commit -m "feat(views): add POST /views/validate and delegate dashboard layout validation"
```

---

### Task 3: GOV-001 — Migration 0014 + catalog ORM 模型

**Files:**
- Create: `backend/migrations/versions/0014_gov_catalog.py`
- Create: `backend/app/governance/__init__.py`
- Create: `backend/app/governance/catalog/__init__.py`
- Create: `backend/app/governance/catalog/models.py`
- Modify: `tests/test_migrations.py`（T-MIG-43/44）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `CatalogCategory`, `CatalogEntry`, `BusRegistration` ORM；revision `0014` head

- [ ] **Step 1: 写 migration 测试**

在 `tests/test_migrations.py` 末尾追加：

```python
def test_revision_chain_head_0014_down_revision_t_mig43():
    """T-MIG-43: heads 含 0014；0014.down_revision==0013。"""
    versions_dir = Path(__file__).resolve().parents[1] / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in versions_dir.glob("*.py"):
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert heads == ["0014"]
    assert revisions["0014"] == "0013"


def test_alembic_upgrade_head_sql_contains_catalog_tables_t_mig44():
    """T-MIG-44: upgrade head --sql 含 catalog_categories 与 bus_registrations。"""
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "catalog_categories" in result.stdout
    assert "bus_registrations" in result.stdout
```

同时更新 `test_revision_directory_single_head_chain` 中 revision 集合加入 `"0014"`，head 断言改为 `["0014"]`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_migrations.py -k "t_mig43 or t_mig44" -v`
Expected: FAIL

- [ ] **Step 3: 创建 `backend/migrations/versions/0014_gov_catalog.py`**

```python
"""gov catalog + bus_registrations

Revision ID: 0014
Revises: 0013
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_CATEGORIES = [
    ("CAT-01", "实体生命周期查询类", "entity", "附录 E 实体类"),
    ("CAT-02", "统计分析聚合类", "aggregate", "附录 E 聚合类"),
    ("CAT-03", "地域维度查询类", "geo", "附录 E 地域类"),
]


def upgrade() -> None:
    op.create_table(
        "catalog_categories",
        sa.Column("code", sa.String(16), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
    )
    op.create_table(
        "catalog_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("http_method", sa.String(8), nullable=False),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("category_codes", sa.JSON(), nullable=False),
        sa.Column("openapi_operation_id", sa.String(128), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "bus_registrations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("catalog_entry_id", sa.Uuid(), sa.ForeignKey("catalog_entries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("trace_id", sa.String(64), nullable=False),
        sa.Column("bus_payload", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    categories = sa.table(
        "catalog_categories",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("kind", sa.String),
    )
    op.bulk_insert(
        categories,
        [{"code": c, "name": n, "description": d, "kind": k} for c, n, k, d in SEED_CATEGORIES],
    )


def downgrade() -> None:
    op.drop_table("bus_registrations")
    op.drop_table("catalog_entries")
    op.drop_table("catalog_categories")
```

- [ ] **Step 4: 创建 `backend/app/governance/catalog/models.py`**

```python
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base

VALID_CATEGORY_CODES = frozenset({"CAT-01", "CAT-02", "CAT-03"})


class CatalogCategory(Base):
    __tablename__ = "catalog_categories"
    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)


class CatalogEntry(Base):
    __tablename__ = "catalog_entries"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    http_method: Mapped[str] = mapped_column(String(8), nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    category_codes: Mapped[list] = mapped_column(JSON, nullable=False)
    openapi_operation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BusRegistration(Base):
    __tablename__ = "bus_registrations"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    catalog_entry_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("catalog_entries.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False)
    bus_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 5: 运行 migration 测试**

Run: `cd backend && python3 -m pytest tests/test_migrations.py -k "t_mig43 or t_mig44 or revision_directory" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/versions/0014_gov_catalog.py backend/app/governance/ tests/test_migrations.py
git commit -m "feat(governance): add catalog migration 0014 and ORM models (GOV-001)"
```

---

### Task 4: GOV-001 — catalog 服务 + API 路由

**Files:**
- Create: `backend/app/governance/catalog/service.py`
- Create: `backend/app/governance/catalog/schemas.py`
- Create: `backend/app/api/v1/gov.py`（catalog 段）
- Modify: `backend/app/api/v1/router.py`
- Test: `tests/test_view_gov_api_r30.py`（GOV-001 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `CatalogError`, `list_categories`, `list_entries`, `create_entry`, `get_entry`；`GET/POST /api/v1/gov/catalog/*`

- [ ] **Step 1: 写失败测试**

```python
def test_gov_categories_three(client):
    """T-GOV-R30-001-01: GET categories → 恰好 3 条 CAT-01/02/03。"""
    resp = client.get("/api/v1/gov/catalog/categories", headers=AUTH)
    assert resp.status_code == 200
    codes = {item["code"] for item in resp.json()["items"]}
    assert codes == {"CAT-01", "CAT-02", "CAT-03"}


def test_gov_create_entry_ok(client):
    """T-GOV-R30-001-02: POST entry categoryCodes CAT-02 → 201。"""
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Aggregate stats",
            "httpMethod": "GET",
            "path": "/api/v1/stats/aggregate",
            "categoryCodes": ["CAT-02"],
            "status": "active",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["categoryCodes"] == ["CAT-02"]


def test_gov_create_entry_invalid_category(client):
    """T-GOV-R30-001-03: categoryCodes CAT-99 → 400 CATALOG_INVALID_CATEGORY。"""
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={"name": "Bad", "httpMethod": "GET", "path": "/x", "categoryCodes": ["CAT-99"]},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "CATALOG_INVALID_CATEGORY"


def test_gov_list_entries_filter(client):
    """T-GOV-R30-001-04: GET entries ?category=CAT-01 过滤。"""
    client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={"name": "E1", "httpMethod": "GET", "path": "/api/v1/entities/x", "categoryCodes": ["CAT-01"], "status": "active"},
    )
    client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={"name": "E2", "httpMethod": "GET", "path": "/api/v1/stats", "categoryCodes": ["CAT-02"], "status": "active"},
    )
    resp = client.get("/api/v1/gov/catalog/entries?category=CAT-01", headers=AUTH)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert "CAT-01" in item["categoryCodes"]
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_gov_" -v`
Expected: FAIL — 404

- [ ] **Step 3: 创建 `governance/catalog/schemas.py` 与 `service.py`**

`schemas.py` 含 `CatalogEntryCreate`（alias camelCase）、`CatalogEntryOut`、`CatalogCategoryOut`、`CatalogListResponse`；`service.py` 含：

```python
class CatalogError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code, self.message, self.status = code, message, status
        super().__init__(message)

def list_categories(db: Session) -> list[CatalogCategoryOut]: ...
def create_entry(db: Session, payload: CatalogEntryCreate) -> CatalogEntryOut:
    invalid = set(payload.category_codes) - VALID_CATEGORY_CODES
    if invalid:
        raise CatalogError("CATALOG_INVALID_CATEGORY", f"Unknown categories: {sorted(invalid)}", 400)
    ...
def list_entries(db: Session, *, category: str | None, limit: int, offset: int) -> CatalogListResponse: ...
def get_entry(db: Session, entry_id: uuid.UUID) -> CatalogEntryOut: ...
```

- [ ] **Step 4: 创建 `api/v1/gov.py` catalog 路由**

```python
router = APIRouter(prefix="/gov", tags=["governance", "IF-06"])

@router.get("/catalog/categories")
def list_catalog_categories(...): ...

@router.get("/catalog/entries")
def list_catalog_entries(category: str | None = None, ...): ...

@router.post("/catalog/entries", status_code=201)
def create_catalog_entry(...): ...

@router.get("/catalog/entries/{entry_id}")
def get_catalog_entry(...): ...
```

错误响应 `_catalog_error_response` 返回 `{"code","message","detail":null}`。

- [ ] **Step 5: `router.py` 注册 `gov_router`**

- [ ] **Step 6: 运行 GOV-001 测试**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_gov_" -v`
Expected: **5 passed**

- [ ] **Step 7: Commit**

```bash
git add backend/app/governance/catalog/ backend/app/api/v1/gov.py backend/app/api/v1/router.py tests/test_view_gov_api_r30.py
git commit -m "feat(governance): add catalog categories and entries API (GOV-001)"
```

---

### Task 5: GOV-002 — BusPoCAdapter + 半自动注册 API

**Files:**
- Create: `backend/app/governance/bus/__init__.py`
- Create: `backend/app/governance/bus/poc.py`
- Modify: `backend/app/governance/catalog/service.py`（`register_entry_to_bus`）
- Modify: `backend/app/api/v1/gov.py`（bus 段）
- Test: `tests/test_view_gov_api_r30.py`（GOV-002 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `BusPoCAdapter` Protocol, `InMemoryBusPoCAdapter`, `POST /api/v1/gov/bus/register`

- [ ] **Step 1: 写失败测试**

```python
def _create_entry(client, *, path: str, status: str = "active") -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={"name": "Reg", "httpMethod": "POST", "path": path, "categoryCodes": ["CAT-01"], "status": status},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_bus_register_active_succeeded(client):
    """T-GOV-R30-002-01: active entry → 201 status=succeeded + traceId。"""
    eid = _create_entry(client, path="/api/v1/query/execute")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "succeeded"
    assert body["traceId"]


def test_bus_register_draft_not_publishable(client):
    """T-GOV-R30-002-02: draft → 400 BUS_ENTRY_NOT_PUBLISHABLE。"""
    eid = _create_entry(client, path="/api/v1/x", status="draft")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 400
    assert resp.json()["code"] == "BUS_ENTRY_NOT_PUBLISHABLE"


def test_bus_register_not_found(client):
    """T-GOV-R30-002-03: 不存在 entryId → 404 CATALOG_ENTRY_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/gov/bus/register",
        headers=AUTH,
        json={"catalogEntryId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CATALOG_ENTRY_NOT_FOUND"


def test_bus_register_force_fail(client):
    """T-GOV-R30-002-04: path 含 force-fail → 502 BUS_REGISTRATION_REJECTED。"""
    eid = _create_entry(client, path="/api/v1/force-fail/demo")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 502
    assert resp.json()["code"] == "BUS_REGISTRATION_REJECTED"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_bus_" -v`
Expected: FAIL — 404

- [ ] **Step 3: 创建 `governance/bus/poc.py`**

```python
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from app.governance.catalog.schemas import CatalogEntryOut


@dataclass(frozen=True)
class BusRegisterResult:
    status: str  # succeeded | failed
    bus_id: str | None = None
    registered_at: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    bus_payload: dict | None = None


class BusPoCAdapter(Protocol):
    def register(self, *, entry: CatalogEntryOut, trace_id: str) -> BusRegisterResult: ...


class InMemoryBusPoCAdapter:
    def register(self, *, entry: CatalogEntryOut, trace_id: str) -> BusRegisterResult:
        if entry.status == "draft":
            return BusRegisterResult(status="failed", error_code="BUS_ENTRY_NOT_PUBLISHABLE", error_message="Draft entry")
        if "force-fail" in entry.path:
            return BusRegisterResult(status="failed", error_code="BUS_REGISTRATION_REJECTED", error_message="Bus rejected")
        bus_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        return BusRegisterResult(
            status="succeeded",
            bus_id=bus_id,
            registered_at=now,
            bus_payload={"busId": bus_id, "registeredAt": now, "traceId": trace_id},
        )
```

- [ ] **Step 4: catalog service 增 `register_entry_to_bus`**

使用 `trace_id_var.get()` 写入 `bus_registrations`；draft → `CatalogError("BUS_ENTRY_NOT_PUBLISHABLE", ..., 400)`；adapter failed → 502 `BUS_REGISTRATION_REJECTED` 或 `BUS_REGISTRATION_FAILED`。

- [ ] **Step 5: `gov.py` 增路由**

```python
@router.post("/bus/register", status_code=201)
def register_bus(payload: BusRegisterIn, ...):
    ...
```

响应 camelCase：`{id, status, traceId, busResponse?}`。

- [ ] **Step 6: 运行 GOV-002 测试**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_bus_" -v`
Expected: **4+ passed**

- [ ] **Step 7: Commit**

```bash
git add backend/app/governance/bus/ backend/app/governance/catalog/service.py backend/app/api/v1/gov.py tests/test_view_gov_api_r30.py
git commit -m "feat(governance): add bus PoC register API (GOV-002)"
```

---

### Task 6: API-001/002 — IF-06 OpenAPI 扩展 + 路由元数据

**Files:**
- Create: `backend/app/openapi/__init__.py`
- Create: `backend/app/openapi/extensions.py`
- Modify: `backend/app/core/config.py`（`api_openapi_version: str = "0.1.0"`）
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/v1/datasources.py`
- Modify: `backend/app/api/v1/query.py`
- Test: `tests/test_view_gov_api_r30.py`（API 段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `customize_openapi(app) -> dict`；IF-06 tags + operationId 前缀 + 示例

- [ ] **Step 1: 写失败测试**

```python
def test_openapi_datasources_if06_paths(client):
    """T-API-R30-001-01/02: OpenAPI 含 datasources CRUD + IF-06 tag。"""
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/datasources" in paths
    post_op = paths["/api/v1/datasources"]["post"]
    assert "IF-06" in post_op.get("tags", [])
    assert post_op.get("operationId", "").startswith("if06.datasources.")


def test_openapi_info_version(client):
    """T-API-R30-001-04: info.version 存在。"""
    spec = client.get("/openapi.json").json()
    assert "version" in spec["info"]


def test_openapi_query_execute_if06(client):
    """T-API-R30-002-01/02: execute 路径 + requestBody 示例。"""
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/api/v1/query/execute"]["post"]
    assert "IF-06" in op.get("tags", [])
    assert op.get("operationId") == "if06.query.execute"
    assert "requestBody" in op


def test_datasources_list_smoke(client):
    """T-API-R30-001-03: GET /datasources 200 Bearer dev。"""
    resp = client.get("/api/v1/datasources", headers=AUTH)
    assert resp.status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_openapi or test_datasources_list" -v`
Expected: FAIL — no IF-06 tag

- [ ] **Step 3: 创建 `openapi/extensions.py`**

```python
from __future__ import annotations

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from app.core.config import get_settings

IF06_DATASOURCE_PREFIX = "/api/v1/datasources"
IF06_QUERY_EXECUTE = "/api/v1/query/execute"


def customize_openapi(app: FastAPI) -> dict:
    if app.openapi_schema:
        return app.openapi_schema
    settings = get_settings()
    schema = get_openapi(
        title=app.title,
        version=settings.api_openapi_version,
        description="VitalSpan REST API. All business routes are under /api/v1/. Breaking changes bump major OpenAPI version.",
        routes=app.routes,
    )
    for path, methods in schema.get("paths", {}).items():
        for verb, op in methods.items():
            if path.startswith(IF06_DATASOURCE_PREFIX):
                tags = list(op.get("tags") or [])
                if "IF-06" not in tags:
                    tags.append("IF-06")
                op["tags"] = tags
                op_id = op.get("operationId") or ""
                if not op_id.startswith("if06."):
                    op["operationId"] = f"if06.datasources.{op_id or verb}"
            if path == IF06_QUERY_EXECUTE and verb == "post":
                tags = list(op.get("tags") or [])
                if "IF-06" not in tags:
                    tags.append("IF-06")
                op["tags"] = tags
                op["operationId"] = "if06.query.execute"
    schema["info"]["version"] = settings.api_openapi_version
    app.openapi_schema = schema
    return schema
```

- [ ] **Step 4: `config.py` 增字段**

```python
api_openapi_version: str = "0.1.0"
```

- [ ] **Step 5: `main.py` 挂载**

```python
from app.openapi.extensions import customize_openapi

def _openapi():
    return customize_openapi(app)

app.openapi = _openapi
```

- [ ] **Step 6: `datasources.py` / `query.py` 增 `summary` 与 `openapi_extra`**

`POST /datasources` 增 `openapi_extra` 示例（mysql，password `***`）；`POST /execute` 增 sql/table 请求示例与响应 description（`QUERY_NOT_READONLY` 400、403 不可见数据源）。

- [ ] **Step 7: 运行 API OpenAPI 测试**

Run: `cd backend && python3 -m pytest tests/test_view_gov_api_r30.py -k "test_openapi or test_datasources_list" -v`
Expected: **5 passed**

- [ ] **Step 8: Commit**

```bash
git add backend/app/openapi/ backend/app/core/config.py backend/app/main.py backend/app/api/v1/datasources.py backend/app/api/v1/query.py tests/test_view_gov_api_r30.py
git commit -m "feat(api): IF-06 OpenAPI extensions for datasources and query execute (API-001/002)"
```

---

### Task 7: 集成测试补齐 + execute 回归 + 文档同步

**Files:**
- Modify: `tests/test_view_gov_api_r30.py`（API-002 execute 回归段）
- Modify: `docs/services/views.md`
- Create: `docs/services/governance.md`
- Modify: `docs/services/README.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.cursor/rules/prd-sync.mdc`（触及 docs/）

**UI skill:** none

- [ ] **Step 1: 补齐 execute 回归测试**

```python
@patch("app.query.service.execute_query")
def test_query_execute_openapi_smoke(mock_execute, client):
    """T-API-R30-002-03: POST /execute mock → 200。"""
    from app.query.schemas import ExecuteResponse

    mock_execute.return_value = ExecuteResponse(columns=["c"], rows=[["v"]], row_count=1, trace_id="t")
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200


def test_query_execute_forbidden_data_source(client):
    """T-API-R30-002-04: 不可见 dataSource → 403。"""
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "SELECT 1"},
    )
    assert resp.status_code in (403, 404)


def test_query_execute_not_readonly(client):
    """T-API-R30-002-05: INSERT → 400 QUERY_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "INSERT INTO t VALUES (1)"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "QUERY_NOT_READONLY"
```

- [ ] **Step 2: 更新 `docs/services/views.md`**

状态改为 **部分（L1）**；登记 `DashboardView`、`validate_dashboard_view`、`POST /api/v1/views/validate`；锚点 VIEW-001。

- [ ] **Step 3: 创建 `docs/services/governance.md`**

含 catalog 三分法、bus PoC adapter、依赖 `datasources`/`query`；边界 In/Out；状态 **部分（L1）**。

- [ ] **Step 4: 更新 `docs/api/README.md`**

登记：
- `POST /api/v1/views/validate` — VIEW-001 — 已实现
- `GET /api/v1/gov/catalog/categories` 等 gov 路由 — GOV-001 — 已实现
- `POST /api/v1/gov/bus/register` — GOV-002 — 已实现
- `/openapi.json` 状态 → **已实现**（IF-06 tag 对齐 API-001/002）

- [ ] **Step 5: 更新 `docs/services/README.md`**

`views.md` 状态 → 部分；`governance.md` 状态 → 部分。

- [ ] **Step 6: 全量验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v`
Expected: **≥660 passed**, 2 skipped；`test_view_gov_api_r30.py` ≥30 passed；`test_viz_dash_quality_r29.py` + `test_viz_dash_l1_r28.py` 全绿

- [ ] **Step 7: Commit**

```bash
git add tests/test_view_gov_api_r30.py docs/services/views.md docs/services/governance.md docs/services/README.md docs/api/README.md
git commit -m "test(docs): r30 integration tests and VIEW/GOV/API documentation sync"
```

---

## Spec Self-Review

| 子项 | 对应 Task | 覆盖 |
|------|-----------|------|
| VIEW-001 | Task 1–2, 7 | DashboardView schema/validate/API + DASH 委托 + 8 pytest |
| GOV-001 | Task 3–4, 7 | 三分法 migration/ORM/CRUD/list + 5 pytest |
| GOV-002 | Task 5, 7 | BusPoCAdapter + register API + 4+ pytest |
| API-001 | Task 6–7 | IF-06 datasources OpenAPI + smoke |
| API-002 | Task 6–7 | execute OpenAPI + 403/只读回归 |

- 文件数 **20 ≤ 20**；无 TBD/TODO；全 Task **UI skill: none**
- migration 使用 **0014**（修正 design 中 0013 与 dashboards 冲突）
