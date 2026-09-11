# Headless Automation Plan · 报表中心 M0 信任链

- **Plan type**: Headless Automation Plan
- **Cursor Build**: disabled
- **Execution trigger**: dev-autopilot A5 plan-execute
- **Date**: 2026-08-23

## 背景

标准分析多期并排 91 维仅露数行；活跃度维度出现 `1970-01-01`；报表域 smoke 需防漂移。

## 目标

M0 信任链：看得全、数据诚实、测试绿。

## 改动清单

| # | Task | 文件 |
|---|------|------|
| T1 | 对比表：表体滚动 + 粘性表头 + 「共 N 行」提示 | `StandardAnalysisCompareMatrixView.tsx`, `StandardAnalysisCompareView.tsx` |
| T2 | 截断/点数 cap 横幅（读 renderSpec.meta） | `StandardAnalysisLiveView.tsx` 或共用组件 |
| T3 | 聚合前过滤无效日期 | `theme_aggregate.py` + 单测 |
| T4 | 报表域 vitest + pytest 全绿 | 修漂移 |

## 验证

```bash
cd backend && pytest tests/test_standard_schedule_delivery.py tests/test_report_dashboard_schedule.py -q
cd fe && pnpm exec vitest run src/pages/admin/reports --reporter=dot
```

## 八维度自审（摘要）

| 维 | 结论 |
|----|------|
| 范围 | 仅 M0，不扩 M1 |
| 风险 | 低，可回滚 |
| 测试 | 补 theme_aggregate 单测 + 现有 smoke |
