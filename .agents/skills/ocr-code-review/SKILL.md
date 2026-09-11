---
name: ocr-code-review
description: Use when reviewing a diff, branch, merge request, workspace changes, or an explicitly requested repository scan for confirmed code defects with auditable scope, isolated reviewers, precise locations, and resumable execution; triggers include code review, CR, OCR review, 审查改动, 全仓扫描, and scan repository.
---

# OCR Code Review

## 核心模型

以 Primary Target 为唯一可报告对象，以 Context Evidence 为按需证据。模型负责理解语义、提出并反证 Bug；程序负责范围、规则、指纹、位置、租约、生命周期、去重和输出。

本 Skill **只审查，不修改源码**。`fix-queue.json/.md` 只是给后续修复流程的输入。

## 入口与启动闸门（强制）

- 用户只说“code review / OCR”而没有指定范围：默认 `review --workspace`，并提示“当前审查工作区改动；全仓扫描需显式指定”。不要默认启动全仓扫描。
- diff、分支、MR、base/head：使用 `review`。
- 用户明确说全仓、全部代码或 repository scan：使用 `scan`。
- 明确要求上线就绪、产品完整性、假绿或外部集成：使用 `production-readiness`；其他情况默认 `correctness`。

显式 `scan` 默认 `runtime-code`；用户强调应用/包时用 `apps-packages`，明确连文档和工具脚本都扫时用 `full`。

**禁止在用户确认启动菜单之前创建任何 reviewer/verifier subagent。**

1. 先 `init`（不要加 `--yes`）。程序返回 `status=awaiting_start`、`launch_menu`（含各选项预算对比与 `how_to_reply`）、`composition`、`token_estimate`。
2. **立刻**按 `launch_menu.display_template`（或等价表格）展示：当前选项、**每个选项的 Primary Targets / Likely tokens**、以及如何回复。禁止只展示当前 session 预算却省略全仓选项。
3. 用户回复格式：`<选项ID>` 或 `<选项ID> <并发>`，例如 `workspace-review`、`scan-runtime max`；也可 `保持默认，开始`。
4. 若选项 `matches_current_session=true`：调用 `start --session ... --choice <id> [--concurrency ...]`。
5. 若选项不同模式/范围：不要对本 session `start`；用该选项的 `reinit_if_different_session` 新建 session。
6. 只有确认后才允许 `orchestrate-tick`。用户明确说“直接开始”时可用 `init --yes`。

默认并发是 **`max`**：第一轮请求全部 Primary Target。`auto` 同样首轮全量，宿主拒绝后再收敛；固定 `N` 仅调试。**15 不是并发上限**——它只是饱和后的再探测步长。Controller 不得人为停在 15。

目标很多时（≥16）**必须走 Fleet**（学习 go-fast）：`fleet-plan` → 每 shard 一个 worktree → 同波最多 **20** 个 shard-controller → 各窗内再 `max`。详见 [fleet-mode.md](references/fleet-mode.md)。禁止单窗 saturate 后把未尝试目标批量标成 `host_capacity` 拒绝却不转 fleet。

## 执行前必读

Controller 必须读：

1. [controller-runbook.md](references/controller-runbook.md)
2. [session-lifecycle.md](references/session-lifecycle.md)
3. [rules.md](references/rules.md)
4. [coverage-routing.md](references/coverage-routing.md)
5. 按模式读 [review-mode.md](references/review-mode.md) 或 [scan-mode.md](references/scan-mode.md)
6. 目标很多 / 要高并发时读 [fleet-mode.md](references/fleet-mode.md)

创建 reviewer 前还要读 [reviewer-protocol.md](references/reviewer-protocol.md) 和 [finding-contract.md](references/finding-contract.md)。收到 verifier action 时再读 [verifier-protocol.md](references/verifier-protocol.md)。

## 运行时

使用随 Skill 安装的 `scripts/ocr_review.py`；只依赖 Python 3 标准库。先探测 `python3`、`python`、Windows `py -3`，再运行：

```text
<python3> <skill-root>/scripts/ocr_review.py --help
```

没有 Python 3 时返回 `BLOCKED`。所有命令只输出 UTF-8 JSON；只按 `error` 和 `next_action` 推进，不用聊天文本代替状态写入。

## Controller 主循环

1. `init` → 展示 `launch_menu` + composition + token 预估；**等待用户**。`start` 确认后写入 Stack Card；幂等 `task-plan` 挂载维度。
2. 反复调用不带槽位猜测的 `orchestrate-tick`。默认 `max`/`auto` 首轮请求全部 runnable 目标；宿主拒绝后学习 `host_capacity`。目标很多时改走 **Fleet**（`fleet-plan` / worktree / ≤20 shard-controller），不要死磕单窗。父 session 有 fleet plan 后**禁止** tick；子 session 开跑前必须 `fleet-preflight` 通过（见 [fleet-mode.md](references/fleet-mode.md) 三层防护）。
3. 对每个 action 尝试创建新的独占 context。创建成功后，Reviewer 用 `task-start --lease` ACK，verifier 用 `verifier-start --lease` ACK；随后把本轮所有接受/拒绝项一次性写入 `orchestrate-report`。
4. Reviewer 只审一个 Primary Target，按需调用 Cursor 原生 Read/Search/Grep/Git/Shell。Controller 不顺手审小文件，不复用 reviewer context。
5. 证据闭环才 `submit`。Reviewer 提交 `existing_code`，程序校正 path/line/fingerprint；模型提供的路径和行号不受信任。
6. Reviewer 提交 Coverage 后调用 `complete`，立即释放 reviewer 槽位；待验证 Finding 留在 verifier backlog。下一次 tick 优先 verifier。
7. 所有 reviewer 和 Finding verifier 完成后执行 `dedup-plan`，再由独立 context 逐候选 `dedup-verify`。
8. 调用 `finalize`（Fleet 扫描默认在 finalize 后自动 `fleet-cleanup` 删除 worktree；调试可用 `--no-fleet-cleanup`）。遇到 `VERIFIER_PENDING` 或 `DEDUP_VERIFIER_PENDING` 必须继续排空，不能发布 partial 冒充最终结果。
9. 自动向用户展示一次最终摘要与 `result.md` 路径；不要把全部分片重新读回上下文。

## 中止、恢复与进度

- 用户说“暂停”：立即 `pause --reason ...`；`resume` 后继续。
- 用户说“停止/取消”：立即 `abort --reason ...`。程序提升 `session_epoch`、拒绝 orphan 写入并生成 partial 结果。
- 长扫描默认静默运行；用 `heartbeat` 每 50 个完成项或 5 分钟输出一条聚合进度。
- `status` 默认只取一行 summary；诊断才用 `status --verbose`。
- 会话或上下文中断后先 `resume`。指纹变化时重新审查，不复用旧结论。

## 不可协商边界

- 其他文件可以作为 Context Evidence 读取，但其中与 Primary Target/当前 diff 无因果关系的历史 Bug 不得报告。
- Candidate、搜索命中、失败测试和静态规则命中都不等于 Finding；必须证明可达触发、契约差异、实际行为和实质影响。
- Finding 必须声明 `impact_surface`、`reachability`、`current_input_reproducible`；cross-file 由程序根据 `xref` 派生。
- 没有唯一 `existing_code` 锚点、证据不足、验证未结束或指纹已失效时不得发布。
- `review` 只报告与本次改动有因果关系的问题；删除导致的问题要有 deletion evidence。
- 明确测试目录 `test/tests/__tests__/spec/specs` 和标准测试命名默认不是 Primary Target，但可作为上下文；按分隔符与语言惯例识别，不按任意 `test` 子串过滤。
- 有 material Blind Spot 时不得输出 clean；clean 只能表述为“在当前范围和 OCR 规则下，没有发现已确认问题”。

## 输出

`finalize` 生成可独立交付的 `result.md`、机器可读 `result.json`、原始 `findings/`、去重审计记录和 `fix-queue.json/.md`。

结果在 512 KiB 内使用 `output_mode=inline`；超出时使用 `output_mode=sharded`，完整问题写入 `results/findings-NNNN.json/.md`，摘要只保留最多 20 条 `finding_preview` 和完整 `finding_shards` 索引。`result.md` 固定含 Run summary 与 Highest-priority preview。最终回复必须给出结论、覆盖度、三层计数、严重度预览、blocked/Blind Spot、assurance 和报告路径。

## 命令速查

```text
ocr_review.py init --repo <repo> [--mode review --workspace]
ocr_review.py init --repo <repo> --mode scan --scope runtime-code|apps-packages|full
ocr_review.py start --session <dir> [--concurrency max|auto|N] [--choice <menu-id>]
ocr_review.py fleet-plan --session <dir> [--fleet-cap 20]
ocr_review.py fleet-shard-open --session <dir> --shard shard-01 --repo <worktree>
ocr_review.py fleet-preflight --session <child-session-dir>
ocr_review.py fleet-status --session <dir>
ocr_review.py fleet-status|fleet-merge|fleet-cleanup --session <dir>
ocr_review.py init ... --yes
ocr_review.py orchestrate-tick --session <dir>
ocr_review.py orchestrate-report --session <dir> --launch <id> --input <launch-report.json>
ocr_review.py task-start --session <dir> --task <id> --reviewer-context <id> --lease <lease-id>
ocr_review.py verifier-start --session <dir> --finding <id> --verifier-context <id> --lease <lease-id>
ocr_review.py pause|abort|resume|status|heartbeat|finalize|export-fix-queue ...
```
