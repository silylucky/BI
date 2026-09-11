---
name: plan-reviewer
description: >
  八维评估技术方案与规划类文档（goal/PRD/arch/plan/ADR/集成简报/设计稿）：长远规划、
  产品体验、生产诚实、架构边界、可靠性、可运维、安全合规、交付可验证；输出评分、
  证据与改造建议。Use when reviewing a technical plan, architecture doc, PRD, roadmap,
  design proposal, ADR set, or when user asks 方案评审 / 计划评分 / 八维评估 / plan review.
---

# Plan Reviewer（八维 · 方案与规划评审）

技术栈无关。评的是**方案/规划类产出是否配得上大型生产系统**，不是替 code-reviewer 扫假绿代码（可交叉引用，但不替代）。

Agent 已会读文档；本 Skill 补：**固定八维刻度**、**每维须证据**、**硬门槛**、**改造建议可执行**、**先报告后改（默认不改文档）**。  
例外：`mode: go-fast-spec-gate` 时对调用方列出的 `docs/specs/**` **自动修 P0**（清硬门槛），仍不改 goal/prd/arch 真理源。

## 何时启用

| 场景 | 动作 |
|------|------|
| 新写/大改 goal、PRD、arch、plan、重大 ADR、集成简报、设计方案 | 八维评分 + 改造清单 |
| 里程碑前「规划能否撑住演化」 | 对 `docs/automate/*` + `docs/arch.md` 联合体检 |
| 用户丢一份方案问「行不行」 | 识别文档类型 → 评分 → 建议 |

**不要**：替代 [code-reviewer](../code-reviewer/SKILL.md) / [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) / [docs-reviewer](../docs-reviewer/SKILL.md) 的代码或文档分类审计；未确认就批量改写真理源；给无证据的「感觉分」。

## 与姊妹 skill

| Skill | 边界 |
|-------|------|
| [create-evolution-*](../create-evolution-goal/SKILL.md) 族 | 人工生成/修订文档；本 Skill **评**其产出是否够格 |
| [code-reviewer](../code-reviewer/SKILL.md) | 评代码假绿/可靠性；方案若鼓励 stub → 本 Skill 在「生产诚实」打穿 |
| [integration-research](../integration-research/SKILL.md) | 外部契约研究；简报可作为本 Skill 输入 |
| [grilling](../grilling/SKILL.md)（含 `mode=with-docs`） | 锐化决策；本 Skill 给结构化分数与改造优先级 |
| [product-blueprint](../product-blueprint/SKILL.md) | 智囊团出蓝图/`docs/specs`（章节映射见其 `spec-map`）；`spec` 成稿后调本 Skill `go-fast-spec-gate`；门失败按最小补丁清单修后再评；规划席刻度与本 Skill 对齐 |
| [requirement-fit](../requirement-fit/SKILL.md) | 外部招标/企业需求 ↔ **代码仓**契合度；本 Skill 只评内部规划文档 |
| [product-reviewer](../product-reviewer/SKILL.md) | 刁钻 PM 评**已上线/可走查产品**；本 Skill 评规划文档质量 |
| [go-fast](../go-fast/SKILL.md) | 落盘 `docs/specs` 后可调用本 Skill `mode: go-fast-spec-gate`：**审规格并自动修 P0**（仅 specs，不动 PRD/arch 真理源） |

## 必读顺序（≤3 次）

1. 本文件「八维」+「刻度」+「硬门槛」+「流程」
2. [references/dimensions.md](references/dimensions.md)（子项与证据）
3. [references/report-template.md](references/report-template.md)

---

## 八维（各 0–100，等权；总分 = 算术平均）

| # | 维度 | 一句话 |
|---|------|--------|
| 1 | **最佳长远规划** | 演进路线、范围收缩与扩展是否清醒，避免把临时态写成终局 |
| 2 | **最佳产品体验** | 用户任务是否闭环；空态/失败/权限/入口是否被方案覆盖 |
| 3 | **最佳生产诚实** | 验收与完成定义是否走真实依赖；禁止 MVP/demo/stub 冒充交付 |
| 4 | **最佳架构边界** | 模块/进程/数据归属是否清晰；缝是否泄漏；关键取舍是否可追溯 |
| 5 | **最佳可靠性** | 失败语义、重试/幂等/降级、一致性是否写清且禁止假成功 |
| 6 | **最佳可运维** | 部署、配置、观测、值班、回滚是否可落地 |
| 7 | **最佳安全合规** | 认证授权、密钥、审计、数据保护、威胁面是否覆盖 |
| 8 | **最佳交付可验证** | 切片可否独立真实验收；依赖序/阻塞是否清楚；指标可否判定 |

子项与打分锚点见 [dimensions.md](references/dimensions.md)。

### 刻度解释（每维）

| 分 | 含义 |
|----|------|
| 90–100 | 可作演化/实施稳定输入 |
| 80–89 | 可用，少量待确认 |
| 70–79 | 能启动，但易在该维漂移 |
| <70 | 建议先改方案再开工 |

**禁止整行同分**：八维不得无差异地打同一个整数（除非文档为空——此时应 BLOCKED，不打分）。

### 硬门槛（一票限制）

出现任一条 → 对应维 ≤40，且**总分上限 69**，不得标「可正式开工」：

- 完成/验收允许 mock、stub、假服务、或「能演示即可」
- 目标态架构依赖占位成功适配器
- 关键用户路径无失败诚实性
- 里程碑以骨架/空壳 API 为可勾选完成项

---

## 流程（必须）

### Phase 0 · Plan Card

| 项 | 内容 |
|----|------|
| 输入 | 路径列表 / 粘贴正文 / issue |
| 类型 | goal / prd / arch / plan / adr / integration-brief / design-doc / mixed |
| 关联 | 是否对照代码或仅评文档 |
| 诉求 | 用户要「只评分」还是「评分+改稿建议」 |
| mode | 默认 `review`；go-fast 调用时为 `go-fast-spec-gate`（见下） |

### Phase 1 · 有界阅读

1. 读齐输入文档；缺上下文时有界读 goal/prd/arch 交叉引用（勿全仓无目的扫）。
2. 若用户要求对照现实：抽检代码锚点/入口是否支持文档宣称（发现假绿 → 记入生产诚实，并提示 code-reviewer）。
3. 每维至少收集 **1 条正面证据或 1 条缺口证据**（引用章节/原句）。

### Phase 2 · 评分

按 [dimensions.md](references/dimensions.md) 打八维 + 总分；列出硬门槛触发项。

### Phase 3 · 改造建议

每条建议须含：

| 字段 | 说明 |
|------|------|
| 维 | 对应八维之一 |
| 优先级 | P0（硬门槛/阻断开工）/ P1（上线或演化前）/ P2（增强） |
| 问题 | 一句话 |
| 建议改法 | 可执行（改哪类句子/补哪节/撤哪条完成定义） |
| 预期提分 | 改完该维大约到多少 |

建议按 P0→P1→P2 排序；同级按对总分影响。

### Phase 4 · 停等确认（默认 mode=`review`）

展示报告（模板见 [report-template.md](references/report-template.md)）。  
**默认不改** goal/prd/arch/plan；用户点名「按建议改」再最小 diff，或交对应 create-evolution-* / 作者。

### mode=`go-fast-spec-gate`（go-fast 规格门 · 可自动改 specs）

由 [go-fast](../go-fast/SKILL.md) 在落盘 `docs/specs/<slug>.md` 后调用。与默认 mode 差异：

1. **输入范围**：仅调用方列出的 `docs/specs/**` 路径（实现规格 ± tickets）。拒绝把 `docs/material/product-reviewer/**` 当主输入。  
2. **流程**：Phase 1–3 → **自动**对输入 specs 做最小 diff：所有 P0 + 为清硬门槛所必需的 P1（生产诚实/可验证交付优先：撤 mock/stub 验收、补真实路径失败语义、补 seam/范围外）。  
3. **禁止自动改**：`docs/automate/**`、`docs/arch.md`、goal/prd 真理源；P2；需产品裁定或外部契约不明的项 → 只写入报告/`blockers`，不猜。  
4. **再评一轮**：改完后对同一 specs 再打一次分（可只记硬门槛是否清除）；仍触硬门槛 → `status: BLOCKED`，`hard_gates_cleared: false`。  
5. **落盘**：评审报告写入 `docs/material/plan-reviewer/<YYYY-MM-DD>-<slug>-spec-gate.md`（可简）；回传 `auto_fixed` 列表。  
6. **不等人确认**（此 mode 下 Phase 4 不停问）；但仍禁止借机扩写全仓规划。

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: plan-reviewer
mode: review | go-fast-spec-gate
inputs:
  - ""
scores:
  long_term: 0
  product_ux: 0
  production_honesty: 0
  architecture: 0
  reliability: 0
  operability: 0
  security: 0
  verifiable_delivery: 0
  total: 0
hard_gates:
  - ""
hard_gates_cleared: true|false   # go-fast-spec-gate 必填
auto_fixed:                      # go-fast-spec-gate；其它 mode 默认 []
  - ""
top_fixes:
  - "P0: …"
artifacts:
  - ""   # 若落盘报告路径
followups:
  - "用户确认后交 create-evolution-* 或作者改稿"
  - "代码假绿嫌疑 → code-reviewer"
```

## 红线

- **禁止**无章节/原句证据的打分
- **禁止**八维全部打成同一分数（非空文档）
- **禁止**把「先 mock 再补真」评成可接受完成策略
- **禁止**未确认批量覆写规划真理源（`go-fast-spec-gate` **仅**可改调用方列出的 `docs/specs/**`）
- **禁止**`go-fast-spec-gate` 自动改 goal/prd/arch/plan 或产品评审报告
- **禁止**用本 Skill 替代安全渗透或完整代码审计
