# Layout Rhythm Contract（LRC）— wf3 布局契约

> **铁律** → [IRON-RULES.md](../IRON-RULES.md) · **layoutJson** → [DASHBOARD-LAYOUT.md](./DASHBOARD-LAYOUT.md)  
> **legacy 成品模板** → [COMPOSE-TEMPLATES-DE.md](./COMPOSE-TEMPLATES-DE.md)（**仅参考做法**，非 wf3 默认审美）

## 定位

| 概念 | 是什么 | 不是什么 |
|------|--------|----------|
| **Rhythm（节律契约）** | 分区语法：bands、maxItems、margin/gutter、画布尺寸 | 成品配色 / DE 壳层 / 固定 8 槽审美 |
| **Blocks（本屏块清单）** | 本屏放什么：cv / chart、占哪个 band | 选 `de-sales-command` 抄一整屏 |
| **Compose** | `rhythm` + `blocks` → **拓扑骨架** | 最终视觉稿 |
| **Agent upload patch** | 间隙、背景、色、x/y/w/h | 模板 JSON 里的 styleConfig |

## 工具

```
vitalspan_list_layout_rhythms
vitalspan_compose_dashboard
  surface_kind=data-screen
  rhythm=rhythm-cv-stage
  blocks=[{"band":"primary","kind":"customViz","artifactId":"<uuid>","title":"趋势"},...]
  name=综合运营驾驶舱
  data_binding=manual
vitalspan_get_dashboard_layout → patch → vitalspan_upload_dashboard
```

## 绑数

- **wf3 默认 always `manual`** — customViz **不**自动绑演示 Dataset；用户在 5173 手绑。
- 内置 chart 亦默认 manual；**不**为「打开就能看」擅自改 demo。

## compose 失败与 orphan

1. **先校验 blocks**（band maxItems），再 POST 建屏。
2. layout 写入失败 → 插件 **DELETE 刚建的空大屏**（stdout 含 `rolled back orphan dashboardId=`）。
3. 重试须 **`dashboard_id=`**，禁止反复新建同名空屏。

## 首批 rhythm（通用，非行业）

| id | band 容量（要点） |
|----|-------------------|
| `rhythm-cv-stage` | 无 metrics；primary ≤2 cv；secondary ≤2 |
| `rhythm-hero-stack` | metrics ≤4；primary ≤2；secondary ≤2；footer ≤1 |
| `rhythm-split-focus` | sidebar ≤3；main ≤1 |
| `rhythm-balanced-grid` | grid ≤4 chart |
| `rhythm-minimal` | dashboard 1440；primary + optional secondary |

## Agent SOP（wf3 默认）

1. 故事线 → **blocks**（对照上表 maxItems）
2. `list_layout_rhythms` + `list_artifacts`
3. `compose_dashboard` rhythm + blocks + **`manual`**
4. **`get` → patch 审美（styleConfig + 几何）→ `upload`**
5. `completion_gate workflow=3`（声称改色/布局 → upload stdout）

**禁止** wf3 默认 `template=de-*`（legacy + gate 拒绝）。

## legacy template=

仍可用但 stdout 含 `[warn] LEGACY_TEMPLATE`。仅兼容旧脚本。

返回：[COMPOSE-STYLE-WORKFLOW.md](./COMPOSE-STYLE-WORKFLOW.md)
