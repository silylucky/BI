# 图表装饰边框配置无效（看不见）

- **ID**: CASE-2026-07-29-001
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-07-29

## 症状

- 样式 Tab「背景」切换到「装饰边框」后可选样式 / 装饰色 / 不透明度
- 面板数值会变，但画布上看不到装饰边框
- 用户感知为「这个功能无法使用」

## 根因

- 装饰边框被放进 `backgroundLayers`，在 `PixelShapeInnerChrome` 里以 `z-0` 渲染在图表内容**下方**
- 内容区（`z-[1]`）自带不透明底色，整幅盖住 frame overlay
- 装饰边框语义是 **overlay**（`resolveChartFrameOverlayLayer`），必须盖在内容之上

## 错误做法（避免）

- 把 `frameLayer` 与底色/底图一并塞进 `backgroundLayers` 再统一渲染在内容前
- 仅靠调高 SVG 对比度排查「看不见」而忽略层叠顺序

## 修复方式

- `mergeShapeInnerPresentation`：拆分 `backgroundLayers`（内容下）与 `frameLayers`（内容上）
- `PixelShapeInnerChrome`：内容渲染后再挂 `frameLayers`（`z-[2]` / `z-[3]`，`pointer-events-none`）
- 边框素材壳层继续清空 `frameLayers`

## 验证

- `chartDeStyle.test.ts`：frame 出现在 `shell.frameLayers[0]`，不在 `backgroundLayers`
- 编辑页选装饰边框样式 3，画布组件四周应可见框线；改装饰色/不透明度即时生效

## 关联

- `fe/src/lib/chartDeStyle.ts`
- `fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`
- `fe/src/lib/chartFrameBorderPresets.ts`
- 装饰色取色器：见同日修复 `ColorField` swatch 勿把 `HintTooltip` 套进 `PopoverTrigger`
- 「必须调不透明度才显示」：Canvas/WebGL 合成层盖住普通 HTML overlay → `resolveChartFrameOverlayLayer` 加 `translateZ(0)`；`frameOpacity` 默认 1 且不再误用背景 opacity
