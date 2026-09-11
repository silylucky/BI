---
description: 代码变更后的文档同步评估（PRD / docs taxonomy · 可消费深度 · runbook）
alwaysApply: true
---

# 文档同步评估

## 文档同步总表

| 变更内容 | 同步文档 |
|---------|---------|
| 业务逻辑/用户可见行为 | `docs/automate/prd.md` + 分片（若有） |
| 产品域概念、术语、流程、状态机 | `docs/domain/` |
| API 路由/契约/信封/错误码 | `docs/api/` + 契约源 |
| 架构/重大选型/国密例外 | `docs/arch.md`、必要时 `docs/adr/` |
| 进程职责/配置/部署/备份恢复/回滚 | `docs/service/` |
| 非测试 stub/假能力 | `docs/mock/`（禁止写成已交付） |
| 控制台 IA/关键流 | `docs/ui/` |
| 持久化/迁移/保留 | `docs/data/` |
| 威胁模型/过检（按需） | `docs/security/` 或并入 ADR |
| 重大事故处置 | runbook：可先写在对应 `docs/service` 运维节，或 `docs/runbook/` |
| 新工程文档 | `docs/README.md` 索引 |

## 分类与最低深度

| 类型 | 路径 | 最低深度 |
|------|------|----------|
| api | `docs/api/<模块>.md` | 鉴权、端点、**信封**、错误模型、冒烟；链契约源 |
| domain | `docs/domain/<流程>.md` | 术语、关系、状态/流程、边界 |
| service | `docs/service/<服务>.md` | 职责、启动、配置、健康、部署、**备份/回滚指针** |
| data | `docs/data/` | 模型与迁移、保留策略 |
| adr | `docs/adr/` | 含国密例外、难回退选型 |
| mock / ui / index | 同前 | 假能力诚实；FE 有 anchor |

## 真源

代码+契约为真源；禁臆造；stub 只进 mock；禁平行 documentation 根；未确认禁整文件覆写精修文档。

## PRD

`docs/automate/prd.md` 为功能索引；行为变更评估分片；纯重构通常不改。
