---
name: evolution-pr-gate
description: >-
  自我演化 G0 PR 闸门：检查 Open PR、处理 Draft、合并遗留 PR。
  由 subagent evolution-pr-gatekeeper 执行，主 agent 只收 PASS/BLOCKED。
---

# PR 闸门（G0）

## 何时使用

- 每轮运行**第一件事**（G0）
- 由 **subagent `evolution-pr-gatekeeper`** 执行

## 执行步骤

### 1. 检查 Open PR

用 GitLab MCP 列出当前仓库 **state=open** 的 MR/PR。

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

1. 读取 PR 详情：标题、源分支、目标分支、Draft 状态、CI、`mergeable`、`has_conflicts`
2. **Draft** → 转为 **Ready for Review**（非 Draft）
3. **合并前同步**（见 `evolution-pr-finish` 5.2 同款流程）：
   - `fetch` 目标分支
   - 源分支落后 → rebase → 解冲突 → push
   - 重跑测试 / 等 CI 绿
4. CI 未通过 → 修复或 `BLOCKED`
5. 确认可合并 → **Squash merge** 至该 MR 的 **目标分支**（即功能分支切出时的基分支；**禁止**默认改为 `dev`）
6. 添加简短结案评论
7. 删除源分支
8. 确认无剩余 Open PR

### 4. 合并成功

```yaml
status: DONE
phase: pr-gatekeeper
gate: PASS
summary:
  - "已合并 PR #<n> 至 <target_branch>"
  - "sha: <short>"
next: evolution-doc-bootstrap
```

### 5. 阻塞

```yaml
status: BLOCKED
phase: pr-gatekeeper
gate: BLOCKED
blockers: ["CI 失败: <摘要>", "冲突未解: <文件>"]
next: null
```

## 红线

- 有 Open PR 时**禁止**开发新功能
- 工作区 dirty 且 state 不可恢复时**禁止**进入 G1
- Draft 须先转正再合并
- **禁止**跳过 rebase / 冲突解决
- **禁止**带着冲突合并

## 回传主 agent

只传 `gate: PASS|RESUME|BLOCKED` + `summary`（≤5 条），**禁止**贴 MCP 原始 JSON。
