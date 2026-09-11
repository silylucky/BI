# Tab 容器无法拖入组件（面板新建 + 画布已有）

## 症状

- 像素画布编辑页：从左侧工具栏拖拽/点击插入图表到 Tab 失败
- **画布上已有组件**拖到 Tab 上松手后仍留在顶层，或弹回原位
- 虚线投放区不显示、松手后组件落到画布顶层而非页签内
- 插入后选中 0×0 子组件，画布上看不到 shape，误以为失败

## 根因（对标 DataEase）

| 层级 | 原因 | 证据 |
|------|------|------|
| 架构（面板） | 过度依赖 HTML5 DnD 落点命中，未建立「投放意图」 | DE 主路径：选中 Tab = 投放目标 |
| **架构（已有组件）** | **`PixelShape` 松手只走 `resolvePixelCollisions`，无 park 进 Tab** | `handleCommit` 未调用 `movePixelWidgetIntoTab` |
| **碰撞** | **与 Tab 轻触时 `shouldRevertCommit` 弹回原位** | `shouldRevertPixelDragCommit` 把 Tab 当普通邻块 |
| 事件 | `PixelShape` 边带/z-index 抢占 drop | 面板拖放期 `pointer-events-none` |
| 捕获层 | 投放层 z-index 低于 shape 或未外扩缓冲 | `TabPaletteDropZones` z-200 + 160px buffer |
| Provider | `tabInsertIntent` 未从 Page 传入 Provider | `DashboardEditPage` → `PaletteDragProvider` |
| UX | 插入后 `handleSelect(draft.id)` 选中折叠子组件 | 应 `handleSelect(tabsHost.id)` |
| 选中 | 仅 Tab 宿主锁定意图，选中页签内子组件无效 | `parentTabsId` 未推导意图 |

## 修复（DE 式投放意图 + 已有组件吸收）

### 面板新建
1. **`tabInsertIntent`**：选中 Tab 或其子组件 → 锁定 `{ tabsWidgetId, paneId }`
2. **`resolveTabPaletteInsertHost`**：显式 id > intent > 落点缓冲 > 选中宿主/父 Tab
3. **`insertPaletteWidgetIntoTabHost`**：直达 park，不走过画布开放槽位
4. **`TabPaletteDropZones`**：160px 虚线 + z-200 捕获；`onTabHover` 更新意图
5. **`handleDrop` 兜底**：落点不在 Tab 矩形时仍用 intent 路由 `onTabPaletteDrop`
6. **插入后选中 Tab 宿主**

### 画布已有组件
1. **`resolveTabHostForWidgetDrop`**：中心点缓冲命中，或外框与 Tab 有足够重叠（≥24px）
2. **`tryAbsorbTopLevelWidgetIntoTab` / `movePixelWidgetIntoTab`**：松手 park 进当前页签
3. **`handleCommit` 优先吸收**，再走碰撞推挤
4. **`shouldRevertCommit`**：目标为 Tab 吸收时不弹回
5. **拖动中显示 Tab 虚线区**（`shapeDragWidget` + `TabPaletteDropZones`）

## 回归测试

- `tabInsertResolver.test.ts`：intent、子组件选中、已有组件吸收、重叠检测
- `layoutUtils.test.ts`：`findTabsHostAtPoint` 缓冲命中

## 手工走查

1. 画布放图表 + Tab → **拖图表到 Tab 上松手** → 图表出现在页签内
2. 选中 Tab → 工具栏点「柱状图」→ 出现在当前页签
3. 选中 Tab → 拖到邻组件旁虚线区松手 → 落入 Tab
4. 与 Tab 轻触但不完全覆盖 → 仍应能吸收（外框重叠 ≥24px）
