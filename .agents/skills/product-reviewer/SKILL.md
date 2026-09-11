---
name: product-reviewer
description: >
  Use when the user wants a sharp/critical product review of a business system, workflow,
  module, or page — 刁钻产品评审、产品挑刺、业务流程评估、模块产品体检、页面产品向评审、
  多维产品打分、改进建议与改造方案、站在刁钻产品经理角度审业务系统；也覆盖体验依赖的
  能力缺口（capability_gap）发现与 PRD/蓝图交接（本 skill 不改 PRD、不发明功能落地）.
---

# Product Reviewer（刁钻产品视角 · 多维评审）

技术栈无关。以**刁钻产品经理**视角评审业务系统 / 业务流程 / 模块 / 页面：盯任务价值、闭环、权责、例外、信任与可运营，输出**带证据的评分、改进建议与可执行方案**。默认先报告，**不改代码/PRD**。

Agent 已会读页面与流程；本 Skill 补：**固定八维刁钻刻度**、**四级评审对象**、**反「功能堆砌」与反「演示友好」**、**每条建议须有产品方案不是视觉抛光清单**、**刺点三分类（体验债 / 能力缺口 / 范围外）与 PRD 交接字段**。

## 何时启用

| 场景 | 动作 |
|------|------|
| 审一整套业务系统的产品成色 | 定主任务与角色 → 抽主流程深挖 → 八维 + 改造方案 |
| 审一条业务流程（端到端） | 按步骤拆状态机/交接 → 例外与权责打穿 |
| 审一个业务模块 | 模块边界内的任务包、入口、与邻域裂缝 |
| 审一个或一组页面 | 页级任务是否成立；勿退化成纯 UI 像素扫 |
| 「站在刁钻 PM 角度挑刺」 | 全套八维；可只要 P0 刺点短版 |

**不要**：替代 [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) 的全路由视觉/菜谱毕业扫；替代 [code-reviewer](../code-reviewer/SKILL.md) 假绿深审；替代 [grilling](../grilling/SKILL.md) 的交互式追问（本 Skill **出结论报告**，不是一次一问）；替代 [requirement-fit](../requirement-fit/SKILL.md) 的招标对标；未确认就大改 IA/RBAC 模型。

## 与姊妹 skill

| Skill | 边界 |
|-------|------|
| [grilling](../grilling/SKILL.md) | 对人/决策**追问**；本 Skill 对系统**下结论+方案** |
| [product-blueprint](../product-blueprint/SKILL.md) | 智囊团**业务叙事/业内对照/一稿确认**（`blueprint`/`spec`/`audit`；图强制、确认面 slim）；本 Skill 管**八维打分+刺点**。`audit` 可先出蓝图体检（缺口 P0/P1/P2）再接力本 Skill 打分；**禁止**用蓝图 audit 冒充本 Skill 报告 |
| [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) | 壳/菜谱/反模式/可毕业；本 Skill 可引用其 finding，但主评**业务产品逻辑** |
| [plan-reviewer](../plan-reviewer/SKILL.md) | 评规划文档；本 Skill 评**已存在或可走查的产品行为** |
| [requirement-fit](../requirement-fit/SKILL.md) | 外部条款契合；本 Skill 不依赖招标文件，评产品自身是否「站得住」 |
| [create-evolution-prd](../create-evolution-prd/SKILL.md) / [go-fast](../go-fast/SKILL.md) | `capability_gap` 确认后扩写 PRD；再 go-fast / `loop-goal-prd` 落地。本 Skill **只提案、不改 PRD** |
| [loop-goal-product](../loop-goal-product/SKILL.md) | 本 Skill + go-fast 多轮冲产品分；须 `mode: loop-lane`；**Fix 默认剔除** `capability_gap`（交 PRD）；契约不明跟 go-fast / 编排契约 §2 |
| [loop-goal-prd](../loop-goal-prd/SKILL.md) | 按 plan/PRD+arch 用 go-fast 冲里程碑实现；消费已回写的能力缺口，**非**本 Skill 直接发明里程碑 |
| [loop-polishing](../loop-polishing/SKILL.md) | 多维（含本 Skill）持续打磨；本 Skill 作 `product`/`flow` lane；**必须** `mode: loop-lane`；同样剔除 `capability_gap` |
| [scenario-playbook](../scenario-playbook/SKILL.md) / [browser-reviewer](../browser-reviewer/SKILL.md) | 需要真机剧本/截图证据时可接力 |

## 必读顺序（≤3 次）

1. 本文件「评审对象」+「八维」+「硬门槛」+「刺点分类」+「流程」+「红线」
2. [references/dimensions.md](references/dimensions.md) + [references/scan-workflow.md](references/scan-workflow.md) + [references/capability-gap.md](references/capability-gap.md)
3. 输出时 [references/report-template.md](references/report-template.md)

---

## 评审对象（四级 · 先定一级）

| 级别 | 典型输入 | 深挖重点 |
|------|----------|----------|
| `system` | 整仓 / 产品名 | 主任务地图、角色、跨模块裂缝、全局信任 |
| `flow` | 「从 A 到 B 的流程」 | 步骤、状态、交接、回滚、审计点 |
| `module` | 菜单域 / 服务域 | 任务包是否内聚、入口、与邻域重复或断裂 |
| `page` | 路由或页面文件 | 本页主任务、决策点、与上下游页是否打架 |

用户未指定时：有明确路由/文件 → `page` 或 `module`；有「流程/怎么完成 X」→ `flow`；否则问一句或默认 `module`（当前最活跃域）。

---

## 八维（各 0–100，等权；总分 = 算术平均）

| # | 维度 | 刁钻一问 |
|---|------|----------|
| 1 | **任务价值** | 用户真正要完成的工作是什么？系统是在帮完成，还是在逼填表？ |
| 2 | **主路径锋利** | 最常见成功路径是否短、稳、少岔路？有没有「为了完整而啰嗦」？ |
| 3 | **例外与逆操作** | 驳回、撤销、部分失败、并发、过期、误操作恢复是否可交代？ |
| 4 | **角色与权责** | 谁发起、谁审批、谁背锅？权限模型是否匹配真实组织而非开发角色？ |
| 5 | **认知与决策点** | 名词、状态、下一步是否一眼可懂？关键决策是否被藏进二级页或行内？ |
| 6 | **状态与信任** | 列表/详情/外部世界是否一致？有无假进度、假成功、说不清的「处理中」？ |
| 7 | **可发现与采用** | 新人/空租户/首次配置能否上路？能力是否藏死在配置里？ |
| 8 | **可运营与可度量** | 出了问题谁能发现？有没有可行动的队列/指标/审计，而不只是好看仪表盘？ |

子项见 [dimensions.md](references/dimensions.md)。

### 刻度（每维）

| 分 | 含义 |
|----|------|
| 90–100 | 刁钻用户也难立刻打穿；可作标杆 |
| 80–89 | 能用，有少量刺点 |
| 70–79 | 演示尚可，真实业务易卡 |
| <70 | 该维产品债重，建议先改再铺功能 |

**禁止整行同分**（无有效对象 → `BLOCKED`）。

### 独立客观评分（强制）

每次评审（含修复后再评、loop-goal-product 第 N 轮）须对**当前可观察产品**重新取证打分：

| 要求 | 说明 |
|------|------|
| 不锚定历史分 | **禁止**读旧报告总分/各维分后微调；禁止「上次 78、修了一点 → 这次至少 80」 |
| 可为降分 | 修 A 暴露 B、回归、范围收窄后主路径变差 → **允许且应当降分**；降分不是失败叙事 |
| 历史报告用途 | 仅可对照刺点 ID / 处理清单状态（open/done），**不得**当评分基线 |
| 证据优先 | 只根据本轮入口、主路径、例外、权责、状态一致性等证据打分 |

报告可附一行「较上轮 Δ（可选）」供编排参考，但该 Δ **事后计算**，不得反向驱动本轮给分。

### 硬门槛（一票限制）

出现任一条 → 相关维 ≤40，且**总分上限 69**，结论不得写「产品已就绪/可规模化推广」：

- 主任务无入口或入口到达假页面/半成品
- 成功反馈与真实结果不一致（假成功 / 假 KPI）
- 关键写操作不可逆且无确认/无审计（条款或业务高风险时）
- 流程依赖「懂内部约定的人」才能走完，产品内无引导与状态
- 权限「能点但不能成」或「不能点但数据已暴露」且无诚实表面

**硬门槛必须挂刺点 ID**：每条命中的硬门槛在报告「硬门槛」节写清对应 `B-*`（可一对多）；处理清单该行 `硬门槛=是`。无对应刺点 → 先补刺点再勾硬门槛，禁止「只有硬门槛勾选、清单无行」。

### 刺点分类（每条必标 · 交接用）

细则与反例：[capability-gap.md](references/capability-gap.md)。摘要：

| 分类 | 何时 | 冲分 Fix | 交接 |
|------|------|----------|------|
| `experience_fix` | 现有（半）能力改好即可 | **可进** | 本环 / go-fast |
| `capability_gap` | 体验/主路径**依赖**但尚未有的最小能力项 | **默认剔除** | `create-evolution-prd`（`hinted_by_surface=否` 的新域 → blueprint） |
| `out_of_scope` | 超出本评审 scope 的新域/新角色/新厂商 | 剔除 | blueprint / 人工扩 scope |

每条 `capability_gap` 须填：`depends_on_dim` / `blocked_step` / `min_capability` / `prd_hint` / `hinted_by_surface` / `suggested_handoff`。  
**发现缺口 ≠ 加分**；八维只评当前可观察产品。  
**禁止**把愿望清单、招标对标、无证据「业界都该有」标成 `capability_gap`。

---

## 流程（必须）

### Phase 0 · Review Card

| 项 | 内容 |
|----|------|
| 对象级别 | system / flow / module / page |
| 范围 | 路由、模块名、流程一句话、或「整产品」 |
| 角色假设 | 至少 1 个主角色 + 可选审批/审计角色（未知则标待确认） |
| 证据源 | 代码走查 / 文档 / 真机（有 `.dev`+剧本时可接力 browser） |
| 诉求 | 全量八维 / 只要 P0 刺点 / 要改造方案深度 |
| 轮次 | 首轮或再评 `rN`（见「再评」） |
| mode | 默认 `review`；经 loop 编排时为 `loop-lane`（见下） |

### Phase 1 · 定主任务

用 3～5 句话写清：

1. **主 JTBD**（谁在什么情境下要完成什么）  
2. **成功长什么样**（业务结果，不是「页面打开了」）  
3. **最贵失败**（做错/做不成的业务代价）

找不到主任务 → 维 1 重扣，并优先建议收缩范围或重做信息架构，勿用功能列表冒充产品。

### Phase 2 · 有界取证

按 [scan-workflow.md](references/scan-workflow.md) 取证：入口 → 主路径 → 例外 → 权限 → 状态一致性。  
每维至少 1 条**可定位**证据（路由/文案/状态/API/文档节）。  
刺点「证据」列须含**可解析路径**（路由、页面/组件文件、API 路径等，供 go-fast 白名单粗估）；纯散文无路径 → 补扫后再写刺点。

**穷尽盘点（反抽样）**：主路径 + 刁钻用例里触发的失败**全部**成刺点，禁止「挑几个典型 P0」交差。同构问题（多页/多角色同病）→ **默认各成一条**，或一条 + **完整实例表**（禁止「等 N 处」）。目标一次列出尽可能多可修 `experience_fix` 供冲分/打磨——**多多益善（有证据，禁注水）**。合并后若 Blind spot 空且 P0+P1 刺点 **< 8**（page 级 **< 5**）→ 二次取证或总览写「穷尽自检：二次 sweep 无新增」。

### Phase 3 · 评分与刺点

打八维 + 总分；列出硬门槛（挂 ID）。  
**先取证再给分**；未读完本轮证据前不要打开旧报告的分数表。若需对齐处理清单，只读 ID/状态/硬门槛/视觉债列，跳过旧「八维/总分」。  
刺点格式：`刺点` = 现象 + 刁钻解读（用户会怎么骂）+ 证据（含路径）。  
每条刺点在处理清单标注：`硬门槛` 是/否；`视觉债` 是/否（纯抛光、不改任务/流程/权责/状态机 → 是；产品逻辑刺 → 否）；**`分类`** = `experience_fix` \| `capability_gap` \| `out_of_scope`。  
优先级只决定排序与 Fix 先后，**禁止**据此截断刺点清单。

主路径/例外卡在「系统没有这一步」时：优先按 [capability-gap.md](references/capability-gap.md) 判 `capability_gap`，勿写成含糊的「体验不好」。

### Phase 4 · 改进建议与方案

每条建议须含：

| 字段 | 说明 |
|------|------|
| 维 | 八维之一 |
| 优先级 | P0（打穿主任务/信任）/ P1（真实业务前）/ P2（锐度/采用） |
| 分类 | `experience_fix` / `capability_gap` / `out_of_scope` |
| 刺点 | 一句话 |
| 产品改法 | **`experience_fix`**：改任务/流程/信息/权责/状态机。**`capability_gap`**：写 `min_capability` + 验收，**不要**假装本环已实现 |
| 方案切片 | 可验收的第一刀（用户可感知的变化）；缺口类写「PRD 落地后的第一刀」 |
| 证据路径 | 实现时优先改动的路由/文件/API（给拆单白名单）；纯缺口可写「无实现锚点 · 建议入口」 |
| 不做 | 防借机重构全世界 / 防借缺口堆菜单 |
| 预期提分 | 该维大约到多少（缺口类：写「PRD 落地并实现后」的预期，标明前提） |

`视觉债=是` 的项：方案可一行指向 ui-ux-reviewer，**不要**写成 go-fast 产品改造主线。  
`capability_gap` / `out_of_scope`：方案指向 PRD/蓝图交接，**不要**写成本环 go-fast 主线。  
完整方案包章节见 [report-template.md](references/report-template.md)。报告须含 **「体验依赖能力清单」**（可空表）：汇总全部 `capability_gap` 行。

### Phase 5 · 落盘（交付）

1. **自动落盘**（默认，不必等用户点名）：写入  
   `docs/material/product-reviewer/<YYYY-MM-DD>-<slug>.md`  
   或再评：`…/<YYYY-MM-DD>-<slug>-r<N>.md`（`N≥2`；首轮可省略 `-r1` 或显式 `-r1`）  
   （目录不存在则创建；`slug` = 范围短名，如 `cmdb-audit` / `order-flow`）  
2. 报告须含 **「处理清单（修复回写）」**（见模板）：与刺点 ID 对齐；含 `硬门槛` / `视觉债` / **`分类`** 列；有缺口则含 **「体验依赖能力清单」**。  
3. 对话展示报告摘要 + **落盘绝对路径**；回传 `artifacts` 填该路径；`capability_gaps` 填缺口 ID 列表（可空）。  
4. **本 Skill 仍默认不改代码/PRD**。落盘即本 Skill 交付完毕。  
   - **单独调用**（`mode: review`）：可停问用户是否采纳 / 是否把 `capability_gap` 写入 PRD / 是否开工（「下一步」清单）。  
   - **`mode: loop-lane`**（经 [loop-goal-product](../loop-goal-product/SKILL.md) 或 [loop-polishing](../loop-polishing/SKILL.md)）：落盘后**不要**等人确认；编排方对 `experience_fix` 进 Fix，对 `capability_gap`/`out_of_scope` **剔除并记 followups**（不在本 Skill 内扩 PRD）。  
   - 修复方（go-fast / loop / 人工）**必须回写本轮源报告**的处理清单（同一文件路径），勿只聊不落盘。

用户明确说「勿落盘 / 只聊」→ 可跳过写文件，并在回传注明。

### mode=`loop-lane`（loop 编排 · 只评不修）

| 项 | 规则 |
|----|------|
| 触发 | 调用方明示 `mode: loop-lane`（或 orchestrator 为 loop-goal-product / loop-polishing） |
| 流程 | Phase 0–5 全跑（含再评继承）；落盘后**结束本 Skill** |
| 禁止 | 停等用户确认；改代码/PRD；进入 go-fast |
| 回传 | `mode: loop-lane`；`fix_mode: none`；处理清单供编排方选批 |

与 code/ui/arch 的 `loop-lane` **同名同义**：只评落盘、不等人、不改业务树。

### 再评（loop-goal-product 第 N 轮或用户要求复评）

1. **同 scope / scope_level**；文件名加 `-r<N>`，**禁止**覆盖上轮报告文件。  
2. **继承处理清单**：从上一份报告拷贝全部刺点 ID 行（优先级、硬门槛、视觉债、**分类**、状态、改动摘要等）；本轮只允许：  
   - 独立重打八维/总分（不读旧分表）  
   - 将已修且本轮取证确认的 `done` → `verified`；回归未达预期 → 改回 `open`  
   - 新增刺点用新 ID（`B-<续号>`），状态 `open`，并标分类  
   - 上轮 `open`/`deferred` 且本轮仍成立 → 保持状态（可改现象/证据/`prd_hint`）；误分类可改（须在改动摘要注明）  
   - 上轮 `capability_gap` 若已写入 PRD 并实现 → 本轮取证后可改为 `experience_fix` 再验，或 `verified`  
3. **禁止**再评时把上轮清单清空重写成全 `open`（除非首轮无上份报告）。  
4. Fix 回写目标 = **发起本轮 Fix 时的源报告路径**（通常为上一份 `-rN`）；再评产出的新文件不替代该回写义务。

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: product-reviewer
mode: review | loop-lane
fix_mode: confirm | none
scope_level: system | flow | module | page
scope: ""
round: 1                    # 再评为 2..N
report_slug: ""             # 含 -rN（若有）
scores:
  job_value: 0
  primary_path: 0
  exceptions: 0
  roles_accountability: 0
  cognition: 0
  state_trust: 0
  discoverability: 0
  operability: 0
  total: 0
hard_gates:                 # 每项挂 barb_id
  - barb_id: B-1
    gate: ""
top_barbs:
  - "P0: …"
capability_gaps:            # 可 []；ID 列表
  - B-3
verdict: "可推广 | 小改后可用 | 主任务未立住 | 勿扩功能先还债"
artifacts:
  - "docs/material/product-reviewer/<YYYY-MM-DD>-<slug>[-rN].md"
followups:
  - "create-evolution-prd（capability_gap） / product-blueprint / ui-ux-reviewer / go-fast / loop-goal-product"
```

## 红线

- **禁止**无证据的「体验不好」「不直观」空话（必须落到路径/文案/状态）
- **禁止**八维同分灌水
- **禁止**受历史落盘评分锚定（上轮分、目标分、ledger 曲线）而抬分/护分；修复后再评**可以降分**
- **禁止**把视觉抛光清单冒充产品方案（改圆角 ≠ 改任务）；视觉债须标 `视觉债=是`
- **禁止**硬门槛命中却不挂刺点 ID / 处理清单不标 `硬门槛=是`
- **禁止**刺点缺 `分类`；**禁止**把愿望清单 / 无主路径依赖的新域标成 `capability_gap`
- **禁止**因列出 `capability_gap` 而抬八维分；发现缺口只作交接，不作加分
- **禁止**本 Skill 擅自改 PRD / 发明功能落地；缺口只提案
- **禁止**用功能完成度替代任务价值（「有 20 个菜单」不是高分理由）
- **禁止**把假成功/演示脚本评成状态诚实高分
- **禁止**未确认实施大爆炸重构；方案须可切片
- **禁止**报告只贴在对话、默认跳过落盘（用户明示「勿落盘」除外）
- **禁止**落盘报告缺少「处理清单」表（与刺点 ID 对齐，含硬门槛/视觉债/**分类**列）
- **禁止**有 `capability_gap` 却缺「体验依赖能力清单」节（可注明 0 条）
- **禁止**再评覆盖上轮文件，或清空继承清单导致 ID 链断裂
- **禁止**`loop-lane` 下停等确认或改代码/PRD
- **禁止**抽样汇报：只交 Top N 刺点 / 「等 N 处」省略证据；未做穷尽自检却交极少 P0+P1
