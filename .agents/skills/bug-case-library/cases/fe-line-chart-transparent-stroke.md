# FE 折线图 execute 有数据但画布无线

## 症状

- `POST /api/v1/query/dataset/execute` 返回 200，`columns`/`rows` 正常
- 同看板表格组件能展示数据
- 折线图仅显示坐标轴（Y 轴刻度、X 轴类目），**折线路径不可见**
- Apex SVG 中 `path.apexcharts-line` 可能为 0，或 path 存在但 `stroke="transparent"`

## 根因

`fe/src/lib/chart-theme.ts` 的 `baseChartOptions.stroke.colors` 为 `["transparent"]`，本意是柱状图圆角柱体描边透明。

`createLineChartOptions` 通过 `deepMergeOptions` 合并 stroke 时**只覆盖** `curve`/`width`，**未覆盖** `colors`，折线继承透明描边 → 数据已到前端但线不可见。

## 修复

1. 从 `baseChartOptions.stroke` 移除 `colors: ["transparent"]`
2. 仅在 `createBarChartOptions` 显式设置 `stroke: { colors: ["transparent"] }`
3. 回归：`fe/src/lib/chart-theme.test.ts`

## 锚点

- `fe/src/lib/chart-theme.ts`
- `fe/src/lib/merge-options.ts` — 对象深合并保留未覆盖字段
- `fe/src/components/charts/ChartRenderer.tsx`

## 预防

共享 base theme 时，仅对特定 chart type 生效的样式不要放在 base；合并后应用测试断言「line 不含 transparent stroke」。
