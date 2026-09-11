# BUG-13：3D 地图卫星纹理与省界错位

> 最近更新 2026-07-23

| 字段 | 值 |
|------|-----|
| 状态 | ✅ 对齐已验收；R6 提清已落地（4096px / zoom 7） |
| 优先级 | P0 |
| 发现日期 | 2026-07-23 |
| 影响范围 | 全部 `map-3d` 全国 + 34 省级卫星纹理 |
| 数据来源 | 用户反馈 + 源码 L1 取证 |

## 问题总览

| # | 根因 | 状态 | 说明 |
|---|------|------|------|
| 1a | 运行时 UV 用线性纬度，纹理在 Web Mercator 像素空间 | ✅ 已修复 | R1 WM 公式 |
| 1b | `flipY=false` + geo UV 与 sc-datav bbox UV 的 V 轴语义相反 | ✅ 已修复 | R2 改 bbox + 默认 flipY |
| 2 | 全国 bounds 含南海诸岛低纬点，大陆在纹理中纵向压缩 | 🟡 部分缓解 | R2 过滤装饰要素，south 2.39→2.83 |
| 3 | 省级卫星 UV 策略 | ✅ 已修复 | R2 统一 terrainProjBounds bbox |
| 4 | `sharp` 链式 `composite→extract` 像素错位 | ✅ 已修复 | R3 先 `png()` 物化再裁切 |
| 5 | 矩形 bbox 纹理 + `terrainProjBounds` UV，非 sat-hunter 轮廓语义 | ✅ 已修复 | R4 轮廓 mask |
| 6 | Mercator 纹理 + `applyGeoCapGeoUv` 与 mesh `projBounds` 坐标系不一致 | ✅ 已修复 | R5 projBounds 空间烘焙 + `applyGeoCapBboxUv` |
| 7 | 全国纹理 zoom 6 + 1024px 输出，目视不够清晰 | ✅ 已修复 | R6 自适应 zoom 7 + 4096px + webp q92 |
| 8 | 仅 4 试点省有 L1 纹理包，其余省 fallback 全国 | ✅ 已修复 | R7 34 省 4096px 全覆盖 + 父省 L2 回退 |

---

## R7：34 省 L1 纹理全覆盖（2026-07-23）

**范围**：两级下钻纹理——L0 全国 + L1 省级；L2 市/区县无独立包，回退父省级纹理。

**改动**：
- `ALL_PROVINCE_ADCODES`（34 省）替换试点列表
- 省级 `4096px` / webp q92 / `fetch --provinces-only` / `--adcode=` 分片
- `resolveProvinceAdcodeFromMapId`：市 adcode → 父省 `XX0000`

---

## R6：全国纹理提清（2026-07-23）

**现象**：用户确认全国省界对齐正确，但纹理不够高清。

**改动**：
| 参数 | 旧值 | 新值 |
|------|------|------|
| 全国 zoom | 固定 6 | 自适应 **7**（8 超限回退） |
| 输出尺寸 | 1024px | **4096px** |
| Mercator 源上限 | 2048 | **8192** |
| WebP quality | 85 | **92**（national） |

**验收**：national `diffuse.webp` 4096×3980，≈4.7 MB；对齐逻辑未变。

---

## 根因 6：纹理坐标系与 mesh 投影平面不一致（R5，2026-07-23）

**现象**：R4 后仍像「局部小图放大到全国」；南部/边缘地物与省界对不上。

**根因**：
- 构建期：Mercator 经纬度矩形上的卫星图（即使轮廓 mask）
- 运行时：mesh 在 `fitChinaGeoProjection` 平面坐标；`applyGeoCapGeoUv` 反投影再 Mercator 采样仍有坐标系/flipY 失配
- sc-datav 正统：**参考视口 projBounds 空间烘焙** + 运行时 **bbox 线性 UV**

**修复**：
| 模块 | 改动 |
|------|------|
| `terrainProjBake.mjs` | 800×600 参考视口，逐像素反投影采样 Mercator 源图 |
| `terrainThreeProject.mjs` | 构建期复刻 `buildThreeGeoProject` |
| `fetch-terrain-satellite.mjs` | 全国/省均走 projBounds 烘焙 |
| `buildGeoFlatPlateMesh.ts` | 卫星统一 `applyGeoCapBboxUv(projBounds)` |
| `renderThreeChoropleth.ts` | 移除 `geoUvContext` |
| `meta.json` | `uvMode: "projBounds"`、`refViewport: [800,600]` |

**验收**：`pnpm run test:chart-catalog` 235 passed；national `diffuse.webp` 1024×995

---

## 根因 5：资产与 UV 架构偏离 sat-hunter / sc-datav（R4，2026-07-23）

**现象**：纹理像「局部小图放大到全国」，覆盖不了全中国面积；南部/侧壁更明显。

**根因**：
- 构建期：矩形经纬度外接框拼瓦片，无 GeoJSON 轮廓 mask
- 运行时：`terrainProjBounds`（geo 矩形四角投影）≠ 轮廓 mask 纹理语义

**修复**：
| 模块 | 改动 |
|------|------|
| `terrainContourBake.mjs` | sat-hunter 同款 `geoContains` 轮廓 alpha 裁切 |
| `fetch-terrain-satellite.mjs` | 全国/省均走轮廓拼接 |
| `buildGeoFlatPlateMesh.ts` | 卫星 → `applyGeoCapGeoUv` + `geoUvContext` |
| `renderThreeChoropleth.ts` | 移除 `terrainProjBounds` |
| `build-china-terrain-assets.mjs` | `meta.uvMode=mercator`、`masked=true`；displacement 同 Mercator 栅格 |
| 删除 | `computeTerrainProjBounds.ts` |

**验收**：`pnpm run test:chart-catalog` 236 passed；`terrainGeographicAudit` 东西采样色差 > 30

---

## 现象描述

用户在看板或 dev 页查看 **3D 区域地图（`map-3d`）** 时，开启「地形贴图」后可见彩色卫星纹理，但**省界与真实地物（沙漠、山脉、海岸线）严重错位**，整体不像正确的中国地图轮廓。[用户反馈]

- 触发条件：必现（全国 L0 + 试点省 L1）
- 期望：省界与卫星地物对齐，可辨认中国大陆地貌
- 实际：纹理可见但地理信息错位

---

## 失败过程还原

### 关键数据

| 指标 | 值 |
|------|-----|
| 全国 bounds south | 2.39°（含南海诸岛） |
| 全国 bounds north | 54.57° |
| 北京 39.9°N 线性 v | ≈ 0.282 |
| 北京 39.9°N WM v | ≈ 0.346 |
| 南北向 UV 偏差 | ≈ 5% 纹理高度（~50px@1024） |

### 时序图

| Seq | 动作 | 输入/参数 | 结果 | 证据来源 | 说明 |
|-----|------|---------|------|---------|------|
| 1 | `fetch:terrain-sat` 拼接瓦片 | ESRI WM 瓦片 + geo bounds | diffuse.png 像素按 Mercator Y | L1 `satelliteTileStitch.mjs` | 构建期正确 |
| 2 | `build:geo-terrain` 转 webp | `_source/diffuse.png` | `meta.source=satellite` | L1 资产审计 | 资产正确 |
| 3 | 运行时加载纹理 | `chinaTerrainLoader` flipY=false | 卫星彩色可见 | L1 代码 | 纹理加载正常 |
| 4 | `applyGeoCapGeoUv` 写 UV | `v = 1 - (lat-south)/latSpan` | 与 WM 像素空间不一致 | L1 `applyGeoCapGeoUv.ts:27` | **分水岭** |
| 5 | 用户目视 | 省界 vs 地物 | 严重错位 | L2 用户反馈 | 现象 |

---

## 根因 1：UV 用线性纬度，纹理在 Web Mercator 像素空间 ✅ 已修复

**代码证据**（构建期 `fe/scripts/lib/satelliteTileStitch.mjs:17-22`）：

```javascript
function lngLatToTileFloat(lng, lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  // ...
}
```

**代码证据**（修复前运行时 `fe/src/components/charts/engine/three/geo/applyGeoCapGeoUv.ts:27`）：

```typescript
const v = Math.max(0, Math.min(1, 1 - (lat - geoBounds.south) / latSpan));
```

**数据流**：

```text
ESRI WM 瓦片 → satelliteTileStitch 裁切（Mercator Y 像素）
  → diffuse.webp → TextureLoader(flipY=false)
  → applyGeoCapGeoUv（修复前：线性纬度 v）
  → 省界与地物南北错位
```

**影响量化**：全国尺度必现；北京纬度偏差约 5% 纹理高度。

### 修复详情（2026-07-23 R2，L1 诊断）

`terrainUvAlignment.test.ts` 证实：北京 vMerc≈0.346 与 vBBox≈0.654 互补（和≈1），说明 **geo UV（north→v=0）必须与 `flipY=true` + bbox UV 成对使用**，此前 `flipY=false` 导致南北镜像。

**改了什么**：

| 文件 | 改动 |
|------|------|
| `computeTerrainProjBounds.ts` | 新增：`meta.bounds` 四角投影 bbox |
| `buildGeoFlatPlateMesh.ts` | 卫星走 `applyGeoCapBboxUv(terrainProjBounds)` |
| `renderThreeChoropleth.ts` | 传入 `terrainProjBounds` |
| `chinaTerrainLoader.ts` | 移除 `flipY=false`；`ClampToEdgeWrapping` |
| `terrainPackBounds.mjs` | 全国 bounds 过滤装饰要素 |

**修复前**：纹理南北镜像 + Repeat 平铺噪声

**修复后**：对标 sc-datav bbox UV + 默认 flipY；R3 修复 sharp 拼接错位并重生成 national `diffuse.webp`

---

## 根因 4：构建期 sharp `composite→extract` 链式错位 ✅ 已修复（2026-07-23 R3）

**现象**：UV 公式自洽，但 `diffuse.webp` 东缘（136°E, 30°N）应为海洋却呈陆地色；瓦片合成后 `extract` 裁切与全画布同坐标像素不一致。

**代码证据**（`fe/scripts/lib/satelliteTileStitch.mjs`）：

```javascript
// 修复前：链式 composite→extract 会错位
.composite(composites).extract({ ... });

// 修复后：先物化 PNG 再 extract
const composed = await sharp({ create: ... }).composite(composites).png().toBuffer();
const base = sharp(composed).extract({ ... });
```

**验证**：重拼接后 136°E,30°N 像素 `b>r`（海洋蓝）；`terrainGeographicAudit.test.ts` 回归。

**操作**：`pnpm run fetch:terrain-sat -- --force && pnpm run build:geo-terrain`

## 根因 2：全国 bounds 含南海诸岛低纬点 🔲 待修复

**代码证据**（`fe/scripts/lib/terrainPackBounds.mjs:46-49`）：

```javascript
export async function readNationalBounds() {
  return boundsFromFeatures(geo.features ?? [], 0.02);
}
```

**代码证据**（`fe/src/components/charts/engine/three/geo/threeGeoProject.ts:37-38`）：

```typescript
.filter((f) => !isDecorativeGeoFeature(f.properties) && f.geometry != null)
```

mesh 拟合过滤装饰要素，纹理 bounds 未过滤 → 大陆纵向被压缩。

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P1 | `readNationalBounds` 过滤 `isDecorativeGeoFeature` 后取 bounds | `terrainPackBounds.mjs` | 中 |

---

## 根因 3：省级卫星 UV 策略与 sc-datav 不一致 🔲 待修复

**代码证据**（`fe/src/components/charts/engine/three/buildGeoFlatPlateMesh.ts:96-99`）：

```typescript
if (options.terrainSource === "satellite" && options.geoUvContext) {
  applyGeoCapGeoUv(capGeometry, options.geoUvContext);
} else {
  applyGeoCapBboxUv(capGeometry, options.projBounds!);
}
```

sc-datav 省级 sat-hunter 手工图用 bbox UV；当前试点省为 ESRI 自动拼接，WM UV 修复后应一致。

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P2 | `meta.uvMode: "bbox" \| "mercator"` 开关 | `meta.json` + `buildGeoFlatPlateMesh` | 低 |

---

## 启示

1. 纹理构建坐标系与运行时 UV 坐标系必须同一套公式，构建期/运行时应共享或交叉校验。
2. 单测角点通过不等于地理对齐正确——需用已知城市经纬度断言 WM vs 线性差异。
3. mesh 拟合 bounds 与纹理裁切 bounds 应同源，避免装饰要素造成二次错位。
4. `flipY=false` 与 north→v=0 配套，修改 UV 公式时必须一并验证 V 轴语义。
