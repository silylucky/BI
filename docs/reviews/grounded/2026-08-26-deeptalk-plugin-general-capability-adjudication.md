# 项目锚定方案评审 — DeepTalk 插件通用能力补全

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-26 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 模式 | adjudicate |
| 问题 | 如何补全 DeepTalk VitalSpan 插件通用能力，应对多变客户需求 |
| 选项 | A 扩 wf2/customViz · B 仅改提示词 · C Cursor 全栈计划 · S0 维持现状 |
| 裁决 | **RECOMMEND_SYNTHESIZED**（吸收 C，纠正优先级与停止项） |
| 方向纠正强度 | **改道** |
| 置信度 | **MEDIUM**（插件仓跨目录 T3；宿主 E2E 仍 UNVERIFIED） |
| **交付** | 读(§0) + 判(§1–6) + 纠(§7) + 给(§8–§9) |

---

## 0. 对话上下文与第三方读法

> **2026-08-28 补录**：按 skill 新格式回填 §0（原文档在 crystallize 规范之前落盘）。

**已共识**（对话/评审上下文）：

- DeepTalk × VitalSpan 是**一体产品**；② 完成 = `artifactId`，③ = `dashboardId`。
- 标准柱/线/表/地图应走 **wf1 L1/L2**，非 customViz。
- 插件 `components.tools` 与 executor 已交付 v0.3.x 基线。

**仍摇摆**（评审时）：

- 通用能力补全应先扩 wf2 模板库，还是先补宿主 5173 编辑链？
- 多变客户需求是否意味着要内置 OD 飞线等未登记 chartType？

**第三方读法**：

> 作为外部顾问：当前问题不是「插件还能加多少工具」，而是 **工作流边界与验收证据是否钉死**——Agent 仍易把 examples 当交付、把 wf1 图表写进 customViz。方向应 **合成 C 的平台优先序**：先 artifact 入库链与 wf1 能力清单，再薄插件 UX；**停止** 无 `artifactId` 宣称完成。

---

## 1. 项目约束摘录

| ID | 约束 | 真源 |
|----|------|------|
| C-01 | 三条工作流分离；② `artifactId`、③ `dashboardId` | [`docs/api/vs-ai-spec/IRON-RULES.md`](../../api/vs-ai-spec/IRON-RULES.md) |
| C-02 | 标准柱/线/表/地图/sankey/graph → **L1/L2 wf1**，禁止 customViz | [`guides/PLATFORM-SLA.md`](../../api/vs-ai-spec/guides/PLATFORM-SLA.md) · [`guides/RENDERERS.md`](../../api/vs-ai-spec/guides/RENDERERS.md) |
| C-03 | 地图仅离线中国；customViz 禁 MapLibre/在线瓦片 | [`.cursor/rules/geo-map-offline-china.mdc`](../../../.cursor/rules/geo-map-offline-china.mdc) · ADR-12 |
| C-04 | 产品对接 = 插件 zip + 特殊工作区；验收在 **5173** | [`deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md`](../../api/vs-ai-spec/deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md) |
| C-05 | 插件 `components.tools` 14 个；wf2/wf3 已交付 v0.3.x | [`agent-tools.schema.json`](../../api/vs-ai-spec/deeptalk-product/agent-tools.schema.json) · [`test_deeptalk_product_integration.py`](../../../backend/tests/test_deeptalk_product_integration.py) |
| C-06 | 内置 chartType 真源 ~45 active | [`capability-manifest.json`](../../api/vs-ai-spec/capability-manifest.json) |
| C-07 | compose 模板 vs-ai-spec **21 套**（5 DE + 6 gov + 10 dash） | [`assets/layout-templates/index.json`](../../api/vs-ai-spec/assets/layout-templates/index.json) v3 |
| C-08 | 无内置「OD 飞线/流向地图」chartType；demo SQL 有 `de_map_flow` | [`docker/demo-mysql/tables.sql`](../../../docker/demo-mysql/tables.sql) · FE 无 flow-map renderer |

---

## 2. 问题重述

**用户问题**：要补全插件的通用能力，让 DeepTalk 能应对更加多变的客户需求，要怎么做？

**纠正后问题**（§7 重定义）：

> 如何在 **不重复造内置图、不扩 customViz 边界** 的前提下，让 Agent **稳定完成「客户意图 → 正确 wf → 可验收交付」**，并消除 **vs-ai-spec 与插件 assets 漂移**？

根因不是「工具少 2 个」，而是 **wf1 在 Agent 路径上隐形 + 无机器可读路由 + 资产双仓漂移**（流向地图误走 wf2 即例证）。

---

## 3. 选项归一

| 选项 | 摘要 | 典型动作 |
|------|------|----------|
| **A** | 继续扩 wf2：更多 customViz 金样/范式（含地图类） | 新 scaffold 模板、加 publish 工具 |
| **B** | 只改 Agent 提示词/Skill，不加工具 | 更新 AGENT-SYSTEM-PROMPT |
| **C** | Cursor 全栈计划（Phase 0–5：同步 + 路由 + wf1 工具 + 范式护栏 + E2E） | 见 `.cursor/plans/deeptalk_插件通用能力_*.plan.md` |
| **S0** | 维持 14 工具 + 人工纠偏 | 无改动 |

---

## 4. 证据与假设

| ID | 类型 | 内容 | 来源 |
|----|------|------|------|
| T1 | 代码 | `POST /api/v1/charts/validate` 已实现 | [`backend/app/api/v1/charts.py`](../../../backend/app/api/v1/charts.py) |
| T1 | 代码 | wf2 有 validate/publish/gate；wf1 无对等 Agent 工具 | [`AGENT-SYSTEM-PROMPT.md`](../../api/vs-ai-spec/deeptalk-product/AGENT-SYSTEM-PROMPT.md) 工具表 |
| T1 | 代码 | sankey/map/graph 在 manifest；L1 示例缺 sankey/map/graph | [`examples/`](../../api/vs-ai-spec/examples/) 目录 |
| T1 | 代码 | `de-kpi-flow-wall` 模板描述「流向/链路 → sankey」 | [`COMPOSE-TEMPLATES-DE.md`](../../api/vs-ai-spec/guides/COMPOSE-TEMPLATES-DE.md) |
| T1 | 审计 | E2E §2–§5 大量未勾；wf2 对话回归 ⏸ | [`E2E-CHECKLIST.md`](../../api/vs-ai-spec/deeptalk-product/E2E-CHECKLIST.md) |
| T1 | 审计 | 工作区 Task 7–9 宿主 UI **PARTIAL 6.5/10** | [`2026-08-25-deeptalk-vitalspan-sop-align-truth-audit.md`](../grounded/2026-08-25-deeptalk-vitalspan-sop-align-truth-audit.md) |
| T3 | 跨仓 | 插件源码在 `deeptalk-plugins/`，不在 VitalSpan 仓 | 用户环境路径；需 sync 脚本 |
| T3 | 产品 | 「流向地图」无 chartType；飞线需 4B 级 FE/BE epic | 对话实证 + tables.sql |
| H1 | 假设 | DeepTalk 可内置 AGENT-SYSTEM-PROMPT 并安装新 zip | E2E §2 未验证 |

---

## 5. 多维打分（10 分制，越高越好）

| 维度 | A 扩 wf2 | B 仅文档 | C 全栈计划 | S0 |
|------|---------|---------|-----------|-----|
| 约束合规 (C-02/03) | 3 | 7 | 9 | 5 |
| 误路由抑制 | 2 | 5 | 9 | 2 |
| 可验收性 | 4 | 4 | 8 | 3 |
| 实施成本 | 4 | 9 | 6 | 10 |
| 与现码复用 | 3 | 8 | 9 | 6 |
| **加权** | **3.2** | **6.6** | **8.2** | **5.2** |

---

## 6. 裁决

**推荐**：**RECOMMEND_SYNTHESIZED**（以 **C 全栈计划** 为骨架，按 §7 改道、§8 收紧 scope）

**一句话**：先 **止血资产漂移 + 机器可读意图路由 + wf1 工具对称**，再谈平台新 chartType；**禁止**用 customViz 补内置图缺口。

**相对 Cursor 原方案的纠正**（详见 §8.6）：

- `vitalspan_route_request` 从「可选」改为 **Phase 1 必做**
- Phase 4B 飞线地图 **移出本 initiative**，单独立项 ADR/PRD
- Phase 0 **必须先于** Phase 1（gov 模板决策不可跳过）
- 工作区壳 E2E **不阻塞**本 initiative，但不得宣称「插件全量验收完成」

---

## 7. 规划方向纠正

**原方向错在哪？**

1. **问题定义偏宽**：「补全插件通用能力」易被理解成 **加工具/加金样**；真缺口是 **路由与 wf 对称**。
2. **A 路径与铁律冲突**：为地图/流向/scaffold customViz 违反 C-02、C-03（流向地图对话已证）。
3. **全栈顺序风险**：若 Phase 4B 与 Phase 1 并行，会分散 Agent 叙事，继续误路由。
4. **双仓漂移未闭合则一切失效**：文档写 21 套模板、插件仅 15 套时，wf3 compose 直接失败。

**纠正后目标（一句话）**：

> 交付 **Intent Router + 三 wf 对称工具链 + 单一 assets 真源同步**，使 10 条典型客户话术 ≥9 条首轮选对路径并在 5173 可验收。

**应停止什么？**

- 为 sankey/map/graph/柱线饼 **新增 customViz 金样或 scaffold**
- 在 customViz 内做 MapLibre/在线瓦片/OD 飞线（除非 4B 单独立项通过 ADR）
- 把 **工作区 resources 深链** 与 **Agent 路由** 混为同一 Phase 阻塞项
- 无 sync 脚本情况下 **手工双份改** vs-ai-spec 与插件 assets

**应优先什么？**

| 优先级 | 内容 | 里程碑对齐 |
|--------|------|------------|
| **P0** | assets 同步 + gov 模板决策 + 文案对齐 | M1 工程可交付（DeepTalk 产品路径 C-04） |
| **P1** | `capability-routing.json` + **`vitalspan_route_request`** + 三处 prompt/Skill | 一体集成铁律 C-01 |
| **P2** | `vitalspan_validate_chart_config` + L1 金样 4 份 + wf1 gate | wf1 与 wf2 对称 |
| **P3** | scaffold 拒绝内置图 + paradigms excludes | RENDERERS 决策树落地 |
| **P4** | 4A 流向组合文档 + demo 绑数说明 | 客户话术「流向地图」标准答 |
| **Defer** | 4B OD 飞线 chartType | 需新 PRD/ADR，非 M1 默认可交付 |

**与里程碑对齐**：

- VitalSpan `goal.md` G3「BI 展现全链路」— 内置 chartType 已覆盖大部分需求；DeepTalk 职责是 **正确编排**，不是重写引擎。
- `plan.md` 无独立 DeepTalk 里程碑；本 initiative 属 **产品对接 companion**，验收以 [`E2E-CHECKLIST.md`](../../api/vs-ai-spec/deeptalk-product/E2E-CHECKLIST.md) 为准。

---

## 8. 推荐解决方案（合成）

### 8.1 方案摘要

**名称**：Intent Router + Wf Symmetry（IRWS）  
**类型**：SYNTHESIZED（C 计划 + 停止 A 路径 + 收紧 4B）  
**一句话**：用 **规则路由 + wf1 工具化 + 资产单真源** 让 Agent 多变需求可预测，customViz 只服务 L3 真缺口。

### 8.2 目标与非目标

| 目标（Phase 1 闭环） | 非目标（本期不做） |
|---------------------|-------------------|
| 10 条话术路由回归 ≥90% 正确 | 新 chartType「OD 飞线地图」（4B epic） |
| wf1 validate 工具 + gate 与 wf2 对称 | 工作区 iframe 内嵌 5173 编辑器 |
| vs-ai-spec → 插件 assets 自动 sync + CI diff | 改 DeepTalk 引擎源码 |
| 流向类标准答：sankey + `de-kpi-flow-wall` | 为每种内置图写 customViz 副本 |
| E2E §5 至少 3 条 Agent 行为用例可勾 | 14→20 工具无节制扩张 |

### 8.3 架构与触及面

| 层 | 动作 | 路径/模块 | 复用 |
|----|------|-----------|------|
| 意图 | 新增 routing JSON + route 工具 | `docs/api/vs-ai-spec/assets/capability-routing.json` · 插件 `tools/route-request.*` | `capability-manifest.json` |
| 工具 | 新增 validate_chart_config | 插件 tool · [`validate-chart-config.py`](../../api/vs-ai-spec/tools/validate-chart-config.py) | [`charts.py`](../../../backend/app/api/v1/charts.py) |
| 资产 | sync 脚本 | VitalSpan `scripts/sync-vs-ai-spec-to-deeptalk-plugin.ps1`（新建） | 现有 `sync-vs-ai-spec-pack.ps1` 模式 |
| 文档 | CUSTOMER-INTENT-ROUTING | `guides/CUSTOMER-INTENT-ROUTING.md` | `THREE-WORKFLOWS.md` |
| 护栏 | paradigms excludes | `custom-viz-paradigms.json` · scaffold 工具 | 现有 P1–P4 |
| 平台 | 4A demo 绑数说明 | `official-demo-chart-queries.json` | `de_map_flow` SQL |
| CI | routing schema + assets diff | `test_deeptalk_product_integration.py` · 插件 vitest | 已有 14-tool 测试 |

### 8.4 实施步骤（有序）

| 步 | 内容 | 依赖 | 验收 |
|----|------|------|------|
| **0** | gov 模板决策 **A**：6 套打进插件；写 sync 脚本；CI assets diff | — | `list_layout_templates` 计数 = index.json；compose `gov-smart-city` 不报错 |
| **1** | 新增 `capability-routing.json` + `guides/CUSTOMER-INTENT-ROUTING.md` | 0 | JSON schema 测试绿 |
| **2** | 实现 **`vitalspan_route_request`**（规则引擎，非 LLM） | 1 | 4 话术单测：流向地图→wf1 sankey；排名→wf2 P1；gis→wf1 gis-map+warn |
| **3** | 同步 AGENT-SYSTEM-PROMPT · DEEPTALK-AGENT-PROMPT · Skill | 1–2 | DeepTalk 内置 prompt 与仓内 diff 为零 |
| **4** | **`vitalspan_validate_chart_config`** + wf1 gate 增强 | 0 | CLI/tool 输出 `ok validate chartType=sankey`；gate wf1 绿 |
| **5** | L1 金样：sankey/map/graph/funnel 各 1 | 4 | `validate-chart-config.py` 四文件 200 |
| **6** | scaffold `redirectToWorkflow1` + paradigms excludes | 2 | scaffold sankey 请求返回错误 + wf1 建议 |
| **7** | 4A：`de_map_flow` → sankey 绑字段文档 | 5 | 文档 PR 可人工 compose+绑 demo |
| **8** | E2E §5 用例 + 10 话术回归脚本 | 2–6 | 清单可勾 ≥3 条 |

### 8.5 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| 插件仓与 VitalSpan 仓分离 | sync 脚本 + CI diff | 暂只发 VitalSpan 文档，插件手动 copy |
| route 规则过拟合 | keywords + chartType 字段规则双层 | 先上文档表，工具 Phase 1.1 |
| DeepTalk 未内置新 prompt | release 说明 + E2E §2 勾选项 | 用户手动粘贴 AGENT-SYSTEM-PROMPT |
| 客户硬性要飞线地图 | 4A 组合 + 书面 alternatives | 4B 单独立项，不在本 initiative 承诺 |

### 8.6 对 Cursor 原方案的具体纠正

| 原建议 | 问题 | 纠正后做法 |
|--------|------|------------|
| Phase 1 route 工具「可选」 | Agent 不可靠读长文档 | **必做** `vitalspan_route_request` |
| Phase 4B 与 Phase 1–3 同计划 | scope 膨胀、延误路由闭环 | **Defer** 4B；本计划只交付 4A |
| 「补全插件能力」= 加工具 | 方向偏 wf2 | 核心是 **路由 + wf1 对称** |
| 全栈含 FE 新 chartType | 与 M1 内置能力重复建设 | 飞线地图需 ADR，非插件 initiative |
| Phase 5 与工作区 Task 9 并列 | 混淆验收 | Task 9 单独 track；不阻塞 IRWS |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**：见 §7 纠正后一句话。

**硬约束**：C-01 ~ C-08（§1）。

**改动清单草案**（≤10）：

1. 新建 `scripts/sync-vs-ai-spec-to-deeptalk-plugin.ps1`
2. 新建 `assets/capability-routing.json` + schema 测试
3. 新建 `guides/CUSTOMER-INTENT-ROUTING.md`
4. 插件新增 tool `vitalspan_route_request` + vitest
5. 插件新增 tool `vitalspan_validate_chart_config`
6. 更新 `completion_gate` wf1 分支
7. 新增 examples：`sankey-flow-deStyle.json` 等 4 份
8. 更新 `custom-viz-paradigms.json` excludes + scaffold 拦截
9. 同步三处 Agent prompt/Skill
10. 扩展 `E2E-CHECKLIST.md` §5 + `test_deeptalk_product_integration.py`

**验证方案**：

```bash
# VitalSpan 仓
pytest backend/tests/test_deeptalk_product_integration.py -q
python docs/api/vs-ai-spec/tools/validate-chart-config.py --file docs/api/vs-ai-spec/examples/sankey-flow-deStyle.json

# 插件仓
npm run smoke
npm test -- route-request

# DeepTalk 对话（人工）
# 「帮我做流向地图」→ route → sankey + de-kpi-flow-wall，无 publish customViz
```

**非目标**：OD 飞线 chartType · iframe 5173 · 改 deeptalk 引擎 · customViz 地图金样

**待验证 spike（DEFER_VERIFY）**：DeepTalk 内置 AGENT-SYSTEM-PROMPT 后 10 话术首轮路由率（H1）

---

## 10. 验证命令

见 §9。

---

## 11. 交接与下一步

| 下一步 | 动作 |
|--------|------|
| **立即** | 用本报告 §9 **更新** `.cursor/plans/deeptalk_插件通用能力_*.plan.md`（收紧 scope） |
| **用户确认后** | `/plan-create` 或 `/plan-execute` 按 §9 展开 |
| **并行不阻塞** | 工作区 Task 9 宿主验收（SOP 深链）单独排期 |
| **4B 飞线地图** | 若 4A 仍不满足 → `feature-land-design` + 新 PRD 分片 |

**建议回写 plan.md 的句子（供用户确认，Agent 不直接改）**：

> DeepTalk 一体集成 companion：优先闭合 Intent Router + wf 对称与 assets sync；OD 飞线地图不纳入 M1 默认可交付范围。
