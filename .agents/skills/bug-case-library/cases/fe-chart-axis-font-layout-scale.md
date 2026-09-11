# 图表放大后轴标签重叠 / 遮挡绘图区

- **ID**: CASE-2026-08-14-004
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-14

## 症状

- 看板组件缩小后轴文字正常；拉大组件后轴字体互相重叠，或盖住图形 / 邻区。
- SVG `vs-chart-svg` 在像素画布 CSS scale 下以更高分辨率绘制。

## 根因

- `beginPresentationPaint` 会按 `visualScale` 把轴字号放大到 paint 坐标系（屏幕上仍约 11px）。
- 轴布局仍按拉丁字宽估宽：`CHAR_PX=6.5`、`CARTESIAN_MARGIN` 固定、抽稀最小间距固定。
- 中文类目（如「上海市」）实际约占字号全宽，估宽偏小 → 刻度过密。
- 组件越大，paint 字号越大，估宽越偏小 → 刻度过密、边距不够。

## 错误做法（避免）

- 只改 `font-size`、不改边距和抽稀。
- 用固定像素估中文轴标签宽度。

## 修复方式

- `axisLayoutScale()` = 当前轴字号 / 11。
- `estimateAxisLabelWidth`、笛卡尔边距、旋转额外底边、分层轴行高、刻度抽稀间距随 scale 放大。

## 验证

- `setAxisFontSize(22)` 时标签估宽与 left/bottom 边距约为 11px 时的 2 倍。
- 拉大带类目轴的图表，标签不盖住柱/折线，不伸出组件叠到旁边。

## 关联

- `fe/src/components/charts/engine/d3/core/axes.ts`
- `fe/src/components/charts/engine/d3/core/margin.ts`
- `fe/src/components/charts/engine/d3/core/chartVisualTokens.ts`
- `fe/src/components/charts/engine/d3/core/hierarchicalAxis.ts`
