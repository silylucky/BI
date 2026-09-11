---
name: loop-polishing
description: >
  Use when the user says loop-polishing / 持续打磨 / 抛光循环 / 多维打磨 /
  指定模块持续优化 / 至少 N 轮打磨, or wants multi-reviewer score→go-fast polish
  loops on a module/subsystem (product, arch, flow, UX, code) with over-polish
  guards and .stop graceful exit — short (10+) or long (100/500) unattended runs.
  Supports must_reach_target mode (持续运行直到目标分): no soft stop while under target_score.
  Also use to resume an interrupted polish loop (required for long/marathon,
  which must span sessions): loop-polishing-resume / 续跑 / resume
  ledger=docs/material/loop-polishing/<date>-<slug>-ledger.md.
---

# Loop-Polishing（多维打磨 · 评 → 修 → 再评）

编排 skill：对用户指定的 **模块 / 子系统**（可含相关邻域）做多维取证打分，再调 [go-fast](../go-fast/SKILL.md) 修可修项，循环抛光。

消费的 reviewer（按轮次焦点 Read 并执行，禁止假装跑过）：


| 焦点 lane     | Skill                                                                                          | 主看                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `product`   | [product-reviewer](../product-reviewer/SKILL.md)                                               | 任务价值、流程权责、信任                                                                                      |
| `flow`      | product-reviewer（`scope_level=flow`）                                                           | 端到端状态机 / 例外                                                                                       |
| `arch`      | [arch-reviewer](../arch-reviewer/SKILL.md)                                                     | depth/seam/locality；按**授权级三档**放行（`polish_safe` 自动 / `local-deepen` 升格时必做 / `structural` deferred） |
| `code`      | [code-reviewer](../code-reviewer/SKILL.md)                                                     | 假绿·stub·可靠性·半成品表面                                                                                 |
| `ui`        | [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md)                                                   | 视觉密度、菜谱、语义色、壳导航                                                                                   |
| `ux`        | ui-ux + product 交叉（**执行定义见 [finding-normalize.md](references/finding-normalize.md)「复合 lane」**） | 交互反馈、空态、可发现                                                                                       |
| `neighbor`  | product/code 邻域抽检（**同上**）                                                                      | 与相关模块裂缝、重复、不一致                                                                                    |
| `composite` | 本 skill 合成台                                                                                    | 八维综合分（见 [dimensions.md](references/dimensions.md)）                                                |


共享舰队 / 回写 / 契约门 / 全量纪律见  
[go-fast/references/loop-orchestrator-contract.md](../go-fast/references/loop-orchestrator-contract.md)（下称**编排契约**）。  
每轮前门前轻量卡片：[loop-orchestrator-card.md](../go-fast/references/loop-orchestrator-card.md)。  
`orchestrator: loop-polishing`。

**不是** Cursor 定时 `/loop`；**不是** [loop-goal-prd](../loop-goal-prd/SKILL.md)（冲交付完成度）；**不是** [loop-goal-product](../loop-goal-product/SKILL.md)（单 skill 冲产品八维分）；**不是** [loop-goal](../loop-goal/SKILL.md)（全仓发现后多军团舰队；本 skill 只做**单 scope** 打磨，可被 loop-goal 当作军团调用）。  
本 skill = **有界 scope 上的多维持续打磨**，带**反过抛**与 `.stop` **优雅停机**。

## 何时启用


| 场景                            | 动作                      |
| ----------------------------- | ----------------------- |
| `loop-polishing 持续打磨 … 至少10轮` | 短跑 profile；可每轮多 lane    |
| `… 至少100轮` / 通宵               | 长跑；轮转焦点 + 定期 composite  |
| `… 至少500轮` / 多天               | 马拉松；更稀的 composite、更严过抛闸 |
| 指定模块/子系统反复抛光                  | 固定 `scope`；邻域只读抽检       |


**不要**：无 `scope` 空想整仓抛光（整仓 / 多业务线 → [loop-goal](../loop-goal/SKILL.md)）；用本环冒充 plan/PRD 完成；硬门槛未消却空转 P2 像素；与 loop-goal-* **并行**改同一 `base_branch`；把 arch Speculative 候选当必修。  
**三环交接**：见编排契约 §10（推荐 prd → product → polishing；禁止并行改同一 base）。

## 默认参数


| 键                             | 默认                                                       | 说明                                                                                     |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `fix_skill`                   | `go-fast`                                                | **固定**                                                                                 |
| `scope`                       | **必填或可推断**                                               | 模块/子系统名；不可推断 → Phase 0 `BLOCKED`                                                       |
| `scope_level`                 | `module`                                                 | `module` | `subsystem` | `flow`                                                        |
| `max_rounds`                  | 从「至少 N 轮」解析；缺省 `10`                                      | 以已完成 **Composite 或等价评分台** 次数计（见轮次定义）                                                   |
| `min_rounds`                  | 同 `max_rounds` 解析出的 N                                    | 「至少 N」= 承诺下限；见 `honor_min_rounds`                                                      |
| `target_score`                | `92`                                                     | 八维综合算术平均；可改                                                                            |
| `fix_scope`                   | `all`                                                    | 含 P0+P1+P2；用户说「仅 P0+P1」可收窄。纯口味 `视觉债=是` 在 `all` 下可进 batch（仍受过抛闸）；收窄为 `P0+P1` 时视觉债剔除（见 anti-overpolish） |
| `attendance`                  | `unattended`                                             | 长跑默认无人值守                                                                               |
| `integration_policy`          | `auto_best_require_adr`                                  | **三环统一默认**（契约 §2）；用户显式才降 `auto_best` 或改 `park`                                         |
| `profile`                     | 由 N 推断                                                   | `short`（N≤20）/ `long`（21–200）/ `marathon`（>200）；语义见下「轮数是预算上限」                          |
| `plateau_delta`               | `1.5`                                                    | 可计算 composite `|Δtotal| <` 此值 → 高原候选                                                   |
| `plateau_min_composites`      | `2`（short）/ `3`（long）/ `3`（marathon）                     | 高原须已完成至少这么多次 **composite**                                                             |
| `plateau_composites`          | `2`（short/long）/ `3`（marathon）                           | 最近这么多次可计算 `|Δtotal|` 均 `< plateau_delta` → 高原                                           |
| `regression_stop`             | `4`                                                      | 可计算 `Δtotal ≤ -regression_stop` → 停机                                                   |
| `overpolish_stop`             | `true`                                                   | 命中过抛闸 → 意图停机                                                                           |
| `honor_min_rounds`            | `false`                                                  | **默认 false**：达目标/过抛/高原可早停；用户说「必须跑满」才 `true`                                           |
| `dig_on_under_target`         | `true`                                                   | 未达标却清单空 → **先挖**再停；`关闭挖掘` → `false`（见 dig.md）                                        |
| `dig_budget`                  | `2`（short）/ `3`（long/marathon）                          | 未达标挖掘波数上限；耗尽仍空才 `no_fixable_items`                                                     |
| `batch_size`                  | `5`（short）/ `3`（long）/ `2`（marathon）                     | 每轮最多纳入 go-fast 的可修 ID                                                                  |
| `stop_file`                   | `.stop`                                                  | 仓库根（工作区 root）相对路径；见 Phase 0.5                                                          |
| `full_suite_every`            | `0`（仅 Phase 5）/ long 可 `50`                              | 可选中途全量；默认只整环一次                                                                         |
| `composite_every`             | 见 [round-roster.md](references/round-roster.md)          | 非 composite 轮次只跑焦点 lane，ledger 记 `partial`                                             |
| `composite_mode`              | `light`（long/marathon）/ `full`（short）                    | `light`=合成上次焦点维分 + 抽检硬门槛；`full`=重跑取证合成                                                 |
| `max_wall_rounds_per_session` | `min(max_rounds, 10)`（short）/ `20`（long）/ `20`（marathon） | short 下常等于 `max_rounds` 故不额外生效；long/marathon 真正生效。marathon **禁止**单会话跑满；达墙 → §12 Resume |
| `force_large_scope`           | `false`                                                  | 阈值以契约 §13「大 scope 数值真源」为准：整仓 / open 项 >15 须显式 true，否则 `BLOCKED`                        |
| `cr_fix_scope`                | `all`                                                    | 本环默认与 `fix_scope` 同为全修；用户说「CR 仅 P0+P1」可收窄。prd/product 环仍默认 `P0+P1`（契约 §8） |
| `dry_run`                     | `false`                                                  | `true`：只 Round 1 composite，禁止 go-fast 写业务树                                             |
| `must_reach_target`           | `false`                                                  | `true` = 持续运行直到 `total >= target_score`；**禁**软停机（契约 §10.6）                          |




### 轮次定义（与 product 同构 · 防双评）

完整状态机见 [references/state-machine.md](references/state-machine.md)。摘要：

- `round` = 已完成**评分台**次数（报告 `…-r<n>.md` 一对一）；Fix 后的再评 = **下一** `round`，不是同轮二次 Review。前门失败 **不** +`round`（`gate_fail_streak`，契约 §5.2）。  
- **总分** `total`：仅 **composite** 更新 `total` / `Δtotal`；焦点轮 `total_stale: true`。  
- **停机用分**：最近一次 composite 的 `total`；首轮必须 composite（且首个 composite 必须 `composite_mode=full`，见下）。  
- **禁止**：Fix 后再评同 lane 之后又立刻对同一基线再开一轮 Review。  
- **高原对照**：编排契约 §0。



### 轮数是**预算上限**；未达标先挖，禁止假早停

「至少 N 轮」解析出的 `max_rounds` 是**上限**，不是目标。停机优先级：**达标 / 高原 / 过抛 / 回归 / `.stop`** 优先于轮数；**「当前 P0+P1 空了」在未达标时不优先停机**——须走 [dig.md](references/dig.md) 挖掘。禁止无 dig 指令的 Review-only 凑轮。

**`must_reach_target=true` 时**（用户说「持续运行 + 必须达到目标分」等，契约 §10.6）：未达标前**无**高原/过抛/回归/轮数上限/挖空/session_wall 软停机；`max_rounds` 仅记账；dig 预算用尽自动重置再挖。


| profile          | 现实预期                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `short`（≤20）     | 常因达标、高原或 **dig 预算耗尽** 停；未达标却因「可修耗尽」秒停 = 违规                                            |
| `long`（21–200）   | 多数在高原/过抛/挖空后停；跑满 100 仍属异常                                                                   |
| `marathon`（>200） | 须跨会话 Resume；**几乎不会**真正跑满                                                                    |


Phase 0 须明说：未达 `target_score` 时清单空 → 自动 dig（默认预算见上），不是直接 `no_fixable_items`。

## 调用示例

```text
loop-polishing 持续打磨代码审核 至少10轮
```

```text
loop-polishing 持续打磨代码审核 至少100轮
```

```text
loop-polishing 持续系统 至少500轮
```

```text
loop-polishing scope=CMDB变更审核 max_rounds=30 target=92 fix_scope=P0+P1
```

解析见 [references/parse.md](references/parse.md)。

## 诚实前提

1. 硬门槛 / 假绿 / 半成品入口 → 总分上限与对应 reviewer 一致；**Fix 必须优先清硬门槛**，禁止用视觉抛光抬分。
2. 打磨 ≠ 发明功能：`capability_gap` / 无证据新能力 → 标分类并 `deferred`（交接 `create-evolution-prd` / blueprint），**不**进本环「抛光成功」；禁止 stub 顶替。
3. 过抛反模式见 [anti-overpolish.md](references/anti-overpolish.md)；命中 → 剔除出 `fix_batch` 或整环停机。
4. arch 按**授权级**放行（真源 [arch-reviewer](../arch-reviewer/SKILL.md)「授权级别」）：`Strong + polish_safe` 自动进 Fix；`local-deepen` 平时 `deferred`，**该簇按契约 §14 升格** `escalated` **时必须做**（先落 ADR，再作加深切片）；`structural` 一律 `deferred` + 升人。
5. 再评独立客观：不锚定上轮总分 / `target_score`；允许降分。
6. 回写：编排契约 §3；**go-fast 为唯一写者**；编排方校验。
7. `.stop`：见 Phase 0.5；**禁止**删用户的 `.stop` 来续跑。
8. 子 reviewer 必须 `mode: loop-lane`（含 product）；**禁止**在 lane 内停等确认或直接改业务树。
9. **禁止**为空转凑 `min_rounds` 做 Review-only。某台无可修 → §5.2.1 换 lane。**连续 2 台**无可修（或累积清单在 `fix_scope` 下已空）：若 `total < target_score` 且 dig 预算未尽 → **必须**按 [dig.md](references/dig.md) 挖掘（换落后维、可升 score_P2），**禁止**直接 `no_fixable_items`；仅 dig 预算耗尽、或已达标/高原/过抛，才允许该停机理由。
10. **产品文案给人看**：go-fast / 本环改写的界面文案须 craft §8 用户向人话（契约 §13）；禁止字段名/工程黑话上屏。
11. marathon / 达 `max_wall_rounds_per_session` → 契约 §12 Resume，禁止单会话假装跑满。



## 流程

```text
Parse → Round 1..N（状态机真源：references/state-machine.md）:
  检查 .stop → 选 lane → Review(评分台, loop-lane) → 归一清单 → Ledger → 停机?
  → 否：过抛过滤 → go-fast Fix → 再评前门（失败 §5.2）
  → 通过：round+=1，下一评分台（再评+新 lane）…
→ Phase 5 全量 → Stop
```



### Phase 0 · 解析

1. **一次** Read：本文件 + 编排契约全文 + [orchestrator-api.md](../go-fast/references/orchestrator-api.md) + [state-machine.md](references/state-machine.md) + [finding-normalize.md](references/finding-normalize.md) + [dig.md](references/dig.md) + anti-overpolish。**Phase 0 不**读 go-fast 全文（省评分台前 token）。**Fix 时**按 orchestrator-api **§1.1** 加载最小必读集。之后每轮评分台/前门只 Read [loop-orchestrator-card.md](../go-fast/references/loop-orchestrator-card.md) + 本轮 reviewer SKILL（dig 波另带 dig 指令）。
2. 确认 `scope` / `max_rounds` / `min_rounds` / `target_score` / `fix_scope` / `profile` / `attendance` / `integration_policy` / `stop_file` / `honor_min_rounds` / `dig_on_under_target` / `dig_budget` / `composite_mode` / `max_wall_rounds_per_session` / `cr_fix_scope` / `dry_run` / `must_reach_target`。
3. `scope` 不可推断 → `status: BLOCKED`，`stop_reason: blocked`。
4. **分支与工作区门闩（开评前，任一失败 →** `BLOCKED`**）**：
  - 记录 `base_branch` = 当前 HEAD 分支名，写入回传与 ledger  
  - HEAD detached → `BLOCKED`（不猜基线）  
  - 工作区有未提交改动（业务树）→ `BLOCKED`，提示先提交或 stash  
  - 已知另一 loop 环正在同一 `base_branch` 上跑 → `BLOCKED`
4b. **证据目录门**（编排契约 §0.5）：`.evidence/` 须已被 gitignore 且未被跟踪；缺 ignore 可补写；已跟踪 → `BLOCKED`。  
5. **大 scope 护栏**（阈值真源：契约 §13）：整仓/「全部系统」或预估 open **>15** → **除非** `force_large_scope=true`，否则 `BLOCKED`；通过时 ledger 记 `large_scope: true`。
6. **扫描底座探测（只探测不装）**：约定见 [code-scanning](../code-scanning/SKILL.md) 隐式入口。跑：
  `command -v ast-grep; command -v codegraph; ls -d .codegraph sgconfig.yml 2>/dev/null`  
  - ledger 写 `scan_tools:`（例：`ast-grep+codegraph` / `ast-grep` / `rg-only`）  
  - 缺 `ast-grep`，或源文件明显 ≥100 且无可用 `.codegraph/` → **追加** ledger / 回传 `blockers`（**不**因此整环 `BLOCKED`）：说明降级影响与「用户显式要求时可 bootstrap」  
  - **禁止** Phase 0 执行安装 / `codegraph init`
7. `profile=long|marathon`：亮警告「轮数是预算上限，实际多半提前停」（见上节）；marathon 另警告「须跨会话 Resume」，单会话只跑至 `max_wall_rounds_per_session`。
8. 亮一行：
  `loop-polishing | scope=… | profile=… | min/max_rounds=… | wall=… | target=… | must_reach=on|off | fix_scope=… | dig=on/budget | honor_min_rounds=… | composite_mode=… | base=… | scan=… | evidence_dir=ok|repaired|blocked | stop_file=.stop | dry_run=… | attendance=… | integration_policy=… | fix=go-fast-fleet`
9. 每轮前门前过编排契约 §9 / card。
10. `dry_run=true` → 只跑 Round 1 composite 后 Phase 5 跳过全量（`skipped_reason: dry_run`），`stop_reason: dry_run`。
11. Resume → 契约 §12；继承 ledger 的 `dig_waves_used` / `dig_remaining`。



### Phase 0.5 · `.stop` 优雅停机

**规则见编排契约 §10.5**（已提升为三环共用，本 skill 与 prd/product 同一套口径）。要点：每轮开始与本轮 Fix 结束后各查一次；存在即置 `stop_pending: true`，允许做完当前评分台（含已开的 Fix 与前门处理）后 Phase 5 → `DONE_WITH_CONCERNS` / `stop_reason: stop_file`；**禁止**删 `.stop` 续跑，**禁止** `stop_pending` 后再开新轮。

### Phase 1 · Review（按 roster · 评分台）

1. 按 [state-machine.md](references/state-machine.md) + [round-roster.md](references/round-roster.md) 选 `lane`（首轮强制 `composite`）。
2. **Read 并执行**对应 reviewer，`mode: loop-lane`（product 亦须 `loop-lane`）；范围= `scope` + 邻域边界。
3. 按 [finding-normalize.md](references/finding-normalize.md) 归一「处理清单」；落盘：
  `docs/material/loop-polishing/<YYYY-MM-DD>-<slug>-r<N>.md`（`N` = 本评分台 `round`）
4. `composite`：按 [dimensions.md](references/dimensions.md) 算八维与 `total`；`composite_mode=full` 可并行取证；`light` = 合成上次各焦点维分 + **抽检硬门槛是否仍在**（须至少打开入口/主路径证据，禁止空想抬分）。
5. 继承上轮清单 ID/状态；新刺点新 ID；回潮 `open`。

**处理清单列（强制）**：


| 列    | 说明                                                                                |
| ---- | --------------------------------------------------------------------------------- |
| ID   | `P-…` / `C-…` / `U-…` / `A-…` / `N-…` 前缀区分来源                                      |
| lane | 来源焦点                                                                              |
| 优先级  | P0 / P1 / P2                                                                      |
| 硬门槛  | 是/否                                                                               |
| 过抛风险 | 是/否（见 anti-overpolish）                                                            |
| 视觉债  | 是/否（纯口味且无任务伤害 → 是；`fix_scope=P0+P1` 时不进 batch；默认 `all` 时可进，仍受过抛闸） |
| 分类   | product/flow 来源必填：`experience_fix` / `capability_gap` / `out_of_scope`（缺省当 experience_fix；见 capability-gap.md） |
| 状态   | `open` / `in_progress` / `done` / `verified` / `blocked` / `deferred` / `wontfix` |
| 证据   | 路径/路由/行为                                                                          |




### Phase 2 · 停机（评分台后）

**Δ**：仅两侧均为 composite 时可计算。  
**高原**：`composite_count >= plateau_min_composites`，且最近 `plateau_composites` 次可计算 `|Δtotal| < plateau_delta`（唯一高原定义；roster 不得另写一套）。

**判定序（强制）**：下表**自上而下，首个命中者生效**；多条同时成立时以先命中者的 `status` / `stop_reason` 为准，其余在 ledger 记为「同时命中」。

**`must_reach_target=true` 且 `total < target_score`（或仍有未清硬门槛）时**：下表 #5、#9–#13 **不适用**（§10.6）；须继续评分台→Fix 或 dig / Resume。


| #   | 条件                                                                       | status                                                                                                                                    | stop_reason                    |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | 用户说停                                                                     | `DONE_WITH_CONCERNS`                                                                                                                      | `user_stop`                    |
| 2   | `stop_pending`（本评分台/已开 Fix 结束后）                                          | Phase 5 后 `DONE_WITH_CONCERNS`                                                                                                            | `stop_file`                    |
| 3   | `dry_run` 且 Round 1 已完成                                                  | Phase 5（跳过全量）→ `DONE_WITH_CONCERNS`                                                                                                       | `dry_run`                      |
| 4   | `gate_fail_streak ≥ 2`                                                   | Phase 5 后 concerns / `BLOCKED`                                                                                                            | `blocked`                      |
| 5   | 可计算 `Δtotal ≤ -regression_stop`                                          | Phase 5 后 `DONE_WITH_CONCERNS`                                                                                                            | `regression`                   |
| 6   | 仍有未清硬门槛                                                                  | **禁止** `met_target`；继续 Fix 或 `BLOCKED`                                                                                                    | —                              |
| 7   | `total >= target_score` 且无未清硬门槛且 `honor_min_rounds=false`                | Phase 5 绿 → `DONE`（不要求跑满 min）                                                                                                             | `met_target`                   |
| 8   | `total >= target_score` 但 `honor_min_rounds=true` 且 `round < min_rounds` | **继续**但 **禁止空转 Review-only**：仅当仍有可修非过抛项才 Fix；否则 Phase 5 → `DONE_WITH_CONCERNS`（`met_target` 或 `overpolish`）并在 ledger 注 `min_rounds_unmet` | —                              |
| 9   | 过抛闸（见 anti-overpolish；**该簇未加深过时不成立**，先升格加深）                              | Phase 5 后 `DONE_WITH_CONCERNS`                                                                                                            | `overpolish`                   |
| 10  | 高原 + `overpolish_stop`                                                   | Phase 5 后 `DONE_WITH_CONCERNS`（**禁止**为凑 min_rounds 空转评分）                                                                                  | `plateau`                      |
| 11  | 连续 2 台 `advanced_without_fix` **或** 累积清单在当前 `fix_scope` 下无可修 | **先看是否 dig**：见下行；不可 dig 才停                                                                                                             | —                              |
| 11a | 第 11 行成立，且 `total < target_score`，且 `dig_on_under_target`，且 `dig_remaining > 0` | **禁止停机**；进入 [dig.md](references/dig.md) 挖掘波（换落后维 / 可升 score_P2 / 必要 full composite） | —（继续）                        |
| 11b | 第 11 行成立，且（已达标 **或** dig 关 **或** `dig_remaining=0`）                 | Phase 5 后 `DONE_WITH_CONCERNS`                                                                                                            | `no_fixable_items`             |
| 12  | `round >= max_rounds`                                                    | Phase 5 后 `DONE_WITH_CONCERNS`                                                                                                            | `max_rounds`                   |
| 13  | 本会话评分台 ≥ `max_wall_rounds_per_session`                                   | Phase 5 骨架（可跳过全量 `session_wall`）+ ledger 游标；`DONE_WITH_CONCERNS`                                                                          | `session_wall`                 |


**单次「本台无可修项」不停机**：换 lane 属常态（§5.2.1）。**连续空台 / 清单空**在未达标时 → **dig，不是停**（11a）。**禁止**把 dig 做成无指令复读；**禁止**把 `deferred: debt_escalated` 算作无可修。已达标后的清单空 → 11b 可停（不必为凑轮再挖）。

### Phase 3 · Fix（go-fast · 必须舰队）

1. **执行** go-fast（动作真源：[orchestrator-api.md](../go-fast/references/orchestrator-api.md) **§1.1**——同会话戴帽或 Task 委派；本会话首次 Fix 加载最小必读集；后续轮读 card，勿零读假装舰队）；`orchestrator: loop-polishing`；传入 `attendance` / `integration_policy` / `cr_fix_scope` / `source_report` / `batch`。
2. **选 batch（顺序强制）**
  - 先：命中 `escalated` 簇的 finding **整体剔除**（`deferred: debt_escalated`；**不**计入 `no_fixable_items`），并把该簇的**加深切片**排进本轮（独占一波、不占 `batch_size`；须 ADR 已落盘）  
  - 再：硬门槛=`是` 且 `open` 且 `分类≠capability_gap|out_of_scope` 且落在 `effective_fix_scope`（常态=`fix_scope`；**dig 波**见 dig.md，可含 score_P2）  
  - 再：其余 `effective_fix_scope` 且 过抛风险=`否` 且 视觉债=`否` 且 `分类≠capability_gap|out_of_scope`  
  - 剔除：过抛风险=`是`；`capability_gap`/`out_of_scope`（`deferred` + followup PRD/蓝图）；`deferred`/`wontfix`/`blocked`/`verified`；arch `structural` 与未升格的 `local-deepen`  
  - 上限 `batch_size`；契约不明 → 编排契约 §2  
  - 本台 batch 空且将记 `advanced_without_fix`：若已连续空且未达标 → Phase 2 走 11a dig，**不要**直接 Phase 5
3. 路径：先 §6.1 `spec_reuse`；否则默认 B；Path A 仅当 §6 全满足。
4. 并发 / 验证 / 回写：编排契约 §3–§4。
5. 校验 `summary`；漏写补修并 `writeback_repaired: true`。**逐条过薄补丁守卫**（[anti-overpolish.md](references/anti-overpolish.md)「薄补丁守卫」）：命中 → 状态回 `open`、记 `thin_patch_rejected`，该簇 `touch_count += 1`。
6. **再评前门（B 层必须自己跑）**：A 层格式检查后，编排方在目标仓亲自执行
  `~/.agents/skills/_bin/gate-check batch --slices <本批> [--strict-red] --json`（`--slices` 只能取回传 `slices[].id` 全集，禁止从 finding ID 猜；退出码 `0`/`1`/`2` 三值语义见 §5.1 B 层，`2`**=ENV_ERROR 一律按失败**），**以退出码为准**；与回传 `evidence.gate` 不符 → 以自跑为准、记 `evidence_mismatch: true`，下一轮强制 `--strict-red` 且至少抽查一次 `gate-check verify --slice <id>`（§5.1.1）。`verify` FAIL → 相关 ID 回 `open` + 该簇 `regression_count += 1`。失败走 §5.2（`gate_fail_streak++`，不 +`round`）。



### Phase 3.5 · debt-map 维护（契约 §14 为真源）


| 项       | 本环补充                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 谁读 / 谁写 | 选 batch **前**先读主 `docs/material/debt-map.md` 取各簇状态；**编排方**（非 go-fast）在本轮前门判完后、进入下一评分台前回写。无 `orchestrator_parent` → 写主文件；`orchestrator_parent: loop-goal` → 契约 **§14.1**（`debt_touches`/分片，不直接改主文件）。前门失败或 `verify` FAIL 也要记（`regression_count += 1`） |
| glob 归并 | 取本轮白名单的最近公共**模块级**目录（如 `src/<module>/`**）与已有簇 `glob` 求交：相交 → 同簇 `touch_count += 1`（同轮多片只 +1）；无交 → 新增一行。**禁止**单文件粒度                                                 |
| 升格后     | 见 Phase 3 选 batch 第 1 条 + [finding-normalize.md](references/finding-normalize.md)「arch 授权级」；与过抛闸冲突时**先加深后停机**（[anti-overpolish.md](references/anti-overpolish.md)） |
| 交接      | 换环时按契约 §10 复制 debt-map 路径与各簇计数；**禁止**下一环从 0 重新计数                                                                                                                   |




### Phase 4 · 再评（= 下一评分台）

前门通过（或按契约 §5.2.1 **无 Fix 推进**）后：**不要**在本 `round` 内再跑第二次 Review。  
`round += 1`，回到 Phase 1：按 state-machine 选**下一** lane（到期则 composite），同 scope 评分台；继承清单；独立打分；回潮优先；再 Phase 2。  
若 `stop_pending`：允许完成已开始的 Fix/前门处理，然后 Phase 5，**不再** `round+=1`。

### Phase 5 · 收尾

1. 整环全量：编排契约 §5.3（含 `residual_worktrees[]`；`full_suite_every` / `session_wall` / `dry_run` 例外须注明）。  
   - 若由 [loop-goal](../loop-goal/SKILL.md) 派出（`skip_full_test` / `full_suite_deferred_to=loop-goal`）：**禁止**跑仓/FE 全量与中途 `full_suite_every`；`full_suite.skipped_reason: deferred_to_fleet`；综合分 `met_target` 仍可按评分判定，全量绿改由舰队 Phase 5 负责。  
2. Ledger：`docs/material/loop-polishing/<YYYY-MM-DD>-<slug>-ledger.md`（见 [ledger.md](references/ledger.md)）；含 Resume 游标。
3. 对话：轮次表、首末综合分、各维、已修/过抛剔除、`.stop`、路径、残留 worktree。
4. 残留 worktree / 片分支列出；未合并勿强删。
5. **不要**自动删除 `.stop`（留给用户）。



## 回传格式

公共字段（`status` / `phase` / `scope` / `base_branch` / `attendance` / `integration_policy` / `cr_fix_scope` / `gate_fail_streak` / `stop_file` / `stop_pending` / `full_suite` / `residual_worktrees` / `integration_decisions` / `resumed_from` / `ledger` / `artifacts` / `rounds[].go_fast` 等）**结构见编排契约 §11.1 + §11**，此处不再复制。本环**差异字段**：

```yaml
phase: loop-polishing
scope_level: module | subsystem | flow
profile: short | long | marathon
min_rounds: 10
honor_min_rounds: false
target_score: 92
fix_scope: all
dig_on_under_target: true
dig_budget: 2
dig_waves_used: 0
dig_remaining: 2
dig_active: false
must_reach_target: false
batch_size: 5
composite_mode: light | full        # 首个 composite 强制 full；dig 内 composite 亦强制 full
dry_run: false
plateau_delta: 1.5
plateau_min_composites: 2
plateau_composites: 2
regression_stop: 4
overpolish_stop: true
full_suite_every: 0
dimensions: {}                      # 最近 composite 八维
rounds:
  - n: 1
    lane: composite | product | flow | arch | code | ui | ux | neighbor
    total: 0
    total_stale: false              # 非 composite 轮必须 true
    delta: null                     # 仅两侧均 composite 时可计算
    dig_wave: false                 # 本台是否 dig.md 挖掘波
    dig_focus_dims: []
    effective_fix_scope: all          # dig 波在收窄 fix_scope 时可升 score_P2
    overpolish_rejected: []
    thin_patch_rejected: []         # 薄补丁守卫命中，回 open（anti-overpolish）
    deepen_slice: ""                # 本台执行的加深切片簇名（refactor-shared；不记 Δ 进步）
    advanced_without_fix: false     # 契约 §5.2.1
final_total: 0
met_target: false
stop_reason: met_target | overpolish | plateau | regression | max_rounds | no_fixable_items | dry_run | blocked | user_stop | session_wall | stop_file
```



## 红线

**三环共用红线见编排契约 §13**（诚实 / 编排纪律 / 计轮与门 / 测试收尾 / 并发范围），此处不重复。本环**专有**：

- **禁止**不 Read state-machine / finding-normalize / dig / anti-overpolish（Phase 0）就开跑  
- **禁止**跳过过抛过滤或 finding 归一；**禁止**把过抛 / 薄补丁剔除项标 `done` 抬综合分  
- **禁止**再评锚定上轮分或按 `target_score` 倒推定分  
- **禁止**未达标且 dig 预算未尽时，以 `no_fixable_items` / 「P0+P1 耗尽」提前停机（须先 dig）  
- **禁止**`must_reach_target=true` 时未达标却以高原/过抛/回归/轮数上限/挖空/session_wall 收工（契约 §10.6）
- **禁止**为凑 `min_rounds` 做空转 Review-only；**禁止**无 dig 指令、不换落后维的复读式评分台冒充挖掘  
- **禁止**同轮「Review→Fix→再评」后再立刻重复 Review（双评）；再评必须是下一 `round`  
- **禁止**首个 composite 用 `light`（无历史焦点维分可合成 → 会捏造基线）  
- **禁止**非 composite 轮更新 `total` 或参与 Δ / 高原判定（须 `total_stale: true`）  
- **禁止** lane reviewer 停等确认或直接改业务树（须显式 `mode: loop-lane`）  
- **禁止** arch `Speculative` / `structural` / 未升格的 `local-deepen` 当抛光；**禁止**发明功能冒充打磨  
- **禁止**簇已 `escalated` 却继续对它打 finding 级补丁，或跳过下一轮的加深切片；**禁止**未加深就用 `overpolish` 停机绕开加深  
- **禁止**用薄补丁（只改文案 / 加 tooltip / 加 `if` 绕过而不改任务流程、信息结构、权责或状态机）计为 finding 完成；finding 本身是「用户向文案 / 禁字段名进空态」时按 anti-overpolish 豁免，改文案算完成  
- **禁止** marathon 单会话假装跑满（须墙钟 + Resume）；**禁止**把轮数上限当交付承诺



## 附加资源

- [parse.md](references/parse.md) · [ledger.md](references/ledger.md)  
- [dimensions.md](references/dimensions.md) · [round-roster.md](references/round-roster.md)  
- [dig.md](references/dig.md) · [anti-overpolish.md](references/anti-overpolish.md)  
- [state-machine.md](references/state-machine.md) · [finding-normalize.md](references/finding-normalize.md)

