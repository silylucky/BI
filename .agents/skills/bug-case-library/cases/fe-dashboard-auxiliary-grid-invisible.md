# 辅助对齐网格不可见 / 开关无效

## 症状

- 配置面板「辅助对齐网格」开关存在，但画布上看不到 20px 网格线
- 或开关关闭后拖拽仍吸附到 20px 网格
- 深色主题下网格与画板底色叠在同一层，可能被 `background-image: none !important` 覆盖

## 根因（L1 代码证据）

| 层级 | 原因 | 证据 |
|------|------|------|
| 渲染层 | 网格与 artboard 共用 `background-image`，深色主题 CSS 清掉 artboard 背景图 | `index.css` `.pixel-canvas-artboard` |
| 对比度 | 旧 stroke `#e2e8f0` / `0.5px` 在浅底上亚像素不可见 | 旧 `auxiliaryGridPatternStyle` |
| 吸附 | ~~`snapRectToAuxiliaryGrid` 未受 `showAuxiliaryGrid` 控制~~ → 对标 DE：网格**仅视觉**，不做步长吸附 | `auxiliaryGridSnap.ts` `shouldApplyAuxiliaryGridSnap` 恒 `false` |
| 对齐线 | ~~关闭辅助网格时一并关闭 mark line~~ → 对标 DE `MarkLine.vue`：编辑态常驻，仅邻组件边/中心 3px 内吸附 | `PixelCanvas` `showMarkLines = mode==='edit'`；`pixelMarkLine.ts` 不含画板/gap 中线 |
| 可见区 | 组件间隙为 0 时网格仅出现在空白区域 | 预期行为，非 bug |

## 修复

1. **独立 overlay**：`PixelCanvas` / `DashboardGrid` 增加 `pixel-canvas-aux-grid` 层（`z-[1]`），artboard 仅承载底色与装饰
2. **样式**：`auxiliaryGridPatternStyle` stroke 改为 `#475569`（light）/ `#cbd5e1`（dark），线宽 1.5px
3. **对齐解耦**：`showMarkLines` 与 `showAuxiliaryGrid` 独立；辅助网格开关只控制 `pixel-canvas-aux-grid` overlay
4. **DE 邻组件吸附**：`computeMarkLineSnap` 仅比较外框边/中心，`markLineThreshold = 3/scale`，不吸附画板边缘
5. **CSS**：`.dashboard-edit-aux-grid { pointer-events: none; }` 避免遮挡交互

## 回归测试

- `dashboardChromeConfig.test.ts`：`auxiliaryGridPatternStyle` 可见 stroke
- `PixelCanvas.test.tsx`：辅助网格 ON/OFF 仅切换 `pixel-canvas-aux-grid`；编辑态 mark line 层常驻
- `pixelMarkLine.test.ts`：3px 邻组件吸附、不吸附画板、无 gap 中线
- `auxiliaryGridSnap.test.ts`：`shouldApplyAuxiliaryGridSnap` 恒 false

## 预防

- 辅助网格不得再 `mergeAuxiliaryGridIntoSurface` 到 artboard（易被主题 CSS 覆盖）
- 新增画布背景层时保持 z-index：artboard(0) → aux-grid(1) → widgets → mark-lines
