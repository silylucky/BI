# 参数解析（loop-polishing）

| 信号 | 写入 |
|------|------|
| `至少 N 轮` / `max_rounds=N` / `N轮` | `max_rounds=N` 且 `min_rounds=N` |
| `最少 N 轮最多 M 轮` | `min_rounds=N`，`max_rounds=M` |
| `持续打磨「…」` / `scope=` / `模块…` / `子系统…` | `scope`；含「子系统」→ `scope_level=subsystem`；含「流程」→ `flow` |
| `目标92` / `target=92` / `→ 92` | `target_score` |
| `必须达到目标N` / `必须冲到N` / `一定要达到N分` / `不达目标不停` / `直到达标` | `must_reach_target=true`；含 `N` 时同步 `target_score` |
| `持续运行` / `持续` / `一直跑` / `不停` | 若同句/同轮已有目标分或 `必须达到` → `must_reach_target=true` |
| `must_reach_target=true` / `达标模式` | `must_reach_target=true` |
| 未提目标分 | `target_score=92` |
| `自动全部修复` / `全修` / 未提（默认） | `fix_scope=all`（含 P2；视觉债在 all 下可修，仍受过抛闸） |
| `仅 P0+P1` / `不含 P2` | `fix_scope=P0+P1`（视觉债剔除；未达标 dig 可临时升 score_P2） |
| `仅 P0` | `fix_scope=P0`（dig **不**扩 P2） |
| `关闭挖掘` / `dig_on_under_target=false` | 清单空可直接 `no_fixable_items`（旧行为） |
| `dig_budget=N` / `挖掘 N 波` | 覆盖默认 dig 预算 |
| `每轮 N 个` / `batch_size=` | `batch_size` |
| `有人值守` | `attendance=attended` |
| `无人值守` / 未提 | `attendance=unattended` |
| `集成自动择优` / `auto_best` | `integration_policy=auto_best` |
| `集成须先 ADR` | `integration_policy=auto_best_require_adr` |
| `集成停放` / `park` | `integration_policy=park` |
| 未提集成档 | `integration_policy=auto_best_require_adr`（**三环统一默认**，契约 §2；不再按 `max_rounds` / profile 阈值推） |
| `高原Δ=` / `regression_stop=` | 覆盖默认 |
| `加深阈值=N` / `deepen_threshold=N` | debt-map 升格阈值（默认 `3`，契约 §14） |
| `关闭过抛停机` / `overpolish_stop=false` | 仍过滤单项，但不全环因过抛停 |
| `过抛可提前停` / `不必跑满` / 未提 | `honor_min_rounds=false`（**默认**） |
| `必须跑满` / `honor_min_rounds=true` | `honor_min_rounds=true` |
| `composite_mode=light\|full` / `轻量综合` / `全量综合` | `composite_mode` |
| `会话最多 N 轮` / `wall=` | `max_wall_rounds_per_session` |
| `强制大范围` / `force_large_scope` | `force_large_scope=true` |
| `CR全修` / 未提（本环默认） | `cr_fix_scope=all` |
| `CR仅 P0+P1` / `cr_fix_scope=P0+P1` | 收窄收尾 CR 自动修 |
| `stop_file=…` / `停止文件=…` | 覆盖默认 `.stop` |
| `跳过全量` / `skip_full_test` | Phase 5 可跳过 |
| `每 N 轮全量` | `full_suite_every=N`（长跑可选） |
| `dry_run` / `试跑一轮` / `dry_run=1` | 只 Round 1 composite，不调 go-fast 写业务树 |
| `续跑` / `resume` / `ledger=` | 编排契约 §12 |

## Profile 推断

| `max_rounds` | `profile` | 默认 `composite_mode` | 默认 `max_wall_rounds_per_session` |
|-------------:|-----------|----------------------|-----------------------------------:|
| ≤20 | `short` | `full` | `min(max_rounds, 10)` |
| 21–200 | `long` | `light` | 20 |
| >200 | `marathon` | `light` | 20（**禁止单会话跑满**） |

**首个 composite 无视上表强制 `full`**（无历史焦点维分可合成；见 [round-roster.md](round-roster.md)）。

示例：`至少10轮` → short；`至少100轮` → long；`至少500轮` → marathon（须跨会话 Resume）。

**轮数是预算上限**：Phase 0 须说明达标/高原/过抛可早停；**未达标时当前 fix_scope 下可修空 → 默认 dig 再停**（非假早停）。**`must_reach_target=true` 时**未达标**无**软停机（契约 §10.6）。详见主 SKILL 与 [dig.md](dig.md)。

## 与姊妹 loop

| 用户意图 | 指向 |
|----------|------|
| 按 plan/PRD 冲实现 | [loop-goal-prd](../../loop-goal-prd/SKILL.md) |
| 只冲产品八维分 | [loop-goal-product](../../loop-goal-product/SKILL.md) |
| 全仓 / 多业务线舰队打磨 | [loop-goal](../../loop-goal/SKILL.md) |
| 多维持续打磨/抛光（单 scope） | **本 skill** |

`scope` 未给且无法推断 → **不要开评**，`BLOCKED` / `stop_reason: blocked`。  
「持续系统」无模块名 → 问一句或从对话最近子系统推断；仍不可 → `BLOCKED`。  
整仓级 scope 或预估 open >15（阈值真源：契约 §13）→ 除非 `force_large_scope`，否则 `BLOCKED`。

契约不明：见编排契约 §2；默认档见上表。

## 示例

```text
loop-polishing 持续打磨代码审核 至少10轮
```

```yaml
scope: 代码审核
scope_level: module
min_rounds: 10
max_rounds: 10
max_wall_rounds_per_session: 10
profile: short
target_score: 92
fix_scope: all
honor_min_rounds: false
composite_mode: full
attendance: unattended
integration_policy: auto_best_require_adr   # 三环统一默认
cr_fix_scope: all
stop_file: ".stop"
```

```text
loop-polishing 持续打磨代码审核 至少100轮
```

```yaml
scope: 代码审核
min_rounds: 100
max_rounds: 100
profile: long
composite_mode: light   # 但 Round 1 的 composite 仍强制 full
batch_size: 3
max_wall_rounds_per_session: 20
```

```text
loop-polishing 持续系统 至少500轮
```

若「系统」可解析为某子系统名则用之；否则 `BLOCKED` 并提示补 `scope=`。

```yaml
# 可解析时
scope: <推断的子系统>
min_rounds: 500
max_rounds: 500
profile: marathon
batch_size: 2
composite_mode: light
max_wall_rounds_per_session: 20
plateau_min_composites: 3
plateau_composites: 3
# 单会话跑满 20 评分台后 session_wall → Resume
```
