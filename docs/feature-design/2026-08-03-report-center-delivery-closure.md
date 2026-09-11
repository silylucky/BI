# 报表中心交付闭环 — 实现文档

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-03 |
| 状态 | **已实现（G5 PDF live 201 · SMTP MIME 附件 · 2026-08-03 闭环）** |
| 范围 | G5 看板/大屏定时报告可视化 PDF · export 路由 · token · 测试 · 文档签收 |
| 关联 PRD | [F08-RPT](../automate/prd/F08-RPT.md) RPT-005 |
| 前置审计 | [2026-07-31 全模块真值](../feature-truth/2026-07-31-report-center-full-truth-audit.md) |
| 非目标 | G4 Word 真排版 · G7 WYSIWYG · G6 另存为 · IM webhook |

## §0 交付定义（DoD）

1. 看板/大屏定时 PDF 附件为 **visual_snapshot**（Playwright 截取 FE export 路由），非 `LAYOUT INVENTORY PREVIEW` 文字清单。
2. 渲染失败时执行状态为 **failed/degraded** 且 `errorMessage` 可读；禁止 silent 回落 inventory（除非 `RPT_EXPORT_FALLBACK=1`）。
3. FE 提供无壳层 export 路由：`/export/dashboard/:id?token=`、`/export/data-screen/:id?token=`。
4. 自动化：pytest `test_dashboard_visual_export.py` + vitest export smoke + 手测 Case 18。
5. 文档：`user-guide` · `reports.md` · 真值复评 · 手测用例同步。

## §1 现状（2026-07-31 基线）

| 实体 | 判定 | 阻塞 |
|------|------|------|
| T1–T8 消费/管理 | REAL | — |
| T9 看板定时 G5 | PARTIAL | PDF = layout_inventory |
| T10 导出 | PARTIAL | FE L1 弱 |
| T11 批量导入 | STUB | pytest 缺 |
| T13 SMTP | PARTIAL | 环境依赖 |

## §2 P0 工作包

| WP | 内容 | 锚点 |
|----|------|------|
| WP-G5-1 | `export_token.py` 签发/校验 TTL 5min | `backend/app/dashboard/` |
| WP-G5-2 | `export_render.py` Playwright → PDF | 依赖 `playwright` optional |
| WP-G5-3 | `GET .../export-layout?token=` + export query execute | `dashboards.py` · `middleware.py` |
| WP-G5-4 | FE `DashboardExportSnapshotPage` + routes | `fe/src/pages/export/` |
| WP-G5-5 | `export_jobs` / `executor` → `visual_snapshot` | `artifactKind` |

## §3 P1 工作包

| WP | 内容 |
|----|------|
| WP-P1-1 | README / user-guide SMTP · MailHog · `DEV_REPORT_SEED` |
| WP-P1-2 | 真值复评 → [`2026-08-03-report-center-g5-visual-pdf-truth-audit.md`](../feature-truth/2026-08-03-report-center-g5-visual-pdf-truth-audit.md) |
| WP-P1-3 | `reports.md` 状态 · F08 companion 演化说明 |

## §4 验收

### 自动化

```bash
cd fe && pnpm vitest run src/pages/export src/pages/admin/reports src/pages/admin/dashboard/DashboardSharePage.smoke.test.tsx
cd .. && python -m pytest tests/test_dashboard_visual_export.py tests/test_report_dashboard_schedule.py tests/test_ff_rpt_companion_e95d.py -q
```

### 手测 Case 18 — 看板定时 PDF 视觉验收

1. admin 登录 → 打开含图表的看板 → 分享 → 创建定时报告（PDF）→ 激活 → 立即执行。
2. 调度历史 `artifactKind` 为 **可视化快照**（非布局摘要）。
3. 下载附件 PDF：可见画布/图表像素；正文 **不得** 以 `LAYOUT INVENTORY PREVIEW` 开头。

### PDF 通过标准

- 含 PNG/图表渲染区域 OR Playwright `page.pdf` 全页截图。
- 文件大小 > 5KB（非纯文本壳）。

## §5 文档同步

| 变更 | 文档 |
|------|------|
| G5 visual PDF | `docs/services/reports.md` · `docs/arch.md` ADR |
| 产物说明 | `docs/user-guide/report-center-how-to.md` |
| 手测 | `docs/features/report-center-manual-test-cases.md` |

## §6 风险

| 风险 | 缓解 |
|------|------|
| Playwright/Chromium 未安装 | `pip install playwright && playwright install chromium`；测试 mock |
| FE 未启动 | `FE_BASE_URL` 配置；CI 起 vite preview |
| 图表 query 需 token | export query execute 与 layout 同 token 门控 |
