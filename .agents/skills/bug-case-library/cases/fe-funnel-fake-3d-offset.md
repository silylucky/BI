# 漏斗 3D 只是错位阴影

- **ID**: CASE-2026-08-14-009
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-14

## 症状

- 漏斗开启立体后像重影，没有柱图那种顶面/侧面。

## 根因

- 挤出只把同一梯形平移再画一层，没有分面。

## 错误做法（避免）

- 用整块 path 平移冒充 2.5D。

## 修复方式

- 与纵柱相同：右上挤出，单独画顶面（提亮）和右侧面（压暗），层间距至少容纳挤出高度。

## 验证

- `pnpm exec vitest run src/components/charts/engine/d3/flow/renderFunnel.test.ts src/components/charts/engine/d3/flow/funnelDepth.test.ts`

## 关联

- `fe/src/components/charts/engine/d3/flow/funnelDepth.ts`
