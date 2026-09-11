# Session and Lifecycle

## 所有权与存储

Controller 只编排、聚合和展示，不加载全部文件正文，也不代替 reviewer。每个 Primary Target 对应一个独占 reviewer context；每个 verifier action 对应一个新的独立 verifier context。

Session 默认保存在 Git 私有目录，不污染工作树：

```text
<git-dir>/ocr-code-review/sessions/<session-id>/
  session.json
  manifest.json
  tasks/<task-id>.json
  findings/<task-id>/<finding-id>.json
  dedup/candidates/<candidate-id>.json
  checkpoints/<task-id>.json
  result.json
  result.md
  result.partial.json
  _partial_summary.md
  fix-queue.json
  fix-queue.md
  results/findings-0001.json
  results/findings-0001.md
```

Reviewer 不直接编辑这些文件，只通过 CLI 提交。所有写状态命令使用跨进程 Session 锁和原子 UTF-8 JSON/Markdown 替换，避免并发 lost update 与 BOM/终端编码漂移。

## Session 启动闸门

```text
init → awaiting_start（launch_menu + composition + token_estimate 已就绪）
    → start（或 init --yes）→ running
```

在 `awaiting_start` 时禁止 `orchestrate-tick` / `dispatch-next`；Controller 必须先把菜单与 token 预估展示给用户。`abort` 允许从 `awaiting_start` 退出。

## Task 生命周期

```text
pending/stale/interrupted/checkpointed
  → leased → running
  → complete
  → task-fail → interrupted → retry
  → 连续失败 3 次 → blocked + material Blind Spot

pause: running 保持 running，不派新任务
abort: running → orphaned；runnable → aborted；session_epoch + 1
```

只有 running 可 `submit`、`checkpoint`、`complete` 或 `task-fail`。`complete` 校验 Coverage 后立即释放 reviewer 槽；其待验证 Finding 由独立 verifier queue 接管。

`task-plan` 先验证全部输入再写状态。同一个 plan hash 重放返回 `skipped_same_plan`；任务已不在 pending/stale 时若出现不同 plan，返回 `PLAN_CONFLICT`，Controller 只调和该文件，不能让整波调度崩溃。

## 租约与 epoch

`orchestrate-tick` 根据目标并发原子申请工作，action 包含 `lease_id`、`session_epoch` 与 `expires_at`。创建 context 后必须用相同租约 ACK，并通过 `orchestrate-report` 完整报告本轮接受/拒绝结果；未 ACK 的拒绝或过期租约会回收。Verifier 优先于 reviewer，并在 backlog 存在时保留 verifier 容量。

`abort` 增加 `session_epoch`，之后旧 epoch、旧租约或 orphan reviewer 的 submit/verify/complete 均被拒绝。这样“用户停止”是机器可执行状态，而不是一份不受约束的说明文件。

兼容命令 `dispatch-next/capacity-report` 和 `orchestrate-tick --available-slots` 仍保留，但新 Controller 只应使用 `orchestrate-tick` + `orchestrate-report`，避免手工槽位猜测与 probe 状态机执行漂移。

## Pause、Abort 与 Resume

- `pause --reason`：停止新派发，允许在途 reviewer checkpoint/complete/fail；`resume` 不把 pause 前仍运行的 context 误判为 orphan。
- `abort --reason`：拒绝新派发、验证和 finalize，清理租约并生成权威 partial result、partial summary 与 partial fix queue。重复 abort 幂等。
- `resume`：重新计算 Primary Target、规则、协议、Requirement 和已记录 Context Evidence 指纹。变化项变为 stale，旧 Finding superseded，必须重新审查；非 pause 的 orphan running 记一次失败后进入重试。

Checkpoint 只用于大文件分段、上下文压力、宿主中断或外部依赖暂不可用。它必须包含已覆盖符号/范围、Finding ID、被否定 Candidate、待解决问题、下一动作和 task input hash。

## Finding 与去重门禁

顺序是：结构校验 → 程序严格同项去重 → 选择性 Finding verifier → confirmed Finding → 新鲜度检查 → `dedup-plan` → 独立 `dedup-verify` → canonical 发布视图。

普通 verifier backlog 非零时，Finalizer 返回 `VERIFIER_PENDING`。语义重复候选未验证时返回 `DEDUP_VERIFIER_PENDING`。两者都是硬门禁，不生成可误解为完成的最终结果。

语义去重只压缩发布视图，`findings/` 中原始 confirmed Finding 永不修改或删除。结果计数分层：

- `confirmed_finding_count`：新鲜 confirmed 原始 Finding 数。
- `published_issue_count`：验证归并后的 canonical 问题数，也是 `finding_count`。
- `duplicate_count`：发布视图折叠的 occurrence 数；满足 `confirmed_finding_count = published_issue_count + duplicate_count`。

## 输出与分片

`result.md` 是可独立交付入口，固定包含 `Run summary → Coverage → Findings summary → Severity → 去重/Findings 或 Highest-priority preview → 分片索引 → incomplete/Blind Spot → Audit artifacts`。

Finalizer 以 UTF-8 序列化后的 JSON/Markdown 实际字节数判断：均不超过 512 KiB 时为 `output_mode=inline`，`findings_complete=true`。任一超出时为 `output_mode=sharded`：

- `stdout`、`result.json`、`result.md` 只保留聚合摘要、最多 20 条 `finding_preview` 和完整 `finding_shards` 索引。
- 全量证据写入 `results/findings-NNNN.json/.md`；例如 `results/findings-0001.json`。
- 单个 Finding 超限时独占分片并标记 `oversized=true`，不截断证据。
- 重复 finalize 会清理不再使用的旧分片。

Finalizer 同时生成 `fix-queue.json/.md`，包含 verified canonical issues、位置、impact surface、最小 fix scope 和依赖，状态统一为 pending。它不修改源码；`export-fix-queue` 可从 final 或 partial result 幂等重建队列。

## 进度与完成语义

`status` 默认返回 compact summary：task counts、running/runnable、并发窗口和 `verifier_backlog`；`--verbose` 才包含逐任务详情。`heartbeat` 按终态增量或时间间隔限流。

- `completion_status=complete`：所有活动 Primary Target 合法终态，普通与 dedup verifier 已结束，无 stale Finding。
- `assurance=limited`：存在 material Blind Spot 或 session aborted。
- `clean=true`：仅当 complete、零 confirmed Finding、零 material Blind Spot。
- `completion_status=partial` 或 `assurance=limited` 时禁止使用 clean 措辞。
