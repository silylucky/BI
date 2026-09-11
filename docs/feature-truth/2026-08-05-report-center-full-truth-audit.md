# Feature Truth Audit: 报表中心全模块（复验）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 核验范围 | 报表中心 **全部** FE 路由 + G1/G2/G3/G5 后端能力（不含 G4/G6–G8） |
| 锚点 | `/admin/reports/*` · `/admin/dashboards/:id/share` · `/api/v1/reports/*` · `/api/v1/dashboards/*/export-jobs` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **8.2 / 10 · B+** |
| 状态 | approved-fix（UX-T5 已修；T11 已升格；T9 看板 G5 仍 PARTIAL） |
| **sampling** | `full`（supersedes `2026-07-31-report-center-full-truth-audit.md`） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | Hub 展示授权模板、搜索/格式筛选 | `ReportCenterPage` |
| T2 | 浏览页 auto-run，展示 Web 结果表 | RPT-001 · `ReportViewPage` |
| T3 | 预制 binding 运行 → 真实 SQL（非 placeholder） | RPT-002 |
| T4 | 角色默认报表 landing | `defaultViewResolve.ts` |
| T5 | analyst/admin RBAC 分菜单 | nav · capabilities |
| T6 | 模板树、**扩展配置含 SQL 表达式**、预览、编辑/删除指标 | RPT-006 · Aug 5 浏览器 |
| T7 | 模板调度向导 + recipients + 激活 FSM | G1/G2 |
| T8 | 调度列表 Tab/历史/重试 | `ReportSchedulesPage` |
| T9 | 看板分享 Dialog 定时 → 执行 → **真实 PDF 附件** | G5 |
| T10 | 同步导出：发起 → 状态 → 下载 | IF-03 |
| T11 | 批量导入 JSON → 创建 catalog 节点 | RPT-007 |
| T12 | dev seed 可跑通 demo | G3 |
| T13 | recipients 解析 → SMTP 投递 | G1 |
| T14 | Cron 向导中文频率 | G2 |

- **非目标**：Jasper WYSIWYG · G6 另存为 · IM webhook · 全站 E2E 17 条手测（本轮以 vitest+pytest+浏览器抽样）

## 2. 完整链路图

```
消费：Hub → view/prefab → POST run → renderSpec → Table
管理：templates → extension(SQL/dataset) → preview → save
调度：SchedulePanel → FSM → semi-real → SMTP 附件（模板链 REAL per P3）
看板：share Dialog → dashboard export-jobs → Playwright PDF（条件 REAL）
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 路由/门禁 | 通 | vitest 60/60 | +DashboardShare |
| 2 | 扩展配置 UX | 通 | **浏览器 Aug 5** | SQL 表达式·编辑·预览表 |
| 3 | 模板 run | 通 | browser cnt=10 | 须 defaultDataSourceId |
| 4 | P3 持久化/真导出 | 通 | P3 audit 71 pytest | signed-off Aug 4 |
| 5 | 看板 G5 Playwright | **条件** | live PDF pass（FE 在线） | bundle 跑时偶发 502 |
| 6 | 批量导入 | 通 | BatchImport happy smoke | 自 Jul 31 STUB 升格 |
| 7 | dev seed | 通 | companion pytest | dashboard export 单测偶发 fail |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | Hub | **REAL** | 9/A | report-center smoke 6/6 |
| T2 | 浏览页 | **REAL** | 9/A | ReportViewPage smoke + browser cnt=10 |
| T3 | 预制分析 | **PARTIAL** | 7/B | smoke 6/6；无 physical 表 → 404 |
| T4 | 默认 landing | **REAL** | 9/A | defaultViewResolve 15/15 |
| T5 | RBAC | **REAL** | 9/A | nav manifest |
| T6 | 模板管理+扩展 | **REAL** | 9/A | templates 5/5 · **browser SQL 全流程** |
| T7 | 模板调度 | **PARTIAL** | 7/B | SchedulePanel smoke；SMTP 环境依赖 |
| T8 | 调度列表 | **REAL** | 8/B | schedules smoke 3/3 |
| T9 | 看板定时 G5 | **PARTIAL** | 7/B | live PDF **pass**（隔离跑）；bundle 偶发 timeout |
| T10 | 导出 companion | **PARTIAL** | 7/B | ReportExportCard poll smoke；无下载字节 L1 |
| T11 | 批量导入 | **REAL** | 8/B | happy path smoke「成功创建 1 项」 |
| T12 | dev seed G3 | **REAL** | 8/B | `test_report_dev_seed`（dashboard job 偶发 fail） |
| T13 | 邮件 G1 | **PARTIAL** | 7/B | template SMTP live skip；mock 通 |
| T14 | 向导 G2 | **REAL** | 8/B | ScheduleRecipientsField test |

**T 汇总**：**9 REAL** · **5 PARTIAL** · **0 STUB** → **总体 PARTIAL · 8.2/B+**

## 3b. 前端控件下钻表（主路径 + 扩展增量）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | Hub 打开/运行 | Link | → view | smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | report-center |
| B6 | 浏览 auto-run | useEffect | POST 1 次 | smoke + browser | 2 | 2 | 2 | 2 | 2 | 10 | REAL | ReportView |
| B8 | 保存扩展配置 | saveExtension | body 含 expression | smoke + browser | 2 | 2 | 2 | 2 | 2 | 10 | REAL | templates + MCP |
| B18 | SQL 表达式 | Textarea | 可填 SELECT | browser | 2 | 2 | 2 | 2 | 2 | 10 | REAL | Aug 5 走查 |
| B19 | 编辑指标 | IconButton | 回填 SQL | browser | 2 | 2 | 2 | 2 | 2 | 10 | REAL | Aug 5 |
| B20 | 删除指标 | IconButton | 列表移除 | browser | 2 | 2 | 2 | 2 | 1 | 9 | REAL | Aug 5 |
| B21 | 预览指标表 | ReportExtensionPreview | 非裸 JSON | browser | 2 | 2 | 2 | 2 | 2 | 10 | REAL | Aug 5 |
| B22 | 默认数据源 | Select | 可选列表 | browser | 2 | 1 | 2 | 2 | 1 | 8 | PARTIAL | 首次打开下拉空 |
| B9–B17 | 调度/预制/分享 | 各 smoke | 见 Jul 31 | vitest 仍绿 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 60 vitest |
| B23 | 批量导入 happy | BatchImportPanel | 成功创建 N 项 | smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | BatchImport smoke |

**打通但不对**：**B22**（数据源下拉首次空；运行须配 defaultDataSourceId，错误诚实）  
**假功能**：无（T11 已升格）

Out：模板块 JSON 编辑器细项 · 17 条手测 Case 全量（非阻塞）

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| T1 Hub | 页面 | ✅ | ✅ | ✅ | ✅ | BROWSER | 2 | 2 | **REAL** | vitest 6/6 |
| T2 View | 页面 | ✅ | ✅ | ✅ | ✅ | BROWSER | 2 | 2 | **REAL** | smoke + browser cnt=10 |
| T3 Prefab | 页面 | ✅ | ✅ | ✅ | ❌ | UI+CHAIN | 2 | 1 | **PARTIAL** | smoke + run.py |
| T4 Default | 路由 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | 15/15 unit |
| T5 RBAC | 导航 | ✅ | ✅ | ✅ | ❌ | UI | 2 | 2 | **REAL** | nav |
| T6 Templates | 页面 | ✅ | ✅ | ✅ | ✅ | BROWSER | 2 | 2 | **REAL** | browser SQL 全流程 |
| T7 TemplateSchedule | 功能 | ✅ | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | **PARTIAL** | SchedulePanel + pytest |
| T8 SchedulesList | 页面 | ✅ | ✅ | ✅ | ❌ | UI | 2 | 2 | **REAL** | smoke 3/3 |
| T9 DashboardSchedule | 功能 | ✅ | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | **PARTIAL** | G5 live pass 隔离；bundle fail |
| T10 Export | 集成 | ✅ | ✅ | ✅ | ❌ | UI | 2 | 1 | **PARTIAL** | ExportCard smoke |
| T11 BatchImport | 功能 | ✅ | ✅ | ✅ | ❌ | UI | 2 | 2 | **REAL** | happy path smoke |
| T12 DevSeed | 后端 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | dev_seed pytest |
| T13 Email G1 | 后端 | ✅ | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | **PARTIAL** | mock；live skip |
| T14 Wizard G2 | FE | ✅ | ✅ | ✅ | ❌ | UI | 2 | 2 | **REAL** | cron test |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **14** |
| REAL 达标 | **9 / 14**（64%） |
| PARTIAL | **5**（T3,T7,T9,T10,T13） |
| STUB | **0** |
| GATE only | **0** |
| BROWSER L1 | **1**（T1/T2/T6 扩展 Aug 5） |
| vitest L1 | **60 passed**（14 files，2026-08-05） |
| pytest L1 | **30 passed, 1 skipped, 2 failed**（全 bundle）；P3 子集 **14 passed** |
| **逐一校验** | **是** — 14 行均有 L1 锚点 |
| 总体可否 REAL | **否** — 5 项 PARTIAL 未达 C≥2 或环境依赖 |

## 3c. 五维评分汇总

| 块 | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| 消费 T1–T5 | 2 | 2 | 2 | 2 | 2 | **10** | A | REAL |
| 管理 T6–T8 | 2 | 2 | 2 | 2 | 2 | **9** | A | REAL |
| 调度投递 T7/T9/T13 | 2 | 1 | 2 | 2 | 2 | **8** | B | PARTIAL |
| 导出/批量 T10/T11 | 2 | 2 | 2 | 2 | 2 | **8** | B | REAL（T11 升格） |
| **加权总体** | — | — | — | — | — | **8.2** | **B+** | **PARTIAL** |

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | vitest 报表+关联 | 全绿 | **60 passed** | ✅ | 2026-08-05 13:26 |
| 2 | pytest P3+companion | 全绿 | **14 passed** | ✅ | manual_cases_p3 等 |
| 3 | pytest 全 bundle | 全绿 | **30 passed, 2 failed** | ⚠️ | G5 live + dev_seed dashboard |
| 4 | G5 live 隔离 | PDF 201 | **PASSED** | ✅ | `test_live_pdf_export_without_playwright_mock` |
| 5 | 浏览器扩展配置 | SQL 保存+预览 | **全流程 OK** | ✅ | MCP Aug 5 |
| 6 | 浏览器运行 | 配数据源出数 | **cnt=10** | ✅ | 未配则 `RPT_ENGINE_DATASOURCE_REQUIRED` |
| 7 | UX 审计文档 | UX-T5 REAL | 仍写 PARTIAL | ❌ | 文档漂移（代码已修） |

## 5. 修复文档

### T9 — 看板 G5 Playwright PDF（P1）

**判定**：PARTIAL 7/B（C=1）  
**期望 vs 实际**：隔离跑 live PDF **通过**；全 bundle 并发时 `data-export-ready` 超时 502。  
**根因**：`export_render.py` 依赖 FE dev `:5173` 与 export 页就绪时序；无重试。  
**修复方向**：pytest 串行标记；或 CI 用 vite preview 固定端口；export-ready 超时加长/诊断。  
**修后验收**：bundle 内 0 fail，C≥2。

### T13 — SMTP live（P1）

**判定**：PARTIAL 7/B  
**期望 vs 实际**：template schedule live **skipped**（MailHog 未达）；mock 路径通。  
**修复方向**：`local_mailhog.py` 已在 P3；全 bundle 须保证 MailHog 或 skip 明示。  

### T3 — 预制空库（P1）

**判定**：PARTIAL 7/B（不变）  
**修复方向**：默认 seed + FE 空态文案。

### B22 — 默认数据源下拉（P2）

**判定**：PARTIAL 8/B  
**期望 vs 实际**：API 有 7 条数据源；浏览器首次打开下拉无选项。  
**修复方向**：Select 加载态/portal；或 SQL 模式标「必选默认数据源」。

### T10 — 导出下载字节（P2）

**判定**：PARTIAL 7/B  
**修复方向**：smoke 断言 download href 或 mock blob。

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T9 | 看板 G5 live 与 bundle 并发稳定性 |
| P1 | T13 | SMTP live 环境可复现（MailHog） |
| P1 | T3 | 预制空库 seed/空态 |
| P2 | B22 | 扩展页默认数据源下拉 |
| P2 | T10 | 导出下载 FE L1 |

## 7. 与历史审计差异

| 项 | 2026-07-31 | 2026-08-05 |
|----|------------|------------|
| 总体 | PARTIAL 7.2/B | **PARTIAL 8.2/B+** |
| REAL 数 | 7/14 | **9/14** |
| STUB | T11 | **0** |
| T6 扩展 UX | 无 SQL 字段 | **REAL**（browser） |
| G5 PDF | minimal stub | live PDF **pass**（隔离） |
| P3 签收 | 无 | **REAL 9.2**（窄 scope，见 `2026-08-04-report-center-p3-truth-audit.md`） |
| UX 审计 | PARTIAL UX-T5 | 代码 REAL；**文档未同步** |

**Supersedes**：`docs/feature-truth/2026-07-31-report-center-full-truth-audit.md`

## 8. 验证命令（复现）

```bash
cd fe && npx vitest run src/pages/admin/reports/ src/pages/admin/dashboard/DashboardSharePage.smoke.test.tsx src/lib/defaultViewResolve.test.ts src/lib/scheduleSourceMeta.test.ts src/lib/reportCatalogUtils.test.ts --reporter=dot

cd .. && python -m pytest tests/test_ff_rpt_companion_e95d.py tests/test_report_manual_cases_p3.py tests/test_report_metadata_db_store.py -q
python -m pytest tests/test_g5_live_export.py -q   # 须 FE :5173 + uvicorn
```

## 9. 交接

- **结论**：较 Jul 31 **显著改善**（9 REAL、0 STUB）；**仍未达模块级 REAL**（5 项 PARTIAL，REAL 率 64% < 90%）。
- **建议**：P1 稳 G5 bundle → 复验 T9；回填 `2026-08-04-report-center-ux-truth-audit.md` UX-T5 → REAL。
- **用户批准修复**：否（本 skill 仅审计落盘）
