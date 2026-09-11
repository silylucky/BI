# 轮次台账（loop-polishing）

路径：`docs/material/loop-polishing/<YYYY-MM-DD>-<slug>-ledger.md`

```markdown
# Loop-Polishing Ledger · <scope>

| 字段 | 值 |
|------|-----|
| target / fix_scope / batch_size | 92 / all / 5 |
| dig | on · budget=2 · used=0 · remaining=2 |
| profile / min/max_rounds / wall | short\|long\|marathon / N / N / wall |
| must_reach_target | false（§10.6 达标模式） |
| composite_mode | light\|full |
| attendance / integration_policy | unattended / auto_best_require_adr |
| cr_fix_scope | all |
| stop_file / stop_pending | .stop / false |
| plateau_* / regression_stop | … |
| honor_min_rounds / dry_run | false / false |
| gate_fail_streak | 0 |
| debt_map / deepen_threshold | docs/material/debt-map.md / 3 |
| escalated_clusters | [] |
| base_branch | … |
| scan_tools | ast-grep+codegraph \| ast-grep \| rg-only（Phase 0 探测；只探测不装） |
| blockers（扫描） | [] 或缺工具时的降级说明（不因此整环 BLOCKED） |
| 停机 | met_target \| max_rounds \| plateau \| regression \| overpolish \| stop_file \| blocked \| user_stop \| no_fixable_items \| dry_run \| session_wall |

## Resume 游标（契约 §12）

| 字段 | 值 |
|------|-----|
| last_round | |
| open_ids | |
| stop_pending | false |
| pending_worktrees | [] |
| escalated_clusters | []（含 `touch_count`；续跑/换环**禁止**从 0 重算） |
| resumed_from | |

## 综合分（仅 composite 更新 total）

| Round | lane | Total | stale | Δ | Hard | 过抛剔除数 | go-fast | spec_reuse | wave | merged | 无Fix推进 | summary | 报告 |
|------:|------|------:|:-----:|--:|------|----------:|---------|:----------:|-----:|--------|:--------:|---------|------|
| 1 | composite | 68 | no | — | 有 | 2 | B/DONE | no | 2 | yes | no | … | …-r1.md |
| 2 | code | 68 | yes | — | 有 | 0 | B/DONE | yes | 1 | yes | no | … | …-r2.md |
| 3 | arch | 68 | yes | — | 无 | 3 | skipped | — | 0 | no | **yes** | — | …-r3.md |
| 4 | composite | 74 | no | +6 | 无 | 1 | A/DONE | yes | 1 | yes | no | … | …-r4.md |

前门失败不增加 Round。**无 Fix 推进**（契约 §5.2.1）**增加** Round，不记 Δ。连续空台且未达标 → **dig**（[dig.md](dig.md)），ledger 标 `dig_wave`；dig 预算尽仍空 → `no_fixable_items`。  
高原仅用 composite Δ（契约 §0）。

## 八维快照（每次 composite）

| Round | mode | 产品任务 | 业务流程 | 架构边界 | 代码诚实 | 视觉密度 | 交互反馈 | 邻域契合 | UX闭环 | Total |
|------:|------|---------:|---------:|---------:|---------:|---------:|---------:|---------:|-------:|------:|
| 1 | full | | | | | | | | | |

## 处理明细（跨轮累积）

| ID | lane | 优先级 | 硬门槛 | 过抛风险 | 视觉债 | 状态 | Round | 动作 | 摘要 | 验证 | 规格/工单 | 报告 |
|----|------|--------|--------|----------|--------|------|------:|------|------|------|-----------|------|
| C-1 | code | P0 | 是 | 否 | 否 | done | 1 | go-fast | … | … | … | …-r1.md |

## 本轮摘要（Round N）

- lane / roster 理由 / composite_mode
- `.stop` 检测：存在？→ `stop_pending`
- 计划修（≤batch_size）/ 实际 done / 过抛剔除 / **薄补丁剔除 `thin_patch_rejected`** / 视觉债剔除 / park
- go-fast：`path` / `spec_reuse` / `status` / `wave_size` / `zero_reason` / `merged_to_base` / `summary`
- 再评前门 B 层：`gate_recheck`（`batch` / `strict_red` / `reasons` / `verify_slices`）+ `evidence_mismatch`；失败 → `gate_fail_streak`
- debt-map：本轮触及簇 + `touch_count` 变化 / 新 `escalated` / `deepen_pending` / 加深切片与 ADR 路径 / 解除为 `deepened`；若 `orchestrator_parent: loop-goal` → 另落 `debt_touches[]`（契约 §14.1），**不**直接改主 `debt-map.md`
- 过抛闸；**禁止**空转 Review-only 凑 min_rounds
- `residual_worktrees` / `integration_decisions`

## 剩余债 / 结论

…
```

**强制**：

1. Fix 后 ledger 与源报告处理清单、go-fast `summary` 同批 ID 一致。  
2. 再评前门未过 → 不得伪造 Δ / 抬分；记 `gate_fail_streak`。  
3. 非 composite 轮必须 `total_stale: yes`。  
4. Phase 5 / 中止须列 `residual_worktrees`；曾合回 → 记 `full_suite`（或 `session_wall` / `dry_run`）。  
5. `stop_file` 触发须写明检测轮次与路径。  
6. `round` = 评分台序号；见 [state-machine.md](state-machine.md)。  
7. 达目标/过抛/高原 → **禁止**记「Review-only 凑轮」。未达标清单空 → 必须有 dig 行或显式 `dig_remaining=0` 后才可 `no_fixable_items`；可记 `min_rounds_unmet`。  
8. Resume 必填游标；marathon 达墙后必须更新游标供下会话续跑。  
9. 每个 Fix 轮都要落 debt-map 变更（含「无变化」）；`regression_count` **从不清零**；`escalated` 簇必须能在下一轮 ledger 找到加深切片或 `blocked` 理由。军团模式写 `debt_touches[]` / 分片，由舰队合入后串行 merge（§14.1）。
