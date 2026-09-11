# Dataset → Dashboard 出图 P0（对标 DE 主路径）

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-10

> 已走简单需求豁免路径：对话中已明确 P0 范围、验收与代码锚点；无新业务歧义。

## 目标

用户选 Dataset 后无需手填 API 绑定、无需重复选数据源，即可在 Dashboard 属性面板配置维度/度量并出图。

## 范围

### In

- 选 Dataset 自动写入 `configId` + `dataSourceId`（从绑定配置解析）
- 列表加载后回填已选 Dataset 的 `configId` / `dataSourceId`
- Dataset 编辑页「绑定查询配置」UI（主表 + 列预览）
- 属性面板就绪清单（缺哪步写哪步）
- `mapApiError` 补 META_DATASET 错误码
- 单测 + smoke

### Out

- 多表 JOIN 可视化、字段勾选建模（P1）
- SQL Lab、筛选器 widget（P2）

## 改动清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `fe/src/lib/datasetChartBinding.ts` | 解析 boundConfig → dataSourceId |
| 2 | `fe/src/lib/datasetTableUtils.ts` | `sample_db.sales` 解析 |
| 3 | `fe/src/components/dashboard/WidgetInspectorDataSection.tsx` | 异步选 Dataset + 自动数据源 |
| 4 | `fe/src/components/dashboard/WidgetInspector.tsx` | 加载后 sync + 就绪清单 |
| 5 | `fe/src/components/dashboard/DatasetReadinessChecklist.tsx` | 未就绪步骤提示 |
| 6 | `fe/src/pages/admin/datasets/components/DatasetBindPanel.tsx` | 绑定 UI |
| 7 | `fe/src/pages/admin/datasets/DatasetFormPage.tsx` | 编辑页挂载绑定面板 |
| 8 | `fe/src/lib/apiError.ts` | META_DATASET_* 文案 |
| 9 | 测试 | binding 单测 + WidgetInspector smoke 增补 |

## 验收

1. Dashboard 选 `test1` + 已绑定 → 状态「Dataset 就绪」，维度/度量下拉可点
2. Dataset 编辑页可「绑定并预览」无需 curl
3. `cd fe && pnpm exec vitest run src/lib/datasetChartBinding.test.ts src/components/dashboard/WidgetInspector.smoke.test.tsx`

## 八维度自审（摘要）

| 维 | 结论 |
|----|------|
| 范围 | P0 仅消费链路，不扩后端域 |
| 依赖 | 依赖既有 `/query/configs` + `bind-query-config` |
| 风险 | 低；仅 FE + 已有 API |
| 回滚 | 可逐文件 revert |
| 测试 | vitest 覆盖 sync 与 smoke |
| 文档 | 本 plan + evolution-state |
| 性能 | 选 Dataset 时多 1 次 GET config |
| 安全 | 复用现有鉴权 |
