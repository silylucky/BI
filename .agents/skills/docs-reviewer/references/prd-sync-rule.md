# prd-sync 规则标准（`.cursor/rules/prd-sync.mdc`）

每次跑 docs-reviewer（整仓或初始化）必须检查该文件：**缺失 / 过时 / 与 taxonomy 冲突 → 记 finding，确认后写入或修补**。

## 目标

让 Cursor Agent 在写 PRD、方案、实现说明、补文档时：

1. 把文档落到**正确类型与路径**
2. **套标准模板**（必填节）
3. **代码为真源**；假能力只进 `docs/mock/`
4. 更新 `docs/README.md` 索引与 `last_verified`

## 合适性检查清单

| 检查项 | 合格标准 |
|--------|----------|
| 存在 | 路径正好是 `.cursor/rules/prd-sync.mdc`（或仓内 rules 等价路径且内容覆盖下列节） |
| 分类 | 含 api/adr/domain/service/mock/ui/data + README，与 [taxonomy.md](taxonomy.md) 一致 |
| 命名 | kebab-case；给出示例路径 |
| 模板 | 要求必填节，或明确「打开 docs-reviewer templates」 |
| api/domain 深度 | 写明须可支撑 Postman / 网关(APISix) / 业务流程测试；禁止空壳摘要 |
| 真源 | 写明：漂移修文档；stub → mock 文档，禁止写成已交付 |
| 契约 | OpenAPI/proto 源目录 vs `docs/api` 摘要关系 |
| 索引 | 新文档必须挂进 `docs/README.md` |
| 不要做 | 禁止平行 `documentation/` 树、禁止臆造端点、禁止未确认整文件覆写精修文档 |

任一不合格 → P1（团队依赖 agent 写文档且规则缺失/严重误导 → P0）。

## 推荐文件正文（确认修复时按此写入或合并）

以下为**推荐全文**；合并已有规则时保留仓内特有节（如产品名、契约源真实路径），但不得删掉分类与真源约束。

```markdown
---
description: 文档与 PRD 同步规范 — 生成/修改 docs 时必须遵守的路径、分类与模板
globs:
  - docs/**/*.md
  - "**/*PRD*"
  - "**/*prd*"
alwaysApply: false
---

# PRD / 文档同步规范（prd-sync）

## 何时应用

编写或修改 PRD、设计说明、API/领域/服务文档、或用户要求「补文档 / 同步文档」时，必须遵守本规则。

## 文档根与分类

统一根目录：`docs/`。

| 类型 | 路径 | 用途 |
|------|------|------|
| api | `docs/api/<模块>.md` | 可消费 API 说明书（环境/鉴权/网关/逐端点示例）；链 OpenAPI；可支撑 Postman/APISix |
| adr | `docs/adr/<主题>-<模块\|流程>.md` | 架构与方案决策 |
| domain | `docs/domain/<业务流程>.md` | 可测业务域（逐步流程/状态机/GWT 规则/Process Test Pack） |
| service | `docs/service/<服务>.md` | 进程职责、配置、部署、运维 |
| mock | `docs/mock/<服务\|模块>.md` | 假能力 / 占位诚实清单 |
| ui | `docs/ui/<表面\|流程>.md` | 信息架构、关键流、页约定 |
| data | `docs/data/<域\|存储>.md` | 数据模型与迁移策略 |
| index | `docs/README.md` | 文档索引（必维护） |

命名：小写 kebab-case；一文一主题。

## 真源与诚实性

- **代码与契约源为真源**；文档与之冲突时修正文档，或标 `待确认`，禁止臆造。
- 非测试 stub/mock/假数据 → 只写入 `docs/mock/`，并写明启用方式与清零条件。
- **禁止**在 `docs/api`、`docs/domain`、根 README 把 mock 能力写成已交付。

## 模板

新文档必须包含对应类型的必填节（概述/契约或职责、相关链接、`last_verified` 等）。
完整模板以仓内约定或 docs-reviewer skill 的 `references/templates/<域>.md`（索引 `references/templates.md`）为准。
**api / domain** 另须满足可消费深度（`references/consumable-depth.md`）：能直接支撑 Postman、APISix/网关配路由、业务流程测试；禁止只有端点名表或概念散文。

文首元信息至少含：`type`、`status`、`last_verified`、`related`。

## 契约源（按仓填写）

- OpenAPI / Swagger：`<填写实际路径，如 api/openapi.yaml>`
- Protobuf：`<填写或写无>`
- `docs/api/*.md` 是可消费说明书（环境、鉴权、网关、逐端点参数与完整 JSON 示例、错误码、冒烟清单）；可链契约源分担巨型 schema，**禁止**整篇只有链接；**不手改生成物冒充源**。
- 可选同批维护 `docs/api/<模块>.postman_collection.json` 或确保 OpenAPI 可被 Postman/APISix Import。

## 变更纪律

1. 改接口 / 领域规则 / 服务配置 / 数据模型 → 同步对应 docs，并更新 `last_verified`。
2. 新增文档 → 挂到 `docs/README.md` 目录表。
3. 假能力清零 → 更新或删除 `docs/mock`，并检查宣称材料。
4. 重大选型 → 补 `docs/adr`，状态 `accepted` 后他处可引用。

## 禁止

- 新建平行文档根（`doc/`、`documentation/`）除非本规则明确兼容别名
- 无代码依据编造端点、表字段、配置项
- 用文档掩盖未实现功能
- 删除他人精修文档而不经确认
- 生成空壳 `docs/api` / `docs/domain`（无法支撑 Postman、网关或流程测试）
```

## 修正策略

| 现状 | 动作 |
|------|------|
| 文件不存在 | 确认后创建，填入本仓契约源真实路径 |
| 分类少 ui/data/mock | 补表项与禁止项，勿删旧类型 |
| 路径写成 `documentation/` | 改为 `docs/`，必要时加「旧路径只读兼容」一句 |
| 无真源/mock 诚实条款 | 必须补上 |
| globs 过窄 | 至少覆盖 `docs/**/*.md`；可按需 `alwaysApply: true`（仅当团队希望每次对话都带上） |

修正 prd-sync 属于批次 **R0**，应在批量写业务文档之前完成，避免边写边用错路径。
