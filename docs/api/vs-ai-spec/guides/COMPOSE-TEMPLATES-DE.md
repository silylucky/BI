# Compose 大屏模板 · DataEase 工整参考（legacy）

> **wf3 默认已改为 LRC** → [LAYOUT-RHYTHM-CONTRACT.md](./LAYOUT-RHYTHM-CONTRACT.md) · **工作流** → [COMPOSE-STYLE-WORKFLOW.md](./COMPOSE-STYLE-WORKFLOW.md)  
> **铁律** → [IRON-RULES.md](../IRON-RULES.md)

> ⚠️ **legacy 参考金样**：下列 `de-*` / `gov-*` preset 仍可通过 `template=` compose，但 stdout 含 `[warn] LEGACY_TEMPLATE`，**completion_gate 会拒绝**。新任务须 `rhythm` + `blocks`。

DeepTalk **workflow ③** 拼大屏时，**不再**默认选用带 **`de-recommended`** 的成品模板；仅当兼容旧脚本或对照金样时使用本页 preset。

1. 插入 **顶栏标题 + 时钟**（对标 DataEase 大屏壳）
2. 按槽位 **`defaultChartType`** 填内置图（不必手传完整 `chart_types`）
3. customViz 槽无 `artifact_ids` 时 → **富文本占位**（不再留空带）

## 推荐模板（数据大屏 · 1920×1080）

| template id | 场景 | 结构 |
|-------------|------|------|
| **`de-classic-cockpit`** | legacy 金样 | 四 KPI + 线/饼/柱/地图 + AI 洞察带 |
| `de-sales-command` | 销售指挥 | 四 KPI + 宽趋势 + 饼/地图 + 明细表 |
| `de-balanced-four` | 最工整四象限 | 2×2 柱/线/饼/雷达 |
| `de-map-command` | 地理分析 | 居中大地图 + 侧栏 KPI/排名/占比 |
| `de-kpi-flow-wall` | 链路/流向 | 四 KPI + sankey + 四象限 |

清单：`vitalspan_list_layout_templates` · 索引 `assets/layout-templates/index.json` 的 `recommendedDataScreen`。

> **已移除**旧大屏 id（`gov-cockpit`、`kpi-flow-banner` 等 10 套无 DE 壳层模板）；请只用上表 **`de-*`**。  
> **5173 政企内置参考**（生态环境/智慧城市等 6 套）→ [COMPOSE-TEMPLATES-GOV.md](./COMPOSE-TEMPLATES-GOV.md) 的 **`gov-*`**。

## Agent 最小调用

```
vitalspan_compose_dashboard
  surface_kind=data-screen
  template=de-classic-cockpit
  name=数据分析驾驶舱
```

可选：

- `chart_types=` — **覆盖**槽位默认类型（顺序与模板 chart 槽一致）
- `artifact_ids=` — 填入 customViz 槽（如 AI 洞察）；不传则用占位文案

## 与 DataEase 内置模板的区别

| 项 | compose 模板 | 5173「从模板创建」 |
|----|--------------|-------------------|
| 入口 | DeepTalk Agent | 管理面 UI |
| 壳层 | compose 自动 title+clock | 平台 `presets.py` 含边框/背景图 |
| 数据 | 演示 Dataset | 官方 demo SQL |
| 改布局 | 换 `template=` 重 compose | 编辑器拖拽 |

要 **DE 官方种子级**视觉（边框装饰、专用 SQL）→ 5173 从 **`workspace-digital-cockpit`** 等平台模板创建；  
要 **Agent 一键可复现** → 用本页 **`de-*`** 模板。

## 样式微调

compose 后：`get_dashboard_layout` → 只 patch `styleConfig` / `deStyle` → `upload_dashboard`（勿改 x/y）。

返回：[DASHBOARD-LAYOUT.md](./DASHBOARD-LAYOUT.md)
