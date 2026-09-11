# VCDS L7：全族视觉与交互天花板

> **状态**：Phase 0–6 已闭环  
> **前置**：[2026-07-21-d3-visual-excellence.md](./2026-07-21-d3-visual-excellence.md)（L4–L6）  
> **纪律**：GEO-IRON-01 离线中国；单文件 ≤300 行；Inspector 矩阵与实现对齐

## 1. 目标

在 L4–L6 基线上，将全部活跃 chartType 拉齐到「同族天花板」：

| 维度 | 天花板定义 |
|------|------------|
| LOOK | `themeEngine` + `VCDS`；无 magic number；depth 档位一致 |
| FEEL | `motionDuration` 入场/hover；`prefers-reduced-motion` 与 live-resize 抑制 |
| PLAY | 图例 dim/toggle；brush/zoom；关系图邻接高亮；地图下钻反馈 |
| FAST | incremental / perfRouter / 表格虚拟滚动不退化 |

## 2. Phase 交付摘要

### Phase 0 — 共享内核

`d3Legend` dim/toggle · `interactionBus` · `tooltipLayer` 收敛 · `motionEngine` morph/stagger · `dataZoom` 横棒 brush · `VCDS` 扩展 token（radar/gauge/funnel/sankey/graph）

### Phase 1 — 笛卡尔族

折线/面积/柱系 legend dim + brush；横棒 tooltip/crosshair；专科柱 enter 动效；DualAxes 拆分与 crosshair

### Phase 2 — 径向 + 指标

饼系 legend dim + morph；雷达多系列 + legend；gauge 分段环；liquid tooltipLayer；KPI spark 可选

### Phase 3 — 关系 / 流向

散点 legend + brush；象限 token 化；漏斗转化率标注；Sankey 路径高亮

### Phase 4 — 层级 / 力导向 / 矩阵

Treemap drill 面包屑；词云碰撞改进；circle-packing 下钻；力导向 drag/zoom/邻接 dim；热力 enter

### Phase 5 — 地图 + 表格

| 类型 | 交付 |
|------|------|
| `map` | `choroplethVisualMap` · 下钻面包屑 UI · `choroplethLabelDensity` 自适应标注 |
| `map-3d` | CSS2D 区域标签 · 相机入场动画 · `threeChoroplethHelpers` 拆分 |
| `table-*` | 排序图标过渡 · 行点击涟漪 · 冻结列阴影增强 |

### Phase 6 — 回归与文档

- `inspectorCapabilityMatrix.ts`：radar legend wired；map-3d label partial；waterfall conditional wired
- `e2e/chart-visual-snapshots.spec.ts`：+waterfall/radar/sankey/graph/funnel/map-3d
- `fe/src/components/charts/engine/d3/README.md` L7 节

## 3. 代码锚点（Phase 5）

| 模块 | 路径 |
|------|------|
| 2D visualMap | `fe/src/components/charts/engine/d3/geo/choroplethVisualMap.ts` |
| 标注密度 | `fe/src/components/charts/engine/d3/geo/choroplethLabelDensity.ts` |
| 下钻面包屑 | `fe/src/components/charts/engine/d3/geo/choroplethDrillBreadcrumb.ts` |
| 3D 标签 | `fe/src/components/charts/engine/three/threeGeoRegionLabels.ts` |
| 3D 相机动画 | `fe/src/components/charts/engine/three/threeGeoCameraIntro.ts` |
| 表格排序动效 | `fe/src/index.css` `.vs-table-sort-icon` |

## 4. 明确不做（L8 候选）

- 在线地图 / 境外底图 / 地图 Key
- 散点 lasso、Sankey 节点自由拖拽
- 为动效牺牲 5k+ 散点 canvas 混合性能

## 5. 验收命令

```bash
cd fe && pnpm vitest run src/components/charts/engine/d3/inspectorCapabilityMatrix.test.ts
cd fe && pnpm vitest run src/components/charts/engine/d3/core
cd fe && pnpm run test:chart-catalog
cd fe && pnpm test:e2e e2e/chart-visual-snapshots.spec.ts   # 需 dev server + 基线截图
```
