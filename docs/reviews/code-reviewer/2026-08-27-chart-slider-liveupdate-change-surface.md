# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-27

## 总览

| 项 | 内容 |
|----|------|
| 范围 | PR·变更面：图表样式滑块 `liveUpdate` 修复 + 关联 dashboard 滑块组件 |
| mode | auto-fix（默认） |
| fix_mode | confirm-batch |
| cr_fix_scope | （待用户确认） |
| Stack Card | 后端 FastAPI · 前端 React 19 + Vite `fe/` · 单租户 BI · M1 |
| 扫描方式 | 主 agent 串行 + 2× explore subagent（L1+L4、L5+L7）；`scan_tools: rg-only`（ast-grep/codegraph 存在但未跑规则包） |
| 证据层 / 外部依赖 | 无 `.evidence/`（记 Blind spot）；本变更无仓外依赖 |
| ha_mode | single（§18 跳过） |
| Blind spots | 无浏览器走查（饼图/GIS 太阳面板拖动目视）；无 `.evidence/` gate |
| Lane 密度 | L1+L4：7 候选；L5+L7：11 候选；主 agent 复核合并 |
| P0 / P1 / P2 | 1 / 4 / 5 |
| 建议 | **修完 P0+P1 再合**；P0 为未提交工作区编译错误 |
| 回传 status | DONE_WITH_CONCERNS |
| 已排除非问题 | 看板级 `DashboardConfigSlider` 松手提交（性能设计）；`ChartPaletteDeParityFields` dense 路径已接 `onOpacityPreview` 即时预览 |

一句话结论：**`DeProgressSlider` liveUpdate 主路径已接通且单测 87/87 绿，但工作区存在 GIS 太阳面板缺 import 的 P0 编译错误，且图表右栏仍有标题字间距、分边距 grid 滑块未走 live 路径。**

### Stack Card（摘要）

- 形态：monorepo · `backend/` + `fe/`
- 变更主根：`fe/src/components/dashboard/deAttrSlider.tsx`（已提交大部分）+ 未提交 `ChartGisMapSunPanel.tsx`
- 跳过 lane：L6 IaC、L8 外部集成、L9 API、L10 安全、L11 HA（与本次 UI 变更无关）
- 单测：`deAttrSlider` 10/10 · `PixelCanvas` 45/45 · `collisionLayout` 27/27 · `sceneGraphLayout` 5/5

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 浏览器走查 | 合理跳过 | 饼图样式 Tab 拖动、GIS 太阳播放 | 无 BROWSER 证据；建议合入前手动验 |
| 证据层 | 无仓内工件 | `.evidence/` | 无法 gate-check；不影响本次纯 FE 交互修复 |
| L1 ast-grep | 降级 | 结构性 stub | `scan_tools: rg-only` + 人工读入口 |

**判定**：变更面核心目录已扫；存在 P0 编译错误 → 不可宣称可上线。

## P0 Findings

### P0-1 · GIS 太阳面板缺 import，编译失败

| 字段 | 内容 |
|------|------|
| 类别 | 真实缺口 |
| 证据 | `fe/src/components/dashboard/chartStyleSections/ChartGisMapSunPanel.tsx:70,79` — 调用 `applyGisMapSun` / `getGisMapSunSettings`；import 被误删为仅 `cn`；`tsc -p tsconfig.app.json` → `TS2304` |
| 为何致命 | 类型检查失败；运行到太阳控制逻辑会 `ReferenceError`，GIS 球面光照配置不可用 |
| 建议修法 | 恢复 `import { applyGisMapSun, getGisMapSunSettings } from "@/components/charts/engine/maplibre/gisMapViewBridge"` |
| xref | — |
| 可批量 | 是（批次 A，单行修复） |

## P1 Findings

### P1-1 · 图表标题「字间距」仍松手提交

| 字段 | 内容 |
|------|------|
| 类别 | 坏表单 / 产品表面 |
| 证据 | `fe/src/components/dashboard/deTitleStyleToolbar.tsx:154-164` — `DashboardConfigSlider` 无 `liveUpdate` / `onPreviewChange`；同栏饼图半径等已用 `ChartDeSliderField` |
| 为何致命 | 用户报告「样式滑块松手才生效」的同类问题仍在标题区 |
| 建议修法 | 改为 `InspectorSliderField` 或 `ChartDeSliderField`（`compact` + `layout="inline"`） |
| xref | P1-4 |
| 可批量 | 是（批次 B） |

### P1-2 · 图表背景「分边」内边距/圆角 grid 滑块未 live

| 字段 | 内容 |
|------|------|
| 类别 | 坏表单 |
| 证据 | `fe/src/components/dashboard/widgetSurfaceStyleFields.tsx:147-188` — `DashboardConfigGridSlider` 内部 `DeSliderStackedRow` 无 `liveUpdate`；`ChartBackgroundStyleSection` 默认 `density="narrow"` 走此路径 |
| 为何致命 | 统一/分边模式交互不一致：统一边距 live，分边仍松手 |
| 建议修法 | `DashboardConfigGridSlider` 增加 `liveUpdate` 透传；图表 narrow 上下文默认 `true` |
| xref | P1-1 |
| 可批量 | 是（批次 B） |

### P1-3 · `DeAttrSubSliderRow` 硬编码 liveUpdate 影响看板配置

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 性能热点 |
| 证据 | `fe/src/components/dashboard/deAttrSlider.tsx:814` — `liveUpdate` 无 prop；用于 `dashboardAlignmentSnapControls.tsx`、`dashboardOverallConfigPanel.tsx`（看板间隙自定义同时有 `onPreview`+`onChange` → 拖动时双路径提交） |
| 为何致命 | 原设计看板滑块松手提交减载；现对齐全表 live 可能引发拖动中整画布重渲染 |
| 建议修法 | `DeAttrSubSliderRow` 增加 `liveUpdate?: boolean` 默认 `false`；仅图表/需要即时预览处显式开启 |
| xref | — |
| 可批量 | 是（批次 B） |

### P1-4 · 同栏滑块交互分裂（L5）

| 字段 | 内容 |
|------|------|
| 类别 | 风格 / 产品表面 |
| 证据 | `chartStyleFields.tsx:108` — `density=narrow` → `InspectorSliderField`（live）；`wide` → `DashboardConfigSlider`（松手）；`deTitleStyleToolbar` 在图表上下文仍用看板组件 |
| 为何致命 | 同一编辑器内「即时 vs 松手」混用，违背用户心智 |
| 建议修法 | 图表 inspector 上下文统一 live 包装；看板宽栏可保留松手或显式 `liveUpdate` 策略文档化 |
| xref | P1-1, P1-2 |
| 可批量 | 是（批次 C） |

## P2 Findings

- **P2-1** · `ChartGisMapProjectPanel.tsx` 经纬度/缩放等 `Input` 仅 `onBlur` 提交（已有 `patchViewDraft` onChange，blur 做校验）— 数字输入体验可 debounce live
- **P2-2** · `chartStyleSections/ChartTypeStyleSections.tsx` 等仍从 deprecated `ChartInspectorContext` 导入 — 统一为 `chartInspectorContext`
- **P2-3** · `deAttrSlider.test.tsx` 未覆盖 `DashboardConfigGridSlider` live、`DeTitleStyleToolbar` 交互 — 补回归防回归
- **P2-4** · `screen/ScreenVisualStylePanels.tsx` 等大屏装饰仍用 `DeAttrSliderField` 无 live — 非内置 chartType，低优先
- **P2-5** · 无浏览器走查记录 — 合入前建议饼图外径/扇区间距 + GIS 太阳日弧轴拖动目视

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| `DashboardConfigSlider` 看板宽栏松手提交 | 有意为之，减轻看板全局样式拖动重渲染 |
| `ChartPaletteDeParityFields` dense 配色不透明度 | `onOpacityPreview` 已在拖动时 `patchDeStyle`，功能上即时 |
| `ChartGeoStylePanel` / `chartAdvancedSections` | 已切 `ChartDeAttrSliderField` |
| 默认管理员 seed | 项目约定 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | Subagent 建议 |
|------|------------|------|----------------|
| **A 编译阻断** | P0-1 | S | 恢复 GIS bridge import |
| **B 图表 live 收口** | P1-1, P1-2, P1-3 | M | 标题字间距 → InspectorSliderField；GridSlider live 透传；SubSliderRow live 可配置 |
| **C 交互一致** | P1-4 | M | 图表上下文 slider 选型统一 |
| **D 测试与债** | P2-1～P2-5 | S | 补测 + deprecated import 清理 |

## 确认后计划

1. 批次 A 立即修（无需设计决策）
2. 批次 B/C 可并行：deAttrSlider API + deTitleStyleToolbar + widgetSurfaceStyleFields
3. 跑 `pnpm exec vitest run src/components/dashboard/deAttrSlider.test.tsx` + `tsc -p tsconfig.app.json`
4. 浏览器：饼图样式 Tab 拖滑块 + GIS 太阳（修 P0 后）

---

```yaml
status: DONE_WITH_CONCERNS
phase: code-reviewer
mode: auto-fix
fix_mode: confirm-batch
cr_fix_scope: null
scope: change_surface
report: docs/reviews/code-reviewer/2026-08-27-chart-slider-liveupdate-change-surface.md
auto_fixed: []
remaining: [P0-1, P1-1, P1-2, P1-3, P1-4, P2-1, P2-2, P2-3, P2-4, P2-5]
coverage:
  blind_spots:
    - "浏览器走查 | 饼图/GIS 太阳拖动目视 | 未执行"
    - "证据层 | .evidence/ gate-check | 仓内无工件"
  evidence_read: false
external_deps: []
evidence:
  cr: ""
  gate_findings: []
blockers:
  - "P0-1 ChartGisMapSunPanel 编译错误须先修"
```
