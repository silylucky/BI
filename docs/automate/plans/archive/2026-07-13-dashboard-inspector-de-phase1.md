# Dashboard Inspector DE 对标 Phase 1

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-13

## 目标

将看板编辑右栏 `WidgetInspector` 信息架构对标 DataEase `chart-edit` Phase 1：加宽、数据/样式/高级 Tab、顶栏切换图表、工程绑定下沉高级 Tab。

## 范围

| 包含 | 不含 |
|------|------|
| `DashboardEditWorkspace` 栏宽 | 字段库拖放（Phase 2） |
| `ChartInspectorTabs` | 聚合函数后端 |
| `WidgetInspector` IA 重组 | PRD 状态回写 |
| `ChartConfigPanel` section 拆分 | |
| smoke 测试适配 | |

## Task

1. `DashboardEditWorkspace.tsx` — 右栏 `minmax(360px,420px)`
2. `chartFieldSlots.ts` — 轴语义标签
3. `ChartInspectorTabs.tsx` — 数据/样式/高级
4. `ChartConfigPanel.tsx` — `section` + compact 主按钮「更新图表」
5. `WidgetInspector.tsx` — 顶栏换型 + Tab 编排
6. 测试：`WidgetInspector.smoke` + `dashboard.smoke` 相关断言

## 验收

- 右栏 lg ≥360px
- 默认「数据」Tab 见维度/度量（轴语义标签）
- Dataset/SQL 在「高级」Tab
- 顶栏可切换图表类型
- compact 主按钮文案「更新图表」
- `vitest run WidgetInspector.smoke dashboard.smoke charts.advanced.smoke` 全绿

## 验证命令

```bash
cd fe && pnpm exec vitest run \
  src/components/dashboard/WidgetInspector.smoke.test.tsx \
  src/pages/admin/dashboard/dashboard.smoke.test.tsx \
  src/components/charts/charts.advanced.smoke.test.tsx
```
