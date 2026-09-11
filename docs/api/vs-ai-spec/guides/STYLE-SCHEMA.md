# Custom Viz 样式声明（styleSchema）

> AI 可为每个组件**自由声明**平台尚未出现过的样式项；平台按 schema 自动生成配置栏，无需新增 tsx。  
> **平台固定六块**（背景/配色/标题/备注/标签/提示）由 FE 写入 `customVizConfig.displayStyle`，见 [PROTOCOL.md](../PROTOCOL.md) §layout `customVizConfig`；**不要**在 schema 重复声明同名键，除非有意覆盖平台值。  
> 入库样式 warn 与 bundle 消费清单见 [CUSTOM-VIZ-STYLE-COMPLIANCE.md](./CUSTOM-VIZ-STYLE-COMPLIANCE.md)。

## 原则

1. **键名 camelCase**：如 `accentColor`、`showValue`；运行时映射为 CSS 变量 `--vs-style-accent-color`
2. **必须成对**：`styleSchema.properties` 每个键在 `defaultStyle` 里有默认值
3. **bundle 消费**：HTML 内读 `getComputedStyle(host).getPropertyValue('--vs-style-…')` / `--vs-palette-0` 或 `.vs-cv-payload` 的 `style` 对象；**数据**须按 Payload v1 的 `bindingStatus`（`unbound | bound | empty | error`）区分未绑定、有数、空结果与失败，见 [PROTOCOL.md](../PROTOCOL.md) §Payload v1
4. **与内置 chart 分层对齐**：平台六块 → `displayStyle`；组件专属 → `styleSchema` + `style`；单卡外壳 → `widgetStyle`（高级 Tab）
5. **禁止重复平台能力**：下列能力平台检查器已提供，**不得**再写入 `styleSchema`（入库 warn `AIVIZ_WARN_PLATFORM_DUPLICATE_STYLE`）

| 平台已有 | 检查器位置 | bundle 做法 |
|----------|-----------|-------------|
| **结果展示 / 取最新 N 条** | 数据 Tab · `dataBinding.resultLimit` | 直接渲染 `payload.rows`（已 LIMIT + 排序） |
| **刷新频率** | 数据 Tab · `dataBinding.refreshMode` | 无需 schema 项 |
| **标题/备注/标签/提示** | 样式 Tab **独立六块** · `displayStyle` | 读 `payload.style` / `--vs-style-*`；**勿**嵌在 styleSchema |
| **图表配色** | 样式 Tab 独立块 · 仅 palette/opacity/gradient | **不含**嵌套「图表标签/图表提示」（标签/提示见上两行独立块） |
| **截断提示** | 壳层横幅 · `truncated`/`rowCap` | 勿自写「已采样」条 |
| **widget 外壳** | 高级 Tab · `widgetStyle` | 勿在 schema 声明 `backgroundShow` 等 |

禁止键示例（非穷举）：`maxItems` · `topN` · `resultLimit` · `refreshMode` · `titleShow` · `labelShow` · `paletteId`

## 支持的 property 类型

| 声明 | 配置栏控件 | 示例 |
|------|-----------|------|
| `{ "type": "string", "format": "color", "title": "强调色" }` | 色块取色器 | `"accentColor": "#2563eb"` |
| `{ "type": "number", "minimum": 0, "maximum": 48, "title": "条高度" }` | DE 滑块 | `"barHeight": 20` |
| `{ "type": "number", "format": "opacity", "minimum": 0, "maximum": 100, "title": "不透明度" }` | 滑块（%） | `"fillOpacity": 80` |
| `{ "type": "boolean", "title": "显示数值" }` | 开关 | `"showValue": true` |
| `{ "type": "string", "enum": ["a","b"], "enumNames": ["横向","纵向"], "title": "排列" }` | 下拉 | `"layoutMode": "horizontal"` |
| `{ "type": "string", "title": "前缀文案" }` | 文本输入 | `"valuePrefix": "¥"` |

可选扩展：

- `"step": 0.5` — 数字步进
- `"description": "…"` — 字段下方说明（勿写 PRD 编号）
- `"x-section": "条形外观"` — 单字段归属分组（可被 `x-styleSections` 覆盖）

## 分组（多区块折叠）

```json
"styleSchema": {
  "type": "object",
  "x-styleSections": [
    { "title": "条形外观", "properties": ["accentColor", "barHeight", "cornerRadius"] },
    { "title": "标签", "properties": ["showValue", "labelColor"] }
  ],
  "properties": { ... }
}
```

未列入分组的键归入「其他」。

## AI 工作流

1. 根据需求列出组件需要哪些**可调视觉参数**（可以是平台从未有过的）
2. 写入 `styleSchema.properties` + `defaultStyle`
3. bundle 内实现对这些键的读取与渲染
4. `POST /api/v1/ai-viz/artifacts` 上传

## 参考样例

- [examples/custom-viz-bundle.json](../examples/custom-viz-bundle.json) — 含分组、开关、下拉、圆角等扩展项
