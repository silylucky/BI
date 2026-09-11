# Code Review · 标准分析 Hub UX-R2 完成度

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-20 |
| mode | review（完成度对账，非整仓扫） |
| scope | `spec_ref=docs/specs/standard-analysis-hub-ux-r2.md` 变更面 |
| 结论 | **DONE_WITH_CONCERNS** — 规格 **A/B/C 主验收已落地**；缺 A6 真机举证 + 文档同步 + 少量 P2  polish |

## Stack Card

| 项 | 值 |
|----|-----|
| 栈 | React 19 · Vite · fe/ · vitest |
| 范围 | change_surface · 7 改 + 1 增 smoke |
| scan_tools | rg + 规格逐条对账 |
| ha_mode | single（FE-only） |
| evidence_read | false（无 `.evidence/` gate） |

## 规格完成度总表

| 批次 | 通过 | 部分 | 未做 |
|------|------|------|------|
| UX-R2a P0 | 6/7 | A6 | — |
| UX-R2b P1 | 4/4 | — | — |
| UX-R2c P2 | 3/3 | — | — |
| 边界 F1–F4 | 3/4 | F1 无单测 | — |
| 实现决策 D1–D6 | 6/6 | — | D7 文档 |

**自动化**：`pnpm exec vitest run src/pages/admin/reports` → **91/91 绿**

---

## Findings

### P2-1 · A6 首屏 50vh 无浏览器工件

| 项 | 内容 |
|----|------|
| 级别 | **P2** |
| 规格 | A6：1280×720 走查或固定高度 smoke |
| 实际 | 仅有布局类名 `flex-1 min-h-0`；**无** browser-reviewer 截图 / Playwright 高度断言 |
| 建议 | deploy-dev 或 browser-reviewer 补 1 张走查图；或 vitest + `container` 固定 `720px` 测表顶 offset |

### P2-2 · 侧栏投递 Badge 第二行（A1 字面偏差）

| 项 | 内容 |
|----|------|
| 级别 | **P2** |
| 证据 | `StandardAnalysisPackList.tsx` L105–135：数据+快照一行，**投递单独第二行**（为避免 `a` 嵌 `button` 已拆结构） |
| 规格 | A1 写「1 行状态 ≤3 Badge」 |
| 影响 | 视觉仍比改前精简；非功能缺口 |
| 建议 | 接受现状或把三 Badge 并回一行（投递用 `onClick+navigate`，勿嵌套交互） |

### P2-3 · xl 标题副标题仍含口径（B1 边缘重复）

| 项 | 内容 |
|----|------|
| 级别 | **P2** |
| 证据 | `StandardAnalysisResultPanel.tsx` L117–119：`themeAggregationHint` 仍在 xl 副标题 |
| 规格 | B1 要求 Strip 不重复；折叠区 + dataMetaNote 已去重 |
| 建议 | 可选删 xl 副标题中的 hint，只留「实时查询/周期对比」 |

### P2-4 · 矩阵对比模式 Strip 无 compareSummary

| 项 | 内容 |
|----|------|
| 级别 | **P2** |
| 证据 | `ResultPanel` 仅在 `compareLayout === "pair"` 传 `compareSummary` |
| 影响 | matrix 模式 compact 条只显示「最近快照」，无「对比期」 |
| 建议 | matrix 模式传简化 summary 或隐藏对比期行 |

### P2-5 · F1 非 manage 用户无自动化断言

| 项 | 内容 |
|----|------|
| 级别 | **P2** |
| 证据 | `canManage && viewMode === "live"` 门禁在 `ResultPanel` L189；**无** smoke 覆盖 |
| 建议 | hub-ux smoke 增一例 `canManage={false}` |

### P2-6 · D7 文档未同步（规格声明非阻塞）

| 项 | 内容 |
|----|------|
| 级别 | **P2** |
| 缺失 | `docs/automate/prd/F08-RPT.md` F-B 文案；`docs/ui/layout.md` 数优先 IA |
| 建议 | 合并前最小 diff 回写 |

---

## 已确认通过（无 finding）

| ID | 证据 |
|----|------|
| A1 主题 chip 删除 | `PackList` 无 `enabledThemes.map`；`hub-ux.smoke` |
| A2 MetaRow xl 隐藏 | `xl:hidden` + `standard-analysis-meta-row-mobile` |
| A3 紧凑 Strip | `observability-compact`；无保存按钮 |
| A4 工具栏快照 | `standard-analysis-capture-toolbar` |
| A5 inline KPI + flex | `LiveSummaryStrip` flex；`SectionChart` flex-1 |
| A7 测试 | 91 绿 + observability/hub-ux smoke |
| B1–B2 Strip 去重 | compact 无口径/节奏；compare 两列 |
| B3–B4 图表默认 | `defaultLivePresentationMode` + 单测 bar |
| C1–C3 折叠/侧栏投递 | `Collapsible` + `pack-delivery` Link |
| F2–F4 | 暂无快照文案；错误 Banner 未动；侧栏+compact 可见投递/快照 |
| D1–D6 | FE-only；无新 API |

---

## 对用户问题「是否完成？」

| 口径 | 结论 |
|------|------|
| **go-fast 规格 UX-R2a/b/c 代码** | **是** — 可交付使用，vitest 全绿 |
| **规格 100% 字面验收** | **否** — A6 浏览器举证未做；A1 投递行布局略偏 |
| **PRD/文档闭环** | **否** — D7 待补（非代码阻塞） |

**一句话**：功能与 IA 重构 **已完成并可上线试用**；若要以规格书「全绿勾选」收口，还需 **A6 走查截图 + D7 文档两行 + 可选 P2 polish**。

---

## 建议修复批次（若确认修）

| 批次 | 内容 | 级别 |
|------|------|------|
| 1 | hub-ux smoke：`canManage=false` 无快照按钮 | P2 |
| 2 | matrix 对比 `compareSummary` 或 Strip 文案 | P2 |
| 3 | xl 副标题去 `themeAggregationHint` | P2 |
| 4 | `F08-RPT.md` + `layout.md` 最小同步 | P2 |
| 5 | browser-reviewer A6 截图 | P2 |

默认 **confirm-batch**：请确认是否修 **P2 全量** 或仅 **文档+D7**。
