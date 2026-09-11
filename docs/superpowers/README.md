# Superpowers 演化产出

> **定位**：无人值守演化流水线（G2–P3）的**轮次设计与实现计划**落盘目录。  
> **不替代** [`docs/automate/`](../automate/)：产品真理源仍在 goal / prd / plan；本目录只存单轮 design 与 execute 合同。

## 与 automate 文档的分工

| 文档 | 路径 | 谁写 | 内容 |
|------|------|------|------|
| 方向 / 验收真理源 | `docs/automate/goal.md` · `prd/` · `plan.md` | 人工 + 演化对账 | 118 项功能、里程碑 |
| 轮次选题 | `docs/superpowers/evolution/*-round-target.md` | evolution-picker（G2） | 本轮 PRD ID、范围框定 |
| 设计规格 | `docs/superpowers/specs/*-design.md` | evolution-designer（P1） + **brainstorming** |
| 实现计划 | `docs/superpowers/plans/*.md` | evolution-planner（P2） + **writing-plans** |
| 运行态账本 | `docs/automate/evolution-state.md` | 各阶段回写 | 当前轮次、待办池、skill 索引 |

**人工 M1 实施**走 [`docs/automate/plan.md`](../automate/plan.md) 实施展开，**不必**在本目录建 plan。

## 子目录

| 目录 | 命名 | 产出阶段 |
|------|------|----------|
| [evolution/](./evolution/) | `YYYY-MM-DD-round-target.md` | G2 选题（**07-10 起为空**；历史见 [archive/evolution/](./archive/evolution/)） |
| [specs/](./specs/) | `YYYY-MM-DD-<name>-design.md` | P1 设计 |
| [plans/](./plans/) | `YYYY-MM-DD-<name>.md` | P2 计划 |
| [archive/](./archive/) | M1–M-FINAL 轮次归档 | 只读追溯 |

## Superpowers skill（项目已安装）

路径：`.agents/skills/`（见根目录 `skills-lock.json`）

| 演化阶段 | Superpowers skill |
|----------|-------------------|
| P1 | `brainstorming` |
| P2 | `writing-plans` |
| P3 | `subagent-driven-development` 或 `executing-plans` |
| 调试 / 验收 | `systematic-debugging` · `verification-before-completion` |

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.1.0 | 2026-07-20 | M1–M-FINAL 轮次移入 `archive/`；automate/plans 同步归档 |
| 1.0.0 | 2026-07-03 | 初版目录骨架 |
