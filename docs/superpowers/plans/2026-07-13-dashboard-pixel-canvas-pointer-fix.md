# Dashboard Pixel Canvas Pointer Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正像素画布视口/内容尺寸模型和 Pointer 移动，并以确定性级联推挤实现顶层组件防重叠与画布高度自适应。

**Architecture:** `PixelCanvas` 只把 host 当滚动视口，新增正常参与滚动尺寸的 content 层，stage 继续保留 1440 基准坐标和统一缩放。`PixelShape` 保留内容区交互隔离，只从 DE 左侧 move handle 启动移动；无 DOM 的 `collisionLayout.ts` 接收活动矩形并确定性向下级联推挤其他顶层 widget，必要时增长 canvas height。真实 Pointer 行为用 Playwright 覆盖，Vitest 验证纯几何、解算器不变量与 React 状态。

**Tech Stack:** React 19、TypeScript、Tailwind CSS v4、Pointer Events、Vitest、Playwright。

## Global Constraints

- `layout.version=2` 的 `x/y/width/height` 始终是 1440 基准画布坐标；禁止将屏幕缩放尺寸写回布局。
- 富文本双击编辑、图表点击/筛选等 `shape-inner` 交互区不得启动拖动。
- 编辑态任何两个顶层 widget 不得相交；边缘相接不算重叠。
- 不允许以取消左右/顶部边界作为修复；底部空间不足时增长 canvas height。
- 当前活动 widget 保持用户目标矩形；仅推挤其他组件。
- Tab 等容器内部 widget 不参与顶层碰撞解算。
- 不改 v1 RGL 紧急回退路径，不新增第三方画布依赖。
- 完成标准包含真实 Chromium Pointer QA；仅 Vitest 通过不能关闭 BUG-2。

---

### Task 1: 锁定尺寸与移动失败的回归测试

**Files:**
- Modify: `fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`
- Modify: `fe/src/components/dashboard/pixelCanvas/geometry.ts`
- Test: `fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`

**Interfaces:**
- Produces: `scaledCanvasMetrics(hostWidth, canvasWidth, canvasHeight, gutter): { scale; contentWidth; contentHeight }`
- Extends: `applyPixelInteraction(start, delta, kind, canvas, { allowBottomGrowth }): PixelRect`

- [ ] **Step 1: 新增纯几何失败测试**

覆盖 645px host、72px gutter、1440×900 canvas：

```ts
expect(scaledCanvasMetrics(645, 1440, 900, 72)).toEqual({
  scale: 0.39791666666666664,
  contentWidth: 645,
  contentHeight: 358.125,
});
```

并覆盖当前真实异常几何在自适应模式下可以向下移动，而右边界仍受约束：

```ts
expect(
  applyPixelInteraction(
    { x: 61, y: 6, width: 1379, height: 894 },
    { x: 100, y: 100 },
    "move",
    { width: 1440, height: 900 },
    { allowBottomGrowth: true },
  ),
).toEqual({ x: 61, y: 106, width: 1379, height: 894 });
```

- [ ] **Step 2: 新增组件盒模型失败测试**

断言 host 不再拥有 `height: 358.125px`，而 `pixel-canvas-content` 明确拥有缩放后的内容尺寸；stage 仍为 1440×900 并应用同一 scale。

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
cd fe
npx pnpm@9.15.0 exec vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
```

Expected: FAIL，缺少 `scaledCanvasMetrics` / `allowBottomGrowth` / `pixel-canvas-content`。

---

### Task 2: 分离滚动视口、缩放内容和规范坐标 stage

**Files:**
- Modify: `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
- Modify: `fe/src/components/dashboard/pixelCanvas/geometry.ts`
- Test: `fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`

**Interfaces:**
- Consumes: `scaledCanvasMetrics(...)`
- Preserves: `visibleCanvasViewport(host, scale, canvas): PixelRect`

- [ ] **Step 1: 实现统一缩放指标**

`scale` 仍按可用宽度 `(hostWidth - gutter) / canvasWidth` 计算；`contentWidth = gutter + canvasWidth * scale`，`contentHeight = canvasHeight * scale`。输入无效时返回安全的 `scale=1`。

- [ ] **Step 2: 改造 DOM 层级**

目标结构：

```tsx
<div className="pixel-canvas-host relative h-full min-h-0 w-full overflow-auto">
  <div
    data-testid="pixel-canvas-content"
    className="relative"
    style={{ width: contentWidth, height: contentHeight }}
  >
    <div
      data-testid="pixel-canvas-stage"
      className="absolute top-0 origin-top-left"
      style={{ left: gutter, width: canvas.width, height: canvas.height, transform: `scale(${scale})` }}
    />
  </div>
</div>
```

删除 host 上的 `min-h-[420px]` 和 `style.height = canvas.height * scale`。host 高度由 `DashboardEditWorkspace` 的 flex 链决定，content 只定义滚动内容边界。

- [ ] **Step 3: 修正 viewport 计算边界**

在 host 宽度小于 gutter、content 小于 viewport、scroll 位于 gutter 内三种情况下，确保 viewport 的 `x/y/width/height` 均非负且不超过 canvas。

- [ ] **Step 4: 运行定向测试确认 GREEN**

Run:

```bash
cd fe
npx pnpm@9.15.0 exec vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
```

Expected: PASS。

---

### Task 3: 收口拖动入口与边界反馈

**Files:**
- Modify: `fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`
- Modify: `fe/src/components/dashboard/pixelCanvas/geometry.ts`
- Modify: `fe/src/components/dashboard/DashboardEditWorkspace.tsx`
- Test: `fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`
- Test: `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`

**Interfaces:**
- Preserves: `startInteraction(event, "move")` 仅由 DE 左侧 move handle 调用

- [ ] **Step 1: 写入口语义失败测试**

断言像素编辑器帮助文案为“选中组件后拖左侧手柄移动”；点击/拖动 `shape-inner` 不更新布局；拖 move handle 更新布局。

- [ ] **Step 2: 写边界反馈失败测试**

对 `{x:61,y:6,width:1379,height:894}`，向右拖时 `x` 保持 61 并出现可访问提示“已到画布右边界”；向下拖时 `y` 正常增加，由 Task 4 同步增长 canvas height；向左上拖仍可到 `{x:0,y:0}`。

- [ ] **Step 3: 实现可靠 Pointer 手柄**

给 move handle 和八向 resize handle 增加 `touch-action:none`、`user-select:none`；Pointer Capture 仍由 `pixel-shape-outer` 持有。记录交互起点与最后 live rect，只有实际几何变化时提交布局；左右/顶部被钳制时触发边界提示，底部不钳制而交给自适应 canvas 增高。

- [ ] **Step 4: 同步用户文案**

像素编辑模式显示“选中组件后拖左侧手柄移动”；v1 grid 模式保留“拖标题栏移动”。不要继续用一条文案描述两套不同交互。

- [ ] **Step 5: 运行组件与页面测试**

Run:

```bash
cd fe
npx pnpm@9.15.0 exec vitest run \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx \
  src/pages/admin/dashboard/dashboard.smoke.test.tsx
```

Expected: PASS。

---

### Task 4: 实现确定性级联推挤与高度自适应

**Files:**
- Create: `fe/src/components/dashboard/pixelCanvas/collisionLayout.ts`
- Create: `fe/src/components/dashboard/pixelCanvas/collisionLayout.test.ts`
- Modify: `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
- Modify: `fe/src/components/dashboard/pixelCanvas/createPixelWidget.ts`
- Modify: `fe/src/components/dashboard/pixelCanvas/usePixelLayoutHistory.ts`
- Modify: `fe/src/components/dashboard/pixelCanvas/index.ts`
- Test: `fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`

**Interfaces:**
- Produces: `rectsOverlap(a: PixelRect, b: PixelRect, gap?: number): boolean`
- Produces: `resolvePixelCollisions(layout, activeId, activeRect, options?): DashboardLayoutV2`
- Produces: `normalizeOverlappingPixelLayout(layout, options?): DashboardLayoutV2`
- PixelShape callback split: `onPreview(widget)`, `onCommit(widget)`, `onCancel(widgetId)`
- Options: `{ gap: 12; minCanvasHeight: 900; bottomPadding: 24 }`

- [ ] **Step 1: 写解算器不变量失败测试**

至少覆盖：

1. 无碰撞输入保持引用值等价；
2. 活动组件保持目标矩形，碰撞组件向下最小位移；
3. A 推 B、B 推 C 的三级级联；
4. 边缘相接不算重叠，12px gap 被保留；
5. 输入数组乱序仍按 `y → x → order → id` 得到同一结果；
6. 推挤超过 900px 时 canvas height 增长到 `maxBottom + 24`；
7. 20 个完全重叠组件能终止且最终两两不相交；
8. 已有重叠布局 normalize 后无重叠，重复 normalize 幂等。

- [ ] **Step 2: 运行解算器测试确认 RED**

```bash
cd fe
npx pnpm@9.15.0 exec vitest run src/components/dashboard/pixelCanvas/collisionLayout.test.ts
```

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现纯函数级联算法**

以活动组件为根节点；碰撞候选按稳定键排序。每个被推动组件的新 `y` 为所有 blocker 的最大 `bottom + gap`，更新后重新入队检查其下游碰撞。使用 `widgets.length * widgets.length` 作为保护上限；超过上限抛出开发期错误，禁止静默保存重叠结果。

- [ ] **Step 4: 接入 drag/resize 实时预览**

`PixelShape` 通过 `onPreview` 上报活动 widget 的 live rect；`PixelCanvas` 用 transient `previewLayout` 对完整布局调用 `resolvePixelCollisions` 并渲染解算结果。`pointerup` 通过 `onCommit` 一次性调用 `onLayoutChange(resolvedLayout)`；pointermove 不写 history，`pointercancel` 通过 `onCancel` 清空 preview 并恢复交互前完整布局。

- [ ] **Step 5: 接入新增、复用与旧数据修复**

- 新增/复用 widget 先按当前可视区定位，再以该 widget 为 active 解算碰撞。
- v2 布局进入可编辑模式时调用 `normalizeOverlappingPixelLayout`；只读预览/分享不得重排。
- normalize 产生变化时标记 dirty，让用户明确保存，不做后台隐式写回。

- [ ] **Step 6: 验证历史原子性**

拖动导致三个组件级联后，undo 一次恢复全部四个组件和原 canvas height；redo 一次恢复完整推挤结果。

- [ ] **Step 7: 运行定向测试确认 GREEN**

```bash
cd fe
npx pnpm@9.15.0 exec vitest run \
  src/components/dashboard/pixelCanvas/collisionLayout.test.ts \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
```

Expected: PASS。

---

### Task 5: 添加真实 Chromium Pointer 与推挤回归

**Files:**
- Create: `fe/e2e/dashboard-pixel-canvas-pointer.spec.ts`
- Modify: `fe/playwright.config.ts`（仅当需要为 mocked dashboard 测试增加稳定超时/项目过滤）

**Interfaces:**
- Mocks: `/api/v1/me`、dashboard GET、dashboard layout PUT 及编辑页启动所需最小接口
- Verifies: 浏览器原生 `page.mouse` Pointer 链、DOM live geometry、PUT v2 payload

- [ ] **Step 1: 建立最小 API mock**

返回一个 1440×900 v2 布局，包含普通组件 `{x:100,y:80,width:300,height:200}`。捕获 layout PUT body 供断言。

- [ ] **Step 2: 写真实拖动用例**

定位 `getByRole("button", { name: "拖动组件" })`，使用 handle 中心坐标执行 `page.mouse.down()` → 分步 `move()` → `up()`；断言 shape 的规范 `left/top` 改变，保存请求仍为 version 2 且坐标与 DOM 一致。

- [ ] **Step 3: 写真实级联推挤用例**

返回 A、B、C 三个纵向相邻组件，将 A 拖到 B 的位置；断言拖动过程中 B、C 实时向下移动，松手后任意两矩形不相交，canvas height 必要时增长。点击 undo 一次应同时恢复 A、B、C 和 canvas height。

- [ ] **Step 4: 写尺寸模型用例**

在 1024×768 viewport 下断言：

- host 高度等于 flex 可用高度，不等于 stage 缩放高度；
- content 高度等于 `canvas.height * scale`；
- stage 可视宽高保持 1440:900 比例；
- host 没有横向意外溢出。

- [ ] **Step 5: 写满画布边界用例**

加载 1379×894 组件：向右拖时 x 被钳制并显示边界提示；向下拖时 y 正常变化且 canvas height 增长；向左上拖可移动到 0,0。该用例用于区分“Pointer 未实现”、水平合法边界与垂直自适应增长。

- [ ] **Step 6: 运行 Chromium E2E**

Run:

```bash
cd fe
npx pnpm@9.15.0 exec playwright test e2e/dashboard-pixel-canvas-pointer.spec.ts --project=chromium
```

Expected: PASS。

---

### Task 6: 回归、文档和人工门控

**Files:**
- Modify: `docs/bugs/BUG-2_dashboard-drag-resize-unusable_2026-07-13.md`
- Modify: `docs/bugs/README.md`
- Modify: `.agents/skills/bug-case-library/cases/fe-dashboard-rgl-pixel-canvas-migration.md`
- Modify: `docs/automate/evolution-state.md`

- [ ] **Step 1: 运行完整自动化**

```bash
cd fe
npx pnpm@9.15.0 exec vitest run src/components/dashboard/ src/pages/admin/dashboard/
npx pnpm@9.15.0 exec playwright test e2e/dashboard-pixel-canvas-pointer.spec.ts --project=chromium
cd ..
python -m pytest tests/test_dashboard_pixel_layout.py tests/test_dashboard_layout_grid_xy.py tests/test_view_m5_protocol.py -q
```

Expected: 全部 PASS。

- [ ] **Step 2: 真实人工 Pointer 门控**

在当前 645×420 画布区域验证：

1. host 与 stage 尺寸关系清晰，无 358.125/420 冲突；
2. 普通组件从左侧手柄拖动后有连续可见位移；
3. 八向缩放后仍能拖动；
4. 拖入另一组件时发生实时级联推挤，松手后顶层组件零重叠；
5. 推挤超过底部时画布高度自动增长；
6. 一次撤销恢复整次级联；
7. 接近铺满画布时仍可向下移动并增长画布；左右/顶部边界有明确反馈；
8. 保存并刷新后规范坐标及推挤结果保持。

- [ ] **Step 3: 仅在人工门控 PASS 后关闭 BUG**

更新 BUG-2 根因 #5–#7、case 和 evolution state。若人工任一步失败，保留 `fixing`，记录实际事件链，不得声明完成。

## Self-Review

- Spec coverage：覆盖用户报告的 host 尺寸冲突、移动无效、组件重叠、自适应高度、保存刷新和真实 Pointer QA。
- Scope control：不重写 layout v2、不取消边界、不触碰 v1 RGL。
- Type consistency：尺寸计算统一返回 `scale/contentWidth/contentHeight`；交互几何用显式 `allowBottomGrowth` 控制垂直自适应。
- Collision invariants：活动组件优先、稳定顺序、最小向下位移、级联终止、normalize 幂等、历史原子性均有独立测试。
- Test gap closed：新增 Playwright 原生鼠标链和真实级联推挤，避免 Vitest Pointer Capture 替身制造假绿。
