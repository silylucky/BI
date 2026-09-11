# Feature Truth Audit: wf3 LRC v0.4.4（Layout Rhythm Contract · 修复后复验）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| 核验范围 | v0.4.4：`rhythm` + `blocks` compose、5 LRC、gate 强制、live E2E、5173 渲染 |
| 锚点 | `deeptalk-plugins/.../layoutRhythm.ts` · `completion_gate.py` · `compose-rhythm-e2e.mjs` |
| 总体判定 | **PARTIAL**（机制链 REAL；Agent 宿主 replay 仍待用户重装 zip） |
| **总分 / 档位** | **8/10 · B+** |
| 状态 | **verified-after-fix** |
| **sampling** | `full` |

## 修复摘要（用户批准 P0/P1）

| ID | 修复 | 状态 |
|----|------|------|
| T8 | live compose → `editor-save` | ✅ `compose-rhythm-e2e.mjs` · `dashboardId=4ae95bc0-…` |
| T9 | gate 强制 rhythm / 拦 legacy | ✅ `completion_gate` + smoke |
| T10 | `COMPOSE-STYLE-WORKFLOW.md` LRC | ✅ 已重写 |
| P1 | de-* 降级 reference | ✅ `layout-templates/index.json` · `COMPOSE-TEMPLATES-DE.md` |
| P1 | `layout-rhythm.schema.json` | ✅ 已创建 |
| P1 | `route_request` wf3 → rhythm | ✅ `rhythm-cv-stage` |

**发布包**：`deeptalk-plugins/release/vitalspan-v0.4.4.zip`

## 3d. 覆盖矩阵（复验）

| 实体 ID | GATE | CHAIN | UI | 深度 | 判定 | 证据 |
|---------|------|-------|-----|------|------|------|
| rhythm-cv-stage | ✅ | ✅ | ✅ | UI | **REAL** | smoke + live E2E + 5173 截图 |
| compose rhythm+blocks | ✅ | ✅ | ✅ | UI | **REAL** | editor-save 200 · 2cv · kpi=0 |
| completion_gate LRC | ✅ | ✅ | ❌ | CHAIN | **REAL** | pytest + smoke 拦 legacy |
| live POST editor-save | ✅ | ✅ | ✅ | UI | **REAL** | e2e script + GET 回读 |
| 5173 2cv 屏 | ❌ | ✅ | ✅ | UI | **REAL** | 图层 4 项（标题+时钟+2cv），无 KPI |
| COMPOSE-STYLE-WORKFLOW | ✅ | ❌ | ❌ | GATE | **REAL** | LRC 默认路径 |
| gate KPI 反同质化 | ✅ | ✅ | ❌ | CHAIN | **REAL** | kpi>=4 非 hero-stack 拒绝 |
| Agent wf3 会话 replay | ❌ | ❌ | ❌ | NONE | **UNVERIFIED** | 需 DeepTalk 装 0.4.4 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 16 |
| REAL 达标 | **14 / 16** |
| NONE 剩余 | 1（Agent 宿主 replay） |
| **逐一校验** | **否** — Agent 行为依赖用户重装插件 |
| 打通但不对 | **0** |

## 动态验证（修复后）

| 步骤 | 期望 | 实际 | 一致 |
|------|------|------|------|
| `node scripts/compose-rhythm-e2e.mjs` | dashboardId + kpi=0 + gate pass | ✅ 见 stdout | ✅ |
| `pytest test_wf3_lrc_compose_e2e.py` | 4 passed | 4 passed | ✅ |
| `npm run smoke` | rhythm + gate LRC | 绿 | ✅ |
| 5173 `/admin/data-screens/…/edit` | 2 cv、无四 KPI | 图层 2 customViz + 标题/时钟 | ✅ |

## 五维（T0 总体）

| L | C | D | E | F | 总分 | 档位 | 真假 |
|---|---|---|---|---|------|------|------|
| 2 | 2 | 2 | 2 | 1 | **9→扣 Agent** **8** | B+ | **PARTIAL** |

- **F=1**：DeepTalk 宿主仍可能装 0.4.2；须用户安装 `vitalspan-v0.4.4.zip` 并 replay「2 组件拼屏」。

## 剩余 P0（用户侧重）

1. DeepTalk 安装 **v0.4.4** zip 并重启
2. Agent 会话 replay：stdout 须 `rhythm=rhythm-cv-stage`，gate 过，summary 不提 de-sales 模板

## 文档

- 初审计：`2026-08-28-wf3-lrc-v043-truth-audit.md`
- 本复验：修复后链路与 UI 证据
