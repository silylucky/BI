# VS-AI-SPEC — DeepTalk × VitalSpan 一体集成项目（v1）

> VitalSpan 混合方案 C：内置图表配置 + 库源码自定义组件（Base 加载）+ 大屏 layout 拼接。  
> 数据绑定由用户在平台手动完成（非 AI 自动生成 SQL）。

**👉 入口：[START-HERE.md](./START-HERE.md)** · **铁律：[IRON-RULES.md](./IRON-RULES.md)**

**完成标准摘要**：

| 路径 | 完成标志 |
|------|----------|
| ① L1/L2 内置图 | `POST /charts/validate` 200 |
| ② L3 customViz | **`artifactId=<uuid>`**（publish/upload） |
| ③ 大屏编排 | **`dashboardId`** + editor-save 200 |

写本地 JSON **不算完成**。详见 [IRON-RULES.md §3](./IRON-RULES.md#3-交付铁律)。

## 三条创作路径

| 路径 | AI 产出 | 落到平台 |
|------|---------|----------|
| **① L1/L2 内置图** | `chartConfig` | 大屏 layout 内联，**不进组件库** |
| **② L3 组件库** | html/d3 bundle | **`ai_viz_artifacts` → `artifactId`** |
| **③ 大屏编排** | `layoutJson` v2 | **`editor-save`**；customViz **引用** ② 或库中已有 |

详见 [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md)（**禁止混任务**）。

## 推荐命令（Agent 默认）

| 线 | 命令 |
|----|------|
| 预检平台 | `python tools/check-vitalspan-health.py` |
| **MVP 一键上传（无 DeepTalk 源码）** | `python tools/mvp-upload.py --file examples/<name>.json` |
| **② 入库（主推）** | `python tools/publish-ai-viz-artifact.py --file examples/<name>.json` |
| ② 查库 | `python tools/list-ai-viz-artifacts.py` |
| ② 删库 | `python tools/delete-ai-viz-artifact.py <uuid>` |
| ① 内置图 | `python tools/validate-chart-config.py --file examples/bar-manual-deStyle.json` |
| ③ 大屏 | `python tools/upload-dashboard-layout.py --dashboard-id <uuid> --file examples/...` |

## DeepTalk 产品级对接

有 DeepTalk 产品源码 → [deeptalk-product/README.md](./deeptalk-product/README.md)（executor · config · Agent 工具 · 完成 Gate）

## 目录

| 文件 | 说明 |
|------|------|
| [IRON-RULES.md](./IRON-RULES.md) | **铁律**：一体模型、三条线、交付判据 |
| [START-HERE.md](./START-HERE.md) | 总入口、一键命令 |
| [PACK-IDENTITY.md](./PACK-IDENTITY.md) | **工程定位**：DeepTalk 集成项目 × VitalSpan 平台能力 |
| [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md) | ② 组件库 · ③ 大屏 · ① 内置图 |
| [DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md) | 贴进 DeepTalk 的系统提示词 |
| [00-REQUIREMENTS.md](./00-REQUIREMENTS.md) | **L3 硬要求**（工作流 ② 细则） |
| [EXTERNAL-AUTHOR.md](./EXTERNAL-AUTHOR.md) | **工作流 ② Runbook** |
| [guides/L1-L2-CHART-CONFIG.md](./guides/L1-L2-CHART-CONFIG.md) | 工作流 ① Runbook |
| [guides/DASHBOARD-LAYOUT.md](./guides/DASHBOARD-LAYOUT.md) | 工作流 ③ Runbook |
| [HANDOFF.md](./HANDOFF.md) | 联调备忘、curl、误读对照 |
| [CHANGELOG.md](./CHANGELOG.md) | 集成项目修订记录 |
| [examples/](./examples/) | 黄金样例（upload 后才进平台组件库） |

## tools/

| 脚本 | 路径 |
|------|------|
| `check-vitalspan-health.py` | `GET /health` |
| **`publish-ai-viz-artifact.py`** | **② 一步：preflight → POST/PUT** |
| `validate-ai-viz-bundle.py` | ② 仅 preflight |
| `upload-ai-viz-artifact.py` | ② POST/PUT（同 publish，兼容旧命令） |
| `list-ai-viz-artifacts.py` | `GET /ai-viz/artifacts` |
| `delete-ai-viz-artifact.py` | `DELETE /ai-viz/artifacts/{id}` |
| `validate-chart-config.py` | ① → `POST /charts/validate` |
| `upload-dashboard-layout.py` | ③ → `editor-save` |

## 鉴权

`Authorization: Bearer <JWT>`；写/删操作需 `dashboard:edit`。

## 红线

- 地图仅离线 GeoJSON（GEO-IRON-01 choropleth）；`gis-map` 使用 `nativeBody.gisProject`
- 自定义 bundle 禁止外链 `<script src>`；样式与逻辑须内联
- `customViz` 不进 `GET /charts/types`（与内置 chartType 分离）
