# Headless Automation Plan · 报表 F-D 交叉表 MVP

- **Plan type**: Headless Automation Plan
- **Cursor Build**: disabled
- **Execution trigger**: dev-autopilot A5 plan-execute
- **Date**: 2026-08-24

## 背景

`plan.md` §M-RPT F-D：固定版式最大 gap 为交叉表。Dashboard 已有 `table-pivot` 图表，报表模板 RenderSpec 尚无交叉表块。

## 目标

模板支持 **单维行 × 单列维 + 指标聚合** 交叉表：配置块 → run → PDF/Excel 导出含透视矩阵。

## 非目标

- 套打分页 PDF、目录另存为（F-D 其余项）
- 多指标/多层列头、小计合计
- 库内 GROUP BY（F-B 可选）

## 改动清单

| # | Task | 文件 |
|---|------|------|
| T1 | 透视纯函数 + 单测 | `backend/app/reports/engine/crosstab.py` · `tests/test_report_crosstab.py` |
| T2 | 模板块 `crosstab` 校验与 schema | `templates/schemas.py` · `templates/service.py` |
| T3 | run 管线：指标表 → 交叉表 section | `engine/crosstab_apply.py` · `engine/service.py` |
| T4 | PDF/Excel 渲染 crosstab section | `render/pdf_renderer.py` · `render/excel_renderer.py` |
| T5 | FE 块编辑器字段 | `TemplateBlockEditor.tsx` · `useReportTemplates.ts` |
| T6 | 集成测试 run/export | `tests/test_report_crosstab_template.py` |

## 验证

```bash
cd backend && pytest tests/test_report_crosstab.py tests/test_report_crosstab_template.py -q
cd fe && pnpm exec vitest run src/pages/admin/reports --reporter=dot
```

## 八维度自审（摘要）

| 维 | 结论 |
|----|------|
| 范围 | 仅交叉表 MVP |
| 风险 | 低，新增块类型，旧模板不受影响 |
| 测试 | 单测 + API smoke |
| 复用 | 内存 pivot，与 dashboard buildTableModel pivot 思路一致但不耦合 |
