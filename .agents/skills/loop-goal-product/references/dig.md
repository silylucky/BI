# 未达标挖掘（dig · loop-goal-product）

与 [loop-polishing/references/dig.md](../../loop-polishing/references/dig.md) **同一精神**（未达标先挖、挖空预算才 `no_fixable_items`）。本环只有 **product-reviewer** 一条 lane，差异如下。

## 触发

连续 2 台 `advanced_without_fix`（或 `fix_scope` 过滤后无可修），且 `total < target_score`，且 `dig_on_under_target` + `dig_remaining > 0`，且未命中回归/高原等更高停机 → **禁止停机**，进 dig。

默认 `dig_budget=2`。

## 一波必须做什么

1. 重置连续空台计数。
2. 下一评分台（再评）**强制 dig 指令**写入 product-reviewer `loop-lane` 提示：
   - 对准最近八维里 **低于 `target_score` 的维** 深挖新刺点（新 ID）
   - 允许更深路径 / 例外流 / 信任与空态 / 半成品入口
   - **允许**发现并标注 `capability_gap`（体验依赖能力缺口，见 [capability-gap.md](../../product-reviewer/references/capability-gap.md)）——须填强制字段
   - **穷尽盘点**：遵守 product-reviewer 穷尽协议——触发即列，禁止挑几个典型交差
   - **禁止**无证据发明功能并当本环实现；**禁止**复读上份报告无新证据；**禁止**纯视觉债 / 愿望清单冒充冲分项
3. **effective_fix_scope**（仅 dig 波）：
   - 原 `fix_scope=all` → 已含 P2，dig 重点是找新刺点而非扩级
   - 原 `P0+P1` → 可临时纳入 **非视觉债、非缺口、非过抛** 的 score_P2
   - 原 `仅 P0` → 不扩 P2
4. 挖到 ≥1 **可进 Fix** 的 `experience_fix`（或可修硬门槛）→ 退出 dig，Fix；否则耗预算。
5. dig 波**只**挖出视觉债 / `capability_gap` / `out_of_scope` → **不计**挖成功；消耗预算；预算尽 → `no_fixable_items`（ledger 可注 `dig_only_gaps_or_visual`；**`must_reach_target=true` 且未达标** → 重置 `dig_remaining = dig_budget`，ledger 记 `dig_budget_reset`，**禁止**停机，§10.6）。

## 与「仅剩视觉债 / 能力缺口」

未达标时：**先 dig** 找可修 `experience_fix` 分差；dig 预算尽且清单只剩视觉债 / `capability_gap` / `out_of_scope` / park → 再 `DONE_WITH_CONCERNS`（followups 含 PRD/蓝图），**禁止**未挖就因「剔视觉/缺口后无可修」早停；**禁止**本环 stub 实现缺口凑分。
