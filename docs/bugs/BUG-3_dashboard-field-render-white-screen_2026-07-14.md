# BUG-3：看板字段拖放白屏与图表渲染失效

> 登记：2026-07-14 · 状态：**fixed**

## 症状

- 编辑页从字段库拖入维度/指标槽位后，整页 `#root` 变空白
- 图表配置完成后仍不出图，或 pie 显示为 bar、指标缺列时全 0
- 「更新图表数据」按钮无实际 refetch 效果

## 根因（三类）

| 类型 | 原因 | 证据 |
|------|------|------|
| 编译白屏 | `DashboardSharePage.tsx` import 语法错误 | Vite overlay，`Unexpected keyword 'import'` |
| 运行时白屏 | `TextWidget` 缺 import + 无 Error Boundary | Console `ReferenceError: textConfigToHtml is not defined` |
| 渲染契约失配 | ready 不一致、假字段、validate≠refetch、pie 走 Apex | 代码审查 + 集成测试缺口 |

## 修复摘要

- 统一 `isWidgetConfigReady` ↔ `isChartExecuteReady`
- 新图表默认空 `dimensions/metrics`，列变化时 reconcile 无效字段
- `buildChartRenderModel` 字段级校验；pie 走 ECharts
- 「更新图表数据」校验后 refetch + `chartRefreshKeys`
- `WidgetErrorBoundary` widget 级隔离
- Dataset execute 传递 `parameters` 与 `limit`

## 代码锚点

- `fe/src/lib/chartConfigState.ts`
- `fe/src/lib/buildChartRenderModel.ts`
- `fe/src/components/dashboard/WidgetErrorBoundary.tsx`
- `fe/src/components/charts/ChartRenderer.tsx`
- `fe/src/components/dashboard/ChartEditorColumn.tsx`

## 回归

- `fe/src/lib/buildChartRenderModel.test.ts`
- `fe/src/lib/chartConfigState.test.ts`
- `fe/src/components/dashboard/WidgetErrorBoundary.test.tsx`
- `fe/src/components/dashboard/dashboard-field-drag.integration.test.tsx`
