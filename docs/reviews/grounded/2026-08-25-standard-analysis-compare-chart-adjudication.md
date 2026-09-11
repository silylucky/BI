# 项目锚定方案评审 — 标准分析周期对比「图主表辅」消费态改造

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-25 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 问题 | 标准分析「周期对比」当前以区域分布 + 多期并排宽表为主，用户难以一眼看出差异；是否应改为趋势图/对比图优先？接下来怎么改？ |
| 选项 | A（Cursor 三阶段 FE 图主表辅）· B（2026-08-18 产品评审：先立信任链再加图）· C（激进 IA：合并 Tab、对比仅保留趋势）· S0（维持现状） |
| 裁决 | **RECOMMEND_SYNTHESIZED** |
| 方向纠正强度 | **改道** |
| 置信度 | **HIGH** |
| **交付** | 判 + 纠 + 给（§6–§9 完整） |

---

## 1. 项目约束摘录

| ID | 来源 | 约束 |
|----|------|------|
| C-01 | `docs/services/reports.md` L49 | 标准分析消费端：**图主表辅** + 数据口径说明 |
| C-02 | `docs/automate/prd/F08-RPT.md` RPT-002 | 已实现：run / compare / snapshots / FE 工作台；M-RPT F-B 已收官 |
| C-03 | `docs/automate/plan.md` §M-RPT | 当前节 F-D（可选）；F-A~F-C 必做已收官；**不阻塞**本改造，但应 companion 体量 |
| C-04 | `.cursor/rules/engineering.mdc` | FE 单文件 ≤300 行；复用 `fe/src/components/README.md` 清单 |
| C-05 | `docs/material/product-reviewer/2026-08-18-standard-analysis-compare.md` | r1：**对比信任链**优先于 polish；无上期勿假对比 |
| C-06 | T1 现码 | 实时态已有图/表切换；对比态仅表；`compare` API 含 `deltas`+`deltaPct`；`compare/matrix` 已实现 |

---

## 2. 问题重述

**用户问题**：标准分析的数据分析感觉应该是趋势图，能明显对比数据差异，而不是展示区域和活跃度周期的宽表。

**纠正后问题**（§7 重定义）：在 **不削弱已收官的对比信任链**（本期/对比期语义、快照可观测、无上期空态）前提下，将 **C 线消费态** 从「表解释一切」纠正为 **「图解释变化、表承接明细」**——默认路径应落在 **两期对比 + 图表**，多期并排降为导出/高级能力。

---

## 3. 选项归一

| ID | 方案摘要 | 触及面 | 与真理源 |
|----|----------|--------|----------|
| **A** | FE 三阶段：默认 trend/两期对比 → 两期对比图表 → 多期折线 Top N | `fe/.../reports/` 纯前端 | 对齐 C-01；不动后端 |
| **B** | 延续 r1：先修信任/快照/语义，**对比立住前不加图** |  Mostly 已完成（F-B） | 与 C-01「图主表辅」**冲突**；滞后用户痛点 |
| **C** | 合并四个 Tab 为「总览/构成/明细」或对比仅保留 trend | IA + FE + 可能 seed/配置 | 超 RPT-002 已交付范围；改动大、可逆性差 |
| **S0** | 维持现状：对比/矩阵继续纯表 | — | **违反** C-01 叙事与域文档 |

---

## 4. 证据与假设

| # | 类型 | 证据 | 结论 |
|---|------|------|------|
| E-1 | T1 | `StandardAnalysisLiveView.tsx` L142–181：实时态有图/表切换 + `StandardAnalysisSectionChart` | 图表能力已存在，**未复用到对比态** |
| E-2 | T1 | `StandardAnalysisCompareView.tsx`：两期对比仅 `DataTable`；`deltaPct` 已展示（L149–153） | 信任链部分已修；**缺图表主视图** |
| E-3 | T1 | `StandardAnalysisCompareMatrixView.tsx`：多期并排 **纯宽表** | 用户截图痛点直接对应此文件 |
| E-4 | T1 | `backend/.../compare.py`：`compare_pack` 返回 `deltas`；`compare_periods_matrix` 返回 `periodKeys`+`rows` | **后端数据足够**，无需新 API |
| E-5 | T1 | `backend/.../service.py` L214–228：distribution/lifecycle→bar；activity/trend→line | 主题→图类型映射已定义，可复用 |
| E-6 | T0 | `docs/services/reports.md` L49「图主表辅」 | 现实现与文档 **漂移** |
| E-7 | T2 | `2026-08-18-standard-analysis-compare.md` r1 总分 53；B-2/B-5 硬门槛 | F-B 后 `SnapshotStrip`、空态、语义条已补；**r1「先不加图」已过时** |
| E-8 | T1 | 用户截图：distribution + 多期并排 6 列 × 45 维 | 最差组合：截面主题 × 矩阵宽表 |
| E-9 | T3 | `ChartEngineView` 多系列折线对 45 维同时绘制可读性 | 矩阵图须 **Top N / 总量线** 策略，否则图表亦糊 |

**假设（待实现验证）**：

- H-1：`compare.deltas` 转 grouped bar 数据集可被 `buildChartViewModel` 消费（与 live 同路径）。
- H-2：矩阵长表 + Top 8 维度折线在手测可接受；超出部分仅表展示。

---

## 5. 多维打分

| 选项 | 契合 | 正确 | 可验证 | 改动 | 可逆 | 现码 | 加权 | 资格 |
|------|------|------|--------|------|------|------|------|------|
| **A** | 9 | 8 | 9 | 8 | 9 | 9 | **8.65** | OK |
| **B** | 6 | 7 | 8 | 9 | 9 | 8 | 7.25 | OK（但滞后） |
| **C** | 5 | 6 | 6 | 4 | 5 | 5 | 5.35 | OK（不推荐） |
| **S0** | 3 | 4 | 9 | 10 | 10 | 10 | 5.95 | DISQUALIFY（违 C-01） |

权重：契合 0.25 · 正确 0.20 · 可验证 0.15 · 改动 0.15 · 可逆 0.10 · 现码 0.15

---

## 6. 裁决

**推荐**：**RECOMMEND_SYNTHESIZED**（置信度 **HIGH**）

**一句话**：采用 **A 的 FE 图主表辅路径**，但 **强制保留 B 已落地的信任链 UX**，并 **否决 C 的 Tab 大改**；实施顺序改为 **默认路径纠偏 → 两期对比图 → 多期 Top N 折线**，矩阵宽表降为次级。

**相对 Cursor 原方案的纠正**：

| 原建议 | 纠正 |
|--------|------|
| 阶段 1+2+3 平铺推进 | **必须先闭合两期对比图**再做多期；矩阵不可与默认路径同期上线 |
| 默认主题改 trend | ✅ 保留；但 **不改** `enabledThemes` 后端契约 |
| 多期折线画全部维度 | ❌ 改为 Top N（默认 8）+ 可选「总量趋势」 |
| 四个 Tab 顺序调整 | ✅ 仅 FE 展示顺序；**不合并/删除主题** |

---

## 7. 规划方向纠正

**原方向错在哪？**

1. **用户表述偏窄**：「都应该是趋势图」——区域/生命周期本质是 **截面构成**，跨期对比应是 **结构变化条/Top 增减**，不是强行折线。
2. **Cursor 初版顺序偏了**：先谈多期矩阵折线，未先闭合 **两期对比** 这一 PRD 主路径（`GET .../compare`）。
3. **与 r1 的张力已消解**：2026-08-18 评审要求「对比立住再加图」；F-B 已交付 `SnapshotStrip`、对比语义条、无上期空态、`deltaPct`——**现在加图不违背 r1**，但 **不得回退** 这些能力。
4. **现码与域文档漂移**：`reports.md` 写「图主表辅」，对比态只有表——这是 **文档诚实性问题**，应通过实现补齐而非改文档降级。

**纠正后目标（一句话）**：标准分析消费端在「周期对比」下 **默认以图表展示本期 vs 对比期（或 Top N 跨期趋势）**，表格为可切换明细；默认落在 **趋势主题 + 两期对比**。

**应停止**：

- 把 **多期并排宽表** 作为首屏默认（localStorage 已有 matrix 的用户可保留，新默认 pair）。
- 在对比态 **删除或弱化** `SnapshotStrip`、无上期空态、语义说明（B-2/B-5 回归）。
- 本期做 **Tab 合并/删主题**、热力图、地图、新 compare API、Excel 设计器。
- 用 env 开关隐藏图表（违反 production R6）。

**应优先**：

1. 默认路径：trend 优先、`pair` 默认、对比默认 chart。
2. 两期对比图表（复用 `ChartEngineView`）。
3. smoke + 域文档/PRD 演化条款各一条。
4. （二期）多期矩阵 Top N 折线。

**与里程碑对齐**：

| 对齐项 | 当前 | 里程碑 | 纠正建议 |
|--------|------|--------|----------|
| 范围 | C 线消费态图表 | M-RPT F-B 已收官 | 作为 **F-B companion polish** 或 **F-D 前小 companion**，不新开里程碑 |
| PRD | RPT-002 已勾选 | 无新功能 ID 必需 | 在 RPT-002「演化建议」补一条消费态图主表辅验收 |
| 体量 | 新增 2–3 个 FE 文件 | fe ≤300 行/文件 | 数据转换抽 `standardAnalysisCompareChartData.ts` |

---

## 8. 推荐解决方案（合成）

### 8.1 方案摘要

**名称**：标准分析对比态「图主表辅」FE 闭环  
**类型**：SYNTHESIZED（A 图表路径 + B 信任链保留 + 否决 C）  
**一句话**：纯前端复用现有 compare API 与 `ChartEngineView`，先闭合两期对比图与默认路径，再做多期 Top N 趋势图。

### 8.2 目标与非目标

| 目标（Phase 1） | 非目标（本期不做） |
|-----------------|-------------------|
| 两期对比默认 **图表**（分组条/蝴蝶 Top 15） | 合并/删除四个主题 Tab |
| 对比态图/表切换（localStorage 记忆） | 新后端 compare 契约 |
| 默认主题优先 `trend`；新用户 compare 默认 `pair` | 热力图、地图、gis-map |
| 保留并测试：SnapshotStrip、无上期空态、deltaPct | 改 `enabledThemes` 后端模型 |
| vitest smoke 覆盖对比默认图表 | 标准分析 yoy/mom（属 extension 线） |

| 目标（Phase 2，可选） | |
|-----------------------|---|
| 多期并排：主区 Top N 折线 + 次区原宽表 | |
| 总量趋势线（各期 sum）摘要条 | |

### 8.3 架构与触及面

| 层 | 动作 | 路径/模块 | 复用 |
|----|------|-----------|------|
| entry | 默认主题/compare 布局 | `StandardAnalysisPage.tsx` | `readCompareLayout` |
| use-case | 主题解析顺序 | `useStandardAnalysis.ts` → `resolveFirstAvailableTheme` | 现有 capabilities |
| presentation | 对比图数据转换 | **新建** `standardAnalysisCompareChartData.ts` | `humanizeSectionHeaders` |
| presentation | 对比默认模式 prefs | **新建** `standardAnalysisComparePresentation.ts` | `standardAnalysisPrefs.ts` 模式 |
| domain UI | 两期对比图 | **新建** `StandardAnalysisCompareChart.tsx` | `StandardAnalysisSectionChart.tsx` |
| domain UI | 两期对比容器 | `StandardAnalysisCompareView.tsx` | 现有 `CompareSemanticsBanner` |
| domain UI | 多期图（P2） | `StandardAnalysisCompareMatrixView.tsx` | P1 转换函数 |
| shared | 图表引擎 | `ChartEngineView` · `buildChartViewModel` | 已有 |
| docs | 演化条款 | `docs/services/reports.md` · `F08-RPT.md` | prd-sync |
| test | smoke | `standard-analysis-compare.smoke.test.tsx` + 新 chart smoke | 现有 mock 结构 |

### 8.4 实施步骤（有序）

| 步 | 内容 | 依赖 | 验收 |
|----|------|------|------|
| **1** | `resolveFirstAvailableTheme` 按 `trend→activity→distribution→lifecycle` 选首个可用 | — | 打开 sss1 默认 Tab 为「趋势」（若 enabled） |
| **2** | `readCompareLayout` 默认 `pair`；`ALL_ANALYSIS_THEMES` 顺序 trend 靠前 | 1 | 新用户进对比见「两期对比」 |
| **3** | 新建 `standardAnalysisCompareChartData.ts`：`deltasToGroupedBarRows(deltas, limit=15)` | — | 单元测试：空/单维/多维 |
| **4** | 新建 `StandardAnalysisCompareChart.tsx` + `standardAnalysisComparePresentation.ts` | 3 | 组件渲染不抛错 |
| **5** | 改造 `StandardAnalysisCompareView`：图/表切换，**默认 chart**；无上期仍走 `NoPreviousSnapshotState` | 4 | smoke：对比模式可见图表 toggle；无上期仍见「对比期快照缺失」 |
| **6** | smoke：mock compare 含 previous + deltas，断言图表区域存在 | 5 | `pnpm vitest run fe/src/pages/admin/reports/standard-analysis-compare*.tsx` |
| **7** | 文档：`reports.md` 补对比态图表；`F08-RPT.md` 演化建议一条 | 5 | 人工 diff 文档 |
| **8**（P2） | `matrixToLongRows` + Top N 折线；`StandardAnalysisCompareMatrixView` 图主表辅 | 5–7 | 选手测 6 期 × 45 维可读 |
| **9**（P2） | 矩阵 smoke + 总量摘要 | 8 | vitest 绿 |

### 8.5 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| 45 维分组条仍拥挤 | Top 15 + 「查看全部」切表 | 默认改 table，chart 为 opt-in |
| 图表与表格数字不一致 | 同源 `compareData.deltas` | — |
| 文件超 300 行 | 转换逻辑外抽 | — |
| 回归 B-2 空态 | smoke 保留无上期用例 |  revert CompareView 条件分支 |

### 8.6 对 Cursor 原方案的具体纠正

| 原建议 | 问题 | 纠正后做法 |
|--------|------|------------|
| 阶段 1+2+3 一起排期 | 矩阵复杂度高，阻塞主路径 | **P1 只交付 1–7**；矩阵图进 P2 |
| distribution 多期用折线 | 截面主题折线难解读 | distribution/lifecycle：**两期 grouped bar**；多期用 Top N 线或暂仅表 |
| 删/并 Tab | 超 scope、违背 RPT-002 | 只调顺序与默认，四主题保留 |
| 先写 PRD 大改 | plan F-D 可选，不宜膨胀 | 演化建议 + services 一句 |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**：对齐 `docs/services/reports.md`「图主表辅」，使标准分析周期对比默认以图表展示增减，表格为明细出口。

**硬约束**：C-01~C-04；不得回退对比信任链（C-05 已闭合项）；零后端 API 变更（P1）；FE 文件体量。

**改动清单草案**（≤10）：

1. `fe/src/pages/admin/reports/useStandardAnalysis.ts` — 主题默认顺序  
2. `fe/src/pages/admin/reports/components/standardAnalysisUi.tsx` — `ALL_ANALYSIS_THEMES` 顺序  
3. `fe/src/pages/admin/reports/standardAnalysisComparePrefs.ts` — 新用户默认 `pair`  
4. `fe/src/pages/admin/reports/standardAnalysisCompareChartData.ts` — **新建**  
5. `fe/src/pages/admin/reports/standardAnalysisComparePresentation.ts` — **新建**  
6. `fe/src/pages/admin/reports/components/StandardAnalysisCompareChart.tsx` — **新建**  
7. `fe/src/pages/admin/reports/components/StandardAnalysisCompareView.tsx` — 图/表切换  
8. `fe/src/pages/admin/reports/standard-analysis-compare.smoke.test.tsx` — 扩展断言  
9. `docs/services/reports.md` — 对比态图表说明  
10. `docs/automate/prd/F08-RPT.md` — RPT-002 演化建议  

**验证方案**：

```bash
cd fe && pnpm vitest run src/pages/admin/reports/standard-analysis-compare.smoke.test.tsx src/pages/admin/reports/standard-analysis-observability.smoke.test.tsx
```

手测：`/admin/reports/standard/results` → 选包 → 周期对比 → 默认两期 + 图表可见涨跌；切「多期并排」仍可用表（P1）。

**非目标**：Tab 合并、热力图、新 API、B 线模板投递、Excel 设计器。

**待验证 spike**：无（H-1/H-2 可在步 3–4 单元测试闭合）。

---

## 10. 验证命令

```bash
# FE 报表域 smoke（P1 必跑）
cd fe && pnpm vitest run src/pages/admin/reports/standard-analysis-compare.smoke.test.tsx

# 可选：全报表域回归
cd fe && pnpm vitest run src/pages/admin/reports/

# 后端无需改；可选确认 compare 契约未动
cd backend && pytest tests/test_standard_snapshot_retention.py -q
```

---

## 11. 交接与下一步

| 下一步 | 负责人 | 条件 |
|--------|--------|------|
| `/plan-create` 展开 §9 为 plan 合同 | 用户或 Agent | 用户确认本裁决 |
| **直接按 §8.4 步 1–7 实现** | Agent | 用户说「按报告实现」 |
| `feature-truth-verify` | 实施后 | P1 合并前 |

**建议立即执行**：P1（步 1–7），预估 **2–3 人日**，纯 FE，可独立 PR。

---

*报告路径：`docs/reviews/grounded/2026-08-25-standard-analysis-compare-chart-adjudication.md`*
