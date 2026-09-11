# FE 看板组件间隙遮盖画板背景 / 保存后无间隙变有间隙

## 症状

- 开启「组件间隙」后，组件之间的 padding 区显示为**组件底色**（深色主题下为 `#1e293b` 色块），而不是透出画板/仪表板背景
- 与 DataEase 行为不符：DE 用 `padding: curGap` 在 shape 外层，padding 区透明，仅内层绘制组件壳
- 有时将间隙设为「无」并保存后，刷新或再次编辑又出现默认间隙（栅格约 8px）

## 根因

1. **遮盖背景**：`index.css` 深色主题对 `.pixel-shape-outer` 强制 `background-color: var(--dashboard-widget-surface)`，padding 间隙落在 outer 上，被组件底色填满
2. **自定义画板**：深色主题 `[data-testid="pixel-canvas-artboard"]` 的 `background-image: none !important` 在用户自定义背景时也会抹掉装饰/渐变
3. **保存回退**：`resolveWidgetGap()` 在缺少 `gapPreset` 时 fallback 到 `DEFAULT_WIDGET_GAP`（8）；保存时未显式写入 `gapPreset: "none"`；保存后 `styleConfig` 状态未与 `layout.styleConfig` 同步

## 修复（2026-07-15 架构加固 GAP-02/03）

- 抽出 **`gapPolicy.ts`** deep module：preset 单源、normalize、patch、resolve
- 新增 **`componentGapRuntime.ts`**：统一 shell/snap/collision adapter（DE 模型 collision=0）
- `bootstrap` / 保存 / 后端 validator 均走同一 normalize 语义
- 画布消费改为 `resolveComponentGapRuntime(mode)`，不再散落 `{ pixel: true }`

## 修复（2026-07-15 全面加固）

- `normalizeDashboardGapConfig`：加载/保存统一归一化；legacy `widgetGap` 推断 preset；custom 双通道补齐
- `buildDashboardGapPatch`：toggle/preset 始终双写 `widgetGap` + `pixelGutter`
- `bootstrapDashboardStyleConfig` 加载时归一化 gap
- CSS：`.dashboard-shape-gap-shell` 透明（栅格+像素）
- 移除 `PixelCanvas.pixelGutter` 死 prop
- `DashboardStyleDialog` 改用 `buildDashboardGapPatch`
- 后端 `DashboardStyleConfig` gap validator 与持久化 layout

## 修复（2026-07-15 保存/预览 WYSIWYG）

- 预览侧栏：`DashboardLayoutPreview` 接受 `styleConfig` 覆盖，并 `bootstrapDashboardStyleConfig` 归一化；编辑预览传入页面实时样式，不再读 stale 的 `layout.styleConfig`。
- 编辑态：`applyStyleConfig` / 保存后 `setStyleConfig` 均走 bootstrap，保证所见即所存。
- `resolvePixelGutter`：legacy 仅 `widgetGap` 时在运行时也推断 pixel 通道，与 normalize 一致。

## 锚点

- `fe/src/components/dashboard/DashboardLayoutPreview.tsx`
- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` — `applyStyleConfig`
- 回归：`DashboardLayoutPreview.test.tsx`、`dashboardGapConfig.test.ts`
