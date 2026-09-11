# VitalSpan 生产就绪 / 产品体验评审 · 2026-09-02

相对 [2026-08-30 同面评审](./2026-08-30-chart-mount-speed-change-surface.md) 的复检。**2026-09-02 用户确认全量后已落地代码**（P1-5 按「不卸成灰」保留最后一帧，未做 DOM 驱逐）。

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：图表挂载调度 + 像素画布编辑门控（主根：`chartMountScheduler` · `ChartMountContext` · `useInViewport` · `DashboardWidget`/`DashboardEditCanvas` · `ChartRenderer` · `GisMapView`/`D3GeoMapView` · `pixelCanvas`；上追：`ChartMountProvider` 调用方） |
| mode | auto-fix |
| fix_mode | auto（用户确认全量） |
| cr_fix_scope | all |
| Stack Card | 见下 |
| 扫描方式 | 并行 explore：L1 · L7 · L11；主 agent 复核入口；`scan_tools: ast-grep + codegraph + rg` |
| 证据层 / 外部依赖 | 无 `.evidence/`（Blind spot）；本批无新增仓外 SDK 契约（GIS 走既有 `apiFetch`） |
| ha_mode | single（arch 单机/compose；L11 §18 跳过） |
| Blind spots | 无证据层；未浏览器复现「永久灰」；L1 结构性规则包 0 hit（词法+深读已补） |
| Lane 密度 | L1/L7/L11 均 ≥5；L2/L4/L6/L8/L9/L10 合理跳过 |
| P0 / P1 / P2 | **1 / 6 / 4** |
| 建议 | 修完 P0 再谈排队完成；不可写可上线 |
| 回传 status | DONE_WITH_CONCERNS（已批量修代码，证据层仍无） |
| 已修 | P0-1, P1-1, P1-2, P1-3, P1-4, P1-6, P2-1, P2-2, P2-3, P2-4 |
| remaining | P1-5：与「已画完不卸成灰」冲突，改为屏外只停 query、保留 DOM/WebGL 最后一帧 |
| 已排除非问题 | 查询失败仍 `onMountReady`（释槽，UI 仍示错）；`D3GeoMapView` 失败 `notifyPaintReady`（与 GIS 应对齐的正确行为）；无 Provider 时 fail-open（探查器/独立预览预期）；demo-mysql region 映射（超出本变更面）；测试双 |

一句话结论：**上次 P0 仍在——`gis-map` 失败/未配底图不调用 `onPaintReady`，挂载槽占死，同屏其它图可一直灰。** v2 非大屏像素画布视口 root 仍错；首帧全体灰闪仍在。工作区未提交 diff 不覆盖这些问题。

### Stack Card（摘要）

- 根路径：`c:\Users\30381\Desktop\VitalSpan`
- 范围模式：PR·变更面（非整仓）
- 形态：monorepo；本批 **仅 FE**
- 前端：React 19 · Vite · `fe/`
- 后端：本批不扫 FastAPI
- ha_mode：single
- 证据层：无
- 跳过 lane：L2（无密钥/假 KPI）；L3（无服务端/多库）；L4（无表单）；L6（无 IaC 变更）；L8（无新仓外契约；`resolveTileService` 走 `apiFetch`）；L9/L10（无 API/鉴权变更）；L5 并入双骨架 P2，未做页级视觉深扫
- 宣称材料：编辑态少灰、已画过不卸骨架、拖拽不因 query 翻转闪（对话/前次 CR）
- 排除：`node_modules`、`dist`、`*.test.*`、`*.spec.*`

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 证据层 | 未消解 | `.evidence/` | 仓内无证据层，不得据此认定干净 |
| BROWSER | 边缘 | 真机永久灰 | 静态可定位 GIS 占槽；未复现用户屏 |
| L1 规则包 | 降级已补 | `ast-grep scan` 0 hit | 关键入口已人工读 |
| L2–L4/L6/L8–L10 | 合理跳过 | — | 见 Stack Card |

## P0 Findings

### P0-1 · gis-map 失败路径永不 markReady，占死挂载槽

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 产品表面 |
| 证据 | `ChartRenderer.tsx`：`gis-map`/`map-3d` 走 `deferMountReadyForPaint`，查询完成 effect **直接 return**，不 `onMountReady`。`gisBasemapOnly` 同样跳过查询路径。`GisMapView.tsx`：无 `tileServiceId` / PMTiles `.catch` / `pmtilesErrorHint` 只把 `gisPaintState` 设为 `error`；`onPaintReady` **仅** `finishInitialLoad`（约 load/style.load）与样式热更成功回调。调度器该 widget 永驻 `mounting`，`drain` 少一槽 → 同屏 waiting 图长时间/永久「图表排队加载中」 |
| 为何致命 | 一张坏 GIS 即可卡住整页排队；用户感知与「加速已修好」矛盾 |
| 建议修法 | 错误/超时/缺配置一律调用 `onPaintReady()`（或调度器释放槽）；与 `D3GeoMapView` 失败仍 `notifyPaintReady` 对齐；另加 mounting watchdog（见 P1-3） |
| xref | [P1-3] |
| 可批量 | 是（批次 A） |

## P1 Findings

### P1-1 · v2 非大屏像素画布 viewport root 未命中

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `DashboardWidget.tsx`：`shell !== "grid"` 时 `rootSelector="[data-canvas-scale-viewport]"`。该属性只在 `CanvasScaleViewport` / `DataScreenEditViewport`。`DashboardEditCanvas.tsx`：v2 且 **非** `data-screen` 时裸挂 `PixelCanvas`（仅 `data-testid="pixel-canvas-host"`）→ `querySelector` 失败 → IO `root=null` → 相对浏览器窗口，相对画布滚动语义错 |
| 建议修法 | fallback `.pixel-canvas-host` / `[data-testid=pixel-canvas-host]`，或给普通 PixelCanvas 根打上同一 viewport 属性 |
| xref | [P1-2] |
| 可批量 | 是（批次 A） |

### P1-2 · 编辑态首帧 inView=false，可见图先全体灰

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `useInViewport.ts`：`enabled===true` 时 `useState(false)`；IO 回调前 `DashboardChartMountGate` 把 `inView=false` 登记 → 不进 `drain`，文案走「图表屏外已暂停」 |
| 建议修法 | 有 node 时默认视为可见，或同步 `getBoundingClientRect` 后再 `register` |
| xref | [P1-1] |
| 可批量 | 是（批次 A） |

### P1-3 · mounting 无超时回收

| 字段 | 内容 |
|------|------|
| 类别 | 热路径 / 可靠性 |
| 证据 | `markReady` 仅 mounting→ready；慢查询、`loading` 永真、GIS 不回调时 `mounting.size` 顶满。`waitForInViewSettled` 只给截图等待，**不释放槽** |
| 建议修法 | 超时强制 `markReady` 或 demote 并释放；与 P0-1 一起 |
| xref | [P0-1] |
| 可批量 | 是（批次 A） |

### P1-4 · 挂载并发与 execute 上限不一致

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 |
| 证据 | `CHART_MOUNT_MAX_EDIT=6` vs `CHART_EXECUTE_MAX_CONCURRENCY=3`；列表/模板预览 `mountMaxConcurrent` 可达 8。多出的图进入 execute limiter **无界 queue** |
| 建议修法 | 对齐上限，或给 execute queue 设 cap + 诚实排队 |
| xref | [P1-6] |
| 可批量 | 是（批次 B，需权衡卡顿 vs 排队） |

### P1-5 · ready 图无屏外驱逐

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 |
| 证据 | `getGate`：ready 恒 `canRender: true`；`PixelCanvas` 顶层 widget 无虚拟化。历史进过视口的 GIS/D3 实例只增不减 |
| 建议修法 | 屏外超时 demote（可留位图）；需产品裁定内存 vs 再灰 |
| xref | [] |
| 可批量 | 否（需产品裁定） |

### P1-6 · inView 每次 register 全员 notify

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 |
| 证据 | `useChartMountGate`：`inView` 变化即 `register` → 无差分，恒 `preempt+drain+notify`；所有订阅 gate 的 widget `revision+1`。叠加 `preemptForPriority` 可把低优 `mounting` 打回 waiting → 卸引擎再挂（GIS `map.remove`） |
| 建议修法 | register 短路（priority/inView/state 未变则 return）；preempt 避免卸已接近 ready 的 GIS |
| xref | [P1-4] |
| 可批量 | 是（批次 B） |

## P2 Findings

- **P2-1** `interactionFrozen` 未进 `getGate`：拖拽冻结只 `notify`，门控行为靠 ready 保帧
- **P2-2** `waitForActiveChartMountDrain` 超时吞错；生产几乎无调用方，缩略图另走 capture
- **P2-3** 门控骨架「图表排队加载中」与查询骨架「图表加载中」叠两层灰
- **P2-4** `chartExecuteProbe` 结果缓存 / inflight Map 无 LRU/TTL（长会话内存单调升；非本批引入也可顺手限）

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 查询 `error` 仍 `onMountReady` | 释放槽；错误面仍展示，不是假绿成功 |
| `D3GeoMapView` 失败仍 paintReady | 正确释槽；GIS 应对齐此行为，不能反过来删掉 |
| 无 `ChartMountProvider` fail-open | 探查器等非看板入口需要能画 |
| `CHART_MOUNT_MAX_EDIT=6` | 有意加速，不是 stub |
| ready 保留最后一帧 | 对应用户「不要卸成灰」；内存策略单列 P1-5 |
| demo-mysql geo 映射 | 超出本变更面 |
| 测试 mock ChartRenderer | 测试双豁免 |
| 工作区 `withDevPmtilesArchiveUrl` | 开发 URL 改写，不修复 P0-1 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 |
|------|------------|------|
| A 占槽/视口 | P0-1, P1-1, P1-2, P1-3 | M |
| B 并发与抖动 | P1-4, P1-6 | S–M |
| C 驱逐/文案 | P1-5, P2-1…P2-4 | S–M（P1-5 先裁定） |

---

确认修全量(P0+P1+P2)？或指定 P0 / P0+P1？
