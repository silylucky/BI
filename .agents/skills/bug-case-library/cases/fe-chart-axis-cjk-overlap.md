# 柱图 X 轴中文类目抽稀仍重叠

- **ID**: CASE-2026-08-14-006
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-14

## 症状

- 分组柱状图 X 轴为省名时，标签互相叠字，即使组件已经够宽。

## 根因

- 未配置 `labelRotate` 时默认水平，日期类长标签抽稀后仍挤在底边。
- 类目抽稀用拉丁字宽估宽。中文「上海市」3 字实际约 `3 * 字号`。

## 错误做法（避免）

- 用拉丁平均字宽估全部轴标签。
- 只放大字号、不按真实标签宽度抽稀。

## 修复方式

- `estimateLabelPixelWidth`：CJK = 字号，ASCII = 0.65× 字号。
- 未配置旋转时按槽宽 **自动倾斜**（`0` 仍可强制水平）。
- 首尾标签补左右边距，避免压住 Y 轴。

## 验证

- `pnpm exec vitest run src/components/charts/engine/d3/core/axes.test.ts`

## 关联

- CASE-2026-08-14-004
- `fe/src/components/charts/engine/d3/core/axes.ts`
- `fe/src/components/charts/engine/d3/core/labelWidth.ts`
