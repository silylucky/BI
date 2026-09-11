# AntV 引擎目录（Plan 层）

> **运行时渲染已迁 D3**；本目录保留数据编码与主题 token。

| 路径 | 用途 |
|------|------|
| `buildChartRenderPlan.ts`（`engine/`） | `buildChartRenderPlan` → `buildPlanForType` |
| `spec/encodeCartesian.ts` · `encodePie.ts` | 行列数据编码 |
| `theme.ts` | `AntvThemeTokens`（D3 复用） |
| `exportPng.ts` | 画布 PNG 导出 |

**已移除**：`@antv/s2` · `@antv/g2plot` · `@antv/g2` · `@antv/g6` · `AntvEngineView` · `geo/`（迁至 `engine/geo/`）（2026-07-21）
