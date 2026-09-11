# 轮次状态机（loop-polishing · 唯一口径）

与 [loop-goal-product](../../loop-goal-product/SKILL.md) **同构**：评分台与 Fix 交替；**再评 = 下一轮评分台**，禁止 Fix 后再评同内容后又立刻开一轮重复 Review。

计轮 / 前门失败与 [loop-orchestrator-contract.md](../../go-fast/references/loop-orchestrator-contract.md) **§5.2** 一致：`round` 仅评分台落盘 +1；`gate_fail_streak` 不计 `round`。

## 单轮循环

```text
Round n（n 从 1 起）：
  1. 选 lane（roster；Round 1 强制 composite；见 round-roster.md）
  2. Review = 本轮「评分台」
     - 执行对应 reviewer，mode=loop-lane（见 finding-normalize.md）
     - 归一处理清单 → 落盘 …-r<n>.md
     - composite：按 composite_mode=light|full 算八维 + total；非 composite：更新维分，total_stale=true
  3. Ledger 追加本轮行
  4. Phase 2 停机判定（用最近 composite 的 total；见主 SKILL）
     - 停 → Phase 5 → 结束（本轮可不 Fix）
     - 不停 → 5
  5. 过抛过滤 → 选 batch
     - batch 非空 → go-fast Fix → 6
     - batch 为空（全被过抛/视觉债/deferred/非 fix_scope 过滤掉，且无可修硬门槛）
       → go-fast skipped / no_fixable_items → 6b
       ※ 只剩 deferred: debt_escalated（待加深）**不算**空：须排该簇加深切片（契约 §14）
  6. 再评前门（编排契约 §5.1；仅当本台**派过** Fix 才适用）
     - 失败 → §5.2（gate_fail_streak++；不 +round；不得抬分）；streak≥2 → 停机
     - 通过 → n+=1，回到 1（下一轮 Review = 对 Fix 的再评 + 新焦点 lane）
  6b. 无 Fix 推进（编排契约 §5.2.1）
     - 记 advanced_without_fix: true；gate_fail_streak **不变**；本台不记任何 Δ 进步
     - n+=1，回到 1（换下一 lane 继续取证）
     - 连续 2 台 advanced_without_fix（或累积清单在 fix_scope 下已空）：
         · total < target 且 dig 预算未尽 → **dig 波**（[dig.md](dig.md)），重置连续空台计数，禁止 no_fixable_items
         · **`must_reach_target=true` 且未达标** → dig 预算尽须重置再挖（§10.6），**禁止** no_fixable_items
         · 否则 → Phase 5，stop_reason: no_fixable_items
```

**6 与 6b 的区别是本台有没有派出 Fix，不是有没有合回。** 多 lane 轮转下某台（尤其 `arch`）没有可进 batch 的项是常态，**禁止**按前门第 1 条（`merged_to_base == true`）判它失败——那会让长跑在头几台就以 `blocked` 假阳性收场。

**未达标空清单**：连续空台优先 dig，不是停机。dig 波必须带 dig 指令并对准落后维；挖空预算后才允许 `no_fixable_items`。

## 计轮定义

| 计入 `round` | 不计入 |
|--------------|--------|
| 每一次落盘的正式评分台（含 Fix 后的再评轮） | 前门失败、未形成新评分报告的重试（`gate_fail_streak++`；可记 ledger `attempts`） |
| 无 Fix 推进的评分台（§5.2.1，`advanced_without_fix`） | go-fast 内 CR / 规格门（属 Fix 子步骤） |
| `dry_run=1` 的 Round 1 评分台 | — |

- **`min_rounds` / `max_rounds`**：均以已完成评分台次数计（与 product 的 Review 次数同尺）。  
- **报告编号**：`…-r<n>.md` 的 `n` = 该次评分台的 `round`（一对一，不另插「再评专用号」）。  
- **禁止双评**：同一 `round` 内不得「Review → Fix → 再评同 lane」后再 `round+=1` 又对同一未改基线再 Review。Fix 后的下一次评分台 **就是** `round+1`。  
- **墙钟**：本会话评分台数 ≥ `max_wall_rounds_per_session` → `session_wall`（契约 §12）；marathon 禁止单会话跑满。**`must_reach_target=true` 且未达标** → `session_wall` 非终局，须 Resume 续冲（§10.6）。

## 下一 lane（再评轮如何选）

进入 `round = n+1` 选 lane 时：

1. 若距上次 **composite** 的评分台间隔 ≥ `composite_every` → **强制** `composite`  
2. 否则按 [round-roster.md](round-roster.md) 序列的下一个焦点（可被启发式覆盖）  
3. `stop_pending`：允许做完**当前**评分台与（若已开）Fix，然后 Phase 5；**不再** `n+=1` 开新轮

## 高原 / 回归用分

| 量 | 规则 |
|----|------|
| `total` / `Δtotal` | **仅**两次均为 composite 的评分台之间可计算 |
| `plateau` | `composite_count >= plateau_min_composites` 且最近 `plateau_composites` 个可计算 `|Δtotal|` 均 `< plateau_delta` |
| `regression` | 最近一次可计算 `Δtotal ≤ -regression_stop` |

`composite_count` = 已完成的 composite 评分台次数（含 Round 1）。对照三环见契约 §0。

## `honor_min_rounds` 与早停

| `honor_min_rounds` | 行为 |
|--------------------|------|
| **`false`（默认）** | 达目标 / 过抛闸 / 高原 → **立即** Phase 5；**未达标的清单空** → dig（非立即停）；dig 预算尽才 `no_fixable_items`。**禁止**无 dig 的 Review-only 凑 `min_rounds`。**`must_reach_target=true` 且未达标** → 无高原/过抛/回归/轮数/挖空/session_wall 软停（§10.6） |
| **`true`（用户说「必须跑满」）** | 尽量跑到 `min_rounds`；未达标同样先 dig；若已达标或 dig 尽仍无可修 → **仍须停机**（可带 `min_rounds_unmet`），**禁止**纯评分空转 |

解析：用户说「过抛可提前停」「不必跑满」/未提 → `false`；「必须跑满至少 N 轮」→ `true`。

## `dry_run=1`

只跑 **Round 1 composite** 评分台 + 归一清单 + ledger 骨架；**禁止** go-fast 改业务树；然后 `DONE_WITH_CONCERNS`，`stop_reason: dry_run`。用于验证解析/roster/归一，不宣称打磨完成。
