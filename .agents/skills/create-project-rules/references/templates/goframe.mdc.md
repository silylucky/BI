---
description: GoFrame 开发规范（路由 · 分层 · 配置）
globs:
  - "**/*.go"
  - "hack/**"
  - "manifest/**"
  - "api/**"
  - "internal/**"
  - "cmd/**"
alwaysApply: false
---

# GoFrame 开发规范

> 公共 Go 组织见 @.cursor/rules/go-common.mdc · 生产红线 @.cursor/rules/production.mdc · 架构 `docs/arch.md`

## 分层

推荐：`api`（入参出参）→ `controller` → `service` → `dao/model`。业务进 service；controller 只做解析、鉴权上下文、调用与响应。

## 路由与契约

- 路由集中注册（按仓：`cmd` / `internal/cmd` / 生成物）；新增 API 同步 OpenAPI/文档索引
- 禁止在 dao 层写 HTTP；禁止 controller 堆 SQL
- 管理面与业务面前缀/中间件分离

## 配置与数据

- 运维入口：`{{CONFIG_PATH}}`（常见 `manifest/config` 或 `hack/config.yaml`）
- DB：`sqlite` \| `mysql` \| `postgres` 可切换（见 production）
- 迁移：`{{MIGRATIONS_DIR}}`；种子与表定义路径按仓写入 §配置；见 production（强制改密）

## 响应 · 日志 · 测试

- **信封**：@.cursor/rules/engineering.mdc
- 国密/弹性/观测：@.cursor/rules/production.mdc
- 日志见 production；禁 `fmt.Println` 当审计
- 新 API 须 service 单测或 smoke；分层见 engineering + go-common
