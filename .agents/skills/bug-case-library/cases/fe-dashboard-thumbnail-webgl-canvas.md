# 含 3D 地图的看板封面截图失败

- **ID**: CASE-2026-08-14-003
- **状态**: 已修复
- **影响**: fe | admin-ui
- **首次发现**: 2026-08-14

## 症状

- 看板里有 3D 地图时，保存后列表没有封面 / 封面加载失败。
- 无 3D 地图的看板可以出封面。

## 根因

- 3D 地图是 Three.js WebGL canvas。默认 `preserveDrawingBuffer: false`，合成后 GPU 缓冲被清空。
- 封面用 `html-to-image`，内部对每个 canvas 调 `toDataURL()`：
  - 缓冲已空 → 空图；或
  - 贴图导致 canvas 污染 → `SecurityError`，**整张看板截图中断**，`PUT /thumbnail` 不会发出。

## 错误做法（避免）

- 指望 html-to-image 直接 clone WebGL canvas。
- 截图失败时静默 best-effort 却不处理 WebGL。

## 修复方式

- `WebGLRenderer` 开启 `preserveDrawingBuffer: true`，截图时缓冲仍在。
- 截图前把 canvas 转成静态 `img` 并隐藏原 canvas，避免 html-to-image 再对 WebGL `toDataURL`；`toDataURL` 抛错也不阻断整张封面。

## 验证

- 含 3D 地图的看板保存后 Network 有 `PUT .../thumbnail` 200（大屏须先缩小到 ≤960 边，避免 422 too large）。
- 列表封面能看到地图区域（或至少整卡其它组件），不再整张失败。

## 关联

- `fe/src/components/charts/engine/three/renderThreeChoropleth.ts`
- `fe/src/lib/captureDashboardThumbnail.ts`
