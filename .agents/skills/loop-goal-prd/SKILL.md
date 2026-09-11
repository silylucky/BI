---
name: loop-goal-prd
description: >
  Use when the user says loop-goal-prd / PRD plan 冲锋 / 按里程碑开工 /
  把 plan 当前节做完 / 按 PRD 分片落地 / arch+prd+plan 闭环实现, or wants
  unattended loops that implement open plan/PRD items via go-fast until the
  scoped milestone is honestly done.
  Supports must_reach_target mode (持续运行直到冲完): no soft stop while remaining>0.
  Also use to resume an interrupted PRD loop: loop-goal-prd-resume /
  续跑 / 继续 / 接着跑 / 接着冲 / continue / resume
  [optional ledger=docs/material/loop-goal-prd/<date>-<slug>-ledger.md];
  bare 继续/continue with no ledger uses soft resume (latest matching ledger).
---

# Loop-Goal-PRD（PRD + plan + arch → go-fast · 里程碑冲锋实现）

编排 skill：以 plan/PRD/`docs/arch.md` 为真理源，多轮调用 [go-fast](../go-fast/SKILL.md) 把 **scope 内未完成项真实落地**，再**诚实**回写分片状态与 plan 勾选。

共享舰队 / 回写 / 契约门 / 全量纪律见  
[go-fast/references/loop-orchestrator-contract.md](../go-fast/references/loop-orchestrator-contract.md)（下称**编排契约**）。  
每轮前门前轻量卡片：[loop-orchestrator-card.md](../go-fast/references/loop-orchestrator-card.md)。  
冲的是 **交付完成度**，不是产品八维分（冲分用 [loop-goal-product](../loop-goal-product/SKILL.md)）。

**不是** Cursor 定时 `/loop`；**不是** 只体检/改文档冲文档分；**不是** 演化 G2/P5 擅自勾选假完成。  
本 skill = **用户授权的会话内按 plan/PRD 冲锋写代码**。

## 何时启用


| 场景                                 | 动作                    |
| ---------------------------------- | --------------------- |
| 「loop-goal-prd：把 plan 当前节 / M2 冲完」 | 解析 → 多轮 go-fast       |
| 「按 PRD 分片 Fxx 无人值守落地」              | 固定 `scope` = 分片 ID 列表 |
| 里程碑前把未勾选项真实做完                      | 默认当前节未完成项             |
| 中断后说「继续 / 接着跑 / 续跑 / continue」     | **等同** `/loop-goal-prd-resume`（契约 §12 soft resume；可省略 ledger） |


**不要**：无 `goal.md` / PRD / plan / `arch.md` 空想开工；把 stub/假绿勾进 plan；在主会话偷改业务树；用文档措辞抬「完成度」；把产品挑刺冲分当成这个 skill。  
**复杂域叙事不清**：多角色闭环或 PRD 主路径与业内情境明显打架、又无已确认蓝图时——**不要**在 loop 内替用户跑完 [product-blueprint](../product-blueprint/SKILL.md)；在 ledger / followups 写「建议先 A2 product-blueprint scope=…」；go-fast 侧见其「流程叙事不清」。用户点名本环可先穿插 blueprint（仍确认后停，再继续 Fix）。  
**多环交接**：见编排契约 §10（推荐本环 → loop-goal-product → 可选 loop-polishing；禁止并行改同一 base）。

## 默认参数


| 键                    | 默认                      | 说明                                          |
| -------------------- | ----------------------- | ------------------------------------------- |
| `prd_skill`          | `create-evolution-prd`  | 盘点跟其状态枚举；回写仅 `mode: honest-writeback`       |
| `plan_skill`         | `create-evolution-plan` | 同上；禁止完整「新建/体检/干预」大改                         |
| `arch_ref`           | `docs/arch.md`          | **必读**约束；缺失 → Phase 0 `BLOCKED`             |
| `fix_skill`          | `go-fast`               | **固定**                                      |
| `scope`              | **必填或可推断**              | plan 节号或 PRD ID 列表；不可推断 → `BLOCKED`         |
| `batch_size`         | `10`                    | 每轮最多纳入的未完成 PRD ID 数（仍受依赖边约束）                |
| `max_rounds`         | `8`                     | 以已完成 Inventory 次数计（前门失败不计入 round，见契约 §5.2） |
| `max_wall_rounds_per_session` | `= max_rounds` | 墙钟；**默认等于 `max_rounds` 故不额外生效**，仅用户显式调小（跨会话分批跑）时有意义 |
| `attendance`         | `unattended`            | 修复阶段；`attended` 时 seam/合回/集成选型停问            |
| `integration_policy` | `auto_best_require_adr` | **三环统一默认**（契约 §2）；用户显式才降 `auto_best` 或改 `park` |
| `plateau_rounds`     | `2`                     | 连续 N 个**Fix 后盘点**的 `DoneΔ=0` → 高原（Fix 前首轮不计入） |
| `regression_rounds`  | `2`                     | 连续 N 个**Fix 后盘点**的 `delta_remaining > 0`（净增）→ 回归停机 |
| `target`             | `scope_clear`           | scope 内未完成项清零且无假绿                           |
| `force_large_scope`  | `false`                 | 阈值以契约 §13「大 scope 数值真源」为准：open PRD 项 >15 或「全部未完成」须显式 true，否则 `BLOCKED` |
| `cr_fix_scope`       | `P0+P1`                 | loop 内 CR 默认只自动修 P0+P1                      |
| `stop_file`          | `.stop`                 | 三环共用优雅停机；见契约 §10.5                        |
| `dig_on_under_target` | `true`                | `remaining>0` 却可修空 → **先挖**再停（见 [dig.md](references/dig.md)） |
| `dig_budget`         | `2`                     | 挖掘波数；耗尽仍空才 `no_fixable_items`             |
| `must_reach_target`  | `false`                 | `true` = 持续运行直到 `scope_clear`；**禁**软停机（契约 §10.6） |


**高原对照**：见编排契约 §0（本环 = Fix 后 DoneΔ；与 product/polishing 不同）。




## 调用示例

```text
/loop-goal-prd 按 docs/automate/plan.md 当前节 + PRD + arch，go-fast 无人值守冲完
```

```text
loop-goal-prd scope=M2 batch_size=3 max_rounds=8
```

```text
继续
```

（中断 / `session_wall` / 新会话后；**等同** resume，ledger 可省略 → soft resume，见 parse.md）

```text
/loop-goal-prd-resume ledger=docs/material/loop-goal-prd/<date>-<slug>-ledger.md
```

解析见 [references/parse.md](references/parse.md)。

## 诚实前提

1. **完成 = 真实验收**：对应 PRD 分片验收在真实依赖下通过；禁止 mock/stub/demo/骨架空壳冒充完成。
2. **勾选/已实现**：由 go-fast 按编排契约 §3 回写；编排方校验；假绿须降状态或反勾。
3. **arch.md 是约束不是装饰**：冲突 → `BLOCKED` 或 needs_human；**禁止**擅自改 arch（须用户点名）。
4. **create-evolution-**：本闭环只允许 `honest-writeback`（状态/勾选）；禁止借机发明无证据的新功能域/新里程碑大改方向。完整新建/体检仍须用户手动触发 create skill。
5. **外部契约不明**：编排契约 §2（三环默认 `auto_best_require_adr`：难回退选型先落 ADR 再真接；用户显式可降 `auto_best` 或改 `park`）；硬禁 stub 顶替。
6. 冲锋尽力而为：**不保证**一轮清完整个 plan；允许部分 `DONE_WITH_CONCERNS`。未 `scope_clear`（`remaining>0`）且可修空 → **必须 dig**（[dig.md](references/dig.md)），禁止以「本批无可修」假早停。
7. **薄补丁不算完成**：为让分片「看起来做完」而做的最小表面修改（改文案 / 加 tooltip / 加 `if` 绕过，而不改任务流程、信息结构、权责或状态机）→ 该 ID 回 `open`，不得计入 `done_count` 或勾选 plan。识别要点见 [anti-overpolish.md「薄补丁守卫」](../loop-polishing/references/anti-overpolish.md)（三环同尺）。**例外**：验收本身要求去掉空态/页头里的字段名、查询参数名、工程黑话等研发口吻 → 改成 craft §8 用户向人话算完成。  
8. **产品文案给人看**：go-fast / 本环改写的界面文案必须用户向人话（契约 §13 + craft §8）；禁止把 ADR/stub/字段名等写进客户主路径。



## 流程

```text
Parse → Round 1..N:
  Inventory（plan 未勾选 ∩ scope + PRD 未实现）→ Ledger → 停机?
  → 否：选本轮 batch → go-fast Fix（编排契约）
  → 再盘点前门失败（编排契约 §5.1–§5.2）→ 不进再盘点；按失败表重试/停机
  → 前门通过（含合法 DONE_WITH_CONCERNS）→ 再 Inventory
→ 整环全量（Phase 5，编排契约 §5.3）→ Stop
```



### Phase 0 · 解析

1. **一次** Read：本文件 + create-evolution-prd/plan 的 **honest-writeback** 节 + **编排契约**全文 + [orchestrator-api.md](../go-fast/references/orchestrator-api.md) + [dig.md](references/dig.md)。**Phase 0 不**读 go-fast 全文（省 Review 前 token）。**Fix 时**按 orchestrator-api **§1.1** 加载最小必读集。之后每轮 Review/前门只 Read [loop-orchestrator-card.md](../go-fast/references/loop-orchestrator-card.md)。  
2. 确认 `scope` / `batch_size` / `max_rounds` / `max_wall_rounds_per_session` / `attendance` / `integration_policy` / `cr_fix_scope` / `stop_file` / `dig_on_under_target` / `dig_budget` / `must_reach_target`。
3. 真理源门闩（任一失败 → `BLOCKED`）：
  - `docs/automate/goal.md` 存在  
  - PRD hub+分片（或可迁移的存量）存在  
  - `docs/automate/plan.md` 存在  
  - `docs/arch.md` 存在且可读  
  - `scope` 可解析到具体节或 PRD ID 集合
4. **分支与工作区门闩（开工前，任一失败 → `BLOCKED`）**：
  - 记录 `base_branch` = 当前 HEAD 分支名，写入回传与 ledger  
  - HEAD detached → `BLOCKED`（不猜基线）  
  - 工作区有未提交改动（业务树）→ `BLOCKED`，提示先提交或 stash；**禁止**让开工前的脏改被卷进本环合回  
  - 已知另一 loop 环正在同一 `base_branch` 上跑 → `BLOCKED`
4b. **证据目录门**（编排契约 §0.5）：`.evidence/` 须已被 gitignore 且未被跟踪；缺 ignore 可补写；已跟踪 → `BLOCKED`。  
5. **大 scope 护栏**（阈值真源：契约 §13）：`scope=全部未完成` 或预估 open PRD ID **>15** → **除非** `force_large_scope=true`，否则 `BLOCKED`；通过时 ledger 记 `large_scope: true`。  
6. **扫描底座探测（只探测不装）**：约定见 [code-scanning](../code-scanning/SKILL.md) 隐式入口。跑：
   `command -v ast-grep; command -v codegraph; ls -d .codegraph sgconfig.yml 2>/dev/null`  
   - ledger 写 `scan_tools:`（例：`ast-grep+codegraph` / `ast-grep` / `rg-only`）  
   - 缺 `ast-grep`，或源文件明显 ≥100 且无可用 `.codegraph/` → **追加** ledger / 回传 `blockers`（**不**因此整环 `BLOCKED`）：说明降级影响与「用户显式要求时可 bootstrap」  
   - **禁止** Phase 0 执行安装 / `codegraph init`  
7. 亮一行：`loop-goal-prd | scope=… | must_reach=on|off | batch=… | max_rounds=… | wall=… | base=… | attendance=… | integration_policy=… | cr=… | dig=on/budget | scan=… | evidence_dir=ok|repaired|blocked | stop_file=.stop | fix=go-fast-fleet | arch=docs/arch.md`。  
8. 每轮前门前过编排契约 §9 / card；每轮开始与 Fix 后查 `.stop`（契约 §10.5）。  
9. Resume / soft resume（「继续」「接着跑」等）→ 契约 §12 + parse.md；继承 ledger 的 `dig_waves_used` / `dig_remaining`。无可用 ledger 时 **禁止**把裸「继续」当成新开全量环。


### Phase 1 · Inventory（盘点）

1. 读 plan 目标节与 PRD 分片状态；对照 arch 术语/边界（**只读** create-evolution 状态枚举，不跑完整体检交互）。
2. 产出「处理清单」（`docs/material/loop-goal-prd/<date>-<slug>-r<N>.md`）：


| 列          | 说明                                                                    |
| ---------- | --------------------------------------------------------------------- |
| ID         | PRD ID（与 plan 勾选一致）                                                   |
| plan_ref   | 节号 / 行                                                                |
| prd_status | 未实现 / 部分 / 已实现 …                                                      |
| hard_gate  | 验收含 stub/mock/demo，或 arch 冲突未消 → 是                                    |
| blocked_by | 依赖的其他 PRD ID / 外部契约                                                   |
| 状态         | `open` / `in_progress` / `done` / `verified` / `blocked` / `deferred` |


3. 统计：`remaining` = scope 内仍应做的 `open`（**必须包含**仍 open 的硬门槛项；`remaining==0` 却仍有硬门槛 open → 记账错误，不得宣称 `scope_clear`）。
4. 首轮 `-r1.md`；第 N 次再盘点 `-rN.md`（不覆盖）。再盘点须**继承**清单 ID/状态。
5. **DoneΔ / `done_count`**：仅在「本轮已发生过 Fix 尝试之后」的 Inventory 填写整数（本轮新标完成的 PRD ID 数）。**Fix 前的首轮 Inventory** 必须记 `done_count: null`（ledger `DoneΔ` = `—`），**禁止**记 `0`，且**不计入**高原窗口。
6. **`delta_remaining`**：`= remaining_n − remaining_{n-1}`（本次盘点的 `remaining` 减上一份清单的 `remaining`）。与 `done_count` 同规则——**Fix 前首轮记 `null`**，之后填带符号整数。  
  - 负数 = 净收敛（正常）；`0` = 原地踏步；**正数 = 净发散**（回潮/新拆出的 open 多于本轮完成数）。  
  - 与 `done_count` 是**两个独立信号**：`done_count>0` 但 `delta_remaining>0` 表示「边做边长」，高原判定抓不到，须由回归停机抓（Phase 2）。



### Phase 2 · 停机（Inventory 后）

**高原**：至少已有 **1 次 Fix 尝试**之后的 Inventory，且最近 `plateau_rounds` 个「Fix 后盘点」的 `DoneΔ`（`done_count`）均为 `0`。  
**回归**：最近 `regression_rounds` 个「Fix 后盘点」的 `delta_remaining` 均 `> 0`（清单净发散：越做越多）。  
首轮 Fix 前 Inventory 的 `null`/`—` **不**参与两者判定。

**判定序（强制）**：下表**自上而下，首个命中者生效**；多条同时成立时以先命中者的 `status` / `stop_reason` 为准，其余在 ledger 记为「同时命中」。

**`must_reach_target=true` 且 `remaining > 0`（或仍有未清硬门槛）时**：下表 #5、#7b、#8–#10 **不适用**（§10.6）；须继续盘点→Fix 或 dig / Resume。

| #  | 条件                               | status                           | stop_reason                             |
| --:| -------------------------------- | -------------------------------- | --------------------------------------- |
| 1  | 用户说停                             | 建议 `DONE_WITH_CONCERNS`          | `user_stop`                             |
| 2  | `stop_pending`（`.stop` 已检出，契约 §10.5） | Phase 5 后 `DONE_WITH_CONCERNS` | `stop_file`                          |
| 3  | `gate_fail_streak ≥ 2`           | Phase 5 后 concerns 或 `BLOCKED`  | `blocked`                               |
| 4  | `remaining == 0` 断言与硬门槛矛盾        | **禁止** `DONE`；修清单或继续             | —                                       |
| 5  | 回归（上式）                           | Phase 5 后 `DONE_WITH_CONCERNS`   | `regression`                            |
| 6  | `remaining == 0` 且无未清硬门槛、勾选与分片一致 | 先 Phase 5；**绿**才 `DONE`          | `scope_clear`                           |
| 7  | 连续 2 次盘点 `advanced_without_fix`（契约 §5.2.1） | **先 dig 再停**：见 7a/7b | — |
| 7a | 第 7 行成立，且 `remaining > 0`，且 dig 预算未尽 | **禁止停机**；进入 [dig.md](references/dig.md)（重盘 plan/PRD 漏项、纠误标、回潮假绿、可解依赖） | —（继续） |
| 7b | 第 7 行成立，且（`remaining==0` **或** dig 关/预算尽） | Phase 5 后 `DONE_WITH_CONCERNS` | `no_fixable_items` |
| 8  | 高原（上式）                           | Phase 5 后 `DONE_WITH_CONCERNS`   | `plateau`                               |
| 9  | `round >= max_rounds`            | Phase 5 后 `DONE_WITH_CONCERNS`   | `max_rounds`                            |
| 10 | 本会话盘点数 ≥ `max_wall_rounds_per_session` | Phase 5 骨架 + 游标；`DONE_WITH_CONCERNS` | `session_wall`                    |
| 11 | 仅剩不可择优的 `blocked` / `park`（dig 后仍无解） | `BLOCKED` 或 `DONE_WITH_CONCERNS` | `blocked` 或 `pending_human_integration` |

**注**：单次「本批无可修」**不**停机——§5.2.1 推进。连续 2 次且 **`remaining > 0`** → **挖一波**（[dig.md](references/dig.md)），**禁止**假早停；仅 dig 尽或已清零才走 7b。

停机意图确定后仍须走 Phase 5（编排契约 §5.3）。

### Phase 3 · Fix（go-fast · 必须舰队）

编排方只做编排；细则见**编排契约** + **card**。本 skill 仅补 PRD 向选批：

1. **执行** go-fast（动作真源：[orchestrator-api.md](../go-fast/references/orchestrator-api.md) **§1.1**——同会话戴帽或 Task 委派；本会话首次 Fix 加载最小必读集；后续轮读 card，勿零读假装舰队）；`orchestrator: loop-goal-prd`；传入 `attendance` / `integration_policy` / `cr_fix_scope` / `source_report` / `batch`。
2. **选本轮 batch（顺序强制）**
  - 先：命中 debt-map `escalated` 簇的 ID **整体剔除**（`deferred: debt_escalated`；**不**计入 `no_fixable_items`），并把该簇的加深切片排进本轮（独占一波、不占 `batch_size`；须 ADR 已落盘）  
  - 再：`hard_gate=是` 且可修的 `open`  
  - 再：无未完成 `blocked_by` 的前沿 `open`，至多 `batch_size` 个  
  - 契约不明：编排契约 §2  
  - 跳过：`blocked`/`deferred`/`verified`/`park`；依赖未就绪者留下轮  
  - 硬门槛仍 open 却冲无关软项 → **违规**
3. **路径**
  - 先查 §6.1 `spec_reuse`；命中 → A。  
  - **路径 A**：本批每个分片均满足编排契约 §6 Path A（共用条 + PRD 附加条）→ `spec_ref` 可指向分片。  
  - **否则路径 B**：综合 PRD + plan + arch + 仓内现状 → `docs/specs` → 规格门 → tickets。  
  - Inventory/ledger **不算**路径 A 规格。
4. **并发 / 验证 / 回写**：编排契约 §3–§4。go-fast 按 §3 写 PRD/plan + 源 Inventory；编排方校验 `summary`，漏则按 create-evolution `honest-writeback` 补写并记 `writeback_repaired: true`。**逐条过薄补丁守卫**（诚实前提 7）：命中 → 状态回 `open`、记 `thin_patch_rejected`，该簇 `touch_count += 1`。
5. **再盘点前门（B 层必须自己跑）**：A 层格式检查后，编排方在目标仓亲自执行  
  `~/.agents/skills/_bin/gate-check batch --slices <本批> [--strict-red] --json`（`--slices` 只能取回传 `slices[].id` 全集，禁止从 PRD 分片 ID 猜；退出码 `0`/`1`/`2` 三值语义见 §5.1 B 层，**`2`=ENV_ERROR 一律按失败**），**以退出码为准**；与回传 `evidence.gate` 不符 → 以自跑为准、记 `evidence_mismatch: true`，下一轮强制 `--strict-red` 且至少抽查一次 `gate-check verify --slice <id>`（§5.1.1）。`verify` FAIL → 相关 ID 回 `open`（不得计入 `done_count`）+ 该簇 `regression_count += 1`。失败走 §5.2（`gate_fail_streak++`，不 +`round`）。
6. **禁止**编排方在 go-fast 未回写前抢先勾选 plan / 标「已实现」。

### Phase 3.5 · debt-map 维护（契约 §14 为真源）

| 项 | 本环补充 |
|----|----------|
| 谁读 / 谁写 | 选 batch **前**先读 `docs/material/debt-map.md` 取各簇状态；**编排方**（非 go-fast）在本轮前门判完后、再盘点之前回写（无文件则创建）；前门失败或 `verify` FAIL 也要写（`regression_count += 1`）。若在 loop-goal 军团内 → 契约 **§14.1**（写 `debt_touches`/分片，不直接改主文件） |
| glob 归并 | 取本轮白名单的最近公共**模块级**目录（如 `src/<module>/**`）与已有簇 `glob` 求交：相交 → 同簇 `touch_count += 1`（同轮多片只 +1）；无交 → 新增一行。**禁止**单文件粒度 |
| 升格后 | `touch_count >= deepen_threshold`（默认 3）→ `escalated`；下一轮**必须**插加深切片。授权级判定与 ADR：以 `mode: loop-lane` 调 [arch-reviewer](../arch-reviewer/SKILL.md)「授权级别」**只做归类 + 落 ADR**（不改码）；`structural` 或与 `docs/arch.md` 冲突 → `park` 升人，**禁止**擅自动结构 |
| 交接 | 换环时按契约 §10 复制 debt-map 路径与各簇计数；**禁止**下一环从 0 重新计数 |



### Phase 4 · 再 Inventory

**前门**必须满足编排契约 §5.1。失败走 §5.2，**不**进本 Phase。  
本批 `go_fast.status: skipped` + `zero_reason: no_fixable_items` → 不适用前门，按契约 §5.2.1 **无 Fix 推进**（`advanced_without_fix: true`，`gate_fail_streak` 不变），照常进入本 Phase。若连续空台触发 Phase 2 的 7a → 本盘点须按 [dig.md](references/dig.md) 执行，不得复读上一份清单交差。

**`round += 1`**（本次再盘点就是下一轮；报告 `-r<round>.md` 与之一对一）。  
同 scope 再跑 Phase 1：新文件 `-r<round>.md`，继承清单；独立核对仓内行为与文档状态（允许回潮 → `open`）。  
本轮 `done_count` = 相对上一份清单新标完成的 PRD ID 数（整数；可为 0）；`delta_remaining` = `remaining` 相对上一份清单的带符号变化（见 Phase 1.6）。  
回潮项下一轮优先。然后回到 Phase 2。

### Phase 5 · 收尾

1. 整环全量：编排契约 §5.3（含 **`residual_worktrees[]`**）。
2. **前端空态文案抽检**（本环 scope 曾改前端 / 空态 / 缺参引导页时**必做**；纯后端 scope 可跳过并写 `copy_spotcheck: skipped`）：
   - 对本批白名单内 EmptyState / 缺参引导 / 页头 description / Alert / 主按钮文案，抽读（可用 rg：`EmptyState|暂无|请指定|ci_id|_id|甲方|乙方|ADR|stub|worktree` 等收窄）  
   - 命中 craft §8 禁令（内部码、API path、**字段名/查询参数名当主句**、**甲方/乙方等合同口吻**、**工程黑话上屏**）或 craft §6 **套卡** → 记 `followups` 或下一轮 open（**不得**因「只是文案/布局」勾选放过）；未命中写 `copy_spotcheck: pass`  
   - 本抽检**不替代** ui-ux-reviewer；只拦「实现片把 OpenAPI 字段或研发术语写进客户界面」这类硬伤  
3. Ledger：`docs/material/loop-goal-prd/<YYYY-MM-DD>-<slug>-ledger.md`（见 [ledger.md](references/ledger.md)）；含 Resume 游标（§12）；有抽检则记 `copy_spotcheck`。  
4. 对话：轮次表、首末 `remaining`、完成 ID、blocked、`full_suite`、`integration_decisions`、残留 worktree、文案抽检结果。  
5. 中止：列出残留 worktree / 片分支；未合并勿强删。  
6. **未 `scope_clear` 收尾时**（`session_wall` / 中断 / `max_rounds` 等）：在对话末尾明示 ledger 路径，并提示下一句可直接说「继续」（或 `/loop-goal-prd-resume ledger=…`）。



## 回传格式

公共字段（`status` / `phase` / `scope` / `base_branch` / `attendance` / `integration_policy` / `cr_fix_scope` / `gate_fail_streak` / `stop_file` / `stop_pending` / `full_suite` / `residual_worktrees` / `integration_decisions` / `resumed_from` / `ledger` / `artifacts` / `rounds[].go_fast` 等）**结构见编排契约 §11.1 + §11**，此处不再复制。本环**差异字段**：

```yaml
phase: loop-goal-prd
prd_skill: create-evolution-prd    # 固定
plan_skill: create-evolution-plan  # 固定
arch_ref: docs/arch.md
batch_size: 10
plateau_rounds: 2
regression_rounds: 2
dig_on_under_target: true
dig_budget: 2
dig_waves_used: 0
dig_remaining: 2
dig_active: false
must_reach_target: false
rounds:
  - n: 1
    remaining: 0
    done_count: null       # DoneΔ；Fix 前首轮必须 null，禁止记 0
    delta_remaining: null  # remaining_n − remaining_{n-1}；Fix 前首轮 null；正数 = 净发散
    batch: []
    dig_wave: false
    dig_actions: []
    thin_patch_rejected: []       # 薄补丁守卫命中，回 open（诚实前提 7）
    deepen_slice: ""              # 本轮执行的加深切片簇名（refactor-shared；不计入 done_count）
    advanced_without_fix: false   # 契约 §5.2.1
final_remaining: 0
completed_ids: []
met_target: false
stop_reason: scope_clear | regression | max_rounds | plateau | no_fixable_items | blocked | pending_human_integration | user_stop | session_wall | stop_file
artifacts:
  - docs/automate/plan.md
  - docs/automate/prd.md
  - docs/arch.md
followups:
  - ""
```



## 红线

**三环共用红线见编排契约 §13**（诚实 / 编排纪律 / 计轮与门 / 测试收尾 / 并发范围），此处不重复。本环**专有**：

- **禁止**跳过 arch 门闩；**禁止**擅自改 `docs/arch.md` / goal 方向（须用户点名）  
- **禁止**假绿勾选 / 无真实验收标「已实现」；**禁止**用文档措辞抬「完成度」  
- **禁止**`remaining==0` 与硬门槛 open 并存时宣称 `scope_clear`  
- **禁止**`remaining>0` 且 dig 预算未尽时，以 `no_fixable_items` / 「本批无可修」假早停（须先 [dig.md](references/dig.md)）  
- **禁止**`must_reach_target=true` 时未 `scope_clear` 却以高原/回归/轮数上限/挖空/session_wall 收工（契约 §10.6）
- **禁止**把 Fix 前首轮 `done_count` / `delta_remaining` 记为 `0` 并计入高原 / 回归窗口  
- **禁止**自动发明无证据的功能项 / 里程碑并当成本环完成  
- **禁止**簇已 `escalated` 却继续对它打分片级补丁，或不排下一轮加深切片；**禁止**把加深切片计入 `done_count` 或勾 plan  
- **禁止**用薄补丁（改文案 / 加 tooltip / 局部 `if` 绕过而不改任务流程、信息结构、权责或状态机）标「已实现」；验收本身是去掉空态研发口吻/字段名时除外（见诚实前提 7）  
- **禁止**完整跑 create-evolution 新建 / 体检 / 干预模式冒充本环回写（仅 `honest-writeback`）  
- **禁止**编排方抢在 go-fast 之前勾选 plan / 标已实现  
- **禁止** Fix 后不校验源 Inventory、PRD 分片状态、plan 勾选三处一致  
- **禁止**用本环冒充产品八维分（冲分走 loop-goal-product）

