---
description: Flask 开发规范（Blueprint · 分层 · 契约）
globs:
  - "**/*.py"
  - "**/pyproject.toml"
  - "**/requirements*.txt"
  - "migrations/**"
alwaysApply: false
---

# Flask 开发规范

> 生产红线 @.cursor/rules/production.mdc · 架构 `docs/arch.md`

## 分层

`blueprints` / views → `services` → `models` / repositories。视图只做解析与调用；禁止在视图写长业务与裸 SQL。

## 契约与扩展

- JSON **必须** engineering 信封 `{code,msg,data}`；错误处理集中（errorhandler）
- 若用 flask-smorest / restx：schema 即契约，变更同步 `docs/api/`
- 管理面与业务面 Blueprint 前缀/鉴权分离

## 配置与数据

- 应用工厂 `create_app`；配置对象清晰区分 dev/prod
- 启动配置 vs 库内热改：见 @.cursor/rules/production.mdc
- DB：sqlite / mysql / postgres 可切换；迁移用 Flask-Migrate/Alembic，每次变更有版本

## 分层 · 日志 · 测试

- 视图薄；领域进 services（engineering）
- 日志滚动见 production；禁 `print`
- 新接口须 pytest + test client
