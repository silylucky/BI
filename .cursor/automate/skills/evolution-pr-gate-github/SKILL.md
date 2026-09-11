---
name: evolution-pr-gate-github
description: >-
  自我演化 G0 PR 闸门（GitHub）：检查 Open PR、处理 Draft、合并遗留 PR。
  由 subagent evolution-pr-gatekeeper-github 执行，主 agent 只收 PASS/BLOCKED。
---

# PR 闸门（G0 · GitHub）

## 何时使用

- 每轮运行**第一件事**（G0）
- SOP：`sop/self-evolution-github.md`
- 由 **subagent `evolution-pr-gatekeeper-github`** 执行

## 工具分工

| 操作 | 工具 |
|------|------|
| 列 PR / 读详情 / Draft 转正 / Squash merge / 评论 / 删分支 | **GitHub MCP** |
| fetch / rebase / 解冲突 / push | **Shell git** |

**禁止** GitLab MCP；**禁止**用 Shell 直接 merge PR。

## 执行步骤

### 1. 检查 Open PR

用 **GitHub MCP** 列出当前仓库 **state=open** 的 PR。

### 2. 无 Open PR

继续前检查本地恢复风险：

1. 运行 `git status --short`
2. 若工作区干净 → `PASS`
3. 若工作区 dirty → Read `docs/automate/evolution-state.md`「当前轮次」
4. 若 `phase/branch/base_branch/prd_ids` 足以判断上一轮进度 → 回传 `DONE_WITH_CONCERNS` + `gate: RESUME`，summary 标明续跑阶段，禁止开新题
5. 若无法从 state 可靠恢复 → `BLOCKED: dirty worktree without run ledger`

```yaml
status: DONE
phase: pr-gatekeeper
gate: PASS
summary: ["无 Open PR，可进入自我演化"]
next: evolution-doc-bootstrap
```

可恢复 dirty 工作区：

```yaml
status: DONE_WITH_CONCERNS
phase: pr-gatekeeper
gate: RESUME
summary: ["检测到未收尾轮次 phase=<phase>，继续 <next>，禁止开新题"]
next: <对应阶段 subagent>
```

### 3. 存在 Open PR — 仅处理合并，严禁新开发

**禁止**进入自我演化、P1–P4、开新分支。

按序执行：

1. **GitHub MCP** 读 PR 详情：标题、head/base 分支、Draft 状态、check runs、`mergeable`
2. **Draft** → **GitHub MCP** 转为 **Ready for review**
3. **合并前同步**（见 `evolution-pr-finish-github` 5.2 同款流程）：
   - **Shell git** `fetch` base 分支
   - head 落后 → rebase → 解冲突 → push（`--force-with-lease` 如需）
   - 重跑测试 / 等 check runs 绿
4. 同步/检查循环最多 **3 轮**；仍不可合并、checks 仍未通过或冲突仍存在 → `BLOCKED`
5. check runs 未通过 → 修复或 `BLOCKED`
6. 若 PR 是自我演化 PR（满足任一：body 使用 `.cursor/automate/templates/evolution-pr-body.md` 模板、包含 `docs/superpowers/evolution/` round-target、或 body/标题列出 prd ID）→ 在合并前执行「遗留 PR 文档同步」（见下），commit 到 head 分支并 push，然后回到合并前同步
7. 确认可合并 → **GitHub MCP Squash merge** 至 PR 的 **base 分支**（功能分支切出时的基分支；**禁止**默认改为 `dev` / `main`）
8. **GitHub MCP** 添加简短结案评论
9. **GitHub MCP** 删除 head 分支
10. 确认无剩余 Open PR

### 3.1 遗留 PR 文档同步（自我演化 PR 必做）

G0 合并遗留自我演化 PR 前，仍必须闭合 P5 的文档账本，禁止只合并代码就放行下一轮：

1. 从 PR body、`docs/automate/evolution-state.md`「当前轮次」、round-target 路径或 PR 变更文件中提取本轮 `prd_ids`、`round_target`、`base_branch`
2. Read `skills/prd-scoring/SKILL.md`
3. 按 `evolution-pr-finish-github` §5.5 同款规则完成，并 commit/push 到 PR head：
   - 触及项 PRD 8 维重评
   - hub 薄弱项汇总刷新
   - 分片状态、验收标准、`里程碑对齐`
   - plan 勾选同步（仅已有 `- [ ] <prd ID>:` 行）
   - `docs/automate/evolution-state.md` 待办池、STUCK 计数、`当前轮次 phase=P5_DOCS_READY`、`pr_number`
4. 无法可靠提取 prd IDs 或 round-target → `BLOCKED`，提示人工检查 PR body / evolution-state；禁止猜测后放行

### 4. 合并成功

```yaml
status: DONE
phase: pr-gatekeeper
gate: PASS
summary:
  - "已合并 PR #<n> 至 <base_branch>"
  - "sha: <short>"
next: evolution-doc-bootstrap
```

### 5. 阻塞

```yaml
status: BLOCKED
phase: pr-gatekeeper
gate: BLOCKED
blockers: ["check runs 失败: <摘要>", "冲突未解: <文件>"]
next: null
```

## 红线

- 有 Open PR 时**禁止**开发新功能
- 工作区 dirty 且 state 不可恢复时**禁止**进入 G1
- Draft 须先转正再合并
- **禁止**跳过 rebase / 冲突解决
- **禁止**带着冲突合并
- **禁止**合并自我演化 PR 后跳过 PRD/plan/evolution-state 同步
- **禁止** GitLab MCP

## 回传主 agent

只传 `gate: PASS|RESUME|BLOCKED` + `summary`（≤5 条），**禁止**贴 MCP 原始 JSON。
