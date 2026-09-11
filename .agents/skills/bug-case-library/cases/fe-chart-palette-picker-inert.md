# 图表样式栏配色选择器点击无效

- **ID**: CASE-2026-07-17-001
- **状态**: 已修复
- **影响**: fe · 看板编辑 · 216px 图表样式栏 · ChartPalettePicker
- **首次发现**: 2026-07-17

## 症状

- 看板编辑 → 选中图表 → 样式 → 图表配色：内联列表（`chart-palette-inline-menu-panel`）可见
- 点击「品牌 / 清透 / …」无反应，或短暂选中后回弹为「默认」
- 432px 仪表板配置同色选择器正常
- 单测 `ChartPalettePicker.test.tsx` / `ChartStylePanel.test.tsx` 通过，实机失败

## 根因

1. **Inspector 写回竞态（主因）**：`patchDeStyle` 经父级 `onChange` 异步提交；columns reconcile / dataset binding effect 在父级 re-render 前用旧 `chartConfig` 再次 `onChange`，**最后一次写回无 paletteId**（单测 `toHaveBeenCalledWith` 只匹配某次调用 → 假绿）
2. **窄栏触控手势（次因）**：样式 Tab `touch-pan-y` + 嵌套滚动，实机轻点可能被当作滚动手势
3. **单测缺口**：未做 Provider → 父 state → re-render 闭环，未断言最后一次 `onChange`

## 错误做法（避免）

- 在 effect 中 `onChange` 前不通过 `emitChange` / `readChartConfig()` 读取最新配置
- 216px 交互区继续使用 `touch-pan-y` 而不对选项区设 `touch-manipulation` / `mousedown` 选型
- 仅用孤立 Picker 单测验收整条 inspector → widget 状态链

## 修复方式

- `ChartInspectorProvider.tsx`：新增 `emitChange`，在调用父级 `onChange` 前同步更新 `widgetRef.chartConfig`；`patchDeStyle` / context `onChange` 均走 `emitChange`
- `useChartInspectorState.ts`：columns reconcile / binding sync / 字段指派均 `readChartConfig()` + `emitChange`，避免 effect 覆盖 deStyle
- `ChartPaletteOptionList.tsx`：选项 `onClick` + `stopPropagation`
- `ChartPalettePicker.tsx`：内联面板 `touch-manipulation`
- `ChartInspectorTabs.tsx`：去掉样式面板 `touch-pan-y`
- `ChartInspectorProvider.palette.test.tsx` / `ChartStylePanel.test.tsx`：集成测 re-render + 最后一次写回

## 验证

```bash
cd fe && pnpm vitest run src/components/dashboard/ChartPalettePicker.test.tsx src/components/dashboard/ChartStylePanel.test.tsx src/components/dashboard/ChartInspectorProvider.palette.test.tsx src/components/dashboard/ChartInspectorTabs.test.tsx
```

## 关联

- `fe/src/components/dashboard/ChartPalettePicker.tsx`
- `fe/src/components/dashboard/useChartInspectorState.ts`
- `fe/src/components/dashboard/chartStyleSections/ChartCommonStyleSections.tsx`
- `.agents/skills/bug-case-library/cases/fe-color-field-picker-jump.md`（同类 Popover/重绘问题）
