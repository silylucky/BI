# Feature Truth Audit: GIS 球面大气 / 光晕 / 星场

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-21 |
| 核验范围 | `gis-map` 球面模式：大气光晕、星场、MapLibre sky、图层栈、样式面板大气相关控件 |
| 锚点 | `fe/src/components/charts/engine/maplibre/*` · `GisMapView.tsx` · `ChartGisMapProjectPanel.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6/10 · C** |
| 状态 | draft |
| **sampling** | `full`（大气子系统 11 实体 + 4 大气相关控件） |

## 1. 核验标准与预期（来自用户/对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 地球外缘有拟真大气光晕，视觉对标 [GeoLibre Web](https://web.geolibre.app/)：薄、柔、向外渐隐，**不遮挡地图** | 用户多轮反馈 + Leonel Dias / GeoLibre 方案 |
| T2 | 光晕/星场随 zoom、pitch、bearing、自转 **贴地球外缘**，无固定大圆、无漂移 | 用户截图：固定圆、光晕不跟随 |
| T3 | 星场铺满深空，**无挖洞**；自转时星点视差漂移 | 用户反馈固定圆遮背景 |
| T4 | 黑夜：星空+流星；白昼：无星点；深空径向背景 | `gisProject` / 面板文案 |
| T5 | 地球不透明度仅作用于地图层，可透出后方星空 | 面板说明 + `earthOpacity` |
| T6 | 样式面板：投影/大气预设/不透明度/自转 写入 `gisProject` 并驱动渲染 | 面板 + `writeGisProject` |

- 非目标：PMTiles CORS、44 型 cartesian 样式、GeoLibre 全插件 parity（comets 参数级完全一致）

## 2. 完整链路图

```
ChartGisMapProjectPanel → writeGisProject → GisMapView
  → applyGisGlobeToStyle / applyGlobeAtmosphere (setSky)
  → mountGisStarfieldOverlay (z-1)
  → mountGisGlobeHaloOverlay (z-3|z-5)
  → MapLibre Map (z-4, projection globe)
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 配置读写 | 通 | `gisProject.test.ts` | fog/atmospherePreset/earthOpacity |
| 2 | setSky | 通 | `gisAtmosphereSky.test.ts` | night blend 0.38 |
| 3 | 星场 mount | 通 | `gisStarfield.test.ts` | 视差公式；无挖洞单测 |
| 4 | 光晕 draw | 通 | `gisGlobeHalo.test.ts` | GeoLibre stops + clip 分支 |
| 5 | 球缘解析 | 部分 | `gisGlobeLayout.test.ts` | mock transform；无 pitch 透视 L1 |
| 6 | **视觉/GeoLibre 对标** | **未验** | 无 BROWSER | 用户截图仍报不对/没了/盖住地球 |
| 7 | 面板 → 渲染 | 部分 | 静态 `read/write` | 无 UI 集成测 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 外缘光晕 | PARTIAL | 5/C | CHAIN 有 gradient；无 BROWSER；曾盖住地球 |
| T2 | 跟随球缘 | PARTIAL | 6/C | raycast+project 链；缺 GeoLibre 椭圆拟合 |
| T3 | 星场无洞 | PARTIAL | 7/B | 已删 isInsideGlobeDisc；无 BROWSER |
| T4 | 昼夜大气 | CHAIN→PARTIAL | 7/B | preset 单测；流星/星场 night only |
| T5 | 地球透明度 | CHAIN | 6/C | host opacity；无 UI 验 |
| T6 | 面板接线 | STUB | 4/D | 无 ChartGisMapProjectPanel 测试 |

## 3b. 前端控件下钻表（大气相关）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 投影 Select | `patchProject projection` | globe 启用大气/星场 | 静态 wiring 存在 | 1 | 1 | 2 | 1 | 1 | 6 | STUB | `ChartGisMapProjectPanel.tsx:293-316` |
| B2 | 大气预设 | `applyAtmospherePreset` | day 无星 / night 有星 | 未 UI 验 | 1 | 1 | 2 | 1 | 1 | 6 | STUB | `:149-336` |
| B3 | 地球不透明度 | `ChartDeSliderField` | 仅 map 层透明 | 未 UI 验 | 1 | 1 | 2 | 1 | 1 | 6 | STUB | `:351-367` |
| B4 | 球面自转 | Checkbox `autoRotate` | 地轴自转，改视角关闭 | runtime 单测 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | `gisMapRuntime.test.ts` |

功能块映射：T6 → B1–B4；T4 → B2；T5 → B3；T2 → B4 + 渲染链

## 3d. 覆盖矩阵

| 实体 ID | 描述 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| A1 | GeoLibre gradient+screen | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `gisGlobeHalo.test.ts` |
| A2 | 球缘 raycast/project | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `gisGlobeLayout.test.ts` |
| A3 | 外环不盖地球 | ❌ | ✅ | ❌ | ❌ | CHAIN | 2 | 0 | PARTIAL | clip 分支单测；用户仍报盖住 |
| A4 | z-3/z-5 自动栈 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | `haloNeedsTopLayer` 启发式 |
| A5 | 星场无挖洞 | ❌ | ⚠️ | ❌ | ❌ | CHAIN | 1 | 1 | PARTIAL | 代码已删挖洞；无回归单测 |
| A6 | 星场视差 | ❌ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `gisStarfield.test.ts` |
| A7 | 流星 night | ❌ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `gisMeteors.test.ts` |
| A8 | MapLibre setSky | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `gisAtmosphereSky.test.ts` |
| A9 | 深空 CSS 背景 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | `spaceBackdropForPreset` |
| A10 | preset→fog 链 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `gisMapStyle.test.ts` |
| A11 | earthOpacity 链 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `gisProject.test.ts` + GisMapView |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 11 |
| GATE only | 2（A4, A9） |
| CHAIN | 9 |
| UI / BROWSER | 0 |
| NONE | 0 |
| REAL 达标 | 0/11 |
| **逐一校验** | **否** — 11/11 有 CHAIN/GATE，但 **0/11 有 BROWSER**；视觉正确性无 L1 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 0 | 2 | 1 | 1 | 6 | C | PARTIAL | 打通但视觉未达标 |
| T2 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL | 缺椭圆拟合 |
| T3 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL | |
| T4 | 2 | 2 | 2 | 1 | 1 | 8 | B | PARTIAL | 无 UI 验 |
| T5 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL | |
| T6 | 1 | 1 | 2 | 1 | 1 | 6 | C | STUB | 面板无集成测 |

**打通但不对**（L≥2 且 C≤1）：T1（A3 外环视觉）  
**假功能**：无（非 STUB 入口）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `pnpm exec vitest run src/components/charts/engine/maplibre` | 53 pass | **53 passed**（11 files） | ✅ | 2026-08-21 终端输出 |
| 2 | 浏览器 globe 远视图 | 外缘柔光 ≈ GeoLibre | **未执行 BROWSER** | ❌ | 用户截图仍反馈不对 |
| 3 | zoom/pitch 拖动 | 光晕贴边 | **未 L1** | ❌ | 缺 Playwright/MCP |
| 4 | 自转 | 光晕+星场同步 | runtime 单测 only | ⚠️ | `gisMapRuntime.test.ts` |

## 5. 修复文档（P0）

### T1 / A3 — 外缘光晕视觉对标 GeoLibre

**判定 / 得分**：PARTIAL 6/10，**C=0**（用户仍报盖住地球 / 不如 GeoLibre）  
**期望 vs 实际**：期望仅外环柔光；实际曾整盘高光、或光晕缺失、或与 [GeoLibre](https://web.geolibre.app/) 厚度/柔度不一致  
**根因（path）**：
- `gisGlobeHaloDraw.ts`：z-5 + clip 与 z-3 无 clip 双模式；MapLibre canvas 通常不透明 → 常走 top+clip
- `gisGlobeHalo.ts:19-24`：`haloNeedsTopLayer` 用 `getComputedStyle(backgroundColor)` 不可靠
- 未实现 GeoLibre [#230](https://github.com/opengeos/GeoLibre/commit/cd954e63fd10a99022d7143111625abd0d3dcab8) **conic 椭圆拟合**，pitch 下 bbox/raycast 仍可能偏  
**修复方向**：
1. 移植 `rayToLimb` + 5-param 椭圆 fit（或至少 pitch 下 conic center）
2. 固定策略：halo **始终 z-3**，MapLibre `setSky` 降低 viewport 填充；或 **始终 z-5 + 0.965 clip** 并加 BROWSER 快照门禁
3. 加 `GisMapView` smoke：canvas 球缘环带 alpha>0、圆心 alpha≈0  
**修后验收**：BROWSER 对比 GeoLibre；C≥2，T1 总分≥8，REAL

### T2 / A2 — 球缘跟踪

**判定**：PARTIAL 7/10  
**根因**：`resolveGlobeLimbBoundsFromProject` 仍为 90° 大圆；fallback `resolveGlobeScreenBounds` 与透视不符  
**修复方向**：优先 conic fit；弃用 viewport 0.42 fallback 作光晕  
**修后验收**：pitch 55° / zoom 0.5–3 BROWSER 无可见 seam

### T6 / B1–B3 — 面板接线

**判定**：STUB  
**修复方向**：`ChartGisMapProjectPanel.test.tsx` userEvent：切 night→期望 `resolveGisStarIntensity===1`；slider earthOpacity  
**修后验收**：UI 深度 ≥1 行 REAL

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T1/A3 | BROWSER 验外环 + 去盖地球 / 对标 GeoLibre 柔光 |
| P0 | T2/A2 | 椭圆球缘拟合（GeoLibre #230） |
| P1 | A4 | 去掉不可靠 `haloNeedsTopLayer` 启发式 |
| P1 | T6 | 面板集成测 |
| P2 | A5 | 星场「无挖洞」回归单测 |

## 7. 交接

- 建议：`root-first-solve` 处理 P0（椭圆 fit + BROWSER 门禁）
- 用户批准修复：**否**（本次仅审计）
- 单测：**53/53 绿** ≠ 视觉 REAL

---

## 8. 复验记录（2026-08-26 · GeoLibre 能力迁入）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-26 |
| 变更 | A1 paint 竞态修复 · A2 高级大气/光晕/自转速度面板 · B1 `layers[]` · B2 `ChartGisMapLayersPanel` · B3 多图层 runtime |
| 单测 | `pnpm exec vitest run src/components/charts/engine/maplibre/` → **101/101 绿** |
| BROWSER | `5173` 组件库 GIS 地图编辑页：`data-gis-paint-state=ready`；PMTiles 陆海+散点可见；样式 Tab 出现「GIS 底图」「高级大气与光晕」「GIS 图层」 |
| 总体判定 | **PARTIAL 7/10 · B**（渲染链与面板接线已验；T1 GeoLibre 远视图像素对标仍为 PARTIAL） |

| ID | 2026-08-26 期望 vs 实际 | 判定 |
|----|-------------------------|------|
| T1 | 外缘柔光 ≈ GeoLibre 远视图 | **PARTIAL** — 球面 globe + 光晕参数已暴露；未做 side-by-side 像素 diff |
| T2 | pitch 下光晕贴边 | **PARTIAL** — 新增 `gisGlobeLayout` pitch 单测；BROWSER 未验倾斜拖动 |
| T6 | 面板 → `gisProject` | **CHAIN→PARTIAL** — BROWSER 见高级大气折叠 + GIS 图层区块；无 Playwright 写回断言 |
| B-new | `gisProject.layers[]` 多图层 | **CHAIN** — `gisProjectLayers.test.ts` + 样式 Tab UI |

**仍待 P0**：与 [web.geolibre.app](https://web.geolibre.app/) 远视图 side-by-side 截图对标（T1）；GeoLibre #230 椭圆拟合完整移植（T2）。

---

## 9. 复验记录（2026-08-27 · 收口 B3/B4/B2）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-27 |
| 变更 | `activeLayerId` + 图层级 `binding` · 数据 Tab 当前图层提示 · LayersPanel UI 单测 · PRD VIZ-003-GIS · api validate 说明 |
| 单测 | maplibre 101+ · `ChartGisMapLayersPanel.test.tsx` 3 条 · `gisMapOverlay` binding case |
| 总体判定 | **PARTIAL 7.5/10 · B**（计划六阶段代码收口；T1 GeoLibre 像素对标仍 PARTIAL） |

| ID | 2026-08-27 | 判定 |
|----|------------|------|
| B3 多图层字段 | `binding` 覆写 + `activeLayerId` 数据 Tab | **CHAIN→UI** |
| B4 文档 | `F06-VIZ` VIZ-003-GIS + `docs/api/README.md` | **DONE** |
| B2 Layers 单测 | `ChartGisMapLayersPanel.test.tsx` | **UI** |
| A3 T1/T2 | 无 side-by-side 像素 diff | **PARTIAL** |

**逐一校验（计划全文）**：**否** — T1 GeoLibre 远视图 BROWSER 像素对标未 REAL。
