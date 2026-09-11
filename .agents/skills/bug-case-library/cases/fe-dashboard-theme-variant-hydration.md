# 仪表板浅/深主题未初始化 / 保存丢失 variant

- **ID**: CASE-2026-07-15-001
- **状态**: 已修复
- **影响**: fe / be / dashboard 编辑
- **首次发现**: 2026-07-15

## 症状

- 右栏「仪表板风格」浅/深切换后画布/组件壳非标准预设
- 保存刷新后另一套主题配置丢失，切换回空白或错乱
- 仅 FE hydrate 无法稳定修复

## 根因

1. **BE `DashboardStyleConfig` 无 `themeVariants`** → `validate_layout_dict` 剥离字段 → DB 永不保存双主题
2. load 仅 `normalizeStyleConfigForColorScheme`，未按 DE §5.1 补齐 `themeVariants.light/dark`
3. 切换时对空 variant 做 merge，根字段被洗成 undefined

## DE 对标原则

| DE | VitalSpan |
|----|-----------|
| §5.1 主题 | `colorScheme` + 固定令牌（`DashboardStyleSurface`） |
| §5.3 背景/壳 | `canvasBackground*`、`widgetStyle`，**按浅/深分别记忆** → `themeVariants` |
| 共享项 | gap/font/palette 等在根 `styleConfig` |

## 修复方式

- **BE**：`schemas.py` 增加 `ThemeVariantFields` / `DashboardThemeVariants` / `themeVariants`
- **FE**：`bootstrapDashboardStyleConfig`（load/save 单入口）
  - 缺失 variant → `defaultThemeVariant`
  - 遗留仅根字段 → 提升为 active scheme，inactive 用标准预设
- **管线**：`prepareDashboardLayout` · `buildDashboardLayoutForSave` · `DashboardEditPage.load`

## 错误做法（避免）

- 只在 FE hydrate、不扩展 BE schema
- 在 EditPage 单独 normalize，绕过 bootstrap
- 切换主题 merge 未补齐的 variant

## 验证

```bash
cd fe && npx vitest run src/components/dashboard/dashboardThemeVariants.test.ts src/components/dashboard/dashboardCanvasMode.test.ts
python -c "from app.dashboard.schemas import DashboardLayout; ..."
```

- 空 config bootstrap 后 light/dark variant 均为标准色
- `buildDashboardLayoutForSave` 输出含 `themeVariants`
- 保存刷新后 JSON 仍含 `themeVariants`

## 关联

- `docs/automate/plans/2026-07-15-dashboard-de-theme-bootstrap.md`
- `backend/app/dashboard/schemas.py`
- `fe/src/components/dashboard/dashboardThemeVariants.ts`
