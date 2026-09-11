# Feature Truth Audit: G5 看板定时报告 ToB 完善

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | ToB 完善全量（Phase 1–4 + 原 G5-T1…T13 回归） |
| 锚点 | `DashboardSchedulePanel` · `DashboardEditPage` · `PATCH /reports/schedules` · `scheduler/store` · `channels/` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.8 / 10 · C+** |
| 状态 | approved-fix（P0：`SchedulePanel` 缺 import 已修 · 见 §5） |
| **sampling** | `full`（G5-T1…T13 + TOB-T1…T18 共 31 项） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| G5-T1…T13 | 见 [2026-08-03 G5 audit](2026-08-03-report-center-g5-visual-pdf-truth-audit.md) | 交付闭环 DoD |
| TOB-T1 | 创建后显示激活引导条，可一键激活 | Phase 1.1 |
| TOB-T2 | 编辑页「定时推送」独立入口 | Phase 1.2 |
| TOB-T3 | `dashboard:schedule` + owner 可写 | Phase 1.3 |
| TOB-T4 | `PATCH` draft 可保存 | Phase 1.4 |
| TOB-T5 | 附件 PDF/Excel 单选语义 | Phase 1.5 |
| TOB-T6 | compact 历史有错误列 | Phase 1.6 |
| TOB-T7 | 「试发邮件」可触发 execute | Phase 1.6 |
| TOB-T8 | 空看板 export → 422 | Phase 1.7 |
| TOB-T9 | ORM 表 + migration 0032 | Phase 2.1 |
| TOB-T10 | `RPT_SCHEDULE_STORE=memory\|db` | Phase 2.1 |
| TOB-T11 | 产物 ArtifactStore fs | Phase 2.2 |
| TOB-T12 | export token 持久化 DB/Redis | Phase 2.3 |
| TOB-T13 | 每看板多调度 UI | Phase 3.1 |
| TOB-T14 | 多 attachment_formats 执行 | Phase 3.2 |
| TOB-T15 | 企微 webhook 投递 | Phase 4.1 |
| TOB-T16 | 钉钉 webhook 投递 | Phase 4.1 |
| TOB-T17 | 表单投递方式多选 | Phase 4.2 |
| TOB-T18 | 多实例 cron DB tick 锁 | Phase 4.3 |

- **非目标**：模板 Jasper PDF · Celery · 飞书 · S3 产物（未实现）

## 2. 完整链路图

```
编辑页「定时推送」/ 分享页 DashboardSchedulePanel
  → POST/PATCH /api/v1/reports/schedules
  → transition → APScheduler (+ tick lock if db)
  → semi_real_execute_schedule
  → submit_dashboard_export (内存 job · 空看板 422)
  → deliver_to_channels (email + wecom + dingtalk)
  → 历史 GET .../executions
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 入口/控件 | 部分通 | vitest 7/7 通过（修 import 后） | 无 EditPage 定时推送 smoke |
| 2 | PATCH draft | 静态通 | `reports/__init__.py:310` | **无 pytest** |
| 3 | ACL owner | 静态通 | `acl.py:43` | **无 owner 单测** |
| 4 | 调度 store | 默认 memory | `config.py:50` default memory | ORM 未默认启用 |
| 5 | export job | 内存 | `export_jobs.py:34` `_jobs` | 未接 ArtifactStore |
| 6 | export token | 内存 | `export_token.py:21` | ORM 表未接线 |
| 7 | 多附件执行 | 通 | pytest mock 201 + SMTP attach | 单测 12 passed |
| 8 | IM webhook | 静态通 | `channels/dispatch.py` | **无 schedule 集成测** |
| 9 | Live PDF+FE | **断** | integration 2 skipped | FE :5173 不可达 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| G5-T6 | Playwright PDF live | **BROKEN** | 3/D | `test_g5_live_export` SKIPPED FE unreachable |
| G5-T11 | SMTP 附件 live | UNVERIFIED | 4/D | pytest mock ✓；MailHog live 未验 |
| TOB-T1 | 激活引导 | PARTIAL | 7/B | 代码存在；无 dedicated vitest |
| TOB-T2 | 独立入口 | PARTIAL | 7/B | `DashboardEditPage` 静态；无 smoke |
| TOB-T3 | 权限 | PARTIAL | 7/B | migration 0032 + acl；无 E2E owner |
| TOB-T4 | PATCH draft | PARTIAL | 6/C | API 已实现；**无自动化** |
| TOB-T5 | 附件单选 | REAL | 8/B | `ScheduleFormFields` radio |
| TOB-T6 | compact 错误列 | PARTIAL | 7/B | 代码 ✓；无 vitest 断言 errorMessage |
| TOB-T7 | 试发邮件 | PARTIAL | 7/B | 按钮存在；同 execute 路径 |
| TOB-T8 | 空看板校验 | REAL | 8/B | pytest 422 `DASHBOARD_EXPORT_EMPTY` |
| TOB-T9 | ORM migration | PARTIAL | 6/C | 0032 存在；**未验 upgrade 后读写** |
| TOB-T10 | store 切换 | PARTIAL | 6/C | memory 默认；db 路径无集成测 |
| TOB-T11 | ArtifactStore | **STUB** | 4/D | 模块存在；**export_jobs 未调用** |
| TOB-T12 | token 持久化 | **STUB** | 4/D | 仍 `_store` dict |
| TOB-T13 | 多计划 UI | PARTIAL | 7/B | 列表+新建；无多计划 vitest |
| TOB-T14 | 多附件 BE | PARTIAL | 7/B | executor loop；UI 单选 |
| TOB-T15 | 企微 | UNVERIFIED | 4/D | HTTP 客户端代码；无 schedule 测 |
| TOB-T16 | 钉钉 | UNVERIFIED | 4/D | 同上 |
| TOB-T17 | 投递多选 | PARTIAL | 7/B | FE checkbox；无 E2E |
| TOB-T18 | tick lock | PARTIAL | 6/C | `store.try_acquire_tick_lock`；仅 db 模式 |

**T 汇总**：2 REAL · 14 PARTIAL · 2 STUB · 1 BROKEN · 4 UNVERIFIED → **总体 PARTIAL**

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 创建定时报告 | createSchedule | 201 + 引导 | smoke G5 ✓ | 2 | 2 | 2 | 2 | 2 | 10 | REAL | DashboardSharePage.smoke |
| B2 | 立即激活 | transition schedule | 变 scheduled | 代码 ✓ 未 smoke | 1 | 2 | 2 | 2 | 2 | 9 | PARTIAL | ScheduleActivationBanner |
| B3 | + 新建 | setShowCreate | 表单 | 代码 only | 1 | 1 | 2 | 2 | 2 | 8 | PARTIAL | DashboardSchedulePanel |
| B4 | 保存草稿 | PATCH | 200 | **无 FE 测** | 1 | 0 | 2 | 2 | 2 | 7 | PARTIAL | useReportSchedules.updateSchedule |
| B5 | 激活/暂停/取消 | transition | FSM | SchedulePanel smoke 部分 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | SchedulePanel.smoke |
| B6 | 试发邮件 | execute | toast+邮件 | 同 execute 路径 | 1 | 1 | 2 | 2 | 2 | 8 | PARTIAL | 无 live |
| B7 | 立即执行 | execute | 历史行 | pytest ✓ mock | 2 | 2 | 2 | 2 | 2 | 10 | REAL | test_report_dashboard_schedule |
| B8 | 复制配置新建 | clone | 表单预填 | 代码 only | 1 | 1 | 2 | 2 | 2 | 8 | PARTIAL | — |
| B9 | 重试 | retryExecution | 新 execution | smoke ✓ | 2 | 2 | 2 | 2 | 2 | 10 | REAL | SchedulePanel.smoke |
| B10 | 定时推送 | setScheduleOpen | Sheet 打开 | **无 smoke** | 1 | 0 | 2 | 2 | 2 | 7 | PARTIAL | DashboardEditPage 静态 |
| B11 | 创建调度 | createMutation | 模板侧 | smoke ✓ | 2 | 2 | 2 | 2 | 2 | 10 | REAL | SchedulePanel.smoke |
| B12 | ScheduleHistoryTable | — | 渲染历史 | **曾 BROKEN** import 缺失 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 修后 smoke 2/2 |

**打通但不对**：B4（PATCH 无测）、B6（live 邮件未验）、B10（入口未 smoke）

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| G5-T1 | token | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | pytest 403 |
| G5-T6 | Playwright | ✅ | ❌ | ❌ | ❌ | NONE | 0 | 0 | BROKEN | live SKIPPED |
| G5-T11 | SMTP attach | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 1 | PARTIAL | mock attach pytest |
| TOB-T1 | 激活引导 | ✅ | ❌ | ✅ | ❌ | UI | 2 | 1 | PARTIAL | 组件存在 |
| TOB-T2 | 独立入口 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 无 smoke |
| TOB-T3 | ACL | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | acl.py |
| TOB-T4 | PATCH | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 无 pytest |
| TOB-T8 | 空看板 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | REAL | export 422 |
| TOB-T9 | ORM | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | migration 文件 |
| TOB-T10 | store db | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 默认 memory |
| TOB-T11 | artifact fs | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 未接线 |
| TOB-T12 | token db | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | 仍内存 |
| TOB-T13 | 多计划 | ✅ | ❌ | ✅ | ❌ | UI | 2 | 1 | PARTIAL | 列表 UI |
| TOB-T14 | 多附件 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | executor loop |
| TOB-T15 | 企微 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | UNVERIFIED | dispatch.py |
| TOB-T16 | 钉钉 | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | UNVERIFIED | dispatch.py |
| TOB-T17 | 投递表单 | ✅ | ❌ | ✅ | ❌ | UI | 2 | 1 | PARTIAL | ScheduleFormFields |
| TOB-T18 | tick lock | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | db only |

（G5-T2…T5、T7…T10、T12、T13 维持 2026-08-03 判定，本审计未重跑 live）

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 31（G5 13 + TOB 18） |
| GATE only | 8 |
| CHAIN | 6 |
| UI | 4 |
| BROWSER | 0 |
| NONE / BROKEN | 2（G5-T6 live + 曾 SchedulePanel crash） |
| REAL 达标 | 2/31（TOB-T8、TOB-T5 UI） |
| **逐一校验** | **否** — 已验 19/31 有自动化或 UI 证据；12 项仅 GATE 或 UNVERIFIED；live FE/PDF/MailHog/IM 未验 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| 维度 | 得分 | 说明 |
|------|------|------|
| 链路可达 L | 1.8/2 | mock/单测通；live FE 断 |
| 正确性 C | 1.4/2 | 空看板、SMTP mock 对；持久化/IM 未验 |
| 深度 D | 1.6/2 | UI smoke 有；无 browser |
| 体验 E | 1.7/2 | ToB 入口/引导已做 |
| 反馈 F | 1.3/2 | 错误列/诚实失败 ✓ |
| **加权** | **6.8 · C+** | PARTIAL |

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | pytest G5 套件 | 12+ pass | **13 passed, 2 skipped** | ✅/⚠️ | 2026-08-04 15:16 |
| 2 | vitest DashboardShare G5 | 5 pass | 5 passed | ✅ | DashboardSharePage.smoke |
| 3 | vitest SchedulePanel | 2 pass | **初失败** ScheduleHistoryTable undefined → **修后 2 passed** | ⚠️→✅ | SchedulePanel.smoke |
| 4 | live FE :5173 | reachable | SKIPPED | ❌ | test_fe_base_url_reachable |
| 5 | live PDF export | 201 %PDF | SKIPPED | ❌ | test_live_pdf_export |
| 6 | backend health | 200 | PASSED | ✅ | test_backend_health |

## 5. 修复文档（P0）

### P0-1 — SchedulePanel 运行时崩溃（已修）

**判定**：BROKEN → REAL（smoke）  
**期望 vs 实际**：有调度时应渲染历史表；实际 `ReferenceError: ScheduleHistoryTable is not defined`  
**根因**：`SchedulePanel.tsx` 添加 `ScheduleActivationBanner` 时误删 import  
**修复**：恢复 `import { ScheduleHistoryTable } from "./ScheduleHistoryTable"`  
**修后验收**：`SchedulePanel.smoke.test.tsx` 2/2 passed

### P0-2 — 生产持久化未默认启用

**判定**：STUB  
**根因**：`RPT_SCHEDULE_STORE` 默认 `memory`；`export_jobs`/`export_token` 仍 dict；`artifact_store` 未接入 export 链  
**修复方向**：`RPT_SCHEDULE_STORE=db` + alembic upgrade；export_jobs 写 storage_key；token 写 `export_tokens` 表  
**优先级**：P0（staging 重启丢调度）

### P0-3 — Live 全链路未通

**判定**：BROKEN（G5-T6 live）  
**根因**：FE dev 未运行（integration skip）  
**修复方向**：启动 `pnpm dev --host 127.0.0.1 --port 5173` + MailHog + Case 18  
**优先级**：P0（签收前）

### P1 — PATCH / IM / db store 缺自动化

**修复方向**：`test_report_dashboard_schedule.py` 增 PATCH draft、delivery_channels mock webhook  
**优先级**：P1

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | P0-1 | SchedulePanel import（**已修**） |
| P0 | P0-2 | 默认启用 db store + 接线 artifact/token |
| P0 | P0-3 | Live FE+PDF+MailHog Case 18 |
| P1 | TOB-T4/T15/T16 | PATCH + IM pytest |
| P2 | TOB-T2/B10 | EditPage 定时推送 smoke |

## 7. 交接

- **结论**：**尚未「全部可用」** — 开发/单测路径大部分可用；**生产 ToB** 需持久化默认 + live 签收；模板 `SchedulePanel` 曾有 P0 崩溃已修。
- 建议：`root-first-solve` 处理 P0-2、P0-3；或批准继续接线持久化。
- 用户批准修复：P0-1 已在审计中修复；P0-2/3 待批准。
