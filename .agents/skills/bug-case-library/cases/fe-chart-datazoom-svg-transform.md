# 缩略轴整图缩放导致跳动且数据对不上

- **ID**: CASE-2026-08-14-013
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-14

## 症状

- 图表高级 → 缩略轴开启后，主图来回跳动
- 底部条与主图类目/数值对不上
- 滚轮会把整张 SVG（含坐标轴）一起放大

## 根因

- 实现是 `d3.zoom` 变换整个 `plot`，不是 DataEase/ECharts `dataZoom` 的类目窗口
- `brush` 清空 selection 或 React 重绘会重置 transform，看起来像跳动
- 主图仍按全量 domain 画轴，只是画面被放大，数据和刻度对不齐

## 错误做法（避免）

- 用 SVG transform / 滚轮缩放冒充缩略轴
- 在 `brush` 过程中 `replaceChildren` 重绘滑条（会闪）

## 修复方式

- 窗口用 0–1 比例并对齐类目边界；主图只画窗口内类目并按窗口重算 Y
- 底部总览条画全量 sparkline + brush；禁止 `d3.zoom`
- 窗口存在 `WeakMap`，重绘后恢复选区

## 验证

```
cd fe && pnpm vitest run src/components/charts/engine/d3/core/dataZoomWindow.test.ts src/components/charts/engine/d3/inspectorCapabilityMatrix.test.ts
```

## 关联

- `fe/src/components/charts/engine/d3/core/dataZoom.ts`
- `fe/src/components/charts/engine/d3/core/dataZoomWindow.ts`
