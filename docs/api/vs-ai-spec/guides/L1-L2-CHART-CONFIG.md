# L1/L2 内置图表（chartConfig · 工作流 ①）

> **铁律** → [IRON-RULES.md](../IRON-RULES.md) · **工程定位** → [PACK-IDENTITY.md](../PACK-IDENTITY.md)  
> **何时用**：柱/线/饼/表/地图等 **已有 chartType** 能表达的需求。  
> **何时不用**：KPI 卡片、滚动列表、自绘 SVG/D3 → 走 [L3 customViz](../EXTERNAL-AUTHOR.md)。

## 1. 完成定义

| 步骤 | 动作 | 成功标志 |
|------|------|----------|
| 1 | 生成 `chartConfig`（见 §2） | JSON 合法 |
| 2 | `POST /api/v1/charts/validate` | **200**（**工作流 ① 完成**） |
| 3 | 嵌入大屏 `layoutJson` widget `type: "chart"` | 属 **工作流 ③**，见 [DASHBOARD-LAYOUT.md](./DASHBOARD-LAYOUT.md) |
| 4 | 用户在编辑器绑定 Dataset | 平台侧手动完成 |

**不算完成**：只写 `examples/chart-xxx.json` 到磁盘；未调 validate。

本机校验：

```bat
python tools\validate-chart-config.py --file examples\bar-manual-deStyle.json
```

## 2. chartConfig 形状

与 `examples/bar-manual-deStyle.json` 同级：

```json
{
  "chartConfig": {
    "chartType": "bar",
    "styleVariant": "default",
    "dimensions": [{ "field": "{{dimension_1}}", "label": "维度" }],
    "metrics": [{ "field": "{{metric_1}}", "label": "指标" }],
    "nativeBody": {
      "dataBinding": { "status": "manual" },
      "deStyle": {
        "paletteId": "default",
        "cartesian": { "barRadius": 6 }
      }
    }
  }
}
```

| 字段 | 规则 |
|------|------|
| `chartType` | 须在 `capability-manifest.json` → `chartTypes[].type` 中 |
| `styleVariant` | 须在该 chartType 的 `styleVariants` 中 |
| `nativeBody.dataBinding.status` | 联调阶段用 **`"manual"`**（待用户在平台绑 Dataset） |
| `deStyle` | 见 `style-vocabulary.json`；GIS 图用 `nativeBody.gisProject` |
| 维度/指标 | 占位符 `{{dimension_1}}` / `{{metric_1}}` 即可；绑数后由用户替换 |

**禁止**：为标准柱线饼单独做 L3 `customViz`（见 [RENDERERS.md](./RENDERERS.md)）。

## 3. HTTP 校验

```
POST {API}/charts/validate
Authorization: Bearer {JWT}
Content-Type: application/json

<body = chartConfig 对象，不是外层再包一层>
```

成功：返回规范化后的 `ChartViewConfig`（含 `chartType`）。  
失败：422 + `{ code, message, detail }`。

## 4. 挂到大屏

在 `layoutJson.widgets[]` 中：

```json
{
  "id": "11111111-1111-4111-8111-111111111101",
  "type": "chart",
  "title": "销售对比",
  "x": 48, "y": 48, "width": 900, "height": 400, "order": 0,
  "chartConfig": { "...": "同上 validate 通过的 chartConfig" }
}
```

保存大屏见 [DASHBOARD-LAYOUT.md](./DASHBOARD-LAYOUT.md)。

## 5. 黄金样例

| 文件 | chartType |
|------|-----------|
| `examples/bar-manual-deStyle.json` | `bar` |
| `examples/line-manual-deStyle.json` | `line` |
| `examples/pie-manual-deStyle.json` | `pie` |
| `examples/gis-map-project.json` | `gis-map` |

## 6. 路径决策（再确认）

| 需求 | 路径 |
|------|------|
| 标准统计图 | **本文件 L1/L2** |
| 排名条 / 脉冲 KPI / 告警流 | L3 `customViz` |
| 整屏混排 | `layoutJson` + editor-save |

返回总入口：[START-HERE.md](../START-HERE.md)
