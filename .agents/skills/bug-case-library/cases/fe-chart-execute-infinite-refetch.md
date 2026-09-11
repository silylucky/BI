# FE 看板图表 query/execute 无限重请求导致抽搐

## 症状

- 看板编辑/预览页图表区域不停闪烁、抖动（「抽搐」）
- 后端日志在极短时间内连续刷 `POST /api/v1/query/execute`（每个图表 widget 每帧都可能重打）
- 多个图表时一次父组件 re-render 会并发打出多条 execute

## 根因

`useChartExecute` 的 `useCallback`/`useEffect` 依赖了 `config` 与 `filterParameters` **对象引用**：

- `widget.chartConfig` 每次父组件 render 可能是新对象
- `buildWidgetFilterParams()` 每次返回新 `{}`

引用一变 → `run` 重建 → `useEffect` 再执行 → `setState` → 再 render → 死循环。

次要：`ChartRenderer` 给 ApexCharts 的 `key` 绑在 `width x height` 上，ResizeObserver 微调尺寸会强制整图卸载重挂，加剧视觉抖动。

## 修复

1. `chartExecuteRequestKey()` 按请求载荷序列化稳定 key；effect 只依赖 key + `executeKey`
2. 用 ref 保存最新 config/filter，避免 `rerun` 闭包过期
3. 移除 ApexCharts 随尺寸变化的 `key`

## 锚点

- `fe/src/components/charts/useChartExecute.ts`
- `fe/src/lib/chartExecuteProbe.ts` — `chartExecuteRequestKey`
- `fe/src/components/charts/ChartRenderer.tsx`
- 回归：`fe/src/components/charts/useChartExecute.test.ts`

## 预防

Hook 中不要把「每次 render 新建的对象」直接放进 effect 依赖；对 API 请求用内容序列化 key 或 `useMemo` 原始字段。

---

# FE 预览页像素画布无限放大（ResizeObserver 正反馈）

## 症状

- 看板**预览**（`/admin/dashboards/:id`）画布区域宽度/高度持续膨胀（可达数万 px）
- 表格等宽内容渲染后画布越撑越大，无法稳定阅读

## 根因

1. 预览路由未纳入 `isFillHeightRoute`，`main` 使用 `overflow-y-auto` + `[&>*]:shrink-0`，页面随内容无限增高
2. 预览 `DashboardEditCanvas` 缺少 `dashboard-canvas-surface overflow-hidden` 稳定壳层
3. `PixelCanvas` 的 `ResizeObserver` 量到**随内容撑大的父节点**（如 `rounded-2xl` 包裹层）→ `scale = parentWidth / 1440` 随 parent 增大而增大 → 正反馈

## 修复

1. `AdminLayout`：`/admin/dashboards/:id` 预览路由同样走 fill 高度布局
2. `DashboardEditPage`：预览/编辑均 `layout="fill"`
3. 预览画布外包 `dashboard-canvas-surface min-h-0 overflow-hidden`
4. `resolvePixelCanvasMeasureElement()` 向上查找 `dashboard-canvas-surface` 或 `overflow:hidden` 祖先作为测量基准

## 锚点

- `fe/src/layouts/AdminLayout.tsx`
- `fe/src/components/dashboard/dashboard-edit/DashboardEditCanvas.tsx`
- `fe/src/components/dashboard/pixelCanvas/geometry.ts` — `resolvePixelCanvasMeasureElement`
- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
- 回归：`fe/src/components/dashboard/pixelCanvas/geometry.test.ts`

---

# FE 像素画布滚动条频闪（ResizeObserver ↔ scrollbar 死循环）

## 症状

- 画布右侧（或底部）滚动条不停出现/消失，滚动条滑块极长且闪动
- 常伴随画布缩放轻微抖动

## 根因

`pixel-canvas-host` 使用 `overflow-auto`，`ResizeObserver` 监听**自身** `clientWidth`/`clientHeight` 计算缩放：

1. 内容略超视口 → 滚动条出现  
2. `clientWidth` 减少（Windows 上约 15px）→ 重新算 `scale`  
3. 缩放后内容又「刚好」塞进视口 → 滚动条消失  
4. 视口变宽 → 再次溢出 → 循环

旧栅格画布在 `.dashboard-canvas-surface` 上已有 `scrollbar-gutter: stable`，但 v2 滚动发生在 `.pixel-canvas-host` 上，未继承该防护。

## 修复

1. `scaledCanvasMetrics` 改为**宽度贴合**（`scale = hostWidth / canvasWidth`），内容宽恒等于视口，禁止横向滚动参与反馈  
2. `ResizeObserver` 改监听**父级** `.dashboard-canvas-surface`（`overflow: hidden`，尺寸稳定）  
3. `.pixel-canvas-host` 增加 `scrollbar-gutter: stable`、`overflow-x: hidden`  
4. `setScale` / `setContentSize` 增加亚像素容差，避免 1px 抖动触发重渲染

## 锚点

- `fe/src/components/dashboard/pixelCanvas/geometry.ts`
- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
- `fe/src/index.css` — `.pixel-canvas-host`
