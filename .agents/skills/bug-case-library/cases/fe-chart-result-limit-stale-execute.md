# 折柱「结果超过 N 行」与自定义条数不同步

## 症状

- 数据 Tab「结果展示」改为自定义 N（如 11）后，分组柱状图出现「结果超过 11 行，请缩小查询范围」，图空白。
- 用户只绑一个维度、只想看 11 条或 1 条，仍被拒画。

## 根因

1. `useChartExecute` 的 `requestKey` 未带 `limit`，改 N 不重查，旧结果行数 > N 触发拒画。
2. 折柱把「超过 N 行」做成**拒画**，与「取最新 N 条」语义冲突：N 应是展示上限，应截取后出图。

## 修复

- `requestKey` 带上 `limit`。
- 折柱超出 N 时 `sliceCartesianDisplayRows` 截取前 N 行再画，不再提示「请缩小查询范围」。

## 锚点

- `fe/src/components/charts/useChartExecute.ts`
- `fe/src/lib/chartExecuteProbe.ts` `chartExecuteBindingKey`
- `fe/src/lib/cartesianRowLimit.ts`
