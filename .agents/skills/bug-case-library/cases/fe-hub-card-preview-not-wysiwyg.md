# Hub 卡片缩略图与真实播放不一致（标题巨大、纵向拉伸、3D 地图退化）

- **ID**: CASE-2026-08-06-003
- **状态**: 已修复
- **影响**: fe / 可视化模板 Hub · 看板与大屏列表卡片 · geo3d 缩略图
- **首次发现**: 2026-08-06

## 症状

模板 / 看板列表卡片缩略图与真实预览播放明显不同：

- 组件标题字号巨大（缩略图内实测设计字号 91px、占卡片高度 8.4%，真实播放里只占 3%）
- 画面纵向被拉伸（1920×1080 画布塞进 16:10 卡框）
- 3D 地图只剩白茫茫一片，看不到卫星地形

## 根因

三个各自独立的退化叠加：

1. **壳层字号二次补偿**：`shapeTitlePresentationStyle` / CSS `--pixel-canvas-chrome-scale` 按画布 scale **反比**放大标题字号与标题栏高度。该补偿是为编辑态缩小画布时保持标题可读可点，但外层 `CanvasScaleViewport` 已整体缩放的 design-locked 场景（预览 / 播放 / 缩略图）会二次放大，缩略图越小标题越离谱。
2. **非等比缩放**：卡片缩略图用 `presentationMode="fill"`，把 16:9 画布拉进 16:10 卡框，纵向多拉伸约 10.8%。
3. **缩略图档位硬降级**：`resolveGeo3dQuality` 对 `renderTier==="thumbnail"` 直接返回 `low`，`resolveTerrainTextureEnabled` 对 thumbnail 直接禁地形贴图——即使模板显式配了 `quality:"high"` + `terrainTexture:true` 也被吃掉。

## 修复方式

- 补偿基数收口到 `resolveShapeTitleCanvasScale(canvasScale, designViewportLocked, mode)`：**仅编辑态**补偿，浏览/预览/播放/缩略图一律返回 1；JS 侧经新增的 `usePixelChromeScale()` 消费，CSS 侧由 `data-pixel-canvas-design-locked` 与 `data-pixel-canvas-mode="edit"` 共同选择器决定，两侧同语义
- 卡片缩略图改 `presentationMode="fit"`；大屏卡框比例改 `HUB_CARD_SCREEN_ASPECT_RATIO = 16 / 9`（`hubCardPreviewFrameStyle(surfaceKind)`），等比后既不留白也不变形
- 去掉 geo3d 的 thumbnail 专用降级：`resolveGeo3dQuality` 不再接 `renderTier`，`resolveTerrainTextureEnabled` 只看 `stylePreset==="satellite"` 与 `terrainTexture`。并发上限仍由 `GEO3D_MAX_WEBGL_INSTANCES` 守着

## 验证

- `dashboardWidgetTypography.test.ts` · `hubCardUi.test.ts` · `geo3dQuality.test.ts` · `geo3dRuntime.test.ts` · `templates/*`（36 + 2 passed）
- 浏览器实测：卡片与真实预览同为 `fit` 等比、同一设计字号 16px、标题高度占比同为 2.96%；卫星地形回来

## 教训

**「补偿到屏幕恒定」的样式只在可交互的编辑态成立。** 任何随画布 scale 反比放大的壳层尺寸，都必须显式区分「自己负责缩放」与「外层已经缩过」（design-locked），否则一旦被嵌进缩略图就整体走形。同理，按 renderTier 硬降级的渲染开关会盖掉用户显式配置，降级判断应留给质量/并发这类真实约束。

## 关联

- `fe/src/components/dashboard/dashboardWidgetTypography.ts` · `pixelCanvas/PixelCanvasScaleContext.tsx` · `hubCardUi.ts`
- `fe/src/components/charts/engine/three/geo3dQuality.ts` · `geo3dRuntime.ts`
- 同类：`fe-data-screen-canvas-wh-mismatch.md`（画布比例）
