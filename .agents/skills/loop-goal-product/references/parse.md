# 参数解析（loop-goal-product）

| 信号 | 写入 |
|------|------|
| `目标95` / `target=95` / `→ 95` | `target_score` |
| `必须达到目标N` / `必须冲到N` / `一定要达到N分` / `不达目标不停` / `直到达标` | `must_reach_target=true`；含 `N` 时同步 `target_score` |
| `持续运行` / `持续` / `一直跑` / `不停` | 若同句/同轮已有目标分或 `必须达到` → `must_reach_target=true` |
| `must_reach_target=true` / `达标模式` | `must_reach_target=true` |
| `审核里程碑「…」` / `scope=` | `scope`；级别偏 `module` 或 `flow` |
| `自动全部修复` / `全修` / 未提 | `fix_scope=all`（含 P2） |
| `仅 P0+P1` / `不含 P2` | `fix_scope=P0+P1` |
| `仅 P0` | `fix_scope=P0` |
| `每轮 N 个` / `batch_size=` / `batch=` | `batch_size`（默认 5） |
| `最多 N 轮` | `max_rounds` |
| `会话最多 N 轮` / `wall=` | `max_wall_rounds_per_session` |
| `有人值守` | `attendance=attended`（Fix 时 seam/合回跟 go-fast 停问） |
| `无人值守` / 未提 | `attendance=unattended` |
| `集成自动择优` / `auto_best` | `integration_policy=auto_best` |
| `集成须先 ADR` / `auto_best_require_adr` | `integration_policy=auto_best_require_adr` |
| `集成停放` / `park` | `integration_policy=park` |
| 未提集成档 | `integration_policy=auto_best_require_adr`（**三环统一默认**，契约 §2；不再按 `max_rounds` 阈值推） |
| `停止文件=…` / `stop_file=…` | 覆盖默认 `.stop`（契约 §10.5） |
| `强制大范围` / `force_large_scope` | `force_large_scope=true` |
| `CR全修` / `cr_fix_scope=all` | `cr_fix_scope=all`（默认 `P0+P1`） |
| `高原Δ=N` / `plateau_delta=` | `plateau_delta`（默认 2；比较的是 `\|Δ\|`） |
| `回归停=N` / `regression_stop=` | `regression_stop`（默认 5） |
| `加深阈值=N` / `deepen_threshold=N` | debt-map 升格阈值（默认 `3`，契约 §14） |
| `跳过全量` / `skip_full_test` | Phase 5 可跳过全量（回传注明） |
| `关闭挖掘` / `dig_on_under_target=false` | 可修空可直接 `no_fixable_items` |
| `dig_budget=N` / `挖掘 N 波` | 覆盖默认 dig 预算（默认 2） |
| `续跑` / `resume` / `ledger=` | 编排契约 §12 Resume |

`review_skill` / `fix_skill` **固定**为 product-reviewer（`mode: loop-lane`）/ go-fast；用户点名按 plan/PRD 冲实现 → 指向 [loop-goal-prd](../../loop-goal-prd/SKILL.md)。  
全仓 / 多业务线 /「产品+流程+架构+UI」舰队 → 指向 [loop-goal](../../loop-goal/SKILL.md)（**不要**在本 skill 开整仓）。

`scope` 未给且无法推断 → **不要开评**，回传 `BLOCKED` / `stop_reason: blocked`。  
预估 open >15 或「整仓」级 scope → **除非** `force_large_scope`，否则 `BLOCKED`（见主 SKILL Phase 0）；用户要舰队切开 → 转 loop-goal。

契约不明：见 [loop-orchestrator-contract.md](../../go-fast/references/loop-orchestrator-contract.md) §2；默认档按上表。**不要**解析成「一律 BLOCKED」。

双环：用户说「先做完 plan 再冲分」→ 先 [loop-goal-prd](../../loop-goal-prd/SKILL.md)，再本 skill（编排契约 §10）。

## 示例

```text
/loop-goal-product 使用 /product-reviewer 审核里程碑「CMDB 变更审核」，并使用 /go-fast 执行自动全部修复，目标95分，持续运行直到达标
```

```yaml
target_score: 95
must_reach_target: true    # 「持续运行」+「必须达到目标95」→ 禁高原/回归/轮数上限软停
fix_scope: all
```

```text
/loop-goal-product 使用 /product-reviewer 审核里程碑「CMDB 变更审核」，并使用 /go-fast 执行自动全部修复，目标95分
```

```yaml
target_score: 95
fix_scope: all
batch_size: 5
scope: CMDB 变更审核
scope_level: module
max_rounds: 5
max_wall_rounds_per_session: 5              # = max_rounds，默认不额外生效
attendance: unattended
integration_policy: auto_best_require_adr   # 三环统一默认
cr_fix_scope: P0+P1
dig_on_under_target: true
dig_budget: 2
must_reach_target: false
stop_file: ".stop"
plateau_delta: 2
regression_stop: 5
```
