# 未清零挖掘（dig · loop-goal-prd）

**问题**：scope 内 `remaining > 0`，但当前 batch 抽不出可修项（依赖未解 / 误标 deferred / 契约 park），若直接 `no_fixable_items` 停机，无人值守冲里程碑会假早停。

**原则**：未 `scope_clear` 时「本批没东西可修」≠「该停」——先 **挖一波 Inventory** 再决定。挖 ≠ 发明新 PRD / 新里程碑；也 ≠ 空转复读同一份清单。

冲分挖掘见 [loop-polishing dig](../../loop-polishing/references/dig.md) / product 同精神；本文件只定义 **交付完成度** 向挖掘。

## 触发（须全部满足）

| # | 条件 |
|---|------|
| 1 | `remaining > 0`（未 scope_clear） |
| 2 | 本会本应命中停机表 `no_fixable_items`（连续 2 次盘点 `advanced_without_fix`，或前沿无可修 open） |
| 3 | 未同时命中更高优先级停机（user_stop / stop_file / regression / plateau / max_rounds / session_wall / blocked 硬卡死）；**`must_reach_target=true` 且 `remaining>0` 时 #3 不适用**（§10.6） |
| 4 | `dig_on_under_target=true`（默认；本环「target」= `scope_clear`）且 `dig_remaining > 0` |

→ **禁止** Phase 5；进入 dig；ledger 记 `dig_active` / `dig_wave` / `dig_remaining`。

## 预算

默认 `dig_budget=2`（可 `dig_budget=N` / `关闭挖掘`）。Resume 继承 `dig_waves_used`。

## 一波必须做什么

1. **重置**连续 `advanced_without_fix` 计数。
2. **再盘点指令（强制）**——不得复读上一份 `-rN.md` 交差：
   - 对照 plan 节 + PRD 分片 + arch：**有无漏进清单的 open**（节内未勾选却未列入）
   - 复查 `blocked` / `deferred` / `park`：依赖是否已满足、可否降为可修 `open`；误标须纠正
   - 抽检近期 `done`/`verified`：假绿 / 薄补丁 → 回潮 `open`（计入可修）
   - 契约类 `park`：若 `integration_policy` 允许且缺的是 ADR/调研 → 本波可排 **integration-research / 落 ADR** 切片（仍走 go-fast 舰队或编排方落 ADR 后再进真接），**禁止** stub 顶替
   - **禁止**自动发明无证据的新功能域 / 新里程碑行
3. 挖出 ≥1 条可进 batch 的 `open`（或加深切片 / 合法 ADR→真接）→ 退出 dig_active，恢复 Fix；`dig_waves_used += 1`。
4. 本波仍 0 可修 → 消耗 1 波预算；预算尽 → 允许 `no_fixable_items`（**`must_reach_target=true` 且 `remaining>0`** → 重置 `dig_remaining = dig_budget`，ledger 记 `dig_budget_reset`，**禁止**停机；或仅剩需人 `blocked` → `pending_human_integration`）。

## 与高原 / 回归

| 信号 | 处理 |
|------|------|
| 回归（清单净发散） | **不**进 dig；按回归停机（**`must_reach_target=true` 且未 scope_clear** → 忽略回归停机，继续 dig，§10.6） |
| 高原（Fix 后 DoneΔ 连续 0） | **不**进 dig；`plateau` 优先（**`must_reach_target=true` 且未 scope_clear** → 忽略高原，继续 dig） |
| dig 中 debt-map 升格 | 加深切片算有活干 |

## Ledger / 回传

```yaml
dig_on_under_target: true
dig_budget: 2
dig_waves_used: 0
dig_remaining: 2
dig_active: false
rounds:
  - n: 4
    dig_wave: true
    dig_actions: ["reopen_thin_done", "unblock_deps", "scan_plan_gaps"]
    new_open_ids: ["F12", "F18"]
```
