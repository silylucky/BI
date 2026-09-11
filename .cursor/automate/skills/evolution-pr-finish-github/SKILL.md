---
name: evolution-pr-finish-github
description: >-
  自我演化 P5（GitHub）：创建 PR、合并前同步、Squash merge、结案评论、PRD 重评分、清理分支。
  由 subagent evolution-pr-finisher-github 执行。
---

# PR 收尾（P5 · GitHub）

## 何时使用

- P4 验证通过后
- SOP：`sop/self-evolution-github.md`
- 由 **subagent `evolution-pr-finisher-github`** 执行

## 工具分工

| 操作 | 工具 |
|------|------|
| 创建 PR / 读 mergeable & checks / Squash merge / 评论 / 删分支 | **GitHub MCP** |
| fetch / rebase / 解冲突 / push | **Shell git** |

**禁止** GitLab MCP；**禁止**用 Shell 直接 merge PR。

## 前置输入（编排器传入）

- `round-target` 路径（本轮演化目标）
- `design.md` / 实现计划路径（`docs/superpowers/plans/*.md`）
- 功能分支名
- **基分支** `base_branch`（功能分支切出时的分支名；PR base 须与此相同）
- 本轮触及的 **prd 功能 ID 列表**

若编排器传入不完整，先读 `docs/automate/evolution-state.md`「当前轮次」补齐；仍缺 `base_branch` 或 prd IDs 时必须 `BLOCKED`，禁止默认 `main`/`dev` 或猜测触及项。

## 目标分支规则（强制）

**PR base = 功能分支切出时的 `base_branch`。**

- P3 开功能分支时须记录 `base_branch`
- 编排器传入 P5 时一并传入
- 若未传入：**Shell git** `merge-base` / reflog 推断，或 **GitHub MCP** 读已有 PR 的 base；**禁止**默认 `dev` / `main` / `master`
- G0 处理遗留 Open PR：以 PR 上已有的 **base** 为准

## 5.1 创建 PR

- **GitHub MCP** 创建 PR，**非 Draft**
- **base branch = `base_branch`**
- title：`feat: <批量主题摘要>`
- body：**严格套用固定模板** `.cursor/automate/templates/evolution-pr-body.md`
  - 按占位符填入，**禁止增删/重排小节标题**；无内容的行填「无」
  - 「目标分支」填 `base_branch`

## 5.2 合并前同步（强制，唯一同步点）

1. **Shell git** `fetch`；**GitHub MCP** 读 PR `mergeable`、check runs
2. head 落后 base 或有冲突 → **Shell git** rebase base → 解冲突 → push（`--force-with-lease` 如需）
3. 执行 §5.5 PRD/state 对齐；若产生文档变更，commit 到 head 分支并 push
4. 重跑测试，等 check runs 绿
5. 循环直到 GitHub MCP 显示可合并；最多 **3 轮同步/检查循环**，仍不可合并或 checks 未绿则 `BLOCKED`

## 5.3 Squash merge

- **GitHub MCP** Squash merge
- 前置：可合并、无冲突、check runs 通过、非 Draft
- merge commit title：`<PR title> (#<pr_number>)`
- API 仍报冲突 → 回 5.2

## 5.4 结案评论

**GitHub MCP** 在 PR 上评论，**严格套用固定模板** `.cursor/automate/templates/evolution-closing-comment.md`：

- 三段固定：选题决策 / 子项明细 / 合并后 PRD 更新
- 按占位符填入，**禁止增删/重排小节标题**；无内容的行填「无」

## 5.5 PRD/state 对齐（合并前写入，合并后确认）

PRD、plan 勾选与 `evolution-state.md` 更新必须在 **Squash merge 前**提交到 PR head 分支，随同一 PR 合并。合并后只确认 `phase=MERGED` 与 merge sha；禁止把 PRD/state 更新作为未提交工作区改动留在 base 分支。

加载 `skills/prd-scoring`：

1. 对本轮触及的 prd 功能项 **8 维子项重评分**（0/1/2 + N/A，算维度分%与加权总分；附证据，允许降分，见 prd-scoring）
2. **hub**（`docs/automate/prd.md`）：更新 8 维总表对应行 → 刷新 **系统薄弱项汇总**（只反映当前状态，**禁止**追加历史 note）→ 修订记录追加一条并**裁剪至最近 10 条**
3. **分片**（`docs/automate/prd/F<NN>-<域>.md`）：更新 `状态`、验收标准勾选、`演化建议`
4. 写入 **`里程碑对齐`**（分片字段，见下表）
5. **plan.md 勾选同步**（见下节「plan 勾选规则」；仅更新已有 `- [ ] <prd ID>:` 行）
6. 更新 `docs/automate/evolution-state.md` 待办池（勾选已完成）
7. **STUCK 计数**（`docs/automate/evolution-state.md`「选题卡住计数」表）：触及项加权总分 `<90` → 对该 prd ID **upsert**（连续未过轮次 +1，记最近加权总分与日期）；`≥90` → **删除**该行。表结构：

   ```markdown
   ## 选题卡住计数（连续未过 90 的功能项）

   | prd ID | 连续未过轮次 | 最近加权总分 | 最近评分日期 |
   |--------|:-----------:|:-----------:|------------|
   ```
8. 更新 `docs/automate/evolution-state.md`「当前轮次」：`phase=P5_DOCS_READY`、`pr_number`、`branch`、`base_branch`、`prd_ids`、`last_verified_exit_code`
9. **禁止**修改 `docs/automate/goal.md`

Squash merge 成功后在回传 summary 中报告 `MERGED` 与 merge sha；文件内可保留 `phase=P5_DOCS_READY` 作为“随 PR 合并前已对齐”的可审计状态，禁止合并后为了改 `phase` 直接写 base。

**里程碑对齐写入规则：**

| 条件 | 动作 |
|------|------|
| 无 `docs/automate/plan.md` | `里程碑对齐` 留空 |
| 有 plan，功能项不在当前里程碑节 | 留空 |
| 有 plan，功能项属于当前节，本轮已合并 | 写入 `<节号> · 已完成 · <YYYY-MM-DD>` |

**plan 勾选规则：**

对每个本轮已合并的 prd ID（编排器传入列表）：

1. 若 `docs/automate/plan.md` 不存在 → 跳过全部 plan 更新
2. 在 plan 中查找行首匹配 `- [ ] <ID>:` 或 `- [x] <ID>:`（`<ID>` 与 plan 中字面一致）
3. 匹配 `- [ ] <ID>: <名称>` 且对应 prd 分片 `状态` 为 `已实现` → 改写为：
   ```
   - [x] <ID>: <名称>（完成于 YYYY-MM-DD）
   ```
   日期与同日写入的 prd 分片「里程碑对齐」一致（合并日）
4. 已是 `[x]` → 不修改（保留原「完成于」日期）
5. plan 中无此 ID → 跳过（**禁止**追加新行）

**plan 勾选红线：**

- **禁止**创建 plan.md
- **禁止**增删节、改 `**目标**`、增删 prd ID 行
- **禁止**将 `[x]` 改回 `[ ]`
- **禁止**修改 plan 头部说明与其他非勾选行

## 5.6 清理分支

**GitHub MCP** 删除已合并的 head 分支。

## 回传编排器

```yaml
status: DONE
phase: pr-finisher
artifacts:
  - docs/automate/prd.md
  - docs/automate/prd/<触及分片>.md
  # 本轮有 plan 勾选变更时追加：
  # - docs/automate/plan.md
summary:
  - "PR #<n> 已合并至 <base_branch>，sha <short>"
  - "prd 重评分: AUTH-006, AUTH-007"
  - "薄弱项汇总已刷新"
  - "plan 已勾选: AUTH-006, AUTH-007"   # 有勾选时；无勾选则省略本行
  - "建议人工跑 create-evolution-plan 对账"   # 仅当 prd 已实现但 plan 格式不匹配无法勾选时
next: null
```

## 红线

- **禁止**跳过合并或结案评论
- **禁止**跳过 PRD 8 维重评分
- **禁止**Squash merge 后才首次写 PRD/plan/evolution-state；这些变更必须随同一 PR 合并
- **禁止**改动 `docs/automate/goal.md`
- **禁止**创建 `docs/automate/plan.md`；**禁止**修改 plan 结构与非勾选行（勾选同步见 §5.5 plan 勾选规则）
- **禁止**在缺少 `base_branch` 或 prd IDs 时猜测合并目标/触及项
- **禁止** GitLab MCP
