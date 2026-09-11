# Custom Viz 可选 D3 开发规范

> **不强制** customViz 使用 D3。选用 D3 时用平台注入的 `host.vsCv.d3`（d3@7.9.0），**不要**内联 d3 整库。与内置图表引擎 **逻辑分离、视觉可对齐**。

## 何时选用 D3

| 适合 `runtime: "d3"` | 更适合 `runtime: "html"` |
|----------------------|-------------------------|
| 多系列比例尺、坐标轴、brush/zoom | 简单排名条、KPI、告警滚动 |
| 动态数据驱动 SVG 更新 | 不必用比例尺的 DOM/CSS |
| 运行时免发版的新形态 | 政企导出像素级一致、进 50 种 chartType |

平台 FE 使用 **d3@7.9.0**。Base 在挂载脚本前把同一份 d3 赋给 `host.vsCv.d3`。**禁止** `<script src="https://cdn...">`，也 **禁止** 把 `d3.min.js` 贴进 `files`。

## 与平台 D3 引擎的区别

```text
内置 chart：chartConfig → buildChartRenderPlan → applyChartStyleChain → fe/engine/d3/*
customViz+D3：artifact HTML 调用 host.vsCv.d3 → Base 宿主展示
```

customViz **不会**调用 `applyChartStyleChain` 或 `renderD3Chart`。要对齐内置图风格，请使用 [theme-tokens.json](../theme-tokens.json)。

平台 **会** 注入 Payload `layout`、`axisPlan`、`truncated`/`rowCap`，壳层 truncated 横幅，以及 `vsCv.mount` / `helpers.thinCategoryTickIndices`。bundle **必须** `host.vsCv.mount(render)`（d3 入库 lint）。详见 [PLATFORM-SLA.md](./PLATFORM-SLA.md) · [PROTOCOL.md](../PROTOCOL.md) §渲染能力边界。

## 自适应与抽稀（d3 必做）

| 场景 | 推荐做法 |
|------|----------|
| 组件拖大/拖小 | **`vsCv.mount(render)`**；render 内读 `p.layout.width/height` 设 SVG |
| 类目过多 | 读 **`payload.axisPlan.categoryTickIndices`**；或 `helpers.thinCategoryTickIndices` |
| 行数过大 | 壳层已提示；可选读 `payload.truncated` |

官方 d3 示例 [`custom-viz-d3-bundle.json`](../examples/custom-viz-d3-bundle.json) 已示范上述模式。  
动态趋势（读 `p.style` + 动画）见 [`custom-viz-trend-line.json`](../examples/custom-viz-trend-line.json)。

## 包约束

与 [PROTOCOL.md](../PROTOCOL.md) 相同：

- 单入口 `index.html`，脚本与样式 **内联**（组件自己的逻辑）
- 整包 ≤ **2MB**；d3 本体不计入制品
- 单文件 ≥200KB 且含 `d3.version` 会被拒绝
- 源码由 Base 挂进主页面；宿主已注入 `--dashboard-*`

## 主题对齐（推荐）

1. 读取 [theme-tokens.json](../theme-tokens.json)
2. 不要用 `:root` / `html` / `body` 改整页
3. 系列色用 `--vs-d3-accent` 或 layout `paletteColors`

## D3 编码约定

| 约定 | 说明 |
|------|------|
| 入口 | `var d3 = document.currentScript.parentElement.vsCv.d3` |
| 数据 | `vsCv.getPayload()` / `vsCv.onPayload`；仅 `bindingStatus === "bound"` 时画数据 |
| 布局 | 预留 margin；分类 `scaleBand` + padding；数值 `scaleLinear` + `.nice()` |
| 地图 | 禁止 L3 内嵌 MapLibre / 在线瓦片（GEO-IRON-01） |

参考（**不可 import**）：[`fe/src/components/charts/engine/d3/`](../../../../fe/src/components/charts/engine/d3/)。

## manifest

```json
{
  "manifest": {
    "id": "my-d3-widget",
    "runtime": "d3",
    "entry": "index.html"
  }
}
```

`rendererHint: "d3"` 仍可作兼容别名。

## 反模式

- 外链 / 内联 d3 整库、ECharts、AntV
- `onclick=` 等 inline 事件
- `id="root"` / `id="app"`
- 把 customViz 当成第 50 种 chartType

## 示例

- [custom-viz-d3-bundle.json](../examples/custom-viz-d3-bundle.json) — `vsCv.d3` 柱条
- [custom-viz-bundle.json](../examples/custom-viz-bundle.json) — html vanilla
