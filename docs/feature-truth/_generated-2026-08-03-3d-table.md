# 组件配置 3D 判定矩阵（condensed）

> 生成：2026-08-03 · 源：`_generated-2026-08-03-matrix.json` · 44 chart 分组行 + 扩展实体 18 行

## 图例

| 符号 | GATE / CHAIN / BROWSER |
|------|------------------------|
| ✅ | 已验（catalog.test / L1 / BROWSER REAL） |
| partial | 07-30 样式审计 CHAIN 部分覆盖 |
| ◐ | BROWSER 部分覆盖（line data slots） |
| ○ | 未 BROWSER |
| OUT | advanced Tab 不适用（advanced-out） |

## 矩阵

| Surface | entityId | configTab | styleSections | GATE | CHAIN | BROWSER | 判定 | 备注 |
|---------|----------|-----------|---------------|------|-------|---------|------|------|
| S1 | gauge | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | gauge | style · advanced | variantBasic → background → palette → title → label → gaugeShape | ✅ | partial | ○ | STUB |  |
| S1 | liquid | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | liquid | style · advanced | background → palette → title → label → liquidShape | ✅ | partial | ○ | STUB | 2026-07-28：水位=指标/目标值；图表提示已接 tooltipPresentation |
| S1 | kpi | data | — | ✅ | ✅ | ✅ | REAL | 2026-08-03 BROWSER 重验 REAL |
| S1 | kpi | style | background → palette → title → label → kpiIndicator | ✅ | partial | ✅ | STUB | 2026-08-03 BROWSER 重验 REAL |
| S1 | kpi | advanced-out | — | OUT | — | ○ | OUT | 2026-08-03 BROWSER 重验 REAL |
| S1 | table-info | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | table-info | style · advanced | tableBasic → tableColor → title → background | ✅ | partial | ○ | PARTIAL |  |
| S1 | table-normal | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | table-normal | style · advanced | tableBasic → tableColor → title → background | ✅ | partial | ○ | PARTIAL |  |
| S1 | table-pivot | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | table-pivot | style · advanced | tableBasic → tableColor → title → background | ✅ | partial | ○ | PARTIAL |  |
| S1 | t-heatmap | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | t-heatmap | style · advanced | background → palette → geo → title | ✅ | partial | ○ | STUB |  |
| S1 | line | data | — | ✅ | ✅ | ◐ | REAL | data slots 未全 BROWSER |
| S1 | line | style · advanced | variantBasic → axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | PARTIAL |  |
| S1 | area | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | area | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | area-stack | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | area-stack | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | bar | data | — | ✅ | ✅ | ✅ | REAL | 07-30 BROWSER 全 Tab REAL |
| S1 | bar | style | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ✅ | PARTIAL | 07-30 BROWSER 全 Tab REAL |
| S1 | bar | advanced | — | ✅ | ✅ | ✅ | REAL | 07-30 BROWSER 全 Tab REAL |
| S1 | bar-stack | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bar-stack | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | percentage-bar-stack | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | percentage-bar-stack | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | bar-group | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bar-group | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | bar-group-stack | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bar-group-stack | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | waterfall | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | waterfall | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | bar-horizontal | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bar-horizontal | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | bar-stack-horizontal | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bar-stack-horizontal | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | percentage-bar-stack-horizontal | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | percentage-bar-stack-horizontal | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | bar-range | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bar-range | style · advanced | axis → cartesianShape → background → palette → title → remark → label | ✅ | partial | ○ | STUB |  |
| S1 | bidirectional-bar | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bidirectional-bar | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | progress-bar | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | progress-bar | style · advanced | axis → cartesianShape → progressBarShape → background → palette → title → remark → label | ✅ | partial | ○ | REAL |  |
| S1 | stock-line | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | stock-line | style · advanced | axis → stockLineShape → background → palette → title → remark → label | ✅ | partial | ○ | REAL |  |
| S1 | bullet-graph | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | bullet-graph | style · advanced | axis → cartesianShape → bulletShape → background → palette → title → remark → label | ✅ | partial | ○ | REAL |  |
| S1 | pie | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | pie | style · advanced | pieShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | pie-donut | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | pie-donut | style · advanced | pieShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | pie-rose | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | pie-rose | style · advanced | pieShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | pie-donut-rose | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | pie-donut-rose | style · advanced | pieShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | radar | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | radar | style · advanced | background → palette → title → remark → label → radarShape | ✅ | partial | ○ | STUB |  |
| S1 | treemap | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | treemap | style · advanced | background → palette → title → remark → label → treemapShape | ✅ | partial | ○ | PARTIAL |  |
| S1 | word-cloud | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | word-cloud | style · advanced | background → palette → title → wordCloudShape | ✅ | partial | ○ | PARTIAL |  |
| S1 | map | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | map | style | background → mapBasic → title → geo → remark | ✅ | partial | ○ | PARTIAL |  |
| S1 | map | advanced-out | — | OUT | — | ○ | OUT |  |
| S1 | map-3d | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | map-3d | style | background → title → geo → remark | ✅ | partial | ○ | PARTIAL |  |
| S1 | map-3d | advanced-out | — | OUT | — | ○ | OUT |  |
| S1 | scatter | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | scatter | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | quadrant | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | quadrant | style · advanced | axis → cartesianShape → quadrantShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | REAL |  |
| S1 | funnel | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | funnel | style · advanced | background → palette → title → legend → funnelShape | ✅ | partial | ○ | STUB |  |
| S1 | sankey | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | sankey | style · advanced | background → palette → title → sankeyShape | ✅ | partial | ○ | PARTIAL |  |
| S1 | circle-packing | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | circle-packing | style · advanced | background → palette → title → label → circlePackingShape | ✅ | partial | ○ | PARTIAL |  |
| S1 | multi-scatter | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | multi-scatter | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | graph | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | graph | style · advanced | variantBasic → background → palette → title → label → graphShape | ✅ | partial | ○ | STUB |  |
| S1 | chart-mix | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | chart-mix | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | chart-mix-group | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | chart-mix-group | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | chart-mix-stack | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | chart-mix-stack | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S1 | chart-mix-dual-line | data | — | ✅ | ✅ | ○ | REAL |  |
| S1 | chart-mix-dual-line | style · advanced | axis → cartesianShape → background → palette → title → remark → legend → label → tooltip | ✅ | partial | ○ | STUB |  |
| S2 | filter | inspector | FilterWidgetInspector: dimensionRef, parameterKey, controlType… | ✅ | ✅ | ○ | REAL | 07-30 T6 widgetRailStyleSections |
| S2 | text | style | TextEditRail: content, fontSize, fontWeight, color… | ✅ | ✅ | ○ | REAL | 07-30 T6 widgetRailStyleSections |
| S2 | media | style | MediaEditRail: mediaType, src, objectFit, alt… | ✅ | ✅ | ○ | REAL | 07-30 T6 widgetRailStyleSections |
| S2 | tabs | style | TabsWidgetInspector: tabs[], defaultTabId, tabBarStyle | ✅ | ✅ | ○ | REAL | 07-30 T6 widgetRailStyleSections |
| S3 | screen-clock | style | clock: fontSize, fontColor | ✅ | ✅ | ○ | REAL | 07-30 G20 ScreenVisualEditRail 8/8 |
| S3 | screen-border | style | border: variant, stroke, glow | ✅ | ✅ | ○ | REAL | 07-30 G20 ScreenVisualEditRail 8/8 |
| S3 | screen-title-bar | style | titleBar: fontSize, fontColor | ✅ | ✅ | ○ | REAL | 07-30 G20 ScreenVisualEditRail 8/8 |
| S3 | screen-datetime | style | datetime: showWeekday, showSeconds | ✅ | ✅ | ○ | REAL | 07-30 G20 ScreenVisualEditRail 8/8 |
| S3 | screen-shape | style | shape: kind, fill, stroke | ✅ | ✅ | ○ | REAL | 07-30 G20 ScreenVisualEditRail 8/8 |
| S3 | screen-icon | style | icon: name, fill, size | ✅ | ✅ | ○ | REAL | 07-30 G20 ScreenVisualEditRail 8/8 |
| S4 | dashboard-style | context | DashboardStyleSections: colorScheme, 整体配置, 背景 | ✅ | partial | ○ | PARTIAL |  |
| S4 | dashboard-widget-style | widget | DashboardWidgetStyleSections: shell, title, numberFormat, filterChrome, palette | ✅ | partial | ○ | PARTIAL |  |
| S4 | dashboard-context | blank-select | DashboardContextInspector: 空白态看板级入口 | ✅ | partial | ○ | PARTIAL |  |
| S5 | ChartDataSlots | data | 维度/指标槽位 · ChartDataOptions · 校验 | ✅ | ✅ | ○ | REAL | ChartEditRail 基础设施 |
| S5 | ChartStylePanel | style | ChartStyleSection 折叠 · profile gated | ✅ | partial | ○ | REAL | ChartEditRail 基础设施 |
| S5 | ChartAdvancedPanel | advanced | 联动/跳转/刷新 · caps gated | ✅ | partial | ○ | PARTIAL | ChartEditRail 基础设施 |
| S5 | DatasetPickerPanel | dataset-rail | 数据集选择 · 字段库 · 列刷新 | ✅ | ✅ | ○ | REAL | ChartEditRail 基础设施 |
| S6 | TemplateBlockEditor | blocks | blockType, queryRef, 重排, 批量删除 | ✅ | ✅ | ○ | PARTIAL | RPT-003 companion · pytest e95d |

## 覆盖摘要

| 指标 | 值 |
|------|-----|
| chart 类型 | 44 |
| S1 chart 行（data + style/advanced 分组） | 92 |
| 扩展实体行（widget·素材·看板·面板·报表） | 18 |
| **总行数** | **110** |
| 逻辑 tab 覆盖 | 132 S1 tab 行 → 92 分组行 |
| BROWSER ✅ | bar 全 Tab · kpi data+style · line data ◐ |
