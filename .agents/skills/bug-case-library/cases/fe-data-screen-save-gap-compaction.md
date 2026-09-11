# 数据大屏保存后 gap 压实导致坐标跳动

- **ID**: CASE-2026-07-29-002
- **状态**: 已修复
- **影响**: fe / data-screen edit / pixel canvas v2 save
- **首次发现**: 2026-07-29

## 症状

- 数据大屏编辑保存后组件位置立即变化
- 有间隙的组件被拉到一起；与仪表板「保存后 pack」症状类似但根因不同

## 根因

`compactPixelLayoutWhenZeroGap` 在 `sanitizePixelLayoutGeometry` 中对 data-screen 误执行（`gapPreset=none` → gutter=0）。保存路径 `persistDashboardLayout` 必经 sanitize。

## 修复方式

- `isDataScreen` 时跳过 `compactPixelLayoutWhenZeroGap`
- 仍执行 Tab repair、`clampPixelLayoutToCanvasBounds`；不 pack 重叠块

## 验证

- `layoutSanitize.test.ts` + `dataScreenPersist.test.ts`
- MT-6 手测（master gap-fill）

## 关联

- `docs/bugs/BUG-14_data-screen-save-gap-compaction_2026-07-29.md`
- `docs/feature-design/2026-07-29-data-screen-master-gap-fill.md`
