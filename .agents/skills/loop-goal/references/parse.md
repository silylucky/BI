# 参数解析（loop-goal）

| 信号 | 写入 |
|------|------|
| `全仓` / `整仓` / `全仓库` / `多业务线` | 启用舰队模式（本 skill）；**不**写成单个 polishing 的 `scope=整仓` |
| `目标95` / `target=95` / `→ 95` | `target_score`（默认 95） |
| `必须达到目标N` / `必须冲到N` / `不达目标不停` / `直到达标` | `must_reach_target=true`；含 `N` 时同步 `target_score` |
| `持续运行` / `持续` / `一直跑` | 若同句/同轮已有目标分 → `must_reach_target=true` |
| `must_reach_target=true` / `达标模式` | `must_reach_target=true`（传给每军团 polishing） |
| `持续 N 轮` / `至少 N 轮` / `max_rounds=N` / `N轮` | **每军团** `max_rounds=N` 且 `min_rounds=N` |
| `产品` / `product` | lanes 含 `product` |
| `业务流程` / `流程` / `flow` | lanes 含 `flow` |
| `架构` / `arch` | lanes 含 `arch` |
| `UI` / `ui` | lanes 含 `ui` |
| `UX` / `ux` | lanes 含 `ux` |
| `含 code` / `代码` / `lanes=…,code` | lanes 追加 `code` |
| 未列 lanes 但说「产品+业务流程+架构+UI/UX」 | `lanes=product,flow,arch,ui,ux`（默认） |
| `fleet_cap=N` / `最多 N 军团并行` | `fleet_cap` |
| `合回串行` / `serial_all` | `merge_policy=serial_all` |
| `按冲突序合回` / 未提 | `merge_policy=conflict_order` |
| `自动全部修复` / `全修` / 未提 | `fix_scope=all` |
| `仅 P0+P1` | `fix_scope=P0+P1` |
| `有人值守` | `attendance=attended` |
| `无人值守` / 未提 | `attendance=unattended` |
| `集成须先 ADR` / 未提 | `integration_policy=auto_best_require_adr` |
| `集成自动择优` / `auto_best` | `integration_policy=auto_best` |
| `集成停放` / `park` | `integration_policy=park` |
| `stop_file=…` | 覆盖默认 `.stop` |
| `dry_run` / `试跑` / `只盘点` | `dry_run=true`（发现+冲突图，不派军团写树） |
| `续跑` / `resume` / `ledger=` | 舰队 Resume（ledger `phase=loop-goal`） |

## 与姊妹 loop

| 用户意图 | 指向 |
|----------|------|
| 按 plan/PRD 冲实现 | [loop-goal-prd](../../loop-goal-prd/SKILL.md) |
| **单**模块/流程冲产品八维分 | [loop-goal-product](../../loop-goal-product/SKILL.md) |
| **单**模块/子系统多维打磨 | [loop-polishing](../../loop-polishing/SKILL.md) |
| **全仓 / 多业务线**发现后多军团打磨 | **本 skill** |

用户只说 `/loop-goal` 且带「全仓 / 多业务线 / 产品+流程+架构+UI」→ 本 skill。  
用户说 `/loop-goal` 却只点名**一个**已有模块、且不要舰队 → 澄清一句；若坚持单 scope 冲分 → 转 loop-goal-product；单 scope 多维 → 转 loop-polishing。

## 示例

```text
/loop-goal 全仓产品 + 业务流程 + 架构 + UI、UX 进行打磨，目标95，持续10轮
```

```yaml
target_score: 95
must_reach_target: false
max_rounds: 10
min_rounds: 10
lanes: [product, flow, arch, ui, ux]
fix_scope: all
fleet_cap: 10
merge_policy: conflict_order
attendance: unattended
integration_policy: auto_best_require_adr
dry_run: false
```
