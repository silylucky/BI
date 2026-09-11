# Dashboard UX 减法 + 加厚 — 收尾计划

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-10  
输入：DE/SS 对标「减法（nav/capability）+ 加厚（Dataset→Dashboard）」首轮实现（未提交）  
真理源：`docs/ui/layout.md` v1.2.4 · `fe/src/config/nav-manifest.tsx` · `fe/src/routes.tsx`

> **验收结论（A6 completion-gate）**：核心 P0 **已实现但未收官** — 功能代码在 working tree，聚焦 vitest 35/35 + `tsc -b` 通过；缺回归测试、快速创建字段预填、文档组件登记。

---

## 当前完成度矩阵

| 轨 | 项 | 状态 | 证据 |
|----|-----|------|------|
| A | `RequireCapabilityName` 路由守卫 | ✅ 已实现 | `fe/src/routes.tsx` |
| A | 工程页 `iaPriority: advanced` | ⚠️ 部分 | 实体/图表目录/设计器已标；治理流程子项未标 |
| A | analyst/viewer 工程分组隐藏 | ✅ 已有 | `resolve-nav.ts` `iaTier: engineering` |
| B | `useInspectorColumns` → ChartConfigPanel | ✅ 已实现 | `fe/src/hooks/useInspectorColumns.ts` |
| B | `DashboardQuickCreateDialog` | ⚠️ 部分 | 向导可创建+插 widget；**未探测 columns 预填维度/度量** |
| B | 列表页接入向导 | ✅ 已实现 | `DashboardListPage.tsx` |
| C | `layout.md` IA 叙事 | ✅ 已更新 | v1.2.4 |
| — | 回归测试 | ❌ 缺失 | 无 QuickCreate / capability / columns 用例 |
| — | `components/README.md` | ❌ 未同步 | 新 hook/组件未登记 |
| — | Git 提交 | ❌ 未提交 | 7 modified + 3 untracked |

---

## 非目标（本轮不做）

- 轻量 SQL Lab / Dataset 编辑页加厚（原 P1 可选）
- admin 侧栏「高级分组默认折叠」UI（需改 `app-sidebar`，单独迭代）
- `/dashboards/:id/preview` 路由补齐（与 view 模式重复，改 layout 文档即可）
- 并发重构计划 `2026-07-09-concurrent-refactor-plan.md`（另一工作流）

---

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| columns 探测复用 | 抽取 `fetchChartColumns(cfg)` 到 `fe/src/lib/chartExecuteProbe.ts` | 消除 `useInspectorColumns` 与 `useChartExecute` 重复 |
| 快速创建预填 | 创建前 `POST execute` 取前两列作 dim/metric | 对标 DE 三步出图体验 |
| 路由守卫测试 | 扩展现有 `routes.smoke.test.tsx` 或新建 `require-capability.test.tsx` | 防 capability 漂移 |
| PRD | 仅更新 `layout.md` + `components/README` | 行为属 post-graduation UX polish，不改 plan companion |

---

## 改动清单（按执行顺序）

### Task 1 · 抽取 chart columns 探测共享函数

| 字段 | 内容 |
|------|------|
| **文件** | 新建 `fe/src/lib/chartExecuteProbe.ts`；改 `fe/src/hooks/useInspectorColumns.ts`；改 `fe/src/components/charts/useChartExecute.ts`（import 共享，行为不变） |
| **改动** | 将 dataset/sql execute 请求体构建与 `apiFetch` 调用抽为 `fetchChartExecuteResult(config, opts?)` |
| **验收** | `vitest` chartViewConfig + useChartExecute 相关测试仍绿；`tsc -b` 通过 |

### Task 2 · 快速创建向导预填维度/度量

| 字段 | 内容 |
|------|------|
| **文件** | `fe/src/components/dashboard/DashboardQuickCreateDialog.tsx` |
| **改动** | `createMutation` 内在 PUT layout 前调用 `fetchChartExecuteResult`；`suggestFields(columns, chartType)` 写入 widget `chartConfig` |
| **验收** | 新建 smoke：`mock execute 返回 columns` → 断言 PUT body 含 dimensions/metrics |

### Task 3 · 回归测试补齐

| 字段 | 内容 |
|------|------|
| **文件** | 新建 `fe/src/components/dashboard/DashboardQuickCreateDialog.smoke.test.tsx`；新建 `fe/src/components/auth/require-capability.test.tsx`；扩展 `WidgetInspector.smoke.test.tsx`（columns 路径 mock） |
| **用例** | ① QuickCreate 打开/选 Dataset/创建 navigate；② analyst 无 `governance:*` 时守卫重定向；③ Inspector 绑定 configId 后 columns 传入 ChartConfigPanel |
| **验收** | `npx vitest run` 上述 3 文件 exit 0 |

### Task 4 · Nav 减法补全 + 文档登记

| 字段 | 内容 |
|------|------|
| **文件** | `fe/src/config/nav-manifest.tsx`（治理流程 item 加 `iaPriority: advanced`）；`fe/src/components/README.md`；`docs/ui/layout.md`（删除或标注 preview 路由为「规划未实现」） |
| **验收** | `resolve-nav.test.ts` 仍 25/25；README 含 QuickCreate / useInspectorColumns / WidgetInspectorDataSection |

### Task 5 · completion-gate 全量收口

| 字段 | 内容 |
|------|------|
| **命令** | `cd fe && npx vitest run src/components/dashboard/ src/components/auth/require-capability.test.tsx src/lib/resolve-nav.test.ts --pool=forks --poolOptions.forks.singleFork=true` |
| | `cd fe && npx tsc -b --noEmit` |
| **验收** | 全绿；更新 `docs/automate/evolution-state.md` phase=DONE |

---

## 八维度自审

| 维度 | 结论 |
|------|------|
| 范围 | 仅 FE + layout/components README，无后端契约变更 |
| 依赖 | Task 1 阻塞 Task 2；Task 3 可与 Task 4 并行 |
| 风险 | execute 探测失败时降级为空 fields（与现行为一致） |
| 回退 | 各 task 可独立 revert |
| 测试 | Task 3 为收官门禁 |
| 文档 | Task 4 同步 |
| 体量 | 新文件均 <200 行，符合 fe-ui 软约束 |
| 安全 | 无新公开面；capability 守卫加强 |

---

## 整体验证方案

```bash
cd fe
npx vitest run \
  src/components/dashboard/DashboardQuickCreateDialog.smoke.test.tsx \
  src/components/dashboard/WidgetInspector.smoke.test.tsx \
  src/components/auth/require-capability.test.tsx \
  src/lib/resolve-nav.test.ts \
  --pool=forks --poolOptions.forks.singleFork=true
npx tsc -b --noEmit
```

手动：admin 登录 → Dashboard 列表「新建看板」→ 选数据源+Dataset → 进入 edit → Inspector 选字段可用。

---

## 推荐模型

`composer-2.5`（FE 小步 + vitest 为主）
