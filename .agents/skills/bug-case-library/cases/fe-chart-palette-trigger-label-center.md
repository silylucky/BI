# 配色方案触发器文案未左对齐

- **ID**: CASE-2026-08-14-001
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-14

## 症状

- 看板编辑右侧配置栏 → 图表配色下拉（宽栏 Select）
- 当前方案名（如「品牌」）在触发器里看起来居中，而不是贴左边

## 根因

- Radix `SelectValue` 选中后镜像 `ItemText`（色条 + 文案），触发器上又叠了一层自绘色条
- `SelectTrigger` 默认 `[&>span]:line-clamp-1`（旧版 webkit-box），短文案在镜像节点里容易视觉居中
- 可见文案没有独立的 `w-full text-left` 节点

## 错误做法（避免）

- 把方案名只放在 `SelectValue` 子节点里，指望 Radix 镜像后仍左对齐
- 只给外层 `flex-col` 加 `text-left`，不给标签本身 `w-full`

## 修复方式

- `ChartPalettePicker`：触发器只放 `SelectValue`，用 `[&>span]:flex [&>span]:w-full [&>span]:items-start [&>span]:text-left` 覆盖 Radix 镜像节点；选项标签 `w-full text-left`
- 选项 `SelectItem` 加 `items-start text-left`
- dense 路径 `ChartPaletteCurrentDisplay` 同步 `items-start` / `text-left`

## 验证

```
cd fe && pnpm vitest run src/components/dashboard/ChartPalettePicker.test.tsx
```

## 关联

- `fe/src/components/dashboard/ChartPalettePicker.tsx`
- `fe/src/components/dashboard/ChartPaletteOptionList.tsx`
