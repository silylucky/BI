# Loop 编排每轮卡片（Token 省读）

**何时 Read**：三环 Phase 0 后的**每一轮**前门前 / Fix 前；争议或首次启用再 Read 整本 [loop-orchestrator-contract.md](loop-orchestrator-contract.md)。  
**不要**每轮重读契约全文。go-fast：**本会话首次 Fix** 按 [orchestrator-api.md](orchestrator-api.md) §1.1 加载最小必读集；后续 Fix 轮不强制重读全文（触发条件见 api）。

> **维护规则**：本文是 [loop-orchestrator-contract.md](loop-orchestrator-contract.md) 的**派生摘要**，无独立效力。修改契约 §0.5 / §1 / §2 / §4 / §5 / §6 / §8 / §9 / §10.5 / §14（含 §14.1）或 [orchestrator-api.md](orchestrator-api.md) §1.1 时**必须**同步本文（尤其 **CR 分环默认** 与 **Fix 读盘**）；两者冲突时**以契约 / api 为准**并立即回修本文。**禁止**在本文引入契约没有的规则。

调用方：`orchestrator: loop-goal-product | loop-goal-prd | loop-polishing`。

**Phase 0 一次**（本卡不每轮重做）：证据目录门见契约 **§0.5**（`.evidence/` ignore + 未跟踪）。

---

## 角色（一眼）

| 谁 | 做什么 |
|----|--------|
| 编排方 | Review/Inventory → 停机 → 选 batch → 调 go-fast → 校验回写/前门 → Phase 5 |
| go-fast | 规格/工单/舰队/合回/相关测/CR/**唯一回写写者** |
| 实现 subagent | 白名单内改业务树 |

编排方 **禁止**未合法降级时主会话手改业务实现。

---

## 选批序（强制）

1. 硬门槛=`是` 且可修的 `open`  
2. 其余落在 `fix_scope` / 前沿依赖就绪者，至多 `batch_size`  
3. 剔除：视觉债（默认）、过抛、`blocked`/`deferred`/`park`/`verified`  
4. 硬门槛仍 open 却只冲软项 → **违规**

---

## 路径（报告 ≠ 规格）

- 评审/Inventory/打磨报告 → **默认 B**（出 specs → 规格门 → tickets）  
- **`spec_reuse`**：同 scope 已有 `docs/specs/<slug>.md` **覆盖本批全部 ID**、无 stub 验收、锚点仍有效 → **Path A**（勿每轮重写）  
- PRD 分片作 `spec_ref`：契约 §6 全满足才 A；对 PRD **只评不改**正文  

---

## 前门（再评 / 再盘点 / 下一评分台）

**只裁判本轮已派出 Fix 的情况。** A/B 两层**都**过才进（契约 §5.1）。

**A 层 · 读字段（只是格式检查）**

1. `merged_to_base == true`；在 `base_branch`；无脏改（含 CR 自动修后）  
2. 有可完成项时 `summary` 非空且 `summary ⊆` 本批  
3. `go-fast.status ∈ {DONE, DONE_WITH_CONCERNS}`；concerns 时 `code_review.remaining` **仅**契约 / 裁定 / **需人批**类（无「可修却未修」）  

**B 层 · 编排方自己跑（决定性）**

```bash
~/.agents/skills/_bin/gate-check batch --slices <本批切片> [--strict-red] --json
```

- `--slices` **只能**填 go-fast 回传 `slices[].id` 全集（排除 `BLOCKED` 且无证据的片）；**禁止**从 finding ID 猜切片名或自己编 id（契约 §5.1 B 层）  
- 退出码三值：`0` = PASS / `1` = FAIL / `2` = ENV_ERROR。**`2` 一律按前门失败**处理（记 `gate_recheck.batch: ENV_ERROR` + `gate_fail_streak++`，先修环境再重跑）；查不到证据 ≠ 无事发生，**绝不可**放行  
- **禁止**只读回传 `evidence.gate` 就放行（那是自证闭环）；与自跑结论不符 → **以自跑为准** + 记 `evidence_mismatch: true`（下轮强制 `--strict-red` 且须抽查 `verify`）  
- `case-count` FAIL = 缩测换绿 → 失败  
- `external_deps[]` 中 `credential: have` 且标已实现的项：`smoke` 非空且 `gate-check smoke --slug <slug>` 过（假通 = 假绿）；`need` / `blocked` 只能 park / concerns，**禁止**进 `summary` 或勾选  
- `verify`（重跑，最硬最慢）：只在 `evidence_mismatch` / 该簇回潮 ≥2 / Phase 5 前抽查  

**失败**：不抬分/不勾选；`gate_fail_streak++`；**不**增加评分台 `round`；`reasons` 原样进 ledger；禁删工件重跑；streak≥2 → 停机 `blocked`。  
合法 `DONE_WITH_CONCERNS`（仅裁定类）→ **允许**再评。

### 无 Fix 推进（契约 §5.2.1 · 别误判成失败）

本轮 `status: skipped` + `zero_reason: no_fixable_items` + 本台报告已有效落盘 + 无可修硬门槛  
→ **不适用**上面的前门，**不**累加 `gate_fail_streak`；记 `advanced_without_fix: true`，`round += 1` 换下一 lane / 下次盘点继续。  
**连续 2 台**如此：若有目标分且未达标且 dig 预算未尽 → **dig**（勿立刻停）；否则 Phase 5，`stop_reason: no_fixable_items`。多 lane 下本台无可修是**常态**。

---

## 债务地图（契约 §14）

每轮 Fix 后更新目标仓 `docs/material/debt-map.md`：与本轮白名单相交的簇 `touch_count += 1` 并记 `last_touch`；回潮或 `verify` FAIL → `regression_count += 1`。

- 升格双通道（数值真源见契约 §14，本文不另定义）：`touch_count >= deepen_threshold`（默认 `3`，可由本次调用参数覆盖），**或**同簇连续 2 次薄补丁 → 该簇 `escalated`：命中它的 finding **不进 batch**（`deferred: debt_escalated`，**不**算 `no_fixable_items`），下一轮**必须**插一次 `local-deepen` 加深切片（须落 ADR；实属 `structural` 则 park 升人）  
- 加深 / `refactor-shared` 片：独占一波、**不占** `batch_size`、**不计** `touch_count`、**禁止**拿来抬分；判定 = 相关测绿 + `case-count` 不降 + 该簇 `touch_count` 归零 → `deepened`  
- 交接下一环时带上 debt-map 路径与 `escalated` 状态，**禁止**从 0 重新计数  
- **loop-goal 军团**：不写主 `debt-map.md`；记 `debt_touches[]`；舰队合入后串行 merge（契约 §14.1）

---

## 全量 / CR（loop 内）

- 单轮 Fix：`full_suite.deferred_to_loop: true`；禁仓/FE 全量（`full_suite_every` 除外）  
- Phase 5：曾合回 → 须全量绿才干净 `DONE` / `met_target` / `scope_clear`  
- unattended CR：以传入的 `cr_fix_scope` 为准（契约 §8）——**prd/product 默认 `P0+P1`**（P2 → `remaining`）；**polishing 默认 `all`**（P0+P1+P2）；显式覆盖优先  
- Fix 读盘：见 [orchestrator-api.md](orchestrator-api.md) §1.1（本会话首次 Fix 必须加载 go-fast 最小集；禁止整环零读）

---

## 契约不明

**三环默认 `auto_best_require_adr`**（难回退选型先落 ADR 再真接）；用户显式才降 `auto_best` 或改 `park`。  
禁 stub 顶替；禁跳过 research + 八维猜接；禁 unattended 干等（`park` 除外）。

---

## `.stop`（三环共用 · 契约 §10.5）

每轮**开始时**与**本轮 Fix 结束后**各查一次工作区根的 `stop_file`（默认 `.stop`）。  
存在 → `stop_pending: true`，做完当前评分台后 Phase 5 → `DONE_WITH_CONCERNS` / `stop_reason: stop_file`。  
**禁止**删 `.stop` 续跑；**禁止** `stop_pending` 后再开新轮。

---

## 自检（口头勾）

- [ ] **B 层已亲自跑** `gate-check batch`，退出码已记；`evidence_mismatch` 已如实标  
- [ ] 本会话首次 Fix（或 Resume 后首次）已按 api §1.1 加载 go-fast 最小必读集；非「心想舰队」  
- [ ] debt-map 已更新（军团内只写 `debt_touches`/分片）；`escalated` 簇本批未再打补丁  
- [ ] summary 门 + 硬门槛未用软项顶替  
- [ ] 本轮无可修项时走了 §5.2.1 推进，**没有**误记 `gate_fail_streak`  
- [ ] CR：`cr_fix_scope` 按环默认（prd/product=`P0+P1`；polishing=`all`）或显式覆盖  
- [ ] prd：Fix 前 Inventory `done_count` / `delta_remaining` 为 `null`  
- [ ] product/polishing：未锚定旧分 / target  
- [ ] polishing：过抛未进 batch；无双评；`loop-lane`；首个 composite 用 `full`  
- [ ] `.stop` 已查；`stop_pending` 后未开新轮  
- [ ] 未并行两 loop 改同一 `base_branch`  
- [ ] 未在 Phase 5 前宣称干净 DONE  

## Resume

中断后续跑：契约 **§12**；读 ledger 游标，禁瞎开新环。
