---
name: evolution-readiness-audit
description: >-
  管理员侧自我演化就绪度体检。检查 automate 部署版本、SOP/agent/skill 漂移、
  docs/automate 状态账本、PRD/plan/state 对齐、当前工作区恢复风险与 Token 索引。
---

# Evolution Readiness Audit

## 何时使用

- 首次接入自我演化前
- `.automate` 更新后，确认 `.cursor/automate` 是否同步
- Automations 长时间运行后，怀疑项目像旧版流程一样发生漂移
- 管理员需要给某个目标项目打分（0-100）并列出修复优先级

本 skill 只做检查和报告，**默认不修改文件**。如需修复，交给 `doc-bootstrap`、`install.sh` 或人工确认后的常规编辑流程。

## 输入

目标项目根目录。默认在当前仓库根目录执行。

## 检查步骤

### 1. 部署版本与运行时漂移

读取：

- `.automate/` 是否存在
- `.cursor/automate/VERSION` 是否存在
- `.cursor/automate/sop/self-evolution.md`
- `.cursor/automate/sop/self-evolution-github.md`
- `.cursor/agents/evolution-*.md`

判定：

| 状态 | 结论 |
|------|------|
| 缺少 `.cursor/automate/VERSION` | `WARN: runtime version unknown`，提示重新执行 `bash .automate/install.sh` |
| `.automate` 存在且 `VERSION automate_rev` 不等于 `.automate` 当前 HEAD | `WARN: deployed automate drift` |
| `.cursor/automate/templates/evolution-state.md` 缺失 | `FAIL: old runtime` |
| GitHub 流程仍出现 `next: evolution-pr-finisher` | `FAIL: old P4 next contract` |
| G2 仍出现 `next: designer` 或 `next: bounded-explorer` | `FAIL: old G2 next contract` |
| GitHub orchestrator 仍写 `G1–G4` | `WARN: old wording` |

### 2. 治理文档完整性

检查：

- `docs/automate/goal.md`
- `docs/automate/prd.md`
- `docs/automate/evolution-state.md`
- `docs/automate/plan.md`（可选）
- `docs/automate/prd/`（hub+分片项目）

判定：

| 状态 | 结论 |
|------|------|
| goal 缺失 | `FAIL: no goal` |
| prd 缺失 | `FAIL: no prd` |
| prd 是单文件旧格式 | `WARN: legacy prd` |
| evolution-state 缺失 | `FAIL: no state ledger` |
| plan 缺失 | `INFO: no external milestone plan`，不扣硬分 |

### 3. `evolution-state.md` 结构与恢复能力

必须包含：

- `## 当前轮次`
- `## 待办池`
- `## 模块地图`
- `## 项目技能规则索引`
- `## 上次扫描摘要`
- `## 选题卡住计数（连续未过 90 的功能项）`

`当前轮次` 必须至少含字段：

- `phase`
- `round_target`
- `design`
- `plan`
- `branch`
- `base_branch`
- `prd_ids`
- `pr_number`
- `last_verified_command`
- `last_verified_exit_code`

判定：

| 状态 | 结论 |
|------|------|
| 缺章节 | `WARN: state ledger needs migration` |
| `phase` 非 `idle` 但缺 `branch/base_branch/prd_ids` | `FAIL: active run is not resumable` |
| 工作区 dirty 且 `当前轮次` 无 branch/phase | `FAIL: dirty worktree without run ledger` |
| `项目技能规则索引` 为空 | `WARN: token cache missing` |

### 4. 项目 skill / rule 索引与 Token 风险

扫描路径（只读 frontmatter / 文件头，禁止全文读大型资料）：

- `.agents/skills/*/SKILL.md`
- `.cursor/skills/*/SKILL.md`
- `.cursor/rules/*.mdc`

检查 `docs/automate/evolution-state.md` 的 `项目技能规则索引` 是否覆盖这些路径。若缺失或明显过旧，标记：

```text
WARN: skill/rule index stale; P2 should refresh before P3
```

建议索引格式：

```markdown
| 类型 | 路径 | globs | 摘要 | 更新时间 |
|------|------|-------|------|----------|
| skill | .agents/skills/<ui-design-skill>/SKILL.md | src/** | UI/设计系统约束 | 2026-06-24 |
| rule | .cursor/rules/prd-sync.mdc | alwaysApply | PRD/plan/state 同步规则 | 2026-06-24 |
```

### 5. PR / 分支恢复风险

检查：

- 当前分支
- `git status --short`
- 最近 5 条提交
- 可用时检查 open PR（平台 MCP 不可用则记录 `SKIPPED`）

判定：

| 状态 | 结论 |
|------|------|
| 有 open PR | `BLOCK: G0 should handle PR before new evolution` |
| dirty worktree + state 可恢复 | `WARN: resume existing run before new topic` |
| dirty worktree + state 不可恢复 | `FAIL: manual recovery required` |
| clean 且 state `phase=idle` | `PASS` |

## 评分口径（100 分）

| 维度 | 分值 |
|------|-----:|
| 部署版本与运行时一致 | 20 |
| 治理文档完整性 | 20 |
| state ledger 可恢复性 | 20 |
| PR/分支门控可控性 | 15 |
| 项目 skill/rule Token 索引 | 15 |
| 外置提示词与项目规则质量 | 10 |

扣分参考：

- `FAIL`：每项扣 8-20 分，按阻断程度
- `WARN`：每项扣 2-6 分
- `INFO/SKIPPED`：通常不扣分，除非关键能力长期不可见

分数解释：

| 分数 | 含义 |
|------|------|
| 95-100 | 可无人值守运行，管理员只需抽检 |
| 90-94 | 可运行，但存在少量漂移或恢复盲区 |
| 80-89 | 能跑，但需要管理员定期介入 |
| 70-79 | 流程脆弱，容易中断或重复消耗 Token |
| <70 | 不建议无人值守 |

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: readiness-audit
score: 0
findings:
  - severity: FAIL | WARN | INFO
    area: deployment | docs | state | pr-gate | token | prompts
    message: ""
recommendations:
  - ""
artifacts:
  - .cursor/automate/VERSION
  - docs/automate/evolution-state.md
next: null
```

## 红线

- 不得修改目标项目文件
- 不得为了 audit 全量读取源码
- 不得在有 open PR 或 dirty worktree 时建议直接开新演化轮次
- 不得把 `.automate` 源路径当作 Automations 运行时路径
