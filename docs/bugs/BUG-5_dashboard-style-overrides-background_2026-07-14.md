# BUG-5 · 仪表板主题覆盖背景风格

> 状态：**v2 已修复（待手工验收）** · 发现：2026-07-14 · plan：`docs/automate/plans/2026-07-14-dashboard-theme-background-de-v2.md`

## v1 修复失误

将 `colorScheme` 与 `canvasBackground` 都写入 `DashboardStyleSurface.style`，并把 artboard/widget 透明化 → 视觉「全改乱」。

## v2 正确模型（对标 DE §5.1 / §5.3）

| 层 | 职责 | 实现 |
|----|------|------|
| 主题 scope | 浅/深语义色、组件卡片 | `DashboardStyleSurface` 仅 `dark` + `data-dashboard-color-scheme` |
| 画板背景 | 用户背景色/图 | `resolveArtboardStyle` 画在 artboard/backdrop |
| 编辑 chrome | 点阵 | `.dashboard-canvas-surface`，有用户背景时透明 |

优先级：用户 §5.3 背景 > 主题默认画板色 > 点阵 chrome

## 壳层主题渗透（v3 · 2026-07-14）

**现象**：顶栏 `ThemeToggle`（`html.dark`）会污染画布组件 `dark:` 样式，与右栏「仪表板风格」冲突。

**根因**：Tailwind `@custom-variant dark (&:is(.dark *))` 无边界；点阵 `.dashboard-canvas-surface` 在 `dashboard-theme-scope` 外。

**修复**（v3 修正 · 2026-07-14）：

- **壳层**：恢复 `html.dark` + 全局 `dark:`（元数据等普通页面正常）
- **画布**：仅 `.dashboard-theme-scope[data-dashboard-color-scheme="light"]` 子树排除全局 dark；看板深色用 `.dashboard-theme-scope.dark`
- **点阵**：仍用 `data-dashboard-color-scheme` on `.dashboard-canvas-surface`

| 层 | 主题来源 |
|----|----------|
| Admin 全站（除浅色看板画布） | `html.dark`（顶栏按钮） |
| 看板画布内容 | `styleConfig.colorScheme` |

## 验收

- [x] vitest 31 项通过
- [ ] 设黄色背景 + 切深色主题 → 画板仍黄，组件变深色卡片
- [ ] 清除背景 + 深色主题 → 画板深蓝灰，非点阵盖色
- [ ] 栅格/像素编辑与 Share 预览一致
- [ ] 壳层深色 + 看板浅色：仅侧栏/顶栏/右栏变深，画布组件保持浅色（M4）
- [ ] 切换顶栏不改变已保存的 `colorScheme`
