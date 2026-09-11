# 组件配置全量审计矩阵

> 生成时间：2026-08-03 · 范围：49 chartType + 4 widget + 看板级  
> 方法论：UI 暴露（profile + gates）→ 能力门控（caps + d3Matrix）→ 渲染消费（P0 门控 / renderer grep）

## 图例

| status | 含义 |
|--------|------|
| ok | 无已知 P0 缺口 |
| p0-fixed | 本轮 P0 已修复或门控 |
| p1-backlog | 矩阵已登记，后续迭代 |

## A. ChartType（50）

| chartType | 样式 Tab 分区（gated） | Inspector caps | D3 matrix | paletteOpacity | seriesGradient | knownGaps | status |
|-----------|------------------------|----------------|-----------|----------------|----------------|-----------|--------|
| gauge | variantBasic → background → palette → title → label → tooltip → gaugeShape | label, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:missing | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| liquid | background → palette → title → label → tooltip → liquidShape | label, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:missing | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| kpi | background → palette → title → label → kpiIndicator | label | plugin-default | hidden | hidden | paletteOpacity UI 已门控隐藏 | ok |
| table (deprecated→table-info) | tableBasic → tableColor → title → background | — | plugin-default | hidden | hidden | deprecated→table-info | p0-fixed |
| table-info | tableBasic → tableColor → title → background | — | plugin-default | hidden | hidden | depthVisual 弱消费 | p1-backlog |
| table-normal | tableBasic → tableColor → title → background | — | plugin-default | hidden | hidden | — | p0-fixed |
| table-pivot | tableBasic → tableColor → title → background | — | plugin-default | hidden | hidden | — | p0-fixed |
| t-heatmap | background → palette → geo → title | conditional | plugin-default | hidden | hidden | paletteOpacity UI 已门控隐藏 | ok |
| line | variantBasic → axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| area | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| area-stack | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| timeline (deprecated→line) | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | plugin-default | hidden | wired | deprecated→line; paletteOpacity UI 已门控隐藏 | p0-fixed |
| bar | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bar-stack | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| percentage-bar-stack | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bar-group | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bar-group-stack | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| waterfall | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, conditional, remark | legend:wired; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bar-horizontal | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bar-stack-horizontal | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| percentage-bar-stack-horizontal | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bar-range | axis → cartesianShape → background → palette → title → remark → label → tooltip | label, conditional, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bidirectional-bar | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, conditional, remark | legend:wired; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| progress-bar | axis → cartesianShape → progressBarShape → background → palette → title → remark → label → tooltip | label, conditional, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| stock-line | axis → stockLineShape → background → palette → title → remark → label → tooltip | label, conditional, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| bullet-graph | axis → cartesianShape → bulletShape → background → palette → title → remark → label → tooltip | label, conditional, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| pie | pieShape → background → title → remark → legend → label → tooltip | legend, label, conditional, remark | legend:wired; label:wired; dataZoom:missing; markLines:missing; conditional:wired | n/a | hidden | seriesGradient 未接线（P0 已隐藏 UI） | p1-backlog |
| pie-donut | pieShape → background → title → remark → legend → label → tooltip | legend, label, conditional, remark | legend:wired; label:wired; dataZoom:missing; markLines:missing; conditional:wired | n/a | hidden | — | p0-fixed |
| pie-rose | pieShape → background → title → remark → legend → label → tooltip | legend, label, conditional, remark | legend:wired; label:wired; dataZoom:missing; markLines:missing; conditional:wired | n/a | hidden | — | p0-fixed |
| pie-donut-rose | pieShape → background → title → remark → legend → label → tooltip | legend, label, conditional, remark | legend:wired; label:wired; dataZoom:missing; markLines:missing; conditional:wired | n/a | hidden | — | p0-fixed |
| radar | background → palette → title → remark → label → tooltip → radarShape | label, conditional, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| treemap | background → palette → title → remark → label → tooltip → treemapShape | label, conditional, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| word-cloud | background → palette → title → wordCloudShape → tooltip | remark | legend:missing; label:missing; dataZoom:missing; markLines:missing; conditional:missing | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| wordCloud (deprecated→word-cloud) | background → palette → title → wordCloudShape → tooltip | remark | legend:missing; label:missing; dataZoom:missing; markLines:missing; conditional:missing | hidden | hidden | deprecated→word-cloud; paletteOpacity UI 已门控隐藏 | p0-fixed |
| map | background → mapBasic → title → geo → remark → tooltip | label, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:missing | wired | hidden | profile 无 label 分区但 caps.label=true；2D 区域标签样式待决策 | p1-backlog |
| map-3d | background → title → geo → remark → tooltip | label, remark | legend:missing; label:missing; dataZoom:missing; markLines:missing; conditional:missing | hidden | hidden | — | p0-fixed |
| gis-map | gisProject → gisAtmosphere → gisSun → gisOverlay → gisLayers → background → title → remark → tooltip | label, remark | plugin-default | hidden | hidden | — | p0-fixed |
| heatmap (deprecated→t-heatmap) | axis → background → palette → title → label → tooltip | label, remark | plugin-default | hidden | hidden | deprecated→t-heatmap; paletteOpacity UI 已门控隐藏 | p0-fixed |
| scatter | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| quadrant | axis → cartesianShape → quadrantShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| funnel | background → palette → title → legend → label → tooltip → funnelShape | legend, label, conditional, remark | legend:wired; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | caps.label=true 无独立 label 分区（标签在 palette 内嵌）; paletteOpacity UI 已门控隐藏 | p1-backlog |
| sankey | background → palette → title → label → tooltip → sankeyShape | label, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:missing | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| circle-packing | background → palette → title → label → tooltip → circlePackingShape | label, conditional, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| multi-scatter | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | hidden | paletteOpacity UI 已门控隐藏 | p0-fixed |
| graph | variantBasic → background → palette → title → label → tooltip → graphShape | label, remark | legend:missing; label:wired; dataZoom:missing; markLines:missing; conditional:missing | hidden | hidden | caps 与 profile legend/label 分叉; paletteOpacity UI 已门控隐藏 | p1-backlog |
| combo (deprecated→chart-mix) | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | plugin-default | hidden | wired | deprecated→chart-mix; paletteOpacity UI 已门控隐藏 | p0-fixed |
| chart-mix | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| chart-mix-group | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| chart-mix-stack | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | paletteOpacity UI 已门控隐藏 | p0-fixed |
| chart-mix-dual-line | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | legend, label, dataZoom, markLines, conditional, remark | legend:wired; label:wired; dataZoom:wired; markLines:wired; conditional:wired | hidden | wired | legend partial，主系列覆盖待确认; paletteOpacity UI 已门控隐藏 | p1-backlog |
## B. 非图表 Widget（4）

| widget | Inspector 字段 | 消费点 | D3 matrix | paletteOpacity | seriesGradient | knownGaps | status |
|--------|----------------|--------|-----------|----------------|----------------|-----------|--------|
| filter | FilterWidgetInspector: dimensionRef, parameterKey, controlType, defaultValue, placeholder, allowClear, multiSelect | 全局筛选注入 / linkage | n/a | n/a | n/a | — | ok |
| text | TextEditRail: content, fontSize, fontWeight, color, align, verticalAlign, datasetBinding | 文本渲染 + 可选 dataset 绑定 | n/a | n/a | n/a | — | ok |
| media | MediaEditRail: mediaType, src, objectFit, alt, autoplay, loop, muted | 图片/视频展示 | n/a | n/a | n/a | — | ok |
| tabs | TabsWidgetInspector: tabs[], defaultTabId, tabBarStyle | 标签页切换与子 widget | n/a | n/a | n/a | — | ok |
## C. 看板级配置（3）

| 入口 | 配置分区 | 消费路径 | D3 matrix | paletteOpacity | seriesGradient | knownGaps | status |
|------|----------|----------|-----------|----------------|----------------|-----------|--------|
| dashboard-style | DashboardStyleSections: 仪表板风格(colorScheme), 整体配置, 仪表板背景 | applyDashboardStylePatch → 子 chart 继承 | n/a | n/a | n/a | 看板级 palette/seriesGradient 为默认继承源 | ok |
| dashboard-widget-style | DashboardWidgetStyleSections: 组件外观(shell), 图表标题, 数值格式, 筛选器外观, 图表配色(paletteId/opacity/gradient/depth) | widgetStyle/titleStyle/numberFormat/filterChrome | n/a | wired | wired | depthVisual 同步子 chart | ok |
| dashboard-context | DashboardContextInspector: 空白态选中时展示 DashboardStyleSections + DashboardWidgetStyleSections | 无 chart 选中时的看板级配置入口 | n/a | n/a | n/a | — | ok |
## P0 修复摘要（2026-08-03）

| ID | 修复 |
|----|------|
| P0-1 | `supportsPaletteOpacity` 仅 map；其余类型隐藏 opacity 滑块 |
| P0-2 | `supportsSeriesGradientToggle` 白名单至 bar/line/area/chart-mix 族 |
| P0-3 | `ChartTooltipStyleSection` 补 tooltip 颜色/背景 |
| P0-4 | table 系移除无效 `palette` 分区 |
| P0-5 | stock-line 移除空 `cartesianShape` 分区 |
| P0-6 | wordCloud D3 matrix 对齐 word-cloud |
| P0-7 | map-3d 无 palette（已完成） |

## P1 Backlog

- pie/funnel 等接线 seriesGradient（若产品需要）
- map 2D label 样式分区决策
- table depthVisual 弱消费
- geo3d 未暴露字段清理
