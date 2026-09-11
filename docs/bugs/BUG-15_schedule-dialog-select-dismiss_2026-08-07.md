# BUG-15：定时推送弹窗内 Select 点击空白误关弹窗

> 最近更新 2026-08-07

| 字段 | 值 |
|------|-----|
| 状态 | ✅ 已修复（三轮） |
| 优先级 | P1 |
| 发现日期 | 2026-08-07 |
| 影响范围 | 看板/大屏「定时推送」弹窗内所有 Select（频率、时区、接收人类型等） |
| 数据来源 | 用户截图反馈 + 代码取证（L1） |

## 问题总览

| # | 根因 | 状态 | 说明 |
|---|------|------|------|
| 1 | Select 下拉 Portal 到 Dialog 外，点击被 Dialog 判定为 outside | ✅ 已修复 | 2026-08-07 |
| 2 | `guardDialogDismiss` 仅检查 `event.target`，Select 关闭竞态时漏拦 | ✅ 已修复 | 2026-08-07 |
| 3 | `display:contents` Portal 容器 + `onFocusOutside` 竞态 | ✅ 已修复 | 2026-08-07 二轮 |
| 4 | 壳层 `overflow-hidden` 裁切下拉，点击穿透遮罩关窗 | ✅ 已修复 | 2026-08-07 三轮 |

---

## 现象描述

用户在「定时推送」弹窗中打开接收人「角色/用户/邮箱」下拉框，点击选项列表内的**非选项空白区域**（padding/留白）时，**整个定时推送弹窗关闭**，而非仅收起下拉。

- 操作：编辑页 → 定时推送 → 打开 Select → 点击列表内空白
- 期望：下拉收起或保持打开，主弹窗不关闭
- 实际：主 Dialog 消失
- 触发：必现（在修复前）

---

## 失败过程还原

N/A（单点交互故障，无多步时序）

---

## 根因 1：Select Portal 挂载在 Dialog 外 ✅ 已修复

**代码证据**（`fe/src/components/ui/select.tsx:64-65`、`fe/src/pages/admin/reports/components/DashboardScheduleSheet.tsx` 修复前）：

```tsx
<SelectPrimitive.Portal container={container ?? undefined}>
```

定时推送弹窗未提供 `container`，Select 默认挂到 `document.body`，位于 Dialog Content DOM 树之外。Radix Dialog 将此类点击视为 `onPointerDownOutside`，触发关闭。

同仓库已有正确范式：`InsertVizComponentDialog` 通过 `AdminFormDialogContent` + `SelectContent container={selectPortal}` 将下拉挂入弹层内（`fe/src/components/dashboard/viz-components/InsertVizComponentDialog.tsx:113`）。

**影响量化**：弹窗内全部 Select 均受影响（频率、星期、时区、接收人类型/角色/用户）

### 修复详情（2026-08-07）

**改了什么**：

| 文件 | 改动 |
|------|------|
| `fe/src/components/layout/admin-form-dialog.tsx` | 抽取并导出 `DialogSelectPortalProvider` |
| `fe/src/pages/admin/reports/components/DashboardScheduleSheet.tsx` | 弹窗内容包裹 `DialogSelectPortalProvider` |
| `ScheduleWizard.tsx` / `ScheduleRecipientsField.tsx` / `ScheduleFormFields.tsx` | `SelectContent container={useAdminFormDialogPortalContainer()}` |

**修复后**：Select 下拉 DOM 位于 Dialog 内部，点击列表空白不再触发 Dialog outside dismiss。

---

## 根因 2：dismiss guard 未遍历 composedPath ✅ 已修复

**代码证据**（`fe/src/lib/dialogNestedDismissGuard.ts` 修复前）：

```ts
export function isDialogDismissBlocked(event: Event): boolean {
  if (isAnySelectDropdownOpen()) return true;
  return isDialogNestedPortaledLayer(event.target); // 仅 target
}
```

当 Select 在同一 pointer 事件中先关闭（`data-state` 变为 closed）时，`isAnySelectDropdownOpen()` 返回 false；若 `event.target` 已变为 overlay/body，则 guard 失效，Dialog 误关。

### 修复详情（2026-08-07）

`isDialogNestedPortaledLayer` 增加 `event.composedPath()` 遍历，兜底识别曾落在 Select 层上的点击。新增单测 `blocks dismiss when original pointer path includes select content`。

---

## 根因 3：`display:contents` Portal 容器 + pointer/focus 竞态 ✅ 已修复

**代码证据**（`fe/src/components/layout/admin-form-dialog.tsx` 修复前、`DashboardScheduleSheet.tsx` 修复前）：

- `DialogSelectPortalProvider` 使用 `display: contents`，Portaled Select 在部分浏览器下仍被 Dialog 判定为 outside
- Select 在同一 `pointerdown` 中先关闭，`isAnySelectDropdownOpen()` 已为 false，guard 漏拦
- Dialog `onOpenChange(false)` 在 outside 事件未被 `preventDefault` 时仍会关窗

### 修复详情（2026-08-07 三轮）

定时推送弹窗改为**禁止遮罩/外部点击关闭**（仅右上角 ✕ 或显式「取消」），并去掉壳层 `overflow-hidden`，Select 下拉挂 `body`（`z-100000`）避免被裁切后点击穿透到遮罩。

---

## 启示

1. **Dialog 内浮层必须挂入弹层 DOM**：凡 Radix Select/Popover/Dropdown，在 Dialog 内使用时须传 `container`，不能仅依赖 dismiss guard。
2. **guard 是兜底，不是主路径**：`dialogNestedDismissGuard` 用于 Portal 未正确挂载时的防线，应配合 composedPath 处理竞态。
3. **新 Dialog 复用 `DialogSelectPortalProvider`**：与 `AdminFormDialogContent` 同一机制，避免各弹窗重复踩坑。
