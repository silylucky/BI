# 各类型标准模板（懒加载索引）

生成或修复时**按类型套模板**。必填节不可删；无内容写 `待确认` 并在报告挂 P2，禁止臆造。

**读法（强制）**：本文件只读索引与下方共用元信息；再**按需只读当前批次涉及的域文件**，禁止 `templates/` 整目录全读。一次批量写多个域时，也只读该批命中的那几个文件。

| 域 | 文件 | 何时读 |
|----|------|--------|
| api | [templates/api.md](templates/api.md) | 写/修 `docs/api/*`；lane D1；过 Postman·APISix 闸门 |
| adr | [templates/adr.md](templates/adr.md) | 写/修 `docs/adr/*`；lane D2；记录非显然选型 |
| domain | [templates/domain.md](templates/domain.md) | 写/修 `docs/domain/*`；lane D3；需 Process Test Pack |
| service | [templates/service.md](templates/service.md) | 写/修 `docs/service/*`；lane D4；可独立运行的服务/worker/CLI |
| mock | [templates/mock.md](templates/mock.md) | 写/修 `docs/mock/*`；lane D5；诚实登记非测试假能力 |
| ui | [templates/ui.md](templates/ui.md) | 写/修 `docs/ui/*`；lane D6；有 SPA/Console/Admin 表面 |
| data | [templates/data.md](templates/data.md) | 写/修 `docs/data/*`；lane D7；有持久化 |
| 索引 | [templates/readme-index.md](templates/readme-index.md) | 写/修 `docs/README.md`；lane D8；R0 批次 |

## 可消费深度（api / domain 硬闸门）

`docs/api` 与 `docs/domain` **不是**「有个表格就算齐」。写完后须通过下列闸门，否则模板合规 = **不合格（P1）**：

| 文档 | 读者仅凭文档（+ 所链契约源）必须能 | 不合格典型 |
|------|-------------------------------------|------------|
| **api** | ① 在 **Postman** 建齐本模块请求（或一键 Import OpenAPI/Collection 并补齐环境变量）；② 在 **APISix / 网关** 配路由（uri、methods、upstream、鉴权插件、必要 header）；③ 对每个对外端点跑通至少 1 次成功 + 主要失败样例 | 只有端点名表、无字段/无完整 JSON、无 Base URL/鉴权、无网关节、示例只有「见代码」 |
| **domain** | ① 写出主流程与异常流程的**可执行测试步骤**；② 每步知道调哪些 API / 期望哪些状态与数据；③ 业务规则可写成 Given/When/Then 断言 | 只有散文叙事、无状态机、无用例表、无 API 触点、无法据此做流程回归 |

有完整 OpenAPI/proto 时：`docs/api` 仍须含 **环境·鉴权·网关·错误码·端点索引·每端点至少一组可复制示例**；schema 细节可链契约源，但**禁止**整篇只有链接而无示例。无契约源时：字段表 + 完整请求/响应 JSON **必须写在本文**。

可选产物（有则更佳，非替代 Markdown 必填节）：

- `docs/api/<模块>.openapi.yaml` 或链到仓内契约源（Postman / APISix 可 Import）
- `docs/api/<模块>.postman_collection.json`（与 Markdown 同步；改接口须同批更新）

细节闸门见 [consumable-depth.md](consumable-depth.md)。

## 共用元信息（所有域通用）

文首统一元信息（Markdown 表或 YAML frontmatter，仓内择一，prd-sync 锁定）：

```markdown
# <标题>

| 项 | 内容 |
|----|------|
| type | api \| adr \| domain \| service \| mock \| ui \| data |
| module / service | <稳定标识> |
| status | current \| draft \| deprecated |
| last_verified | YYYY-MM-DD |
| related | [链接](相对路径) … |
| consumers |（api 建议）postman \| apisix \| e2e；（domain 建议）process-test \| qa |
```
