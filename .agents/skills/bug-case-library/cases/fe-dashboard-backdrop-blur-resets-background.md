# 背景模糊滑块重置背景色/背景图

## 症状

- 样式 Tab「背景」→「外观」里调整「背景模糊」后，自定义背景色与背景图被还原为旧值或主题默认
- 多发生在刚改完背景色/底图后立刻拖模糊滑块，或看板全局「图表样式」与单图样式交替编辑时

## 根因（L1 代码证据）

| 层级 | 原因 | 证据 |
|------|------|------|
| 状态合并 | `patchWidgetStyle` / `patchBackground` 闭包捕获渲染时的 `ws`/`cfg`，只 patch `{ backdropBlur }` 时把**旧** nested 对象写回 | `dashboardConfigPanels.tsx` · `ChartCommonStyleSections.tsx` |
| 渲染路径 | `buildWidgetBackgroundPresentation` 将 `backgroundImage` 只放在 `imageLayer`，`applyBackgroundOpacityOnly` 在 `backdropBlur>0` 时走毛玻璃分支，未识别底图 | `widgetStylePresentation.ts` · `widgetSurfaceBackground.ts` |
| CSS 层叠 | 模糊开启后 `backgroundLayer` 同时写入 `background` 简写与 `backgroundImage`，简写会清掉底图，只剩 `var(--dashboard-widget-surface)` 暗色底 | `widgetSurfaceBackground.ts` `applyBackgroundPaintToLayer` |

## 修复

1. **看板配置**：`DashboardContextInspector.patchStyle` 支持 `(prev) => patch` 函数式更新；`patchWidgetStyle` 基于 `prev.widgetStyle` 合并
2. **图表检查器**：`ChartInspectorProvider` 提供 `patchDeStyleNested` / `mutateChartConfig`，始终读取最新 `widget.chartConfig`
3. **呈现层**：底图写入 `style.backgroundImage` 后再走 `applyBackgroundOpacityOnly`；毛玻璃保留用户 `opacity`
4. **CSS 层叠**：有底图时只用 `backgroundColor` 铺底色，禁止在同层写 `background` 简写（避免覆盖 `backgroundImage`）
5. **模糊语义**：有底图时用 `filter: blur()` 模糊底图；无毛玻璃底图时用 `backdrop-filter` 模糊画布，且 `pixel-shape-inner` 保持透明

## 回归测试

- `widgetSurfaceBackground.test.ts`：blur + image / blur + 自定义 opacity
- `chartDeStyle.test.ts`：`widgetStyleToContentCss` 保留底色与底图
- `dashboardOverallConfigPanel.test.ts`：widgetStyle patch 为函数式
