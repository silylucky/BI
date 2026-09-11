# 看板保存静默丢字段 / 关联组件配置不落库

- **ID**: CASE-2026-07-27-002
- **状态**: 已修复
- **影响**: fe | be
- **首次发现**: 2026-07-27

## 症状

- 仪表板配置（装饰背景、chrome、内边距、数值「自动」、千分符、双主题 decor/accent 等）保存刷新后消失，UI 仍提示已保存
- 关联组件在画布上下钻/改 chartConfig 后看板保存，配置丢失
- 有意重叠布局保存后坐标被 pack 改写

## 根因

1. BE `DashboardStyleConfig` / `WidgetStyleConfig` 字段远少于 FE → Pydantic 默认 ignore → `model_dump` 静默剥离
2. `numberFormat.type: "auto"` 不在 BE Literal → 422 或无法选自动
3. 关联组件 `stripLinkedWidgetForPersist` 剥 chartConfig；画布 `onChartConfigChange` 只写本地、不推组件库；`resolveLayoutWidget` 又以库为准覆盖本地
4. `sanitizePixelLayoutGeometry` 在保存路径对重叠顶层组件隐式 pack

## 错误做法（避免）

- 依赖 Pydantic ignore 当「兼容」——前端可写、后端 silently drop = 假保存
- 关联组件只改 layout 内联 config 却期望看板 PUT 持久化

## 修复方式

- 扩展 `backend/app/dashboard/schemas.py` 对齐 FE style 契约（含 auto / thousandSeparator / chrome / widget 富样式 / themeVariants 子集）
- 画布关联变更 → `pushWidgetPayloadToLibrary` + refetch；保存前 `flushLinkedLocalOverridesToLibrary`
- 保存/加载 sanitize 默认不 pack（`packOverlaps` 显式开启）

## 验证

- `pytest tests/test_dashboard_style_config_roundtrip.py tests/test_dashboard_gap_style_config.py`
- `vitest run src/components/dashboard/pixelCanvas/layoutSanitize.test.ts`
- 手测：改 chrome/内边距/数值自动 → 保存刷新仍在；关联地图下钻 → 保存后仍在库组件

## 关联

- `fe-dashboard-theme-variant-hydration.md`（themeVariants 曾修过，子集仍需扩）
- `fe-dashboard-layout-roundtrip-drift.md`
