# Feature Truth Audit: 3D/2D 地图「应对上数据」的特效与维度绑定

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | `map` / `map-3d` 中**应绑定数据集维度/指标**的渲染与特效；并核验**纯装饰特效**是否误绑数据 |
| 锚点 | `renderThreeChoropleth.ts` · `renderChoropleth.ts` · `geo3dHeatSamples.ts` · `OfflineGeoPort.joinMapRows` · `D3GeoMapView` · `geoMapDrill.ts` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.5/10 · C** |
| 状态 | draft |
| **sampling** | `full`（枚举 scope 内全部实体，无抽样） |

## 1. 核验标准与预期（来自用户对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | **区域着色/3D 顶面明暗**应反映当前层级维度 + 指标的聚合值 | 用户问「特效和数据是否对上了」 |
| T2 | **3D 热力光斑（heat blob）**落点与数值应来自同一 `regionField` + `metricField`（含 `areaMapping`） | 同上 + `buildHeatBlobSamplesForMap` 设计 |
| T3 | **下钻到市/县**后，join 字段应切换为 `city`/`district`，着色与 tooltip 显示市级/县级聚合 | 下钻无波纹对话 + `geoMapDrill.ts` |
| T4 | **底座平台波纹/网格/扫光、云层、地形贴图**仅为视觉装饰，**不**随业务维度变化 | 架构预期（避免假通） |
| T5 | **2D 气泡水波**仅在有数据且 `value>0` 的区域出现 | `geoMapBubbleRippleLayer.ts` |
| T6 | 钻取槽误绑非地理字段（如 `product_name`）时，系统应诚实暴露「对不上」而非静默假通 | 用户广东下钻体验 |

- 非目标：全 44 图表类型；样式面板每个 slider；浏览器全像素截图对比。

## 2. 完整链路图

```
数据集 execute → rows/columns
  → ChartRenderer drillPipeline (displayField 随 stack 切换)
  → buildChartViewModel → D3GeoMapView contentKey 变更 → 整图重建
  → buildD3DispatchPayload (regionField, metricField, areaMapping, drillDepth)
  → joinOfflineMapFeatures → features[].value
  → [3D] cap color/valueT + tooltip + heatBlobSamples
  → [2D] path fill + mountGeoMapBubbleRippleLayer (value>0)
  → [装饰] platformEffects / sceneClouds / terrain（不读 rows）
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|-----|------|---------|------|
| 1 | 数据 execute | 通 | `v_sales_geo` 含 province/city/district | 非仅省层 |
| 2 | 钻取 displayField | 条件通 | `geoMapDrill.pipeline.test.ts` | 依赖钻取槽字段正确 |
| 3 | join 聚合 | 通 | `OfflineGeoPort.joinMapRows` + contract 测试 | 与 2D 共用 |
| 4 | 3D choropleth 着色 | 通（CHAIN） | `renderThreeChoropleth.ts:458-509` | value→colorForValue |
| 5 | 3D heat blob | 通（CHAIN） | `geo3dHeatSamples.test.ts` 5 passed | 缺 areaMapping 用例 |
| 6 | 3D 平台波纹等 | 通（装饰） | `geo3dPlatformEffects.test.ts` | 不读 regionField |
| 7 | 2D 水波 | 通（CHAIN） | `geoMapBubbleRippleLayer.ts:62` | value>0 过滤 |
| 8 | 错误钻取配置 | **假通** | `getMapDrillDisplayField` + 对话复现 | 市图 + product_name join |
| 9 | areaMapping 变更重绘 | 通 | `geoMapContentKey` + `areaMappingSig` | 会话内已修 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 区域着色/valueT | PARTIAL | 7/B | CHAIN 已验；错误钻取配置时全平 |
| T2 | 3D heat blob | PARTIAL | 7/B | 单测覆盖坐标/锚点；无 areaMapping 集成测 |
| T3 | 下钻字段对齐 | PARTIAL | 5/C | 正确槽位时 pipeline 测试通过；误绑无 UI 拦截 |
| T4 | 装饰特效不绑数据 | REAL | 9/A | 平台/云/地形无 rows 入参 |
| T5 | 2D 水波 | PARTIAL | 7/B | 逻辑正确；误钻取 + value=0 时无波纹 |
| T6 | 误配钻取诚实性 | PARTIAL | 4/D | 无警告；地图像「没数据」 |

## 3b. 前端控件下钻表（FE）

本 scope **不验** Inspector 每个按钮；仅验渲染结果与数据维度关系。

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 地图 tooltip | `renderThreeChoropleth` hover | 显示 metric 聚合值 | CHAIN 与 join 同源 | 2 | 2 | 2 | 1 | 2 | 9 | REAL | 代码路径一致；未浏览器点验 |
| B2 | 钻取槽拖入字段 | `writeAxisField drill` | 市/县字段→下钻 join 正确 | 非地理字段→join 失败 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 无字段类型校验 |

Out 控件：地名映射属性输入、3D 预设下拉、气泡动效开关（属配置，非本 scope 逐按钮）。

功能块映射：T1→B1；T3/T6→B2。

## 3d. 覆盖矩阵（枚举 scope 必填）

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| E-3D-CHORO | 3D 顶面着色/valueT | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `joinOfflineMapFeatures` → `colorForValue` |
| E-3D-TOOLTIP | 3D tooltip 数值 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `userData.value` 来自 join |
| E-3D-HEATBLOB | 3D heat blob | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `geo3dHeatSamples.test.ts`；无 areaMapping 测 |
| E-3D-VISMAP | 3D 图例 min/max | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `minVal/maxVal` 来自 features |
| E-3D-DRILL | 下钻 displayField | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `geoMapDrill.pipeline.test.ts`；误绑未拦 |
| E-3D-PLATFORM | 底座波纹/网格等 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | **预期不绑数据**；`geo3dPlatformEffects.test.ts` |
| E-3D-CLOUDS | 场景云 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | **预期不绑数据** |
| E-3D-TERRAIN | 地形贴图 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | **预期不绑数据** |
| E-2D-CHORO | 2D 区域填色 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 与 3D 同源 join |
| E-2D-RIPPLE | 2D 气泡水波 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `value>0` 过滤；非 3D 底座波纹 |
| E-AREAMAP | areaMapping→payload | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `chartConfigContract.test.ts` map-3d |
| E-DRILL-MIS | 钻取误绑 product_name | ✅ | ✅ | ❌ | CHAIN | 2 | 0 | PARTIAL | 市图仍画，join 用错列 |
| E-PATCH-STYLE | patchGeo3dStyle 仅样式 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | **预期**不重算 rows；`geo3dStylePatch.test.ts` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 12 |
| GATE only | 0 |
| CHAIN | 12 |
| UI / BROWSER | 0 |
| NONE（未验） | 0 |
| REAL 达标 | 8 / 12 |
| **逐一校验** | **是** — 12 行均有 CHAIN 代码/测试证据 |
| 总体可否 REAL | **否** — E-3D-HEATBLOB、E-3D-DRILL、E-DRILL-MIS 为 PARTIAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 1 | 2 | 9 | A | REAL | 正确配置下着色对齐 |
| T2 | 2 | 1 | 2 | 1 | 2 | 8 | B | PARTIAL | 缺 areaMapping 热测 |
| T3 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL | 误绑钻取字段 |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 装饰不绑数据（符合预期） |
| T5 | 2 | 2 | 2 | 1 | 2 | 9 | A | REAL | value>0 规则 |
| T6 | 2 | 0 | 1 | 1 | 1 | 5 | C | PARTIAL | 静默假通感 |

**打通但不对**（L≥2 且 C≤1）：T3、T6（钻取槽误绑非地理维度）  
**假功能**：无（STUB/BROKEN 无）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest` 7 文件 map-3d/drill/join | 全绿 | 54 tests passed | ✅ | 命令输出 17:07 |
| 2 | `geo3dHeatSamples` 市字段锚点 | city→锚点→value | 2 samples 100/200 | ✅ | test L39-58 |
| 3 | `chartConfigContract` map-3d areaMapping | payload 带 lookup | `EAST_01→江苏省` | ✅ | test L479-518 |
| 4 | `geoMapDrill.pipeline` 广东下钻 | displayField=city | pipeline 通过 | ✅ | test 3 passed |
| 5 | 逻辑推演：钻取=product_name + 市图 | join 失败/全 0 | `chain[1]=product_name` | ✅ | `geoMapDrill.ts:54` |
| 6 | 平台波纹 layer | 不读 rows | 仅 layout+style | ✅ | `geo3dPlatformEffects.test.ts` |
| 7 | 惠州 tooltip | 示例库无销售 | amount=0 | ✅ | `tables.sql` 仅广深 |

## 5. 修复文档

### T3 / T6 — 钻取槽误绑非地理字段

**判定 / 得分**：PARTIAL 5/10（C=0 于误配场景）  
**期望 vs 实际**：下钻到市级地图时，join 应使用 `city`；用户绑 `product_name` 时应有警告或禁用下钻。实际：地图切到市界，但 `getMapDrillDisplayField` 取 `chain[1]=product_name`，join 对不上市名 → 着色平、tooltip 0、无 heat blob/水波。  
**下钻链**：`resolveGeoDrillChain` → `getMapDrillDisplayField` → `joinOfflineMapFeatures`  
**根因**：`fe/src/lib/geoMapDrill.ts:47-55` 用地理层级 index 索引用户维度链，未校验 drill 槽必须为地理字段。  
**修复方向**（P1）：钻取槽仅允许地理字段；或下钻时强制 `GEO_DRILL_LEVEL_FIELDS[index]` 覆盖非地理槽；误配时 Inspector 警告。  
**修后验收**：误绑 `product_name` 时 C≥2（明确提示或自动回退 city 列），总分≥8。

### T2 — 3D heat blob + areaMapping

**判定**：PARTIAL 8/10（C=1）  
**期望 vs 实际**：`areaMapping` 改变热力落点应与 choropleth 一致。代码已传 `areaMapping` 入 `buildHeatBlobSamplesForMap`，但**无单测**覆盖 `EAST_01→省锚点`。  
**根因**：测试缺口，非已知生产 bug。  
**修复方向**（P2）：`geo3dHeatSamples.test.ts` 增加 areaMapping 用例。  
**修后验收**：C≥2，单测绿。

### 用户感知 — 底座波纹误导

**判定**：PARTIAL（反馈维 F=1）  
**期望 vs 实际**：用户易把底座波纹当作「有数据的波纹」。实际：平台特效恒动，与维度无关。  
**修复方向**（P2）：帮助文案区分「底座装饰」与「数据热力/水波」；或误配数据时顶部黄条提示。  
**修后验收**：E≥2。

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T3/T6/E-DRILL-MIS | 钻取槽误绑非地理字段时 join 失败但无诚实提示 |
| P2 | T2/E-3D-HEATBLOB | heat blob + areaMapping 缺集成单测 |
| P2 | T4 感知 | 底座波纹易误解为数据特效 |

## 7. 交接

- 建议：批准修 P1（钻取字段校验/警告）→ `root-first-solve`；P2 可随地图 Inspector 迭代。
- 用户即时操作（无需改代码）：`v_sales_geo` 下钻时钻取槽绑 `city`、`district`；指标 `amount`；地区维度省级用 `province`。

## 8. 结论摘要（给用户）

| 应对上数据的特效 | 是否真对上 | 条件 |
|------------------|------------|------|
| 3D 区域顶面颜色/明暗 | ✅ CHAIN 已验 | `regionField`+`metricField` 正确；钻取层级字段匹配 |
| 3D tooltip 数值 | ✅ | 同上 |
| 3D heat blob 光斑 | ⚠️ 大部分对上 | 同上；`areaMapping` 代码已接，缺单测 |
| 2D 区域填色 | ✅ | 与 3D 同源 join |
| 2D 气泡水波 | ✅ | 仅 `value>0`；需开气泡动效 |
| 底座平台波纹/网格/扫光 | ✅ **故意不对数据** | 纯装饰，易误解 |
| 云层 / 地形 | ✅ **故意不对数据** | 纯装饰 |

**不是「数据只有省层」**：`v_sales_geo` 有省/市/区县；下钻后若钻取槽不是 `city`/`district`，会出现「地图是市级、数据还在用错列」→ 看起来像特效没对上。
