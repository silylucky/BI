# 看板图例开启后表格/图表闪烁 + execute 日志风暴

## 症状

- 看板编辑页开启右侧「图例」后，画布上表格等组件持续闪烁
- 关闭「图例」开关后立刻恢复正常
- 后端在 1–2 秒内刷大量 `POST /api/v1/query/dataset/execute`（每个 traceId 不同）

## 根因

`PixelShapeInnerChrome` 在 `legendActive` 为 true/false 时在两种 React 树结构间切换：

- 无图例：直接渲染 `children`（含 `ChartRenderer`）
- 有图例：`<EmbeddedChartLegendShell>{children}</EmbeddedChartLegendShell>`

数据加载完成后图例项从空变为非空 → `legendActive` 变 true → 子树结构变化 → `ChartRenderer` **卸载重挂** → `useChartExecute` 重新 `loading` → 图例项又变空 → 再卸载 → **死循环**。

关闭图例时 `shellLegendVisible=false`，图例项始终为空，`legendActive` 恒 false，不会切换结构，故不闪。

## 修复

1. `PixelShapeInnerChrome`：**始终**使用 `EmbeddedChartLegendShell`，`items=[]` 时仅隐藏图例 UI，不改变子节点挂载位置
2. `chartExecuteProbe`：增加 execute 结果缓存 + `peekChartExecuteCachedResult`，remount 时先 hydrate 避免 loading 骨架闪屏
3. `useChartExecute`：effect 启动时读缓存，有数据则不阻塞 loading

## 锚点

- `fe/src/components/dashboard/pixelCanvas/PixelShape.tsx` — `PixelShapeInnerChrome`
- `fe/src/components/charts/EmbeddedChartLegend.tsx`
- `fe/src/lib/chartExecuteProbe.ts`
- `fe/src/components/charts/useChartExecute.ts`
- 回归：`fe/src/components/charts/EmbeddedChartLegend.test.tsx`

## 预防

条件渲染若会改变子组件在 React 树中的**父节点类型/层级**，需评估是否导致业务子树 remount；应用 CSS/`items=[]` 隐藏而非结构切换。
