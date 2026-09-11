# Tab 拖放虚线过大 / 拖动时页签框乱动 / 子组件被遮罩

## 症状

- 从工具栏拖组件进页签时，画布虚线投放框远大于 Tab 外框（原 160px 外扩）
- 拖动其他组件经过 Tab 时，Tab 容器随碰撞推挤上下移动
- 页签内已有子组件时，拖放层全屏遮罩 + `opacity-50` 导致子组件「像没显示」
- 图表子组件 ECharts 报 `clientWidth/clientHeight` 为 0

## 根因

1. `TAB_PALETTE_DROP_BUFFER_PX = 160` 同时用于命中与绘制
2. `resolvePixelCollisions` 对 Tab 宿主执行 `emptyTargetFootprint` 下推
3. `TabsWidget` 在有子组件时仍铺 `TabsPaletteDropOverlay` 并禁用子组件指针事件
4. 像素壳层 Tab 内子组件 `min-h-[72px]` 不足，flex 未撑满 panel

## 修复

- 命中区 `48px`，视觉虚线 `4px`（`TabPaletteDropZones` 分离 hit/visual）
- Tab 容器参与与普通组件相同的碰撞推挤（`emptyTargetFootprint` / `liftVacatedColumn` 不再豁免）
- 有子组件时仅底部紧凑提示条，不再全屏遮罩
- shape 壳层子组件 `min-h-[5rem]` + `flex-1` 撑满 panel

## 锚点

- `fe/src/components/dashboard/pixelCanvas/tabInsertResolver.ts`
- `fe/src/components/dashboard/pixelCanvas/TabPaletteDropZones.tsx`
- `fe/src/components/dashboard/pixelCanvas/collisionLayout.ts`
- `fe/src/components/dashboard/TabsWidget.tsx`

## 回归

- 切换页签时画布 `scrollTop` 保持不变（手测）

---

# Tab 点击空页签占位 / 选中页签时画布滚到顶部

## 症状

- 画布滚到下方后，点击 Tab 内空页签占位「拖入或插入组件」，或首次点选 Tab 容器，`pixel-canvas-host` 滚回顶部

## 根因

1. `TabsWidget` 内 `onSelect` 经 `DashboardCanvasWidgetRenderer` 直达 `DashboardEditPage.handleSelect`，**绕过** `PixelCanvas.handleSelect` 的滚动保持
2. 选中后右侧配置栏展开触发 `ResizeObserver` 重算 `contentSize`，异步把 `scrollTop` 归零
3. 已选中 Tab 时 tabpanel 仍 `preventDefault`，可能触发多余焦点/锚定抖动

## 修复

- `preservePixelCanvasHostScroll`：多帧恢复 + `consumePendingCanvasHostScrollRestore` 在 `PixelCanvas` layout 提交后补恢复
- `DashboardCanvasWidgetRenderer.handleSelect` 与 `DashboardEditPage` 的 `selectWidgetOnCanvas` 统一包滚动保持
- 空页签区：仅未选中时 `preventDefault` + `onSelect`；已选中只 `stopPropagation`

## 锚点

- `fe/src/components/dashboard/pixelCanvas/preserveCanvasHostScroll.ts`
- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
- `fe/src/components/dashboard/dashboard-edit/DashboardCanvasWidgetRenderer.tsx`
- `fe/src/components/dashboard/TabsWidget.tsx`
- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`

## 回归

- `preserveCanvasHostScroll.test.ts`
- 手测：滚到底部点空页签占位，画布不跳顶

---

# Tab 点击页签栏画布滚到顶部

## 症状

- 点击 Tab 容器页签栏（页签 1/2/3…）时，像素画布 `pixel-canvas-host` 总是滚回顶部

## 根因

1. 页签 `button` 点击后获得焦点，浏览器对可滚动祖先执行 `scrollIntoView`
2. `pixel-shape-inner` 的 `pointerdown` 在页签栏冒泡，触发多余选中/布局抖动
3. 切换 `activePaneId` 写入 `contentRevision` 导致整组件重挂载

## 修复

- 页签按钮 `pointerdown` + `preventDefault` 阻止聚焦滚动
- 页签栏 `pointerdown` 阻止冒泡到 `PixelShape`
- shape 壳层 tabpanel 用 `overflow-hidden`，滚动交给画布
- `contentRevision` 不再包含 `activePaneId`

## 锚点

- `fe/src/components/dashboard/TabsWidget.tsx`
- `fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`
- `fe/src/components/dashboard/dashboard-edit/DashboardEditCanvas.tsx`

---

# 顶层组件与 Tab 容器相互重叠

## 症状

- 拖动图表/表格等到 Tab 上松手后，两者同区域叠放（Tab 半透明压在表格上）
- 媒体、热力图等多个顶层组件与 Tab/表格占据同一坐标

## 根因

1. 曾将 Tab 标为画布锚点，碰撞时不推挤 Tab，活动块可叠在 Tab 上方
2. `layoutsOverlap` / `packPixelLayoutSeamless` 未排除 Tab 内折叠子组件（`parentTabsId` + `0×0`）
3. **保存 422（阻塞）**：`parkPixelWidgetInTab` 将子组件折叠为 `width/height=0`，但后端 `LayoutWidget` 曾强制 `ge=120/32`，Pydantic 在校验阶段即 422 → 消毒后的布局无法落库，用户仍见叠放脏态
4. **保存假失败（TDZ）**：`handleSave` 在 layout PUT **200 之后**引用未声明的 `savedStyle` → toast 失败且 `resetLayout` 未执行
5. **保存后叠放回显**：`resetLayout` → `prepareDashboardLayout` 仅 `compact`、不 `pack`；已消毒的坐标在回写时被跳过完整 sanitize

## 修复

- Tab 与普通组件同一套 `resolvePixelCollisions`（可被下推、可上浮）
- **保存/加载单路径**：`sanitizePixelLayoutGeometry`（Tab park 修复 + 顶层重叠 pack）接入 `persistDashboardLayout` / `preparePixelLayoutForDisplay` / 保存后 `resetLayout`
- **编辑态**：`setPixelLayout` → `repairPixelLayoutTabState`（仅 Tab 折叠，不整版 pack）
- **工具栏插入**：`insertPixelPaletteWidget` 走 `resolvePixelCollisions`
- **拖入页签（DE）**：松手 `tryAbsorbTopLevelWidgetIntoTab`；吸收后选中 Tab 宿主
- **后端契约**：`parentTabsId` + `tabPaneId` 的 Tab 子组件允许 `0×0`，并跳过画布越界检查（`backend/app/dashboard/schemas.py`）
- **`handleSave`**：`savedStyle` 须在 `resetLayout` 之前声明（修复 TDZ 假失败）

## 锚点

- `fe/src/components/dashboard/pixelCanvas/layoutSanitize.ts`
- `fe/src/components/dashboard/stylePipeline.ts`
- `fe/src/components/dashboard/layoutUtils.ts`（`repairUnparkedTabChildren`）
- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`（保存后 reset）
- `backend/app/dashboard/schemas.py`（Tab parked 子组件尺寸豁免）

## 回归

- `collisionLayout.test.ts`：`pushes tab hosts like any other widget when overlapped`
- `tabInsertResolver.test.ts`：吸收与 intent
- `tests/test_dashboard_pixel_layout.py`：`test_pixel_layout_accepts_tab_parked_child_zero_size`
- 手测：叠放画布 → 保存 200 → 无重叠；Tab 内子组件仅页签内可见