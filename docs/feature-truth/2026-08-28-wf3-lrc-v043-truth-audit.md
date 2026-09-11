# Feature Truth Audit: wf3 LRC v0.4.3（Layout Rhythm Contract）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| 核验范围 | v0.4.3：`rhythm` + `blocks` compose、5 个 LRC、`list_layout_rhythms`、Agent 真源、相对 grounded 裁决 Phase 1 完成度 |
| 锚点 | `deeptalk-plugins/plugins/vitalspan/src/layoutRhythm.ts` · `composeDashboard.ts` · `docs/api/vs-ai-spec/assets/layout-rhythms/` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.5/10 · C+**（引擎 CHAIN 达标；产品闭环与 Agent 行为未验） |
| 状态 | superseded → see `2026-08-28-wf3-lrc-v044-truth-audit-recheck.md` |
| **sampling** | `full`（Phase 1 交付项 + 5 rhythm 全枚举） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | wf3 **默认** `rhythm` + `blocks` 生成 layout，**非** `template=` 复制 8 槽 | grounded 裁决 §7 · 用户 North Star |
| T2 | `rhythm-cv-stage` + 2 个 customViz blocks → **0 个 KPI widget** | 对话 · smoke 用例 |
| T3 | **5 个 rhythm** 均可 `buildLayoutFromRhythm` 且不越界 canvas | Phase 1 §8.5 step 1–2 |
| T4 | 同 rhythm、不同 blocks → **widget 拓扑数量变化** | 个性化机制 |
| T5 | `template=de-*` 仍可用但 stdout **`[warn] LEGACY_TEMPLATE`** | 兼容 + 纠偏 |
| T6 | `vitalspan_list_layout_rhythms` 注册且可列出 5 契约 | 工具链 |
| T7 | `AGENT-SYSTEM-PROMPT` / skill / agent-tools **v0.4.3** 与实现一致 | 真源 |
| T8 | `compose` **POST editor-save** 真落库（live API） | wf3 完成定义 C2 |
| T9 | DeepTalk Agent 拼屏会话 **实际走 rhythm**（非 de-sales 8 内置） | 用户痛点验收 |
| T10 | `COMPOSE-STYLE-WORKFLOW.md` 与 LRC 一致 | prd-sync |

- **非目标（本期）**：平台侧 layout API（Phase 3）、5173 全控件下钻、21 套 legacy template 删除。

## 2. 完整链路图

```
用户话 → Agent blocks JSON → list_layout_rhythms → compose(rhythm,blocks)
  → layoutRhythm.buildLayoutFromRhythm → editor-save → dashboardId → 5173 预览
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | LRC 资产 5 JSON | **通** | `docs/api/vs-ai-spec/assets/layout-rhythms/*.json` |
| 2 | 布局引擎 | **通** | `layoutRhythm.ts` · node 全 rhythm 构建 |
| 3 | compose 参数 | **通** | `composeDashboard.ts` rhythm/blocks |
| 4 | legacy 警告 | **通** | `resolveComposeLayout` + smoke |
| 5 | 工具注册 | **通** | `plugin.json` · smoke tool export |
| 6 | Agent 真源 | **静态通 / 行为未验** | `AGENT-SYSTEM-PROMPT.md` |
| 7 | 平台 POST | **未验** | 无 live :8000 compose 本轮 |
| 8 | 5173 渲染 | **未验** | 无 browser |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | rhythm+blocks 为 wf3 主路径 | PARTIAL | 7/B | 代码+prompt 已改；Agent 会话未 replay |
| T2 | 2cv 零 KPI | **REAL** | 9/A | smoke + node：`kpi:0, cv:2` |
| T3 | 5 rhythm 可构建 | **REAL** | 9/A | node 脚本 5/5 ok |
| T4 | blocks 驱动拓扑差异 | **REAL** | 8/B | 1 cv vs 2 cv widget 数不同 |
| T5 | legacy 警告 | **REAL** | 8/B | `LEGACY_TEMPLATE` true |
| T6 | list_layout_rhythms | **REAL** | 8/B | smoke ok tool |
| T7 | 文档/契约同步 | PARTIAL | 5/C | LRC guide 有；COMPOSE-STYLE 未改 |
| T8 | live editor-save | **UNVERIFIED** | 3/D | 无 API 实测 |
| T9 | Agent 行为 | **UNVERIFIED** | 2/F | 未重装 0.4.3 回放 |
| T10 | Phase 1 清单闭环 | PARTIAL | 6/C | 缺 gate 反同质化、reference 迁移 |

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| rhythm-cv-stage | LRC | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | smoke + node 2cv/0kpi |
| rhythm-hero-stack | LRC | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | node metrics空→0 KPI |
| rhythm-split-focus | LRC | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | node build ok |
| rhythm-balanced-grid | LRC | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | node build ok |
| rhythm-minimal | LRC | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | node build ok |
| compose rhythm+blocks | API 参数 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | `resolveComposeLayout` |
| list_layout_rhythms | tool | ✅ | ❌ | ❌ | GATE | 2 | 2 | **REAL** | smoke export |
| LEGACY_TEMPLATE warn | compose | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | de-classic compose |
| agent-tools schema 21 | 登记 | ✅ | ❌ | ❌ | GATE | 2 | 2 | **REAL** | pytest 19 passed |
| release v0.4.3.zip | 交付 | ✅ | ❌ | ❌ | GATE | 2 | 2 | **REAL** | zip exists |
| live POST editor-save | E2E | ❌ | ❌ | ❌ | NONE | 0 | 0 | **UNVERIFIED** | 未跑 |
| 5173 2cv 屏渲染 | UI | ❌ | ❌ | ❌ | NONE | 0 | 0 | **UNVERIFIED** | 未跑 |
| Agent wf3 会话 | 行为 | ❌ | ❌ | ❌ | NONE | 0 | 0 | **UNVERIFIED** | 未 replay |
| COMPOSE-STYLE-WORKFLOW | 文档 | ✅ | ❌ | ❌ | GATE | 1 | 1 | **STUB** | 无 rhythm 章节 |
| gate KPI 反同质化 | 门禁 | ❌ | ❌ | ❌ | NONE | 0 | 0 | **STUB** | 裁决 step 6 未做 |
| de-* → reference/ | 降级 | ❌ | ❌ | ❌ | NONE | 0 | 0 | **STUB** | 仅 warn |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 16 |
| CHAIN 已验 | 8 |
| GATE only | 4 |
| UI / BROWSER | 0 |
| NONE（未验） | 4 |
| REAL 达标 | 10 / 16 |
| **逐一校验** | **否** — 4 项 NONE + 2 STUB；无 live/Agent/UI |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总（总体 T0）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| **T0 总体** | 2 | 2 | 1 | 1 | 1 | **7** | B | **PARTIAL** |

- **L=2**：布局引擎 CHAIN 证据充分。  
- **C=2**：T2/T3/T4 与预期一致（0 KPI、5 rhythm、拓扑可变）。  
- **D=1**：未验 editor-save 持久化与 5173 round-trip。  
- **E/F=1**：legacy warn 有；Agent 误用 template 无运行时拦截（仅 prompt）。

**打通但不对**：0（引擎层无）  
**假功能/未验**：live POST、5173 UI、Agent 行为、gate 反同质化

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `node scripts/smoke.mjs` | rhythm 用例绿 | `ok rhythm-cv-stage 2 customViz zero KPI row` 等 | ✅ | 2026-08-28 运行 |
| 2 | node 5 rhythm build | 5/5 成功，cv-stage 0 KPI | 5/5 ok，`heroStackZeroKpi:true` | ✅ | dist/layoutRhythm.js |
| 3 | legacy compose | LEGACY warn | `legacyWarn:true` | ✅ | resolveComposeLayout |
| 4 | topology diff | 1cv≠2cv widget | A=1,B=2（content widgets） | ✅ | node 脚本 |
| 5 | pytest integration | 19 passed | 19 passed | ✅ | backend/tests |
| 6 | live compose POST | dashboardId | 未执行 | ❌ | — |
| 7 | DeepTalk replay | rhythm 路径 | 未执行 | ❌ | — |

## 5. 修复文档（P0/P1）

### T8 — live editor-save 未验

**判定**：UNVERIFIED · C=0  
**期望 vs 实际**：compose 应 POST `:8000` 并返回 `ok dashboardId=`；本轮仅单元/离线 layout 构建。  
**修复方向**：在 `.dev` 环境跑一条 `vitalspan_compose_dashboard` rhythm+cv E2E；记入 auto-test receipt。  
**修后验收**：L=2 C=2 D=2 · REAL  

### T9 — Agent 仍可能走 legacy template

**判定**：UNVERIFIED（行为）· 机制 PARTIAL  
**根因**：prompt 改不等于 DeepTalk 已装 0.4.3 + 会话习惯；无 gate 强制 `rhythm=` stdout。  
**修复方向**：Phase 2：`completion_gate` 若 summary 含 template 且无 `rhythm=` → block；用户重装 zip 并 replay「2 组件拼屏」。  
**修后验收**：会话 stdout 含 `rhythm=rhythm-cv-stage`，无 `template=de-*`  

### T10 — COMPOSE-STYLE-WORKFLOW 未同步 LRC

**判定**：STUB  
**根因**：只新增 `LAYOUT-RHYTHM-CONTRACT.md`，未改 `COMPOSE-STYLE-WORKFLOW.md`。  
**修复方向**：wf3 默认路径改为 rhythm+blocks，template 标 legacy。  
**优先级**：P1  

### 裁决 step 5–6 未完成

**de-* reference 迁移**、**gate KPI_ROW 警告** — 未实现，不影响引擎但影响「完成 Phase 1 清单」表述。  
**优先级**：P1  

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T8 | live compose E2E 验证 dashboardId 落库 |
| P0 | T9 | 重装 0.4.3 + Agent replay「2 组件拼屏」须走 rhythm |
| P1 | T10 | 同步 COMPOSE-STYLE-WORKFLOW |
| P1 | — | completion_gate 可选强制 rhythm stdout |
| P2 | — | de-* 移 reference/ 目录 |

## 7. 交接

**结论：Phase 1 引擎「已完成」，产品级「未完成」。**

| 维度 | 状态 |
|------|------|
| **核心机制（0 KPI、blocks 驱动）** | ✅ CHAIN 已证 |
| **5 rhythm + compose API + 工具 + prompt** | ✅ 已交付 v0.4.3 |
| **live E2E + 5173 + Agent 行为** | ❌ 未验 |
| **文档/门禁收尾** | ⚠️ 部分缺口 |

- 建议：批准 P0 → 跑 live compose + Agent replay；或交接 `root-first-solve` 补 gate/文档。
- 发布包：`C:\Users\30381\Desktop\deeptalk-plugins\release\vitalspan-v0.4.3.zip`

## 8. Phase 1 对照清单（grounded 裁决 §8.5）

| 步 | 内容 | 状态 |
|----|------|------|
| 0 | LRC schema + 5 JSON + 文档 | **PARTIAL**（无独立 JSON schema 文件；guide+5 JSON 有） |
| 1 | layoutRhythm + 单测 | **DONE** |
| 2 | compose rhythm+blocks | **DONE**（离线） |
| 3 | list_layout_rhythms | **DONE** |
| 4 | AGENT prompt 改写 | **DONE** |
| 5 | de-* 降级 reference | **NOT DONE**（仅 LEGACY warn） |
| 6 | gate 反同质化 | **NOT DONE** |
| 7 | 平台 API | **N/A**（二期） |
