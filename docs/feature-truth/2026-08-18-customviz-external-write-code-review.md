# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-18

> **2026-08-18 续**：用户确认全部批次后已落地。P0 无；P1-1/2/3、P2-2 已改。P2-1 **未改响应 JSON 形状**（包 `{code,message}` 会破坏 DeepTalk），已在 `docs/api/README.md` 登记成功体例外。


## 总览

| 项 | 内容 |
|----|------|
| 范围 | **PR·变更面**：`backend/app/ai_viz/` · `backend/app/api/v1/ai_viz.py` · `fe/.../CustomViz*` · `fe/.../custom-viz/` · `docs/api/vs-ai-spec/` · `scripts/upload-ai-viz-artifact.py` |
| Stack Card | 见下 |
| 扫描方式 | 主 agent 串行 lane（变更面约数十源文件，非整仓）；`scan_tools: ast-grep 已安装 + rg`；本切片以 rg + 读入口为主，未跑全仓 `ast-grep scan` |
| 证据层 / 外部依赖 | **无** `.evidence/`；DeepTalk 为仓外调用方（我方是 HTTP 服务端）。Smoke：`tests/test_ai_viz_hybrid.py`、本机 `upload-ai-viz-artifact.py` 已 201 |
| Blind spots | 无证据层；L5 视觉未扫（合理跳过）；全仓 ast-grep 未跑 |
| P0 / P1 / P2 | **0 / 3 / 2** |
| 建议 | 单用户本机 POST 黄金样例 **链路可通**；同页多实例、跨用户看板、浏览器跨域 DeepTalk **上线前应处理 P1**。不得写「整仓可上线」 |
| 回传 status | **DONE_WITH_CONCERNS** |
| 已排除非问题 | 默认 admin 种子；customViz 测试 mock 的是 `fetchWithTimeout` 等外部依赖；未绑数 `unbound` 引导（诚实空态，非假数据） |

一句话结论：**外部组件写入主路径（JWT → POST artifacts → 画布 GET entry → vsCv）对「同一登录用户 + 规范 JSON」是通的；DeepTalk 写桌面/vanilla-iife 包走不通是契约问题不是 Base 断了。仍有多实例 ID、制品仅属主、CORS 三处 P1。**

### Stack Card（摘要）

- 形态：FastAPI + React 19 `fe/`；L3 无沙箱，主 DOM 挂 HTML
- SPA：有；本切片不评全站风格
- 跳过：L5 风格（非视觉改版）；L6 IaC（本切片未改 compose/helm）
- 宣称：F17 **试点**；规范包宣称 L3 html/d3 + POST 落库

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| L5 | 合理跳过 | 全站 UI 风格 | 本次问的是外部写入链路 |
| L6 | 合理跳过 | CI/Helm | 未改交付编排 |
| 证据层 | 未消解（边缘） | `.evidence/` 不存在 | 不据此称干净；不升 BLOCKED（主路径已有 pytest/vitest/本机 POST） |
| L1 结构 | 部分 | 未跑全仓 ast-grep | 变更面已读入口 + rg；保留词法漏报风险 |

## 链路判定（对照 DeepTalk 写入）

```
外部 JWT POST /api/v1/ai-viz/artifacts
  → validate_manifest + validate_bundle_files（2MB / html|d3 / 禁 CDN）
  → ai_viz_artifacts（owner=当前用户，status=draft）
  → 图表面板「自定义」GET /ai-viz/artifacts 列表（仅本人）
  → 拖入 layout 只存 artifactId
  → CustomVizWidget GET meta + GET entry?h=hash
  → mountCustomVizHtml + host.vsCv
  → 人绑 Dataset → query/execute → Payload v1
```

| 步 | 通？ | 证据 |
|----|------|------|
| 规范 JSON POST | 通 | hybrid + 本机 `artifactId=cd98d88d-…` |
| vanilla/iife JSON | 不通（正确拒） | upload 脚本 exit 1 |
| 写桌面 html | 不通（未走 API） | 产品外路径 |
| 画布加载 | 通（同用户） | Widget GET entry；列表 ChartPicker |
| 未绑数 | 通 | unbound 引导 |
| 绑数出图 | 通（CHAIN/UI 测） | payload + examples d3 rect |
| PUT 后刷新 | 通（可见页签） | visibility + PUT GET |

## P0 Findings

无。未见生产路径 stub 冒充已写入；未绑数不是假绿。

## P1 Findings

### P1-1 · 官方包 `getElementById` 在同页多实例会抢节点

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 正确性 |
| 证据 | `docs/api/vs-ai-spec/examples/custom-viz-*.json` 脚本用 `document.getElementById('vs-cv-root'|…)`；PROTOCOL 虽写「多实例 ID 须唯一」，黄金样例未遵守。Base 把脚本挂进各 host，但 `getElementById` 搜整页 |
| 为何应修 | 两块外部组件时，后挂的渲染会写到第一块 DOM |
| 建议修法 | 样例一律 `host.querySelector`；规范改为「禁止依赖全局 id」 |
| 可批量 | 是（批次 A） |

### P1-2 · 制品仅 `owner_user_id` 可读，共享看板易 403

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 可靠性 |
| 证据 | `backend/app/ai_viz/service.py` `get_artifact`：非 owner → `AIVIZ_FORBIDDEN`。列表同样按 owner 过滤 |
| 为何应修 | DeepTalk 用账号 A 写入，同事 B 打开同一大屏会加载失败；试点单人无感 |
| 建议修法 | 看板读权限下放行被 layout 引用的 artifact；或写入时绑 dashboard 授权 |
| 可批量 | 否（需产品裁定） |

### P1-3 · 浏览器跨域 POST 依赖 CORS，DeepTalk 网页端可能被拦

| 字段 | 内容 |
|------|------|
| 类别 | 隐式假通（集成卫生） |
| 证据 | `CORS_ORIGINS` 默认本机 Vite；DeepTalk 若在别的 origin 用浏览器 `fetch` 会被 CORS 拦。服务端 curl/脚本不受影响 |
| 为何应修 | 对方「传不过去」会误判平台坏了 |
| 建议修法 | 规范写明必须服务端/本机脚本 POST；演示环境把 DeepTalk origin 加入 CORS，或只发后端适配器 |
| 可批量 | 是（文档 + 环境配置，批次 A） |

## P2 Findings

- **P2-1** `create` 响应是裸 `AiVizArtifactOut`，与工程信封 `{code,message,detail}` 不完全一致（试点可接受）。
- **P2-2** 新建组件对话框类型条无独立「自定义」按钮，靠图表面板「自定义」分区；能用但发现成本高。

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 默认 admin / changeme | 开发种子；不单开漏洞标题 |
| Widget 测 mock fetch | mock 的是外部 HTTP，不是被测断言恒真 |
| 打开本地 html 不算上传 | 规范已写；属对方流程错误 |
| iframe 沙箱未做 | 产品明确不做 |
| 无 `.evidence/` | 记盲区，不升 P0 |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 |
|------|------------|------|
| A | P1-1 样例改 host 查询；P1-3 HANDOFF CORS/服务端 POST | S |
| B | P1-2 共享读权（需产品） | M |
| C | P2 信封 / 入口文案 | S |

确认修 A / A+B / 全部 / 不修后才改代码。

## 集成研究建议

无（DeepTalk 不是我方 SDK；契约是自有 REST）。
