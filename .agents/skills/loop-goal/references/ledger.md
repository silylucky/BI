# 舰队台账（loop-goal）

路径：`docs/material/loop-goal/<YYYY-MM-DD>-<slug>-fleet-ledger.md`

```markdown
# Loop-Goal Fleet Ledger · <slug>

| 字段 | 值 |
|------|-----|
| phase | loop-goal |
| target / rounds_per_legion / lanes | 95 / 10 / product,flow,arch,ui,ux |
| fix_scope / attendance / integration_policy | all / unattended / auto_best_require_adr |
| fleet_cap / merge_policy | 10 / conflict_order |
| base_branch | … |
| stop_file / stop_pending | .stop / false |
| dry_run | false |
| product_map | docs/material/loop-goal/…-product-map.md |
| conflict_graph | docs/material/loop-goal/…-conflict-graph.md |
| scan_tools | … |
| 停机 | fleet_met_target \| fleet_complete \| dry_run \| blocked \| user_stop \| session_wall \| stop_file |
| full_suite | ran=… / skipped_reason=…（舰队收尾 ≤1 次；军团侧均为 deferred_to_fleet） |

## Resume 游标

| 字段 | 值 |
|------|-----|
| current_wave | |
| pending_legion_ids | |
| stop_pending | false |
| pending_worktrees | [] |
| resumed_from | |

## 波次

| Wave | Legion IDs | 状态 | 合入 base？ | 备注 |
|-----:|------------|------|------------|------|
| 1 | L1,L3 | done | yes | |
| 2 | L2 | running | no | |

## 军团

| ID | scope | branch | worktree | status | total | met | stop_reason | legion_ledger | 报告 |
|----|-------|--------|----------|--------|------:|:---:|-------------|---------------|------|
| L1 | … | loop-goal/…/L1 | .worktrees/… | done | 96 | yes | met_target | …-ledger.md | … |

## 本波摘要

- 派出 / 完成 / crashed / 合回冲突
- `.stop` 检测
- `residual_worktrees`

## 延期军团 / blockers

…

## 结论

- fleet_report: docs/material/loop-goal/…-fleet-report.md
- …

…
```

## 强制

1. 每个已派出军团必须有行；`running` 超过会话结束未更新 → Resume 时视为 `interrupted`。  
2. `status=done*` 必须有 `legion_ledger` 路径（dry_run 除外）。  
3. Phase 5 / 中止须列 `pending_worktrees` / `residual_worktrees`（结构同契约 §5.3.1）。  
4. Resume **只**依据本文件 + 子 ledger；禁止凭记忆重造军团表。  
5. 合入 base 后更新波次「合入」列；未合入不得删 worktree。  
6. 舰队 `stop_reason` 与各军团 `stop_reason` 分开记，禁止用单一军团达标冒充 `fleet_met_target`（须全部应付军团达标或用户收窄范围）。  
7. Phase 5 必须落盘 [fleet-report.md](fleet-report.md) 汇总报告，并在本「结论」节写上路径。
