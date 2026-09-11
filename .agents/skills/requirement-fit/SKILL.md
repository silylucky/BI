---
name: requirement-fit
description: >
  Use when the user provides a tender/bid packet, RFP, must-have checklist, or enterprise
  requirements to benchmark against an existing codebase — 应标对标、招标评分、政企需求差距、
  企业需求契合度、能力匹配、缺功能方案、多维改造建议、完整应标/差距方案.
---

# Requirement Fit（需求/应标 · 仓内能力对标）

技术栈无关。把**外部需求真理源**（招标文件、应标条款、企业 RFP、必须完成清单）与**当前仓库事实**对照：匹配已有能力、评产品体验与可交付性、对缺口给可执行方案；**默认先报告，不改业务代码**。

Agent 已会读代码与文档；本 Skill 补：**需求条目化**、**匹配态枚举（须证据）**、**固定八维**、**必须项硬门槛**、**缺功能诚实方案**、**完整方案包**。

## 何时启用

| 场景 | 动作 |
|------|------|
| 政企招标 / 应标，对照现有系统 | 条目矩阵 + 八维评分 + 改造/应标方案 |
| 企业需求 / RFP，对照现有系统 | 同上（合规维按条款权重调整） |
| 需求中有系统尚不存在的功能 | 标 `MISSING`，给缺口方案（不做假「已有」） |
| 用户只要「能不能应标 / 差多少」 | 矩阵 + 总分 + P0 清单；完整方案可精简 |

**不要**：替代 [plan-reviewer](../plan-reviewer/SKILL.md) 评内部 goal/PRD 文笔；替代 [code-reviewer](../code-reviewer/SKILL.md) 假绿深审；把 stub/演示当「已满足必须项」；未确认就按方案改仓或伪造应标材料。

## 与姊妹 skill

| Skill | 边界 |
|-------|------|
| [plan-reviewer](../plan-reviewer/SKILL.md) | 评**内部规划文档**质量；本 Skill 评**外部需求 ↔ 代码/产品**契合 |
| [code-reviewer](../code-reviewer/SKILL.md) | 假绿/可靠性深审；本 Skill 发现 stub 冒充满足 → 记入证据并提示接力 |
| [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) | 上线前 UI 毕业扫；本 Skill「产品体验」维可引用其结论，不替代全路由扫 |
| [integration-research](../integration-research/SKILL.md) | 外部协议/厂商缺口 → 出集成简报后再回填本报告改造项 |
| [create-evolution-prd](../create-evolution-prd/SKILL.md) / [create-evolution-plan](../create-evolution-plan/SKILL.md) | 用户确认改造范围后，再写/改 PRD 与里程碑 |
| [product-whitepaper-ppt](../product-whitepaper-ppt/SKILL.md) | 宣传白皮书；**禁止**把对标缺口粉饰成已具备能力 |
| [product-reviewer](../product-reviewer/SKILL.md) | 刁钻 PM 评产品自身成色；本 Skill 评**外部需求 ↔ 仓**契合 |

## 必读顺序（≤3 次）

1. 本文件「匹配态」+「八维」+「硬门槛」+「流程」+「红线」
2. [references/dimensions.md](references/dimensions.md) + [references/scan-workflow.md](references/scan-workflow.md)
3. 输出时 [references/report-template.md](references/report-template.md)

---

## 匹配态（每条需求必须标一种）

| 态 | 含义 | 证据要求 |
|----|------|----------|
| `FULL` | 已具备且可真实验收 | 代码/路由/API/配置锚点 + 可走通路径说明 |
| `PARTIAL` | 有骨架或部分路径，缺关键闭环 | 已有锚点 + **明确缺口** |
| `MISSING` | 仓内无合理对应能力 | 搜索范围说明（扫过哪些入口仍无） |
| `PROXY` | 近邻能力可改造成满足 | 近邻锚点 + 改造要点（非「已满足」） |
| `UNKNOWN` | 需求含糊或仓内证据不足 | 待确认问题；**不得**当 FULL |
| `N/A` | 超出产品边界或用户裁定不做 | 写明依据 |

**禁止**：无锚点标 `FULL`；仅有 UI 壳/假数据标 `FULL`；把 `PROXY`/`PARTIAL` 写成应标「已完全满足」。

---

## 八维（各 0–100；总分见下）

| # | 维度 | 一句话 |
|---|------|--------|
| 1 | **功能覆盖** | 必须项与评分项被 `FULL/PARTIAL/PROXY` 覆盖的诚实程度 |
| 2 | **产品体验** | 对标场景下任务能否闭环；入口、权限、空/错/载是否可交代 |
| 3 | **安全合规** | 招标/需求中的认证、审计、密评/等保表述、数据隔离等是否有实装或诚实缺口 |
| 4 | **集成互通** | 要求的外围系统/标准协议是否有真路径或已研究的可交付方案 |
| 5 | **部署运维** | 部署形态、高可用、备份、监控、升级是否匹配条款 |
| 6 | **架构可承载** | 现有边界能否承载缺口改造，而非推倒重来或缝泄漏硬接 |
| 7 | **证据可应标** | 材料、演示路径、文档、验收脚本能否支撑「声称已有」 |
| 8 | **缺口可交付** | 对 `MISSING/PARTIAL` 的方案是否真实可验收（禁 stub 顶替） |

子项与打分锚点见 [dimensions.md](references/dimensions.md)。

### 总分

- 默认：八维**算术平均**。
- 若用户/标书给出**必须项清单**：先算「必须项满足率」（仅 `FULL` 计满足；`PARTIAL/PROXY` 计 0.5 除非用户另定），再与八维均分合成：

```text
综合分 = 0.5 × 必须项满足率×100 + 0.5 × 八维均分
```

无必须项区分时：综合分 = 八维均分。

### 刻度（每维）

| 分 | 含义 |
|----|------|
| 90–100 | 可直接应标/签约实施该维陈述 |
| 80–89 | 可用，少量待确认或小改 |
| 70–79 | 能谈，但该维易被评委/客户打穿 |
| <70 | 该维须先改造或收缩承诺 |

**禁止整行同分**：八维不得无差异地打同一整数（无需求输入 → `BLOCKED`，不打分）。

### 硬门槛（一票限制）

出现任一条 → 相关维 ≤40，且**综合分上限 69**，结论不得写「可无保留应标/可承诺全部必须项」：

- 必须项标 `FULL` 但无代码/可运行路径证据
- 用 mock、stub、假服务、固定演示数据冒充必须项满足
- 关键集成条款仅有空适配器或「以后再接」却写入已满足
- 缺口方案以骨架 API / 纯前端壳为「交付完成」定义

---

## 流程（必须）

### Phase 0 · Fit Card

| 项 | 探测 |
|----|------|
| 需求源 | 文件路径 / 粘贴 / 表格；类型：招标 / 企业 RFP / 必须清单 / 混合 |
| 仓库 | 当前工作区根；多仓则用户指定主仓 |
| 产品表面 | Console/Admin/API/…；是否有 `docs/arch.md`、`docs/ui/`、PRD |
| 模式 | `存量对标`（系统已有）/ `缺口方案`（含大量 MISSING）/ `混合` |
| 输出 | 聊天报告 / 另落盘（默认聊天；用户点名再写 `docs/material/requirement-fit/`） |

写出短 Card；缺需求正文 → `BLOCKED`。

### Phase 1 · 需求条目化

1. 拆成可对标条目：`REQ-ID`、原文摘要、类型（必须 / 评分 / 可选）、主题域。
2. 保留原文锚点（章节号/页码/表格行）；勿改写掉强制性措辞。
3. 条目过多（>80）→ 先必须项 + 高分值项全量，其余按域抽样并声明覆盖率。

### Phase 2 · 有界扫仓

按 [scan-workflow.md](references/scan-workflow.md) 为每条（或每域）找证据；**禁止**无搜索断言「没有」或「全有」。

并行策略：独立域可拆 subagent，但**匹配态与分数由主 agent 统一裁定**，避免同分灌水。

### Phase 3 · 矩阵 + 八维评分

1. 填需求×匹配矩阵（态、锚点、缺口一句话）。
2. 按 [dimensions.md](references/dimensions.md) 打八维 + 综合分；列出硬门槛。
3. 每维至少 1 条正面或缺口证据（路径/符号/文档节）。

### Phase 4 · 改造建议与完整方案

每条改造建议须含：对应 `REQ-ID` 或维、优先级、问题、建议改法、预期匹配态变化、粗工作量（S/M/L）、依赖/风险。

完整方案包（报告必备章节，见模板）：

1. **执行摘要**（综合分、必须项满足率、能否应标结论）
2. **匹配矩阵**
3. **八维评分与证据**
4. **差距与改造路线**（P0→P1→P2；分期可交付切片）
5. **缺功能方案**（`MISSING/PROXY`：目标行为、真实验收、不做清单、是否需 integration-research）
6. **应标/答复口径**（可声称 / 须加条件声称 / 不可声称）
7. **开放问题与待用户裁定**

### Phase 5 · 停等确认

展示报告。**默认不改代码、不改 PRD**。  
用户确认后：交 create-evolution-* / go-fast / integration-research / 人工应标材料；落盘仅在用户点名时写入 `docs/material/requirement-fit/<date>-<slug>.md`。

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: requirement-fit
mode: existing_fit | gap_plan | mixed
requirement_source: ""
scores:
  functional_coverage: 0
  product_ux: 0
  security_compliance: 0
  integration: 0
  deploy_ops: 0
  architecture_fit: 0
  bid_evidence: 0
  gap_delivery: 0
  dimension_avg: 0
  must_have_rate: 0    # 0–1；无必须项则 null
  total: 0
hard_gates:
  - ""
matrix_summary:
  full: 0
  partial: 0
  missing: 0
  proxy: 0
  unknown: 0
  na: 0
top_fixes:
  - "P0: …"
verdict: "可无保留应标 | 有条件应标 | 勿承诺必须项 | 需先改造"
artifacts:
  - ""   # 若落盘
followups:
  - "确认后：create-evolution-prd/plan 或 integration-research"
  - "假绿嫌疑 → code-reviewer"
```

## 红线

- **禁止**无代码/文档锚点将必须项标为 `FULL`
- **禁止**用 stub、mock、假数据、纯演示脚本充当满足证据
- **禁止**八维无差异同分（有有效需求输入时）
- **禁止**把宣传口径或白皮书措辞当作仓内已实现证据
- **禁止**未确认批量改业务代码或伪造投标响应文件
- **禁止**对 `UNKNOWN` 需求「乐观默认已满足」
