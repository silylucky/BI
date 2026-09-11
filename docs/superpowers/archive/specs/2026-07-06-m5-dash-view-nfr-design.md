# M5 Dashboard 组件库收官设计 — DASH-003 / VIEW-001 / NFR-001

```yaml
date: 2026-07-06
milestone: M5 + NFR companion
round_target: docs/superpowers/evolution/2026-07-06-round-target-m5-dash.md
base_branch: dev-auto
prd_ids: [DASH-003, VIEW-001, NFR-001]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | Dashboard 四类扩展 widget 注册与出数 | DASH-003 | 1 | 用户价值 **84%**；架构健康 **88%** | 编辑模式可添加地图/热力/KPI/时间轴；view 模式绑定 dataSourceId+SQL 真实出数 |
| 2 | FR-VIEW-1 视图协议正式化与 round-trip | VIEW-001 | 2 | 用户价值 **82%**；测试覆盖 **96%** | 含扩展 widget 的视图配置可校验、可序列化往返；非法配置结构化 4xx |
| 3 | Dashboard view 首屏 perf smoke | NFR-001 | 3 | 性能 **88%**；用户价值 **84%** | 含扩展 widget 的最小 Dashboard fixture 首屏加载有可判定 P95 基线 |

**依赖链**：DASH-003 注册四类 chart type → FE 渲染与 WidgetPalette 暴露 → VIEW-001 以扩展 widget layout 做协议 round-trip/破坏性校验 → NFR-001 在同一 fixture 上测首屏 perf smoke。

**上轮已交付（本轮不重复 L1 骨架）**：

- VIZ-003 `ChartTypeRegistry` + `builtin.py` 9 类型（含 `map` 后端注册与 `renderFromSpec` map 渲染）
- VIEW-001 r30/r31：`POST /api/v1/views/validate`、bounds/cycle 错误码、`validate_layout_dict` 委托链
- NFR-001 r64/r67：mock `dashboard-first-screen` validate/probe API + ACL 边界
- M-FE-2/3：`DashboardEditPage` edit/view 双路由、`WidgetSqlPanel`、`ChartRenderer` 三态、`react-grid-layout`

**plan.md 状态**：M5 勾选 DASH-003、VIEW-001；NFR-001 属 M6 companion 收窄纳入本轮。**禁止**修改 `plan.md` / `goal.md` 结构（P5 勾选）。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `backend/app/viz/builtin.py` | 已注册 `map`；**缺** `heatmap`、`kpi`、`timeline` |
| `fe/src/components/dashboard/WidgetPalette.tsx` | 仅 `table`/`line`/`bar` 三按钮；扩展类型不可添加 |
| `fe/src/lib/chartViewConfig.ts` | `ChartType` 含 `map` 等 advanced；`defaultChartConfig` 仅支持 `ChartTypeL1` 三基础型 |
| `renderFromSpec.ts` | 已实现 `map`/`gauge`/sankey 等；**缺** `heatmap`、`timeline` |
| `ChartRenderer.tsx` | advanced 走 ECharts；**无** KPI 专用渲染分支 |
| `views/schemas.py` | `DashboardView` 无顶层 `protocolVersion` 常量/export |
| `views/validate.py` | 边界闭合；**无**含 heatmap/kpi/timeline 的 round-trip 集成测 |
| `dashboard_first_screen.py` | mock elapsedMs=800；**无**含扩展 widget 的 fixture smoke |
| `prd/F07-DASH.md` DASH-003 | 「地图/热力/KPI/时间轴可插拔」仍为 `[ ]` |
| `prd/F09-VIEW.md` VIEW-001 | schema+validate 已 `[x]`；全 BI 统一与 defaultViewId 仍 `[ ]`（后者非本轮） |
| `prd/F15-NFR.md` NFR-001 | mock probe `[x]`；真实 perf suite 仍 `[ ]` |

**范围框定模块**（3）：`backend/app/`（viz + views 协议）+ `fe/`（charts + dashboard palette）+ `tests/`（widget + protocol + perf smoke）。

**真理源优先级**：`round-target` > `plan.md` §M5 > `prd/F07` · `F09` · `F15` > `docs/services/views.md` > b-design-system skill。

## 3. 范围框定文件清单（18 ≤ 20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/viz/builtin.py` | DASH-003 | 修改：注册 `heatmap`/`kpi`/`timeline` |
| `backend/app/viz/render.py` | DASH-003 | 修改：`kpi` engine 标记；encoding 规则不变 |
| `backend/app/views/schemas.py` | VIEW-001 | 修改：增 `protocolVersion: Literal[1]` |
| `backend/app/views/protocol.py` | VIEW-001 | 新建：`VIEW_PROTOCOL_VERSION`、`round_trip_view_document` |
| `fe/src/lib/chartViewConfig.ts` | DASH-003 | 修改：扩展 `ChartType`；`isKpiType`/`isAdvancedEchartsType` |
| `fe/src/lib/chartRegistry.ts` | DASH-003 | 修改：`FALLBACK_TYPES` 增三类 |
| `fe/src/components/charts/adapters/renderFromSpec.ts` | DASH-003 | 修改：`buildHeatmapOption`/`buildTimelineOption` |
| `fe/src/components/charts/adapters/KpiCard.tsx` | DASH-003 | 新建：指标卡渲染（1–4 metrics） |
| `fe/src/components/charts/ChartRenderer.tsx` | DASH-003 | 修改：KPI 分支；扩展类型走既有 execute 链 |
| `fe/src/components/dashboard/WidgetPalette.tsx` | DASH-003 | 修改：基础/扩展分组；catalog 驱动 |
| `fe/src/components/dashboard/layoutUtils.ts` | DASH-003 | 修改：`defaultChartConfig` 支持四类 + `ChartType` 宽化 |
| `fe/src/components/charts/charts.dash003.smoke.test.tsx` | DASH-003 | 新建：四类渲染 smoke |
| `tests/test_dash_m5_widgets.py` | DASH-003 | 新建：registry + render-spec + execute 链 |
| `tests/test_view_m5_protocol.py` | VIEW-001 | 新建：round-trip + 破坏性输入 |
| `tests/test_nfr_001_first_screen_smoke.py` | NFR-001 | 新建：扩展 widget fixture + budget 断言 |
| `fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx` | NFR-001 | 新建：view 模式首屏 timing smoke |
| `docs/api/README.md` | VIEW-001 | 修改：登记 protocol 字段（若有文档增量） |
| `fe/src/components/README.md` | DASH-003 | 修改：登记 `KpiCard` |

> P5 对账（非 P3 必改）：`docs/services/views.md`、`prd/F07-DASH.md`、`prd/F09-VIEW.md`、`prd/F15-NFR.md`。

## 4. 非目标（明确不做）

- M13 冻结项；Dataset 语义层（QUERY-009）；VIZ-005 维度筛选 UI（M11）
- M6 其余项：CAT/GOV 总线分类、报表全站 NFR-02、生产 TLS（NFR-004）
- VIEW-002 defaultViewId 持久化、VIEW-003 FE（已在 M-FE-3 完成）、「全 BI 页面统一 DashboardView」
- 新增数据库连接器（M7）；GIS 行政区划下钻（DASH-006）
- AntV L7 真实 GIS（arch 远期）；本轮热力/地图用 ECharts + 内置 `regions-simplified.json`
- Playwright 真浏览器 perf E2E；并发压测报告（NFR-001 PRD 远期项）
- 修改 `DashboardLayout` 栅格 schema（不增 `gridX`/`gridY`）
- 预装业务 Dashboard 页面（保持出厂无预装页）

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维 | 本轮设计对策 |
|--------|--------|--------------|
| DASH-003 | 用户价值 84%；架构健康 88% | 四类 type 与 `ChartTypeRegistry` 对齐；WidgetPalette catalog 分组；不经 Dataset 直连 query execute |
| VIEW-001 | 用户价值 82%；测试覆盖 96% | `protocolVersion` 显式化；round-trip + 破坏性 widget/chartConfig 用例覆盖扩展类型 |
| NFR-001 | 性能 88%；用户价值 84% | 含四类 widget 的 fixture；FE vitest P95 + BE pytest budgetMs=5000 smoke；不测全站 |

## 6. 架构设计

### 6.1 目标增量结构

```
backend/app/viz/
├── builtin.py          # + heatmap, kpi, timeline ChartTypeSpec
└── render.py           # kpi → engine:"kpi"

backend/app/views/
├── schemas.py          # DashboardView.protocolVersion
└── protocol.py         # VIEW_PROTOCOL_VERSION, round_trip_view_document()

fe/src/components/charts/
├── adapters/
│   ├── KpiCard.tsx           # NEW
│   └── renderFromSpec.ts     # + heatmap, timeline
├── ChartRenderer.tsx         # + kpi branch
└── charts.dash003.smoke.test.tsx

fe/src/components/dashboard/
├── WidgetPalette.tsx         # catalog 分组
└── layoutUtils.ts            # defaultChartConfig 扩展

tests/
├── test_dash_m5_widgets.py
├── test_view_m5_protocol.py
└── test_nfr_001_first_screen_smoke.py
```

### 6.2 DASH-003 — 四类 widget 注册与渲染

#### 6.2.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 扩展 `builtin.py` + 既有 registry/render-spec/ChartRenderer 分支 | 与 VIZ-003 插件模型一致；map 已存在 | **采用** |
| B 每类 widget 独立 `fe/pages` 组件、绕过 ChartViewConfig | 破坏 FR-VIEW-2 协议 | 否决 |
| C 热力用 AntV L7 | arch 远期；超本轮文件预算 | 否决 |

#### 6.2.2 后端 ChartTypeSpec（`builtin.py`）

| type | displayName | category | renderer | fieldRule |
|------|-------------|----------|----------|-----------|
| `map` | 地图 | geo | echarts | 1 维（区域名）+ 1 度量（**已存在，本轮仅暴露到 palette**） |
| `heatmap` | 热力图 | geo | echarts | 2 维（x,y 分类）+ 1 度量 |
| `kpi` | KPI 指标 | indicator | kpi | 0–1 维 + 1–4 度量 |
| `timeline` | 时间轴 | temporal | echarts | 1 时间维 + 0–4 度量 |

`render.py` 对 `kpi` 返回 `engine: "kpi"`；其余扩展类型仍 `engine: spec.renderer`。

#### 6.2.3 前端渲染策略

| type | 渲染路径 | 数据契约 |
|------|----------|----------|
| map | 既有 `buildMapOption` + `AdvancedEchartsChart` | 区域字段匹配 `regions-simplified.json` 省名 |
| heatmap | 新增 `buildHeatmapOption`：x/y 两维 + value | 行列 capped `ADVANCED_CHART_ROW_CAP` |
| kpi | 新增 `KpiCard`：不请求 render-spec | 取 execute 结果首行，按 metrics 展示大数字+标签 |
| timeline | 新增 `buildTimelineOption`：time 维 x 轴 + 折线/散点 | 时间字段字符串可解析即可 |

`ChartRenderer` 分支顺序：

1. `isKpiType(chartType)` → `KpiCard`（仍包在 `ChartPanel` 三态内）
2. `isAdvancedEchartsType` → 既有 render-spec + `AdvancedEchartsChart`
3. 基础 table/line/bar → 既有路径

#### 6.2.4 WidgetPalette 与默认配置

**方案比选（Palette）**：

| 方案 | 说明 | 结论 |
|------|------|------|
| A `fetchChartTypeCatalog()` 过滤 category | 与后端 catalog 同步 | **采用**（失败时静态 fallback 四类） |
| B 硬编码四按钮 | 快但漂移 | 仅作 offline fallback |

`WidgetPalette` 布局：

- 分组标题：「基础组件」（table/line/bar）+「扩展组件」（map/heatmap/kpi/timeline）
- 按钮：`Button variant="outline"` 全宽左对齐（延续 M-FE-2 模式）
- `onInsert` 签名宽化为 `ChartType`（`layoutUtils.defaultChartConfig` 同步）

**defaultChartConfig 示例 SQL**（最小可执行）：

| type | 默认 SQL | dimensions | metrics |
|------|----------|------------|---------|
| map | `SELECT '北京' AS region, 100 AS value` | region | value |
| heatmap | `SELECT 'A' AS x, '1' AS y, 10 AS v` | x,y | v |
| kpi | `SELECT 1280 AS total, 12.5 AS rate` | — | total, rate |
| timeline | `SELECT '2026-01-01' AS t, 1 AS v` | t | v |

#### 6.2.5 DASH-003 可测试验收标准

| ID | 验收项 | 判定方式 |
|----|--------|----------|
| DASH-003-01 | `GET /api/v1/charts/types` 含 map/heatmap/kpi/timeline | pytest catalog 断言 |
| DASH-003-02 | `POST /api/v1/charts/render-spec` 对四类返回合法 spec | pytest |
| DASH-003-03 | mock execute 后 FE vitest 四类容器非空渲染 | `charts.dash003.smoke.test.tsx` |
| DASH-003-04 | `WidgetPalette` 可插入四类且 `PUT layout` payload 含 chartConfig | dashboard smoke 或 vitest |
| DASH-003-05 | 不经 Dataset：`chartConfig.mode=sql` + dataSourceId 走 `/api/v1/query/execute` | pytest execute 链 |

### 6.3 VIEW-001 — FR-VIEW-1 协议正式化

#### 6.3.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 顶层 `protocolVersion` + `protocol.py` round-trip  helper | 与 `layout.version` 分层；易测 | **采用** |
| B 仅文档描述、不改 schema | 无法闭合「正式化」 | 否决 |
| C 新 DB 表存协议版本 | 超范围 | 否决 |

#### 6.3.2 协议字段

`DashboardView` 增：

```python
protocol_version: Literal[1] = Field(default=1, alias="protocolVersion")
```

语义：

- `protocolVersion`：FR-VIEW-1 视图文档版本（本轮恒为 `1`）
- `layout.version`：布局子 schema 版本（已有，保持 `1`）
- 非法 `protocolVersion` → `VIEW_INVALID_LAYOUT` + fields 路径 `protocolVersion`

`views/protocol.py`：

- `VIEW_PROTOCOL_VERSION = 1`
- `round_trip_view_document(data: dict) -> dict`：`validate_dashboard_view` → `model_dump(by_alias=True)` → 再 `validate_dashboard_view`
- `export_view_json_schema()`：可选，基于 Pydantic `model_json_schema()` 供测试断言 key 存在

#### 6.3.3 与 DASH-003 兼容性

- `validate_layout_dict` 内 `validate_chart_view_config` 已通过 registry 校验 type；扩展类型自动纳入
- 新增破坏性用例：未知 chartType、`heatmap` 缺第二维度、`kpi` 零 metrics、`timeline` 缺时间维

#### 6.3.4 存储 round-trip

流程：`Dashboard` layout_json 含四类 widget → `POST /views/validate` 200 → `PUT /dashboards/{id}` → `GET` 布局等价 → 再 validate 200。

不新增独立 views 存储表；round-trip 经 dashboard API + validate 入口。

#### 6.3.5 VIEW-001 可测试验收标准

| ID | 验收项 | 判定方式 |
|----|--------|----------|
| VIEW-001-01 | 含四类 widget 的 DashboardView validate 200 | pytest |
| VIEW-001-02 | `round_trip_view_document` 两次 validate 布局等价 | pytest |
| VIEW-001-03 | 破坏性：非法 chartType → 422 + `detail.fields` | pytest |
| VIEW-001-04 | 破坏性：chartRef 环 / colSpan 越界回归 r31 | pytest 保留 r31 子集 |
| VIEW-001-05 | Dashboard PUT/GET layout_json 与 validate 一致 | pytest 集成 |

### 6.4 NFR-001 — Dashboard 首屏 perf smoke（companion 收窄）

#### 6.4.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A FE vitest timing + BE pytest fixture widget_count=4 | 可 CI；覆盖扩展 widget | **采用** |
| B 仅延伸 mock probe API | 不测真实 FE 路径 | 否决（用户价值不足） |
| C Playwright + Lighthouse | 超本轮预算 | 否决 |

#### 6.4.2 阈值与 fixture

| 环境 | 指标 | 阈值 |
|------|------|------|
| SRS / API | `budgetMs` | **5000**（默认，不变） |
| FE vitest（mock execute） | 首屏所有 widget `aria-busy=false` | **P95 ≤ 3000ms**（CI 稳定；注释对齐 SRS 5s） |
| BE pytest | `probe_dashboard_first_screen` widget_count=4 | `withinBudget=true`；`elapsed_ms ≤ budget_ms` |

**Fixture**：`tests/fixtures/dashboard_m5_extended_widgets.json`（内联于测试文件亦可，≤1 个 fixture 文件不计入 18 若合并进 test）

含 4 widget：map、heatmap、kpi、timeline；各带最小 chartConfig。

FE perf smoke：

- mock `apiFetch`：dashboard GET + 4 次 execute 即时返回
- 渲染 `DashboardEditPage mode="view"`
- `performance.now()` 从 mount 到 4 个 `ChartPanel` 脱离 loading
- 跑 5 次取 P95（vitest 内循环）

BE smoke：

- 调用现有 `probe_dashboard_first_screen(DashboardFirstScreenProbeIn(dashboardId="dash-m5-smoke", widgetCount=4))`
- 断言 `within_budget`；`simulate_slow=true` 时 `within_budget=false`（回归 r64）

#### 6.4.3 NFR-001 可测试验收标准

| ID | 验收项 | 判定方式 |
|----|--------|----------|
| NFR-001-01 | 扩展 widget fixture probe withinBudget | pytest |
| NFR-001-02 | simulate_slow breach 回归 | pytest |
| NFR-001-03 | FE view 模式 4 widget P95 ≤ 3000ms（mock） | vitest perf smoke |
| NFR-001-04 | r67 ACL/probe budget 子集仍绿 | 现有测试不回归 |

## 7. UI 设计交付

`ui_design_skill`: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读 `SKILL.md`、`references/component-styles/chart-theme.md`、`references/visual-language.md`）

### 7.1 页面信息架构

| 路由 | 模式 | 主内容区 | 本轮变更 |
|------|------|----------|----------|
| `/admin/dashboards/:id/edit` | edit | `max-w-(--breakpoint-2xl)` 内：左 `WidgetPalette`（lg:w-64）+ 右 `DashboardGrid` | Palette 增「扩展组件」分组 |
| `/admin/dashboards/:id` | view | 全宽 Grid + 顶栏 `GlobalFilterBar`（若有） | 扩展 widget 与基础 chart 相同卡片容器 |

**空/加载/错误/权限态**（沿用 `ChartPanel` + `DashboardEditPage` `ErrorBanner`）：

- 加载：`Skeleton min-h-[180px]` + `aria-busy`
- 错误：`role="alert"` + 重试 `Button outline sm`
- 空：`暂无数据` 居中
- KPI 零行：显示 `—` 占位，数字区仍保留 `min-h` 防布局跳动
- 权限：沿用 API 403 → `mapApiError` 中文（不新增页面）

### 7.2 视觉层级

```
DashboardEditPage
├── 顶栏：标题 + 保存（primary）+ 切换 view（outline）
├── WidgetPalette（侧栏卡片）
│   ├── 基础组件 → outline 按钮列表
│   └── 扩展组件 → outline 按钮列表
└── DashboardGrid
    └── DashboardWidget（card）
        └── ChartPanel / KpiCard
            ├── 标题 text-theme-sm font-semibold
            ├── KPI 大数字 text-title-sm font-semibold tabular-nums
            └── 图表区 min-h-[180px]
```

- **主操作**：保存、添加组件按钮
- **次操作**：widget 内重试、分页（table）
- **承载**：扩展 chart 与基础 chart 共用 `ChartPanel` 边框 `rounded-xl border-gray-200`；禁止页面内新造 card 样式

### 7.3 组件映射

| 需求 | 复用 | 新建/扩展 |
|------|------|-----------|
| Widget 容器 | `DashboardWidget`、`ChartPanel` | — |
| 地图/热力/时间轴 | `AdvancedEchartsChart`、`renderFromSpec` | heatmap/timeline option builders |
| KPI | — | `KpiCard`（对齐 TailAdmin 指标卡密度） |
| Palette 按钮 | `Button variant="outline"` | `WidgetPalette` 分组 |
| 配置面板 | `WidgetSqlPanel`、`ChartConfigPanel` | 不改交互，仅 type 扩展 |

**禁止**：页面局部重画 button/table；禁止硬编码 hex（走 `chart-theme` / semantic token）。

### 7.4 Token 与密度

| 元素 | Token / 类 |
|------|------------|
| Palette 容器 | `rounded-xl border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4` |
| 分组标题 | `text-theme-sm font-medium text-gray-700 dark:text-gray-300` |
| KPI 主值 | `text-title-sm font-semibold text-gray-800 dark:text-white/90 tabular-nums` |
| KPI 标签 | `text-theme-xs text-gray-500` |
| 图表色板 | ECharts 走宿主 `chartPalette`；Apex 基础图不变 |
| 间距 | 分组内 `space-y-2`；grid `gap-4`/`gap-6`（`visual-language.md`） |

### 7.5 响应式与可访问性

| 视口 | 行为 |
|------|------|
| desktop ≥1280 | Palette 固定 `lg:w-64` 左侧；Grid 12 列 |
| tablet/mobile | Palette 全宽置顶；Grid 单列堆叠 |
| 键盘 | Palette `Button` 可 Tab 聚焦；`focus-visible:ring-brand-500` |
| ARIA | `ChartPanel` 保持 `aria-label`；KPI 卡 `role="group"` + `aria-label="{title}指标"` |
| 长文本 | widget 标题 `truncate`；KPI 标签 `line-clamp-2` |

### 7.6 视觉 QA 清单（P3/P4 执行）

| # | 检查项 | desktop | mobile |
|---|--------|:-------:|:------:|
| 1 | Palette 两组对齐、按钮无重叠 | 截图 | 截图 |
| 2 | 四类 widget view 模式出数态 | 截图 | 截图 |
| 3 | loading/error/empty 三态无色彩漂移 | light+dark | 375px |
| 4 | KPI 数字不裁切、tabular-nums | 截图 | 截图 |
| 5 | 地图/热力容器无溢出；横向 `overflow-x-auto` 若需 | 截图 | 截图 |
| 6 | `pnpm run check:design` 无新增 hex 违规 | CI | — |

## 8. 测试策略

| 层 | 文件 | 覆盖子项 |
|----|------|----------|
| BE unit/integration | `test_dash_m5_widgets.py` | DASH-003 registry/render-spec |
| BE protocol | `test_view_m5_protocol.py` | VIEW-001 round-trip/破坏 |
| BE nfr | `test_nfr_001_first_screen_smoke.py` | NFR-001 budget |
| FE component | `charts.dash003.smoke.test.tsx` | DASH-003 渲染 |
| FE perf | `dashboard-first-screen.perf.smoke.test.tsx` | NFR-001 P95 |
| 回归 | `test_view_gov_api_r31.py` 子集 | VIEW 边界不退化 |

**执行**：`cd backend && pytest tests/test_dash_m5_widgets.py tests/test_view_m5_protocol.py tests/test_nfr_001_first_screen_smoke.py`；`cd fe && pnpm vitest run src/components/charts/charts.dash003.smoke.test.tsx src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx`。

## 9. 文档同步（P3/P5）

| 变更 | 文档 |
|------|------|
| 新 chart types | `docs/api/README.md`（若 catalog 描述变更） |
| views protocolVersion | `docs/services/views.md` |
| PRD 勾选 | `F07-DASH.md` DASH-003、`F09-VIEW.md` VIEW-001、`F15-NFR.md` NFR-001（P5） |

## 10. Spec self-review

| 检查项 | 结果 |
|--------|------|
| 占位符 TBD/TODO | 无 |
| 覆盖 round-target 三项 | 是 |
| 文件数 ≤20 | 18 |
| 未超范围框定 | 是（无 M6 CAT/GOV、无 Dataset、无 L7） |
| UI 设计交付完整 | 是 |
| 内部一致性 | protocolVersion 与 layout.version 分层已说明 |
