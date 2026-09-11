# 外部作者 Runbook — 工作流 ② · 组件库（L3 customViz）

> **铁律** → [IRON-RULES.md](./IRON-RULES.md) · **工程定位** → [PACK-IDENTITY.md](./PACK-IDENTITY.md)  
> **本文件只覆盖「开发新组件并入库」。**  
> 拼大屏 → [guides/DASHBOARD-LAYOUT.md](./guides/DASHBOARD-LAYOUT.md)（工作流 ③）  
> 三条线总览 → [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md)

## 定位

| 项 | 说明 |
|----|------|
| 任务 | 开发 **html** 或 **d3** 新组件 |
| 交付目标 | VitalSpan **平台组件库**（表 `ai_viz_artifacts`） |
| 完成标志 | `POST /ai-viz/artifacts` 返回 **`artifactId=<uuid>`** |
| 复用 | 入库后任意大屏可通过 `customVizConfig.artifactId` 引用 |

**本工作流结束于 `artifactId`。** 是否上大屏是另一条工作流（③），可另开任务。

## 0. 一句话（禁止误解）

| 错 | 对 |
|----|-----|
| 「组件项目目录里已完成」 | 「**组件库**已登记 `artifactId=...`」 |
| 「保存在 output/」 | 「已 POST 到 `:8000/api/v1/ai-viz/artifacts`」 |

## 步骤

| 步 | 动作 | 成功标志 |
|----|------|----------|
| 0 | `python tools/check-vitalspan-health.py` | ok |
| 1 | 读 `00-REQUIREMENTS` + `PLATFORM-SLA`；d3 参考 `custom-viz-d3-bundle.json` 的 `mount`；起盘 generic-blank | — |
| 2 | 草稿 `examples/<name>.json`（禁止 `output/` 当交付目录） | JSON 合法 |
| 3 | **`python tools/publish-ai-viz-artifact.py --file examples/<name>.json`** | **`ok artifactId=<uuid>`** |

仅 preflight、不 POST：`publish-ai-viz-artifact.py --validate-only` 或 `validate-ai-viz-bundle.py`。

## 汇报模板（必须）

```
工作流 ② 完成
artifactId=<uuid>
entry GET http://127.0.0.1:8000/api/v1/ai-viz/artifacts/<uuid>/entry
已入平台组件库；大屏引用见工作流 ③ customVizConfig.artifactId
```

## 禁止的完成说法

- 「已保存到 output/…」
- 「可在扩展中直接使用」
- 未报 `artifactId` 却说「已上传 VitalSpan」

## 环境变量

见 [START-HERE.md](./START-HERE.md)。桌面包必填 `VITALSPAN_ROOT`。

## 刷新集成项目

```powershell
.\scripts\sync-vs-ai-spec-pack.ps1
```
