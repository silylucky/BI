# Feature Truth Audit: 报表中心最终收官签收

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-07 |
| 核验范围 | RPT-001～007 · ReportService · job queue · center prefs · template versions · schedule revision · batch export |
| 锚点 | `/admin/reports/center` · `/api/v1/reports/*` |
| 总体判定 | **REAL**（主链） |
| **总分 / 档位** | **9.0 / 10 · A** |
| 状态 | signed-off |
| **sampling** | `full`（supersedes `2026-08-05-report-center-full-truth-audit.md` 收官项） |

## 自动化证据

| 层 | 命令 | 结果 |
|----|------|------|
| 后端 pytest（report 过滤） | `pytest tests/ -k report` | **77 passed** |
| 报表中心收官单测 | `tests/test_report_center_final.py` | **4 passed** |
| 前端 Vitest（reports） | `vitest run src/pages/admin/reports` | **44 passed** |
| Playwright E2E | `fe/e2e/report-center-final.smoke.spec.ts` | Hub / 模板展开 / 移动端 |

## 主链能力判定

| ID | 能力 | 判定 | 证据 |
|----|------|------|------|
| RPT-001 | 报表中心 Hub / 浏览 | **REAL** | center prefs API + ReportCenterPage vitest/e2e |
| RPT-002 | 预制分析 | **REAL** | prefab smoke + run API |
| RPT-006 | 模板 / 扩展 / 版本发布 | **REAL** | template versions publish test + TemplateDetailPanel |
| RPT-007 | 批量导入 / 导出 | **REAL** | BatchImportPanel wizard + batch export job |
| G1/G2 | 调度 FSM / 修订链 | **REAL** | schedule revision API + executor artifact persist |
| ADR-09 | 自研 RenderSpec 四格式 | **REAL** | `test_report_template_real_export` + CJK PDF |

## 仍须真实环境验收（UNVERIFIED 不阻塞签收）

| 项 | 说明 |
|----|------|
| MailHog PDF 附件 | 需 staging SMTP；单测 mock 已绿 |
| 企微/钉钉 webhook | 需 staging 凭证 |
| 看板 G5 Playwright 真 PDF | `test_dashboard_visual_export` mock 绿；真机依赖 FE+Chromium |
| MinIO artifact round-trip | `ARTIFACT_STORAGE_BACKEND=s3` 集成 smoke 待 staging |

## 结论

报表中心主链已无阻塞 STUB；内存 job store 仅测试注入；客户路径 batch export / schedule artifact / center prefs 均已持久化。文档模板块式编辑 + published snapshot + 统一 ReportService 门面已落地，可标 **最终形态（主链 REAL）**。
