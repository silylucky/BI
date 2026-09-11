# 仪表板主题与 Admin 壳层主题隔离方案

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  

日期：2026-07-14  
关联：DASH-008-01 · BUG-5 v2 · `DashboardStyleSurface` · `theme-context`  
前置：`docs/automate/plans/2026-07-14-dashboard-theme-background-de-v2.md`（主题/背景分离，已完成）

---

## 0. 问题陈述

用户发现：顶栏 **全局深浅色按钮**（`ThemeToggleButton`）会影响 `dashboard-canvas-surface` 内画布与图表，与右栏 **「仪表板风格」**（`styleConfig.colorScheme`）产生冲突。

**产品结论**：二者应 **独立**，不应同步。

| 主题 | 控制入口 | 持久化 | 影响范围 |
|------|----------|--------|----------|
| **壳层主题** | 顶栏太阳/月亮 | `localStorage.theme` | 侧栏、顶栏、右栏配置 UI、编辑页外框 |
| **看板主题** | 右栏「仪表板风格」 | `layoutJson.styleConfig.colorScheme` | 画布 artboard、组件卡片、View/Share/Embed 预览 |

当前实现虽在 `DashboardStyleSurface` 上挂了 `dashboard-theme-scope` + 条件 `dark`，但 **Tailwind `dark:` 变体仍从 `html.dark` 向下渗透**，导致壳层切换污染看板内容。

---

## 1. 根因（代码证据）

### 1.1 全局 dark 挂在 `html`

```ts
// fe/src/context/theme-context.tsx
document.documentElement.classList.toggle("dark", theme === "dark");
```

### 1.2 Tailwind v4 dark 变体无边界

```css
/* fe/src/index.css */
@custom-variant dark (&:is(.dark *));
```

任意祖先 `.dark`（含 `html`）即可触发子树全部 `dark:` 工具类。

### 1.3 点阵 chrome 绑在全局 dark

```css
.dark .dashboard-canvas-surface { ... }
```

未绑定 `dashboard-theme-scope`，随壳层主题变化。

### 1.4 DOM 层级：点阵在 scope 之外

```text
DashboardEditWorkspace
└── CanvasShell
    └── .dashboard-canvas-surface     ← 点阵层（壳层子树，scope 外）
        └── DashboardEditCanvas
            └── .dashboard-theme-scope ← 看板主题 scope（内层）
                └── PixelCanvas / Grid
```

即使 scope 内 `colorScheme=light`，外层 `html.dark` 仍会让 scope 内 `dark:bg-gray-900` 等生效。

---

## 2. 目标与非目标

### 2.1 目标

1. **壳层主题** 与 **看板主题** 互不渗透（四象限组合均符合预期，见 §6）。
2. 编辑画布 WYSIWYG：编辑态组件色 ≈ View/Share 发布后（`DASH-008-01`）。
3. 不改动 `styleConfig` 后端契约；不新增 API。
4. 改动可单 PR 交付，vitest + 少量手工门控可验收。

### 2.2 非目标（Companion）

- 「跟随系统 / 跟随编辑器」作为 `colorScheme` 第三枚举值
- Embed 页单独壳层主题（Embed 无 Admin 顶栏，仅看板 `colorScheme`）
- 列表缩略图 `DashboardListCardPreview` 完全对齐看板主题（可 Phase 2）
- 图表 ECharts 内置主题与 `paletteId` 深度联动

---

## 3. 目标架构

### 3.1 双作用域 dark 变体（核心）

将 Tailwind `dark:` 定义为 **壳层 OR 看板**，且 **看板子树排除壳层 dark**：

```css
@custom-variant dark (
  &:is(.admin-shell.dark *:not(.dashboard-theme-scope *)),
  &:is(.dashboard-theme-scope.dark *)
);
```

语义：

| 壳层 | 看板 colorScheme | 侧栏/顶栏 | scope 内组件 |
|------|------------------|-----------|--------------|
| light | light | 浅色 | 浅色 |
| light | dark | 浅色 | 深色 |
| dark | light | 深色 | **浅色**（关键修复） |
| dark | dark | 深色 | 深色 |

**无需**把全仓库 `dark:` 改成 `shell-dark:`；现有 `dark:` 在 scope 内自动只看 `dashboard-theme-scope.dark`。

### 3.2 壳层 dark 挂载点迁移

`html.dark` → `.admin-shell.dark`（`AdminLayout` 根节点）。

```text
#root
└── .admin-shell[.dark]          ← ThemeProvider 切换此处
    ├── AppSidebar               ← dark: 由壳层驱动
    ├── AppHeader + ThemeToggle
    └── main
        └── DashboardEditPage
            ├── CanvasShell      ← 编辑外框：跟壳层（可选，见 §3.4）
            └── chartRail        ← 配置手风琴：跟壳层
```

`ThemeProvider` 不再写 `document.documentElement`；改为 Context 提供 `theme`，由 `AdminLayout` 把 `dark` class 加到 `.admin-shell`。

**Login / 无 Admin 壳层路由**：保持 `html` 或 `body` 级 light；不包 `admin-shell` 的页面不受影响（仅默认 light）。

### 3.3 看板三层（延续 BUG-5 v2）

```text
.dashboard-canvas-surface[data-dashboard-color-scheme]  编辑点阵 chrome
  .dashboard-theme-scope[.dark]                          §5.1 主题 scope
    artboard / backdrop                                  resolveArtboardStyle §5.3
    .dashboard-widget-surface                            组件卡片
```

### 3.4 编辑外框（CanvasShell）跟谁？

| 方案 | 行为 | 推荐 |
|------|------|------|
| A. 跟壳层 | 编辑区白卡片边框随顶栏主题 | **默认采用**（与 DE 编辑器一致） |
| B. 跟看板 | 外框也随 colorScheme | 易与点阵/artboard 混淆 |

点阵 **必须** 跟看板 `colorScheme`，不能跟壳层（§4.2）。

---

## 4. 任务分解

### T1 — Tailwind dark 变体 + 壳层挂载点

| 文件 | 改动 |
|------|------|
| `fe/src/index.css` | 替换 `@custom-variant dark` 为双作用域；`.dark .dashboard-canvas-surface` → `.dashboard-theme-scope.dark .dashboard-canvas-surface`（或 data 属性，见 T2） |
| `fe/src/context/theme-context.tsx` | 移除 `document.documentElement.classList.toggle`；仅维护 state |
| `fe/src/layouts/AdminLayout.tsx` | 根 `div` 增加 `admin-shell` + `theme === 'dark' && 'dark'` |

**验证**：`AdminLayout.smoke.test.tsx` / `routes.smoke.test.tsx` 仍绿；顶栏切换后 `html` 无 `dark`。

---

### T2 — 点阵 chrome 绑定看板 colorScheme

**问题**：`.dashboard-canvas-surface` 在 `dashboard-theme-scope` 之外。

**方案（推荐）**：在 `DashboardEditWorkspace` 把 `styleConfig` 传入（或仅 `colorScheme`），给点阵容器加：

```tsx
<div
  className="dashboard-canvas-surface ..."
  data-dashboard-color-scheme={styleConfig?.colorScheme ?? "light"}
/>
```

CSS：

```css
.dashboard-canvas-surface[data-dashboard-color-scheme="dark"] {
  /* 原 .dark .dashboard-canvas-surface 规则 */
}
.dashboard-canvas-surface:has([data-canvas-user-bg="true"]) { ... } /* 保持 */
```

| 文件 | 改动 |
|------|------|
| `fe/src/components/dashboard/DashboardEditWorkspace.tsx` | 新增 prop `canvasColorScheme?: ColorScheme`；点阵容器 `data-dashboard-color-scheme` |
| `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` | 传入 `styleConfig.colorScheme` |
| `fe/src/index.css` | 点阵选择器改用 `data-dashboard-color-scheme` |

**备选（结构重构）**：把 `dashboard-canvas-surface` 移入 `DashboardStyleSurface` 内 — DOM 变动大，仅当 data 属性方案不够时采用。

---

### T3 — DashboardStyleSurface 强化

| 文件 | 改动 |
|------|------|
| `fe/src/components/dashboard/DashboardStyleSurface.tsx` | `colorScheme=light` 时显式 **不** 挂 `dark`；保留 `data-dashboard-color-scheme` |
| `fe/src/components/dashboard/DashboardStyleSurface.test.tsx` | 新增：mock 外层 `.admin-shell.dark` + `colorScheme=light` → scope 内探针元素无 `dark:` 生效 |

探针测试示例：

```tsx
// scope 内放 <span data-testid="probe" className="bg-white dark:bg-gray-900" />
// admin-shell.dark + colorScheme light → probe 计算样式 background 为 white
```

---

### T4 — 画布/组件漏网项清扫

重点文件（含 `dark:` 且位于看板子树）：

| 文件 | 项 |
|------|-----|
| `pixelCanvas/PixelShape.tsx` | `dark:bg-gray-900` 等 — 变体修复后应自动正确 |
| `pixelCanvas/PixelCanvas.tsx` | `dark:ring-gray-700` on artboard |
| `dashboard-edit/DashboardEditCanvas.tsx` | view 模式 wrapper `dark:border-gray-800` |
| `DashboardListCardPreview.tsx` | 缩略图：Phase 2 传 `layout.styleConfig` 包一层 scope；本 PR 可记 WARN |

**原则**：scope 内继续用 `dark:`；不要改业务语义色写法。

---

### T5 — 配置栏 UX 说明

| 文件 | 改动 |
|------|------|
| `fe/src/components/dashboard/dashboardConfigPanels.tsx` | 「仪表板风格」分组下增加一行说明：「仅影响看板内容与发布后展示，与顶栏深浅色无关」 |
| `docs/bugs/BUG-5_dashboard-style-overrides-background_2026-07-14.md` | 追加 §壳层渗透 与验收项 |

---

### T6 — 测试与门禁

| 类型 | 内容 |
|------|------|
| 单测 | `DashboardStyleSurface.test.tsx` 四象限探针（可用 jsdom + getComputedStyle 或 class 断言） |
| 单测 | `theme-context` 不再写 `html.dark`（mock documentElement） |
| 单测 | `DashboardEditWorkspace` 点阵 `data-dashboard-color-scheme` |
| Smoke | `AdminLayout.smoke.test.tsx` 顶栏切换仍可用 |
| Smoke | `dashboard.smoke.test.tsx` 编辑页挂载 |
| 手工 | §6 矩阵 4 条 + BUG-5 背景三项 |

**命令**：

```bash
cd fe && pnpm exec vitest run \
  src/components/dashboard/DashboardStyleSurface.test.tsx \
  src/components/dashboard/DashboardContextInspector.test.tsx \
  src/layouts/AdminLayout.smoke.test.tsx \
  src/pages/admin/dashboard/dashboard.smoke.test.tsx
```

---

## 5. 八维度自审

| 维度 | 评估 |
|------|------|
| 正确性 | 双作用域 CSS 精确切断 `html.dark` 渗透，符合 DE 分工 |
| 范围 | 仅 FE 主题挂载 + 画布 chrome；无 BE |
| 风险 | 中：dark 变体为全局机制，需全量 vitest smoke |
| 回滚 | 恢复单行 `@custom-variant` + `html.dark` 即可 |
| 性能 | 无影响 |
| 可测性 | 探针单测 + 四象限手工 |
| 文档 | BUG-5 + 本 plan；PRD 行为不变仅澄清 |
| 演进 | Companion：colorScheme=auto、列表缩略图 scope |

---

## 6. 验收矩阵（手工门控）

在 **同一看板** 上操作，设明显对比（如浅色看板 + 壳层深色）：

| ID | 壳层顶栏 | 看板风格 | 预期 |
|----|----------|----------|------|
| M1 | 深色 | 浅色 | 画布组件白底、图表轴浅色系；侧栏/顶栏/右栏深色 |
| M2 | 浅色 | 深色 | 画布组件深底；壳层浅色 |
| M3 | 深色 | 深色 | 全局深色，保存后 View 页一致 |
| M4 | 切换壳层 | 固定浅色 | **仅** 侧栏/顶栏/右栏变，画布 **不变** |
| M5 | 任意 | 设黄背景 + 深色看板 | 画板仍黄，组件深色（BUG-5 回归） |
| M6 | 任意 | 保存后刷新 | `colorScheme` 回读一致；壳层仍读 localStorage |

---

## 7. 文档同步（prd-sync）

| 变更 | 文档 |
|------|------|
| 行为澄清：壳层主题 ≠ 看板主题 | `docs/bugs/BUG-5_*.md` 追加一节 |
| DASH-008 验收说明 | `docs/automate/prd/F07-DASH.md` DASH-008-01 补一句「与 Admin 壳层主题独立」 |
| 无需改 API / services | — |

---

## 8. 实施顺序与估时

```text
T1 变体 + AdminLayout（0.5d）
  → T2 点阵 data 属性（0.25d）
  → T3 探针单测（0.25d）
  → T4 漏网清扫 + T5 UX（0.25d）
  → T6 全量验证（0.25d）
合计约 1.5 人日
```

**禁止**：在未通过 M4 前宣称「主题隔离完成」。

---

## 9. 可选 Phase 2（不在本 PR）

1. `colorScheme: "auto"` — 未显式设置时跟随 `.admin-shell` 主题，写入时提示将固化为 light/dark。
2. `DashboardListCardPreview` 读取卡片 `layout.styleConfig` 包 `DashboardStyleSurface`。
3. Share 页预览区全宽去 Admin 壳层包裹的「双重边框」视觉抛光。

---

## 10. 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 壳层 vs 看板 | **独立** | DE §5.1、DASH-008、WYSIWYG |
| 技术路线 | **双作用域 `dark:` 变体** | 最小 diff，不需重命名全库 `dark:` |
| dark 挂载 | **`admin-shell` 非 `html`** | 与 scope 排除选择器配合 |
| 点阵 chrome | **data-dashboard-color-scheme** | 避免大改 DOM 包裹层级 |
| CanvasShell 外框 | **跟壳层** | 编辑器 chrome 与内容区分 |
