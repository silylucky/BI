# START HERE — DeepTalk 集成项目总入口

> **铁律（必读）** → [IRON-RULES.md](./IRON-RULES.md)  
> **无 DeepTalk 源码 · 给接口即上传** → [MVP-UPLOAD.md](./MVP-UPLOAD.md)  
> **工程定位** → [PACK-IDENTITY.md](./PACK-IDENTITY.md)  
> **三条工作流必须分开** → [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md)

## 0. 无 DeepTalk 源码（MVP · 推荐先看）

| 目标 | 命令 |
|------|------|
| **② 上传新组件** | `python tools\mvp-upload.py --file examples\你的组件.json` |
| **查库 / 复用** | `python tools\mvp-dashboard.py --list-artifacts` |
| **③ 拼大屏** | `python tools\mvp-dashboard.py --dashboard-id <uuid> --artifact-ids uuid1,uuid2` |

DeepTalk 写到 `output/` 时：`python tools\mvp-upload.py --from output\xxx.json`  
详见 [MVP-UPLOAD.md](./MVP-UPLOAD.md)。

## 0b. 三条线（不要混）

| 线 | 任务 | 落到平台哪里 | 完成判据 |
|----|------|-------------|----------|
| **① 内置图** | 柱/线/饼/表/地图 `chartConfig` | 写进大屏 layout，**不进组件库** | `POST /charts/validate` 200 |
| **② 组件库** | **新组件** html/d3 开发与入库 | **`ai_viz_artifacts` 组件库** | **`artifactId=<uuid>`** |
| **③ 大屏** | 编排 layout，**复用库中已有 + ② 新上传** | `dashboards.layout_json` | `editor-save` 200 + **`dashboardId`** |

## 1. 一键命令

### 预检（工作流 ②/③ 前）

```bat
python tools\check-vitalspan-health.py
```

### ② 组件库（d3/html 新组件 · **先 scaffold + validate，再 publish**）

```bat
python tools\scaffold-custom-viz.py --id my-widget --name 我的组件
python tools\validate-ai-viz-bundle.py --file examples\my-widget.json
python tools\publish-ai-viz-artifact.py --file examples\my-widget.json
python tools\list-ai-viz-artifacts.py
python tools\delete-ai-viz-artifact.py <artifactId>
```

更新已有组件：

```bat
python tools\publish-ai-viz-artifact.py --file examples\你的组件.json --artifact-id <uuid>
```

### ① 内置图

```bat
python tools\validate-chart-config.py --file examples\bar-manual-deStyle.json
```

### ③ 大屏

```bat
python tools\upload-dashboard-layout.py --dashboard-id <大屏uuid> --file examples\e2e-mixed-screen.json
```

## 2. Runbook 索引

| 线 | 文档 |
|----|------|
| 总览 | [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md) |
| ② 组件库 | [guides/CUSTOM-VIZ-AUTHOR.md](./guides/CUSTOM-VIZ-AUTHOR.md) · [EXTERNAL-AUTHOR.md](./EXTERNAL-AUTHOR.md) · [00-REQUIREMENTS.md](./00-REQUIREMENTS.md) |
| ① 内置图 | [guides/L1-L2-CHART-CONFIG.md](./guides/L1-L2-CHART-CONFIG.md) |
| ③ 大屏 | [guides/DASHBOARD-LAYOUT.md](./guides/DASHBOARD-LAYOUT.md) · [compose+样式补丁](./guides/COMPOSE-STYLE-WORKFLOW.md) |
| DeepTalk 提示词 | [DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md) |

## 3. 环境

| 项 | 值 |
|----|-----|
| API | `http://127.0.0.1:8000/api/v1` |
| 健康检查 | `GET http://127.0.0.1:8000/health` |
| 组件库列表 | `GET /api/v1/ai-viz/artifacts` |
| 桌面包 validate | `VITALSPAN_ROOT=C:\...\VitalSpan` |

## 4. 禁止假完成

写本地 JSON（含 `output/`）≠ ② 入库 ≠ ③ 保存大屏。必须见上表 HTTP 判据。

## 5. DeepTalk 产品仓对接

有 DeepTalk 源码时，见 [deeptalk-product/README.md](./deeptalk-product/README.md)：

```powershell
.\scripts\sync-vs-ai-spec-to-deeptalk-repo.ps1 -DeepTalkRoot C:\path\to\deeptalk
```

内置 Agent 提示词：[deeptalk-product/AGENT-SYSTEM-PROMPT.md](./deeptalk-product/AGENT-SYSTEM-PROMPT.md) · 工具注册：[agent-tools.schema.json](./deeptalk-product/agent-tools.schema.json)

## 6. 刷新本包（桌面包 MVP）

```powershell
.\scripts\sync-vs-ai-spec-pack.ps1
.\scripts\pack-vs-ai-spec-deeptalk-test.ps1
```
