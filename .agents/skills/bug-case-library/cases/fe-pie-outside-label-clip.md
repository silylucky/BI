# 饼图/玫瑰图外标签被裁切叠字

- **ID**: CASE-2026-08-17-001
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-17

## 症状

- 组件库编辑页玫瑰图（外置标签：维度 + 数值 + 占比）左侧省名被裁成「省 xxx」，标签互相遮挡。
- SVG 虽 `overflow: visible`，父级 `embedded-chart-live-surface` 为 `overflow: hidden`。

## 根因

- 高画布上 `maxR = min(innerW, innerH) / 2` 几乎占满宽度。
- 左右只额外预留最多 96px，不够「海南省 48,102 (2.20%)」+ 引线。
- 外标签布局只做纵向避让，越出画布左右仍绘制。

## 错误做法（避免）

- 只加大固定左右边距、不按最长标签宽度收缩半径。
- 依赖 SVG `overflow: visible` 穿过 `overflow: hidden` 的预览容器。

## 修复方式

- `capPieRadiusForOutsideLabels`：按最长外标签占用把 `maxR` 压进左右可用宽度。
- `layoutPieOutsideLabels` 增加 `xmin`/`xmax`，越界标签隐藏。

## 验证

- `pnpm exec vitest run src/components/charts/engine/d3/radial/pieLayout.test.ts src/components/charts/engine/d3/radial/pieLabels.test.ts src/components/charts/engine/d3/radial/renderPie.test.ts`

## 关联

- `fe/src/components/charts/engine/d3/radial/pieLayout.ts`
- `fe/src/components/charts/engine/d3/radial/pieLabels.ts`
- `fe/src/components/charts/engine/d3/radial/renderPie.ts`
