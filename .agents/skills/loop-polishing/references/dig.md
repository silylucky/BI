# 未达标挖掘（dig）

**问题**：清单里当前 `fix_scope` 可修项空了，但 `total < target_score`，若直接 `no_fixable_items` 停机，无人值守冲分会假早停。

**原则**：未达标时「没东西可修」≠「该停」——先 **挖一波** 再决定；挖空预算后才允许 `no_fixable_items`。挖 ≠ 空转凑轮：必须换角度、扩有效范围、对准落后维；**允许标注** `capability_gap`，**禁止**本环发明功能落地。

## 触发（须全部满足）

| # | 条件 |
|---|------|
| 1 | 最近一次可用 `total < target_score` |
| 2 | 无未清硬门槛被卡死（硬门槛仍 `open` 且可修 → 应 Fix，不进 dig） |
| 3 | 本会本应命中停机表 `no_fixable_items`（连续 2 台 `advanced_without_fix`，或累积清单在当前 `fix_scope` 下无可修） |
| 4 | 未同时命中更高优先级停机（user_stop / stop_file / regression / overpolish / plateau / max_rounds / session_wall）；**`must_reach_target=true` 且未达标时 #4 不适用**（§10.6） |
| 5 | `dig_on_under_target=true`（默认）且 `dig_remaining > 0` |

→ **禁止** Phase 5；进入 dig；ledger / 回传记 `dig_active: true`、`dig_wave`、`dig_remaining`。

## 预算

| profile | 默认 `dig_budget`（波数） |
|---------|-------------------------:|
| short | 2 |
| long | 3 |
| marathon | 3 |

一波 = **一次**带 dig 指令的评分台（可紧跟一轮 Fix）。用户可 `dig_budget=N` / `关闭挖掘`（`dig_on_under_target=false`）覆盖。

进入 dig 时：`dig_remaining = dig_budget - dig_waves_used`（Resume 从 ledger 继承已用波数）。

## 一波必须做什么

1. **重置**「连续 advanced_without_fix」计数（本波不算凑轮停机的第 3 次空台）。
2. **选 lane**（覆盖 [round-roster.md](round-roster.md) 启发式）：优先最近 composite 中 **低于 `target_score` 的维** 对应 lane：
   - 产品任务 / 权责 / 信任偏低 → `product` / `flow`
   - 代码诚实 / 硬门槛残余 → `code`
   - 视觉密度 / 壳交互 → `ui` / `ux`
   - 架构边界偏低或 debt-map 可升格 → `arch`（升格加深优先于再打补丁）
   - 邻域裂缝 → `neighbor`
   - 多维同时低 → 下一台强制 `composite` 且 **`composite_mode=full`**
3. **Reviewer 指令（强制写入 lane 提示）**：
   - 目标：找出能抬综合分、此前清单**未覆盖**的新刺点（新 ID）
   - 对准落后维；允许更深路径 / 例外流 / 空态信任 / 半成品入口 / locality
   - product/flow lane：**允许**标注 `capability_gap`（强制字段见 [capability-gap.md](../../product-reviewer/references/capability-gap.md)）
   - **穷尽盘点**：遵守各 reviewer「穷尽盘点」——命中即列，禁止 Top N / 代表样例；dig 波尤忌「再挖出 2～3 条交差」
   - **禁止**发明新功能冒充打磨/本环实现；**禁止**只重述已 `done`/`wontfix`/`deferred` 项；**禁止**纯口味像素凑数
4. **有效修复范围（仅 dig 波）**：`effective_fix_scope` =
   - 用户原 `fix_scope` 已是 `all` → dig **不**再扩级，只换角度找新刺点（过抛项仍剔除）
   - 原为 `P0+P1` → 可临时并上 P2 且 `视觉债=否` 且 `过抛风险=否` 且 `分类≠capability_gap|out_of_scope` 且能对应落后维的项（`score_P2`）
   - 原为 `仅 P0` → 不扩 P2  
   纯过抛项 / `capability_gap` / `out_of_scope` 仍剔除出 Fix。
5. 挖出 ≥1 条可进 batch 的新/回潮 `open`（可修 `experience_fix` 或可修硬门槛等）→ 本波后 `dig_active=false`（或保留到该批 Fix+前门过），恢复正常选 batch；`dig_waves_used += 1`。
6. 本波仍 0 可修 → `dig_waves_used += 1`，`dig_remaining -= 1`；若 `dig_remaining > 0` 换另一落后维再挖；若 `0` → 允许 `no_fixable_items` 停机（**`must_reach_target=true` 且未达标** → 重置 `dig_remaining = dig_budget`，ledger 记 `dig_budget_reset`，换维再挖，**禁止**停机）。

## 与过抛 / 高原

| 信号 | 处理 |
|------|------|
| 过抛闸已成立（anti-overpolish） | **不**进 dig；按过抛停机（**`must_reach_target=true` 且未达标** → 不整环停，须加深后换维继续，§10.6） |
| 高原已成立 | **不**进 dig；`plateau` 优先于 dig（**`must_reach_target=true` 且未达标** → 忽略高原，继续 dig） |
| dig 波只挖出过抛/视觉债/`capability_gap`/`out_of_scope` | 不计「挖成功」；消耗预算；预算尽 → `no_fixable_items`（ledger 注 `dig_only_overpolish` 或 `dig_only_gaps_or_visual`） |
| dig 中 debt-map 升格 | 加深切片照常；**算**有活干，退出「清单耗尽」路径 |

## 禁止（dig 仍受诚实约束）

- **禁止**把 dig 做成 Review-only 复读同一报告抬轮次  
- **禁止**未换 lane / 未对准落后维 / 未写 dig 指令却宣称 `dig_wave`  
- **禁止**为凑 `min_rounds` 在已达目标后再 dig  
- **禁止** dig 发明功能落地或把 `structural` arch 当抛光必修；标注 `capability_gap` ≠ 本环实现  

## Ledger / 回传字段

```yaml
dig_on_under_target: true
dig_budget: 2
dig_waves_used: 0
dig_remaining: 2
dig_active: false
rounds:
  - n: 5
    dig_wave: true
    dig_focus_dims: ["信任", "空态"]
    effective_fix_scope: "all"
    new_open_ids: ["P-12", "U-7"]
```
