# M9 可视化高级图表类型 L1 kickoff r42 设计 — VIZ-003/004/005/006/008

```yaml
date: 2026-07-04
milestone: M9 (F06-VIZ 横切)
round_target: docs/superpowers/evolution/2026-07-04-round-target-r42.md
prd_ids: [VIZ-004, VIZ-008, VIZ-003, VIZ-005, VIZ-006]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

本轮以 **后端 chart-spec 契约层**为交付形态（对齐 r36/r38/r40 连接器 L1 kickoff「registry + 契约 + 错误域 + mock smoke」模式）。核心洞察：**VIZ-003「图表类型插件注册」= 图表类型注册表（backend `ChartTypeRegistry`，镜像 `datasources/registry.py`）**；其余四项是同一注册表/契约的不同切面。高级图表类型（桑基/关系/地图/漏斗/仪表盘/饼）作为注册表的**骨架条目**，同时驱动全部切面。

| # | 子项 | PRD ID | 契约切面 | 交付载体 | 执行顺序 | 主攻薄弱维 | 用户感知（骨架档） |
|---|------|--------|----------|----------|:--------:|------------|--------------------|
| 1 | 图表类型插件注册 | VIZ-003 | 类型注册表 + types catalog | `app/viz/registry.py`+`builtin.py`；`GET /charts/types` | 1（VIZ 域核心，先行） | 完整度 **5%→≥60%**；架构 **8%→≥40%** | 图表编辑器可枚举全部注册图表类型（表格/折线/柱/饼/仪表/地图/桑基/漏斗/关系）；新类型可注册进 registry 而不改核心类 |
| 2 | 图表样式子类型 | VIZ-004 | 每类型 `style_variants` + 校验 | `specs.py` + `chart_view.py` 校验 | 2（全表最低 11.3） | 完整度 **5%→≥60%**；测试 **0%→≥50%** | 柱状图可选堆叠/分组/水平，折线可选面积/平滑，饼图可选环形；非法 styleVariant 被结构化拒绝 |
| 3 | 维度指标筛选配置 | VIZ-005 | 每类型 `field_rules`（维度/指标 min-max 与特殊槽位）+ 校验 | `specs.py` + `chart_view.py` 校验 | 3 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 各图表类型声明其维度/指标需求（桑基需 2 维+1 度量，漏斗需 1 维+1 度量…）；缺字段返回可定位 `CHART_FIELD_REQUIREMENT` |
| 4 | ECharts/AntV 渲染适配层 | VIZ-008 | 每类型 `renderer` 引擎 + 归一 render-spec | `render.py`；`POST /charts/render-spec` | 4（全表次低 11.4） | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 统一 `ChartViewConfig → 渲染器描述符` 映射（引擎无关，标注 echarts/table 目标）；前端后续按描述符适配 |
| 5 | iframe 嵌入门户 | VIZ-006 | 嵌入配置契约 + 错误域 | `embed.py`；`POST /charts/embed/validate` | 5 | 完整度 **5%→≥60%**；安全性 **12%→≥40%** | 嵌入配置可声明目标（chartId/dashboardId）与跨域 origin 白名单；非法 origin/冲突目标返回 `EMBED_*` |

**依赖链**：`app/viz/specs.py`（数据类）→ `registry.py`（注册表 + catalog）→ `builtin.py`（9 类型骨架 + `register_builtin_chart_types()`）→ `render.py`（VIZ-008）+ `embed.py`（VIZ-006）→ `chart_view.py` 校验改为 registry 驱动（VIZ-004/005）→ `api/v1/charts.py` 三新入口 → `tests/test_viz_advanced_l1_r42.py` smoke → **修复** r28/r30 用 `pie` 作非法 type 的回归样例（P4 blocker，见 §4）→ P5 目标各 ID 加权总分脱离 11–12 骨架档抬升至 L1 可用档（60–70 量级；破 90 留 companion 轮）。

**上轮已交付（本轮不重复）**：VIZ-001/002（`ChartViewConfig` 协议 + table/line/bar 最小集，r28/r29）；DASH-001~003（看板 CRUD/layout，r28/r29）；VIEW L1（r30/r31）。**本轮不含**：真实 ECharts/AntV 前端渲染实现、`fe/` 图表组件、嵌入 iframe 页面、SDK 嵌入（VIZ-007）。

## 2. PRD 分片锚点漂移注记

真理源优先级（沿用 r40 precedent）：`round-target` > `prd.md` hub > `prd/F06-VIZ.md` > `docs/services/` > `docs/api/`。本轮存在两处漂移，明示如下：

| 项 | round-target 叙事 | prd/F06-VIZ.md（陈旧/字面） | 本轮处理 |
|----|-------------------|------------------------------|----------|
| 主题 | 「高级图表类型」（桑基/关系/地图/漏斗/仪表盘） | VIZ-003~008 多为机制项（注册/样式/配置/嵌入/适配），非图表类型 | 以 **PRD ID 字面语义**定义各切面，高级类型作为注册表骨架载体，二者统一（§1 映射表）|
| 代码锚点 | 后端 chart-spec 模块 + tests | 各项锚点指向 `fe/src/components/charts/*`、`fe/src/embed/` | 本轮 **L1 后端契约先行**（镜像 VIZ-001 既有 `schemas/chart_view.py`+`api/v1/charts.py` 后端锚点）；`fe/` 镜像与真实渲染留 companion/L2 轮。P5 回写 F06-VIZ 后端锚点与状态 |
| VIZ-006 语义 | round-target 子项 5 描述为「新增一类高级图表」 | F06-VIZ 字面为「iframe 嵌入门户」 | 以 **PRD 字面（iframe 嵌入门户）** 为准，交付后端嵌入配置契约骨架（origin 白名单 = PRD「跨域策略可配置」）；仪表盘/饼作为注册表条目一并登记 |

**plan.md 状态**：M1+M1B 全 `[x]`，无活跃 `[ ]` 行（已知 concern，本轮回落纯 8 维选题）；立项来源 `plan.archive.md` M9 可视化簇。**禁止**修改 `plan.md` / `goal.md` 结构。

**round-target 每轮必答对齐**：用户感知（§1 表末列）；补缺型（5 项状态=未实现）；不做代价（高级图表缺失，对标 DataEase/Superset 图表库缺项）；已批处理同域 5 项；共 5 项、≤3 后端模块、≤14 文件（§2.4）。

## 2.4 范围框定

**范围框定模块**（≤3）：`backend/app/viz/`（新域）· `backend/app/schemas/chart_view.py`（既有契约改造）· `backend/app/api/v1/charts.py`（entry）+ `tests/`。

**范围框定文件列表**（14 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/viz/__init__.py` | 全部 | 新建：导出 + 启动注册 `register_builtin_chart_types()` |
| `backend/app/viz/specs.py` | VIZ-003/004/005/008 | 新建：`ChartTypeSpec` / `FieldRule` 数据类 |
| `backend/app/viz/registry.py` | VIZ-003 | 新建：`ChartTypeRegistry` + `get_spec` + `export_chart_type_catalog` |
| `backend/app/viz/builtin.py` | VIZ-003/004/005/008 | 新建：9 类型骨架 spec + `register_builtin_chart_types()` |
| `backend/app/viz/render.py` | VIZ-008 | 新建：`build_render_spec()` 归一映射 |
| `backend/app/viz/embed.py` | VIZ-006 | 新建：`ChartEmbedConfig` + `ChartEmbedError` + `validate_chart_embed_config()` |
| `backend/app/schemas/chart_view.py` | VIZ-004/005 | 修改：`chart_type`/`style_variant` 改 `str`；校验改 registry 驱动；新码 `CHART_INVALID_STYLE_VARIANT`/`CHART_FIELD_REQUIREMENT` |
| `backend/app/api/v1/charts.py` | VIZ-003/006/008 | 修改：新增 `GET /charts/types`、`POST /charts/render-spec`、`POST /charts/embed/validate` |
| `backend/app/main.py` | 全部 | 修改（若需）：确保 `app.viz` 在启动时导入并注册（沿用 `router` 导入链，通常无需改） |
| `tests/test_viz_advanced_l1_r42.py` | 全部 | 新建（≥30 条断言） |
| `tests/test_viz_dash_l1_r28.py` | 回归 | 修改：3 处 `pie` → 未注册 type `radar`（§4） |
| `tests/test_view_gov_api_r30.py` | 回归 | 修改：1 处 `pie` → `radar`（§4） |
| `docs/services/viz.md` | 全部 | 新建（P3）：viz 域附录 |
| `docs/services/README.md` | 全部 | 修改（P3）：域索引增 viz 行 |

> `docs/api/README.md`（3 新路由）与 `docs/automate/prd/F06-VIZ.md`（状态/锚点）为 P3/P5 文档同步项，不计入 P3 代码框定文件数，见 §8。

**本轮性质**：M9 **L1 kickoff**（chart-type registry + 契约校验 + render-spec 归一 + embed 契约 + pytest 纯单测/TestClient smoke）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、真实图表渲染、iframe 页面、Docker 集成。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/viz/                    # 新域（domain 层，可复用业务规则，无 HTTP）
├── __init__.py                     # 导出；模块导入时 register_builtin_chart_types()
├── specs.py                        # ChartTypeSpec / FieldRule 数据类（frozen）
├── registry.py                     # ChartTypeRegistry + get_spec + export_chart_type_catalog
├── builtin.py                      # 9 类型 spec + register_builtin_chart_types()
├── render.py                       # build_render_spec()（VIZ-008）
└── embed.py                        # ChartEmbedConfig + ChartEmbedError + validate（VIZ-006）

backend/app/schemas/chart_view.py   # entry 契约：registry 驱动校验（VIZ-004/005）
backend/app/api/v1/charts.py        # entry：+3 路由

tests/
├── test_viz_advanced_l1_r42.py     # T-VIZ-R42-*
├── test_viz_dash_l1_r28.py         # 回归修复 pie→radar
└── test_view_gov_api_r30.py        # 回归修复 pie→radar
```

**分层遵从**（common.mdc）：`app/viz/` 为 domain（无 HTTP、可复用规则）；`api/v1/charts.py` 为 entry（薄，解析→调用→响应）；`schemas/chart_view.py` 为 shared 契约。`chart_view.py` 校验需查 registry：采用**函数内惰性 import**（`from app.viz.registry import get_spec`），与既有 `views/validate.py`（函数内 `from app.dashboard.service import ...`）一致，避免 import-time 反向依赖。此为经权衡的最小侵入选择；companion 轮可评估将 `validate_chart_view_config` 整体下沉 `app/viz/` 以彻底消除 shared→domain 时序耦合。

### 3.2 数据类契约（`specs.py`）

```
FieldRule(frozen):
  min_dimensions: int = 0
  max_dimensions: int = 8
  min_metrics: int = 0
  max_metrics: int = 8
  note: str = ""            # 特殊槽位说明（如 sankey: dims=source,target）

ChartTypeSpec(frozen):
  type: str                 # 稳定 key，如 "sankey"
  display_name: str         # 中文名，如 "桑基图"
  category: str             # basic | advanced | geo | flow | relation
  renderer: str             # "echarts" | "table"（VIZ-008 引擎标注）
  capabilities: tuple[str,...]   # ("style_variant","field_config","render_spec")
  style_variants: tuple[str,...] # 含 "default"；VIZ-004
  field_rule: FieldRule          # VIZ-005
```

**注册表条目（9 类型骨架）**：

| type | display_name | category | renderer | style_variants | 维度 | 指标 |
|------|--------------|----------|----------|----------------|:----:|:----:|
| `table` | 表格 | basic | `table` | `default` | 0–8 | 0–8 |
| `line` | 折线图 | basic | echarts | `default,area,smooth` | 1–8 | 1–8 |
| `bar` | 柱状图 | basic | echarts | `default,stacked,grouped,horizontal` | 1–8 | 1–8 |
| `pie` | 饼图 | basic | echarts | `default,donut` | 1–1 | 1–1 |
| `gauge` | 仪表盘 | advanced | echarts | `default` | 0–0 | 1–1 |
| `map` | 地图 | geo | echarts | `default` | 1–1 | 1–1 |
| `sankey` | 桑基图 | flow | echarts | `default` | 2–2 | 1–1 |
| `funnel` | 漏斗图 | flow | echarts | `default` | 1–1 | 1–1 |
| `graph` | 关系图 | relation | echarts | `default` | 2–2 | 0–1 |

> 类型集覆盖 PRD VIZ-003 验收「折线/柱/饼/仪表/表格/地图最小集」+ round-target 高级类型（桑基/漏斗/关系）。`bar` 的 `horizontal` 与 `line` 的 `area/smooth`、`pie` 的 `donut` 满足 VIZ-004「堆叠/分组/面积/环形等」。

### 3.3 VIZ-003 — 图表类型注册表（`registry.py`）

镜像 `datasources/registry.py`（`ConnectorRegistry` + 线程锁 + `export_type_catalog`）：

| 元素 | 行为 |
|------|------|
| `ChartTypeRegistry` | `register(spec)` / `get(type)` / `list_specs()`；`threading.RLock` |
| `ChartTypeAlreadyRegisteredError` | 重复注册 type 抛出 |
| `ChartTypeNotRegistered(KeyError)` | 未知 type 抛出 |
| `get_spec(type) -> ChartTypeSpec` | 模块级便捷函数；未注册 → `ChartTypeNotRegistered` |
| `export_chart_type_catalog() -> list[dict]` | `[{type, displayName, category, renderer, styleVariants, fieldRule:{minDimensions,...}, capabilities}]` |
| 插件性（NFR-04） | 新类型仅 `register(ChartTypeSpec(...))`，不改核心类 —— 测试断言结构不变 |

`builtin.py::register_builtin_chart_types()` 顺序注册 9 类型，幂等保护（重复调用不报错：注册前 `if type in registry: skip` 或捕获 `AlreadyRegistered`）。`app/viz/__init__.py` 导入时调用一次。

**入口**（`api/v1/charts.py`）：`GET /charts/types` → `export_chart_type_catalog()`（需鉴权，沿用 `Depends(get_current_user)`）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-VIZ-R42-003-01 | `export_chart_type_catalog()` 含 9 类型，每项有 `type/displayName/category/renderer/styleVariants/fieldRule` |
| T-VIZ-R42-003-02 | catalog 含 `sankey/graph/map/funnel/gauge/pie`（高级类型出现） |
| T-VIZ-R42-003-03 | `get_spec("sankey").category == "flow"` |
| T-VIZ-R42-003-04 | `get_spec("no_such")` → `ChartTypeNotRegistered` |
| T-VIZ-R42-003-05 | 注册自定义 `ChartTypeSpec` 后 `get_spec` 可取；不修改 `ChartTypeRegistry` 类定义（插件性结构断言）|
| T-VIZ-R42-003-06 | `register_builtin_chart_types()` 幂等：二次调用不抛 `AlreadyRegistered` |
| T-VIZ-R42-003-07 | `GET /api/v1/charts/types` → 200，body 为 9 项列表 |
| T-VIZ-R42-003-08 | `GET /api/v1/charts/types` 无鉴权 → 401 |

### 3.4 VIZ-004 — 样式子类型校验

`ChartViewConfig.style_variant` 由 `Literal["default"]` 改为 `str`（默认 `"default"`）。校验入 registry：`style_variant ∉ spec.style_variants` → `CHART_INVALID_STYLE_VARIANT`（422，`fields=[{field:"styleVariant"}]`）。

**验收**：

| ID | 断言 |
|----|------|
| T-VIZ-R42-004-01 | `bar` + `styleVariant=stacked` 校验通过 |
| T-VIZ-R42-004-02 | `line` + `styleVariant=area` 通过 |
| T-VIZ-R42-004-03 | `pie` + `styleVariant=donut` 通过 |
| T-VIZ-R42-004-04 | `bar` + `styleVariant=donut`（不属 bar）→ `CHART_INVALID_STYLE_VARIANT` |
| T-VIZ-R42-004-05 | 省略 `styleVariant` 默认 `default` 通过（向后兼容 r28/r29） |

### 3.5 VIZ-005 — 维度/指标字段规则校验

registry 驱动替代 `chart_view.py` 硬编码的 line/bar 分支：

- **line/bar 保留** `CHART_MISSING_SERIES`（向后兼容 r28 `test_chart_view_missing_series`）：当 `min_dimensions≥1 且 min_metrics≥1` 且缺任一 → 沿用旧码 `CHART_MISSING_SERIES`（仅 line/bar 走此码）。
- **其余类型** 违反 `field_rule` 上下限 → 新码 `CHART_FIELD_REQUIREMENT`（422，`fields=[{field:"dimensions"|"metrics", message}]`，message 含 registry `note` 提示，如「桑基图需 2 个维度（source,target）」）。
- table（0–8/0–8）无强制；binding-only（`bindingId` 存在、无 inline）时跳过字段规则（数据形态由绑定决定，与既有 `test_chart_view_binding_only` 一致）。

**校验顺序**（`ChartViewConfig.validate_l1_rules`，惰性 import registry）：
1. `get_spec(chart_type)` 失败 → `CHART_INVALID_TYPE`（**最先**，保证非法 type 优先于缺 datasource 报错，见 §4）
2. style_variant 校验 → `CHART_INVALID_STYLE_VARIANT`
3. binding/datasource/mode 结构校验（**不变**：`CHART_BINDING_CONFLICT`/`CHART_MISSING_DATASOURCE`/`CHART_MISSING_SQL`/`CHART_MISSING_TABLE`/`CHART_MISSING_MODE`）
4. 字段规则：line/bar → `CHART_MISSING_SERIES`；其余非 binding-only → `CHART_FIELD_REQUIREMENT`

**验收**：

| ID | 断言 |
|----|------|
| T-VIZ-R42-005-01 | `sankey` 含 2 维+1 度量通过 |
| T-VIZ-R42-005-02 | `sankey` 仅 1 维 → `CHART_FIELD_REQUIREMENT`（fields 含 dimensions）|
| T-VIZ-R42-005-03 | `funnel` 缺度量 → `CHART_FIELD_REQUIREMENT` |
| T-VIZ-R42-005-04 | `gauge` 含 0 维+1 度量通过；含 1 维 → `CHART_FIELD_REQUIREMENT`（max_dimensions=0）|
| T-VIZ-R42-005-05 | `pie` 含 1 维+1 度量通过 |
| T-VIZ-R42-005-06 | `graph` 含 2 维+0 度量通过（metrics 0–1）|
| T-VIZ-R42-005-07 | line 缺 metrics 仍 → `CHART_MISSING_SERIES`（向后兼容）|

### 3.6 VIZ-008 — 渲染适配层（`render.py`）

`build_render_spec(cfg: ChartViewConfig) -> dict`：产出**引擎无关归一描述符**，供前端适配器（ECharts/AntV，本轮不实现）消费：

```json
{
  "engine": "echarts",
  "chartType": "sankey",
  "styleVariant": "default",
  "encoding": {
    "dimensions": [{"field":"src","label":null}, {"field":"dst","label":null}],
    "metrics": [{"field":"amount","label":null}]
  },
  "source": {"mode":"sql","dataSourceId":"...","sql":"..."} | {"bindingId":"..."}
}
```

`engine` 取自 `get_spec(cfg.chart_type).renderer`。纯函数、无 IO；不含真实 ECharts option 构造（留前端/companion）。

**入口**：`POST /charts/render-spec`（body 同 validate；先 `validate_chart_view_config` 再 `build_render_spec`；非法 → 复用 `ChartViewError` → `_error_response`）。

**验收**：

| ID | 断言 |
|----|------|
| T-VIZ-R42-008-01 | `table` → render-spec `engine="table"` |
| T-VIZ-R42-008-02 | `bar` → `engine="echarts"`，`chartType="bar"` |
| T-VIZ-R42-008-03 | render-spec `encoding.dimensions/metrics` 字段与输入一致 |
| T-VIZ-R42-008-04 | binding-only 输入 → `source={"bindingId":...}` |
| T-VIZ-R42-008-05 | `POST /charts/render-spec` 合法 → 200 含 `engine`；非法 type → 422 `CHART_INVALID_TYPE` |
| T-VIZ-R42-008-06 | styleVariant 透传入 render-spec |

### 3.7 VIZ-006 — 嵌入配置契约（`embed.py`）

```
ChartEmbedError(code, message, status=422, fields=[])   # 同 ChartViewError 形状

ChartEmbedConfig(BaseModel, populate_by_name):
  chart_id: UUID | None        (alias chartId)
  dashboard_id: UUID | None    (alias dashboardId)
  allowed_origins: list[str]   (alias allowedOrigins, default [], max_length 32)
  theme: Literal["light","dark"] = "light"
  token: str | None = None     (max_length 512；响应脱敏由上层保证)
```

`validate_chart_embed_config(data) -> ChartEmbedConfig`：
1. `chart_id`/`dashboard_id` 恰一存在：都无 → `EMBED_MISSING_TARGET`；都有 → `EMBED_TARGET_CONFLICT`
2. 每个 `allowed_origins` 项匹配 origin 形态（`scheme://host[:port]`，无 path/末斜杠；正则 `^https?://[a-zA-Z0-9.-]+(:\d+)?$`）→ 违规 `EMBED_INVALID_ORIGIN`（fields 定位索引）
3. Pydantic `ValidationError` → 映射 `EMBED_INVALID`

**入口**：`POST /charts/embed/validate` → 成功 200 返回归一 config；失败结构化 body（`{code,message,detail}`）。

**验收**：

| ID | 断言 |
|----|------|
| T-VIZ-R42-006-01 | 仅 `chartId` + 合法 origins 通过 |
| T-VIZ-R42-006-02 | 仅 `dashboardId` 通过 |
| T-VIZ-R42-006-03 | 都缺 → `EMBED_MISSING_TARGET` |
| T-VIZ-R42-006-04 | 都给 → `EMBED_TARGET_CONFLICT` |
| T-VIZ-R42-006-05 | `allowedOrigins=["not-a-url"]` → `EMBED_INVALID_ORIGIN` |
| T-VIZ-R42-006-06 | `allowedOrigins=["https://a.com:8443"]` 通过 |
| T-VIZ-R42-006-07 | `POST /charts/embed/validate` 非法 → 422 结构化 body；无鉴权 → 401 |
| T-VIZ-R42-006-08 | 默认 `theme="light"`；`theme="pink"` → 422（`EMBED_INVALID`）|

### 3.8 `chart_view.py` 改造要点（向后兼容）

| 变更 | 说明 |
|------|------|
| `chart_type: str`（原 `Literal[table,line,bar]`）| registry 决定合法性；类型别名 `ChartTypeL1` 保留为文档常量（无外部 import） |
| `style_variant: str`（原 `Literal["default"]`）| registry `style_variants` 决定 |
| `validate_l1_rules` 首步惰性 import `get_spec` | 非法 type 优先 `CHART_INVALID_TYPE`（§3.5 顺序） |
| `_map_validation_error` | 删除已失效的 `literal_error`/`chartType` 分支；`_CODE_FIELD_HINTS` 增 `CHART_INVALID_STYLE_VARIANT:[styleVariant]`、`CHART_FIELD_REQUIREMENT:[dimensions,metrics]` |
| 保留码 | `CHART_MISSING_SERIES`/`CHART_MISSING_DATASOURCE`/`CHART_MISSING_SQL`/`CHART_MISSING_TABLE`/`CHART_MISSING_MODE`/`CHART_BINDING_CONFLICT` 语义与 fields 不变 |

**回归护栏**：r28（`test_viz_dash_l1_r28`）、r29（`test_viz_dash_quality_r29`）、r30/r31（view/dash）除 §4 三例外全绿；dashboard/views 经 `validate_chart_view_config` 间接消费，无需改其源码。

## 4. P4 回归修复 — `pie` 作非法 type 样例

**根因**：VIZ-003 注册 `pie` 后，多处以 `chartType="pie"` 验证「非法类型 → 拒绝」的回归测试语义失真（pie 变为合法）。

**修复**（纳入 P3「回归门控」Task，禁止从 registry 移除 pie 迁就测试；改用**未注册** type `radar`）：

| 文件::用例 | 现状 | 改法 | 断言保持 |
|-----------|------|------|----------|
| `test_viz_dash_l1_r28.py::test_chart_view_invalid_type` | `chartType:"pie"` | `"radar"` | `CHART_INVALID_TYPE` |
| `test_viz_dash_l1_r28.py::test_post_charts_validate_rejects_invalid` | `{"chartType":"pie"}` | `{"chartType":"radar"}` | 422 + `CHART_INVALID_TYPE` |
| `test_viz_dash_l1_r28.py::test_dashboard_layout_invalid_chart` | `chartConfig:{"chartType":"pie"}` | `"radar"` | 422 + `DASH_INVALID_LAYOUT` |
| `test_view_gov_api_r30.py::test_view_invalid_chart_type` | `chartConfig.chartType="pie"` | `"radar"` | 422（`ViewError`）|

`radar` 未在本轮 9 类型内且非本轮计划类型，语义仍为「非法/未注册图表类型」。

## 5. 测试策略

### 5.1 新套件

**文件**：`tests/test_viz_advanced_l1_r42.py`

- 命名 `T-VIZ-R42-<PRD>-*`；复用既有 `conftest` 的 `client`/`auth_headers` fixture（见 r28 用法）。
- 纯单测（registry/spec/render/embed 直调）+ TestClient（4 路由）；**无外部依赖、无 mock 驱动**（全内存）。
- 目标 **≥30** 条断言（§3.3–3.7 合计 34 条）。
- 保留 r28（含修复 3 例）、r29、r30（含修复 1 例）、r31 不删。

### 5.2 验证命令

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_viz_advanced_l1_r42.py \
  ../tests/test_viz_dash_l1_r28.py \
  ../tests/test_viz_dash_quality_r29.py \
  ../tests/test_view_gov_api_r30.py \
  ../tests/test_view_gov_api_r31.py \
  -v
```

全量基线：`cd backend && python3 -m pytest ../tests -q` 现 1003 passed/4 skipped；本轮目标 **≥1033 passed** + 4 skipped（+≥30 新测），零失败、`ruff` clean。

### 5.3 HTTP 语义说明

- `/charts/validate`、`/charts/render-spec`、`/charts/embed/validate`：校验失败 **HTTP 422** + `{code,message,detail:{fields}}`（与既有 `_error_response` 一致）；未鉴权 401。
- `/charts/types`：只读 GET；无副作用；查询类只读（backend-fastapi.mdc）。

## 6. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮闭合手段 | L1 目标 | companion 目标 |
|--------|------------------|--------------|---------|-----------------|
| VIZ-004(11.3) | 完 5%、靠 0%、测 0%、性 0% | style_variants + `CHART_INVALID_STYLE_VARIANT` + 5 测 | 完 ≥60%、测 ≥50% | 破 90 |
| VIZ-008(11.4) | 完 5%、靠 0%、测 0%、性 0% | renderer 标注 + `build_render_spec` + 6 测 | 完 ≥60%、靠 ≥40% | 破 90 |
| VIZ-003(11.7) | 完 5%、靠 0%、测 0%、架 8% | `ChartTypeRegistry` + catalog + 8 测 | 完 ≥60%、架 ≥40% | 破 90 |
| VIZ-005(11.7) | 完 5%、靠 0%、测 0% | `field_rule` + `CHART_FIELD_REQUIREMENT` + 7 测 | 完 ≥60%、靠 ≥40% | 破 90 |
| VIZ-006(12.1) | 完 5%、靠 0%、测 0%、安 12% | embed 契约 + origin 白名单 + `EMBED_*` + 8 测 | 完 ≥60%、安 ≥40% | 破 90 |

## 7. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- `fe/` 任何文件：图表组件、`registry.ts`、`styles/`、`config/` UI、`adapters/`、`embed/` iframe 页面、SDK（VIZ-007）
- 真实 ECharts/AntV option 构造与前端渲染（本轮仅归一描述符契约）
- 图表数据实际出数/执行（复用既有 QUERY 链，非本轮）
- 嵌入鉴权 token 签发/校验链、CSP/X-Frame-Options 响应头（留 companion；本轮仅配置契约）
- 新 Alembic migration（无新持久化模型）
- 扩展 `ChartViewConfig` 数据字段（dimensions/metrics/filters 结构不变）
- 将 `validate_chart_view_config` 整体下沉 `app/viz/`（评估留 companion，见 §3.1）
- 高级类型的性能/大数据虚拟化、地图 GeoJSON 底图管理

## 8. 文档同步（P3/P5）

| 文档 | 时机 | 内容 |
|------|------|------|
| `docs/services/viz.md` | P3 | 新建 viz 域附录：职责/边界（In=chart-type 注册·契约校验·render-spec·embed 契约；Out=真实渲染/前端/出数）/依赖/锚点/状态=骨架 |
| `docs/services/README.md` | P3 | 域索引增 `viz` 行（模块 `app/viz/`、F06-VIZ、M9、骨架）；「横切 F06-VIZ」脚注更新 |
| `docs/api/README.md` | P3/P5 | 登记 `GET /charts/types`、`POST /charts/render-spec`、`POST /charts/embed/validate` |
| `docs/automate/prd/F06-VIZ.md` | P5 | VIZ-003/004/005/006/008 状态（未实现→骨架/部分）、后端锚点、验收勾选与漂移回写 |
| `docs/srs/` | — | 无 SRS 级新需求（图表类型属既有 G3 展现范围），无需回流 |

## 9. UI 设计交付

```yaml
ui_design_skill: none
```

本轮纯后端 L1 kickoff，**不触及 `fe/`** 或壳层 IA；无「UI 设计交付」小节要求项。前端图表渲染、配置 UI、嵌入页面留 companion/L2 轮，届时按 `.agents/skills/b-design-system-tailadmin-radix/SKILL.md` 匹配 UI skill。

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 注册 `pie` 破坏 r28/r30「非法 type」回归 | §4 明确改用未注册 `radar`；纳入 P3 回归门控 Task |
| schemas→domain 反向依赖 | 函数内惰性 import（与 `views/validate.py` 一致）；companion 评估下沉 |
| 校验顺序变动导致错误码漂移 | §3.5 固定顺序：type→style→结构→字段；r28/r29 逐条回归护栏 |
| dashboard/views 间接消费 chart 校验受影响 | 保留全部既有错误码与 fields；除 §4 外零测试改动 |
| registry 幂等（多次 import 重复注册）| `register_builtin_chart_types()` 注册前判存在；T-VIZ-R42-003-06 断言 |
| round-target 与 PRD 语义漂移引质疑 | §2 漂移表明示 PRD 字面为准 + 高级类型统一载体 |
| VIZ-006 被视为过度设计（PRD 锚点为 fe/embed）| L1 交付**后端配置契约**（origin 白名单=「跨域策略可配置」），iframe 页面留后续；§7 明列非目标 |
| 单文件超 200 行（chart_view.py 现 152 行）| 校验逻辑增量小；如逼近上限，将 registry 校验函数留 `app/viz/`，chart_view.py 仅调用 |

## 11. 方案比选摘要（批量级）

| 维度 | 方案 A（采用） | 方案 B | 方案 C |
|------|---------------|--------|--------|
| 交付层 | 后端 chart-spec 契约先行（镜像连接器 L1 + VIZ-001 后端锚点） | 直接前端 ECharts 渲染 | 后端 + 前端全栈同轮 |
| 注册表位置 | 新域 `app/viz/`（对齐 `datasources/registry.py`）| 塞入 `schemas/chart_view.py` | 塞入 `dashboard/` |
| 校验耦合 | `chart_view.py` 惰性 import registry | registry 内联进 Pydantic 模型 import-time | 复制类型清单到 schemas |
| 非法 type 回归 | 改样例为 `radar` | 跳过用例 | 从 registry 移除 pie |
| 测试组织 | 新文件 `test_viz_advanced_l1_r42.py` | 并入 r28 | 仅 HTTP e2e |

**推荐 A**：最小侵入、与既有演化节奏（连接器 L1 kickoff）与 VIZ-001 后端锚点一致、P4 blocker 有明确修复路径、纯后端可全量 mock-free 单测、`ui_design_skill: none` 无 UI 门控开销。
