# Fleet Mode（学习 go-fast）

当 Primary Target 很多时，单工作区宿主常把并发锁在很小的窗口（例如 8）。OCR Fleet 对齐 go-fast：**worktree 分片 + 同波多 shard-controller**，把产品并发上限抬到 `fleet_cap`（默认 **20**）。

## 何时启用

- `start` 后若目标数 ≥ 16，返回 `next_action=fleet_plan_then_worktree_shards` 与 `fleet_recommendation`。
- 用户要求尽快扫完 / 明确要高并发时，**优先 fleet**，不要在单窗把剩余 lease 一律标成 `host_capacity` rejected。

## Controller 流程

```text
start
  → fleet-plan --fleet-cap 20
  → 为每个 shard: git worktree add .worktrees/ocr-fleet-shard-NN -b ocr-fleet/shard-NN
  → 同波：对每个 shard fleet-shard-open --repo <worktree>
  → 同波：派出 ≤20 个 shard-controller subagent（cwd=对应 worktree）
  → 每个 shard-controller 在子 session 上跑 orchestrate-tick 循环（concurrency=max）
  → 父 session fleet-status 直到 all_shards_terminal
  → fleet-merge → dedup-plan → dedup-verify* → finalize → fleet-cleanup
  → 自动：finalize 成功后删除本批 .worktrees/ocr-fleet-* 与 ocr-fleet/* 分支（可用 --no-fleet-cleanup 跳过）
```

## 命令

```text
ocr_review.py fleet-plan --session <parent> [--fleet-cap 20]
ocr_review.py fleet-shard-open --session <parent> --shard shard-01 --repo <worktree-abs>
ocr_review.py fleet-status --session <parent>
ocr_review.py fleet-merge --session <parent> [--partial]
ocr_review.py fleet-cleanup --session <parent> [--partial] [--keep-worktrees]
```

`fleet-cleanup` 在 `fleet-merge` 之后、`finalize` 之后执行（`finalize` 默认会自动调用；调试可用 `finalize --no-fleet-cleanup` 保留 worktree）。仅删除本 session fleet plan 登记的 worktree 与 `ocr-fleet/*` 分支；merge 未完成或 `abort` 时**禁止**清理。

## Worktree 约定

目录优先级与 go-fast 相同：`.worktrees/`（须 gitignore）→ `worktrees/`。

```bash
git check-ignore -q .worktrees || echo ".worktrees/" >> .gitignore
git worktree add ".worktrees/ocr-fleet-shard-01" -b "ocr-fleet/shard-01"
```

已在 linked worktree 内时不要再叠套；改为缩小 `fleet_cap` 或串行 shard。

## 三层防护（防子 session 混入全仓任务）

### 第一层：Controller 纪律

| 步骤 | 必须 | 禁止 |
|---|---|---|
| `start` 后目标 ≥16 | 先 `fleet-plan` | 单窗 bulk `host_capacity` 后放弃 |
| 开 shard | 只用 `fleet-shard-open` 返回的 `session_dir` | 在 worktree 里 `init --mode scan` |
| 派 subagent 前 | `fleet-preflight` + `status` 验收 pending ≈ `primary_tasks` | 不验就派 reviewer |
| 父 session | 仅 `fleet-status` / `fleet-merge` | 父 session `orchestrate-tick` |

**shard-controller 提示词固定字段：**

```text
父 session（只读）: <parent_session_dir>
子 session（唯一可写）: <fleet-shard-open.session_dir>
shard_id / 预期 primary_tasks: <opened.primary_tasks>
禁止: init、对父 session tick/submit/complete
开跑前: fleet-preflight 必须 ok=true
```

### 第二层：开跑门禁（程序 + 人工）

```text
fleet-shard-open → fleet-preflight --session <child>
```

通过标准：

- `fleet_preflight.ok == true`
- `actual_tasks == expected_tasks`（约为 全量/fleet_cap）
- 子 session 含 `fleet_shard_id` + `parent_session_id`

不通过 → `abort` 子 session，重新 `fleet-shard-open`；**禁止派 reviewer**。

`fleet-status` 会在每个 shard 条目附带 `fleet_preflight`；`status` 亦返回当前 session 的 `fleet_preflight`。

### 第三层：程序硬闸（`ocr_review.py`）

| 错误码 | 触发 |
|---|---|
| `FLEET_PARENT_DISPATCH_FORBIDDEN` | 父 session 已有 `fleet/plan.json` 仍 `orchestrate-tick` |
| `FLEET_SHARD_CONTAMINATION` | 子 session 任务数 ≠ `shard.json` 预期 |
| `FLEET_WORKTREE_INIT_FORBIDDEN` | 在 `ocr-fleet-*` worktree 内 `init`（除非 `--allow-fleet-worktree-init` 测试开关） |
| `fleet_recommendation` on bulk reject | 单窗 rejected ≥50 且 Primary ≥16 时，`orchestrate-report` 强制 `next_action=fleet_plan_then_worktree_shards` |

## 并发模型

| 层 | 含义 |
|----|------|
| `fleet_cap` | 同波最多多少个 **shard-controller**（默认 20，>20 须用户预授权） |
| shard 内 `concurrency=max` | 该 worktree 内再请求全部 runnable；宿主拒绝后学习该窗 `host_capacity` |
| 总吞吐 | 约 `opened_shards × 单窗容量`，而不是单窗 8 |

审查只读：worktree 主要用于 **隔离 Cursor agent 容量**，不是为了并行改代码。

## 父 / 子 session

- 父 session：任务编排真相源；打开 shard 后对应任务状态变为 `fleeted`，父级不再 dispatch 它们。
- 子 session：只含该 shard 的任务；独立 `orchestrate-tick` / submit / complete。
- `fleet-merge`：把子 session 终态与 `findings/` 拷回父 session，再走统一 dedup/finalize。
- `fleet-cleanup`：`fleet-merge` 且结果已落盘后，删除本批 `git worktree` 与 `ocr-fleet/*` 分支；`finalize` 默认自动执行。

## Worktree 清理（强制）

| 时机 | 行为 |
|---|---|
| `fleet-merge` 全部完成 → `finalize` | **自动** `fleet-cleanup`（删除 plan 登记的 worktree + 分支） |
| 仅需手动清理 | `fleet-cleanup --session <parent>` |
| 调试 / 保留现场 | `finalize --no-fleet-cleanup` 或 `fleet-cleanup --keep-worktrees` |
| merge 未完成 / `abort` | **禁止**清理；worktree 保留作证据 |

清理范围仅限 fleet plan 中 `worktree` / `worktree_name` + `branch_name`（须匹配 `ocr-fleet/` 前缀）；不删子 session 目录（`fleet/shards/*/session` 仍保留 findings 审计链）。

## 红线

- 禁止在单窗 saturate 后把未尝试的上千个 lease 批量写成 `host_capacity` 拒绝，却不转 fleet。
- 禁止同波超过 `fleet_cap` 且无用户授权。
- 禁止 shard-controller 改写其他 shard 的路径或父 session 文件（只通过 CLI 写自己的 child session）。
- merge 前不要对父 session `finalize`。
- 沙箱拒绝建 worktree → 缩小 `fleet_cap` 或单窗滚窗，并在 status 写明降级。
