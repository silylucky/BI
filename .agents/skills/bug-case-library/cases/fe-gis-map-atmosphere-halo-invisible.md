# GIS 球面大气光晕不可见

## 症状

- 样式栏「大气效果」已启用，光晕强度/范围已调高，地图上仍看不到球缘蓝色光晕
- 深空背景、昼夜分界（太阳引擎）可能正常，用户易误以为「大气已生效」
- 偶见球缘极细蓝线，整体仍像「没效果」

## 根因（主层：代码/实现 + 架构缝）

1. **光晕 canvas 置于 map WebGL 之下（z=3）**：MapLibre 球面画布在球外区域仍不透明，下层光晕被整屏遮挡；须 z=5 叠在 map canvas 之上 + evenodd 外环。
2. **光晕 canvas 显示高度为 0**：bitmap 尺寸正确，但 `h-full w-full` 挂在无布局高度的 `canvas-container` 上，CSS `height:100%` → 0，光晕被压扁不可见；须 `style.width/height` 显式 px（对齐 effects 引擎）。
3. **光晕 canvas bitmap 高度被钳成 1px**：`readOverlayLayoutSize(canvas-container)` 在子 canvas 绝对定位时 `clientHeight=0`，`Math.max(1,0)` → bitmap `height=1`，光晕不可见；须读 `map.getCanvas().clientHeight`。
3. **球缘解析门控过严**：`isGlobeTransformProbeReady`（依赖 `isPointOnMapSurface`）未就绪时直接 `display:none`，而 GeoLibre 用 `map.project` 地平线采样（`resolveGlobeLimbBoundsFromProject`）即可绘制。
3. **与 effects 引擎职责混淆**：光晕曾绑在 `GisGeolibreEffectsEngine` 上，又受 `tileServiceId` / `gisPaintState=ready` 门控，引擎未挂载则完全无光晕。

## 修复

- **光晕唯一路径**：`mountGisGlobeHaloOverlay`（`GisMapView` 常驻挂载，仅要求 `projection=globe`）
- **层栈**：`getCanvasContainer()` 内 halo z=3、map canvas z=4（球面遮挡中心，光晕仅从球外透明区透出；勿 z=5 叠顶 + evenodd，球缘采样误差会洗白地表）
- **尺寸**：`readMapOverlayPaintSize` + `applyOverlayCanvasLayout` 显式 px（禁 `h-full` 挂在 canvas-container）
- **球缘**：`resolveGlobeLimbBoundsForHaloPaint` — project 采样优先，不硬依赖 surface probe
- **绘制**：`drawGlobeAtmosphereHalo` 全圆 + screen 混合（地图 z=4 遮挡球内）
- **effects 引擎**：仅深空/星场/流星，不再画 halo

## 验证

- DevTools：`data-testid="gis-globe-halo"` 的 `width`/`height` 属性应与 `.maplibregl-canvas` 同量级（非 `height=1`）
- 全球 zoom 1–3，球缘应有可见蓝色光晕
- `pnpm vitest run src/components/charts/engine/maplibre/gisGlobeHalo*.test.ts src/components/charts/engine/maplibre/gisGlobeLayout.test.ts`

- 旋转卡顿/闪烁：`bootLoop` 与 `bindMapRenderSync` 双通道每帧 clear+重绘；改为 `schedulePaint`（rAF 合并）+ 仅 `render/resize` 同步；球缘未变跳过重绘；探测优先于 project 采样

- 回归测：`GisMapView.effects.regression.test.ts` 要求 `mountGisGlobeHaloOverlay` 且不经 `gisPaintState` 门控
- 勿再把光晕收回 effects 引擎或加 `isGlobeTransformProbeReady` 硬门控

## 锚点

- `fe/src/components/charts/engine/maplibre/gisGlobeHalo.ts`
- `fe/src/components/charts/engine/maplibre/gisGlobeLayout.ts` → `resolveGlobeLimbBoundsForHaloPaint`
- `fe/src/components/charts/engine/maplibre/GisMapView.tsx`
