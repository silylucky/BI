# FE 看板拖入字段后整页白屏

## 症状

- 编辑页从右侧字段库拖入维度/指标槽位（或点击字段填入）后，`#root` 变空，整页白屏
- 浏览器 Console 可见 `ReferenceError: textConfigToHtml is not defined`（或 `isRichTextEmpty is not defined`）
- 现象与「图表字段配置」强相关，但根因不一定在 Chart 组件本身

## 根因（分层）

1. **编译白屏**：`DashboardSharePage.tsx` 曾把 `import` 插入 `import type { ... }` 块内 → Vite 编译失败、整页 `#root` 清空。
2. **运行时白屏**：`TextWidget.tsx` 使用 `textConfigToHtml` / `isRichTextEmpty` 却未 import → 字段拖放触发 `setWidgets` 重渲染时富文本组件抛错；无 widget 级 Error Boundary → 整树崩溃。
3. **图表不可用**：ready 判定不一致、默认假字段 `x/y`、更新按钮只 validate 不 refetch、缺列静默变 0、pie 走 Apex bar 分支。

## 修复

- `TextWidget.tsx`：补回 `richTextHtml` import。
- `DashboardSharePage.tsx`：修正 import 块。
- `chartConfigState.ts` / `buildChartRenderModel.ts`：统一 binding/query/render 状态与字段映射校验。
- `ChartRenderer.tsx`：pie 走 ECharts；显式字段级错误；palette/queryLimit 生效。
- `ChartEditorColumn.tsx`：「更新图表数据」校验后 refetch。
- `WidgetErrorBoundary.tsx`：widget 级异常隔离。

## 锚点

- `fe/src/lib/chartConfigState.ts`
- `fe/src/lib/buildChartRenderModel.ts`
- `fe/src/components/dashboard/WidgetErrorBoundary.tsx`
- `fe/src/components/charts/ChartRenderer.tsx`
- 回归：`dashboard-field-drag.integration.test.tsx`、`WidgetErrorBoundary.test.tsx`、`buildChartRenderModel.test.ts`
