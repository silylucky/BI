# FE 像素看板拖放松手组件挤叠重叠

- **ID**: CASE-2026-07-16-001
- **状态**: 已修复
- **影响**: fe / admin-ui
- **首次发现**: 2026-07-16

## 症状

- 拖动时邻组件被 preview 级联推挤，手感「恶心」；松手后多块叠在一起
- 对齐吸附与挤压算法与 DataEase 不一致

## 根因

1. **非 DE 预览推挤**：`handlePreview` + `cascadeFromBlocker` 在拖动每帧推邻居，DE 仅在松手后矩阵 reflow
2. **错误挤压模型**：`pushDown` 级联 ≠ DE `moveItemUp`（上浮）+ `emptyTargetCell`/`moveItemDown`（目标区下推）
3. **吸附阈值偏大**：`markLineThreshold` 使用 8px 屏幕下限，DE 固定 `diff=3`
4. **canItemGoUp 误用**：松手后把活动组件吸到 y=0，覆盖用户拖放坐标

## 修复方式（DE CanvasCore 对标）

- **拖动中**：`resolvePixelCollisions` 经 `handlePreview` 节流预览（32ms），邻块跟手让位；活动组件 `isPlayer` 浮层跟指针
- **松手/键盘提交**：同算法正式写入 layout
- **松手/键盘提交**：`resolvePixelCollisions` = vacate 上浮 → 写入新外框 → `emptyTargetCell` 式下推
- vacate 仅在 x/y 变化或高度缩小时触发；纯增高用 emptyTarget 下推
- `PixelCanvas` 移除 `handlePreview` 碰撞路径

## 验证

- `vitest run src/components/dashboard/pixelCanvas/`
- 编辑页：拖动中邻居不动；松手后无重叠、坐标保持用户落点

## 关联

- DataEase `CanvasCore.vue` movePlayer / resizePlayer / moveItemUp / emptyTargetCell
- `fe/src/components/dashboard/pixelCanvas/collisionLayout.ts`
- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
