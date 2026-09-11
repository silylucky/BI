# VitalSpan 地图纹理实现说明

> **范围**：仅 **3D 区域地图（`map-3d`）** 使用离线卫星位图纹理；2D `map` 与热力图无地形纹理。  
> **合规**：GEO-IRON-01 — **运行时**禁止在线瓦片 / 地图 Key；资产须打包在 `fe/src/assets/geo/`。  
> **关联**：架构 [ADR-12](../arch.md#adr-12-离线中国地图geo-iron-01) · PRD [VIZ-003](../automate/prd/F06-VIZ.md#viz-003-图表类型插件注册)

---

## 结论先行

| 图表类型 | 是否有「纹理」 | 实现方式 |
|---------|---------------|---------|
| **2D 区域地图 `map`** | 否 | D3/SVG 纯色 choropleth + visualMap 渐变色 |
| **3D 区域地图 `map-3d`** | 是（可选） | **projBounds 空间烘焙** 离线卫星 WebP + 顶盖 `applyGeoCapBboxUv` |
| **热力图 `heatmap` / `t-heatmap`** | 否 | 矩阵色块，与地形无关 |

对标 [sc-datav Demo1](https://github.com/knight-L/sc-datav)：**参考视口（800×600）投影平面烘焙纹理**，运行时按 `projBounds` 线性铺展。

---

## 数据来源（构建期）

| 项 | 说明 |
|----|------|
| **彩色卫星** | [ESRI World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer)（与 sat-hunter 可选源一致） |
| **阴影法线** | [ESRI World Hillshade](https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer)（可选，构建期拉取） |
| **下载入口** | `pnpm run fetch:terrain-sat` → [`satelliteTileStitch.mjs`](../../fe/scripts/lib/satelliteTileStitch.mjs)（邻接瓦片 **4px 余弦羽化** 减轻网格缝） |
| **运行时** | 仅读仓库内 `diffuse.webp`，**零外链**（GEO-IRON-01） |

### 两级下钻纹理范围

| 层级 | drillDepth | mapId 示例 | 纹理包 |
|------|------------|-----------|--------|
| L0 全国 | 0 | `vs-regions` | `terrain/national/` 4096px |
| L1 省级 | 1 | `vs-geo-440000` | `terrain/provinces/{adcode}/` 4096px × **34 省** |
| L2 市/区县 | 2 | `vs-geo-440100` | **无独立包**；回退父省级纹理 |

### 分辨率（R6 + 省级全覆盖）

| 参数 | 全国 | 省级（34 省） |
|------|------|---------------|
| 瓦片 zoom | 7（自适应 8→7→6） | 8~9（按省界） |
| 烘焙输出 | 4096px 长边 | **4096px** 长边 |
| WebP quality | 92 | **92** |
| 体积 | ≈ 4.7 MB | 单省约 2~8 MB，合计约 80~200 MB |

```bash
# 仅重生成省级（跳过全国）
pnpm run fetch:terrain-sat -- --force --provinces-only
pnpm run build:geo-terrain
```

---

## 坐标系契约（BUG-13 修复后）

| 层 | 约定 |
|----|------|
| **构建期** | Mercator 瓦片拼接（邻接边羽化）→ 逐像素反投影采样 → **projBounds 空间 diffuse** + 轮廓 alpha；**displacement** 同 projBounds 网格烘焙（无损 WebP） |
| **运行时 UV** | `applyGeoCapBboxUv(projBounds)`（与 sc-datav `shape.tsx` 同构） |
| **禁止** | 矩形 Mercator 图直接配 bbox UV；运行时 Mercator 经纬度 UV |

---

## GEO-IRON-01：构建期 vs 运行时

| 阶段 | 是否允许联网 | 说明 |
|------|-------------|------|
| **构建期** | 允许 | sat-hunter 或 `pnpm run fetch:terrain-sat` 下载瓦片 + projBounds 烘焙 |
| **运行时** | **禁止** | 仅 `TextureLoader` 加载仓库内 `diffuse.webp` |

---

## 资产生成

### 方式 A：sat-hunter 手动（推荐验收）

1. 克隆 [sat-hunter](https://github.com/knight-L/sat-hunter)
2. **按区域轮廓下载** → 搜索「中华人民共和国」或省名
3. 导出 `diffuse.png`、`normal.png` → `terrain/*/_source/`
4. `cd fe && pnpm run build:geo-terrain`

> 手动导出须与参考视口投影一致；推荐优先用方式 B 自动烘焙。

### 方式 B：构建期自动（推荐）

```bash
cd fe && pnpm run fetch:terrain-sat -- --force && pnpm run build:geo-terrain
# 分片：--national-only | --provinces-only | --adcode=330000
```

- `terrainProjBake.mjs`：参考视口 800×600，`projBounds` 逐像素反投影采样 Mercator 源图
- `terrainThreeProject.mjs`：与运行时 `buildThreeGeoProject` 同投影
- `meta.json`：`uvMode: "projBounds"`、`refViewport: [800,600]`、`masked: true`

### 输出文件

| 文件 | 含义 |
|------|------|
| `diffuse.webp` | projBounds 空间卫星彩色（透明底） |
| `normal.webp` | 阴影辅助（可选） |
| `displacement.webp` | 程序化高度 |
| `meta.json` | `bounds`、`width`、`height`、`uvMode`、`refViewport`、`masked` |

---

## 运行时渲染

| 子 Mesh | 几何 | 材质 / UV |
|---------|------|-----------|
| **顶盖** | `ShapeGeometry` | `applyGeoCapBboxUv(projBounds)` + `MeshStandardMaterial(map, normalMap, …)` |
| **侧壁** | `ExtrudeGeometry` | 纯色 Standard（无卫星贴图） |

- 纹理：`ClampToEdgeWrapping`（`chinaTerrainLoader.ts`）
- Inspector：`geo3d.terrainTexture` / `geo3d.terrainRelief`

---

## 关键文件

| 环节 | 路径 |
|------|------|
| projBounds 烘焙 | `fe/scripts/lib/terrainProjBake.mjs` |
| 构建期投影 | `fe/scripts/lib/terrainThreeProject.mjs` |
| 构建期下载 | `fe/scripts/fetch-terrain-satellite.mjs` |
| 转 webp | `fe/scripts/build-china-terrain-assets.mjs` |
| 运行时 UV | `fe/src/components/charts/engine/three/geo/applyGeoCapBboxUv.ts` |
| Mesh 入口 | `fe/src/components/charts/engine/three/buildGeoFlatPlateMesh.ts` |
| 3D 编排 | `fe/src/components/charts/engine/three/renderThreeChoropleth.ts` |

---

## 扩展与调试

| 目标 | 操作 |
|------|------|
| 更新全国/省卫星图 | `fetch:terrain-sat -- --force` → `build:geo-terrain` |
| 地理审计 | `terrainGeographicAudit.test.ts` |
| UV 对齐 | `terrainUvAlignment.test.ts` |
| 关闭 3D 纹理 | Inspector 关闭「地形贴图」 |
