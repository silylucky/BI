# 自我演化 Subagents

Cursor 只发现 **`.cursor/agents/`**。源文件在目标项目 `.automate/agents/`，经 `install.sh` 部署：

```bash
bash .automate/install.sh
```

所有 `evolution-*.md` frontmatter 统一 **`model: composer-2.5`**。

**外置提示词：** 全部 evolution-* subagent 启动时检查 `docs/automate/subagent/<agent名>.md`（目标项目内）：存在则作为项目级外置提示词读取（只能收窄/补充，不得推翻 SOP 红线与门控），不存在则静默跳过。`-github` 后缀 agent 查同名文件，不回退。

## 索引

| Agent | 作用 | 门控 | Skill | SOP |
|-------|------|------|-------|-----|
| evolution-pr-gatekeeper | 检查并处理遗留 Open PR，闸门通过前禁止开始新演化。 | G0 PR 闸门（GitLab） | evolution-pr-gate | self-evolution.md |
| evolution-pr-gatekeeper-github | GitHub 版 G0 闸门：检查 Open PR、Draft 转正并合并遗留 PR。 | G0 PR 闸门（GitHub） | evolution-pr-gate-github | self-evolution-github.md |
| evolution-doc-bootstrap | 检查并生成 goal/prd/evolution-state，缺失 prd 时扫描代码并做 8 维初评。 | G1 文档 | doc-bootstrap · prd-bootstrap · prd-scoring | 共用 |
| evolution-picker | 只读文档批量选题，结合 PRD 8 维选薄弱项，默认凑满 5 项写 round-target。 | G2 选题（**禁止扫代码**） | evolution-topic-picker · prd-scoring | 共用 |
| evolution-bounded-explorer | G2 选题不足时的有界代码探索，定向搜索并更新 evolution-state 待办池。 | G2 补足 | evolution-bounded-explore | 共用 |
| evolution-designer | 基于 round-target 在范围框定内写 design spec，无人值守不询问用户。 | P1 | evolution-design + Superpowers brainstorming | 共用 |
| evolution-planner | 基于 design.md 写完整实现计划，禁止占位符，完成后直接走 option 1。 | P2 | evolution-plan + Superpowers writing-plans | 共用 |
| evolution-implementer | 按 plan 逐任务实现代码，TDD + 双 review，固定 subagent-driven 模式。 | P3 | evolution-implement · Superpowers subagent-driven-development | 共用 |
| evolution-verifier | 完整运行测试套件验证实现，失败则 BLOCKED。 | P4 | evolution-verifier | 共用 |
| evolution-pr-finisher | 创建 PR、rebase 合并、写结案评论并刷新 PRD 8 维评分。 | P5 收尾（GitLab） | evolution-pr-finish · prd-scoring | self-evolution.md |
| evolution-pr-finisher-github | GitHub 版 P5 收尾：Squash merge、结案评论与 PRD 8 维重评。 | P5 收尾（GitHub） | evolution-pr-finish-github · prd-scoring | self-evolution-github.md |

回传 YAML 契约 → `sop/self-evolution.md` 或 `sop/self-evolution-github.md`（按 Automations 任务选用）
