# 图表样式 Tab 对标 DataEase 完善方案

> **Plan type**: Headless Automation Plan  
> **Cursor Build**: disabled  
> **Execution trigger**: dev-autopilot A5 plan-execute  
> **状态**：P0–P4 已实施 · code-review 二轮闭环完成（批次 A–C，2026-07-22）· **§4 矩阵 2026-07-30 刷新**（profiles 真理源 + P0/P1 shape 接线）  
> **触发**：看板/大屏编辑右栏「样式」Tab — 各 `chartType` 应有**独立**样式分区，且配置必须渲染生效  
> **真理源**：`fe/src/lib/chartTypeStyleProfiles.ts`（样式 Tab 分区）· `fe/src/lib/chartDeStyle.ts` · `fe/src/components/charts/engine/d3/inspectorCapabilityMatrix.ts` · `fe/src/lib/chartTableInspector.ts` · `docs/feature-design/2026-07-30-component-style-per-type-land-design.md`  
> **DE 参考**：[DataEase v2 图表样式设计](https://dataease.cn/docs/v2/user_manual/view_module/view_style_design/)（仅借鉴离线区域地图相关项，遵守 GEO-IRON-01）

---

## 0. 评审摘要

| 维度 | 现状 | 目标 |
|------|------|------|
| 通用壳层（背景/标题/备注/边框） | 大部分已接线至 widget shell | 栅格/像素双布局一致 |
| 配色/系列色/渐变/立体 | `palette` 分区较完整，D3 已消费 | 按类型门控补齐 |
| 图例/标签/提示 | 折柱 shell 图例 + D3 inline；标签格式部分类型生效 | 消除「UI 有、渲染无」 |
| **类型特化**（坐标轴/柱宽/仪表/漏斗…） | **几乎缺失** | 按 DE §2–§4、§8 逐型补齐 |
| 三源一致性 | metadata / matrix / registry 漂移 | 单源 `chartTypeStyleProfiles` |

**核心结论**：VitalSpan 已覆盖 DE 样式 Tab 的「外壳骨架」（背景、配色、标题、图例、标签、地图 geo）；**缺口集中在 DE「基础样式 / 大小 / 坐标轴」的类型特化块**，且存在多处假绿（样式 Tab 可配但 D3 `missing`）。

---

## 1. DataEase 样式 Tab 模型（官方文档）

DE 点击「样式」后，按图表类型动态组装折叠块。官方文档章节与 VitalSpan 映射如下：

| DE 章节 | 典型内容 | VitalSpan 现状 | 缺口 |
|---------|----------|----------------|------|
| §1 背景 | 内边距、圆角、背景色、背景图、边框 | `background` section → `deStyle.background/border` → shell | 栅格布局弱；plot 区背景未独立 |
| §2 基础样式 | 配色方案、系列色、渐变、透明度；柱圆角；饼 TopN；表列宽模式 | `palette` + `variantBasic`（子类型）+ `tableBasic` | 柱圆角/柱宽、饼外径/扇区间距、TopN |
| §3 大小 | 水波目标值；仪表 min/max/起止角；词云字号区间；气泡大小 | **无** | gauge/liquid/word-cloud 全缺 |
| §4 标签 | 颜色/字号；地图维指勾选；漏斗转化率；全量/自适应；堆叠总计标签 | `label` section 部分字段 | 位置、自适应、类型特化标签 |
| §5 提示 | 字号/颜色/格式 | 嵌在 `palette` 内 `tooltip` 子组 | 未独立 section；无轮播 |
| §6 标题 | 名称、字号、颜色、字间距、样式、对齐 | `title` section | 基本对齐 |
| §7 图例 | 图标/方向/位置/字号/颜色；地图色带等分/自定义区间 | `legend` section | 地图 visualMap 区间；radar/treemap 假绿 |
| §8 坐标轴 | 横纵轴：位置、轴名、轴线、标签、数值格式与单位 | **无** | 笛卡尔/散点/双轴/象限全缺 |
| §9 表格 | 表头/单元格/汇总色；列宽；分页；透视树形；冻结；合并；换行 | `tableBasic` + `tableColor` | 冻结/合并/表头分组/树形展示 |
| §10 提示轮播 | 柱/线/饼/双轴/地图 tooltip 自动轮播 | **无** | P4+ |
| §11 边框 | 颜色/圆角/线型/线宽 | `background` 内 `border` | 已覆盖 |
| §12 地图 | 地名标签、缩放级别、中心点、自定义区域 | `geo` 部分（离线子集） | 仅 `roam/showRegionLabel/visualMap`；**禁止**在线底图项 |

> **GEO-IRON-01**：DE §12 在线地图、瓦片 URL、高德风格等**不纳入**本方案；仅对标离线中国省级 choropleth + 矩阵热力。

---

## 2. VitalSpan 现有架构（代码实扫）

### 2.1 数据流

```
ChartEditRail
  └─ ChartInspectorProvider（patchDeStyle / mutateChartConfig）
       └─ ChartInspectorTabs → tab「样式」
            └─ ChartStylePanel
                 ├─ chartStyleSectionsForType(type)     // registry + metadata + tableProfile
                 ├─ filterStyleSectionsForChart(...)    // legend/label/remark 能力门控
                 └─ ChartStyleSection[sectionId]        // 折叠块 UI
                      └─ nativeBody.deStyle / deTableStyle / styleVariant
                           └─ applyChartStyleChain → applyD3Style / S2 buildS2SheetOptions
                                └─ D3 views / Widget shell
```

**入口文件**：`ChartEditRail.tsx` · `ChartEditorColumn.tsx`（`style={<ChartStylePanel />}`）· `ChartStylePanel.tsx` · `ChartStyleSection.tsx`

### 2.2 样式分区 ID（当前 33 种，2026-07-30）

定义：`fe/src/lib/chartStyleSectionRegistry.ts` · 分区组合真理源：`fe/src/lib/chartTypeStyleProfiles.ts`（**metadata.properties 已镜像 profiles，G13**）

| Section ID | UI 组件 | 写入路径 | 渲染消费 | 状态 |
|------------|---------|----------|----------|------|
| `variantBasic` | `ChartVariantBasicSection` | `cfg.styleVariant`；饼 donut → `deStyle.pie.innerRadiusPercent` | `styleVariant`→编码；`innerRadius`→`renderPie` | 部分：多数 type 仅 1 个 variant → **section 注册但 UI 为 null** |
| `palette` | `ChartPaletteStyleSection` | `deStyle.palette*` / `seriesColor` / `gradient` / `depth` / 嵌套 label·tooltip | `applyChartStyleChain` + `buildD3PresentationProps` | 大部分生效 |
| `title` | `ChartTitleStyleSection` | `deStyle.title` + `widget.title` | `mergeChartTitleStyle` → shell | 像素 ✓；栅格 partial |
| `remark` | `ChartRemarkStyleSection` | `deStyle.remark` | `WidgetShapeChrome` | 像素 ✓；栅格无 |
| `legend` | `ChartLegendStyleSection` | `deStyle.legend.*` | shell legend / D3 `legendLayout` | 按类型 partial（见 §5） |
| `label` | `ChartLabelStyleSection` | `deStyle.label` + `deFeatures.showLabel` | `__showLabel` / `valueFormat` | partial |
| `background` | `ChartBackgroundStyleSection` | `deStyle.background` / `border` | `resolveChartContentShellStyle` | shell ✓ |
| `geo` | `ChartGeoStylePanel` | `deStyle.geo.*` | `buildRenderConfig` → choropleth/heatmap/3D | map/heatmap ✓ |
| `tableBasic` | `ChartTableStylePanel` | `deTableStyle` 交互项 | S2 options | 近期已闭环 |
| `tableColor` | `ChartTableColorPanel` | `deTableStyle` 色板 | S2 theme | ✓ |

### 2.3 `ChartDeStyle` 契约（当前）

文件：`fe/src/lib/chartDeStyle.ts:100-118`

```typescript
ChartDeStyle = {
  paletteId?, paletteOpacity?, seriesGradient?, depthVisual?,
  seriesColor?: ChartSeriesColorItem[],
  title?, legend?, label?, tooltip?,
  background?, border?, remark?,
  geo?: { mapArea?, roam?, showRegionLabel?, visualMap?, showCellLabel? },
  pie?: { innerRadiusPercent? },
}
```

**不存在（P1+ 已增 compare 块）**：`gauge`、`liquid`、`funnel`、`sankey`、`graph`、`radar`、`wordCloud` 等类型块仍待系统化扩展；**已增** `quadrant` / `progressBar` / `bullet` / `stockLine` / `treemap` / `circlePacking` 块 — 见 `chartDeStyleBlocks.ts`。

### 2.4 样式管线 — 到达 D3 的键

| 阶段 | 文件 | 输出 |
|------|------|------|
| 上下文构建 | `buildStyleContext` | `chartColors`, `showLabel`, `seriesGradient`, `labelPresentation`, `tooltipPresentation` |
| Plan 补丁 | `applyD3Style.ts` | `color`, `innerRadius`, `__d3Theme`, `__showLabel`, `__showTooltip`, `__labelFontSize/Color`, `__seriesGradient`, `__tooltipPresentation`, `__valueFormat`, `__shellLegend`, `__legendShow`, `__dataZoom` |
| View props | `buildStyleProps.ts` → `buildD3PresentationProps` | `colors`, `theme`, `showLabel`, `legendLayout`, `depthVisual`, `conditionalRules`, `markLines` |
| Geo | `buildRenderConfig.ts` | `geoStyle.{roam,showRegionLabel,visualMap}`, heatmap `showCellLabel` |

**硬编码未暴露给 Inspector 的渲染参数**（调研摘录）：

- 柱宽：`renderDualAxesColumn.ts` `barWidth = min(28, …)` — 无 `deStyle` 入口
- 折线平滑：`buildCartesianConfig.ts` `smooth: Boolean(options.smooth)` — 来自 `styleVariant===smooth`，非独立样式项
- 饼外径：`renderPie.ts` 默认 outer 70% — 仅 `innerRadiusPercent` 可配
- 仪表弧度/指针色：`renderGauge.ts` 内部常量

### 2.5 门控函数（`chartStylePanelGates.ts`）

| 函数 | 规则 |
|------|------|
| `supportsDepthVisualToggle` | bar 系列、chart-mix 系列、heatmap、gauge、stock-line、funnel |
| `supportsSeriesGradientToggle` | 排除 table/t-heatmap/kpi/geo/gauge/liquid/radar/sankey/graph/word-cloud/stock-line |
| `resolveLegendEditorMode` | 无 legend→`none`；饼/瀑布/双向柱/漏斗→`d3`（隐藏方向/位置）；折柱→`shell` |
| `filterStyleSectionsForChart` | 按 `chartInspectorCapabilities` 过滤 legend/label/remark |

### 2.6 三源不一致（P0 必修）

| 源 A | 源 B | 漂移示例 | 裁决 |
|------|------|----------|------|
| `metadata.engineCapabilities` | `inspectorCapabilityMatrix` | `graph`：metadata `legend:true`，matrix `legend:missing` | **以 matrix 为准**（D3 实测） |
| `metadata.properties` | `chartStyleSectionRegistry` fallback | funnel 在 registry fallback 为 MINIMAL，metadata 为 FLOW_WITH_LEGEND | 以 metadata + tableProfile 为准 |
| `chartStyleSectionRegistry.test` | 当前 metadata | bar 测试期望**无** `variantBasic`，实际 `LINE_BAR_SECTIONS` **以 variantBasic 开头** | 更新测试 |
| `chartInspectorCapabilities.test` | matrix | graph legend 期望 true | 改为 false（与 matrix 一致） |
| 高级 Tab vs 样式 Tab | — | `showLabel` 两处可改 | 高级 Tab 仅 dataZoom/markLine/conditional/jump |

### 2.7 Catalog `styleVariants`（后端登记）

仅下列类型在 catalog 有多于 1 个 `styleVariant`（决定 `ChartVariantBasicSection` 是否渲染）：

| chartType | styleVariants | 说明 |
|-----------|---------------|------|
| `line` | default, smooth | smooth → `applyLineStyleVariant` |
| `gauge` | default, progress | UI 应展示但当前 section 在 MINIMAL 无 variantBasic |
| `graph` | default, force, dagre | section 在 MINIMAL，**variantBasic 未注册** |
| 其余 ~46 型 | default | `variantBasic` 注册但 `ChartVariantBasicSection` return null |

> **设计债**：`LINE_BAR_SECTIONS` 对所有柱/线/面积注册 `variantBasic`，但 catalog 仅 `line` 有 smooth；bar 等类型的 variantBasic 折叠块**永远为空**。

---

## 3. 通用分区字段级对照（已实现）

### 3.1 `palette` — `ChartPaletteDeParityFields`

| UI 控件 | deStyle 键 | D3/Shell 消费 | DE 对标 |
|---------|-----------|---------------|---------|
| 配色方案（含继承） | `paletteId` | `resolveChartColors` | §2 系统方案 |
| 系列色列表 | `seriesColor[]` | `applyChartStyleChain` 覆盖 `options.color` | §2 逐色调整 |
| 不透明度 | `paletteOpacity` | 颜色 alpha | §2 |
| 渐变颜色 | `seriesGradient` | `__seriesGradient` → area/line/column | §2 |
| 立体视觉 | `depthVisual` | `buildD3PresentationProps` | DE 无直接同名；VCDS 增强项 |
| 标签开关/字号/颜色 | `label.*` + `deFeatures.showLabel` | `__showLabel`, `__labelFontSize/Color` | §4 |
| 提示开关/字号/颜色/背景 | `tooltip.*` | `__tooltipPresentation` | §5 |
| 表格配色（table 专用） | `deTableStyle.*` | S2 theme | §9 |

### 3.2 `legend` — `ChartLegendDeParityFields`

| UI 控件 | deStyle 键 | 消费 | 备注 |
|---------|-----------|------|------|
| 显示 | `legend.show` | shell / `__legendShow` | |
| 图标形状 | `legend.icon` | `legendLayout` | shell 侧需确认 icon 全渲染 |
| 图标大小 | `legend.iconSize` | `legendLayout` | |
| 文本字号 | `legend.fontSize` | `legendLayout` | |
| 方向 | `legend.orient` | `legendLayout` | `editorMode=d3` 时**隐藏**（饼/漏斗等） |
| 水平/垂直对齐 | `legend.hAlign/vAlign` | `resolveLegendPositionFromAlign` | 同上 |
| 字体颜色 | — | **未暴露** | DE §7 有 |

### 3.3 `label` — `ChartLabelStyleSection`

| UI 控件 | deStyle 键 | 消费 |
|---------|-----------|------|
| 显示 | `label.show` + `deFeatures.showLabel` | `__showLabel` |
| 字体颜色/字号 | `label.color/fontSize` | presentation |
| 格式类型 | `label.formatType` | `valueFormat` |
| 千分符 | `label.thousandSeparator` | `valueFormat` |

**未实现**：标签位置、全量/自适应、堆叠总计标签、漏斗转化率（DE §4）。

### 3.4 `geo` — `ChartGeoStylePanel`

| UI 控件 | 条件 | deStyle 键 | 消费 |
|---------|------|-----------|------|
| 缩放平移 | map/map-3d | `geo.roam` | choropleth / 3D |
| 区域标签 | map（仅 2D） | `geo.showRegionLabel` | choropleth |
| 单元格数值 | heatmap | `geo.showCellLabel` | matrix heatmap |
| 数值色带 | 全部 | `geo.visualMap` | visualMap 组件 |

**未实现**：`geo.mapArea`（类型占位）；地图色带等分/自定义区间（DE §7）；map-3d 区域标签控件。

### 3.5 表格 — `ChartDeTableStyle`

`tableBasic` 字段：`opacity`, `borderColor`, `scrollbarColor`, `paginationMode/Variant/pageSize`, `columnWidthMode/columnWidths`, `wordWrap`, `showSummary`, `rowHover`

`tableColor` 字段：`headerBg/Fg`, `bodyBg/Fg`, `zebraBg`, `columnBg`, `cornerBg`, `borderColor`, `scrollbarColor`, `emptyHintFg`, `paginationFg/FontSize`

**类型有、UI 无**：`summaryBg/summaryFg`

**DE §9 未覆盖**：行列冻结、单元格合并、表头分组、透视树形/平铺、自定义聚合公式。

---

## 4. 逐类型样式 Tab 矩阵（49 catalog 项）

图例说明：

- **注册 sections**：`chartStyleSectionsForType` 原始列表
- **门控后**：经 `filterStyleSectionsForChart` 实际展示
- **D3 接线**：`inspectorCapabilityMatrix`（未登记则继承 metadata caps，表格/KPI 不走 matrix）
- **状态**：✅ 已对齐 · ⚠️ partial · ❌ 缺失/假绿

### 4.1 指标（quota）

| chartType | 注册 sections | 门控后 | D3 legend/label | DE 应有特化 | 现状缺口 |
|-----------|---------------|--------|-----------------|-------------|----------|
| `gauge` | background, palette, title | 无 legend/remark；label 有 | label:wired | §3 最小/最大/起止角/指针色；§2 progress 子类型 | ❌ 无 gaugeShape；catalog 有 progress 但无 variantBasic |
| `liquid` | 同 gauge | 同左 | label:wired | §3 目标值/动态值/轮廓 | ❌ 无 liquidShape |
| `kpi` | background, palette, title, label | 无 legend/remark；labelFormat only | —（React） | §4 指标字号/对齐/多指标布局 | ⚠️ 仅通用 label 格式 |

### 4.2 表格（table）

| chartType | 注册 sections | DE §9 对齐度 | 缺口 |
|-----------|---------------|--------------|------|
| `table`（legacy） | tableBasic, tableColor, palette, title, background | 分页/列宽/配色 ✓ | 走 React 老路径 |
| `table-info` | 同上 | +序号列 ✓ | 冻结/合并/表头分组 |
| `table-normal` | 同上 | +小计 ✓ | 同上 |
| `table-pivot` | 同上 | 配色 ✓ | 树形/平铺、按行头/列头展示指标 |
| `t-heatmap` | background, palette, geo, title | geo 色带 ✓ | 无 table 色块（符合 DE） |

### 4.3 趋势（trend）

| chartType | 注册 sections | D3 接线 | DE 特化缺口 |
|-----------|---------------|---------|-------------|
| `line` | LINE_BAR 全套 | legend/label/dataZoom/markLine/conditional: wired | ❌ 坐标轴 §8；折线点/线宽；variantBasic 仅 smooth |
| `area` | 同 line | wired | ❌ 坐标轴；面积透明度 |
| `area-stack` | 同 line | wired | ❌ 坐标轴；堆叠总计标签 §4 |
| `timeline`（deprecated→line） | 同 line | — | 迁移保留 styleVariant |

### 4.4 对比（compare）

| chartType | 注册 sections | D3 接线 | DE 特化缺口 |
|-----------|---------------|---------|-------------|
| `bar` | LINE_BAR | 全 wired | ❌ 柱宽 §2.10.4、圆角、坐标轴 |
| `bar-stack` / `percentage-bar-stack` | 同 bar | wired | ❌ 同上 + 百分比刻度 |
| `bar-group` / `bar-group-stack` | 同 bar | wired | ❌ 组间距 |
| `bar-horizontal` / `*-horizontal` | 同 bar | wired | ❌ 条形特化（横向轴） |
| `waterfall` | LINE_BAR | legend/label wired；dataZoom/markLine missing | ❌ 合计色/连接线样式；无坐标轴 |
| `bar-range` | LINE_BAR | legend:**missing**, label wired | ❌ 区间色/坐标轴 |
| `bidirectional-bar` | LINE_BAR | legend/label wired | ❌ 对称轴/中心线 |
| `progress-bar` | axis + cartesian + **progressBarShape** | legend missing, label wired | progressBarShape 轨道透明度 ✓（2026-07-30） |
| `stock-line` | axis + cartesian + **stockLineShape** | legend missing, label wired | stockLineShape 实体宽度比 ✓ |
| `bullet-graph` | axis + cartesian + **bulletShape** | legend missing, label wired | bulletShape 目标线/区间 ✓ |

### 4.5 分布（distribute）

| chartType | 注册 sections | D3 接线 | DE 特化缺口 |
|-----------|---------------|---------|-------------|
| `pie` | PIE_SECTIONS | legend/label wired | ⚠️ 仅 donut+pie 类型有内径；❌ 外径/padAngle/TopN §2 |
| `pie-donut` | 同 pie | wired | innerRadius ✓；❌ 外径 |
| `pie-rose` / `pie-donut-rose` | 同 pie | wired | ❌ 玫瑰半径模式 |
| `radar` | profile（无 legend） | legend:**missing**, label wired | radarShape ✓；legend 门控隐藏 |
| `treemap` | treemapShape + label | legend:**missing**, label wired | treemapShape 间距/圆角 ✓（2026-07-30） |
| `word-cloud` | wordCloudShape | label missing（profile 无 label） | wordCloudShape 字号/间距 ✓ |
| `wordCloud`（deprecated） | — | — | 迁 word-cloud |

### 4.6 地图（map）

| chartType | 注册 sections | D3 接线 | DE 特化（离线子集） |
|-----------|---------------|---------|---------------------|
| `map` | geo + palette + title + remark | label wired | roam/regionLabel/visualMap ✓；❌ 色带等分/自定义区间 |
| `map-3d` | 同 map | label **missing** | roam ✓；❌ 3D 高度/光照/区域标签控件 |
| `heatmap`（deprecated→t-heatmap） | MINIMAL | — | 无 geo |

### 4.7 关系（relation）

| chartType | 注册 sections | D3 接线 | DE 特化缺口 |
|-----------|---------------|---------|-------------|
| `scatter` | LINE_BAR | 全 wired | ❌ 坐标轴；点大小 |
| `quadrant` | axis + cartesian + **quadrantShape** | wired | quadrantShape 分割线/区域 ✓（2026-07-30） |
| `multi-scatter` | cartesian | wired | ❌ 多系列点形 |
| `funnel` | funnelShape + legend | legend/label wired | funnelShape ✓ |
| `sankey` | sankeyShape | legend/label missing（门控） | sankeyShape 节点/链接 ✓（2026-07-30） |
| `circle-packing` | circlePackingShape + label | label wired | circlePackingShape ✓ |
| `graph` | graphShape + label | legend missing, label wired | graphShape force/dagre ✓ |

### 4.8 双轴（dual_axes）

| chartType | 注册 sections | D3 接线 | DE 特化缺口 |
|-----------|---------------|---------|-------------|
| `chart-mix` | LINE_BAR | conditional:**partial** | ❌ 左右轴独立样式 §8 |
| `chart-mix-group/stack` | 同左 | partial | ❌ 同上 |
| `chart-mix-dual-line` | 同左 | legend:**partial** | ❌ 双折线轴刻度 |
| `combo`（deprecated→chart-mix） | — | — | 迁移 |

---

## 5. 假绿与 partial 清单（须 P0 诚实化或 P1 接线）

| 问题 | 类型 | UI | 渲染 | 修复策略 |
|------|------|-----|------|----------|
| legend section 无 D3 消费 | radar, treemap | **已门控隐藏** | matrix missing | ✅ 2026-07-30 |
| sankey/wordCloud 专有 shape 假绿 | sankey, word-cloud | sankeyShape/wordCloudShape | 已接线 + 单测 | ✅ 2026-07-30 |
| metadata.properties 漂移 | 全 catalog | 双轨 | profiles 真理源 | ✅ G13 镜像 |
| variantBasic 空折叠 | bar 等 40+ 型 | 注册无 UI | — | P0 从 profile 移除或按 catalog 条件注册 |
| gauge progress variant | gauge | 无 variantBasic | — | P2 加 gaugeShape + variantBasic |
| graph force/dagre | graph | 无 variantBasic | styleVariant 未消费 | P3 graphShape |
| map-3d 区域标签 | map-3d | 无控件 | — | P2 geo 扩展 |
| legend 字体颜色 | 全部 | 无控件 | — | P4 补 `legend.color` |
| tooltip 独立 section | 全部 | 嵌在 palette | 已消费 | P4 拆出 `tooltip` section（DE §5） |
| 高级 Tab showLabel 重复 | 折柱 | 两处 | 同步 | P0 文档+隐藏高级侧 |

---

## 6. 目标架构

### 6.1 单真理源：`chartTypeStyleProfiles.ts`（新增）

```typescript
export type ChartStyleSectionId =
  | "variantBasic" | "axis" | "cartesianShape" | "pieShape"
  | "gaugeShape" | "liquidShape" | "kpiIndicator"
  | "funnelShape" | "sankeyShape" | "graphShape" | "radarShape" | "wordCloudShape"
  | "geo" | "palette" | "legend" | "label" | "tooltip"
  | "title" | "remark" | "background"
  | "tableBasic" | "tableColor";

export type ChartTypeStyleProfile = {
  sections: ChartStyleSectionId[];
  /** 字段级门控（对标 DE attr 细项） */
  fields?: Partial<Record<ChartStyleSectionId, string[]>>;
  /** 是否展示 variantBasic（catalog styleVariants.length > 1） */
  showVariantBasic?: boolean;
};

export function resolveChartTypeStyleProfile(type: ChartType): ChartTypeStyleProfile;
```

**收敛规则**：

1. `chartStyleSectionsForType` **只读** `resolveChartTypeStyleProfile`
2. `metadata.properties` **删除**，仅保留 `paletteCategory` / `library` / `renderer`
3. `engineCapabilities` **删除**，Inspector 能力统一 `inspectorCapabilityMatrix` + `chartInspectorCapabilities` 衍生
4. `showVariantBasic` 由 catalog `styleVariants.length > 1` 驱动，**禁止**对 default-only 类型注册空折叠

### 6.2 `ChartDeStyle` 扩展（按类型块）

| 块 | 字段（示例） | 优先类型 | 消费方 |
|----|-------------|----------|--------|
| `axis` | `x/y: { show, name, lineColor, lineWidth, labelRotate, format }` | 笛卡尔/散点/双轴/象限 | `buildCartesianConfig` axis helpers |
| `cartesian` | `barWidthRatio`, `barRadius`, `lineSmooth`, `pointSize`, `areaOpacity` | bar/line/area/mix | `renderBar*`, `renderD3LineChart`, `renderArea` |
| `pie` | `inner/outerRadiusPercent`, `padAngle`, `topN` | pie* | `renderPie` |
| `gauge` | `min`, `max`, `startAngle`, `endAngle`, `pointerColor`, `splitNumber` | gauge | `renderGauge` |
| `liquid` | `targetValue`, `outlineWidth`, `waveColor` | liquid | `renderLiquid` |
| `funnel` | `sort`, `gap`, `showConversionRate` | funnel | `renderFunnel` |
| `sankey` | `nodeWidth`, `nodeGap`, `linkOpacity` | sankey | `renderSankey` |
| `graph` | `layout`, `edgeLength`, `repulsion` | graph | `renderGraph` |
| `radar` | `shape`, `axisName`, `areaOpacity` | radar | `renderRadar` |
| `wordCloud` | `fontSizeMin/Max`, `spacing` | word-cloud | `renderWordCloud` |
| `geo` | 现有 + `visualMapMode`, `visualMapSplits` | map | choropleth visualMap |

**纪律**：Inspector 可见字段 ⊆ `ChartDeStyle` schema ⊆ renderer 读取；同 PR 必须 `[AUTO]` 测试。

### 6.3 UI 组件分层（新增）

```
chartStyleSections/
  ChartAxisStyleSection.tsx       # P1 · 横纵轴折叠（可嵌套）
  ChartCartesianShapeSection.tsx  # P1 · 柱宽/圆角/线点
  ChartPieShapeSection.tsx        # P2 · 从 variantBasic 拆出
  ChartGaugeStyleSection.tsx      # P2
  ChartFunnelStyleSection.tsx     # P3
  ChartSankeyStyleSection.tsx     # P3
  ChartGraphStyleSection.tsx      # P3
  ChartRadarStyleSection.tsx      # P3
  ChartTooltipStyleSection.tsx    # P4 · 从 palette 拆出
```

窄栏 ~252px：沿用 `ChartInspectorSection` + `ChartDeAttrField` + `DeTitleStyleToolbar` 密度。

---

## 7. 分期实施

| 期 | 范围 | 工期 | 验收 |
|----|------|------|------|
| **P0** | 三源收敛；新增 `chartTypeStyleProfiles.ts`；修假绿门控（radar/treemap/bar-range 等 legend）；移除空 variantBasic；同步测试 | 1–2d | `chartStyleSectionRegistry.test` · `chartInspectorCapabilities.test` · `inspectorStyleWiring.test` 全绿 |
| **P1** | `axis` + `cartesianShape` schema/UI/D3；覆盖 line/bar/area/chart-mix/scatter | 3–5d | `applyD3Style.test` + `renderBar`/`renderD3LineChart` 柱宽/轴名快照 |
| **P2** | gauge/liquid/kpi + `pieShape` 补全；gauge progress variant；map-3d geo 扩展 | 2–3d | F7 夹具手测 + `renderGauge`/`renderPie` 单测 |
| **P3** | funnel/sankey/graph/radar/treemap/word-cloud 特化；graph force/dagre | 3–5d | `2026-07-21-chart-per-type-verification.md` §4.5–4.7 手测 |
| **P4** | tooltip 独立 section；legend.color；栅格 remark/background；tooltip 轮播（可选） | 2d | 双布局走查 |

**禁止**：未接 renderer 的 Switch 占位；在线地图样式（GEO-IRON-01）。

### P0 具体任务

1. 新建 `fe/src/lib/chartTypeStyleProfiles.ts`，从 metadata/tableProfile 迁移 sections 表（§4 矩阵为验收清单）
2. `filterStyleSectionsForChart` 增加：matrix `legend:missing` → 不展示 legend section
3. `variantBasic` 仅在 `profile.showVariantBasic` 为 true 时注册
4. 更新 `chartStyleSectionRegistry.test.ts` bar 期望（含 variantBasic 或 profile 驱动后不含）
5. 更新 `chartInspectorCapabilities.test.ts` graph legend → false

### P1 具体任务（笛卡尔）

DE 对标字段最小集：

| 字段 | DE | 默认值建议 |
|------|-----|-----------|
| `axis.x.show/y.show` | §8 显隐 | true |
| `axis.x.name/y.name` | 轴名 | 空 |
| `axis.*.lineColor/lineWidth` | 轴线 | theme 默认 |
| `axis.y.format` | 数值格式 | 继承 label.formatType |
| `cartesian.barWidthRatio` | 柱宽 | 0.55（对齐现有算法） |
| `cartesian.barRadius` | 圆角 | 0；waterfall/stock-line 锁定 0 |
| `cartesian.lineSmooth` | 平滑 | 继承 styleVariant smooth |
| `cartesian.pointSize` | 点大小 | 4 |

---

## 8. 测试策略

| 层 | 文件 | 断言 |
|----|------|------|
| Profile 快照 | `chartTypeStyleProfiles.test.ts`（新建） | 49 型 sections 与 §4 矩阵一致 |
| 门控一致 | `chartStylePanelGates.test.ts` | legend mode / depth / gradient |
| Matrix 一致 | `inspectorCapabilityMatrix.test.ts` | 无 metadata 漂移 |
| 写入→渲染 | `applyChartStyleChain.test.ts` | seriesColor/conditional/axis |
| UI smoke | `ChartStylePanel.test.tsx` | 按 type 应有折叠块 data-testid |
| 手测 | `2026-07-20-chart-component-acceptance.md` INS-S-* | 配置即生效 |

---

## 9. 与 PRD / 验收文档关系

| 文档 | 关系 |
|------|------|
| `prd/F06-VIZ.md` VIZ-004 样式子类型 | P1 `cartesianShape` + `variantBasic` 治理 |
| `2026-07-20-chart-component-acceptance.md` INS-S-01 | 本方案 §4 矩阵取代其简略表 |
| `2026-07-21-chart-per-type-verification.md` | L1/L2/L3 仍有效；样式项以本文 §4–§5 为增量 |
| `archive/2026-07-14-dashboard-config-rail-canvas-mapping-audit.md` | 部分过时（Apex 路径）；壳层/假绿思路仍参考 |

---

## 10. 评审决策项

1. **是否采纳 `chartTypeStyleProfiles` 单源**（推荐：是）  
2. **P0 是否立即隐藏假绿 legend**（推荐：是，诚实化优先于接线）  
3. **空 variantBasic 处理**：从 profile 移除 vs 合并进类型特化 section（推荐：移除，仅 catalog 多 variant 时展示）  
4. **P1 优先级**：笛卡尔轴系 vs 指标 gauge（推荐：笛卡尔，覆盖 60%+ 用量）  
5. **tooltip 独立 section 时机**（推荐：P4，非阻塞）  
6. **DE 表格高级项**（冻结/合并/表头分组）：是否纳入 M1 或单列 M2（推荐：M2，本方案聚焦图表画布样式）

评审通过后按 P0→P1 开 PR，每 PR ≤400 行、带 `[AUTO]` 增量测试。

---

## 附录 A. `LINE_BAR_SECTIONS` 共用类型一览（20 型）

下列类型当前共用 `variantBasic + background + palette + title + remark + legend + label`，仅 `line` 的 variantBasic 有实际 UI：

`line`, `area`, `area-stack`, `bar`, `bar-stack`, `percentage-bar-stack`, `bar-group`, `bar-group-stack`, `waterfall`, `bar-horizontal`, `bar-stack-horizontal`, `percentage-bar-stack-horizontal`, `bar-range`, `bidirectional-bar`, `progress-bar`, `stock-line`, `bullet-graph`, `scatter`, `quadrant`, `multi-scatter`, `chart-mix`, `chart-mix-group`, `chart-mix-stack`, `chart-mix-dual-line`

**P1 后预期分化**：

- 保持 LINE_BAR 通用壳层
- 追加 `axis` + `cartesianShape`（waterfall/stock-line 字段子集不同）
- `waterfall` / `funnel` / `bidirectional-bar` 保留 D3 inline legend 模式

## 附录 B. 代码锚点速查

|  Concern | 路径 |
|----------|------|
| 样式 Tab 入口 | `fe/src/components/dashboard/ChartStylePanel.tsx` |
| Section 分发 | `fe/src/components/dashboard/chartStyleSections/ChartStyleSection.tsx` |
| 插件 sections 登记 | `fe/src/components/charts/engine/plugins/metadata.ts:68-84` |
| 表格 profile | `fe/src/lib/chartTableInspector.ts` |
| D3 接线矩阵 | `fe/src/components/charts/engine/d3/inspectorCapabilityMatrix.ts` |
| 样式契约 | `fe/src/lib/chartDeStyle.ts` |
| 样式链 | `fe/src/components/charts/engine/applyChartStyleChain.ts` |
| D3 样式映射 | `fe/src/components/charts/engine/d3/applyD3Style.ts` |
| 图例 DE 字段 | `fe/src/components/dashboard/chartLegendStyleFields.tsx` |
| 配色 DE 字段 | `fe/src/components/dashboard/chartPaletteDeParityFields.tsx` |

## 附录 C. code-review 闭环记录（2026-07-22）

| 批次 | 内容 | 状态 |
|------|------|------|
| A | `bar-range` / `progress-bar` / `bullet-graph` 接 `axisStyle` + `barWidthRatio` + `barRadius` | ✅ |
| B | `resolveCartesianLineSmooth` 单源；`line` 图 `variantBasic` ↔ `lineSmooth` 双向同步 | ✅ |
| C | 本 plan 状态回写 | ✅ |

**残余 P2（不阻塞合并）**：schema 预埋无 UI 字段、`metadata.properties` 双源、renderer DOM 级 smoke。
