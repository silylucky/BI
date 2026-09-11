# 轮次台账（loop-goal-product）

路径：`docs/material/loop-goal-product/<YYYY-MM-DD>-<slug>-ledger.md`

```markdown
# Loop-Goal-Product Ledger · <scope>

| 字段 | 值 |
|------|-----|
| 目标分 | 95 |
| review / fix | product-reviewer (loop-lane) / go-fast |
| fix_scope / batch_size | all / 5 |
| max_rounds / wall | 5 / 5 |
| must_reach_target | false（§10.6 达标模式） |
| attendance | unattended |
| integration_policy | auto_best_require_adr |
| cr_fix_scope | P0+P1 |
| plateau_delta / regression_stop | 2 / 5 |
| gate_fail_streak | 0 |
| debt_map / deepen_threshold | docs/material/debt-map.md / 3 |
| escalated_clusters | [] |
| stop_file / stop_pending | .stop / false |
| dig | on · budget=2 · used=0 · remaining=2 |
| base_branch | …（Phase 0 门闩记录） |
| scan_tools | ast-grep+codegraph \| ast-grep \| rg-only（Phase 0 探测；只探测不装） |
| blockers（扫描） | [] 或缺工具时的降级说明（不因此整环 BLOCKED） |
| 停机 | met_target \| regression \| max_rounds \| plateau \| no_fixable_items \| blocked \| user_stop \| session_wall \| stop_file |

## Resume 游标（契约 §12）

| 字段 | 值 |
|------|-----|
| last_round | |
| open_ids | |
| stop_pending | false |
| pending_worktrees | [] |
| escalated_clusters | []（含 `touch_count`；续跑/换环**禁止**从 0 重算） |
| resumed_from | |

## 轮次总分

| Round | Total | Δ | Hard gates | go-fast | spec_reuse | wave_size | merged | summary | 源报告 | 再评报告 |
|------:|------:|--:|------------|---------|:----------:|----------:|--------|---------|--------|----------|
| 1 | 62 | — | 有 | B / DONE | no | 2 | yes | B-1,B-2 | …/slug.md 或 …-r1.md | — |
| 2 | 71 | +9 | 无 | A / DONE | yes | 1 | yes | B-3 | …-r1.md（Fix 回写） | …-r2.md |

Δ = `total_n - total_{n-1}`；第 1 轮记 `—`。高原判定用最近两轮的 `\|Δ\|`（须 ≥3 次 Review）。  
前门失败不增加 Round（记 `gate_fail_streak` / attempts）；**无 Fix 推进**（契约 §5.2.1）增加 Round 但记 `advanced_without_fix: yes`、`gate_fail_streak` 不变、Δ 不记进步。连续空台且未达标 → **dig**（[dig.md](dig.md)）；dig 尽才 `no_fixable_items`。
`summary` = go-fast 回传已处理 ID；有可完成项时禁止空（见编排契约 §3）。

## 处理明细（全量 · 跨轮累积）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | Round | 本轮动作 | 改动摘要 | 验证 | 规格/工单 | 源报告 |
|----|--------|--------|--------|------|------:|----------|----------|------|-----------|--------|
| B-1 | P0 | 是 | 否 | done | 1 | go-fast | … | … | … | …-r1.md |

## 本轮摘要（Round N）

- 计划修（≤batch_size）/ 实际 done / blocked / 剔除（视觉债 / **薄补丁 `thin_patch_rejected`**）/ park
- go-fast：`path` / `spec_reuse` / `status` / `wave_size` / `zero_reason` / `merged_to_base` / `source_report` / `summary` / `writeback_repaired`
- 回写源报告：`<path>`；写者 = go-fast，编排方校验
- `code_review_delta` / `cr_fix_scope`
- 再评前门 B 层：`gate_recheck`（`batch` / `strict_red` / `reasons` / `verify_slices`）+ `evidence_mismatch`；失败 → §5.2 + `gate_fail_streak`
- debt-map：本轮触及簇 + `touch_count` 变化 / 新 `escalated` / 加深切片与 ADR 路径 / 解除为 `deepened`；若 `orchestrator_parent: loop-goal` → `debt_touches[]`（契约 §14.1），不直接改主文件
- `integration_decisions`

## residual_worktrees / 剩余债 / 结论

…
```

**强制**：

1. Fix 后 ledger 与**源报告**「处理清单」、go-fast `summary` 同一批 ID 状态一致。  
2. 再评前门未过 → 不得写「已再评」或伪造 Δ；按 §5.2 记 `gate_fail_streak`。  
3. 再评报告须继承清单；不得只在 `-rN` 新建全 `open` 表。  
4. Phase 5 / 中止须列 `residual_worktrees`（未合并勿假装已清理）。  
5. 本环曾合回 → Phase 5 须记 `full_suite`（或 `skip_full_test` / `never_merged` / `session_wall`）。  
6. Resume 必填游标字段（契约 §12）。  
7. 每个 Fix 轮都要落 debt-map 变更（含「无变化」）；`regression_count` **从不清零**；`escalated` 簇必须能在下一轮找到加深切片或 `blocked` 理由。
