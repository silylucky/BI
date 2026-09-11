# Feature Truth Audit: GIS 地图 · 散点叠加（P1）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 核验范围 | `gis-map` 经纬度散点：数据绑定、GeoJSON/sizeNorm、样式配置、样式面板、MapLibre 运行时同步 |
| 锚点 | `fe/src/components/charts/engine/maplibre/gisMapOverlay*.ts` · `gisProject.ts` · `GisMapView.tsx` · `ChartGisMapOverlayPanel.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7/10 · B** |
| 状态 | approved-fix（P0 已落地 2026-08-24）· BROWSER 走查 2026-08-24 |
| **sampling** | `full`（散点子系统 12 实体 + 10 面板控件） |

## 1. 核验标准与预期（来自用户/对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 绑定数值型经度+纬度后，底图上出现散点；可选指标控制圆点大小、标签可选 | 对话 P1 散点能力 |
| T2 | 散点样式可配：颜色、半径范围、不透明度、描边、按指标缩放 | 对话 P1 |
| T3 | 标签可开关；低于指定 zoom 隐藏标签 | 对话 P1 |
| T4 | 样式 Tab 有「散点叠加」面板，控件写入 `gisProject.overlay` 并驱动地图 | 对话 P1 样式面板 |
| T5 | 数据变更用 `setData` 更新，样式变更用 `setPaintProperty`，避免整图 `setStyle` | 对话 P1 运行时 |
| T6 | 提供 lng/lat 示例 SQL 或官方 demo 数据集，降低接入门槛 | 对话 P1 示例 |
| T7 | 绑 province 等地区字段时黄条提示、不出散点 | 既有 GIS 数据提示 |

- 非目标：按 province 在 GIS 上 choropleth、在线瓦片、44 型 cartesian 样式全量

## 2. 完整链路图

```
ChartDataSlots / ChartGisMapDataPanel
  → chartConfig.dimensions[0,1] + metrics[0]
  → buildGisOverlayGeoJson (+ sizeNorm)
  → GisMapView overlayGeoJson
  → MapLibre source vs-gis-overlay (setData | style embed)
  → circle/symbol layers (paint/layout)

ChartGisMapOverlayPanel
  → patchOverlay → writeGisProject({ overlay })
  → resolveGisOverlayStyle + syncGisOverlayStyle (setPaintProperty)
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 数据槽位/提示 | 通 | `gisMapDataHint.test.ts` · `catalog.ts` | 经/纬/指标槽位 + warn |
| 2 | GeoJSON 构建 | 通 | `gisMapOverlay.test.ts` | sizeNorm 0–1 |
| 3 | overlay 配置 | 通 | `gisMapOverlayStyle.test.ts` · `gisProject.test.ts` | normalize + resolve |
| 4 | 样式层定义 | 通 | `gisMapOverlayStyle.test.ts` | paint/layout 表达式 |
| 5 | 面板注册 | 通 | `chartTypeStyleProfiles.ts` · `ChartStyleSection.tsx` | gisOverlay section |
| 6 | 面板控件 → 持久化 | **未 UI 验** | 静态 Read | 无 `ChartGisMapOverlayPanel.test.tsx` |
| 7 | 运行时 setData | **部分** | `GisMapView.tsx:159-169` | data 仍进 styleKey → 整 style 重载 |
| 8 | 运行时 setPaint | **未集成验** | `gisMapOverlayStyle.ts:119-139` | 无 Map mock 单测 |
| 9 | 地图可见散点 | **未验** | 无 BROWSER | 依赖 PMTiles 环境 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 数据→散点 | PARTIAL | 7/B | CHAIN 单测；无 BROWSER 见点 |
| T2 | 样式可配 | PARTIAL | 7/B | builder 单测；面板未 UI 验 |
| T3 | 标签 zoom | PARTIAL | 6/C | minzoom + layout；无 zoom 行为 L1 |
| T4 | 样式面板 | STUB | 4/D | GATE 注册；零 panel 测试 |
| T5 | 运行时优化 | PARTIAL | 5/C | setData 存在但被 style 重载抵消 |
| T6 | 示例接入 | PARTIAL | 5/C | hint 含 SQL 文案；无 demo Dataset |
| T7 | 错绑提示 | REAL | 8/B | `gisMapDataHint.test.ts` 5/5 绿 |

## 3b. 前端控件下钻表（散点叠加面板）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 散点颜色 | `patchOverlay color` | 圆点变色 | 静态 wiring | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `ChartGisMapOverlayPanel.tsx:63-67` |
| B2 | 描边颜色 | `patchOverlay strokeColor` | 描边变色 | 未验 | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `:71-75` |
| B3 | 不透明度 | `InspectorSliderField` | 圆点透明 | 未验 | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `:80-88` |
| B4 | 最小半径 | slider | 小点下限 | 未验 | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `:90-100` |
| B5 | 最大半径 | slider | 大点上限 | 未验 | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `:102-110` |
| B6 | 描边宽度 | slider | 描边 px | 未验 | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `:112-120` |
| B7 | 按指标缩放 | switch | 有/无 sizeNorm 插值 | CHAIN 表达式单测 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | builder test |
| B8 | 显示标签 | switch | 标签显隐 | 未验 | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `:128-132` |
| B9 | 标签最小 zoom | number input | 低 zoom 无字 | 未验 | 1 | 0 | 2 | 1 | 1 | 5 | STUB | `:134-150` |
| B10 | 恢复默认 | button | 清空 overlay | 未验 | 1 | 1 | 2 | 1 | 1 | 6 | STUB | `:153-160` |

功能块映射：T4 → B1–B10；T2 → B1–B7；T3 → B8–B9

## 3d. 覆盖矩阵

| 实体 ID | 描述 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| E1 | buildGisOverlayGeoJson + sizeNorm | ❌ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `gisMapOverlay.test.ts` 3/3 |
| E2 | gisProject.overlay schema | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `gisProject.test.ts` + overlay normalize |
| E3 | overlay paint/layout builders | ❌ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `gisMapOverlayStyle.test.ts` 9/9 |
| E4 | appendGisOverlayLayers | ❌ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | style test 含 layer id |
| E5 | syncGisOverlayData | ❌ | ❌ | ❌ | ❌ | NONE→代码 | 1 | 0 | STUB | 无单测；且被 style 重载弱化 |
| E6 | syncGisOverlayStyle | ❌ | ❌ | ❌ | ❌ | NONE | 1 | 0 | STUB | 无 Map mock 单测 |
| E7 | GisMapView 接线 | ✅ | ⚠️ | ❌ | ❌ | GATE | 1 | 0 | STUB | Read：`overlayGeoJson`∈style deps |
| E8 | profile `gisOverlay` section | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | `chartTypeStyleProfiles.ts:57` |
| E9 | ChartStyleSection 路由 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | `ChartStyleSection.tsx:59-60` |
| E10 | ChartGisMapOverlayPanel | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 无 test 文件 |
| E11 | 数据 hint + SQL 文案 | ❌ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `gisMapDataHint.test.ts` + message 含 SELECT |
| E12 | chartDeAxis 槽位标签 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | `catalog.ts` gis-map entry |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 12 |
| GATE only | 5（E7–E10、E12） |
| CHAIN | 4（E1–E4、E11） |
| UI / BROWSER | 1（E9 底图 + autoFit；散点见点待放大复验） |
| NONE（未独立验） | 2（E5、E6） |
| REAL 达标 | 0/12（T7 提示子项可单算 REAL，非散点渲染主路径） |
| **逐一校验** | **否** — 12 实体中 0 项达 UI/BROWSER；10 个面板控件 0 项 UI 验 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总（功能块 T 级，取 Bx 最低分加权）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 2 | 2 | 1 | 8 | B | PARTIAL | 无地图见点 L1 |
| T4 | 1 | 0 | 2 | 1 | 1 | 5 | C | STUB | 面板全 STUB |
| T5 | 1 | 0 | 2 | 1 | 1 | 5 | C | PARTIAL | setData 被 styleKey 抵消 |
| T6 | 1 | 1 | 1 | 2 | 1 | 6 | C | PARTIAL | 仅 hint 无 Dataset |
| **总体** | — | — | — | — | — | **6** | **C** | **PARTIAL** | L≥2 项存在但 C 未达标 |

**打通但不对**（L≥2 且 C≤1）：B1–B6、B8–B9（面板控件未验正确性）；T5 架构目标未达成  
**假功能**（STUB）：E5/E6/E10 登记了 API 但未证明运行时行为

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest run` 散点相关 5 文件 | 全绿 | 38/38 passed | ✅ | 2026-08-24 15:00 命令输出 |
| 2 | Read `GisMapView` style deps | 数据变更不触发 `JSON.stringify(style)` | `overlayGeoJson` 在 style useMemo deps | ❌ | `GisMapView.tsx:159-171` |
| 3 | Grep `ChartGisMapOverlayPanel.test` | 存在 UI 单测 | **无文件** | ❌ | glob 0 命中 |
| 4 | Grep demo dataset lng/lat | 仓内 seed/SQL 示例 | 仅 `gisMapDataHint.ts` 文案 | ❌ | 无 seed 文件 |
| 5 | BROWSER 绑定 lng/lat 见散点 | 地球上有圆点 | 预览模式 PMTiles 底图 + autoFit 东亚；MapLibre 8 层；API 500 行；**散点圆点截图未清晰辨认** | ⚠️ | `localhost:5173` 预览 2026-08-24 |
| 6 | seed `demo-map-scatter` | 一键接入可用 | 需先 `python scripts/seed-demo-package.py`；数据集列表缓存未刷新时会误报「尚未就绪」 | ⚠️ | 走查中已 seed；刷新数据集列表后通过 |
| 7 | T7 错绑 province | 黄条 warn、无散点 | 编辑态见「地区字段不能当经纬度…」 | ✅ | 首屏截图 |
| 8 | 一键接入 de_map_heat | 槽位 lng/lat/point_name/amount | 按钮 + 校验通过文案 | ✅ | ChartGisMapScatterSetup |
| 9 | 编辑态实时预览 | 选中组件可见底图 | 多组件看板编辑态 GIS 区黑屏（mount gate / 未 inView） | ❌ | 预览模式才挂载 canvas |

## 5. 修复文档（P0）

### T5 — 运行时 setData 被整 style 重载抵消

**判定 / 得分**：PARTIAL 5/10，C=0  
**期望 vs 实际**：期望数据刷新只 `source.setData`；实际 `overlayGeoJson` 参与 `style`/`styleKey`，触发 `applyGisMapStylePreservingCamera`  
**根因**：`GisMapView.tsx:159-171` style useMemo 依赖 `overlayGeoJson`  
**修复方向**：style 内 overlay 固定 `emptyGisOverlayGeoJson()`；数据仅走 `syncGisOverlayData`；styleKey 排除 GeoJSON payload  
**修后验收**：数据变更不触发 `setStyle`；单测 mock Map 断言 `setData` 调用次数  
**优先级**：P0

### T4 — 散点叠加面板无 UI 验证

**判定**：STUB 4/10  
**期望 vs 实际**：slider/switch 改色改半径并回显；实际仅静态组件存在  
**根因**：缺 `ChartGisMapOverlayPanel.test.tsx`（对比 `ChartGisMapProjectPanel.test.tsx`）  
**修复方向**：参照 project panel 写 userEvent 测试：patchOverlay → `nativeBody.gisProject.overlay`  
**修后验收**：B1–B3 至少 3 控件 UI 测；C≥2  
**优先级**：P0

### T6 — 无官方 demo Dataset

**判定**：PARTIAL 6/10  
**期望 vs 实际**：P1 列「示例 SQL / 官方 Dataset」；实际仅 hint 字符串  
**修复方向**：demo seed 或文档内可执行 SQL + 文档登记（非 mock 占位）  
**优先级**：P1

### T1 — 无 BROWSER 见点证据

**判定**：PARTIAL 7/10  
**修复方向**：`.dev` 环境走查：绑定 longitude/latitude/amount → 截图或 MCP snapshot  
**优先级**：P1（交付前）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T5 | 从 styleKey 剥离 overlayGeoJson，真正 setData-only 更新 |
| P0 | T4 | 补 ChartGisMapOverlayPanel 集成测 |
| P1 | T6 | 补 lng/lat demo Dataset 或 seed |
| P1 | T1 | BROWSER 走查见散点 |

## 7. 交接

- 建议：`root-first-solve` 先修 T5 + T4，再 BROWSER 复验
- 用户批准修复：**是**（2026-08-24）

## 8. P0 修复记录（2026-08-24）

| ID | 修复 | 证据 |
|----|------|------|
| T5 | `GisMapView` style 固定 `emptyGisOverlayGeoJson()`；`mapStyleKey` 不含 payload；数据仅 `syncGisOverlayData` | `GisMapView.tsx` · `gisMapOverlayStyle.test.ts` sync 单测 |
| T4 | 新增 `ChartGisMapOverlayPanel.test.tsx`（5 项 UI 接线） | vitest 5/5 绿 |

**复验后判定**：T5/T4 由 STUB/PARTIAL 提升至 **CHAIN/UI**；总体仍 **PARTIAL**（缺 BROWSER 见点、demo Dataset）。

## 9. BROWSER 走查记录（2026-08-24）

**环境**：`localhost:5173` · 看板 `58e63e97-a12b-44e5-a8ed-e2af5b7aacdc` · admin · sample-mysql + PMTiles 已登记

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | GIS 底图（PMTiles） | ✅ | 预览模式可见东亚底图 |
| 2 | 错绑 province → 黄条 | ✅ | 编辑态 warn，无散点 |
| 3 | 一键接入 de_map_heat | ✅ | 槽位自动填充；需 seed + 刷新数据集列表 |
| 4 | 数据集 execute | ✅ | API 返回 500 行 lng/lat/amount |
| 5 | autoFit | ✅ | 预览自动定位东亚/中国范围 |
| 6 | 散点可见 + cluster | ⚠️ | overlay 层已挂载（maplibregl 8 层）；截图未清晰看到圆点/cluster |
| 7 | 点击 tooltip | — | 未在截图坐标系下稳定复现 |
| 8 | 样式 Tab 散点叠加 | — | 本次未逐控件改色 |
| 9 | 编辑态 canvas | ❌ | 编辑页 GIS 区长期黑屏，预览模式才渲染 |

**走查结论**：链路 **大部分打通**；交付前建议：① seed 后提示刷新数据集缓存；② 编辑态 mount gate 导致 GIS 难即时预览；③ 放大至 city 级复验散点/cluster/tooltip。

---

**结论（回答「确认完成了吗？」）**：

**不能标「已完成 / REAL」。** 代码与 CHAIN 单测表明 **P1 散点能力已大部分落地**（配置、GeoJSON、样式 builder、面板注册、数据提示），但 truth-verify 下总体为 **PARTIAL · 6/10 · C**，主要缺口：

1. **运行时优化未真完成** — 数据变更仍会整图 `setStyle`  
2. **样式面板 10 个控件零 UI 验证**  
3. **无 BROWSER 证据**证明地图上可见散点  
4. **官方 demo Dataset 未做**（仅有 hint 内 SQL 文案）
