# Dashboard 画布对标 DataEase 设计方案

日期：2026-07-13  
状态：**像素画布已实现**（代码与自动化验证完成；最终真实浏览器 Pointer QA 尚未执行）
关联：DASH-002 · `docs/bugs/BUG-1_dashboard-chart-clipped_2026-07-13.md` · `fe/src/components/dashboard/`

---

## 0. 决策记录（2026-07-13）

**用户反馈**：「只能看，拖拉拽和调大小完全不能用。」

### 0.1 Phase A 初始结论（历史）

初始审查结论为“暂不换库”，先修复 **实现缺陷 + UX 缺口**：

| 问题 | 证据（L1） | 严重度 | 处置 |
|------|-----------|--------|------|
| 拖拽/缩放过程中调用 `compactLayoutVertical` | `DashboardGrid.tsx` `applyLiveLayout` 在 `onDrag/onResize/onLayoutChange` 每帧压缩 | **P0** | **已回滚**：交互中仅 `setLayout`，松手再 `normalizeGridLayout` |
| 缩放手柄 8px + 默认 `pointer-events:none` | `index.css` L217-238 | P1 | 已放大至 12px、贴边放置 |
| 只能拖标题栏 `.dashboard-drag-handle` | `dashboardGridRgl.tsx` `draggableHandle` | P1 UX | 待加提示或允许边框拖 |
| 测试绿但无真实指针 E2E | vitest 仅单测/ smoke mock | P2 | 补 Playwright 拖放用例 |

### 0.2 Phase A FAIL → Phase B

Phase A 已完成 v1 坐标持久化、RGL 交互时序与手柄可用性修补，但真实交互门控结果为 **FAIL**。据此停止继续叠加 RGL 补丁，执行受控计划 Phase B：

- 后端 `DashboardLayout` 升级为 v1/v2 双版本；v2 使用 1440px 规范画布与 `x/y/width/height`。
- 前端自研 `PixelCanvas` + `PixelShape`，用 Pointer Capture 驱动拖移与八向缩放；允许重叠，`order` 决定层级。
- 默认启用像素画布；v1 编辑时内存迁移并首次保存为 v2。显式关闭开关时，v1 才回退 RGL；v2 仅只读且禁止保存。
- 预览、分享、缩略图与 DashboardView 外层协议按 `layout.version` 消费，v2 不转换回 `colSpan` 持久化。

**验收边界**：当前“已实现”仅指代码与自动化验证完成，不代表用户验收通过。最终真实浏览器 Pointer QA 仍须按受控计划清单执行。

---

## 1. Phase A 历史调研：无「DE 级看板画布」开箱成品

### 1.1 不存在的产品形态

市场上**没有**可直接 npm install 即获得 DataEase `editor-canvas-main` + `canvas-mark-line` + `shape-point` 完整体验的「BI 看板画布」成品库。DataEase 为自研 Vue 画布，不开源该编辑器模块；VitalSpan 约束 NFR-08 **零 DE 运行时依赖**，不能嵌入 DE 组件。

### 1.2 第三方库评估（2026-07）

| 库 | Stars/成熟度 | 对标 DE 能力 | 结论 |
|----|-------------|-------------|------|
| **[react-grid-layout](https://github.com/react-grid-layout/react-grid-layout)**（已用 v2.2） | 高 · 业界标准 | 栅格拖放/缩放/紧凑；**无** mark-line；v2 有 `GridBackground` 可自绘参考栅格 | **保留为布局引擎** |
| **[gridstack.js](https://github.com/gridstack/gridstack.js)** | 高 · 7k+ | 仪表板专用、八向 resize、移动端；**无**对齐参考线 | 换库收益低，迁移成本中 |
| **[snapgrid](https://snapgrid.dev/)** | 新 · RGL v2 替代 | dnd-kit 驱动、snapToGrid；**无**元素间对齐线 | 不解决 mark-line 诉求 |
| **[react-moveable](https://github.com/daybrush/moveable)** | 高 · moveable 生态 | **Snappable** + `elementGuidelines` ≈ DE mark-line；八向 resize ≈ shape-point；需自管布局状态 | **推荐叠加层** |
| **[react-gridy-canvas](https://github.com/fuvl/react-gridy-canvas)** | **0 stars** · 无社区 | 文档宣称 Figma 式 snap lines | **否决**（未生产可用） |
| **[Puck](https://puckeditor.com/)** / Craft.js | 中 | 页面搭建器，非 BI widget 栅格 | **域不匹配** |
| **Konva / tldraw** | 高 | 自由画布/设计工具 | 过重，需重写 widget 渲染与 layout 契约 |

### 1.3 行业参照

| 产品 | 画布技术 |
|------|----------|
| Apache Superset | react-grid-layout |
| Grafana | 自研 grid |
| DataEase | 自研像素画布 + mark-line 层 |
| VitalSpan（现） | react-grid-layout + 自研 adapter |

**结论**：对标 DE **对齐参考线 + 精细缩放**，最可行路径是 **保留 RGL + 叠加 react-moveable Snappable**（或自绘 SVG 参考线），而非更换整体布局库。

---

## 2. Phase A 历史目标与非目标

### 2.1 目标（分阶段）

| 阶段 | 用户可感知能力 | 对标 DE |
|------|---------------|---------|
| **P1** | 拖拽/缩放时出现**对齐参考线**（组件边/中心/画布中线） | `canvas-mark-line` |
| **P1** | 多选后**对齐/分布**工具栏 | DE 编辑栏 |
| **P1** | 图表在 widget 内**完整自适应**（BUG-1 收口） | 图表区 |
| **P2** | 细栅格（24/48 列）或亚像素吸附，缩放更「无极」 | shape-point 手感 |
| **P3**（可选） | 像素坐标 `x/y/width/height` 布局 + 迁移 | 完全同等 |

### 2.2 非目标

- 不引入 DataEase / Superset 运行时（NFR-08）
- 不在 P1 改动 `layoutJson` 后端契约（仍 `colSpan/rowSpan/gridX/gridY`）
- 不做旋转、倾斜、组合变形（DE 看板亦少见）

---

## 3. Phase A 历史推荐：RGL + MarkLine 叠加层

### 3.1 架构

```text
DashboardEditWorkspace
└── DashboardGrid
    ├── DashboardRglCanvas          ← 布局真理源（现有）
    │     └── widgets (grid items)
    └── DashboardMarkLineOverlay    ← 新增，pointer-events: none
          └── 拖拽/缩放时绘制 SVG 参考线
```

**交互分工**：

| 层 | 职责 |
|----|------|
| `react-grid-layout` | 落点、碰撞、紧凑、`layoutJson` 序列化 |
| `DashboardMarkLineOverlay` | 仅视觉 + 吸附计算，不写库 |
| `gridSnapUtils` | 扩展：吸附到邻 widget 边缘/中心（栅格单位） |

### 3.2 Mark-line 实现（二选一，推荐 A）

**方案 A — 自绘 SVG（推荐 P1）**

- 在 `onDrag` / `onResize` 时根据当前 item 与其它 item 的栅格边界计算对齐线
- 用 `gridSpanToPixelHeight` + RGL `rowHeight/margin` 换算为像素坐标画线
- 吸附：松手前将 `x/y/w/h` 对齐到最近参考（阈值 1 列 / 半行）
- **依赖**：无新 npm 包
- **工作量**：约 2–3 人日

**方案 B — react-moveable Snappable**

- 编辑态选中 widget 时挂载 `Moveable`（`snappable` + `elementGuidelines={其它 widget DOM}`）
- 拖拽结束将像素 bbox 反算为栅格 `x/y/w/h` 写回 RGL
- **风险**：RGL 与 Moveable 双控制器冲突，需「交互模式」互斥
- **工作量**：约 4–5 人日

**推荐 P1 用方案 A**；若 A 吸附手感不足再引入 B。

### 3.3 多选对齐工具栏（P1）

- 复用现有 `selectedIds` + Shift 多选（`DashboardEditPage` 已有）
- 画布顶栏增加：左对齐 / 右对齐 / 顶对齐 / 底对齐 / 水平居中 / 垂直等距
- 实现：纯栅格坐标运算后 `setWidgets` + `onLayoutChange`
- **工作量**：约 1–2 人日

### 3.4 文件改动范围（P1）

| 文件 | 改动 |
|------|------|
| `fe/src/components/dashboard/DashboardMarkLineOverlay.tsx` | **新增** SVG 参考线 |
| `fe/src/components/dashboard/gridSnapUtils.ts` | 吸附算法、邻组件边界 |
| `fe/src/components/dashboard/DashboardGrid.tsx` | 挂载 overlay、drag/resize 回调 |
| `fe/src/components/dashboard/DashboardAlignToolbar.tsx` | **新增** 多选对齐 |
| `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` | 工具栏入口 |
| `fe/src/components/dashboard/DashboardGrid.interaction.test.tsx` | mark-line / 对齐用例 |
| `docs/bugs/BUG-1_*.md` | 图表裁切验证后改 fixed |

**不改**：`backend/app/dashboard/schemas.py`（P1）

---

## 4. Phase A 历史备选方案对比

| 方案 | 描述 | 工期 | DE 相似度 | 风险 |
|------|------|------|-----------|------|
| **推荐 P1** | RGL + 自绘 mark-line + 对齐栏 | 4–6 人日 | ~75% | 低 |
| P1-B | RGL + react-moveable Snappable | 5–7 人日 | ~80% | 双引擎冲突 |
| P2 | 换 gridstack.js | 5–8 人日 | ~60% | 回归大、仍无 mark-line |
| P3 | 像素画布 + layout v2 schema | 15–25 人日 | ~95% | 迁移、嵌入、分享全链路 |

---

## 5. Phase A 历史 P2：更「无极」的缩放

在保留 12 列 API 前提下：

1. **细栅格**：RGL `cols=48`，入库时 `colSpan = round(w * 12 / 48)`（前端换算，后端仍 1–12）
2. 或 **行高** 降至 16px、`maxH` 提高（已部分做 32px）

无需第三方库。

---

## 6. Phase B：像素布局契约（已实现）

### 6.1 layoutJson v2

```json
{
  "version": 2,
  "canvas": { "width": "100%", "unit": "px" },
  "widgets": [{
    "id": "…",
    "x": 120, "y": 80, "width": 480, "height": 320,
    "order": 1
  }]
}
```

- 后端统一入口按版本禁止字段混用；v1 使用栅格字段，v2 使用像素字段。
- 迁移纯函数：`gridX/colSpan/rowSpan` → 1440px 规范坐标；画布高度自动容纳最底部组件。
- 编辑器：自研 React Pointer Events / Pointer Capture 交互，不新增第三方画布运行时。
- `pixelCanvas/` 只负责 v2 几何、交互与历史；`dashboard-edit/` 只负责编辑页编排和 widget 内容适配。

---

## 7. Phase B 验收状态

| ID | 标准 |
|----|------|
| DE-CANVAS-01 | v2 像素坐标与画布 bounds 后端往返 | 自动化已覆盖 |
| DE-CANVAS-02 | Pointer Capture 拖移、八向缩放、cancel/lost capture 收口 | 单元测试已覆盖；真实浏览器 QA 待执行 |
| DE-CANVAS-03 | 编辑态 shape outer / edit-bar / inner；预览态无编辑 chrome | 组件测试已覆盖 |
| DE-CANVAS-04 | v1 迁移 v2；v2 保存不得出现 `colSpan` | 自动化已覆盖 |
| DE-CANVAS-05 | 预览、分享、缩略图、View 协议保留 v2 几何 | 自动化已覆盖 |
| DE-CANVAS-06 | 保存刷新后位置/尺寸不变 | API 往返已覆盖；真实浏览器 QA 待执行 |

---

## 8. 最终决策

1. 不引入 DataEase、gridstack、react-moveable 等新运行时；采用自研轻量像素交互层。
2. v2 为默认编辑路径；v1 RGL 只保留紧急回滚。
3. 不实施 mark-line、多选对齐等无关 UI 扩展；先完成 BUG-2 的拖移/缩放/持久化闭环。
4. 最终关闭 BUG-2 前必须完成真实浏览器 Pointer QA。

---

## 9. 待执行门控

- [x] Phase A 门控 FAIL，批准执行 Phase B 像素画布
- [x] B1–B3 代码实施并通过 task review
- [ ] 真实浏览器 Pointer QA：拖移、八向缩放、保存、刷新位置保持
- [ ] QA 通过后再将 BUG-2 标记 closed / 用户验收通过
