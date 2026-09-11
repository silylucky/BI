# VitalSpan × DeepTalk 联调备忘

**👉 铁律：[IRON-RULES.md](./IRON-RULES.md)** · **身份：[PACK-IDENTITY.md](./PACK-IDENTITY.md)**  
**👉 总入口：[START-HERE.md](./START-HERE.md)** · **DeepTalk 提示词：[DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md)**  
**👉 DeepTalk 产品仓：[deeptalk-product/README.md](./deeptalk-product/README.md)**

**先读 [00-REQUIREMENTS.md §0](./00-REQUIREMENTS.md#0-集成项目与平台落点)**（集成项目目录 ≠ 平台落点；**只认各路径 HTTP 完成标志**）。

| 集成项目（DeepTalk 工作区） | 平台落点 |
|---------------------------|----------|
| 本目录：文档、`examples/`、`tools/` | 写进本目录任意路径 ≠ 已入库 |
| `tools/publish-ai-viz-artifact.py` | 必须执行（或等价 POST/PUT） |
| 入库/更新/删除 | `POST/PUT/DELETE .../ai-viz/artifacts` → 库表 `ai_viz_artifacts` |

下文是环境占位与误读对照。

## 环境（由 VitalSpan 方口头提供，勿把密钥写进仓库）

| 项 | 说明 |
|----|------|
| API 根 | `{API}`，例如 `http://127.0.0.1:8000/api/v1` |
| 前端 | `{FE}`，例如 `http://127.0.0.1:5173/admin` |
| 鉴权 | `Authorization: Bearer {JWT}`，写接口需要 `dashboard:edit` |
| 测哪张大屏 | 由 VitalSpan 指定一条已有看板/大屏 URL |

业务表数据**不要** POST 给我们。只交组件源码；行数据由用户在 VitalSpan 绑 Dataset 后平台 `query/execute` 注入。

## 它传什么

`POST {API}/ai-viz/artifacts`

```json
{
  "manifest": { "id": "...", "displayName": "...", "runtime": "html|d3", "fieldSlots": {}, "styleSchema": {}, "defaultStyle": {}, "entry": "index.html" },
  "files": { "index.html": "<!DOCTYPE html>..." }
}
```

成功 **201**：`{ "artifactId": "<uuid>", "manifest": {}, "status": "...", "contentHash": "..." }`

同一组件更新：`PUT {API}/ai-viz/artifacts/{artifactId}`，body 同上。  
属主删除：`DELETE {API}/ai-viz/artifacts/{artifactId}` → 204。

工作流 ② **结束于 `artifactId`**。上大屏走工作流 ③ `upload-dashboard-layout.py`（填 `customVizConfig.artifactId`）。

## 组件脚本怎么读数（平台注入，不是 DeepTalk 推数）

挂载后宿主上有 `host.vsCv`（完整 SLA 见 [guides/PLATFORM-SLA.md](./guides/PLATFORM-SLA.md)）：

- **`mount(renderFn)`**（**d3 入库必须**）：payload / layout 变化时 Base 自动调用 render
- `getPayload()` / `onPayload(fn)`：Payload v1（`bindingStatus`、`columns`、`rows`、`style`、`layout`、`axisPlan`…）
- `onLayout(fn)`：兼容旧写法；新制品请用 `mount`
- `helpers.thinCategoryTickIndices` / `helpers.measureHost`
- `d3`：平台 d3@7.9.0，**禁止**把 d3 整库打进 `files`

推荐写法：

```js
host.vsCv.mount(function (p) {
  if (!p) return;
  var w = (p.layout && p.layout.width) || 320;
  var ticks = (p.axisPlan && p.axisPlan.categoryTickIndices)
    || host.vsCv.helpers.thinCategoryTickIndices(p.rows.length, w - 56, 56);
  // …按 bindingStatus 渲染…
});
```

## 路径决策（先读再写）

| 需求 | 路径 |
|------|------|
| 标准柱/线/表/地图 | **L1/L2 `chartConfig`**，**不要** customViz |
| KPI / DOM / 滚动 | L3 `runtime: html` + `mount` |
| 自定义 SVG/D3 | L3 `runtime: d3` + `mount` + 读 `axisPlan` |

见 [guides/RENDERERS.md](./guides/RENDERERS.md)。

## 一键试跑（把黄金样例打进去）

在本包根目录（与 `examples/` 同级）：

```bash
# 将 {API} {JWT} 换成联调环境
curl -sS -X POST "{API}/ai-viz/artifacts" ^
  -H "Authorization: Bearer {JWT}" ^
  -H "Content-Type: application/json" ^
  --data-binary "@examples/custom-viz-d3-bundle.json"
```

Linux/macOS 把 `^` 换成 `\`。

建议顺序：

1. `examples/custom-viz-bundle.json`（html）
2. `examples/custom-viz-d3-bundle.json`（平台 d3）
3. `examples/custom-viz-trend-line.json`（d3 动态趋势 · 读 `p.style`）
4. 可选：`custom-viz-pulse-kpi.json` / `ring-progress` / `alert-feed`

工作流 ② 完成 = 拿到 `artifactId`。上大屏见 [guides/DASHBOARD-LAYOUT.md](./guides/DASHBOARD-LAYOUT.md)。

**打开本地 `demo-*.html` 或把文件写到桌面 ≠ 已上传。** 必须对正在运行的 VitalSpan 发 HTTP。本机示例：

```bash
python tools/publish-ai-viz-artifact.py --file examples/custom-viz-d3-bundle.json
```

默认 `http://127.0.0.1:8000/api/v1`，账号 `admin`，密码环境变量 `VITALSPAN_DEV_ADMIN_PASSWORD`。

**必须服务端或本机脚本 POST。** DeepTalk 网页若从别的 origin `fetch` VitalSpan，会被 CORS 拦住；不要把「浏览器跨域失败」当成平台坏了。

DeepTalk 若产出 `runtime: vanilla`、`.iife.js`、`dataSchema` / `eventSchema`，**本平台会拒收**。必须是本包 `examples/custom-viz-*.json` 那种 `{ "manifest", "files": { "index.html": "..." } }`。

## 验收（对方 + VitalSpan 各看一眼）

| 步骤 | 应看到 |
|------|--------|
| 未绑 Dataset | 「请在右侧绑定数据集与字段」，不是空白卡死 |
| 绑字段并刷新 | `bindingStatus=bound`，html/d3 出图 |
| 同一 ID `PUT` 新 HTML | 切回页签或硬刷新后是新画面 |
| 失败 | HTTP 与 JSON `{ code, message, detail }`，例如超 2MB → 413 `AIVIZ_BUNDLE_TOO_LARGE`；d3 无 `vsCv.mount` → 422 `AIVIZ_MOUNT_REQUIRED` |

## 红线

- 禁止 `<script src="http...">`、inline `onclick=`
- 禁止内联 d3 整库（单文件 ≥200KB 且含 `d3.version`）
- 整包 ≤ 2MB（不含平台 d3）
- 不要 ECharts / AntV；标准柱线饼走 L1/L2 `chartConfig`（见 `README.md`）
- 不要 L3 内嵌地图 SDK / 在线瓦片

## 建议阅读顺序

1. [IRON-RULES.md](./IRON-RULES.md)  
2. [START-HERE.md](./START-HERE.md)  
3. [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md)  
4. [DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md)  
5. `guides/PLATFORM-SLA.md` · `PROTOCOL.md`  
6. `examples/` · `theme-tokens.json`

## 不要按别的规范误读

| 误读 | 本包事实 |
|------|----------|
| 「这是 VitalSpan 自定义可视化**组件项目目录**」 | **DeepTalk 集成项目**；真系统在 `:8000` API + `:5173` 前端；见 [PACK-IDENTITY.md](./PACK-IDENTITY.md) |
| L3 有 vanilla / react / webgl / three | **只有 `html` 与 `d3`**。`html` = 内联 DOM/CSS/SVG/Canvas，不是 React 运行时 |
| capability-manifest 里 `library: react` | 那是**内置 chartType** 的实现标注，不是 customViz runtime |
| 缺 WebGL 示例 | **不提供**该 runtime，无需补示例 |
| `HANDOFF.md` 有 TODO | 本文件无未完成 TODO；勿把第三方清单写回本包 |
| `layout-v2.schema.json` | 主文件是 `schemas/layout.schema.json`；包内另有同内容别名 |

不提供独立 CHANGELOG/LICENSE/CONTRIBUTING（内部规范包，非开源发行）。版本记录见仓库 `docs/api/README.md` 修订表。
