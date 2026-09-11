# 文档分类与命名（Taxonomy）

本文件是路径与命名的唯一标准。生成文档、修正 `prd-sync.mdc`、做覆盖矩阵时均以此为准。

## 目录树

```
docs/
├── README.md                 # 索引（必有）
├── api/
│   └── <模块>.md
├── adr/
│   └── <主题>-<模块|流程>.md
├── domain/
│   └── <业务流程>.md
├── service/
│   └── <服务>.md
├── mock/
│   └── <服务|模块>.md
├── ui/
│   └── <表面|流程>.md
└── data/
    └── <域|存储>.md
```

可选：`docs/runbook/`、`docs/security/`（见 SKILL「可选」）。根 `README.md` 保留快速开始，详细内容链到 `docs/`。

## 命名规则

| 类型 | 模式 | 示例 | 说明 |
|------|------|------|------|
| api | `kebab-case` 模块名 | `docs/api/billing.md` | 一模块一文；过大可拆 `billing-invoice.md` |
| adr | `<主题>-<模块\|流程>` | `docs/adr/event-bus-order.md` | 主题在前便于浏览；一文一决策 |
| domain | 业务流程名 | `docs/domain/order-fulfillment.md` | 面向业务语言，少技术词 |
| service | 进程/部署单元名 | `docs/service/api-gateway.md` | 与二进制、compose 服务名对齐 |
| mock | 服务或模块名 | `docs/mock/payment.md` | 与被模拟对象同名 |
| ui | 设计锚 + 表面或关键流 | `docs/ui/anchor.md`（必有）、`docs/ui/console-ia.md`、`docs/ui/checkout-flow.md` | 锚一文；IA/全站一文；复杂流可另文。缺 `anchor.md` = 视觉基准无源，按 P1 报（见 [create-ui-docs](../../create-ui-docs/references/anchor.md)） |
| data | 域或存储名 | `docs/data/order.md`、`docs/data/redis-cache.md` | 按限界上下文或存储引擎 |

一律：**小写 + 连字符**；禁止空格、下划线混用、中文文件名（标题内可用中文）。

## 覆盖判据（何时「缺文档」）

| 代码信号 | 期望文档 | 缺则最低级 |
|----------|----------|------------|
| HTTP/RPC/GraphQL 路由或 OpenAPI/proto | `docs/api/<模块>.md`（过可消费闸门） | P1；薄文档不可 Postman/APISix → 仍 P1；对外宣称已交付且无契约可循 → P0 |
| 多方案取舍痕迹（ADR 注释、重大重构 PR、双写） | `docs/adr/...` | P1（非显然）/ P2（局部小优化可不建） |
| 领域服务、状态枚举、业务规则集中处 | `docs/domain/...`（含 Process Test Pack） | P1；仅有散文无逐步表/场景包 → P1 模板不合规 |
| `main`/worker/Dockerfile/systemd/compose 服务 | `docs/service/...` | P1；唯一入口且无法靠 README 启动 → P0 |
| 非测试 stub/mock/假数据/ForceStub | `docs/mock/...` | P1；文档把假写成真 → P0 |
| 前端路由表/菜单 | `docs/ui/...` | P1（有产品表面时） |
| migration/schema/ORM model | `docs/data/...` | P1 |
| 启用本体系 | `docs/README.md` | P1 |
| Agent 文档生成约定 | `.cursor/rules/prd-sync.mdc` | P1；缺失且团队靠 agent 写文档 → P0 |

## 现有树不合规时

1. **可映射**：旧路径能 1:1 映射到标准类型 → 报告建议「迁移重命名」，确认后 `git mv` + 改链接。
2. **杂糅长文**：一篇混 api+部署+领域 → 建议拆分到对应类型，确认后拆。
3. **平行根**（`documentation/`、`doc/`）：P1 建议收敛到 `docs/`；用户明确要求保留旧根时，在 prd-sync 写「兼容别名」，仍以 `docs/` 为规范写入目标。

## 与契约源的关系

| 产物 | 位置 | docs 角色 |
|------|------|-----------|
| OpenAPI / Swagger | 如 `api/openapi.yaml` | **权威 schema 源**；`docs/api` 链到源，并补齐环境/鉴权/网关/业务码/逐端点可复制示例（可消费闸门） |
| Protobuf | 如 `proto/` | 同上 |
| Postman Collection | 可选 `docs/api/<模块>.postman_collection.json` | 与 Markdown 同批维护；改接口须同步 |
| DB migration | 如 `migrations/` | `docs/data` 描述模型与迁移策略，不复制每条 SQL |
| Helm/compose | `deploy/`、`docker-compose*` | `docs/service` 写操作步骤并链到清单 |

**薄摘要不合格**：仅有端点名表或「见 OpenAPI」四个字 → P1。判定细则：[consumable-depth.md](consumable-depth.md)。

## 可消费深度（毕业附加条件）

| 类型 | 读者必须能 | 详见 |
|------|------------|------|
| api | 建 Postman 请求（或 Import 契约）+ 配 APISix/网关路由 + 跑冒烟 | consumable-depth A1–A8 |
| domain | 按 Process Test Pack 执行主/异常流程并断言状态 | consumable-depth D1–D8 |

## 交叉链接约定

每篇文档头部 YAML 或「元信息」表建议含：

- `type`: api | adr | domain | service | mock | ui | data
- `module` / `service`: 稳定标识
- `related`: 相关文档相对路径列表
- `status`: current | draft | deprecated
- `last_verified`: YYYY-MM-DD（对账日）

`docs/README.md` 用表格索引全部 `current` 文档；`deprecated` 保留文件但移出主表或单独一节。
