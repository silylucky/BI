# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-28（表格样式变更面复扫）

## 总览

| 项 | 内容 |
|----|------|
| 范围 | **PR·变更面**：`fe/src/lib/chartDeTableStyle.ts` · `ChartTableStylePanel.tsx` · `VitalSpanTable.tsx` · `D3TableView.tsx` · `useTableLayoutResize.ts` · `buildTableModel.ts` · `index.css`（像素画布表格/SVG）+ 上追一层：`ChartInspectorProvider` · `DashboardEditPage` · `ChartRenderer` |
| Stack Card | 后端 FastAPI · 前端 React 19 + Vite + Tailwind v4 · 表格引擎 D3/VitalSpanTable · 看板像素画布 |
| 扫描方式 | 主 agent 串行 lane（L1/L7 深度追链 + L4 表单/面板）；`scan_tools: rg-only`（无 ast-grep 规则包执行；结构性假绿 Blind spot 保留） |
| 证据层 / 外部依赖 | **无 `.evidence/`**（记 Blind spot）；本变更面无仓外依赖（L8 跳过） |
| Blind spots | ① 无浏览器走查（排序图标视觉、滑块即时预览、编辑/预览 WYSIWYG）② 无 ast-grep 结构性扫描 ③ 无 `.evidence/` gate-check |
| P0 / P1 / P2 | **2 / 4 / 1** |
| 建议 | **P0 已修（A+B+C）**；建议硬刷新后浏览器验真（批次 D） |
| 回传 status | **DONE_WITH_CONCERNS**（浏览器主路径未自动化验真） |
| 已排除非问题 | 表格配色在独立「表格配色」Tab（`ChartTableColorPanel`）属产品设计，非 stub；测试双目录内 mock 不进 findings |

一句话结论：**上轮补丁在单测层通过，但用户反馈「一个都没修」成立——根因是修复未覆盖 table-info 典型数据路径（仅 `axes.xAxis.field`、无 `label`），且行/列拖拽 `commit` 会无条件污染 `columnWidthsPx`，使面板列宽比例与行高配置在真实看板上被覆盖或看似无效。**

### Stack Card（摘要）

- 形态：SPA `fe/` + FastAPI；标杆 UI：看板编辑右栏 `ChartEditRail`
- 跳过的 lane：L2 硬编码、L3 可靠性、L6 IaC、L8 隐式假通（与本次变更无关）
- 宣称材料：样式面板文案已交付「列宽比例」「行高」「不透明度」等（命中 L7 宣称判据）
- `scan_tools`: rg-only + 关键文件精读 + vitest 17/17 绿（**不代表运行时已修**）

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| L7 浏览器验真 | 失败后补扫仍不足 | 像素画布明细表：排序图标尺寸、样式滑块→画布联动、编辑/预览对比 | 无 Playwright/BROWSER；用户原话「都没修」需运行时佐证 |
| L1 结构性 | rg-only | 全仓 stub 形状 | 未跑 ast-grep 规则包 |
| Phase 2.5 | 跳过 | `.evidence/` | 仓内无证据层 |

**判定**：变更面核心（表格样式下发链）已代码追链；但 **浏览器主路径未验** → 不得写「可上线 / 本批干净」。

## P0 Findings

### P0-1 · 中文列名修复未覆盖 table-info 典型路径（用户仍见英文字段名）

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 真实缺口 |
| 证据 | `resolveChartFieldLabel`（`chartDeTableStyle.ts:236-245`）仅在 `dimensions/metrics/axes.*.label` 存在时返回中文；`writeAxisField`/`setAxisField`（`resolveChartEncoding.ts:71-80`）拖字段只写 `{ field }` 无 `label`；`useInspectorColumns` 只返回 SQL 列名无中文别名。`buildTableModel.columnMeta`（`buildTableModel.ts:22-30`）**不读** `encoding.axes.xAxis[].label`，表头仍回退 `field`。单测只在 `dimensions` 带 `label` 时断言中文（`chartDeTableStyle.test.ts:45-56`），**未覆盖** table-info 仅 `axes.xAxis` 场景（`buildTableModel.test.ts:22-37` 用例无 label 断言）。 |
| 为何致命 | UI 已宣称「列宽比例 %」按列展示，但典型明细表拖字段后 `grid_name`/`event_count` 仍原样显示——用户判定「英文没修」。 |
| 建议修法 | 统一标签解析：`columnMeta`/`resolveChartFieldLabel` 共用 `resolveFieldDisplayLabel(cfg, field)`；拖字段时写入 `label`（数据集元数据或 `humanizeColumnName` 回退）；补 table-info + 仅 xAxis 无 label 的集成测。 |
| 可批量 | 是（批次 B） |

### P0-2 · 行/列拖拽 commit 无条件写入 `columnWidthsPx`，覆盖面板「列宽比例 %」

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 静默做错事 |
| 证据 | `useTableLayoutResize.commit`（`useTableLayoutResize.ts:134-141`）每次松手都提交完整 `columnWidthsPx`；`startRowResize` 在 `!pixelActive` 时先 `hydrateFromDom()`（`238-245`），DOM 测宽写入像素列宽；`VitalSpanTable` 在 `columnWidthMode==="custom"` 且存在 `columnWidthsPx` 时走像素布局（`263-266`），**优先于** `columnWidths` 百分比（`buildTableColumnWidthPlan`）。面板 `patchColumnWidth` 虽会 `columnWidthsPx: undefined`（`ChartTableStylePanel.tsx:48-55`），但用户若曾拖行高/列宽或历史布局已污染，则调 % 滑块前仍被 px 覆盖。 |
| 为何致命 | 样式面板控件可点、单测可绿，但真实看板「绝大多数表格配置不生效」——列宽比例、行高与拖拽状态互相污染。 |
| 建议修法 | 行高-only commit 只写 `rowHeightPx`；列宽 commit 才写 `columnWidthsPx`；`hydrateFromDom` 与 `pixelActive` 触发条件与 `columnWidthMode` 对齐；提供迁移/「重置列宽」清脏数据。 |
| 可批量 | 是（批次 A） |

## P1 Findings

### P1-1 · 单测路径与生产主路径错位（假绿背书）

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·测试 |
| 证据 | `ChartTableStylePanel.test.tsx` 用 `chartType: "table"` + `dimensions`；`VitalSpanTable.columnWidth.test.tsx` / `D3TableView.tableStyle.test.tsx` 直接注入 `deTableStyle`，未走 `DashboardEditPage` → `ChartRenderer` → 画布；无「拖字段后面板标签」「% 列宽覆盖旧 px」E2E。 |
| 为何应修 | CI 绿但用户现场仍坏，符合「mock 掉被测主路径」特征。 |
| 建议修法 | 增 table-info + xAxis-only fixture；DOM 测 `hydrateFromDom` 后不污染 % 模式；可选 Playwright 一条。 |
| 可批量 | 是（批次 C） |

### P1-2 · `buildTableModel.columnMeta` 与样式面板标签源不一致

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | 面板用 `resolveChartFieldLabel`（读 axes）；表头用 `columnMeta`（不读 axes）。即使后续在 axes 写入 label，表头仍可能英文。 |
| 建议修法 | 提取共享 `resolveTableColumnLabel(encoding, field)`，两处引用。 |
| 可批量 | 是（批次 B，与 P0-1 同批） |

### P1-3 · 编辑态 vs 预览态：像素画布 chrome-scale 与表格字号策略

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 风格 |
| 证据 | `index.css:477-480` 表格 `th/td` 用固定 `--dw-screen-table`；编辑态标题等用 `--pixel-canvas-chrome-scale` 反比补偿（`411-412`）。`layoutInteractive` 编辑 true / 预览 false（`D3TableView.tsx:131,168`）导致列宽拖拽仅编辑可用。用户反馈「编辑和预览不一致」可能叠加缩放与交互差异。 |
| 建议修法 | 浏览器对比同一 widget 编辑/预览；必要时统一表格在 edit chrome 下的 scale 或禁用编辑态额外补偿。 |
| 可批量 | 否（需浏览器裁定） |

### P1-4 · 历史 `deTableStyle` 脏数据（小数行高、陈旧 px 列宽）

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | 用户截图行高 `21.212383270263672px` 来自 DOM 测宽写入；`patch` 已 `Math.round` 行高（`ChartTableStylePanel.tsx:157`）但**不清理**已存脏值。 |
| 建议修法 | 读时 normalize（round rowHeightPx）；加载 layout 时可选 strip 无效 px；面板增加「恢复默认列宽」。 |
| 可批量 | 是（批次 A 附带） |

## P2 Findings

- **P2-1** · 表格配色（表头/单元格色）在「表格配色」Tab，不在「基础样式」——易误解「配色不生效」。可在基础样式加一句引导文案（非功能 stub）。

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| `applyPayloadChange` 不写 widgets | 已实现 `setWidgets` 合并 `chartConfig`（`useVizComponentInspectorActions.ts:81-87`） |
| `ChartRenderer` 不更新 config | `useLayoutEffect` 同步 `effectiveConfig`（`ChartRenderer.tsx:436-437`）；memo 比引用，patch 产生新对象应触发 |
| 排序图标 CSS 修复逻辑 | `index.css:1110-1111` `:not(:has(.embedded-chart-table-host))` 理论正确；**待浏览器确认**用户是否未热更新或遇 `:has` 边缘 case |
| 默认管理员/种子 | 非本 scope |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | 说明 |
|------|------------|------|------|
| **A** 列宽/行高 commit 与脏数据 | P0-2, P1-4 | M | 拆分 commit；行高不携带 px；normalize 历史值 |
| **B** 中文列名统一 | P0-1, P1-2 | M | 共享 label 解析 + 拖字段写 label |
| **C** 测试对齐主路径 | P1-1 | S | table-info xAxis fixture + 污染回归 |
| **D** 浏览器验真 | P1-3 + Blind spot | S | 硬刷新后验排序图标、滑块、编辑/预览 |

## 修复状态（2026-08-28 已批准 A+B+C）

| Finding | 状态 | 说明 |
|---------|------|------|
| P0-1 | **已修** | 新增 `chartFieldLabels.ts`；拖字段写 humanize label；`buildTableModel` 统一解析 |
| P0-2 | **已修** | `useTableLayoutResize` 按拖拽类型拆分 commit；行高拖不再 hydrate 列宽 px |
| P1-1 | **已修** | 补 table-info xAxis / row-only commit / normalize 单测 |
| P1-2 | **已修** | 与 P0-1 同批 |
| P1-3 | 待浏览器验真 | 预览态行高不再回退内部 pixelLayout |
| P1-4 | **已修** | `readChartDeTableStyle` 读取时 round `rowHeightPx` |
| P2-1 | 未做 | 可选引导文案 |

**回归**：`pnpm exec vitest run` 相关 8 文件 **38/38** 绿。

```yaml
status: DONE_WITH_CONCERNS
fix_mode: confirm
auto_fixed: [P0-1, P0-2, P1-1, P1-2, P1-4]
remaining: [P1-3, P2-1]
```

## 确认后计划（预填）

1. 批次 A：`useTableLayoutResize.commit` 按拖拽类型拆分 patch；`VitalSpanTable` 收紧 `usePixelColumnLayout` 条件  
2. 批次 B：`resolveTableColumnLabel` + `buildTableModel` / `ChartTableStylePanel` / `assignField`  
3. 批次 C：补 vitest；`pnpm exec vitest run` 相关文件  
4. 浏览器：像素画布明细表全链路点验  

---

```yaml
status: BLOCKED
phase: code-reviewer
mode: review
fix_mode: confirm
scope: change_surface
report: docs/reviews/code-reviewer/2026-08-28-dashboard-table-style-change-surface-recheck.md
auto_fixed: []
remaining:
  - P0-1
  - P0-2
  - P1-1
  - P1-2
  - P1-3
  - P1-4
  - P2-1
coverage:
  blind_spots:
    - "L7 | 像素画布表格浏览器主路径 | 无 BROWSER/Playwright，用户声称未修需运行时验真"
    - "L1 | 全仓结构性 stub | rg-only，未跑 ast-grep"
    - "Phase 2.5 | .evidence/ | 仓内无证据层"
  evidence_read: false
external_deps: []
evidence:
  cr: ""
  gate_findings: []
blockers:
  - "P0 未修且用户现场反馈与单测结论矛盾"
  - "浏览器验真未完成"
```
