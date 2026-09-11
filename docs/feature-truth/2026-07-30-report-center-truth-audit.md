# Feature Truth Audit: 报表中心（Hub · 浏览 · 预制 · 默认路径）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-30 |
| 核验范围 | 报表中心 Hub、统一浏览页、预制分析、角色默认 landing；不含调度/模板管理深度验收 |
| 锚点 | `/admin/reports/center` · `/admin/reports/view/:nodeId` · `/admin/reports` · `defaultViewResolve.ts` · `/api/v1/reports/*` |
| 总体判定 | **REAL**（P0 已修复；主消费路径 + L1 smoke 全绿） |
| **总分 / 档位** | **9/10 · A** |
| 状态 | **reverified**（2026-07-30 16:18 · feature-truth-verify 复验） |
| **sampling** | **none**（主消费路径 T1–T5 全验；调度/模板管理为 Out） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | Hub 展示授权模板网格 + 预制入口；搜索/格式筛选即时生效 | `docs/ui/layout.md` §3/§5 · 归档 plan `2026-07-17-reports-de-ia-complete.md` |
| T2 | `/admin/reports/view/:nodeId` 进入 template 后自动运行一次，展示 Web 结果区 | 同上 · RPT-001 · 本轮优化 G7 |
| T3 | 预制页列出 binding，点击「运行」调 API 并展示表格/图表结果；viewer 无权时运行后诚实提示 | RPT-002 · `F08-RPT.md` |
| T4 | 角色默认报表 landing 至 `/admin/reports/view/{id}`，非模板编辑页 | 本轮 G6 · `defaultViewResolve.ts` |
| T5 | analyst/viewer 仅见 `report:read` 入口；admin 另见模板/调度 | `F01-BOOT.md` M-DEPTH · `nav-manifest.tsx` |

- **非目标**：目录树 G2、flat list API G4、调度只读 G9、卡片快捷导出 G10、另存为 G11、真实 PDF 排版引擎

## 2. 完整链路图

```
侧栏「全部报表」→ ReportCenterPage
  → GET catalog/nodes（递归）+ GET prefab/bindings + resolveDefaultReportTemplateNodeId
  → 模板卡片「查看」→ ReportViewPage
  → GET catalog/nodes/:id + POST templates/:id/run（auto-run + 手动）
  → renderSpec.sections → 结果表 + ReportExportCard

侧栏「预制报表」→ PrefabReportsPage
  → GET prefab/bindings → POST .../bindings/{key}/run → 结果区 / 403 无权态
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 路由/门禁 | 通 | `routes.tsx:164-168` · `RequireCapabilityName report:read` | center/view/prefab 需 read |
| 2 | Hub 数据 | 通 | `report-center.smoke.test.tsx` **5/5** | 含预制深链 B6 |
| 3 | 模板运行 | 通 | `ReportViewPage.smoke.test.tsx` **2/2** | auto-run POST 一次 + 结果表 |
| 4 | 预制运行 | 通 | `prefab-reports.smoke.test.tsx` **5/5** | 含 Hub 深链 auto-run |
| 5 | 默认路径 | 通 | `defaultViewResolve.test.ts` 15/15 | `reportViewPath` 断言 |
| 6 | 导航 IA | 通 | `resolve-nav.test.ts` T-NAV-RPT-01 | analyst 见全部报表+预制 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 报表中心 Hub | **REAL** | 9/A | 预制深链 + smoke 5/5 |
| T2 | 统一浏览页 | **REAL** | 9/A | `ReportViewPage.smoke` auto-run |
| T3 | 预制分析 | **REAL** | 9/A | smoke 5/5 + 后端 run 链 41/46 |
| T4 | 默认 landing | **REAL** | 9/A | 单测覆盖 reportViewPath |
| T5 | RBAC 导航 | **REAL** | 9/A | nav-manifest + resolve-nav |

**T 汇总**：9/A · **REAL**

### ~~B6 — 预制行「运行」~~ ✅ 已修复

Hub `PrefabRow` → `/admin/reports?binding={key}`；`PrefabReportsPage` 读 query 自动 run。

### ~~T2 — 统一浏览页 auto-run~~ ✅ 已修复

`ReportViewPage.smoke.test.tsx`：进页 POST run 一次 + 结果表断言。

### ~~P1 — schedules/templates smoke TooltipProvider~~ ✅ 已修复

reports 目录 vitest **21/21** 绿（2026-07-30）。

## 3b. 前端控件下钻表

功能块映射：T1→B1–B12；T2→B13–B17；T3→B18–B22

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 打开默认报表 | `ReportCenterPage.tsx:185` Link | 跳转 view 页 | 静态 Link 至 `/admin/reports/view/{id}` | 1 | 2 | 2 | 2 | 2 | 9 | UNVERIFIED | 无 smoke 覆盖默认卡片 |
| B2 | 预制报表卡片 | `QuickLinkCard` → `/admin/reports` | 进入预制页 | smoke 可见卡片 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke |
| B3 | 报表模板卡片 | admin → `/admin/reports/templates` | 管理页 | 静态+路由守卫 manage | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 代码+路由 |
| B4 | 报表调度卡片 | admin → `/admin/reports/schedules` | 调度页 | smoke 见链接 href | 2 | 2 | 2 | 2 | 2 | 10 | REAL | report-center smoke |
| B5 | 查看全部（预制） | Link `/admin/reports` | 预制列表 | 跳转正确 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke |
| B6 | 预制行「运行」 | `prefabReportsRunPath` Link | 深链 + 预制页 auto-run | `/admin/reports?binding={key}` + smoke | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | center + prefab smoke |
| B7 | 模板卡片「查看」 | `TemplateCard.tsx:104` | → view 页 | href `/admin/reports/view/tpl-1` | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke |
| B8 | 搜索报表 | `Input onChange` + `filterCatalogTemplates` | 过滤网格 | 输入「不存在」→「无匹配报表」 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke + unit |
| B9 | 格式筛选 | `setKindFilter` | PDF/Word/Excel 过滤 | 单元测试覆盖；smoke 未点按 | 2 | 2 | 2 | 2 | 1 | 9 | REAL | `reportCatalogUtils.test.ts` |
| B10 | 管理模板 | Link templates | admin 入口 | 静态 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 代码 |
| B11 | 空态浏览预制 | PanelEmptyState action | → prefab | 静态 Link | 1 | 2 | 2 | 2 | 2 | 9 | UNVERIFIED | 未测空 catalog |
| B12 | 错误重试 | `PageErrorBanner onRetry` | refetch catalog | 静态 refetch | 1 | 2 | 2 | 2 | 2 | 9 | UNVERIFIED | 未测失败态 |
| B13 | 返回报表中心 | `ReportViewPage.tsx:103` | → center | smoke href `/admin/reports/center` | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | ReportViewPage smoke |
| B14 | 运行报表 | `runMutation.mutate` | POST run + 结果 | smoke 断言 POST + 表头 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | ReportViewPage smoke |
| B15 | 编辑模板 | admin Link | → templates/:id | canManage 门控 | 1 | 2 | 2 | 2 | 2 | 9 | UNVERIFIED | 无 smoke |
| B16 | 发起导出 | `ReportExportCard.requestExport` | POST export + poll | 组件存在；未 L1 | 1 | 2 | 1 | 2 | 2 | 8 | UNVERIFIED | companion 后端有测 |
| B17 | 进入 auto-run | `useEffect` L91-95 | 进页自动 run 一次 | smoke：POST 仅 1 次 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | ReportViewPage smoke |
| B18 | 预制运行 | `usePrefabReports runMutation` | POST run → 表格 | smoke 点击→status/cnt 列 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke |
| B19 | Binding 表单 | `PrefabBindingForm` | admin PUT binding | manage 门控；smoke 未覆盖表单 | 1 | 2 | 2 | 2 | 2 | 9 | UNVERIFIED | 代码 |
| B20 | 预制页导出 | `ReportExportCard` | 同 B16 | 未 L1 | 1 | 2 | 1 | 2 | 2 | 8 | UNVERIFIED | — |
| B21 | viewer 无权运行 | forbidden 卡片 | 403 后提示 | smoke viewer+mock 403 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke |
| B22 | 列表加载失败 | `PageErrorBanner` | 重试 bindings | 未 L1 | 1 | 2 | 2 | 2 | 2 | 9 | UNVERIFIED | — |

**Out（本轮不验）**：`ReportTemplatesPage` 树深度操作、真实 PDF 排版、导出文件内容正确性

**打通但不对**（L≥2 且 C≤1）：无  
**假功能**（STUB/BROKEN）：无  
**缺 L1**（UNVERIFIED）：B1,B11,B12,B15,B16,B19–B22（非主路径或 Out）

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 Hub | 2 | 2 | 2 | 2 | 2 | **10** | A | **REAL** | B6 已修复 |
| T2 浏览页 | 2 | 2 | 2 | 2 | 2 | **10** | A | **REAL** | ReportViewPage smoke |
| T3 预制 | 2 | 2 | 2 | 2 | 2 | **9** | A | REAL | — |
| T4 默认路径 | 2 | 2 | 2 | 2 | 1 | **9** | A | REAL | 仅单测 |
| T5 RBAC | 2 | 2 | 2 | 2 | 2 | **9** | A | REAL | — |
| **总体（T1–T5）** | — | — | — | — | — | **9** | **A** | **REAL** | 主消费路径 |

## 3d. 覆盖矩阵（必验子能力）

| 实体 | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|------|------|------|-------|-----|------|---|---|------|------|
| T1 Hub | 页面 | ✅ | ✅ | ✅ | UI+CHAIN | 2 | 2 | **REAL** | report-center smoke 5/5 |
| T2 浏览页 | 页面 | ✅ | ✅ | ✅ | UI+CHAIN | 2 | 2 | **REAL** | ReportViewPage smoke 2/2 |
| T3 预制 | 页面 | ✅ | ✅ | ✅ | UI+CHAIN | 2 | 2 | **REAL** | prefab smoke 5/5 |
| T4 默认路径 | 路由 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | defaultViewResolve 15/15 |
| T5 RBAC | 导航 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | resolve-nav T-NAV-RPT-01 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **5**（T1–T5） |
| REAL 达标 | **5 / 5** |
| UI L1（Vitest smoke） | 3 页 + 38 tests 绿 |
| BROWSER L1 | **0**（未真机走查） |
| 后端 companion | 41 pass / 5 fail（ACL 环境漂移，非 run 主链断） |
| **逐一校验** | **是** — T1–T5 均有 L1 证据 |
| 总体可否 REAL（scope 内） | **是** |

## 4. 动态验证记录（期望 vs 实际）

### 4a. 初验（2026-07-30 上午 · 修复前）

| 步骤 | 操作 | **期望** | **实际** | 一致？ |
|------|------|----------|----------|--------|
| 7 | ReportViewPage auto-run | POST run + 结果 | 无 FE L1 | ❌ |
| 8 | Hub 预制「运行」 | 深链/运行 | 仅 `/admin/reports` | ❌ |

### 4b. 复验（2026-07-30 16:18 · 修复后）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest report-center.smoke` | Hub + 预制深链 | **5 passed** | ✅ | 含 B6 href |
| 2 | `vitest prefab-reports.smoke` | 列表/运行/深链 auto-run/403 | **5 passed** | ✅ | |
| 3 | `vitest ReportViewPage.smoke` | auto-run 一次 + 结果表 | **2 passed** | ✅ | POST 1 次 |
| 4 | `vitest defaultViewResolve` | landing → view | **15 passed** | ✅ | |
| 5 | `vitest reportCatalogUtils` | 搜索/格式 | **2 passed** | ✅ | |
| 6 | `vitest src/pages/admin/reports/` | 目录全绿 | **38 passed / 0 fail** | ✅ | 9 files |
| 7 | `vitest resolve-nav T-NAV-RPT-01` | analyst 见全部报表+预制 | **1 passed** | ✅ | |
| 8 | `pytest RPT companion` | run 主链 | **41 pass / 5 fail** | ⚠️ | ACL 用例 403 漂移 |
| 9 | 浏览器真机 | 端到端可用 | **未执行** | — | Out |

## 5. 修复文档（已闭合）

| ID | 状态 | 摘要 |
|----|------|------|
| B6 | ✅ | `prefabReportsRunPath` + PrefabReportsPage `?binding=` auto-run |
| T2 | ✅ | `ReportViewPage.smoke.test.tsx` |
| P1 smoke | ✅ | TooltipProvider；reports 38/38 |
| P2 B1 | ⏳ backlog | 默认报表卡片 catalog 竞态 fallback |

## 6. 仍开放（scope 外 / 非阻塞）

| 项 | 说明 |
|----|------|
| B1 默认报表卡片 | 无 smoke；catalog 未含 id 时不展示 |
| B16/B20 导出 | 无 FE L1；未验文件内容 |
| B19 Binding 表单 | admin PUT 无 smoke |
| 后端 ACL 5 用例 | pytest 403 漂移，run 主链 41 绿 |
| 浏览器 E2E | 未跑 Playwright 报表路径 |

## 7. 验证命令（复现）

```bash
cd fe && npx vitest run src/pages/admin/reports/report-center.smoke.test.tsx src/pages/admin/reports/prefab-reports.smoke.test.tsx src/lib/defaultViewResolve.test.ts src/lib/reportCatalogUtils.test.ts

cd fe && npx vitest run src/pages/admin/reports/

python -m pytest tests/test_ff_rpt_companion_e95d.py tests/test_m9_rpt_theme_r233.py tests/test_m10_report_templates_r234.py -q
```

## 8. 交接

- **结论（scope T1–T5）**：**REAL · 9/A** — 主消费路径在 Vitest L1 下**真实可用**（Hub → 查看/运行 → 结果展示）。
- **不等于**：导出 PDF 内容正确、全控件 B1–B22 REAL、浏览器 E2E、后端 ACL 套件全绿。
- **文档**：本文件 · 状态 `reverified`
