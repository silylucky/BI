# Feature Truth Audit: DataEase 式标签面板（维度/指标/占比/格式）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-06 |
| 核验范围 | 用户诉求：「很多组件的标签都要显示 DataEase 式配置，一个不能漏」 |
| 锚点 | `ChartLabelStyleSection` · `ChartDeLabelContentFields` · `deStyle.label` · D3 renderers |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **5/10 · D**（T1 面板 4/C；T2 渲染 5/C） |
| 状态 | draft |
| **sampling** | `full`（44 活跃型 + 控件全列；无抽样） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | **凡 profile 含 `label` 分区**的 chartType，样式 Tab 须展示 DataEase 式内容：全量显示（饼外置）、维度/指标/占比、指标格式（类型/单位语言/数量单位/后缀/小数/千分符）、占比小数 | 用户截图 + 对话 |
| T2 | 勾选维度/指标/占比后，**图上标签文案**按组合显示（非仅裸数字） | T1 下游 |
| T3 | 指标格式（小数、单位、千分符）写入 `valueFormat`，标签数值随之变化 | DataEase 对标 |
| T4 | 饼图外置「全量显示」开启时，不因防重叠大批量隐藏标签 | 饼图玫瑰图对话 |
| T5 | 水波/KPI/饼 专用分支仍可用，不与通用面板冲突 | 现有 `ChartLiquidLabelFields` / `ChartPieLabelFields` |

- **非目标**：地图 `geo` 区域标签、表格单元格、词云文字、桑基节点名（非 `deStyle.label` 路径）
- **Out**：deprecated 型（`table`/`timeline`/`wordCloud`/`heatmap`/`combo`）不计入必验 REAL

## 2. 完整链路图

```
ChartStylePanel → ChartLabelStyleSection
  → patchChartLabelStyle / patchDeStyleNested("label")
  → deStyle.label
  → buildStyleContext.labelContent + resolveChartValueFormat
  → applyChartDeStyleBlocks (__labelShow* / __pie*)
  → buildCartesianConfig.labelContent / buildRenderConfig
  → renderer .text(formatCartesianDatumLabel | formatSimpleDataLabel | pieLabels)
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | UI 分区 profile | 通 | `chartTypeStyleProfiles.ts` | 36 型 profile 含 `label` |
| 2 | UI 门控 gates | **断** | `chartStylePanelGates.ts:105` | `funnel`/`graph` profile 有 label 但被 gate 剔除 |
| 3 | UI 控件 | 静态通、未 UI 测 | `ChartDeLabelContentFields.tsx` | 无 integration / browser 测试 |
| 4 | 配置写入 | 通 | `chartDeStyle.ts` `showAll`/`unitLanguage` | 字段已扩 |
| 5 | apply 链 | 部分通 | `applyChartDeStyleBlocks.ts:223-228` | 非 Pie/Liquid 写 `__labelShow*` |
| 6 | 渲染消费 | **部分** | grep `formatCartesianDatumLabel` | 仅 bar/hbar/line/funnel + 饼专用；其余仍 `formatChartValue` |

## 3. 子能力判定

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 全类型 DE 标签面板 | **PARTIAL** | 4/C | UI 组件已写；`funnel`/`graph` gate 阻断；无 UI 测试 |
| T2 | 维度/指标/占比上图 | **PARTIAL** | 5/C | 4 个笛卡尔 render + funnel + 饼；20+ 型仅指标格式 |
| T3 | 指标格式 valueFormat | **PARTIAL** | 6/C | `resolveChartValueFormat` 已扩 metricDecimals/unit；无 per-type 渲染断言 |
| T4 | 饼全量显示 | **CHAIN** | 6/C | `__pieShowAll` → `layoutPieOutsideLabels(..., showAll)`；无 UI 测 |
| T5 | 水波/饼/KPI 专用 | **REAL** | 7/B | 原有 `ChartLiquidLabelFields`/`ChartPieLabelFields` 仍独立 |

## 3b. 前端控件下钻（`ChartDeLabelContentFields` + `ChartLabelStyleSection`）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 显示数据标签 Switch | `patchChartShowLabel` | 开关控制 showLabel | 代码存在 | 1 | 1 | 2 | 1 | 0 | 5 | STUB | `ChartLabelStyleSection` 未测 |
| B2 | 字体颜色 | `patchChartLabelStyle` | 写入 color | 代码存在 | 1 | 1 | 2 | 1 | 0 | 5 | STUB | 同上 |
| B3 | 字号 | `patchLabel({ fontSize })` | 写入 fontSize | 代码存在 | 1 | 1 | 2 | 1 | 0 | 5 | STUB | 同上 |
| B4 | 全量显示 | `showAll` | 饼外置时可见 | 仅 `ChartPieLabelFields` | 1 | 1 | 2 | 1 | 0 | 5 | STUB | 无 UI 测 |
| B5 | 维度 | `showDimension` | 勾选写入 deStyle | 代码存在 | 1 | 1 | 2 | 1 | 0 | 5 | STUB | 渲染仅部分型消费 |
| B6 | 指标 | `showIndicator` | 默认开 | 代码存在 | 1 | 2 | 2 | 1 | 1 | 7 | PARTIAL | valueFormat 全局生效 |
| B7 | 格式类型 | `formatType` | 影响指标格式 | `resolveChartValueFormat` | 2 | 2 | 2 | 1 | 1 | 8 | PARTIAL | 无 UI 断言 |
| B8 | 单位语言 | `unitLanguage` | 中英文单位映射 | 代码存在 | 1 | 1 | 2 | 1 | 0 | 5 | STUB | 未测切换 |
| B9 | 数量单位/后缀 | `metricUnit` | 后缀展示 | `formatMetricValue` | 2 | 2 | 2 | 1 | 1 | 8 | PARTIAL | 无渲染断言 |
| B10 | 小数位 | `metricDecimals` | 小数位变化 | `resolveChartValueFormat` | 2 | 2 | 2 | 1 | 1 | 8 | PARTIAL | 无渲染断言 |
| B11 | 千分符 | `thousandSeparator` | 千分符 | 同上 | 2 | 2 | 2 | 1 | 1 | 8 | PARTIAL | 同上 |
| B12 | 占比 | `showPercent` | 勾选显示 (%) | 仅部分 render | 1 | 1 | 2 | 1 | 0 | 5 | STUB | area/dual 等未接 |
| B13 | 占比小数 | `percentDecimals` | 小数位 | 饼/部分 render | 1 | 1 | 2 | 1 | 1 | 6 | PARTIAL | `pieLabels.test` |

Out：`ChartLiquidLabelFields` 内完成度/指标/占比（T5）；KPI 无维度/占比（设计如此）。

## 3d. 覆盖矩阵（44 活跃 chartType）

清单来源：`BUILTIN_PLUGIN_DEFS.filter(!deprecated)`（44 型）。

| chartType | profile `label` | UI gate `label` | GATE | CHAIN dim/% | UI | 深度 | L | C | 判定 | 证据 |
|-----------|-----------------|-----------------|------|-------------|-----|------|---|---|------|------|
| gauge | ✅ | ✅ | profile | valueFormat only | ❌ | GATE | 1 | 1 | STUB | `renderGauge.ts` |
| liquid | ✅ | ✅ | 专用面板 | liquid 专用 | ❌ | CHAIN | 2 | 2 | PARTIAL | `ChartLiquidLabelFields` |
| kpi | ✅ | ✅(format) | profile | valueFormat | ❌ | CHAIN | 2 | 2 | PARTIAL | 无 show 开关 |
| line | ✅ | ✅ | profile | ✅ `formatCartesianDatumLabel` | ❌ | CHAIN | 2 | 2 | PARTIAL | `renderD3LineChart.ts` |
| area | ✅ | ✅ | profile | ❌ `formatChartValue` | ❌ | GATE | 1 | 1 | STUB | `renderArea.ts:197` |
| area-stack | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | 同 area |
| bar | ✅ | ✅ | profile | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `renderBar.ts` |
| bar-stack | ✅ | ✅ | profile | ❌* | ❌ | GATE | 1 | 1 | STUB | 栈模式标签路径弱 |
| bar-horizontal | ✅ | ✅ | profile | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `renderBarHorizontal.ts` |
| percentage-bar-* (×2) | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | 同 bar 族 |
| bar-group* (×2) | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | 同 bar |
| waterfall | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | `renderWaterfall.ts:161` |
| bar-range | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | `renderBarRange.ts` |
| bidirectional-bar | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | `renderBidirectionalBar.ts` |
| progress-bar | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | `renderProgressBar.ts` |
| stock-line | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | `renderStock.ts` |
| bullet-graph | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | `renderBullet.ts` |
| pie / donut / rose / donut-rose | ✅ | ✅ | 饼专用 | ✅ `pieLabels` | ❌ | CHAIN | 2 | 2 | PARTIAL | `pieLabels.test.ts` |
| radar | ✅ | ✅ | profile | 轴名非 DE 文案 | ❌ | GATE | 1 | 1 | STUB | `renderRadar.ts` |
| treemap | ✅ | ✅ | profile | 仅 name | ❌ | GATE | 1 | 1 | STUB | `renderTreemap.ts:163` |
| scatter | ✅ | ✅ | profile | ❌ 坐标对 | ❌ | GATE | 1 | 1 | STUB | `renderScatter.ts` |
| quadrant | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | 未接 `labelContent` |
| multi-scatter | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | 同 scatter |
| funnel | ✅ | **❌ gate** | profile | ✅ render 已接 | ❌ | CHAIN† | 2 | 2 | **BROKEN UI** | profile 有 label；`caps.label\|\|labelFormat` 为 false |
| circle-packing | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | `renderCirclePacking.ts` |
| graph | ✅ | **❌ gate** | profile | ❌ | ❌ | **BROKEN UI** | 0 | 0 | STUB | 同 funnel gate |
| chart-mix* (×4) | ✅ | ✅ | profile | ❌ | ❌ | GATE | 1 | 1 | STUB | dual/area 路径 |
| table-info/normal/pivot | — | — | Out | — | — | NONE | 0 | 0 | Out | 表格无数据标签 |
| t-heatmap | — | — | Out | geo | — | NONE | 0 | 0 | Out | `geo.showCellLabel` |
| map / map-3d | — | — | Out | geo | — | NONE | 0 | 0 | Out | 区域标签 |
| word-cloud | — | — | Out | — | — | NONE | 0 | 0 | Out | 词即标签 |
| sankey | — | — | Out | 硬编码节点名 | — | NONE | 0 | 0 | Out | `renderSankey.ts` |

† funnel：渲染层已用 `formatSimpleDataLabel`，但样式 Tab **看不到**标签分区 → UI 链断。

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 活跃 chartType | 44 |
| profile 含 `label`（必验 T1 子集） | 35 |
| UI gate 实际展示 `label` 分区 | **33**（缺 `funnel`、`graph`） |
| CHAIN 含维度/占比组合文案 | **7**（bar、hbar、line、funnel†、pie×4） |
| GATE only（profile 有、渲染仅 valueFormat 或裸值） | **~24** |
| UI / BROWSER | **0** |
| NONE（Out） | 9 |
| REAL 达标（L≥2,C≥2,深度≥CHAIN） | **0 / 35** |
| **逐一校验** | **否** — profile 35 型中 33 型 UI 可验；2 型 UI 断；渲染仅 7 型 CHAIN 组合文案；无 browser |
| **总体可否 REAL** | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 1 | 1 | 2 | 1 | 1 | 5 | D | PARTIAL | 面板代码有；funnel/graph 门控断；无 UI 测 |
| T2 | 2 | 2 | 2 | 1 | 1 | 8 | B | PARTIAL | 7 型组合文案；其余未接 |
| T3 | 2 | 2 | 2 | 1 | 1 | 8 | B | PARTIAL | format 链通；缺渲染断言 |
| T4 | 2 | 2 | 2 | 1 | 1 | 8 | B | PARTIAL | showAll 代码通；无 E2E |
| T5 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL | 水波/饼/KPI 专用保留 |

**打通但不对**（L≥2 且 C≤1）：无（多为未打通或未验）  
**假绿风险**：`chartTypeStyleProfiles.test` 仅验 sections 非空，**不验** `ChartDeLabelContentFields 挂载` 与渲染组合文案

## 4. 动态验证（已执行）

```text
npx vitest run src/lib/chartDataLabelFormat.test.ts \
  src/components/charts/engine/d3/radial/pieLabels.test.ts \
  src/lib/chartTypeStyleProfiles.test.ts
→ 3 files, 23 tests passed
```

- `chartDataLabelFormat.test.ts`：组合字符串逻辑 ✅（非 UI）
- `pieLabels.test.ts`：饼外置布局 ✅（非 browser）
- `chartTypeStyleProfiles.test.ts`：活跃型 sections 非空 ✅（**GATE**，非标签内容）

**未执行**：ChartStylePanel userEvent、MCP browser 走查、44 型逐型截图。

## 5. 结论：是否「真正完成」？

**否 — 判定 PARTIAL，不能标 REAL。**

| 维度 | 完成情况 |
|------|----------|
| **UI 面板** | 共享组件 `ChartDeLabelContentFields` 已建；`ChartLabelStyleSection` 已挂接；但 **`funnel` / `graph` 因 `chartInspectorCapabilities` 无 `label`/`labelFormat`，标签分区被 gate 掉** |
| **配置字段** | `showAll`、`unitLanguage`、`metricDecimals`/`metricUnit` 等已入 `ChartLabelStyle` |
| **渲染** | **仅** bar、bar-horizontal、line、funnel（无 UI）、饼族 完整消费维度/指标/占比；**area、dual、waterfall、scatter、treemap、gauge、bullet、stock 等 20+ 型仍只 `formatChartValue` 或仅名称** |
| **测试** | 工具函数 + 饼布局单测；**无**样式面板集成测、**无**「改勾选 → 图上文案变」的 render 断言矩阵 |
| **真机** | 未做 |

## 6. P0 修复清单（须用户批准后改代码）

| P | 项 | 动作 |
|---|-----|------|
| P0-1 | `funnel`/`graph` 标签分区不显示 | `chartInspectorCapabilities`：`label: true` 或扩展 `labelFormat` 到 relation 分发/层级型 |
| P0-2 | 笛卡尔族未接 `labelContent` | 在 `renderArea`/`renderDualAxes`/`renderWaterfall`/`renderBidirectionalBar`/`renderBullet`/`renderStock`/`renderBarRange`/`renderProgressBar` 等统一用 `formatCartesianDatumLabel` / `formatSimpleDataLabel` |
| P0-3 | treemap/radar/graph/circle-packing | 按图语义接 `formatSimpleDataLabel`（name + value + optional %) |
| P0-4 | scatter/quadrant | 定义维度字段（系列名或 x 维）后接组合文案 |
| P1 | UI 集成测 | `ChartLabelStyleSection` + `userEvent` 勾选维度/占比 → `deStyle.label` 快照 |
| P1 | CHAIN 矩阵测 | 每型至少 1 条「showDimension+showPercent → text 含维度与 (%)」 |
| P2 | Browser | 编辑页各型打开标签 Tab 截图归档 |

---

<HARD-GATE-COVERAGE>
- §3d 行数覆盖 35 必验 profile-label 型 + 9 Out
- 覆盖摘要已填
- 逐一校验：否（已说明缺口）
</HARD-GATE-COVERAGE>

**下一步（请选一）**：① 批准按 P0 清单修代码；② 交接 `root-first-solve`；③ 仅保留本报告。
