# Finding Contract

## 状态

```text
search/scan hit → Candidate → semantic investigation → Finding
Finding → optional verifier → confirmed/rejected → finalizer → published comment
```

Candidate 是待查假设；Finding 是有结构化因果证据的审查结论。只有 `state=confirmed` 且位置/指纹仍新鲜的 Finding 可以输出。

## Reviewer 提交字段

```json
{
  "title": "扣款错误被忽略",
  "claim": "charge 返回的错误被丢弃，失败后仍继续使用 result",
  "severity": "high",
  "category": "bug",
  "existing_code": "result, _ := charge()\nreturn use(result)",
  "expected": "扣款失败时终止并传播错误",
  "actual": "忽略错误并继续处理返回值",
  "impact": "可能把失败扣款记录为成功",
  "impact_surface": "runtime",
  "reachability": "proven",
  "current_input_reproducible": true,
  "delivery_impact": "P1（仅 production-readiness，可选）",
  "evidence": ["charge 的第二个返回值被丢弃", "调用方随后写入成功状态"],
  "change_evidence": "可选；review 模式的改动因果证据",
  "change_kind": "addition|modification|deletion",
  "xref": [{"path": "account.go", "symbol": "Account.MarkPaid", "purpose": "调用契约证据"}],
  "root_cause_key": "可选；有把握时填写稳定、简短的根因键",
  "fix_scope": "可选；能够消除该问题的最小修复边界"
}
```

禁止提供 `path/file/line/start_line/end_line`。程序从 task 的 Primary Target 和 `existing_code` 计算它们。

`impact_surface` 必须是 `runtime | build-deploy | tooling | test | docs`；`reachability` 必须是 `proven | likely | unknown`；`current_input_reproducible` 必须是布尔值。`correctness` profile 下，tooling/docs 问题只有在当前输入可复现且 reachability=proven 时才可提交，避免脚手架和一次性脚本的机械命中淹没运行时缺陷。

模型不提交 `cross-file` 真值。程序只在 `xref` 非空时派生 `cross_file=true`，并据此触发独立 verifier；这样不会因提示词标签漂移制造无意义验证队列。

## 位置

- `existing_code` 必须是当前 Primary Target 中连续、原样、足以唯一匹配的代码。
- 唯一命中后，程序计算 1-based 起止行并保存位置指纹。
- 多次命中：`LOCATION_AMBIGUOUS`，扩大片段。
- 未命中：`LOCATION_FAILED`，重新读取当前代码。
- `review` 默认要求锚点与 new-side diff hunk 相交。
- 删除引发的问题：`change_kind=deletion`、提供删除 hunk 中原样存在的完整行序列 `change_evidence`；程序拒绝任意子串或单字符“证据”。`existing_code` 仍锚定当前幸存代码，禁止发布旧文件行号。

## 严重度与类别

严重度：`critical | high | medium | low`。

类别兼容 OCR：`bug | security | performance | maintainability | test | style | documentation | other`，并允许选择性验证用的 `concurrency | transaction | data-consistency | data-loss`。

默认只报告实质性正确性、安全、数据、并发、明确性能或维护缺陷。style/documentation 只有项目 OCR 规则明确要求时才报告。

`production-readiness` 可另记 `delivery_impact=P0|P1|P2`，但不得替换主严重度。

## 去重与关联

- 程序级严格去重键为：`task_id + task input revision + 原样 claim + 位置指纹(path + existing_code)`。键完全相同时生成相同 Finding ID，后续提交返回 `duplicate=true`，不会重复写入或输出。
- Finding ID 包含 task input revision；代码、规则或 Requirement 变化后，旧 Finding 会 superseded，新证据必须重新提交，不能错误复用旧结论。
- claim 改写、锚点改变或来自不同 Primary Target 时，原始 Finding 始终保留在 `findings/<task-id>/<finding-id>.json`。程序不使用向量、编辑距离或 LLM 自由文本判断直接删除原始项。
- Reviewer 只有在能给出稳定根因时才填写 `root_cause_key`；`fix_scope` 描述最小共同修复边界。二者是候选提示，不是合并证明。没有提示时保持独立 Finding。
- 所有 Primary Target 终态后，`dedup-plan` 对新鲜的 confirmed Finding 按 `category + normalized root_cause_key` 确定性分桶。只有至少两个成员的桶成为 `dedup/candidates/<candidate-id>.json`；不同类别永不自动进入同一候选。
- 每个 pending 候选交给新的独立 verifier context。Verifier 可以把候选分成多个 merge group，并把其余成员放入 `keep_separate_finding_ids`；每个候选成员必须且只能被覆盖一次。
- 每个 merge group 必须同时证明 `same_root_cause=true`、`same_failure_path=true`、`single_fix_resolves_all=true`，并给出非空理由。任一项不成立或不确定，就保留为独立问题。
- `dedup-verify` 只记录决定，不修改或删除原始 Finding。Finalizer 从 verified decision 派生 canonical 发布问题，附带 `duplicate_finding_ids`、全部 `occurrences` 和理由，并使用组内最高严重度，避免归并造成降级；原始证据仍可独立审计。

Verifier 输入示例：

```json
{
  "groups": [
    {
      "canonical_finding_id": "finding-a",
      "duplicate_finding_ids": ["finding-b"],
      "reason": "两个 occurrence 由同一校验缺失触发，修复共享入口即可同时消除",
      "same_root_cause": true,
      "same_failure_path": true,
      "single_fix_resolves_all": true
    }
  ],
  "keep_separate_finding_ids": ["finding-c"],
  "reason": "finding-c 需要独立修复"
}
```

## 选择性验证

以下 Finding 必须验证：critical/high；security、concurrency、transaction、data-consistency、data-loss；程序从 `xref` 派生的跨文件问题；框架/版本依赖或证据仍不确定的判断。其余 medium/low 可以直接 confirmed，但 Finalizer 仍检查位置新鲜度。普通 verifier backlog 未清空时 `finalize` 返回 `VERIFIER_PENDING`。
