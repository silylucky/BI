# BUG-14：数据大屏保存后组件位置跳动（gap 压实）

> 最近更新 2026-07-29

| 字段 | 值 |
|------|-----|
| 状态 | ✅ 已修复（Vitest 绿；发版前 MT-6 手测） |
| 优先级 | P0 |
| 影响面 | `surfaceKind=data-screen` 编辑态保存 |
| 关联 case | `.agents/skills/bug-case-library/cases/fe-data-screen-save-gap-compaction.md` |
| 关联 master | `docs/feature-design/2026-07-29-data-screen-master-gap-fill.md` |

## 现象

- 大屏编辑自由摆放组件（组件间有间隙或叠放）后点击保存，组件位置立即变化
- 典型表现：热力图/饼图/地图等相对位置漂移、叠放错乱

## 根因

`sanitizePixelLayoutGeometry` 对**所有** v2 布局调用 `compactPixelLayoutWhenZeroGap`。数据大屏默认 `gapPreset: "none"`（`pixelGutter=0`），保存路径 `persistDashboardLayout` → sanitize 时触发外框间隙压实，将分离组件往一起拉。

仪表板需要该压实；数据大屏允许自由叠放，**不应**在保存时改坐标。

## 修复

[`layoutSanitize.ts`](../../fe/src/components/dashboard/pixelCanvas/layoutSanitize.ts)：`isDataScreen` 时跳过 `compactPixelLayoutWhenZeroGap`，保留 pack 跳过与 `clampPixelLayoutToCanvasBounds`。

## 验收

- [x] `layoutSanitize.test.ts` — `does not compact separated widgets on data-screen sanitize`
- [x] `dataScreenPersist.test.ts` — `preserves widget coordinates after persist roundtrip`
- [ ] MT-6：自由摆放 → 保存 → 坐标不变（见 master gap-fill）

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-29 | 初版：跳过 data-screen gap 压实 |
