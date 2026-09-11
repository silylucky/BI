# Stack Card, Routing, Coverage and Evidence

## Stack Card

Controller 在读取大量代码前建立一次仓库能力画像：语言/框架、构建系统、入口、数据库/缓存/消息、外部集成、鉴权边界、CI/部署、前端与公开 API。路径检测只是初稿，必须用 `stack-card` 写入复核后的 JSON。

```json
{
  "languages": {".go": 52},
  "build_systems": ["Go modules"],
  "entrypoints": ["cmd/api/main.go"],
  "data_stores": ["PostgreSQL"],
  "external_integrations": ["payment gateway"],
  "auth_boundaries": ["HTTP middleware"],
  "delivery_surfaces": ["REST API"],
  "scan_tools": {
    "cursor_native": true,
    "rg": {"available": true},
    "ast_grep": {"available": false},
    "codegraph": {"available": true, "fresh": false}
  }
}
```

## 信号路由

维度是 reviewer 的关注标签，不是新任务：

| 信号 | 挂载维度 |
|---|---|
| TODO、空实现、固定成功 | fake-green / stub |
| HTTP/RPC/SDK | timeout、retry、failure semantics、idempotency |
| 鉴权、输入、上传 | security / authorization |
| 事务、并发写、消息 | consistency / race / idempotency |
| 公开 API | envelope / error / compatibility |
| 查询、循环、批处理 | N+1 / memory / fan-out / hot path |
| 页面、表单、路由 | product surface / form / copy，仅 production-readiness |
| HA 宣称 | multi-instance state / lock / queue / capacity |

`correctness` 默认挂载 correctness、安全、数据、并发和有证据的性能风险。`production-readiness` 才增加假绿、产品入口、UI/表单、CI/IaC、外部真接等专项。不存在每维度 Candidate 数量下限；无命中时记录已检查证据或合理 skipped reason。

Controller 在 dispatch 前用 `task-plan` 把信号路由结果写入任务：

```json
{
  "dimensions": ["correctness", "authorization", "idempotency"],
  "signals": [
    {"name": "auth-boundary", "evidence": "HTTP middleware routes into this handler"}
  ]
}
```

`correctness` 不可删除。`complete` 时，每个计划维度必须出现在 `dimensions`（已检查）或 `skipped`（给出理由）中，否则返回 `DIMENSION_COVERAGE_MISSING`。

## Candidate 来源

- Cursor 原生 Read/Search/Grep/Git/Shell 是默认工具。
- 字符串/配置找 `rg`；稳定代码形状可用 ast-grep；调用者/影响面可用新鲜 codegraph。
- 工具只产生 Candidate。若已安装 `code-scanning`，可按它的分诊使用；缺失时本 Skill仍可独立运行。
- 隐式触发不安装工具、不建索引。
- 过期图不可作为结论；同步失败后降级原生搜索/rg/AST，并记录尚未补足的 Blind Spot。
- 图或搜索“未找到”不能证明不存在，动态分发/反射/配置路由需词法复核。

## Evidence Gate

build、test、lint、CI、`.evidence/`、运行日志和契约是证据源，不是自动 Finding。失败先形成 Candidate，再确认是否与 Primary Target 及当前改动有因果关系。Gate 失败不得被删除、重跑掩盖或写成背景噪音。

Finding 的 evidence 应引用命令、工件或代码事实；敏感内容只保存必要摘要。

## Coverage Ledger

每个 `complete` 输入：

```json
{
  "primary_target_complete": true,
  "symbols": ["CreatePayment", "HandleCallback"],
  "ranges": [{"start_line": 1, "end_line": 120}],
  "dimensions": ["correctness", "idempotency", "external-call-reliability"],
  "skipped": [{"dimension": "performance", "reason": "无批量或热路径信号"}],
  "blind_spots": [],
  "pending_questions": [],
  "context_paths": ["account.go"]
}
```

`ranges` 使用正整数、闭区间的 `start_line/end_line`；程序也接受 `[start_line, end_line]` 并归一化。`context_paths` 列出实际参与判定的 Context Evidence；程序计算依赖指纹，恢复时其中任一变化会使任务 stale。大文件分段必须用 symbols/ranges 证明覆盖。被否定 Candidate 存入 checkpoint：主张、否定证据和相关指纹，避免恢复后重复调查。

Blind Spot 必须包含 `area`、`reason`、`scope`。`scope` 只能是 `primary-target | changed-code | core-path | external-integration | auth-boundary | data-boundary | optional-tool | peripheral`。程序根据 scope 计算 `material`，不信任 reviewer 自报的布尔值：前六类一定是实质性盲区；仅缺少非必要增强工具、且已用原生工具完成等价复核时才使用后两类。

Session 是否完成与 assurance 分开：流程可以 complete，但 material Blind Spot 使 `assurance=limited` 且 `clean=false`。

Reviewer 连续失败 3 次时，程序自动为该 Primary Target 生成 `scope=primary-target` 的 material Blind Spot 并将任务置为 blocked。Controller 不因单文件失败暂停全仓调度；Finalizer 统一输出 `partial + limited + clean=false`。
