# 内置可视化模板 Dataset 精简后维/指错绑或空图

- **ID**: CASE-2026-08-14-014
- **状态**: 已修复
- **影响**: be · admin-ui
- **首次发现**: 2026-08-14

## 症状

- 可视化模板 Hub 卡片数据全是假数或空预览；打开模板后图待配置、饼图按日期切片、KPI 绑了文本列
- 官方 Dataset 精简为 4 个后，部分图仍空 `datasetId`，或维/指与表列不匹配

## 根因

1. 导出布局只做了下线 Dataset remap，未按图类型重配合法维/指
2. 空 widget 仅 `componentRef`、无 `chartConfig`
3. `BUILTIN_SEED_CONTENT_REVISION` 未上调时，启动 seed 不覆盖已入库内置模板

## 错误做法（避免）

- 只改 `datasetId` 不改字段
- 分类图用 `sale_date` 当唯一维度（演示表垫到数百行后卡片会乱）
- KPI/仪表盘把 `category_name` / `sale_date` 当度量

## 修复方式

- `rebind_demo_encodings.rebind_layout_demo_encodings` 在 `prepare_exported_layout` 中统一改绑
- 空图补 `chartConfig` 并断开空 `componentRef`
- 上调 `BUILTIN_SEED_CONTENT_REVISION` 写回 DB

## 验证

- `pytest tests/test_builtin_template_demo_encodings.py tests/test_official_demo_sql.py -q`

## 关联

- `backend/app/dashboard/templates/rebind_demo_encodings.py`
- `backend/app/dashboard/templates/layouts/*.json`
