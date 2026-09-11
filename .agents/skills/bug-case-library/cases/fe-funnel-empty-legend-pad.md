# 漏斗关闭图例仍留空带

- **ID**: CASE-2026-08-14-008
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-14

## 症状

- 漏斗图关闭图例后，底部/四周仍有大块空白；图形又小又挤。

## 根因

- `reserveLegendMargin` 在 `items=[]` 但传入 `legendLayout` 时仍按占位行高扩边。
- 漏斗使用饼/径向 `24px` 边距，且层间距从高度里扣了却没画出来。

## 错误做法（避免）

- 无图例项时仍按 fallback 行高留白。
- 无坐标轴的图套用径向大边距。

## 修复方式

- 空 items 不扩边；漏斗用 8px 贴边；层间真实 gap；窄层标签外置。

## 验证

- `pnpm exec vitest run src/components/charts/engine/d3/flow/renderFunnel.test.ts src/components/charts/engine/d3/core/d3Legend.test.ts`

## 关联

- `fe/src/components/charts/engine/d3/flow/renderFunnel.ts`
- `fe/src/components/charts/engine/d3/core/d3Legend.ts`
