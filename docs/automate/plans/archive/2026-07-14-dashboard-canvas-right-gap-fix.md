# 看板编辑画布右侧余隙 · 修复方案

日期：2026-07-14  
关联：DASH-002 · `PixelCanvas` · `dashboard-canvas-surface` · BUG 画布右侧空隙  
对标：DataEase `DePreview.vue`（`::-webkit-scrollbar { width: 0 }` + 画板贴满工作区）

---

## 1. 现象

编辑页 `CanvasShell` → `dashboard-canvas-surface`（约 766×770）内，白色画板右侧仍有一条 **窄点阵带**（约 8–17px），与 DE「画板右缘即工作区内容右缘」不一致。

预览页大块空隙已通过 `scaledCanvasMetrics` 设计高度拆分修复；编辑页残留为 **次级布局问题**。

---

## 2. 根因（分层）

| 层级 | 证据 | 影响 |
|------|------|------|
| **P0 滚动条槽** | `index.css` L227 `dashboard-canvas-surface` 与 L263 `pixel-canvas-host` 均 `scrollbar-gutter: stable` | LTR 下**永久预留**竖滚动条宽度；画板按 `clientWidth` 缩放，右侧槽位露出点阵 →「小间隙」 |
| **P1 宽度取整** | `contentWidth = Math.ceil(scaledWidth)` + `transform: scale()` 亚像素 | 极端分辨率下 1–2px 缝；`canvas` 模式应直接贴满 `availableWidth` |
| **P2 测量锚点** | `resolvePixelCanvasMeasureElement` 固定取 `dashboard-canvas-surface` | 栅格 RGL 需要；像素模式应优先测 **实际滚动宿主** `pixel-canvas-host` |
| **非根因** | 右栏 432px、`lg:grid-cols-[1fr_auto]` | 属编辑布局，不是画板内右侧点阵带 |

DE 对照：预览容器 `overflow-y: auto` 且 **隐藏滚动条**，不占布局宽度；画板 `width: 100%` 或等比居中，不在右侧留稳定槽。

---

## 3. 方案

### T1 — 滚动条槽收口（P0）

```css
/* 像素画布：滚动发生在 host，surface 不预留槽 */
.dashboard-canvas-surface:has(.pixel-canvas-host) {
  scrollbar-gutter: auto;
}
.pixel-canvas-host {
  scrollbar-gutter: auto; /* 去掉 stable，避免无滚动时也留缝 */
}
/* 栅格 RGL 仍保留 surface stable，防 WidthProvider 宽度抖动 */
```

### T2 — 宽度贴边（P1）

`geometry.ts` → `snapScaledContentWidth`：

- **按画布比例**：`contentWidth = round(availableWidth)`（已按宽比缩放，直接贴满）
- **按组件比例**：若 `availableWidth - scaledWidth < 2px`，吸收到 `availableWidth`；否则 `ceil` + 居中

### T3 — 测量宿主（P1）

`resolvePixelCanvasMeasureElement`：若祖先链存在 `pixel-canvas-host`，**优先返回 host**，避免 surface 与 host 双层宽度不一致。

### T4 — 回归测试（P1）

- `geometry.test.ts`：贴边 snap、设计高度比例用例
- `DashboardEditWorkspace.test.tsx`：像素模式下 surface 无 `scrollbar-gutter: stable`（可选样式断言）

### T5 — 人工验收

- [ ] 编辑页 · 按画布比例：画板右缘与点阵区右缘对齐（无窄条）
- [ ] 编辑页 · 按组件比例：左右对称留白或贴满（无单侧 15px 槽）
- [ ] 内容超高：纵向滚动正常，无宽度抖动
- [ ] 栅格看板（v1）：RGL 编辑无 WidthProvider 闪烁回归

---

## 4. 不在本轮

- 画板 `ring-1` 改 `box-shadow` 内描边（视觉 1px，非布局缝）
- 右栏折叠后全宽（独立 IA 需求）
- DE 式完全隐藏滚动条（可 Phase 2 用 `no-scrollbar` + 滚轮）

---

## 5. 决策

**先 T1+T2+T3**，预期消除编辑页右侧点阵窄条；若仍有缝，再查 `ring-1` 与浏览器 zoom。
