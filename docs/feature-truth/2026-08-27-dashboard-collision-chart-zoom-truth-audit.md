# Feature Truth Audit: 仪表板碰撞松手整理 + 缩放下图表填满

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-27 |
| 核验范围 | ① 编辑态 `paintMaxEdge` 降采样后图表仍填满 widget；② 拖动预览用重合阈值、松手提交任意重叠触发碰撞推挤 |
| 锚点 | `fe/src/components/dashboard/pixelCanvas/*` · `fe/src/components/charts/engine/d3/core/sceneGraph.ts` · `fe/src/lib/dashboardEditChartPerf.ts` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7/10 · B** |
| 状态 | approved-fix（P1 测试基建已落地） |
| sampling | `full`（scope 内 6 项能力 + 2 条用户原话预期） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 浏览器/视口缩小后，编辑态未选中组件图表仍**铺满** widget 内容区，不出现左上角残缺 | 用户截图 + 对话 |
| T2 | **拖动中**：两轴重叠未超过「重合阈值」时，邻块不预览推挤 | 配置说明 + 对话 |
| T3 | **松手后**：任意重叠即触发碰撞整理，邻块被推开，不留叠加 | 用户原话「松手后一定要取消阈值」 |
| T4 | 从组件库拖入、Tab 子组件拖出落位，与 T3 同严格度 | 代码路径一致性 |
| T5 | **数据大屏**（`surfaceKind=data-screen`）仍允许自由叠放，不跑碰撞 | `allowsPixelWidgetOverlap` · ADR |

**Out**：栅格看板（非 pixel canvas）；customViz HTML 运行时；GIS MapLibre / Three.js 地球裁切（独立引擎）。

## 2. 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 能力 E1–E6 | 6 | 0 | 6 | 见 §3d |
| 用户场景 T1–T5 | 5 | 1（T5 为反向预期） | 4 | 对话 |

## 3. 完整链路图

```
T1 图表缩放
  DashboardWidget.paintMaxEdge → D3CanvasView.readPaintSize → capChartPaintSize
  → runD3Renderer → appendChartSvg / normalizeEmbeddedChartSvgs
  → SVG viewBox + width/height 100%

T2/T3 碰撞
  PixelCanvas.handlePreview → resolveActiveAt(phase=preview, minOverlap=buffer)
  PixelCanvas.handleCommit → resolveActiveAt(phase=commit, minOverlap=0)
  → resolvePixelCollisions → emptyTargetFootprint
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | SVG 可拉伸根节点 | **通** | `sceneGraphLayout.test.ts` 5/5 绿 |
| 2 | 降采样后 normalize | **通** | `normalizeEmbeddedChartSvgs` 单测 |
| 3 | 碰撞预览缓冲 | **通** | `collisionLayout.test.ts` shallow 用例 |
| 4 | 碰撞提交零阈值 | **通** | `collisionLayout.test.ts` commit 用例 + `PixelCanvas.test` move/resize overlap 2 例绿 |
| 6 | PixelCanvas 全量回归 | **通** | `PixelCanvas.test.tsx` **45/45** 绿（2026-08-27 13:42） |
| 5 | 浏览器缩放下视觉 | **未验** | 无 BROWSER / Playwright |

## 3d. 覆盖矩阵

| 实体 ID | 说明 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|------------|------|---|---|------|------|
| E1 | `applyScalableChartSvgDisplay` | ✅ 静态 | ✅ 单测 | ❌ | CHAIN | 2 | 2 | PARTIAL | `sceneGraphLayout.test.ts` |
| E2 | `normalizeEmbeddedChartSvgs` 覆盖饼/漏斗等 | ✅ grep | ✅ 单测 | ❌ | CHAIN | 2 | 1 | PARTIAL | 无 renderPie 集成断言 |
| E3 | `paintMaxEdge` 仍 cap 绘制 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `dashboardEditChartPerf.test.ts`；无 widget 级 DOM |
| E4 | 预览 `minOverlap=buffer` | ✅ | ✅ | ⚠️ 1 例 | CHAIN | 2 | 2 | PARTIAL | `collisionLayout.test.ts:71-80` · `PixelCanvas` preview 用例绿 |
| E5 | 提交 `minOverlap=0` | ✅ | ✅ | ⚠️ 2 例 | CHAIN | 2 | 2 | PARTIAL | `collisionLayout.test.ts:82-99` · `PixelCanvas` move+resize overlap 绿 |
| E6 | 拖入/Tab 出 `createPixelWidget`/`tabParking` | ✅ 静态 | ✅ 单测 | ❌ | CHAIN | 2 | 2 | PARTIAL | `collisionLayout.test.ts` palette insert 用例 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 6 |
| GATE only | 0 |
| CHAIN | 6 |
| UI / BROWSER | 0 |
| NONE | 0 |
| REAL 达标 | 0/6（深度上限） |
| **逐一校验** | **否** — T1 仍缺浏览器 L1 |
| **总体可否 REAL** | **否**（T1 未 BROWSER 验真） |

## 3b. 前端控件下钻（本 scope 无独立配置控件）

本批修复为运行时行为，不新增 UI 控件。碰撞阈值 slider 见 [2026-08-27-dashboard-alignment-snap-truth-audit.md](./2026-08-27-dashboard-alignment-snap-truth-audit.md)（文案已更新为「拖动预览 / 松手整理」）。

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 缩放下图表填满 | 2 | 1 | 0 | 2 | 1 | 6 | C | PARTIAL | CHAIN 有，无浏览器对比 |
| T2 拖动预览缓冲 | 2 | 2 | 1 | 2 | 2 | 9 | A | PARTIAL* | 深度仅 CHAIN |
| T3 松手零阈值碰撞 | 2 | 2 | 1 | 2 | 2 | 9 | A | PARTIAL* | 同上 |
| T4 拖入/Tab 出 | 1 | 1 | 1 | 2 | 2 | 7 | B | STUB | GATE-only |
| T5 大屏允许叠放 | 2 | 2 | 1 | 2 | 2 | 9 | A | REAL* | 设计如此；用户若在**大屏**验 T3 会误判为未修 |

\*深度上限：无 BROWSER 时 T1 不得 REAL；T2/T3 逻辑 REAL 但验收深度 PARTIAL。

**打通但不对**：0（逻辑层无反向证据）  
**假通/未验**：T1 浏览器视觉；E6 拖入链

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `vitest collisionLayout.test.ts` | 26 绿 | 26 passed | ✅ | 2026-08-27 13:34 命令输出 |
| 2 | `vitest sceneGraphLayout.test.ts` | viewBox 100% | 5 passed | ✅ | 同上 |
| 3 | `vitest PixelCanvas.test -t overlap` | move/resize 浅重叠提交推挤 | 2 passed | ✅ | `commits move when overlap…` · `keeps resize commit…` |
| 4 | `vitest PixelCanvas.test.tsx` 全文件 | 45 绿 | 45 passed | ✅ | 2026-08-27 13:42 |
| 5 | `vitest collisionLayout` palette insert | 推邻块 | 27 passed | ✅ | 新增 E6 用例 |
| 6 | 浏览器缩小页面目视 | 图表铺满 | **未执行** | — | UNVERIFIED |

## 5. 修复文档（残余 P0/P1）

### T1 — 缩放下图表残缺（残余风险）

**判定**：PARTIAL 6/10，C=1  
**期望 vs 实际**：期望浏览器缩小后仍铺满；实际仅证明 SVG 根节点可拉伸，**未在真实编辑页复现用户截图场景**。  
**根因**：`paintMaxEdge` 与固定像素 SVG 的历史组合已通过 viewBox 修复；customViz / 部分非 `appendChartSvg` 路径依赖 `normalizeEmbeddedChartSvgs` 事后补丁，升采样可能略糊。  
**修后验收**：BROWSER：缩小至 67% → 未选中大 widget 图表铺满无左上角空白；C≥2。  
**优先级**：P1（若用户仍反馈残缺则升 P0）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T1 | 浏览器缩小编辑页走查（本地 dev 未自动执行） |
| — | T5 | 若在大屏编辑验碰撞，属预期叠放，非 bug |

## 7. 交接

- **能否说「没问题了」？** **仪表板碰撞松手 + 单测回归可放心**（45/45 + 27 collision）；**图表缩放**仍建议本地浏览器目视一次（T1）。
- 用户批准修复：**是**（P1 测试基建 + E6 单测已落地）
- 残余：T1 BROWSER 走查待用户或下一轮补 Playwright

### 测试基建 — PixelCanvas TooltipProvider

**状态**：**已修复**（2026-08-27）  
**改动**：`renderPixelCanvas` / `rerenderPixelCanvas` 统一包裹 `TooltipProvider`；`pointercancel` 无移动不提交、有移动则提交（拆为两条用例）。

### E6 — 组件库拖入碰撞（已补单测）

**状态**：CHAIN 已覆盖 `insertPixelPaletteWidgetAt` 浅重叠推邻块。
