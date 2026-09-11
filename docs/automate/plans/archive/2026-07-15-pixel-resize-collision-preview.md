# 像素画布缩放碰撞预览 · 与拖拽管线对齐

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-15  

真理源：`docs/bugs/BUG-7_dashboard-resize-no-collision_2026-07-15.md` · `prd/F07-DASH.md` DASH-002 · `docs/superpowers/specs/2026-07-13-dashboard-de-canvas-design.md`  
前置：`2026-07-14-dashboard-canvas-ux-de-complete.md`（**C3 决策需反转**）

---

## 0. 需求契约（dev-autopilot 编译）

| 字段 | 值 |
|------|-----|
| request | 像素画布组件调整大小时应与邻组件碰撞推挤，行为与拖拽一致 |
| type | bug |
| goal | resize 手势中邻组件跟手让位；松手后 layout 无重叠；不回归图表 live resize 性能 |
| scope_include | `PixelShape.tsx` · `PixelCanvas.tsx` · `PixelCanvas.test.tsx` · `collisionLayout.test.ts`（可选补例）· BUG-7 · evolution-state |
| scope_exclude | 横向 pushRight 二维碰撞（RC-3，另开）· Playwright E2E · 后端 schema · ChartInspector 架构债 |
| acceptance | 见 §6；vitest 绿；tsc 绿 |
| risk_level | low |
| autonomy_policy | auto_accept_low_risk |

### 用户反馈摘要

选中漏斗图 `PixelShape` 八向缩放时「不会和其他组件交互」——拖拽同场景下方组件会让位，缩放不会。

---

## 1. 问题与根因（代码锚点）

| ID | 根因 | 证据 |
|----|------|------|
| RC-1 | resize 不调用 `onPreview` | `PixelShape.tsx` L303–305 |
| RC-2 | 旧 plan C3 将禁止 preview 当目标 | `2026-07-14-dashboard-canvas-ux-de-complete.md` C3 |
| RC-3 | 碰撞仅 `pushDown` | `collisionLayout.ts` — 本 plan 不改 |

**关键洞察**：`PixelCanvas.handlePreview` 已实现完整链路（`resolvePixelCollisions` → `previewRegistry.applyAll` → `syncPreviewStageMetrics`）。resize 只需接入同一入口，无需新子系统。

---

## 2. 目标架构

```text
Pointer resize (any direction)
  PixelShape.flushPointerFrame
    ├─ applyDisplay(active)           # 活动组件 DOM + live-resize 事件
    ├─ scheduleMarkGuides             # 已有
    └─ onPreview(withRect)            # 新增：与 move 共用
         PixelCanvas.handlePreview (32ms throttle)
           ├─ resolvePixelCollisions
           ├─ previewRegistry.applyAll  # 邻组件仅 syncOuterStyle
           └─ syncPreviewStageMetrics

Pointer up
  handleCommit → resolveActive → setPixelLayout  # 不变
```

**性能约束**：preview 仍走节流 + imperative DOM；**不**在 preview 阶段调用 `onLayoutChange` 写 React history（与 drag 一致）。

---

## 3. 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| resize preview | 复用 `onPreview` / `handlePreview` | 单真理源，与 drag 对称 |
| 节流 | 保持 `PIXEL_PREVIEW_THROTTLE_MS = 32` | 已有 drag 验证；足够跟手 |
| 活动组件更新 | 仍 `applyDisplay` 每帧 rAF | 图表 `pixel-shape-live-resize` 依赖 |
| 邻组件更新 | `previewRegistry` only | 避免 resize 触发全树 React commit |
| 横向碰撞 | 本 plan 不做 | RC-3 需产品裁决；纵向已覆盖主诉 |
| 旧 plan C3 | 文档勘误 + 删「禁止 preview」 | 防止队列执行错误方向 |

---

## 4. 改动清单

### Task 1 · 接入 resize preview（P0）

**文件**：`fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`

1. 在 `flushPointerFrame` 中，将 `onPreview` 条件从 `active.kind === "move"` 改为对所有 pointer 交互调用（或 `move || isResizeInteraction(active.kind)`）。
2. 保持 `skipFirstMove` 对 resize 跳过首帧逻辑不变（L311–314）。
3. 注释说明：preview 经 `PixelCanvas` 节流，不在此层节流。

**验收**：代码审阅 + Task 2 单测。

---

### Task 2 · 自动化测试（P0）

**文件**：`fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`

新增用例 **`previews cascade push-down on neighbors while resizing`**：

1. 布局：`w1` 在上 `(100, 80, 300, 200)`，`w2` 在下 `(100, 300, 300, 200)`。
2. `pointerDown` SE 手柄 → `pointerMove` 增大高度（`clientY` +120）→ `flushPixelPointerFrames`。
3. 断言 `w2` 的 `top` 随 preview 下移（与 drag 用例对称）。
4. `pointerUp` → `onLayoutChange` 调用 1 次，`layoutsOverlap` 为 false。

可选：删除或改写任何暗示「resize 不得 preview」的注释/测试（若存在）。

**验收**：`pnpm vitest run fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`

---

### Task 3 · collisionLayout 补例（P1，可选）

**文件**：`fe/src/components/dashboard/pixelCanvas/collisionLayout.test.ts`

新增：`resolvePixelCollisions` 在**仅增高**（`height` 300→400）时推挤下方 widget。纯单元，无 UI。

---

### Task 4 · 文档同步（P1）

| 文件 | 动作 |
|------|------|
| `docs/bugs/BUG-7_*.md` | R1 修复记录、状态 → fixed/qa_pending |
| `docs/bugs/README.md` | 登记 BUG-7 |
| `docs/automate/evolution-state.md` | 本轮契约与 phase |
| `docs/automate/plans/2026-07-14-dashboard-canvas-ux-de-complete.md` | C3 勘误：「resize 应走 preview，与 move 对称」 |

---

## 5. 八维度自审

| 维度 | 结论 |
|------|------|
| 1 目标对齐 | 直接修复用户主诉，复用已有 preview 管线 |
| 2 范围 | 单文件行为变更 + 测试，无跨域 API |
| 3 可验证性 | vitest 对称 drag 用例 + overlap 断言 |
| 4 风险 | 低；节流与 imperative DOM 已验证于 drag |
| 5 回退 | 恢复 `move`-only 门控（一行） |
| 6 依赖 | 无新依赖 |
| 7 体量 | PixelShape ±5 行；测试 +40 行 |
| 8 文档 | BUG-7 + plan 勘误 |

---

## 6. 整体验证方案

```bash
# 单元
cd fe && pnpm vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx src/components/dashboard/pixelCanvas/collisionLayout.test.ts

# 类型
cd fe && pnpm exec tsc --noEmit
```

### 手工 Pointer QA（修复后）

| # | 场景 | 通过标准 |
|---|------|----------|
| 1 | 上下两图表，上方向下 SE 拉高 | 下方跟手下移，无叠层 |
| 2 | 三组件竖列，中间增高 | 最下方级联下移 |
| 3 | 快速甩动 resize 手柄 | 无白屏、无 render-spec 风暴 |
| 4 | 松手后保存刷新 | 坐标与所见一致（衔接 BUG-6） |

---

## 7. 非目标

- 横向扩宽推挤左右邻组件（RC-3）
- 修改 `resolvePixelCollisions` 算法
- Playwright 真实浏览器 E2E

---

## 8. plan-review 摘要（内联）

| 项 | 结论 |
|----|------|
| state | **PASS** |
| 阻塞 | 无 |
| 警告 | 执行后需手测 RC-3 横向场景，避免用户二次反馈 |
| 推荐模型 | 默认（改动小、路径清晰） |
