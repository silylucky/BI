# 刺点分类 · 体验依赖能力缺口

目标：把「现有能力改好」和「体验依赖但尚未有的能力」分开，便于 loop / PRD 交接；**不**把本 Skill 变成功能发明机。

## 三类（每条刺点必标一）

| 分类 | 含义 | 本环 / go-fast | 真理源交接 |
|------|------|----------------|------------|
| `experience_fix` | 能力已有（或半有），改任务/流程/信息/权责/状态机即可抬体验 | **可进** product / polishing Fix | 一般不扩 PRD |
| `capability_gap` | 主路径或关键例外**成立所依赖**的能力项缺失或仅有假入口 | **默认不进**冲分 Fix；标 `deferred` / followup | → `create-evolution-prd`（或人确认后扩写）→ 再 `loop-goal-prd` |
| `out_of_scope` | 新域 / 新角色体系 / 新集成厂商等，超出当前评审 scope | **不进** Fix；`wontfix` 或 `deferred` | → `product-blueprint` / 人工扩 scope；禁止当冲分项 |

`视觉债=是` 仍独立标注；视觉债通常落在 `experience_fix` 的抛光子集，或直接交 ui-ux（与分类正交）。

## 何时标 `capability_gap`（须同时满足）

1. **体验依赖**：不补该能力，某一维（常 2/3/4/7/8）无法诚实抬到「真实业务可用」——不是「有了会更好看」。  
2. **可验收最小项**：能写成一句话能力 + 谁用什么步骤验收（不是愿望清单）。  
3. **证据**：主路径/例外走查卡在「系统根本没有这一步/对象/动作」，或只有菜单/路由骨架无真实行为（半成品入口常同时命中硬门槛）。

## 禁止当成 `capability_gap`

| 反例 | 应标 |
|------|------|
| 文案黑话、字段名上屏、空态口吻 | `experience_fix`（文案豁免薄补丁） |
| 决策藏二级、状态不透明、权责文案不清 | `experience_fix` |
| 「不如再做一个工单中心 / BI 大屏」无主路径依赖 | `out_of_scope` 或执行摘要「不该再加」 |
| 招标条款缺失（无外部 RFP 对照） | 不归本 Skill；走 [requirement-fit](../../requirement-fit/SKILL.md) |
| 无证据的「业界都该有」愿望 | 禁止入库；要业内对照先 [product-blueprint](../../product-blueprint/SKILL.md) `audit` |

## `capability_gap` 强制字段（刺点或附录表）

| 字段 | 说明 |
|------|------|
| `depends_on_dim` | 卡住的八维编号（可多） |
| `blocked_step` | 主路径/例外上哪一步断了（一句话） |
| `min_capability` | 最小可验收能力项（用户可感知） |
| `prd_hint` | 建议新 PRD ID / 并入已有 `Fxx` / `unknown` |
| `hinted_by_surface` | `是` = 已有菜单/路由/文案暗示该能力；`否` = 纯缺口 |
| `suggested_handoff` | 默认 `create-evolution-prd`；新域则 `product-blueprint` |

## 评分纪律

- 八维分**只评当前可观察产品**；发现并列出 `capability_gap` **不得**作为加分理由。  
- 缺口导致主任务立不住 → 该维仍应低分 + 可挂硬门槛；分类是交接，不是护分。  
- 执行摘要须区分：「先还体验债」vs「体验依赖能力清单（须进 PRD）」。

## 与 loop 编排

| 环 | 对 `capability_gap` |
|----|---------------------|
| `loop-goal-product` / `loop-polishing` | 默认**剔除**出 Fix batch；处理清单状态 `deferred`（原因：`capability_gap`）；followups 写 PRD/蓝图；**dig 允许新发现并标注**，禁止当本环实现 |
| `loop-goal-prd` | 仅当缺口已诚实写入 plan/PRD 后才实现；本报告附录作线索，**不**自动发明里程碑 |
| dig「禁止发明功能」 | = 禁止无分类、无证据、直接写代码扩能力；**≠** 禁止发现并标注 `capability_gap` |
