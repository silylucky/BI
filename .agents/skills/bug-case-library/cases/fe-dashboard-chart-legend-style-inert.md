# 看板图表「显示图例 / 字号 / 位置」配置无效

## 症状

- 216px 图表样式 Tab「图例」折叠内：开关、字号、位置均可操作，但画布上图表无变化
- 开关默认呈「开」，实际图例仍不显示

## 根因（L1 代码证据）

| 层级 | 原因 | 证据 |
|------|------|------|
| 渲染层 | `showLegend` 要求 `deStyle.legend?.show === true`，未配置时恒为 false | `echartsDeStyle.ts` `resolveEchartsChromeInsets` |
| 内嵌模式 | 看板 widget `fill=true` → `embedded: true`，旧逻辑 `!compact` 强制隐藏图例 | `AdvancedEchartsChart` + `resolveEchartsChromeInsets` |
| UI 层 | 开关 `checked={show !== false}` 与渲染语义不一致 | `ChartLegendStyleSection` |
| 定位层 | 图例画在 ECharts canvas 内，相对绘图区内框而非组件内容区外缘 | `applyDeStyleToEchartsOption` |

## 修复

1. 新增 `readChartLegendVisible(deStyle, { embedded })`：显式 `show: true` 在内嵌也显示；未配置时内嵌默认隐藏、全尺寸默认显示
2. `resolveEchartsChromeInsets` 改用 `readChartLegendVisible`，移除 `!compact` 硬禁
3. 图例开关 `checked` 与 `readChartLegendVisible(..., { embedded: true })` 对齐
4. **组件外壳图例**：看板内嵌时 `shellLegend` 模式用 `EmbeddedChartLegendShell` 贴在 `pixel-shape-inner`（含标题），ECharts 内不再占位
5. **外观合并外框**：单图 `deStyle.background` / `deStyle.border` 合并到 `pixel-shape-inner`，不再只画在 `pixel-shape-content`（避免图例相对绘图区内框定位）

## 回归测试

- `chartDeStyle.test.ts`：`readChartLegendVisible`
- `echartsDeStyle.test.ts`：内嵌显式开启、字号/位置应用、`shellLegend` 禁用 ECharts 图例
- `chartLegendItems.test.ts`：漏斗/多系列项提取
- `ChartLegendStyleSection.test.tsx`：开关默认关、toggle 写入 `legend.show`
