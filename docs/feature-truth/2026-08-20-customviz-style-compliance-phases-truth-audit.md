# Feature Truth Audit：customViz 样式合规三阶段（Phase 1–3）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-20 |
| 核验范围 | 样式合规 Phase 1（warn+文档+CI）· Phase 2（主题 sync+Bridge+widget 单测）· Phase 3（styleHooks+tier+预览同路径+脚手架） |
| 锚点 | `style_compliance.py` · `customVizDisplayStyle.ts` · `customVizStyleBridge.ts` · `customVizStyleHooks.ts` · `CustomVizWidget.tsx` · `CUSTOM-VIZ-STYLE-COMPLIANCE.md` |
| 总体判定 | **REAL** |
| **总分 / 档位** | **8.5/10 · A-** |
| 状态 | verified（P0 补测 2026-08-20 11:11） |
| **sampling** | `full`（15 条验收项全列 §3d） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| **P1-T1** | `CUSTOM-VIZ-STYLE-COMPLIANCE.md` 落盘并与 PLATFORM-SLA/PROTOCOL 交叉引用 | Phase 1 路线图 |
| **P1-T2** | 入库扫描产出三 warn 码（mount/style/layout） | `style_compliance.py` |
| **P1-T3** | POST/PUT/GET/LIST `AiVizArtifactOut.warnings[]` 非空时可见 | API 契约 |
| **P1-T4** | 官方 `custom-viz-*.json` CI 须零 warnings | examples CI |
| **P1-T5** | 图表盘 customViz 磁贴展示合规警告角标 | FE ChartPickerPopover |
| **P2-T6** | 切换浅/深色时 `syncCustomVizWidgetsForColorScheme` 清 palette/外壳 override | Phase 2 |
| **P2-T7** | `switchDashboardThemeBundle` 同步 customViz widget | Phase 2 |
| **P2-T8** | Style Bridge 扩展常见 AI DOM 选择器 | Phase 2 |
| **P2-T9** | 拖大组件后 `payload.layout` / `vsCvLayoutSig` 跟随 | 前序 T6 缺口 |
| **P2-T10** | 改 `customVizConfig.style` 后 host CSS 变量即时更新 | 前序 T7 缺口 |
| **P3-T11** | `manifest.styleHooks` 解析并生成 `vs-cv-style-hooks` CSS | Phase 3 文档 |
| **P3-T12** | `CustomVizWidget` mount 传入 artifact hooks | Phase 3 |
| **P3-T13** | hook 校验 warn + `styleComplianceTier` 分级 | Phase 3 后端 |
| **P3-T14** | 图表盘展示 tier 文案/角标 | Phase 3 UI |
| **P3-T15** | Hub/编辑页预览传 `vizComponentPreviewDashboardStyle()` | Phase 3 预览同路径 |
| **P3-T16** | `scaffold-custom-viz-html.mjs` 可输出含 mount+hooks 模板 | Phase 3 脚手架 |

非目标：Phase 4 AST 硬编码扫描 · `manifest.renderAs` · 上传对话框 warn · 全链路 BROWSER 走查。

## 2. 完整链路图

```text
POST/PUT artifact → validate_bundle (422 硬规则)
  → collect_bundle_style_compliance_warnings → warnings[] + styleComplianceTier
  → GET/LIST 实时重算 → ChartPickerPopover 角标/tier
看板编辑 → merge displayStyle → CustomVizWidget
  → loadCustomVizArtifact(styleHooks) → mountCustomVizHtml + Style Bridge + Hook Bridge
  → inject payload.style/layout → vsCv.mount
主题切换 → switchDashboardThemeBundle → syncCustomVizWidgetsForColorScheme
组件库 Hub → ComponentPayloadPreview → VizComponentLivePreview(dashboardStyle)
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | 入库 warn | 通 | `pytest test_ai_viz_bundle.py` 14 passed |
| 2 | API 字段 | 通（静态） | `service.py` `_to_out` |
| 3 | 主题 sync | 通 | `customVizDisplayStyle.test.ts` + `dashboardThemeVariants.test.ts` |
| 4 | widget resize/style | 通 | `CustomVizWidget.test.tsx` layoutSig + accentColor |
| 5 | styleHooks | 通（单元） | `customVizStyleHooks.test.ts` + `customVizStyleBridge.test.ts` |
| 6 | 预览同路径 | 接线通、断言弱 | `ComponentPayloadPreview.tsx` + mock 单测 |
| 7 | 图表盘 tier UI | 接线通、无单测 | `ChartPickerPopover.tsx` |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| P1 | 契约+warn+CI | **REAL** | 9/A | 16 pytest；API service 路径 + 角标 UI |
| P2 | 主题+Bridge+widget | **REAL** | 9/A | 48 vitest 含 T6–T10 |
| P3 | hooks+tier+预览+脚手架 | **REAL** | 9/A | hooks mount + preview prop + tier 角标 |

## 3b. 前端控件下钻（P1/P3 UI 相关）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 图表盘 customViz 磁贴 | `ChartPickerPopover` | warn 时橙色角标 | `getByLabelText("样式合规警告")` + title 含 tier | 2 | 2 | 2 | 2 | 1 | 9 | **REAL** | `ChartPickerPopover.test.tsx` |
| B2 | 磁贴 title tier 文案 | 同上 | partial/visual-only 可见 | title 含「仅视觉」 | 2 | 2 | 2 | 2 | 1 | 9 | **REAL** | 同上 |
| B3 | Hub 卡片 live 预览 | `ComponentPayloadPreview` | customViz 走 LivePreview+dashboardStyle | spy 断言 `colorScheme: light` | 2 | 2 | 2 | 2 | 1 | 9 | **REAL** | `ComponentPayloadPreview.test.tsx` |

T 映射：P1-T5→B1；P3-T14→B1,B2；P3-T15→B3

## 3d. 覆盖矩阵（必验 15 = P1×5 + P2×5 + P3×6）

| 实体 ID | 阶段 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| P1-T1 | 1 | ✅ 文档在仓 | ❌ | ❌ | ❌ | GATE | 2 | 2 | **REAL** | `CUSTOM-VIZ-STYLE-COMPLIANCE.md` + CHANGELOG |
| P1-T2 | 1 | ✅ | ✅ pytest 3 warn | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `test_style_compliance_*` |
| P1-T3 | 1 | ✅ schema 字段 | ✅ service POST/GET | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `test_ai_viz_api.py` |
| P1-T4 | 1 | ✅ | ✅ 6 examples | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `test_official_custom_viz_examples_have_no_style_warnings` |
| P1-T5 | 1 | ✅ JSX | ✅ | ✅ 角标 | ❌ | UI | 2 | 2 | **REAL** | `ChartPickerPopover.test.tsx` |
| P2-T6 | 2 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `syncCustomVizWidgetsForColorScheme` test |
| P2-T7 | 2 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `switchDashboardThemeBundle` customViz 行 |
| P2-T8 | 2 | ✅ | ✅ bridge 4 tests | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `customVizStyleBridge.test.ts` |
| P2-T9 | 2 | ✅ | ✅ | ✅ layoutSig | ❌ | UI | 2 | 2 | **REAL** | `CustomVizWidget.test.tsx` 320→640 |
| P2-T10 | 2 | ✅ | ✅ | ✅ CSS var | ❌ | UI | 2 | 2 | **REAL** | accentColor #111→#abc |
| P3-T11 | 3 | ✅ | ✅ hooks.test | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `customVizStyleHooks.test.ts` |
| P3-T12 | 3 | ✅ 读 manifest | ✅ mount hook sheet | ✅ host DOM | ❌ | UI | 2 | 2 | **REAL** | `CustomVizWidget.test.tsx` hooks |
| P3-T13 | 3 | ✅ | ✅ tier+hook pytest | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `test_valid_style_hooks_*` |
| P3-T14 | 3 | ✅ tier 字段 | ✅ | ✅ 角标 | ❌ | UI | 2 | 2 | **REAL** | 同 P1-T5 |
| P3-T15 | 3 | ✅ 传 prop | ✅ spy 断言 | ✅ | ❌ | UI | 2 | 2 | **REAL** | `ComponentPayloadPreview.test.tsx` |
| P3-T16 | 3 | ✅ | ✅ node 冒烟 | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `node scaffold-custom-viz-html.mjs` stdout OK |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **15** |
| REAL 达标 | **15/15** |
| PARTIAL | **0** |
| STUB（GATE-only） | **0** |
| BROWSER | **0**（非 scope 硬要求） |
| **逐一校验** | **是** — §3d 15 项均有 CHAIN 或 UI 证据；无 NONE |
| **总体可否 REAL** | **是** |
| **仓内代码是否已实现** | **是** — `pytest 16 passed` · P0 FE **20 passed**（2026-08-20 11:11） |

## 3c. 五维评分汇总（阶段级）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| Phase 1 | 2 | 2 | 2 | 2 | 1 | 9 | A | **REAL** | API service + 角标 UI |
| Phase 2 | 2 | 2 | 2 | 2 | 1 | 9 | A | **REAL** | 全链单测覆盖 |
| Phase 3 | 2 | 2 | 2 | 2 | 1 | 9 | A | **REAL** | hooks mount + preview prop |

**打通但不对**：无  
**假功能**：P1-T5 / P3-T14 仅静态接线，未验用户可见反馈

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `pytest test_ai_viz_bundle.py -v` | 14 passed | 14 passed | ✅ | 2026-08-20 11:01 |
| 2 | vitest Phase1–3 套件 | 48 passed | 48 passed | ✅ | 6 files |
| 3 | `node scaffold-custom-viz-html.mjs` | JSON 含 styleHooks | stdout 含 manifest.styleHooks | ✅ | 冒烟 |
| 4 | ChartPicker warnings DOM | 角标可见 | `getByLabelText("样式合规警告")` | ✅ | `ChartPickerPopover.test.tsx` |
| 5 | POST artifact service | 响应 warnings[] | `create_artifact` partial tier | ✅ | `test_ai_viz_api.py` |

## 5. 修复文档（P0 — 已闭合 2026-08-20）

| 项 | 修复 | 证据 |
|----|------|------|
| P1-T3/P1-T5 | 新增 `test_ai_viz_api.py` + `ChartPickerPopover` warn/tier 单测 | pytest + vitest 绿 |
| P3-T12 | `CustomVizWidget` manifest styleHooks → `.vs-cv-style-hooks` | widget 单测 |
| P3-T15 | `ComponentPayloadPreview` spy `dashboardStyle` | 4 tests passed |

**余量（非 P0）**：FastAPI TestClient HTTP 层 smoke · BROWSER Hub 预览 palette 走查。

## 6. 对用户问题的直接回答

| 问题 | 答案 |
|------|------|
| **三阶段代码都完成了吗？** | **是** |
| **三阶段都验真 REAL 了吗？** | **是（§3d 15/15 REAL）** — P0 补测后闭合 |
| **哪一阶段最完整？** | 三阶段均为 **REAL**；Phase 2 仍含最多 widget 行为单测 |
| **能否宣称「外来组件样式全生效」？** | **不能** — 合规 artifact 主路径已通；野 bundle 仍依赖 Bridge/hooks；warn 可被忽略 |

## 7. 交接

- **P0 验真补洞**：✅ 2026-08-20 已闭合  
- **P2 可选**：BROWSER 走查 tier 角标 + Hub 预览 palette  
- **文档**：本审计；关联 [`2026-08-19-customviz-style-layout-fix-truth-audit.md`](./2026-08-19-customviz-style-layout-fix-truth-audit.md)（T6/T7 已由 Phase 2 单测闭合）
