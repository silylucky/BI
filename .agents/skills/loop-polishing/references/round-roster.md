# 轮次 roster（焦点轮转）

长跑禁止每轮全量四 reviewer（贵且易过抛）。按 `profile` 选节奏；**Round 1 永远 `composite`**。  
选 lane / 计轮以 [state-machine.md](state-machine.md) 为准（再评 = 下一评分台，在该台开始时选 lane）。

**`composite_mode`**：`short` 默认 `full`；`long`/`marathon` 默认 `light`（合成上次焦点维分 + 抽检硬门槛）。用户可覆盖。

**首个 composite 强制 `full`（硬规则，不可被 `composite_mode` 或用户覆盖降级）**：`light` 的定义是「合成**上次**焦点维分」，而 Round 1 没有任何历史焦点轮可合成。若首轮用 `light`，八维基线只能凭空捏造，之后所有 `Δtotal` / 高原 / `target_score` 判定都建在假基线上。因此：

| 情形 | `composite_mode` |
|------|------------------|
| Round 1（强制 composite） | **`full`**（重新取证算全八维），无论 `profile` |
| Resume 后本会话的首个 composite，且 ledger 已有历史八维快照 | 可 `light`（有源可合成） |
| Resume 后本会话的首个 composite，但 ledger 无八维快照 | **`full`** |
| 其余 composite | 按 `composite_mode` |

回传 `rounds[].composite_mode` 须如实记录本台实际用的模式；ledger 八维快照表的 `mode` 列同理。

## short（≤20）

建议循环：

```text
composite → code → product → ui → composite → flow → ux → neighbor → composite → …
```

- 每 **3** 轮至少 1 次 `composite`
- 可同轮轻量并行 2 个 lane（仍只产一份合并清单）；标 `lane: code+ui`

## long（21–200）

```text
composite → code → product → ui → arch → flow → ux → neighbor →
composite → code → …（重复）
```

- 每 **8** 轮至少 1 次 `composite`（`composite_every=8`）
- 单轮单主 lane；禁止每轮四审齐开
- 可选 `full_suite_every=50`（用户显式才开）

## marathon（>200）

```text
composite → code → code → product → ui → neighbor → flow → arch → ux →
（每 12 轮 composite）
```

- `composite_every=12`；默认 `composite_mode=light`
- `batch_size=2`；更狠过抛闸
- 高原：`plateau_min_composites=3` 且 `plateau_composites=3`（最近 3 次可计算 composite `|Δ| < plateau_delta`）→ `plateau` / 过抛闸（与主 SKILL **同一**定义，不另发明停机规则）
- **禁止单会话跑满**：`max_wall_rounds_per_session` 默认 20；达墙 → `session_wall` + Resume（契约 §12）
- 默认不中途全量（只 Phase 5）；除非用户设 `full_suite_every`
- 选 lane 发生在**每一评分台开始时**（含 Fix 后的再评轮）；见 [state-machine.md](state-machine.md)

## 选 lane 启发式（可覆盖表）

| 条件 | 下一 lane 优先 |
|------|----------------|
| 硬门槛多为 stub/半成品 | `code` |
| 主路径/权责刺点多为 | `product` / `flow` |
| 壳/空态/提交反馈 | `ui` / `ux` |
| 改一处炸一片 | `arch`（只收集；Fix 仍过滤） |
| debt-map 有 `escalated` 簇 | **强制**下一台排入该簇的加深切片（`refactor-shared` 独占一波；契约 §14）；lane 照常轮转 |
| 与邻菜单/状态不一致 | `neighbor` |
| 距上次 composite ≥ composite_every | **强制** `composite` |
| **`dig_active`（未达标挖掘）** | 对准最近 composite **低于 target** 的维选 lane（见 [dig.md](dig.md)）；多维低 → **强制** `composite` + `full`；禁止复读上一台同 lane 无新指令 |
| `stop_pending` | 可做完本轮；下轮不开始 |

## 报告命名

- `…-r1.md` 起；不覆盖  
- 文件头 YAML 或首表须含：`lane` / `round` / `scope` / `total`（或 stale）
