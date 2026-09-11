# schemas

| 文件 | 用途 |
|------|------|
| `custom-viz-plugin.schema.json` | `POST/PUT /ai-viz/artifacts` 请求体 |
| `layout.schema.json` | 大屏 `layoutJson` v2（**磁盘文件名**） |
| `layout-v2.schema.json` | 与上一文件内容相同，兼容旧文档 `$id` / 文件名 |
| `styles.schema.json` | `manifest.styleSchema` |
| `tokens.schema.json` | `theme-tokens.json` 外形 |

L3 `runtime` 只有 `html` | `d3`。capability-manifest 里 chartType 的 `"library": "react"` 指**内置图**实现库，不是 customViz runtime。
