# Graduation Dash-UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 M-DASH-UX 必做 companion + M-PRODUCT F-E 文档对账 + F-D 书面 E2E，使项目达到「最小毕业」可演示态。

**Architecture:** 接线优先——编辑态复用 `ChartRenderer`/`useChartExecute`/`ChartConfigPanel`/`GlobalFilterBar`；双 worktree 并行（FE 编辑轨 vs 文档/E2E 轨）。

**Tech Stack:** React + TanStack Query + vitest；FastAPI 文档只读对账；git worktree。

## Global Constraints

- 前端根目录仅 `fe/`；API 前缀 `/api/v1/`；零第三方 BI 运行时
- 禁止新建查询执行器；必须复用 `useChartExecute` / `ChartRenderer` / `ChartConfigPanel`
- 禁止实现 M-PRODUCT F-F、对齐/多选、组件联动、AI/SQLBot
- 单文件 fe ≤300 行软约束；超限拆私有模块
- 设计系统：`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- 每任务结束：聚焦 vitest 绿 + commit；报告写入指定 report 文件
- plan 勾选格式：`- [x] <ID>: …（完成于 2026-07-09）`
- 工作目录：各自 worktree 根；基线分支 `dev-auto`

---

## Track A — `feat/grad-dash-ux`（FE 编辑体验）

### Task 1: F-A 编辑态真出图

**Files:**
- Modify: `fe/src/components/dashboard/DashboardWidget.tsx`
- Modify: `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`（或现有 dashboard smoke）
- Test: 新增断言 edit 模式配置就绪时渲染 ChartRenderer / 不显示「仅预览才出图」文案

**Steps:**
1. 写失败测试：edit + ready config → 应出现 chart 容器 / 不应出现「保存布局后可在预览查看出图」
2. 改 `DashboardWidget`：`mode==="edit"` 且 `isWidgetConfigReady(widget.chartConfig)` → 渲染与 view 相同的 `ChartRenderer`（含 filterParameters/executeKey）；未就绪保留精简待配置态（可删冗长 WidgetEditPreview 文案）
3. 跑 vitest 相关文件至绿
4. Commit: `feat(dash): edit-mode live ChartRenderer (M-DASH-UX F-A)`

**Acceptance:** VIZ-002 · QUERY-005 · QUERY-009 · META-004 · VIZ-008 行为在编辑页可感知（配置变更经 props 刷新即可；loading/error 走 ChartPanel）

---

### Task 2: F-B WidgetInspector 嵌入 ChartConfigPanel

**Files:**
- Modify: `fe/src/components/dashboard/WidgetInspector.tsx`
- Modify/Create: `fe/src/components/dashboard/WidgetInspector.smoke.test.tsx`
- Reuse: `fe/src/components/charts/ChartConfigPanel.tsx`

**Steps:**
1. 写失败测试：选中 widget 可见「数据」「样式」相关 Tab/控件（或 ChartConfigPanel 字段）
2. 在现有 Dataset/SQL 配置下方或 Tabs 内嵌入 `ChartConfigPanel`；columns 可先空数组或从轻量 schema 拉取（若无列则 panel 仍可改 styleVariant）
3. `onChange` 合并回 `chartConfig`
4. vitest 绿 + commit: `feat(dash): WidgetInspector ChartConfigPanel tabs (F-B)`

**Acceptance:** VIZ-005 · VIZ-004

---

### Task 3: F-C 布局撤销/重做

**Files:**
- Modify: `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- Optional helper: `fe/src/components/dashboard/layoutHistory.ts`（若页面过大）
- Test: dashboard smoke 覆盖 undo 后 widgets 恢复

**Steps:**
1. 维护 past/future 栈；widgets 变更时 push（跳过相同 fingerprint）
2. 工具栏「撤销/重做」+ Ctrl+Z / Ctrl+Y（或 Ctrl+Shift+Z）
3. vitest + commit: `feat(dash): layout undo/redo (F-C)`

**Acceptance:** DASH-002 撤销必做行

---

### Task 4: F-D 编辑页全局筛选

**Files:**
- Modify: `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`（`loadFilters` 去掉 mode 早退；edit 也挂 GlobalFilterBar）
- Test: smoke 断言 edit 模式会请求 global-filters 或渲染筛选条

**Steps:**
1. `loadFilters`：`if (!id) return`（允许 edit）
2. edit 布局中在画布上方渲染 `GlobalFilterBar`（与 view 一致）
3. vitest + commit: `feat(dash): edit-mode GlobalFilterBar (F-D)`

**Acceptance:** DASH-004 筛选必做行

---

### Task 5: Track A plan 勾选 + 文档锚点

**Files:**
- Modify: `docs/automate/plan.md`（勾选 F-A/B/C必做/D必做）
- Optional: `docs/automate/prd/F06-VIZ.md` / `F07-DASH.md` 演化建议补一句编辑态接线（仅若行为描述需同步）

**Steps:**
1. 勾选对应行（完成于 2026-07-09）
2. Commit: `docs(plan): check M-DASH-UX must-do after FE graduation`

---

## Track B — `feat/grad-docs-e2e`（文档 + 书面 E2E）

### Task 6: F-E API auth 对账

**Files:**
- Modify: `docs/api/README.md`
- Read: `backend/app/auth/middleware.py`（或等价公开路径列表）

**Steps:**
1. 对照 AuthMiddleware 公开路径，更新 README 顶部/相关行状态（`/docs` `/redoc` `/openapi.json` `/health` 等）
2. Commit: `docs(api): align public paths with AuthMiddleware (F-E)`

**Acceptance:** API-007

---

### Task 7: F-E layout.md 对账

**Files:**
- Modify: `docs/ui/layout.md`（若已与 nav-manifest 一致则仅补 DS-007 勾选说明）
- Read: `fe/src/config/nav-manifest.tsx`

**Steps:**
1. 核对侧栏分组与 F-B taxonomy 文案；修漂移
2. Commit: `docs(ui): layout.md nav sync (F-E DS-007)`

**Acceptance:** DS-007 layout 行

---

### Task 8: F-D 书面 E2E pass 记录

**Files:**
- Create: `docs/automate/plans/2026-07-09-graduation-e2e-pass.md`
- Modify: `docs/automate/plan.md`（勾选 M-PRODUCT F-D 四行，注明书面记录路径；若无法 live 跑则写「条件通过/跳过原因」）

**Steps:**
1. 按 goal P4-SMOKE / DATA-SMOKE 四行写检查表；无环境则标记 blocked-by-env 与复现命令
2. Commit: `docs(e2e): graduation written pass record (M-PRODUCT F-D)`

---

## Merge / 收官（Controller）

### Task 9: 合并双轨 → 更新 hub

1. 将两分支 squash/merge 回 `dev-auto`（或开 PR）
2. 更新 `docs/automate/prd.md` 执行范围：M-DASH-UX 收官；M-PRODUCT F-D/E 勾选状态
3. 更新 `.superpowers/sdd/progress.md`

---

## Parallel Dispatch Map

```
Wave 1 (parallel worktrees):
  Track A Task 1–2  ||  Track B Task 6–7
Wave 2 (after A1–2):
  Track A Task 3–4  ||  Track B Task 8
Wave 3 (controller):
  Track A Task 5 + Task 9 merge
```
