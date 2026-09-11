# 图库预览缩略图（gallery）

按分类归档的预览图副本，**运行时图库 UI 走 `packs/thumbs/` 或全图 `url`**，本目录供人工浏览与核对。

| 子目录 | 用途 | 条数 |
|--------|------|------|
| `canvas-dark/` | 大屏深色背景预览副本 | 154 |
| `canvas-light/` | 大屏浅色背景预览副本 | 154 |
| `screen-bg/` | 经典背景图预览副本 | 7 |
| `component-panel/` | 组件面板预览副本 | 52 |
| `title-strip/` | 顶部装饰预览副本 | 30 |
| `screen-header/` | 顶栏整图预览副本 | 30 |
| `borderless-decor/` | 无边框装饰预览副本 | 100 |

由 `pnpm run generate:template-catalog` 自动生成，勿手工编辑。选中素材时仍写入 `packs/` 下的全图 `url`。
