# Feature Truth Audit: 2D 区域地图下钻（组件库优先）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | **2D 地图**（`chartType=map`）双击下钻 · 面包屑/返回 · 手动地区 picker；入口以 **S3 组件库编辑预览** 为主 |
| 锚点 | `VizComponentEditPage` · `VizComponentLivePreview` · `ChartRenderer` · `renderChoropleth` · `ChartDrillChrome` |
| 总体判定（修复前） | **BROKEN**（组件库预览 GATE 断链：`drillEnabled=false` + 无 `ChartDrillProvider`） |
| **总分 / 档位（修复前）** | **3/10 · F** |
| 状态 | **approved-fix**（本 PR 实施接线修复） |
| sampling | **none**（§3d 全量必验行） |
| Bug 案例 | CASE-2026-07-27-001（下钻资产注册表，已修；本次为不同根因） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 组件库编辑预览：双击省界 → 市级 GeoJSON + 面包屑「全部 / 省名」 | `ChartGeoStylePanel` 文案 |
| T2 | 点击「返回上一级」或面包屑「全部」→ 回全国省级地图 | `ChartDrillChrome` |
| T3 | 右栏「手动下钻」选省/市与双击等效，画布同步 | `ChartMapRegionPicker` |
| T4 | 看板 edit/view map 下钻不退化 | 回归 vitest |
| T5 | Hub 列表 thumbnail 卡片不要求交互下钻 | Out |

**Out**：`heatmap` 矩阵热力、Embed 只读消费（P1 顺手修）、区县边界未打包时的「停在市级」提示。

## 2. 完整链路（修复前断点）

```
VizComponentLivePreview
  → ChartRenderer(drillEnabled=false)     ← 断点 1
  → drillInteraction=false
  → onInteraction undefined
  → buildRenderConfig 不传 onPointClick
  → renderChoropleth dblclick 无回调

无 ChartDrillProvider                      ← 断点 2
  → useChartDrill.active=false
  → ChartDrillChrome 不渲染（即使栈存在）
```

| 序 | 层 | 修复前 | 证据 |
|----|-----|--------|------|
| 1 | 入口 `VizComponentLivePreview` | **断** | 未传 `drillEnabled` |
| 2 | Drill 上下文 | **断** | 无 `ChartDrillProvider` |
| 3 | D3 双击 | 通（单测） | `renderChoropleth.test.ts` |
| 4 | preflight / 层级 | 通（单测） | `geoMapDrill.test.ts` |
| 5 | 看板画布 | 通 | `DashboardWidget` 传 `drillEnabled` |

## 3. 子能力判定（修复前）

| ID | 子能力 | 判定 | 证据 |
|----|--------|------|------|
| T1 | 组件库·双击下钻 | **BROKEN** | `drillInteraction=false` |
| T2 | 组件库·返回/面包屑 | **BROKEN** | 无 chrome + 无栈 |
| T3 | 组件库·手动地区 | **PARTIAL** | picker 写 config，预览不跟栈 |
| T4 | 看板 map | **REAL**（CHAIN） | vitest + 既有实现 |
| T5 | Hub thumbnail | Out | — |

## 3b. 控件下钻表

| ID | 控件 | handler | 期望 | 修复前实际 | 判定 |
|----|------|---------|------|-----------|------|
| B1 | 地图 path·双击 | `renderChoropleth` → `handleDrillClick` | 下钻一级 | 无 `onPointClick` | BROKEN |
| B2 | 返回上一级 | `ChartDrillChrome.onBack` | 栈 pop | 组件不存在 | BROKEN |
| B3 | 面包屑「全部」 | `onNavigate(0)` | 全国 | 组件不存在 | BROKEN |
| B4 | 手动下钻 Select | `ChartMapRegionPicker` | 画布换层 | config 变、预览不变 | PARTIAL |
| B5 | 重置钻取 | `onReset` | 全国 | 组件不存在 | BROKEN |

## 3d. 覆盖矩阵

| 行 | 实体 | 深度 | 修复前 | 修复后目标 |
|----|------|------|--------|-----------|
| M1 | 组件库编辑·双击下钻 | UI+CHAIN | BROKEN | REAL |
| M2 | 组件库编辑·返回 | UI+CHAIN | BROKEN | REAL |
| M3 | 组件库编辑·面包屑 | UI | BROKEN | REAL |
| M4 | 组件库编辑·手动 picker | CHAIN | PARTIAL | REAL |
| M5 | 看板 map 下钻 | CHAIN | REAL | REAL |
| M6 | Hub thumbnail | Out | — | — |

**覆盖摘要（修复前）**：已验 1 / 必验 5；GATE-only 0；未验 4（M1–M4 UI 未通）。**逐一校验：否**（组件库 3 项 GATE 断链）。

## 4. 根因与修复

| 根因 | 修复 |
|------|------|
| `VizComponentLivePreview` 未传 `drillEnabled` | 地图类型传 `drillEnabled` |
| 无 `ChartDrillProvider` | 包裹 chart 预览 |
| 无 `onChartConfigChange` | 编辑页 `patchWidget` 同步 `manualDrillStack` |
| `EmbedChartPage` 同缺口 | P1 对齐 |

参照：`WidgetEnlargeDialog.tsx`（正确接线样板）。

## 5. 验证命令

```bash
cd fe
npx vitest run \
  src/components/dashboard/viz-components/VizComponentLivePreview.map-drill.test.tsx \
  src/components/charts/engine/d3/geo/renderChoropleth.test.ts \
  src/lib/geoMapDrill.test.ts \
  src/lib/geoMapDrill.pipeline.test.ts \
  src/components/charts/ChartDrillChrome.test.tsx \
  src/hooks/useGeoMapLevel.test.ts
```

## 6. 修复后判定

| 字段 | 值 |
|------|-----|
| 总体判定 | **REAL**（组件库 M1–M4；vitest 30/30 + 浏览器手验） |
| 总分 / 档位 | **8/10 · B** |
| 逐一校验 | **是**（5/5 必验行；Hub thumbnail Out） |

**浏览器手验**（2026-08-04，`/admin/viz-components/.../edit`，2D 区域地图 + v_sales_geo）：

| 步骤 | 期望 | 实际 |
|------|------|------|
| 手动选「广东省」 | 面包屑「全部 / 广东省」+ 市级地图 | 通过（`返回上一级`/`钻取路径` 可见） |
| 点击「返回上一级」 | 回全国、面包屑消失 | 通过 |
| vitest 回归 | 30/30 绿 | 通过 |

**覆盖摘要（修复后）**：已验 5 / 必验 5；GATE-only 0；未验 0（M6 Out）。**逐一校验：是**。
