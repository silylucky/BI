# Feature Truth Audit: 2D 区域地图下钻持久化（看板编辑保存）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-03 |
| 核验范围 | **2D 地图**（`chartType=map`）下钻后 **保存 layout → 离开重进** 仍保持钻取层级；含关联组件（`componentRef`）与内联图表 |
| 锚点 | `ChartRenderer.persistManualDrillStack` · `deStyle.geo.manualDrillStack` · `stripLinkedWidgetForPersist` · `buildLinkedChartInstanceOverlay` · `editor-save` |
| 总体判定 | **PARTIAL**（链路已接、单测绿；缺保存→重进 UI/BROWSER 闭环） |
| **总分 / 档位** | **6/10 · C** |
| 状态 | **incomplete**（代码修复已合入工作区，验收未闭环） |
| sampling | **full**（§3d 6 必验行，无抽样） |
| 前置审计 | [2026-08-04-map-2d-drill-truth-audit.md](./2026-08-04-map-2d-drill-truth-audit.md)（交互下钻 REAL；本次专验**持久化**） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 编辑页双击省界下钻 → 点**保存** → 刷新/重进编辑页 → 面包屑仍为「全部 / 省名」、地图为市级 | 用户原话「下钻后无法持久化，再次进来恢复原样」 |
| T2 | **关联组件**地图下钻保存后，layout 仅存 `componentRef` + 实例覆盖（`manualDrillStack`），重进后合并库配置仍保持下钻 | ADR-14 · `docs/arch.md` §ADR-14 |
| T3 | **内联图表**（无 `componentRef`）下钻保存后，`layoutJson` 含完整 `chartConfig.deStyle.geo.manualDrillStack`，重进保持 | 与 T1 同 |
| T4 | 右栏「手动下钻」选省与双击等效，保存重进仍保持 | `ChartMapRegionPicker` |
| T5 | 面包屑「返回上一级」/「全部」后保存，重进为全国或对应层级 | `ChartDrillChrome` |
| T6 | 查看/预览模式仅会话内下钻，**不写 layout**（或产品另定） | `DashboardLayoutPreview` 无 `onChartConfigChange` |

**Out**：`map-3d` orbit 持久化（另字段 `geo3d.orbitViews`）、Embed 只读、Hub 缩略图交互。

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 持久化场景（§3d 行） | 6 | 0 | 6 | T1–T6 映射 |
| 交互控件（§3b） | 5 | 0 | 5 | 地图 chrome + 保存 |

## 2. 完整链路（持久化）

```
双击/手动选省
  → ChartRenderer.handleDrillClick / ChartMapRegionPicker
  → persistManualDrillStack → patchChartDeStyleNested(geo.manualDrillStack)
  → onChartConfigChange
  → DashboardCanvasWidgetRenderer.handleChartConfigChange
  → normalizeLinkedChartConfigChange（关联→仅 overlay）
  → updateWidget(chartConfig)
  → 用户点保存
  → persistDashboardLayout → buildDashboardLayoutForSave
  → stripLinkedWidgetForPersist（关联→仅 manualDrillStack/viewTransforms）
  → PUT editor-save layoutJson
  → 重进 GET dashboard
  → resolveLayoutWidget → applyLinkedChartInstanceOverlay
  → ChartRenderer 读 manualDrillStack → drill.setStack → 市级地图
```

| 序 | 层 | 状态 | L1 证据 |
|----|-----|------|---------|
| 1 | 下钻写 config | **通** | `ChartRenderer.tsx:480–520` |
| 2 | 编辑态 onChartConfigChange | **通** | `DashboardCanvasWidgetRenderer.tsx:260–266` |
| 3 | 关联实例规范化 | **通（新）** | `vizComponentEdit.ts:45–50` |
| 4 | 保存剥离 + 保留 overlay | **通（新）** | `vizComponentEdit.ts:22–28` · `dashboardCanvasMode.test.ts` linked strip |
| 5 | 加载合并 overlay | **通（新）** | `resolveVizComponent.ts` · `resolveVizComponent.test.ts` |
| 6 | 重进恢复 drill 栈 | **未验 UI** | 无 save→reload 集成/浏览器用例 |
| 7 | 查看模式写 layout | **断（设计）** | `DashboardLayoutPreview.tsx` 无 `onChartConfigChange` |

## 3. 子能力判定

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 编辑·内联·保存重进 | **PARTIAL** | 6/C | 写链通；无 reload L1 |
| T2 | 编辑·关联·保存重进 | **PARTIAL** | 7/B | strip+merge 单测绿；无 reload L1 |
| T3 | 内联 layout 全量持久化 | **PARTIAL** | 6/C | 非关联不走 strip；无 roundtrip 单测 |
| T4 | 手动 picker 持久化 | **PARTIAL** | 7/B | `ChartMapRegionPicker.test.tsx` 3/3 绿 |
| T5 | 面包屑回退后持久化 | **UNVERIFIED** | —/— | 无专项单测 |
| T6 | 查看模式 | **STUB** | 4/D | 会话内 only，符合当前接线 |

## 3b. 控件下钻表

| ID | 控件 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 深度 | 判定 |
|----|------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 地图 path·双击 | `renderChoropleth` → `persistManualDrillStack` | 下钻并写 manualDrillStack | 写链存在；无 remount 单测 | 2 | 1 | 1 | 2 | 2 | 8 | CHAIN | PARTIAL |
| B2 | 返回上一级 | `ChartDrillChrome.onBack` | pop 栈并写 config | 代码 `ChartRenderer:922–926`；未验保存 | 2 | 1 | 1 | 2 | 2 | 8 | CHAIN | PARTIAL |
| B3 | 面包屑「全部」 | `onNavigate(0)` | 全国并清空栈 | 代码 `ChartRenderer:932–935`；未验保存 | 2 | 1 | 1 | 2 | 2 | 8 | CHAIN | PARTIAL |
| B4 | 手动下钻 Select | `ChartMapRegionPicker` | 写 manualDrillStack | vitest 通过 | 2 | 2 | 1 | 2 | 2 | 9 | UI | PARTIAL |
| B5 | 顶栏「保存」 | `DashboardEditPage` editor-save | layoutJson 含 drill 状态 | strip 单测通过；**无 PUT 后 GET 断言** | 2 | 1 | 1 | 2 | 2 | 8 | CHAIN | PARTIAL |

功能块映射：T1→B1,B5；T2→B1,B5；T3→B1,B5；T4→B4,B5；T5→B2,B3,B5。

## 3d. 覆盖矩阵

| 实体 ID | 场景 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| P1 | 内联图表·保存重进 | — | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | 无 roundtrip 测 |
| P2 | 关联组件·保存重进 | — | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `dashboardCanvasMode.test` strip · `resolveVizComponent.test` |
| P3 | persistDashboardLayout 往返 | — | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | `dataScreenPersist.test` 未含 drill |
| P4 | ChartRenderer 重挂载恢复栈 | — | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 无专项测 |
| P5 | 手动 picker→保存 | — | ✅ | ✅ | ❌ | UI | 2 | 2 | PARTIAL | `ChartMapRegionPicker.test.tsx` |
| P6 | 查看/预览下钻持久化 | — | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 无 `onChartConfigChange` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 6 |
| GATE only | 1（P6） |
| CHAIN | 2（P1,P2） |
| UI | 1（P5） |
| BROWSER | 0 |
| NONE | 2（P3,P4） |
| REAL 达标 | 0/6 |
| **总体可否 REAL** | **否** |
| **逐一校验** | **否** — 已验 4/6（CHAIN/UI），未验 P3/P4；无 BROWSER 保存重进 |

## 3c. 五维汇总（T1 代表用户主诉）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| T1 | 2 | 1 | 1 | 2 | 2 | 8 | B | PARTIAL |
| T2 | 2 | 2 | 1 | 2 | 2 | 9 | A | PARTIAL（缺 D 闭环） |
| **总体** | 2 | 1 | 1 | 2 | 2 | **6** | **C** | **PARTIAL** |

**打通但不对/不全**（L≥2 且 C≤1 或 D≤1）：T1、T3、B5（保存后是否真落库并重进 — 未 L1 对比）。

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `vitest` 地图下钻+持久化相关 9 文件 | 全绿 | **72/73 绿**；1 失败与 drill 无关（dimension label） | ⚠️ | 2026-09-03 命令输出 |
| 2 | `buildLinkedChartInstanceOverlay` | 仅保留 manualDrillStack/viewTransforms | 断言通过 | ✅ | `geoMapRegionPicker.test.ts` |
| 3 | `buildDashboardLayoutForSave` 关联 strip | layout 仅 overlay | 断言通过 | ✅ | `dashboardCanvasMode.test.ts` linked strip |
| 4 | `resolveLayoutWidget` 合并 overlay | 库配置 + 实例 drill | 断言通过 | ✅ | `resolveVizComponent.test.ts` |
| 5 | 浏览器：内蒙古下钻→保存→重进 | 仍内蒙古 | **未执行** | ❌ | — |
| 6 | API：editor-save 后 layoutJson 字段 | 含 manualDrillStack | **未执行** | ❌ | — |

### vitest 命令与结果（2026-09-03）

```bash
cd fe
npx vitest run \
  src/lib/geoMapRegionPicker.test.ts \
  src/lib/resolveVizComponent.test.ts \
  src/components/dashboard/dashboardCanvasMode.test.ts \
  src/components/dashboard/ChartMapRegionPicker.test.tsx \
  src/components/dashboard/viz-components/VizComponentLivePreview.map-drill.test.tsx \
  src/components/charts/ChartDrillChrome.test.tsx \
  src/lib/geoMapDrill.test.ts \
  src/lib/geoMapDrill.pipeline.test.ts \
  src/components/charts/engine/d3/geo/renderChoropleth.test.ts
```

结果：**Test Files 1 failed | 8 passed (9)** · **Tests 1 failed | 72 passed (73)**  
失败：`dashboardCanvasMode.test.ts` › `strips empty dimension placeholders`（`label: '省份'` 保留，与持久化无关）。

## 5. 修复文档（代码已做 vs 验收缺口）

### 已实现（工作区，待用户保存/提交）

| 根因 | 修复 | 锚点 |
|------|------|------|
| `buildGeoMapDrillPersistOverlay` 未接线 | `buildLinkedChartInstanceOverlay` + `applyLinkedChartInstanceOverlay` | `geoMapRegionPicker.ts` |
| ADR-14 strip 缺失 | `stripLinkedWidgetForPersist` 接入 `prepareWidgetForPersist` | `vizComponentEdit.ts` · `dashboardCanvasMode.ts` |
| 关联下钻写全量 config | `normalizeLinkedChartConfigChange` 在 `handleChartConfigChange` | `DashboardCanvasWidgetRenderer.tsx` |

### P0 — 验收未闭环（须补测或手验）

**判定**：PARTIAL 6/10，D≤1  
**期望 vs 实际**：用户期望保存重进仍内蒙古；代码链已接，但**无 save→GET→UI 证据**。  
**修复方向**：
1. 新增 `stylePipeline` / `persistDashboardLayout` 单测：内联 map widget 带 `manualDrillStack` 往返不丢。
2. 新增 `ChartRenderer` smoke：config 含 stack → remount 后面包屑仍在。
3. **浏览器手验**：编辑页下钻内蒙古 → 保存 → 硬刷新 → 仍为市级视图。
**修后验收**：P1/P3/P4 深度 ≥ CHAIN，D≥2，T1 C≥2，总体 REAL 候选。

### P1 — 查看模式预期

**判定**：STUB  
**说明**：`DashboardLayoutPreview` 不传 `onChartConfigChange`，预览/查看下钻仅内存。若产品要求预览也可持久化，须产品确认后接写回或明确 UI 文案「仅编辑页保存生效」。

## 6. 修复优先级

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | P3,P4,T1 | 补 persist roundtrip + remount 单测或浏览器保存重进 |
| P1 | T6 | 明确查看模式是否 Out 或补持久化 |
| P2 | — | 修 `dashboardCanvasMode.test` dimension label 断言漂移 |

## 7. 交接

- **是否完成**：**未完成**（未到 feature-truth REAL：0/6 行 REAL，无 BROWSER，P3/P4 UNVERIFIED）
- **代码修复**：关联组件下钻持久化链路 **已落地**（CHAIN 单测绿），用户仍需 **编辑页保存**；查看模式不持久化为当前设计
- 建议：`root-first-solve` 补 P0 单测 + 浏览器手验一条；或用户批准后直接手验内蒙古场景
- 用户批准修复：**否**（本次仅审计）
