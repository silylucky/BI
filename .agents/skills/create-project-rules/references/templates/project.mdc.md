---
description: {{PRODUCT}} 总约束（目录 · 任务路由 · 必读真理源）
alwaysApply: true
---

# 项目总约束

> 架构：`docs/arch.md` · 产品：`docs/automate/goal.md` · 功能：`docs/automate/prd.md`（若有）

## 会话启动（硬约束）

开发前**先读** `docs/arch.md` 与 `docs/automate/goal.md`，再扫顶层目录；禁止臆造进程、路由或模块边界。

## 定位

**{{PRODUCT}}** — {{ONE_LINER}}

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | {{BACKEND_STACK}} |
| 前端 | {{FRONTEND_STACK}} |
| 数据 | SQLite / MySQL / PostgreSQL |
| 认证 | 本地（若有）· LDAP · OAuth/OIDC |
| 密码学 | 国密 SM2/SM3/SM4（见 production） |
| 交付 | {{DELIVERABLES}}（打包上传 → release-package） |
| 规则 | production · engineering · delivery · prd-sync |

## 任务路由

- **改架构/边界** → `docs/arch.md`
- **改产品范围** → `docs/automate/goal.md`
- **体量/信封/分层/超时幂等** → @.cursor/rules/engineering.mdc
- **国密/弹性/观测/RBAC/作业/测试/备份…** → @.cursor/rules/production.mdc
- **打包上传/演示部署** → @.cursor/rules/delivery.mdc（执行用 release-package / deploy-dev）
- **后端框架** → @.cursor/rules/{{BACKEND_RULE}}
- **Go 公共包** → @.cursor/rules/go-common.mdc（若有）
- **前端** → @.cursor/rules/fe-ui.mdc + `docs/ui/`
- **文档** → @.cursor/rules/prd-sync.mdc

## 仓库目录（目标）

```
{{REPO_TREE}}
```

## 规则索引

| 场景 | 规则 |
|---|---|
| 生产红线 | @.cursor/rules/production.mdc |
| 工程公共 | @.cursor/rules/engineering.mdc |
| 交付门禁指针 | @.cursor/rules/delivery.mdc |
| 文档同步 | @.cursor/rules/prd-sync.mdc |
| {{EXTRA_RULE_ROWS}} |
