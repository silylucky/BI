# 实施计划索引

> **真理源**：产品验收仍以 [`prd.md`](../prd.md) + `prd/F*.md` 为准；本目录为 dev-autopilot / 人工执行的**分步计划**。
> **归档**：已完成或被取代的计划见 [`archive/`](./archive/)。

## 活跃计划

| 计划 | 状态 | 说明 |
|------|------|------|
| [2026-07-21-chart-per-type-verification.md](./2026-07-21-chart-per-type-verification.md) | **AUTO 已闭环** | 逐型验收（L1/L2/L3 + MIG）；`pnpm test:chart-catalog` |
| [2026-07-21-d3-full-chart-migration.md](./2026-07-21-d3-full-chart-migration.md) | **已完成** | 画布图表全量 D3 渲染（43 型）；AntV 画布依赖已移除 |
| [2026-07-20-chart-component-acceptance.md](./2026-07-20-chart-component-acceptance.md) | **历史参考** | 迁移期 Inspector 清单；引擎分路以 2026-07-21 逐型手册为准 |
| [2026-07-20-data-screen-resize-geometry-pipeline.md](./2026-07-20-data-screen-resize-geometry-pipeline.md) | **P0 进行中** | BUG-12：resize 后内容消失；几何+测量管线（plan-review PASS） |
| [2026-07-20-data-screen-edit-viewport-de.md](./2026-07-20-data-screen-edit-viewport-de.md) | **排队** | 大屏编辑视口：平移/缩放/标尺对标 DE（T1 ✅，T2–T4 待做） |
| [2026-07-14-dashboard-canvas-ux-de-complete.md](./2026-07-14-dashboard-canvas-ux-de-complete.md) | **排队** | 看板画布拖缩放 + 表格/图表视觉 DE 对标 |
| [2026-07-17-data-screen-phase25-requirements.md](./2026-07-17-data-screen-phase25-requirements.md) | **需求规格** | Phase 2.5 需求真理源（Wave A–E） |
| [2026-07-13-dashboard-de-toolbar-full.md](./2026-07-13-dashboard-de-toolbar-full.md) | **部分** | DE 工具栏 Wave 长期 backlog |
| [2026-07-13-dashboard-config-inspector-de-full.md](./2026-07-13-dashboard-config-inspector-de-full.md) | **部分** | 配置栏 DE 对标母计划 |
| [2026-07-13-engine-spec-phase2-sql-dialects.md](./2026-07-13-engine-spec-phase2-sql-dialects.md) | **待核对** | sqlite/sqlserver/oracle 方言接线 |

## 战略参考（非执行队列）

| 计划 | 说明 |
|------|------|
| [2026-07-10-fe-de-ss-ia-optimization.md](./2026-07-10-fe-de-ss-ia-optimization.md) | M-DEPTH 全栈 DE/SS IA 审视 |
| [2026-07-10-architecture-improve-exhaustive.md](./2026-07-10-architecture-improve-exhaustive.md) | 架构债 R0/R1.5 索引 |

## 归档

[`archive/`](./archive/) 含 2026-07-08 ~ 2026-07-17 已交付计划（像素画布、大屏 Phase 1/2.5 执行、gap/mark-line、报表 IA 等）。检索 bug 追溯时优先查 `.agents/skills/bug-case-library/cases/` 与 `docs/bugs/`。

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-21 | 逐型验收 AUTO 闭环（`test:chart-catalog`） |
| 2026-07-21 | 新增逐型验收手册（L1/L2/L3 + DE 夹具） |
| 2026-07-21 | 新增 D3 全量图表迁移计划 |
| 2026-07-20 | 新增 BUG-12 resize 几何管线计划（P0） |
| 2026-07-20 | 初版索引；38 份已完成计划移入 `archive/` |
