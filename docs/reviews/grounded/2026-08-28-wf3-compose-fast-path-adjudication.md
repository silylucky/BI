# 项目锚定方案评审 — wf3 compose 快路径优化方案

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 问题 | 对话中提出的 wf3 优化（默认 compose 即交付、按需 patch、gate/stdout 对齐）是否正确、是否真有用 |
| 选项 | S0 维持现状 · A 文案+stdout+gate 优化 · B 行业模板/主题枚举 · C 平台侧新 API · D 仅 DeepTalk 编排层 |
| 裁决 | **RECOMMEND_SYNTHESIZED**（A + 部分 D；拒 B；S0 不满足目标） |
| 方向纠正强度 | **改道**（从「补模板穷举」→「改 SOP + 门禁 + 通用 patch 纪律」） |
| 置信度 | **MEDIUM**（T1 真理源完整；gate 语义校验为 T2 设计） |
| **交付** | 判 + 纠 + 给（§6–§9 完整） |

---

## 1. 项目约束摘录

| ID | 约束 | 来源 |
|----|------|------|
| C1 | DeepTalk Agent 用 **通用 tools**，不穷举行业模板/主题路径 | 用户 2026-08-28 硬约束 |
| C2 | wf3 完成证据 = `dashboardId` + 平台 POST | `AGENT-SYSTEM-PROMPT.md` · `IRON-RULES.md` |
| C3 | compose 用 template，禁止手写 x/y | `composeDashboard.ts` · `layoutBuilder.ts` |
| C4 | 样式 patch 只动 `styleConfig` / `deStyle` / `customVizConfig.*` | `COMPOSE-STYLE-WORKFLOW.md` |
| C5 | 文档同步评估 | `prd-sync.mdc`（改 prompt/指南须评估） |

---

## 2. 问题重述

**用户问题**：上一轮提出的 wf3 优化方案（快路径默认 compose、按需 get→patch→upload、强化 gate、不增行业 template）**写得对不对、是否真的有用**？

**纠正后问题**：在 **不穷举场景** 前提下，如何用 **现有通用工具 + 规则/门禁** 让 Agent **又快又达标**，并避免 57 步 / 假交付？

---

## 3. 选项归一

| 选项 | 摘要 | 与 C1 关系 |
|------|------|------------|
| **S0** | 维持 `AGENT-SYSTEM-PROMPT` wf3 第 6 步必 patch | 合规但不解决慢 |
| **A** | P0 prompt/skill 分叉快/慢路径；P1 compose stdout + completion_gate；patch 纪律 | **符合 C1** |
| **B** | 增 `theme=` / `de-ec-*` 等行业模板与路由 | **违反 C1** |
| **C** | 平台新增 compose 样式 API / 服务端 preset | 通用但成本高、非 Phase 1 必要 |
| **D** | 仅 DeepTalk 限 plan / 限 edit_file 次数 | 治标，无 VitalSpan 规则仍慢 |

---

## 4. 证据与假设

| # | 主张 | 等级 | 锚点 |
|---|------|------|------|
| E1 | wf3 SOP **强制** get→patch→upload | **T1** | `docs/api/vs-ai-spec/deeptalk-product/AGENT-SYSTEM-PROMPT.md` L69 |
| E2 | SKILL 写明「仅 compose 一步完成」可不改样式 | **T1** | `deeptalk-plugins/.../skills/vitalspan-bi/SKILL.md` L183–191 |
| E3 | **CONFLICT**：E1 与 E2 同时有效 → Agent 倾向慢路径 | **T1** | 同上 |
| E4 | compose 成功 stdout **总是** 推 style patch | **T1** | `composeDashboard.ts` L197 |
| E5 | compose 默认 `data_binding=manual` | **T1** | `composeDashboard.ts` L66·114；`demoChartBinding.ts` L51–80；`smoke.mjs` L108 |
| E6 | gate 已拒 get 导出 stdout，但未校 summary 与 demo/manual 一致 | **T1** | `workflow3Stdout.ts` L29–37；`completionGate.ts` L83–92 |
| E7 | 电商大屏事故：13× edit_file、2 失败仍 upload | **T0** | 用户会话审计 2026-08-27 |
| E8 | 用户禁止行业 template 穷举 | **T0** | 用户 2026-08-28 |
| E9 | P2 `get_style_vocabulary` 能减 blind patch，但 **非 Phase 1 必要** | **T2** | `style-vocabulary.json` 存在但未进插件 assets |
| E10 | DeepTalk plan 放大步数 | **T3** | 会话日志；仓内无 plan 配置真源 |

**假设（待 Phase 1 验收）**：

- H1：改 prompt + compose `next:` 后，Agent wf3 快路径可稳定在 ≤5 tool calls。
- H2：gate 增加 demo/manual 与 delivery 来源校验，可减少「说有演示数据实则 manual」。

---

## 5. 多维打分（1–5，5=优）

| 维度 | S0 | A | B | C | D |
|------|----|----|----|----|-----|
| 满足 C1 通用能力 | 5 | 5 | 1 | 4 | 5 |
| 解决慢（步数/时间） | 1 | 4 | 3 | 3 | 2 |
| 质量/防假交付 | 2 | 4 | 2 | 4 | 2 |
| 实现成本 | 5 | 4 | 2 | 1 | 5 |
| 可验收性 | 3 | 4 | 3 | 3 | 2 |
| **加权倾向** | 否 | **是** | 否 | 延后 | 辅助 |

---

## 6. 裁决

**推荐**：**RECOMMEND_SYNTHESIZED**（**A 为主 + D 为辅**；**拒 B**；**S0 不可接受**）

**一句话**：优化方案 **方向正确、Phase 1（P0+P1）真有用**；曾出现的「电商专用 template / theme 参数」与用户 C1 **冲突，应删除**；P2 可选、不挡上线。

**相对对话原方案的纠正**：

| 原片段 | 裁决 |
|--------|------|
| P0 prompt 快/慢分叉 | ✅ 保留，**最高优先级** |
| P1 stdout / gate | ✅ 保留；gate 语义校验宜 **工具侧** 实现，少依赖 Agent 自觉 |
| P2 `get_style_vocabulary` | ⚠️ 可选 Phase 2，**非「真有用」的必要条件** |
| `de-ec-promo` / `theme=ecommerce` | ❌ 违反 C1，**不得进入 plan** |
| 仅 DeepTalk 限 plan/edit | ✅ 作 **D 辅助**，不能替代 A |

**置信度 MEDIUM 原因**：E7/E10 为会话证据；gate 新规则需 `smoke.mjs` / 插件测试补探针后方可升 HIGH。

---

## 7. 规划方向纠正

**原方向错在哪？**

1. **症状**：57 步、edit 失败、假称演示数据 — 被误导向「缺电商模板」。
2. **根因（T1）**：`AGENT-SYSTEM-PROMPT` wf3 **第 6 步写死 patch** + compose stdout **永远 next: style patch**（E1·E4），与 SKILL「一步 compose」（E2）**CONFLICT**。
3. **约束偏离**：任何「按行业加 template / preset 穷举」与用户 C1 **直接矛盾**（E8）。

**纠正后目标（一句话）**：wf3 **默认 compose 即交付**；仅当用户话里要求视觉/配色/品牌/标题时走 **一次 get → 整文件 patch → upload**；gate 校验 **delivery 来源与绑数声明**。

**应停止**：

- 新增行业/风格 template id 或 `theme=` 枚举（B）。
- wf3 SOP 把 patch 列为**必做**第 6 步。
- 对同一 layout JSON 多次 `edit_file` 碎片修改。
- manual compose 却汇报「已绑演示数据」。

**应优先**：

1. 统一 **AGENT-SYSTEM-PROMPT · skill · compose stdout · COMPOSE-STYLE-WORKFLOW** 的快/慢分叉表述。
2. 改 `composeDashboard.ts` 的 `next:` / `done:` 条件文案。
3. 扩展 `completionGate` + `workflow3Stdout`（demo/manual、upload vs compose）。
4. `list_layout_templates` / list_artifacts **条件化**（customViz=0 跳过）。

**与里程碑对齐**：

| 对齐项 | 说明 |
|--------|------|
| DeepTalk × VitalSpan 一体集成 | 属集成体验优化，不扩 PRD 新功能 ID |
| 文档 | 改 `AGENT-SYSTEM-PROMPT` / guides 须按 `prd-sync.mdc` 评估（通常属集成文档，非 SRS 变更） |

---

## 8. 推荐解决方案（合成）

### 8.1 方案摘要

**名称**：wf3 Fast-Path First（通用 compose 优先）  
**类型**：SYNTHESIZED（A + D）  
**一句话**：用 **规则与门禁** 让 Agent 默认 3–5 步完成 wf3；样式与绑数 **按用户原话分支**，不增场景枚举。

### 8.2 目标与非目标

| 目标（Phase 1） | 非目标（本期不做） |
|-----------------|-------------------|
| wf3 无样式需求时 **compose → gate** 即结束 | 行业 template / theme preset |
| 用户要预览时 compose 带 `data_binding=demo` | 平台新 compose 样式 API（C） |
| patch 时 **整文件 write**，≤1 get | 穷举「电商/政务」路由表 |
| gate 拦截 get stdout、demo 声明不一致 | 替换 DeepTalk plan 产品（D 仅建议） |
| 文档/stdout/skill **同一绑数规则** | wf1/wf2 行为变更 |

### 8.3 架构与触及面

| 层 | 动作 | 路径 | 复用 |
|----|------|------|------|
| Agent 规则 | wf3 快/慢分叉；patch 纪律 | `docs/api/vs-ai-spec/deeptalk-product/AGENT-SYSTEM-PROMPT.md` | 现有 wf3 节 |
| Agent 规则 | 同步 skill | `deeptalk-plugins/plugins/vitalspan/skills/vitalspan-bi/SKILL.md` | 现有「一步 compose」句 |
| 插件 tool | compose stdout 条件 `next` | `deeptalk-plugins/.../src/composeDashboard.ts` | 现有 bindingNote |
| 插件 tool | gate wf3 语义 | `completionGate.ts` · `workflow3Stdout.ts` | 已有 get 拒收逻辑 |
| 插件 tool | get stdout 警示 | `getDashboardLayout.ts` | 已有文案 |
| 插件 tool | list 条件提示 | `listLayoutTemplates.ts` | customVizSlots |
| 指南 | 与 prompt 对齐「patch 可选」 | `docs/api/vs-ai-spec/guides/COMPOSE-STYLE-WORKFLOW.md` | 现有四阶段表 |
| sync | deeptalk-product-sync | `deeptalk-plugins/.../deeptalk-product-sync/AGENT-SYSTEM-PROMPT.md` | sync 脚本 |
| 测试 | smoke / 单测 | `deeptalk-plugins/.../scripts/smoke.mjs` | 已有 wf3 gate 用例 |

### 8.4 实施步骤（有序）

| 步 | 内容 | 依赖 | 验收 |
|----|------|------|------|
| 1 | 改 AGENT-SYSTEM-PROMPT wf3：快路径默认；第 6 步改「**仅当用户要视觉/配色/标题**」；`list_artifacts` 条件化；绑数分支表 | — | 人工 diff；无「必做 patch」措辞 |
| 2 | 同步 SKILL + COMPOSE-STYLE-WORKFLOW 首段「原则」：① compose 可单独交付 | 1 | 三文档 bind 规则一致 |
| 3 | `composeDashboard.ts`：`done:` + 条件 `optional: patch…` 替换无条件 style patch | 1 | smoke 断言新 stdout 行 |
| 4 | `completionGate`：若 summary 含 演示/预览/能看 → 要求 tool_stdout 含 `data binding: demo`；若含 改色/配色/风格 → 要求 stdout 来自 upload（或 gate 参数 `delivery=patched`） | 3 | smoke 增 2 负例 + 1 正例 |
| 5 | `getDashboardLayout` stdout 增 **not completion** 强调 | — | gate 仍拒 get stdout |
| 6 | sync deeptalk-product-sync + 插件 build zip 版本号 | 1–5 | `npm run build` · smoke 绿 |
| 7 | （Phase 2 可选）通用 `get_style_vocabulary` 读 `style-vocabulary.json` | 6 | 工具返回 globalStyleFields，无行业键 |

### 8.5 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| Agent 该 patch 时不 patch | 用户话含「风格/配色/品牌」触发慢路径；gate 可选 `user_intent` 字段 | 恢复 prompt 慢路径提示（非必做 patch） |
| gate 关键词误判 | 以 tool_stdout 硬信号为主（demo 行、upload vs compose） | 放宽 summary 关键词，仅保留 stdout 校验 |
| 文档 drift | 单 PR 同改 prompt + guide + sync | revert 文档 commit |
| 旧 Agent 缓存旧 prompt | 插件 release note + 版本 bump | 无代码回退必要 |

### 8.6 对 Cursor 原方案的具体纠正

| 原建议 | 问题 | 纠正后做法 |
|--------|------|------------|
| wf3 第 6 步必 patch | E1 导致 57 步 | 默认 compose 结束；按需 patch |
| `de-ec-promo` / theme 参数 | 违反 C1 | **删除**；Agent 自改通用 JSON 字段 |
| P2 vocabulary 与 Phase 1 并列 | 分散优先级 | Phase 2 可选 |
| gate 只验 uuid | 假交付 | 加 demo/manual + delivery 来源 |
| 13× edit_file |  fragile | prompt 写 **整文件 write、≤3 edit** |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**：wf3 Agent 默认快路径 compose 交付；质量由 gate 与绑数规则保证；不穷举行业模板。

**硬约束**：C1 · C2 · C3 · C4

**改动清单草案**（≤10）：

1. `docs/api/vs-ai-spec/deeptalk-product/AGENT-SYSTEM-PROMPT.md` — wf3 快/慢分叉
2. `deeptalk-plugins/plugins/vitalspan/skills/vitalspan-bi/SKILL.md` — 对齐
3. `docs/api/vs-ai-spec/guides/COMPOSE-STYLE-WORKFLOW.md` — compose 可单独交付
4. `deeptalk-plugins/plugins/vitalspan/src/composeDashboard.ts` — stdout
5. `deeptalk-plugins/plugins/vitalspan/src/completionGate.ts` — wf3 语义
6. `deeptalk-plugins/plugins/vitalspan/src/workflow3Stdout.ts` — 辅助校验函数
7. `deeptalk-plugins/plugins/vitalspan/src/getDashboardLayout.ts` — 警示
8. `deeptalk-plugins/plugins/vitalspan/scripts/smoke.mjs` — 探针
9. sync `deeptalk-product-sync/AGENT-SYSTEM-PROMPT.md`

**验证方案**：

- `cd deeptalk-plugins/plugins/vitalspan && npm run build && node scripts/smoke.mjs`
- `cd backend && pytest tests/test_deeptalk_product_integration.py -q`
- 手测：DeepTalk 发起「拼个销售大屏」→ 仅 compose+gate；「要能看+换暖色」→ compose(demo)+get+write+upload+gate

**非目标**：行业 template · theme API · 平台 compose 新端点 · 改 wf1/wf2

**待验证 spike**：无（DEFER_VERIFY 不适用）

---

## 10. 验证命令

```bash
cd deeptalk-plugins/plugins/vitalspan && npm run build && node scripts/smoke.mjs
cd VitalSpan/backend && pytest tests/test_deeptalk_product_integration.py -q
```

---

## 11. 交接与下一步

| 下一步 | 条件 |
|--------|------|
| `/plan-create` 按 §9 展开 | 用户同意实施 |
| 直接 implement P0+P1 | 用户说「按 §8 实现」 |
| 无需 first-review | 「该不该做 wf3 优化」已成立 |

**评审结论（给用户）**：

- **写得对不对？** → **大方向对**；曾混入的 template/theme 穷举 **不对**，须剔除。
- **是否真的有用？** → **P0+P1 真有用**（对准 E1/E3/E4/E6/E7 根因）；单靠 D 或单靠 P2 **不够**。
- **最小有效包**：改 prompt + compose stdout + gate 三处，即可预期 wf3 从 20–50+ 步降到 **3–10 步**。
