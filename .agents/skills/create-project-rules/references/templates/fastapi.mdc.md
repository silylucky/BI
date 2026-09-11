---
description: FastAPI 开发规范（路由 · 依赖注入 · 契约）
globs:
  - "**/*.py"
  - "**/pyproject.toml"
  - "**/requirements*.txt"
  - "alembic/**"
  - "migrations/**"
alwaysApply: false
---

# FastAPI 开发规范

> 生产红线 @.cursor/rules/production.mdc · 架构 `docs/arch.md`

## 分层

`routers`（APIRouter）→ `services` → `repositories` / ORM；依赖经 `Depends` 注入。路由函数禁止堆业务 SQL。

## 契约与校验

- 请求/响应用 Pydantic 模型；对外 JSON **必须**套 engineering 信封 `{code,msg,data}`
- OpenAPI 由 FastAPI 生成，**人读摘要**仍维护 `docs/api/`
- 管理面与业务面路由前缀分离

## 配置与数据

- 启动仅保留连接与安全根密钥等（见 production）；业务参数进 DB + 管理面热改
- DB 驱动可切换：sqlite / mysql / postgres
- 迁移：Alembic（或仓内等价）**每次** schema 变更有修订；禁只靠运行时创表

## 分层 · 日志 · 测试

- routers 薄；领域进 `services/`（engineering）
- 统一 logging；滚动见 production；禁 `print`
- 新路由须 TestClient/pytest；禁空 stub 当交付
