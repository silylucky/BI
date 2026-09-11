# Headless Automation Plan — 看板保存/预览 WYSIWYG（StylePipeline）

> Plan type: Headless Automation Plan  
> Cursor Build: disabled  
> Execution trigger: dev-autopilot A5 plan-execute  
> Bug doc: `docs/bugs/BUG-10_dashboard-save-reload-layout-drift_2026-07-15.md`

## 背景

用户保存看板后再次打开，组件间隙与布局节奏与保存前编辑态不一致；预览亦与编辑不一致。根因是 **样式三源分裂** + **gap normalize 不对称** + **load 双写** + **缩放双轨**。

## 目标

建立 **load → edit → preview → save → reload** 单一路径（StylePipeline），保证「所见即所存」。

## 非目标

- 自动 repack 重叠组件（另开 CANVAS-04）
- 栅格 v1 迁移大改
- DSC-01 全量 styleConfig 拆模块（仅 facade 先行）

---

## 改动清单

### Phase 1 — StylePipeline 最小闭环（P0）✅ 已实施

| # | 文件 | 改动 |
|---|------|------|
| 1 | `fe/src/components/dashboard/stylePipeline.ts` | hydrate / resolveEffective / persist / syncPixelLayoutChartStyles |
| 2 | `fe/src/components/dashboard/stylePipeline.test.ts` | roundtrip + legacy gap + 几何不变 |
| 3 | `DashboardEditPage.tsx` | load 单写；save/isDirty 走 pipeline |
| 4 | `DashboardEditCanvas.tsx` | effectiveStyle 统一 |
| 5 | `DashboardLayoutPreview.tsx` | resolveEffective + gap runtime |
| 6 | `gapPolicy.ts` | legacy widgetGap → pixelGutter 运行时推断 |

### Phase 2 — 画布度量单源（P1）

| # | 文件 | 改动 |
|---|------|------|
| 7 | `fe/src/components/dashboard/pixelCanvas/geometry.ts` | 导出 `resolveCanvasMetricsInput(layout)` 统一 designHeight/contentHeight |
| 8 | `PixelCanvas.tsx` | 消费统一 metrics；保存与渲染共用 |
| 9 | `dashboardCanvasMode.ts` | `fitCanvasHeightToContent` 与 metrics 对齐文档 |

### Phase 3 — 契约与回归（P1）

| # | 文件 | 改动 |
|---|------|------|
| 10 | `fe/src/components/dashboard/dashboardPersistRoundtrip.test.ts` | 多 widget .fixture JSON save→hydrate→fingerprint |
| 11 | `backend/tests/test_dashboard_gap_style_config.py` | 扩展 FE golden vectors |
| 12 | `.agents/skills/bug-case-library/cases/fe-dashboard-wysiwyg-persist.md` | case 登记 |

### Phase 4 — 体验降噪（P2）

| # | 改动 |
|---|------|
| 13 | 保存成功 toast 提示「布局已按当前间隙设置持久化」 |
| 14 | 文档说明：编辑选中 chrome 与 view 态视觉差 |

---

## 八维度自审

| 维度 | 结论 |
|------|------|
| 1. 范围 | 仅 dashboard 样式/布局持久化，不触业务 API |
| 2. 依赖 | 依赖已有 gapPolicy、bootstrapDashboardStyleConfig |
| 3. 风险 | 低；pipeline 为薄 facade，可回退 |
| 4. 测试 | stylePipeline.test + 既有 gap tests |
| 5. 性能 | useMemo hydrate，无额外网络 |
| 6. 安全 | 无 |
| 7. 文档 | BUG-10 + bug-case 同步 |
| 8. 回滚 | 删除 stylePipeline，恢复直连 bootstrap |

---

## 整体验证方案

```bash
cd fe
npx vitest run src/components/dashboard/stylePipeline.test.ts \
  src/components/dashboard/dashboardGapConfig.test.ts \
  src/components/dashboard/DashboardLayoutPreview.test.ts
npx tsc --noEmit
cd ../backend && pytest tests/test_dashboard_gap_style_config.py -q
```

手测：

1. 打开用户「数据集测试111」看板，设间隙「中」，保存，刷新 — 对比外框间距
2. 设「无间隙」，保存，刷新 — 组件应贴边
3. 编辑 → 预览（未保存）— 间隙一致

---

## 推荐执行模型

`plan-execute` → implementer 子任务；Phase 2+ 可并行 spec-reviewer。
