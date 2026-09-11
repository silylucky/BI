# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-30

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：图表挂载加速 + 松手不闪（`chartMountScheduler` · `ChartMountContext` · `useInViewport` · `DashboardChartMountGate` · `ChartRenderer` · PixelCanvas/D3 live resize） |
| mode | auto-fix |
| fix_mode | confirm-batch（待确认） |
| cr_fix_scope | （待用户确认后填） |
| Stack Card | 见下 |
| 扫描方式 | 并行 explore：L1/产品表面 · L11 性能；`scan_tools: rg + 调用链深读` |
| 证据层 | 无 `.evidence/`（Blind spot） |
| ha_mode | single（本批无服务端；L11 §18 跳过） |
| Blind spots | 无证据层；未浏览器复现「永久灰」；L3/L4/L6/L8/L9/L10 合理跳过 |
| Lane 密度 | L1 ≥5；L11 ≥5 |
| P0 / P1 / P2 | **1 / 5 / 3** |
| 建议 | 先修 P0（GIS 不 markReady 占槽）+ P1 viewport root；再谈「排队已完成」 |
| 回传 status | DONE_WITH_CONCERNS |
| 已排除非问题 | 测试双；默认管理员种子；「6 并发会卡」无压测数字不单开臆测 P0 |

一句话结论：**加速与保留最后一帧方向对，但 `gis-map` 失败不释放挂载槽可让同屏其它图一直灰；v2 像素画布视口 root 选错。不可宣称排队问题已彻底完成。**

### Stack Card（摘要）

- 形态：VitalSpan FE React 19；本批无后端
- 跳过 lane：L3/L6/L8/L9/L10（无服务端/IaC/仓外契约/API 变更）；L4 无表单
- 宣称：编辑态少灰、已画过不卸骨架、拖拽不因 query 翻转闪

## Blind spots / 未完成 lane

| Lane | 状态 | 说明 |
|------|------|------|
| 证据层 | 未消解 | 无 `.evidence/` |
| BROWSER | 边缘 | 未真机复现 GIS 占槽 |
| L1 结构性 | 降级 | ast-grep 未跑规则包 |

## P0 Findings

### P0-1 · gis-map 失败路径永不 markReady，占死挂载槽

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 产品表面 |
| 证据 | `ChartRenderer.tsx`：`gis-map`/`map-3d` 走 `deferMountReadyForPaint`，普通 effect **不** `onMountReady`。`GisMapView.tsx:149-163,184-188`：无 `tileServiceId` / PMTiles 失败只 `setGisPaintState("error")`，成功路径才 `onPaintReady`（约 458/545 行）。调度器该 id 永驻 `mounting`，`drain` 少一个槽 → 其它可见图长时间/永久灰 |
| 为何致命 | 一张坏 GIS 图即可让整页排队卡住；用户感知「莫名其妙一直灰」 |
| 建议修法 | 错误/超时/缺配置一律 `onPaintReady()`（或调度器 `markReady`）；与 `D3GeoMapView` 失败也 notify 对齐 |
| xref | [P1-3] |
| 可批量 | 是（批次 A） |

## P1 Findings

### P1-1 · v2 像素编辑 viewport root 未命中

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `DashboardWidget.tsx` shape 壳 `rootSelector="[data-canvas-scale-viewport]"`；普通 v2 `PixelCanvas` 无该属性（仅大屏 `CanvasScaleViewport`/`DataScreenEditViewport` 有）→ IO root=null → 用浏览器视口，相对 `.pixel-canvas-host` 滚动语义错 |
| 建议修法 | fallback `.pixel-canvas-host` / `[data-testid=pixel-canvas-host]` |
| xref | [] |
| 可批量 | 是（批次 A） |

### P1-2 · 首帧 inView=false，可见图先全体排队灰

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `useInViewport.ts:20` `useState(() => !enabled)`；登记时 `inView=false` 不进 `drain` |
| 建议修法 | 有 node 时默认 true 或同步读 `getBoundingClientRect` 再登记 |
| xref | [] |
| 可批量 | 是（批次 A） |

### P1-3 · markReady 卡住无超时回收

| 字段 | 内容 |
|------|------|
| 类别 | 热路径 / 可靠性 |
| 证据 | `markReady` 仅 mounting→ready；慢查询/`loading` 永真/GIS 不回调则 `mounting.size` 顶满，后续 waiting 一直灰。无 watchdog |
| 建议修法 | 超时强制 markReady 或 demote + 释放槽（与 P0-1 一起） |
| xref | [P0-1] |
| 可批量 | 是（批次 A） |

### P1-4 · 6 路挂载 vs 3 路 execute 扇出不一致

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 |
| 证据 | `CHART_MOUNT_MAX_EDIT=6` vs `CHART_EXECUTE_MAX_CONCURRENCY=3`（`chartExecuteProbe.ts`）；6 路可同时进 D3/GIS paint |
| 建议修法 | 对齐上限（挂载 3 或 execute/paint 6），或 paint 另限流 |
| xref | [] |
| 可批量 | 是（批次 B，需产品权衡卡顿 vs 排队） |

### P1-5 · ready 图无屏外驱逐，DOM/WebGL 只增不减

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 |
| 证据 | `getGate` ready 恒 `canRender:true`；大屏滚过的图一直挂实例 |
| 建议修法 | 屏外超时 demote waiting（可保留位图快照） |
| xref | [] |
| 可批量 | 否（需产品裁定内存 vs 再灰） |

## P2 Findings

- **P2-1** `interactionFrozen` 未进 `getGate`：`ChartMountInteractionBridge` 对 gate 无实质作用（行为靠 ready 保留帧）
- **P2-2** `preempt` 把 mounting 打回 waiting 仍会骨架闪（有空槽已不误伤；满槽选中仍会踢 1 个）
- **P2-3** `waitForActiveChartMountDrain` 超时吞错，缩略图可能截到灰骨架

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 提高并发到 6 | 有意加速，不是 stub |
| ready 保留最后一帧 | 对应用户「不要卸成灰」；内存策略单列 P1-5 |
| 测试 mock | 豁免 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 |
|------|------------|------|
| A 占槽/视口 | P0-1, P1-1, P1-2, P1-3 | M |
| B 并发对齐 | P1-4 | S（需裁定 3 vs 6） |
| C 驱逐/冻结接线 | P1-5, P2-1…P2-3 | S–M |

---

确认修全量(P0+P1+P2)？或指定 P0 / P0+P1？
