# BUG-1：看板编辑页 widget 内图表内容被裁切

> 最近更新 2026-07-13

| 字段 | 值 |
|------|-----|
| 状态 | 🔧 部分修复（R2 待验证） |
| 优先级 | P1 |
| 发现日期 | 2026-07-13 |
| 影响范围 | 看板编辑/预览页所有已配置折线、柱状图 widget |
| 数据来源 | 用户 DOM 检查（L2）；源码取证（L1） |

## 问题总览

| # | 根因 | 状态 | 说明 |
|---|------|------|------|
| 1 | Apex `options.chart.height` 硬编码 180px | ✅ 已修复 | 2026-07-13 R2 |
| 2 | `ChartRenderer` embedded 模式 `Math.max(120, …)` 强制最小高度 | ✅ 已修复 | 2026-07-13 R1 |
| 3 | widget 多层 `overflow-hidden` + 高度链未贯通 | 🟡 部分缓解 | R1/R2 调整 flex；待用户验证 |
| 4 | 小高度 widget 下 X 轴标签 + 图例占满绘图区 | ✅ 已修复 | R2 紧凑模式 |
| 5 | DataEase 级像素画布/八向缩放「未实现」感知 | 🔲 待修复 | 产品差距，非本 BUG |

---

## 现象描述

[用户反馈] 在看板编辑页拖入并配置折线图/柱状图后：

- 期望：图表完整显示在 widget 边框内，随 widget 缩放自适应。
- 实际：图表绘图区下半截或坐标轴标签被遮挡；DOM 中 `foreignobject height="180"` 大于 widget 可用高度。
- 触发：必现（小行高 widget，如 6×3 栅格）。
- 关联：用户此前反馈「无极缩放 / 自适应均未实现」，部分为产品能力差距，部分为本 BUG。

---

## 失败过程还原

N/A（单点布局/配置错误，非多步骤时序故障）

### 关键数据

| 项 | 值 | 证据 |
|----|-----|------|
| 默认 widget 行高 | `rowSpan=3` | `gridLayoutAdapter.ts` |
| 栅格像素高度 | 3×32 + 2×12 = **120px** | `gridSpanToPixelHeight()` |
| 标题栏 + padding | ≈ **60px** | `WIDGET_BODY_CHROME_PX` |
| 可用绘图区（估算） | ≈ **60px** | 120 − 60 |
| Apex SVG 高度（修复前） | **180px** | `chart-theme.ts:106` + 用户 DOM |

---

## 根因 1：Apex `options.chart.height` 硬编码 180px ✅ 已修复

**代码证据**（`fe/src/lib/chart-theme.ts`，修复前）：

```typescript
return getBaseChartOptions({
  chart: { type: "bar", height: 180 },
  // ...
});
```

**数据流**：

```text
createBarChartOptions() 写入 chart.height=180
  → ChartRenderer 传入 <Chart height={chartSize.height} />
  → Apex 仍以 options.chart.height 渲染 SVG foreignobject=180px
  → DashboardWidget overflow-hidden 裁切超出部分
  → 用户看到「显示不全 / 被遮盖」
```

**影响量化**：所有看板内折线/柱状图 widget，在可用高度 < 180px 时 **100% 裁切**。

### 修复详情（2026-07-13 R2）

**改了什么**：

| 文件 | 改动 |
|------|------|
| `fe/src/lib/chart-theme.ts` | 移除 `chart.height: 180` 默认值 |
| `fe/src/components/charts/ChartRenderer.tsx` | `apexOverrides.chart.height = chartSize.height`；小高度隐藏图例、旋转 X 轴标签 |

**修复前**：`foreignobject height="180"`，widget 可用 ~60–80px  
**修复后**：SVG 高度与 `chartSize.height` 一致，随 widget 缩放

---

## 根因 2：embedded 模式强制最小图表高度 ✅ 已修复

**代码证据**（`fe/src/components/charts/ChartRenderer.tsx`，R1 前）：

```typescript
const chartHeight = Math.max(120, bodySize.height || 180);
```

**影响量化**：在 `bodySize` 未量到或小于 120px 时，强制绘制 ≥120px 图表，加剧裁切。

### 修复详情（2026-07-13 R1）

改用 `chartSize`：`embedded` 时用 `bodySize` 或 `estimateWidgetBodyHeight(gridSpan.h)`，**不再** `Math.max(120, …)`。

---

## 根因 3：flex 高度链与 overflow 叠加 🟡 部分缓解

**代码证据**：

- `DashboardWidget.tsx:105` — 根节点 `overflow-hidden`
- `DashboardWidget.tsx:193` — 内容区 `p-2` 未 `flex-1`（R2 已改为 `flex min-h-0 flex-1 flex-col`）
- `index.css` — `.grid-widget-cell { height: 100% }`（R1 已加）

**待办**：用户验证 R2 后若仍裁切，需用 DevTools 量测 `.react-grid-item` 与 `bodyRef` 的 `getBoundingClientRect().height` 是否一致。

---

## 根因 4：小 widget 下图例 + 密集 X 轴标签占满绘图区 ✅ 已修复

**代码证据**：`chart-theme.ts` 默认 `legend.show` 为真；多类目 X 轴默认水平展示。

### 修复详情（2026-07-13 R2）

`embedded && chartSize.height < 160` 时：`legend.show=false`，`xaxis.labels.rotate=-35`，`hideOverlappingLabels=true`。

---

## 根因 5：DataEase 画布能力差距 🔲 待修复

**说明**：[用户反馈] 认为「所有功能未实现」。代码已实现 12 列栅格八向缩放与紧凑布局，但**无** DE 像素级自由画布与对齐参考线。属产品 backlog，见 `docs/automate/plans/2026-07-10-fe-de-ss-ia-optimization.md`。

---

## 启示

1. **图表库双通道高度**：`react-apexcharts` 的 `height` prop 与 `options.chart.height` 必须同步，不能只改其一。
2. **embedded 组件禁止硬编码默认尺寸**：默认值应来自容器量测或父级传入的栅格尺寸。
3. **overflow-hidden 下游必须保证子元素尺寸 ≤ 容器**：否则必然裁切。
4. **小容器图表需紧凑模式**：图例、轴标签策略应随高度分级切换。
