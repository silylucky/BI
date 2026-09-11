# Headless Automation Plan · 2026-07-22-code-review-fake-features-fix

- **Plan type**: Headless Automation Plan
- **Cursor Build**: disabled
- **Execution trigger**: dev-autopilot A5 plan-execute

## 背景

Code Review 发现图表/看板配置「能保存但不生效」的假功能。本轮修复 P0 + 高影响 P1。

## 目标

消除配置面板假绿，使 Inspector 控件与渲染/runtime 一致。

## 范围

### Include
- P0-2 `geo3d.terrainRelief` Three 接线
- P0-1 富文本移除假数据 Tab
- P0-3 栅格看板单组件 `widgetStyle` 外壳
- P1-1 Tooltip presentation 批量补齐
- P1-2 Shell 图例文本颜色
- P1-3 水波图目标值语义（UI 改为 %）
- P1-6 3D 地图空要素占位
- P1-8/9/10 筛选器样式 + 媒体链接提示

### Exclude
- P0-1 富文本 Dataset 动态渲染（产品决策：撤入口）
- LinkageRulesPanel 挂载、死代码清理（P2）
- region_id demo 映射（P1-11）

## Tasks

1. `terrainRelief` + 3D 空态 — `renderThreeChoropleth.ts`
2. `TextEditRail` 仅样式 Tab
3. `resolveGridWidgetShell` + Text/Media/Tabs/Filter 栅格外壳
4. Tooltip `tooltipPresentation` 补齐 ~14 render 文件
5. Shell legend `color` 发布链
6. Liquid 目标值 UI 0–100%
7. Filter labelColor + GlobalFilterBar 样式 + Media 提示修正

## 验证

```bash
cd fe && pnpm exec vitest run src/components/charts/adapters/tableStyleWiring.test.tsx src/components/charts/EmbeddedChartLegend.test.tsx src/components/charts/engine/three/geo/applyGeoTerrainSurface.test.ts --reporter=dot
cd fe && pnpm run test:chart-catalog
```
