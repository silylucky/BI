# Verifier Protocol

Verifier 使用 `orchestrate-tick` 租约创建的全新只读 context，不继承 Reviewer 的推理过程，也不与其他 Finding 复用。它接收 Finding claim、Primary Target 锚点、diff、引用证据和必要契约，目标是**尝试推翻**，不是润色评论。

检查：

1. 触发路径是否可达，还是 Reviewer 假设了不可能输入？
2. 期望行为是否有代码、接口、规则或业务契约支持？
3. 实际行为是否被上下文中的保护、事务、重试或调用方处理抵消？
4. 影响是否真实且与严重度相称？
5. `review` Finding 是否真的由当前改动引入或暴露？
6. 是否有直接反证？

结论只能是：

- `confirm`：没有找到能推翻核心主张的反证；说明最强证据。
- `reject`：给出具体反证或缺失的必要因果链。

不允许用“看起来合理”确认，也不允许仅因无法复现就拒绝。context 创建成功后先调用 `verifier-start --lease <lease-id> --verifier-context <context-id>`，由 Controller 将其作为 accepted 写入 `orchestrate-report`；审查结束再调用 `verify --decision ... --reason ...` 并携带同一租约与 context。租约/epoch 失效、没有启动 ACK 或没有工具状态记录都不算完成。Verifier backlog 优先于新增 reviewer；Finalizer 在 backlog 未清空时返回 `VERIFIER_PENDING`。

## 语义重复候选

`dedup-plan` 产生的每个候选必须使用一个新的独立只读 context；不得使用 Controller、任一 Primary Target reviewer，或复用其他候选的 verifier context。输入以单个 `dedup/candidates/<candidate-id>.json` 为边界，只按需读取能够证明或推翻共同根因/失败路径/修复边界的源码。

对候选做完整分区：把真正重复的成员放进一个或多个 `groups`，其余全部放入 `keep_separate_finding_ids`。合并组必须同时满足：

1. `same_root_cause=true`：不是相似症状，而是同一因果缺陷。
2. `same_failure_path=true`：触发链与实质影响相同，局部 occurrence 没有独立可行动差异。
3. `single_fix_resolves_all=true`：修复共同边界即可消除组内全部 occurrence。

任一证明不成立或证据不足，就保持独立。调用 `dedup-verify --candidate ... --input ... --verifier-context ...`；Verifier 不删除 Finding，也不修改严重度或原始证据。
