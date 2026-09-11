# Feature Truth Audit: 图表标签抽稀 + 样式面板即时刷新

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| 核验范围 | ① 桑基图/矩形树图/关系图密集标签抽稀防叠字；② D3 样式面板改 deStyle 后无需拖组件即重绘 |
| 锚点 | `fe/src/components/charts/engine/d3/core/nodeLabelThinning.ts` · `renderSankey.ts` · `renderTreemap.ts` · `renderForceGraph.ts` · `buildD3CanvasContentKey.ts` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7/10 · B** |
| 状态 | approved-fix |
| sampling | `full`（scope 内 4 项能力 + 4 条用户原话预期） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 桑基图密集列（如 18+ 日期节点）标签**抽稀显示**，相邻标签不叠字 | 用户截图 3 + 对话「该抽稀就抽稀」 |
| T2 | 矩形树图顶行窄格多行标签不横向/纵向叠字，大格优先保留 | 用户截图 1 |
| T3 | 关系图二分图左列密集日期标签不叠字 | 用户截图 2 |
| T4 | 仪表板编辑右侧样式 Tab（如环形图标签内/外、字号）**改后立即反映**，无需拖组件 | 前序对话 + `buildD3CanvasContentKey` 修复 |

**Out**：44 全 chartType 样式面板；漏斗/笛卡尔轴刻度抽稀（已有 `axes.ts`）；浏览器真机走查；GIS/Three 引擎。

## 2. 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 能力 E1–E4 | 4 | 0 | 4 | 本次改动文件 |
| 用户场景 T1–T4 | 4 | 0 | 4 | 对话 |

## 3. 完整链路图

```
T1–T3 标签抽稀
  chartConfig.showLabel → D3RenderConfig.showLabel
  → renderSankey / renderTreemap / renderForceGraph
  → nodeLabelThinning.pick*Visible*
  → pickThinIndicesWithoutBBoxOverlap / pickCandidatesWithoutOverlap
  → 仅渲染 visible 子集（graph 用 display:none）

T4 样式即时刷新
  ChartInspector onChange → chartConfig 新引用
  → buildStyleContext → D3CanvasView contentKey
  → chartDeStyleRenderFingerprint(deStyle) 变更
  → useEffect([contentKey]) → measureAndRender("data", true)
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | 抽稀算法单元 | **通** | `nodeLabelThinning.test.ts` 4/4 绿 |
| 2 | 桑基 render 接线 | **通** | `renderSankey.test.ts` 5/5 绿；密集列 labels < nodes |
| 3 | 矩形树图 render 接线 | **通** | `renderTreemap.test.ts` 4/4 绿；拥挤 data labels < leaves |
| 4 | 关系图 render 接线 | **通** | `renderForceGraph.test.ts` 密集二分图 hidden>0 |
| 5 | contentKey 指纹 | **通** | `buildD3CanvasContentKey.test.ts` 3/3 绿 |
| 6 | D3CanvasView 重绘链 | **通** | `D3CanvasView.test.tsx` deStyle 变更触发二次 `runD3Renderer` |
| 7 | 浏览器视觉 | **未验** | 无 BROWSER / Playwright |

## 3d. 覆盖矩阵

| 实体 ID | 说明 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|------------|------|---|---|------|------|
| E1 | 桑基标签抽稀 | ✅ grep 接线 | ✅ 单测+bbox | ❌ | CHAIN | 2 | 2 | **PARTIAL** | `renderSankey.test.ts` labels<18 + `assertVerticalLabelsNoOverlap` |
| E2 | 矩形树图标签抽稀 | ✅ grep | ✅ 单测+bbox | ❌ | CHAIN | 2 | 2 | **PARTIAL** | `assertTreemapVisibleLabelsNoOverlap` |
| E3 | 关系图标签抽稀 | ✅ grep | ✅ render 密集 | ❌ | CHAIN | 2 | 2 | **PARTIAL** | `renderForceGraph.test.ts` 18 左列；drag end 重算抽稀 |
| E4 | 样式 contentKey 即时刷新 | ✅ 静态 | ✅ key+D3CanvasView | ❌ | CHAIN | 2 | 2 | **PARTIAL** | `D3CanvasView.test.tsx` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 4 |
| GATE only | 0 |
| CHAIN | 4 |
| UI / BROWSER | 0 |
| NONE | 0 |
| REAL 达标 | 0/4（深度上限，缺 BROWSER） |
| **逐一校验** | **否** — T1–T4 仍缺浏览器 L1 |
| **总体可否 REAL** | **否** |

## 3b. 前端控件下钻（T4 相关）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 样式 Tab · 标签位置 内/外 | `ChartInspector` → `patchChartLabelStyle` | 改后画布立即更新 | **未 UI 验**；contentKey 会变 | 1 | 1 | — | — | — | 5 | PARTIAL | `buildD3CanvasContentKey.test.ts` |
| B2 | 样式 Tab · 标签字号 | 同上 | 改后字号立即变 | **未 UI 验**；contentKey 会变 | 1 | 1 | — | — | — | 5 | PARTIAL | 同上 |

功能块映射：T4 → B1, B2

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 桑基抽稀 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | CHAIN+bbox；缺 BROWSER |
| T2 矩形树图抽稀 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 同上 |
| T3 关系图抽稀 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | render 密集测 + drag 重算 |
| T4 样式即时 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | D3CanvasView 链；缺样式面板 UI |
| **T 汇总（取最低）** | 2 | 2 | 2 | 2 | 2 | **7** | **B** | **PARTIAL** | 全项 CHAIN 达标；总体仍缺 BROWSER |

**打通但不对**（L≥2 且 C≤1）：无（均为「部分证据」而非结果错）  
**假功能**：无

## 4. 动态验证记录

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest run nodeLabelThinning.test.ts` | 4 绿 | 4 passed | ✅ | 2026-08-28 10:46 |
| 2 | `vitest run renderSankey.test.ts` | ≥5 绿，含抽稀用例 | 5 passed | ✅ | 同上 |
| 3 | `vitest run renderTreemap.test.ts` | ≥4 绿，含 crowded | 4 passed | ✅ | 同上 |
| 4 | `vitest run buildD3CanvasContentKey.test.ts` | 3 绿 | 3 passed | ✅ | 同上 |
| 5 | `renderForceGraph.test.ts` 密集二分图 | labels 抽稀 | 3 passed，hidden>0 | ✅ | 2026-08-28 10:53 |
| 6 | `D3CanvasView.test.tsx` | 样式变→二次 render | 1 passed | ✅ | 同上 |
| 7 | 浏览器复现用户三图 | 无叠字 | **未执行** | ❌ | — |

**命令输出摘要**（2026-08-28 复验）：

```
Test Files  6 passed (6)
Tests       20 passed (20)
```

## 5. 静态审计结论（改得对不对）

### ✅ 方向正确、实现合理

1. **根因判断准确**：此前抽稀存在于 `axes.ts` / `pieLabels.ts` / `radarLabels.ts`，**桑基/矩形树图/关系图从未接入**——不是「失效」，是「未做全」。
2. **算法复用正确**：`nodeLabelThinning.ts` 复用 `pickThinIndicesWithoutBBoxOverlap`（纵向列）与 `pickCandidatesWithoutOverlap`（矩形树图面积优先），与项目既有抽稀体系一致。
3. **桑基按 depth 分列抽稀**：符合左右列独立叠字场景。
4. **桑基补 `showLabel`**：与 `D3RenderConfig` 契约对齐（此前标签强制渲染）。
5. **样式即时刷新**：`chartDeStyleRenderFingerprint` 纳入 `contentKey` 可解释「拖组件才刷新」（resize 强制 `measureAndRender(..., true)`）——**逻辑上应修复**。

### ⚠️ 残留风险（未证伪）

| 风险 | 严重度 | 说明 |
|------|--------|------|
| E3 render 无密集集成测 | P1 | 二分图左列 30+ 节点仅 unit 覆盖，render 接线未回归 |
| 无 DOM 叠字断言 | P1 | 单测只断言 `labels.length < n`，未读 SVG `y`/bbox 证明不重叠 |
| T4 无 D3CanvasView 链 | P1 | contentKey 变 ≠ 实测 `measureAndRender` 触发 |
| graph 拖节点后未重算抽稀 | P2 | `syncLabelVisibility` 仅在 `finishLayout`；`drag end` 只 `freezeLayout()` |
| 矩形树图顶行极窄格 | P2 | bbox 用完整文本宽，贪心应跳过多数；**未浏览器确认**截图场景 |
| 桑基左列 `text-anchor:end` 长文本 | P3 | 纵向不叠，仍可能向左溢出组件（裁切链另题） |

## 6. 已实施修复（2026-08-28 用户批准）

| 项 | 改动 |
|----|------|
| P1 | `labelSpacingTestHelpers.ts` — 桑基/矩形树图 bbox 叠字断言 |
| P1 | `renderForceGraph.test.ts` — 18 节点密集二分图抽稀验收 |
| P1 | `D3CanvasView.test.tsx` — deStyle 变更触发 `runD3Renderer` |
| P3 | `renderForceGraph.ts` — `drag end` 调用 `syncLabelVisibility()` |

## 7. 待办（可选）

### BROWSER — 用户三图走查（P2）

**修后验收**：T1–T3 C≥2 有截图证据。

### 样式面板 UI 集成测（P2）

**修复方向**：ChartStylePanel userEvent 改标签位置 → 画布 DOM 变。  
**修后验收**：T4 深度 UI，总体可评 REAL（若 BROWSER 亦绿）。

## 8. 结论

| 问题 | 回答 |
|------|------|
| 之前抽稀失效了吗？ | **否**，是三类图**从未接入** |
| 这次改法对不对？ | **方向对、接线合理**，CHAIN 单测 16/16 绿 |
| 能标 REAL 吗？ | **仍不能** — CHAIN 证据已齐，缺 BROWSER 与样式面板 UI |
| 用户现在能用吗？ | **应已明显改善**；建议浏览器刷新后目视确认三图 |

---

**下一步（可选）**：浏览器走查三图截图对比；或补 ChartStylePanel UI 集成测后复验标 REAL。
