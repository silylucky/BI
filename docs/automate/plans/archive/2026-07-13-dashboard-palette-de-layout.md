# 看板编辑布局 · 左栏组件库 DE 对标方案

Plan type: Headless Automation Plan  
日期：2026-07-13  
真理源：`docs/ui/layout.md` · `docs/superpowers/specs/2026-07-13-dashboard-de-canvas-design.md` · DataEase v2 用户手册

---

## 0. 用户澄清（2026-07-13）

> **只收起左侧组件库**；收起后画布占满中间区域。  
> **不要**保留 48px `CollapsedPaletteRail` 占位条（当前实现偏离 DE）。

右栏 chart-edit / 字段库、画布工具栏、页面顶栏保存按钮 **不在本轮收起范围**。

---

## 1. DataEase 编辑布局调研

### 1.1 三区结构（文档 + 走查归纳）

| 区域 | DE 行为 | 文档依据 |
|------|---------|----------|
| **顶栏编辑菜单** | 撤销/恢复、样式、外部参数、隐藏设置、**图表**、复用、保存/发布 | `dashboard_basicfunctions` §1–2 |
| **左侧抽屉** | **非常驻**；由顶栏按钮唤起（样式 / 隐藏设置 / **图表组件库**），与画布互斥展示 | §5「左侧弹出」、§7 退出隐藏时点击「图表」 |
| **中间画布** | 矩阵模式拖拽；无左栏时占满可用宽度 | `module_basicfunctions` §4 |
| **右侧配置** | 选中图表后展开「图表配置 + 数据集字段」；**【收回】** 靠右隐藏，非删除 | `module_basicfunctions` §1 |

### 1.2 与 VitalSpan 现状对比

| 维度 | DataEase | VitalSpan（当前） | 差距 |
|------|----------|-------------------|------|
| 左组件库 | 工具栏图标下拉 | 画布顶栏 `CanvasPaletteMenu` 下拉 | 已对齐 |
| 右 chart-edit | 独立「收回」 | 固定 `360–428px` | P1 |
| 编辑工具 | 页面顶栏集中 | 撤销/保存在画布条 | P2 |
| 左栏互斥 | 样式/隐藏/组件库互斥 | 仅组件库 | P3 |

### 1.3 目标布局（仅 Phase A 范围）

```
┌──────────────────────────────────────────────────────────────────┐
│ 看板名 [编辑提示]     [返回][预览][分享]…                        │
├──────────────────────────────────────────────────────────────────┤
│ 画布 flex-1（顶栏左：[▾组件] 下拉菜单 + 提示）  │ chart-edit 双列 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 方案决策

### 2.1 左组件库（Phase A · P0）— **本轮实施**

| 项 | 决策 |
|----|------|
| 收起语义 | `paletteOpen=false` → **grid 无左列**，非窄条 |
| 展开入口 | 画布顶栏左上角「组件」按钮（`CanvasShell` leading） |
| 收起入口 | 组件库面板顶端 `PanelLeftClose`；或再次点击画布「组件」 |
| 状态持久化 | `localStorage` `vs:dashboard-palette-open`（默认 `true`） |
| 实现位置 | `DashboardEditWorkspace.tsx`（`CanvasPaletteToggle` + `ComponentPalettePanel`） |

**不改**：右栏宽度、ChartEditRail 双列、RGL 画布。

### 2.2 右栏「收回」（Phase B · P1）— 单独排期

- `ChartEditRail` 顶栏增加「收回」→ `chartRailOpen=false` 时右列缩为 ~24px 展开柄
- 与左组件库 **独立状态**，不联动

### 2.3 顶栏工具整合（Phase C · P2）

- 撤销/重做/保存从 `CanvasShell` 迁至 `DashboardEditToolbar`
- 对齐 DE：画布区仅保留选中提示

### 2.4 左栏多模式（Phase D · P3）

- 「样式」「隐藏设置」等左抽屉与组件库互斥（需产品确认是否 M5 范围）

---

## 3. 代码锚点

| 文件 | Phase A 改动 |
|------|----------------|
| `fe/src/components/dashboard/DashboardEditWorkspace.tsx` | `CanvasPaletteToggle` 于画布顶栏左上角 |
| `fe/src/lib/dashboardPaletteCollapsed.ts` | 重命名为 `dashboardPaletteOpen.ts` 或兼容读写 |
| `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` | 挂载 Toolbar + 状态 |
| `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx` | 断言无 `palette-collapsed-rail` |

---

## 4. 验收标准

| ID | 标准 |
|----|------|
| DE-PAL-01 | 点击组件库顶端收起后，**DOM 无左列 section**，画布横向变宽 |
| DE-PAL-02 | 编辑工具条「组件」可再次展开 |
| DE-PAL-03 | 右栏 chart-edit 宽度与交互不变 |
| DE-PAL-04 | `T-DASH-PALETTE-01` smoke 通过 |
| DE-PAL-05 | 刷新后保持上次开/关状态 |

---

## 5. 非目标

- 右栏收回（Phase B）
- 顶栏撤销/保存迁移（Phase C）
- 样式/隐藏左抽屉（Phase D）
- 更换 RGL / 像素画布（见 canvas design spec）

---

## 6. 验证命令

```bash
cd fe && npx vitest run \
  src/pages/admin/dashboard/dashboard.smoke.test.tsx \
  src/lib/dashboardPaletteCollapsed.test.ts
```
