# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-28

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：像素画布「松手仅宽高补测」+ 背景 decor（主根 `fe/src/components/dashboard/pixelCanvas/` · hooks · D3 views · EmbeddedChartLegend · decor 配置） |
| mode | auto-fix |
| fix_mode | confirm-batch（待确认） |
| cr_fix_scope | （待用户确认后填） |
| Stack Card | 见下 |
| 扫描方式 | 并行 explore lane：L1 假绿/闭环 · 行为对账 · L5 decor；`scan_tools: ast-grep+codegraph 可用但本批以 rg 深读为主` |
| 证据层 / 外部依赖 | 无 `.evidence/`（Blind spot）；本批无仓外依赖（L8 合理跳过） |
| ha_mode | single（arch 单机/compose；§18 跳过） |
| Blind spots | 无证据层；未做浏览器真机复现 R4 decor 闪没；未压测 |
| Lane 密度 | L1/行为/L5 均 ≥5 或 EXHAUSTED |
| P0 / P1 / P2 | 1 / 5 / 4 |
| 建议 | **不可宣称完成**；先修 P0+P1 再验收「未碰不刷新」 |
| 回传 status | DONE_WITH_CONCERNS |
| 已排除非问题 | 测试双边界；DashboardGrid 无 geometry commit（栅格靠 RO，本批焦点为像素画布）；默认管理员种子无关 |

一句话结论：**像素画布主 commit 路径（仅宽高 → scoped 派发 / 空数组不广播 / cancel 不派发）已基本正确，但图例旁路仍可全画布广播，且 GisMap/CustomViz/集成测未闭环 → 不能宣称「已完成」。**

### Stack Card（摘要）

- 形态：VitalSpan BI monorepo；本批纯前端交互
- 语言 / 框架：TypeScript · React 19 · Vite · `fe/`
- 跳过的 lane：L3/L6/L9/L10/L11（无服务端/IaC/API/安全变更）；L8（无仓外依赖）；L4 表单（本批无表单主路径）
- 宣称材料：会话内产品规则——未碰不刷新、碰撞 alone 不重绘、仅宽高 remasure、decor 松手不消失

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 证据层 | 未消解 | `.evidence/` | 仓内无证据层 → 不得写「可上线」 |
| R4 真机 | 边缘 | decor 松手闪没 | 代码路径已封堵；未 browser-reviewer 复现 |
| L1 结构性 | 降级 | ast-grep 未跑规则包 | 本批以调用链深读为主；记 Blind spot 边缘 |

## 完成度判定（针对用户「是否完成」）

| 规则 | 像素画布主路径 | 旁路/其它引擎 | 可否宣称 |
|------|----------------|---------------|----------|
| 未碰组件松手不刷新 | ✅ `collectGeometryChangedWidgetIds` + `[]` 不派发 | ❌ Legend 可 `dispatch(undefined)` 全广播 | **否** |
| 碰撞推位 alone 不重绘 | ✅ 仅比 w/h | — | 主路径是 |
| 仅宽高变才 remasure | ⚠️ 派发层是；引擎 `force=true` 仍可无差重绘 | Legend RO 无 delta | **否** |
| decor 松手不消失 | ✅ materialize + style 不跟 layout | 清空底色会 wipe（边角） | 主路径是 |

**总判：部分完成 · 不可宣称交付完成。**

## P0 Findings

### P0-1 · EmbeddedChartLegend 可全画布 geometry 广播

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 产品表面（破坏「未碰不刷新」） |
| 证据 | `fe/src/components/charts/EmbeddedChartLegend.tsx:247-257` — `dispatchPixelLayoutGeometryCommitted(widgetId ? [widgetId] : undefined)`；`widgetId` 解析失败或栅格无 `data-component-id` 时省略 ids → `geometryCommitAffectsWidget` 对所有 listener 为 true；mount 时即 `notify()` |
| 为何致命 | 绕过 `PixelCanvas.collectGeometryChangedWidgetIds`；任一带 shell 图例的 RO 抖动可令全画布图表 commit 重绘，直接否定本批产品规则 |
| 建议修法 | ① 无 widgetId 时**禁止**广播（不派发或派发空并早退）；② RO 先比 chartArea 宽高 delta；③ 栅格 widget 补 `data-component-id` 或 legend 改局部回调 |
| xref | [P1-2, P1-3] |
| 可批量 | 是（批次 A） |

## P1 Findings

### P1-1 · GisMapView / CustomViz 未接入 size-only / isPlayer 管线

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 真实缺口 |
| 证据 | `GisMapView.tsx` 仅 RO+footprint；`CustomVizWidget.tsx` `useElementSize` 无 `paused: playing` |
| 为何致命 | 同画布多引擎行为不一致；resize 拖拽期 custom viz 仍可能持续 inject |
| 建议修法 | 接入 `useEmbeddedChartLiveResize` + `geometryCommitAffectsWidget`；custom viz `paused: playing` |
| xref | [] |
| 可批量 | 是（批次 B） |

### P1-2 · `geometryCommitAffectsWidget`：`!widgetId → true`

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `pixelShapeLiveResize.ts:48` — 解析失败仍响应 scoped 事件 |
| 建议修法 | scoped 事件下 `!widgetId` → `false`（fail-closed） |
| xref | [P0-1] |
| 可批量 | 是（批次 A） |

### P1-3 · D3 `onCommitResize` 恒 `force=true` 绕过尺寸相等检查

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 / 产品规则 |
| 证据 | `D3CanvasView.tsx` / `D3GeoMapView.tsx` — `measureAndRender("commit", true)`；`!force && !embeddedSizeChanged` 被绕过 |
| 建议修法 | commit 先读 paint size，仅尺寸变化或明确脏标记时 force |
| xref | [P0-1] |
| 可批量 | 是（批次 A） |

### P1-4 · size-only 无端到端测；D3 单测 mock 掉 resize 管线

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·测试 |
| 证据 | `D3CanvasView.test.tsx` mock `useElementSize`/`useEmbeddedChartLiveResize`；仅有工具函数单测 |
| 建议修法 | 补：`dispatch([])` vs `["w1"]` 断言 renderer 调用次数；至少一条不 mock hook 的路径 |
| xref | [] |
| 可批量 | 是（批次 C） |

### P1-5 · ChartRenderer playing 结束强制 `remeasureBody`

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `ChartRenderer.tsx:372-381` — `suspendLiveResize` false 时 effect 重跑 `remeasureBody()`，与尺寸是否变化无关 |
| 建议修法 | 与 `useElementSize` 相等短路叠加后仍建议仅在 footprint/size dirty 时 remeasure；或去掉该过渡补测改仅依赖 scoped commit |
| xref | [] |
| 可批量 | 是（批次 A） |

## P2 Findings

- **P2-1** 清空画布底色连带 wipe decor（`dashboardCanvasBackgroundPanel.tsx`）
- **P2-2** 主题切换不 rematerialize tile 纹理色（`dashboardThemeVariants.ts`）
- **P2-3** decor 与辅助网格可叠层；命名「点阵」双轨
- **P2-4** `PIXEL_LIVE_RESIZE_DEBOUNCE_MS` 死常量；`flushCommitResize` 在 `el==null` 仍可能 commit

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| PixelCanvas 主 commit size-only | 已实现且单测覆盖工具函数 |
| handleCancel 不广播 | 符合「取消无宽高变化」 |
| DashboardGrid 无 geometry commit | 非本批像素画布焦点；move-only 通常不改 cell 尺寸 |
| 测试双 mock 外部依赖 | 豁免；但 mock **被测 resize 管线** 已升为 P1-4 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | Subagent 建议 |
|------|------------|------|----------------|
| A 关旁路广播 | P0-1, P1-2, P1-3, P1-5 | M | Legend fail-closed + D3 commit 尺寸守卫 + ChartRenderer |
| B 引擎对齐 | P1-1 | M | GisMap + CustomViz 接入管线 |
| C 防假绿测 | P1-4 | S | 集成断言 move vs resize |
| D decor 边角 | P2-1…P2-3 | S | 确认后可选 |

---

确认修全量(P0+P1+P2)？或指定 P0 / P0+P1？
