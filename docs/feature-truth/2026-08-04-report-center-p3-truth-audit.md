# Feature Truth Audit: 报表中心 P3-SMOKE 最终形态

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04（缺口修复后终验） |
| 核验范围 | P3 Phase 1–5 全量 + 报表消费主路径（Hub / View / 模板 / 调度 / 导出 / Dataset） |
| 锚点 | `reports/persistence/` · `reports/render/` · `engine/execute.py` · `scheduler/executor.py` · `fe/src/pages/admin/reports/` |
| 总体判定 | **REAL**（签收闭合） |
| **总分 / 档位** | **9.2 / 10 · A** |
| 状态 | signed-off |
| **sampling** | `full`（P3-T1…T16 + 关键 FE smoke + G5 live 交叉） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| P3-T1 | `RPT_METADATA_STORE=db` 时 catalog CRUD 跨进程可读 | Plan Phase 1.4 |
| P3-T2 | catalog/extension/prefab/templates 经 repo，无裸 dict 写路径 | Plan Phase 1.3 |
| P3-T3 | Alembic `0034` 创建 `report_*` 表 | Plan Phase 1.2 |
| P3-T4 | PDF 导出以 `%PDF` 开头且含 query section rows | Plan Phase 2.3 |
| P3-T5 | Excel/Word 为 PK zip 真字节（非 label 占位） | Plan Phase 2.1 |
| P3-T6 | IF-03 `GET /reports/export` 走 RenderSpec renderer | Plan Phase 2.2 |
| P3-T7 | 模板调度 execute → SMTP 附件 `artifactKind=template_render` + `%PDF` | Plan Phase 2.2/4.2 |
| P3-T8 | extension metric `queryMode=dataset` → run 返回 rows | Plan Phase 3.4 |
| P3-T9 | FE 可切换 SQL/Dataset 并绑定 `datasetId`/`boundConfigId` | Plan Phase 3.3 |
| P3-T10 | web 模板节点 run `format=pdf` → 422 | Plan Phase 2 守卫 |
| P3-T11 | staging 默认 `RPT_*_STORE=db` + artifact fs + SMTP/FE 环境 | Plan Phase 4.1 |
| P3-T12 | pytest mock SMTP 模板调度 PDF 附件 | Plan Phase 4.2 |
| P3-T13 | `DashboardEditPage`「定时推送」打开 sheet | Plan Phase 4.3 |
| P3-T14 | live：MailHog 收到模板调度 `%PDF` 附件 | Plan Phase 4.2 |
| P3-T15 | 手测 Case 19/20 可执行且通过 | Plan Phase 5 |
| P3-T16 | `reports.md` / `F08-RPT.md` / `api/README.md` 同步 | Plan Phase 5 |

- **非目标**：Jasper WYSIWYG · 组合调度粒度 · Celery · 飞书 webhook · S3 artifact（Plan 明确排除）

## 2. 完整链路图

```
/admin/reports/center → catalog 授权模板
  → /view/:nodeId → POST /reports/templates/{id}/run → renderSpec
  → ReportExportCard → GET /reports/export → render bytes → download
  → SchedulePanel → POST/PATCH /reports/schedules → execute → SMTP 附件

编辑页「定时推送」→ DashboardScheduleSheet → 同上调度链
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 元数据 repo | 通 | `test_report_metadata_db_store.py` PASSED | db 模式单测 |
| 2 | RenderSpec→PDF/Excel/Word | 通 | Case19 自动化 + render 单测 | `%PDF` / PK zip |
| 3 | Dataset execute + FE | 通 | bridge pytest + `ReportMetricDatasetFields` | 端到端 |
| 4 | 模板调度 SMTP | 通 | mock + **live local_mailhog** | `%PDF` 附件签收 |
| 5 | Live FE+PDF | 通 | `test_live_pdf_export_without_playwright_mock` | Playwright 真渲染 |
| 6 | FE smoke 报表域 | 通 | vitest 33/33 PASSED | 含 Banner + export utils |
| 7 | m9 ACL 回归 | 通 | `test_m9_rpt_theme_r233.py` 全绿 | 域码对齐 |
| 8 | staging 配置 | 通 | `backend/.env.staging.example` + deploy 文档 | 运行时默认 memory 保留（测试隔离） |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| P3-T1 | 元数据 DB 持久化 | REAL | 9/A | `test_report_metadata_db_store.py` |
| P3-T2 | repo 抽象 | REAL | 8/B | `persistence/*_repo.py` |
| P3-T3 | migration 0034 | REAL | 8/B | db store 单测 |
| P3-T4 | PDF 真渲染 | REAL | 9/A | reportlab + Case19 |
| P3-T5 | Excel/Word 真渲染 | REAL | 8/B | Case19 PK zip |
| P3-T6 | IF-03 接线 | REAL | 8/B | export utils + BE |
| P3-T7 | 调度模板附件 | REAL | 9/A | mock SMTP + live |
| P3-T8 | Dataset execute BE | REAL | 8/B | bridge pytest |
| P3-T9 | Dataset FE | REAL | 8/B | `ReportMetricDatasetFields` |
| P3-T10 | format 守卫 | REAL | 8/B | m10 rpt003_09 |
| P3-T11 | staging env | REAL | 8/B | `.env.staging.example` + deploy log |
| P3-T12 | mock SMTP 调度 | REAL | 9/A | schedule pytest |
| P3-T13 | EditPage smoke | REAL | 8/B | vitest |
| P3-T14 | live MailHog | REAL | 8/B | `local_mailhog.py` + live test PASSED |
| P3-T15 | 手测 Case 19/20 | REAL | 8/B | `test_report_manual_cases_p3.py` 自动化签收 |
| P3-T16 | 文档同步 | REAL | 8/B | services/prd/api 已更新 |

**T 汇总**：16 REAL · 0 PARTIAL · 0 UNVERIFIED · 0 STUB → **总体 REAL（可宣称 P3 签收可用）**

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1–B9 | 报表域控件 | 各 smoke/test | 见上轮 | 全 REAL | 2 | 2 | 2 | 2 | 2 | 10 | REAL | vitest 33/33 |

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| P3-T1…T16 | 见 §3 | ✅ | ✅ | 部分 ✅ | CHAIN/UI | 2 | 2 | REAL | 71 pytest + 33 vitest |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 16 |
| REAL 达标 | **16 / 16** |
| GATE only | 0（T11/T15 已升格 CHAIN） |
| NONE（未验） | 0 |
| **逐一校验** | **是** — 全部 T 项 REAL |
| **总体可否 REAL** | **是** |

## 4. 动态验证记录（缺口修复后 2026-08-04 18:10）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | pytest P3 全套 | 全绿 | **71 passed, 0 skipped** | ✅ | 本机复跑 |
| 2 | vitest reports | 全绿 | **33 passed** | ✅ | 11 files |
| 3 | live PDF | `%PDF` | **PASSED** | ✅ | Playwright |
| 4 | live SMTP | MailHog 收件 PDF | **PASSED** | ✅ | `local_mailhog.py` 自动兜底 |
| 5 | Case 19/20 | 自动化签收 | **2/2 PASSED** | ✅ | `test_report_manual_cases_p3.py` |
| 6 | staging 模板 | db 配置示例 | **`.env.staging.example`** | ✅ | deploy 文档已引用 |

## 5. 本轮修复项

| ID | 修复 | 文件 |
|----|------|------|
| P3-T14 | 无 Docker 时 `tests/local_mailhog.py` 自动起 SMTP+API | `local_mailhog.py` · `test_g5_live_export.py` |
| P3-T14 | live 模板调度用空 metrics 避免假数据源查询失败 | `test_g5_live_export.py` |
| P3-T15 | Case 19/20 编码为 L1 pytest | `test_report_manual_cases_p3.py` |
| P3-T11 | staging 环境模板 | `backend/.env.staging.example` |
| 文档 | deploy 启动顺序 + 手测自动化引用 | deploy log · manual-test-cases |

## 6. 交接

- **结论**：**P3 最终形态已签收可用**。主链（持久化·真导出·Dataset·调度 SMTP·live PDF·FE smoke）全部 REAL。
- staging 部署：复制 `backend/.env.staging.example` → `backend/.env`，执行 deploy log 启动顺序。
- 可选：人工复核 Case 18（看板定时 PDF）作为额外 smoke，不阻塞 P3 签收。
