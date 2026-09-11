# 舰队汇总报告（loop-goal Phase 5）

路径：`docs/material/loop-goal/<YYYY-MM-DD>-<slug>-fleet-report.md`

**目的**：一场 `loop-goal` 结束后，用**一份**可读报告回答「跑了哪些军团/多少轮、修了啥、还剩啥」，不必翻 N 份子 ledger。

**何时写**：舰队 Phase 5（含 `dry_run` / `session_wall` / `stop_file` 骨架收尾）；Resume 到终态时**覆盖更新**同一 `slug` 的报告（或写 `-fleet-report-r<N>.md` 若用户要求保留历史）。

**材料来源**（只汇总，禁止臆造）：

- 舰队 ledger · product-map · conflict-graph  
- 各军团 `legion_ledger` + 各轮 `…-r<N>.md` 处理清单 / go-fast `summary`

---

## 模板

```markdown
# Loop-Goal Fleet Report · <slug>

| 字段 | 值 |
|------|-----|
| 日期 / base_branch | … |
| target / rounds_per_legion / lanes | 95 / 10 / product,flow,arch,ui,ux |
| 波次数 / 军团数（派出/完成/blocked/延期） | … |
| fleet_cap / merge_policy | 10 / conflict_order |
| 全量 | ran=yes\|no · 结果=绿\|红\|skipped(…) |
| 停机 | fleet_met_target \| fleet_complete \| … |
| 关联 | product-map · conflict-graph · fleet-ledger |

## 1. 一句话结论
（达标 / 部分达标 / 中断；人话，禁止堆 jargon）

## 2. 舰队总览
| 军团 | scope | 轮数(完成) | 首分→末分 | met? | 停因 | 合入 base? |
|------|-------|----------:|----------|------|------|------------|

## 3. 本场已解决（跨军团汇总）
按优先级列出**已 `done`/`verified`** 的 finding（从各军团 ledger「处理明细」并集去重）：

| ID | 军团 | lane | 优先级 | 硬门槛 | 摘要（人话） | 轮次 |
|----|------|------|--------|--------|--------------|------:|

可按域再分小节：产品任务 / 流程 / 架构 / UI / UX / 代码。

**统计**：P0 清 N · P1 清 N · P2 清 N · 硬门槛清 N · 薄补丁打回 N · 过抛剔除 N

## 4. 本场做过的关键改动（可选短表）
| 军团 | 规格/工单或模块路径 | 一句话 |
|------|---------------------|--------|
（来自 go-fast summary / 源报告，无则写「见军团 ledger」）

## 5. 未解决 / 延期 / 合回失败
| ID或项 | 军团 | 状态 | 原因 | 建议下一跳 |
|--------|------|------|------|------------|
（含 deferred_legions、合回 `blocked`、park、dig 耗尽）

## 6. 全量与残留
- full_suite：…
- residual_worktrees / 未合入分支：…

## 7. 续跑（若未终态）
```text
loop-goal-resume ledger=docs/material/loop-goal/<…>-fleet-ledger.md
```
```

---

## 强制

1. Phase 5 **必须**落盘本报告（`dry_run` 可只含地图/冲突图结论 +「未派军团」）；路径写入舰队 ledger「结论」与回传 `artifacts`。  
2. 「已解决」表**只**收各军团 ledger 已标 `done`/`verified` 且与 go-fast `summary` 一致的 ID；禁止把过抛剔除 / 薄补丁打回算进已解决。  
3. 对话 Phase 5 摘要须给出本报告**绝对路径** + 统计一行（清了多少 P0/P1、几支军团达标）。  
4. **不替代**各军团详细 ledger；本报告是索引式汇总。
