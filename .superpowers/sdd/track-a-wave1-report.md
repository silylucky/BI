# Track A Wave1 Report — Tasks 1–2 (F-A + F-B)

**Status:** DONE

**Worktree:** `C:/Users/30381/Desktop/VitalSpan/.worktrees/grad-dash-ux`
**Branch:** `feat/grad-dash-ux`
**Base commit:** `f5b890b`

## Commits

| SHA | Message |
|---|---|
| `abb2bd7` | `feat(dash): edit-mode live ChartRenderer (M-DASH-UX F-A)` |
| `9808172` | `feat(dash): WidgetInspector ChartConfigPanel (F-B)` |

## Task 1 — F-A 编辑态真出图

- `fe/src/components/dashboard/DashboardWidget.tsx`：`mode === "edit"` 且 `isWidgetConfigReady(widget.chartConfig)` 为真时，改为渲染与 view 相同的 `ChartRenderer`（含 `filterParameters` / `executeKey` 透传）；未就绪保留精简待配置占位（`WidgetPendingPreview`，去掉了冗长的「保存布局后可在预览查看出图」文案分支，仅保留待配置态）。
- 复用 `ChartRenderer`，未新建执行器。
- TDD：先在 `dashboard.smoke.test.tsx` 新增两条红测（`F-A: edit mode with ready config renders live ChartRenderer...` / `F-A: edit mode with unready config still shows pending placeholder`），确认 fail 后再改实现，改后转绿。

## Task 2 — F-B WidgetInspector 嵌入 ChartConfigPanel

- `fe/src/components/dashboard/WidgetInspector.tsx`：在现有 Dataset/SQL 绑定 UI 下方新增「图表样式与字段」区块，嵌入既有 `ChartConfigPanel`（`columns={[]}`，`onChange` 直接接到 `WidgetInspector` 的 `onChange`，因两者 `ChartViewConfig` 全量结构一致，无需额外合并逻辑）。
- Wave1 范围内 `columns` 传空数组（沿 plan 里的 fallback 约定：无 schema 时维度/度量选择器禁用，样式子类型仍可编辑）；真实列拉取留给后续迭代。
- TDD：先在 `WidgetInspector.smoke.test.tsx` 新增两条红测（面板可见「样式子类型/维度字段/度量字段」；点击「添加筛选」验证 `onChange` 收到含 `filters` 的完整 config），确认 fail 后再改实现，改后转绿。
- 文件行数：`WidgetInspector.tsx` 现为 300 行，贴到软上限但未超出。

## Test Summary

- 聚焦套件：`dashboard.smoke.test.tsx`（24/24）+ `WidgetInspector.smoke.test.tsx`（4/4）+ `charts.*`（37/37）全绿，合计 71/71 通过。
- 全量 `vitest run`：297 项中 293 通过、4 失败，失败均在 `src/routes.smoke.test.tsx`（`@/lib/api` mock 未导出 `ApiRequestError`，导致 `DashboardListPage` 错误路径抛出未处理异常）；已在**基线 commit `f5b890b`（未改动前的主仓库）**复现同样 4 项失败，确认为预置缺陷，与本轮 Task 1/2 改动无关，未修复（超出 brief 范围）。
- `tsc -b --noEmit`：存在 8 处基线既有报错（`DashboardGrid.tsx` / `nav-manifest.tsx` / `resolve-nav.test.ts` / `routes.smoke.test.tsx` 的未用变量与一处 DragEvent 类型问题），均不在本次改动文件内，未处理。

## Concerns

1. `src/routes.smoke.test.tsx` 4 项预置失败（详见上）——建议后续（Controller 或 Track B）补 `ApiRequestError` 到该文件的 `@/lib/api` mock 导出中。
2. Task 2 中 `ChartConfigPanel` 的 `columns` 暂为空数组，维度/度量字段选择器在 Inspector 中禁用（仅样式子类型可编辑）；如需要 Inspector 内真实列驱动的字段选择，需后续接入 `useChartExecute` 或轻量 schema 接口（brief 明确允许此 Wave1 简化）。
3. 未触碰 `docs/api`、`docs/ui`（按 brief 约束），未实现撤销/重做与筛选（Task 3–4，Wave2 范围）。
4. `WidgetInspector.tsx` 改动后恰好 300 行，已到软上限，后续若再加字段建议拆分子模块。
