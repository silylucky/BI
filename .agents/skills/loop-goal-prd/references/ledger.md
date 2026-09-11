# 轮次台账（loop-goal-prd）

路径：`docs/material/loop-goal-prd/<YYYY-MM-DD>-<slug>-ledger.md`

```markdown
# Loop-Goal-PRD Ledger · <scope>

| 字段 | 值 |
|------|-----|
| scope | M2 / 当前节 / Fxx,… |
| arch | docs/arch.md |
| fix | go-fast |
| batch_size / max_rounds / wall | 10 / 8 / 8 |
| must_reach_target | false（§10.6 达标模式） |
| attendance | unattended |
| integration_policy | auto_best_require_adr |
| cr_fix_scope | P0+P1 |
| plateau_rounds | 2（只计 Fix 后 DoneΔ） |
| regression_rounds | 2（只计 Fix 后 `delta_remaining>0`） |
| gate_fail_streak | 0 |
| debt_map / deepen_threshold | docs/material/debt-map.md / 3 |
| escalated_clusters | [] |
| stop_file / stop_pending | .stop / false |
| dig | on · budget=2 · used=0 · remaining=2 |
| base_branch | …（Phase 0 门闩记录） |
| scan_tools | ast-grep+codegraph \| ast-grep \| rg-only（Phase 0 探测；只探测不装） |
| blockers（扫描） | [] 或缺工具时的降级说明（不因此整环 BLOCKED） |
| copy_spotcheck | pass \| fail+followups \| skipped（Phase 5 前端空态文案抽检；craft §8） |
| 停机 | scope_clear \| regression \| max_rounds \| plateau \| no_fixable_items \| blocked \| user_stop \| session_wall \| stop_file |

## Resume 游标（契约 §12）

| 字段 | 值 |
|------|-----|
| last_round | |
| open_ids | |
| stop_pending | false |
| pending_worktrees | [] |
| escalated_clusters | []（含 `touch_count`；续跑/换环**禁止**从 0 重算） |
| resumed_from | |

## 轮次完成度

| Round | Remaining | DoneΔ | ΔRemaining | Hard gates | Batch | go-fast | spec_reuse | wave_size | merged | summary | 源清单 | 再盘点 |
|------:|----------:|------:|-----------:|------------|-------|---------|:----------:|----------:|--------|---------|--------|--------|
| 1 | 12 | — | — | 有 | F03,F04 | B / DONE | no | 2 | yes | F03,F04 | …-r1.md | — |
| 2 | 9 | 3 | −3 | 无 | F05 | A / DONE | yes | 1 | yes | F05 | …-r1.md（回写） | …-r2.md |

`DoneΔ` ≡ 回传 `done_count` = **Fix 后**盘点时本轮新标完成的 PRD ID 数。  
`ΔRemaining` ≡ `delta_remaining` = `remaining_n − remaining_{n-1}`；**正数 = 净发散**（边做边长）。  
**Round 1（Fix 前 Inventory）两者均须为 `—` / `null`，禁止记 0。**  
前门失败不增加 Round（`gate_fail_streak`）；**无 Fix 推进**（契约 §5.2.1）增加 Round 但记 `advanced_without_fix: yes`、`gate_fail_streak` 不变。连续空台且 `remaining>0` → **dig**（[dig.md](dig.md)）；dig 尽才 `no_fixable_items`。  
高原：至少 1 次 Fix 尝试后，连续 `plateau_rounds` 个 Fix 后盘点的 `DoneΔ=0`（首轮 `—` 不计入窗口）。见契约 §0。  
回归：连续 `regression_rounds` 个 Fix 后盘点的 `ΔRemaining > 0`。

## 处理明细（全量 · 跨轮累积）

| ID | plan_ref | 硬门槛 | 状态 | Round | 本轮动作 | 改动摘要 | 验证 | 规格/工单 | 源清单 |
|----|----------|--------|------|------:|----------|----------|------|-----------|--------|
| F03 | M2 | 是 | done | 1 | go-fast | … | 相关测绿 | specs/… | …-r1.md |

## 本轮摘要 / residual_worktrees / 结论

- go-fast：`path` / `spec_reuse` / `summary` / `writeback_repaired` / `thin_patch_rejected`
- 再盘点前门 B 层：`gate_recheck`（`batch` / `strict_red` / `reasons` / `verify_slices`）+ `evidence_mismatch`；失败 → §5.2
- debt-map：本轮触及簇 + `touch_count` 变化 / 新 `escalated` / 加深切片与 ADR 路径 / 解除为 `deepened`；若 `orchestrator_parent: loop-goal` → `debt_touches[]`（契约 §14.1），不直接改主文件
- Phase 5：`full_suite` + `residual_worktrees[]`
```

**强制**：

1. Fix 后 ledger 与源 Inventory、PRD/plan、`summary` 同批一致。  
2. 再盘点前门未过 → 不得抬完成度；记 `gate_fail_streak`。  
3. Phase 5 / 中止须列 `residual_worktrees`。  
4. Resume 必填游标（契约 §12）。  
5. 每个 Fix 轮都要落 debt-map 变更（含「无变化」）；`regression_count` **从不清零**；`escalated` 簇必须能在下一轮找到加深切片或 `blocked` 理由。
