# BUG-9：像素画布持续抖动（Resize 反馈环）

> 最近更新：2026-07-15

| 字段 | 值 |
|------|-----|
| 状态 | 🧪 R1 代码修复完成，待真实浏览器 QA |
| 优先级 | P0 |
| 发现日期 | 2026-07-15 |
| 影响范围 | Dashboard 编辑页 · 像素画布 · `#editor-canvas-main` |
| 关联 | `2026-07-14-dashboard-canvas-right-gap-fix.md` · BUG-2 · BUG-1 |

---

## 现象

[用户反馈] 看板编辑页像素画布（`scale≈0.493`、`#editor-canvas-main`）**静止时仍持续抖动**——画板、组件或表格内容亚像素颤动，对标 DataEase 应稳定贴满工作区。

DOM 特征（用户提供）：

- `transform: scale(0.493056)` 在 `1440×1440` stage 上
- 宿主宽约 710px，含多 chart + 表格 widget

---

## 根因总览

| # | 根因 | 状态 | 说明 |
|---|------|------|------|
| RC-1 | **视口状态上提触发整页重渲染** | ✅ R1 | `onViewportChange={setPixelViewport}` 每帧新对象 → `DashboardEditPage` 全树重渲染 |
| RC-2 | **contentHeight 边界翻转** | ✅ R1 | `scaledCanvasMetrics` 在「贴满视口」与 `ceil` 间切换 → 滚动条出现/消失 → `clientHeight` 变化 |
| RC-3 | **ResizeObserver 未合帧** | ✅ R1 | 多路 RO（画布 + N 个 chart）同帧多次测量 → 连续 `setScale` / `echarts.resize` |
| RC-4 | **子组件 RO 级联** | 🟡 部分缓解 | `useElementSize` + `useEmbeddedChartLiveResize` 在父重渲染后再次 resize |
| RC-5 | **scrollbar-gutter 与测量宿主** | ✅ 已有+补强 | T1 已做 surface `auto`；R1 补 host `scrollbar-gutter: auto` |

---

## RC-1：视口上提 → 整页重渲染（L1 确证）

**证据**：

```198:199:fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx
      onViewportChange?.(visibleCanvasViewport(host, metrics.scale, viewCanvas));
      setVisibleViewport(visibleCanvasViewport(host, metrics.scale, viewCanvas));
```

（R0）`DashboardEditPage` 绑定：

```921:921:fe/src/pages/admin/dashboard/DashboardEditPage.tsx
              onViewportChange={setPixelViewport}
```

`pixelViewport` **仅**用于 palette 插入落点（`insertPixelPaletteWidget`），却用 `useState` 上提 → ResizeObserver 每次回调创建新 `PixelRect` → React 认为 state 变化 → 编辑页 + 全部 widget（含 ECharts/表格）重渲染 → 子树 RO 再次触发 → **反馈环**。

### R1 修复

- `pixelViewportRef` + `handlePixelViewportChange`（ref 写入，不触发渲染）
- `publishViewport`：浅比较后才 `setVisibleViewport` / 回调父级

---

## RC-2：contentHeight 边界翻转（L1 确证）

**证据**：

```132:133:fe/src/components/dashboard/pixelCanvas/geometry.ts
  const contentHeight =
    scaledContentHeight <= availableHeight + 0.5 ? availableHeight : Math.ceil(scaledContentHeight);
```

当 `scaledContentHeight ≈ availableHeight` 时：

1. 内容区高度设为 `ceil` → 出现纵向滚动条（~8px）
2. `clientHeight` 减少 → 判定切回 `availableHeight`
3. 滚动条消失 → 高度回升 → 循环

与 `2026-07-14-dashboard-canvas-right-gap-fix.md` T5「无宽度抖动」同源。

### R1 修复

`PixelCanvas` `setContentSize`：**高度变化 < 12px 时保持上一帧**（迟滞，覆盖 scrollbar 宽度）。

---

## RC-3：ResizeObserver 未合帧（L1 确证）

RO 回调直接 `setState`；同帧内 host + chart 多源 RO 可连续触发。

### R1 修复

- `scheduleMetrics` → `requestAnimationFrame` 合帧
- 挂载时同步 `applyMetrics()` 保证首帧正确

---

## RC-4：图表/表格子树 RO（L2 线索）

`useEmbeddedChartLiveResize` 监听 `.pixel-shape-outer` + 容器；父级重渲染或 scale 微变 → `echarts.resize()` / 表格 reflow → 可能再次触发 host RO。

**R1**：切断 RC-1 后级联应大幅减弱。  
**P2**（计划）：scale 变化期间全局 `suspendLiveResize`（不仅 isPlayer）。

---

## 修复记录

| 轮次 | 日期 | 内容 | 结果 |
|------|------|------|------|
| R0 | — | 识别问题；`right-gap-fix` T1 已落地 | 用户仍报抖动 |
| R1 | 2026-07-15 | ref 视口、viewport 浅比较、RO rAF、contentHeight 迟滞、host scrollbar-gutter | vitest 55 项 pixel 相关绿 |

### R1 变更文件

| 文件 | 变更 |
|------|------|
| `PixelCanvas.tsx` | rAF 合帧、`publishViewport`、contentHeight 迟滞 |
| `pixelRectEqual.ts` | 视口浅比较工具 |
| `DashboardEditPage.tsx` | `pixelViewportRef` 替代 `useState` |
| `index.css` | `.pixel-canvas-host { scrollbar-gutter: auto }` |

---

## 改进优先级（剩余）

| 优先级 | 动作 |
|--------|------|
| P0 | 手测：编辑页静止 10s、滚动、选中表格/chart，确认无抖动 |
| P1 | `geometry.ts`：canvas 模式 `contentWidth` 直接 `round(availableWidth)`（right-gap T2） |
| P2 | scale 变化时全局暂停 chart `useElementSize`（`useCanvasScaleStable` hook） |
| P2 | DE 式 overlay 滚动条（`no-scrollbar` + 滚轮），彻底消除布局宽度侵占 |

---

## 防复发原则（此类问题）

1. **测量态不上提 React state**：仅插入落点等读时 ref；上提必浅比较。
2. **RO → rAF 合帧**：一层测量入口，避免 N 个 widget 各写 layout state。
3. **滚动条与 contentHeight 迟滞**：禁止在 ±1 scrollbar 宽度内翻转。
4. **交互期冻结子树测量**：`isPlayer` / scale 变更期间 pause chart resize。
