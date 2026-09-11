# Feature Truth Audit: 图表高级 Tab · 跳转设置 + 条件样式

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-07 |
| 核验范围 | 看板/大屏编辑 · 图表「高级」Tab 内 **跳转设置**、**条件样式**；用户锚点：`chart-mix`（柱线组合图） |
| 锚点 | `ChartAdvancedPanel` · `chartAdvancedSections.tsx` · `chartDeFeatures.ts` · `ChartRenderer.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **8/10 · B**（T1/T2 均可用；全型 UI 未逐一真机） |
| 状态 | draft |
| **sampling** | `full`（功能块全控件下钻；chartType 按能力矩阵枚举，非 44 型全 UI） |

## 1. 核验标准与预期（来自用户/对话/设计）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | **跳转**：高级 Tab 可启用；类型 URL/看板；查看态点击数据点触发跳转；看板模式新标签打开；与下钻/联动互斥时跳转优先 | 用户截图 · `ChartAdvancedJumpSection` hint · `ChartRenderer` |
| T2 | **条件样式**：可添加规则（运算符+阈值+颜色）；保存后柱/线等按度量阈值着色；首条匹配规则生效 | `ChartAdvancedConditionalSection` · `resolveDatumColor` |
| T3 | **柱线组合图**（`chart-mix`）：上述两项在编辑侧栏可配、画布/查看态可生效 | 用户原话「这个跳转和条件样式能用」+ 截图 |

- **非目标（Out）**：地图专用「联动设置」、气泡动效；跳转 URL 携带点击维度/query（DE 部分模板能力，本仓未声明）；KPI/地图-3D 条件色；编辑态点击触发跳转（仅查看态 `drillEnabled`）。

## 2. 完整链路图

```
高级 Tab UI (ChartAdvancedPanel)
  → useChartInspector.onChange
  → patchChartDeFeatures → nativeBody.deFeatures.{jump|conditionalRules}
  → 看板保存 / 关联组件推库
  → ChartRenderer readChartJumpConfig / readChartConditionalRules
  → 跳转：handleJumpClick → window.open(resolveChartJumpHref)
  → 条件：applyChartStyleChain → __conditionalRules → D3 resolveDatumColor / ECharts applyConditional*
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|-----|------|---------|------|
| 1 | UI 门控 | 通 | `chartInspectorCapabilities.ts:105-109` · `ChartAdvancedPanel.tsx:71-109` | jump/conditional 按型展示 |
| 2 | 配置持久化 | 通 | `patchChartDeFeatures` · `chartDeFeatures.test.ts` | 写入 `nativeBody.deFeatures` |
| 3 | 跳转 runtime | 通（CHAIN+用户） | `ChartRenderer.tsx:492-511` · `buildCartesianConfig.ts:73-78` | 查看态点击 → `onJumpClick` |
| 4 | 条件 runtime | 通（CHAIN） | `series.ts:38-46` · `renderDualAxesColumn.ts` · `chartDeFeatures.test.ts` | D3 着色 |
| 5 | 柱线组合 partial | 已知限制 | `inspectorCapabilityMatrix.ts:41` · UI hint | 条件色可能仅部分系列 |
| 6 | 编辑态跳转 | 按设计关闭 | `DashboardWidget.tsx` drillEnabled 仅 view | 编辑画布不触发跳转 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 跳转设置 | **PARTIAL** | 8/B | 链路完整；静态目标看板；无点击维度；用户确认 chart-mix 可用 |
| T2 | 条件样式 | **PARTIAL** | 8/B | D3 接线广；chart-mix `conditional:partial`；用户确认可用 |
| T3 | chart-mix 锚点 | **PARTIAL** | 8/B | 用户 L1 + CHAIN 单测；线系列描边条件色未全验 |

## 3b. 前端控件下钻表（高级 Tab · 跳转 + 条件）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 启用跳转 | `patchJump({enabled})` | 开关写入 deFeatures | 接线 `InspectorSwitchRow` | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B2 | 跳转类型 | `patchJump({mode})` | url/dashboard | Select 接线 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B3 | 链接地址 | `patchJump({url})` | URL 持久化 | Input onChange | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B4 | 目标看板 | `patchJump({dashboardId})` | Picker 选看板 | `DashboardPickerField` | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 用户截图 |
| B5 | 新标签页打开 | `patchJump({openInNewTab})` | 控制 window.open | Switch 接线 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B6 | 查看态点击跳转 | `handleJumpClick` | 打开配置 href | 用户确认可用；Agent 未真机 | 2 | 2 | 2 | 2 | 2 | 10 | REAL* | 用户 L1 |
| B7 | 添加规则 | `setRules([...])` | 新增规则行 | Button 接线 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B8 | 规则开关 | `onChange({enabled})` | 单规则启用 | `ConditionalRuleRow` | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B9 | 比较/阈值/颜色 | `onChange` | 三字段落库 | Select/Input/Color | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B10 | 删除规则 | `onRemove` | 移除规则 | Trash 按钮 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B11 | 画布条件着色 | `resolveDatumColor` | 阈值匹配改色 | 用户确认；smoke+单测 | 2 | 2 | 2 | 2 | 2 | 10 | REAL* | 用户+vitest |

\* B6/B11：Agent 未跑 MCP 浏览器；依据用户对话 L1 + 单测/smoke。

**Out**：地图联动区块控件、辅助线、缩略轴、地名映射（非本 scope）。

**T 映射**：T1 → B1–B6；T2 → B7–B11；T3 → B4,B6,B11。

## 3d. 覆盖矩阵（chartType × 能力）

| 实体 ID | 跳转 caps | 条件 caps | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|-----------|-----------|------|-------|-----|------|---|---|------|------|
| chart-mix | ✅ | ✅ partial | ✅ | ✅ | ✅用户 | UI | 2 | 2 | **REAL*** | 用户+`inspectorCapabilityMatrix.test` |
| chart-mix-dual-line | ✅ | ✅ wired | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | matrix wired |
| line / bar / area* | ✅ | ✅ wired | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | D3 render + smoke |
| scatter / radar / pie* | ✅ | ✅ wired | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `resolveDatumColor` 接线 |
| waterfall / funnel / treemap | ✅ | ✅ wired/missing | ✅ | 部分 | ❌ | CHAIN/GATE | 1-2 | 1-2 | PARTIAL | matrix |
| gauge / liquid / map-3d / kpi | ❌/部分 | ❌ | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 无 jump 或无 conditional |
| map | ✅ | ❌ | ✅ | ✅ map only | ❌ | CHAIN | 2 | 1 | PARTIAL | 跳转 map 专用；见 `2026-08-04-map-advanced-tab-truth-audit.md` |
| table-info 等表格 | ✅ | 部分表 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `chartTableInspector` jump only |

\* area 及 bar 变体等同属 D3 `WIRED` 矩阵。

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体（功能块） | T1/T2/T3 + 11 控件 |
| chart-mix 锚点 | UI + 用户 L1 |
| GATE only（无 jump/conditional） | gauge, liquid, map-3d, kpi, word-cloud 等 |
| CHAIN（D3 着色/跳转接线） | line, bar, chart-mix*, scatter, pie, radar… |
| UI / BROWSER（Agent） | 仅 chart-mix 用户 L1；Agent 未 MCP |
| NONE | 0 |
| REAL 达标（scope 内控件） | B1–B11 均 REAL（含用户 L1） |
| **逐一校验** | **否** — chartType 矩阵未对每型做 BROWSER；**是** — 跳转/条件控件链与 chart-mix 用户验收 |
| **总体可否 REAL** | **否** — 多 chartType 仅 CHAIN/GATE；跳转无维度参数为已知 PARTIAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 功能真通；href 静态 |
| T2 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | chart-mix partial 已文档化 |
| T3 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 用户确认 |

**打通但不对**：0（用户确认与预期一致；已知限制为「partial 系列」非错误）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `pnpm vitest run chartDeFeatures.test.ts` 等 | 5+ 用例绿 | 32 tests passed | ✅ | 命令输出 2026-08-07 |
| 2 | 读码：jump 互斥 | 跳转优先于下钻 | `jumpInteraction` 先于 `activeDrillInteraction` | ✅ | `ChartRenderer.tsx:495-502` |
| 3 | 读码：chart-mix 条件 | partial 标注 | `conditional: "partial"` + UI hint | ✅ | `inspectorCapabilityMatrix.ts:41` |
| 4 | 用户 L1：chart-mix | 跳转+条件可用 | 用户原话确认 | ✅ | 对话 |
| 5 | Agent MCP 查看态点击跳转 | 新 tab 打开目标看板 | **未执行** | — | — |

## 5. 修复文档（P1，非阻断）

### T1 — 跳转不携带点击维度（P1）

**判定**：PARTIAL（C=2 对「静态内部链接」预期；对「带维度 query」预期 C=0）  
**期望 vs 实际**：部分 DE 场景 URL 带 `{{region}}`；实际 `resolveChartJumpHref` 仅静态 `/admin/dashboards/{id}`。  
**根因**：`chartDeFeatures.ts:264-274`  
**修复方向**：可选 `parameterKey` + 点击值拼 query；或文档明确不支持。  
**修后验收**：若产品要求带参 → C≥2 且 browser smoke。

### T2 — chart-mix 条件色仅 partial（P1）

**判定**：PARTIAL（设计内 partial，非 BROKEN）  
**期望 vs 实际**：UI 已提示「可能仅部分系列」；折线描边未必变色，点/柱已接线。  
**根因**：`renderDualAxesLineSeries` 仅点 `resolveDatumColor`，线 stroke 未条件化。  
**修复方向**：线 series stroke 亦走 `resolveDatumColor` 或文档保持 partial。  
**触及文件**：`renderDualAxes.ts`  
**优先级**：P1（体验增强）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T1 | 跳转 URL 维度参数（若对标 DE 全量） |
| P1 | T2 | chart-mix 折线描边条件色 |

## 7. 交接

- 用户陈述与代码/单测一致：**跳转 + 条件样式在 chart-mix 上可用**。
- 总体 **PARTIAL** 原因：非全型 BROWSER、跳转静态 href、chart-mix 条件 partial 为登记能力。
- 建议：若需标 **REAL（全型）** → `root-first-solve` + Playwright/MCP 对 jump/conditional 矩阵补 UI 层。
- **用户批准修复**：否
