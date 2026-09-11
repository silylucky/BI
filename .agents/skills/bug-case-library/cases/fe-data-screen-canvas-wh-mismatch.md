# 大屏编辑 W/H 与画布视觉不符

## 症状

- 右侧 `screen-canvas-w` / `screen-canvas-h` 显示设计尺寸（如 2072×1094），改 W/H 后标尺、白底或组件边界与输入不一致
- 快速连改 W、H 时最终尺寸偶发只生效一边
- 默认「高度优先」缩放下改 H，屏幕上的画布高度几乎不变，用户误以为 H 无效

## 根因

1. **默认缩放与 DE 不一致**：VitalSpan 默认「高度优先」，DataEase 默认「宽度优先」——在宽度优先下改 W 屏幕宽度贴满不变、改 H 才改变可见高度（用户所述现象）
2. **语义**：W/H 为**设计稿像素**，编辑视口按缩放方式等比显示
3. **视口层**：pan 盒与内层 `scale()` 布局错位（已简化）
4. **提交路径**：W、H 分两次提交可能闭包过期（已改 patch）

## 修复

- 默认 `fitWidth`（宽度优先），右栏仅保留 宽度优先 / 高度优先 / 等比适应
- UI 顺序对标 DE：W · H → 缩放方式
- 右下角 HUD 显示当前设计尺寸 `1920×1080`
- `resolveCanvasRulerScrollOffset`：标尺偏移须含 `viewPan + contentOffset`
- 角块透明 + `z-0`，横/纵尺 `z-[1] overflow-visible` 并向角区延伸，避免 28×28 色块裁切刻度数字

## 锚点

- `fe/src/components/dashboard/screen/DataScreenEditViewport.tsx`
- `fe/src/components/dashboard/screen/DataScreenConfigExtras.tsx`
- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` — `handleDataScreenCanvasSize`

## 回归

- `DataScreenConfigExtras.test.tsx`
- `DataScreenEditViewport.test.tsx` — stage 随 canvasWidth 更新
