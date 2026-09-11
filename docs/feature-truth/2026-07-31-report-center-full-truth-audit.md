# Feature Truth Audit: 报表中心全模块

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 核验范围 | 报表中心 **全部** FE 路由 + G1/G2/G3/G5 后端能力（不含 G4/G6–G8） |
| 锚点 | `/admin/reports/*` · `/admin/dashboards/:id/share` · `/admin/data-screens/:id/share` · `/api/v1/reports/*` · `/api/v1/dashboards/*/export-jobs` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7.2 / 10 · B** |
| 状态 | draft |
| **sampling** | **full**（用户：「报表中心所有功能」） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | Hub 展示授权模板、预制预览、admin 快捷入口；搜索/格式筛选生效 | `ReportCenterPage` · 手测 Case 2.x |
| T2 | 浏览页进入 template 后 auto-run，展示 Web 结果表 | RPT-001 · `ReportViewPage` |
| T3 | 预制 binding 列表 → 运行 → 真实 SQL 结果（非 placeholder） | RPT-002 · `prefab/run.py` |
| T4 | 角色默认报表 landing 至 `/admin/reports/view/{id}` | G6 · `defaultViewResolve.ts` |
| T5 | analyst 仅 read 入口；admin 见模板/调度 | nav · `report:read` / `report:manage` |
| T6 | 模板树 CRUD、扩展配置保存、预览 render-spec | RPT-004/006 · `ReportTemplatesPage` |
| T7 | 模板调度：日/周/月向导 + 角色/用户/邮箱 + 激活 FSM + 立即执行 | G1/G2 · land-design |
| T8 | 调度列表：源类型 Tab、接收人摘要、历史展开、重试 | G5 列表 · `ReportSchedulesPage` |
| T9 | 看板/大屏分享 Dialog 内创建定时报告 → 执行 → PDF 附件投递 | G5 · land-design |
| T10 | 同步导出 companion：发起 → 状态 → 下载 | IF-03 · `ReportExportCard` |
| T11 | 批量导入 JSON 创建 catalog 节点 | RPT-007 · `BatchImportPanel` |
| T12 | dev 空库 `DEV_REPORT_SEED=1` 可跑通模板+预制+调度 demo | G3 · `dev_seed.py` |
| T13 | 调度执行解析 recipients → SMTP 投递至真实邮箱 | G1 · `delivery_adapter.py` |
| T14 | Cron 向导与 `describeCron` 中文频率一致 | G2 · `ScheduleWizard` |

- **非目标**：G4 真实 Word/PDF 排版；G6 另存为；G7 WYSIWYG；G8 统一导出中心；IM webhook；浏览器 E2E（本轮未跑）

## 2. 完整链路图

```
消费：Hub → view/prefab → POST run → renderSpec → Table
管理：templates → extension/schedule → POST schedules → FSM → semi-real execute → delivery
看板：share Dialog → DashboardSchedulePanel → POST schedules(sourceType=dashboard) → execute → dashboard export-jobs → email
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 路由/门禁 | 通 | `routes.tsx:163-168` | read/manage 分 capability |
| 2 | Hub/浏览/预制 UI | 通 | vitest **50/50** | 含深链 auto-run |
| 3 | 模板/调度 UI | 通 | templates/schedules/SchedulePanel smoke | recipients 表单 |
| 4 | 看板定时 UI | 通 | `DashboardSharePage.smoke` G5 | 2026-07-31 已接线 |
| 5 | 模板 run 后端 | 条件通 | `engine/execute.py` | 无 dataSourceId → placeholder |
| 6 | 预制 run 后端 | 条件通 | `prefab/run.py` | 无 physical table → 404 |
| 7 | 调度 semi-real | 通 | `test_dash_rpt_r58.py` 等 | mock delivery 可绿 |
| 8 | G5 PDF 产物 | **假通** | `export_jobs.py:_minimal_pdf` | 非真实看板渲染 |
| 9 | SMTP 投递 | **条件** | `delivery_adapter.py` | 未配 SMTP → degraded/failed |
| 10 | dev seed | 通 | `test_report_dev_seed.py` **4/4** | 依赖 sample DB |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | Hub | **REAL** | 9/A | report-center smoke 5/5 |
| T2 | 浏览页 | **REAL** | 9/A | ReportViewPage smoke 2/2 |
| T3 | 预制分析 | **PARTIAL** | 7/B | smoke 5/5；无 equipment 表则 404 |
| T4 | 默认 landing | **REAL** | 9/A | defaultViewResolve 15/15 |
| T5 | RBAC | **REAL** | 9/A | prefab viewer 403 smoke |
| T6 | 模板管理 | **REAL** | 8/B | templates smoke 4/4；块编辑未 L1 |
| T7 | 模板调度 | **PARTIAL** | 7/B | SchedulePanel smoke；激活后不可改；SMTP 依赖 |
| T8 | 调度列表 | **REAL** | 8/B | schedules smoke 3/3 |
| T9 | 看板定时 G5 | **PARTIAL** | 6/C | UI+API 通；PDF 为 minimal stub |
| T10 | 导出 companion | **PARTIAL** | 7/B | 后端 companion 有测；FE 无 L1 下载校验 |
| T11 | 批量导入 | **STUB** | 5/C | 仅 JSON 校验 smoke；无 E2E 入库 |
| T12 | dev seed G3 | **REAL** | 8/B | pytest 幂等；需 MySQL sample |
| T13 | 邮件 G1 | **PARTIAL** | 6/C | 解析 recipients 通；生产 SMTP 未验 |
| T14 | 向导 G2 | **REAL** | 8/B | describeCron + ScheduleRecipientsField test |

**T 汇总**：7 REAL · 6 PARTIAL · 1 STUB → **总体 PARTIAL · 7.2/B**

## 3b. 前端控件下钻表（主路径）

功能块映射：T1→B1–B8；T2→B9–B11；T3→B12–B16；T6→B17–B20；T7/T8→B21–B28；T9→B29–B31

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 打开并运行 | Link view | → auto-run | smoke tpl-1 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | report-center |
| B2 | 看板定时报告 QuickLink | `?tab=dashboard` | 调度 Tab | href 断言 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | report-center |
| B3 | 预制运行 | POST run | 表格列 | smoke status/cnt | 2 | 2 | 2 | 2 | 2 | 10 | REAL | prefab smoke |
| B4 | Hub 深链 auto-run | `?binding=` | POST 1 次 | prefab smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | prefab smoke |
| B5 | viewer 无权运行 | 403 | 诚实卡片 | smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | prefab smoke |
| B6 | 浏览页 auto-run | useEffect | POST 1 次 | ReportView smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | ReportView smoke |
| B7 | 发起导出（浏览） | ReportExportCard | poll + download | 无 FE L1 | 1 | 1 | 1 | 2 | 2 | 7 | UNVERIFIED | 后端 companion |
| B8 | 保存扩展配置 | saveExtension | toast 成功 | templates smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | templates smoke |
| B9 | 创建调度+recipients | SchedulePanel POST | body 含 recipients | SchedulePanel smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | SchedulePanel smoke |
| B10 | 执行历史重试 | retryExecution | toast | SchedulePanel smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | SchedulePanel smoke |
| B11 | 调度 Tab/搜索 | client filter | 过滤行 | schedules smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | schedules smoke |
| B12 | 在看板分享页新建 | Link dashboards | 看板列表 | href `/admin/dashboards` | 2 | 2 | 2 | 2 | 2 | 10 | REAL | schedules smoke |
| B13 | 分享 Dialog 定时报告 | DashboardSchedulePanel | 创建表单 | G5 smoke | 2 | 2 | 2 | 2 | 2 | 10 | REAL | DashboardShare smoke |
| B14 | 创建定时报告 | POST schedules | 201 + list | API test G5 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | test_report_dashboard_schedule |
| B15 | 立即执行（semi-real） | POST execute | history 行 | r58 pytest | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | SMTP/PDF 内容 |
| B16 | 配置首条绑定 | PrefabBindingForm | PUT binding | UI 有；无 submit L1 | 1 | 2 | 1 | 2 | 2 | 8 | UNVERIFIED | prefab empty smoke |
| B17 | 批量导入 JSON | BatchImportPanel | 创建节点 | 仅 parse error smoke | 1 | 1 | 1 | 2 | 2 | 7 | STUB | BatchImport smoke |

**打通但不对**（L≥2 且 C≤1）：**B15**（执行成功但 PDF/邮件内容非生产级）  
**假功能**：**B17**（批量导入 happy path 未 L1）

## 3d. 覆盖矩阵（必验实体 · full scope）

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| T1 Hub | 页面 | ✅ | ✅ | ✅ | UI | 2 | 2 | **REAL** | vitest 5/5 |
| T2 View | 页面 | ✅ | ✅ | ✅ | UI | 2 | 2 | **REAL** | vitest 2/2 |
| T3 Prefab | 页面 | ✅ | ✅ | ✅ | UI+CHAIN | 2 | 1 | **PARTIAL** | smoke + `prefab/run.py` |
| T4 Default | 路由 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | defaultViewResolve 15/15 |
| T5 RBAC | 导航 | ✅ | ✅ | ✅ | UI | 2 | 2 | **REAL** | prefab 403 smoke |
| T6 Templates | 页面 | ✅ | ✅ | ✅ | UI | 2 | 2 | **REAL** | vitest 4/4 |
| T7 TemplateSchedule | 功能 | ✅ | ✅ | ✅ | CHAIN | 2 | 1 | **PARTIAL** | SchedulePanel + r53/r58 pytest |
| T8 SchedulesList | 页面 | ✅ | ✅ | ✅ | UI | 2 | 2 | **REAL** | vitest 3/3 |
| T9 DashboardSchedule | 功能 | ✅ | ✅ | ✅ | UI+CHAIN | 2 | 1 | **PARTIAL** | G5 smoke + `_minimal_pdf` |
| T10 Export | 集成 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | **PARTIAL** | companion pytest |
| T11 BatchImport | 功能 | ✅ | ❌ | ✅ | GATE | 1 | 1 | **STUB** | error-only smoke |
| T12 DevSeed | 后端 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | **REAL** | test_report_dev_seed 4/4 |
| T13 Email G1 | 后端 | ✅ | ✅ | ✅ | CHAIN | 2 | 1 | **PARTIAL** | recipients pytest；SMTP 环境 |
| T14 Wizard G2 | FE | ✅ | ✅ | ✅ | UI | 2 | 2 | **REAL** | ScheduleRecipientsField + cron |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **14** |
| REAL 达标 | **7 / 14** |
| PARTIAL | **6** |
| STUB | **1** |
| GATE only | **1**（T11） |
| UI L1（Vitest） | **50 passed**（12 files，2026-07-31） |
| 后端 L1（pytest 抽样） | **15 passed**（companion + dev_seed + dashboard_schedule） |
| BROWSER L1 | **0** |
| **逐一校验** | **是** — 14 行均有代码或测试锚点 |
| 总体可否 REAL | **否** — T9/T3/T7/T13/T10/T11 未达 C≥2 或 L≤1 |

## 3c. 五维评分汇总（模块级）

| 块 | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| 消费 T1–T5 | 2 | 2 | 2 | 2 | 2 | **10** | A | REAL |
| 管理 T6–T8 | 2 | 2 | 2 | 2 | 2 | **9** | A | REAL |
| 调度投递 T7/T9/T13 | 2 | 1 | 2 | 2 | 2 | **9** | A→**PARTIAL** | PARTIAL |
| 导出/批量 T10/T11 | 1 | 1 | 1 | 2 | 2 | **7** | B | PARTIAL/STUB |
| **加权总体** | — | — | — | — | — | **7.2** | **B** | **PARTIAL** |

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest` 报表目录 | 全绿 | **50 passed** | ✅ | 2026-07-31 11:34 |
| 2 | `pytest test_ff_rpt_companion` | companion 通 | **13 passed** | ✅ | 含 prefab/run/export |
| 3 | `pytest test_report_dev_seed` | G3 种子 | **4 passed** | ✅ | template+prefab+schedule |
| 4 | `pytest test_report_dashboard_schedule` | G5 API | **2 passed** | ✅ | create+list by sourceId |
| 5 | 读 `export_jobs._minimal_pdf` | 看板 PDF 含真实图表 | 仅文本 PDF 壳 | ❌ | `backend/app/dashboard/export_jobs.py:30-38` |
| 6 | 读 `delivery_adapter` 无 SMTP | 执行 degraded + 错误文案 | semi_real_delivery_degraded | ✅ | executor L142-147 |
| 7 | 浏览器 E2E | 17 条手测 | **未执行** | — | Blind spot |

## 5. 修复文档（P0 / P1）

### T9 — 看板定时 PDF 附件（G5 正确性）

**判定 / 得分**：PARTIAL **6/C**（L=2, C=1）  
**期望 vs 实际**：期望定时执行附件为看板/layout 渲染 PDF；实际 `_minimal_pdf()` 写入固定字符串，Excel 为 CSV 行。  
**根因**：`backend/app/dashboard/export_jobs.py:30-52` MVP 占位。  
**修复方向**：接入 layout→render→PDF 管线（或截图链）；pytest 断言 PDF 含 widget 标题字节。  
**修后验收**：C≥2，T9 REAL。

### T13 — 邮件投递（G1 生产正确性）

**判定**：PARTIAL **6/C**  
**期望 vs 实际**：期望配置 SMTP 后真实送达 To 列表；未配置时 FE 应明确「投递降级」且手测可复现。  
**根因**：`delivery_adapter._send_smtp` 依赖 `RPT_SMTP_*`；executor 将 unconfigured 标 failed/degraded。  
**修复方向**：dev `.env.example` 文档化；可选 dev 内置 mailhog；FE 历史表展示 `errorMessage`。  
**优先级**：P1（链路已通，内容/环境依赖）

### T3 — 预制运行数据前提

**判定**：PARTIAL **7/B**  
**期望 vs 实际**：空库无 `DEV_REPORT_SEED` 时预制 run → `RPT_PREFAB_ENTITY_NOT_READY`。  
**根因**：`prefab/run.py:_resolve_table` 需 physical 表。  
**修复方向**：确保 dev 默认 seed；空态 FE 提示「启用 DEV_REPORT_SEED」而非仅管理员文案。  
**优先级**：P1

### T11 — 批量导入

**判定**：STUB **5/C**  
**期望 vs 实际**：JSON 粘贴 → 批量创建 catalog 节点；仅 invalid JSON smoke。  
**根因**：`BatchImportPanel.smoke.test.tsx` 仅测 parse error。  
**修复方向**：补 happy path smoke + pytest POST `/reports/batch`。  
**优先级**：P2

### T7 — 调度激活后不可编辑

**判定**：PARTIAL（产品边界）**7/B**  
**期望 vs 实际**：用户期望改接收人；FE 只读 + 取消重建引导（2026-07-31 已加文案）。  
**修复方向**：若产品要编辑 → 后端 PATCH schedule；否则保持引导。  
**优先级**：P2 产品确认

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T9 | G5 PDF 仍为 minimal stub，不满足 DE 附件预期 |
| P1 | T13 | SMTP 未配时投递失败/降级，需环境与 UX 闭环 |
| P1 | T3 | 空库预制 run 依赖 dev seed / equipment 表 |
| P2 | T10 | FE 导出下载无 L1 |
| P2 | T11 | 批量导入 happy path 未验 |
| P2 | T7 | 激活后调度不可编辑（或补 PATCH） |

## 7. 与 2026-07-30 审计差异

| 项 | 2026-07-30 | 2026-07-31 |
|----|------------|------------|
| 范围 | T1–T5 消费路径 | **全模块 14 实体** |
| 总体 | REAL 9/A | **PARTIAL 7.2/B** |
| G5 看板定时 UI | Out / 断链 | **已接线**（DashboardShareDialog） |
| G1/G2 FE | Out | **REAL**（recipients + wizard） |
| 主要回落原因 | — | G5 PDF stub、SMTP、批量导入 STUB |

## 8. 验证命令（复现）

```bash
cd fe && npx vitest run src/pages/admin/reports src/pages/admin/dashboard/DashboardSharePage.smoke.test.tsx src/lib/scheduleSourceMeta.test.ts src/lib/defaultViewResolve.test.ts src/lib/reportCatalogUtils.test.ts

cd .. && python -m pytest tests/test_ff_rpt_companion_e95d.py tests/test_report_dev_seed.py tests/test_report_dashboard_schedule.py -q
```

## 9. 交接

- **结论**：消费与管理 **主路径 REAL**；**调度投递与 G5 附件 PARTIAL**；批量导入 **STUB**。
- **建议**：P0 修 `export_jobs` PDF 管线 → 复验 T9；P1 配 SMTP/mailhog → 复验 T13。
- **用户批准修复**：否（本 skill 仅审计落盘）
- **文档**：`docs/feature-truth/2026-07-31-report-center-full-truth-audit.md`
