# Custom Viz 渲染器选择

> L3 **只支持** `html` 与 `d3`。`manifest.runtime` 由后端校验。ECharts / AntV **不支持**（标准图走 L1/L2）。  
> 平台 SLA：[PLATFORM-SLA.md](./PLATFORM-SLA.md)

## 决策树（先读）

```text
标准柱/线/表/地图能表达？  → 是 → L1/L2 chartConfig（禁止走 customViz）
KPI / DOM / 滚动 / 告警？   → 是 → L3 runtime: html + vsCv.mount
比例尺 / 坐标轴 / SVG 图？  → 是 → L3 runtime: d3 + vsCv.mount + axisPlan
```

## runtime

| 值 | 适用场景 | 示例 |
|----|----------|------|
| `html` | DOM/CSS/SVG/Canvas、KPI、告警滚动 | [custom-viz-bundle.json](../examples/custom-viz-bundle.json) |
| `d3` | 比例尺、坐标轴、复杂几何；用 `host.vsCv.d3` | [custom-viz-d3-bundle.json](../examples/custom-viz-d3-bundle.json) · [D3-OPTIONAL.md](./D3-OPTIONAL.md) |

未声明 `runtime` 时：`rendererHint === "d3"` → `d3`，否则 `html`。

`html` 下仍可用手写 SVG/Canvas；不必再单独声明 `svg`/`canvas` hint。

## 与内置 chart 的关系

| 需求 | 推荐路径 |
|------|----------|
| 已有 chartType 能表达（含 `gis-map`） | L1/L2：`chartConfig` + `deStyle` / `gisProject` |
| 全新形态、免发版 | L3：`customViz` + `html` 或 `d3` |
| 必须接全套 deStyle / 导出像素一致 | 原生 chartType（合入仓库发版） |
| ECharts / AntV option | **不支持**；用 L2 或放弃 |

## 风格对齐

推荐 [theme-tokens.json](../theme-tokens.json) 的 `--dashboard-*`。Base 会把主题变量写到宿主上。

## 约束

见 [PROTOCOL.md](../PROTOCOL.md)：禁 CDN、禁内联 d3 整库、整包 ≤2MB、`host.vsCv`。
