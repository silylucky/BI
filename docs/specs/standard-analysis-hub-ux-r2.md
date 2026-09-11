# 标准分析 Hub · UX-R2 开工规格

> 蓝图：`docs/material/blueprints/2026-08-20-standard-analysis-ux-audit.md`（用户确认 · 2026-08-20）  
> PRD：RPT-002 · M-RPT F-B 可观测（改 **展示形态**，不删能力）  
> 路由：`/admin/reports/standard/results` · 代码根：`fe/src/pages/admin/reports/`

## 问题陈述

标准分析 **能力链已通**（run / 翻译 / 快照 / 投递），但消费端 Hub 将 **侧栏摘要、MetaRow Badge、四行可观测条、样本脚注、KPI 大卡** 叠在同一视口，首屏约一半被运维/配置信息占据，表格或图表被挤到下方空白区。用户反馈「非常难用」——根因是 **信息架构重复**，不是缺后端功能。

**最贵失败**：分析师打开页面后 10 秒内仍读不到分布结论，回 Excel 手搓透视。

**JTBD**：选分析包与主题 → **3 秒内看到关键指标与主视图（图/表）** → 需要时再展开运维信息（快照节奏、投递状态）。

## 方案

**纯前端 IA 重组**（三批交付，可分批 go-fast）：

| 批次 | 目标 |
|------|------|
| **UX-R2a（P0）** | 侧栏精简；xl 隐藏 MetaRow；可观测条改紧凑格；「保存本期快照」进工具栏；数据区 flex 撑满 |
| **UX-R2b（P1）** | 口径/meta 去重；对比模式 Strip 精简；lifecycle 有 chart section 时默认图 |
| **UX-R2c（P2）** | 包级运维 Collapsible（默认折叠）；侧栏投递 Badge 可点击深链 |

**不改**：`backend/app/reports/standard/**` · run/compare/snapshot API · RenderSpec 契约 · 调度/投递逻辑。

### 目标 IA（to-be）

```mermaid
flowchart TB
  subgraph sidebar [侧栏 xl+]
    N[包名]
    S[单行状态: 数据·快照·投递]
  end
  subgraph toolbar [ListPageToolbar]
    T[主题 Tabs]
    M[实时 | 周期对比]
    R[刷新]
    C[保存快照 manage]
  end
  subgraph data [flex-1 min-h-0]
    K[inline KPI 一行]
    V[Chart 或 Table]
    F[单行 dataMetaNote]
  end
  subgraph ops [Collapsible 默认关]
    O[快照节奏 / 留存 / 主题口径详情]
  end
  sidebar --> toolbar --> data
  toolbar --> ops
```

## 用户故事

1. **作为分析师**，我想打开标准分析后 **首屏直接看到表格或图表**，以便快速读数而不滚动穿过运维文案。  
2. **作为分析师**，我想在侧栏 **一眼区分** 哪个包已绑数据、有无快照、投递是否配置，以便选包时不被 Badge 墙淹没。  
3. **作为管理员**，我想 **保存本期快照** 与刷新在同一工具栏，以便操作可发现。  
4. **作为管理员**，我想在需要时 **展开** 查看快照节奏与留存策略，以便默认界面不被四行段落占屏。  
5. **作为分析师（窄屏）**，我在 `< xl` 下仍能看到 MetaRow 摘要（侧栏隐藏时），以便移动端/窄窗不丢绑定信息。  
6. **作为分析师**，我在 **周期对比** 模式下只看到与对比相关的可观测信息，以便不被包级重复字段干扰。

## 可观察验收

### UX-R2a（P0 · 必须先过）

| ID | 验收（真实 UI / vitest） |
|----|--------------------------|
| **A1** | `StandardAnalysisPackList`：**不再渲染** `enabledThemes` 主题 chip 行；每卡最多 **1 行** 状态（数据集/快照周期/投递，≤3 Badge） |
| **A2** | `StandardAnalysisResultPanel`：视口 `xl+` 时 **不渲染** `StandardAnalysisMetaRow`；`< xl` 仍渲染 MetaRow |
| **A3** | 可观测区：`StandardAnalysisSnapshotStrip` 改为 **紧凑条**（≤2 行或 icon+短标签 grid）；**不含**「保存本期快照」按钮 |
| **A4** | `ListPageToolbar.actions`：管理员 + `viewMode=live` 时可见 **「保存本期快照」**；点击仍调用现有 `onCaptureCurrent` |
| **A5** | `StandardAnalysisLiveView`：`LiveSummaryStrip` 改为 **inline 一行**（flex，非 `grid-cols-4` 大卡）；`ListPageTableFrame` / 图表容器占 **flex-1 min-h-0** |
| **A6** | 1280×720 浏览器走查（或 smoke 固定高度容器）：有数据时 **主表/图顶边** 出现在首屏 **50vh 内**（无需滚动越过工具栏） |
| **A7** | `pnpm exec vitest run fe/src/pages/admin/reports` **全绿**；更新 `standard-analysis-observability.smoke.test.tsx` 断言新 DOM |

### UX-R2b（P1）

| ID | 验收 |
|----|------|
| **B1** | Strip **实时模式** 不重复 `themeAggregationHint`（口径只在 **dataMetaNote 或** 折叠区一处）；删除 Strip 内与 `buildStandardAnalysisDataMetaNote` 语义重复的「口径」长句 |
| **B2** | Strip **对比模式** 仅显示：**对比期说明** + **最近快照**（≤2 项）；不显示包级「快照节奏/留存」全文 |
| **B3** | 后端 `renderSpec.sections[0].kind=chart` + `chartType=bar` 的 lifecycle 包：默认 **图表** 模式（沿用 `defaultLivePresentationMode`）；用户可切表 |
| **B4** | `standardAnalysisPresentation.test.ts` 覆盖 lifecycle chart section 默认 chart |

### UX-R2c（P2）

| ID | 验收 |
|----|------|
| **C1** | 包级运维（快照节奏、留存、投递详情）收入 **`Collapsible`**，`defaultOpen=false`；展开后内容与现 Strip 四行 **信息等价**（不丢字段） |
| **C2** | 侧栏投递 Badge（未配置/已调度）**可点击** 跳转 `standardScheduleHubPath(packKey)`（manage 或只读提示） |
| **C3** | Strip **不再** 渲染投递行（投递只在侧栏 + 折叠区） |

### 关键失败 / 边界（必须诚实）

| ID | 场景 | 期望 |
|----|------|------|
| **F1** | 非 manage 用户 | 无「保存快照」按钮；折叠区只读；侧栏投递仍可见 |
| **F2** | 无快照 | 紧凑条显示「暂无快照」；对比模式诚实空态 **保持** 现有 `StandardAnalysisCompareView` 行为 |
| **F3** | run 失败 | `PageErrorBanner` 仍在工具栏下；不因 IA 改动吞掉错误 |
| **F4** | 可观测信息 | 折叠默认关时，**侧栏 + 紧凑条** 仍能让用户看见「最近快照 periodKey」与投递状态（满足 RPT-002 F-B **可见**） |

## 实现决策

| # | 决策 |
|---|------|
| **D1** | **FE-only**；禁止为 UX 新增 `/api/v1` 路由 |
| **D2** | 复用 `ListPageToolbar` · `hubFilterUi` · `Collapsible`（shadcn）；禁止新造整页壳 |
| **D3** | 侧栏状态文案复用 `SNAPSHOT_LABELS` · `retentionPeriodsLabel` · `summarizePackDelivery`；不复制业务逻辑 |
| **D4** | xl 断点与 `STANDARD_WORKBENCH_GRID_CLASS` 一致（`xl:grid-cols-[16rem_1fr]`） |
| **D5** | 保留 `data-testid="standard-analysis-observability-strip"`；投递 summary 迁侧栏后改用 **`standard-analysis-pack-delivery`** 等新 testid |
| **D6** | lifecycle 默认图 **仅当** section 已是 `kind=chart`；若后端仍返 table section，保持表（不 FE 伪造 chart） |
| **D7** | PRD F-B 验收语义调整为「可观测 **可见且可折叠**」——本 spec 落地后评估 `prd/F08-RPT.md` 最小回写（非本批阻塞） |

## 测试决策 / seam

| 层 | 策略 |
|----|------|
| **组件 smoke** | 更新 `standard-analysis-observability.smoke.test.tsx`；新增 `standard-analysis-hub-ux.smoke.test.tsx`（MetaRow xl 隐藏、工具栏快照按钮、侧栏无 theme chip） |
| **单元** | `standardAnalysisPresentation.test.ts`（B3/B4）；可选 `standardAnalysisPackList.test.tsx` 快照 Badge 数量 |
| **不测** | 后端 run/snapshot；ChartEngine 内部渲染像素 |
| **回归** | `pnpm exec vitest run src/pages/admin/reports` 全绿；不降低现有 M-RPT smoke 覆盖 |

### 建议 go-fast Slice Map

| Slice | 文件（主） | 验收 ID |
|-------|------------|---------|
| S1 | `StandardAnalysisPackList.tsx` | A1, C2 |
| S2 | `StandardAnalysisResultPanel.tsx` + `StandardAnalysisSnapshotStrip.tsx` | A2–A4, B1–B2, C1, C3 |
| S3 | `StandardAnalysisLiveView.tsx` + `standardAnalysisUi.tsx` | A5 |
| S4 | 测试更新 + smoke | A7, F1–F4 |

## 范围外

- 历史快照抽屉（08-19 audit R2 open）  
- M2 库内 GROUP BY 全量聚合  
- 后端 lifecycle 强制返 `kind=chart`（若需，单独立项）  
- 标准分析 **配置页** `StandardAnalysisConfigPage` 改版  
- 文档模板 / 调度列表页 IA  
- browser-reviewer 截图工件（可选 follow-up，非本 spec 阻塞）

## 补充说明

### 证据与锚点

| 类型 | 路径 |
|------|------|
| 蓝图 audit | `docs/material/blueprints/2026-08-20-standard-analysis-ux-audit.md` |
| 前序结果区 audit | `docs/material/blueprints/2026-08-19-standard-analysis-results-panel-audit.md` |
| UI IA | `docs/ui/layout.md` §标准分析 |
| 组件 | `StandardAnalysisPage.tsx` · `StandardAnalysisResultPanel.tsx` · `StandardAnalysisPackList.tsx` · `StandardAnalysisSnapshotStrip.tsx` · `StandardAnalysisLiveView.tsx` |
| 设计系统 | `.agents/skills/b-design-system-tailadmin-radix/SKILL.md` · `list-page-kit` |

### PRD 偏航（实施后评估）

| 项 | 说明 |
|----|------|
| RPT-002 F-B | 「Hub 与结果页均展示可观测条」→ 改为 **紧凑条 + 可折叠详情**，实时/对比仍一致 |
| `layout.md` | 补「标准分析 Hub 数优先 IA」一句 |

### 规格门自检（go-fast Path A）

| 门槛 | 状态 |
|------|------|
| 可观察真实验收 | ✅ A1–A7 / B / C / F |
| 无 stub/demo 完成定义 | ✅ 浏览器/vitest 真实 DOM |
| 失败路径 | ✅ F1–F4 |
| 范围外 | ✅ |
| 实现决策 | ✅ D1–D7 |
| 后端边界 | ✅ FE-only 显式 |

**交接**：规格就绪 → 用户或编排方调用 **go-fast**，`spec_ref=docs/specs/standard-analysis-hub-ux-r2.md`，建议先 **UX-R2a（S1–S4）** 串行落地后再 B/C。
