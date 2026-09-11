# 下钻地图「资产未就绪」—— OfflineGeoPort 注册表失步

- **ID**: CASE-2026-07-27-001
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-07-27

## 症状

- 3D/2D 区域地图从全国下钻到省（如青海 `vs-geo-630000`）后，红字「下钻地图资产未就绪」
- 面包屑已是「全部 / 青海省」，说明 drill 栈与层级解析成功
- 磁盘上 `fe/src/assets/geo/cities/630000.json` 存在；单测 `ensureOfflineGeoMap` 亦可通过

## 根因

1. **HMR / 双实例**：`OfflineGeoPort` 用模块级 `Map` 存注册表；Vite HMR 后 `geoMapLevels` 与 `renderThreeChoropleth` 可能分别持有不同模块副本。`resolveGeoMapLevelContext` / `ensureCityMap` 写入实例 A，渲染 `getOfflineGeoMap` 读实例 B → 空表。
2. **历史短路**：曾用 `registeredMapIds.has(mapId)` 跳过 `registerOfflineGeoMap`，空表一旦登记便无法 upsert 覆盖。
3. **渲染未强制 ensure**：上周/今早部分路径只 `getOfflineGeoMap`，依赖 resolve 侧副作用；失步后无恢复。

## 错误做法（避免）

- 下钻失败时用全国 `vs-regions` GeoJSON 静默顶替省级 `mapId`
- `registerGeoMap` 用 Set 短路跳过 upsert

## 修复方式

- `OfflineGeoPort`：`registeredMaps` 挂 `globalThis.__vsOfflineGeoMaps`，跨 HMR 实例唯一
- `geoMapLevels`：`ensureCityMap` 缓存 `{ index, geo }`，命中也 re-upsert；`loadOfflineGeoMap` = ensure + 同模块读回
- `renderThreeChoropleth`：渲染前 `await loadOfflineGeoMap(resolvedMapId)`，禁止全国顶替下钻
- **加载稳定化（2026-07-28）**：
  - `useGeoMapLevel`：resolve 失败 `.catch` + `requestSeq`，避免永久 `resolving`
  - `D3GeoMapView`：2D 分支 paint 前 `loadOfflineGeoMap`；尺寸 0→有效后强制重渲；3D 12s 超时清 `threePending`
  - `geoMapLevels`：区县 `districtIndexCache` + city/district 缓存挂 `globalThis`
  - `renderChoropleth`：`joinOfflineMapFeatures` 传入 `drillDepth`

## 验证

- `vitest run src/hooks/useGeoMapLevel.test.ts src/components/charts/engine/geo/offlineGeoMapId.test.ts src/lib/geoMapLevels.test.ts src/components/charts/engine/d3/geo/renderChoropleth.test.ts`
- 手工：全国 → 青海/湖南下钻见市级轮廓 → 面包屑点「全部」回全国；开发态可硬刷新后再下钻
- 窄容器首屏出图；快速连点下钻/返回不卡「正在加载…」；3D 不长期 `data-render-engine="pending"`

## 关联

- `fe/src/components/charts/engine/geo/OfflineGeoPort.ts`
- `fe/src/components/charts/engine/geo/geoMapLevels.ts`
- `fe/src/components/charts/engine/three/renderThreeChoropleth.ts`
- GEO-IRON-01 / `docs/arch.md` ADR-12
