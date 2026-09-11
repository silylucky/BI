# 项目锚定方案评审 — 前端流畅度与 Worker/异步策略

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-26 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 问题 | 系统感觉不流畅，是否因未做 Worker/异步？应怎么做？ |
| 选项 | A 全面 Web Worker · B 主线程减负 · C Profile-first 合成路径 · S0 维持现状 |
| 裁决 | **RECOMMEND_SYNTHESIZED**（C = A 的 PoC 子集 + B 的 Phase 1） |
| 方向纠正强度 | **改道** |
| 置信度 | **HIGH**（P2/P3 实测见 [附录](./2026-08-26-vitalspan-fe-performance-profile-appendix.md)；P1 像素画布待补录） |
| **交付** | 判 + 纠 + 给（§6–§9 完整） |

---

## 1. 项目约束摘录

| ID | 约束 | 真源 |
|----|------|------|
| C-01 | BI 运行时零 Superset/DataEase 依赖；图表经 ChartEngine 抽象 | [`docs/arch.md`](../../arch.md) ADR-03/13 |
| C-02 | 地图仅离线中国 GeoJSON；GIS 用 MapLibre + 内网 PMTiles | [`.cursor/rules/geo-map-offline-china.mdc`](../../../.cursor/rules/geo-map-offline-china.mdc) ADR-12 |
| C-03 | NFR-001 首屏 ≤5s；NFR-002 报表查询 ≤10s | [`docs/automate/prd/F15-NFR.md`](../../automate/prd/F15-NFR.md) |
| C-04 | 单文件 fe ≤300 行；单函数 ≤60 行 | [`.cursor/rules/engineering.mdc`](../../../.cursor/rules/engineering.mdc) |
| C-05 | M1 工程基线已收官；性能薄弱项在 PRD 评分表 recurring「性能」 | [`docs/automate/prd.md`](../../automate/prd.md) |
| C-06 | 列表/Hub 应用静态缩略图替代 live 渲染（已验证思路） | [`docs/feature-truth/2026-08-25-viz-component-hub-screenshot-preview-truth-audit.md`](../feature-truth/2026-08-25-viz-component-hub-screenshot-preview-truth-audit.md) |

---

## 2. 问题重述

**用户问题**：感觉系统不流畅，是不是没做 Worker 或异步处理？需不需要做？

**纠正后问题**（§7 重定义）：

> 如何在 **不推翻 D3 SVG + Three.js + React 现架构** 的前提下，把 **大屏编辑交互、区域地图、多 widget 同屏** 的主线程占用压到可接受范围，并 **用 profiling 证明** 是否值得为 **可序列化计算** 单点引入 Worker？

根因不是「缺 Worker」，而是 **异步 IO 已有、主线程绘制与交互反馈环仍重**。

---

## 3. 选项归一

| 选项 | 摘要 | 典型动作 |
|------|------|----------|
| **S0** | 维持现状，仅零散 bugfix | 无系统性能 initiative |
| **A** | 全面 Web Worker / OffscreenCanvas 图表管线 | `workers/` 包、D3/Three 离屏渲染、消息协议 |
| **B** | 仅主线程减负（不调 Worker） | 增量 resize、mount 冻结、视口占位、减 effect 环 |
| **C** | **Profile-first 合成**：B Phase 1 → profiling → 条件性 A 子集（geo match Worker） | 见 §8 |

---

## 4. 证据与假设

| ID | 类型 | 内容 | 来源 |
|----|------|------|------|
| T1 | 代码 | 图表数据 `useChartExecute` 异步 fetch；非同步阻塞 | [`fe/src/components/charts/useChartExecute.ts`](../../../fe/src/components/charts/useChartExecute.ts) |
| T1 | 代码 | execute 去重 + 缓存 + **并发上限 3** | [`fe/src/lib/chartExecuteProbe.ts`](../../../fe/src/lib/chartExecuteProbe.ts) `CHART_EXECUTE_MAX_CONCURRENCY=3` |
| T1 | 代码 | 编辑态 `ChartMountScheduler`：**视口内最多 2 路并发挂载**；`inView` 门控 | [`fe/src/lib/chartMountScheduler.ts`](../../../fe/src/lib/chartMountScheduler.ts) · [`ChartMountContext.tsx`](../../../fe/src/components/charts/ChartMountContext.tsx) |
| T1 | 代码 | 编辑态未选中 `paintMaxEdge=720`；`shouldDeferEditLivePaint` | [`fe/src/lib/dashboardEditChartPerf.ts`](../../../fe/src/lib/dashboardEditChartPerf.ts) |
| T1 | 代码 | MapLibre **已 setWorkerUrl**（库自带 Worker） | [`fe/src/components/charts/engine/maplibre/maplibreBootstrap.ts`](../../../fe/src/components/charts/engine/maplibre/maplibreBootstrap.ts) |
| T1 | 代码 | 3D 地图 WebGL 槽位 ≤4 | [`fe/src/components/charts/engine/three/geo3dRuntime.ts`](../../../fe/src/components/charts/engine/three/geo3dRuntime.ts) |
| T1 | 代码 | 2D choropleth **主线程** `renderD3ChoroplethChart` 建 SVG DOM | [`fe/src/components/charts/engine/d3/geo/renderChoropleth.ts`](../../../fe/src/components/charts/engine/d3/geo/renderChoropleth.ts) |
| T1 | 代码 | 列表卡片 `IntersectionObserver` + 预览槽位 | [`fe/src/components/dashboard/DashboardListCardPreview.tsx`](../../../fe/src/components/dashboard/DashboardListCardPreview.tsx) |
| T1 | 近期修复 | 碰撞预览 skip 活动 widget；2D 地图 live resize viewBox；`onCommitResizeRef` | `pixelShapePreviewRegistry.ts` · `D3GeoMapView.tsx`（会话内已落地） |
| T3 | 实测 | P3 冷进入 Top：`buildDatasetEncoding` / `renderD3ChoroplethChart` / `runD3Renderer`；P2 Inspector：`renderWithHooks` / `fetchWithTimeout` | [附录](./2026-08-26-vitalspan-fe-performance-profile-appendix.md) |
| H1 | 假设 | 用户卡顿主场景 = **大屏 PixelCanvas + 区域地图** | 近期对话 + DOM 路径 |
| H2 | 假设 | 后端 demo 查询 <3s | 本地环境未在本评审中压测 |

---

## 5. 多维打分（10 分制）

| 维度 | S0 | A 全面 Worker | B 主线程减负 | C 合成 |
|------|-----|--------------|-------------|--------|
| 约束合规 (C-01/04) | 8 | 4 | 9 | 9 |
| 短期体感改善 | 2 | 5 | 8 | 8 |
| 实施成本 / 风险 | 10 | 3 | 8 | 7 |
| 与现码复用 | 6 | 4 | 9 | 9 |
| 可验收性 | 3 | 5 | 8 | 8 |
| 架构可持续 | 4 | 6 | 8 | 9 |
| **加权** | **5.0** | **4.5** | **8.3** | **8.5** |

---

## 6. 裁决

**推荐**：**RECOMMEND_SYNTHESIZED**（**C：Profile-first → B Phase 1 → 条件性 A 子集**）

**一句话**：**已有异步与限流，不必全面 Worker 化**；先做 **主线程交互减负 + 一次 profiling**，仅当 CPU 瓶颈在 **geo 行匹配/大数据采样** 且 >50ms 时再做 **单点 Worker spike**。

**相对「是不是没做 Worker」的纠正**：

| 误解 | 事实 |
|------|------|
| 「完全没做异步」 | execute、懒挂载、路由 lazy、MapLibre Worker **已有** |
| 「加 Worker 就流畅」 | D3 SVG 依赖 DOM；Three 离屏 Worker 成本高；**绘制仍须回主线程** |
| 「异步 = 不卡」 | 数据回来后 **measureAndRender / collision preview** 仍占主线程 |

---

## 7. 规划方向纠正

**原方向错在哪？**

1. **问题定义偏窄**：把「不流畅」等同于「缺 Worker」，忽略 **已有 `ChartMountScheduler` + execute 并发门**。
2. **A 路径与栈矛盾**：ADR-13 下 D3/AntV 端口以 **DOM/Canvas 主线程渲染** 为交付形态；全面 Worker 化 ≈ **新引擎子项目**，超出 M1/M2 companion 体量。
3. **治症状顺序反了**：未 profiling 就上 Worker，无法证明 ROI；近期地图/缩放卡顿已证 **effect 环 + 全量重绘** 为主因，属 B 类问题。
4. **忽略后端维度**：查询 >3s 时前端 Worker **无解**（NFR-002 在后端）。

**纠正后目标（一句话）**：

> 在 **2 周内** 闭合「大屏编辑拖缩放 + 区域地图 Inspector」三条路径的 **主线程减负**，并用 Performance 录制留下 **Top3 耗时栈**；Worker 仅作为 **有证据的 Phase 2 可选项**。

**应停止什么？**

- 立项 **「全面 Web Worker 图表引擎」** 或 OffscreenCanvas 重写 D3 管线
- 在未 profiling 前实现 **通用 worker 消息层**
- 把 **SQL 慢查询** 寄托于前端 Worker
- 大屏 **默认同屏多 3D 地图全特效** 作为默认演示配置

**应优先什么？**

| 优先级 | 内容 | 里程碑对齐 |
|--------|------|------------|
| P0 | Chrome Performance 三条路径录栈 + 归档 | 评审 §10 探针 |
| P1 | 推广 `D3GeoMapView` 模式到 `D3CanvasView`；交互期冻结非选中 execute | M1 大屏编辑体验 |
| P1 | 延续碰撞 preview / 字段拖放 / 地图 loading 环修复 | 近期 bug 收敛 |
| P2 | 条件性 `geoMatch.worker.ts` spike | 仅 profiling 证明需要 |
| P3 | 列表/Hub 静态缩略图扩面 | 对齐 C-06 已验证路径 |

**与里程碑对齐**：属 **NFR/体验 companion**，不新开 M2 里程碑；回写 `prd.md` 性能薄弱项时引用本报告路径即可（**不直接改 plan 勾选**）。

---

## 8. 推荐解决方案（合成）

### 8.1 方案摘要

**名称**：Profile-first 主线程减负 + 条件性 Worker  
**类型**：SYNTHESIZED（B 为主干 + A 的 geo 计算子集为可选）  
**一句话**：先量、再减主线程重绘与资源争抢，最后才考虑单点 Worker。

### 8.2 目标与非目标

| 目标（Phase 1） | 非目标（本期不做） |
|-----------------|-------------------|
| 大屏拖缩放含地图 widget **跟手、不闪 loading** | 全面 Worker 化 D3/Three |
| Inspector 拖字段 **可绑定、不反复闪态** | 新图表引擎 / 换 AntV 栈 |
| 留下 Performance **Top3 栈文档** | OffscreenCanvas 3D 地图重写 |
| 推广稳定 resize commit（`onCommitResizeRef`） | 后端查询优化 initiative（另立项） |

### 8.3 架构与触及面

| 层 | 动作 | 路径/模块 | 复用 |
|----|------|-----------|------|
| 图表 live resize | 增量 viewBox + ref 稳定 commit | `fe/src/components/charts/engine/d3/views/D3GeoMapView.tsx` · `D3CanvasView.tsx` | 已落地 Geo 部分 |
| 大屏交互 | preview skip 活动 widget | `fe/src/components/dashboard/pixelCanvas/pixelShapePreviewRegistry.ts` | 已落地 |
| 字段拖放 | text/plain fallback；加载中不禁用槽 | `fe/src/lib/chartFieldDrag.ts` · `ChartMapFieldSlots.tsx` | 已落地 |
| 挂载调度 | 拖拽期 `acquireInteractionFreeze` + 暂停非选中 execute | `ChartMountScheduler` · `DashboardWidget.tsx` | 已有 API |
| 地图配置 | axes 显式写入一键配置 | `fe/src/lib/mapChartSalesGeo.ts` | 已落地 |
| 可选 Worker | geo 行匹配 offload | `fe/src/workers/geoMatch.worker.ts`（**待 spike**） | `OfflineGeoPort.analyzeMatch` 逻辑抽取 |

### 8.4 实施步骤（有序）

| 步 | 内容 | 依赖 | 验收 |
|----|------|------|------|
| **0** | Chrome Performance 录三条路径，归档 Top3 栈到 `docs/reviews/grounded/` 附录或本文件 §10 | — | 有截图/栈名列表 |
| **1** | `D3CanvasView`：复制 `onCommitResizeRef` + live resize 节流策略 | 0 可选 | `vitest` D3 相关用例绿 |
| **2** | `DashboardWidget`：拖拽/缩放会话 `acquireInteractionFreeze` 且非选中 widget `execute` 不 rerun | 1 | 手测：拖 A 时 B 不闪 loading |
| **3** | 回归：PixelCanvas resize 用例 + 地图 Inspector 拖 `province` | 1–2 | `pixelShapePreviewRegistry.test.ts` 等绿 |
| **4**（可选） | 若步 0 证明 geo match >50ms：`geoMatch.worker.ts` spike | 0 证据 | worker vitest mock + 主线程降帧 |

### 8.5 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| 冻结 execute 导致松手后数据陈旧 | 松手 `PIXEL_LAYOUT_GEOMETRY_COMMITTED` 后统一 flush | 移除 freeze，仅保留 mount 并发 |
| viewBox 缩放投影失真 | commit 时 force `measureAndRender("commit", true)` | 回退 live 跳过重绘 |
| Worker 序列化开销 > 收益 | 步 0 必须证明；spike 有 benchmark | 不合并 Worker |

### 8.6 对 Cursor 原方案的具体纠正

| 原建议 | 问题 | 纠正后做法 |
|--------|------|------------|
| 「可能缺 Worker」 | 以偏概全 | 先列 **已有** 异步/限流/MapLibre Worker |
| 「全面 Worker」 | 成本极高、与 D3 DOM 矛盾 | **禁止**；仅 geo match 可 spike |
| 「直接改 D3」无顺序 | 无证据驱动 | **步 0 profiling 门禁** |
| 只修地图不推广 | 其他嵌入式图仍 effect 环 | **步 1 推广到 D3CanvasView** |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**：闭合大屏编辑 + 区域地图 Inspector 主线程卡顿；Profiling 驱动，不全面 Worker 化。

**硬约束**：C-01 · C-02 · C-04 · C-06

**改动清单草案**（≤10）：

1. 归档 Performance Top3（文档）
2. [`D3CanvasView.tsx`](../../../fe/src/components/charts/engine/d3/views/D3CanvasView.tsx) — `onCommitResizeRef` + live resize 对齐 Geo
3. [`DashboardWidget.tsx`](../../../fe/src/components/dashboard/DashboardWidget.tsx) — 交互 freeze 联动 execute
4. [`useChartExecute.ts`](../../../fe/src/components/charts/useChartExecute.ts) 或 gate — `canQuery=false` 时跳过 run
5. 回归测试补齐 PixelCanvas / 地图字段槽
6. （可选）`fe/src/workers/geoMatch.worker.ts`
7. PRD 性能薄弱项备注链到本报告（`prd-sync` 评估）

**验证方案**：

- `pnpm exec vitest run` — `pixelShapePreviewRegistry` · `chartFieldDrag` · `mapChartSalesGeo` · `gisGlobeLayout`（若动地图）
- 手测：大屏拖缩放地图 widget；Inspector 绑 `province` + 更新数据；多 widget 编辑进入
- 可选：`dashboard-first-screen.perf.smoke.test.tsx`

**非目标**：全面 Worker · OffscreenCanvas 引擎 · 后端查询优化 · 新 chartType

**待验证 spike**：步 0 未做前 **禁止** 步 4 合入

---

## 10. 验证命令

```bash
# 前端单测（性能相关已触达模块）
cd fe && pnpm exec vitest run \
  src/lib/chartFieldDrag.test.ts \
  src/lib/mapChartSalesGeo.test.ts \
  src/components/dashboard/pixelCanvas/pixelShapePreviewRegistry.test.ts \
  src/components/charts/engine/maplibre/gisGlobeLayout.test.ts

# 首屏 smoke（若改 mount/execute 门控）
pnpm exec vitest run src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx
```

**手测探针**：

1. 大屏编辑：选中含区域地图 widget → 拖边角缩放 → 无「对着干」、loading 不闪
2. Inspector：`province` 拖入「地区/维度」→ 点「更新图表数据」→ 省界着色
3. Performance：录制 10s，导出 Main 线程 Top 3 函数名

---

## 11. 交接与下一步

| 下一步 | 条件 |
|--------|------|
| **`/plan-create` 按 §9 展开** | 用户同意本裁决 |
| **直接执行步 1–3** | 用户说「按 §8 实现」/「开始落地」 |
| **步 0 profiling** | 建议与步 1 并行（人工 Chrome） |
| **feature-truth-verify** | 步 1–3 合入后 |

---

*status: complete · 步 0 P2/P3 已录；P1 像素画布待环境修复后补录 → [附录](./2026-08-26-vitalspan-fe-performance-profile-appendix.md)*
