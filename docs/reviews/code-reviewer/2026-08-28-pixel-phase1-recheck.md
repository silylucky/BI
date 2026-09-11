# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-28（Phase1 复检）

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：Phase1 geometry fail-closed / 不闪收口后复检 |
| mode | auto-fix |
| fix_mode | confirm-batch（待确认） |
| Stack Card | React FE `fe/`；像素画布；ha_mode=single；scan_tools=rg+explore |
| 证据层 | 无 `.evidence/`（Blind spot） |
| Blind spots | 无 BROWSER；无证据层；D3 单测仍 mock resize hook |
| P0 / P1 / P2 | **0 / 5 / 4** |
| 建议 | **总线可宣称收口**；**产品「未碰不闪」不可宣称完成** |
| 回传 status | DONE_WITH_CONCERNS |

一句话：先前 P0（Legend 全广播 / fail-open）已修掉；残留主要是 **ResizeObserver 旁路** 与 **paintMaxEdge 选区 force 重绘**。

### 对照上轮 CR

| 上轮 | 本轮 |
|------|------|
| P0 Legend `dispatch(undefined)` | ✅ 已修（scoped+delta+无 id 不派发） |
| P0/P1 omit 广播 / `!widgetId→true` | ✅ 已修 |
| P1 D3 force=true | ✅ 改为 `force=false` |
| P1 ChartRenderer playing 结束 remeasure | ✅ 已收紧 |
| GisMap/CustomViz | 仍缺口（本批 Out，P1 记） |

## P0 Findings

无。

## P1 Findings

### P1-1 · useEmbeddedChartLiveResize RO 旁路

| 字段 | 内容 |
|------|------|
| 证据 | `useEmbeddedChartLiveResize.ts` — playing=false 时任意 RO → live resize，不经 size-only 过滤 |
| 建议 | move-only 减少 metrics 抖动；或 RO 仅在宽高相对 last 变化时触发 |
| 可批量 | 是（批次 A） |

### P1-2 · paintMaxEdge 选区切换 force commit

| 字段 | 内容 |
|------|------|
| 证据 | `DashboardWidget` → D3 `useEffect` `measureAndRender("commit", true)` |
| 建议 | 选区切换勿 force；或尺寸未变跳过 |
| 可批量 | 是（批次 A） |

### P1-3 · GisMapView 未接入管线

| 字段 | 内容 |
|------|------|
| 证据 | `GisMapView.tsx` 裸 RO |
| 建议 | Phase2 接入；本批可不阻塞「总线收口」 |
| 可批量 | 是（批次 B） |

### P1-4 · CustomVizWidget 无 paused

| 字段 | 内容 |
|------|------|
| 证据 | `CustomVizWidget.tsx` |
| 建议 | Phase2 |
| 可批量 | 是（批次 B） |

### P1-5 · 缺 move vs resize 集成测（假绿风险）

| 字段 | 内容 |
|------|------|
| 证据 | 仅工具测绿；`D3CanvasView.test` mock hook |
| 建议 | 不 mock 的 redraw 次数断言 |
| 可批量 | 是（批次 A） |

## P2 Findings

- P2-1 `refreshCanvasMetrics` 在 move-only commit 仍跑 → 放大 RO  
- P2-2 表格 remeasureLayout 近 no-op  
- P2-3 Tab unpark 不经 handleCommit（漏补测边界）  
- P2-4 `flushCommitResize` el==null 仍可能 commit  

## 非问题

| 项 | 原因 |
|----|------|
| 总线 omit/empty | 已早退 + 单测 |
| handleCancel 不广播 | 符合预期 |
| GisMap 未做完不算总线失败 | 裁决 Out |

## 建议修复批次（待确认）

| 批次 | 含 finding | 说明 |
|------|------------|------|
| A | P1-1, P1-2, P1-5, P2-1 | 关 RO/选区闪 + 集成测 |
| B | P1-3, P1-4 | Phase2 引擎 |

确认修全量 / 仅批次 A（P0+本轮 P1 主路径）/ 仅报告？

关联 feature-truth：`docs/feature-truth/2026-08-28-pixel-size-only-noflicker-truth-audit.md`
