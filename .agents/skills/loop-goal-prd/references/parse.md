# 参数解析（loop-goal-prd）

| 信号 | 写入 |
|------|------|
| `当前节` / `scope=M2` / `里程碑「…」` | `scope`（节号或名称） |
| `PRD F01,F02` / `分片=…` | `scope` = ID 列表 |
| `全部未完成` / `scope=all` | `scope=全部未完成` |
| `每轮 N 个` / `batch_size=` | `batch_size` |
| `最多 N 轮` | `max_rounds` |
| `会话最多 N 轮` / `wall=` | `max_wall_rounds_per_session` |
| `有人值守` | `attendance=attended` |
| `无人值守` / `冲锋` / 未提 | `attendance=unattended` |
| `集成自动择优` / `auto_best` | `integration_policy=auto_best` |
| `集成须先 ADR` / `auto_best_require_adr` | `integration_policy=auto_best_require_adr` |
| `集成停放` / `park` | `integration_policy=park` |
| 未提集成档 | `integration_policy=auto_best_require_adr`（**三环统一默认**，契约 §2；不再按 `max_rounds` 阈值推） |
| `强制大范围` / `force_large_scope` | `force_large_scope=true` |
| `CR全修` / `cr_fix_scope=all` | `cr_fix_scope=all` |
| `高原轮=N` / `plateau_rounds=` | `plateau_rounds`（默认 2；只计 Fix 后 DoneΔ） |
| `回归轮=N` / `regression_rounds=` | `regression_rounds`（默认 2；只计 Fix 后 `delta_remaining>0`） |
| `加深阈值=N` / `deepen_threshold=N` | debt-map 升格阈值（默认 `3`，契约 §14） |
| `关闭挖掘` / `dig_on_under_target=false` | `remaining>0` 时也可直接 `no_fixable_items`（旧行为） |
| `dig_budget=N` / `挖掘 N 波` | 覆盖默认 dig 预算（默认 2） |
| `必须冲完` / `必须做完` / `直到 scope 清零` / `必须达到`（无分数，指交付） | `must_reach_target=true`（达标 = `scope_clear`） |
| `持续运行` / `持续` / `一直跑` / `不停` | 若同句/同轮已有 `必须冲完` / `scope_clear` 意图 → `must_reach_target=true` |
| `must_reach_target=true` / `达标模式` | `must_reach_target=true` |
| `停止文件=…` / `stop_file=…` | 覆盖默认 `.stop`（契约 §10.5） |
| `跳过全量` / `skip_full_test` | Phase 5 可跳过全量（回传注明） |
| `续跑` / `resume` / `ledger=` | 编排契约 §12（显式 resume） |
| `继续` / `接着跑` / `接着冲` / `接着干` / `continue` | **soft resume**（等同 `/loop-goal-prd-resume`；见下） |
| `/loop-goal-prd-resume` | 显式 resume 入口；可带或不带 `ledger=` |

`prd_skill` / `plan_skill` / `fix_skill` **固定**；`arch_ref` 默认 `docs/arch.md`。  
用户点名只要改文档冲分、不要写代码 → 说明本 skill 已是**实现闭环**，文档体检请直接调 create-evolution-*。  
用户点名产品八维冲分 → 指向 [loop-goal-product](../../loop-goal-product/SKILL.md)（编排契约 §10：可先本环再冲分）。

`scope` 未给且无法从「当前节」/对话推断 → **不要开工**，`BLOCKED`。  
缺 `goal.md` / PRD / `plan.md` / `arch.md` → **不要开工**，`BLOCKED`。  
`scope=全部未完成` 或预估 open >15 → **除非** `force_large_scope`，否则 `BLOCKED`。

无人值守下契约不明：按 Phase 0 默认档（常为 `auto_best_require_adr`）；见 [loop-orchestrator-contract.md](../../go-fast/references/loop-orchestrator-contract.md) §2。与 loop-goal-product **同一口径**。

## Soft resume（「继续」≡ resume）

用户只说「继续 / 接着跑 / continue」等、**未**给新 `scope=`、也**未**给 `ledger=` 时，**不得**新开环，应按编排契约 §12 续跑：

1. **同会话优先**：本会话已有本环 ledger 路径（回传 / Phase 5 提示 / 对话上下文）→ 用该路径。  
2. **否则自动解析**：在仓根取 `docs/material/loop-goal-prd/*-ledger.md` 中 **mtime 最新**且正文 `phase: loop-goal-prd`（或等价标明本环）的一份；回传 `resumed_from` + `ledger_resolved: auto_latest`。  
3. **多候选歧义**（同秒多份 / 无法判定 phase / 最新份 `met_target: true` 且 `remaining==0` 而更早份仍未清）→ **不要猜**；列出 2–3 个路径问用户，或 `BLOCKED`。  
4. **零候选** → `BLOCKED`，提示先跑 `/loop-goal-prd` 或显式 `ledger=`；**禁止**把裸「继续」解释成「全部未完成新开冲锋」。  
5. 用户**同时**给了新 `scope=` / `force_large_scope` 等开工参数 → 视为**新开**，不是 resume（除非明确「在旧 ledger 上改 scope 续」）。  
6. `.stop` / `stop_pending` 仍在 → 契约 §10.5 / §12：只收尾，不新开 Fix。

## 示例

```text
/loop-goal-prd 按 plan 当前节 + PRD + arch，go-fast 无人值守冲完
```

```text
继续
```

```text
/loop-goal-prd-resume ledger=docs/material/loop-goal-prd/2026-07-30-m2-ledger.md
```

```yaml
scope: 当前节
batch_size: 10
max_rounds: 8
max_wall_rounds_per_session: 8              # = max_rounds，默认不额外生效
attendance: unattended
integration_policy: auto_best_require_adr   # 三环统一默认
cr_fix_scope: P0+P1
plateau_rounds: 2
regression_rounds: 2
dig_on_under_target: true
dig_budget: 2
must_reach_target: false
stop_file: ".stop"
arch_ref: docs/arch.md
```
