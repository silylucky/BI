# 仪表板浅/深主题 · DE §5.1 Bootstrap 重规划

日期：2026-07-15  
真理源：DE [§5.1 仪表板主题](https://dataease.cn/docs/v2/user_manual/dashboard_basicfunctions/) · `2026-07-14-dashboard-theme-background-de-v2.md`

## 问题

仅 FE `hydrateDashboardStyleConfig` 无法解决「两套风格未初始化成标准」：

1. **BE 未登记 `themeVariants`** → `validate_layout_dict` / Pydantic 丢弃 → 保存后双主题快照丢失
2. **DE 职责混淆**：§5.1 只负责 `colorScheme` + 语义令牌；§5.3 画布/组件壳随主题分别记忆，存在 `themeVariants`
3. **load/save 不对称**：FE hydrate 重种默认，inactive 主题用户定制无法 round-trip

## DE 对标模型

| 层 | DE | VitalSpan |
|----|-----|-----------|
| §5.1 主题 | 浅/深切换 → 组件字色/图表/控件语义色 | `colorScheme` + `DashboardStyleSurface` + `getDashboardThemeTokens` |
| §5.3 背景 | 画布底色/装饰，**不**改主题语义 | `canvasBackground*` + `resolveArtboardStyle` |
| 双主题记忆 | 浅/深各自一套视觉配置 | `themeVariants.light` / `themeVariants.dark` |
| 共享配置 | 间隙/字体/刷新等 | 根 `styleConfig`（不进 variant） |

## 实施

### T1 · BE schema（阻塞项）

- `backend/app/dashboard/schemas.py`：`ThemeVariantFields` + `DashboardThemeVariants` + `themeVariants` 字段

### T2 · FE bootstrap 单入口

- `bootstrapDashboardStyleConfig`（别名 `hydrateDashboardStyleConfig`）
- 缺失 variant → `defaultThemeVariant(scheme)` 补齐
- 遗留 layout（仅有根字段）→ 提升为 active scheme variant，inactive 用标准预设
- load：`prepareDashboardLayout`；save：`buildDashboardLayoutForSave`

### T3 · 切换

- `switchDashboardColorScheme`：快照 prev → `ensureThemeVariant` 加载 next → normalize 仅纠正冲突

### 验收

- 空看板 load 后 `themeVariants.light/dark` 均为标准 token
- 保存 → 刷新 → `themeVariants` 仍在 JSON 中
- 深色切浅色 → 画布/组件壳切到 light variant
