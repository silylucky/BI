# 看板保存/重载后像素布局漂移

- **ID**: CASE-2026-07-15-001
- **状态**: 已修复
- **影响**: fe / dashboard edit / pixel canvas v2
- **首次发现**: 2026-07-15

## 症状

- 点击保存后画布组件位置立即变化
- 退出编辑页再进入，布局与保存前编辑态不一致
- 可能与「保存后仍显示未保存」同时出现

## 根因

1. **`resetLayout` 对 v2 自动 `packPixelLayoutSeamless`**：从零装箱重算全部 x/y，破坏 WYSIWYG（`useDashboardCanvasState.ts` L103–108）
2. **`load()` 用 `resetLayout(source)` 而非 `prepared.layout`**：canvas 与 fingerprint/widgets 不同源（`DashboardEditPage.tsx` L240）
3. **save / fingerprint / hydrate 不对称**：DB 存未 pack 坐标，内存展示 pack 后坐标（`dashboardCanvasMode.ts` fingerprint 分支）

## 修复方式（计划）

- hydrate 默认不 pack；fingerprint 与 save 共用 `buildDashboardLayoutForSave` 且无 pack
- `load()` 统一 `resetLayout(prepared.layout)`
- round-trip 单测门禁

## 验证

- 非紧凑布局 save → 不跳动 → 刷新/重进坐标不变
- `dashboardCanvasMode.test.ts` round-trip 用例绿

## 关联

- `docs/bugs/BUG-6_dashboard-layout-roundtrip-drift_2026-07-15.md`
- `docs/automate/plans/2026-07-15-dashboard-layout-roundtrip-drift.md`
- **大屏变体（gap 压实）**：`fe-data-screen-save-gap-compaction.md` · [BUG-14](../../../../docs/bugs/BUG-14_data-screen-save-gap-compaction_2026-07-29.md)
