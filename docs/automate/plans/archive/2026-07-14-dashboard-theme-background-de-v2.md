# 仪表板主题 vs 背景 · DE 分离修复 v2

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  

日期：2026-07-14  
前置：BUG-5 v1 修复回滚语义 · DE §5.1 主题 / §5.3 背景

---

## 0. DE 调研结论

| DE 分组 | 作用域 | 不得影响 |
|---------|--------|----------|
| §5.1 仪表板主题 | 浅/深主题、组件文字/图表/控件色 | 不覆盖用户已设背景色/图 |
| §5.3 仪表板背景 | 画布底色/背景图 | 不改变主题语义色 |

v1 错误：把 `colorScheme` 与 `canvasBackground` 都写入 `DashboardStyleSurface.style`，且 artboard/widget 透明化，导致「全改乱」。

## 1. 目标架构

```text
dashboard-canvas-surface     编辑点阵 chrome（无用户背景时）
  DashboardThemeScope          仅 colorScheme → dark 类 + data 属性
    PixelCanvas / Grid
      artboard/backdrop        resolveArtboardStyle（§5.3 优先，否则主题默认）
      widget shell             bg-white / dark:bg-gray-900（主题层）
```

## 2. API

- `canvasBackgroundStyle(config)` — 仅用户显式 §5.3 字段
- `resolveArtboardStyle(config)` — artboard 绘制：用户背景 > 主题默认
- `hasUserCanvasBackground(config)` — 是否设了用户背景（抑制点阵）

## 3. 任务

- T1 dashboardStyleConfig 拆分函数 + 单测
- T2 DashboardStyleSurface 去 background，仅主题 scope
- T3 PixelCanvas artboard + DashboardEditCanvas grid backdrop
- T4 恢复 PixelShape 组件卡片底色
- T5 UI「仪表板风格」→「仪表板主题」
- T6 vitest 绿
