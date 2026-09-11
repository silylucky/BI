# Tab 内嵌组件拖入后不可见 / ECharts 0 尺寸

## 症状

- 像素画布：拖入/插入 Tab 页签后，右侧列表有子组件，画布页签内空白或仅见细条
- 控制台 ECharts `Can't get DOM width or height`（clientWidth/height 为 0）
- 待配置图表占位、`WidgetPendingPreview` 也可能高度塌陷

## 根因（分层）

| 层 | 原因 |
|----|------|
| **数据模型** | `parkPixelWidgetInTab` 故意 `width/height=0`；`pixelWidgetToLayoutWidget` 推导出 `colSpan/rowSpan=1` |
| **渲染壳层** | 嵌套子组件继承父 Tab 的 `shell:"shape"`，走 `absolute inset-0` 嵌入式图表路径，依赖像素 footprint |
| **尺寸传递** | `DashboardCanvasWidgetRenderer` 对 0×0 仍传 `pixelSize`，`embeddedBodyHeight` 回退不足 |
| **布局** | `TabsWidget` tabpanel 内容区 `min-h-[4rem]` 未参与 flex-1 链，子节点 `h-full` 无参照高度 |

## 修复

- Tab 内子组件使用与顶层一致的 **`shape` 壳层**（完整图表/内容区，非栅格 12×2 列表条）
- `pixelWidgetToLayoutWidget`：`parentTabsId` 时默认栅格占位仅用于高度估算
- `TabsWidget` tabpanel `flex flex-col`，子项撑满
- **拖出页签**：左侧 `TabNestedDragRail`（与 shape 拖边一致）拖到 Tab 外画布
- **拖入（DE）**：选中 Tab/子组件锁定 `tabInsertIntent`；工具栏插入走 intent；画布组件拖入 Tab 吸收；插入后选中 Tab 宿主

## 锚点

- `fe/src/components/dashboard/TabNestedDragRail.tsx`
- `fe/src/components/dashboard/pixelCanvas/tabParking.ts`
- `fe/src/components/dashboard/pixelCanvas/tabChildExtractContext.tsx`
- `fe/src/components/dashboard/dashboard-edit/DashboardCanvasWidgetRenderer.tsx`
- `fe/src/components/dashboard/layoutUtils.ts`（`reconcileTabPaneChildIds` / `reconcileTabPaneChildIdsInPixelLayout`）
- `fe/src/components/dashboard/pixelCanvas/layoutSanitize.ts`

## 回归

- `dashboardCanvasMode.test.ts`：parked tab child colSpan/rowSpan
- `layoutUtils.test.ts` / `layoutSanitize.test.ts`：Tab child reconcile
- 手测：拖柱状图进 Tab → 页签内可见待配置预览；配置后图表正常渲染
