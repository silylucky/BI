---
name: vitalspan-bi
version: 3.0.3
description: "VitalSpan BI 插件：customViz 入库 + compose/get/upload 大屏闭环，禁止盲试 publish。"
metadata: {}
---

# VitalSpan × DeepTalk（插件内置，直接可用）

## 前置

1. 安装本插件 ZIP（`vitalspan-v0.3.1.zip`）
2. VitalSpan 后端运行：`http://127.0.0.1:8000`（开发默认 **admin / changeme**）
3. （推荐）工作区 `config.json` 设 `vitalspan.vitalspan_root` 指向 VitalSpan 克隆，可走 Python 全量 lint（见 `assets/config.example.json`）

## 工作流 ② 标准路径（禁止 70 步盲试）

| 步骤 | 工具 / 命令 | 说明 |
|------|-------------|------|
| 1 | `vitalspan_scaffold_artifact` | **先判范式**（下表）→ 选对应 **template**；禁止默认 html-minimal 硬改 |
| 2 | 改 `examples/<id>.bundle.html` 或 JSON | 保留 mount / p.style / id=vs-cv-* |
| 3 | `vitalspan_validate_artifact` | **必须先过**；失败看 `→ 修复:` 行 |
| 4 | `vitalspan_publish_artifact` | **须先 validate 成功**（validate stamp）；再 POST/PUT |
| 5 | `vitalspan_completion_gate workflow=2` | 带 publish 的 tool_stdout |

金样 template 共 **5 套**（`assets/templates/`），**一套范式对应一套金样 + 一套 fieldSlots**，禁止混用。

### customViz 范式 × 金样 × fieldSlots（全部 scaffold · 必守）

| 范式 | 何时用（交互/数据） | template | runtime | dimensions | metrics |
|------|---------------------|----------|---------|------------|---------|
| **P1 笛卡尔** | 类别轴 + 数值；排名/对比/趋势 | `ranking-bar` · `trend-line` | html / **d3** | min≥1，通常 max=1 | min≥1，通常 max=1 |
| **P2 多维明细** | 多列平铺展示，**不做聚合**；滚动/静态表 | **`scrolling-table`** | html | min≥1，**max>1** | **`min=0, max=0`** |
| **P3 滚动条** | 单列文案 + 可选等级/数值 | `alert-feed` | html | min=1, max=1 | min=1, max=1 |
| **P4 通用 DOM** | KPI 卡、简单双列、未定形态 | `html-minimal` | html | min≥1 | min≥1 |

**全部范式通用（任一 bundle 都必须）**

- `host.vsCv.mount` + `(p && p.style) || {}` + 容器 `id="vs-cv-*"`
- render 读 `p.bindingStatus` / `p.error` / `p.rows` / `p.columns`（及 cartesian 时 `p.encoding` + helpers）
- **未绑定/缺字段/查询失败**须在组件内显示人话（金样 `statusHint` 模式）
- **fieldSlots 必须与范式一致**；改 HTML 时**同步改 manifest**，禁止只改 render 不改 slots
- **禁止**从零写 manifest；**禁止**跳过 validate 直接 publish

**范式错配（任何组件都会踩，与 id 无关）**

| 错配 | 后果 | 修复 |
|------|------|------|
| P2 交互却用 P4/P1 金样（`metrics.min≥1`） | 只绑维度列**不出数** | 换 `scrolling-table` 或 `metrics.min=0,max=0` |
| P1 却设 `metrics.min=0` | 无法绑数值轴 | 换 `ranking-bar` / `trend-line` |
| P1 折线却用 html 金样手写 d3 | 422 / 无缩放 | `template=trend-line`，`host.vsCv.d3` |
| validate 报 warn 后循环重试 | 假进度 | **改一处 → validate 一次 → publish** |

validate 见 **`[warn] AIVIZ_WARN_DETAIL_TABLE_METRICS`**：表示 **fieldSlots 不符合 P2 多维明细范式**（`dimensions.max>1` 时不应 `metrics.min≥1`），按上表改 slots 或换金样。

文档真源：`docs/api/vs-ai-spec/guides/CUSTOM-VIZ-AUTHOR.md` · 金样目录 `assets/templates/`

### D3 运行时（必读 · v0.2.8 对齐平台）

| ❌ 禁止 | ✅ 正确 |
|---------|---------|
| `<script src="https://...d3...">` 或任何 CDN | `manifest.runtime: "d3"` + 平台注入 **`host.vsCv.d3`** |
| 把 d3.min.js 粘贴进 bundle（≥200KB + `d3.version` → 422） | `var d3 = host.vsCv.d3;` 在 mount 回调内使用 |
| 指望 iframe 沙箱跑整页 | **无 iframe**；bundle 在同页执行 |
| `d3.select('#app')` | 容器 `id="vs-cv-*"`，在 mount 给的 `p` 上渲染 |

**html 明细/Canvas**：`runtime: "html"`，DOM/CSS/`requestAnimationFrame` 即可；**不必**强行 d3。

**DeepTalk 预览 ≠ 验收**：组件是否可用以 **5173 看板**（绑 Dataset、样式面板）为准，不是 show-widget 草图。

### 422 禁止盲试 — 常见修复

| 错误 | 一行修复 |
|------|----------|
| 缺 fieldSlots | 用 scaffold 选范式金样，勿从零写 JSON |
| `metrics.min must be >= 1` | 仅 **P2** 允许 `metrics.min=0`（须 `dimensions.max>1`）；P1/P3/P4 须 min≥1 |
| **`AIVIZ_WARN_DETAIL_TABLE_METRICS`** | fieldSlots 与 **P2 范式**不符：P2 须 `metrics.min=0,max=0` 或换 `scrolling-table` 金样 |
| `AIVIZ_INLINE_D3_FORBIDDEN` | 删内联 d3；改 `host.vsCv.d3` |
| `AIVIZ_FICTION_API` | 删 `getStyle()` / `vs-cv-style-update` / `.vs-cv-style`；用 `(p&&p.style)` + mount 重绘 |
| `AIVIZ_UNSAFE_CONTENT` | 禁 `id=app/root`、HTML `onclick=`、`.onmouseenter=`；悬停暂停用 **CSS** `:hover{animation-play-state:paused}` |
| partial 样式 | `host.vsCv.mount` + `(p&&p.style)` + schema 中文 title |

## customViz 入库自检清单（工作流 ② · publish 前必过）

**目标**：组件库卡片 **无 ⚠**、底部 **「样式合规」**（`styleComplianceTier=full`，`warnings=0`）；右侧样式面板 **中文标签**且 **改动能即时生效**。

### A. 生命周期（硬规则）

- [ ] `host.vsCv.mount(function (p) { … })` 注册渲染（html/d3 均必须）
- [ ] 每次 payload/style 变化都走 **mount 回调** 重绘
- [ ] **禁止** `vs-cv-style-update` 事件（平台不存在）
- [ ] **禁止** `host.vsCv.getStyle()` / 读 `.vs-cv-style`（平台不存在）
- [ ] d3 禁止内联整库；必须 `host.vsCv.d3`

### B. 样式读取（面板生效的关键）

- [ ] render 内：`var st = (p && p.style) || {};`
- [ ] 每个可配项用 `st.xxx` 驱动 DOM/CSS（颜色、高度、间距、开关等）
- [ ] 或 CSS 使用 `var(--vs-style-*)` / `var(--vs-palette-*)` / `var(--dashboard-*)`
- [ ] boolean 开关（如显示数值）须在 JS 里读 `st.showXxx`，不能只写死

### C. manifest.styleSchema（中文面板）

- [ ] 每个 `properties.<key>` 必须有 **`"title": "中文标签"`**（禁止裸 camelCase）
- [ ] 可选 `x-styleSections` 分组（如「条形颜色」「显示与尺寸」）
- [ ] `defaultStyle` 与 schema 键名 **一致**

### D. manifest.styleHooks（推荐）

- [ ] boolean 项配 `hideWhenFalse` + `hideSelectors`（如 `.bar-value`、`.rank-badge`）
- [ ] `styleHooks` 的 key 必须在 `styleSchema.properties` 里声明

### E. publish 后验收（必须执行）

1. `vitalspan_publish_artifact` → 输出含 **`styleComplianceTier=full`** 且 **无 warn**
2. 若 `partial` / `visual-only` / 有 warnings → **不得结束**；按 A–D 修 bundle 后 **PUT 同一 artifactId**
3. `vitalspan_completion_gate workflow=2` 且传入 publish 的 **tool_stdout**
4. 5173 图表盘「自定义」：无 ⚠、标签中文、改色/改高度即时生效

### 反例（范式错配 · 与 manifest.id 无关）

| 错误写法 | 后果 |
|----------|------|
| **P2 交互**却 scaffold **P4**（`html-minimal`）且保留 `metrics.min≥1` | 只绑维度列不出数 |
| **P1 交互**却设 `metrics.min=0` | 数值轴无法绑定 |
| 只监听 `vs-cv-style-update` | 样式面板不生效 |
| schema 无 `title` | 面板显示 `barColor` 等英文 |
| 颜色写死在 CSS 渐变 | 改 top1Color 无效 |
| 未用 `mount` | resize/样式不同步；warn |

参考修复样例：`docs/api/vs-ai-spec/examples/custom-viz-ranking-bar-chart-fixed.json`（VitalSpan 仓）

---

## 用户要拼看板/大屏 → 两段式（compose 骨架 + JSON 改样式）

```
vitalspan_list_layout_templates
```

### 阶段 A：搭骨架（compose）

**必须**指定 `template=` 且 `surface_kind` 与模板一致。**禁止从零手写坐标算 x/y**。

```
vitalspan_compose_dashboard
  surface_kind=data-screen
  template=de-classic-cockpit
  chart_types=kpi,kpi,kpi,kpi,line,pie-donut,bar,map
  artifact_ids=<uuid1>,...
  name=数据分析驾驶舱
```

记下 `dashboardId=...`。

### 阶段 B：改样式（get → patch → upload）

```
vitalspan_get_dashboard_layout
  dashboard_id=<uuid>
  file=examples/my-screen.json
```

**只改样式字段**（勿动坐标，除非用户要求改布局）：

| 层级 | 路径 |
|------|------|
| 整屏 | `layoutJson.styleConfig`（背景、卡片圆角、标题色） |
| 内置图 | `widgets[].chartConfig.nativeBody.deStyle`（配色、圆角、图例） |
| customViz | `widgets[].customVizConfig.style` / `displayStyle` / `widgetStyle` |

金样：`assets/templates/dashboard-style-patch.example.json`（VitalSpan 仓 `docs/api/vs-ai-spec/examples/`）

```
vitalspan_upload_dashboard
  dashboard_id=<uuid>
  file=examples/my-screen.json
```

文档真源：`docs/api/vs-ai-spec/guides/COMPOSE-STYLE-WORKFLOW.md`

**数据大屏示例（仅 compose，不改样式时一步完成）：**
```
vitalspan_compose_dashboard
  surface_kind=data-screen
  template=de-kpi-flow-wall
  chart_types=kpi,kpi,kpi,kpi,sankey,pie-donut,map,funnel,graph
  artifact_ids=<uuid1>,<uuid2>,...
  name=电商运营大屏
```

**仪表板示例：**
```
vitalspan_compose_dashboard
  surface_kind=dashboard
  template=dash-kpi-grid
  chart_types=kpi,kpi,kpi,kpi,bar,line,pie-donut,table-info
  artifact_ids=<uuid1>,...
  name=运营日报
```

| template id（data-screen · **仅 DE 壳层**） | 风格 |
|-------------|------|
| **`de-classic-cockpit`** | **默认首选** · 四 KPI + 线/饼/柱/地图 + 洞察带 |
| `de-sales-command` | 销售指挥 · 四 KPI + 宽趋势 + 明细表 |
| `de-balanced-four` | 2×2 柱/线/饼/雷达（最工整） |
| `de-map-command` | 居中大地图 + 侧栏 KPI/排名 |
| `de-kpi-flow-wall` | 四 KPI + sankey + 四象限（电商/流向） |

> 旧 id（`gov-cockpit`、`kpi-flow-banner` 等）已移除，compose 会报 `unknown layout template`。

| template id（dashboard · 1440） | 风格 |
|-------------|------|
| `dash-kpi-grid` | KPI 四宫 + 双行图表（推荐默认） |
| `dash-analytics-3col` | 三栏分析 |
| `dash-trend-hero` | 左侧大折线 |
| `dash-report-light` | 浅色汇报 + 宽表 |
| `dash-map-panel` | 地图 + 侧栏 |
| `dash-table-focus` | 明细表主导 |
| `dash-dark-ops` | 深色六面板 |
| `dash-mixed-cv` | CustomViz 混排 |
| `dash-minimal` | 极简三区块 |
| `dash-sales-board` | 销售 KPI + 柱线饼 |

不传 `template` 时走自适应网格（组件多时会变密）；**大屏/仪表板默认用模板**。

**内置图默认演示数据（v0.2.11+）**：`chart_types` 自动绑官方演示 **Dataset**（`__demo:sample_db__` 引用）。需 **sample-mysql :3307** + `seed-demo-package`。

**customViz** 仍走 bundle 静态演示，直到用户绑 Dataset。

## 两类素材（禁止混淆）

| 素材 | 工具 |
|------|------|
| 内置 chartType ~50 | `vitalspan_list_chart_types` |
| DeepTalk 自写组件 | `vitalspan_publish_artifact` → `vitalspan_list_artifacts` |

## 仪表板 vs 数据大屏

| | 仪表板 | 数据大屏 |
|---|--------|----------|
| surface_kind | `dashboard` | `data-screen` |
| 画布 | 1440（高可扩展） | **固定** 1920×1080 |

## 拼大屏常见失败（禁止再踩）

| 错误做法 | 后果 | 正确做法 |
|----------|------|----------|
| `compose` 塞 10+ 组件到 data-screen（旧版布局） | `y + height must not exceed canvas height` | **只用 `vitalspan_compose_dashboard`**（v0.2.2+ 自适应网格） |
| 从零手写 layout 算坐标 | 422 越界 / uuid 错误 | **compose + template**；改样式用 **get → patch → upload** |
| 手写 `examples/*.json` 用 `kpi-1`、`radar` 当 id | 422 uuid_parsing | widget `id` 须 UUID；用 compose 或 get 导出后再改 |
| 1920 布局上传到 dashboard 类型 | `canvas width must be 1440` | `surface_kind` 与目标 `dashboard_id` 一致 |
| 改 layout 里 surfaceKind 但不改 canvas | surface/canvas 双错 | surface_kind、canvas、目标 dashboard_id **三者一致** |
| 工具失败仍说「上传成功」 | 用户看到假成功 | 必须看到 `ok dashboardId=` 才能交付 |
| patch 时改了 x/y 导致重叠 | 布局乱 | **只改 styleConfig / deStyle / customVizConfig** |
| 跳过 get 直接猜 layout 结构 | 样式改错 widget | 先 `vitalspan_get_dashboard_layout` 再 patch |

**数据大屏硬性约束**：组件 `y + height ≤ 1080`；组件多时插件会自动缩小格子，不要自己算坐标。

## 工具

| 工具 | 何时用 |
|------|--------|
| `vitalspan_list_layout_templates` | 拼大屏/仪表板前选 20 套排布之一 |
| `vitalspan_compose_dashboard` | 一键创建+编排（带 `template=`） |
| `vitalspan_get_dashboard_layout` | **导出 layout** → 改样式 → upload |
| `vitalspan_upload_dashboard` | 保存 layout（`--file` 或 chart_types） |
| `vitalspan_scaffold_artifact` | ② 从金样复制 bundle（**新组件第一步**） |
| `vitalspan_validate_artifact` | ② 本地预检（publish 前必跑） |
| `vitalspan_publish_artifact` | ② 入库（内置预检 + 修复提示） |
| `vitalspan_completion_gate` | 结束前校验（workflow 2 带 tool_stdout） |
| 其余 | health / list_* / create |

## 禁止

- browser 登录 5173 · 只 list_artifacts · publish 金样（除非用户要求）
- **工具返回含 `isError` 或没有 `ok dashboardId=` 时，禁止对用户说「上传成功」**
- 目标是大屏时 **禁止** 在 layout 里写 `surfaceKind: dashboard`（旧 workaround；v0.2.3 upload 会自动修正，但仍应优先 `compose_dashboard`）
