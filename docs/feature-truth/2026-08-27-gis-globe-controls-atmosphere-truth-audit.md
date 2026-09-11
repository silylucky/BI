# Feature Truth Audit: GIS 球面大气 · 地图控件 · 样式栏开关

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-27 |
| 核验范围 | 本会话收口：`gis-map` 球面默认视图大气/星场/光晕、地图控件真通、GIS 样式栏 Checkbox→Switch；承接 [2026-08-21-gis-globe-atmosphere-truth-audit.md](./2026-08-21-gis-globe-atmosphere-truth-audit.md) T1/T2 |
| 锚点 | `GisMapView.tsx` · `gisGeolibreEffectsEngine.ts` · `gisGlobeLayout.ts` · `gisMapViewBridge.ts` · `ChartGisMap*Panel.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.5/10 · C** |
| 状态 | draft |
| **sampling** | `full`（14 必验实体 + 11 控件行） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T7 | 默认全球视图（zoom≈1.5）可见星场 + 蓝色光晕 + 深空；非纯黑空壳 | 用户「太空和大气全没了」 |
| T8 | 样式栏「地图控件」5 项开关后，地图角出现导航/比例尺/全屏/归属/经纬网 | 用户「僵尸按钮」 |
| T9 | GIS 相关样式栏布尔项均为 Switch（非 Checkbox） | 用户「配置里的勾选都改成开关」 |
| T10 | zoom>4.5 或球盘铺满时隐藏星场/光晕，避免底部白条伪影 | 会话修复约束 |
| T11 | 继承 T1/T2：外缘光晕视觉 ≈ GeoLibre；pitch 下贴边 | 2026-08-21 审计 P0 |

- 非目标：PMTiles CORS、44 型 cartesian 样式全量、GeoLibre 全插件 parity

## 2. 完整链路图

```
ChartGisMap*Panel → mutateChartConfig / applyGisMap* bridge
  → gisProject.mapControls / effects
  → GisMapView (gisPaintState=ready, mapRuntimeEpoch)
  → mountGisMapControls / gisGeolibreEffectsEngine
  → MapLibre controls + canvas overlays
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 配置读写 | 通 | `gisProject.test.ts` | mapControls resolve |
| 2 | 远视图判定 | 通 | `gisAtmosphereSky.test.ts` | zoom 主门 + 0.92 辅门 |
| 3 | Effects 挂载 | 通 | `GisMapView.effects.regression.test.ts` | ready + epoch 门禁 |
| 4 | 控件 live bridge | 部分 | `gisMapViewBridge.test.ts` | 仅 mock 注册；无 DOM 控件断言 |
| 5 | 控件 remount 时机 | 部分 | `GisMapView.tsx` 静态读 | 已接 ready/epoch/style.load；**未 BROWSER** |
| 6 | Switch UI | 部分 | `ChartGisMapAtmospherePanel.test.tsx` | 仅大气面板验 switch |
| 7 | **视觉正确性** | **未验** | 无 BROWSER | T7/T8/T11 缺 L1 截图 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T7 | 默认视图大气 | PARTIAL | 7/B | CHAIN 阈值修复已 commit `5baed511`；无 BROWSER |
| T8 | 地图控件真通 | PARTIAL | 5/C | remount+bridge 已写；**工作区未提交**；无 UI/BROWSER |
| T9 | Switch 统一 | PARTIAL | 6/C | 源码已改 InspectorSwitchRow；Sun/Project 无 switch 单测 |
| T10 | 区域伪影抑制 | CHAIN | 7/B | `shouldRenderGisGlobeFarEffects` 单测 |
| T11 | GeoLibre 对标 | PARTIAL | 6/C | 继承 2026-08-21；仍无像素 diff |

## 3b. 前端控件下钻表（GIS 样式栏 · 必验 11 行）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 大气·已启用 | `patchEffects enabled` | Switch + 即时预览 | Switch ✅；bridge 有 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | `ChartGisMapAtmospherePanel.test.tsx` |
| B2 | 太阳·启用太阳光照 | `setSun enabled` | Switch | Switch 源码 ✅；无单测 | 1 | 1 | 2 | 1 | 1 | 6 | STUB | `ChartGisMapSunPanel.tsx:99` |
| B3 | 底图图层×4 | `patchBasemapLayers` | Switch + live basemap | Switch ✅；basemap bridge 有 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | `ChartGisMapProjectPanel.tsx:356` |
| B4 | 导航与指南针 | `patchMapControl` | 地图右上角控件 | bridge+remount ✅；**未 BROWSER** | 2 | 0 | 2 | 1 | 1 | 6 | PARTIAL | `GisMapView.tsx` remountMapControls |
| B5 | 全屏 | 同上 | 全屏按钮 | 同 B4 | 2 | 0 | 2 | 1 | 1 | 6 | PARTIAL | `gisMapRuntime.ts:227` |
| B6 | 比例尺 | 同上 | 左下角比例尺 | 同 B4 | 2 | 0 | 2 | 1 | 1 | 6 | PARTIAL | `gisMapRuntime.ts:232` |
| B7 | 归属信息 | 同上 | 右下角 © | 同 B4 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 默认开 |
| B8 | 经纬网 | 同上 | overlay 线 | applyGisGraticule 链 | 2 | 0 | 2 | 1 | 1 | 6 | PARTIAL | `gisGraticule.ts` |
| B9 | 建筑 3D | `patchBasemapRuntime` | Switch + 挤出 | Switch ✅ | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | bridge basemap |
| B10 | 球面自转 | `patchProject autoRotate` | Switch + 旋转 | Switch ✅；runtime 单测 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | `gisMapRuntime.test.ts` |
| B11 | 图层可见 Switch | `commitLayers visible` | 行尾 Switch | Switch ✅；Layers 单测未 assert role | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | `ChartGisMapLayersPanel.tsx` |

功能块映射：T7→E1,E2；T8→B4–B8,E7–E12；T9→B1–B3,B9–B11；T10→E1,E14

## 3d. 覆盖矩阵

| 实体 ID | 描述 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| E1 | 远视图判定 zoom 门 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `gisAtmosphereSky.test.ts` |
| E2 | Effects 挂载 ready 门 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `GisMapView.effects.regression.test.ts` |
| E3 | 大气 Switch+色 | ❌ | ❌ | ✅ | ❌ | UI | 2 | 1 | PARTIAL | `ChartGisMapAtmospherePanel.test.tsx` |
| E4 | 太阳 Switch | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 源码 only |
| E5 | mapControls 5 项配置 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 0 | PARTIAL | `gisProject.test.ts` |
| E6 | remountMapControls | ❌ | ⚠️ | ❌ | ❌ | CHAIN | 2 | 0 | PARTIAL | `gisMapViewBridge.test.ts` |
| E7 | NavigationControl | ❌ | ⚠️ | ❌ | ❌ | CHAIN | 2 | 0 | PARTIAL | `mountGisMapControls` |
| E8 | ScaleControl | 同 E7 | 同 | 同 | 同 | CHAIN | 2 | 0 | PARTIAL | 同 |
| E9 | FullscreenControl | 同 E7 | 同 | 同 | 同 | CHAIN | 2 | 0 | PARTIAL | 同 |
| E10 | AttributionControl | 同 E7 | 同 | 同 | 同 | CHAIN | 2 | 1 | PARTIAL | 默认开 |
| E11 | Graticule overlay | ❌ | ⚠️ | ❌ | ❌ | CHAIN | 2 | 0 | PARTIAL | `gisGraticule.ts` |
| E12 | 控件 z-index 可见 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | `gisGeolibreEffectsEngine.ts` CSS |
| E13 | GIS Switch 全量 | ⚠️ | ❌ | ⚠️ | ❌ | GATE | 1 | 1 | STUB | 1/4 面板有 switch 单测 |
| E14 | T11 GeoLibre 像素 | ❌ | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 继承旧审计 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 14 |
| GATE only | 3（E4, E12, E13） |
| CHAIN | 9 |
| UI | 1（E3） |
| BROWSER | 0 |
| NONE | 1（E14 未复验） |
| REAL 达标 | **0/14** |
| **逐一校验** | **否** — 14/14 有静态/单测痕迹，**0/14 BROWSER**；T8 控件 C=0 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T7 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL | commit 已合；需 BROWSER |
| T8 | 2 | 0 | 2 | 1 | 1 | 6 | C | PARTIAL | 僵尸根因已修代码；未 L1 验可见 |
| T9 | 1 | 1 | 2 | 1 | 1 | 6 | C | STUB/PARTIAL | 缺 Project/Sun switch 单测 |
| T10 | 2 | 2 | 2 | 1 | 1 | 8 | B | PARTIAL | 单测够；无 BROWSER |
| T11 | 0 | 0 | 1 | 0 | 0 | 1 | F | UNVERIFIED | 未纳入本次动态验 |

**打通但不对**（L≥2 且 C≤1）：T8（B4–B6,B8），E7–E9,E11  
**未提交代码**：T8/T9 相关 `GisMapView.tsx`、`gisMapViewBridge.ts`、`ChartGisMapProjectPanel.tsx` 等（相对 `5baed511`）

## 4. 动态验证记录

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest run` GIS 9 文件 35 测 | 全绿 | **35/35 passed** | ✅ | 2026-08-27 18:17 终端 |
| 2 | git 相对 HEAD | T8/T9 已提交 | **5baed511 仅含 T7 大气**；控件/开关 **M 未提交** | ❌ | `git status` |
| 3 | BROWSER 默认 globe | 光晕+星场 | **未执行** | ❌ | — |
| 4 | BROWSER 开导航 | 右上角 +/- | **未执行** | ❌ | — |
| 5 | 用户截图 地图控件 | Switch 列表 | 仍为 **Checkbox UI** | ❌ | 用户 18:04 截图（未刷新或未部署） |

## 5. 修复文档（P0 · 未 REAL）

### T8 — 地图控件僵尸

**判定**：PARTIAL 6/10，**C=0**  
**期望 vs 实际**：开「导航与指南针」应见 MapLibre 控件；用户报无可见功能  
**根因**：
1. ~~挂载 effect 早于 map ready~~ → 已修 `gisPaintState` + `mapRuntimeEpoch`（**未提交**）
2. ~~无 live bridge~~ → 已加 `applyGisMapControls`（**未提交**）
3. **缺 BROWSER L1**；用户环境可能仍为旧 bundle / Checkbox 旧 UI  
**修复方向**：
1. **提交** T8/T9 工作区改动
2. `ChartGisMapProjectPanel.test.tsx`：userEvent 切 navigation → `applyGisMapControls` mock 被调
3. BROWSER：5173 编辑页开 5 控件逐项 snapshot  
**修后验收**：B4–B8 每项 C≥2，T8≥8，REAL

### T9 — Switch 统一

**判定**：PARTIAL 6/10  
**修复方向**：Sun/Project/Layers 面板补 `getByRole('switch')` 单测；硬刷新验 UI  
**修后验收**：E13 UI 深度，11/11 控件行有 switch 断言

### T7 — 默认大气（已 commit，待 BROWSER 收口）

**判定**：PARTIAL 7/10  
**已做**：`shouldRenderGisGlobeFarEffects` zoom 主门（`5baed511`）  
**待做**：BROWSER 默认 zoom 1.5 见光晕+星场  
**修后验收**：T7 C≥2，REAL

### T11 — 继承 GeoLibre 对标

见 [2026-08-21-gis-globe-atmosphere-truth-audit.md §5](./2026-08-21-gis-globe-atmosphere-truth-audit.md) P0，**仍未完成**。

## 6. 完成度结论（回答「是否完成」）

| 维度 | 状态 |
|------|------|
| **代码意图** | 大部分已写（T7 已提交；T8/T9 在工作区） |
| **单测** | 35/35 绿，但 **无地图控件 UI/BROWSER** |
| **用户可感知** | **未完成** — 截图仍 Checkbox；控件 C=0 |
| **REAL 标准** | **否** — 0/14 实体 REAL |
| **里程碑可宣称** | **否** — 需提交 + BROWSER + T8 单测 |

## 7. 交接

- 建议顺序：① git commit T8/T9 → ② 补 Project 控件单测 → ③ BROWSER 5173 验 T7/T8 → ④ 再评 T11  
- 用户批准修复：**待确认**  
- 单测绿 **≠** 功能 REAL（GATE/CHAIN 冒充风险已排除，但 BROWSER 缺口仍在）
