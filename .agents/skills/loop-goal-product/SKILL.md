---
name: loop-goal-product
description: >
  Use when the user says loop-goal-product / 产品分闭环 / product-reviewer 冲分 /
  里程碑产品评修循环, or wants product-reviewer then go-fast in a loop until a
  target product score — e.g. review milestone and auto-fix toward 95.
  Supports must_reach_target mode (持续运行直到达标): no soft stop on plateau/regression/max_rounds while under target.
  Also use to resume an interrupted product loop: loop-goal-product-resume /
  续跑 / resume ledger=docs/material/loop-goal-product/<date>-<slug>-ledger.md.
---

# Loop-Goal-Product（product-reviewer → go-fast · 冲产品分）

编排 skill：**只**编排 [product-reviewer](../product-reviewer/SKILL.md) + [go-fast](../go-fast/SKILL.md)。  
流程：评 → 按刺点修 → 再评，直到总分 ≥ 目标或停机。  
**不是** Cursor 定时 `/loop`；**不是** [loop-goal-prd](../loop-goal-prd/SKILL.md)（按 plan/PRD+arch 冲里程碑实现）。

共享舰队 / 回写 / 契约门 / 全量纪律见  
[go-fast/references/loop-orchestrator-contract.md](../go-fast/references/loop-orchestrator-contract.md)（下称**编排契约**）。  
每轮前门前轻量卡片：[loop-orchestrator-card.md](../go-fast/references/loop-orchestrator-card.md)。  
全仓 / 多业务线舰队打磨见 [loop-goal](../loop-goal/SKILL.md)（本 skill 仅**单 scope** 冲产品分）。

## 何时启用

| 场景 | 动作 |
|------|------|
| 「loop-goal-product：审里程碑，go-fast 全修，目标 95」 | 解析 → 多轮闭环 |
| 里程碑验收前冲产品八维分 | 默认全修（含 P2），再评 |
| 指定模块/流程反复评修 | 固定 `scope` / `scope_level` |

**不要**：编排其他 reviewer；无范围空想冲分；硬闸未消却宣称逼近 95；用假绿抬分；用本 skill 冒充 plan/PRD 完成（先做完交付用 loop-goal-prd）；用本 skill 冒充全仓多军团（用 loop-goal）。  
**多环交接**：见编排契约 §10（推荐 prd → product → 可选 polishing；禁止并行改同一 base）。

## 默认参数

| 键 | 默认 | 说明 |
|----|------|------|
| `review_skill` | `product-reviewer` | **固定**；调用时 `mode: loop-lane` |
| `fix_skill` | `go-fast` | **固定** |
| `target_score` | `95` | 八维算术平均 |
| `fix_scope` | `all` | 含 P0+P1+P2；可收窄为 `P0+P1` / `P0` |
| `batch_size` | `5` | 每轮最多纳入 go-fast 的可修刺点 ID 数（硬门槛优先） |
| `max_rounds` | `5` | 以已完成 Review 次数计（前门失败不计入，见契约 §5.2） |
| `max_wall_rounds_per_session` | `= max_rounds` | 墙钟；**默认等于 `max_rounds` 故不额外生效**，仅用户显式调小（跨会话分批跑）时有意义 |
| `attendance` | `unattended` | 修复阶段；`attended` 时 seam/合回跟 go-fast 停问 |
| `scope_level` | 用户指定或 `module` | |
| `scope` | **必填或可推断** | 不可推断 → Phase 0 `BLOCKED` |
| `plateau_delta` | `2` | 连续两轮 `\|Δtotal\| <` 此值 → 高原（须 ≥3 次 Review） |
| `regression_stop` | `5` | 再评 `Δtotal ≤ -regression_stop` → 停机 |
| `integration_policy` | `auto_best_require_adr` | **三环统一默认**（契约 §2）；用户显式才降 `auto_best` 或改 `park` |
| `force_large_scope` | `false` | 阈值以契约 §13「大 scope 数值真源」为准：预估 open 项 >15 或整仓级时须显式 true，否则 `BLOCKED` |
| `cr_fix_scope` | `P0+P1` | 传给 go-fast unattended CR；显式 `all` 才升 P0+P1+P2 |
| `stop_file` | `.stop` | 三环共用优雅停机；见契约 §10.5 |
| `dig_on_under_target` | `true` | 未达标却可修空 → 先挖再停（Phase 2 · 8a） |
| `dig_budget` | `2` | 挖掘波数；耗尽仍空才 `no_fixable_items` |
| `must_reach_target` | `false` | `true` = 持续运行直到 `total >= target_score`；**禁**高原/回归/轮数上限/挖空/session_wall 软停机（契约 §10.6） |

**高原对照**：见编排契约 §0（本环 = Review `\|Δtotal\|`；与 prd DoneΔ、polishing composite Δ 不同）。

## 调用示例

```text
/loop-goal-product 使用 /product-reviewer 审核里程碑「CMDB 变更审核」，并使用 /go-fast 执行自动全部修复，目标95分
```

```text
loop-goal-product scope=CMDB变更审核 target=95
```

解析见 [references/parse.md](references/parse.md)。

## 诚实前提

1. 硬门槛命中 → 总分上限 69；**Fix 必须优先清可修硬门槛**（`分类=experience_fix` 或未标分类时的旧报告硬门槛），否则禁止空转软刺、禁止宣称逼近 95。硬门槛且 `capability_gap`/`out_of_scope` → **不得**本环 stub 顶替；标 `deferred` + followup PRD/蓝图；若因此无法清硬门槛 → 停机表 #4 / #12，**禁止**报 `DONE`/`met_target`。
2. 「全部修复」= `fix_scope`（默认 `all`，含 P2；可收窄为 `P0+P1` / `P0`）。
3. 纯视觉债 → 从本轮 `fix_scope` **剔除**，建议 ui-ux-reviewer；不计入本闭环假进度。**`capability_gap` / `out_of_scope`**（见 [product-reviewer/references/capability-gap.md](../product-reviewer/references/capability-gap.md)）→ 同样**剔除**出 Fix；处理清单 `deferred`；followups 写 `create-evolution-prd` / `product-blueprint`；**禁止**本环发明功能落地冒充冲分。未达标时：**先 dig**（[dig.md](references/dig.md)）找可修 `experience_fix`；dig 尽且只剩视觉债 / 能力缺口 / park → 再 `DONE_WITH_CONCERNS`。**不是纯视觉债**：空态/页头把 API 字段名、查询参数名（如 `ci_id`）当主文案 —— 属可发现/任务引导失败，须进本环可修清单（`experience_fix`）。
4. 外部契约不明 → 走编排契约 §2（三环默认 `auto_best_require_adr`：难回退选型先落 ADR 再真接；用户显式可降 `auto_best` 或改 `park`）。**禁止**「一律 BLOCKED、不研究」，也**禁止**用 stub 顶替。
5. 冲分是尽力而为：再评独立客观、允许降分；**不保证**单调逼近 `target_score`。未达标且可修空 → **必须 dig**（Phase 2 · 8a），禁止以「P0+P1 耗尽」假早停。
6. 回写遵守编排契约 §3：**go-fast 为唯一写者**；编排方校验，漏则补写并记 `writeback_repaired`。
7. **薄补丁不算完成**：为过分而做的最小表面修改（只改文案 / 加 tooltip / 加 `if` 绕过，而不改任务流程、信息结构、权责或状态机）→ 该刺点状态回 `open`，记 `thin_patch_rejected`，该簇 debt-map `touch_count += 1`。识别要点见 [anti-overpolish.md「薄补丁守卫」](../loop-polishing/references/anti-overpolish.md)（三环同尺，本环不另写一套）。**例外**：finding 本身就是「主路径文案研发口吻 / 字段名进空态 / 工程黑话上屏」时，改成 craft §8 用户向人话 **算完成**，不适用薄补丁否决。  
8. **产品文案给人看**：本环 / go-fast 生成的界面文案须用户向人话（契约 §13 + craft §8）；技术真名不进客户主路径。
9. **发现缺口 ≠ 实现缺口**：dig / 再评**允许**新标 `capability_gap`；**禁止**把缺口当本批 Fix；列出缺口**不得**抬分。
## 流程

```text
Parse → Round 1..N:
  product-reviewer（主会话取证打分）→ Ledger → 停机?
  → 否：go-fast Fix（编排契约：舰队 / 相关测 / 禁本轮全量）
  → 再评前门失败（编排契约 §5.1–§5.2）→ 不进再评；按失败表重试/停机
  → 前门通过（含合法 DONE_WITH_CONCERNS）→ 再 product-reviewer
→ 整环全量（Phase 5，编排契约 §5.3）→ Stop
```

### Phase 0 · 解析

1. **一次** Read：本文件 + product-reviewer（含 `loop-lane`）+ **编排契约**全文 + [orchestrator-api.md](../go-fast/references/orchestrator-api.md) + [dig.md](references/dig.md)。**Phase 0 不**读 go-fast 全文（省 Review 前 token）。**Fix 时**按 orchestrator-api **§1.1** 加载最小必读集。之后每轮 Review/前门只 Read [loop-orchestrator-card.md](../go-fast/references/loop-orchestrator-card.md) +（再评时）product-reviewer 再评节。  
2. 确认 `scope` / `target_score` / `fix_scope` / `batch_size` / `max_rounds` / `max_wall_rounds_per_session` / `attendance` / `integration_policy` / `cr_fix_scope` / `stop_file` / `dig_on_under_target` / `dig_budget` / `must_reach_target`。
3. `scope` 用户未给且无法从对话/仓内里程碑名推断 → **立即** `status: BLOCKED`，`stop_reason: blocked`，勿开评。  
4. **分支与工作区门闩（开评前，任一失败 → `BLOCKED`）**：  
   - 记录 `base_branch` = 当前 HEAD 分支名，写入回传与 ledger（后续「禁止两环并行改同一 base」「Resume 校验」都依赖它）  
   - HEAD detached → `BLOCKED`（不猜基线）  
   - 工作区有未提交改动（业务树）→ `BLOCKED`，提示先提交或 stash；**禁止**让开工前的脏改被卷进本环合回  
   - 已知另一 loop 环正在同一 `base_branch` 上跑 → `BLOCKED`  
4b. **证据目录门**（编排契约 §0.5）：`.evidence/` 须已被 gitignore 且未被跟踪；缺 ignore 可补写；已跟踪 → `BLOCKED`。  
5. **大 scope 护栏**（阈值真源：契约 §13）：预估 open 刺点 **>15**，或用户 `scope` 明显「整仓/全部模块」→ **除非** `force_large_scope=true`，否则 `BLOCKED`（`stop_reason: blocked`），建议收窄 `scope` 或 `fix_scope=P0+P1`；通过时 ledger 记 `large_scope: true`。  
6. **扫描底座探测（只探测不装）**：约定见 [code-scanning](../code-scanning/SKILL.md) 隐式入口。跑：
   `command -v ast-grep; command -v codegraph; ls -d .codegraph sgconfig.yml 2>/dev/null`  
   - ledger 写 `scan_tools:`（例：`ast-grep+codegraph` / `ast-grep` / `rg-only`）  
   - 缺 `ast-grep`，或源文件明显 ≥100 且无可用 `.codegraph/` → **追加** ledger / 回传 `blockers`（**不**因此整环 `BLOCKED`）：说明降级影响与「用户显式要求时可 bootstrap」  
   - **禁止** Phase 0 执行安装 / `codegraph init`  
7. 亮一行：`loop-goal-product | target=… | must_reach=on|off | fix_scope=… | batch=… | max_rounds=… | wall=… | scope=… | base=… | attendance=… | integration_policy=… | cr=… | dig=on/budget | scan=… | evidence_dir=ok|repaired|blocked | stop_file=.stop | fix=go-fast-fleet`。  
8. 每轮前门前过编排契约 §9 / card 自检；每轮开始与 Fix 后查 `.stop`（契约 §10.5）。  
9. Resume：用户给 ledger 或 `续跑` → 编排契约 §12，跳过重新发明 scope；继承 `dig_waves_used` / `dig_remaining`。

### Phase 1 · Review

按 product-reviewer 全流程，`mode: loop-lane`（含再评继承规则）。  
报告须含「处理清单」（`硬门槛` / `视觉债` / **`分类`** 列）及「体验依赖能力清单」（可无缺口）；落盘路径记入 ledger。  
首轮：`…/<date>-<slug>-r1.md`（或可省略 `-r1`）；第 N 次再评：`…-r<N>.md`（不覆盖上份）。

### Phase 2 · 停机（Review 后）

**Δ 定义**：`Δtotal_n = total_n - total_{n-1}`（第 1 轮无 Δ，记 `—`）。  
**高原**：须已有 ≥2 个可计算 Δ（即至少完成 **3 次** Review），且最近两轮均满足 `|Δtotal| < plateau_delta`。  
用绝对值：大跌不算高原（大跌走回归停机）。

**判定序（强制）**：下表**自上而下，首个命中者生效**；多条同时成立时以先命中者的 `status` / `stop_reason` 为准，其余在 ledger 记为「同时命中」。

**`must_reach_target=true` 且 `total < target_score`（或仍有未清硬门槛）时**：下表 #5、#8b、#9–#11 **不适用**（软停机纪律见编排契约 §10.6）；须继续评→修或 dig / Resume，**禁止**终局收工。

| # | 条件 | status | stop_reason |
|--:|------|--------|-------------|
| 1 | 用户说停 | 建议 `DONE_WITH_CONCERNS` | `user_stop` |
| 2 | `stop_pending`（`.stop` 已检出，契约 §10.5） | Phase 5 后 `DONE_WITH_CONCERNS` | `stop_file` |
| 3 | `gate_fail_streak ≥ 2` | Phase 5 后 `DONE_WITH_CONCERNS` 或 `BLOCKED` | `blocked` |
| 4 | 硬门槛 open 且本轮无法纳入可修项（含仅剩 `capability_gap` 硬门槛、不可择优、需人裁定） | `BLOCKED` | `blocked` |
| 5 | 再评 `Δtotal ≤ -regression_stop` | Phase 5 后 `DONE_WITH_CONCERNS` | `regression` |
| 6 | `total >= target_score` 但仍有硬门槛 | **禁止**报 `DONE`；继续 Fix 或 `BLOCKED` | — |
| 7 | `total >= target_score` 且无未清硬门槛 | 先 Phase 5 全量；**绿**才 `DONE`/`met_target` | `met_target` |
| 8 | 连续 2 个评分台 `advanced_without_fix`（契约 §5.2.1） | **先 dig 再停**：见 8a/8b | — |
| 8a | 第 8 行成立，且 `total < target_score`，且 dig 预算未尽（默认 `dig_budget=2`，`dig_on_under_target=true`） | **禁止停机**；下一评分台必须带 dig 指令：对准落后维挖新刺点；可临时纳入非视觉债、非缺口的 score_P2；挖到可修 `experience_fix` 则恢复 Fix | —（继续） |
| 8b | 第 8 行成立，且（已达标 **或** dig 关/预算尽） | Phase 5 后 `DONE_WITH_CONCERNS` | `no_fixable_items` |
| 9 | 高原（上式） | Phase 5 后 `DONE_WITH_CONCERNS` | `plateau` |
| 10 | `round >= max_rounds` | Phase 5 后 `DONE_WITH_CONCERNS` | `max_rounds` |
| 11 | 本会话评分台数 ≥ `max_wall_rounds_per_session` 且未达终态 | Phase 5 骨架（可 `session_wall`）+ ledger 游标；`DONE_WITH_CONCERNS` | `session_wall` |
| 12 | 仅剩需裁定 / `park` 挂起 / 纯视觉 / `capability_gap` / `out_of_scope` / 非本闭环能修 | `BLOCKED` 或 `DONE_WITH_CONCERNS` | `blocked` |

**注**：单次「本轮无可修项」**不**停机——§5.2.1 推进。连续 2 次且**未达标** → **挖一波**（[dig.md](references/dig.md)），**禁止**以「P0+P1 耗尽」假早停；仅 dig 预算尽或已达标才走 8b。

停机意图确定后仍须走 Phase 5（编排契约 §5.3）；`never_merged` / `skip_full_test` / `session_wall` 除外纪律见契约。

### Phase 3 · Fix（go-fast · 必须舰队）

编排方只做编排；细则见**编排契约** + **card**。本 skill 仅补产品向选批：

1. **执行** go-fast（动作真源：[orchestrator-api.md](../go-fast/references/orchestrator-api.md) **§1.1**——同会话戴帽或 Task 委派；本会话首次 Fix 加载最小必读集；后续轮读 card，勿零读假装舰队）；`orchestrator: loop-goal-product`；传入 `attendance` / `integration_policy` / `cr_fix_scope` / `source_report` / `batch`。  
2. **提取刺点（顺序强制）**  
   - 先：命中 debt-map `escalated` 簇的刺点**整体剔除**（`deferred: debt_escalated`；**不**计入 `no_fixable_items`），并把该簇的加深切片排进本轮（独占一波、不占 `batch_size`；须 ADR 已落盘）  
   - 再：`硬门槛=是` 且 `分类≠capability_gap|out_of_scope`（缺分类列的旧报告视为可修）且落在 `fix_scope` 的 `open`（含回归）  
   - 再：其余 `fix_scope` 且 `视觉债=否` 且 `分类=experience_fix`（或缺分类）  
   - **至多 `batch_size` 个**；其余留以后轮  
   - 剔除：`视觉债=是`；`分类=capability_gap|out_of_scope`（`deferred` + followup PRD/蓝图）；已 `blocked`/`deferred`/`wontfix`/`verified`  
   - 契约不明：编排契约 §2  
   - 硬门槛仍 open 却修无关软刺 → **违规**  
   - 将 `capability_gap` 当本批实现或 stub 顶替 → **违规**
3. **路径**：先查编排契约 §6.1 `spec_reuse`；命中 → Path A。否则默认 B（报告 ≠ 规格）；Path A 仅当 §6 全部满足。  
4. **并发 / 验证 / 回写**：编排契约 §3–§4、§8。  
5. **校验回写**：检查 go-fast `summary` 与源报告处理清单；漏写则补写，`writeback_repaired: true`。并**逐条过薄补丁守卫**（诚实前提 7）。  
6. **ledger**：落「处理明细」；记 `code_review_delta`、`gate_fail_streak`、`spec_reuse`。  
7. **再评前门（B 层必须自己跑）**：A 层格式检查后，编排方在目标仓亲自执行  
   `~/.agents/skills/_bin/gate-check batch --slices <本批> [--strict-red] --json`（`--slices` 只能取回传 `slices[].id` 全集，禁止从刺点 ID 猜；退出码 `0`/`1`/`2` 三值语义见 §5.1 B 层，**`2`=ENV_ERROR 一律按失败**），**以退出码为准**；与回传 `evidence.gate` 不符 → 以自跑为准、记 `evidence_mismatch: true`，下一轮强制 `--strict-red` 且至少抽查一次 `gate-check verify --slice <id>`（§5.1.1）。`verify` FAIL → 相关 ID 回 `open` + 该簇 `regression_count += 1`。失败走 §5.2（`gate_fail_streak++`，不 +`round`）。

### Phase 3.5 · debt-map 维护（契约 §14 为真源）

| 项 | 本环补充 |
|----|----------|
| 谁读 / 谁写 | 提取刺点**前**先读 `docs/material/debt-map.md` 取各簇状态；**编排方**（非 go-fast）在本轮前门判完后、再评之前回写（无文件则创建）；前门失败或 `verify` FAIL 也要写（`regression_count += 1`）。若在 loop-goal 军团内 → 契约 **§14.1**（写 `debt_touches`/分片，不直接改主文件） |
| glob 归并 | 取本轮白名单的最近公共**模块级**目录（如 `src/<module>/**`）与已有簇 `glob` 求交：相交 → 同簇 `touch_count += 1`（同轮多片只 +1）；无交 → 新增一行。**禁止**单文件粒度 |
| 升格后 | `touch_count >= deepen_threshold`（默认 3）→ `escalated`；下一轮**必须**插加深切片。授权级判定与 ADR：以 `mode: loop-lane` 调 [arch-reviewer](../arch-reviewer/SKILL.md)「授权级别」**只做归类 + 落 ADR**（不评分、不进八维、不改码）；`structural` → `park` 升人 |
| 交接 | 换环时按契约 §10 复制 debt-map 路径与各簇计数；**禁止**下一环从 0 重新计数 |

### Phase 4 · 再评

**前门**必须满足编排契约 §5.1。失败走 §5.2，**不**进本 Phase。  
本轮 `go_fast.status: skipped` + `zero_reason: no_fixable_items` → 不适用前门，按契约 §5.2.1 **无 Fix 推进**（`advanced_without_fix: true`，`gate_fail_streak` 不变），照常进入本 Phase。若连续空台触发 Phase 2 的 8a → 本评分台须带 dig 指令（挖新刺点 / 对准落后维），不得复读上份报告交差。

**`round += 1`**（本次再评就是下一个评分台；报告 `-r<round>.md` 与之一对一）。  
同 scope 再跑 product-reviewer（`mode: loop-lane`）：新文件 `-r<round>.md`，**继承**源报告处理清单，独立重打八维；`done`→`verified` 或回潮 `open`。  
再评须**独立客观打分**（见 product-reviewer）：不锚定上轮总分/目标分；允许降分；ledger 如实记 Δ。  
回潮 `open` 下一轮 Fix 优先于同级新软刺。  
然后回到 Phase 2。

### Phase 5 · 收尾

1. 整环全量：编排契约 §5.3（含 **`residual_worktrees[]` 强制清单**）。  
2. Ledger：`docs/material/loop-goal-product/<YYYY-MM-DD>-<slug>-ledger.md`（见 [ledger.md](references/ledger.md)）；含 Resume 游标字段（契约 §12）。  
3. 对话：轮次表、首末分、已修/未修、路径、`full_suite`、`integration_decisions`、残留 worktree。  
4. 中止：列出残留 worktree / 片分支；未合并勿强删。

## 回传格式

公共字段（`status` / `phase` / `scope` / `base_branch` / `attendance` / `integration_policy` / `cr_fix_scope` / `gate_fail_streak` / `stop_file` / `stop_pending` / `full_suite` / `residual_worktrees` / `integration_decisions` / `resumed_from` / `ledger` / `artifacts` / `rounds[].go_fast` 等）**结构见编排契约 §11.1 + §11**，此处不再复制。本环**差异字段**：

```yaml
phase: loop-goal-product
review_skill: product-reviewer     # 固定
target_score: 95
fix_scope: all                     # 本环特有：默认含 P2
scope_level: module
batch_size: 5
plateau_delta: 2
regression_stop: 5
dig_on_under_target: true
dig_budget: 2
dig_waves_used: 0
dig_remaining: 2
dig_active: false
must_reach_target: false
rounds:
  - n: 1
    total: 0                       # 八维算术平均
    delta: null                    # Δtotal；第 1 轮 null
    dig_wave: false
    dig_focus_dims: []
    effective_fix_scope: all
    fixed: []
    thin_patch_rejected: []        # 薄补丁守卫命中，回 open（诚实前提 7）
    deepen_slice: ""               # 本轮执行的加深切片簇名（refactor-shared；不记 Δ 进步）
    code_review_delta: none | possible_new_product_findings
    advanced_without_fix: false    # 契约 §5.2.1
final_total: 0
met_target: false
stop_reason: met_target | regression | max_rounds | plateau | no_fixable_items | blocked | user_stop | session_wall | stop_file
```

`go_fast.skipped` / `zero_reason`：

| 值 | 何时 |
|----|------|
| `no_fixable_items` | 剔除视觉债/capability_gap/out_of_scope/blocked/park 后无可修；或 Phase 2 已决定停 |
| `blocked_upstream` | 硬门槛/不可择优契约未清，无法开工 |
| `degrade` | 有工单但未并行派出；填 `degrade_reason` |

## 红线

**三环共用红线见编排契约 §13**（诚实 / 编排纪律 / 计轮与门 / 测试收尾 / 并发范围），此处不重复。本环**专有**：

- **禁止**编排非 product-reviewer / 非 go-fast（例外：debt-map 升格时可 `loop-lane` 调 arch-reviewer **仅**做授权级归类 + ADR，不得据此打分）  
- **禁止**未达标且 dig 预算未尽时，以 `no_fixable_items` / 「可修耗尽」假早停（须先 [dig.md](references/dig.md)）  
- **禁止**`must_reach_target=true` 时未达标却以高原/回归/轮数上限/挖空/session_wall 收工（契约 §10.6）
- **禁止**簇已 `escalated` 却继续对它打刺点级补丁，或不排下一轮加深切片  
- **禁止**用薄补丁（改文案 / 加 tooltip / 局部 `if` 绕过而不改任务流程、信息结构、权责或状态机）计为刺点完成；finding 本身是用户向文案/禁字段名进空态时除外（诚实前提 7）  
- **禁止**调用 product-reviewer 时省略 `mode: loop-lane`  
- **禁止**硬门槛仍在时宣称冲向 `target_score` 或报 `met_target`  
- **禁止**超出 `fix_scope`；**禁止**把纯视觉债塞进本闭环冒充产品进度
- **禁止**本环实现 `capability_gap` / 发明功能抬分；缺口只 deferred + followup PRD
- **禁止**要求再评「不得低于上轮」或按 `target_score` 倒推定分  
- **禁止**再评清空处理清单，或只写新 `-rN` 而漏源报告回写校验  
- **禁止**扩大到源报告之外「顺便重构」  
- **禁止**用本环冒充 plan/PRD 完成（交付完成度走 loop-goal-prd）  
- **禁止**把「读了 go-fast」当成已派舰队；回传须含 `tickets_dir` / `wave_size` / `zero_reason` / `source_report` / `summary`