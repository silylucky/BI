# Compose 大屏模板 · 5173 政企内置参考

> **铁律** → [IRON-RULES.md](../IRON-RULES.md) · **DE 工整模板** → [COMPOSE-TEMPLATES-DE.md](./COMPOSE-TEMPLATES-DE.md)

DeepTalk **workflow ③** 除 5 套 `de-*` 工整模板外，新增 **6 套政企内置大屏参考**（与 5173「数据大屏」卡片列表一致）。  
坐标、`styleConfig`（含背景图/毛玻璃/边框）均来自平台内置模板，供 Agent **对齐真实交付视觉**。

## 何时用哪套

| 目标 | 选用 |
|------|------|
| Agent 快速搭骨架、槽位类型清晰 | `de-classic-cockpit` 等 **`de-*`**（见 COMPOSE-TEMPLATES-DE） |
| 对齐截图/政企内置大屏（生态环境、智慧城市…） | 本页 **`gov-*`** |
| 5173 UI「从模板创建」+ 官方 demo SQL | `platformTemplateKey`（如 `builtin-gov-eco-monitor`） |

## 推荐模板（数据大屏 · 1920×1080）

| template id | 5173 名称 | 结构要点 | platformTemplateKey |
|-------------|-----------|----------|---------------------|
| **`gov-eco-monitor`** | 生态环境监测大屏 | 3D 地图底 + 仪表/柱/词云/玫瑰饼/散点/圆堆 | `builtin-gov-eco-monitor` |
| **`gov-industrial-park`** | 工业园区数据监控中心 | 顶栏标题 + 五图（条/堆条/饼/柱线组合/柱） | `builtin-gov-industrial-park` |
| **`gov-smart-city`** | 智慧城市运行监测 | 深色 HUD · 四 KPI + 地图态势 + 底宽表 | `builtin-gov-smart-city` |
| **`gov-digital-cockpit`** | 数字政府 KPI 驾驶舱 | 浅色纸纹 · 面积/仪表/树图/表/K 线 | `builtin-gov-digital-cockpit` |
| **`gov-emergency-command`** | 应急指挥调度中心 | 深色指挥底 · 地图中枢 + 告警带 | `builtin-gov-emergency-command` |
| **`gov-community`** | 社区治理一张图 | 薰衣草卡片 · 表/词云/柱/仪表/象限 | `builtin-gov-community` |

清单：`vitalspan_list_layout_templates` · `assets/layout-templates/index.json` 的 **`recommendedGovDataScreen`**。

> 列表里的 **「DE KPI 流向墙」** 用户实例对应 compose 模板 **`de-kpi-flow-wall`**（DE 工整系列，非 `gov-*`）。

## Agent 最小调用

```
vitalspan_compose_dashboard
  surface_kind=data-screen
  template=gov-eco-monitor
  name=生态环境监测大屏
```

可选：

- `chart_types=` — 覆盖槽位默认类型（顺序与模板 chart 槽一致；见 JSON `slots[].defaultChartType`）
- `artifact_ids=` — 填入 customViz 槽（当前 6 套均为纯内置图）

## 与 `de-*` / 5173 内置的关系

| 项 | `gov-*` compose | `de-*` compose | 5173 内置模板 |
|----|-----------------|----------------|---------------|
| 坐标来源 | 内置 layout 导出 | 手工 DE 槽位 | 同 `gov-*` 源文件 |
| 背景/装饰 | **完整** `styleConfig`（含 SVG 底图） | 渐变 + 边框 preset | 同左 |
| 顶栏 | 平台富文本标题 + 时钟（`shell.mode=platform`） | compose 自动 title+clock | 同左 |
| 维护 | `export-gov-compose-templates.py` | `generate-layout-templates.py` | `sync-dashboards-to-templates.py` |

`composeHints.preserveCoordinates=true`：**勿**对 `gov-*` 再叠加 DE 壳层 88px 偏移。

## 维护（研发）

```bat
REM 1. 5173 编辑内置大屏后，同步 layout 真源
python scripts\sync-dashboards-to-templates.py

REM 2. 导出 DeepTalk compose 参考 JSON + 刷新 index
python docs\api\vs-ai-spec\tools\export-gov-compose-templates.py --rebuild-index

REM 3. 同步桌面包（若已接 sync-vs-ai-spec-pack.ps1）
powershell -File scripts\sync-vs-ai-spec-pack.ps1
```

返回：[COMPOSE-TEMPLATES-DE.md](./COMPOSE-TEMPLATES-DE.md) · [START-HERE.md](../START-HERE.md)
