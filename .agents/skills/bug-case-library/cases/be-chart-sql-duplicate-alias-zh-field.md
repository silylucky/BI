# [官方模板 Dataset 出数：中文别名 / 重复 SQL 列]

- **ID**: CASE-2026-08-14-001
- **状态**: 已修复
- **影响**: fe | be | admin-ui
- **首次发现**: 2026-08-14

## 症状

- 公共服务满意度看板：「网格服务 TOP10」报 `Invalid column identifier: 网格`
- K 线图、堆叠折线图报「查询执行失败」
- Inspector 仍显示「配置校验通过」

## 根因

- SQL→Dataset 迁移只改了 `dimensions`/`metrics`，`axes` 仍保留中文别名；出数以 axes 为准，标识符校验拒绝非 ASCII 列名
- 堆叠图类别轴与堆叠项绑同一字段、K 线四个 OHLC 槽复用 `amount`/`quantity`，生成 `SUM(x) AS x` 重复别名，MySQL Duplicate column

## 错误做法（避免）

- 只改 dimensions 不改 axes
- 用笼统 `QUERY_EXECUTION_ERROR` 当配置校验通过后的唯一反馈而不查 SQL 别名

## 修复方式

- `legacySqlFieldAliases` / `legacy_sql_field_aliases.py`：加载与出数时把残留中文别名映射回物理列
- `chart_sql`：维度去重、指标别名冲突加后缀
- `buildChartExecuteEncoding`：维度去重
- 官方 layout JSON 回写英文列；演示 K 线改为折线（销售宽表无 OHLC）

## 验证

- pytest `test_dataset_chart_sql` duplicate 用例、`test_migrate_remaps_legacy_chinese_axis_aliases`
- vitest `migrateChartTypes` / `chartExecuteProbe` 别名与维度去重

## 关联

- `backend/app/query/dataset/chart_sql.py`
- `fe/src/lib/legacySqlFieldAliases.ts`
- `backend/app/dashboard/templates/layouts/workspace-satisfaction.json`
