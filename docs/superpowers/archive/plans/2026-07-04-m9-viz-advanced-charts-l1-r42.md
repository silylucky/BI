# M9 可视化高级图表类型 L1 kickoff 实现计划 — VIZ-003/004/005/006/008

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/viz/` (新域) · `backend/app/schemas/chart_view.py` · `backend/app/api/v1/charts.py` · `tests/test_viz_advanced_l1_r42.py` · `tests/test_viz_dash_l1_r28.py` · `tests/test_view_gov_api_r30.py` · `docs/services/viz.md` · `docs/services/README.md` · `docs/api/README.md`
> **子项：** VIZ-003, VIZ-004, VIZ-005, VIZ-006, VIZ-008
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 以后端 chart-spec 契约层交付 M9 高级图表类型 L1 骨架 —— `ChartTypeRegistry`（9 类型注册表）+ 样式/字段校验 registry 驱动 + render-spec 归一 + embed 配置契约 + ≥30 条 pytest smoke。

**Architecture:** 新增 domain 域 `backend/app/viz/`（无 HTTP，可复用规则），镜像 `datasources/registry.py` 的注册表模式。`schemas/chart_view.py`（shared 契约）校验改为 registry 驱动，通过**函数内惰性 import** 消除 shared→domain import-time 反向依赖（与 `views/validate.py` 一致）。`api/v1/charts.py`（entry，薄）新增 3 路由。纯后端、全内存单测、无 mock 驱动、无新 Alembic migration。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / dataclass(frozen) / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/` 任何文件、真实 ECharts/AntV 渲染、iframe 页面、SDK（VIZ-007）；`ui_design_skill: none`。
- **零第三方 BI 运行时依赖**（NFR-08）：禁止引入 Superset/DataEase。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不新增** Alembic migration（无新持久化模型）；不扩展 `ChartViewConfig` 数据字段（dimensions/metrics/filters 结构不变）。
- **分层纪律**（`common.mdc`）：`app/viz/` = domain（无 HTTP）；`api/v1/charts.py` = entry（仅解析→调用→响应）；`schemas/chart_view.py` = shared（校验查 registry 用**函数内惰性 import**，禁止 module-level `from app.viz ...`）。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行；同目录手写源 ≤12 个。
- **错误体**：`{code, message, detail}`；`detail.fields=[{field, message}]`；校验失败 HTTP 422；未鉴权 401。
- **鉴权**：所有新路由 `Depends(get_current_user)`，沿用 `Bearer dev`（开发）。
- **真理源优先级**：`round-target` > `prd.md` hub > `prd/F06-VIZ.md` > `docs/services/` > `docs/api/`。VIZ-006 以 PRD 字面「iframe 嵌入门户」为准，本轮交付后端嵌入配置契约骨架。
- **P4 blocker**：注册 `pie` 后须修复 r28/r30 用 `pie` 作「非法 type」的回归样例 → 改用未注册 `radar`（Task 7，禁止从 registry 移除 pie 迁就测试）。
- **验证基线**：现 `pytest ../tests -q` = 1003 passed / 4 skipped；本轮目标 **≥1033 passed** + 4 skipped，零失败，`ruff` clean。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/viz/__init__.py` | 域导出；import 时 `register_builtin_chart_types()` | 新建 |
| `backend/app/viz/specs.py` | `FieldRule` / `ChartTypeSpec` frozen dataclass | 新建 |
| `backend/app/viz/registry.py` | `ChartTypeRegistry` + `get_spec` + `export_chart_type_catalog` | 新建 |
| `backend/app/viz/builtin.py` | 9 类型骨架 + `register_builtin_chart_types()` | 新建 |
| `backend/app/viz/render.py` | `build_render_spec()` 归一映射（VIZ-008） | 新建 |
| `backend/app/viz/embed.py` | `ChartEmbedConfig` + `ChartEmbedError` + validate（VIZ-006） | 新建 |
| `backend/app/schemas/chart_view.py` | 校验改 registry 驱动（VIZ-004/005） | 修改 |
| `backend/app/api/v1/charts.py` | +3 路由（VIZ-003/006/008） | 修改 |
| `tests/test_viz_advanced_l1_r42.py` | 新套件 ≥30 断言 | 新建 |
| `tests/test_viz_dash_l1_r28.py` | 回归修复 3 处 `pie`→`radar` | 修改 |
| `tests/test_view_gov_api_r30.py` | 回归修复 1 处 `pie`→`radar` | 修改 |
| `docs/services/viz.md` | viz 域附录 | 新建（Task 8） |
| `docs/services/README.md` | 域索引增 viz 行 | 修改（Task 8） |
| `docs/api/README.md` | 登记 3 新路由 | 修改（Task 8） |

预估文件数 **14 ≤ 20**（`main.py` 无需改：`charts_router` 已在 `api/v1/router.py` 注册；`charts.py` import `app.viz.*` 触发 registry 注册）。

---

## Task 1: viz 域数据类与注册表（VIZ-003 核心）

**Files:**
- Create: `backend/app/viz/specs.py`
- Create: `backend/app/viz/registry.py`
- Test: `tests/test_viz_advanced_l1_r42.py`（本 Task 建文件 + 003-03/04/05 单测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`（Pydantic/域分层约定）
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Produces:
  - `FieldRule(min_dimensions:int=0, max_dimensions:int=8, min_metrics:int=0, max_metrics:int=8, note:str="")` — frozen dataclass
  - `ChartTypeSpec(type:str, display_name:str, category:str, renderer:str, capabilities:tuple[str,...]=(), style_variants:tuple[str,...]=("default",), field_rule:FieldRule=FieldRule())` — frozen dataclass
  - `ChartTypeRegistry` with `register(spec)`, `get(type)->ChartTypeSpec`, `has(type)->bool`, `list_specs()->list[ChartTypeSpec]`
  - `ChartTypeNotRegistered(KeyError)`, `ChartTypeAlreadyRegisteredError(ValueError)`
  - module singleton `registry`; `get_spec(type)->ChartTypeSpec`; `export_chart_type_catalog()->list[dict]`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_viz_advanced_l1_r42.py
"""M9 viz advanced chart types L1 kickoff r42 smoke — VIZ-003/004/005/006/008."""
from __future__ import annotations

import uuid

import pytest

from app.viz.registry import (
    ChartTypeAlreadyRegisteredError,
    ChartTypeNotRegistered,
    ChartTypeRegistry,
    get_spec,
)
from app.viz.specs import ChartTypeSpec, FieldRule


def test_registry_register_get_roundtrip():
    """T-VIZ-R42-003-03(unit): 自定义 registry register→get 往返。"""
    reg = ChartTypeRegistry()
    spec = ChartTypeSpec(
        type="custom_x",
        display_name="自定义",
        category="advanced",
        renderer="echarts",
        field_rule=FieldRule(min_dimensions=1, max_dimensions=1),
    )
    reg.register(spec)
    assert reg.get("custom_x").category == "advanced"
    assert reg.has("custom_x") is True


def test_registry_duplicate_raises():
    """T-VIZ-R42-003-05a: 重复 type register → AlreadyRegistered。"""
    reg = ChartTypeRegistry()
    spec = ChartTypeSpec(type="dup", display_name="d", category="basic", renderer="table")
    reg.register(spec)
    with pytest.raises(ChartTypeAlreadyRegisteredError):
        reg.register(spec)


def test_get_spec_unknown_raises():
    """T-VIZ-R42-003-04: get_spec 未注册 → ChartTypeNotRegistered。"""
    with pytest.raises(ChartTypeNotRegistered):
        get_spec("no_such_type_xyz")


def test_builtin_get_spec_category():
    """T-VIZ-R42-003-03: builtin sankey category=flow（依赖 Task 2 注册）。"""
    assert get_spec("sankey").category == "flow"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.viz'`

- [ ] **Step 3: Write `specs.py`**

```python
# backend/app/viz/specs.py
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FieldRule:
    min_dimensions: int = 0
    max_dimensions: int = 8
    min_metrics: int = 0
    max_metrics: int = 8
    note: str = ""


@dataclass(frozen=True)
class ChartTypeSpec:
    type: str
    display_name: str
    category: str
    renderer: str
    capabilities: tuple[str, ...] = ()
    style_variants: tuple[str, ...] = ("default",)
    field_rule: FieldRule = field(default_factory=FieldRule)
```

- [ ] **Step 4: Write `registry.py`**

```python
# backend/app/viz/registry.py
from __future__ import annotations

import threading

from app.viz.specs import ChartTypeSpec


class ChartTypeNotRegistered(KeyError):
    pass


class ChartTypeAlreadyRegisteredError(ValueError):
    pass


class ChartTypeRegistry:
    def __init__(self) -> None:
        self._specs: dict[str, ChartTypeSpec] = {}
        self._lock = threading.RLock()

    def register(self, spec: ChartTypeSpec) -> None:
        with self._lock:
            if spec.type in self._specs:
                raise ChartTypeAlreadyRegisteredError(
                    f"chart type already registered: {spec.type}"
                )
            self._specs[spec.type] = spec

    def get(self, type: str) -> ChartTypeSpec:
        with self._lock:
            try:
                return self._specs[type]
            except KeyError as exc:
                raise ChartTypeNotRegistered(type) from exc

    def has(self, type: str) -> bool:
        with self._lock:
            return type in self._specs

    def list_specs(self) -> list[ChartTypeSpec]:
        with self._lock:
            return list(self._specs.values())


registry = ChartTypeRegistry()


def get_spec(type: str) -> ChartTypeSpec:
    return registry.get(type)


def export_chart_type_catalog() -> list[dict]:
    return [
        {
            "type": s.type,
            "displayName": s.display_name,
            "category": s.category,
            "renderer": s.renderer,
            "styleVariants": list(s.style_variants),
            "capabilities": list(s.capabilities),
            "fieldRule": {
                "minDimensions": s.field_rule.min_dimensions,
                "maxDimensions": s.field_rule.max_dimensions,
                "minMetrics": s.field_rule.min_metrics,
                "maxMetrics": s.field_rule.max_metrics,
                "note": s.field_rule.note,
            },
        }
        for s in registry.list_specs()
    ]
```

- [ ] **Step 5: Run partial tests to verify they pass**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "roundtrip or duplicate or unknown"`
Expected: 3 PASS（`test_builtin_get_spec_category` 仍 FAIL —— builtin 尚未注册，Task 2 补齐）

- [ ] **Step 6: Commit**

```bash
git add backend/app/viz/specs.py backend/app/viz/registry.py tests/test_viz_advanced_l1_r42.py
git commit -m "feat(viz): add ChartTypeSpec/FieldRule dataclasses and ChartTypeRegistry (VIZ-003)"
```

---

## Task 2: 9 类型骨架注册 + 域导出（VIZ-003 catalog）

**Files:**
- Create: `backend/app/viz/builtin.py`
- Create: `backend/app/viz/__init__.py`
- Test: `tests/test_viz_advanced_l1_r42.py`（追加 catalog 断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**Interfaces:**
- Consumes: `ChartTypeSpec`, `FieldRule`, `registry`, `ChartTypeAlreadyRegisteredError`, `export_chart_type_catalog`（Task 1）
- Produces: `register_builtin_chart_types()`（幂等）；`app.viz` 包 import 时自动调用一次

**注册表 9 条目**（type / display / category / renderer / style_variants / dims / metrics）：
`table`表格/basic/table/(default)/0-8/0-8 · `line`折线图/basic/echarts/(default,area,smooth)/1-8/1-8 · `bar`柱状图/basic/echarts/(default,stacked,grouped,horizontal)/1-8/1-8 · `pie`饼图/basic/echarts/(default,donut)/1-1/1-1 · `gauge`仪表盘/advanced/echarts/(default)/0-0/1-1 · `map`地图/geo/echarts/(default)/1-1/1-1 · `sankey`桑基图/flow/echarts/(default)/2-2/1-1 · `funnel`漏斗图/flow/echarts/(default)/1-1/1-1 · `graph`关系图/relation/echarts/(default)/2-2/0-1。

- [ ] **Step 1: Write the failing test（追加到 `tests/test_viz_advanced_l1_r42.py` 末尾）**

```python
from app.viz.registry import export_chart_type_catalog
from app.viz.builtin import register_builtin_chart_types


def test_catalog_has_nine_types_with_shape():
    """T-VIZ-R42-003-01: catalog 含 9 类型，每项字段齐备。"""
    catalog = export_chart_type_catalog()
    types = {c["type"] for c in catalog}
    assert {"table", "line", "bar", "pie", "gauge", "map", "sankey", "funnel", "graph"} <= types
    for item in catalog:
        for key in ("type", "displayName", "category", "renderer", "styleVariants", "fieldRule"):
            assert key in item, key


def test_catalog_has_advanced_types():
    """T-VIZ-R42-003-02: 高级类型 sankey/graph/map/funnel/gauge/pie 出现。"""
    types = {c["type"] for c in export_chart_type_catalog()}
    assert {"sankey", "graph", "map", "funnel", "gauge", "pie"} <= types


def test_register_builtin_idempotent():
    """T-VIZ-R42-003-06: register_builtin_chart_types 幂等，二次调用不抛。"""
    register_builtin_chart_types()
    register_builtin_chart_types()
    assert get_spec("bar").renderer == "echarts"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "catalog or idempotent or category"`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.viz.builtin'`

- [ ] **Step 3: Write `builtin.py`**

```python
# backend/app/viz/builtin.py
from __future__ import annotations

from app.viz.registry import ChartTypeAlreadyRegisteredError, registry
from app.viz.specs import ChartTypeSpec, FieldRule

_CAPS = ("style_variant", "field_config", "render_spec")

_BUILTIN_SPECS: tuple[ChartTypeSpec, ...] = (
    ChartTypeSpec("table", "表格", "basic", "table", _CAPS, ("default",), FieldRule(0, 8, 0, 8)),
    ChartTypeSpec("line", "折线图", "basic", "echarts", _CAPS, ("default", "area", "smooth"), FieldRule(1, 8, 1, 8)),
    ChartTypeSpec("bar", "柱状图", "basic", "echarts", _CAPS, ("default", "stacked", "grouped", "horizontal"), FieldRule(1, 8, 1, 8)),
    ChartTypeSpec("pie", "饼图", "basic", "echarts", _CAPS, ("default", "donut"), FieldRule(1, 1, 1, 1)),
    ChartTypeSpec("gauge", "仪表盘", "advanced", "echarts", _CAPS, ("default",), FieldRule(0, 0, 1, 1)),
    ChartTypeSpec("map", "地图", "geo", "echarts", _CAPS, ("default",), FieldRule(1, 1, 1, 1)),
    ChartTypeSpec("sankey", "桑基图", "flow", "echarts", _CAPS, ("default",), FieldRule(2, 2, 1, 1, note="桑基图需 2 个维度（source,target）与 1 个度量")),
    ChartTypeSpec("funnel", "漏斗图", "flow", "echarts", _CAPS, ("default",), FieldRule(1, 1, 1, 1, note="漏斗图需 1 个维度与 1 个度量")),
    ChartTypeSpec("graph", "关系图", "relation", "echarts", _CAPS, ("default",), FieldRule(2, 2, 0, 1, note="关系图需 2 个维度（source,target）")),
)


def register_builtin_chart_types() -> None:
    for spec in _BUILTIN_SPECS:
        if registry.has(spec.type):
            continue
        try:
            registry.register(spec)
        except ChartTypeAlreadyRegisteredError:
            pass
```

- [ ] **Step 4: Write `__init__.py`（import 时注册；submodule-only import 避免包内循环）**

```python
# backend/app/viz/__init__.py
from __future__ import annotations

from app.viz.builtin import register_builtin_chart_types
from app.viz.registry import (
    ChartTypeAlreadyRegisteredError,
    ChartTypeNotRegistered,
    ChartTypeRegistry,
    export_chart_type_catalog,
    get_spec,
    registry,
)
from app.viz.specs import ChartTypeSpec, FieldRule

register_builtin_chart_types()

__all__ = [
    "ChartTypeAlreadyRegisteredError",
    "ChartTypeNotRegistered",
    "ChartTypeRegistry",
    "ChartTypeSpec",
    "FieldRule",
    "export_chart_type_catalog",
    "get_spec",
    "register_builtin_chart_types",
    "registry",
]
```

- [ ] **Step 5: Run Task 1 + Task 2 tests to verify all pass**

Run: `cd backend && python3 -m ruff check app/viz && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v`
Expected: all PASS（含 Task 1 的 `test_builtin_get_spec_category`）

- [ ] **Step 6: Commit**

```bash
git add backend/app/viz/builtin.py backend/app/viz/__init__.py tests/test_viz_advanced_l1_r42.py
git commit -m "feat(viz): register 9 builtin chart types + idempotent bootstrap (VIZ-003)"
```

---

## Task 3: `GET /charts/types` 入口（VIZ-003 entry）

**Files:**
- Modify: `backend/app/api/v1/charts.py`
- Test: `tests/test_viz_advanced_l1_r42.py`（追加 003-07/08）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`（entry 纪律、Depends 鉴权）

**Interfaces:**
- Consumes: `export_chart_type_catalog`（Task 1/2）；`get_current_user`, `UserContext`（既有）
- Produces: `GET /api/v1/charts/types` → 200 `list[dict]`（9 项 catalog）；无鉴权 401

- [ ] **Step 1: Write the failing test（追加到 `tests/test_viz_advanced_l1_r42.py`）**

```python
def test_get_charts_types_ok(client, auth_headers):
    """T-VIZ-R42-003-07: GET /charts/types → 200，9 项列表。"""
    resp = client.get("/api/v1/charts/types", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    types = {c["type"] for c in body}
    assert {"sankey", "funnel", "graph", "map", "gauge", "pie"} <= types


def test_get_charts_types_unauthorized(client, unauthorized_headers):
    """T-VIZ-R42-003-08: GET /charts/types 无有效鉴权 → 401。"""
    resp = client.get("/api/v1/charts/types", headers=unauthorized_headers)
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "charts_types"`
Expected: FAIL — `test_get_charts_types_ok` 得 404（路由未注册）

- [ ] **Step 3: Modify `charts.py`（新增 import 与 GET 路由）**

将顶部 import 块改为：

```python
from app.auth.deps import UserContext, get_current_user
from app.schemas.chart_view import ChartViewConfig, ChartViewError, validate_chart_view_config
from app.viz.registry import export_chart_type_catalog
```

在 `validate_chart` 路由**之前**新增：

```python
@router.get("/types")
def list_chart_types(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> list[dict]:
    return export_chart_type_catalog()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m ruff check app/api/v1/charts.py && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "charts_types"`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/charts.py tests/test_viz_advanced_l1_r42.py
git commit -m "feat(viz): add GET /charts/types catalog endpoint (VIZ-003)"
```

---

## Task 4: `chart_view.py` registry 驱动校验（VIZ-004 样式 + VIZ-005 字段）

**Files:**
- Modify: `backend/app/schemas/chart_view.py`
- Test: `tests/test_viz_advanced_l1_r42.py`（追加 004-* / 005-*）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`（Pydantic v2 model_validator、shared→domain 惰性 import）
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `get_spec`, `ChartTypeNotRegistered`（Task 1，函数内惰性 import）
- Produces: `ChartViewConfig`（`chart_type: str`、`style_variant: str`）；新码 `CHART_INVALID_STYLE_VARIANT`、`CHART_FIELD_REQUIREMENT`；保留 `CHART_INVALID_TYPE`/`CHART_MISSING_SERIES`/`CHART_MISSING_DATASOURCE`/`CHART_MISSING_SQL`/`CHART_MISSING_TABLE`/`CHART_MISSING_MODE`/`CHART_BINDING_CONFLICT` 语义与 fields 不变

**校验顺序**（固定）：1) `get_spec` 失败→`CHART_INVALID_TYPE` 2) style_variant→`CHART_INVALID_STYLE_VARIANT` 3) binding/datasource/mode 结构（不变） 4) 字段规则：binding-only 跳过；line/bar→`CHART_MISSING_SERIES`；其余→`CHART_FIELD_REQUIREMENT`。

- [ ] **Step 1: Write the failing test（追加到 `tests/test_viz_advanced_l1_r42.py`）**

```python
from app.schemas.chart_view import ChartViewError, validate_chart_view_config


def _sql_base(chart_type: str, **extra) -> dict:
    data = {
        "chartType": chart_type,
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1",
    }
    data.update(extra)
    return data


def test_style_variant_bar_stacked_ok():
    """T-VIZ-R42-004-01: bar + stacked 通过。"""
    cfg = validate_chart_view_config(
        _sql_base("bar", styleVariant="stacked",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.style_variant == "stacked"


def test_style_variant_line_area_ok():
    """T-VIZ-R42-004-02: line + area 通过。"""
    cfg = validate_chart_view_config(
        _sql_base("line", styleVariant="area",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.style_variant == "area"


def test_style_variant_pie_donut_ok():
    """T-VIZ-R42-004-03: pie + donut 通过。"""
    cfg = validate_chart_view_config(
        _sql_base("pie", styleVariant="donut",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.style_variant == "donut"


def test_style_variant_invalid_rejected():
    """T-VIZ-R42-004-04: bar + donut（不属 bar）→ CHART_INVALID_STYLE_VARIANT。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _sql_base("bar", styleVariant="donut",
                      dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
        )
    assert exc.value.code == "CHART_INVALID_STYLE_VARIANT"
    assert any(f["field"] == "styleVariant" for f in exc.value.fields)


def test_style_variant_default_backcompat():
    """T-VIZ-R42-004-05: 省略 styleVariant 默认 default 通过。"""
    cfg = validate_chart_view_config(_sql_base("table"))
    assert cfg.style_variant == "default"


def test_field_rule_sankey_ok():
    """T-VIZ-R42-005-01: sankey 2 维+1 度量通过。"""
    cfg = validate_chart_view_config(
        _sql_base("sankey",
                  dimensions=[{"field": "src"}, {"field": "dst"}],
                  metrics=[{"field": "amt"}])
    )
    assert cfg.chart_type == "sankey"


def test_field_rule_sankey_missing_dim():
    """T-VIZ-R42-005-02: sankey 仅 1 维 → CHART_FIELD_REQUIREMENT。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _sql_base("sankey", dimensions=[{"field": "src"}], metrics=[{"field": "amt"}])
        )
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"
    assert any(f["field"] == "dimensions" for f in exc.value.fields)


def test_field_rule_funnel_missing_metric():
    """T-VIZ-R42-005-03: funnel 缺度量 → CHART_FIELD_REQUIREMENT。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(_sql_base("funnel", dimensions=[{"field": "stage"}]))
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_field_rule_gauge_dim_bounds():
    """T-VIZ-R42-005-04: gauge 0 维+1 度量通过；含 1 维 → CHART_FIELD_REQUIREMENT。"""
    ok = validate_chart_view_config(_sql_base("gauge", metrics=[{"field": "v"}]))
    assert ok.chart_type == "gauge"
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _sql_base("gauge", dimensions=[{"field": "d"}], metrics=[{"field": "v"}])
        )
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_field_rule_pie_ok():
    """T-VIZ-R42-005-05: pie 1 维+1 度量通过。"""
    cfg = validate_chart_view_config(
        _sql_base("pie", dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.chart_type == "pie"


def test_field_rule_graph_zero_metric_ok():
    """T-VIZ-R42-005-06: graph 2 维+0 度量通过（metrics 0-1）。"""
    cfg = validate_chart_view_config(
        _sql_base("graph", dimensions=[{"field": "a"}, {"field": "b"}])
    )
    assert cfg.chart_type == "graph"


def test_field_rule_line_missing_series_backcompat():
    """T-VIZ-R42-005-07: line 缺 metrics 仍 → CHART_MISSING_SERIES（向后兼容）。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(_sql_base("line", dimensions=[{"field": "x"}]))
    assert exc.value.code == "CHART_MISSING_SERIES"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "style_variant or field_rule"`
Expected: FAIL — 现 `chart_type: Literal[...]` 拒绝 sankey/pie 等（pydantic `literal_error` → `CHART_INVALID_TYPE`），且无 `CHART_INVALID_STYLE_VARIANT`/`CHART_FIELD_REQUIREMENT`

- [ ] **Step 3: Modify `chart_view.py` — 字段类型与 `validate_l1_rules`**

将类型别名与字段声明改为 `str`（保留 `ChartTypeL1` 常量作文档，无外部 import）：

```python
ChartTypeL1 = Literal["table", "line", "bar"]  # 文档常量：r28 最小集，registry 为真理源
StyleVariantL1 = Literal["default"]  # 文档常量
```

```python
    chart_type: str = Field(alias="chartType")
    style_variant: str = Field(default="default", alias="styleVariant")
```

将 `validate_l1_rules` 整体替换为：

```python
    @model_validator(mode="after")
    def validate_l1_rules(self) -> ChartViewConfig:
        from app.viz.registry import ChartTypeNotRegistered, get_spec

        try:
            spec = get_spec(self.chart_type)
        except ChartTypeNotRegistered as exc:
            raise ValueError("CHART_INVALID_TYPE:Unsupported chartType") from exc

        if self.style_variant not in spec.style_variants:
            raise ValueError(
                "CHART_INVALID_STYLE_VARIANT:"
                f"styleVariant '{self.style_variant}' is not valid for {self.chart_type}"
            )

        inline = [self.mode, self.sql, self.schema_name, self.table_name, self.data_source_id]
        if self.binding_id is not None and any(v is not None for v in inline):
            raise ValueError("CHART_BINDING_CONFLICT:bindingId conflicts with inline fields")
        if self.binding_id is None:
            if self.data_source_id is None:
                raise ValueError("CHART_MISSING_DATASOURCE:dataSourceId is required")
            if self.mode == "sql" and not self.sql:
                raise ValueError("CHART_MISSING_SQL:sql is required for sql mode")
            if self.mode == "table" and (not self.schema_name or not self.table_name):
                raise ValueError("CHART_MISSING_TABLE:schema and table are required for table mode")
            if self.mode is None:
                raise ValueError("CHART_MISSING_MODE:mode is required when bindingId is absent")

        if self.binding_id is not None:
            return self
        if self.chart_type in ("line", "bar"):
            if not self.dimensions or not self.metrics:
                raise ValueError(
                    "CHART_MISSING_SERIES:dimensions and metrics are required for line/bar",
                )
            return self
        rule = spec.field_rule
        dim_n = len(self.dimensions)
        met_n = len(self.metrics)
        note = f" {rule.note}" if rule.note else ""
        if not (rule.min_dimensions <= dim_n <= rule.max_dimensions):
            raise ValueError(
                "CHART_FIELD_REQUIREMENT:"
                f"{self.chart_type} requires {rule.min_dimensions}-{rule.max_dimensions} "
                f"dimensions, got {dim_n}.{note}"
            )
        if not (rule.min_metrics <= met_n <= rule.max_metrics):
            raise ValueError(
                "CHART_FIELD_REQUIREMENT:"
                f"{self.chart_type} requires {rule.min_metrics}-{rule.max_metrics} "
                f"metrics, got {met_n}.{note}"
            )
        return self
```

- [ ] **Step 4: Modify `chart_view.py` — 错误映射（删失效 literal 分支 + 新码 fields）**

在 `_CODE_FIELD_HINTS` 增两行：

```python
_CODE_FIELD_HINTS: dict[str, list[str]] = {
    "CHART_MISSING_DATASOURCE": ["dataSourceId"],
    "CHART_MISSING_SQL": ["sql"],
    "CHART_MISSING_TABLE": ["schema", "table"],
    "CHART_MISSING_MODE": ["mode"],
    "CHART_INVALID_STYLE_VARIANT": ["styleVariant"],
    "CHART_FIELD_REQUIREMENT": ["dimensions", "metrics"],
}
```

在 `_map_validation_error` 中删除已失效的 `literal_error`/`chartType` 分支（现 `chart_type` 为 `str`，不再产生 `literal_error`）：

```python
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid chart config"))
        if msg.startswith("Value error, "):
            msg = msg.removeprefix("Value error, ")
        loc = err.get("loc", ())
        if msg.startswith("CHART_") and ":" in msg:
            err_code, text = msg.split(":", 1)
            code = err_code
            message = text
            fields.extend(_fields_for_code(err_code, text, tuple(loc)))
            continue
        field_name = _loc_to_field(tuple(loc))
        fields.append({"field": field_name, "message": msg})
```

- [ ] **Step 5: Run new + r28/r29 regression tests to verify pass**

Run: `cd backend && python3 -m ruff check app/schemas/chart_view.py && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py ../tests/test_viz_dash_quality_r29.py -v -k "style_variant or field_rule or chart_view or series or binding"`
Expected: 新 004/005 PASS；r29 chart_view 相关 PASS。（r28 的 3 处 `pie` 非法样例仍红，Task 7 修复 —— 本步不跑 r28。）

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/chart_view.py tests/test_viz_advanced_l1_r42.py
git commit -m "feat(viz): registry-driven style/field validation with CHART_INVALID_STYLE_VARIANT & CHART_FIELD_REQUIREMENT (VIZ-004/005)"
```

---

## Task 5: render-spec 归一层（VIZ-008）

**Files:**
- Create: `backend/app/viz/render.py`
- Modify: `backend/app/api/v1/charts.py`
- Test: `tests/test_viz_advanced_l1_r42.py`（追加 008-*）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**Interfaces:**
- Consumes: `ChartViewConfig`, `validate_chart_view_config`, `ChartViewError`（schemas）；`get_spec`（Task 1）
- Produces: `build_render_spec(cfg: ChartViewConfig) -> dict`（keys: `engine`, `chartType`, `styleVariant`, `encoding{dimensions,metrics}`, `source`）；`POST /api/v1/charts/render-spec`

- [ ] **Step 1: Write the failing test（追加到 `tests/test_viz_advanced_l1_r42.py`）**

```python
from app.viz.render import build_render_spec


def test_render_spec_table_engine():
    """T-VIZ-R42-008-01: table → engine=table。"""
    cfg = validate_chart_view_config(_sql_base("table"))
    spec = build_render_spec(cfg)
    assert spec["engine"] == "table"


def test_render_spec_bar_echarts():
    """T-VIZ-R42-008-02: bar → engine=echarts, chartType=bar。"""
    cfg = validate_chart_view_config(
        _sql_base("bar", dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    spec = build_render_spec(cfg)
    assert spec["engine"] == "echarts"
    assert spec["chartType"] == "bar"


def test_render_spec_encoding_matches_input():
    """T-VIZ-R42-008-03: encoding.dimensions/metrics 与输入一致。"""
    cfg = validate_chart_view_config(
        _sql_base("sankey",
                  dimensions=[{"field": "src"}, {"field": "dst"}],
                  metrics=[{"field": "amt"}])
    )
    spec = build_render_spec(cfg)
    assert [d["field"] for d in spec["encoding"]["dimensions"]] == ["src", "dst"]
    assert [m["field"] for m in spec["encoding"]["metrics"]] == ["amt"]


def test_render_spec_binding_only_source():
    """T-VIZ-R42-008-04: binding-only → source={'bindingId':...}。"""
    bid = uuid.uuid4()
    cfg = validate_chart_view_config({"chartType": "table", "bindingId": str(bid)})
    spec = build_render_spec(cfg)
    assert spec["source"] == {"bindingId": str(bid)}


def test_render_spec_style_variant_passthrough():
    """T-VIZ-R42-008-06: styleVariant 透传入 render-spec。"""
    cfg = validate_chart_view_config(
        _sql_base("line", styleVariant="smooth",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert build_render_spec(cfg)["styleVariant"] == "smooth"


def test_post_render_spec_http(client, auth_headers):
    """T-VIZ-R42-008-05: POST /charts/render-spec 合法→200 含 engine；非法 type→422。"""
    ok = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("bar", dimensions=[{"field": "d"}], metrics=[{"field": "m"}]),
        headers=auth_headers,
    )
    assert ok.status_code == 200
    assert ok.json()["engine"] == "echarts"
    bad = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("radar"),
        headers=auth_headers,
    )
    assert bad.status_code == 422
    assert bad.json()["code"] == "CHART_INVALID_TYPE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "render_spec"`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.viz.render'`

- [ ] **Step 3: Write `render.py`**

```python
# backend/app/viz/render.py
from __future__ import annotations

from app.schemas.chart_view import ChartViewConfig
from app.viz.registry import get_spec


def build_render_spec(cfg: ChartViewConfig) -> dict:
    spec = get_spec(cfg.chart_type)
    if cfg.binding_id is not None:
        source: dict = {"bindingId": str(cfg.binding_id)}
    else:
        source = {
            "mode": cfg.mode,
            "dataSourceId": str(cfg.data_source_id) if cfg.data_source_id else None,
        }
        if cfg.mode == "sql":
            source["sql"] = cfg.sql
        elif cfg.mode == "table":
            source["schema"] = cfg.schema_name
            source["table"] = cfg.table_name
    return {
        "engine": spec.renderer,
        "chartType": cfg.chart_type,
        "styleVariant": cfg.style_variant,
        "encoding": {
            "dimensions": [{"field": d.field, "label": d.label} for d in cfg.dimensions],
            "metrics": [{"field": m.field, "label": m.label} for m in cfg.metrics],
        },
        "source": source,
    }
```

- [ ] **Step 4: Modify `charts.py` — 新增 render-spec 路由**

顶部 import 增：

```python
from app.viz.render import build_render_spec
```

新增路由：

```python
@router.post("/render-spec")
def render_spec_chart(
    payload: dict,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> dict | JSONResponse:
    try:
        cfg = validate_chart_view_config(payload)
    except ChartViewError as exc:
        return _error_response(exc)
    return build_render_spec(cfg)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python3 -m ruff check app/viz/render.py app/api/v1/charts.py && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "render_spec"`
Expected: all render_spec PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/viz/render.py backend/app/api/v1/charts.py tests/test_viz_advanced_l1_r42.py
git commit -m "feat(viz): engine-agnostic render-spec builder + POST /charts/render-spec (VIZ-008)"
```

---

## Task 6: 嵌入配置契约（VIZ-006）

**Files:**
- Create: `backend/app/viz/embed.py`
- Modify: `backend/app/api/v1/charts.py`
- Test: `tests/test_viz_advanced_l1_r42.py`（追加 006-*）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`（Pydantic v2、错误体一致性）

**Interfaces:**
- Consumes: 无（独立模块）
- Produces: `ChartEmbedError(code, message, status=422, fields=[])`；`ChartEmbedConfig`（alias chartId/dashboardId/allowedOrigins；theme Literal light|dark；token max 512）；`validate_chart_embed_config(data: dict) -> ChartEmbedConfig`；错误码 `EMBED_MISSING_TARGET`/`EMBED_TARGET_CONFLICT`/`EMBED_INVALID_ORIGIN`/`EMBED_INVALID`；`POST /api/v1/charts/embed/validate`

- [ ] **Step 1: Write the failing test（追加到 `tests/test_viz_advanced_l1_r42.py`）**

```python
from app.viz.embed import ChartEmbedError, validate_chart_embed_config


def test_embed_chart_id_only_ok():
    """T-VIZ-R42-006-01: 仅 chartId + 合法 origins 通过。"""
    cfg = validate_chart_embed_config(
        {"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://a.com"]}
    )
    assert cfg.chart_id is not None


def test_embed_dashboard_id_only_ok():
    """T-VIZ-R42-006-02: 仅 dashboardId 通过。"""
    cfg = validate_chart_embed_config({"dashboardId": str(uuid.uuid4())})
    assert cfg.dashboard_id is not None


def test_embed_missing_target():
    """T-VIZ-R42-006-03: 都缺 → EMBED_MISSING_TARGET。"""
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config({"allowedOrigins": []})
    assert exc.value.code == "EMBED_MISSING_TARGET"


def test_embed_target_conflict():
    """T-VIZ-R42-006-04: 都给 → EMBED_TARGET_CONFLICT。"""
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config(
            {"chartId": str(uuid.uuid4()), "dashboardId": str(uuid.uuid4())}
        )
    assert exc.value.code == "EMBED_TARGET_CONFLICT"


def test_embed_invalid_origin():
    """T-VIZ-R42-006-05: allowedOrigins=['not-a-url'] → EMBED_INVALID_ORIGIN。"""
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config(
            {"chartId": str(uuid.uuid4()), "allowedOrigins": ["not-a-url"]}
        )
    assert exc.value.code == "EMBED_INVALID_ORIGIN"


def test_embed_origin_with_port_ok():
    """T-VIZ-R42-006-06: https://a.com:8443 通过。"""
    cfg = validate_chart_embed_config(
        {"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://a.com:8443"]}
    )
    assert cfg.allowed_origins == ["https://a.com:8443"]


def test_embed_http_endpoint(client, auth_headers, unauthorized_headers):
    """T-VIZ-R42-006-07: POST /charts/embed/validate 非法→422 结构化；无鉴权→401。"""
    bad = client.post(
        "/api/v1/charts/embed/validate",
        json={"allowedOrigins": []},
        headers=auth_headers,
    )
    assert bad.status_code == 422
    assert bad.json()["code"] == "EMBED_MISSING_TARGET"
    noauth = client.post(
        "/api/v1/charts/embed/validate",
        json={"chartId": str(uuid.uuid4())},
        headers=unauthorized_headers,
    )
    assert noauth.status_code == 401


def test_embed_theme_default_and_invalid():
    """T-VIZ-R42-006-08: 默认 theme=light；theme=pink → EMBED_INVALID。"""
    ok = validate_chart_embed_config({"chartId": str(uuid.uuid4())})
    assert ok.theme == "light"
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config({"chartId": str(uuid.uuid4()), "theme": "pink"})
    assert exc.value.code == "EMBED_INVALID"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "embed"`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.viz.embed'`

- [ ] **Step 3: Write `embed.py`**

```python
# backend/app/viz/embed.py
from __future__ import annotations

import re
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

_ORIGIN_RE = re.compile(r"^https?://[a-zA-Z0-9.-]+(:\d+)?$")


class ChartEmbedError(Exception):
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


class ChartEmbedConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")
    dashboard_id: uuid.UUID | None = Field(default=None, alias="dashboardId")
    allowed_origins: list[str] = Field(
        default_factory=list, alias="allowedOrigins", max_length=32
    )
    theme: Literal["light", "dark"] = "light"
    token: str | None = Field(default=None, max_length=512)


def validate_chart_embed_config(data: dict[str, Any]) -> ChartEmbedConfig:
    try:
        cfg = ChartEmbedConfig.model_validate(data)
    except ValidationError as exc:
        first = exc.errors()[0] if exc.errors() else {}
        field_name = ".".join(str(p) for p in first.get("loc", ())) or "config"
        raise ChartEmbedError(
            "EMBED_INVALID",
            "Invalid embed config",
            422,
            [{"field": field_name, "message": str(first.get("msg", "invalid"))}],
        ) from exc
    if cfg.chart_id is None and cfg.dashboard_id is None:
        raise ChartEmbedError(
            "EMBED_MISSING_TARGET",
            "chartId or dashboardId is required",
            422,
            [{"field": "chartId", "message": "required"},
             {"field": "dashboardId", "message": "required"}],
        )
    if cfg.chart_id is not None and cfg.dashboard_id is not None:
        raise ChartEmbedError(
            "EMBED_TARGET_CONFLICT",
            "chartId conflicts with dashboardId",
            422,
            [{"field": "chartId", "message": "conflict"},
             {"field": "dashboardId", "message": "conflict"}],
        )
    invalid = [
        {"field": f"allowedOrigins[{i}]", "message": f"invalid origin: {o}"}
        for i, o in enumerate(cfg.allowed_origins)
        if not _ORIGIN_RE.match(o)
    ]
    if invalid:
        raise ChartEmbedError("EMBED_INVALID_ORIGIN", "invalid origin", 422, invalid)
    return cfg
```

- [ ] **Step 4: Modify `charts.py` — 新增 embed/validate 路由**

顶部 import 增：

```python
from app.viz.embed import ChartEmbedConfig, ChartEmbedError, validate_chart_embed_config
```

新增路由（错误体形状与 `_error_response` 一致，`ChartEmbedError` 结构同 `ChartViewError`）：

```python
def _embed_error_response(exc: ChartEmbedError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.post("/embed/validate")
def validate_embed(
    payload: dict,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ChartEmbedConfig | JSONResponse:
    try:
        return validate_chart_embed_config(payload)
    except ChartEmbedError as exc:
        return _embed_error_response(exc)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python3 -m ruff check app/viz/embed.py app/api/v1/charts.py && python3 -m pytest ../tests/test_viz_advanced_l1_r42.py -v -k "embed"`
Expected: all embed PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/viz/embed.py backend/app/api/v1/charts.py tests/test_viz_advanced_l1_r42.py
git commit -m "feat(viz): chart embed config contract + POST /charts/embed/validate (VIZ-006)"
```

---

## Task 7: P4 回归修复 `pie`→`radar` + 全量回归门控

**Files:**
- Modify: `tests/test_viz_dash_l1_r28.py`（3 处 `pie`→`radar`）
- Modify: `tests/test_view_gov_api_r30.py`（1 处 `pie`→`radar`）

**Skills:**
- Read `.agents/skills/bug-case-library/SKILL.md`（回归根因记录）
- Read `.agents/skills/verification-before-completion/SKILL.md`

**Interfaces:**
- Consumes: registry 已注册 `pie`（Task 2）使其成为合法 type，故原「非法 type」样例语义失真
- Produces: 用未注册 `radar` 恢复「非法/未注册图表类型」语义；`CHART_INVALID_TYPE`/`DASH_INVALID_LAYOUT`/`ViewError` 断言保持

**根因**：VIZ-003 注册 `pie` 后，`chartType="pie"` 不再是「非法类型」；改用**未注册** `radar`（不在本轮 9 类型内），断言语义不变。禁止从 registry 移除 pie 迁就测试。

- [ ] **Step 1: 修复 `test_viz_dash_l1_r28.py::test_chart_view_invalid_type`**

将该用例内 `"chartType": "pie"` 改为 `"chartType": "radar"`；docstring 同步为 `chartType=radar → CHART_INVALID_TYPE`。断言 `exc.value.code == "CHART_INVALID_TYPE"` 保持。

- [ ] **Step 2: 修复 `test_viz_dash_l1_r28.py` HTTP 与 dashboard layout 两处**

- `test_post_charts_validate_rejects_invalid`：`json={"chartType": "pie"}` → `json={"chartType": "radar"}`。
- `test_dashboard_layout_invalid_chart`：widget `chartConfig` 内 `{"chartType": "pie"}` → `{"chartType": "radar"}`。
断言（422 + `CHART_INVALID_TYPE` / `DASH_INVALID_LAYOUT`）保持不变。

- [ ] **Step 3: 修复 `test_view_gov_api_r30.py::test_view_invalid_chart_type`**

将 `layout["widgets"][0]["chartConfig"]["chartType"] = "pie"` 改为 `= "radar"`；断言 `exc.value.status == 422`（`ViewError`）保持。

- [ ] **Step 4: 运行 r42 全套件 + 全部回归护栏**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_viz_advanced_l1_r42.py \
  ../tests/test_viz_dash_l1_r28.py \
  ../tests/test_viz_dash_quality_r29.py \
  ../tests/test_view_gov_api_r30.py \
  ../tests/test_view_gov_api_r31.py \
  -v
```
Expected: 全 PASS（r42 ≥30 新测 + r28/r29/r30/r31 回归全绿），`ruff` clean

- [ ] **Step 5: 运行全量基线确认无回归**

Run: `cd backend && python3 -m pytest ../tests -q`
Expected: **≥1033 passed** / 4 skipped，零失败

- [ ] **Step 6: Commit**

```bash
git add tests/test_viz_dash_l1_r28.py tests/test_view_gov_api_r30.py
git commit -m "test(viz): fix pie->radar invalid-type regressions after registering pie (VIZ-003 P4)"
```

---

## Task 8: 文档同步（P3）

**Files:**
- Create: `docs/services/viz.md`
- Modify: `docs/services/README.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/create-evolution-prd/SKILL.md`（域附录结构参考，非必需）

（触及 `docs/**` → `docs-layer.mdc` 生效：`docs/services/` 只写职责/边界/依赖，不写 HTTP schema；HTTP 路由登记入 `docs/api/README.md`。`prd/F06-VIZ.md` 状态/锚点回写为 **P5** 项，不在本 Task。）

- [ ] **Step 1: 新建 `docs/services/viz.md`**

按既有域附录格式（元信息 / 职责 / 边界 In-Out / 依赖 / 入口）编写：
- 元信息：模块 `backend/app/viz/`；PRD 分片 `F06-VIZ`（VIZ-003/004/005/006/008）；里程碑 M9；实现状态 **骨架（L1 kickoff）**。
- 职责：chart-type 注册表（`ChartTypeRegistry` + 9 类型）、样式/字段校验规则源、render-spec 归一、embed 配置契约。
- 边界 In：类型注册与 catalog、`style_variant`/`field_rule` 校验、引擎无关 render-spec、embed origin 白名单校验。边界 Out：真实 ECharts/AntV 渲染、`fe/` 图表组件、iframe 页面、SDK（VIZ-007）、图表出数（复用 QUERY 链）、嵌入 token 签发与 CSP 响应头。
- 依赖：上游被 `schemas/chart_view.py`（惰性 import）与 `api/v1/charts.py` 消费；无下游域依赖。
- 入口：`get_spec` / `export_chart_type_catalog` / `build_render_spec` / `validate_chart_embed_config`；HTTP 指针 → `docs/api/README.md`。

- [ ] **Step 2: 修改 `docs/services/README.md`**

在域索引表增 `viz` 行（模块 `app/viz/`、F06-VIZ、M9、状态=骨架）；更新「横切 F06-VIZ」相关脚注指向 `viz.md`。

- [ ] **Step 3: 修改 `docs/api/README.md`**

登记 3 新路由：`GET /api/v1/charts/types`（只读 catalog）、`POST /api/v1/charts/render-spec`（校验+归一）、`POST /api/v1/charts/embed/validate`（嵌入配置校验），状态=已实现（骨架），错误码列 `CHART_INVALID_TYPE`/`CHART_INVALID_STYLE_VARIANT`/`CHART_FIELD_REQUIREMENT`/`EMBED_*`。

- [ ] **Step 4: 验证文档链接与索引一致**

Run: `cd backend && python3 -m pytest ../tests -q`
Expected: **≥1033 passed** / 4 skipped（文档变更不影响测试，确认无意外副作用）

- [ ] **Step 5: Commit**

```bash
git add docs/services/viz.md docs/services/README.md docs/api/README.md
git commit -m "docs(viz): add viz domain appendix + register 3 chart routes (F06-VIZ)"
```

---

## Self-Review

**1. Spec coverage：**
- VIZ-003（注册表 + catalog + GET /charts/types）→ Task 1/2/3（008 断言 003-01~08）✓
- VIZ-004（style_variant 校验）→ Task 4（004-01~05）✓
- VIZ-005（field_rule 校验）→ Task 4（005-01~07）✓
- VIZ-008（render-spec + POST）→ Task 5（008-01~06）✓
- VIZ-006（embed 契约 + POST）→ Task 6（006-01~08）✓
- P4 blocker（pie→radar）→ Task 7 ✓
- 文档同步（services/api）→ Task 8；PRD/F06-VIZ 回写为 P5 ✓
- 断言合计 34 ≥ 30 ✓

**2. Placeholder scan：** 无 TBD/TODO；每 code step 含完整代码；每 Task 含验证命令。✓

**3. Type consistency：** `get_spec`/`export_chart_type_catalog`/`registry`/`ChartTypeNotRegistered`/`ChartTypeAlreadyRegisteredError`（registry.py）、`ChartTypeSpec`/`FieldRule`（specs.py）、`build_render_spec`（render.py）、`ChartEmbedConfig`/`ChartEmbedError`/`validate_chart_embed_config`（embed.py）跨 Task 引用签名一致；`chart_view.py` 错误码 `CHART_INVALID_TYPE`/`CHART_INVALID_STYLE_VARIANT`/`CHART_FIELD_REQUIREMENT` 与测试断言一致。✓

**4. 分层/循环 import 校验：** `schemas/chart_view.py` 仅函数内惰性 import `app.viz.registry`；`app.viz` 包内 `__init__`→`builtin`→`registry`→`specs` 皆 submodule import，无 `from app.viz import ...` 回环；`render.py` module-level import `schemas.chart_view`（后者不 module-level import viz）无循环。✓

**5. 文件数：** 14 ≤ 20 ✓
