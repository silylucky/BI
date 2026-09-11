---
name: loop-goal
description: >
  Use when the user says loop-goal / 全仓打磨 / 舰队打磨 / 多业务线并行抛光 /
  全仓产品+业务流程+架构+UI/UX, or wants repo-wide product-map discovery then
  multiple loop-polishing legions on isolated worktrees/branches with fleet
  ledger resume — e.g. /loop-goal 全仓产品 + 业务流程 + 架构 + UI、UX 目标95 持续10轮.
  Supports must_reach_target fleet mode (持续运行直到全部军团达标).
  Also use to resume: loop-goal-resume / 续跑 /
  ledger=docs/material/loop-goal/<date>-<slug>-fleet-ledger.md.
---

# Loop-Goal（全仓舰队 · 发现 → 冲突图 → 多军团 loop-polishing）

编排 skill：**先**全仓盘点产品定位与业务线关系，**再**做并发冲突分析，**然后**按冲突图派出多支 [loop-polishing](../loop-polishing/SKILL.md) **军团**（各军团独立 worktree + 分支），用**舰队 ledger** 跟踪与续跑。

**不是** Cursor 定时 `/loop`；**不是** [loop-goal-prd](../loop-goal-prd/SKILL.md)（冲交付）；**不是** [loop-goal-product](../loop-goal-product/SKILL.md)（单 scope 冲产品分）；**不是** 单 scope 的 loop-polishing（无 scope 整仓空想抛光仍禁止——本 skill 的解法是**切成有界军团**）。

共享舰队 / 回写 / 前门 / Resume 真源仍见  
[go-fast/references/loop-orchestrator-contract.md](../go-fast/references/loop-orchestrator-contract.md)（下称**编排契约**）。  
每军团内部走 loop-polishing 全流程；本 skill 只做**舰队级**发现、冲突、分派、合回序、续跑。

`orchestrator` 传给子环：`loop-polishing`（军团内 Fix 不变）。本 skill 自身 `phase: loop-goal`。

## 何时启用

| 场景 | 动作 |
|------|------|
| `/loop-goal 全仓产品 + 业务流程 + 架构 + UI/UX 目标95 持续10轮` | 发现 → 冲突图 → 多军团并行（可并行波） |
| 全仓 / 多业务线同时打磨 | 本 skill；禁止用单次 loop-polishing 冒充 |
| 某军团意外停机 / 会话中断 | `loop-goal-resume` 读舰队 ledger，只重启未完成军团 |

**不要**：跳过冲突分析直接并行；多军团合回同一 `base_branch` 时忽略冲突边；用本 skill 冒充 plan/PRD 完成；删 `.stop` 续跑；在主会话偷改业务树（实现仍归各军团内 go-fast）。

## 默认参数

| 键 | 默认 | 说明 |
|----|------|------|
| `legion_skill` | `loop-polishing` | **固定**；每军团 Read 并执行该 skill |
| `target_score` | `95` | 传给每军团；用户可改 |
| `max_rounds` | `10` | **每军团**轮数上限（「持续 N 轮」） |
| `min_rounds` | 同 `max_rounds` | 传给 polishing |
| `lanes` | `product,flow,arch,ui,ux` | 军团焦点；用户说「含 code」才加 `code` |
| `fix_scope` | `all` | 传给 polishing |
| `attendance` | `unattended` | 传给军团 |
| `integration_policy` | `auto_best_require_adr` | 传给军团（契约 §2） |
| `cr_fix_scope` | `all` | 传给 polishing |
| `stop_file` | `.stop` | **仓库根**共用；任一检测点命中 → 舰队 `stop_pending`，允许在途军团收尾后不再派新波 |
| `fleet_cap` | `10` | 同波最多并行军团数（worktree 上限） |
| `merge_policy` | `conflict_order` | 合回序跟冲突图拓扑；用户可 `serial_all` |
| `force_large_scope` | 本 skill 内 **隐含 true** | 全仓由舰队切开；**单军团**仍须有界 `scope`，禁止把「整仓」传给单个 polishing |
| `dry_run` | `false` | `true`：只跑发现 + 冲突图 + 军团表，不派 polishing、不建 worktree 写业务树 |
| `must_reach_target` | `false` | `true` = 舰队持续运行直到全部军团 `met_target`；**禁**军团软停机（契约 §10.6，须传给每军团） |
| `discover_sources` | 见 [discover.md](references/discover.md) | goal/PRD/arch/ui/路由/剧本 |

## 调用示例

```text
/loop-goal 全仓产品 + 业务流程 + 架构 + UI、UX 进行打磨，目标95，持续10轮
```

```text
loop-goal lanes=product,flow,arch,ui,ux target=95 max_rounds=10 fleet_cap=10
```

```text
loop-goal-resume ledger=docs/material/loop-goal/2026-07-27-fleet-fleet-ledger.md
```

解析见 [references/parse.md](references/parse.md)。

## 诚实前提

1. **有界军团**：每支军团的 `scope` 必须是模块 / 子系统 / 单条（或紧密耦合的一组）业务流程，**禁止** `scope=整仓` 传给 loop-polishing。
2. **先冲突后并行**：未产出冲突图与波次表 → **禁止**建多 worktree 并行军团。
3. **隔离模型 A**：可并行军团 = 各自 `git worktree` + 独立分支（自 `base_branch` 切出）；合回 `base_branch` 须按冲突图顺序，**禁止**两军团同时往同一 base 推未协调的合入。
4. **契约仍生效**：军团内禁止同 base 双环；本舰队用**分支隔离**满足「禁止并行改同一 base」——并行的是**军团分支**，不是 base。
5. **续跑真源 = 舰队 ledger**：禁止猜军团列表；崩溃/墙钟/会话断 → 读舰队 ledger 的军团状态与子 ledger 路径，只 resume 未完成者。
6. **打磨 ≠ 发明功能**：同 loop-polishing；无证据新能力 → `wontfix` 或转 loop-goal-prd。
7. **`.stop`**：仓库根命中 → 舰队级 `stop_pending`；禁止删文件续跑。  
8. **全量只舰队收尾一次**：经本 skill 派出的每支 loop-polishing **必须** `skip_full_test`（`full_suite_deferred_to: loop-goal`）；**禁止**每军团 Phase 5 各跑一遍仓/FE 全量。全部应付军团终态并合入（或诚实记录未合入）后，由本 skill Phase 5 **至多 1 次**全量。

## 流程

```text
Parse → Discover（产品地图）→ Conflict（冲突图 + 波次）
  → 按波：建 worktree/分支 → 派 loop-polishing 军团（跳过全量）→ 更新舰队 ledger
  → 波末按拓扑合回 base → 下一波
→ 舰队收尾（≤1 次全量）→ Stop
中断后续跑：Resume 舰队 ledger → 只重启非终态军团
```

### Phase 0 · 解析

1. **一次** Read：本文件 + [discover.md](references/discover.md) + [conflict-graph.md](references/conflict-graph.md) + [legion.md](references/legion.md) + [fleet-report.md](references/fleet-report.md) + 编排契约 §10 / §10.5 / §12（舰队相关）+ loop-polishing SKILL 的「默认参数 / 何时启用 / 红线」摘要节（**不必**一次读完其全部 references；派军团时再按 polishing Phase 0 读）。
2. 确认 `target_score` / `max_rounds` / `lanes` / `fleet_cap` / `merge_policy` / `attendance` / `stop_file` / `dry_run` / `must_reach_target`。
3. **门闩**：HEAD detached → `BLOCKED`；工作区业务树有未提交脏改 → `BLOCKED`；记录 `base_branch`。  
4. 已知另一 **非本舰队** loop 正在改同一 `base_branch` → `BLOCKED`（本舰队自己的军团分支除外）。  
4b. **证据目录门**（编排契约 §0.5）：`.evidence/` 须已被 gitignore 且未被跟踪；缺 ignore 可补写；已跟踪 → `BLOCKED`。  
5. 亮一行：  
   `loop-goal | fleet | target=… | must_reach=on|off | rounds/legion=… | lanes=… | fleet_cap=… | base=… | evidence_dir=ok|repaired|blocked | dry_run=… | stop_file=.stop`  
6. Resume → [ledger.md](references/ledger.md) + 编排契约 §12；跳到 Phase R。

### Phase 1 · Discover（产品地图）

按 [discover.md](references/discover.md) 扫描并落盘：

`docs/material/loop-goal/<YYYY-MM-DD>-<slug>-product-map.md`

须含：产品定位、业务线/域列表、关键流程、主要交互面（路由/菜单）、跨域引用与共享壳、建议军团候选（一域或一流程一线）。

可消费：`docs/automate/goal.md`、PRD/plan、`docs/arch.md`、`docs/ui/`、[scenario-playbook](../scenario-playbook/SKILL.md) 发现逻辑（**只读其 discovery 约定**，不强制写出全套剧本除非用户要）。

**禁止**无证据臆造业务线；不确定标 `待确认` 并进舰队 `blockers`（不因此整舰队 `BLOCKED`，除非 0 条可派军团）。

### Phase 2 · Conflict（冲突图 → 波次）

按 [conflict-graph.md](references/conflict-graph.md) 产出：

`docs/material/loop-goal/<YYYY-MM-DD>-<slug>-conflict-graph.md`

边类型：路径/glob 相交、共享壳（layout/nav/auth）、共享状态机、共享 RBAC/权限面、共享数据模型写路径。

输出：**军团表** + **波次**（同波内无阻塞边，且 ≤ `fleet_cap`；超出则拆下一波或串行）。

`dry_run=true` → 写地图与冲突图后 Phase 5 骨架停机，`stop_reason: dry_run`。

### Phase 3 · Dispatch（按波派军团）

对当前波每一个军团，按 [legion.md](references/legion.md)：

1. 自 `base_branch`（或本波规定的 integrate 点）建分支 `loop-goal/<slug>/<legion_id>` + worktree。
2. **执行** loop-polishing：传入有界 `scope`、`target_score`、`max_rounds`、`must_reach_target`、`lanes` 焦点约束、`attendance` 等，以及 **强制** `skip_full_test=true` / `full_suite_deferred_to=loop-goal`（见 [legion.md](references/legion.md)）；军团自己的 ledger 落在  
   `docs/material/loop-polishing/<date>-<legion-slug>-ledger.md`（路径写入舰队 ledger）。
3. 更新舰队 ledger 军团行：`running` → `done` / `done_with_concerns` / `blocked` / `crashed` / `session_wall` / `stop_file`。
4. 同波可并行派出（Task/subagent 或等价），但主会话保持舰队 ledger 为真源。

波内全部终态后：按冲突图拓扑合回 `base_branch`（`merge_policy=conflict_order`）；**每合入一支军团后**按 [legion.md](references/legion.md) / 契约 **§14.1** 串行合并其 `debt_touches` 进主 `docs/material/debt-map.md`（禁止多军团并行写主文件）。残留 worktree 列入舰队 `residual_worktrees`（结构同契约 §5.3.1）。**未合并勿强删**。

### Phase 4 · 舰队停机判定

**`must_reach_target=true` 且仍有军团未 `met_target` 时**：#5、#7 **不得**作为终局收工；须续派 / Resume 该军团直至达标或命中 #1–#3、#6（§10.6）。

| # | 条件 | status | stop_reason |
|---|------|--------|-------------|
| 1 | 用户说停 | `DONE_WITH_CONCERNS` | `user_stop` |
| 2 | `stop_pending` / `.stop` | 允许在途军团收尾 → 收尾 | `stop_file` |
| 3 | `dry_run` 且地图+冲突图已落 | 收尾 | `dry_run` |
| 4 | 全部军团 `done` 且均 `met_target`（或无硬门槛遗留） | `DONE` | `fleet_met_target` |
| 5 | 全部军团终态但有 concerns / 未达标 | `DONE_WITH_CONCERNS` | `fleet_complete` |
| 6 | 无任何可派军团（发现失败） | `BLOCKED` | `blocked` |
| 7 | 本会话只跑完部分波 / 墙钟策略 | `DONE_WITH_CONCERNS` + 游标 | `session_wall` |

军团级达标不等于舰队 `DONE`：以舰队表汇总为准。

### Phase 5 · 收尾

1. **全量（强制口径）**：本舰队曾任意一次军团合入 `base_branch` → 编排方在 base 上跑 **≤1 次**仓/FE 全量（契约 §5.3）。  
   - `dry_run` / 从未合入 → `skipped_reason: dry_run` / `never_merged`  
   - 仅 `session_wall` 且用户将续跑 → 可骨架收尾并 `skipped_reason: session_wall`，**下一会话 Resume 到舰队终态时补跑**（不得永久跳过却宣称 `fleet_met_target`）  
   - 宣称 `fleet_met_target` / 舰队干净 `DONE` 前：须 `full_suite.ran: true` 且绿  
2. 写/更新舰队 ledger：[ledger.md](references/ledger.md)（含 `full_suite`）。  
3. **写舰队汇总报告**：[fleet-report.md](references/fleet-report.md) →  
   `docs/material/loop-goal/<YYYY-MM-DD>-<slug>-fleet-report.md`  
   （跨军团：跑了几轮、清了哪些 ID、未解决/合回失败、全量结果；禁止臆造）。  
4. 对话摘要：报告绝对路径 + 统计一行 + 产品地图/冲突图/ledger 路径 + 残留 worktree + 续跑命令。  
5. **不要**自动删 `.stop`。

### Phase R · Resume（舰队续跑）

1. 入口：`loop-goal-resume ledger=…` / `续跑` 点名舰队 ledger；`phase` 必须为 `loop-goal`。
2. 校验 `base_branch`；处理 `pending_worktrees`。
3. `.stop` / `stop_pending` → 直接 Phase 5，不新派。
4. 对状态 ∈ `pending|running|crashed|session_wall|interrupted` 的军团：若有子 ledger → 对该 worktree 执行 `loop-polishing-resume`；若无子 ledger 且仍 `pending` → 按 Phase 3 新派。
5. **禁止**把已 `done` 军团重跑一轮「刷分」；**禁止**重置舰队地图（除非用户显式要求重发现）。
6. 回传含 `resumed_from: <fleet-ledger>`。

## 回传格式

公共骨架见编排契约 §11.1（`phase: loop-goal`）。本 skill **差异字段**：

```yaml
phase: loop-goal
target_score: 95
must_reach_target: false
max_rounds: 10                 # per legion
lanes: [product, flow, arch, ui, ux]
fleet_cap: 10
merge_policy: conflict_order
dry_run: false
product_map: ""
conflict_graph: ""
fleet_report: ""              # Phase 5 汇总报告路径
waves:
  - n: 1
    legion_ids: []
legions:
  - id: L1
    scope: ""
    branch: ""
    worktree: ""
    status: pending | running | done | done_with_concerns | blocked | crashed | session_wall | stop_file
    met_target: false
    final_total: null
    stop_reason: ""
    legion_ledger: ""
    polishing_report: ""
fleet_met_target: false
full_suite:
  ran: false
  skipped_reason: ""   # deferred 由军团使用；舰队用 dry_run|never_merged|session_wall|"" 
stop_reason: fleet_met_target | fleet_complete | dry_run | blocked | user_stop | session_wall | stop_file
```

## 红线

其余见编排契约 §13。本 skill **专有**：

- **禁止**跳过 Discover / Conflict 直接多 worktree 并行  
- **禁止**把 `scope=整仓` 传给单个 loop-polishing  
- **禁止**冲突边未消解时同波并行两军团并同时合入 base  
- **禁止**无舰队 ledger 猜续跑；**禁止**已 done 军团无授权重跑  
- **禁止**主会话代替军团 go-fast 改业务树  
- **禁止**删 `.stop` 续跑；**禁止**用本舰队冒充 loop-goal-prd 交付完成  
- **禁止**军团 Phase 5 / `full_suite_every` 跑仓/FE 全量；**禁止**多军团各跑一遍全量；全量只许舰队收尾 ≤1 次  
- **禁止**未跑舰队全量（或合法 skip）却宣称 `fleet_met_target` / 干净 `DONE`  
- **禁止**`must_reach_target=true` 时仍有军团未达标却以 `fleet_complete` / `session_wall` 终局收工（契约 §10.6）
- **禁止**军团直接改主 `debt-map.md` 或两军团并行写同一主文件；合入后须 §14.1 串行 merge（见 [legion.md](references/legion.md)）

## 附加资源

- [parse.md](references/parse.md) · [ledger.md](references/ledger.md) · [fleet-report.md](references/fleet-report.md)  
- [discover.md](references/discover.md) · [conflict-graph.md](references/conflict-graph.md) · [legion.md](references/legion.md)
