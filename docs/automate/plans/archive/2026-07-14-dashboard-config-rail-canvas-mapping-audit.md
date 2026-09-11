# 看板右栏配置 ↔ 画布真实映射审计与修复方案

Plan type: Headless Automation Plan  
日期：2026-07-14  
触发：右栏 `DashboardContextInspector` / 图表 `数据·样式·高级` Tab 与左侧画布交互断点多  
关联：`docs/automate/plans/2026-07-14-dashboard-style-layer-cascade-fix.md`（画板/壳层分层，本方案在其上补「控件级接线」）  
PRD 锚点：DASH-008（看板编辑）、DASH-005（图表）

---

## 0. 需求契约

| 字段 | 值 |
|------|-----|
| request | 右栏每一项配置必须与左侧画布/预览/发布视图有**可验证**的功能映射；断项须接线或降级（禁用+说明） |
| type | audit + phased fix |
| scope_include | `DashboardContextInspector`、`dashboardConfigPanels`、`ChartEditorColumn` 三 Tab、像素/栅格双壳层、`ChartRenderer` 适配器 |
| scope_exclude | 后端 schema 变更；辅助线/条件样式/跳转等明确标为「后续版本」的新能力开发 |
| acceptance | 本方案 §4 各 Phase 验收清单 + 新增 rail↔canvas 契约单测 |
| risk_level | medium（涉及样式分层与多 renderer 分派） |

---

## 1. 审计方法

### 1.1 状态路径约定

| 层级 | 存储 | 典型消费者 |
|------|------|------------|
| 看板级 | `layout.styleConfig` | `DashboardStyleSurface`、`DashboardGrid`、`PixelCanvas`、`DashboardWidget` |
| 组件级 | `widget.title`、`widget.chartConfig`、`widget.filterConfig` 等 | `DashboardWidget`、`PixelShape`、`ChartRenderer` |
| 图表 DE 扩展 | `chartConfig.nativeBody.{deStyle,deFeatures,deDisplay,deTableStyle}` | `ChartStylePanel`、`ChartRenderer`、表格适配器 |
| 联动 | `linkage.linkageRules` | `buildWidgetFilterParams` → 图表 execute |

### 1.2 严重度定义

| 标签 | 含义 |
|------|------|
| **WORKING** | 改动能即时或保存后在画布/预览可见 |
| **PARTIAL** | 仅部分布局/图表类型/模式生效 |
| **DEAD** | 写入 state 但无消费者 |
| **MISLEADING** | UI 暗示生效，实际无效或行为与文案不符 |

### 1.3 Rail 切换（编辑页）

`DashboardEditPage.tsx`：选中图表 → `ChartEditRail`；筛选/文本/媒体/Tabs → 各自 Inspector；无选中 → `DashboardContextInspector`。

---

## 2. 逐项审计清单

### 2.1 DashboardContextInspector（无选中 / 仪表板风格）

#### A. 仪表板风格

| 控件 | 状态路径 | 画布映射 | 严重度 | 证据 |
|------|----------|----------|--------|------|
| 浅色/深色主题 | `styleConfig.colorScheme` | `DashboardStyleSurface` → `data-dashboard-color-scheme`；画板默认底色 | WORKING | `DashboardStyleSurface.tsx` |
| 保存 | 整板 layout 持久化 | 编辑态样式**已实时**预览；保存仅持久化 | MISLEADING | 文案易误解为「未保存不生效」 |
| 说明文案 | — | 与顶栏深浅色隔离方向一致 | WORKING | `dashboardConfigPanels.tsx` |

#### B. 整体配置

| 控件 | 状态路径 | 画布映射 | 严重度 | 证据 |
|------|----------|----------|--------|------|
| 主题强调色 | `themeAccent` | 仅写 `--dashboard-accent`，**无 CSS 消费** | DEAD | `DashboardStyleSurface.tsx` L25–26 |
| 全局字体 | `fontFamily` | 看板 scope 继承 | WORKING | `DashboardStyleSurface.tsx` |
| 组件默认圆角 | `widgetStyle.borderRadius` | 栅格外壳 `mergeWidgetShellStyle`；像素 `pixel-shape-inner` 硬编码白底 | PARTIAL | `PixelShape.tsx` L360 |
| 组件间隙 | `gapPreset` / `widgetGap` | 仅栅格 v1 `DashboardGrid` | WORKING（已标注栅格） | `DashboardGrid.tsx` |
| 像素间隙 | `pixelGutter` | 像素 v2 `PixelCanvas` | WORKING | `resolvePixelGutter` |
| 缩放模式 | `scaleMode` | 编辑/预览/缩略图 | WORKING | `geometry.ts` |
| 刷新频率(秒) | `refreshIntervalSec` | **仅** `DashboardSharePage` 整页 reload | PARTIAL | placeholder 已写「分享页」 |
| 结果展示数量 | `defaultQueryLimit` | `resolveChartQueryLimit` → 图表 query | WORKING | `chartDeDisplay.ts` |

#### C. 仪表板背景

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 底色 / 装饰 / 自定义图 | `canvasBackground` / `canvasBackgroundImage` | `resolveArtboardStyle` → artboard | WORKING |

#### D. 图表样式（看板级 widgetStyle）

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 背景色 / 圆角 / 边框 / 透明度 | `widgetStyle.*` | 栅格 `DashboardWidget` 外壳；**像素 shape 未读** | PARTIAL |

#### E. 图表配色（看板级）

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 调色板预设 | `paletteId` + `paletteColors` | `ChartRenderer`；可被组件 `deStyle.paletteId` 覆盖 | WORKING |

#### F. 图表标题（看板级）

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 字号 / 颜色 | `titleStyle.*` | 像素 `WidgetShapeChrome` + `mergeChartTitleStyle`；栅格编辑栏**未合并**组件 `deStyle.title` | PARTIAL |

#### G. 查询组件

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 标题位置 上/左 | `filterChromeStyle.titlePosition` | `FilterWidget` **未读取** | DEAD |
| 控件高度 | `filterControlStyle.height` | `FilterWidget` input 高度 | WORKING |
| 标题颜色 | `filterChromeStyle.titleColor` | `FilterWidget` 可读，**面板无控件** | PARTIAL |
| 控件圆角 | `filterControlStyle.borderRadius` | 类型存在、Filter 可读，**面板无控件** | PARTIAL |

#### H. 数字内容格式

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 格式/小数/单位/千分符 | `numberFormat.*` | **仅 KPI** `KpiCard` | PARTIAL |
| 单位语言（disabled） | — | 占位 | DEAD |

#### I. 高级样式

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 联动/钻取图标色 | `actionIconColor` | **无消费者** | DEAD |

#### J. 筛选联动

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 联动规则 CRUD | `linkage.linkageRules` | 编辑态 `effectiveLinkage` 即时过滤图表 | WORKING |

---

### 2.2 ChartEditRail — 数据 Tab

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 切换图表类型 | `chartType` | 换类型 + 槽位容量 | WORKING |
| 维度/指标槽 | `dimensions[]` / `metrics[]` | `useChartExecute` 自动重查 | WORKING |
| 图表过滤器 | `filters[]` | 编入 execute | WORKING |
| 刷新频率 | `deDisplay.refreshMode` | **仅 view 模式**轮询；编辑画布不刷新 | PARTIAL |
| 结果展示 | `deDisplay.resultLimit` | `resolveChartQueryLimit` | WORKING |
| 更新图表数据 | — | 主要 `/charts/validate` + 字段列刷新；查询已随 config 自动跑 | MISLEADING |
| 右侧数据集/字段 | `datasetId` 等 | 选源、点字段入槽 | WORKING |

---

### 2.3 ChartEditRail — 样式 Tab

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 样式子类型 | `styleVariant` | bar `stacked` 等部分 Apex 路径；高级图走 spec | PARTIAL |
| 配色（跟随/覆盖） | `deStyle.paletteId` | `ChartRenderer` | WORKING |
| 标题 显示/文本/字号/颜色/对齐 | `deStyle.title` + `widget.title` | 像素 `WidgetShapeChrome`；栅格标题样式未完全合并 | PARTIAL |
| 备注 | `deStyle.remark` | 像素 `WidgetShapeChrome`；栅格无 | PARTIAL |
| 图例 | `deStyle.legend` | **仅 Apex bar/line** | PARTIAL |
| 数据标签 + 字号 | `deStyle.label` + `deFeatures.showLabel` | **仅 Apex bar/line** | PARTIAL |
| 标签格式/千分符 | `deStyle.label.formatType` 等 | 面板内示例文案 only | DEAD / MISLEADING |
| 背景 色/内边距/圆角 | `deStyle.background` | **ChartRenderer 未消费** | DEAD |
| 边框 | `deStyle.border` | **未消费** | DEAD |
| **表格专用** `deTableStyle` | `nativeBody.deTableStyle` | `EmbeddedChartTable` | WORKING |

---

### 2.4 ChartEditRail — 高级 Tab

| 控件 | 状态路径 | 画布映射 | 严重度 |
|------|----------|----------|--------|
| 缩略轴 dataZoom | `deFeatures.dataZoom` | 适配器**未读取** | DEAD |
| 显示数据标签 | `deFeatures.showLabel` | 与样式 Tab 重复；仅 Apex | PARTIAL / MISLEADING |
| 时间范围 | `timeRange` | SQL 模式 `buildTimeRangeParameters` | PARTIAL |
| 辅助线 / 条件样式 / 跳转 | — | disabled 占位 | DEAD（预期） |
| 打开筛选联动 | 导航 | 切到 `DashboardContextInspector` 联动区 | WORKING |

---

### 2.5 跨组件 Inspector（摘要）

| Inspector | 严重度 | 备注 |
|-----------|--------|------|
| FilterWidgetInspector | WORKING | 维度/控件类型/默认值 |
| TextEditRail 数据/样式 | WORKING | 高级 disabled |
| MediaWidgetInspector | WORKING | |
| TabsWidgetInspector | WORKING | |

---

### 2.6 栅格 vs 像素 能力矩阵

| 能力 | 栅格 v1 | 像素 v2 |
|------|---------|---------|
| `widgetGap` | ✓ | ✗（用 `pixelGutter`） |
| 看板级 `widgetStyle` 外壳 | ✓ | ✗（inner 硬编码） |
| 组件标题/备注/对齐 | 标题栏在 `DashboardWidget`；备注无 | `WidgetShapeChrome` 完整 |
| 组件级 `deStyle.title` 覆盖看板标题样式 | ✗ 栅格未 merge | ✓ |
| 图例/标签 deStyle | 受 ChartRenderer 限制 | 同左 |

---

## 3. 根因归类

| 根因 | 表现 | 涉及文件 |
|------|------|----------|
| **R1 写而不读** | 配置入库无 consumer | `themeAccent`、`actionIconColor`、`filterChromeStyle.titlePosition`、`deStyle.background/border`、`dataZoom` |
| **R2 壳层双轨** | 栅格与像素走不同组件树 | `DashboardWidget` vs `PixelShape` + `WidgetShapeChrome` |
| **R3 Renderer 分派不全** | deStyle 只接 Apex 柱/线 | `ChartRenderer.tsx`、`AdvancedEchartsChart.tsx` |
| **R4 看板级 vs 组件级未分层说明** | 同一概念两处配置，优先级不清 | `dashboardConfigPanels` vs `ChartStylePanel` |
| **R5 文案/占位误导** | 「保存后生效」「更新图表数据」、disabled 项无统一标记 | 各 Panel |

---

## 4. 分阶段修复方案

### Phase 0 — 诚实化 UI（1–2d，低风险）

**目标**：先消除 MISLEADING，不新增能力。

| ID | 任务 | 改动 |
|----|------|------|
| P0-1 | 仪表板风格保存文案 | 「保存布局」/「样式已实时预览，保存后发布生效」 |
| P0-2 | 「更新图表数据」 | 改「校验配置并刷新字段」；tooltip 说明查询随槽位自动刷新 |
| P0-3 | 样式 Tab 标签格式 | 标注「当前仅 KPI 与示例预览」或 `disabled` 至 Phase 2 |
| P0-4 | DEAD 控件临时处理 | `themeAccent`、`actionIconColor`、`filterChromeStyle.titlePosition` → `disabled` +「即将支持」或从面板移除 |
| P0-5 | 高级 Tab 数据标签 | 移除重复 Switch，保留样式 Tab 一处 |

**验收**：右栏无「改了完全无反应」且未标注的控件；`DashboardContextInspector.test.tsx` 更新快照/断言。

---

### Phase 1 — 样式分层接线（3–5d，与 style-layer-cascade 对齐）

**目标**：看板级 / 组件级 / 图表内三层 cascade 可预测。

| ID | 任务 | 改动 | 验收 |
|----|------|------|------|
| P1-1 | 像素壳层读 `widgetStyle` | `PixelShape` outer/inner 应用 `mergeWidgetShellStyle(dashboardStyle.widgetStyle)`；移除 inner 硬编码 `bg-white` | 改圆角/背景，像素组件即时变 |
| P1-2 | 组件 `deStyle.background/border` | 在 `pixel-shape-inner` 或 `ChartRenderer` embedded 外包一层应用 `deStyle` | 样式 Tab 背景/边框在画布可见 |
| P1-3 | 栅格标题 merge | `DashboardWidget` 栅格路径统一 `mergeChartTitleStyle` | 组件级标题字号/颜色覆盖看板级 |
| P1-4 | 筛选器标题位置 | `FilterWidget` 读 `titlePosition` 切换 flex 布局 | 右栏「上/左」即时生效 |
| P1-5 | 主题强调色 | `index.css` 或 chart action rail 用 `--dashboard-accent` | 改色后选中框/品牌强调可见 |

**代码锚点**：`PixelShape.tsx`、`DashboardWidget.tsx`、`FilterWidget.tsx`、`chartDeStyle.ts`、`index.css`

**单测**：`dashboardStyleConfig.test.ts` cascade；`WidgetShapeChrome.test.tsx` + 新 `pixelShapeShellStyle.test.ts`

---

### Phase 2 — ChartRenderer 能力对齐（5–8d）

**目标**：样式/高级 Tab 按 **renderer × chartType** 分派，不可用则 disabled。

| ID | 任务 | 改动 | 验收 |
|----|------|------|------|
| P2-1 | 能力矩阵 | 新增 `chartInspectorCapabilities.ts`：`{ legend, label, dataZoom, styleVariant }` per type | 饼图/关系图/表格 样式 Tab 自动 disable 图例等 |
| P2-2 | AdvancedEcharts 接 deStyle | 图例/标签/配色传入 ECharts option | 关系图改图例位置生效 |
| P2-3 | dataZoom | Apex + ECharts 读 `deFeatures.dataZoom` | 高级 Tab 缩略轴可见 |
| P2-4 | 标签 formatter | Apex `dataLabels.formatter` + 表格列格式 hook | 格式类型/千分符在柱线图生效 |
| P2-5 | numberFormat 扩展 | 非 KPI 图表 tooltip/轴标签可读看板 `numberFormat` | 看板级数字格式对柱图 tooltip 生效 |

**单测**：`ChartRenderer` + `AdvancedEchartsChart` 快照/option 断言；`ChartStylePanel` 按 type mock capabilities。

---

### Phase 3 — 刷新与联动一致性（2–3d）

| ID | 任务 | 验收 |
|----|------|------|
| P3-1 | 统一刷新模型文档 + UI | 看板 `refreshIntervalSec` vs 组件 `deDisplay.refreshMode` 在面板互链说明 |
| P3-2 | 编辑态预览刷新（可选） | 编辑画布在 `refreshMode=auto` 时也可轮询（feature flag） |
| P3-3 | `actionIconColor` | 用于 `PixelShapeActionRail` / 钻取图标 |

---

### Phase 4 — 明确排除（不本期实现）

保持 `disabled` + 文案：辅助线、条件样式、跳转、单位语言、背景图上传 API。

---

## 5. 配置优先级契约（修复后文档化）

写入 `docs/services/dashboard.md` 或 `fe/src/components/README.md`：

```
看板 theme (colorScheme, fontFamily, canvasBackground)
  └─ 看板 widgetStyle / titleStyle / paletteId / numberFormat（默认）
       └─ 组件 widget.title / filterConfig / textConfig
            └─ 图表 deStyle / deFeatures / deDisplay（覆盖看板默认同类项）
```

**冲突规则**：
- 配色：`deStyle.paletteId` > 看板 `paletteId`
- 标题样式：`deStyle.title` > 看板 `titleStyle`（显示开关仅 `deStyle.title.show`）
- 查询条数：`deDisplay.resultLimit` > 看板 `defaultQueryLimit`

---

## 6. 验收总表（Phase 1+2 完成后）

| # | 操作 | 期望画布反应 |
|---|------|--------------|
| 1 | 看板背景改点阵 | artboard 即时变 |
| 2 | 看板组件圆角 16 | 像素+栅格组件外壳圆角变 |
| 3 | 看板标题色红 | 所有未覆盖组件标题变红 |
| 4 | 单图标题色蓝 | 仅该图标题变蓝（覆盖看板） |
| 5 | 关「显示标题」 | 预览隐藏标题；编辑仍可内联改（DE 行为） |
| 6 | 样式 Tab 背景色 | 组件内区背景变 |
| 7 | 筛选标题改左 | 筛选器布局变横向 |
| 8 | 高级 dataZoom 开 | 柱/折线底部缩略轴出现 |
| 9 | 联动规则添加 | 改筛选后目标图数据变 |
| 10 | 改 pixelGutter | 画布右侧缩放空隙变 |

---

## 7. 建议执行顺序

```
P0 诚实化 → P1-1/P1-2 像素壳层 → P1-3 标题 merge → P1-4 筛选器 → P2-1 能力矩阵 → P2-2/P2-3 renderer 接线
```

与 `2026-07-14-dashboard-style-layer-cascade-fix.md`：**先合并 T2/T3（artboard 透明 + inner 去硬编码）再执行本方案 P1-1/P1-2**，避免重复改 `PixelShape`。

---

## 8. 文件索引

| 用途 | 路径 |
|------|------|
| 看板配置面板 | `fe/src/components/dashboard/dashboardConfigPanels.tsx` |
| 看板 Inspector | `fe/src/components/dashboard/DashboardContextInspector.tsx` |
| 图表三 Tab | `fe/src/components/dashboard/ChartEditorColumn.tsx` |
| 样式 Tab | `fe/src/components/dashboard/ChartStylePanel.tsx` |
| 高级 Tab | `fe/src/components/dashboard/ChartAdvancedPanel.tsx` |
| DE 样式契约 | `fe/src/lib/chartDeStyle.ts` |
| 像素壳层 | `fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`、`WidgetShapeChrome.tsx` |
| 图表绘制 | `fe/src/components/charts/ChartRenderer.tsx` |
| 编辑页 Rail 路由 | `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` |

---

## 9. 统计摘要

| 严重度 | DashboardContextInspector | 图表·数据 | 图表·样式 | 图表·高级 |
|--------|-------------------------|-----------|-----------|-----------|
| WORKING | 9 | 6 | 2 (+表格) | 1 |
| PARTIAL | 6 | 2 | 6 | 2 |
| DEAD | 4 | 0 | 3 | 3 |
| MISLEADING | 1 | 1 | 1 | 1 |

**结论**：右栏 UI 覆盖面已对标 DataEase，但约 **35% 控件** 为 PARTIAL/DEAD/MISLEADING。优先 Phase 0 止损，再 Phase 1 壳层接线，Phase 2 按 renderer 矩阵补齐。
