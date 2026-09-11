# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-27（变更面收口）

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：`bad3d893`…`HEAD`（dashboard 图表裁切、对齐吸附、AI 组件删除、报表 fill 路由、GIS 特效、滑块 liveUpdate） |
| mode | auto-fix（默认） |
| fix_mode | auto（用户确认全量） |
| cr_fix_scope | all |
| Stack Card | 后端 FastAPI · 前端 React 19 + Vite `fe/` · 单租户 BI · M1 |
| 扫描方式 | 2× explore subagent（L1+L7、L4+L5+L9）+ 主 agent 复核；`scan_tools: rg-only`（`sgconfig.yml` 存在，未跑 ast-grep 规则包） |
| 证据层 / 外部依赖 | 无 `.evidence/`（记 Blind spot）；本变更无仓外 HTTP 新集成 |
| ha_mode | single（§18 跳过） |
| Blind spots | 无浏览器走查（图表编辑裁切、报表页间距、删除 toast 目视）；无 `.evidence/` gate；L1 结构性假绿依赖 rg |
| Lane 密度 | L1+L7：12 候选；L4+L5+L9：10 候选；主 agent 合并去重 |
| P0 / P1 / P2 | 0 / 5 / 12 |
| 建议 | **P0–P2 已批量修复**；剩余 P2-11/P2-12 为演示占位与浏览器走查（非代码阻塞） |
| 回传 status | DONE_WITH_CONCERNS |
| 已排除非问题 | 看板级 `DashboardConfigSlider` 松手提交（性能设计）；`markLineThresholdPx` FE/BE 范围已对齐；`AIVIZ_IN_USE` 有中文映射；默认管理员 seed |

一句话结论：**会话内功能改动已落盘且相关单测 90/90 绿；旧 CR 的 GIS 编译 P0 已修复。剩余主要为 P1：组件库删除仍用 `window.confirm`、AIVIZ 错误 fields 非标准信封、滑块 live/blur 策略分裂；无阻塞合入的 P0。**

### Stack Card（摘要）

- 形态：monorepo · `backend/` + `fe/`
- 变更主根：`fe/src/components/dashboard/` · `fe/src/components/charts/` · `fe/src/lib/aiVizArtifacts.ts` · `fe/src/pages/admin/reports/` · `backend/app/dashboard/schemas.py` · `backend/app/ai_viz/`
- 跳过 lane：L6 IaC、L8 外部集成、L10 安全深扫、L11 HA（与本次 UI 变更弱相关）
- 单测（本批）：`ChartPickerPopover` 10 · `EmbeddedChartLegend` 9 · `dashboardChromeConfig` 14 · `dashboardOverallConfigPanel` 6 · `admin-layout-routes` + `AdminLayout.smoke` 51

### 与上一份报告关系

| 旧 finding | 状态 |
|------------|------|
| P0-1 `ChartGisMapSunPanel` 缺 import | **已修复**（`gisMapViewBridge` import 已恢复，commit `5baed511`） |
| P1-1～P1-4 滑块 live 分裂 | **仍开放**（合并为 P1-1） |
| P2-1～P2-5 | 部分仍开放；新增变更面 finding 见下 |

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 浏览器走查 | 合理跳过 | 编辑态图表轴标签裁切、报表 center/schedules 间距 | 无 BROWSER 证据 |
| 证据层 | 无仓内工件 | `.evidence/` gate-check | 无法实证 gate |
| L1 ast-grep | 降级 | 结构性 stub | `rg-only`；变更产线关键词 0 命中 |

**判定**：变更面核心目录已扫；无 P0 → 可 `DONE_WITH_CONCERNS`；非「可上线」因 P1 未修。

## P0 Findings

（无）

## P1 Findings

### P1-1 · 图表/看板滑块 live 与松手提交混用

| 字段 | 内容 |
|------|------|
| 类别 | 坏表单 / 产品表面 |
| 证据 | `deAttrSlider.tsx:449` `ChartDeSliderField` 固定 `liveUpdate=true`；`deTitleStyleToolbar.tsx:154-164` 字间距用 `DashboardConfigSlider`（松手）；`widgetSurfaceStyleFields.tsx:147-188` 分边 `DashboardConfigGridSlider` 无 live |
| 为何致命 | 用户报告「样式滑块松手才生效」的同类问题仍在标题区与分边背景；同一编辑器内交互分裂 |
| 建议修法 | 图表 inspector 上下文统一 live 包装；`DashboardConfigGridSlider` 增加 `liveUpdate` 透传；`DeAttrSubSliderRow` 对看板全局配置默认 `liveUpdate=false`（吸附灵敏度已接 live，其余看板项保持松手） |
| xref | P2-1, P2-2 |
| 可批量 | 是（批次 B） |

### P1-2 · 组件库删除使用 `window.confirm`

| 字段 | 内容 |
|------|------|
| 类别 | 风格 / 产品表面 |
| 证据 | `ChartPickerPopover.tsx:319` — `window.confirm(...)`；同域 `ReportTemplatesPage` 已用 `AlertDialog` |
| 为何致命 | 违反 `fe-ui.mdc`（禁原生 confirm）；删除中无 loading/disabled，与平台对话框模式不一致 |
| 建议修法 | 对齐模板页：`AlertDialog` + 引用列表展示 + 删除中 disabled |
| xref | — |
| 可批量 | 是（批次 A） |

### P1-3 · AIVIZ 删除错误 `detail.fields` 非标准信封

| 字段 | 内容 |
|------|------|
| 类别 | API 信封 |
| 证据 | `service.py:188-192` 返回 `{dashboardId, dashboardName, widgetId}`；`api.ts` 假定 `{field, message}`；仅 `formatAiVizArtifactDeleteError` 特判 |
| 为何致命 | 通用 `mapApiError` / 字段级错误无法消费；后续表单难复用 |
| 建议修法 | 后端改为标准 `field`/`message` 数组，或 FE 定义 `AiVizReferenceFields` 并在 envelope 解析层注册 |
| xref | P2-3 |
| 可批量 | 是（批次 C，需契约对齐） |

### P1-4 · AI 组件删除仅图表选择器单入口

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `ChartPickerPopover.tsx` 为唯一删除 UI；`admin/viz-components` 列表无删除；API `DELETE /ai-viz/artifacts/{id}` 已实现 |
| 为何致命 | 管理员在组件库页无法删除孤儿 artifact，只能进看板编辑器 |
| 建议修法 | `viz-components` 列表补删除（复用 `fetchRefs` + `AlertDialog`）；或文档明确「仅编辑器内删除」并撤管理端宣称 |
| xref | P1-2 |
| 可批量 | 是（批次 D，产品裁定） |

### P1-5 · 报表路由 fill/wide 分类重叠

| 字段 | 内容 |
|------|------|
| 类别 | 风格 / 可靠性 |
| 证据 | `admin-layout-routes.ts:21-22` center/schedules 在 `ADMIN_LIST_FILL_PATTERNS`；`ADMIN_WIDE_SCROLL_PATTERNS:53` 仍匹配 `/admin/reports(?:/|$)`；`isAdminWideScrollRoute` 产线未使用 |
| 为何致命 | 路由分类自相矛盾，后续维护易回归宽 padding；`/admin/reports/view/:id` 不在 fill 列表，hub 与查看页壳层不一致 |
| 建议修法 | 从 `ADMIN_WIDE_SCROLL_PATTERNS` 排除已列入 fill 的子路径；或删除未使用的 wide 辅助函数并补注释 |
| xref | P2-4 |
| 可批量 | 是（批次 A） |

## P2 Findings

- **P2-1** · `deTitleStyleToolbar` 字间距 `min=0` vs BE `ge=-2`（`schemas.py:180`）— 负字间距不可编辑
- **P2-2** · `widgetSurfaceStyleFields` 背景模糊 `max=48` vs BE `le=64` — 超范围值 UI 不可调
- **P2-3** · `service.py` / `apiError.ts` 错误文案含 `artifactId`/`widget` 英文术语
- **P2-4** · 标准分析子页 `px-5` vs 报表 center `LIST_PAGE_CONTENT_PAD_CLASS` — 同模块密度分裂
- **P2-5** · `ChartPickerPopover` 空态「VS-AI」产品内名称；compliance tooltip 可能暴露 `manifest.styleHooks.*`
- **P2-6** · `CustomVizWidget` 错误「未配置 artifactId」— 配置键名上屏
- **P2-7** · `ChartPickerPopover` 删除无 `dashboard:edit` 能力门禁 — 只读用户可见删除钮，API 403
- **P2-8** · `ChartPickerPopover` / `WidgetPalette` catalog API 失败静默 fallback 本地表
- **P2-9** · `pixelMarkLine.ts` 与 `dashboardChromeConfig.ts` 各维护默认阈值 10 — 常量漂移风险
- **P2-10** · 删除竞态：refs 为空但 layout 仍引用 → 409 需二次操作
- **P2-11** · `ReportViewPage` placeholder 区块「示例态」— 演示占位（非测试）
- **P2-12** · 无浏览器走查记录 — 建议合入前目视验证图表裁切与报表间距

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| `clipChart={mode !== "edit"}` | 有意修复编辑态轴标签裁切；单测已覆盖 |
| `markLineThresholdPx` 2–24 | FE `dashboardChromeConfig` 与 BE `schemas.py` 一致 |
| `formatAiVizArtifactDeleteError` | 409 `AIVIZ_IN_USE` 有人话 toast；主路径已非静默 |
| 移除「网格步长」UI、保留 20px 内部格 | 产品决策；吸附灵敏度 slider 已替代用户可调项 |
| 默认管理员 seed | 项目约定 |
| GIS `gisMapViewBridge` import | 旧 P0-1 已修复 |

## 修复状态（2026-08-27 全量 batch-fix）

| Finding | 状态 |
|---------|------|
| P1-1 | ✅ 字间距改 `ChartDeAttrSliderField`；分边 GridSlider 加 `liveUpdate` |
| P1-2 | ✅ 抽取 `AiVizArtifactDeleteDialog`（AlertDialog） |
| P1-3 | ✅ BE `fields` 改为 `{field, message}` 标准格式 |
| P1-4 | ✅ `VizComponentsHubPage` 增加 `AiVizArtifactsHubSection` |
| P1-5 | ✅ `isAdminWideScrollRoute` fill 优先，测试已更新 |
| P2-1 | ✅ 字间距 `min=-2` |
| P2-2 | ✅ 背景模糊 `max=64` |
| P2-3 | ✅ `apiError` / BE message 去 artifactId 术语 |
| P2-4 | ✅ 标准分析对比视图 `px-5`→`px-4` |
| P2-5 | ✅ 空态文案 + `humanizeAiVizComplianceWarning` |
| P2-6 | ✅ CustomVizWidget 错误人话 |
| P2-7 | ✅ 删除钮 `dashboard:edit` 门禁 |
| P2-8 | ✅ WidgetPalette catalog 失败 toast |
| P2-9 | ✅ `pixelMarkLine` 引用 `DEFAULT_MARK_LINE_THRESHOLD_PX` |
| P2-10 | ✅ 删除统一 `unlink: true` |
| P2-11 | ⏸ 报表示例态 placeholder（产品演示设计，未改） |
| P2-12 | ⏸ 浏览器走查（须人工） |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | 说明 |
|------|------------|------|------|
| **A 快修** | P1-2, P1-5 | S | AlertDialog 替换 confirm；清理 reports wide/fill 重叠 |
| **B 滑块收口** | P1-1, P2-1, P2-2 | M | 图表上下文 live 统一；字间距/模糊上下限对齐 BE |
| **C API 契约** | P1-3, P2-3 | M | AIVIZ fields 标准信封 + 文案去术语 |
| **D 产品入口** | P1-4 | M | viz-components 列表删除或撤宣称 |
| **E 债与体验** | P2-4～P2-12 | S–L | 文案、权限、浏览器走查 |

## 确认后计划

1. 批次 A 可立即修（无外部契约）
2. 批次 B/C 可并行；C 需前后端同 PR
3. 回归：`pnpm exec vitest run` 变更面相关 + `tsc` 变更文件
4. 浏览器：看板编辑图表裁切、报表 center/schedules 间距、自定义组件删除 toast

---

```yaml
status: DONE_WITH_CONCERNS
phase: code-reviewer
mode: auto-fix
fix_mode: auto
cr_fix_scope: all
scope: change_surface
report: docs/reviews/code-reviewer/2026-08-27-dashboard-ui-change-surface-completion.md
supersedes_partial: docs/reviews/code-reviewer/2026-08-27-chart-slider-liveupdate-change-surface.md
auto_fixed: [P1-1, P1-2, P1-3, P1-4, P1-5, P2-1, P2-2, P2-3, P2-4, P2-5, P2-6, P2-7, P2-8, P2-9, P2-10]
remaining: [P2-11, P2-12]
coverage:
  blind_spots:
    - "浏览器走查 | 图表裁切/报表间距/删除 toast | 未执行"
    - "证据层 | .evidence/ gate-check | 仓内无工件"
    - "L1 ast-grep | 结构性 stub | rg-only 降级"
  evidence_read: false
external_deps: []
evidence:
  cr: ""
  gate_findings: []
blockers: []
```
