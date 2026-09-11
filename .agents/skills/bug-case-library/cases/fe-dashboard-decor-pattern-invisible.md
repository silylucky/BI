# 看板背景装饰纹理「仅点阵可见」

## 症状

- 配置面板「背景装饰」五个选项中，**仅点阵缩略图**能辨认纹理
- 细网格 / 十字线 / 斜纹缩略图像纯色块；选中后画布上也几乎看不见
- 与「编辑辅助网格不可见」属同类：**SVG 平铺纹理在浅底 + 小预览区下对比度/尺度不足**

## 根因（L1 代码证据）

| 层级 | 原因 | 证据 |
|------|------|------|
| 对比度 | 十字线浅色 stroke 为 `#e2e8f0`，在 `#f8fafc` 底上接近不可见 | 旧 `CANVAS_CROSS_SVG` |
| 线宽 | 网格/十字 canvas 仅 `0.5px` stroke，HiDPI 下亚像素淡化 | 旧 `CANVAS_GRID_SVG` |
| 缩略图尺度 | 面板 chip 仅 `20×20px`，却用 `24×24` / `20×20` 大瓦片 → 不足 1 个周期 | `decorPresetThumbStyle` + `size-5` |
| 架构 | 缩略图与画布共用同一 data URL，无「预览专用」参数 | `decorTileImageForScheme` 仅区分 light/dark |

点阵可见：实心圆 `fill` + 较小 tile，在 micro-preview 中仍有一点可见像素。

## 修复

1. 新增 `fe/src/components/dashboard/canvasDecorPatterns.ts`
   - `context: "canvas" | "thumb"` 双通道
   - thumb：8px 瓦片、stroke ≥1px、`#64748b`（light）/ `#cbd5e1`（dark）
   - canvas：统一 `#94a3b8` stroke，去掉 `#e2e8f0`
2. `decorPresetThumbStyle` / `resolveDecorImageStyle` 走 thumb/canvas 分层
3. 面板缩略图 `size-5` → `size-6`（24px）
4. `url("...")` 统一加引号

## 回归测试

- `canvasDecorPatterns.test.ts`：四种 preset 的 thumb/canvas URL 含可见色、thumb 8px repeat
- `dashboardCanvasBackgroundPanel.test.ts` 保留既有 decor 管线用例

## 预防

- 新增平铺纹理 preset 时必须同时验收 **thumb + canvas** 两种 context
- 缩略图尺寸变更时检查 `backgroundSize` 是否能在 preview 内显示 ≥2 个 tile 周期
