---
description: Hono 开发规范（路由 · 中间件 · 适配器）
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/package.json"
  - "src/**"
  - "apps/**"
alwaysApply: false
---

# Hono 开发规范

> 生产红线 @.cursor/rules/production.mdc · 架构 `docs/arch.md` · 有 SPA 时另见 fe-ui.mdc

## 分层

`app` / 子 `Hono` 路由 → handlers（薄）→ `services` → 数据访问。RPC/客户端适配与领域逻辑分离。

## 契约与校验

- 优先 Zod 等与 `@hono/zod-validator`（或仓内等价）
- 对外 JSON **必须** engineering 信封 `{code,msg,data}`；`onError` 统一人话 `msg`
- 管理面与业务面 `basePath` 分离

## 配置与数据

- 运行时适配（Node/Bun/Workers）在入口隔离；业务代码不绑死单一 runtime（除非 arch 锁定）
- 配置热改与多库：见 @.cursor/rules/production.mdc
- 迁移每次变更有版本文件

## 分层 · 日志 · 测试

- handlers 薄；领域进 services（engineering）
- 请求日志 + 滚动（production）；禁裸 `console.log` 审计
- 用 Hono 测试助手覆盖主路径与鉴权失败
