# 像素画布对齐参考线（Mark Line）· DE 对标实施计划

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  

日期：2026-07-14  
真理源：`docs/superpowers/specs/2026-07-13-dashboard-de-canvas-design.md` · DASH-002  
DE 源码参考：[MarkLine.vue](https://github.com/dataease/dataease/blob/ee25da15/core/core-frontend/src/components/data-visualization/canvas/MarkLine.vue) · [CanvasCore.vue](https://github.com/dataease/dataease/blob/ee25da15/core/core-frontend/src/components/data-visualization/canvas/CanvasCore.vue)

---

## 0. 需求契约（dev-autopilot 编译）

| 字段 | 值 |
|------|-----|
| request | 对标 DataEase 拖拽/缩放时的对齐参考线（canvas-mark-line） |
| type | feature |
| goal | v2 像素画布编辑态拖移/八向缩放时显示对齐线并磁吸对齐邻组件 |
| scope_include | `pixelCanvas/` 纯函数吸附、`PixelMarkLineOverlay`、PixelCanvas/PixelShape 接线、单测、CSS token |
| scope_exclude | v1 RGL mark-line；多选对齐工具栏；旋转组件；react-moveable；后端 schema |
| acceptance | 单测覆盖吸附算法；vitest 绿；手工：拖近邻组件边/中心出现蓝线且松手对齐 |
| risk_level | low |
| autonomy_policy | auto_accept_low_risk |

---

## 1. DataEase 功能调研

### 1.1 架构位置

```text
CanvasCore（编辑引擎）
├── Shape × N          ← 拖移/缩放入口
├── MarkLine           ← 对齐参考线层（#canvas-mark-line）
├── Area               ← 框选（本轮不做）
└── de-grid            ← 背景栅格（我们有 dashboard-canvas-surface 点阵）
```

`MarkLine` **仅在主画布编辑态**显示（`markLineShow = isMainCanvas`），预览态不显示。

### 1.2 六条参考线语义

| 线 ID | 方向 | 含义 |
|-------|------|------|
| `xt` | 横线 | 活动组件 **顶边** 对齐参考 |
| `xc` | 横线 | 活动组件 **垂直中心** 对齐参考 |
| `xb` | 横线 | 活动组件 **底边** 对齐参考 |
| `yl` | 竖线 | 活动组件 **左边** 对齐参考 |
| `yc` | 竖线 | 活动组件 **水平中心** 对齐参考 |
| `yr` | 竖线 | 活动组件 **右边** 对齐参考 |

### 1.3 对齐判定（每邻组件 10 种组合）

对当前活动组件矩形与每个**其他**组件矩形，比较：

**水平方向（影响 top / 显示 xt/xc/xb）：**

- 活动 top ≈ 邻 top → 吸顶对齐顶
- 活动 bottom ≈ 邻 top → 吸底对齐顶
- 活动中心 Y ≈ 邻中心 Y → 中心对齐
- 活动 top ≈ 邻 bottom → 吸顶对齐底
- 活动 bottom ≈ 邻 bottom → 吸底对齐底

**垂直方向（影响 left / 显示 yl/yc/yr）：** 同理 5 种。

### 1.4 磁吸阈值与视觉

| 项 | DE 实现 |
|----|---------|
| 吸附阈值 | `diff = 3`（px，与鼠标移动同坐标系） |
| 线颜色 | `#59c7f9` |
| 线宽 | 1px；横线 `width:100%`，竖线 `height:100%` |
| 层级 | `z-index: 1000`；`pointer-events: none` |
| 生命周期 | `eventBus 'move'` 显示/吸附；`'unMove'` 隐藏 |
| 多线冲突 | `chooseTheTrueLine`：按拖动方向优先（右移优先 yr→yc→yl；下移优先 xb→xc→xt） |

### 1.5 与 VitalSpan 差异

| 维度 | DataEase | VitalSpan 现状 |
|------|----------|----------------|
| 布局 | 矩阵/像素双模式 + Pinia | v2 像素画布 + 本地 state |
| 对齐 | MarkLine + 实时改 style | **无** |
| 碰撞 | 矩阵重排 | 级联推挤（`collisionLayout`） |
| 画板 | 白底 artboard | 已实现 `pixel-canvas-artboard` |

**结论**：应在 **v2 PixelCanvas** 自绘 SVG 参考线 + 纯函数吸附（方案 A），**不引入** react-moveable（NFR-08 + 双控制器风险）。

---

## 2. 目标行为（验收口径）

### 2.1 用户可见

1. 编辑态拖移或八向缩放组件时，当边/中心与邻组件边/中心距离 ≤ 阈值，出现 **品牌青色** 参考线（横跨画板或竖跨画板）。
2. 同时 **磁吸** 活动组件到对齐位置（拖动手感与 DE 一致）。
3. `pointerup` / `pointercancel` 后参考线消失。
4. 预览/只读态无参考线。

### 2.2 可选 P1.5（时间允许）

- 与 **画板** 对齐：`x=0`、`x=canvas.width`、水平中心 `width/2`（DE 源码未做，但 Figma 类工具有；可开关）

---

## 3. 技术方案

### 3.1 模块划分

```text
pixelCanvas/
├── pixelMarkLine.ts              # 纯函数：computeMarkLineSnap + chooseVisibleLines
├── pixelMarkLine.test.ts
├── PixelMarkLineOverlay.tsx      # SVG 层，pointer-events-none
├── PixelShapeInteractionContext  # 已有；扩展传 dragDelta 方向
├── PixelShape.tsx                # 拖移/缩放中调用 snap，上报 guides
├── PixelCanvas.tsx               # 持有 guideState，渲染 Overlay
└── geometry.ts                   # 复用 PixelRect
```

### 3.2 坐标系

- 全部在 **画布逻辑坐标**（1440 基准）计算。
- 屏幕阈值：`SNAP_THRESHOLD_CANVAS = 3 / scale`（与 DE 3px 屏幕吸附等价）。
- Overlay 放在 `pixel-canvas-stage` 内，与 artboard 同缩放，线条用 canvas 坐标绘制。

### 3.3 数据流

```text
PointerMove (PixelShape)
  → applyPixelInteraction → draft Rect
  → computeMarkLineSnap(draft, others, canvas, { threshold, dragDir })
  → { snappedRect, lines: { xt?, xc?, xb?, yl?, yc?, yr?, positions } }
  → setDisplayRect(snappedRect) + onGuideChange(lines)
PointerUp
  → onGuideChange(null) + onCommit(snappedRect)
```

`dragDir`：比较 `clientX/Y` 与 `startClient` 得到 `isRightward` / `isDownward`（对齐 DE `chooseTheTrueLine`）。

### 3.4 与碰撞推挤的关系

| 阶段 | 行为 |
|------|------|
| 拖动中 | **仅** mark-line 吸附 + 参考线；**不**每帧跑 `resolvePixelCollisions`（避免与吸附打架） |
| 松手 commit | 现有 `resolvePixelCollisions` 级联推挤 **保持不变** |

`handlePreview` 在拖动中不再 `setPreviewLayout(resolveActive)`，改为仅更新 guides；或保留推挤但延后到 commit（推荐后者，改动更小：拖动中只 guides，commit 时 collision）。

### 3.5 样式

```css
/* fe/src/index.css */
.pixel-canvas-mark-line {
  stroke: var(--color-mark-line, #59c7f9); /* 对齐 DE，后续可 token 化 brand */
  stroke-width: 1;
  pointer-events: none;
}
```

---

## 4. 实施任务

### T1 — `pixelMarkLine.ts` 纯函数（RED → GREEN）

**文件**：`fe/src/components/dashboard/pixelCanvas/pixelMarkLine.ts`

**导出**：

```ts
export type MarkLineId = "xt" | "xc" | "xb" | "yl" | "yc" | "yr";
export type MarkLineGuide = { id: MarkLineId; position: number }; // x 或 y 坐标
export type DragDirection = { isRightward: boolean; isDownward: boolean };

export function computeMarkLineSnap(
  active: PixelRect,
  others: PixelRect[],
  options: { threshold: number; dragDir: DragDirection; canvas?: PixelCanvasBounds },
): { rect: PixelRect; guides: MarkLineGuide[] };
```

**测试**（`pixelMarkLine.test.ts`）：

1. 两矩形顶对齐：threshold 内 → `rect.y` 吸附 + 出现 `xt`
2. 中心对齐：出现 `xc` / `yc`
3. 阈值外：guides 空数组
4. 多候选线：`chooseVisibleLines` 按拖动方向只保留 1 横 + 1 竖（DE 行为）
5. （P1.5）`canvas.width` 右缘吸附

### T2 — `PixelMarkLineOverlay.tsx`

- `guides: MarkLineGuide[]` + `canvas: { width, height }`
- SVG `viewBox={`0 0 ${width} ${height}`}`，`className="absolute inset-0 z-[1000] pointer-events-none"`
- 横线：`y=position` 从 0 到 width；竖线：`x=position` 从 0 到 height

### T3 — `PixelCanvas` 状态与挂载

- `const [markGuides, setMarkGuides] = useState<MarkLineGuide[] | null>(null)`
- 通过 `PixelShapeInteractionProvider` 或新 context 下发 `onMarkGuidesChange`
- `mode === "edit"` 时渲染 `<PixelMarkLineOverlay guides={markGuides ?? []} canvas={viewCanvas} />` 于 artboard 之上、widgets 之下或之上（线应在最顶：z 高于 shape）

### T4 — `PixelShape` 集成吸附

- `activeRef` 增加 `lastClient` 用于 `dragDir`
- `rectForEvent` 内：`computeMarkLineSnap` 替换 raw `applyPixelInteraction` 结果（仅 move/resize 类 kind）
- `finish` / `onLostPointerCapture`：`onMarkGuidesChange?.(null)`
- 拖动中 **不** 调用 `onPreview` 触发 collision（或 PixelCanvas 忽略 preview 级 collision）

### T5 — 编辑壳层与文档

- `fe/src/components/README.md`：登记 `PixelMarkLineOverlay` / `pixelMarkLine`
- `docs/superpowers/plans/2026-07-14-dashboard-canvas-boundary-de.md`：追加「mark-line 已计划」链接
- PRD 评估：DASH-002 演化建议补一条 mark-line（**不**改验收勾选，属增强）

### T6 — 验证

```bash
cd fe && npx vitest run \
  src/components/dashboard/pixelCanvas/pixelMarkLine.test.ts \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx \
  src/components/dashboard/pixelCanvas/geometry.test.ts
```

手工门控（浏览器）：

1. 两图表左右并排放置，拖其中一个靠近另一左边 → 出现竖线 + 左边对齐
2. 拖向下靠近顶边对齐 → 横线
3. 松手后线消失；保存刷新位置保持
4. 八向缩放靠近邻组件边 → 同样出现线

---

## 5. 八维度自审

| 维度 | 结论 | 说明 |
|------|------|------|
| 正确性 | 🟢 | 算法直接移植 DE 10+10 条件；阈值按 scale 换算 |
| 完整性 | 🟢 | 覆盖 move + 8 向 resize；编辑/预览分离 |
| 可测试性 | 🟢 | 纯函数单测为主；Overlay smoke 可选 |
| 风险 | 🟢 | 不改 layout schema；与 collision 解耦到 commit |
| 性能 | 🟢 | O(n) 邻组件；列表页无影响 |
| 一致性 | 🟢 | 颜色/六线语义对齐 DE |
| 可维护性 | 🟢 | 无新 npm 依赖 |
| 文档 | 🟢 | 本 plan + README |

---

## 6. 非目标（显式）

- v1 `DashboardGrid` / `gridSnapUtils` mark-line
- 多选批量对齐工具栏（`DashboardAlignToolbar`）
- `Area` 框选
- 旋转组件对齐
- react-moveable / gridstack

---

## 7. 工期估算

| Task | 人日 |
|------|------|
| T1 纯函数 + 测试 | 0.5 |
| T2 Overlay | 0.25 |
| T3–T4 接线 + Shape | 1 |
| T5–T6 文档 + 手工 | 0.25 |
| **合计** | **~2 人日** |

---

## 8. 执行顺序

```
T1 (RED tests) → T1 (GREEN) → T2 → T3 → T4 → T6 vitest → 手工门控 → T5 文档
```

---

## 9. plan-review 预审备注

- 与 `collisionLayout` 的交互已在 §3.4 钉死：拖动中仅吸附，松手再推挤。
- 默认路径为 **v2 pixel**；v1 回退画布无 mark-line 可接受（紧急回退场景）。
- 若 plan-review 要求 P1.5 画板缘吸附，可作为 T1 可选子测试一并交付。
