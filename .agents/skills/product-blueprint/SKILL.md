---
name: product-blueprint
description: >
  深扫仓 + 六席专家智囊团（产品/规划/架构/运维审计/终端用户/领域实践）两阶段评审，
  少问硬决策（默认≤3），产出可贴合真实用户场景与业内惯例的完整业务蓝图、开工规格或
  已有能力蓝图体检——强制架构图+核心业务流程各一图、难回退技术方案/架构选型作硬约束
  （先挂证再锁图；不明则 integration-research 或假设显式化）、确认面先图后文、禁 MVP/demo/stub。
  Use when 业务蓝图 / 流程蓝图 / 对照 PRD 偏航 / 一稿确认 / 专家智囊团出规格 /
  开工规格交 go-fast / 已有模块流程蓝图再评 / product-blueprint / mode=blueprint|spec|audit.
---

# Product Blueprint（智囊团 · 业务蓝图 / 开工规格 / 现状体检）

解决两类痛点：**grilling 问太多**与 **少问却偏离真实场景/业内惯例**。

本 Skill：**深扫仓 → 难回退选型登记 →（极少硬决策）→ 提纲 → 六席两阶段（独立 Task，禁演戏）→ 精简确认面 → 落盘成稿**。  
默认**不改代码**；确认后停；修订按 [revision.md](references/revision.md) 分级。

**选型姿态**：技术方案 / 架构选型是流程与边界的**参考硬约束**（路错难纠、易留债务），不是成稿后补丁；本 Skill 做识别与门禁，多候选八维择优 + smoke 仍交 [integration-research](../integration-research/SKILL.md)。

## 何时启用

| 场景 | mode |
|------|------|
| 新功能/流程一稿确认；对照 PRD 分片查偏航 | `blueprint`（默认） |
| 已对齐意图，要可开工的 `docs/specs` | `spec` |
| 已有功能/模块/流程蓝图级再评 | `audit` |

**不要**：替代 [grilling](../grilling/SKILL.md) 纯决策追问；替代 [product-reviewer](../product-reviewer/SKILL.md) 八维打分；替代 [go-fast](../go-fast/SKILL.md) 写代码；未确认就改 PRD/开工。

## 与姊妹 skill

| Skill | 关系 |
|-------|------|
| [grilling](../grilling/SKILL.md) | 硬决策「一次一问」；本 Skill **配额封顶**，其余进假设 |
| [plan-reviewer](../plan-reviewer/SKILL.md) | 规划席刻度；`spec` 后 `go-fast-spec-gate` |
| [product-reviewer](../product-reviewer/SKILL.md) | 产品席刻度；打分仍走该 skill；`audit` 可接力 |
| [create-evolution-prd](../create-evolution-prd/SKILL.md) | 确认后可选回写；**默认不改** PRD |
| [go-fast](../go-fast/SKILL.md) | `spec` 门过后交接；**不自动**调用；流程叙事不清时应先回本 Skill |
| [integration-research](../integration-research/SKILL.md) | 外部契约 / 难回退多方案不明；简报进证据袋后才锁依赖图；**禁止**蓝图内编造协议或伪选型 |
| [create-ui-docs](../create-ui-docs/SKILL.md) | 有前端读 `docs/ui`；页面说明引用菜谱，禁重发明壳、禁套卡 |

## 必读顺序

1. 本文件「三 mode」+「提问配额」+「选型门禁」+「F 预算」+「确认面」+「流程」+「红线」
2. [selection-gate.md](references/selection-gate.md) + [council.md](references/council.md) + [seat-prompts.md](references/seat-prompts.md) + [diagrams.md](references/diagrams.md)
3. 落盘：[outline-template.md](references/outline-template.md) + [blueprint-template.md](references/blueprint-template.md)；[self-check.md](references/self-check.md)；[evidence-bag.md](references/evidence-bag.md)；[revision.md](references/revision.md)；[spec-map.md](references/spec-map.md)；校准 [example-mini.md](references/example-mini.md)；解析 [parse.md](references/parse.md)

---

## 三 mode

| mode | 输入 | 主产物 | 写边界 |
|------|------|--------|--------|
| **`blueprint`** | 意图 ± PRD ± 仓 | `docs/material/blueprints/<YYYY-MM-DD>-<slug>.md` | 偏航表只建议；点名才回写 |
| **`spec`** | 已对齐 / 已确认蓝图 | `docs/specs/<slug>.md` | 映射 [spec-map.md](references/spec-map.md)；过规格门；确认后停 |
| **`audit`** | 已有模块/流程 | `…-audit.md` | as-is 图 + 缺口 P0/P1/P2；**不改**代码/PRD |

路由：[parse.md](references/parse.md)。

---

## 提问配额

| 规则 | 说明 |
|------|------|
| 默认 | 硬决策 ≤ `max_questions`（默认 3），一次一问 + 推荐答案 |
| 硬决策 | 难回退 ∧ 仓内无锚点 ∧（改主流程/权责/数据归属/**难回退技术方案或架构选型**/是否跟随业内基线） |
| 配额优先 | 先问 `selection_constraints.action=ask`，再问其余硬决策；可逆 UI 不得挤占 |
| 其余 | 「假设」清单（带证据袋依据）；**不得**写成已裁定 |
| 禁止 | 文案/可逆 UI 逐条追问；一次多问 |

`max_questions=0`：零问先稿；未锚选型一律 `assumed`/`open` 门禁，不得装已裁定。`domain_strength=weak` 或存在 `open` 难回退选型时，无人值守不得伪 `DONE`。

---

## 难回退选型门禁（强制）

完整状态机与登记字段见 [selection-gate.md](references/selection-gate.md)。摘要：

| 规则 | 说明 |
|------|------|
| **先证后图** | Phase 1 登记 `selection_constraints`；**先更新选型状态，再定稿依赖它的架构图/核心 F** |
| **挂证** | `anchored`（ADR/arch）或 `researched`（integration-research 简报）；契约/多方案不明 → 调调研，禁蓝图内编造 |
| **未决显式** | 配额不足 → `assumed` 进假设并标「难回退选型」；`open` 不得写入已定主路径 |
| **状态后果** | 任一 `open` → 最多 `DONE_WITH_CONCERNS` / `BLOCKED`；`assumed` 须确认面醒目，未整包接受不得当已裁定交 spec/go-fast |

---

## 核心 F 预算与确认面（强制）

| 规则 | 说明 |
|------|------|
| **核心 F ≤5** | 确认面必须附图的独立主业务闭环 ≤5；超出进**附录**（落盘可写，确认面不展开） |
| **确认面 ≠ 成稿** | 对话只贴下方 Phase 5 精简项 + 成稿路径；**禁止**把完整成稿墙贴进聊天 |
| **先图后文** | JTBD → 架构图 → 各核心 F 图 → … |

---

## 生产姿态（强制）

| 禁止 | 要求 |
|------|------|
| MVP / demo / stub 验收 | 主路径 + 例外 + 权限 + 审计 + 真实依赖 |
| 无业内/场景锚点的实验室流程 | 场景对照表 + 领域席；依据写 E# |
| 先画流程再补选型 / 把未决底座写成已定 | 选型门禁 + 假设显式；简报/ADR 进证据袋 |
| 只丢长文无图 | 架构图 + 每核心 F 一流程图 |
| 一人分饰六席 | 独立 Task；见 council / seat-prompts |
| 重发明 UI 壳 | 有 `docs/ui` 则引用菜谱/锚 |

---

## 流程（必须）

### Phase 0 · Card

| 项 | 内容 |
|----|------|
| mode / scope / `max_questions` | 默认 3 |
| PRD 锚 / attendance | 无人值守：假设全收；弱证据或 `open` 选型 → `DONE_WITH_CONCERNS` |
| 缩席 | 仅小 scope，见 council；有新难回退选型时 **不可** 标 architecture=`N/A` |

亮一行：`product-blueprint | mode=… | scope=… | max_q=… | prd=…|none | domain=strong|mixed|weak | sel=anchored|mixed|open`

### Phase 1 · 深扫仓 → 证据袋

有界读取（按 scope）：

1. arch / goal / 相关 PRD / **已有 ADR（选型锚）**  
2. `docs/ui/`（有前端）+ 路由/页  
3. API/domain/ADR、已有 specs、`docs/integrations/` 简报  
4. 代码锚抽检（外部适配器、中间件接线）  
5. 领域文档；不足则公开惯例检索（注明来源）  
6. **登记 `selection_constraints`**（见 [selection-gate.md](references/selection-gate.md)）；外部契约/多方案 `open` → 调 [integration-research](../integration-research/SKILL.md)，简报路径写入证据袋后再锁依赖图

产出：[evidence-bag.md](references/evidence-bag.md)（长跑建议落盘 `…-evidence.md`）。

### Phase 2 · 硬决策（若有）

仅配额内；**优先**难回退选型（`action=ask`）；问尽 → 提纲。  
调研中（`action=research`）未回简报 → 不把该底座画成已定；可暂停升人/交接调研或降为 `assumed`。

### Phase 3 · 提纲 + 智囊团①

1. [outline-template.md](references/outline-template.md)（含**选型约束表**、架构图、核心 F≤5 流程图、场景表、术语表、假设）。  
2. 按 [seat-prompts.md](references/seat-prompts.md) **并行独立 Task** 六席（或合法缩席）→ 合并。  
3. 否决未消 → 改提纲再投（最多再一轮）或升人；僵持 → `BLOCKED` / `DONE_WITH_CONCERNS`。

### Phase 4 · 成稿 + 智囊团②（增量）

1. 扩成 [blueprint-template.md](references/blueprint-template.md)；`spec` 按 [spec-map.md](references/spec-map.md)。图与正文一致。  
2. **增量复评**（默认 product+plan；变更触及再加派）——见 [council.md](references/council.md)。  
3. 合并后跑 [self-check.md](references/self-check.md)；全过才进确认面。

### Phase 5 · 一稿确认面（精简 · 停等用户）

**只展示**（参照 [example-mini.md](references/example-mini.md)）：

1. JTBD + 成功 / 最贵失败  
2. **架构关系图**  
3. **各核心 F 流程图**（≤5；附录仅一行目录可不贴图）  
4. 场景对照表（可缩为要点，全文在成稿）  
5. **难回退选型状态**（S#：anchored / researched / assumed；`open` 不得请确认）  
6. **假设清单**（醒目；含未裁定选型）  
7. 智囊团 vote 一行摘要  
8. `blueprint`+PRD：偏航表要点；`audit`：P0/P1 要点  
9. 成稿路径 + 下一步交接（停：不自动 go-fast / 不改 PRD；待调研则 handoff integration-research）

逐步说明、页面字段表、完整审计清单 → **仅落盘稿**。

**缺图、选型门禁未过或 self-check 未过 → 不得「请确认」**。  
用户改意见 → [revision.md](references/revision.md)（L0～L3）。

### Phase 6 · 落盘与交接

| mode | 动作 |
|------|------|
| blueprint | 写 blueprints；偏航建议；默认不改 PRD |
| spec | 写 specs → `go-fast-spec-gate` → 提示可 go-fast，**不自动开**；门失败按 spec-map 最小补丁 |
| audit | 写 audit；缺口表；建议接力 product-reviewer / 纠正 blueprint |

点名回写 PRD → 最小 diff（验收/流程），禁发明无证据功能域。

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: product-blueprint
mode: blueprint | spec | audit
scope: ""
max_questions: 3
questions_asked: 0
domain_strength: strong | mixed | weak
evidence_ref: ""          # 证据袋路径或 inline
selection_gate:
  ok: true|false
  constraints: []         # [{id, topic, status, action}]
  open_count: 0
  assumed_count: 0
council:
  outline_pass: true|false
  draft_pass: true|false
  theater_ok: true        # 独立 Task；false=违规
  vetoes: []
  seats: {}
  skipped: {}             # draft 轮未派席及理由
assumptions: []
core_flows: []            # F1… ≤5
appendix_flows: []
prd_drift: []
gaps: []                  # audit
artifact: ""
confirm_surface: slim     # 必须 slim
spec_gate:
  ran: false
  hard_gates_cleared: false
  patch_list: []          # 门失败时
handoffs: []              # 含 integration-research 若有
followups: []
revision: null            # 若在修订：{ level: L0|L1|L2|L3, note: "" }
```

## 红线

- **禁止**超配额追问非硬决策；**禁止**一次多问  
- **禁止**跳过智囊团两阶段；**禁止**一人分饰六席假投票  
- **禁止**无场景对照表 / 领域席未发言就宣称提纲通过  
- **禁止**无架构图或核心 F 缺流程图就「请确认」；**禁止**核心 F>5 未进附录  
- **禁止**确认面墙贴完整成稿（须 slim）  
- **禁止**图文主路径不一致；节点用内部包名/表名当主标签  
- **禁止** MVP/demo/stub 验收；实验室流程无锚点且不标偏离  
- **禁止**未确认改 PRD / 开 go-fast / 改业务代码  
- **禁止** `audit` 冒充八维打分；**禁止** `spec` 跳过规格门宣称可交 go-fast  
- **禁止**把假设写成已裁定；**禁止** `domain_strength=weak` 或存在 `open` 难回退选型时无人值守伪 `DONE`  
- **禁止**先画依赖图再补选型；**禁止**把 `open`/`assumed` 底座写成已定事实；**禁止**契约不明却不调 integration-research 却编造协议细节  
- **禁止**有 `docs/ui` 仍重发明整壳；页面说明外卡套表  

## 附加资源

- [references/parse.md](references/parse.md)
- [references/selection-gate.md](references/selection-gate.md)
- [references/council.md](references/council.md)
- [references/seat-prompts.md](references/seat-prompts.md)
- [references/diagrams.md](references/diagrams.md)
- [references/evidence-bag.md](references/evidence-bag.md)
- [references/self-check.md](references/self-check.md)
- [references/revision.md](references/revision.md)
- [references/spec-map.md](references/spec-map.md)
- [references/example-mini.md](references/example-mini.md)
- [references/outline-template.md](references/outline-template.md)
- [references/blueprint-template.md](references/blueprint-template.md)
