---
name: create-evolution-goal
description: >-
  人工交互生成或修订 docs/automate/goal.md。苏格拉底式提问澄清产品定位、终极目标、边界与成功指标。
  由用户在聊天中手动触发；演化 Automation 与 evolution-* subagent 禁止调用。
---

# Create Evolution Goal（人工交互）

## 何时使用

- 用户手动触发：为目标项目首次生成 goal.md、体检已有 goal.md，或修订已过时 / 反推错向的 goal.md
- 本 skill 是 goal.md **唯一合法修改通道**；演化 subagent 禁止修改已存在的 goal.md（缺失时 doc-bootstrap 仍可首次生成）
- **禁止**被无人值守演化流程（Automations / evolution-* subagent）调用

## 文档定位

`docs/automate/goal.md` 是自我演化的**方向与边界源**，回答「为什么做、给谁做、做到什么程度、不做什么」。它不列具体功能清单，不替代 PRD，不排里程碑。

| 文档 | 定位 | 本 skill 是否修改 |
|------|------|------------------|
| `goal.md` | 产品定位、终极目标、边界、成功指标 | 是 |
| `prd.md` + `prd/*.md` | 功能真理源、验收标准、8 维评分、goal_ref 映射 | 否，修订后提示体检 |
| `plan.md` | 人工里程碑与顺序干预 | 否 |
| `evolution-state.md` | 当前轮次、待办池、模块地图、Token 索引、STUCK 计数 | 否 |

## 工作模式

| 模式 | 触发 | 输出 |
|------|------|------|
| 新建 | `goal.md` 不存在 | 完整 `goal.md` |
| 体检 | `goal.md` 已存在，用户要求检查 | 质量评分 + 问题清单 + 修订建议，不默认写入 |
| 修订 | 用户确认要改已有内容 | 逐条确认后的最小修改 |

## 提问纪律（苏格拉底式）

- **一次只问一个问题**；能给选项就给选项（多选一优先，附推荐项）
- 提问前先读上下文：README、package 描述、docs/、`git log -10`、已有 goal.md
- 用户跳过问题 → 采用推荐默认值，并在产出中该处标注 `（待确认）`
- 写入前必须展示「变更摘要 + 将写入的章节预览」，等待用户明确确认

## 质量评分（100 分）

| 维度 | 分值 | 检查点 |
|------|-----:|--------|
| 定位清晰度 | 20 | 一句话说明用户、场景、问题、产品形态 |
| 目标可追踪性 | 20 | 终极目标 3–6 条，编号稳定，可被 `goal_ref` 引用 |
| 边界明确度 | 20 | In Scope / Out of Scope 可阻止无关演化 |
| 成功指标可判定性 | 20 | 指标可被 agent 或测试判断；方向性指标显式标注 |
| PRD 衔接度 | 10 | 目标编号适合映射到功能项 |
| 文档可维护性 | 10 | 章节固定、低频人工修订、无实现细节堆积 |

评分解释：

| 分数 | 结论 |
|------|------|
| 90-100 | 可作为自动演化稳定锚点 |
| 80-89 | 可用，但有模糊项需后续确认 |
| 70-79 | 勉强可用，容易导致选题漂移 |
| <70 | 建议先继续交互澄清，不写入正式 goal |

## 首次生成（goal.md 不存在）

按顺序逐项探讨，每项一轮提问：

| 节 | 探讨内容 |
|----|----------|
| 1. 产品定义 | 一句话定位：是什么 + 给谁用 + 解决什么 |
| 2. 终极目标 | 3–6 条，**编号列表**（prd 功能项 `goal_ref` 将引用编号，编号一经写入 goal.md 不复用） |
| 3. 核心价值 | 价值 → 说明 表格 |
| 4. 边界范围 | In Scope 摘要 + Out of Scope 表（非目标 + 原因） |
| 5. 成功指标 | 走下方「可判定性环节」 |
| 6. 文档层级 | 固定生成下方结构图，无需提问 |

### 成功指标可判定性环节

对用户给出的每条指标追问一次：「agent 如何判定这条达成 / 未达成？」

| 类型 | 处理 |
|------|------|
| 可判定（如「成功请求 100% 写入 usage」） | 写成可测试句式 |
| 不可判定（如「≤1 工作日上线新厂商」） | 保留但标注 `（方向性）` |

## 重复执行（goal.md 已存在）

1. 读现有 goal.md，对照代码现状与 `git log`，列出疑似 **模糊 / 过时 / 与现状冲突** 的条目
2. 按「质量评分」给出现状分数、扣分原因、建议动作
3. 逐条向用户提问确认（一次一条）
4. 汇总修订摘要（改了哪节、为什么）→ 用户确认后写入
5. **禁止**未经用户确认改写任何已有内容
6. 终极目标编号变更（删除/合并）时，提示受影响的 prd `goal_ref` 列表

## 产出结构

节标题固定，内容按探讨结果填写：

```markdown
# <项目名> — 产品目标

> 功能真理源见 prd.md；本文件低频人工修订（create-evolution-goal），演化 agent 只读。

## 1. 产品定义
## 2. 终极目标
## 3. 核心价值
## 4. 边界范围
## 5. 成功指标
## 6. 文档层级
```

「## 6. 文档层级」节固定写入：

```
docs/automate/goal.md              ← 方向与边界（人工低频修订，create-evolution-goal）
docs/automate/prd.md               ← PRD hub：8 维评分、薄弱项、功能索引（G2 只读）
docs/automate/prd/                 ← 功能明细分片（按 ID 按需读）
docs/automate/plan.md              ← 里程碑（人工维护，create-evolution-plan；演化 agent 只读）
docs/automate/evolution-state.md   ← 当前轮次、待办池、模块地图、项目 skill/rule 索引、STUCK 计数
docs/automate/subagent/            ← subagent 外置提示词（可选，人工维护）
```

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: create-evolution-goal
mode: create | audit | revise
score: 0
artifacts:
  - docs/automate/goal.md
summary:
  - ""
followups:
  - "建议运行 create-evolution-prd 体检 goal_ref 映射"
```

## 红线

- 修订必须逐条经用户确认
- 写入前必须展示预览并获得确认
- **禁止**演化流程调用本 skill
- 产出后提醒用户：goal 修订可能影响 prd `goal_ref` 映射，建议接着跑 `create-evolution-prd` 体检
