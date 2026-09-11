# 规范要求（L3 customViz · 工作流 ② 必读）

> **铁律** → [IRON-RULES.md](./IRON-RULES.md) · **工程定位** → [PACK-IDENTITY.md](./PACK-IDENTITY.md)  
> 打开集成项目后**先读 [START-HERE.md](./START-HERE.md)**，再读本文件（L3 细则）。不满足下列任一条 = 未对接成功。

> **DeepTalk 集成 Agent**：交付完成**只认 `artifactId`**。只 `write_file` 到本目录、桌面、`examples/`、`output/` 等任意路径 = **未完成**。必读 [§0](#0-集成项目与平台落点) 与 [EXTERNAL-AUTHOR.md](./EXTERNAL-AUTHOR.md)。

## 0. 集成项目与平台落点

本目录（`vs-ai-spec-deeptalk-test`）是 **DeepTalk × VitalSpan 正式集成项目**，不是 VitalSpan 服务端本身。

| 你拿到/操作的东西 | 它是什么 | 算不算「已上传 VitalSpan」 |
|------------------|----------|---------------------------|
| 本集成项目整个目录 | 文档 + 金样 + `tools/` 脚本 | **否** |
| `examples/你的组件.json` | 本地草稿（磁盘文件） | **否** |
| 自建的 `output/`、`dist/` 等目录里的 JSON | **规范未定义**；禁止当作交付路径 | **否** |
| DeepTalk `write_file` / VS Code 保存 | 只改了本机文件 | **否** |
| 「可在 VS Code AI 扩展中使用」 | **不存在此完成标准** | **否** |
| `POST /api/v1/ai-viz/artifacts` 返回的 **`artifactId`** | 平台元库里的组件 uuid | **是（唯一完成标志）** |

**上传目的地（入库端点）只有一个**——正在运行的 VitalSpan 后端：

```
POST http://127.0.0.1:8000/api/v1/ai-viz/artifacts
Authorization: Bearer <JWT>
Content-Type: application/json
Body: { "manifest": { ... }, "files": { "index.html": "<字符串>" } }
```

- 数据落在平台数据库 **`ai_viz_artifacts`**（外部作者不直接访问该表）
- 成功：**HTTP 201**，响应 JSON 含 **`artifactId`**
- 更新：`PUT /api/v1/ai-viz/artifacts/{artifactId}`

**怎样才算做完（必须满足其一，并能把 uuid 报给用户）：**

1. 在本集成项目根目录执行  
   `python tools\publish-ai-viz-artifact.py --file <你的.json>`  
   终端出现 **`ok artifactId=<uuid>`**
2. 自行 POST 上述 URL，拿到 **201 + `artifactId`**

**没有 `artifactId` = 未对接成功。** 禁止向用户声称「已上传」「已传过去」「已完成」。

推荐流程：`publish-ai-viz-artifact.py`（内置 preflight）→ **`ok artifactId=...`**。详见 [EXTERNAL-AUTHOR.md](./EXTERNAL-AUTHOR.md)。

## 1. 完成定义

必须对 **正在运行的 VitalSpan** 发出 HTTP，并拿到 `artifactId`。

```
POST {API}/ai-viz/artifacts
Authorization: Bearer {JWT}
Content-Type: application/json
```

- `{API}` 本机：`http://127.0.0.1:8000/api/v1`（服务要先启动）
- 成功：**201** + JSON 含 `artifactId`
- 更新：同一 id 再 `PUT {API}/ai-viz/artifacts/{artifactId}`

下列**全部不算完成**：

- 只把 HTML/JSON 写到操作者桌面、`examples/`、**`output/`** 或规范包内任意路径
- 使用 DeepTalk **`write_file`**、VS Code 保存、或声称「文件已保存在工作区」
- 声称「可在 VS Code AI 扩展中使用」——**规范无此路径**
- `files.index.html` 写成 `{ "content": "..." }` 对象（必须是 **字符串**）
- bundle 内用 `postMessage` / `payload.data`（DeepTalk 协议），未接 `vsCv.mount` + `payload.rows`
- 用浏览器打开 `demo-*.html`
- 产出 `runtime: vanilla` / React / WebGL / `.iife.js` / 外链打包

## 2. 请求体形状（唯一合法）

与 `examples/custom-viz-d3-bundle.json` 相同层级：

```json
{
  "manifest": {
    "id": "my-widget-v1",
    "displayName": "名称",
    "version": "1.0.0",
    "entry": "index.html",
    "runtime": "html",
    "fieldSlots": {
      "dimensions": { "min": 1, "max": 1, "label": "类别" },
      "metrics": { "min": 1, "max": 1, "label": "数值" }
    },
    "styleSchema": {
      "type": "object",
      "properties": { "accentColor": { "type": "string", "format": "color" } }
    },
    "defaultStyle": { "accentColor": "#465fff" }
  },
  "files": {
    "index.html": "<!DOCTYPE html><html>…内联 style 与 script…</html>"
  }
}
```

| 必填 | 规则 |
|------|------|
| `manifest.runtime` | 仅 `html` 或 `d3` |
| d3 入口脚本 | 必须含 `host.vsCv.mount(`，否则 **422** `AIVIZ_MOUNT_REQUIRED` |
| `manifest.entry` | 必须是 `index.html` 且出现在 `files` |
| `files` | 仅 `.html` / `.css` / `.svg`；脚本须写在 HTML 内联 `<script>` |
| `fieldSlots` | dimensions、metrics 的 `min >= 1` |
| `styleSchema.properties` | 至少 1 个样式键 |
| 体积 | 整包 ≤ 2MB；禁止内联 d3 整库 |

## 3. 画图怎么读数

平台注入 `host.vsCv`（见 [guides/PLATFORM-SLA.md](./guides/PLATFORM-SLA.md) · `PROTOCOL.md`）：

- **必须** `host.vsCv.mount(renderFn)`（d3 入库 lint；html 强烈推荐）
- 读 `payload.layout` / `payload.axisPlan.categoryTickIndices`
- **不要**自己定义 `dataSchema`、`eventSchema`、向 VitalSpan 推业务行

未绑数：`bindingStatus === "unbound"`，显示「请在右侧绑定数据集与字段」。

## 4. 路径决策

| 要做的事 | 用什么 |
|----------|--------|
| 标准柱/线/表/地图 | L1/L2 `chartConfig`（**不是** customViz） |
| KPI / DOM / 滚动 | L3 `runtime: html` |
| 自定义 D3/SVG | L3 `runtime: d3` |

## 5. 本机怎么传（Windows）

外部 AI 三步见 [EXTERNAL-AUTHOR.md](./EXTERNAL-AUTHOR.md)。摘要：

1. 后端：`uvicorn` 监听 8000（`GET http://127.0.0.1:8000/health` 要通）
2. **先校验**（与 API 相同 lint，422 前拦截）：

```bat
python tools\validate-ai-viz-bundle.py --file examples\你的组件.json
```

3. **再入库**（`write_file` 到桌面不算完成）：

```bat
python tools\upload-ai-viz-artifact.py --file examples\你的组件.json
```

仅校验、不 POST：`upload-ai-viz-artifact.py --validate-only`（或单独跑 validate 脚本）。

默认金样例 `examples/custom-viz-d3-bundle.json`。账号默认 `admin`，密码 `VITALSPAN_DEV_ADMIN_PASSWORD`（未设则 `changeme`）。  
成功须打印 `artifactId=<uuid>` 与 `styleComplianceTier`；将该 uuid 填进大屏 `customVizConfig.artifactId`。

## 6. 拒收示例（不要生成）

- `runtime: "vanilla"` / `"react"` / `"webgl"`
- `"entry": "dist/realtime-chart.iife.js"`
- 顶层 `dataSchema`、`eventSchema`、`authors` 当主契约
- `<script src="https://cdn...">`

黄金样例：`custom-viz-trend-line.json`、`custom-viz-bundle.json`、`custom-viz-d3-bundle.json`、`custom-viz-ranking-bar-medal.json`，以及 pulse / ring / alert。

## 7. 怎么发 HTTP（不要用 DeepTalk 网页跨域 fetch）

必须从 **DeepTalk 服务端** 或本机脚本 POST（`tools/upload-ai-viz-artifact.py` / `curl`）。

浏览器里从 DeepTalk 自己的域名去打 VitalSpan，会被 CORS 拦住（平台 `CORS_ORIGINS` 默认只放行本机前端）。**打开本地 html、把文件写到桌面，都不算上传。**

联调若必须浏览器直打，由 VitalSpan 把 DeepTalk 源站加入 `CORS_ORIGINS`，不要改组件契约。

