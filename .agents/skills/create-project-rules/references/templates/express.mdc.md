---
description: Express 开发规范（路由 · 中间件 · 分层）
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/package.json"
  - "src/**"
  - "apps/**"
alwaysApply: false
---

# Express 开发规范

> 生产红线 @.cursor/rules/production.mdc · 架构 `docs/arch.md` · 有 SPA 时另见 fe-ui.mdc

## 分层

`routes` → `controllers`（薄）→ `services` → `repos`。路由文件禁止堆业务；中间件做鉴权/请求 id/审计。

## 契约与校验

- 入参用 zod / joi / 等价校验；对外 JSON **必须** engineering 信封 `{code,msg,data}`
- OpenAPI 若有则与实现同步；错误中间件集中转换为人话 `msg`
- 管理面与业务面路径前缀分离

## 配置与数据

- 启动：端口、DB/Redis 连接、根密钥；其余进 DB + 管理面热改（production）
- DB：sqlite / mysql / postgres 经统一 client；迁移每次变更有文件

## 分层 · 日志 · 测试

- routes/controllers 薄；领域进 `services/`（engineering）
- pino/winston 等 + 滚动（production）；禁 `console.log` 当审计
- 新路由须测试覆盖成功与失败路径
