# 表格样式三缺口：测试先行但未接线

- **ID**: CASE-2026-08-06-004
- **状态**: 已修复
- **影响**: fe / table-info|normal|pivot 样式面板与渲染
- **首次发现**: 2026-08-06

## 症状

用户反馈表格类组件：

- 表头与底部分页条不跟随整体/组件透明度（实色 `#f9fafb` 盖住透明底）
- 样式面板无表头/单元格字号设置（仅分页器字号）
- 无像图表一样的「配色方案」一键预设（只能逐字段取色）

## 根因

18:12 提交（`cb5ceaaf`）**测试与 lib 半成品已入库，实现与 UI 未接线**：

- `softenTableChromeBg` 有单测但 `resolveTableThemeVars` 未调用
- `headerFontSize` / `bodyFontSize` / `tablePaletteId` 测试引用但类型与 patch 函数不存在
- `TABLE_PALETTE_CATALOG` 已映射 7 套预设，面板未挂载 `ChartPalettePicker`

## 修复方式

- `resolveTableThemeVars`：未显式 `bodyBg` 时对 header/footer/body/column 走 `softenTableChromeBg`；去掉 thead/分页 fallback 实色
- `ChartDeTableStyle` 增 `headerFontSize` / `bodyFontSize` / `tablePaletteId`；面板加字号选择与配色方案
- `mergeChartTableStyle(chart, dash, scheme)` + `patchChartDeTablePalette`；`ChartTableColorPanel` 挂 `ChartPalettePicker`

## 验证

- `chartSurfaceTheme.table.test.ts` · `chartTablePalette.test.ts` · `D3TableView.tableStyle.test.tsx` · `ChartTableColorPanel.test.tsx` 转绿

## 教训

**测试先行必须同 PR 接线实现与 UI**，否则长期假红无人跑，用户侧表现为「功能消失/从未有过」。lib 层半成品（函数写了、调用没写）比完全没做更难排查。

## 关联

- `fe/src/lib/chartSurfaceTheme.ts` · `chartDeTableStyle.ts` · `chartTablePalette.ts`
- `fe/src/components/dashboard/ChartTableColorPanel.tsx`
