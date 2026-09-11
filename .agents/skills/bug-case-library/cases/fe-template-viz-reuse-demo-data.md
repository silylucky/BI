# 模板导入导出与组件复用未携带演示数据

- **ID**: CASE-2026-08-07-003
- **状态**: 已修复
- **影响**: fe · be
- **首次发现**: 2026-08-07

## 症状

- 看板/大屏导出 JSON 后导入另一环境，Hub 预览或「使用模板」创建实例后图表无数据
- 用户路径保留环境 `dataSourceId` UUID，未归一化为 `__demo:sample_db__`
- 组件库发布/插入 linked 组件后画布空数据；跨看板复制 linked 图表只有 `componentRef` 无 inline `chartConfig`
- `repair_legacy_template_layout` 在 export/read 时 pop 演示占位符，导致内置路径与用户路径不一致

## 根因

1. 内置 gov 模板走 `prepare_exported_layout` + `bind_template_demo_datasources`；用户 `export_envelope` / FE 侧栏导出绕过后者
2. `import_envelope` 入库前未 normalize
3. 组件库 payload 存环境 UUID；linked widget layout 不含完整 binding
4. 跨看板复制直接 `cloneLayoutWidget`，未 batch-resolve + inline 快照

## 修复方式

- BE：`export_envelope` / `import_envelope` 统一 `prepare_exported_layout`；repair 不再 strip demo ref
- FE：`normalizeLayoutForTemplateExport` 接入 `buildVizLayoutEnvelope`、`exportDataScreenTemplate`
- 组件：`normalizePayloadForPortableDemo` 于发布；`resolveWidgetForCrossDashboardCopy` 于跨看板复制；库插入后 refetch
- 运行时仍由 `bind_template_demo_datasources` / `bindTemplateDemoDatasource` 绑定本环境 sample_db

## 验证

- `pytest tests/test_dash_templates_r01.py tests/test_template_demo_datasource.py`
- `cd fe && pnpm vitest run src/lib/templateDemoData.test.ts src/lib/dataScreenTemplates.test.ts src/lib/vizComponentEdit.test.ts src/components/dashboard/ReuseWidgetDialog.test.tsx`
- 手测：导出 JSON → 导入 → 预览有数；发布组件 → 插入有数；跨看板复制 linked 图表有数

## 关联

- `docs/automate/prd/F07-DASH.md` DASH-009 / DASH-010
- `backend/app/dashboard/templates/presets_exported.py`
- `fe/src/lib/templateDemoData.ts`
