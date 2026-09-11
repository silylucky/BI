# customViz 样式合规（STYLE-COMPLIANCE）

> 与 [PLATFORM-SLA.md](./PLATFORM-SLA.md) · [STYLE-SCHEMA.md](./STYLE-SCHEMA.md) · [PROTOCOL.md](../PROTOCOL.md) 配套  
> **Phase 1**：warn 入库，不 422 硬拦（除既有安全/mount 硬规则）

## 责任分界

| 层 | 谁负责 | 集成项目 Agent 要做什么 |
|----|--------|------------------|
| **六块 chrome** | 平台 `CustomVizWidget` + `displayStyle` | **不要**在 bundle 里重复画标题/卡片背景 |
| **看板继承** | 平台注入 `--dashboard-*` · `--vs-palette-*` | 条内主题色读变量，勿写死 `#hex` |
| **schema 扩展项** | 平台生成检查器 → `payload.style` | `render` 内读 `p.style` / CSS 变量 |
| **生命周期** | 平台 `vsCv.mount` 调度 | 注册 `host.vsCv.mount(fn)`，少用手写 `onLayout` 双轨 |

平台保证：**送对** `payload.style`、外壳、layout、axisPlan。  
bundle 保证：**读出来**画进 DOM/SVG。

## 合规清单（入库 warn）

POST/PUT `/api/v1/ai-viz/artifacts` 成功仍返回 `warnings[]`（不阻断入库）：

| code | 条件 | 含义 |
|------|------|------|
| `AIVIZ_WARN_MOUNT_RECOMMENDED` | `runtime=html` 且 entry 无 `vsCv.mount` | resize/样式更新可能不稳定 |
| `AIVIZ_WARN_STYLE_COMPLIANCE` | 全 bundle 未引用 `payload.style` / `p.style` **且** 无 `--vs-style-*` / `--vs-palette-*` | 样式面板与看板配色可能不生效 |
| `AIVIZ_WARN_LAYOUT_FALLBACK` | 仅 `clientWidth \|\| 320` 且无 `payload.layout` | 拖放 resize 可能留白 |
| `AIVIZ_WARN_PLATFORM_DUPLICATE_STYLE` | styleSchema 声明 `maxItems`/`refreshMode`/六块键等与平台检查器重复 | 删 schema 项；条数用数据 Tab「结果展示」→ `payload.rows` |
| `AIVIZ_WARN_PLATFORM_STYLE_KEYS` | 读了 `p.style` 但未消费六块键或 `--vs-palette-*` | 用 scaffold 壳层 `resolveStyle`（见 BUNDLE-BOILERPLATE §7） |
| `AIVIZ_WARN_DOM_HOST_LOOKUP` | entry 含 `(host\|\|document).getElementById` | 宿主 div 上无效，预览可能空白 |
| `AIVIZ_WARN_DOM_DOCUMENT_LOOKUP` | entry 含 `document.getElementById` | 多实例抢节点 |

**仍为 422（硬规则，不变）**：d3 无 `vsCv.mount`、禁 `id="root"`/`id="app"`、外链 script、内联 d3 整库等 — 见 [PLATFORM-SLA.md §入库 lint](./PLATFORM-SLA.md#入库-lintpostput)。

## 最小合规模板（html）

```javascript
host.vsCv.mount(function (p) {
  var st = (p && p.style) || {};
  var host = document.currentScript && document.currentScript.parentElement;
  var root = host && host.querySelector("#vs-cv-root");
  if (root && st.accentColor) {
    root.style.setProperty("--vs-style-accent-color", String(st.accentColor));
  }
  // 读 p.layout 设定尺寸；读 p.rows / bindingStatus 画内容
});
```

CSS 侧优先：

```css
.fill {
  background: var(--vs-palette-0, var(--vs-style-accent-color, #3b82f6));
}
.lbl {
  color: var(--dashboard-text-primary, #e2e8f0);
}
```

## 反例（会 warn 或样式不跟面板）

| 反例 | 问题 |
|------|------|
| JS 写死 `background: "#f79009"` 作唯一主题色 | 改看板配色无效 |
| 只用 `onPayload`，不用 `mount` | 部分场景 layout/style 不同步 |
| 在 schema 重复声明 `backgroundShow` / `titleShow` | 与平台六块冲突，行为难预测 |
| bundle 自画标题栏 | 与 pixel/grid 外壳重复 |

## 官方参考金样

`docs/api/vs-ai-spec/examples/custom-viz-*.json` 须 **零 warnings**（CI 门禁）。Agent **起盘 generic-blank**；下列仅 **参考** fieldSlots/动画/数据接线（禁止整包 scaffold）：

- 排名条：`custom-viz-ranking-bar-medal.json`
- 动态趋势：`custom-viz-trend-line.json`
- KPI 卡片：`custom-viz-pulse-kpi.json` · `hex-kpi-grid.json`
- 环形进度：`custom-viz-ring-progress.json`

## API 响应

```json
{
  "artifactId": "…",
  "manifest": { },
  "status": "draft",
  "contentHash": "…",
  "warnings": [
    {
      "code": "AIVIZ_WARN_STYLE_COMPLIANCE",
      "message": "bundle 未引用 payload.style 或 --vs-style-* / --vs-palette-*，样式面板与看板配色可能不会生效"
    }
  ]
}
```

前端组件库/图表盘可展示 `warnings`，管理员上架前自检。

## 与 Style Bridge 的关系

`customVizStyleBridge` 对**已入库但不完全合规**的 bundle 做有限 DOM/CSS 兜底（配色/标签/提示/渐变等），**不能替代** bundle 正确读 `payload.style`。新制品应满足本清单；Bridge 是第二道保险，不是主路径。

## Phase 3：`manifest.styleHooks`（自愿声明）

在 `manifest` 中可选声明 **styleSchema 键 → DOM/CSS 映射**，平台据此生成 Hook Bridge（`vs-cv-style-hooks`），比纯猜 `.fill` 更准。

```json
{
  "styleSchema": {
    "properties": {
      "accentColor": { "type": "string", "format": "color" },
      "showRankBadge": { "type": "boolean" }
    }
  },
  "styleHooks": {
    "accentColor": {
      "selectors": [".fill", ".bar"],
      "property": "background"
    },
    "showRankBadge": {
      "hideWhenFalse": true,
      "hideSelectors": [".badge"]
    }
  }
}
```

| 字段 | 说明 |
|------|------|
| `selectors` | 宿主内 CSS 选择器列表 |
| `property` | `background` · `color` · `height` · `gap` · `font-size` · `opacity`（可省略，按键名推断） |
| `cssVar` | 可选，默认 `--vs-style-{kebab-key}` |
| `hideWhenFalse` + `hideSelectors` | 布尔 schema 项关断时隐藏 DOM |

**入库行为**

- hooks 键须在 `styleSchema.properties` 内，否则 `AIVIZ_WARN_STYLE_HOOK_UNKNOWN_KEY`
- 缺 `selectors` / `hideSelectors` → `AIVIZ_WARN_STYLE_HOOK_INVALID`
- **有效 hooks 可免除** `AIVIZ_WARN_STYLE_COMPLIANCE`（仍建议 bundle 读 `payload.style`）

**合规分级 `styleComplianceTier`**

| tier | 含义 |
|------|------|
| `full` | 无 warn；bundle 原生读变量/样式，或有效 `styleHooks` |
| `partial` | 有 warn（mount/layout/六块消费等），仍可用但样式可能不完整 |
| `visual-only` | 仍有 `AIVIZ_WARN_STYLE_COMPLIANCE` 或 hook 无效 |

**脚手架**：`node scripts/scaffold-custom-viz-html.mjs --out my-widget.json`（含 mount + hooks 示例）

**组件库预览**：Hub 卡片与编辑页共用 `vizComponentPreviewDashboardStyle()` + `CustomVizWidget` 路径，与看板 palette/chrome 一致。
