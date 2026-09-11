# Reviewer Protocol

这是不可由仓库规则覆盖的协议层。仓库规则只能改变“检查什么”，不能改变范围、证据、工具循环和完成语义。

## Reviewer 输入

- 一个 `task_id`
- `orchestrate-tick` 返回的 `lease_id` 与 `session_epoch`
- 一个宿主实际创建、只服务于此文件的 reviewer context ID
- 一个 Primary Target path
- `review` 的该文件 unified diff，或 `scan` 的完整文件
- 解析后的 OCR 规则
- Requirement Background
- Stack Card 中与该文件有关的信号和审查维度
- 其他 changed file 路径列表；不预载它们的内容

## 硬提示词

创建 context 后先用租约调用 `task-start`；租约过期或 epoch 不匹配时退出，不尝试绕过程序状态。将以下语义放入每个 reviewer context：

> 你只审查当前 Primary Target。其他文件仅供理解；即使在其中发现真实历史 Bug，也不得报告。先完整理解当前 diff/文件，再调查 Candidate。事实不清时使用只读工具获取上下文，禁止猜测。搜索命中不是问题。只有能够描述触发条件、期望行为、实际行为、影响并提供当前代码锚点时，才提交 Finding。完成必须提交 Coverage 并调用 `complete`；自然语言 complete 无效。

## Agent 工具循环

```text
读 Primary Target
  → 产生 Candidate
  → 还缺什么事实？
      → Search/Grep 找符号或候选
      → Read 精确读取定义、调用方、配置、测试
      → Git/Diff 确认与改动关系
      → 必要时运行只读 build/test/lint
  → 尝试推翻 Candidate
  → 证据闭环：submit
  → 证据不足：记录 rejected candidate 或 pending question
  → sweep 完成：complete
```

优先精确搜索，避免无界读取。通常每个 Candidate 用 2–3 次针对性上下文读取即可；这不是硬配额，复杂跨文件问题允许继续查证。

## Bug 判定

Finding 至少回答：

1. 什么可达输入、状态或时序触发？
2. 代码/接口/业务契约期望什么？
3. 当前实现实际做了什么？
4. 差异造成什么用户、数据、安全或运行时影响？
5. 哪段 Primary Target 当前代码能唯一锚定？
6. `review` 模式下，它与本次改动的因果关系是什么？

回答不了就仍是 Candidate。

## Context Evidence

允许读取调用方、被调函数、类型、配置、测试和相邻实现。Context Evidence 只支持或推翻 Primary Target 的主张。

例如 `payment.go` 是任务，`account.go` 可以证明账户状态契约；如果只发现 `account.go` 自己的历史错误，应记录“与当前任务无关”后停止，禁止 submit。

默认被排除的测试文件可作为证据读取。只有用户通过 OCR include 规则显式准入时，测试才成为 Primary Target。

## 大文件与上下文隔离

普通文件使用一个新 reviewer context，不做外部压缩。大文件按符号或行范围分段，同一 task 维护 Coverage Ledger；禁止把分段变成互相独立、无法证明完整性的 Finding 源。

只在以下情况写 checkpoint：大文件分段、上下文即将耗尽、宿主中断、外部依赖暂不可用。checkpoint 必须含已覆盖范围、Finding ID、被否定 Candidate 及证据、待解决问题、下一动作和 task input hash。

## 提交与完成

语义闭环后按 [finding-contract.md](finding-contract.md) 生成 JSON，调用 `submit`。必须明确 `impact_surface`、`reachability`、`current_input_reproducible`；跨文件证据写入 `xref`，`cross_file` 由程序派生。只有对共同根因有把握时才补充稳定、简短的 `root_cause_key` 与最小 `fix_scope`；不要为了减少最终数量而猜测标签。收到 `LOCATION_AMBIGUOUS` 或 `LOCATION_FAILED` 必须扩大/纠正原样代码片段，不得手填行号绕过。

全部 Candidate 已证实或否定后，按 [coverage-routing.md](coverage-routing.md) 生成 Coverage，调用 `complete`。即使某些 Finding 仍在 verifier backlog，`complete` 也会释放 reviewer 槽；不要让 reviewer 等待 verifier。命令失败即任务未完成。
