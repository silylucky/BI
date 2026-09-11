# BUG-12：数据大屏编辑 resize 后组件内容消失

> 最近更新 2026-07-29（R6 + e2e 环境阻塞）

| 字段 | 值 |
|------|-----|
| 状态 | ✅ R6 已落地（Vitest + e2e 绿 · 2026-07-29） |
| 优先级 | P0 |
| 影响面 | `surfaceKind=data-screen` 编辑态；拖手柄微调组件尺寸 |
| 关联计划 | [`2026-07-20-data-screen-resize-geometry-pipeline.md`](../automate/plans/2026-07-20-data-screen-resize-geometry-pipeline.md) |
| 关联 case | `fe-dashboard-pixel-resize-widgets-vanish.md`（仪表板邻块路径，大屏见本 BUG） |

## 问题总览

| # | 根因 | 状态 | 说明 |
|---|------|------|------|
| RC-A | 修复场景错位（R4 仪表板邻块方案） | ✅ 已识别 | 大屏 `suppressResizePreview`，不走邻块 preview |
| RC-B | `finish()` 过早 geometry dispatch + R4 订阅竞态 | ✅ R4 已修复 | 删除 `finish()` dispatch 与 document 订阅 |
| RC-C | 双轨外框几何（React style vs imperative） | ✅ R4 已修复 | 外框仅 `syncOuterStyle` |
| RC-D | 嵌入图表测量链 commit 后断裂 | ✅ R4 已修复 | `pixelSize` 变化触发 `remeasureBody()` |
| RC-E | 双 transform scale 分裂 | 🟡 部分缓解 | `DataScreenVisualScaleProvider` 已注入 |
| RC-F | Vitest 假绿 | ✅ R4/R5 已修复 | 补大屏无 rerender + 首帧几何用例 |
| RC-G | R4 imperative-only 无首帧兜底 | ✅ R5 已修复 | 稳定态 React style 用 widget props |
| RC-H | `finish()` onCommit 晚于 setIsPlayer | ✅ R5 已修复 | 先 commit 再退出 isPlayer |
| RC-I | `activeRef` 泄漏阻塞 sync | ✅ R5 已修复 | pointerId 不匹配时释放 |
| RC-J | 仪表板 preview 与 React style 冲突 | ✅ R5 已修复 | `layoutStyleDeferred` prop |
| RC-K | `pixel-canvas-content` 依赖异步 `contentSize` 初始 0 | ✅ R6 已修复 | 大屏 `resolvedContentSize` 直读 `viewCanvas` |
| RC-L | commit 后几何双轨批量失步 | ✅ R6 已修复 | overlap `applyAll` + 大屏不写 `deferLayoutStyle` |
| RC-M | `clearPreviewChrome` 剥除 content 宽高 | ✅ R6 已修复 | `designViewportLocked` 时跳过 content imperative 清除 |
| RC-N | `flushSync` + viewPan clamp 副作用 | ✅ R6 已修复 | 移除 flushSync；clamp 仅随 viewport/scale |
| RC-O | 图表 commit 在 0 尺寸静默跳过 | ✅ R6 已修复 | D3/liveResize rAF 重试 |
| RC-P | `clearPreviewChrome` 剥除 **stage** 高度（R6 仅保护 content） | ✅ R6.1 已修复 | `designViewportLocked` 时跳过 stage/content imperative 清除 |

---

## 现象描述

| 项 | 描述 |
|----|------|
| 操作 | `/admin/data-screens/:id/edit`，选中组件，拖八向手柄略微放大/缩小，松手 |
| 期望 | 组件外框与图表等内容保持可见，尺寸与手柄一致 |
| 实际 | R3 后白屏缓解；**2026-07-23** 用户确认 R4 后外框+图表均不可见、新组件也不显示 |
| 复现 | 必现于数据大屏编辑；普通仪表板邻块推挤路径为不同代码路径 |

---

## 失败过程还原

| Seq | 动作 | 结果 | 证据来源 | 说明 |
|-----|------|------|---------|------|
| 1 | `startInteraction` resize | ✅ | L1 `PixelShape.tsx` | `isPlayer=true`，仅 imperative 跟手 |
| 2 | 大屏 `suppressResizePreview` | — | L1 `PixelShape.tsx:502` | resize **不调用** `onPreview` |
| 3 | `finish` → `applyDisplay(settledRect)` | ✅ | L1 `PixelShape.tsx:541` | 外框应为最终尺寸 |
| 4 | `dispatchPixelLayoutGeometryCommitted`（R4 前） | ❌ | L1 `PixelShape.tsx:542` | **早于** `onCommit`，订阅方用陈旧 props 覆盖 |
| 5 | `setIsPlayer(false)` + React style 写 `display` | ❌ | L1 `PixelShape.tsx:611-619` | 双轨几何，陈旧 state 覆盖 imperative |
| 6 | `handleCommit` → `notifyGeometryCommitted` | ✅ | L1 `PixelCanvas.tsx` | double rAF，layout 已提交 |
| 7 | 图表 remeasure | ❌/🟡 | L1 `useElementSize.ts` / `ChartRenderer.tsx` | RO 可能读到 0；`pixelSize` 未及时补测 |

**分水岭**：Seq 3–5 之间外框几何被回滚；Seq 6–7 图表尺寸链未跟上。

---

## 根因 RC-B：`finish()` 过早 geometry dispatch ✅ R4 修复中

**代码证据**（`fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`）：

```typescript
applyDisplay(settledRect, true);
dispatchPixelLayoutGeometryCommitted(); // 早于 onCommit
setIsPlayer(false);
if (commit && !revert) onCommit?.(withRect(widget, finalRect));
```

R4 在 `PixelShape` 订阅该事件后，`syncDisplayFromWidgetProps()` 用**未提交**的 `widget` props 覆盖 `settledRect`。

### 修复详情（2026-07-23 R4）

- 删除 `finish()` 内 `dispatchPixelLayoutGeometryCommitted`
- 删除 `PixelShape` 对 `PIXEL_LAYOUT_GEOMETRY_COMMITTED` 的 document 订阅
- 图表 remeasure 仅由 `PixelCanvas.notifyGeometryCommitted`（layout 提交后 double rAF）触发

---

## 根因 RC-C：双轨外框几何 🔧 R4 修复中

**代码证据**：非 `isPlayer` 时 React `style` 写 `display.x/y/width/height`，与 `syncOuterStyle` imperative 并存。

### 修复详情（2026-07-23 R4）

- 外框 `left/top/width/height` **仅** `syncOuterStyle` + `useLayoutEffect([widget.x,y,width,height])`
- React `style` 只保留 `zIndex` / `--dashboard-shape-gap`

---

## 根因 RC-D：嵌入图表测量链 🔧 R4 修复中

**代码证据**：`ChartRenderer` embedded 路径 `useElementSize(paused)`；`pixelSize` 来自 widget 尺寸，commit 后 prop 变化但无强制 remeasure。

### 修复详情（2026-07-23 R4）

- `pixelSize` 变化时调用 `useElementSize.remeasure()` 补测

---

## 已尝试修复

| 轮次 | 日期 | 假设 | 结果 |
|------|------|------|------|
| R1 | 2026-07-20 | previewRegistry `setDisplay` 竞态 | 用户仍复现 |
| R2 | 2026-07-20 | 去掉 React 外框几何 + `pixelSize` 拖拽期常开 | 用户仍复现 |
| R3 | 2026-07-20 | visualScale 注入 + commit 总线 + 删 geom remount | 白屏缓解；尺寸仍失败 |
| R4 | 2026-07-23 | imperative-only 外框 + geometry 事件订阅 | 用户仍复现；新组件也不显示 |
| R5 | 2026-07-23 | 稳定态 widget props React style + layoutStyleDeferred + finish 顺序 | 用户仍复现卡顿+消失 |
| R5.1 | 2026-07-23 | useLayoutEffect 仅在 props 真变化时同步；大屏 overlap 跳过 flushPreview 全画布重渲染 | Vitest 绿；用户仍复现全画布消失 |
| R5.2 | 2026-07-23 | `shouldApplyPropsRectToDisplay` + flushSync onCommit | 用户确认 layout 生效但全画布仍消失 |
| R6.1 | 2026-07-23 | 用户手测仍复现；RC-P stage 高度被 removeProperty + React 不重刷 | Vitest 40 绿；待手测 |
| R6 | 2026-07-23 | content 去状态化 + commit applyAll + 单轨几何 + clearPreviewChrome 不修 content + viewPan 稳定 + remeasure 重试 | Vitest 47 绿；e2e 待跑 |

---

## 验收标准

- [ ] 大屏编辑：拖/缩放松手后**全部**组件仍可见，无需刷新（MT 抽测；e2e 已绿）
- [x] `pnpm exec vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx` 通过（含多组件大屏 commit）
- [x] 大屏无 rerender 回归用例绿
- [x] 大屏首帧几何 + content 1920×1080 用例绿
- [x] `pnpm exec playwright test e2e/data-screen-resize-content.spec.ts --project=chromium` 通过（2026-07-29）

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-20 | 初版 |
| 2026-07-23 | R5：imperative-only 回归修复；RC-G~J |
| 2026-07-23 | R6：画布级消失收口；RC-K~O |
| 2026-07-29 | Gap-fill：手动解压 chromium-1148 + headless_shell-1148；e2e 选择器/选中态修复后绿 |
