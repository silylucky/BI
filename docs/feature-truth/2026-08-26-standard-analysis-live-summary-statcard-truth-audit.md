# Feature Truth Audit: 标准分析实时摘要条改用 ScheduleStatCard

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-26 |
| 核验范围 | 标准分析实时结果页顶部摘要（`LiveSummaryStrip` → `ScheduleStatCard`） |
| 锚点 | `/admin/reports/standard/results` · `StandardAnalysisLiveView` · `data-testid="standard-analysis-live-summary"` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **8/10 · B** |
| 状态 | draft |
| **sampling** | `full`（scope 内 7 项必验实体全列） |

## 1. 核验标准与预期（来自用户/对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 摘要区不再使用自定义纯文本行，改用项目已有 `ScheduleStatCard` | 用户原话「用我们已经有的组件」 |
| T2 | 指标卡横向拉满可用宽度（多卡等分） | 用户原话「把组件拉长」 |
| T3 | 摘要卡无边框、无阴影，与图表区一体 | 用户原话「去掉边框」 |
| T4 | 指标语义不变：结果行数、数量合计；distribution 主题含「最高区域」 | 既有 `buildLiveSummaryMetrics` 行为 |
| T5 | `data-testid="standard-analysis-live-summary"` 保留 | 测试锚点约定 |

- 非目标：矩阵对比页 `MatrixTotalSummaryStrip` 统一（未在本次原话范围）
- 非目标：调度 Hub / SchedulePageOverview 视觉改版

## 2. 完整链路图

```
StandardAnalysisPage run API
  → RunResult.renderSpec.sections[0]
  → normalizeColumns/Rows
  → buildLiveSummaryMetrics(headers, rows, theme)
  → LiveSummaryStrip grid
  → ScheduleStatCard × N (borderless)
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|-----|------|---------|------|
| 1 | 数据归一化 | 通 | `standardAnalysisUi.tsx:normalize*` | 与改前一致 |
| 2 | 指标计算 | 通 | `buildLiveSummaryMetrics` | 行数/合计/最高区域逻辑未改 |
| 3 | 组件复用 | 通 | `StandardAnalysisLiveView.tsx:63-69` | 已 import `ScheduleStatCard` |
| 4 | 样式 borderless | 通 | `SchedulePageOverview.tsx:24-26` + UI 断言 | `border-0 shadow-none` |
| 5 | 全宽 grid | 通 | `style gridTemplateColumns repeat(N,1fr)` | 2 卡/3 卡均分 |
| 6 | 空数据隐藏 | 通（静态） | `liveRows.length > 0` 条件 | 未动态复验 |
| 7 | 调度页回归 | 通（静态） | 默认 `borderless` 未传 → 仍有边框 | 未跑 Hub smoke |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 复用 ScheduleStatCard | **REAL** | 9/A | 源码接线 + UI 渲染含 `rounded-xl` 卡结构 |
| T2 | 全宽等分 | **REAL** | 9/A | `grid-template-columns: repeat(2\|3, minmax(0,1fr))` |
| T3 | 无边框 | **REAL** | 9/A | 卡 class 含 `border-0`，无 `border-gray-200` |
| T4 | 指标准确 | **REAL** | 9/A | lifecycle 2+3；distribution 华北（30） |
| T5 | testid 保留 | **REAL** | 10/A | `data-testid` 仍在容器 div |

## 3b. 前端控件下钻表（本 scope 无新增可交互控件）

本改动为**只读指标展示**，无可点击控件。相邻控件（图表/数据表切换）未改，Out。

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| — | — | — | — | — | — | — | — | — | — | — | — | 无 B 项 |

功能块映射：T1–T5 由展示层直接验收，无 B 下钻。

## 3d. 覆盖矩阵

| 实体 ID | 描述 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| M1 | 接线 ScheduleStatCard | ✅ | — | ✅ | UI | 2 | 2 | REAL | `StandardAnalysisLiveView.tsx:34,63-69` |
| M2 | borderless 样式 | ✅ | — | ✅ | UI | 2 | 2 | REAL | 审计临时 vitest：卡 `border-0` |
| M3 | 全宽 grid N 列 | ✅ | — | ✅ | UI | 2 | 2 | REAL | 审计临时 vitest：`repeat(2,…)` |
| M4 | lifecycle 指标 | ✅ | — | ✅ | UI | 2 | 2 | REAL | 行数 2、合计 3 |
| M5 | distribution 第三指标 | ✅ | — | ✅ | UI | 2 | 2 | REAL | 3 列 +「华北（30）」 |
| M6 | 无数据不渲染 | ✅ | — | ❌ | GATE | 1 | 1 | STUB | 静态条件分支，未动态验 |
| M7 | SchedulePageOverview 回归 | ✅ | — | ❌ | GATE | 1 | 1 | STUB | 默认仍带边框，未跑 Hub smoke |
| M8 | 矩阵页 MatrixTotalSummaryStrip | — | — | — | **Out** | — | — | Out | 非本次用户范围 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 7（Out 1） |
| GATE only | 2（M6、M7） |
| UI | 5 |
| BROWSER | 0 |
| NONE | 0 |
| REAL 达标 | 5/7 |
| **逐一校验** | **否** — M6/M7 仅静态 GATE，未动态/UI 复验 |
| **总体可否 REAL** | **否** — 存在 GATE-only 必验行；且无仓内正式单测 |

## 3c. 五维评分汇总（T 级：摘要条改造）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 展示链路完整 |
| T2 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | grid 等分 |
| T3 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | borderless |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 指标与改前一致 |
| T5 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | testid 保留 |
| **T 汇总（取最低）** | 2 | 2 | 2 | 2 | 2 | **10** | **A** | **REAL** | 核心改造项 |

**scope 总体 PARTIAL 原因**：§3d 中 M6/M7 仅 GATE；无正式回归测试入仓；未 BROWSER 真机截图。

**打通但不对**：0

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | vitest 审计渲染 lifecycle | 2 卡、无边框、行数 2 合计 3 | 通过 | ✅ | `_audit-live-summary.temp.test.tsx`（审计后已删） |
| 2 | vitest 审计渲染 distribution | 3 卡、含最高区域华北（30） | DOM 输出正确（第二用例因未 cleanup 报 duplicate，内容已证实） | ✅ | vitest stderr 快照 |
| 3 | `standardAnalysisLiveViewChart.test.tsx` | 图表数据路径仍通 | 1 passed | ✅ | vitest 输出 |
| 4 | `standard-analysis.smoke.test.tsx` | 结果页可挂载 | 1 passed | ✅ | vitest 输出 |
| 5 | 仓内正式摘要单测 | 有断言 ScheduleStatCard/borderless | **不存在** | ❌ | grep 无匹配 |

## 5. 修复文档（P1 — 非阻断交付，建议补测）

### P1 — 缺少正式 UI 回归单测

**判定 / 得分**：STUB（测试缺口），不影响已实现 UI  
**期望 vs 实际**：期望仓内有 `standard-analysis-live-summary` 的 mount 断言；实际仅 smoke 未覆盖摘要条  
**修复方向**：在 `standardAnalysisLiveViewChart.test.tsx` 或新 smoke 中断言 `getByTestId('standard-analysis-live-summary')`、卡数量、`border-0`  
**修后验收**：M6 动态验 + 总体可标 REAL  

### P2 — 矩阵对比摘要未统一（可选）

**判定**：Out of scope，产品一致性缺口  
**修复方向**：`MatrixTotalSummaryStrip` 改用同一 `ScheduleStatCard` + borderless grid  
**优先级**：P2

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | 测试缺口 | 补正式 vitest 覆盖摘要 ScheduleStatCard |
| P2 | M8 Out | 矩阵页总量条可选统一组件 |

## 7. 交接

- **用户问「是否完成」结论**：
  - **产品/UI 改造：已完成**（代码已落地，动态 UI 验证通过）
  - **Truth-verify 签收：PARTIAL**（缺正式单测 + M6/M7 GATE-only + 无 BROWSER）
- 建议：批准补 P1 单测后复验同矩阵；或交接 `root-first-solve` 统一矩阵摘要
- 用户批准修复：**否**
