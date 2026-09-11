# Feature Truth：customViz 与内置图表引擎能力边界

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-19（AIVIZ-017 闭环更新） |
| 核验范围 | L3 customViz 底座 SLA；与内置 chart 引擎边界 |
| 锚点 | `CustomVizWidget.tsx` · `customVizPayload.ts` · `customVizRuntime.ts` · `D3CanvasView.tsx` |
| 总体判定 | **BY DESIGN + PLATFORM SLA（AIVIZ-017）** |
| 依据 | F17-AIVIZ · `PLATFORM-SLA.md` · Payload v1 |

## 1. 结论

**customViz 是外挂 HTML 沙箱，不是第 50 种 chartType。** 内置 chart 走 `buildChartRenderPlan → applyChartStyleChain → renderD3Chart`；customViz 仅共享 **query/execute** 与 **Payload v1 + vsCv**，**不调用** `renderD3Chart`。

**AIVIZ-017 后平台底座 SLA**（L3 终态主路径）：

| 能力 | 实现 |
|------|------|
| 生命周期 | `vsCv.mount(renderFn)` — payload/layout 变化自动重绘 |
| 轴抽稀 | `payload.axisPlan.categoryTickIndices` + helpers 兜底 |
| 大行数 | Base `capRows` + **壳层 truncated 横幅** |
| 尺寸 | `payload.layout` + mount |
| 入库 | d3 须含 `vsCv.mount`（422） |

典型症状（**老 artifact 未 PUT 升级**）仍可能出现轴重叠/resize 不变；升级至官方示例或 PLATFORM-SLA 合规 HTML 即可。

## 2. 能力对照

| 能力 | 内置 chart | customViz（设计 Out） | customViz（AIVIZ-017） |
|------|-----------|----------------------|------------------------|
| 查数 | chartType 插件 | 合成 `table` execute | 同左 |
| 行数 cap | `capRows` 500 + UI 提示 | 仅 SQL resultLimit | Base cap + **壳层横幅** |
| 轴抽稀 | 引擎 cartesian | bundle 自实现 | **`axisPlan` + helpers** |
| 尺寸跟随 | `useElementSize` + live resize | 无 | **`mount` + layout** |
| 样式链 | `applyChartStyleChain` | CSS token + displayStyle | 同左 |
| 查看数据 | 右键 | 无 | **customViz 右键 parity** |

## 3. 代码锚点

- 内置管线：`fe/src/components/charts/engine/d3/views/D3CanvasView.tsx`
- L3 Base：`fe/src/components/dashboard/CustomVizWidget.tsx`
- Runtime：`fe/src/components/dashboard/custom-viz/customVizRuntime.ts`
- 契约：`docs/api/vs-ai-spec/guides/PLATFORM-SLA.md` · `PROTOCOL.md` §Payload v1

## 4. 仍 Out（F17）

- 强制走 `renderD3Chart`（除非未来单独立项 `renderAs`）
- chartType 代理 / 动态注册进 catalog
- iframe 沙箱
- `vsCv.draw.*` 参考 API（Phase 2 可选）

## 5. 运维提示

- 图表盘「自定义」列表来自 `GET /api/v1/ai-viz/artifacts`（按属主）；**无 DELETE API**，清理演示数据需 DBA 删 `ai_viz_artifacts` 行或覆盖 PUT。
- 标准柱/线图应走 **L1/L2 chartConfig**，见 `guides/RENDERERS.md` 决策树。
