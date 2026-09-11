# 看板画布边界与列表预览 · DE 对标分析

日期：2026-07-14  
关联：DASH-002 · `DashboardListCard` · `PixelCanvas`

---

## 1. DataEase 怎么区分「边界」

DE 编辑区是 **三层视觉**，不是一层：

| 层 | DE 类名/语义 | 视觉 | 作用 |
|----|-------------|------|------|
| **工作区 Workspace** | `editor-canvas-main` 外层 | 灰底 + 点阵/网格 | 无限编辑桌面；组件可拖出画板但仍属工作区 |
| **画板 Artboard** | 画布本体 | **白底 + 描边/阴影**；逻辑宽（如 1920/1440） | **仪表板边界**：右/上缘可见；底缘随内容增高 |
| **组件 Shape** | `shape` / `shape-inner` | 未选：浅灰描边；选中：品牌色描边 + 8 向手柄 | 组件边界与选中态 |

配套能力（手册 §5.2–5.4）：

- **按画布比例 / 按组件比例** 缩放（`scaleMode`）
- **组件间隙** 0–10（`pixelGutter`）
- **仪表板背景色** 画在 artboard 上，工作区仍灰点阵
- 拖拽时 **对齐参考线**（`canvas-mark-line`）— VitalSpan 待做

**结论**：用户感到「边界不明确」，通常是 **缺 artboard 白卡片** + **未选组件无边框**，而非缺 RGL 栅格线。

---

## 2. VitalSpan 现状与差距

| 项 | VitalSpan 现状 | 问题 |
|----|---------------|------|
| 工作区 | `dashboard-canvas-surface` 点阵 ✅ | 已有 |
| 画板 | `pixel-canvas-stage` 透明，widget 直接落在点阵上 | **看不出 1440px 右边界与页面底** |
| 未选组件 | `border-transparent` | **与背景融为一体** |
| 选中组件 | `border-brand-500` + 手柄 ✅ | 已有 |
| 列表预览 | `DashboardListCardPreview` 真渲染 | 缩放过小、多路查询、加载闪烁 → **效果差** |

---

## 3. 列表预览策略（修正）

| 方案 | 适用 | 结论 |
|------|------|------|
| A. 真渲染缩略图 | 单卡详情、分享页 | ❌ 列表格不适合 |
| B. **色块布局缩略图**（增强） | 列表 10–20 张/页 | ✅ **恢复** `DashboardPreviewThumb` |
| C. 服务端截图缓存 | 发布后异步生成 | 🔲 Phase 2（需 API） |

列表卡片：**固定 16:10 框 + 色块按比例还原布局**，与 DE 列表「布局示意」一致；真预览留给「预览/查看」页。

---

## 4. 编辑页修复（本轮）

### T1 — `pixel-canvas-artboard`

在 `pixel-canvas-stage` 内增加白底画板层：

- `bg-white` + `ring-1 ring-gray-200` + `shadow-theme-sm`
- 尺寸 = `viewCanvas.width × viewCanvas.height`
- `z-index` 低于 widget

### T2 — 未选组件描边

`PixelShape` 未选中：`border-gray-200/90`（dark: `border-gray-700/80`）

### T3 — 列表恢复色块预览

`DashboardListCard` 改回 `DashboardPreviewThumb`；保留 `DashboardListCardPreview` 供后续截图方案复用。

---

## 5. 后续（未做）

- [ ] 对齐参考线 `DashboardMarkLineOverlay`（DE `canvas-mark-line`）
- [ ] 画板尺寸角标（如「1440 × 900」）编辑态角标
- [ ] 列表截图 API + CDN 缩略图

---

## 6. 验收

- [ ] 编辑页可见白色画板矩形，点阵在其外侧/周围
- [ ] 未选组件有浅灰边框
- [ ] 列表卡片为色块布局预览，无图表查询风暴
