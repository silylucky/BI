# 三条工作流（必须分开，禁止混做）

> **铁律** → [IRON-RULES.md](../IRON-RULES.md) · **工程定位** → [PACK-IDENTITY.md](../PACK-IDENTITY.md)  
> DeepTalk × VitalSpan **一体集成**有 **三条独立工作流**。每条有独立产出、独立 API、独立完成判据。  
> **不要**在一次任务里把「开发组件」和「拼大屏」说成一步完成。

## 总览

```
┌──────────────────────────────────────────────────────────────────┐
│ 工作流 ① 内置图表（L1/L2）                                        │
│ 产出：chartConfig（嵌在大屏 layout 里）                             │
│ 不进组件库 · 完成：POST /charts/validate                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 工作流 ② 组件库 · 新组件开发（L3 · html / d3）  ★ DeepTalk 主战场  │
│ 产出：artifactId → 写入平台组件库（ai_viz_artifacts）              │
│ 完成：POST /ai-viz/artifacts → 汇报 artifactId=<uuid>            │
│ 同一组件可被多张大屏复用                                            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 工作流 ③ 大屏编排                                                  │
│ 产出：layoutJson → 保存到指定 dashboard                           │
│ 只引用已有能力，不在此工作流里写组件 HTML                            │
│ 完成：PUT /dashboards/{id}/editor-save                            │
│ customViz → 填组件库里的 artifactId（已有 + ② 新上传的均可）        │
└──────────────────────────────────────────────────────────────────┘
```

| 工作流 | 问什么 | 做什么 | **不做什么** | Runbook |
|--------|--------|--------|--------------|---------|
| **① 内置图** | 50 种 chartType 能画吗？ | 写 `chartConfig` | 不做 customViz、不进组件库 | [L1-L2-CHART-CONFIG.md](./L1-L2-CHART-CONFIG.md) |
| **② 组件库** | 要新形态 KPI/D3/动画？ | 写 html/d3 bundle → **入库** | 不拼大屏、不写 layout | [EXTERNAL-AUTHOR.md](../EXTERNAL-AUTHOR.md) |
| **③ 大屏** | 要摆到看板上？ | 写 `layoutJson` → editor-save | **不开发**组件源码 | [DASHBOARD-LAYOUT.md](./DASHBOARD-LAYOUT.md) |

---

## 工作流 ② · 组件库（开发新组件 d3/html）

**这是组件入库平台 `ai_viz_artifacts` 的唯一路径（不是本集成项目目录）。**

| 项 | 说明 |
|----|------|
| runtime | 仅 `html` 或 `d3` |
| 入库 API | `POST /api/v1/ai-viz/artifacts` |
| 存储 | 平台元库 **`ai_viz_artifacts`**（不是本规范包目录） |
| 完成证据 | 终端打印 **`ok artifactId=<uuid>`** |
| 前端入口 | 管理端图表盘「自定义」、`GET /api/v1/ai-viz/artifacts` 列表 |

### 标准步骤（只做组件，不做大屏）

```bat
py -3 tools\validate-ai-viz-bundle.py --file examples\my-widget.json
py -3 tools\upload-ai-viz-artifact.py --file examples\my-widget.json
```

向用户汇报：

```
artifactId=<uuid>
entry: GET /api/v1/ai-viz/artifacts/<uuid>/entry
说明：已入平台组件库，可被任意大屏通过 customVizConfig.artifactId 引用
```

**禁止**：写到 `output/` 就停；禁止说「组件项目已完成」而未 POST。

d3 必须 `host.vsCv.mount(`。详见 [00-REQUIREMENTS.md](../00-REQUIREMENTS.md)。

---

## 工作流 ③ · 大屏编排（复用组件库 + 内置图）

**大屏不承载组件源码，只引用 ID 或内联 chartConfig。**

### customViz 从哪来

| 来源 | artifactId 怎么拿 |
|------|-------------------|
| **库中已有** | VitalSpan 方提供，或 `GET /api/v1/ai-viz/artifacts` 列表 |
| **本次新开发** | 先走完 **工作流 ②**，用返回的 `artifactId` |
| 禁止 | 在 layout 里内联 HTML；禁止假 uuid |

```json
{
  "type": "customViz",
  "customVizConfig": {
    "artifactId": "079a6e97-24fa-4db0-a106-7b092e7ea072",
    "dataBinding": { "status": "manual" }
  }
}
```

同一张大屏可同时引用：

- 多个 **不同** `artifactId`（库中多个组件）
- 多个 **相同** `artifactId`（同一组件多实例）
- 多个 **内置 chart** widget（工作流 ① 的 `chartConfig`）

### 标准步骤（只做编排，开发组件请回到 ②）

```bat
REM 1. 确认 layout 里 customViz 的 artifactId 已在库中（② 或已有）
REM 2. 可选：内置图 chartConfig 先 validate-chart-config.py
py -3 tools\upload-dashboard-layout.py --dashboard-id <大屏uuid> --file examples\my-screen.json
```

完成证据：`ok dashboardId=<uuid>`。

用户在 `:5173` 编辑器绑 Dataset 后组件才出数——绑数是平台侧步骤，不是 DeepTalk POST 业务行。

---

## 工作流 ① · 内置图（补充）

标准柱/线/饼/表/地图走 `chartType`，配置写在 widget 的 `chartConfig` 里，**不经过** `POST /ai-viz/artifacts`。

与大屏关系：在工作流 ③ 的 `layoutJson` 里 `type: "chart"` 直接带 `chartConfig`。

---

## 典型联调顺序（两条线分开时）

**场景 A：只交一个新组件**

1. 只做工作流 ② → 汇报 `artifactId`  
2. **结束**（VitalSpan 方自行挂大屏，或另开任务做 ③）

**场景 B：新组件 + 上大屏**

1. 工作流 ② → `artifactId`  
2. 工作流 ③ → layout 填入该 `artifactId` + 其他已有组件/内置图 → editor-save  

**场景 C：只拼大屏，全用已有组件**

1. 只做工作流 ③ → 从库中选 artifactId，不调 ②  

---

## 与规范包目录的关系

| 目录里 | 平台里 |
|--------|--------|
| `examples/*.json` 草稿 | 组件库 `artifactId`（②） |
| `e2e-mixed-screen.json` 草稿 | `dashboards.layout_json`（③） |

规范包 **≠** 组件库。组件库 **只在 VitalSpan 后端**。

返回：[START-HERE.md](../START-HERE.md) · [PACK-IDENTITY.md](../PACK-IDENTITY.md)
