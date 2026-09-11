# 看板配置 ColorField 取色跳色 / 部分颜色不可用

- **ID**: CASE-2026-07-15-002
- **状态**: 已修复
- **影响**: fe · 看板编辑 · 图表样式
- **首次发现**: 2026-07-15

## 症状

- 仪表板配置 → 图表样式 → 背景色：拖动饱和度/色相时颜色会突然跳到其他值（常见闪回白色）
- 取色面板内点击一次饱和度/色相，Popover 立即关闭，无法连续调色
- 深色看板下选择浅色（如 `#43B379`）后画布仍显示深色默认底，感觉「很多颜色用不了」
- Hex 输入未输完时取色面板指针会跳到 `#ffffff`

## 根因

1. **取色器状态竞争**：`ColorField` 在 popover 打开时仍用 `useEffect([value])` 从父级同步；拖拽时 120ms 防抖提交触发看板重渲染，父级 `value` 可能落后于本地 draft，回写导致 react-colorful 跳色
2. **Popover 点击即关**：取色面板 `onChange` 同步 `flushCommit` 触发父级（看板/图表配置）重绘，Radix Popover 在 pointer 交互中途被 dismiss
3. **无效 hex fallback**：`pickerHex` 对未输完 hex 回退 `#ffffff`，面板指针突变
4. **主题强制改色**：`coerceWidgetSurfaceBackground` / `normalizeStyleConfigForColorScheme` 在深色主题下将非暗色组件底强制改为 `#1e293b`，用户显式选色被覆盖

## 错误做法（避免）

- 取色器打开期间仍用外部 `value` 覆盖 `localValue`
- 对不完整 hex 使用硬编码 `#ffffff` 作为 picker 受控值
- 用户显式配置的 `widgetStyle.background` 在渲染时再按主题 coercion

## 修复方式

- `fe/src/components/ui/color-field.tsx`：popover 打开或防抖 pending 时不同步 prop；**面板内变更经 120ms 防抖异步 commit**（避免同步 onChange 导致 Popover dismiss）；关闭时 flush 剩余 pending；`onOpenAutoFocus` 阻止抢焦点；仅提交 `normalizeHexColor` 成功的值
- `fe/src/components/ui/color-utils.ts`：`resolvePickerHex(hex, lastValid)` 保留上次合法色
- `fe/src/components/dashboard/dashboardStyleConfig.ts`：`coerceWidgetSurfaceBackground` 有值则原样返回
- `fe/src/components/dashboard/dashboardThemeVariants.ts`：normalize 仅纠正 legacy 白/暗默认，不再按亮度 blanket 重置

## 验证

- `fe` 下运行 `color-field.test.tsx`、`color-utils.test.ts`
- 深色看板编辑：图表样式背景色拖拽 hue/saturation 不跳色；选 `#43B379` 画布组件底可见该色

## 关联

- `fe/src/components/ui/color-field.tsx`
- `fe/src/components/ui/color-picker-panel.tsx`
- `fe/src/components/dashboard/dashboardConfigPanels.tsx`
