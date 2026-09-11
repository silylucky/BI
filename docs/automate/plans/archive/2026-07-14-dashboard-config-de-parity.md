# DataEase 看板右栏全量对标（DE Parity）

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-14  
前置：`2026-07-14-dashboard-config-rail-canvas-mapping-audit.md`（Phase 0–3 已交付）

---

## 0. 需求契约

| 字段 | 值 |
|------|-----|
| request | 对照 DataEase 右栏 DOM 分区，VitalSpan 功能项「都要有」；粒度可简化但须可配置且接线 |
| type | feature |
| scope_include | `dashboardConfigPanels`、`dashboardCanvasBackgroundPanel`、`dashboardStyleConfig`、`dashboardChromeConfig`、像素画布、ChartRenderer、弹窗壳 |
| scope_exclude | 后端 schema 迁移；条件样式/跳转/单位语言 |
| acceptance | §4 矩阵 + vitest 绿 |
| autonomy_policy | auto_accept_low_risk |

---

## 1. DE → VS 差距矩阵（本轮）

| DE 分区 | 项 | 本轮 |
|---------|-----|------|
| 仪表板风格 | 浅/深 + 保存 | 已有 |
| 整体配置 | 主题色/字体/间隙/缩放/刷新 | 已有 |
| 整体配置 | 图表加载提示 | `chrome.showChartLoadingHint` → ChartRenderer |
| 整体配置 | 图表结果 | `defaultQueryLimit` + 文案 |
| 整体配置 | 悬浮按钮/操作按钮/辅助网格 | `chrome.*` 三开关 |
| 背景 | 底色/装饰/自定义图 | 已有 |
| 背景 | 弹框背景/字体色 | `dialogStyle` + CSS 变量 |
| 组件样式 | 内边距/圆角分边、模糊、背景图 | `widgetStyle` 扩展 + merge |
| 图表配色 | 不透明度 | `deStyle.paletteOpacity` |
| 高级 | 联动钻取色 / 钻取层级色 | `actionIconColor` + `drillLevelColors` UI |

---

## 2. 任务清单

| ID | 状态 | 说明 |
|----|------|------|
| T1 | done | 类型与 `dashboardChromeConfig.ts` |
| T2 | done | 右栏 UI 开关/弹框/间距/钻取色 |
| T3 | done | 画布/图表/弹窗接线 |
| T4 | done | 单测 `dashboardChromeConfig.test.ts` |

---

## 3. 验证

```bash
cd fe && npx vitest run src/components/dashboard/dashboardChromeConfig.test.ts src/components/dashboard/dashboardStyleConfig.test.ts src/components/dashboard/dashboardCanvasBackgroundPanel.test.ts src/components/dashboard/DashboardContextInspector.test.tsx
cd fe && npx tsc --noEmit
```

---

## 4. 手测清单

1. 关「悬浮操作按钮」→ 选中像素组件无右侧操作轨  
2. 关「辅助对齐网格」→ 编辑画布无点阵叠层、拖拽无对齐线  
3. 关「图表加载提示」→ 查询中无骨架屏  
4. 设弹框背景/字体色 → 打开「查看数据」弹窗颜色变化  
5. 组件内边距/圆角分边 → 栅格/像素外壳即时变化  
