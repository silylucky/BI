# Graduation Design — M-DASH-UX + M-PRODUCT 最小毕业

> 日期：2026-07-09 · 无人值守编排 · 用户授权跳过确认门

## 1. 现状结论（PRD 对账）

| 层 | 状态 | 说明 |
|----|------|------|
| PRD 合同 129 项 | **已实现** | hub `feature_count: 129`；分片验收标准合同项已勾 |
| plan §M-DASH-UX | **当前缺口** | 编辑体验 companion：9 必做 + 2 可选（稳定性已勾 1） |
| plan §M-PRODUCT | **排队** | F-D E2E 4 + F-E docs 2；**F-F 18 项非默认 gate（毕业不含）** |
| 代码证据（2026-07-09 实扫） | **部分已落地** | F-A/F-B 已 merge（`abb2bd7`/`9808172`/`9543c5f`）：编辑态 `ChartRenderer` + `WidgetInspector` 嵌 `ChartConfigPanel`；**仍缺** F-C 撤销/重做、F-D 编辑页 `GlobalFilterBar`（`loadFilters` 仍 `mode==="view"` 早退） |

**毕业定义（本轮）**：完成 M-DASH-UX 全部必做 + M-PRODUCT F-E 文档对账 + M-PRODUCT F-D 书面 E2E 记录（可 mock/脚本）。**不含** F-F 深度 companion、对齐/多选、组件联动、AI/SQLBot。

## 2. 推荐方案（已选定）

**方案 B — 接线优先 + 双 worktree 并行**

| 轨道 | 范围 | 依赖 |
|------|------|------|
| Track A `feat/grad-dash-ux` | F-A → F-B → F-C undo → F-D 筛选 | 串行于同一 FE 编辑面 |
| Track B `feat/grad-docs-e2e` | F-E API/layout 对账 → F-D 书面 E2E 模板 | 与 Track A 文件无冲突 |

备选否决：
- A 全串行：太慢
- C 含 F-F：超毕业范围、与 plan gate 冲突

## 3. 架构要点

1. **F-A**：`mode==="edit"` 且 `isWidgetConfigReady` → 渲染 `ChartRenderer`（复用 `useChartExecute`）；未就绪保留轻量待配置态。
2. **F-B**：`WidgetInspector` 增加「数据/样式」Tab，嵌入已有 `ChartConfigPanel`；`onChange` 回写 `chartConfig`。
3. **F-C**：编辑页维护 undo/redo 栈（布局指纹变更 push）；Ctrl+Z / 工具栏按钮。
4. **F-D**：`loadFilters` 去掉 `mode!=="view"` 早退；编辑页挂载 `GlobalFilterBar`。
5. **F-E**：`docs/api/README.md` 公开路径与 `AuthMiddleware` 对齐；`layout.md` 与 nav 已基本同步则补漏勾。
6. **F-D E2E**：在 `docs/automate/plans/` 写书面 pass 记录（无 live 环境时标注 mock/跳过条件）。

## 4. 非目标

- M-PRODUCT F-F 18 项
- DASH-002 对齐/多选、DASH-004 组件联动（plan 可选）
- 新建查询执行器 / 重写 ChartConfigPanel
- 修改 `goal.md`

## 5. 验收

- vitest：dashboard / charts / WidgetInspector 相关绿
- plan.md 勾选对应 companion 行
- hub 执行范围可回写收官状态（收官后）
