# 图表密集视口滚动优化方案

> **Plan type**: Headless Automation Plan  
> **Cursor Build**: disabled  
> **Execution trigger**: dev-autopilot A5 plan-execute  
> **状态**：**P0 已实施**（2026-07-22）· P1–P4 待续  
> **触发**：小组件/大屏像素画布下类目或标签压缩至字体重叠；用户要求**数据显示优先**，通过**固定视口 + 方向导航**浏览全量数据  
> **真理源**：`fe/src/components/charts/engine/d3/core/axes.ts` · `dataZoom.ts` · `TableScrollRegion.tsx` · `chartRendererEmbedded.tsx` · `inspectorCapabilityMatrix.ts`  
> **对标**：DataEase 缩略轴 / 表格横向滚动；本方案强调**显式方向按钮**（上下/左右），按图类型分策略

---

## 0. 问题与目标

### 0.1 现状

| 现象 | 根因 |
|------|------|
| 轴标签重叠、柱上数值不可读 | 绘制尺寸 = 组件 `clientWidth × clientHeight`，类目数不变 → 单 band 高度/宽度趋近 0 |
| 「数据显示优先」与「防重叠」矛盾 | 全量类目 + 固定 11px 字号 → 必然叠字 |
| 已有 `dataZoom` 仅覆盖部分笛卡尔图 | 滚轮/拖拽缩放，**无方向按钮**；双向柱/区间柱/瀑布等未接入 |
| Widget 容器 `overflow-hidden` | 内容无法滚动，只能裁剪或缩字 |

### 0.2 目标

1. **数据零省略**：进入密集态后，内容区按可读最小尺寸布局（全量类目/柱/标签），不再抽稀、截断、隐藏。
2. **视口固定**：组件外框尺寸不变（栅格 span / 像素 `width×height`）。
3. **滚轮导航**：视口小于内容时，**鼠标滚轮**在图表上浏览（到边界后交给外层画布）；不按按钮滑动。
4. **分图专优**：按坐标轴方向、布局模型分 6 类策略，各图只实现必要轴。
5. **与现有能力共存**：`dataZoom`（缩放平移）、地图 `roam`、表格 `TableScrollRegion` 保留；本方案补「按钮导航 + 密集态自动切换」。

### 0.3 非目标

- 不改变 SQL/查询层 500 行采样策略（另案）。
- 不引入在线地图或第三方滚动库。
- 编辑态拖拽组件时不触发内容滚动（与 `suspendLiveResize` 一致）。

---

## 1. 核心概念

### 1.1 双尺寸模型

```
┌─ Widget 视口 (viewport) ─────────────┐  ← 固定：组件 CSS 尺寸
│  ┌─ 内容画布 (content) ───────────┐ │  ← 可变：由数据密度推导
│  │  [轴][plot 全量数据]            │ │
│  │         ↑ 可滚动区域            │ │
│  └─────────────────────────────────┘ │
│  [◀][▶] 或 [▲][▼] 导航钮            │
└──────────────────────────────────────┘
```

| 术语 | 定义 |
|------|------|
| **viewport** | `readChartPaintSize()` 得到的绘制宽高 |
| **content** | 满足可读性下限后的逻辑尺寸（如 `categories × MIN_BAND_PX`） |
| **dense** | `content > viewport` 某轴，启用该轴滚动 |
| **frozen chrome** | 滚动时不动的 UI：轴向标签区、图例、缩略轴（可选） |

### 1.2 可读性下限（常量，可配置）

| 常量 | 建议值 | 用途 |
|------|--------|------|
| `MIN_CATEGORY_BAND_PX` | 14 | 柱/条带最小高度或宽度 |
| `MIN_AXIS_LABEL_PX` | 11 | 轴标签字号（密集态不缩小到 7px） |
| `MIN_BAR_LABEL_GAP_PX` | 4 | 柱顶/柱侧数值与柱体间距 |
| `SCROLL_STEP_RATIO` | 0.85 | 按钮单次滚动视口比例 |
| `DENSE_ENTER_RATIO` | 1.0 | content/viewport > 1 即进入密集态 |

### 1.3 策略枚举 `ChartViewportMode`

```ts
type ChartViewportMode =
  | "none"              // 无滚动：饼/仪表/KPI/单点 gauge
  | "scroll-y"          // 纵向内容滚动：横向柱、双向柱、进度条…
  | "scroll-x"          // 横向内容滚动：纵向柱、折线、面积…
  | "scroll-xy"         // 双轴滚动：热力图、透视式矩阵
  | "pan-plot"          // 整体平移：散点、关系图、桑基（节点溢出）
  | "reuse-dataZoom"    // 已有 dataZoom，仅加按钮与密集态切换
  | "reuse-table"       // 表格：TableScrollRegion + 按钮
  | "reuse-geo-roam";   // 地图：roam + 方向按钮
```

登记位置（新建）：`fe/src/components/charts/engine/viewport/chartViewportRegistry.ts`

---

## 2. 分图类型策略矩阵

> 44 个 catalog 类型按 **6 族** 收敛；实现时以 `metadata.ts` 的 `family` + `isHorizontal` 为主，类型 ID 为辅。

### 2.1 族 A — 纵向类目轴（`scroll-x`）

**模式**：X 轴类目从左向右铺排；视口固定，内容宽度 = `Σ max(MIN_BAND, labelWidth)`。

| chartType | 冻结区 | 滚动轴 | 专优 |
|-----------|--------|--------|------|
| bar, bar-stack, bar-group, bar-group-stack | 左 Y 数值轴 + 底 X 轴头 | ↔ | 堆叠柱保持 band 对齐；百分比堆叠 Y 域固定 |
| percentage-bar-stack | 同上 | ↔ | Y 轴 0–100% 冻结 |
| line, area, area-stack | 左 Y + 底 X | ↔ | 折线点随 band 滚动；smooth 路径按可见域裁剪 |
| waterfall, stock-line | 左 Y + 底 X | ↔ | stock 蜡烛宽度随 band |
| chart-mix* | 左 Y + 右 Y（双轴）+ 底 X | ↔ | 右轴刻度随 plot 同步 transform |
| funnel（竖向） | 左对齐标签 | ↔ | 梯形宽度按可见段重算 |

**导航**：底部 `[◀ 上一屏][▶ 下一屏]`；滚轮默认横向（`shift+滚轮` 或 `data-viz-wheel-scroll`）。

### 2.2 族 B — 横向类目轴（`scroll-y`）★ 用户痛点

**模式**：Y 轴类目从上到下；内容高度 = `categories × MIN_CATEGORY_BAND_PX`。

| chartType | 冻结区 | 滚动轴 | 专优 |
|-----------|--------|--------|------|
| bar-horizontal, bar-stack-horizontal | 左 Y 类目轴 + 底 X 数值轴 | ↕ | 类目轴 **sticky left**，仅 plot 纵滚 |
| percentage-bar-stack-horizontal | 同上 | ↕ | |
| bidirectional-bar | 左 Y + 底 X + 中轴 | ↕ | 左右柱同步纵滚；中线贯穿可视区 |
| bar-range, progress-bar, bullet-graph | 左 Y + 底 X | ↕ | 进度条 0–1 / 子弹图区间随滚可见 |

**导航**：右侧 `[▲ 上一屏][▼ 下一屏]`；底栏可选「第 1–8 / 共 32 项」指示器。

### 2.3 族 C — 双类目矩阵（`scroll-xy`）

| chartType | 冻结区 | 滚动轴 | 专优 |
|-----------|--------|--------|------|
| heatmap（t-heatmap） | 左上角 + 顶 X 头 + 左 Y 头 | ↔ + ↕ | 冻结首行首列（对标 Excel 冻结窗格） |
| table-pivot（S2） | 行头 + 列头 | ↔ + ↕ | 复用 S2 冻结；按钮调用 `sheet.scrollBy` |

### 2.4 族 D — 数值域平移（`reuse-dataZoom` + 按钮）

已有 `attachCartesianDataZoom` 的图：**密集态自动开启**，并增加 UI 按钮映射到 `zoom.translateBy`。

| chartType | 增强 |
|-----------|------|
| line, bar, area, bar-horizontal, dualAxes | `[+][-]` 缩放 + `[◀][▶][▲][▼]` 平移 |
| 缩略轴 brush | 密集态默认显示；非密集态可隐藏 |

与族 A/B 关系：**优先 scroll 模式**（保持 1:1 数据比例与刻度对齐）；dataZoom 作为「放大查看」二级能力，不替代 scroll。

### 2.5 族 E — 表格（`reuse-table`）

| chartType | 方案 |
|-----------|------|
| table-info, table-normal | `TableScrollRegion` 已有四向渐隐；**新增**边缘悬浮 `[▲▼◀▶]` 调用 `scrollBy` |
| table-pivot | 同上 + 与 S2 冻结联动 |

### 2.6 族 F — 地理 / 关系 / 径向（专优）

| chartType | 模式 | 专优 |
|-----------|------|------|
| map | `reuse-geo-roam` | 四向按钮映射 `translate`；双击复位保留 |
| map-3d | `reuse-geo-roam` | 按钮映射 orbit pan |
| scatter, quadrant, multi-scatter | `pan-plot` | 点密度高时扩展逻辑画布 + 平移 |
| graph, sankey, circle-packing | `pan-plot` | 布局 bbox 大于视口时启用 |
| pie*, radar, treemap, word-cloud | `none` | 径向缩放/省略标签策略独立（非滚动） |
| gauge, liquid, kpi | `none` | 单指标无滚动 |

---

## 3. 架构设计

### 3.1 模块划分

```
fe/src/components/charts/engine/viewport/
├── chartViewportRegistry.ts      # chartType → ChartViewportMode + options
├── computeDenseContentSize.ts    # 输入 plan/data/viewport → content W/H + dense 标志
├── ChartScrollViewport.tsx       # React 壳：overflow + 导航钮 + 滚动指示
├── useChartScrollViewport.ts     # scrollTop/Left、步进、边界、键盘
├── ChartScrollNavButtons.tsx     # ▲▼◀▶ UI（TailAdmin 风格，半透明悬浮）
├── d3ScrollableScene.ts          # D3：固定轴 + transform 可滚 plot 层
└── chartViewport.test.ts
```

**接入点**（二选一，推荐 A）：

| 方案 | 位置 | 说明 |
|------|------|------|
| **A（推荐）** | `D3CanvasView` 内层包裹 `ChartScrollViewport` | 所有 D3 图统一；传入 `plotType` + `renderPlan` |
| B | 各 `render*.ts` 内部 | 分散、难维护 |

数据流：

```
D3CanvasView
  → computeDenseContentSize(plan, viewport)
  → if dense: ChartScrollViewport(contentSize)
       └─ inner div (content W×H)
            └─ runD3Renderer (SVG 以 content 尺寸绘制)
  → else: 现有路径（viewport 尺寸直接绘制）
```

### 3.2 D3 绘制改造（族 A/B 通用）

**现状**：`buildCartesianScene({ width, height })` = viewport。

**改造**：

```ts
type ScrollableCartesianScene = CartesianScene & {
  scrollPlot: d3.Selection<SVGGElement, ...>;  // 随滚动 transform
  frozenAxes: { x?: ..., y?: ... };            // 不随滚
  contentW: number;
  contentH: number;
};
```

- **scroll-y**：`contentH = categories.length * MIN_CATEGORY_BAND_PX`；Y 轴 scale `range([0, contentH])`；视口 clip 显示窗口。
- **scroll-x**：`contentW = categories.length * MIN_CATEGORY_BAND_PX`；X 轴 scale `range([0, contentW])`。
- 轴标签始终在 frozen 层，使用**完整类目**文本（恢复 11px，取消 `resolveBandAxisFontSize` 缩小逻辑——密集态由滚动解决）。

### 3.3 导航按钮交互

| 行为 | 说明 |
|------|------|
| 单击滚轮 | 在图表上滚动浏览内容（纵向/横向按图类型） |
| 到顶/到底 | 滚轮事件交给外层画布继续滚动 |
| 键盘 | 聚焦图表时方向键步进（无障碍，P4） |
| 指示器 | 无 UI 按钮；`title="滚轮浏览数据"` 提示 |
| 编辑态 | `suspendLiveResize` 时禁用滚动，避免与拖拽冲突 |

样式：滚动区 `overflow-auto` + `useChartScrollWheel` 捕获滚轮；与 `routePixelCanvasWheel` 链式放行。

### 3.4 与「数据显示优先」策略对齐

| 旧策略（当前） | 新策略（本方案） |
|----------------|------------------|
| 全量类目挤在 viewport | 全量类目铺在 content |
| 缩小字号到 7px | 固定 MIN_AXIS_LABEL_PX |
| 截断「…」 | 禁止截断（冻结轴区完整显示） |
| 柱标签 band<9 不画 | 始终画（content 保证 band 高度） |

`axes.ts` 中 `pickCategoryTicks` 恢复全量后，**密集判定**交给 `computeDenseContentSize`，非轴逻辑。

---

## 4. 分阶段实施

### P0 — 框架 + 族 B（横向类目）✅ 2026-07-22

**交付**：

- [x] `chartViewportRegistry` + `computeDenseContentSize`
- [x] `ChartScrollViewport` + `useChartScrollWheel`（滚轮浏览，无按钮）
- [x] `D3CanvasView` 接入密集态 content 尺寸 + 滚动壳
- [x] 族 B 类型自动 scroll-y（bidirectional-bar / bar-horizontal / bar-range / progress-bar / bullet-graph）
- [x] 单测：`chartViewport.test.ts`
- [x] `test:chart-catalog` 208 passed

**代码锚点**：`fe/src/components/charts/engine/viewport/*` · `D3CanvasView.tsx`

**P0 简化**：整图纵滚（轴与 plot 同滚）；冻结轴层留 P1。

### P1 — 族 A（纵向类目）⏱ 2–3d

- [ ] scroll-x 场景
- [ ] 接入：bar/line/area/waterfall/stock/chart-mix*
- [ ] 双 Y 轴冻结与同步

### P2 — 族 C + dataZoom 按钮增强 ⏱ 2d

- [ ] heatmap 冻结首行首列
- [ ] dataZoom 图增加方向按钮映射
- [ ] 密集态与 dataZoom 互斥/叠加规则文档化

### P3 — 族 E 表格 + 族 F 地图 ⏱ 2d

- [ ] `TableScrollRegion` 增加导航钮
- [ ] map / map-3d 方向按钮接 roam

### P4 — 族 F 关系图 + 样式 Tab ⏱ 2d

- [ ] scatter/graph/sankey `pan-plot`
- [ ] 样式 Tab 增加「浏览模式：自适应 | 滚动 | 缩放」（默认自适应=本方案自动判定）
- [ ] `inspectorCapabilityMatrix` 增加 `viewportScroll` 列

---

## 5. 配置与样式 Tab（P4）

```ts
// chartDeStyle.ts 扩展（可选块）
viewport?: {
  mode: "auto" | "scroll" | "fit";  // auto=密集态自动滚动
  showNavButtons: boolean;          // 默认 true
  showPositionIndicator: boolean;   // 默认 dense 时 true
  minBandPx?: number;               // 覆盖 MIN_CATEGORY_BAND_PX
};
```

| mode | 行为 |
|------|------|
| `auto` | content>viewport 时滚动，否则 fit |
| `scroll` | 强制按 minBand 展开 content |
| `fit` | 回退旧行为（压缩字号，**不推荐**） |

---

## 6. 测试与验收

### 6.1 自动测试

| 用例 | 文件 |
|------|------|
| `computeDenseContentSize` 各类型 | `chartViewport.test.ts` |
| 20 类目 × 120px 高 → dense=true, contentH≥280 | 同上 |
| scroll 边界 clamp | `useChartScrollViewport.test.ts` |
| 双向柱滚后左右柱 y 对齐 | `renderBidirectionalBar.test.ts` |
| catalog smoke 仍全绿 | `charts.smoke.test.tsx` |

### 6.2 手动验收（大屏小组件）

| # | 场景 | 期望 |
|---|------|------|
| 1 | 对称条形图 261×122，15+ 类目 | 右侧 ▲▼ 可浏览；类目完整；柱长=真实值 |
| 2 | 纵向柱图 宽 200，12 月 | 底部 ◀▶ 可浏览 |
| 3 | 热力图 8×12 | 冻结首行首列 + 双向滚动 |
| 4 | 编辑拖拽组件 | 滚动禁用；松手恢复 |
| 5 | 表格 50 行 | 原有滚动 + 按钮可用 |

---

## 7. 风险与对策

| 风险 | 对策 |
|------|------|
| SVG 超大尺寸性能 | content 上限 `MAX_CONTENT_PX = 32000`；超出提示「请缩小维度或启用采样」 |
| 双指缩放与滚动冲突 | 图表区 `touch-action: pan-x pan-y` 按模式单轴 |
| 与 embed 大屏 scale 叠加 | `readChartPaintSize` 已反算 CSS scale；滚动用逻辑像素 |
| dataZoom 与 scroll 叠加混乱 | 默认互斥：scroll 模式关闭 zoom；高级用户可开「缩放」 |
| 轴 frozen 与 plot 不同步 | 单一 scale domain，frozen 轴仅画刻度，plot 用 transform |

---

## 8. 文档同步（实施后）

| 变更 | 文档 |
|------|------|
| 新能力 viewportScroll | `prd/F06-VIZ.md` VIZ-003 附录 |
| 域边界 | `docs/services/viz.md` |
| 组件清单 | `fe/src/components/README.md` |
| 矩阵 | `inspectorCapabilityMatrix.ts` |

---

## 9. 决策记录

| ID | 决策 | 理由 |
|----|------|------|
| ADR-VP-01 | 滚动优于缩字号 | 用户明确要求数据显示优先 |
| ADR-VP-02 | 按钮 + 滚轮双通道 | 大屏触控/鼠标场景均覆盖 |
| ADR-VP-03 | 按族实现非按 44 型逐个 | 降低重复；registry 可细粒度 override |
| ADR-VP-04 | 接入 D3CanvasView 非 ChartRenderer | 表格/地图已有独立 View，各走 reuse 路径 |
| ADR-VP-05 | 横向柱族 P0 优先 | 对称条形图为当前痛点 |

---

## 附录 A — 类型 → 模式速查

| 模式 | chartTypes |
|------|------------|
| scroll-y | bar-horizontal, bar-stack-horizontal, percentage-bar-stack-horizontal, bidirectional-bar, bar-range, progress-bar, bullet-graph |
| scroll-x | bar, bar-stack, bar-group, bar-group-stack, percentage-bar-stack, line, area, area-stack, waterfall, stock-line, chart-mix, chart-mix-group, chart-mix-stack, chart-mix-dual-line |
| scroll-xy | heatmap, table-pivot |
| reuse-dataZoom | 同 scroll-x/y 且已接 dataZoom 者（增强） |
| reuse-table | table-info, table-normal |
| reuse-geo-roam | map, map-3d |
| pan-plot | scatter, quadrant, multi-scatter, graph, sankey, circle-packing |
| none | pie*, radar, treemap, word-cloud, gauge, liquid, kpi, funnel（可选 scroll-x） |

---

## 附录 B — 与近期轴优化补丁关系

当前 `axes.ts`「全量类目 + 缩字号」为**过渡方案**。本计划 P0 落地后：

1. `pickCategoryTicks` 保持全量；
2. **移除** `resolveBandAxisFontSize` 作为主策略；
3. 密集态由 `ChartScrollViewport` 承担可读性；
4. 非密集态仍 fit viewport，无需滚动。
