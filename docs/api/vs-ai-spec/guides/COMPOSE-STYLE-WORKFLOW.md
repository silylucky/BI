# Compose + 样式补丁工作流（工作流 ③）

> **铁律** → [IRON-RULES.md](../IRON-RULES.md) · **LRC 默认** → [LAYOUT-RHYTHM-CONTRACT.md](./LAYOUT-RHYTHM-CONTRACT.md)  
> **legacy 成品模板** → [COMPOSE-TEMPLATES-DE.md](./COMPOSE-TEMPLATES-DE.md)（参考金样，非 wf3 默认）  
> **插件工具**：`vitalspan_list_layout_rhythms` · `vitalspan_compose_dashboard` ·（按需）`get` → patch → `upload`

## wf3 默认：rhythm + blocks（LRC 骨架 → Agent 审美）

模板 **不是**抄 DataEase 成品；**rhythm** 只定 band 拓扑，**视觉由 DeepTalk patch**。

| 步骤 | Agent 须想清 |
|------|----------------|
| 故事线 | 看谁 · 一屏答哪 3～5 问 |
| blocks | 每个块：`band` + `kind` + `artifactId`/`chartType`；**先对照 band maxItems** |
| rhythm | `list_layout_rhythms` 选型 |
| 绑数 | **始终 `manual`**（customViz 不自动 demo） |
| 审美 | compose 后 **get → patch styleConfig + x/y/w/h → upload** |

**禁止** wf3 默认 `template=de-*`。compose 失败会自动删 orphan 空屏；重试用 `dashboard_id=`。

## 三条路径

| 路径 | 何时 | 步骤 |
|------|------|------|
| **标准路径（wf3 默认）** | rhythm 拼屏 | `compose` 骨架 → **`get` → patch 审美/几何 → `upload`** → gate |
| **仅骨架交付** | 用户只要占位 | `compose` → gate（不得声称配色/布局已定） |
| **legacy template** | 兼容旧脚本 | `template=` → gate **拒绝** |

## 原则

| 阶段 | 谁做 | 改什么 |
|------|------|--------|
| **① compose** | 插件 | `rhythm` + `blocks` → 生成坐标与 widget 拓扑 |
| **② get** | 插件 | 拉回 `layoutJson`（**慢路径**） |
| **③ patch** | Agent | **A** 只改样式 · **B** 改标题/删 widget/坐标（整文件 write） |
| **④ upload** | 插件 | `editor-save` 写回同一 `dashboardId` |

慢路径 A **禁止**改 `x/y/width/height`。慢路径 B 仅在叙事需要时改布局。

## 绑数

| 用户意思 | compose 参数 |
|----------|----------------|
| 演示 / 预览 / 能看 | `data_binding=demo` |
| 正式 / 未提 | `manual`（默认） |

## 快路径示例（2 个已有 customViz）

```
vitalspan_list_layout_rhythms
vitalspan_compose_dashboard
  surface_kind=data-screen
  rhythm=rhythm-cv-stage
  blocks=[{"band":"primary","kind":"customViz","artifactId":"<uuid1>","title":"趋势"},{"band":"secondary","kind":"customViz","artifactId":"<uuid2>","title":"排名"}]
  name=综合运营驾驶舱
  data_binding=manual
```

stdout 须含 `rhythm=rhythm-cv-stage` · `kpi=0` · `ok dashboardId=` → `completion_gate workflow=3`。

## legacy template=（兼容 · 非默认）

```
vitalspan_compose_dashboard
  surface_kind=data-screen
  template=de-classic-cockpit
  ...
```

stdout 含 `[warn] LEGACY_TEMPLATE` — **completion_gate 会拒绝**，仅旧脚本兼容。

## 慢路径 A — 样式

### 1. compose（rhythm+blocks 同上）

### 2. 导出 layout

```
vitalspan_get_dashboard_layout
  dashboard_id=<uuid>
  file=examples/my-screen.json
```

**get 的 stdout 不是 wf3 完成证据** — 不能传给 completion_gate。

### 3. 只改样式层

| 层级 | JSON 路径 |
|------|-----------|
| 整屏 | `layoutJson.styleConfig` |
| 内置图 | `widgets[].chartConfig.nativeBody.deStyle` |
| customViz | `widgets[].customVizConfig.style` / `displayStyle` / `widgetStyle` |

### 4. 写回

```
vitalspan_upload_dashboard
  dashboard_id=<uuid>
  file=examples/my-screen.json
```

`completion_gate` 须用 **upload** 的 stdout（用户声称改风格时）。upload 路径不要求 stdout 含 `rhythm=`。

## 慢路径 B — 叙事/布局

当 compose 块数与故事线不一致，或占位标题须改成业务名时：

1. `get_dashboard_layout` 同上
2. **整文件 write**：改 `widgets[].title` · 从 `layoutJson.widgets` **删除**多余项 · 按需改 `x/y/width/height`
3. `upload_dashboard` → gate 用 upload stdout（声称「布局/摆放已优化」时必须）

## compose 自动样式（v0.2.15+）

按槽位高度写入 `deStyle`（隐藏重复标题、KPI 缩放、小槽隐藏图例等）。rhythm 路径下 KPI 数量由 **blocks** 决定，非模板默认。

## 数据说明

- `demo`：内置图绑官方演示 Dataset（走查）；须 sample-mysql + seed
- `manual`：5173 手绑 Dataset
- customViz：layout 只引用 `artifactId`；实例样式走 `customVizConfig`

返回：[LAYOUT-RHYTHM-CONTRACT.md](./LAYOUT-RHYTHM-CONTRACT.md) · [START-HERE.md](../START-HERE.md)
