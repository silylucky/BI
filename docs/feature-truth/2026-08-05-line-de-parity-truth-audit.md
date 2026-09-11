# Feature Truth Audit: 基础折线图 DataEase 对齐（本轮验收包）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 核验范围 | `line` 基础折线图 vs DataEase：数据槽位、子类别编码、渲染、样式 Tab、已知 DE 差距项 |
| 锚点 | `fe/src/lib/chartDeAxis/catalog.ts` · `encodeCartesian.ts` · `renderD3LineChart.ts` · `ChartCartesianStyleSections.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.5/10 · C** |
| 状态 | draft |
| **sampling** | `full`（scope 内 18 子项全列；**不含** 44 活跃 chartType 全量） |

> 用户问「是否全部实现可用」→ **否**。数据槽位 + 编码 + 基础渲染主路径可用；DE 全量维度能力、样式 UI 真机、轴色/线宽 DE 细项仍未 REAL。

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | Inspector 数据 Tab 展示 DE 同款槽位：类别轴*、子类别、值轴*（可多指标）、钻取、过滤 | 对话 + `cartesianTrendAxes()` + 截图 |
| T2 | 子类别字段拆系列；单维时单系列；图例与 X 轴语义正确 | `buildDatasetEncoding` + DE F1/F1+region |
| T3 | **基础折线**默认只显示折线+点，**不**默认铺半透明面积；面积模式或 areaOpacity>0 才铺面积 | 本轮修复 + DE「基础折线图」 |
| T4 | 样式 Tab：平滑/线宽/点大小/面积透明度写入 config 并影响 SVG | `chartTypeStyleProfiles` + DE 图形属性 |
| T5 | 坐标轴区：显示开关、轴名称在图面生效 | 样式审计 2026-08-03 `axis:wired` |
| T6 | 高级区 legend/label/dataZoom/markLine/conditional 对折线 wired | `inspectorCapabilityMatrix.ts` line:WIRED |
| T7 | DE registry 1–8 维：类别轴可多字段拖入（DE 泛化能力） | `deriveFieldRuleFromDeCatalog` vs backend |
| T8 | 浏览器手测：折线点数与 SQL 一致、跨地区/跨日期连线可见 | `2026-07-21-chart-per-type-verification.md` L2 |

- **非目标**：44 活跃 chartType 全矩阵；表格配色；ChartTypeTile 图标（已另修）

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 数据槽位/链路子项 | 18 | 0 | 18 | 下文 §3d |
| 44 chartType | 44 | 44 | 0 | **不在本 scope** |

## 2. 完整链路图

```
ChartEditorColumn 数据 Tab
  → ChartDataSlots (DE axis blueprint)
  → syncLegacyFieldsFromAxes
  → buildPlan linePlan / encodeCartesianRows
  → applyChartStyleChain → renderD3LineChart
  → d3-line-chart SVG

样式 Tab
  → ChartVariantBasicSection / ChartAxisStyleSection / ChartCartesianShapeSection
  → deStyle.cartesian.*
  → applyChartDeStyleBlocksToPlan → __lineWidth / __pointSize / …
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | DE 槽位登记 | 通 | `catalog.test.ts` line 用例 | 4 槽文案对齐 |
| 2 | 过滤入口 | 通 | `ChartEditorColumn.tsx:185` section=filters | UI 有「过滤」 |
| 3 | 子类别编码 | 通 | `encodeCartesian.test.ts` | seriesField=__series__ |
| 4 | 基础渲染 | 通（修后） | `renderD3LineChart.test.ts` | 无默认 area path |
| 5 | 样式→render | 部分通 | `applyChartStyleChain.test.ts` | pointSize/smooth；**lineWidth 无 chain 单测** |
| 6 | 样式 UI 点击 | **未验** | 无 line 专用 ChartStylePanel userEvent | 深度 NONE→缺 UI |
| 7 | DE 8 维多字段 | **断** | `xDim()` limit=1 | 刻意未实现 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 数据槽位 + 过滤 | **PARTIAL** | 7/B | catalog ✅；过滤 UI ✅；过滤→query 未在本 scope 动态验 |
| T2 | 子类别编码 | **REAL** | 8/B | encode 单测 + catalog |
| T3 | 基础折线渲染 | **REAL** | 8/B | 修默认面积；render 单测 + smoke `d3-line-chart` |
| T4 | 图形属性样式链 | **PARTIAL** | 6/C | CHAIN 有点/平滑；线宽 render 单测；**无 UI 验** |
| T5 | 坐标轴样式 | **PARTIAL** | 5/C | show/name wired；**lineColor/lineWidth 轴色未暴露 UI、未消费** |
| T6 | 高级 wired | **PARTIAL** | 7/B | matrix 登记 WIRED；无 BROWSER 逐控件 |
| T7 | DE 8 维 | **STUB** | 2/F | maxD=3，类别轴单字段 |
| T8 | L2 手测 | **UNVERIFIED** | 0/F | 无 MCP/Playwright 记录 |

## 3b. 前端控件下钻表（line 样式 Tab）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 基础样式·平滑 | `ChartVariantBasicSection` | 切换 smooth 变体 | 代码同步 lineSmooth+styleVariant | 1 | 1 | 2 | 1 | 1 | 6 | PARTIAL | 静态读码；无 UI 测 |
| B2 | 基础样式·面积 | 同上 variant=area | buildPlan area:true | `buildPlan.ts` 已传 area | 1 | 1 | 2 | 1 | 1 | 6 | PARTIAL | 无 UI 切换验 |
| B3 | 平滑曲线开关 | `ChartCartesianShapeSection` | deStyle.cartesian.lineSmooth→smooth path | applyChain 有 smooth | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 无 slider 点击 |
| B4 | 线宽 | 同上 | stroke-width 变化 | render 单测 stroke-width=4 | 2 | 2 | 2 | 1 | 1 | 8 | PARTIAL | **CHAIN 有；UI 未验** |
| B5 | 点大小 | 同上 | 圆点半径变化 | applyChain __pointSize | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 无 UI 测 |
| B6 | 面积透明度 | 同上 | areaOpacity>0 出现 area fill | render 单测 areaOpacity | 2 | 2 | 2 | 1 | 1 | 8 | PARTIAL | CHAIN 有；UI 未验 |
| B7 | 横/纵轴·显示轴线 | `ChartAxisStyleSection` | 轴线显隐 | sceneGraph 读 axisStyle.show | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 无 UI 测 |
| B8 | 横/纵轴·轴名称 | 同上 | 轴标题文字 | sceneGraph 读 axis.name | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 无 UI 测 |

Out：`axis.lineColor` / `axis.lineWidth`（schema 有、UI 无）— 不计入 B 表必验

功能块映射：T4→B3–B6；T5→B7–B8；T3→（渲染无独立按钮）

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| DE-SLOT-1 | 类别轴/维度 | ✅ | — | ❌ | GATE | 1 | 1 | STUB | `catalog.test.ts` |
| DE-SLOT-2 | 子类别/维度 | ✅ | — | ❌ | GATE | 1 | 1 | STUB | 同上 |
| DE-SLOT-3 | 值轴多指标 | ✅ | — | ❌ | GATE | 1 | 1 | STUB | uiMode multi |
| DE-SLOT-4 | 钻取/维度 | ✅ | — | ❌ | GATE | 1 | 1 | STUB | blueprint |
| DE-SLOT-5 | 过滤器 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `ChartEditorColumn` 静态 |
| ENC-1 | 子类别拆系列 | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | `encodeCartesian.test.ts` |
| ENC-2 | 单维单系列 | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | 同上 |
| REN-1 | 基础线无默认面积 | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | `renderD3LineChart.test.ts` |
| REN-2 | 面积/areaOpacity | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | 同上 |
| REN-3 | 线宽 render | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | 同上 stroke-width |
| STYLE-smooth | lineSmooth 链 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `applyChartStyleChain.test.ts` |
| STYLE-pointSize | 点大小链 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | 同上 |
| STYLE-areaOpacity | 面积透明度链 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | render 单测 |
| STYLE-lineWidth | 线宽链 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | render 单测；apply 无断言 |
| ADV-legend | legend wired | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `inspectorCapabilityMatrix` |
| ADV-markLine | markLine wired | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 同上 |
| GAP-multi-dim | 类别轴 1–8 维 | ✅ | ❌ | ❌ | GATE | 1 | 0 | STUB | maxD=3 设计债 |
| GAP-browser-L2 | 手测点数 | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 计划 ☐ 未勾 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 18 |
| GATE only | 7 |
| CHAIN | 8 |
| UI / BROWSER | 0 |
| NONE（未验） | 1 |
| REAL 达标 | **4/18** |
| **逐一校验** | **否** — 已验 17/18（1 NONE）；其中 **7 仅 GATE**、**0 UI/BROWSER** |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T2 编码 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL | 单测充分 |
| T3 渲染 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL | 修默认面积后 |
| T4 样式 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL | 无 UI 真点 |
| T1 数据 | 1 | 1 | 2 | 1 | 1 | 6 | C | PARTIAL | 槽位登记非端到端 |
| T7 GAP | 1 | 0 | 1 | 1 | 1 | 4 | D | STUB | DE 8 维未做 |

**打通但不对**（L≥2 且 C≤1）：T5 轴色/轴线宽（C=1）

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `vitest run renderD3LineChart.test.ts` | 3 passed | 3 passed | ✅ | 2026-08-05 命令输出 |
| 2 | `vitest run encodeCartesian.test.ts` | 2 passed | 2 passed | ✅ | 同上 |
| 3 | `vitest run catalog.test.ts -t line` | line 槽位断言过 | 9 passed（全文件） | ✅ | 同上 |
| 4 | `vitest run charts.smoke -t line` | d3-line-chart 挂载 | 1 passed | ✅ | 同上 |
| 5 | ChartStylePanel line 线宽 slider 点击 | stroke 变粗 | **未执行** | ❌ | 无 UI 测 |
| 6 | 浏览器：region+date 配置预览 | 可见连接线 | **未执行** | ❌ | 无 BROWSER |

## 5. 修复文档（P0/P1）

### GAP-browser-L2 — L2 手测未做

**判定**：UNVERIFIED 0/10  
**期望 vs 实际**：期望折线点数=日期数、跨类别连线可见；实际无真机记录  
**修复方向**：`/admin/charts/explore` 或看板编辑，F1 夹具 dim=date metric=amount + 用户截图配置各测一次  
**修后验收**：BROWSER 深度，C≥2  

### GAP-multi-dim — 类别轴多维度

**判定**：STUB 4/10  
**根因**：`deAxis.xDim()` limit=1，`deriveFieldRuleFromDeCatalog("line").maxDimensions=3`  
**修复方向**：若 product 确认 DE 折线类别轴需 multi container → `MULTI_DIM_OPTS` + 编码层支持  
**优先级**：P1（非本轮 P0，除非用户强制 DE 全量维）  

### T5 — 坐标轴 lineColor/lineWidth

**判定**：PARTIAL 5/10，C=1  
**根因**：`ChartAxisSideStyle` 有 lineColor/lineWidth；`ChartAxisStyleSection` 未暴露；`sceneGraph` 未读 lineColor  
**修复方向**：补 UI 色块/线宽 + `drawCartesianAxes` 消费  
**优先级**：P1  

### T4 — 样式 Tab UI 真点（B3–B8）

**判定**：PARTIAL 6–7/10  
**根因**：仅有 CHAIN/GATE，无 `ChartStylePanel` + userEvent 集成测  
**修复方向**：`ChartCartesianStyleSections.integration.test.tsx` 覆盖 line 四滑块 + 预览 SVG 断言  
**优先级**：P1  

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T3 | ✅ 已修：基础折线默认不铺面积（本轮代码） |
| P0 | REN-3 | ✅ 已修：线宽样式链 + render 单测 |
| P1 | GAP-browser-L2 | 补浏览器 L2，确认「只见点」在真机消失 |
| P1 | T4/B3–B8 | 样式 slider UI 集成测 |
| P1 | T5 | 轴色/轴线宽 DE 细项 |
| P2 | GAP-multi-dim | 类别轴 1–8 维（需产品确认） |

## 7. 交接

- 建议：批准 P1 浏览器走查 + UI 集成测；或交接 `root-first-solve`
- 用户批准修复：**否**（本轮 skill 仅审计+文档）
- 若需 **44 型全量** truth-verify：另开 scope，`sampling: full`，矩阵 44 行起
