# 项目锚定方案评审 — wf3 布局契约（非成品模板）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 模式 | **crystallize** |
| 问题 | DeepTalk 拼大屏同质化（顶栏四 KPI、DE 脸）；模板被当抄本；用户要通用契约 + 按问个性化 |
| 选项 / 候选 | S0 维持 de-* 成品模板 · A 仅 prompt/删 KPI · B 增行业模板 · **C 布局节律契约 LRC + compose 实例化** · D 平台侧 layout 服务 |
| 裁决 | **RECOMMEND_SYNTHESIZED（C 为主 + D 二期；拒 S0/A/B）** |
| 方向纠正强度 | **重定义** |
| 置信度 | **HIGH**（T0 用户意图 + T1 现码结构一致指向同一根因） |
| **交付** | 读(§0) + 判(§1–6) + 纠(§7) + 给(§8–§9) |

---

## 0. 对话上下文与第三方读法

**已共识（对话）**

- 模板 **不是** DE 成品抄录，是 **大屏怎么排的语法/契约**。
- DeepTalk 每次交付应 **对应用户这一次的问题**，屏与屏 **多样化**。
- 绑数可 manual，不是当前主矛盾；**四 KPI + 固定几套 JSON** 才是「每屏一个模板脸」。
- 0.4.1/0.4.2（快路径、品大屏、慢路径 B）**缓解症状**，用户已明确 **未解决根本**。
- 硬约束仍在：**不穷举行业 template/路由**；通用 tools + 用户原话驱动。

**仍摇摆（对话）**

- 现有 `de-*` / `gov-*` JSON **删还是降级为金样**（建议降级，不删文件）。
- 契约放 **插件** 还是 **VitalSpan 平台 API**（建议 Phase 1 插件，Phase 2 可选平台校验）。

**隐含假设（需纠正）**

- ❌ 「换 `de-balanced-four` / 删 KPI / 改 prompt」= 个性化。  
- ❌ `list_layout_templates` + `template=` 是 wf3 的长期真源。  
- ✅ **真源应是：用户意图 → 块清单（blocks）→ 节律契约（rhythm）→ 生成 layout**。

**已排除**

- 行业问卷单选 → 套 gov/de 模板（B 类方案）。
- 再增加 5～10 套固定 slots JSON（仍是抄本，违反用户 North Star）。

**第三方读法**

> 作为外部顾问：团队与 Cursor 已在 prompt 层反复纠「品大屏」，但 **产品抽象仍错**——`layout-templates/*.json` 是 **整屏预设**，`compose` 是 **填槽复制**，这与用户要的 **「契约 + 实例化」** 不在同一层。继续打磨 Agent 文案，只会得到 **「更会用抄本的人」**，不会得到 **「按问排版的人」**。力应集中在 **重定义 compose 输入/输出模型**，而不是第 N 版 AGENT-SYSTEM-PROMPT。

---

## 1. 项目约束摘录

| ID | 约束 | 来源 |
|----|------|------|
| C1 | 不穷举行业 template/theme/路由；通用 tools | 用户 2026-08-28 · `AGENT-SYSTEM-PROMPT` |
| C2 | wf3 完成 = `dashboardId` + 平台 `editor-save` | `IRON-RULES.md` · `DASHBOARD-LAYOUT.md` |
| C3 | layoutJson v2 · 1920 data-screen / 1440 dashboard | `layoutBuilder.ts` · `surface.ts` |
| C4 | customViz 只引用 `artifactId`；②③ 分离 | `DASHBOARD-LAYOUT.md` |
| C5 | 地图离线中国 · 零第三方 BI 运行时 | `geo-map-offline-china.mdc` · `production.mdc` |
| C6 | DeepTalk wf3 仍走 Agent tools（非 iframe compose） | `WORKSPACE-PLUGIN-CONTRACT.md` |
| C7 | 文档同步评估 | `prd-sync.mdc` |

---

## 2. 问题重述

**用户问题**：`/project-grounded-review` — **要怎么做** 才能让用户每次提问得到 **个性化大屏**，而不是固定几套模板（尤其顶栏四 KPI）？

**纠正后问题（§7 重定义）**

> 如何将 wf3 从 **「选择成品模板 id → 复制 slots」** 重构为 **「声明布局节律契约 + 本屏块清单 → 算法生成 layoutJson」**，使 DeepTalk 输出在 **拓扑与组件组合** 上随用户问题变化，且 **不** 依赖行业枚举？

---

## 3. 选项归一

| 选项 | 摘要 | 对根本问题 |
|------|------|------------|
| **S0** | 维持 21 套 `layout-templates` + `template=` compose | **否** — 抽象不变 |
| **A** | 仅 prompt（品大屏、禁 4-KPI 盲选、慢路径 B 删 widget） | **否** — 0.4.2 已证不够 |
| **B** | 增行业/场景模板与问卷路由 | **否** — 违反 C1，加剧抄本 |
| **C** | **布局节律契约 LRC** + **blocks 实例化引擎**（插件内） | **是** — 对齐用户 North Star |
| **D** | VitalSpan 后端 `POST /layouts/compose-from-intent` | **是（长期）** — 成本高，非 Phase 1 必要 |
| **E** | HYBRID：**C Phase 1–2** + **D Phase 3 可选** | **推荐路径** |

---

## 4. 证据与假设

| # | 主张 | 等级 | 锚点 |
|---|------|------|------|
| E1 | 5 套 DE 推荐大屏中 4 套含 **KPI×4** 顶栏 | T1 | `assets/layout-templates/de-*.json` |
| E2 | compose 对模板 **每个 chart 槽必生成 widget** | T1 | `layoutTemplates.ts` `buildLayoutFromTemplate` |
| E3 | 无 template 时已有 **自适应网格** compose | T1 | `layoutBuilder.ts` `buildMixedDashboardLayout` |
| E4 | 自适应网格 **仍均分格子**，无 hero/可选 KPI 带 | T1 | `computeFitGrid` — 无 narrative bands |
| E5 | 文档仍引导 `de-recommended` + `template=` | T1 | `COMPOSE-TEMPLATES-DE.md` · `listLayoutTemplates.ts` |
| E6 | 0.4.2 prompt 写「模板=布局语法」但 **实现仍是成品 slots** | T1 | **CONFLICT** prompt vs code |
| E7 | 用户会话：「已有组件」任务却 8 内置图 + 四 KPI | T0 | 2026-08-28 Agent 审计 |
| E8 | 用户：模板要通用契约，**不要固定几套** | T0 | 2026-08-28 本 thread |
| E9 | 曾移除多样布局 id（`sparse-three-tier` 等） | T1 | `index.json` `removedDataScreenIds` |
| E10 | 平台 `editor-save` 已接受任意合法 widgets 坐标 | T1 | `DASHBOARD-LAYOUT.md` — 平台不阻个性化 |

**假设（Phase 1 spike 验证）**

- H1：3～5 种 **节律契约**（非 21 套成品）可覆盖 80% wf3 会话且 KPI 行 **非默认**。
- H2：Agent 可稳定产出 **blocks JSON**（5～10 块）供 compose 消费。
- H3：现有 `slotChartStyle` / `deStyle` 可复用于生成后 widget，无需改 FE 渲染。

---

## 5. 多维打分（1–5）

| 维度 | S0 | A | B | C | D |
|------|----|----|----|----|-----|
| 解决根本（个性化/非抄本） | 1 | 2 | 1 | 5 | 5 |
| 符合 C1（不穷举行业） | 3 | 5 | 1 | 5 | 5 |
| 实现成本 | 5 | 5 | 3 | 3 | 1 |
| 可验收性 | 3 | 3 | 2 | 4 | 4 |
| 与现码复用 | 4 | 4 | 2 | 4 | 2 |
| **加权** | 否 | 否 | 否 | **是** | 二期 |

---

## 6. 裁决

**RECOMMEND_SYNTHESIZED — 以 C（插件内 LRC + blocks compose）为 Phase 1–2 主路径；D 为 Phase 3 可选；拒 S0/A/B。**

| 裁决 | 理由 |
|------|------|
| 拒 S0/A | 用户已否定「在抄本体系里微调」 |
| 拒 B | 与 C1、用户 North Star 直接冲突 |
| 取 C | 重定义抽象，不改平台即可闭环 wf3 |
| 取 D（延后） | schema 稳定后再考虑服务端校验/缓存 |

---

## 7. 规划方向纠正

**第三方一句话**

> **停止把 `template=id` 当 wf3 核心；改为「节律契约 + 本屏 blocks」生成 layout，de-* JSON 降级为参考金样。**

**原方向错在哪**

- 把 **DataEase 式整屏 JSON** 当成「模板」真源；compose 语义是 **copy slots** 而非 **instantiate contract**。
- 0.4.x 在 **Agent 纪律** 上改道，但 **数据模型未改**，故四 KPI、DE 脸必然复发。
- `list_layout_templates` 强化 **选 id** 心智，与用户 **「契约」** 定义相悖（E6 CONFLICT）。

**纠正后目标（一句话，可验收）**

> wf3 新增（或扩展）compose：**输入 = surface + rhythm + blocks[]（角色/类型/artifactId）**；**输出 = 随 blocks 变化的 layoutJson**；同一 rhythm 不同 blocks **不得** 总是 KPI×4+固定下图。

**应停止**

- 新增 **成品** data-screen JSON 模板作为默认路径。
- 行业问卷 → `gov-*` / `de-sales-command` 路由。
- 以 `slots: chart 8/8` 作为 **质量** 指标（改为 blocks 与故事线一致）。
- 在 prompt  alone 上继续堆「品大屏」而不改 compose API。

**应优先**

1. **LRC schema** 文档化（vs-ai-spec，非 21 个 json 文件）。
2. **rhythm 引擎**（插件 `layoutRhythm.ts` 或扩 `layoutBuilder`）。
3. **新 compose 参数** `rhythm` + `blocks`（JSON 或结构化 CSV）。
4. **Agent 真源改写**：wf3 默认 **不再** `list_layout_templates` 选 de-*；改 `list_layout_rhythms` + 用户问题 → blocks。
5. **de-* 降级**：`referenceLayouts` / 金样目录，**移出** compose 默认 catalog。

**与里程碑对齐**

| 对齐项 | 建议 |
|--------|------|
| VitalSpan M1+ / DeepTalk 一体集成 | 属 **集成契约演进**，非 PRD 新 chart 类型；改 `docs/api/vs-ai-spec/guides/` + 插件，**评估** `docs/services/` 若新增 layout-compose 域 |
| 5173 编辑器 | **不变** — 生成结果仍 `editor-save`；用户可手调 |
| plan.md | 建议新增 companion：`plans/YYYY-MM-DD-wf3-layout-rhythm-contract.md`（由 plan-create 展开） |

**纠正强度**：**重定义** — Phase 0 从 schema + spike 写起，非再一版 prompt。

---

## 8. 推荐解决方案（合成）

### 8.1 方案摘要

**名称**：Layout Rhythm Contract（LRC）+ Blocks Compose  
**类型**：SYNTHESIZED（C + 延后 D）  
**一句话**：用 **少量通用节律契约** 描述「大屏怎么排」，用 **本屏 blocks** 描述「放什么」；compose **生成** layout，不再 **复制** de-* slots。

### 8.2 目标与非目标

| 目标（Phase 1） | 非目标（本期不做） |
|-----------------|-------------------|
| 定义 LRC schema（bands、比例、可选 KPI 带） | 21 套行业大屏 JSON |
| 3～5 个 rhythm id（通用，非行业） | 问卷行业单选 |
| `compose` 支持 `blocks` → 动态 widget 数/坐标 | 平台新 REST 服务（Phase 3） |
| Agent wf3 默认走 blocks，非 `template=de-*` | 改 FE 编辑器拖拽模型 |
| de-* 移入 `reference/` 仅文档/金样 | 删除现有模板文件（先降级） |

### 8.3 架构与触及面

| 层 | 动作 | 路径/模块 | 复用 |
|----|------|-----------|------|
| 契约 | 新增 LRC schema + rhythm 目录 | `docs/api/vs-ai-spec/schemas/layout-rhythm.schema.json` · `assets/layout-rhythms/*.json` | `schemas/layout.schema.json` |
| 引擎 | rhythm → 坐标算法 | `deeptalk-plugins/.../src/layoutRhythm.ts` | `layoutBuilder` MARGIN/GAP · `slotChartStyle` |
| compose | 新参数 `rhythm` + `blocks` | `composeDashboard.ts` · `composeLayout.ts` | `buildMixedDashboardLayout` 思路 |
| 工具 | `list_layout_rhythms`（或扩 list API） | `listLayoutRhythms.ts` | 替换 wf3 默认 list_templates |
| Agent | 重写 wf3 SOP | `AGENT-SYSTEM-PROMPT.md` · `SKILL.md` | gate 仍验 dashboardId |
| 降级 | de-* 标 legacy | `layout-templates/index.json` · `COMPOSE-TEMPLATES-DE.md` | 保留 smoke 兼容 `template=` |

### 8.4 LRC 概念模型（核心）

**Rhythm（节律契约）** — 只描述 **排版语法**，不描述 **具体 chartType**：

```yaml
# 示例 rhythm: rhythm-hero-stack（非行业）
canvas: { surface: data-screen, 1920x1080 }
bands:
  - id: header
    optional: false
    height: 88
    role: shell
  - id: metrics
    optional: true          # 关键：KPI 带可省略
    minItems: 0
    maxItems: 4
    heightRatio: 0.12
    layout: row-equal
  - id: primary
    optional: false
    minItems: 1
    heightRatio: 0.38
    layout: single | split-2
  - id: secondary
    optional: true
    minItems: 0
    maxItems: 3
    heightRatio: 0.35
    layout: row | grid-2
  - id: footer
    optional: true
    heightRatio: 0.10
    minHeight: 112
constraints:
  customVizMinHeight: 200
  mapPreferBand: secondary
```

**Blocks（本屏实例）** — Agent 从 **用户问题 + list_artifacts** 生成：

```json
{
  "rhythm": "rhythm-hero-stack",
  "blocks": [
    { "band": "metrics", "kind": "chart", "chartType": "kpi", "title": "总销售额" },
    { "band": "primary", "kind": "customViz", "artifactId": "…", "title": "趋势 Pro" },
    { "band": "secondary", "kind": "customViz", "artifactId": "…", "title": "排名竞赛" }
  ]
}
```

**同一 rhythm，不同 blocks → 不同屏**：无 metrics band 填充则 **无四 KPI**；两个 cv 占 primary/secondary → **不是** 8 内置图。

**建议首批 rhythm id（通用，非行业）**

| rhythm id | 语义 |
|-----------|------|
| `rhythm-hero-stack` | 可选 KPI 带 + 一大块 + 下方 1～2 块 |
| `rhythm-split-focus` | 左主（map/cv）+ 右栈 2～3 块 |
| `rhythm-cv-stage` | 无 KPI；1～2 高 cv + 窄辅图 |
| `rhythm-balanced-grid` | 2×2 均分（无默认 KPI 行） |
| `rhythm-minimal` | 1～3 块 + 大留白 |

### 8.5 实施步骤（有序）

| 步 | 内容 | 依赖 | 验收 |
|----|------|------|------|
| **0** | 写 LRC schema + 5 rhythm JSON；写 `LAYOUT-RHYTHM-CONTRACT.md` | — | schema validate · 文档 review |
| **1** | Spike：`layoutRhythm.ts` 实现 2 个 rhythm，单测 bounds ≤1080 | 0 | `node tests/layoutRhythm.test.mjs` |
| **2** | `compose_dashboard` 增 `rhythm` + `blocks`（与 `template` 互斥，template 标 deprecated） | 1 | smoke：同 rhythm 不同 blocks → widget 数/拓扑不同 |
| **3** | `list_layout_rhythms` 工具 + stdout 示例 | 0 | Agent 可见 band 说明 |
| **4** | 重写 `AGENT-SYSTEM-PROMPT` wf3：用户问题 → blocks → compose；**禁**默认 de-* | 2–3 | 会话 replay：「2 个已有组件拼屏」须出现 2 cv |
| **5** | de-* 移 `referenceLayouts`；`list_layout_templates` 打 legacy | 4 | 旧 `template=` 仍可用但 warn |
| **6** | gate：`KPI_ROW_DEFAULT` warn if metrics band filled 4 without user story | 2 | smoke gate |
| **7**（可选） | 平台 `layout` 校验 rhythm constraints | 1–2 | 二期 |

### 8.6 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| Agent 不会写 blocks | tool 提供 JSON schema + 2 金样 blocks | 临时保留 `template=` + warn |
| 坐标算法 bug 越界 | 复用 `validateAllLayoutTemplates` 式 bounds 测试 | 回退 template compose |
| 与 COMPOSE-TEMPLATES-DE 文档冲突 | 同期改 vs-ai-spec 指南 | — |

### 8.7 对 Cursor 原方案的具体纠正

| 原建议 | 问题 | 纠正后做法 |
|--------|------|------------|
| 0.4.2 品大屏 + 慢路径 B 删 KPI | 仍在成品模板内修补 | blocks compose，metrics band `minItems:0` |
| 选 `de-balanced-four` 无 KPI | 仍是选整屏 preset | 用 `rhythm-balanced-grid` + 自定义 blocks |
| 行业问卷 | 路由到 gov/de 抄本 | 问 **故事线 blocks**，不问行业 |
| `list_layout_templates` 20 套 | 强化选 id | **`list_layout_rhythms` 5 套语法** |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**  
将 wf3 compose 从成品模板复制升级为 **Layout Rhythm Contract + blocks 实例化**，使 DeepTalk 每次按用户问题生成 **不同拓扑**，根除「顶栏四 KPI + DE 脸」默认化。

**硬约束**  
C1 · C2 · C4 · C6 · 不穷举行业 · 绑数 manual 默认 · 地图离线

**改动清单草案**

1. `docs/api/vs-ai-spec/schemas/layout-rhythm.schema.json`（新）
2. `docs/api/vs-ai-spec/guides/LAYOUT-RHYTHM-CONTRACT.md`（新）
3. `deeptalk-plugins/.../assets/layout-rhythms/*.json`（5 个）
4. `deeptalk-plugins/.../src/layoutRhythm.ts` + tests
5. `composeDashboard.ts` / `composeLayout.ts` — `rhythm` + `blocks`
6. `listLayoutRhythms.ts`（新 tool 或替代 list_templates wf3 默认）
7. `AGENT-SYSTEM-PROMPT.md` · `SKILL.md` · `COMPOSE-STYLE-WORKFLOW.md` 重写 wf3
8. `layout-templates/index.json` — legacy 标记 + `referenceLayouts`
9. `completion_gate` / smoke — blocks 路径 + anti-homogeneity 探针
10. `docs/reviews/grounded/` 本报告链到 plan companion

**验证方案**

- `npm run smoke`（deeptalk-plugins vitalspan）
- 用例 A：blocks=2 cv → layout 含 2 customViz，metrics band 空 → **0 KPI**
- 用例 B：同 rhythm，blocks 仅 1 kpi + 1 line → **1 KPI**
- `pytest test_deeptalk_product_integration.py`
- 人工：DeepTalk replay「用已有两个组件拼大屏」

**非目标**

- 新行业模板 JSON
- 5173 编辑器改版
- 平台 compose API（Phase 3）

**待验证 spike（Phase 0，1–2 天）**

- `rhythm-hero-stack` + 3 blocks 手测坐标与 5173 渲染
- Agent 能否从自然语言稳定产出 blocks JSON（10 条 prompt 样本）

---

## 10. 验证命令

```bash
# Phase 0 后
cd deeptalk-plugins/plugins/vitalspan && npm run smoke

cd VitalSpan/backend && python -m pytest tests/test_deeptalk_product_integration.py -q
```

---

## 11. 交接与下一步

| 下一步 | 负责人 | 产出 |
|--------|--------|------|
| 用户确认 North Star | 用户 | 认可 LRC 重定义 |
| `/plan-create` | Agent | `plans/2026-08-28-wf3-layout-rhythm-contract.md` |
| Phase 0 spike | 实现 | 2 rhythms + 1 compose 用例 |
| 插件版本 | 实现 | `v0.5.0`（破坏性：wf3 默认路径变更） |
| 文档 sync | 实现 | vs-ai-spec + prd-sync 评估 |

**给用户的一句话**：  
**要怎么做 = 先把「模板」从 21 套成品 JSON 改成 5 套左右「排版契约」，再让 compose 吃「本屏 blocks」而不是 `template=de-sales-command`；prompt 只能配合，不能代替这层重构。**
