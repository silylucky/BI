# 自我演化 Skills

路径：`<项目>/.cursor/automate/skills/`（由 `bash .automate/install.sh` 从 submodule 同步）。Subagent 部署后位于 `.cursor/agents/evolution-*.md`。

| Skill | Agent | 门控 | SOP |
|-------|-------|------|-----|
| [evolution-orchestrator](./evolution-orchestrator/SKILL.md) | 主 agent | 编排（GitLab） | self-evolution.md |
| [evolution-orchestrator-github](./evolution-orchestrator-github/SKILL.md) | 主 agent | 编排（GitHub） | self-evolution-github.md |
| [evolution-readiness-audit](./evolution-readiness-audit/SKILL.md) | 主 agent（人工触发） | 管理员体检 | 共用 |
| [evolution-pr-gate](./evolution-pr-gate/SKILL.md) | evolution-pr-gatekeeper | G0（GitLab） | self-evolution.md |
| [evolution-pr-gate-github](./evolution-pr-gate-github/SKILL.md) | evolution-pr-gatekeeper-github | G0（GitHub） | self-evolution-github.md |
| [doc-bootstrap](./doc-bootstrap/SKILL.md) | evolution-doc-bootstrap | G1 | 共用 |
| [prd-bootstrap](./prd-bootstrap/SKILL.md) | evolution-doc-bootstrap | prd 生成 | 共用 |
| [prd-scoring](./prd-scoring/SKILL.md) | 多个 | 8 维评分 | 共用 |
| [evolution-topic-picker](./evolution-topic-picker/SKILL.md) | evolution-picker | G2 | 共用 |
| [evolution-bounded-explore](./evolution-bounded-explore/SKILL.md) | evolution-bounded-explorer | G2 补足 | 共用 |
| [evolution-design](./evolution-design/SKILL.md) | evolution-designer | P1 | 共用 |
| [evolution-plan](./evolution-plan/SKILL.md) | evolution-planner | P2 | 共用 |
| [evolution-implement](./evolution-implement/SKILL.md) | evolution-implementer | P3 | 共用 |
| [evolution-verifier](./evolution-verifier/SKILL.md) | evolution-verifier | P4 | 共用 |
| [evolution-pr-finish](./evolution-pr-finish/SKILL.md) | evolution-pr-finisher | P5（GitLab） | self-evolution.md |
| [evolution-pr-finish-github](./evolution-pr-finish-github/SKILL.md) | evolution-pr-finisher-github | P5（GitHub） | self-evolution-github.md |

**人工交互 skill（演化流程禁止调用）：**

| Skill | Agent | 用途 | SOP |
|-------|-------|------|-----|
| [create-evolution-goal](./create-evolution-goal/SKILL.md) | 主 agent（人工触发） | 新建/体检/修订 goal.md，明确产品定位、边界与成功指标 | 共用 |
| [create-evolution-prd](./create-evolution-prd/SKILL.md) | 主 agent（人工触发） | 新建/体检/迁移/修订 PRD（hub+分片；8 维评分与 goal_ref） | 共用 |
| [create-evolution-plan](./create-evolution-plan/SKILL.md) | 主 agent（人工触发） | 新建/体检/干预/迁移 plan.md，处理里程碑、STUCK 与 SATURATED | 共用 |

**Superpowers（插件）：** brainstorming · writing-plans · subagent-driven-development

**模板：** `../templates/prd-hub.md` + `../templates/prd-feature.md` · **SOP：** `../sop/README.md`
