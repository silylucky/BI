# loop-goal-prd ledger · M-RPT F-B

| 字段 | 值 |
|------|-----|
| date | 2026-08-20 |
| scope | §M-RPT F-B 标准分析深化 |
| base_branch | dev |
| status | DONE |
| stop_reason | scope_clear |
| scan_tools | rg + pytest + vitest |
| copy_spotcheck | pass |

## 轮次

| n | remaining | done_count | delta_remaining | batch |
|---|-----------|------------|-----------------|-------|
| 1 | 3 | null | null | — |
| 2 | 0 | 3 | -3 | RPT-002 retention / Dataset / 可观测 |

## 完成 ID

- RPT-002 retention：`snapshot.py` prune + `backend/tests/test_standard_snapshot_retention.py` 2/2
- RPT-002 Dataset 叙事：`createEmptyAnalysisPack` 默认 datasetId；`StandardAnalysisMetaRow` 数据集/物理表（兼容）；配置页 deprecated Alert 链 `/admin/datasets`
- RPT-002 可观测条：`StandardAnalysisSnapshotStrip` 口径/快照/retention/投递；Hub `StandardAnalysisPackList` 摘要；实时与对比模式共用条

## 跳过（可选）

- RPT-002 库内 GROUP BY：未点名；现有 `sampleBased` meta 诚实标注保留

## 证据

- `backend/tests/test_standard_snapshot_retention.py`
- `fe/src/pages/admin/reports/standard-analysis-observability.smoke.test.tsx`
- `fe/src/pages/admin/reports/standardAnalysisDeliverySummary.test.ts`
- vitest: standard-analysis + compare + observability 7/7 绿

## 文档回写

- `docs/automate/plan.md` F-B 必做 3 项 `[x]`；当前节 → F-C
- `docs/automate/prd/F08-RPT.md` M-RPT F-B companion `[x]`
- `docs/automate/prd.md` hub → F-C · v1.2.124
