# BUG-8：点击图表组件白屏（ChartInspectorProvider 边界）

> 最近更新：2026-07-15

| 字段 | 值 |
|------|-----|
| 状态 | 🧪 R2 代码修复完成，待真实浏览器 QA |
| 优先级 | P0 |
| 发现日期 | 2026-07-15 |
| 影响范围 | Dashboard 编辑页 · 图表右栏 · DASH-002 |
| 关联 | BUG-3 · ChartEditRail 架构债 |

---

## 问题总览

| # | 根因 | 状态 | 说明 |
|---|------|------|------|
| RC-1 | 9 个子组件隐式依赖 `useChartInspector`，Provider 边界易漏 | ✅ R2 已修 | `ChartEditRail` 内置 Provider，单入口 |
| RC-2 | Context 与 `useChartInspectorState` 同文件/循环 re-export 可能产生双份 Context（HMR） | ✅ R2 已修 | 拆至 `chartInspectorContext.ts` + `ChartInspectorProvider.tsx` |
| RC-3 | 缺编辑页「点击像素图表 → 右栏」集成测试 | ✅ R1 已补 | `dashboard.smoke.test.tsx` |
| RC-4 | 9 个 hook 消费者未改为 props 注入（长期架构债） | 🟡 排队 | P2 可选 |

---

## 现象

[用户反馈] 编辑页点击漏斗图等 chart 组件 → `RouteErrorBoundary` 整页白屏：

```text
useChartInspector must be used within ChartInspectorProvider
```

---

## 根因 1：Context 边界过窄（L1）

**隐式依赖链**（均调用 `useChartInspector`）：

- `ChartEditorColumn` · `ChartStylePanel` · `ChartTableStylePanel`
- `ChartDataSlots` · `ChartDataOptions` · `ChartAdvancedPanel`
- `DatasetFieldBank`（生产路径已用 `DatasetPickerPanel` props，但模块仍 export hook 版）

**原挂载点**：

```93:95:fe/src/components/dashboard/ChartEditRail.tsx
// 旧：Provider 仅在 Rail 内部
```

当选中图表时 `DashboardEditPage` 渲染 `chartRail` → 若 Provider 与内容树因 remount/key/HMR 不同步，任一子组件抛错即被 `RouteErrorBoundary` 捕获为「页面加载失败」。

### R2 修复（2026-07-15，用户仍复现后）

1. **Context 模块拆分**：`chartInspectorTypes.ts` · `chartInspectorContext.ts`（单例 `createContext`）· `ChartInspectorProvider.tsx`；`ChartInspectorContext.tsx` 仅 re-export。
2. **`ChartEditRail`**：恢复 **内置** `ChartInspectorProvider`（`ChartEditRailInner` + 外层 Provider），`widget/onChange` 为必填；页面不再手写 Provider 包裹。
3. **`DashboardEditPage`**：chart 分支仅渲染 `<ChartEditRail widget=… onChange=… />`。
4. **测试**：`ChartEditRail.smoke` + `dashboard.smoke`「点击像素 chart」均断言无 `useChartInspector` 崩溃。

### R1 修复（2026-07-15，部分缓解）

1. **`DashboardEditPage`**：页面级 `ChartInspectorProvider` 包裹 `ChartEditRail`（用户仍复现）。
2. **拆分** `ChartEditRail` / `ChartEditRailWithProvider` API。

---

## 改进优先级

| 优先级 | 动作 |
|--------|------|
| P0 | 手测：硬刷后点击漏斗/折线/表格 chart，右栏三 Tab 正常 |
| P2 | 将 inspector 子面板改为 props 注入，弱化 Context（参考 `TextEditRail` + `useTextDatasetInspector`） |
| P2 | 删除未使用的 `DatasetFieldBank` hook 路径或文档标注废弃 |

---

## 修复记录

| 轮次 | 日期 | 内容 | 结果 |
|------|------|------|------|
| R0 | 2026-07-14 | ChartEditRail 内嵌 Provider + StylePanel 导入修复 | 部分缓解，用户仍复现 |
| R1 | 2026-07-15 | Provider 提升页面级 + 拆分 Rail API + 集成测试 | 用户仍复现 |
| R2 | 2026-07-15 | Context 模块拆分 + ChartEditRail 内置 Provider 单入口 | vitest 绿；待手测 |
