# 本目录是什么（工程定位 · 必读）

> **铁律全文** → [IRON-RULES.md](./IRON-RULES.md)（一体模型 · 三条工作流 · 交付判据）

## 一体集成项目（正确心智）

`vs-ai-spec-deeptalk-test` 是 **VitalSpan × DeepTalk 正式集成项目**：

- DeepTalk 在这里 **写组件、拼大屏**，并通过 `tools/` **上传到 VitalSpan**
- VitalSpan 提供 **平台能力**（API、组件库、大屏、渲染、样式/数据注入）
- 对用户：**一个产品体验**；对工程：中间走 HTTP + uuid，Agent **必须跑完 upload/save**

```
┌─────────────────────────────────────────────────────────┐
│  vs-ai-spec-deeptalk-test  （DeepTalk 集成项目根）       │
│  规范 + 金样 + validate/upload 脚本                      │
│  Agent：写 bundle / layout → 调 VitalSpan API 入库       │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP POST/PUT（必须 · 非可选）
                        ▼
┌─────────────────────────────────────────────────────────┐
│  VitalSpan 平台（能力侧 · 非本目录源码）                 │
│  :8000 API  ·  ai_viz_artifacts / dashboards  ·  :5173  │
└─────────────────────────────────────────────────────────┘
```

## 它是什么 / 不是什么

| ✅ 是 | ❌ 不是 |
|------|--------|
| DeepTalk **正式对接项目** | VitalSpan 源码仓（`fe/`、`backend/` 在 VitalSpan 仓） |
| 调用平台 API 的 **authoring + delivery 客户端** | 可独立运行的 React/组件运行时 |
| 金样 + Schema + 联调 CLI | 「写到磁盘就算交付」的草稿目录 |
| 草稿暂存 `examples/<name>.json` | 用 `output/` 当交付目录 |

**禁止**把本目录说成「与 VitalSpan 无关的外部手册」——那是错误心智模型。

**禁止**把本目录说成「VitalSpan customViz **源码工程项目**」——组件运行在 **平台进程** 里，本目录只产 bundle 并 POST 入库。

## 完成对接的工程含义

**不是**「本目录里多了一个 JSON 文件」。  
**是**「平台侧产生了可引用的持久化记录」：

| 路径 | 平台侧落点 | 完成证据 |
|------|-----------|----------|
| ② L3 customViz | 表 `ai_viz_artifacts` | **`artifactId` uuid** |
| ① L1/L2 图 | layout 内 `chartConfig` | `POST /charts/validate` 200 |
| ③ 大屏 | 表 `dashboards.layout_json` | **`dashboardId`** + editor-save 200 |

## DeepTalk 常见错答（一律判错）

| 错说法 | 对说法 |
|--------|--------|
| 「规范包与 VitalSpan 无关」 | 「DeepTalk 集成项目 + 平台能力 = 一体」 |
| 「组件已保存在 output/，符合规范」 | 「必须 POST 入库，汇报 **`artifactId`**」 |
| 「可在工作区 / 扩展中直接使用」 | 「5173 看板通过 `customVizConfig.artifactId` 引用」 |
| 「write_file 一步完成」 | 「validate → upload → **汇报 uuid**」 |

## 联调真源路径

以 VitalSpan 方 `sync-vs-ai-spec-pack.ps1` 同步后的目录为准，例如：

`C:\Users\<你>\Desktop\vs-ai-spec-deeptalk-test`

不要使用过期副本、Documents 下旧工作区、或未同步的 zip（看 `CHANGELOG.md` 日期）。

## 下一步读什么

1. [IRON-RULES.md](./IRON-RULES.md) — **铁律**  
2. [START-HERE.md](./START-HERE.md) — 三条路径与命令  
3. [DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md) — 贴进 DeepTalk 系统提示  
4. [guides/THREE-WORKFLOWS.md](./guides/THREE-WORKFLOWS.md) — 工作流详述
