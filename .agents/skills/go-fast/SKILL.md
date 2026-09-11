---
name: go-fast
description: >
  Use when user says 开工 / 开始开发 / go-fast / 快走 / 并行开发 / worktree 开工 /
  subagent 实现 / 按规格实现 / 红绿落地 / 无人值守开工 / unattended go-fast — start coding
  now with optional parallel worktrees; not planning-only.
---

# Go-Fast（极速 · 开工实现）

**go-fast = 极速开工**（不是 Go 语言）。按规格落地：对齐依据 → seam → **能并行则 worktree+subagent** → 边界诚实 → 验证可复现。

Agent 已会写代码；本 Skill 补：**规格门（有则直接干 / 无则内嵌出规格再拆工单）**、**无人值守并发**、**一刀一测一实现**、**主路径禁止假绿**、**验证跟仓走**。

出规格与拆工单已**内嵌**本 Skill（见 [spec-and-tickets.md](references/spec-and-tickets.md)），**不要**再去调用或引用外部同名流程。

## 何时启用

| 场景 | 动作 |
|------|------|
| 用户已提供规格 + 明确需求 | **直接干**：读规格 → seam → Slice Map → 串/并行落地 |
| 有需求、**无**规格文档 | **内嵌出规格** → **内嵌拆工单** → **无人值守按前沿并发**落地 |
| 修 bug 且适合测先行 | 先写再现失败的测试，再最小修复（通常串行） |
| 经 [bug-fix](../bug-fix/SKILL.md) 确认的线/面批量 | 决策卡+发散候选作路径 B 需求；`unattended` 落地 |
| 「开工 / go-fast / 快走 / 无人值守开工」 | 走下方主流程分叉 |

**不要**：无需求依据时空想大重构；对有阻塞边或抢同一文件的工单硬并行；全仓 mock 代替行为测试；测试 fake 进主路径；当成「只写 Go 语言」。

## 与姊妹 skill

| Skill | 关系 |
|-------|------|
| [bug-fix](../bug-fix/SKILL.md) | 单点 Bug：点线面+同类发散决策卡；**用户确认线/面批量后**由本 Skill 路径 B 落地（决策卡+候选表作需求） |
| [code-reviewer](../code-reviewer/SKILL.md) | 收尾：`unattended` **必须**跑（变更面）并对可修 finding **自动修**；`attended` 建议跑、修前确认 |
| [integration-research](../integration-research/SKILL.md) | 外部契约不明 → 研究 + 八维择优 → 真接；**禁止 stub 顶替**；见「契约不明门」 |
| [model-reviewer](../model-reviewer/SKILL.md) | **建模门**（开工前 4.5）：新增表 → `mode=slice-gate` 轻量 checklist，`block` 按前门失败处理；改既有表结构属 `structural`，unattended park 升人。`spec_ref` 来自它时**禁止回调**（防环）；改表落地仍走本 Skill 路径 B |
| [create-ui-docs](../create-ui-docs/SKILL.md) | 缺 `docs/ui/` 时先提取 UI 基准；写前端前必读 craft / page-design |
| [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) | 页级毕业；前端实现真源复用其 page-recipes / anti-patterns（经 [frontend-ui-contract.md](references/frontend-ui-contract.md)） |
| [product-reviewer](../product-reviewer/SKILL.md) / [loop-goal-product](../loop-goal-product/SKILL.md) | 需求常来自评审报告；报告**不是**路径 A 规格；见「产品报告与编排」 |
| [loop-goal-prd](../loop-goal-prd/SKILL.md) | 需求来自 plan/PRD + `docs/arch.md`；Inventory **不是**路径 A 规格；见「PRD/plan 编排」 |
| [loop-polishing](../loop-polishing/SKILL.md) | 多维打磨台处理清单；报告**不是**路径 A 规格；见「打磨编排」；`orchestrator: loop-polishing` |
| [loop-goal](../loop-goal/SKILL.md) | 全仓舰队：发现业务线 → 冲突图 → 多军团 polishing（各 worktree）；go-fast 仍只见军团的 `orchestrator: loop-polishing` |
| [plan-reviewer](../plan-reviewer/SKILL.md) | 落盘 `docs/specs` 后、拆单/开工前的**规格门**（审 + 自动修 P0）；见「规格门」 |
| [product-blueprint](../product-blueprint/SKILL.md) | 智囊团业务蓝图 / `mode=spec` 出开工规格；**确认后由用户或编排方再调本 Skill**，go-fast 不内嵌调用。见下「流程叙事不清」 |
| [evidence.md](references/evidence.md) | **证据层**：`evidence-run` 包住每条验证命令、`gate-check` 判定各道门。本 Skill 所有「已验证 / 已对接 / 已回归」的声称都须绑工件 |
| [project-context.md](references/project-context.md) | **项目 rules + 本地 skills** 盘点与下传（实现 subagent 不继承主会话注入） |
| [go-zero-goctl.md](references/go-zero-goctl.md) | 仓用 go-zero 时的 **绝对红线**：goctl 规范；禁手改/打补丁 `types.go`/`routes.go` 等产物 |
| [frontend-ui-contract.md](references/frontend-ui-contract.md) | 前端硬清单 + **复用** craft / ui-ux 菜谱·反模式（详情只读、编辑载体、幽灵钮、危险色、色彩密度） |
| [loop-orchestrator-contract.md](references/loop-orchestrator-contract.md) | **三环**共用：**唯一** Path A 表、再评/再盘点前门、前门失败下一跳、无 Fix 推进、回写单一写者、舰队、全量推迟、`integration_policy`、`spec_reuse`、`.stop`、Resume、共用回传骨架与红线 |
| [orchestrator-api.md](references/orchestrator-api.md) | **给编排方**的调用面（怎么调 / 传什么 / 回什么 / 怎么判定）；三环 Phase 0 读它**代替**本文全文 |
| [loop-orchestrator-card.md](references/loop-orchestrator-card.md) | 每轮前门前轻量卡片；Phase 0 后**不要**每轮重读契约全文或本文 |

## 必读顺序（≤3 次）

1. 本文件「主流程分叉」+「规格门」+「契约不明门」+「产品报告与编排」+「开工前」+「并行」+「红绿」+「收尾」+「红线」
2. [references/evidence.md](references/evidence.md)（**必读**：所有验证命令的跑法都变了）+ 开工前读 [project-context.md](references/project-context.md)（项目 rules/skills）
3. 无规格路径：[references/spec-and-tickets.md](references/spec-and-tickets.md)；规格门时 Read [plan-reviewer](../plan-reviewer/SKILL.md)；契约不明时 Read [integration-research](../integration-research/SKILL.md)；经 loop 编排时：编排方 Phase 0 Read [loop-orchestrator-contract.md](references/loop-orchestrator-contract.md) + [orchestrator-api.md](references/orchestrator-api.md)；**Fix** 按 api **§1.1** 加载本文件最小必读集；每轮前门 Read [loop-orchestrator-card.md](references/loop-orchestrator-card.md)
4. [references/parallel.md](references/parallel.md) + [references/implementer-prompt.md](references/implementer-prompt.md) + [references/tests.md](references/tests.md) + [references/mocking.md](references/mocking.md)

---

## 主流程分叉（必须先判定）

```text
有「可验收实现规格」（docs/specs、用户完整规格、或通过 Path A 检查表的 PRD 分片）？
  ├─ 是 → 路径 A「直接干」
  └─ 否 → 对话/材料里有可综合需求（含 product-reviewer 报告 / PRD+plan）？
        ├─ 是 → 路径 B「出规格 → 拆工单 → 无人值守并发」
        └─ 否 → BLOCKED（不编造）
```

**不算路径 A 规格**（即使文件很长）：`docs/material/product-reviewer/**`、loop ledger、Inventory、纯挑刺/评分报告。  
此类 → **必须路径 B**：综合材料写出 `docs/specs/<slug>.md` + tickets，再派发。

### Path A 检查表（唯一真源）

**完整条目只在** [loop-orchestrator-contract.md](references/loop-orchestrator-contract.md) **§6**。本处不重复维护列表。摘要：

- **共用**：可观察真实验收 + 无 stub/mock/demo 通过措辞 + 锚点/新建范围 + 覆盖本批全部 ID  
- **PRD 分片**作 `spec_ref`：另须对 PRD **只评不自动改**正文  
- **已有 `docs/specs` / `spec_reuse`**：规格已落盘且覆盖本批（product/polishing 常见；见契约 §6.1）→ Path A，**禁止**每轮重写  
缺任一 → 整批路径 B。细则与 loop 共用口径见契约 §6。

### 路径 A · 已有规格 → 直接干

1. `spec_ref` = 用户路径 / 粘贴落盘路径 / 仓内已匹配的 `docs/specs/<slug>.md`，或通过契约 §6 的 PRD 实现分片。  
2. **规格门**（见下）：对 `docs/specs/**` 默认跑 plan-reviewer；用户说 `skip_plan_review` / `spec_review=off` 可跳过。PRD 分片作 `spec_ref` 时**只评不自动改** PRD（完成态回写见「回写单一写者」；改验收正文须用户点名）。  
3. **不**强制再生成工单目录（可用本会话 Slice Map）；仍须分派图，不得跳过派发直接手写多刺点。  
4. `attendance`：用户说无人值守 → `unattended`；否则默认 `attended`（seam 需确认）。经 loop-goal-product / loop-goal-prd / loop-polishing 且未写 attended → `unattended`。  
5. 进入「开工前」→ 红绿 / 并行。

### 流程叙事不清（建议先 A2，不硬编规格）

出规格或 Path A 开工前，若同时出现：

- 主路径/权责/业内基线在对话与 PRD 间互相矛盾，或  
- 多角色闭环（≥2 独立主业务）却无已确认蓝图 / 无架构图与业务流程图，或  
- 领域锚点弱，继续写规格只会「实验室流程」  

→ **attended**：停问一句，建议先 `/product-blueprint`（或 `mode=spec`）一稿确认，再回本 Skill。  
→ **unattended / loop 编排**：不得替用户跑完 blueprint；在回传 `blockers` / `followups` 写明「建议 product-blueprint scope=…」；若材料仍可综合出诚实验收句则可继续路径 B，但**禁止**用 stub/demo 句填洞。

### 路径 B · 无规格 → 出规格 → 规格门 → 拆工单 → 无人值守并发

1. **出规格**（不访谈，只综合对话 + 有界扫仓 + 若有则 product-reviewer 处理清单）：按 [spec-and-tickets.md](references/spec-and-tickets.md) §A 写入 `docs/specs/<slug>.md`。未达「开工就绪」→ `BLOCKED`（或见上「流程叙事不清」）。  
2. **规格门（必须）**：Read 并执行 [plan-reviewer](../plan-reviewer/SKILL.md)，`mode: go-fast-spec-gate`，输入 = 刚写入的 `spec_ref`；按该 mode **自动修 P0**（及清硬门槛所需的 P1）后再拆单。硬门槛仍在或 `BLOCKED` → **禁止拆单/派发**，整条 go-fast `BLOCKED`。用户明示 `skip_plan_review` 才可跳过（回传注明）。  
3. **拆工单**：按同文 §B 写入 `docs/specs/<slug>/tickets/<NN>-*.md`（一工单一文件，含阻塞边与路径白名单粗估；白名单优先取刺点「证据路径」）。  
4. **`attendance=unattended`**（本路径默认无人值守，不等人确认 seam / 拆分）。  
5. 取**前沿**工单（无未完成阻塞者）：路径白名单不相交 **且** 无产品语义阻塞边；若仓内有可用 codegraph（见 [code-scanning](../code-scanning/SKILL.md)）还须 **impact 影响面不相交** → worktree+subagent **同波并发**（波宽填满前沿，上限 20）；其余按依赖串行推进。  
6. 每张工单 = 一片；总规格为用语/seam 真源；验收以工单清单 + 规格「可观察验收」为准。

小缺陷且单路径：路径 B 可只出规格、工单目录仅 `01` 一张，再串行落地——仍走 B（含规格门），不回头引用外部「出规格」技能。

### 契约不明门（integration-research + 八维择优）

主路径依赖**仓外协议/厂商/SaaS**且契约、沙箱或失败语义不清时：

```text
停手（勿猜接）
  → integration-research：2–3 候选 + 证据
  → 八维择优（长期最合适）→ 选定
  → 真接开发（unattended 默认不等人）
```

**硬禁（零例外）**：外部契约不明时，**禁止**用 stub / mock / 假成功 / 内存假后端 / 「先返回成功」顶替交付或冒充已选型、已实现、可勾选。  
唯一合法出口：`research → 八维择优 → 真接`，或显式 `park`（该项挂起，保持未实现）。**不存在**「先 stub 再补契约」的完成态。

| attendance | 行为 |
|------------|------|
| **`unattended`（默认）** | **必须**走「研究 → 八维择优 → 选定 → 真接」；**禁止**干等用户；**禁止**无评分就随便挑；**禁止** stub 顶替。参数 `integration_policy` 默认 `auto_best`；用户可 `park` 或 `auto_best_require_adr`（难回退须先 ADR，见编排契约 §2）。`loop-goal-product` / `loop-goal-prd` / `loop-polishing` **同一口径**（禁止 product「一律 BLOCKED」分叉） |
| **`attended`** | 同样先研究 + 八维给出推荐；**停问**确认后再真接（用户可改选）；确认前同样禁 stub |
| **`integration_policy=park`** | 仅用户显式要求时：出简报后挂起该项、冲其他（不自动开工；仍禁 stub） |
| **`integration_policy=auto_best_require_adr`** | 同 `auto_best`，但 `needs_adr: true` 时**必须先落 ADR** 再真接；缺 ADR → park / `DONE_WITH_CONCERNS`，禁止先真接后补 |

**八维择优**（与 [integration-research](../integration-research/SKILL.md) / [plan-reviewer](../plan-reviewer/SKILL.md) 同尺，对**候选方案**打分）：长远规划、产品体验、生产诚实、架构边界、可靠性、可运维、安全合规、交付可验证。取算术平均最高且无硬门槛者为选定方案；并列 → 官方维护 SDK/标准实现 > 成熟社区库 > 自研。任何候选若依赖 stub 交付 → 「生产诚实」= 0，不得入选。

**仍须 park（不可假装选定开工）**：无任何公开资料/需 NDA 才能定契约；合法合规必须人批；缺少密钥/沙箱导致**连真实验收路径都无法定义**（可选定 SDK，但验收门标 `DONE_WITH_CONCERNS`，**仍禁止** stub/假绿顶上）。

**`auto_best` / `auto_best_require_adr` 审计最小集**（缺一不得宣称已选定开工；与编排契约 §2 一致）：

| 字段 | 要求 |
|------|------|
| `brief` | `docs/integrations/<slug>.md` |
| 八维表 | 简报内对照 |
| `selected` | 选定方案名 |
| 回传/ledger 一行 | brief / selected / auto_started |
| 难回退 | `needs_adr: true`；`auto_best_require_adr` 时还须 `adr_path` 已落盘 |

### 契约验真门（真打通过，才叫已对接）

上面那张表全是**文档与自述字段**。它能证明「研究过、选过」，**证明不了「通过」**。
「反 stub」不等于「反假通」——用标准 SDK 写出语法正确、endpoint/scope/签名全错的代码，
静态扫描与八维打分都发现不了，直到联调才炸。因此：

**宣称某个外部依赖「已对接 / 已实现 / 可勾选」之前，必须存在一条真实端点的 smoke 工件。**

```bash
EV=~/.agents/skills/_bin/evidence-run
$EV --slice INT-<slug> --phase smoke --label "<slug> <最小真实调用>" -- ./contracts/<slug>.smoke.<ext>
~/.agents/skills/_bin/gate-check smoke --slug <slug>     # 退出码 0 才算过
```

| 项 | 要求 |
|----|------|
| smoke 脚本 | `contracts/<slug>.smoke.*`，**可重复执行**，最小鉴权 + 一次只读或幂等写 |
| 打向 | 真实端点或厂商沙箱。**打本地 mock server 一律不算**（那是假通，比 stub 更难发现） |
| 凭据 | 从 `.dev` 声明的 env 变量名读；工件默认脱敏；**禁止**硬编码或写进仓库 |
| 失败语义 | 超时 / 401 / 429 退避 / 幂等键 须**写进代码并有测试**，不是只写在简报里 |
| 无凭据 / 无沙箱 | 走 `park`，或 `DONE_WITH_CONCERNS` + `blockers` 列明缺哪个凭据；**不得**标已对接 |

`integration_decisions[].smoke` 为空却把该依赖标成已实现 → 假通，等同假绿。

| 规则 | 说明 |
|------|------|
| 时机 | 路径分叉后、拆单派发前；或实现中发现外部缺口；或 CR 命中外部 stub |
| 产物 | 简报 + 选定记录（specs/ledger）+ 回传 `integration_decisions`（含 `needs_adr` / 必要时 `adr_path`） |
| 禁止 | 跳过研究与八维直接猜接；**任何形式 stub/mock/假成功顶替**；`unattended` 干等用户 |
| 不触发 | 纯本仓业务、无外部服务、arch 已钉死且契约清楚 |

### 规格门（plan-reviewer）

| 项 | 规则 |
|----|------|
| 时机 | 路径 B：出规格之后、拆单之前；路径 A：开工前（可 skip） |
| 输入 | **仅**本批 `docs/specs/<slug>.md`（必要时含已有 tickets）；**不要**把 product-reviewer 报告当输入 |
| 调用 | Read plan-reviewer；`mode: go-fast-spec-gate`；类型 `design-doc` / 实现规格 |
| 自动修 | 对该 `docs/specs/**` 文件：清硬门槛的 P0（及必要 P1）最小 diff；**一轮**修完 → 再评一次；仍触硬门槛 → go-fast `BLOCKED` |
| 不自动修 | `docs/automate/**`、`docs/arch.md`、goal/prd 真理源；P2；需产品裁定/缺外部契约的项 → 记 `blockers`，交人 or integration-research |
| 报告 | plan-reviewer 报告可落 `docs/material/plan-reviewer/…`；路径写入 go-fast 回传 `plan_review` |
| 与出规格边界 | plan-reviewer **不**负责从零写规格；只审+补强 go-fast 已落盘正文 |

### 产品报告与编排（product-reviewer / loop-goal-product）

| 规则 | 说明 |
|------|------|
| 报告 ≠ 规格 | 见上；默认路径 B |
| 刺点过滤 | 只修清单中 `视觉债=否` 且状态为 `open`（或回归 `open`）的项；`视觉债=是` 不进工单 |
| 硬门槛优先 | `硬门槛=是` 的 open 项必须排在工单依赖序最前；未清前不拆无关软刺并行洪水；编排方传入本批 ID 至多 `batch_size` |
| 契约不明 | 与本文件「契约不明门」+ 编排契约 §2 **同一口径**；**禁止**「一律 BLOCKED、不研究」 |
| 语义依赖边 | 同 module/flow 共享壳/布局/RBAC/同一状态机 → 工单「阻塞于」必写边，或先契约/共享壳片；**禁止**仅因 glob 不交就同波硬并 |
| **路径 / spec_reuse** | 报告 ≠ Path A；先查契约 §6.1，可复用则 `spec_reuse: true` 走 A |
| **回写单一写者** | **本 Skill（go-fast）**在合回+相关测绿后回写**源报告**处理清单；回传 `summary` = 已处理 ID。编排方只校验，漏写可补并记 `writeback_repaired`（见编排契约 §3） |
| **编排方 = loop-goal-product** | 主编排**禁止**在主会话直接改业务实现树；须 worktree + 实现 subagent（合法降级填 `zero_reason`）；product-reviewer 须 `mode: loop-lane`；再评前门见编排契约 §5.1–§5.2；共享细则见编排契约 / card |
| create-ui-docs | loop 冲分轮次中：缺 `docs/ui` 时只读已有，或按 anchor.md §4 最小基准补齐（6 项封顶）并记入 summary；**禁止**借机大改视觉基准冒充产品分 |
| CR vs 冲分 | **本环（product）** unattended CR 默认只自动修 P0+P1（`cr_fix_scope`；契约 §8；**勿**当成 polishing 默认——polishing 默认 `all`）；相关测绿即可出本轮；若改动主任务/入口/权责 → 须进入下一轮 product 再评 |

### PRD/plan 编排（loop-goal-prd）

| 规则 | 说明 |
|------|------|
| 依据 | `docs/automate/plan.md` 目标节 + PRD 分片 + **`docs/arch.md`**；Inventory/ledger **不是**路径 A 规格 |
| 路径 | 分片通过编排契约 §6 Path A → 可 A（对 PRD **只评不自动改**正文）；否则 B：综合 PRD+plan+arch 出 `docs/specs` → 规格门 → tickets |
| 硬门槛优先 | 验收含 stub/mock/demo 或 arch 冲突未消的 open 项须先于无关项 |
| 语义依赖边 | 同 loop-goal-product；另尊重 PRD 依赖性 / plan 顺序 |
| **回写单一写者** | **本 Skill**合回且相关绿后：诚实更新 PRD 分片状态 + plan 勾选（禁假绿）+ 源 Inventory；`summary` 列本批 PRD ID。编排方校验；完整 create-evolution 交互模式禁止，仅允许其 **`honest-writeback`** 规则子集 |
| **编排方 = loop-goal-prd** | 同 loop-goal-product：禁止主会话直接改业务实现树；须舰队；`orchestrator: loop-goal-prd`；本轮全量 `deferred_to_loop`；再盘点前门见编排契约 §5.1–§5.2 |
| 不改真理源方向 | **禁止**借 go-fast 擅自改 arch/goal；改 PRD/plan 仅限诚实完成态回写 |

### 打磨编排（loop-polishing）

| 规则 | 说明 |
|------|------|
| 报告 ≠ 规格 | 打磨台 / 各 reviewer 报告默认路径 B |
| 刺点过滤 | 硬门槛优先；剔除 `过抛风险=是`、默认剔除纯视觉债（除非 `fix_scope=all`）；arch 按**三级授权**收（`polish_safe` 自动 / `local-deepen` 须 ADR 已落盘 / `structural` 一律 deferred，见 [arch-reviewer](../arch-reviewer/SKILL.md)）；**细则**见 loop-polishing `anti-overpolish.md` + `finding-normalize.md`；回写见编排契约 §3 |
| 契约不明 | 编排契约 §2 同一口径 |
| **回写单一写者** | 合回+相关测绿后回写**源打磨报告**处理清单；`summary` = 已处理 ID；不得把过抛剔除项标成 done |
| **编排方 = loop-polishing** | 禁止主会话直接改业务实现树；须舰队；`orchestrator: loop-polishing`；本轮全量默认 `deferred_to_loop`（编排方 `full_suite_every` 中途全量除外）；再评前门 §5.1–§5.2（再评 = 下一评分台） |
| 过抛 | 不得把过抛项当成本批「完成」抬综合分 |

### reviewer 全量确认后的修复路径（auto-fix 反向调用）

[code-reviewer](../code-reviewer/SKILL.md) / [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) / [arch-reviewer](../arch-reviewer/SKILL.md) 在 `mode: auto-fix` 下扫完报告 → 用户确认（或指定 `P0` / `P0+P1` / `polish_safe` / `polish_safe+local-deepen`）后，会**反向调本 Skill**。本 Skill 接到时：

| 调用来源 | `spec_ref` | `attendance` | `cr_fix_scope` | 路径 |
|----------|-----------|--------------|---------------|------|
| code-reviewer（确认全量）| `docs/material/code-reviewer/<date>-<slug>.md` | `attended` | `all` | B（报告 = 综合 spec） |
| code-reviewer（指定 P0/P0+P1）| 同上 | `unattended` | `P0` / `P0+P1` | B |
| ui-ux-reviewer（确认全量）| `docs/material/ui-ux-reviewer/<date>-<slug>.md` | `attended` | `all` | B；S0 共享壳优先 |
| ui-ux-reviewer（指定 P0/P0+P1）| 同上 | `unattended` | `P0` / `P0+P1` | B |
| arch-reviewer（确认 polish_safe+local-deepen）| `docs/material/arch-reviewer/<date>-<slug>.md` | `attended` | `polish_safe+local-deepen` | B；`local-deepen` 候选必须 ADR 已落盘 |
| arch-reviewer（指定 polish_safe）| 同上 | `unattended` | `polish_safe` | B |
| arch-reviewer（structural 候选）| — | — | — | **不进 auto-fix**；走 arch-reviewer Phase 3 grilling → 切片 |

**对 reviewer 报告作为 spec 的额外要求**：
- 报告含**完整 finding 表**（id / severity / category / path+line / suggested_fix / xref），缺字段 → 视为规格门未过，BLOCKED
- finding 的 `xref` 链（同根因组）→ 本 Skill 拆工单时合并进同一 subagent，不跨波
- arch-reviewer `local-deepen` 候选 → 本 Skill 按「refactor-shared 片」规则独占一波（编排契约 §4），不占 batch 名额
- 修完回写：本 Skill 合回 + 相关测绿后，**必须**回写源 reviewer 报告的处理清单（finding ID → done/blocked；候选 ID → ADR 路径）

**禁止**：
- 把 reviewer 报告当路径 A 规格（无 Path A 检查表）；必须路径 B
- 跳过规格门（plan-reviewer）；除非 reviewer 报告本身已过 plan-review
- `cr_fix_scope` 超出 reviewer 确认范围（如用户只确认 P0，本 Skill 自行扩到 P2）

单独调用 go-fast（非 loop）时：仍鼓励 subagent+worktree；允许主编排在合法串行下降级手写，但需求来自产品报告时**仍须**由本 Skill 回写处理清单（或显式委托编排方并在 summary 注明）；需求来自 loop-goal-prd 时**仍须**诚实回写 PRD/plan。经 loop 时写者固定为 go-fast（编排契约 §3）。

---

## 有人值守 / 无人值守

| | **attended** | **unattended** |
|--|--------------|----------------|
| 典型 | 路径 A 且用户未说无人值守 | 路径 B；或路径 A 且用户明示无人值守 |
| seam | 列出并确认；未确认不测不派 | 用规格「测试决策」seam；写入回传 |
| 切片/工单 | Slice Map 亮一行；未反对可并行 | 用工单前沿或自裁 Slice Map；不额外停问 |
| UI 基准 | 缺 `docs/ui` → create-ui-docs 预览确认 | 缺则按 [anchor.md](../create-ui-docs/references/anchor.md) §4「最小基准」（**限定 6 项**）落，可信度只能 `inferred`/`assumed`，所有 `assumed` 进 `blockers`；**禁止**超出这 6 项臆造 |
| 停问 | 歧义可问一句 | 证据不足 → `BLOCKED`，不猜需求 |
| 合回初始分支 | 集成相关测绿后**停问**再 merge 回 `base_branch` | 集成相关测绿后**自动** merge 回 `base_branch` |
| 合回后测 | 见「验证纪律」：单独调用默认全量 1 次；`orchestrator=loop-goal-product|loop-goal-prd|loop-polishing` 本轮**只相关测**（全量留给整环结束；polishing 显式中途全量除外） | 同左 |
| 合回后清理 | 合回 + **本批验证门**绿后**必须**清本批 worktree / 片分支 / 已并入的 `integrate_branch`（不问是否保留） | 同左，自动清 |
| 收尾 code-reviewer | **建议**跑（变更面）；若跑了 → 报告后**停问确认**再 batch-fix | 合回 + 本批验证门绿后**必须**跑；`mode: go-fast-unattended-fix`。**无 orchestrator**：可修 P0+P1+P2。**有 orchestrator**：按传入 `cr_fix_scope`（polishing 默认 `all`；prd/product 默认 `P0+P1`） |
| 推送 | 仅用户明确要求 | 同左 |

---

## 开工前（必须）

0. **主流程分叉** → 得到 `spec_ref`；路径 B 已过规格门后再有 `tickets_dir`。  
0.4 **证据目录门**：编排契约 [§0.5](references/loop-orchestrator-contract.md)（`.evidence/` 已 ignore 且未被跟踪；缺 ignore 可补写；已跟踪 → `BLOCKED`）。见 [evidence.md](references/evidence.md)。  
0.5 **建证据 run**：`~/.agents/skills/_bin/evidence-run init`（幂等）。本批所有验证命令都从它走，见 [evidence.md](references/evidence.md)。  
0.6 **外部依赖盘点（一次，覆盖本批全部工单）**：扫本批规格/工单 + 仓内既有适配器，列出**所有**要碰的仓外协议/厂商/SaaS，逐条标 `credential: have | need | blocked`。  
   - 这是**主动全量盘点**，不是「发现不明才触发」。被动触发会漏，漏掉的就是后期对不上的那些。  
   - 有 `need` → 一次性问齐（attended）或按「契约不明门」处理（unattended）；**不要**边做边发现、一条一条停。  
   - 每条 `have` 的依赖，开工前或本片内必须产出 smoke 工件（见「契约验真门」）。  
1. **记录分支锚点**（并行/合回真源）：  
   - `base_branch` = 当前 HEAD 分支名（开工时的初始分支）  
   - HEAD detached → attended 问一句确认基线；unattended → `BLOCKED`（不猜）  
   - `integrate_branch` = 主工作区任务分支，或新建 `go-fast/integrate`（从 `base_branch` 分出）  
2. **读规格**（规格门之后的正文；及当前要做的工单）；验收为**真实路径**句式。  
2.5 **项目规则与本地技能**（见 [project-context.md](references/project-context.md)）：  
   - 盘点 `.cursor/rules`、仓根 `AGENTS.md`/`CLAUDE.md`、以及**仓库内** `.cursor/skills` / `.agents/skills` / `skills/`（**不是** `$HOME/.agents/skills`）  
   - always 规则必读；glob 规则按本批白名单相交加载；相关项目 skill（如设计系统）全文 Read 并遵守  
   - **必须下传**到 implementer「项目红线 / 项目技能」段——实现 subagent 不继承主会话注入  
   - 与 go-fast 硬禁冲突时硬禁优先，项目侧记 `blockers`  
3. **读仓**：依赖、目标模块、邻近测试与错误风格；有 arch/goal 则对齐术语。**先认栈**。  
   - **命中 go-zero** → Read 并遵守 [go-zero-goctl.md](references/go-zero-goctl.md)（**绝对红线**：遵守 goctl；严禁手改产物 `types.go`/`routes.go`；禁止给 goctl 产物打补丁）。回传 `stack.go_zero: true`。  
4. **写前端时读** `docs/ui/` + **[frontend-ui-contract.md](references/frontend-ui-contract.md)**（防风格漂移；**复用** craft / ui-ux 菜谱，不另造规范）：  
   - 有则必读：`anchor.md`（设计锚：组件库 + token 来源 + 外部参考）+ `layout.md` + 相关 `*-ia.md`  
   - **必读真源**： [craft.md](../create-ui-docs/references/craft.md) + [page-recipes.md](../ui-ux-reviewer/references/page-recipes.md)（改列表/详情/CRUD 时再读 [anti-patterns.md](../ui-ux-reviewer/references/anti-patterns.md) 相关节）  
   - 若项目提供设计系统 skill（`.cursor/skills` 等）→ **与 `docs/ui/` 一并**按 project-context 加载，冲突时：硬禁 > 项目 skill 明示红线 > `docs/ui` 锚 > craft  
   - 缺失或过时 → [create-ui-docs](../create-ui-docs/SKILL.md)。**缺设计锚时不得由本 Skill 自造视觉基准**：
     没有锚的自造基准会形成「AI 造基准 → AI 照它实现 → AI 拿它评审 → 自证合规」的闭环，
     漂移要到人工验收才暴露。unattended 缺锚 → 按最小可信锚（仓内既有组件库 + 既有 token）落，
     并在回传 `blockers` 标明「设计锚未钉死」  
   - 新页/优化页：严格执行 [page-design.md](../create-ui-docs/references/page-design.md) + craft（**含 §7 详情只读、§2 编辑载体、§8 用户向文案**）；禁止跳过设计卡  
   - **硬清单须落地**：详情默认只读描述；编辑用 Dialog/Sheet/独立页三者择一（同域一致）；删除等危险操作用 destructive 红、禁止满屏品牌色按钮；列表操作栏 **ghost** 且组内间距紧凑；页内色彩勿过密；**禁止卡片套卡片**（含列表外卡再套表格内框，见 craft §6 / frontend-ui-contract §6）  
   - 套壳/模板/菜谱；信息量与间距、Dialog/Sheet、toast、抛光跟 craft  
   - **读完必须传下去**：把设计锚、壳层结论、本页菜谱、标杆页路径、必须复用的组件清单、**frontend-ui-contract 硬清单**、craft §8 文案禁令、以及项目设计系统 skill 要点
     写进 [implementer-prompt.md](references/implementer-prompt.md) 的「UI 契约」段。
     实现 subagent 不继承本会话，**你读了不传等于没读**  
4.5 **建模门（本批碰 DDL/迁移/ORM 模型时）**：白名单含 `migrations/`、`db/`、`prisma/`、`models/`、`entity/`，
   或规格里有建表/改表 → 按下表处理。**新建表是最便宜的时刻**：此刻改一版 DDL 就完事，
   上线后同样的问题要 expand→backfill→switch→contract 四步走。
   先按 model-reviewer「**变更风险三档**」（该文是粒度真源）给本片定档，**判据只有一条：出错时能不能靠 revert 一次提交回到原状**。
   | 档 | 动作 | unattended |
   |----|------|-----------|
   | **T1** 向后兼容无回填（新建表、加可空列、加索引、加 CHECK/唯一约束且**已查存量无违规**） | 调 [model-reviewer](../model-reviewer/SKILL.md) `mode=slice-gate`（11 条 checklist）。`verdict: block` → **前门失败 = 回炉**：按 `must_fix` 改 DDL 再跑一次 gate，**不升人**、不得「记债后继续」；**同一片连续 2 次仍 block** → 停止重试并 park 升人 | **可做** |
   | **T2** 扩展 + 回填（旧结构仍是唯一读源） | 做 expand + backfill，留证据（存量校验查询 + 迁移可重放 + 回滚已验）；**`switch` / `contract` 挂 `remaining` 等人**，该条目不算完成 | **可做前两步** |
   | **T3** 破坏性（switch/contract、改键或唯一键语义、改列类型、改字段语义、拆表合表、分区分片改造、大表加 FK） | **park 升人**，不自行改表；attended 则先跑 model-reviewer 完整 review 拿迁移剧本 | **一律不做** |
   | `spec_ref` 来自 model-reviewer（`invoked_by: model-reviewer`） | **禁止回调 model-reviewer** —— 已审过，回调即成环 | — |
   - **T3 禁止拆成多个 T2 分批绕过**；T1/T2 在无人值守下仍须版本化 migrations（禁手改库）+ 证据工件
   - **park ≠ 整环 BLOCKED**：该片 skip → 挂 `remaining` + `needs_human` → 编排方继续做本批其它片，且**该片不得进入后续轮次候选**（否则每轮重撞同一堵墙，烧轮次）
   - **单向一次**：go-fast → model-reviewer 只允许 `slice-gate` 这一档且不递归；`slice-gate` 侧禁止反向调 go-fast
   - 无迁移/DDL 变更的片跳过本步，回传 `model_gate: skipped`

5. **列出 seam**（attended 确认 / unattended 自定并记录）。  
6. **划切片 / 分派图**：路径 A → Slice Map；路径 B → 以 tickets 为切片源（每张工单一片）。  
   - 写清依赖边 + 路径白名单；相交或有阻塞 → 不可同波  
   - 依赖边含：API/类型 **与** 产品语义（共享壳、RBAC、同一状态机）  
   - 无依赖且白名单不相交 → **候选**同波；再按 [parallel.md](references/parallel.md) §1.4 做 **codegraph impact**（有图才做；无图/`status` 过期且 sync 失败 → 只靠白名单，回传 `impact_check: skipped`）  
   - 共享类型/同一文件/共享壳 → 串行或先契约片  
   - **多页前端批次**：先串行 **S0 壳层片**（壳/页模板/共享组件/token），合回后才铺页；
     否则 N 个片各造一套页头与空态。细则见 [parallel.md](references/parallel.md)  
   - **≥2 片要写相似逻辑** → 先插一片 `refactor-shared` 独占一波做提取，
     不要放任各片在自己白名单里各复制一份（白名单机制天然奖励复制，须主动对冲）  
7. 用语与规格一致；过载词消歧（unattended：依据写入 `summary`）。

attended：亮一行 `attendance` + `serial|parallel(N≤20)` + `base_branch` + 切片摘要。  
unattended：写入回传即可，不额外停问。

---

## 并行加速（能并行才并行 · 洪水舰队）

细则见 [parallel.md](references/parallel.md)；派发模板见 [implementer-prompt.md](references/implementer-prompt.md)。  
目标仍是缩短墙钟，但**路径不交 ≠ 可并行**（产品语义边见上节与 parallel.md）。

| 条件 | 并行？ |
|------|--------|
| ≥2 片/工单，白名单不相交，无 API/类型/产品语义阻塞边，**且**（无可用图 **或** impact 不相交） | **是** — 同波 worktree + subagent（填满前沿，上限 20） |
| 同文件 / 后片依赖前片 / 共享壳·RBAC·状态机 / 工单仍被阻塞 / **impact 相交** | **否** — 串行或等前沿 |
| 仅调研 | 可并行只读；不建 worktree |

### 主编排（波次循环）

1. 建分派图：依赖边（含产品语义）+ 路径白名单相交检测 + **有图时的 impact 相交检测**（[parallel.md](references/parallel.md) §1.4）；**前沿** = 无未完成阻塞者、彼此白名单不相交、且（跳过或通过）impact。  
2. 取前沿最多 **20** 片：每片建隔离 worktree + 分支（已在 linked worktree 内勿叠套）。  
3. **同一轮**派出最多 20 个实现 subagent（提示词按 implementer-prompt，自包含；**不传 `model`**，继承本会话）。  
4. 等齐 → **合并门**轻量回传审 + 越界 diff 检查 → 按依赖序 merge 进 `integrate_branch` → **本波相关测**（禁止本步全量 FE / 多树同时全量）。  
5. 任一片 `BLOCKED` / 合并冲突 / 集成红 → **停派新波**；先修失败片或降级串行；未全绿前禁止宣称本批 DONE。  
6. 刷新前沿，派下一波，直到切片/工单耗尽。  
7. 全部集成绿后 → **合回 `base_branch`**（见「收尾」）。

### 硬限制

- **舰队上限 `fleet_cap = 20`**：同波尽量填满可并行前沿；**>20 须用户预先授权**（unattended 亦遵守，除非授权）。  
- **模型锁定（会话同源）**：派发实现 / 调研 / 修冲突等 **一切** go-fast Task/subagent 时 **禁止** 传 `model`（或等价「换模型 / 指定更强模型」参数）。省略后子代理继承**当前主会话模型**；片 `BLOCKED` 时拆更小片 / 补上下文 / 升给人，**禁止**用换模型当重试手段。  
- 白名单相交、impact 相交（有图时）、或仍有阻塞边（含产品语义）→ **禁止**同波硬并行。  
- 每片只做轻量回传审；规格/质量深审放在合并门 + 收尾 code-reviewer（`unattended` 强制并自动修；**不**每片双审）。  
- Subagent 不得互改同一路径；不得擅自 push。  
- 提交：各 worktree 本地 commit 清晰；推送/PR 仅用户要求。  
- 沙箱/平台拒绝再建 worktree → 降级串行或缩小波宽，并写入回传 `zero_reason: degrade`。  
- 实现 subagent 长时间无回传：主编排可取消并重派/降级串行，记入 `blockers`；禁止假装该片 DONE。

---

## 红绿循环（每一刀）

默认每一刀：**一个 seam · 一条失败测试 · 仅够变绿的实现**。

| 步 | 动作 | 要点 |
|----|------|------|
| 红 | 写失败测试 | 期望来自规格/工单字面量 |
| 确认红 | 跑该文件/用例 | 失败原因符合预期 |
| 绿 | 最小实现 | 不预支下一刀 |
| 确认绿 | 再跑同一范围 | 通过后再下一刀 |
| 常检 | 改动面附近 | 单测 + 类型/静态检查 |

| 反模式 | 正确做法 |
|--------|----------|
| 验内部协作/调用次数 | 只经 seam 观察行为 |
| 同义反复 | 期望用独立字面量 |
| 横批测试 | 竖切：一测→一实现 |
| 先绿后测 | 必须先见红 |

### 红必须留证

「先见红」以前只是纪律口号——回传里没有任何字段能区分「见过红」和「直接写了绿测试」。现在两个阶段都过 `evidence-run`：

```bash
EV=~/.agents/skills/_bin/evidence-run
$EV --slice <id> --phase red --expect-fail --label "<验什么>" -- <测试命令>   # 退出码须 ≠ 0
$EV --slice <id> --phase green --label "<同上>"              -- <同一命令>   # 退出码须 = 0
~/.agents/skills/_bin/gate-check red-green --slice <id>
```

红工件缺失、或红工件退出码是 0（测试从一开始就绿）→ 这一刀不成立。
后续绿阶段的**用例数不得低于**前面轮次（`gate-check case-count`）——缩小验证范围换绿会被直接判失败。

**产品向 / 无合适自动测基建时的降级**（须写入工单与回传 `evidence.degraded`）：  
可用规格「可观察验收」句式 + 手工/窄集成路径验证代替强单元红绿，但**仍须** `--phase slice` 记录你实际跑过的东西（构建、类型检查、启动、脚本化的手工路径），并写明为何无红绿。**仍禁止**主路径假绿、假后端、mock 冒充交付。有仓内既有测则优先红绿。

---

## 实现习惯

- 系统边界可注入替换；核心勿写死外部 SDK。  
- 公共 API 为默认 seam。  
- 非测试主路径禁止假成功 / 假后端冒充交付。  
- 跟仓内风格，不另起框架。

## 验证纪律

**所有验证命令一律用 `evidence-run` 包起来跑**（原样透传输出与退出码，不改变既有行为），`--phase` 按下表填；判定用 `gate-check`。见 [evidence.md](references/evidence.md)。

| 时机 | 做什么 | `--phase` |
|------|--------|-----------|
| 每一刀 | 红（`--expect-fail`）→ 绿，同一范围 | `red` / `green` |
| 每片收尾 | **仅**白名单路径测试 + 类型检查；**禁止**该 worktree 内无路径全量 | `slice` |
| 并行波次合并门 | **仅**本波触及目录/包的相关测；**禁止**多 worktree 同时全量 | `merge` |
| 合回 `base_branch` 后 | 见下「全量时机」 | `full` |
| 收尾 code-reviewer 自动修后 | 先跑变更面相关测；是否再全量跟「全量时机」 | `cr` |
| 宣称外部依赖已对接前 | 打真实端点/沙箱 | `smoke` |

### 全量时机（按编排方）

| 调用方 | 合回后 / 本批收尾 | 全量谁跑 |
|--------|-------------------|----------|
| **单独** go-fast（`orchestrator` 空） | 合回后跑**相关测**，再默认 **全量 1 次**；绿才宣称本批 DONE | 本 Skill |
| **loop-goal-product** / **loop-goal-prd** / **loop-polishing** 内一轮 Fix | 合回后**只跑相关测**；**禁止**本轮全量（polishing 编排方显式 `full_suite_every` 除外） | **整环结束**（loop Phase 5）最多 1 次 |
| 用户 `skip_full_test` | 单独调用也可跳过收尾全量；回传注明；仍须相关测绿 | — |

「本批验证门绿」= 合回成功 + 按上表该跑的测已绿（loop 轮次 = 相关绿；单独 = 相关绿 + 全量绿，除非 skip）。

### 舰队禁全量（FE / Vitest 硬规则）

多 subagent、多 worktree 并发时，**默认禁止各片跑前端全量**（否则墙钟与内存随波宽线性爆炸，且易留 watch 孤儿进程）。

| 规则 | 说明 |
|------|------|
| 片内命令 | 工单须写死路径，例如：`pnpm exec vitest run <白名单路径…>` 或仓内等价 `make test-fe-fast` / related |
| 禁止 | `pnpm test` / `npm test` / 裸 `vitest`（默认 **watch**，agent 断线易留孤儿）；无路径的 `vitest run` 全仓 |
| 必须 | 一律 `vitest run`（或仓内封装且内部是 `run`）；watch 仅人类本地 |
| 合并门 | 本波相关目录一次；**不要**每波全量 |
| 全量时机 | 见上表；loop 内轮次禁止全量；单独 go-fast 收尾 ≤1 次（可 `skip_full_test`） |
| 孤儿 | 片结束确认无残留 vitest/vite-node；主编排发现本机打满可 `pkill -f 'vitest\|vite-node'`（慎用，勿误杀无关会话） |
| Go/其它 | 同理：片内 `go test ./触及包/...`，禁止每片 `go test ./...`；全量按上表时机 |

优先仓内快路径：`make test`（若已拆 FE）、`pnpm exec vitest run <paths>`、`go test ./pkg/...`、`pytest <paths>`。**不要**在 implementer 提示词里写无限定的 `pnpm test`。

## 收尾

1. 对照规格与 Slice Map / 全部 tickets：可观察验收通过；`integrate_branch` 上**相关测**绿。  
1.5 **证据门（合回之前）**：
   ```bash
   ~/.agents/skills/_bin/gate-check batch --slices <本批切片ID逗号分隔> --strict-red
   ```
   退出码非 0 → **禁止**合回、禁止宣称 DONE。逐条修复或如实降级为 `DONE_WITH_CONCERNS` 并把
   gate 的 `reasons` 原样写进回传 `evidence.gate.reasons`（**不许**静默吞掉，也**不许**删工件重跑）。
   仓内没有自动测基建时不加 `--strict-red`，但告警仍须原样上报。  
2. **合回 `base_branch`**（合并门已绿之后）：  
   - `unattended`：在主工作区 `checkout base_branch` → `merge integrate_branch`（或等价快进）→ 按「验证纪律·全量时机」跑测；红则停在集成区修，**不**宣称 DONE。  
   - `attended`：集成相关测绿后停问「是否合回 `base_branch`」；用户同意再 merge + 按全量时机跑测。  
3. **合回成功且本批验证门绿 → 必须清理本批隔离区**（细则见 [parallel.md](references/parallel.md)「清理」）：  
   - 凡本批创建的 **worktree**（`.worktrees/go-fast-*` 等）→ `git worktree remove`  
   - 凡本批 **片/开发分支**（`go-fast/<slice-id>` 等，且已并入）→ `git branch -d`  
   - `integrate_branch` 若已并入 `base_branch` 且 ≠ `base_branch` → 同样删除  
   - 串行单分支开工同理：合回后删该开发分支与其 worktree（若有）  
   - **默认清干净**；不问「是否保留」。仅当用户在开工前或合回前**明示保留**某分支/worktree 时可例外，并写入回传 `cleanup.kept`  
   - 合回失败 / 验证门红 / `BLOCKED` → **禁止**删证据分支与 worktree；列入 `blockers` / `cleanup.remaining`  
4. **回写单一写者（合回 + 本批验证门绿后，由本 Skill 执行）**  
   - **product-reviewer / loop-goal-product**：回写**源报告**「处理清单」——本批刺点 ID 标 `done`/`blocked`/…，填改动摘要、验证、规格/工单路径；回传 **`summary`** = 已处理 ID 列表（本批有可验收完成项时**禁止空**）。缺硬门槛/视觉债列则按 product-reviewer 模板补列再填。再评新文件不替代源报告回写。  
   - **loop-goal-prd**：诚实回写 PRD 分片状态 + plan 勾选（禁假绿）+ **源 Inventory**处理清单；`summary` 列本批 PRD ID。仅按 create-evolution **`honest-writeback`** 规则改状态/勾选，禁止借机大改验收句或新功能域。  
   - **loop-polishing**：回写**源打磨报告**处理清单（含过抛/硬门槛列）；`summary` = 已处理 ID；不得把过抛剔除项标成 done 抬分。  
   - 经 loop 编排时：编排方**不得**抢先勾选/标 done；仅可在发现漏写后补写并回传 `writeback_repaired: true`（见编排契约 §3）。  
5. **收尾 code-reviewer**（合回 + 本批验证门绿 + 清理之后；细则见 [code-reviewer](../code-reviewer/SKILL.md)）：  
   - **范围**：本批**变更面**（相对开工前 `base_branch` tip 的 diff 触及目录为主根，L1/L2/L7 上追一层）；非整仓，除非用户明示。  
   - **`unattended`（必须）**：Read 并执行 code-reviewer，`mode: go-fast-unattended-fix`。自动修范围：无 `orchestrator` → 可修 P0+P1+P2；有 orchestrator → 按传入 `cr_fix_scope`（**loop-polishing 默认 all**；prd/product 默认仅 P0+P1，除非显式 `all`）。有可修项 → **自动**走 batch-fix，不等人确认；修完跑变更面相关测；**单独**调用且未 `skip_full_test` 时按全量时机补全量；**loop 内轮次禁止**因此再跑全量。契约不明 / 需裁定 / 盲区不足以安全改 → 只记 `code_review.remaining`（可撤入口则优先撤），**禁止**瞎真接。无可修且无阻塞 remaining → `code_review.status: DONE`。仍有可修且落在 `cr_fix_scope` 内却未修 → **禁止**宣称整批干净 `DONE`。  
   - **提交隔离（必须）**：此时已合回 `base_branch` 且本批 worktree 已清理，CR 自动修**直接落在主工作区**，没有隔离区可退。因此：CR 自动修的改动须形成**独立 commit**（如 `cr: 自动修 <finding ids>`），**不得**与实现改动混在一起、**不得**留在工作区不提交；修后变更面相关测**红** → `git revert` 该 commit（或等价回退）恢复到合回态，再把该 finding 转入 `code_review.remaining`，**禁止**留脏树交给编排方（会直接触发编排契约 §5.1 第 2 条前门失败）。  
   - **经 loop-goal-product**：CR 自动修若触及主任务/入口/权责/状态机表面 → 回传注明，供编排方记 `code_review_delta`；**不得**假定产品分已过关。  
   - **`attended`（建议）**：建议跑同一变更面；若跑了 → 默认 `fix_mode: confirm-batch`（即 code-reviewer 的 `mode: auto-fix` 默认行为），报告后停问再修。用户说 `skip_code_review` 可跳过（回传注明）。
   - 用户明示 `skip_code_review`：unattended 亦可跳过，但回传 `skipped_reason`，且不得假装已审。  
6. 提交/推送仅用户明确要求；外部契约不明 → 走「契约不明门」（research → 八维择优 → 真接；或 park）；**禁止**收尾阶段用 stub 顶替或瞎真接。  
7. 中止/BLOCKED：列出残留 worktree / 片分支于 `cleanup.remaining`；未合并勿强删。

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: go-fast
path: A_direct | B_spec_tickets | skipped   # skipped：本批无可修项或被上游阻塞，未产生任何合回
spec_reuse: false         # 契约 §6.1；命中已有 specs 覆盖本批时 true
attendance: attended | unattended
mode: serial | parallel
orchestrator: ""          # loop-goal-product | loop-goal-prd | loop-polishing | ""（单独调用）
cr_fix_scope: all | P0+P1  # polishing 默认 all；prd/product 默认 P0+P1；单独调用默认 all
fleet_cap: 20
wave_size: 0              # 本轮派出实现 subagent 总数（非仅最后一波）
zero_reason: ""           # wave_size=0 时：degrade | no_fixable_items | blocked_upstream
degrade_reason: ""        # zero_reason=degrade 时必填
base_branch: ""
integrate_branch: ""
stack:
  go_zero: false          # 认栈命中 go-zero 时 true；见 go-zero-goctl.md
merged_to_base: false     # 是否已合回 base_branch
full_suite:
  ran: false              # 本批是否跑过全量
  deferred_to_loop: false # orchestrator 为三 loop 之一时默认 true（本轮禁全量）
  skipped_reason: ""      # skip_full_test | …
cleanup:
  done: false             # 合回+本批验证门绿后是否已清本批 worktree + 开发/集成分支
  removed_worktrees: []
  removed_branches: []
  kept: []                # 仅用户明示保留时非空
  remaining: []           # BLOCKED / 未合入时残留，须列出
spec_ref: ""
spec_via: user_provided | generated | repo_existing
source_report: ""         # product-reviewer 源报告路径（若有）
tickets_dir: ""           # 路径 B；路径 A 可空
plan_review:
  ran: true|false
  skipped_reason: ""      # skip_plan_review | not_specs_path | …
  status: DONE | DONE_WITH_CONCERNS | BLOCKED | skipped
  total: 0
  hard_gates_cleared: true|false
  report: ""              # docs/material/plan-reviewer/…
  auto_fixed: []          # 已自动写入 specs 的 P0/P1 摘要
model_gate:               # 开工前步骤 4.5；无 DDL/迁移变更时 skipped
  status: skipped | pass | blocked | parked_t3
  tier: ""                # T1 | T2 | T3（见 model-reviewer「变更风险三档」）
  must_fix: []            # slice-gate 必修项（blocked 时非空；改完 DDL 重跑 gate，不升人）
  block_attempts: 0       # 同一片连续 block 次数；达 2 → 停止重试并 park 升人
  deferred_steps: []      # T2 下挂起的步骤（switch / contract），须进 remaining 等人
  note: ""                # parked_t3 已升人；invoked_by=model-reviewer 则跳过以防环
external_deps:            # 开工前盘点结果（步骤 0.6）；无外部依赖时空数组
  - name: ""
    credential: have | need | blocked
    smoke: ""             # 证据工件路径；credential=have 时宣称已对接必填
project_context:          # 开工前步骤 2.5；见 project-context.md
  none: false
  rules: []               # {path, apply, loaded}
  skills: []              # {name, path, relevant, loaded}
  red_lines_excerpt: []
integration_decisions:    # 数组（契约 §11 同名字段）；契约不明门触发时必填，未触发为 []
  - id: ""                # 触发该决策的依赖 / finding ID
    ran: true|false
    brief: ""             # docs/integrations/<slug>.md
    policy: auto_best | auto_best_require_adr | park | attended_confirm
    selected: ""          # 选定方案短名
    scores: {}            # 八维分或候选→总分
    auto_started: true|false
    smoke: ""             # 真实端点 smoke 工件；为空则**不得**标该依赖已对接
    failure_semantics_tested: false  # 超时/401/429/幂等是否已有测试（非仅写文档）
    needs_adr: false      # 难回退选型：true
    adr_path: ""          # auto_best_require_adr 且 needs_adr 时必填
    park_reason: ""       # 仅 park：nda | no_public_docs | compliance | …
evidence:                 # 证据层；见 references/evidence.md
  run_id: ""
  gate:                   # gate-check batch 结果，原样贴，不许修饰
    status: PASS | FAIL
    reasons: []
  slices:
    - slice: ""
      red: ""             # 工件路径；无测试基建时留空并进 degraded
      green: ""
      cases: 0
  smoke: []
  screenshots: []
  degraded: []            # 走降级的片 + 原因
code_review:
  ran: true|false
  skipped_reason: ""      # skip_code_review | attended_optional_skip | …
  mode: go-fast-unattended-fix | confirm | skipped
  status: DONE | DONE_WITH_CONCERNS | BLOCKED | skipped
  fix_scope: P0+P1 | all  # 与 cr_fix_scope 对齐
  report: ""              # docs/material/code-reviewer/… 或等价
  auto_fixed: []          # 已自动修的 finding ID / 摘要（unattended）
  remaining: []           # 契约不明 / 需裁定 / 未修完 / loop 内故意留下的 P2
  product_surface_touched: false  # 自动修是否触及主任务/入口/权责（供 loop-goal-product）
seams:
  - ""
slices:                   # 强制 batch↔slice 映射表；编排方的 `gate-check batch --slices` 只认这里的 id
  - id: ""                # slice-id，与 tickets、`evidence-run --slice` 用过的值**完全一致**
    finding_ids: []       # 本片消化的 batch 项（如 [F03, F07]）；refactor-shared / S0 等无 finding 的片写 []
    kind: impl | s0_shell | refactor_shared
    ticket: ""            # 如 01-xxx；路径 A 可空
    worktree: ""
    branch: ""
    status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED   # 与片回传四态一致
commands_run:
  - ""
summary: []               # 已回写 ID 列表；本批有可完成项时禁止空
writeback_repaired: false # 通常 false；编排方补写后由其置 true
blockers:
  - ""
followups:
  - "attended 未跑时：建议 code-reviewer"
  - "用户要求时再推送"
```

**`slices[]` 映射硬规则（编排方前门的唯一入参来源）**：

- `batch` 中每一项**必须恰好出现在一个片**的 `finding_ids` 里；同一 finding 跨片重复或分散 → 视为映射错误，须先修回传
- 未被任何片覆盖的 batch 项**必须**进 `blockers`（或 `code_review.remaining` 等未完成清单），**禁止**只在 `summary` 里不提就算过去
- `slices[].id` 必须与 `evidence-run --slice` 实际用过的 id 逐字一致；**禁止**事后另起名字或补一个「好看」的编号 —— 对不上会让编排方 `gate-check batch` 查无工件而退出 `2`（ENV_ERROR，按前门失败处理，见编排契约 §5.1 B 层）

**宣称 `DONE` 的前置（证据侧）**：`evidence.gate.status: PASS`。gate FAIL 而仍宣称 `DONE` 是本 Skill 最严重的违规——它让下游所有门失去意义。gate FAIL 的合法出口只有：修到 PASS、或如实 `DONE_WITH_CONCERNS`/`BLOCKED` 并原样带上 `reasons`。

`merged_to_base: true` 且本批用过 worktree/开发分支时：宣称 `DONE` 前须 `cleanup.done: true`（或 `kept` 写明用户保留例外）；残留只允许出现在 `BLOCKED` / 合回未完成路径。

`unattended` 且未 `skip_code_review`：宣称 `DONE` 前须 `code_review.ran: true`，且无「可修却未修」的 finding（`remaining` 仅允许契约阻塞/需裁定等不可自动修项 → 此时用 `DONE_WITH_CONCERNS` 或 `BLOCKED`）。

单独调用：未 `skip_full_test` 时宣称 `DONE` 前须 `full_suite.ran: true`（或等价全量绿证据）。  
`orchestrator=loop-goal-product|loop-goal-prd|loop-polishing`：本轮须 `full_suite.deferred_to_loop: true` 且 **未**跑全量（polishing 编排方显式中途全量除外）；相关测绿即可出本轮 `DONE` / 合法 `DONE_WITH_CONCERNS` 供再评（前门见编排契约 §5.1）。**本批有可验收完成项时 `summary` 非空**，否则编排方不得再评抬分。

`zero_reason`：`no_fixable_items` = 无可修刺点；`blocked_upstream` = 硬门槛/契约未清无法开工；`degrade` = 有工单但未并行（合法串行/无 worktree）。

## 红线

标 `[gate]` 的可用 `gate-check` 机器判定，违反会被直接拦下；没标的靠自觉。

> 维护约定：**一条既没有 gate、又从没真正拦下过什么的红线，就是安慰剂，下次维护时删掉。**
> 禁令数量本身会稀释注意力——第 40 条和第 1 条在推理时不是同等分量。宁可少而硬。

**分叉与规格**

- **禁止**跳过主流程分叉：无 `spec_ref` 就测试/实现/派 subagent
- **禁止**把 product-reviewer / loop ledger / Inventory / 打磨台报告当路径 A「已有规格」；**禁止**未过编排契约 §6 Path A 检查表就拿 PRD 分片 / 非 specs 路径当 `spec_ref` 直接干
- **禁止**路径 B 跳过规格门（plan-reviewer）就拆单派发，或规格门硬门槛未清仍开工（`skip_plan_review` 除外）

**外部契约**

- **禁止**外部契约不明时用 stub / mock / 假成功 / 内存假后端 / 「先返回成功」顶替交付（零例外；只能真接或 `park`）
- **禁止**跳过契约门猜接；`unattended` **禁止**干等用户、**禁止**无八维择优或缺审计最小集就开工；`auto_best_require_adr` 且 `needs_adr` 时**禁止**无 ADR 落盘就真接
- **禁止**无真实端点 smoke 工件就宣称某外部依赖已对接 / 已实现 / 可勾选；**禁止**拿本地 mock server 冒充 smoke `[gate: smoke]`

**证据**

- **禁止**验证命令绕过 `evidence-run`；**禁止** `gate-check` FAIL 时合回或宣称 `DONE`；**禁止**删证据工件重跑或修饰 gate 结论 `[gate: batch]`
- **禁止**跳过开工前证据目录门（契约 §0.5）：`.evidence/` 未 ignore 却继续、或已跟踪却不开 `BLOCKED`
- **禁止**无红工件、或红工件退出码为 0，就宣称走过红绿 `[gate: red-green]`
- **禁止**缩小验证范围换绿 `[gate: case-count]`

**并行与抽象**

- **禁止**对仍被阻塞（含共享壳 / RBAC / 状态机语义边）、白名单相交、**有可用 codegraph 却跳过 impact 检测**、或 impact 相交的切片假装并行；**禁止**同波超 `fleet_cap`（默认 20）且无用户预先授权
- **禁止**多页前端批次不先做 S0 壳层片就铺页；**禁止**放任 ≥2 片各自复制同一逻辑而不插 `refactor-shared` 片
- **禁止**派发 go-fast Task/subagent 时传 `model` 或切换到非本会话模型（须省略，继承主会话）

**UI 基准**

- **禁止**写前端时无视已有 `docs/ui/` 另起视觉/壳层体系
- **禁止**无设计锚时自造视觉基准冒充 `docs/ui` 并据此自证合规
- **禁止**派发前端片时不在 implementer-prompt 填「UI 契约」段（读了不传等于没读）；**禁止** UI 契约缺 craft §8 用户向文案禁令（含工程黑话不上屏）却派前端空态/缺参/按钮文案片
- **禁止**跳过 [frontend-ui-contract.md](references/frontend-ui-contract.md) / craft / ui-ux 菜谱另造第三套规矩
- **禁止**已有资源详情一进即满屏可编辑表单（须只读描述 +「编辑」）；**禁止**不声明编辑载体（Dialog/Sheet/独立页）就开做
- **禁止**列表操作列用实心品牌色钮或组内大间距撑开；**禁止**删除等危险操作与编辑同色；**禁止**页内色彩过密（状态/装饰全刷品牌色）
- **禁止**卡片套卡片：内容区外卡再套内卡；**尤其禁止**列表「工具栏外卡 + 表格内描边框」双层表面（craft §6 反例 B）；页头 `title-card` 壳层除外

**项目规则与本地技能**

- **禁止**跳过 [project-context.md](references/project-context.md) 盘点却开工（有 `.cursor/rules` / 仓内 skills 时）
- **禁止**假定 Cursor 已注入 rules 而不下传 implementer「项目红线」段；**禁止**相关项目 skill（如设计系统）存在却不加载、不写入派发提示
- **禁止**用项目 skill/rule 覆盖本 Skill 假绿 / stub / 证据 / 契约不明硬禁
- **禁止**派发时只写「请自行阅读 `.cursor/rules`」而不摘红线/skill 要点

**go-zero / goctl（命中即绝对红线）**

- **禁止**不遵守 goctl 使用规范却改 go-zero API/路由/类型契约
- **禁止**手动修改 goctl 产物 **`types.go`**、**`routes.go`**
- **禁止**对 goctl 产物文件打补丁（含脚本 hotfix）；唯一合法路径是改 `.api`（或官方输入）后 **重新 goctl 生成**（见 [go-zero-goctl.md](references/go-zero-goctl.md)）

**验证纪律**

- **禁止**舰队并发时跑无路径全量 / `pnpm test` / `vitest` watch；片内必须 `vitest run <白名单>`（或仓内等价快路径），合并门只跑本波相关测
- **禁止**合回前跳过集成区相关测；**禁止**三环单轮 Fix 内跑全量（全量只许整环结束；polishing 显式中途全量除外）；单独调用未 `skip_full_test` 时**禁止**跳过收尾全量

**收尾**

- **禁止**合回且验证门绿后仍留本批 worktree / 已并入的片分支 / `integrate_branch` 不清理（用户明示保留除外）；**禁止**合回未成功或验证门红时强删证据 worktree / 分支
- **禁止**`unattended` 合回绿后跳过 code-reviewer；**禁止**已发现落在 `cr_fix_scope` 内的可修 finding 却只出报告不修；**禁止**仍有可修未修时宣称干净 `DONE`
- **禁止** CR 自动修不单独 commit、或修出红测后留脏树不 revert（须回退到合回态并把该项转 `remaining`）
- **禁止**需求来自三环之一却不回写源清单：`summary` 空（有可完成项时）、假绿勾选 PRD/plan、把过抛项标 done 抬分
- **禁止**`orchestrator` 为三环之一时在主会话直接改业务实现树且不派实现 subagent（合法降级须填 `zero_reason`）
