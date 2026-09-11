# loop-goal-prd ledger · M-RPT F-C

| 字段 | 值 |
|------|-----|
| date | 2026-08-20 |
| scope | §M-RPT F-C 字典与模板体验 |
| base_branch | dev |
| status | DONE |
| stop_reason | scope_clear |
| scan_tools | pytest + vitest |
| copy_spotcheck | pass |

## 轮次

| n | remaining | done_count | delta_remaining | batch |
|---|-----------|------------|-----------------|-------|
| 1 | 3 | null | null | — |
| 2 | 0 | 3 | -3 | META-003 + RPT-001 + RPT-003 |

## 完成 ID

- META-003 / RPT-001：`reports/label_translation.py` — 标准分析 run/compare/snapshot + 模板 run/export 共用 lookup；失败旁注 `translationNote`
- RPT-003：`POST /api/v1/reports/center/seed-demo` + `ReportTemplatesPage` 空态「加载示例报表」CTA；`dev_seed` 修复 Dataset 指标 + status 维度值种子
- 附带：`MetricAdjustment.dimensionDictCode`；legacy `queryMode=sql` 兼容防 extension 500

## 证据

- `backend/tests/test_report_label_translation.py` 2/2
- vitest: `standardAnalysisDataMeta` + `report-templates.smoke` 13/13
- `backend/tests/test_standard_snapshot_retention.py` 2/2

## 文档回写

- `plan.md` F-C 三项 `[x]`；M-RPT 必做 gate 满足
- `prd/F08-RPT.md` · `prd/F11-META.md` F-C companion `[x]`
- `prd.md` hub v1.2.125
