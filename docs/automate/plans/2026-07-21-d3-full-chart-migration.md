# 图表全量 D3 渲染迁移计划

> **状态**：✅ 已完成（Phase 0–7）· 43 画布型全部 D3 · 表格三件套 D3 自研 · ECharts/S2/G2/G2Plot/G6 运行时已下架  
> **清理归档**：[`2026-07-21-chart-engine-dead-code-cleanup.md`](./2026-07-21-chart-engine-dead-code-cleanup.md)  
> **真理源**：`fe/src/components/charts/engine/plugins/metadata.ts` · `fe/src/components/charts/engine/d3/` · 验收 [`2026-07-20-chart-component-acceptance.md`](./2026-07-20-chart-component-acceptance.md)  
> **模式**：Adapter — `ChartEngineViewProps` / `ChartViewModel` / `ChartStyleContext` 不变，仅替换最底层渲染 View  
> **禁止**：在线地图/境外地图（GEO-IRON-01）· 引入 Superset/DataEase 运行时（NFR-08）

## 1. 目标

1. **所有画布类 chartType** 由 D3 渲染（catalog 48 项中 **43 项画布型** 已全部完成）。
2. **上层零破坏**：`ChartRenderer`、Inspector、下钻/跳转、壳层图例、`layoutFootprint` remeasure、PNG 导出语义不变。
3. **统一视觉与交互**：渐变、入场动画、十字准线、精致 tooltip、轴标签抽稀、暗色主题一致；`prefers-reduced-motion` 可关闭动画。
4. **下线 AntV/ECharts 画布依赖**：生产路径移除 `@antv/g2plot`、`@antv/g6`、`@antv/g2`、`@antv/s2` 与 ECharts 运行时；`engine/antv/` 仅保留 plan 编码与主题 token。

## 2. 范围边界

### 2.1 画布型（已全部 D3）

| paletteCategory | chartType | 数量 | 引擎 |
|-----------------|-----------|:----:|------|
| trend | `line` `area` `area-stack` | 3 | d3 |
| compare | `bar` `bar-stack` … `bullet-graph` | 14 | d3 |
| dual_axes | `chart-mix` … `chart-mix-dual-line` | 4 | d3 |
| distribute | `pie` … `circle-packing` | 8 | d3 |
| quota | `gauge` `liquid` | 2 | d3 |
| relation | `scatter` … `graph` | 6 | d3 |
| map | `map` `t-heatmap` | 2 | d3 |

### 2.2 表格与遗留

| chartType | 引擎 | 说明 |
|-----------|------|------|
| `table-info` / `table-normal` / `table-pivot` | d3 | `D3TableView` 自研表格 |
| `table` | react | legacy 薄壳，引导迁移至 `table-info` |
| `kpi` | d3 | KPI 画布 |
| `timeline` / `combo` / `heatmap` / `wordCloud` | — | deprecated；随 `migratesTo` 覆盖 |

### 2.3 铁律

| 项 | 约定 |
|----|------|
| 地图 | 仅离线中国 GeoJSON（`fe/src/assets/geo/*.json` 或平台 API 分发）；`d3-geo` choropleth；禁止瓦片/CDN/地图 Key |
| 依赖门禁 | `pnpm check:chart-engine`：`@antv/*` 仅 `engine/antv/**`；D3 仅 `engine/d3/**` |
| 文件体量 | 单文件 ≤300 行；按族拆子目录 |

---

## 3. 架构（复用 line 试点）

### 3.1 分层

```
ChartRenderer（不变）
  └─ CanvasChartHost → ChartEngineView
       ├─ buildChartRenderPlan()      # VM → RenderPlan（kind: "d3"）
       ├─ applyChartStyleChain()     # D3 主题 / 条件格式 / markLine
       └─ D3ViewRouter
            ├─ D3CanvasView / D3GeoMapView / D3TableView
            └─ renderDispatch → renderD3Xxx(svg, plan.options, style)
```

### 3.2 契约（不变）

- 入参：`ChartEngineViewProps`（`viewModel` · `style` · `chartConfig` · `onInteraction` · `onJumpClick` · `layoutFootprint` …）
- 编码：`encodeCartesianRows` / `encodePieRows` / 既有 `buildPlanForType` 逻辑不改字段语义
- 每型迁移 checklist（机械重复 6 步）：
  1. `metadata.ts`：`library: "d3"`
  2. `buildPlan.ts`：`kind: "d3"`（options 字段契约不变）
  3. `applyChartStyleChain` / 新增 `applyD3Style`：配色、条件色、markLine
  4. `renderD3Xxx.ts`：SVG 渲染实现
  5. `ChartEngineView` / `D3ViewRouter`：按 library/plotType 分发
  6. smoke + 能力回归测试

### 3.3 目标目录

```
fe/src/components/charts/engine/d3/
├── core/                 # theme, axes, grid, tooltip, legend, interaction, animate, gradient
├── cartesian/            # line, area, bar, dualAxes, waterfall, bidirectional, bullet, stock
├── radial/               # pie, gauge, liquid, radar
├── hierarchy/            # treemap, circle-packing
├── flow/                 # funnel, sankey
├── relation/             # scatter, quadrant
├── graph/                # force graph（替代 G6）
├── geo/                  # choropleth（离线中国）
├── matrix/               # t-heatmap
├── views/                # D3XxxView React 壳
├── d3ViewRouter.tsx
└── types.ts
```

### 3.4 line 试点锚点（已完成）

| 文件 | 职责 |
|------|------|
| `d3/D3LineView.tsx` | 读 plan + style → 调 render |
| `d3/renderD3LineChart.ts` | SVG 折线 + 渐变面积 + 十字准线 + 动画 |
| `d3/d3LineVisual.ts` | ticks / nearest / gradient / animate（待迁入 core/） |
| `metadata.ts` | `line` → `library: "d3"` |
| `buildPlan.ts` | `line` → `kind: "d3", engine: "d3"` |

---

## 4. D3 视觉与交互规范（全型统一）

### 4.1 视觉 Token

| 元素 | 规范 |
|------|------|
| 折线 | 2.5px，`round` cap；系列色 + 下方面积渐变（opacity 0.32→0.02） |
| 柱形 | 圆角 rx=4；hover 亮度 +8%；stack 间 1px 间隙 |
| 饼图 | 扇区间 1.5px 白分隔；hover 外扩 6px |
| 网格 | 水平虚线，opacity 0.9；domain 极淡或隐藏 |
| 轴文字 | 11px；自动抽稀；拥挤时 -32° 倾斜 |
| Tooltip | 8px 圆角、blur、色点、标题+数值分层 |
| 动画 | 入场 600–800ms `easeCubicOut`；hover 120ms |
| 暗色 | `chartThemeTokens(scheme)`；渐变 top opacity 略提高 |

### 4.2 交互

| 交互 | 笛卡尔 | 饼/雷达 | 地图 | 图网络 |
|------|:------:|:-------:|:----:|:------:|
| 十字准线 | ✓ | — | — | — |
| hover 高亮 | ✓ | ✓ | ✓ | ✓ |
| 路径/柱/扇区入场动画 | ✓ | ✓ | ✓ | 布局 tween |
| 合并 tooltip | ✓ | ✓ | ✓ | 节点/边 |
| 下钻 `onInteraction` | ✓ | ✓ | ✓（adcode） | 节点 |
| 跳转 `onJumpClick` 优先 | ✓ | ✓ | ✓ | ✓ |
| dataZoom brush | ✓（P1 统一） | — | — | — |
| `prefers-reduced-motion` | 关闭动画 | 同左 | 同左 | 同左 |

---

## 5. 分阶段实施

### Phase 0 — 基础设施（3–4 人天）

**任务**

- [ ] P0-01：`d3/core/*` 从 `d3LineVisual.ts` / line renderer 抽离
- [ ] P0-02：`d3ViewRouter.tsx` + `D3CartesianView` 通用壳（plan → renderer 映射）
- [ ] P0-03：`applyD3Style(plan, ctx)`；扩展 `applyChartStyleChain` 对 `kind === "d3"`
- [ ] P0-04：`exportChartPng` 支持 SVG → canvas
- [ ] P0-05：`d3/core/*.test.ts`（ticks、nearest、gradient）
- [ ] P0-06：line 回归无劣化

**验收**

- [ ] `[AUTO]` `charts.smoke` line 用例 `data-testid="d3-line-chart"`
- [ ] `[AUTO]` `check:chart-engine` 通过

---

### Phase 1 — 笛卡尔主力 P0（5–7 人天）

| 批次 | chartType | renderer |
|------|-----------|----------|
| 1a | `area` `area-stack` | `renderArea.ts` |
| 1b | `bar` `bar-stack` `bar-group` `bar-group-stack` | `renderBar.ts` |
| 1c | `percentage-bar-stack` `bar-horizontal` `bar-stack-horizontal` `percentage-bar-stack-horizontal` | `renderBar.ts` |
| 1d | `bar-range` `progress-bar` `stock-line` | bar 扩展或专用 |
| 1e | `waterfall` `bidirectional-bar` `bullet-graph` | 专用 renderer |

**本阶段交互**：柱 hover、dataZoom brush、条件着色（柱 fill）

**验收**（对照验收计划 D1/D2）

- [ ] 每型 smoke `data-testid="d3-*-chart"`
- [ ] `[MANUAL]` 编码、legend、下钻（≥2维）、条件色、markLine 抽检

---

### Phase 2 — 双轴与饼图 P1（4–5 人天）

| 批次 | chartType | renderer |
|------|-----------|----------|
| 2a | `chart-mix` `chart-mix-group` `chart-mix-stack` `chart-mix-dual-line` | `renderDualAxes.ts` |
| 2b | `pie` `pie-donut` `pie-rose` `pie-donut-rose` | `renderPie.ts` |
| 2c | `radar` | `renderRadar.ts` |

**验收**

- [ ] 双轴左右 Y 刻度、柱线配色区分
- [ ] 饼图 donut/rose 变体、扇区展开动画

---

### Phase 3 — 散点与关系流 P1（3–4 人天）

| chartType | renderer |
|-----------|----------|
| `scatter` `multi-scatter` | `renderScatter.ts` |
| `quadrant` | `renderQuadrant.ts` |
| `funnel` | `renderFunnel.ts` |
| `sankey` | `renderSankey.ts` |

---

### Phase 4 — 层级与词云 P2（3–4 人天）

| chartType | renderer | 备注 |
|-----------|----------|------|
| `treemap` | `renderTreemap.ts` | `d3-hierarchy` |
| `circle-packing` | `renderCirclePacking.ts` | `d3-hierarchy` |
| `word-cloud` | `renderWordCloud.ts` | 可选 `d3-cloud` 或简化螺旋 |

---

### Phase 5 — 指标与地图 P2（4–5 人天）

| chartType | renderer | 约束 |
|-----------|----------|------|
| `gauge` | `renderGauge.ts` | 弧 + 指针动画 |
| `liquid` | `renderLiquid.ts` | 波浪 clip |
| `map` | `renderChoropleth.ts` | **GEO-IRON-01**；复用 `OfflineGeoPort` 数据 join |
| `t-heatmap` | `renderHeatmap.ts` | 矩阵色阶 + 条件色 |

**地图专项**

- [ ] 仅 `registerMap` 等价离线边界；省→市下钻换 GeoJSON
- [ ] Code Review 对照 `.cursor/rules/geo-map-offline-china.mdc`

---

### Phase 6 — 关系图 G6→D3 P2（3–4 人天）

| chartType | renderer |
|-----------|----------|
| `graph` | `renderForceGraph.ts`（`d3-force`） |

- [ ] 节点拖拽、力导向、边箭头
- [ ] 完成后可移除 `@antv/g6`

---

### Phase 7 — 收尾与 AntV 画布下线（2–3 人天）

- [ ] 全部 canvas 型 `metadata.library === "d3"`
- [ ] 删除生产路径 `g2plot/` `g6/` `geo/`（若 map 已迁）
- [ ] `pnpm remove @antv/g2plot @antv/g6 @antv/g2`（**保留 s2**）
- [ ] 可选：`AntvEngineView` → `CanvasEngineView`
- [ ] 更新 `engine/d3/README.md`、验收计划 B 节引擎分路表
- [ ] 全量 `pnpm test` + `[MANUAL]` 走查

---

## 6. 路由目标态

```typescript
// AntvEngineView.tsx（或 CanvasEngineView）
if (library === "s2") return <AntvS2View {...props} />;
if (library === "d3") return <D3ViewRouter {...props} />;
return <AntvG2PlotView {...props} />; // 过渡期 fallback，Phase 7 删除
```

`D3ViewRouter` 按 `plan.plotType` 分发至 `RENDERERS` 表（Line / Column / Pie / …）。

---

## 7. 测试策略

| 层级 | 内容 | 证据 |
|------|------|------|
| 单元 | `d3/core/*`；各 render 纯函数 DOM 结构 | `[AUTO]` vitest |
| 集成 | `charts.smoke.test.tsx` 每型 ≥1 条 | `[AUTO]` |
| 契约 | `catalogParity.test.ts` library 字段 | `[AUTO]` |
| 样式链 | `applyChartStyleChain.test.ts` d3 条件色 | `[AUTO]` |
| 门禁 | `check:chart-engine` | CI |
| 走查 | Inspector 配置即生效、embedded 缩放、暗色、下钻/跳转 | `[MANUAL]` |

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| 42 型改动面大 | 7 Phase 独立可合并；每 Phase 末回归 |
| 视觉漂移 | 强制 `d3/core` + §4 规范；禁止 View 内硬编码 hex |
| 大数据性能 | 保留 `capRows`；散点/图超 2k 采样；必要时 canvas 降级 |
| 地图合规 | Phase 5 专审 GEO-IRON-01 |
| word-cloud 复杂 | Phase 4 可简化首版 |
| PNG 导出 | Phase 0 统一 `svgToPng` |
| 文件超标 | 按族分子目录，单文件 ≤300 行 |

---

## 9. 工期估算

| Phase | 内容 | 人天 |
|-------|------|:----:|
| 0 | 基础设施 | 3–4 |
| 1 | 笛卡尔 17 型 | 5–7 |
| 2 | 双轴 + 饼 + 雷达 | 4–5 |
| 3 | 散点/漏斗/桑基 | 3–4 |
| 4 | 层级/词云 | 3–4 |
| 5 | 指标/地图/矩阵热力 | 4–5 |
| 6 | 关系图 | 3–4 |
| 7 | 收尾下线 AntV 画布 | 2–3 |
| **合计** | | **27–36** |

> 1 人全职约 6–8 周；2 人并行 Phase 1/2/3 可压至 4–5 周。

---

## 10. 建议执行顺序

```
第 1 周  → Phase 0 + Phase 1a/1b（core + area + bar）
第 2 周  → Phase 1 收尾 + Phase 2 饼图
第 3 周  → Phase 2 双轴 + Phase 3 散点
第 4 周  → Phase 4–5 地图/指标
第 5 周  → Phase 6 图 + Phase 7 下线 AntV 画布
```

---

## 11. 文档同步（按 prd-sync 评估）

| 变更完成时 | 同步文档 |
|------------|----------|
| Phase 7 全量 D3 | `docs/automate/plans/2026-07-20-chart-component-acceptance.md` B 节引擎表 |
| 架构决策（下线 g2plot） | `docs/arch.md` ADR 补充 |
| 地图 D3 实现 | `docs/services/viz.md` 锚点 |
| 里程碑勾选 | `prd/F06-VIZ.md` 若验收条款变化 |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-21 | Phase 7 完成：43 画布型全量 D3；下线 g2plot/g2/g6 |
