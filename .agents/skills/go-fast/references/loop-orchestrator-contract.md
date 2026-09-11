# Loop 编排契约（loop-goal-product / loop-goal-prd / loop-polishing 共用）

各 loop 与 go-fast 的**共享不变量**。差异（冲产品分 vs 冲完成度 vs 多维打磨）写在各自 SKILL；此处禁止各写一份互相打架的舰队/回写/前门规则。

调用方：`orchestrator: loop-goal-product | loop-goal-prd | loop-polishing`。  
舰队级编排 [loop-goal](../../loop-goal/SKILL.md) **不**作为 go-fast 的 `orchestrator` 值；它派出的军团仍传 `loop-polishing`。舰队 Resume / 波次 / worktree 隔离见该 SKILL；本契约 §10 / §12 对其 `phase: loop-goal` ledger **同样适用**路由口径。

**Path A 检查表、再评/再盘点前门、前门失败下一跳、integration_policy 档位、Resume** 以本文为**唯一真源**；`go-fast` 与**三环**只引用，不另写互相打架的副本。

**Token 读法**：

| 时机 | 读什么 |
|------|--------|
| **Phase 0**（编排） | **一次** Read 本文（含 **§0.5**）+ [orchestrator-api.md](orchestrator-api.md)。**此阶段不**读 go-fast 全文 |
| **每轮 Review / 选批 / 前门** | 只 Read [loop-orchestrator-card.md](loop-orchestrator-card.md)（+ 本轮 reviewer） |
| **本会话首次 Fix**（及 Resume / 新会话 marathon 后首次 Fix） | 按 [orchestrator-api.md](orchestrator-api.md) **§1.1** 加载 go-fast **最小必读集**（戴实现帽）；**禁止**整环从未读 go-fast 正文却宣称已舰队 Fix |
| **同会话后续 Fix 轮** | 不强制重读全文；必读 card；命中 api §1.1 回读触发条件时补读对应节 |
| 争议 / 首次启用 / Resume 歧义 | 回读本文对应节 |

---

## 0. 高原对照（三环 · 防混用）

| 环 | 计量 | 窗口 | 首轮/首评 |
|----|------|------|-----------|
| **loop-goal-prd** | Fix **后** Inventory 的 `done_count`（DoneΔ）连续为 `0` | `plateau_rounds`（默认 2）个 Fix 后盘点 | Fix 前 Inventory：`done_count: null` / `—`，**不计入** |
| **loop-goal-product** | 相邻两次 Review 的 `\|Δtotal\| < plateau_delta` | 最近 2 个可计算 Δ；且已完成 ≥3 次 Review | 第 1 轮无 Δ |
| **loop-polishing** | 相邻两次 **composite** 的 `\|Δtotal\| < plateau_delta` | `plateau_composites` 次可计算 Δ；且 `composite_count ≥ plateau_min_composites` | 非 composite 轮 `total_stale`，不参与 Δ |

---

## 0.5 证据目录门（Phase 0 · 入口强制）

适用于：**三环**、**loop-goal**、**单独 go-fast** 的 Phase 0 / 开工前（与 [evidence.md](evidence.md) 同尺）。  
目的：`.evidence/` 是本地验证工件，**禁止入库**；入口技能**不得**假定 `evidence-run` 已跑过才安全。

在目标业务仓根执行（编排方 / go-fast 亲自跑，禁止空想）：

```bash
# A) .gitignore 是否忽略
grep -E '^(\.evidence/?|\.evidence)$' .gitignore 2>/dev/null \
  || grep -E '(^|/)\.evidence(/|$|\*)' .gitignore 2>/dev/null

# B) 是否已被 git 跟踪（非空 = 违规）
git ls-files .evidence '.evidence/**' 2>/dev/null
```

| 结果 | 动作 |
|------|------|
| A 未命中 | **允许**补写一行 `.evidence/` 到 `.gitignore`（与 `evidence-run` 同口径）；ledger / 回传记 `evidence_gitignore_repaired: true` |
| B 非空（已跟踪） | **`BLOCKED`**：提示先 `git rm -r --cached .evidence`（保留本地目录）并确认 ignore；**禁止**继续开评 / 开工 / 派军团 |
| A 已忽略且 B 空 | 通过；ledger 可记 `evidence_dir: ignored_ok` |

**禁止**：把 `.evidence/**` 提交进业务仓；用「脚本稍后会 ignore」跳过本门；已跟踪时删本地证据目录灭迹。  
本门**不管** `docs/material/**/-rN.md` 膨胀（另策）；只护证据目录。

---

## 1. 角色

| 角色 | 职责 |
|------|------|
| **编排方（主会话）** | Parse → Review/Inventory/打磨评分台 → 停机判定 → 选 batch/刺点 → 调 go-fast → **自己跑 `gate-check` 做事实校验** + 校验回写（§5.1）→ 再评/再盘点 → Phase 5 全量 → ledger + debt-map（§14）；中断后续跑见 §12 |
| **go-fast** | 规格/工单、舰队实现、合回、相关测、CR（unattended）、**唯一回写写者**（见 §3） |
| **实现 subagent** | 白名单内改业务树；禁止主会话在未合法降级时直接改业务实现 |

编排方 **禁止**「心想 go-fast」后在主会话手改业务树；但**必须**自己执行 `gate-check`（只读校验）。**不代劳的是实现与修复，不是校验** —— 见 §5.1 B 层。

---

## 2. 契约不明门（统一口径）

与 go-fast「契约不明门」、integration-research 同尺。参数：`integration_policy`。

| 值 | 行为 |
|----|------|
| **`auto_best`**（单独 go-fast 默认） | research → 八维择优 → 选定 → 真接（unattended 不等人）；难回退标 `needs_adr: true`（可事后补 ADR，停机报告必须列出） |
| **`park`** | 出简报后挂起该项、保持未实现；不自动开工；仍禁 stub |
| **`auto_best_require_adr`**（**三环默认**） | 同 `auto_best`，但凡 `needs_adr: true`（难回退选型）→ **必须先落 ADR** 再真接；unattended 亦遵守，缺 ADR → 该项 park / 整环 `DONE_WITH_CONCERNS`，禁止先真接后补 |

**默认档（唯一口径）**：`orchestrator` 为三环之一 → 默认 `auto_best_require_adr`；单独 go-fast → 默认 `auto_best`。两者均可被用户显式覆盖。  
不可择优（NDA / 无人批 / 无可定义真实验收路径）→ `park` 或整环 `BLOCKED`。

**硬禁**：stub/mock/假成功顶替；跳过研究+八维猜接；`unattended` 干等用户（`park` 除外）。

**`auto_best` / `auto_best_require_adr` 审计最小集**（缺一不得宣称已选定开工）：

| 字段 | 要求 |
|------|------|
| `brief` | `docs/integrations/<slug>.md` 路径 |
| 八维表 | 简报内对照表 |
| `selected` | 选定方案名 |
| ledger 一行 | 记录 brief / selected / auto_started |
| 难回退 | `needs_adr: true`；`auto_best_require_adr` 时还须 ADR 路径已落盘 |

`loop-goal-product`、`loop-goal-prd` 与 `loop-polishing` **同一套门**；禁止 product 写「一律 BLOCKED」、prd/go-fast 写「一律 auto_best」的分叉出口。

---

## 3. 回写单一写者

| 产物 | **写者 = go-fast**（合回 + 相关测绿后） | **编排方** |
|------|------------------------------------------|------------|
| product 源报告「处理清单」 | 本批刺点 ID → `done`/`blocked`/… + 摘要/验证/规格路径 | 校验 `summary` ⊆ 本批；漏写则补写并记 `writeback_repaired: true` |
| PRD 分片状态 + plan 勾选 | 仅真实验收通过的 ID；禁假绿 | 同上校验；禁止在 go-fast 未写时抢先勾选抬完成度 |
| 源 Inventory 处理清单 | 本批 PRD ID 状态 | 同上 |
| **polishing 源打磨报告**处理清单 | 本批 ID → `done`/`blocked`/…；**禁止**把过抛剔除项标 `done` 抬分 | 同上校验；归一规则见 loop-polishing `finding-normalize.md` |
| ledger「处理明细」 | 可与编排方分工：go-fast 回传 ID 后由编排方落 ledger，但**状态不得优于** go-fast `summary` | 落盘 ledger；与源报告/PRD/plan/打磨报告对齐 |

**summary 门**：本批有可验收完成项时，go-fast 回传 `summary`（已处理 ID 列表）**非空**；`summary` 空却宣称本批 fixed → **禁止**再评/再盘点抬分或勾选。

再评新 `-rN` / 再盘点新文件 **不替代**源报告/源 Inventory 回写义务。

---

## 4. 舰队与并发

1. **执行** go-fast：动作与读盘见 [orchestrator-api.md](orchestrator-api.md) **§1 / §1.1**（标明 `orchestrator`；本会话首次 Fix 加载最小必读集；后续轮勿无「省读」跳过实现纪律）。  
2. 白名单来自刺点证据路径或 PRD/plan 锚点；标依赖边（共享壳 / RBAC / 同一状态机 / PRD 依赖性）。  
3. 白名单不相交 **且** 无产品语义阻塞边 → 同波 worktree + 实现 subagent（上限 `fleet_cap`）；否则串行或先契约片。  
4. 一次回复派出同波全部实现 subagent（能并行时）；否则 `zero_reason`：`degrade` | `no_fixable_items` | `blocked_upstream`。  
5. **降级**：仅 1 工单 / 白名单相交 / 共享壳边 / 无 worktree → `zero_reason: degrade` + `degrade_reason`；仍优先单个实现 subagent + worktree。  
6. 主会话允许：解析、写 specs/tickets、分派、merge、相关测、校验/补回写、ledger、清理残留 worktree（未合并勿强删）。  
7. 主会话禁止：未派实现 subagent（或未合法降级）时直接改业务实现树。

### 硬门槛 / batch 序（共用精神）

- 先清 `硬门槛=是`（或 Inventory `hard_gate=是`）且可修的 `open`。  
- 硬门槛仍 open 却冲无关软项 → **违规**。  
- 硬门槛清不掉且不可按 `integration_policy` 真接 → 本轮 `blocked_upstream` / 整环 `BLOCKED`，不空转。

### `refactor-shared` 片（编排侧）

某簇按 §14 升格、或 ≥2 片要写相似逻辑时，允许在某一轮 batch 里插入 go-fast 的 `refactor-shared` 片（独占一波、可跨白名单、只做共享抽象提取）。

| 项 | 规则 |
|----|------|
| 名额 | **不占** `batch_size` 的 finding 名额（否则编排方为冲分永远不做它） |
| 并发 | 独占一波；**禁止**与命中同簇的 finding 片同波 |
| 计数 | **不计入**所属簇 `touch_count`（§14） |
| 完成判定 | 不产出新 `done` finding。判定 = 相关测绿 + 行为不变（`case-count` 不降）+ 该簇 debt-map `touch_count` 归零 |
| 计分 | **禁止**拿它抬 Δtotal / DoneΔ / 勾 PRD；该轮无其它 Fix 时不记 Δ 进步，但**确有 Fix**，不适用 §5.2.1 |

---

## 5. 验证、再评/再盘点前门、全量

| 时机 | 规则 |
|------|------|
| 片内 / 波次 / 本轮合回 | **只相关测**；禁 FE 全量与 `pnpm test` watch |
| 本轮 go-fast 回传 | `full_suite.deferred_to_loop: true`；`full_suite.ran: false` |
| **再评/再盘点前门** | 见 §5.1（唯一口径） |
| **前门失败** | 见 §5.2 |
| **Phase 5 整环全量** | 见 §5.3 |

### 5.1 再评/再盘点前门（唯一口径）

**适用范围**：本节只裁判**本轮已派出 Fix**的情况。本轮 `go_fast.status: skipped` 且 `zero_reason: no_fixable_items` 时走 §5.2.1「无 Fix 推进」，**不**适用本节、**不**记前门失败。

前门分两层：**A 层只是格式检查，B 层才是决定性的**。字段填得再漂亮，B 层退出码非 0 一律不得进再评。

**A 层 · 格式前置检查**（读回传字段；任一不成立即失败，不必再跑 B）

1. `merged_to_base == true`  
2. 工作区在 `base_branch`；无未合入脏改（含 CR 自动修后）  
3. §3 summary 门通过（有可完成项时 `summary` 非空；且 `summary` ⊆ 本批）  
4. `go-fast.status ∈ { DONE, DONE_WITH_CONCERNS }`；若为 `DONE_WITH_CONCERNS`，`code_review.remaining` **仅**含契约/裁定/需人批类（**无可修却未修**的 finding）

**禁止**用笼统「非 DONE 不进再评」挡掉合法的 `DONE_WITH_CONCERNS`（与 §8 一致）。

**B 层 · 事实校验（编排方自己跑，以退出码为准）**

编排方**必须**在目标仓自己执行下列命令；**禁止**只读回传的 `evidence.gate` 字段就放行（那是自证闭环，等于没做门）：

```bash
G=~/.agents/skills/_bin/gate-check
$G batch --slices <本批切片ID逗号分隔> [--strict-red] --json   # 有测试基建即开 --strict-red
```

**`--slices` 参数来源（唯一口径 · 禁止臆造）**：取值**只能**是本轮 go-fast 回传 `slices[].id` 的全集，排除 `status: BLOCKED` 且无任何证据工件的片；其余片（含 `s0_shell` / `refactor_shared`）一律带上。编排方**禁止**自己发明、缩写、重命名 slice-id，也**禁止**从 finding ID（`F03` / `B-1` / PRD 分片 ID）反推或猜测切片名 —— finding → slice 的对应关系由回传 `slices[].finding_ids` 强制给出（结构见 [go-fast/SKILL.md](../SKILL.md)「回传格式」）。回传缺 `slices[]` 或映射不全 → 按 A 层失败处理，要求 go-fast 补齐，**禁止**猜一个 id 去跑。

**`gate-check` 退出码三值语义（唯一口径）**：`0` = PASS / `1` = FAIL / `2` = ENV_ERROR。

| 退出码 | 判定 |
|--------|------|
| `0` | 过前门 |
| `1` | 前门失败（§5.2） |
| `2` | **一律按前门失败处理**：记 `gate_recheck.batch: ENV_ERROR`、`gate_fail_streak++`、`reasons` 原样进 ledger；先修环境（slice-id 拼写、执行位置、工件目录）再重跑。**绝不可**读作「查不到证据 = 无事发生」而放行 —— 查无工件恰是最常见的失效模式 |

| 判定 | 规则 |
|------|------|
| `batch` 退出码 | 按上表三值语义；非 `0` 一律不得进再评 |
| 用例数 | `batch` 已含 `case-count`；对存疑片可单跑 `$G case-count --slice <id>`，FAIL 即前门失败（缩小测试范围换绿） |
| 与回传不一致 | 回传 `evidence.gate.status` 与编排方跑出的结论不同 → **以自己跑的为准**，本轮记 `evidence_mismatch: true` |
| 外部契约 | 本批 `external_deps[]` 中 `credential: have` 且被标为已实现/已勾选的项，`smoke` 须非空且 `$G smoke --slug <slug>` 过；否则前门失败（**假通 = 假绿**） |
| `credential: need` / `blocked` | 只能 `park` 或 `DONE_WITH_CONCERNS` + `blockers`；**禁止**静默推进为已实现、**禁止**进 `summary` 或勾选 PRD/plan |

**降级**：确无自动测基建的片按 evidence.md §5 不加 `--strict-red`；`evidence.degraded[]` 须列明片与理由，告警**原样进 ledger**，不得静默吞掉。

`BLOCKED` / `skipped` + `blocked_upstream` → **不**进再评/再盘点；走 §5.2。  
`skipped` + `no_fixable_items` 且无合回 → **不**走本节常规再评路径，改按 §5.2.1「无 Fix 推进」判定（满足条件即 `round += 1` 换台，**不**记前门失败）。

#### 5.1.1 抽查重跑与信任降级

`$G verify --slice <id>` 会真的重跑该片最后一条绿命令，是全流程**唯一不可伪造**的门，也最慢 —— **不要求每轮跑**，命中下列任一则对该片跑一次：

| 触发 | 理由 |
|------|------|
| 该片/该轮曾 `evidence_mismatch: true` | 回传已失真一次，其字段不再采信 |
| 该簇 debt-map `regression_count >= 2`（§14） | 同一模块反复回潮，疑似假绿 |
| Phase 5 之前 | 整环一次，抽 ≥1 个代表性切片 |

`verify` FAIL → 前门失败 + 该批相关 ID 回退 `open`（§7）+ debt-map `regression_count += 1`。

**信任降级**：某轮记过 `evidence_mismatch` → 下一轮**强制** `--strict-red`，且前门须至少抽查一次 `verify`；连续 2 轮 `evidence_mismatch` → 按 §5.2 计 `gate_fail_streak++`，并在停机报告点名该 go-fast 回传失真。

### 5.2 前门失败下一跳（计轮唯一口径）

**计轮不变量**（三环共用）：

| 量 | 规则 |
|----|------|
| **`round`** | 仅当落盘了正式 Review / Inventory / 评分台报告时 +1（与报告 `-rN` 一对一） |
| **`gate_fail_streak`** | 前门失败或「未合回/测红导致无法再评」时 +1；**不**增加 `round`；成功再评/再盘点后清零 |
| **`attempts`** | ledger 可记本环 Fix/前门尝试次数（含失败）；**不得**把失败尝试算进 `max_rounds` 的 `round` 计数 |

| 情况 | 动作 |
|------|------|
| 未合回 / 相关测红 / 脏树 / 可修 CR 未修完 | **禁止**再评/再盘点抬分或勾选；不计成功完成；优先同批或缩 `batch` 重试；`gate_fail_streak++`（**不** +`round`）；`gate_fail_streak ≥ 2` → `zero_reason: blocked_upstream` 或整环 `DONE_WITH_CONCERNS`（`stop_reason: blocked`） |
| **B 层 FAIL**（`batch` / `case-count` / `smoke` / `verify`） | 同上一行处理；gate 的 `reasons` **原样**进 ledger 与停机报告；下一轮强制 `--strict-red`；**禁止**删证据工件重跑、**禁止**改写 gate 结论 |
| summary 空但声称有完成项 | 禁再评/再盘点；编排方要求 go-fast 补写或自行按 §3 补写并 `writeback_repaired: true`；仍空 → 记违规 + `gate_fail_streak++`，不得伪造 DoneΔ/Δtotal |
| `DONE_WITH_CONCERNS` 且 remaining 仅裁定类 | **允许**再评/再盘点；ledger 记 concerns / `integration_decisions`；`gate_fail_streak = 0` |
| `BLOCKED` / `skipped` + `blocked_upstream` | 不进再评/再盘点；回到停机表（blocked / pending_human_integration） |
| **`skipped` + `no_fixable_items` 且本台评审/盘点已有效落盘** | **正常推进**（见 §5.2.1）：允许进入下一评分台 / 再盘点；`gate_fail_streak` **不变**；本轮不得记任何 DoneΔ/Δ 进步，ledger 记 `advanced_without_fix: true` |

#### 5.2.1 无 Fix 推进（`advanced_without_fix`）

**「本轮没有可修项」≠「前门失败」。** 前门（§5.1）只裁判**已发生的 Fix**；本轮压根没派 Fix 时不适用，**禁止**因 `merged_to_base == false` 判失败并累加 `gate_fail_streak`。

| 条件（须**全部**满足） | 说明 |
|------------------------|------|
| 本评分台/盘点报告已按各 SKILL 规则落盘并继承清单 | 空转不落盘不算 |
| `go_fast.status: skipped` 且 `zero_reason: no_fixable_items` | `blocked_upstream` / `degrade` 不适用 |
| 剔除原因合法 | 视觉债 / 过抛 / `deferred` / `wontfix` / `park` / 依赖未就绪 / 非 `fix_scope` |
| 累积清单中**无**可修的 `硬门槛=是` `open` 项 | 有则属违规空转，走停机表 `blocked` |

满足 → `round += 1` 进入下一评分台（polishing 换 lane / prd 再盘点 / product 再评），`gate_fail_streak` 保持。

**连续无 Fix 推进**：连续 `2` 个评分台 `advanced_without_fix` → 本 `scope` 在当前 `fix_scope` 下暂无可修。

| 环 / 条件 | 动作 |
|-----------|------|
| **loop-polishing** / **loop-goal-product**：`total < target_score` 且 dig 预算未尽 | **禁止**立刻 `no_fixable_items`；进入该环 dig（[polishing/dig.md](../../loop-polishing/references/dig.md) / [product/dig.md](../../loop-goal-product/references/dig.md)） |
| **loop-goal-prd**：`remaining > 0` 且 dig 预算未尽 | **禁止**立刻 `no_fixable_items`；进入 [prd/dig.md](../../loop-goal-prd/references/dig.md) 重盘漏项/纠误标/回潮假绿 |
| 已达标 / `remaining==0` / dig 关 / dig 预算尽 | Phase 5 → `DONE_WITH_CONCERNS`，`stop_reason: no_fixable_items`（**`must_reach_target=true` 且未达标** → dig 预算尽须重置再挖，§10.6，**禁止**本行停机） |

**禁止**靠无 Fix 推进凑 `round` / `min_rounds`（单次换 lane 取证正常；连续空台在未达标时必须是 **dig**，不是复读凑轮）。

### 5.3 Phase 5 全量（编排方）

1. 本环曾任意一次 `merged_to_base: true` → **必须**跑 ≤1 次仓/FE 全量（除非用户 `skip_full_test`）。  
2. 仅「从未合回任何代码」的纯 BLOCKED → 可 `full_suite.skipped_reason: never_merged`。  
3. 宣称 `met_target` / `scope_clear` / 整环干净 `DONE` 前：须 `full_suite.ran: true` 且绿；否则最多 `DONE_WITH_CONCERNS`。  
4. 全量红 → 先修或 `DONE_WITH_CONCERNS` / `BLOCKED`；禁止假装全量已过。  
5. **残留 worktree 清单（强制）**：无论绿/红/中止，Phase 5 回传与对话须列出 `residual_worktrees[]`；**未合并勿强删**。  
6. **舰队 defer（loop-goal）**：经 [loop-goal](../../loop-goal/SKILL.md) 派出的 loop-polishing 军团 **必须** `skip_full_test`，Phase 5 写 `skipped_reason: deferred_to_fleet`，**禁止**军团自跑全量 / `full_suite_every`。全量改由 **loop-goal Phase 5** 在全部应付军团终态并合入后跑 **≤1 次**；舰队宣称 `fleet_met_target` / 干净 `DONE` 适用本条第 3 款。军团自身的 `met_target`（综合分）**不**要求军团 `full_suite.ran`。

#### 5.3.1 残留 worktree 字段（唯一结构 · 三处同一物）

```yaml
residual_worktrees:
  - path: ".worktrees/go-fast-<slice>"
    branch: "go-fast/<slice>"
    status: merged_cleaned | keep_unmerged | orphan_delete_candidate
```

| 出现处 | 关系 |
|--------|------|
| go-fast 回传 `cleanup.remaining[]` | **同一结构**（上表三元组）。go-fast 只报告本批残留 |
| loop Phase 5 回传 `residual_worktrees[]` | 编排方**并集**：本环历轮所有 go-fast `cleanup.remaining[]` 去重累加，减去后续已清理项 |
| ledger Resume 游标 `pending_worktrees[]` | **同一结构**；= 落盘时刻 `status ≠ merged_cleaned` 的子集，供 §12 续跑处理 |

三处**禁止**各自发明字段名或结构；新增字段须先改本节。

---

## 6. 路径选择（报告 ≠ 规格 · Path A 唯一表）

| 不算路径 A | 必须 |
|------------|------|
| product/ui-ux/code/arch 评审报告、loop ledger、纯评分/Inventory/打磨台报告 | 默认路径 B：出 `docs/specs` → plan-reviewer `go-fast-spec-gate` → tickets → 分派 |

### Path A 检查表（须**全部**满足；否则整批走 B）

**共用条（任何 `spec_ref`）：**

1. 可观察验收句：真实依赖 + 失败语义  
2. **无** stub/mock/demo「通过即完成」措辞  
3. 有代码/路由锚点，或明确「新建表面」范围  
4. 覆盖**本批全部** ID（缺一 → 整批 B）

**按来源附加：**

| 来源 | 附加 |
|------|------|
| **PRD 分片**作 `spec_ref`（loop-goal-prd） | 对 PRD **只评不自动改**正文（完成态回写走 §3） |
| **已有 `docs/specs/<slug>.md`**（loop-goal-product / loop-polishing 或仓内规格） | 规格须已落盘且覆盖本批；**禁止**把评审报告路径当作 `spec_ref` |

### 6.1 `spec_reuse`（Token · 禁止每轮重写规格）

同 `scope`（或同里程碑批）下，若仓内已有 `docs/specs/<slug>.md` 满足：

1. 覆盖**本批全部**待修 ID（可在规格「覆盖 ID」节或 tickets 索引核对）  
2. 共用条 1–3 仍成立（无 stub 验收、锚点未过时）  
3. 距上次规格门通过未发生「验收语义大改」（仅状态回写不算大改）  

→ **必须走 Path A**（`path: A_direct`，`spec_reuse: true`），**禁止**为同一批 ID 再写一份新 specs 再跑规格门。  
本批出现**新 ID** 未覆盖 → 最小 diff **增补**原规格（或新 tickets）后再规格门；仍禁止无关重写。

否则 → 路径 B。无论 A/B：须 Slice Map 或 tickets + 分派图，不得跳过派发手写多刺点。

`go-fast` / **三环** **禁止**另维护与上表不一致的 Path A 条目列表；只可写「见本契约 §6」+ 一行指向来源差异。

---

## 7. 处理清单状态机（共用）

`open` → `in_progress` → `done` → `verified`  
回潮 / 再评未达标 → `open`  
另：`blocked` | `deferred` | `wontfix`

再评/再盘点须**继承**清单 ID；禁止清空重写成全 `open`。

---

## 8. unattended code-reviewer（与冲分关系）

- go-fast `unattended` 收尾强制 CR（`go-fast-unattended-fix`）。  
- **`orchestrator` 为三环之一时**：自动修范围以调用方传入的 `cr_fix_scope` 为准。  
  - **loop-polishing** 默认 **`all`**（P0+P1+P2；与本环 `fix_scope=all` 对齐）  
  - **loop-goal-prd / loop-goal-product** 默认 **仅 P0+P1**（P2 进 `remaining`，防冲分震荡）；显式 `cr_fix_scope=all` / `CR全修` 才升  
  调用方未传时按上表环默认；**禁止**忽略已传入的 `cr_fix_scope`。
- **单独** go-fast（无 orchestrator）：仍默认可修 P0+P1+P2 自动修。  
- 修后相关测绿方可出本轮（`DONE` 或合法 `DONE_WITH_CONCERNS`）。  
- **再评前门不要求** CR「产品向过关」；CR 是质量门。  
- CR 自动修若改动主任务/入口/权责/状态机文案 → 必须进入下一轮 product 再评取证；ledger 记 `code_review_delta`（是否可能引入新产品刺点）。  
- CR `remaining` 仅契约/裁定类（或 loop 内故意留下的 P2）→ `DONE_WITH_CONCERNS` **且按 §5.1 允许再评**；可修 P0/P1 未修完 → 禁脏树再评（§5.2）。

---

## 9. 编排方每轮自检（轻量）

每轮勾选清单以 [loop-orchestrator-card.md](loop-orchestrator-card.md)「自检」呈现（条目真源仍是 §3–§6 / §10.5 / §14），本节**不重复列举**。其中**不可省**的三条：

- [ ] **B 层已真跑**：`gate-check batch` 由编排方亲自执行、退出码已记；与 `evidence.gate` 不符时以自己跑的为准并记 `evidence_mismatch`  
- [ ] `go-fast.status` 与 §5.1 一致（含合法 `DONE_WITH_CONCERNS`）；`gate_fail_streak` 已记账  
- [ ] debt-map 已按本轮白名单更新 `touch_count` / `last_touch`；`escalated` 簇本批未再打补丁（§14）

---

## 10. 多环交接（推荐）

```text
推荐：loop-goal-prd(scope=里程碑/当前节) → scope_clear（或诚实 DONE_WITH_CONCERNS）
  → loop-goal-product(scope=同模块/流程, target=95)
  → loop-polishing(scope=同模块, target=92, min_rounds=…)   # 可选：多维抛光
```

也可：`prd → polishing`（跳过 product）当用户只要打磨不要单维冲分。

全仓 / 多业务线：用 [loop-goal](../../loop-goal/SKILL.md)（发现 → 冲突图 → 多军团 polishing + worktree）。军团并行时**各自独分支**，合回 `base_branch` 须按冲突图；**禁止**多军团同时直接改同一 `base_branch` 工作区。

- 交接复制：`scope` 语义、未清 `integration_decisions`、仍 open 的硬门槛/park 项、过抛/`wontfix` 清单、ledger 路径、**debt-map 路径 + 各簇 `touch_count` / `escalated` 状态**（§14；下一环**禁止**从 0 重新计数）。  
- **禁止**任两环并行改同一 `base_branch`。  
- product **不**冒充 plan/PRD 勾选完成；prd **不**用文档措辞抬产品八维分；polishing **不**发明功能冒充打磨、**不**删 `.stop` 续跑；loop-goal **不**跳过冲突分析并行合入。

---

## 10.5 `.stop` 优雅停机（三环共用）

无人值守多轮改业务树时，用户须有**不杀会话**的刹车。三环**全部**适用（旧版仅 loop-polishing 有，已提升为共用）。

| 规则 | 行为 |
|------|------|
| 检测路径 | 工作区根目录下的 `stop_file`（默认 `.stop`）；也接受用户指定相对路径 |
| **何时查** | 每轮**开始时** 与 **本轮 Fix 结束后、进入下一轮前** |
| 已存在 | 置 `stop_pending: true`；**允许完成当前轮次**（含进行中的 Review/Inventory/Fix/前门处理），然后 Phase 5 → `DONE_WITH_CONCERNS`，`stop_reason: stop_file` |
| 内容 | 不解析；存在即生效（空文件亦可） |
| **禁止** | 删除/改名 `.stop` 以续跑；把 `.stop` 提交进业务仓（除非用户要求）；`stop_pending` 后再开新轮 |
| 用户口语停 | 同 `user_stop`（可与 `.stop` 并存） |
| Resume | `stop_pending` 或 `.stop` 仍在 → 直接 Phase 5，不新开 Fix（§12.3） |

回传须含 `stop_file` / `stop_pending`；`stop_reason` 枚举须含 `stop_file`。Phase 5 **不要**自动删除 `.stop`（留给用户）。

---

## 10.6 `must_reach_target` 达标模式（禁软停机）

用户明确要求**持续运行直到达标**时，三环与 [loop-goal](../../loop-goal/SKILL.md) 须进入本模式，**禁止**因预算/高原/回归/挖空等软理由在未达标时收工。

### 解析（唯一口径）

| 信号 | 写入 |
|------|------|
| `必须达到目标N` / `必须冲到N` / `一定要达到N分` / `不达目标不停` / `直到达标` | `must_reach_target=true`；含 `N` 时同步 `target_score=N`（prd 环见下） |
| `持续运行` / `持续` / `一直跑` / `不停` | 若**同句或同轮**已有目标（`target_score` / `scope_clear` / `必须冲完`）→ `must_reach_target=true` |
| `必须冲完` / `必须做完` / `直到 scope 清零`（loop-goal-prd） | `must_reach_target=true`（达标判据 = `remaining==0` 且无未清硬门槛） |
| `must_reach_target=true` / `达标模式` | `must_reach_target=true` |
| 仅 `持续 N 轮` / `至少 N 轮`、**无**「必须达到/直到达标」 | **不**自动开本模式（轮数仍是预算上限） |

各环 parse.md 可列本地同义词，**语义以本表为准**。

### 达标判据

| 环 | 未达标（软停机一律禁用） | 达标（可正常 `met_target` / `scope_clear` 停机） |
|----|--------------------------|--------------------------------------------------|
| loop-goal-product / loop-polishing | `total < target_score` 或仍有未清硬门槛 | `total >= target_score` 且无未清硬门槛 |
| loop-goal-prd | `remaining > 0` 或仍有未清硬门槛 | `remaining == 0` 且无未清硬门槛、勾选与分片一致 |
| loop-goal（舰队） | 任一应付军团未 `met_target` | 全部军团终态且均 `met_target`（或无硬门槛遗留） |

### `must_reach_target=true` 时的停机纪律

**未达标期间禁止**以下 `stop_reason` 作为**终局收工**（命中时**不得** Phase 5 后以 `DONE_WITH_CONCERNS` 结束本环/本军团，须继续评→修循环或按 §12 续跑）：

`plateau` · `regression` · `max_rounds` · `no_fixable_items` · `overpolish` · `session_wall`

| 原软停机 | 本模式行为 |
|----------|------------|
| `max_rounds` / `round >= max_rounds` | **仅记账**；`max_rounds` 降为参考上限，**不**触发停机 |
| `plateau` / `regression` | **忽略**；允许降分/原地踏步，继续 Fix + dig |
| `no_fixable_items` / dig 预算尽 | **禁止**因挖空停；`dig_remaining` 用尽 → **重置**为 `dig_budget`（ledger 记 `dig_budget_reset`），换落后维/ lane 再挖 |
| `overpolish`（polishing） | **不**整环停；仍剔除过抛项出 batch，**须**先加深（§14）再换维继续 |
| `session_wall` | **非终局**：写 ledger 游标 + Phase 5 **骨架**（可 `full_suite.skipped_reason: session_wall`）；**同会话仍可继续则立即 soft resume 开下一评分台**；跨会话则对话只提示「说继续即可」，Resume 时**禁止**因未达标收工 |

**仍允许终局停机**（与默认模式相同）：`met_target` / `scope_clear` / `fleet_met_target`、`user_stop`、`stop_file`、`blocked`（`gate_fail_streak ≥ 2`、硬门槛不可择优、需人裁定且 dig 后仍无解）、`dry_run`。

### Phase 0 / 回传

- 亮配置行须含 `must_reach=on|off`（或等价字段）。  
- 回传 / ledger 必填 `must_reach_target: true|false`；Resume **继承**，用户显式取消（`must_reach_target=false`）才可恢复预算停机。  
- [loop-goal](../../loop-goal/SKILL.md) 须把 `must_reach_target` **传给每军团** loop-polishing。

### 红线（本模式专有）

- **禁止**未达标却以 `plateau` / `regression` / `max_rounds` / `no_fixable_items` / `overpolish` / `session_wall` 收工  
- **禁止**`must_reach_target=true` 时把 `dig_budget` 用尽当作停机理由（须重置再挖）  
- **禁止**`session_wall` 后未达标却不提示「继续」或不写 ledger 游标就假装环已结束  
- **禁止**用户已说「必须达到目标 N」却不开 `must_reach_target`（仍按默认 5/8/10 轮软停）

---

## 11. 回传字段（go_fast 块最小集）

```yaml
go_fast:
  path: A_direct | B_spec_tickets | skipped
  spec_reuse: false           # §6.1 命中时 true
  status: DONE | DONE_WITH_CONCERNS | BLOCKED | skipped
  tickets_dir: ""
  merged_to_base: false
  wave_size: 0
  zero_reason: degrade | no_fixable_items | blocked_upstream | ""
  degrade_reason: ""
  source_report: ""
  summary: []                 # 本批已回写 ID；有可完成项时禁止空
  slices: []                  # {id, finding_ids, kind, status}；batch↔slice 强制映射，`--slices` 的唯一来源（§5.1 B 层）
  writeback_repaired: false   # 编排方补写时 true
  evidence: {}                # go-fast 回传原样；结构见 go-fast/references/evidence.md §4
  external_deps: []           # {name, credential, smoke}；前门按 §5.1 B 层校验
  gate_recheck:               # 编排方**自己**跑出来的结果（≠ go-fast 自述）
    batch: PASS | FAIL | ENV_ERROR
    strict_red: false
    reasons: []
    verify_slices: []         # 本轮抽查过的片（§5.1.1）
  evidence_mismatch: false    # 自跑结论与 evidence.gate 不一致 → true
  code_review:
    ran: true|false
    status: DONE | DONE_WITH_CONCERNS | BLOCKED | skipped
    fix_scope: P0+P1 | all    # 与传入 cr_fix_scope 对齐：polishing 默认 all；prd/product 默认 P0+P1
    auto_fixed: []
    remaining: []
  full_suite:
    deferred_to_loop: true
    ran: false
  integration_decisions:
    - id: ""
      brief: ""
      selected: ""
      needs_adr: false
      adr_path: ""            # auto_best_require_adr 且 needs_adr 时必填
      auto_started: true
```

### 11.1 三环回传公共骨架（唯一真源 · 各 SKILL 不再抄）

下列字段**三环通用**，各 SKILL 回传格式**只写本环差异字段** + 一行「其余见契约 §11.1」，**禁止**逐字复制本节。

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: loop-goal-prd | loop-goal-product | loop-polishing | loop-goal
fix_skill: go-fast
scope: ""
attendance: attended | unattended
integration_policy: auto_best | auto_best_require_adr | park   # 三环默认 auto_best_require_adr
cr_fix_scope: P0+P1 | all   # polishing 默认 all；prd/product 默认 P0+P1
force_large_scope: false
base_branch: ""              # Phase 0 门闩记录
max_rounds: 0
max_wall_rounds_per_session: 0
must_reach_target: false
gate_fail_streak: 0
debt_map: "docs/material/debt-map.md"   # §14；跨环传递
escalated_clusters: []                  # §14 状态为 escalated 的簇名
stop_file: ".stop"
stop_pending: false
resumed_from: ""
rounds:
  - n: 1
    report: ""
    hard_gates: true|false
    advanced_without_fix: false   # §5.2.1
    go_fast: {}                   # 结构见 §11
full_suite:
  ran: false
  skipped_reason: ""   # skip_full_test | never_merged | session_wall | dry_run | ""
residual_worktrees: []            # 结构见 §5.3.1
integration_decisions: []         # 结构见 §11 go_fast.integration_decisions；本环并集
met_target: false
stop_reason: ""      # 共用值：blocked | user_stop | session_wall | stop_file | no_fixable_items | max_rounds | plateau；各环专有值见自身 SKILL
ledger: ""
artifacts: []
```

各环**必须**另行声明的差异字段举例：prd 的 `remaining` / `done_count` / `delta_remaining` / `completed_ids`；product 的 `target_score` / `total` / `delta`；polishing 的 `lane` / `total_stale` / `profile` / `composite_mode` / `dimensions`。

---

## 12. Resume（断点续跑 · 唯一口径）

会话中断、墙钟达 `max_wall_rounds_per_session`、或用户说 `resume` / `续跑` / **`继续` / `接着跑` / `接着冲` / `continue`**（及各环 `loop-*-resume`）时：

1. **入口**（优先级）：  
   - **显式**：`loop-*-resume ledger=<path>`，或 `续跑` / `resume` + 点名 ledger。  
   - **Soft resume**：用户只说「继续 / 接着跑 / continue」等、**未**给新开工 `scope=`、也**未**给 `ledger=` → **等同**对应环的 resume，**禁止**当成新开环。Ledger 解析序：① 同会话已披露的本环 ledger → ② 仓内 `docs/material/<loop-dir>/*-ledger.md` 中 mtime 最新且 `phase` 匹配本环 → ③ 歧义则列出候选问用户 / `BLOCKED`，**禁止瞎猜** → ④ 零候选 → `BLOCKED`（提示先开环或显式 `ledger=`）。  
   - 解析到 ledger 后：先按 `phase` 路由到对应 loop skill 再续跑。`phase: loop-goal` → [loop-goal](../../loop-goal/SKILL.md) Phase R（舰队 ledger；子军团再按其 `legion_ledger` 走 polishing Resume）。  
2. **必读 ledger 字段**：`phase` / `scope` / `base_branch` / `last_round` / `gate_fail_streak` / `open_ids`（或等价清单） / `stop_pending` / `integration_decisions` / `pending_worktrees[]` / `profile`（若有） / `attendance` / `integration_policy` / `debt_map` + `escalated_clusters`（§14）。舰队另读：`current_wave` / `legions[]` / `product_map` / `conflict_graph`。  
3. **动作**：  
   - 校验工作区在 `base_branch`（或记录的 integrate 态）；有未合并 `pending_worktrees` → 先按 go-fast 合回纪律处理或标 `keep_unmerged`，**禁止**无视残留另开平行环。  
   - 从 `last_round` 的下一评分台/盘点继续；**禁止**重置清单为全 `open`。舰队：只重启非终态军团，**禁止**无授权重跑已 `done` 军团。  
   - `stop_pending` 或 `.stop` 仍在 → 直接 Phase 5，不新开 Fix（舰队则不新派波）。  
4. **跨会话 marathon**：`profile=marathon` **禁止**单会话跑满；每会话至多 `max_wall_rounds_per_session` 个评分台，然后 Phase 5 骨架收尾（可 `skipped_reason: session_wall`）+ 更新 ledger 游标，提示用户下一会话可说 **「继续」** 或 `resume ledger=…`。  
   - **`must_reach_target=true` 且未达标**：`session_wall` **不是**终局（§10.6）；Resume 后**必须**从游标继续冲达标，**禁止**因墙钟在未达标时收工。  
5. 回传须含 `resumed_from: <ledger>` 与 `residual_worktrees`（同 §5.3.1）；soft resume 自动选中时另记 `ledger_resolved: auto_latest`（或 `session_context`）。Resume 须继承 `must_reach_target`。  

---

## 13. 三环共用红线（唯一真源 · 各 SKILL 不再抄）

各 SKILL 红线**只写本环专有项** + 一行「其余见契约 §13」，**禁止**逐字复制本节。标 `[gate: xxx]` 的可由 `gate-check` 机器判定。

**诚实**

- **禁止**外部契约不明时用 stub / mock / 假成功 / 内存假后端顶替交付（零例外；只能真接或 `park`）
- **禁止**契约不明时跳过 research + 八维择优猜接；**禁止** `unattended` 干等用户（`park` 除外）
- **禁止**假绿抬分 / 无真实验收标「已实现」/ 用文档措辞抬完成度
- **禁止**为抬分改文案或测例断言而不改行为 `[gate: case-count]`
- **禁止**把用户可见产品文案写成研发/运维/合同口吻：字段名、查询参数名、内部状态码、工程黑话（ADR / stub / worktree / gate…）、**甲方/乙方/我方/贵方**上屏；须 craft §8 人话。**禁止**卡片套卡片（大卡套步骤小卡、内容区再套提示条卡、**列表外卡再套表格内框**；craft §6）
- **禁止**把 `credential: have` 却无 smoke 工件的外部依赖当作已实现放行 `[gate: smoke]`
- **禁止**跳过 Phase 0 证据目录门（§0.5）：`.evidence/` 未 ignore 却继续开工，或已跟踪却不 `BLOCKED`

**编排纪律**

- **禁止**编排非 go-fast 作为实现引擎
- **禁止** Fix 阶段在主会话直接改业务实现、或跳过拆工单 / Slice Map 把多项揉进一次手改（须舰队；合法降级须填 `zero_reason` + `degrade_reason`）
- **禁止**整环从未按 [orchestrator-api.md](orchestrator-api.md) §1.1 加载 go-fast 最小必读集却宣称已舰队 Fix（「心想 go-fast」≠ 执行）
- **禁止**编排方抢在 go-fast 回写之前勾选 / 标 `done` / 抬完成度
- **禁止**把评审报告 / Inventory / ledger / 打磨台报告当作 Path A「已有规格」
- **禁止**可 `spec_reuse` 时每轮重写 specs
- **禁止**仅因路径 glob 不交、忽略共享壳 / RBAC / 状态机依赖而同波硬并行
- **禁止** loop-goal 多军团并行时同时写主 `docs/material/debt-map.md`（须 §14.1 分片/`debt_touches` + 舰队串行合并）

**计轮与门**

- **禁止**硬门槛 open 时优先冲无关软项；**禁止**单轮超过 `batch_size`
- **禁止**再评/再盘点前门未过（§5.1）时抬分或勾选；**禁止**用笼统「非 DONE」挡掉合法 `DONE_WITH_CONCERNS`
- **禁止**跳过 §5.1 B 层（只读 `evidence.gate` 字段就放行）；**禁止**在自跑 gate FAIL / `evidence_mismatch` 时按 PASS 推进 `[gate: batch]`
- **禁止**对 `escalated` 簇继续做 finding 级局部修复、或不更新 debt-map 计数（§14）
- **禁止**把前门失败算进 `round` / `max_rounds`（须用 `gate_fail_streak`）
- **禁止**把「本轮无可修项」当前门失败（须走 §5.2.1 无 Fix 推进）；**禁止**靠连续无 Fix 推进凑轮；**禁止**未达标且 dig 预算未尽时以 `no_fixable_items` 假早停（须 dig）
- **禁止**`must_reach_target=true` 时未达标却以 `plateau` / `regression` / `max_rounds` / `no_fixable_items` / `overpolish` / `session_wall` 终局收工（§10.6）；**禁止**用户要求「必须达到目标分/冲完/持续运行直到达标」却不开 `must_reach_target`
- **禁止**再评/再盘点清空处理清单重编号（须继承，§7）

**测试与收尾**

- **禁止**单轮 go-fast 内跑仓 / FE 全量（须 `deferred_to_loop`；全量只在 Phase 5，polishing 显式 `full_suite_every` 除外）
- **禁止**宣称 `met_target` / `scope_clear` / 整环干净 `DONE` 却未跑 Phase 5 全量（`skip_full_test` / `never_merged` / `session_wall` / `dry_run` 除外）
- **禁止**跳过 ledger；**禁止** Fix 后不校验源报告 / 源清单回写（`summary` 空却抬分）
- **禁止**中止 / Phase 5 不列 `residual_worktrees`（§5.3.1）

**并发与范围**

- **禁止**与另一环并行改同一 `base_branch`
- **禁止**大 scope 未 `force_large_scope` 却强行开跑

**大 scope 数值真源（三环统一）**：预估 **`open` 项 > 15**（PRD ID / 刺点 / 打磨 finding，按本环计量口径数），或用户 `scope` 明显「整仓 / 全部模块 / 全部未完成」→ 须 `force_large_scope=true`，否则 `BLOCKED`。三环 SKILL **只引用本条**，禁止各写一个阈值。
- **禁止**删除 `.stop` 续跑；**禁止** `stop_pending` 后再开新轮（§10.5）
- **禁止**演化 subagent 冒充用户触发三环

---

## 14. 债务地图与加深升格（三环共用）

§7 的状态机记的是 **finding ID**，不记「同一处被不同 finding 修过几次」。于是同一模块可被无限次局部修补，系统每次只看到「一个新的 open finding」，永远不会说「这里该重构了」。债务地图补的正是这个计数。

**位置**：目标业务仓 `docs/material/debt-map.md`（三环共写共读、跨环传递）。

```markdown
# 债务地图

<!-- deepen_threshold: 3 -->

| 簇 | glob | touch_count | regression_count | last_touch | deferred_arch | 状态 |
|----|------|-------------|------------------|------------|---------------|------|
| 订单状态机 | `src/order/**` | 3 | 1 | prd-r4 | ARCH-012 | escalated |
| 权限壳 | `src/auth/**`,`src/shell/rbac/**` | 1 | 0 | product-r2 | — | ok |
```

| 列 | 含义 |
|----|------|
| `簇` | 人读名。按**白名单 glob 归并的文件簇**，**禁止**按单文件（单文件粒度可被改名/挪目录绕过） |
| `glob` | 归并依据；本轮 Fix 白名单与之相交即算一次触及 |
| `touch_count` | 累计被 Fix 触及的**轮次**数（同轮多片只记 1） |
| `regression_count` | 该簇 `done`/`verified` 后回退 `open`（§7）或 `verify` FAIL 的次数；**长期信号，从不清零** |
| `last_touch` | 最近触及轮次，`<phase 简称>-r<N>` |
| `deferred_arch` | 关联的 arch-reviewer deferred 候选 ID |
| `状态` | `ok` \| `escalated`（已升格待加深）\| `deepened`（加深已完成） |

**升格阈值（双通道 · 唯一真源 · 两条互补，任一成立即升格）**：

| 通道 | 条件 | 用意 |
|------|------|------|
| **慢速通道** | 同簇 `touch_count >= deepen_threshold`（默认 `3`） | 补丁次数堆够了 |
| **快速通道** | 同簇**连续 2 次**被判薄补丁（under-abstraction，识别口径见 loop-polishing [anti-overpolish.md](../../loop-polishing/references/anti-overpolish.md)「薄补丁守卫」） | 已确认在做最小表面修改，**不必**等 `deepen_threshold` |

薄补丁本身也 `touch_count += 1`（算触及不算解决），因此两通道可同时逼近；先满足者先置 `escalated`。  
**`refactor-shared` 切片不计入所属簇的 `touch_count`**（否则加深动作自己就把簇推向升格 / 过抛闸）；加深完成后该簇 `touch_count` 归零（见下第 4 条）。

> `deepen_threshold` 的优先级：**本次调用参数 > 文件头注释 > 默认 3**。用户在本次调用里传了 `加深阈值=N` / `deepen_threshold=N`，编排方须**同时把 `<!-- deepen_threshold: N -->` 改写进 debt-map 文件头**（否则下一环读到旧值，跨环阈值漂移）。

置 `escalated` 后：

1. **暂停**该簇的 finding 级局部修复：命中该 glob 的 finding 本轮不进 batch，标 `deferred`（原因 `debt_escalated`），**不**计入 `no_fixable_items`（避免误判成「无可修项」而空转推进）。  
2. 下一轮 batch **必须**插入一次针对该簇的加深切片，授权级别按 arch-reviewer 三级：**`local-deepen`**（unattended 可做，**须落 ADR**）；实际属 **`structural`** → 只能 park 升给人，unattended **禁止**自作主张动结构；`polish_safe` 级改动**不算**加深、不解除升格。  
3. 加深切片按 §4「`refactor-shared` 片」执行（独占一波、不占 `batch_size`）。  
4. **解除**：加深切片合回 + §5.1 A/B 两层前门通过 + ADR 已落盘 → `touch_count` 归 `0`、状态置 `deepened`；`regression_count` 保留。此后该簇恢复正常接受 finding。  
5. 升格后仍回潮（`regression_count` 再 `+2`）→ 该簇整体 `blocked`，整环最多 `DONE_WITH_CONCERNS` 并在停机报告点名。

**禁止**：为绕开升格把同一簇拆成多个新名字；把加深切片记成 finding 完成抬分；`escalated` 期间继续对该簇打补丁。

### 14.1 舰队并行与 debt-map 写冲突（loop-goal）

多军团共享计数时**禁止**两军团同时写主文件 `docs/material/debt-map.md`（后写覆盖 → 丢 `touch_count` / 假 `ok`）。

| 角色 | 规则 |
|------|------|
| **军团内 polishing**（`orchestrator_parent: loop-goal`） | **不**直接改主 `debt-map.md`。在子 ledger 记 `debt_touches[]`（见下），可选落分片 `docs/material/debt-map-<legion_id>.md`（仅本 worktree） |
| **舰队主编排** | 军团合入 `base_branch` 后**串行**把该军团 `debt_touches` / 分片 merge 进主 `debt-map.md`；下一军团合入前完成合并 |
| **单环**（无 `orchestrator_parent`） | 编排方仍按上表写主 `docs/material/debt-map.md`（不变） |

`debt_touches[]` 最小项：`cluster` / `glob` / `touch_delta`（本轮对该簇 +1 则为 1）/ `regression_delta` / `escalated`（bool）/ `last_touch`（如 `polish-r3`）。

**合并算法（唯一口径）**：按 `glob`（或簇名）对齐行；`touch_count = max(主, 分片累计)` 若分片带绝对计数，否则 `主 + touch_delta`；`regression_count = 主 + regression_delta`（**只增不减**）；任一侧 `escalated` → 主行 `escalated`；`deepened` 仅当舰队侧确认加深切片已合入且前门过；`last_touch` 取较新轮次标签。合并后可删已合入军团的分片文件。
