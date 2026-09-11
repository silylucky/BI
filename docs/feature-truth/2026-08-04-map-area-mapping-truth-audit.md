# Feature Truth Audit: 地图地名映射（一期）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | `ChartGeoStyle.areaMapping`：高级 Tab 编辑 · 持久化 · join/警告/联动下钻回传 · `map` + `map-3d` |
| 锚点 | `chartAdvancedSections.tsx` · `chartGeoAreaMapping.ts` · `geoMapChart.ts` · `buildRenderConfig.ts` · `D3GeoMapView.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **8/10 · B** |
| 状态 | approved-fix（P1 测试缺口已补） |
| sampling | **full**（5 子能力 + 5 控件，无抽样） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 高级 Tab「地名映射」可增删行；`from/to` 写入 `nativeBody.deStyle.geo.areaMapping` | 一期实施方案 §4 |
| T2 | 配置 `EAST_01→江苏省` 后，join 聚合到江苏省且 metric 正确着色 | 方案验收 #1 · `joinOfflineMapFeatures` |
| T3 | 部分行仍无法匹配时 overlay 提示「有 N 条无法匹配」；映射补全后 warning 消失 | 方案验收 #2 · `D3GeoMapView` |
| T4 | 联动/下钻单击省界时，注入 SQL 的参数为**原始业务值**（如 `EAST_01`） | 方案验收 #3 · `findMapDrillFilterValue` |
| T5 | `map-3d` 与 `map` 读同一 `geo.areaMapping`，3D join/热力锚点路径携带 lookup | 方案验收 #4 |

**非目标（Out）**：自定义多省区域（华东）、CAT-003 打通、未匹配一键导入、浏览器走查、看板 API 层变更。

## 2. 完整链路图

```
ChartAdvancedPanel (map | map-3d)
  → ChartAdvancedMapAreaMappingSection
  → patchChartDeStyleNested(cfg, "geo", { areaMapping })
  → DashboardEditPage 保存 chartConfig

运行时 ChartRenderer / D3GeoMapView
  → readChartGeoAreaMappingLookup(deStyle)
  → buildD3DispatchPayload → D3GeoRenderConfig.areaMapping
  → joinOfflineMapFeatures → resolveRegionMetricValue(applyAreaMapping)
  → analyzeMatch(areaMapping) → GeoMapOverlayHint
  → onPointClick/onDrillClick → findMapDrillFilterValue(..., areaMapping)
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|-----|------|---------|------|
| 1 | Inspector UI 挂载 | **通** | `ChartAdvancedPanel.tsx:81–90` | map + map-3d 均有 accordion |
| 2 | 配置 patch | **通** | `chartAdvancedMapAreaMapping.test.tsx` | 添加行落库 |
| 3 | Render 携带 lookup | **通** | `chartConfigContract.test.ts` | payload.areaMapping |
| 4 | Join 上色 | **通** | `geoProjection.test.ts` | 江苏省 value=120 |
| 5 | 解析/匹配统计 | **通** | `geoMapChart.test.ts` | matched 上升 |
| 6 | 点击回传原值 | **通** | `geoMapLevels.test.ts` | 江苏省→EAST_01 |
| 7 | 3D join / 热力 | **通（静态+2D 同链）** | `renderThreeChoropleth.ts:267` · `geo3dHeatSamples.ts` | 无 3D 专属 join 单测 |
| 8 | 匹配 overlay | **未动态验** | 读码 `D3GeoMapView.tsx:123–142` | 无 mapping 场景 vitest |
| 9 | 保存/刷新回显 | **未验** | — | 无 save→reload 集成测 |
| 10 | 浏览器编辑全流程 | **未验** | — | 无 BROWSER |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 配置 UI + patch | **REAL（CHAIN）** | 8/B | add/edit/delete + JSON round-trip 单测 |
| T2 | 运行时 join | **REAL（CHAIN）** | 8/B | join 单测 + resolve 单测 |
| T3 | 匹配警告 | **REAL（CHAIN）** | 8/B | `geoMapAreaMappingMatchWarning.test.ts` |
| T4 | 联动/下钻回传 | **REAL（CHAIN）** | 8/B | `findMapDrillFilterValue` 单测 |
| T5 | map-3d 共用 | **REAL（CHAIN）** | 8/B | `chartConfigContract` map-3d dispatch |

## 3b. 前端控件下钻表（FE 全量）

功能块映射：T1→B1–B5。

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 添加映射 | `addEntry` → `patchEntries` | 新增空行并 patch | onChange 收到 1 条 entry | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | vitest 添加 |
| B2 | 业务值 Input | `updateEntry({from})` | 改 from 落库 | 读码接线正确 | 2 | 1 | 1 | 2 | 2 | 8 | PARTIAL | 静态；无 L1 |
| B3 | 标准地名 Input | `updateEntry({to})` | 改 to 落库 | 读码 + datalist 省级建议 | 2 | 1 | 1 | 2 | 2 | 8 | PARTIAL | 静态 |
| B4 | 删除映射 | `removeEntry` | 行消失且 patch | 读码接线 | 1 | 1 | 1 | 2 | 2 | 7 | PARTIAL | 无单测 |
| B5 | 高级 Tab 挂载 | `ChartAdvancedPanel` | map/map-3d 见区块 | 条件分支 + badge 条数 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | capabilities.test |

**Out 控件**：datalist 选项（只读建议，无独立 handler）。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| T1-ui | 配置编辑 | ✅ Panel | ✅ add/edit/delete + JSON RT | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `chartAdvancedMapAreaMapping.test.tsx` · `chartGeoAreaMapping.persist.test.ts` |
| T2-join | join 上色 | ✅ types | ✅ join | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `geoProjection.test.ts` |
| T3-warn | 匹配 overlay | ✅ analyze wired | ✅ warning 逻辑 | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `geoMapAreaMappingMatchWarning.test.ts` |
| T4-drill | 点击回传 | ✅ buildRenderConfig | ✅ findMapDrill | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `geoMapLevels.test.ts` |
| T5-map3d | 3D 共用 | ✅ 同 geo 字段 | ✅ dispatch | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `chartConfigContract.test.ts` |
| P-save | 保存回显 | ✅ patch 路径 | ✅ JSON round-trip | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `chartGeoAreaMapping.persist.test.ts` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 6 |
| GATE only | 0 |
| CHAIN | 6 |
| UI / BROWSER | 0 |
| NONE（未验） | 0 |
| REAL 达标 | 6/6 |
| **逐一校验** | **是** |
| 总体可否 REAL | **否** — 缺 BROWSER；CHAIN 维 REAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 1 | 2 | 2 | 8 | B | PARTIAL | 缺 save/reload |
| T2 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL* | *CHAIN 深度 |
| T3 | 1 | 1 | 1 | 2 | 1 | 6 | C | STUB | 无 L1 |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL* | *CHAIN |
| T5 | 1 | 1 | 2 | 2 | 2 | 8 | B | PARTIAL | 3D 无 join 单测 |
| **总体** | 2 | 2 | 2 | 2 | 2 | **8** | **B** | **PARTIAL** | CHAIN 全绿；无 BROWSER |

**打通但不对**：无（C=0 项 0）  
**假功能**：T3-warn（GATE-only，overlay 未用 mapping 场景验）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `vitest` 7 文件 area-mapping 相关 | 全绿 | **61 passed** | ✅ | 2026-08-04 14:45 命令输出 |
| 2 | `joinOfflineMapFeatures(EAST_01→江苏省)` | 江苏省 value=120 | `jiangsu?.value).toBe(120)` | ✅ | `geoProjection.test.ts` |
| 3 | `findMapDrillFilterValue(江苏省)` | 回传 `EAST_01` | `.toBe("EAST_01")` | ✅ | `geoMapLevels.test.ts` |
| 4 | `buildD3DispatchPayload` map | lookup 含 EAST_01 | `.get("EAST_01")).toBe("江苏省")` | ✅ | `chartConfigContract.test.ts` |
| 5 | UI 点击「添加映射」 | patch areaMapping | onChange 1 entry | ✅ | `chartAdvancedMapAreaMapping.test.tsx` |
| 6 | 配置映射后 overlay warning 消失 | 无「N 条无法匹配」 | `resolveGeoMatchWarning` null | ✅ | `geoMapAreaMappingMatchWarning.test.ts` |
| 7 | JSON 序列化往返 | areaMapping 回显 | read 相等 | ✅ | `chartGeoAreaMapping.persist.test.ts` |
| 8 | 浏览器 map-3d 高级 Tab | 见「地名映射」 | **未执行** | — | UNVERIFIED |

## 5. 修复文档（2026-08-04 已闭合 P1）

以下项已通过新增单测闭合（**无业务代码变更**）：

| ID | 修复 | 证据 |
|----|------|------|
| T3 | overlay warning + mapping | `geoMapAreaMappingMatchWarning.test.ts` |
| P-save | JSON round-trip | `chartGeoAreaMapping.persist.test.ts` |
| B4 | 删除行 | `chartAdvancedMapAreaMapping.test.tsx` |
| T5 | map-3d dispatch | `chartConfigContract.test.ts` map-3d case |

**剩余可选（P2）**：浏览器走查高级 Tab；3D WebGL render 端到端目视。

## 6. 修复优先级汇总（历史）

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T3 | overlay warning 在 mapping 场景下的 vitest |
| P1 | P-save | chartConfig JSON 往返回显单测 |
| P2 | T5 | map-3d join 单测锚点 |
| P2 | B4 | 删除行 RTL 单测 |

## 7. 交接

- **结论（是否可用）**：**可用（PARTIAL · 8/10 · B · CHAIN REAL）** — 核心链路 + 持久化 + 警告逻辑均有 L1 单测；生产宣称前建议补 1 条浏览器走查。
- 用户批准修复：**是**（2026-08-04 测试补全）
