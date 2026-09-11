# Feature Truth Audit: 2D 区域地图 · 高级 Tab（联动 / 跳转 / 气泡动效）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | `chartType=map` 高级 Tab 三块：**联动设置**、**跳转设置**、**气泡动效**；含配置持久化 + 查看态运行时 |
| 锚点 | `ChartAdvancedPanel` · `chartAdvancedSections` · `ChartRenderer` · `buildRenderConfig` · `renderChoropleth` · `DashboardEditPage` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6/10 · C** |
| 状态 | **approved-fix**（P0 联动 preview 断链已修） |
| sampling | **full**（§3d 必验 3 子能力 + §3b 全控件，无抽样） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 高级 Tab 可配置「联动」：启用 + 参数键 + 目标图；**查看态单击**省界 → 目标图 SQL `{{key}}` 注入维度值并刷新 | 对话「参考 DataEase」· DE 地图高级「联动设置」 |
| T2 | 高级 Tab 可配置「跳转」：启用 + URL/看板；**查看态单击**区域触发跳转；**优先于下钻**；下钻仍 **双击** | 对话 · `ChartAdvancedJumpSection` hint |
| T3 | 高级 Tab「气泡动效」：开关/颜色/速率/环数 → 画布水波渲染；改配置后无需切缩放才生效 | 前序会话验收 |
| T4 | 配置写入 `chartConfig.nativeBody` 并随看板保存 | VitalSpan 持久化惯例 |
| T5 | 对标 DE 高级其余项（如 **地名映射**） | DE 完整高级面板 |

**非目标（Out）**：`map-3d` 高级联动/跳转、`heatmap` 矩阵热力联动、在线底图、跳转 URL 携带点击维度 query（DE 部分场景有，本仓未声明）。

## 2. 完整链路图

```
ChartEditRail → ChartAdvancedPanel
  → patchChartDeFeatures(deFeatures.linkage|jump) / patchChartDeStyleNested(geo.bubble*)
  → DashboardEditPage 保存 chartConfig

查看态 DashboardEditPage(mode=view)
  → chartLinkageRuntime + handleChartLinkageClick
  → DashboardWidget → ChartRenderer
  → buildRenderConfig(Choropleth)
       onPointClick: jump | linkage（单击）
       onDrillClick: drill（双击）
  → renderChoropleth
  → jump: window.open / location.assign
  → linkage: setChartLinkageParams → buildWidgetFilterParams → useChartExecute 重查
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|-----|------|---------|------|
| 1 | Inspector UI 挂载 | **通** | `ChartAdvancedPanel.tsx:76–104` | map 三块 accordion 已注册 |
| 2 | 配置写入 | **通** | `chartAdvancedSections.tsx:408–470` · `patchChartDeFeatures` | linkage/jump 落 `deFeatures` |
| 3 | 跳转 runtime | **通（CHAIN）** | `ChartRenderer.tsx:466–473,697` · `buildRenderConfig.ts:117–126` | 单击 + 优先下钻 |
| 4 | 联动 runtime | **通（CHAIN，主路径）** | `DashboardEditPage.tsx:561–571` · `dashboardFilterUtils.ts:47–62` | 仅 **DashboardEditPage view/edit 画布** 接线 |
| 5 | 气泡 runtime | **通（CHAIN）** | `renderChoropleth.test.ts` · `geoRegionFillStyle.test.ts` | contentSig 含 bubble 字段 |
| 6 | 导出/大屏独立预览 | **通（2026-08-04 修复）** | `DashboardLayoutPreview` 内置 `useChartLinkageState` | 未传 prop 时自动启用 |
| 7 | 组件库独立预览 | **断（联动/跳转）** | `VizComponentLivePreview` 无 `onChartLinkageClick` | 配置可改，查看态不触发联动 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 联动设置 | **PARTIAL** | 6/C | 单元测 param 合并通过；无 E2E 证明目标图数据变化；无点击反馈 |
| T2 | 跳转设置 | **PARTIAL** | 7/B | 链路接线完整；无浏览器 L1；跳转 URL **不含**点击维度 |
| T3 | 气泡动效 | **REAL（CHAIN）** | 8/B | render + styleSig 单测通过；缺 UI 滑块集成测 |
| T4 | 配置持久化 | **PARTIAL** | 7/B | 写路径通；未验保存/刷新后回显（无 UI 测） |
| T5 | DE 完整对标 | **PARTIAL** | 7/B | **地名映射一期**：别名表 UI + join 链；自定义多省区域未做 |

## 3b. 前端控件下钻表（FE 全量）

功能块映射：T1→B1–B3；T2→B4–B8；T3→B9–B13。

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 启用联动 | `patchLinkage({enabled})` | 开关落库 | 写 `deFeatures.linkage` | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态读码 |
| B2 | 参数键 | `patchLinkage({parameterKey})` | 注入 SQL 键名 | 同上 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B3 | 目标图表 Checkbox | `toggleTarget` | 限定联动目标 | 写 `targetWidgetIds`；空=全部 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B4 | 启用跳转 | `patchJump({enabled})` | 开关落库 | 写 `deFeatures.jump` | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B5 | 跳转类型 | `patchJump({mode})` | url/dashboard | Select 接线 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 静态 |
| B6 | 链接地址 | `patchJump({url})` | 保存 URL | Input 接线 | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | 未验非法 URL |
| B7 | 目标看板 | `DashboardPickerField` | 保存 dashboardId | Picker 接线 | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | 未验打开正确页 |
| B8 | 新标签页 | `patchJump({openInNewTab})` | 控制打开方式 | Switch 接线 | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | 未浏览器验 |
| B9 | 气泡动效开关 | `patchGeo({bubbleEffect})` | 启停水波 | render 单测 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | vitest |
| B10 | 水波颜色 | `patchGeo({bubbleEffectColor})` | 环/点着色 | render 单测 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | vitest |
| B11 | 速率滑块 | `patchGeo({bubbleEffectSpeed})` | 动画速率变 | styleSig 变 | 2 | 1 | 2 | 1 | 2 | 8 | PARTIAL | 无动画帧断言 |
| B12 | 环数滑块 | `patchGeo({bubbleEffectRingCount})` | 环数量变 | styleSig 变 | 2 | 1 | 2 | 1 | 2 | 8 | PARTIAL | 无 DOM 计数断言 |
| B13 | 地图·单击（联动） | `onLinkageClick` | 目标图 refresh | 仅 DashboardEditPage 接线 | 2 | 1 | 1 | 1 | 1 | 6 | PARTIAL | 无 E2E |
| B14 | 地图·单击（跳转） | `onJumpClick` | 打开配置 URL | 静态 URL，无维度 | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | 无 browser |
| B15 | 地图·双击（下钻） | `onDrillClick` | 跳转开时仍可双击下钻 | 单测 split click/dblclick | 2 | 2 | 2 | 2 | 2 | 10 | REAL | `renderChoropleth.test.ts` |

**Out 控件**：动效类型「水波」为只读文案（无 handler）。

**打通但不对（L≥2 且 C≤1）**：B13（联动效果未端到端证明）。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| T1-linkage | 联动 runtime | ✅ Panel 挂载 | ✅ `buildWidgetFilterParams` 单测 | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `dashboardFilterUtils.test.ts` |
| T2-jump | 跳转 runtime | ✅ caps.jump(map) | ✅ render click split | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | `renderChoropleth.test.ts` |
| T3-bubble | 气泡动效 | ✅ Panel 挂载 | ✅ render + styleSig | ❌ | ❌ | CHAIN | 2 | 2 | REAL | vitest 34 passed |
| T4-persist | 配置持久化 | ✅ patch 路径 | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | 未验 save/reload |
| T5-de-alias | 地名映射 | ✅ Panel 挂载 | ✅ join + drill 单测 | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `chartGeoAreaMapping.ts` · vitest |
| P-export | 导出快照预览 | — | ❌ | ❌ | ❌ | NONE | 0 | 0 | BROKEN | 无 chartLinkage 接线 |
| P-datascreen | 大屏 Presenter | — | ❌ | ❌ | ❌ | NONE | 0 | 0 | BROKEN | 同上 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 7 |
| GATE only | 1（T4） |
| CHAIN | 3（T1–T3 主路径） |
| UI / BROWSER | 0 |
| NONE / 断链 | 2（P-export、P-datascreen） |
| REAL 达标 | 1/7（仅 T3-bubble CHAIN 维） |
| **逐一校验** | **否** — 已验 4/7 有 L1；0 项 BROWSER；3 项 NONE/断链 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL | 主路径 CHAIN 通，缺 E2E |
| T2 | 2 | 1 | 2 | 2 | 2 | 9 | B | PARTIAL | 静态 URL |
| T3 | 2 | 2 | 2 | 1 | 2 | 9 | B | REAL* | *仅 CHAIN 深度 |
| **总体** | 2 | 1 | 2 | 1 | 2 | **6** | **C** | **PARTIAL** | 取 T1 为 P0 下限 |

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `vitest` 地图高级相关 6 文件 | 全绿 | 34 tests passed | ✅ | 2026-08-04 命令输出 |
| 2 | 读码：`jumpInteraction` 优先级 | 跳转优先、双击下钻 | `activeDrillInteraction = drill && !jump` | ✅ | `ChartRenderer.tsx:473` |
| 3 | 读码：联动 param 合并 | w2 收到 region | `{ region: '广东省' }` | ✅ | `dashboardFilterUtils.test.ts` |
| 4 | 读码：导出页 | 联动可用或诚实 Out | 未传 chartLinkage | ❌ | `DashboardExportSnapshotPage.tsx:80` |
| 5 | 浏览器：看板 view 单击联动 | 目标图数据变 | **未执行** | — | UNVERIFIED |
| 6 | 浏览器：看板 view 单击跳转 | 新 tab 打开 URL | **未执行** | — | UNVERIFIED |

## 5. 修复文档（P0 / P1）

### T1 — 联动设置（P0）

**判定 / 得分**：PARTIAL 6/10（C=1）  
**期望 vs 实际**：单击省界 → 目标图 SQL 参数更新并刷新；实际链路在 `DashboardEditPage` 已接，但 **无 L1 证明目标图 execute 收到新 param**；**导出/大屏/组件库** 路径未接。  
**根因**：
- `DashboardLayoutPreview` / `DataScreenPresenter` 未接收 `chartLinkage` + `onChartLinkageClick`（`DashboardExportSnapshotPage.tsx:80`）
- `VizComponentLivePreview` 无联动回调  
**修复方向**：
1. 抽取 `useChartLinkageState()` hook，在 EditPage / LayoutPreview / DataScreenPresenter 复用  
2. 增加集成测：mock execute，断言 `filterParameters.region` 随点击变化  
3. 可选：单击高亮当前联动省界 + toast「已联动：广东省」  
**修后验收**：C≥2，B13 REAL，P-export 非 BROKEN  

### T2 — 跳转设置（P1）

**判定**：PARTIAL 7/10  
**期望 vs 实际**：单击跳转；实际 **静态 href**，不支持 `{{region}}` 或 query 携带点击值（DE 部分模板支持）。  
**修复方向**：`resolveChartJumpHref(jump, context?)` 支持占位符；browser smoke 1 条。  
**修后验收**：C≥2  

### T5 — 地名映射（P2 · DE 差距 · 一期已实现）

**判定**：PARTIAL 7/10（一期：业务值→标准地名别名表）  
**已实现**：`ChartGeoStyle.areaMapping` · `ChartAdvancedMapAreaMappingSection` · `resolveRegionMetricValue` / `joinOfflineMapFeatures` / `findMapDrillFilterValue` · `map` + `map-3d` 共用  
**仍未做（二期）**：自定义区域多省聚合（如「华东」）、与 CAT-003 目录打通、未匹配项一键导入  
**代码锚点**：`fe/src/lib/chartGeoAreaMapping.ts` · `fe/src/components/dashboard/chartAdvancedSections.tsx` · `fe/src/lib/geoMapChart.test.ts`

### T4 — 配置持久化（P1）

**判定**：GATE STUB  
**修复方向**：`ChartAdvancedPanel` smoke：patch → reload cfg JSON 断言 `deFeatures.linkage`  

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T1 | 联动 runtime 扩展到 LayoutPreview/DataScreen + 1 条 E2E execute 断言 |
| P1 | T2 | 跳转 browser smoke + 可选 URL 占位符 |
| P1 | T4 | 保存/回显集成测 |
| P2 | T5 | 地名映射二期（自定义多省区域） |
| P2 | T3 | 气泡速率/环数 DOM 断言 |

## 7. 交接

- 建议：`root-first-solve` 从 P0（联动 preview 路径 + E2E）起修  
- 用户批准修复：**否**

---

## 附：功能全吗？（对话直答）

| 对标 DE 高级（地图） | 状态 |
|---------------------|------|
| 联动设置 | **有 UI + 主看板 view 可用**；导出/大屏/组件库 **不可用** |
| 跳转设置 | **有 UI + 看板 view 单击可用**；URL 不带点击维度 |
| 气泡动效 | **可用**（CHAIN 已验） |
| 地名映射 | **一期已实现**（别名表；无自定义多省） |
| 下钻 vs 跳转优先级 | **已按 DE 文案实现**（单击跳转/联动，双击下钻） |

**结论**：不是「全不能用」，也 **不能称功能完整 / REAL**。当前档位 **PARTIAL · 6/10 · C**——配置层基本可用，运行时在 **看板查看态主路径** 可试；要宣称生产可用需补 P0 E2E 与 preview 断链。
