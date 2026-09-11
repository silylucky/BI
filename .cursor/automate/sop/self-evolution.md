# 自我演化 SOP（GitLab · Thin）

**用途**：Cursor Automations 无人值守自我演化入口。主 agent 只做状态机编排，重活全部委派 subagent。

**启动必读**：

```text
Read .cursor/automate/sop/self-evolution.md
Read .cursor/automate/skills/evolution-orchestrator/SKILL.md
```

运行时只读 `.cursor/automate/` 与 `.cursor/agents/`；`.automate/` 只作为安装源。`.cursor/automate/VERSION` 缺失或明显落后时，先重新执行 `bash .automate/install.sh`。

---

## GitLab 差异

- G0/P5 使用无平台后缀的 PR subagent：`evolution-pr-gatekeeper`、`evolution-pr-finisher`。
- **Shell git** 负责 checkout、branch、commit、fetch、rebase、push。
- **GitLab MCP** 负责 MR/PR 查询、创建、Draft 转正、CI/mergeable 查询、Squash merge、评论、删分支。
- **禁止** GitHub MCP；**禁止** Shell 直接 merge MR/PR；**禁止** GitLab MCP 做本地 rebase。
- MR/PR target 必须等于 P3 记录的 `base_branch`，禁止默认 `main` / `dev` / `master`。

细节以 `skills/evolution-pr-gate/SKILL.md` 与 `skills/evolution-pr-finish/SKILL.md` 为准。

---

## 状态机

```text
G0 evolution-pr-gatekeeper
  → G1 evolution-doc-bootstrap
  → G2 evolution-picker
  → [evolution-bounded-explorer 若 G2 不足 3 项后回 G2]
  → P1 evolution-designer
  → P2 evolution-planner
  → P3 evolution-implementer
  → P4 evolution-verifier
  → P5 evolution-pr-finisher
```

固定纪律：

- 有 Open PR/MR 时只处理 PR/MR，禁止进入 G1-P4。
- writing-plans 完成后固定 `subagent-driven-development (option 1)`，不询问用户。
- `BLOCKED` 立即结束本轮，等待下次触发；禁止跳门控继续。
- 工作区 dirty 时，先读 `docs/automate/evolution-state.md`「当前轮次」；可恢复则续跑对应阶段，不可恢复则 `BLOCKED: dirty worktree without run ledger`。

---

## 门控

| 门控 | 通过条件 | 未通过 |
|------|----------|--------|
| G0 | 无 Open PR/MR 且工作区干净；或遗留 PR/MR 已合并；dirty 但 state 可恢复则 `gate: RESUME` | 停止，只处理 PR/MR；state 不可恢复则 BLOCKED |
| G1 | `docs/automate/goal.md`、`prd.md`、`evolution-state.md` 就绪；`plan.md` 可选只读 | 委派 doc-bootstrap |
| G2 | `round-target.md` 已写，3-5 项，每项有 prd ID、8 维分、范围框定 | 禁止进入 P1 |
| P1 | design.md 覆盖全部 round-target，范围框定内 | 禁止写生产代码 |
| P2 | `docs/superpowers/plans/*.md` 无占位符，任务可执行 | 禁止进入 P3 |
| P3 | 每任务 Spec review + Quality review 通过，本地测试通过 | 禁止进入 P4 |
| P4 | 完整验证 exit_code = 0 | 禁止建 PR/MR |
| P5 | PRD/state 对齐及已有 plan 勾选已完成，PR/MR 已合并 | 本轮结束 |

前端 UI 附加门控仅在本轮触及目标项目前端 UI 文件时启用：

- P1 匹配并读取目标项目真实存在的 UI/设计系统 skill；无匹配则记录 `ui_design_skill: none` 并使用通用 UI 质量基线。
- P2 相关 Task 写明 **Skills** / `UI skill: none` 与 **UI Acceptance**。
- P3 完成可用的设计 drift 检查和截图 QA，或记录不可运行原因。
- P4 把 UI 验证结果纳入通过判定。

纯后端、CLI、脚本项目不触发前端 UI 门控。

---

## 阶段职责

| 阶段 | Subagent | Skill | 关键产出 |
|------|----------|-------|----------|
| G0 | `evolution-pr-gatekeeper` | `evolution-pr-gate` | `gate: PASS/RESUME/BLOCKED` |
| G1 | `evolution-doc-bootstrap` | `doc-bootstrap` | `docs/automate/*` 就绪 |
| G2 | `evolution-picker` | `evolution-topic-picker` | `docs/superpowers/evolution/*-round-target.md` |
| 探索 | `evolution-bounded-explorer` | `evolution-bounded-explore` | 待办池补充，回 G2 |
| P1 | `evolution-designer` | `evolution-design` + brainstorming | `docs/superpowers/specs/*-design.md` |
| P2 | `evolution-planner` | `evolution-plan` + writing-plans | `docs/superpowers/plans/*.md` |
| P3 | `evolution-implementer` | `evolution-implement` + subagent-driven-development | 代码、测试、`base_branch` |
| P4 | `evolution-verifier` | `evolution-verifier` | `next: platform-pr-finisher` |
| P5 | `evolution-pr-finisher` | `evolution-pr-finish` + `prd-scoring` | PR/MR 合并、PRD/state 对齐 |

`platform-pr-finisher` 在 GitLab 流程中固定映射到 `evolution-pr-finisher`。

---

## 细则索引

为节省启动 token，本 SOP 不展开下列细则；进入对应阶段再读：

- 文档治理、旧路径硬切换、state 模板：`skills/doc-bootstrap/SKILL.md`
- PRD 8 维评分：`skills/prd-scoring/SKILL.md`
- 选题顺序、饱和熔断、STUCK 标记、批量规则：`skills/evolution-topic-picker/SKILL.md`
- 有界探索预算：`skills/evolution-bounded-explore/SKILL.md`
- P1-P4 具体执行与 UI 门控：`skills/evolution-design|plan|implement|verifier/SKILL.md`
- GitLab G0/P5 PR 规程：`skills/evolution-pr-gate/SKILL.md`、`skills/evolution-pr-finish/SKILL.md`

每个 `evolution-*` subagent 启动时可读取 `docs/automate/subagent/<agent名>.md`。外置提示词只能收窄/补充，不能推翻 SOP 红线与阶段 skill。

---

## 回传契约

Subagent 只回传 YAML 摘要，禁止贴源码全文、完整测试日志、MCP 原始 JSON。

```yaml
status: DONE | BLOCKED | DONE_WITH_CONCERNS
phase: <阶段名>
artifacts: [<路径>]
summary: [<≤5 条>]
blockers: []
next: <下一阶段 subagent 名> | null
```

---

## 红线

- 禁止有 Open PR/MR 时新开发。
- 禁止主 agent / evolution-picker 扫代码选题。
- 禁止跳过 brainstorming、writing-plans、双 review、完整验证。
- 禁止 Automations 向用户提问或等待确认；需要人工时输出 `BLOCKED`。
- 禁止修改已存在的 `docs/automate/goal.md`。
- 禁止创建 `docs/automate/plan.md`；P5 只能勾选已有 `- [ ] <prd ID>:` 行，禁止改结构。
- 禁止未验证就建 PR/MR；禁止跳过 rebase/冲突解决；禁止 Draft PR/MR 遗留。
- 禁止 PR/MR 合并到与 `base_branch` 不一致的目标分支。
- 禁止合并后不更新 PRD 8 维评分与 `evolution-state.md`。
- 禁止 G0/P5 委派 `-github` 后缀的 PR subagent。
