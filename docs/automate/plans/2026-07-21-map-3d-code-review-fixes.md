# 实施计划：map-3d Code Review 修复闭环

> **Plan type**: Headless Automation Plan  
> **Cursor Build**: disabled  
> **Execution trigger**: dev-autopilot A5 plan-execute  
> **状态**：**DONE**（2026-07-21 plan-review PASS → 执行闭环）  
> **来源**: Code Review 2026-07-21（P0-1 静默 WebGL 降级 + P1 Inspector/测试/catalog 漂移）  
> **关联**: `map-3d` 实现 · [`2026-07-21-chart-per-type-verification.md`](./2026-07-21-chart-per-type-verification.md)

## 背景与目标

**问题描述**：`map-3d`（3D 区域地图）已在 Picker 登记并对外宣称「可拖拽旋转视角」，但 WebGL 不可用时**静默**回退为 2D choropleth，测试与 `data-testid` 仍报「3D 已渲染」；Inspector 部分开关（数值色带、标签）在 Three 路径未接线。

**成功标准**：

1. 用户选择 `map-3d` 后，若实际渲染非 Three.js，界面**必须**出现可见说明（`role="status"` 横幅），且 DOM 带 `data-render-engine="d3-fallback"`。
2. WebGL 可用时，`data-render-engine="three"` 且容器内存在 WebGL `<canvas>`。
3. Inspector「数值色带」在 3D 路径与 2D 行为一致（可开关）；「标签」分区对 `map-3d` 不展示死配置。
4. `pnpm run test:chart-catalog` 全绿；新增/更新用例能区分 `three` vs `d3-fallback`（jsdom 下 mock WebGL 或断言 `data-render-engine`）。
5. 后端 catalog `map-3d` 的 `library` 与 FE 一致；`chart-per-type-verification.md` §4.8 补 `map-3d` 行。

**非目标（本次不做）**：

- 3D 地图区域名称标签挤出（2D `showRegionLabel` 能力不移植到 Three）。
- 在线地图 / 境外 GeoJSON（违反 GEO-IRON-01）。
- Playwright 真机 WebGL 截图基线（CI 无 GPU 时仅做路由 smoke + `data-render-engine` 断言）。
- 撤掉 `map-3d` 类型或改为「实验性」灰显（采用诚实降级而非隐藏入口）。

## 整体方案

引入 **GeoMap 渲染结果契约**（`engine` + 可选 `fallbackReason`），由 `renderThreeChoroplethChart` 返回，`D3GeoMapView` 据此展示横幅与 `data-render-engine`。静默 `catch` 改为记录原因并走同一降级路径。Three 路径补齐 **visualMap 色带**（DOM overlay，复用 D3 色阶算法）。Inspector 通过 `inspectorCapabilityMatrix` + `chartStylePanelGates` 对 `map-3d` 隐藏标签分区。测试层用 **WebGL mock** 或 **engine 属性断言** 消除假绿。catalog 元数据与验收文档同步。

## 关键决策

| 决策点 | 选择 | 备选项 | 理由 |
|--------|------|--------|------|
| WebGL 不可用策略 | **诚实降级 + 横幅** | A) 禁止渲染仅报错 B) 静默 2D | A 政企场景可用性差；B 为当前 P0 假绿；降级+说明兼顾可用与诚实 |
| 渲染结果传递 | **`GeoMapRenderResult` 返回值** | 全局事件 / container dataset 写入 | 返回值类型安全、易单测；dataset 作 DOM 镜像 |
| visualMap 3D 实现 | **DOM overlay 色带**（absolute 底部） | 隐藏 Inspector 开关 / Three CSS2D | 与 2D 语义一致、改动可控；隐藏开关是退而求其次 |
| Three 包加载 | **动态 import**（`map-3d` 首次渲染时） | 保持静态 import | 仅 3D 地图用户承担 ~500KB；符合 NFR 包体纪律 |
| 文件体量 | **拆分为 `geoToThreeShapes.ts` + `renderThreeChoropleth.ts`** | 单文件 311 行 | 满足 `fe-ui.mdc` ≤300 行业务文件软上限 |
| BE library | **`library="d3"`**（与 FE metadata 对齐） | 新增 `three` 枚举 | 最小 diff；实际引擎由 FE plugin 路由，BE 仅 catalog 展示 |

## 假设与依赖

- 继续遵守 GEO-IRON-01：仅 `OfflineGeoPort` / `china-provinces.json`。
- `three@0.185` 已安装；OrbitControls 路径 `three/addons/controls/OrbitControls.js` 不变。
- 验收命令：`cd fe && pnpm run test:chart-catalog`；可选 `pytest tests/test_viz_chart_catalog_parity.py -q`。
- 用户已接受「无 WebGL 时仍可看 2D 地图」，但必须知情。

## 风险与回退

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 动态 import 导致首帧闪烁 | 中 | 体验 | `map-3d` 容器先显示 loading 文案；import 完成再 mount |
| jsdom WebGL mock 与真机行为不一致 | 中 | 测试假绿 | 补充 Playwright 路由 smoke（仅断言 engine 属性，不强求截图） |
| visualMap overlay 与 OrbitControls 层级冲突 | 低 | 色带被挡 | `pointer-events: none` + 固定 z-index |
| 拆文件引入循环依赖 | 低 | 构建失败 | `geoToThreeShapes` 仅依赖 d3/three 类型，不引 renderChoropleth |

**回退**：若 Three 路径回归严重，可临时在 Picker 隐藏 `map-3d`（`deprecated` + `migratesTo: map`），但**不得**保留静默降级。

---

## 改动清单

### T1 · 渲染结果契约（P0 核心）

| 项 | 内容 |
|----|------|
| **位置** | 新建 `fe/src/components/charts/engine/geo/geoMapRenderResult.ts`；改 `renderThreeChoropleth.ts`、`D3GeoMapView.tsx` |
| **改动** | 定义 `export type GeoMapRenderEngine = "three" \| "d3-fallback"`；`GeoMapRenderResult = { dispose: () => void; engine: GeoMapRenderEngine; fallbackReason?: string }`。`renderThreeChoroplethChart` 返回该类型；`webglAvailable()===false` 或 catch 时 `engine: "d3-fallback"` + `fallbackReason`（如 `webgl-unavailable` / `three-init-failed`）。`D3GeoMapView`：`useState` 存 `renderEngine`/`fallbackReason`；容器设 `data-render-engine`；`fallbackReason` 时展示横幅：「当前环境不支持 WebGL，已显示 2D 区域地图」。`setRenderError(null)` 仅在 `engine==="three"` 或用户已知降级时 |
| **目标** | P0-1 消除静默假绿 |
| **验证** | 单测：mock `webglAvailable→false` 断言 `engine==="d3-fallback"`；Vitest 渲染 `map-3d` 断言横幅文案存在 |

### T2 · 拆分 Three 模块 + 懒加载（P2 工程债，与 T1 同 PR）

| 项 | 内容 |
|----|------|
| **位置** | `fe/src/components/charts/engine/three/geoToThreeShapes.ts`（`geometryToShapes`、`webglAvailable`、`geoSurfaceColors`）；`renderThreeChoropleth.ts`（≤200 行）；`D3GeoMapView.tsx` 内 `import()` |
| **改动** | `measureAndRender` 对 `map-3d`：`await import("@/components/charts/engine/three/renderThreeChoropleth")` 后再调用；加载中显示「正在加载 3D 地图…」 |
| **目标** | 包体与文件体量 |
| **验证** | `pnpm run build` 通过；chunk 分析 optional（`dist/assets` 含独立 three chunk） |

### T3 · Three 路径 visualMap（P1-1）

| 项 | 内容 |
|----|------|
| **位置** | `renderThreeChoropleth.ts` 或 `threeGeoVisualMap.ts` |
| **改动** | 读取 `geoStyle.visualMap !== false`（与 2D 一致）；在 container 内 append 绝对定位 div：CSS `linear-gradient` 色带 + min/max 文案（复用 `formatGeoTooltipValue` / 与 `renderChoropleth` 同色阶 `colorForValue`） |
| **目标** | Inspector「数值色带」真接线 |
| **验证** | 手动：开关 visualMap 色带显隐；单测可选 snapshot DOM |

### T4 · Inspector 能力矩阵与门控（P1-2）

| 项 | 内容 |
|----|------|
| **位置** | `inspectorCapabilityMatrix.ts`；`chartStylePanelGates.ts` 或 `chartStyleSectionRegistry.ts` |
| **改动** | 登记 `"map-3d": { legend: "missing", label: "missing", dataZoom: "missing", markLines: "missing", conditional: "missing" }`（与 Three 实测一致；roam 走 geo 面板非 matrix）。确保 `chartStyleSectionsForType("map-3d")` 不含 `label`（或 gates 返回 false） |
| **目标** | 消除标签死配置 |
| **验证** | `inspectorCapabilityMatrix.test.ts` 增 `map-3d` 行；`chartStyleSectionRegistry.test.ts` 断言无 `label` |

### T5 · 测试假绿修复（P1-3）

| 项 | 内容 |
|----|------|
| **位置** | `charts.smoke.test.tsx`；新建 `renderThreeChoropleth.test.ts` |
| **改动** | L1：`map-3d` case 断言 `host.getAttribute("data-render-engine")` 为 `three` 或 `d3-fallback`（jsdom 预期 `d3-fallback`）+ 降级时断言横幅文案。`webglAvailable` 导出供 vi.mock。禁止仅用 `svg|canvas` 任一即通过。`CHART_CATALOG_SMOKE_CASES` 保持 44 |
| **目标** | 测试与真实引擎一致 |
| **验证** | `pnpm run test:chart-catalog` |

### T6 · Catalog 元数据对齐（P1-5 + P2-4）

| 项 | 内容 |
|----|------|
| **位置** | `backend/app/viz/builtin/map.py`；`chartTypeCatalogDisplay.ts` FALLBACK |
| **改动** | `map-3d` 的 `library="g2"` → `library="d3"`（或文档注明 FE 路由为准，以代码对齐为准）。`FALLBACK_CATALOG_ITEMS` 增加 `map-3d` 条目 |
| **目标** | API catalog 与 FE 一致 |
| **验证** | `pytest tests/test_viz_chart_catalog_parity.py -q` |

### T7 · 文档同步（P1-4）

| 项 | 内容 |
|----|------|
| **位置** | `docs/automate/plans/2026-07-21-chart-per-type-verification.md` §4.8；评估 `docs/automate/prd/F06-VIZ.md` |
| **改动** | 矩阵增 `map-3d`：L1 `three-map-chart` + `data-render-engine`；L2 同 `map` choropleth；L3 同 `map` fieldRule；注明 WebGL 降级行为。PRD：若 VIZ-003 仅写 2D map，追加「3D 区域地图（map-3d）」验收子条或脚注 |
| **目标** | prd-sync 合规 |
| **验证** | 人工读 diff；无新 API |

### T8 · E2E 路由 smoke（P2-5，可选本 PR）

| 项 | 内容 |
|----|------|
| **位置** | `fe/e2e/chart-visual-snapshots.spec.ts` 或新建 `map-3d.smoke.spec.ts` |
| **改动** | 访问 `/dev/charts?type=map-3d`；断言 `[data-testid=three-map-chart]` 可见 + `data-render-engine` 存在；**不**做像素截图（WebGL CI 不稳定） |
| **目标** | 路由级回归 |
| **验证** | `pnpm test:e2e` 相关用例（本地 dev server） |

### T9 · Picker 预览区分度（P2-3，可选）

| 项 | 内容 |
|----|------|
| **位置** | `ChartTypePreviewIcon.tsx`；可选新建 `PreviewMap3d.tsx` |
| **改动** | `map-3d` 使用带透视/挤出暗示的 SVG 预览（非与 `map` 共用 `PreviewMap`） |
| **目标** | Picker 可辨识 |
| **验证** | 目视 |

---

## 执行顺序

```
T1（契约+横幅）→ T3（visualMap）→ T4（Inspector）→ T5（测试）
     ↘ T2（拆分+懒加载，可与 T1 并行）
T6（catalog）→ T7（文档）→ T8/T9（可选）
```

**前置**：无 DB 迁移；无破坏性 API。

**后置门禁**：

```bash
cd fe && pnpm run test:chart-catalog
cd fe && pnpm run build
pytest tests/test_viz_chart_catalog_parity.py -q
```

---

## 八维度自审

| 维度 | 评级 | 说明 |
|------|------|------|
| 目标-实现一致性 | 🟢 | T1–T7 覆盖全部 P0/P1 finding |
| 必要性 | 🟢 | T8/T9 标可选，不阻塞合并 |
| 正确性 | 🟢 | 降级路径仍用同一 GeoJSON join |
| 完整性 | 🟢 | 含 dispose、懒加载 loading、文档 |
| 一致性 | 🟢 | 复用 `isGeoMapChartType`、GEO 样式链 |
| 副作用 | 🟡 | 动态 import 可能短暂 loading；需在 T2 验收 |
| 降级合理性 | 🟢 | 核心修复点：降级必须可见 |
| 顺序依赖 | 🟢 | T1 先于 T5 |
| 可验证性 | 🟢 | 每项有命令或断言 |

---

## 建议修复批次（对应 Code Review）

| 批次 | Tasks | Finding |
|------|-------|---------|
| **A 假绿清零** | T1, T5 | P0-1, P1-3 |
| **B 产品表面** | T3, T4 | P1-1, P1-2 |
| **C 文档/catalog** | T6, T7 | P1-4, P1-5, P2-4 |
| **D 工程债** | T2, T8, T9 | P2-1, P2-2, P2-3, P2-5 |

**推荐合并顺序**：A → B → C；D 可与 A 同 PR（T2）或 follow-up。

---

## plan-review 结论

| 检查项 | 结果 |
|--------|------|
| state | **PASS**（2026-07-21） |
| WARN | T2 动态 import 竞态（`renderGenRef` 已缓解）；T8 E2E 依赖 dev server |
| 执行验证 | `pnpm run test:chart-catalog` 167 passed；`pytest tests/test_viz_chart_catalog_parity.py` 4 passed；map-3d 相关 tsc 无新增错误 |

## plan-verify 结论（A8）

| Task | 状态 | 证据 |
|------|------|------|
| T1 渲染契约 | ✅ | `geoMapRenderResult.ts` + `data-render-engine` + 横幅 |
| T2 拆分+懒加载 | ✅ | `geoToThreeShapes.ts` + dynamic import + loading |
| T3 visualMap | ✅ | `threeGeoVisualMap.ts` |
| T4 Inspector | ✅ | `inspectorCapabilityMatrix` + 测试 |
| T5 测试 | ✅ | smoke + `renderThreeChoropleth.test.ts` |
| T6 catalog | ✅ | BE `library=d3` + FALLBACK |
| T7 文档 | ✅ | `chart-per-type-verification.md` §4.8 |
| T8 E2E | ✅ | `fe/e2e/map-3d.smoke.spec.ts` |
| T9 Picker 预览 | ✅ | `PreviewMap3d` |

---

## plan-review 预留（历史）

| 检查项 | 预期 |
|--------|------|
| state | PASS（待审） |
| 阻塞项 | 无 |
| WARN 可能 | T8 E2E 依赖 dev server；可标 optional |
