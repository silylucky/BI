# 数据大屏 Phase 2.5 Wave B 验收闭合

> **已并入** [Master Gap-fill](./2026-07-29-data-screen-master-gap-fill.md)（统一真理源）

| 项 | 值 |
|----|-----|
| 模式 | Gap-fill（对标 DataEase 2.x 编辑深化） |
| 日期 | 2026-07-29 |
| 状态 | **已闭合** |
| 执行依据 | `docs/automate/plans/archive/2026-07-17-data-screen-phase25-execute.md` Wave B |

## 1. 问题与结论

Phase 2.5 Wave B（编辑深化）代码早已落地，但执行计划勾选与自动化验收长期空缺。本轮以**验收驱动闭合**为主：补 Vitest、核对行为、同步文档，无新架构变更。

**审计结论**：B1 单组件锁定在 `PixelShape` 已完整（拖拽/键盘/八向手柄）；像素画布无多选变形入口，不存在计划所述「多选 resize 漏网」。

## 2. Wave B 闭合清单

| ID | 能力 | 代码锚点 | 测试 |
|----|------|----------|------|
| B1 | 图层锁定禁拖拽/缩放/键盘 | `pixelCanvas/PixelShape.tsx` | `PixelCanvas.test.tsx` locked ×3 |
| B2 | Tab 预览轮播 | `TabsWidget.tsx` | `TabsWidget.test.tsx` |
| B3 | 导出布局 JSON | `DataScreenConfigExtras.tsx` · `exportLayoutJson.ts` | `exportLayoutJson.test.ts` · `DataScreenConfigExtras.test.tsx` |
| B4 | 图表放大导出 PNG | `WidgetEnlargeDialog.tsx` | `WidgetEnlargeDialog.test.tsx` |
| B5 | 图层 Panel Tab 子项 | `LayerPanel.tsx` | `LayerPanel.test.tsx` |

## 3. 手测登记（建议每版发版前抽测）

| 步骤 | 操作 | 期望 |
|------|------|------|
| MT-1 | 大屏编辑 → 图层 Panel 锁定某组件 → 拖动手柄/八向缩放/方向键 | 无位移、无尺寸变化 |
| MT-2 | Tab 容器开启轮播（≥3s）→ 保存 → `/preview` | 页签自动切换；编辑态不切换 |
| MT-3 | 配置区「布局 JSON」导出 → 列表「导入 JSON」 | 新建大屏布局一致 |
| MT-4 | 图表「放大」→「导出图片」 | PNG 下载成功（ECharts 类图表） |
| MT-5 | 图层 Panel 展开含 Tab 的页面 | 子组件缩进 +「Tab 内嵌」文案 |

## 4. 后续项（已移交 master）

| 项 | 处理 |
|----|------|
| 编辑视口 T2–T3 | ✅ 已闭合 · `plans/2026-07-20-data-screen-edit-viewport-de.md` |
| 保存 WYSIWYG（gap 压实） | ✅ [BUG-14](../bugs/BUG-14_data-screen-save-gap-compaction_2026-07-29.md) |
| BUG-12 resize e2e | ✅ `e2e/data-screen-resize-content.spec.ts` 绿（2026-07-30 复验） |
| A2 share smoke | ✅ `DashboardSharePage.smoke.test.tsx` |
| Wave C/D | ✅ [wave-cd-gap-fill](./2026-07-29-data-screen-wave-cd-gap-fill.md) |

## 5. 验证命令

```bash
cd fe && npx vitest run \
  src/lib/exportLayoutJson.test.ts \
  src/components/dashboard/TabsWidget.test.tsx \
  src/components/dashboard/widget-actions/WidgetEnlargeDialog.test.tsx \
  src/components/dashboard/LayerPanel.test.tsx \
  src/components/dashboard/screen/DataScreenConfigExtras.test.tsx \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx -t "locked"
```
