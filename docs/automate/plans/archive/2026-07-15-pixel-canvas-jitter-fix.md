# 像素画布抖动根治 · Headless Automation Plan

> Plan type: Headless Automation Plan  
> Cursor Build: disabled  
> Execution trigger: dev-autopilot A5 plan-execute  
> 日期：2026-07-15  
> 关联：BUG-9 · DASH-002 · `2026-07-14-dashboard-canvas-right-gap-fix.md`

---

## 目标

消除看板编辑页像素画布静止/滚动时的持续抖动，对标 DataEase 稳定画板体验。

## 验收

- [ ] 编辑页打开含 chart+表格的 v2 看板，静止 10s 无可见颤动
- [ ] 纵向滚动、选中组件、切换右栏：无 scale/content 来回跳变
- [ ] `pnpm vitest run src/components/dashboard/pixelCanvas` 全绿
- [ ] `pnpm exec tsc --noEmit` 通过

---

## Task 1 — 切断视口反馈环 ✅ R1

- `DashboardEditPage`：`pixelViewportRef` 替代 `useState`
- `PixelCanvas`：`publishViewport` + `pixelRectsNearlyEqual`
- 测试：`pixelRectEqual.test.ts`

## Task 2 — 稳定测量管线 ✅ R1

- RO 回调 `requestAnimationFrame` 合帧
- `contentHeight` 12px 迟滞
- `.pixel-canvas-host { scrollbar-gutter: auto }`
- 更新 `PixelCanvas.test.tsx` rAF flush

## Task 3 — geometry 贴边（P1，待做）

- `snapScaledContentWidth`：canvas 模式 `contentWidth = round(availableWidth)`
- 补 `geometry.test.ts` 贴边用例

## Task 4 — 子树 resize 冻结（P2，待做）

- 新增 `useCanvasScaleGeneration`：scale 变化后 1 帧内 `suspendLiveResize`
- `DashboardCanvasWidgetRenderer` 传入 chart

## Task 5 — 手测与 BUG 收口（P0）

- 浏览器 QA 清单写入 BUG-9
- 更新 `docs/bugs/README.md` 状态

---

## 验证命令

```bash
cd fe && pnpm vitest run src/components/dashboard/pixelCanvas
cd fe && pnpm exec tsc --noEmit
```

## 不在本轮

- overlay 滚动条视觉（Phase 2）
- 栅格 RGL `scrollbar-gutter: stable` 行为变更
