# DeepTalk × VitalSpan 一体集成铁律

> **会话/Agent 必读** · 与 [PACK-IDENTITY.md](./PACK-IDENTITY.md) · [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md) 配套  
> Cursor 规则：`.cursor/rules/deeptalk-vitalspan-integration.mdc`

## 1. 一体模型（产品铁律）

`vs-ai-spec-deeptalk-test` 是 **VitalSpan × DeepTalk 正式集成项目**，不是与 VitalSpan 无关的「外部手册包」。

| 谁 | 做什么 |
|----|--------|
| **DeepTalk 项目**（本目录 / 桌面包） | 写 customViz bundle、写大屏 layout、执行 validate + upload 脚本 |
| **VitalSpan 平台**（`:8000` + `:5173` + 元库） | 提供组件库 API、大屏保存、CustomViz 渲染、样式/数据注入、preflight、鉴权 |

```
DeepTalk 集成项目  ──HTTP──►  VitalSpan 平台能力
  写组件 / 拼大屏              入库 / 渲染 / 编辑
```

**用户心智**：在 DeepTalk 里做 BI，结果在 VitalSpan 里能拖、能改、能保存。  
**工程事实**：中间必须经过 HTTP；「一体」= Agent **默认跑完** upload/save，不是「写文件即同步」。

## 2. 三条工作流（不可混）

| 线 | 何时 | 完成证据 | 禁止 |
|----|------|----------|------|
| **② 组件库** | 开发**新** html/d3 组件 | **`artifactId=<uuid>`** | 同任务拼大屏；write_file 当完成 |
| **③ 大屏** | 编排 layout | **`dashboardId`** + editor-save | 写组件 HTML；内联 bundle |
| **① 内置图** | 标准 chartType | `/charts/validate` 200 | 走 customViz 入库 |

详见 [THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md)。

## 3. 交付铁律

| 规则 | 说明 |
|------|------|
| **无 uuid 不算完成** | ② 无 `artifactId`、③ 无 `dashboardId` → 禁止向用户说「已上传/已对接/已完成」 |
| **本地文件是草稿** | `examples/`、`write_file`、`output/` 均 ≠ 平台持久化 |
| **② 固定链路** | `validate-ai-viz-bundle.py` → `upload-ai-viz-artifact.py` → `ok artifactId=...` |
| **③ 固定链路** | `upload-dashboard-layout.py --dashboard-id ...` → 报 `dashboardId` |
| **HTTP 真源** | `POST/PUT http://127.0.0.1:8000/api/v1/...`（Bearer JWT） |

## 4. 组件实现铁律

| 规则 | 说明 |
|------|------|
| **读 `payload.style`** | `var st = (p && p.style) || {}`；禁止依赖不存在的 `vsCv.getStyle()` / `.vs-cv-style` |
| **读 `payload.layout`** | render 内按 `p.layout.width/height` 缩放；拖 widget 须跟着变 |
| **溢出滚动** | 内容多于可视区 → 组件内滚动；容器小 → 能展示多少就多少；禁固定 px 无视 resize |
| **勿重复平台配置** | 禁 styleSchema 声明 `maxItems`/`refreshMode`/六块键等；数据 Tab「结果展示」→ 用 `payload.rows` |
| **d3 必须 mount** | `host.vsCv.mount(function (p) { ... })` |
| **样式合规** | 引用 `p.style` 或 CSS `--vs-style-*` / `--vs-palette-*`；金样见 `examples/custom-viz-*.json` |
| **六块 chrome** | 标题/卡片背景由平台 `CustomVizWidget` 负责，bundle 不自画标题栏 |

## 5. 组件库与金样

| 项 | 铁律 |
|----|------|
| 图表盘「自定义」 | **仅** `GET /api/v1/ai-viz/artifacts`（DB `ai_viz_artifacts`），按 `owner_user_id` 隔离 |
| 官方 `examples/` | **参考金样** + preflight/CI；**禁止 Agent 整包 scaffold**；须 upload 后才出现在图表盘 |
| 平台无自动 seed | 图表盘「自定义」仅来自 DB；官方 `examples/` 须 publish 后才进库 |
| 属主 DELETE | `DELETE /api/v1/ai-viz/artifacts/{id}` · CLI `delete-ai-viz-artifact.py` · 5173 图表盘移除按钮 |

## 6. 禁止说法（验收判错）

- 「这是 VitalSpan 组件**源码项目**」→ 错；是 **DeepTalk 集成项目**，源码在 `VitalSpan/fe`、`VitalSpan/backend`
- 「规范包与 VitalSpan 无关」→ 错；是 **唯一正式对接入口**
- 「output/ 已交付」→ 错；必须 **`artifactId`**
- 「DeepTalk 会自动打通平台」→ 错；**必须执行 upload 脚本**（一体 = 流程默认包含 upload，不是魔法同步）

## 7. 联调路径

| 项 | 值 |
|----|-----|
| **产品对接（定论）** | 安装 **vitalspan 插件 zip** + 可选 **VitalSpan BI 特殊工作区** → [deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md](./deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md) |
| 插件源码 | `deeptalk-plugins/plugins/vitalspan/` → `npm run release` |
| 桌面包 MVP | `vs-ai-spec-deeptalk-test`（`scripts/sync-vs-ai-spec-pack.ps1`） |
| 开发备用 sync | `integrations/vitalspan/`（`scripts/sync-vs-ai-spec-to-deeptalk-repo.ps1` · `tools/*.py` · CI） |
| 产品 Agent 提示词 | [deeptalk-product/COMPLIANCE-BOOTSTRAP.md](./deeptalk-product/COMPLIANCE-BOOTSTRAP.md)（v0.5.0；专家 prompt 由 DeepTalk 配置） |
| 旧 Agent 提示词跳转 | [deeptalk-product/AGENT-SYSTEM-PROMPT.md](./deeptalk-product/AGENT-SYSTEM-PROMPT.md) |
| DeepTalk 提示词（简） | [DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md) |
| 仓内真源 | `docs/api/vs-ai-spec/` |

**5173 验收不变**：wf2/wf3 完成证据仍为 `artifactId` / `dashboardId`；工作区 iframe 只做连接与跳转，不重做完整 BI 编辑器。
