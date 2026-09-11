# Custom Viz 组件库协议（v1）

> **铁律** → [IRON-RULES.md](./IRON-RULES.md) · **工作流 ②** → [EXTERNAL-AUTHOR.md](./EXTERNAL-AUTHOR.md)  
> 一个 Base（`CustomVizWidget`）从接口异步加载库中源码，挂进看板主页面。

## Bundle 结构

```json
{
  "manifest": {
    "id": "ranking-strip-v1",
    "displayName": "排名条",
    "version": "1.0.0",
    "entry": "index.html",
    "fieldSlots": {
      "dimensions": { "min": 1, "max": 1, "label": "类别" },
      "metrics": { "min": 1, "max": 1, "label": "数值" }
    },
    "styleSchema": {
      "type": "object",
      "properties": {
        "accentColor": { "type": "string", "format": "color" },
        "barHeight": { "type": "number", "minimum": 8, "maximum": 48 }
      }
    },
    "defaultStyle": {
      "accentColor": "#3b82f6",
      "barHeight": 24
    },
    "runtime": "html",
    "rendererHint": "vanilla"
  },
  "files": {
    "index.html": "<!DOCTYPE html>..."
  }
}
```

## 渲染器（仅 html / d3）

customViz **只支持两种 runtime**。ECharts / AntV 不提供；标准图走 L1/L2 `chartConfig`。

| `manifest.runtime` | 说明 |
|--------------------|------|
| `html`（默认） | DOM / CSS / SVG / Canvas；读 `host.vsCv` 的 payload |
| `d3` | 使用平台注入的 **d3@7.9.0**（`host.vsCv.d3`），**禁止**把 d3 整库打进制品 |

未声明 `runtime` 时：若旧字段 `rendererHint === "d3"` 则视为 `d3`，否则 `html`。`rendererHint` 仅为兼容别名。

Base 在跑 bundle 脚本前给宿主挂 `host.vsCv`：`getPayload()`、`onPayload(fn)`、`onLayout(fn)`、**`mount(renderFn)`**、`helpers`、`d3`。平台 SLA 见 [guides/PLATFORM-SLA.md](./guides/PLATFORM-SLA.md)。

## 加载方式

1. AI：`POST /api/v1/ai-viz/artifacts` 把 HTML 源码存进库；同一 ID 用 `PUT` 覆盖
2. 大屏 layout 只记 `customVizConfig.artifactId`
3. Base（`CustomVizWidget`）`GET .../entry` 拉源码（带 `?h=<contentHash>` 防缓存）；**页签重新可见时**再拉 meta+entry，以便 PUT 覆盖后不必关页也能换新 HTML。挂进主页面宿主 DOM。

## 约束

| 规则 | 说明 |
|------|------|
| 单文件入口 | `manifest.entry` 默认 `index.html`，须存在于 `files` |
| 禁外链脚本 | 不得含 `<script src="http...">` 或 `//cdn` |
| 禁内联事件 | 不得含 `onload=`、`onclick=` 等 |
| 大小上限 | 整包 ≤ **2MB**（仅组件 HTML/CSS/内联脚本；**不含**平台 d3） |
| 禁内联 d3 整库 | 单文件 ≥200KB 且含 `d3.version` → 422 `AIVIZ_INLINE_D3_FORBIDDEN`，改用 `host.vsCv.d3` |
| runtime | `html` 或 `d3`（见上表） |
| 数据槽位 | **必填** `manifest.fieldSlots`：`dimensions` 与 `metrics` 均须 `min >= 1` |
| 样式声明 | **必填** `manifest.styleSchema.properties`（至少 1 项）；推荐同时提供 `defaultStyle`；**可声明平台从未出现过的样式键**，见 [guides/STYLE-SCHEMA.md](./guides/STYLE-SCHEMA.md) |
| 节点查找 | **仅**宿主内 `querySelector('#vs-cv-…')` 或 [BUNDLE-BOILERPLATE.md](./guides/BUNDLE-BOILERPLATE.md) 的 `$()`；**禁止** `document.getElementById`；**禁止** `(host\|\|document).getElementById`（宿主为 `div` 时无效）。禁止 `id="root"` / `id="app"` |
| CSS 作用域 | 挂载时选择器会收到 `.vs-custom-viz-host`；宿主已注入 `--dashboard-*`，不必再用 `:root` 改全局 |

## 注册与更新 API

`POST /api/v1/ai-viz/artifacts` — 新建，响应含 `artifactId`、`manifest`、`warnings[]`（样式合规 warn，不阻断入库）

`PUT /api/v1/ai-viz/artifacts/{id}` — 覆盖同一组件源码；引用该 ID 的看板/大屏下次打开即新代码

样式合规 warn 细则见 [guides/CUSTOM-VIZ-STYLE-COMPLIANCE.md](./guides/CUSTOM-VIZ-STYLE-COMPLIANCE.md)。

## 挂到看板/大屏

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "customViz",
  "title": "AI 排名条",
  "x": 0,
  "y": 0,
  "width": 480,
  "height": 240,
  "order": 0,
  "customVizConfig": {
    "artifactId": "<artifactId>",
    "dataBinding": { "status": "manual" }
  }
}
```

### layout `customVizConfig` 三层样式

| 字段 | 检查器位置 | 作用 |
|------|-----------|------|
| `widgetStyle` | **高级** Tab | 单卡外壳（底色/边框/圆角/透明度），与看板 `styleConfig.widgetStyle` 合并 |
| `displayStyle` | **样式** Tab 固定六块 | 平台通用：背景/图表配色/标题/备注/标签/提示；未设字段继承看板整体配置 |
| `style` | **样式** Tab schema 扩展 | manifest `styleSchema` 专属项；键名 camelCase |

合并写入运行时 `payload.style` 的顺序：`manifest.defaultStyle` → `displayStyle`（扁平化）→ `style`（schema 扩展覆盖同名键）。各键同时映射为宿主 CSS 变量 `--vs-style-<kebab-case>`；看板配色 token 另注入 `--vs-palette-0`… 与 `--dashboard-*`。

#### `displayStyle` 扁平化键（Payload v1 `style`）

| 块 | 写入 `style` 的键（节选） |
|----|--------------------------|
| 图表配色 | `paletteId` · `paletteColors` · `paletteOpacity` · `seriesGradient` |
| 标题 | `titleShow` · `titleColor` · `titleFontSize` · `titleFontWeight` · `titleAlign` … |
| 备注 | `remarkShow` · `remarkText` |
| 标签 | `labelShow` · `labelColor` · `labelFontSize` · `labelPosition` · `labelFormatter` |
| 提示 | `tooltipShow` · `tooltipColor` · `tooltipBackground` · `tooltipFontSize` |

bundle **应**优先读 `--vs-palette-*` / `--vs-style-*`（或 `payload.style` 同名键），以响应平台六块；组件专属项仍走 manifest 声明键。主题「重置颜色」会清除单卡 `displayStyle` 底色/配色 override（与内置 chart 对齐）。

## 运行时数据与样式（平台 → 宿主）

Base 在绑定就绪后走 `query/execute`，并**始终**向 `.vs-custom-viz-host` 注入 payload（含未绑定时 `bindingStatus: "unbound"`）：

1. **JSON 载荷**：宿主内 `<script type="application/json" class="vs-cv-payload">`，结构见 **Payload v1**（下方）
2. **样式变量**：`style` 各键映射为 `--vs-style-<kebab-case>` 写在宿主元素 `style` 上（与 `defaultStyle` + `displayStyle` 扁平 + `customVizConfig.style` 合并）；boolean 为 `true`/`false` 字符串；看板配色另注入 `--vs-palette-0`…

### Payload v1

```json
{
  "protocolVersion": 1,
  "bindingStatus": "bound",
  "columns": ["region", "amount"],
  "rows": [["华东", 100]],
  "style": { "accentColor": "#3b82f6", "titleShow": true, "labelColor": "#667085" },
  "layout": { "width": 480, "height": 240 },
  "axisPlan": {
    "categoryCount": 40,
    "categoryTickIndices": [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 39]
  },
  "truncated": false,
  "rowCap": 500,
  "error": "可选；仅 bindingStatus=error 时出现"
}
```

| 字段 | 说明 |
|------|------|
| `layout` | 宿主 `.vs-custom-viz-host` 当前像素尺寸；resize 时 Base 更新并触发 mount / `vs-cv-layout-update` |
| `axisPlan` | Base 预计算的类目轴 tick 下标；d3 bundle **应**优先消费 `categoryTickIndices` |
| `truncated` | 为 `true` 时表示 `rows` 已按 `rowCap` 截断；**壳层横幅**由 Base 绘制，非 bundle 自写 |
| `rowCap` | 平台侧 cap 上限（当前 500）；仅 `truncated: true` 时出现 |

| `bindingStatus` | 含义 |
|-----------------|------|
| `unbound` | 未绑 Dataset / 字段，或 execute 尚未就绪 |
| `bound` | 已绑定且 execute 返回行 |
| `empty` | 已绑定但结果集为空 |
| `error` | execute 失败；读 `error` 人话说明 |

AI 可在 `styleSchema` 中自由声明颜色、滑块、开关、下拉、文本等控件类型，平台自动生成配置栏（位于样式 Tab **六块之下**），详见 [guides/STYLE-SCHEMA.md](./guides/STYLE-SCHEMA.md)。平台固定六块见上文 `displayStyle`，**不必**在 schema 重复声明。

### vsCv（推荐 · AIVIZ-017）

```js
var host = document.currentScript.parentElement;
var vsCv = host.vsCv;
function render(p) {
  if (!p) return;
  if (p.bindingStatus === "unbound") { /* 引导文案 */ return; }
  if (p.bindingStatus !== "bound") { /* empty/error */ return; }
  var w = (p.layout && p.layout.width) || host.clientWidth;
  var ticks = (p.axisPlan && p.axisPlan.categoryTickIndices)
    || vsCv.helpers.thinCategoryTickIndices(p.rows.length, Math.max(w - 56, 8), 56);
  vsCv.d3.select(host.querySelector("#vs-cv-chart")); // 不要 document.getElementById
}
vsCv.mount(render);
```

| API | 说明 |
|-----|------|
| **`mount(renderFn)`** | **推荐**；payload/layout 变化时 Base 自动调用；**d3 入库必须** |
| `getPayload()` / `onPayload(fn)` | Payload v1；兼容旧 bundle |
| `onLayout(fn)` | 仅尺寸变化；新制品请用 `mount` |
| `d3` | 平台 d3@7.9.0，勿内联整库 |
| `helpers.thinCategoryTickIndices(count, innerWidth, minLabelPx?)` | 返回应显示类目标签的下标数组（抽稀） |
| `helpers.measureHost(el?)` | 读宿主或子节点 `getBoundingClientRect` 像素尺寸 |

也可继续监听 **`vs-cv-payload-update`** / **`vs-cv-layout-update`**。**禁止** MutationObserver 盯宿主。推荐 `getComputedStyle(host)` 读 `--vs-style-*`。

### 渲染能力边界（与内置 chart 的区别）

customViz **不会**调用 `applyChartStyleChain` 或 `renderD3Chart`（F17 Out）。平台提供（见 [guides/PLATFORM-SLA.md](./guides/PLATFORM-SLA.md)）：

- 查数结果 → `payload.rows`（cap + `truncated` + **壳层横幅**）
- 宿主尺寸 → `payload.layout` + **`mount` 自动重绘**
- 轴抽稀计划 → `payload.axisPlan` + `helpers.thinCategoryTickIndices`

**bundle 责任**：在 `mount` 的 render 内读 `layout` / `axisPlan` 设 SVG 视口与 tick；处理 unbound/empty/error 态。详见 [guides/D3-OPTIONAL.md](./guides/D3-OPTIONAL.md) · [guides/HTML-RUNTIME.md](./guides/HTML-RUNTIME.md)。

未绑定时依据 `bindingStatus === "unbound"` 显示引导，**不要**假装已有业务数据。

## Schema 文件（磁盘名）

| 路径 | 说明 |
|------|------|
| `schemas/layout.schema.json` | layoutJson v2（**请用此文件名**） |
| `schemas/layout-v2.schema.json` | 同上，兼容旧 `$id` / 误写的文件名 |
| `schemas/custom-viz-plugin.schema.json` | 注册 artifact 请求体 |
| `schemas/styles.schema.json` | `manifest.styleSchema` |
| `schemas/tokens.schema.json` | `theme-tokens.json` 外形 |

## 数据（第一期）

- `dataBinding.status: "manual"`：用户稍后在平台绑字段；bundle 可用静态演示数据
- 平台绑字段后走与内置 chart 相同的 `query/execute`；**不在 layout 写入合成 chartType**
