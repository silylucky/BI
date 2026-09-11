# VitalSpan 生产就绪评审 · 性能步 1–3 完成度 · 2026-08-26

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：`D3CanvasView` · `chartMountScheduler` · 关联测试 · 性能 profiling 附录 |
| mode | review（用户仅问完成度，不修） |
| fix_mode | none |
| Stack Card | 前端 React 19 + Vite · `fe/` · FastAPI 后端 · 裁决真源 `docs/reviews/grounded/2026-08-26-vitalspan-fe-performance-adjudication.md` |
| 扫描方式 | 主 agent 串行 lane（L1/L7/L11 变更面 + 裁决 §8.4 对账） |
| 证据层 | 未读 `.evidence/`（本批为 companion 性能，非交付 gate） |
| ha_mode | single |
| Blind spots | L4/L5 UI 走查未做；P1 像素画布 Performance 未录成 |
| P0 / P1 / P2 | 0 / 2 / 3 |
| 建议 | **未完成全部验收** — 核心代码已合入且单测绿，但 §8.4 步 0(P1)、步 1(live 减负)、网格选中语义、运行时崩溃各留缺口 |
| 回传 status | **DONE_WITH_CONCERNS** |

**一句话结论**：步 **2（交互 freeze + 非选中停 query）** 与步 **3（单测回归）** 基本到位；步 **1** 只做了 **commit ref 稳定化**，未做柱/线等图的 live 减负；步 **0** 仅 P2/P3 有栈；**不能宣称「§8 全部完成」**。

### Stack Card（摘要）

- 形态：BI 前端 `fe/` + FastAPI `backend/`
- 变更文件（性能相关）：`D3CanvasView.tsx`、`chartMountScheduler.ts`、`chartMountScheduler.test.ts`；辅助 `fe/scripts/perf-profile-*.mjs|py`、profiling 附录
- 跳过 lane：L6 IaC、L8 仓外集成、L9 API 信封（本批未触 API）

---

## 裁决 §8.4 完成度对账

| 步 | 要求 | 状态 | 证据 |
|----|------|------|------|
| **0** | Chrome Performance 三条路径 Top3 栈 | **部分** | [profile-appendix](../grounded/2026-08-26-vitalspan-fe-performance-profile-appendix.md)：P2/P3 ✅；P1 像素画布地图拖缩放 ❌（大屏路由不存在 + 运行时崩溃） |
| **1** | `D3CanvasView` 对齐 `onCommitResizeRef` + live resize | **部分** | `onCommitResizeRef` + `playing` 跳过 layout commit ✅；`onLiveResize` 仍每 100ms 全量 `measureAndRender("live")` ❌（未像 Geo 2D 跳过全量重绘） |
| **2** | 拖拽期 `acquireInteractionFreeze` + 非选中 execute 不重跑 | **基本完成** | `getGate`：`interactionFrozen && ready` → 仅 `priority===0` 可 query；`ChartMountInteractionBridge` 已在 `PixelCanvas`/`DashboardGrid` 接线 |
| **3** | 回归 PixelCanvas / 地图 Inspector | **部分** | `vitest` 21 项绿 ✅；无 `D3CanvasView` 单测；手测 P1 路径被 `classifyDatasetField` 崩溃阻断 |

---

## P1 Findings

### P1-1 · 网格看板拖缩放未保证「操作 widget = priority 0」

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 性能热点 |
| 证据 | `DashboardGrid.tsx` `onDragStart`/`onResizeStart` 只设 `gridPlayingWidgetId`；`DashboardChartMountGate` 的 priority 仍来自 `selected` 而非 playing widget |
| 为何重要 | 冻结期仅 `priority===0` 可 `canQuery`；若拖 B 而选中仍是 A，**A 仍会 execute**，与验收「拖 A 时 B 不闪 loading」不对称，且可能出现反向 case |
| 建议修法 | 冻结期用 `playingWidgetId` 映射 priority，或拖/缩放开始时同步 `onSelect(playingId)`（像素画布 `PixelShape.startInteraction` 已 onSelect，网格应对齐） |
| 可批量 | 是（小改 `DashboardGrid` + 补测） |

### P1-2 · 地图 Inspector 运行时崩溃未闭合（阻塞手测）

| 字段 | 内容 |
|------|------|
| 类别 | 真实缺口 |
| 证据 | Profiling 会话：点选地图 widget 后页面 `classifyDatasetField is not defined`；步 3 手测探针未通过 |
| 为何重要 | 裁决路径含「Inspector 绑字段」；崩溃属 **P0 级体验**（本评审标 P1 因不在本次 diff 内，但阻塞完成声明） |
| 建议修法 | 定位未 import 的 `classifyDatasetField` 引用链并修；补 `ChartMapFieldSlots` 相关 smoke |
| 可批量 | 是（独立 bugfix） |

---

## P2 Findings

### P2-1 · D3CanvasView live resize 仍全量 D3 重绘

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 |
| 证据 | `D3CanvasView.tsx` `onLiveResize` → `measureAndRender("live")`；对比 `D3GeoMapView` 2D 分支仅更新 `lastMeasureRef` |
| 建议 | 对支持 viewBox/CSS 缩放的图类型做增量策略，或文档明确「步 1 仅 commit 环修复」 |
| 可批量 | 中（需分 chartType 评估） |

### P2-2 · 无 D3CanvasView 行为单测

| 字段 | 内容 |
|------|------|
| 类别 | 技术债 |
| 证据 | 无 `D3CanvasView*.test.*`；`onCommitResizeRef` / `playing` 跳过仅靠代码对照 Geo |
| 建议 | 抽 `measureAndRender` 门控为可测 helper 或轻量 render hook 测试 |
| 可批量 | 是 |

### P2-3 · 性能脚本未入 CI / package.json

| 字段 | 内容 |
|------|------|
| 类别 | 技术债 |
| 证据 | `fe/scripts/perf-profile-hotpaths.mjs` 等新增，未登记 `package.json` scripts；Playwright chromium 需本机 install |
| 建议 | 加 `pnpm perf:profile-hotpaths` 并在附录写清前置条件 |
| 可批量 | 是 |

---

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| `playing` 结束改为 `onCommitResizeRef`（force commit） | 与 Geo 对齐；松手后全量重绘属预期 |
| geo Worker spike 未做 | profiling 未达 >50ms 门槛，裁决明确禁止 |
| 像素画布 `startInteraction` 先 `onSelect` | 大屏路径下 priority 与 playing 一致，步 2 有效 |

---

## 测试已执行

```text
vitest: chartMountScheduler (9) · pixelShapePreviewRegistry (2) · chartFieldDrag (3) · mapChartSalesGeo (6) · pixelShapeLiveResize (1) — 全部通过
```

---

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 |
|------|------------|------|
| A 完成声明阻断项 | P1-2 classifyDatasetField | S |
| B 网格选中对齐 | P1-1 | S |
| C 可选深化 | P2-1 live resize · P2-2 单测 | M |

---

## 集成研究建议

无（本批无仓外依赖）。

---

```yaml
status: DONE_WITH_CONCERNS
phase: code-reviewer
mode: review
fix_mode: none
cr_fix_scope: ""
scope: change_surface
report: docs/reviews/code-reviewer/2026-08-26-vitalspan-fe-perf-steps-1-3-completion.md
auto_fixed: []
remaining: [P1-1, P1-2, P2-1, P2-2, P2-3]
coverage:
  blind_spots: ["L4/L5 未浏览器走查", "P1 Performance 未录成"]
  evidence_read: false
external_deps: []
evidence:
  cr: ""
  gate_findings: []
blockers:
  - "§8.4 步 0 P1 与步 3 手测因大屏路由/classifyDatasetField 未闭合"
```
