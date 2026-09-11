# D3 图表视觉卓越计划（VCDS）

> **状态**：Phase 0–6 已闭环 · 笛卡尔/分布/关系/矩阵/表格全族接入 VCDS 核心能力  
> **前置**：[`2026-07-21-d3-full-chart-migration.md`](./2026-07-21-d3-full-chart-migration.md)  
> **验收扩展**：[`2026-07-21-chart-per-type-verification.md`](./2026-07-21-chart-per-type-verification.md) §5 L4–L6

## 1. 目标

建设 **VitalSpan Chart Design System（VCDS）**，统一 43 画布型 + 表格/KPI 的：

- 视觉 Token（线宽、圆角、网格、tooltip）
- 交互（磁吸十字准线、合并 tooltip、图例 dimming）
- 动效（入场、hover、morph、KPI count-up）
- 性能（增量 resize、虚拟滚动、采样路由、canvas 混合）

## 2. 核心模块（`fe/src/components/charts/engine/d3/core/`）

| 模块 | 职责 |
|------|------|
| `chartVisualTokens.ts` | VCDS 常量 + 动效强度 |
| `themeEngine.ts` | `D3Theme`（surface/accent/crosshair） |
| `sceneGraph.ts` | 笛卡尔 scene 构建、grid、point/band axes |
| `crosshair.ts` | 磁吸十字准线 + point/band hover 层 |
| `tooltipLayer.ts` | 毛玻璃合并 tooltip |
| `motionEngine.ts` | morph / stagger / count-up |
| `interactionBus.ts` | 系列 focus / dimming |
| `perfRouter.ts` | SVG 全量 / 采样 / canvas 混合 |
| `incrementalRender.ts` | live resize 会话 |
| `canvasScatterLayer.ts` | 散点 >5k canvas 混合层 |
| `depthEngine.ts` | 伪 3D 深度（bevel / extrude / shadow / hover lift） |

## 3. Depth Visual（VCDS 伪 3D）

看板 `depthVisual`（off / standard / enhanced）经 `D3CanvasView` → `setDepthVisual` 注入渲染器；`depthEngine.ts` 提供统一 helper：

| Helper | 用途 |
|--------|------|
| `shadeColor` | 顶面提亮 / 侧面压暗 |
| `resolveEffectiveDepth` | 尊重 `prefers-reduced-motion` 与显式 off |
| `ensureDepthShadowFilter` | SVG feDropShadow |
| `applyCellBevel` | 矩阵/层级单元斜面描边 |
| `applyDepthHoverLift` | hover 微抬升 |
| `paintVerticalBar` / `drawExtrudedBar` | 柱系挤出 |

已接入：笛卡尔柱、饼图 extrude、散点 SVG 阴影、象限 radial 底、漏斗侧壁、Sankey 链 opacity、层级 bevel、力导向 radial 节点、热力 bevel+lift、 choropleth lift+enhanced 阴影、表格 `data-depth-visual` 行 hover 投影。

## 4. L4–L6 验收清单

### L4 Visual（LOOK）

- [x] 轴 11px tabular-nums；网格虚线 opacity 0.9
- [x] 折线 2.5px + 面积渐变；柱 rx=4、stack 1px 间隙
- [x] 饼 padAngle + 白分隔；暗色/浅色 token 一致
- [x] tooltip 毛玻璃 + 色点分层
- [x] 热力 hover 行列十字高亮 + 标签

### L5 Motion（FEEL）

- [x] 折线路径入场 720ms；hover 120ms
- [x] KPI 数字 count-up；饼/漏斗扇区展开
- [x] `prefers-reduced-motion` 跳过入场
- [x] live resize 不 replay 入场动画
- [x] 表格行 hover 过渡 + 左侧色条

### L6 Perf（FAST）

- [x] live resize：`data-vs-incremental` + SVG 保留
- [x] 表格 scroll 模式 >200 行虚拟滚动
- [x] 散点 >5k 走 `hybrid-canvas` + 全量 canvas 点层
- [x] 透视表列宽/行高拖拽 + deTableStyle 持久化

## 5. Renderer 纪律

- 禁止 renderer 内硬编码 `#hex`；用 `themeEngine.resolveD3Theme`
- 禁止无故 `replaceChildren`；plotType 切换或空数据除外
- 单文件 ≤300 行；笛卡尔交互上浮 `cartesian/renderCartesianBase.ts`

## 6. 已接入 VCDS 的图表

| 族 | 文件 | VCDS 能力 |
|----|------|-----------|
| 折线 | `renderD3LineChart.ts` | sceneGraph, crosshair, tooltipLayer, incremental |
| 柱 | `renderBar.ts` | sceneGraph, band crosshair, stack gap, incremental |
| 面积 | `renderArea.ts` | sceneGraph, crosshair, tooltipLayer, incremental |
| 饼/漏斗 | `renderPie.ts` / `renderFunnel.ts` | VCDS.pie.* / 分层入场 |
| KPI | `renderKpi.ts` | morphNumber count-up |
| 散点 | `renderScatter.ts` | perfRouter 采样 + canvas 混合 + SVG depth shadow |
| 象限 | `renderQuadrant.ts` | 四象限 radial 深度底 |
| 漏斗 | `renderFunnel.ts` | 梯形侧壁 extrude |
| Sankey | `renderSankey.ts` | 链 depth opacity |
| 层级 | `renderTreemap.ts` 等 | `applyCellBevel` |
| 力导向 | `renderForceGraph.ts` | 节点 radialGradient |
| 热力 | `renderHeatmap.ts` | bevel + hover lift + 十字高亮 |
| 地图 | `renderChoropleth.ts` | hover lift + enhanced shadow |
| 表格 | `VitalSpanTable.tsx` | 虚拟滚动、resize、密度档、`data-depth-visual` hover 投影 |
| 透视表 | `TablePivotGrid.tsx` | resize + 密度档 + 行 hover |

## 7. 测试

```bash
cd fe && pnpm vitest run src/components/charts/engine/d3/core
cd fe && pnpm run test:chart-catalog
cd fe && pnpm test:e2e e2e/chart-visual-snapshots.spec.ts   # 需 dev server + 基线截图
```

视觉回归：`fe/e2e/chart-visual-snapshots.spec.ts` 对 line/column/pie/scatter/map/table 截图 diff 容差 2%。
