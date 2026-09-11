# 看板图表组件「effectiveScheme is not defined」致数据不显示

- **ID**: CASE-2026-07-15-003
- **状态**: 已修复
- **影响**: fe / dashboard edit / pixel canvas widgets
- **首次发现**: 2026-07-15

## 症状

- 编辑页多个图表组件显示「无法渲染」，`effectiveScheme is not defined`
- 富文本等非 chart 组件正常
- 部分组件另显示 `Failed to fetch`（前端 dev 未运行或 API 不可达）

## 根因

1. **主题推断分散**：`mergeChartTitleStyle(..., effectiveScheme)` 在局部引入 `effectiveScheme` 变量，HMR 半更新时曾出现「引用未定义」中间态。
2. **壳层/内容分层后**：`PixelShape` 仍用 `colorScheme` 而非组件实底推断主题，与标题样式不一致。
3. **Failed to fetch**：Vite dev 崩溃或未代理 `/api` 时，原生 fetch 错误直接展示，用户误以为「数据丢失」。

## 修复

- 新增 `resolveWidgetEffectiveScheme(styleConfig)`（`chartSurfaceTheme.ts`）作为唯一入口
- `DashboardWidget` / `PixelShape.resolveShapeTitleState` / shell 样式统一调用
- `useChartExecute` 将网络错误映射为可读提示

## 验证

- `chartSurfaceTheme.test.ts` 覆盖 `resolveWidgetEffectiveScheme`
- 硬刷新编辑页：图表不再因 ReferenceError 白屏；API 可达时数据正常加载
