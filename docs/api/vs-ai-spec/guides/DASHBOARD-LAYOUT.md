# 版面编排 — 工作流 ③（layoutJson + editor-save）

> **铁律** → [IRON-RULES.md](../IRON-RULES.md) · **工程定位** → [PACK-IDENTITY.md](../PACK-IDENTITY.md)  
> **本文件只覆盖「把已有能力摆到看板/大屏上」。**  
> **不在此工作流开发组件 HTML** → 新组件先走 [工作流 ②](../EXTERNAL-AUTHOR.md) 入库。  
> 三条线总览 → [THREE-WORKFLOWS.md](./THREE-WORKFLOWS.md)

## 仪表板 vs 数据大屏

| | **仪表板** | **数据大屏** |
|---|-----------|-------------|
| `layoutJson.styleConfig.surfaceKind` | `dashboard`（默认） | `data-screen` |
| 画布 | 1440 宽 | 1920×1080 |
| 5173 | `/admin/dashboards/:id/edit` | `/admin/data-screens/:id/edit` |
| 列表 API | `GET /dashboards?surfaceKind=dashboard` | `?surfaceKind=data-screen` |

同表 `dashboards`、同 `editor-save`，**禁止**把一种 surface 的 layout 保存到另一种 uuid。

## 定位

| 项 | 说明 |
|----|------|
| 任务 | 编排 `layoutJson` v2，保存到指定 dashboard |
| 完成标志 | `PUT .../editor-save` → **`dashboardId`** |
| customViz | **只填 `artifactId`**，引用**组件库**中的条目 |
| 内置图 | widget `type: chart` + `chartConfig`（工作流 ①，不进组件库） |

**DeepTalk 插件推荐**：`compose` 搭骨架 → `get_dashboard_layout` 导出 → 只改样式 → `upload`。见 [COMPOSE-STYLE-WORKFLOW.md](./COMPOSE-STYLE-WORKFLOW.md)。

## 组件从哪来（可混用）

| 来源 | 用法 |
|------|------|
| **库中已有** | VitalSpan 提供 uuid，或 `GET /api/v1/ai-viz/artifacts` |
| **本次新开发** | 先完成工作流 ②，用新 `artifactId` |
| **内置 chartType** | 工作流 ①，`chartConfig` 直接写在 layout 里 |

同一大屏可放：多个不同组件、同一组件多实例、多个内置图。

```json
{
  "type": "customViz",
  "customVizConfig": {
    "artifactId": "<组件库 uuid>",
    "dataBinding": { "status": "manual" }
  }
}
```

## 步骤（只做编排）

| 步 | 动作 |
|----|------|
| 0 | 确认每个 `customViz` 的 `artifactId` **已在组件库**（② 或历史已有） |
| 1 | 组装 `layoutJson`（`schemas/layout.schema.json`） |
| 2 | `py -3 tools/upload-dashboard-layout.py --dashboard-id <uuid> --file examples/my-screen.json` |
| 3 | 汇报 `dashboardId` + widget 数量 |

绑 Dataset 由用户在 `:5173` 编辑器完成。

## 与 ② 的分工

```
② 开发上传 ──► 组件库 (artifactId)
                    │
                    ├──► ③ 大屏 A 引用
                    └──► ③ 大屏 B 引用（同一 artifactId 可复用）
```

**禁止**在 ③ 里 `write_file` 组件 bundle 并声称大屏已完成。

## 样例

`examples/e2e-mixed-screen.json`：内置柱图 + customViz（需替换 `REPLACE_WITH_ARTIFACT_UUID`）。

## API

```
PUT {API}/dashboards/{dashboardId}/editor-save
Body: { "layoutJson": { "version": 2, ... }, "globalFilters": null }
```

返回总入口：[START-HERE.md](../START-HERE.md)
