# 像素画布坐标系一致性 · Headless Automation Plan

日期：2026-07-17  
Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
关联：DASH-002 · `PixelCanvas` · BUG 拖动/点击视觉与命中区错位

---

## 1. 现象（用户反馈）

- 编辑页 1440px 画布：左侧大块浅色留白，组件挤在右侧深色区域
- **拖动、点击**后加剧：组件视觉位置与可交互区域不一致
- 与「按组件比例」留白、背景色不同步等问题叠加，用户感知为「实际可用区域和显示不一致」

---

## 2. 根因分层（代码证据）

| 层级 | 证据 | 影响 |
|------|------|------|
| **P0 坐标参照系错误** | `clientPointToCanvas` 以 `pixel-canvas-host` + 手算 `horizontalGutter`/`stageLeft` 换算（`geometry.ts` L303–315；`PixelCanvas.tsx` 原 L597–607） | 未计入 `stage` 的 `transform: scale()`、flex 居中、`stageLeft` 组合偏移；拖放/点击落点漂移 |
| **P1 测量宽度偏差** | `scaledCanvasMetrics` 用 `clientWidth`；host 有 `padding-right:20px` + `margin-right:-20px` 藏条（`index.css` L415–417） | scale 按逻辑宽算、视觉外框不一致 → 画板与点阵/组件横向错位 |
| **P2 预览期 DOM 抖动** | `syncPreviewStageMetrics` 拖动中写 `content.style.width`（`PixelCanvas.tsx`） | 与 React `contentSize` 状态打架，引发布局跳动 |
| **P3 缩放模式留白** | `component` 模式 `centerContent` 信箱（`geometry.ts` L133–141） | 两侧露出壳层底色；编辑态已在上一轮强制 `canvas` 模式，但预览仍可能复现 |

---

## 3. 方案

### T1 — Stage 参照坐标（P0，已实施）

- 新增 `clientPointToCanvasFromStage(stage, clientX, clientY, scale)`
- `PixelCanvas.resolveClientToCanvas` 改为读取 `stageRef.getBoundingClientRect()`
- 自动吸收 scroll、居中、scale，删除 host gutter 手算

### T2 — 测量宽度统一（P1，已实施）

- 新增 `resolvePixelCanvasMeasureWidth(el)`：`getBoundingClientRect().width` 优先
- `applyMetrics` / `syncPreviewStageMetrics` 改用该宽度

### T3 — 预览期只调高度（P2，已实施）

- `syncPreviewStageMetrics` 仅写 `content.style.height`，不再覆盖 `width`

### T4 — 回归测试（P1）

- `geometry.test.ts`：stage 坐标换算单测
- `PixelCanvas.test.tsx`：编辑态 `component` 仍贴满宽（上轮）
- 全量 `pixelCanvas` vitest

### T5 — 文档与 Case（P2）

- `.agents/skills/bug-case-library/cases/fe-dashboard-pixel-canvas-coordinate-drift.md`

### T6 — 人工验收

- [ ] 编辑页：拖组件任意位置，松手与视觉一致
- [ ] 从工具栏拖入图表，落点与鼠标一致
- [ ] 滚动画布后点击空白/组件，选中正确
- [ ] 预览页 `component` 模式：两侧留白同色（上轮 host 背景）

---

## 4. 不在本轮

- 移除 `margin-right:-20px` 藏条（需单独 UX 评估）
- 重写 `visibleCanvasViewport` 为 stage 参照（视口裁切次要）

---

## 5. 决策

**T1+T2+T3 为最小正确修复**；坐标必须以 **已 transform 的 stage 外框** 为唯一真理源，禁止 host 手算偏移。
