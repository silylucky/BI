# Feature Truth Audit: 像素画布松手仅宽高补测 / 不闪

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| 核验范围 | Phase 1：geometry fail-closed + 松手不闪（像素画布 D3/表格主路径） |
| 锚点 | `pixelShapeLiveResize.ts` · `PixelCanvas` · `EmbeddedChartLegend` · `useEmbeddedChartLiveResize` · `D3CanvasView` · `ChartRenderer` · `docs/reviews/grounded/2026-08-28-pixel-size-only-remeasure-adjudication.md` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6/10 · C** |
| 状态 | draft（待批准下一刀或仅报告） |
| **sampling** | `full`（本批必验实体；GisMap/CustomViz 显式 Out） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 纯拖移 A：B/C 图表不闪、不整图重绘 | 对话 |
| T2 | 碰撞推位 alone：被推组件不重绘 | 对话 |
| T3 | 仅缩放某组件时，只有该组件补测重绘 | 对话 |
| T4 | 省略/空 `widgetIds` 或图例无 id → **不**全画布广播 | grounded 裁决 Phase1 |
| T5 | 同尺寸 commit 不强制 force 重绘；commit 压制入场动画 | 对话「不闪」 |
| T6 | 松手后 decor/点阵仍在 | 既有 materialize；本批回归 |

**非目标（Out）**：GisMap / CustomViz 管线对齐（Phase 2）；栅格看板统一 bus；浏览器自动化全覆盖。

## 2. 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 规则 T1–T6 | 6 | 0 | 6 | 对话 + 裁决 |
| 交互 B1–B4 | 4 | 0 | 4 | 拖移/缩放/取消/图例 RO |
| 引擎旁路记缺口 | 2 | 2 | 0 | GisMap、CustomViz |

## 3. 完整链路图

```
PixelShape.finish
  → PixelCanvas.handleCommit|Cancel
  → collectGeometryChangedWidgetIds (仅 w/h)
  → notifyGeometryCommitted(changedIds) | cancel 不派发
  → dispatch（空/省略 → 早退）
  → useEmbeddedChartLiveResize / useElementSize（geometryCommitAffectsWidget fail-closed）
  → D3 onCommitResize → measureAndRender("commit", false)
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | size-only collect | 通 | `pixelShapeLiveResize.test.ts` move→`[]` / resize→`["a"]` |
| 2 | 空/省略不派发 | 通 | 同文件 omit/empty 测 |
| 3 | fail-closed !widgetId | 通 | 同文件 |
| 4 | Legend scoped+delta | 通（静态） | `EmbeddedChartLegend.tsx:247-262`；无独立单测 |
| 5 | D3 commit force=false | 通（静态） | `D3CanvasView.tsx:196` |
| 6 | ChartRenderer 松手 | 通（静态） | `ChartRenderer.tsx:372-379` |
| 7 | PixelCanvas 碰撞/拖移 | 通（布局） | `PixelCanvas.test.tsx` 50 例绿；**不断言**图表 redraw 次数 |
| 8 | 感官不闪 / RO 旁路 | **未验** | 无 BROWSER；见 CR P1-1 |

## 3b. 前端控件下钻

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 拖移外框 | `PixelShape`→`handleCommit` | 纯移不派发补测 | 工具层 `changedIds=[]` 且 dispatch 早退 | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 无「0 次 runD3Renderer」断言；RO 旁路未验 |
| B2 | 缩放手柄 | 同上 | 仅该 id 补测 | collect 含 id；commit force=false | 2 | 1 | 2 | 1 | 1 | 7 | PARTIAL | 缺集成测 + BROWSER |
| B3 | 取消交互 | `handleCancel` | 不广播 | 代码不 notify | 2 | 2 | 2 | 2 | 1 | 9 | REAL | 静态+注释；cancel 用例存在 |
| B4 | 图例区 RO | `EmbeddedChartLegendShell` | 无 id 不派发；有 id 仅本组件 | 已改 scoped+delta | 2 | 1 | 1 | 1 | 1 | 6 | PARTIAL | 无单测；栅格无 data-component-id 时静默 |

映射：T1→B1；T2→B1；T3→B2；T4→B4；T5→B2；T6→既有 decor 测（`PixelCanvas` tile decor 用例绿）。

## 3d. 覆盖矩阵

| 实体 ID | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|-------|------------|------|---|---|------|------|
| E1 collect size-only | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL* | vitest 工具测 |
| E2 omit/empty 不派发 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL* | vitest |
| E3 fail-closed | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL* | vitest |
| E4 Legend scoped | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB→PARTIAL 静态 | 读码；无测 |
| E5 D3 commit 无差跳过 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB/PARTIAL 静态 | 读码 |
| E6 不闪（感官） | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 无 BROWSER |
| E7 RO 旁路不打穿 | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | CR P1-1 |
| E8 GisMap/CustomViz | — | — | — | Out | — | — | Out | 裁决 Phase2 |

\*期望含「感官不闪」时，仅 CHAIN 的工具测 **不得**标实体 REAL（C 对 UI 期望上限）。

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 7（E1–E7；E8 Out） |
| GATE only | 2（E4、E5） |
| CHAIN | 3（E1–E3） |
| UI / BROWSER | 0 |
| NONE | 2（E6、E7） |
| REAL 达标 | **0/7** |
| **逐一校验** | **否** — E6/E7 未验；E4/E5 无动态断言；无「redraw 次数」集成测 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| B1 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL |
| B2 | 2 | 1 | 2 | 1 | 1 | 7 | B | PARTIAL |
| B3 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |
| B4 | 2 | 1 | 1 | 1 | 1 | 6 | C | PARTIAL |
| T 汇总（取最低 P0 体感） | — | — | — | — | — | **6** | **C** | **PARTIAL** |

**打通但不对/不全**：B1/B2/B4（总线收口，感官与旁路未证）  
**假功能**：无 STUB 入口冒充  
**未验**：E6 不闪、E7 RO 旁路

## 4. 动态验证命令（已 Read 输出）

```
pnpm exec vitest run …/pixelShapeLiveResize.test.ts …/PixelCanvas.test.tsx
→ Test Files 2 passed · Tests 56 passed（2026-08-28 18:28）
```

未跑：Playwright / browser-reviewer（感官不闪）。

## 5. 修复建议（批准前不改代码）

| 优先级 | 项 | 说明 |
|--------|-----|------|
| P0 产品 | 手测四条 + 记结果 | 硬刷新拖移/碰撞/缩放/图例 |
| P1 | RO 旁路治理 | `useEmbeddedChartLiveResize`：非尺寸语义变化勿 live；或 move-only commit 跳过 `refreshCanvasMetrics` |
| P1 | 集成测 | move 后 `runD3Renderer` 调用次数；勿 mock resize hook |
| P2 | Legend/D3 单测 | 覆盖 scoped / force=false |
| Phase2 | GisMap/CustomViz | Out，不阻塞 Phase1「总线收口」宣称 |

## 6. 结论

- **geometry 总线 Phase1**：工具层可宣称 **收口**（E1–E3 CHAIN 绿）。  
- **「是否完成 / 不闪」产品完成**：**否**（PARTIAL · 6/C · 0 REAL · 逐一校验否）。

---

批准修 P1 旁路 / 交接 root-first-solve / 仅报告？
