# 像素画布表格排序图标被放大填满单元格

## 症状

- 看板像素画布内明细表/透视表表头出现巨大灰色 `↑↓` 排序图标，占满整列
- 表体也可能被放大的 `ArrowUp` 与列宽拖拽竖线遮挡，数据行不可读
- 同页散点图等 D3 图表正常

## 根因

`fe/src/index.css` 为像素画布嵌入图表容器写了：

```css
.pixel-canvas-host .embedded-chart-live-surface svg,
.pixel-canvas-host .dashboard-no-drag svg { width: 100%; height: 100%; }
```

明细表经 `embeddedChartSurface()` 包在 `.embedded-chart-live-surface` 内；表头 `SortableHeaderCell` 使用 lucide `ArrowUpDown`（`className="size-3"`）。全局 `svg { width/height: 100% }` 特异性高于 Tailwind `size-3`，图标被拉伸至按钮/单元格全尺寸。

`.dashboard-no-drag` 分支还会误伤组件工具栏等小图标。

## 修复

1. 图表填满规则改为 `:not(:has(.embedded-chart-table-host))`，排除内嵌表格
2. 删除 `.dashboard-no-drag svg` 分支（避免误伤工具栏 lucide 图标）

## 锚点

- `fe/src/index.css` — `.pixel-canvas-host .embedded-chart-live-surface`
- `fe/src/components/charts/engine/d3/table/SortableHeaderCell.tsx`
- `fe/src/components/charts/ChartRenderer.tsx` — `wrapEmbedded(EmbeddedChartTable)`

## 编辑 vs 预览列宽/字号不一致（同源）

| 原因 | 修复 |
|------|------|
| 表格 th/td 参与 `--pixel-canvas-chrome-scale` 反比补偿 | `index.css` 表格字号改为 `var(--dw-screen-table)`，仅随画布 transform 缩放 |
| `D3TableView` 始终 `layoutInteractive` | `layoutInteractive={Boolean(onTableStylePatch)}`，预览只读已保存列宽 |

## 预防

- 像素画布「图表 SVG 填满」规则不得覆盖 UI chrome（lucide、分页、resize handle）
- 新增嵌入容器时区分 **scene svg** vs **widget chrome svg**
