---
description: 生产交付红线（日志·HA·多库·认证·配置·国密·弹性·观测·安全·作业·测试·备份）
alwaysApply: true
---

# 生产交付红线

> 与 `docs/arch.md` 对齐。构建打包上传细则 → 姊妹 skill **release-package**；演示部署 → **deploy-dev**。见 @.cursor/rules/delivery.mdc。

## 日志 · 观测

- 日志：统一封装；按大小/时间滚动 + 保留策略；请求/进程/作业分类；mask；禁裸 print
- **指标**：RED（量/错/延迟）或等价；有队列则积压；**有日志 ≠ 已观测**
- **链路**：request id（可选 trace id）贯穿日志与出站；关键告警有归属文档

## 高可用 · 弹性

- 单机 ↔ HA 可配置切换；锁/选举/共享存储诚实；readiness/liveness
- **超时**（出站/DB/MQ）必显式；重试仅幂等 + 退避上限
- **限流/配额**；依赖失败：熔断/降级/快失败，禁止假成功
- 易重复写：**幂等键或 409**

## 数据 · 迁移 · 种子 · 备份

- DB：`sqlite` | `mysql`（可含 TiDB 兼容）| `postgres` 可切换落地
- **migrations** 版本化可重放；**seed** 平台幂等（demo 种子默认不进生产）；**表定义**真源按栈（见 skill `references/db-layout.md`，勿盲抄 `db/`）
- 默认管理员若存在（如 admin/admin）：**强制改密**；生产禁长期弱口令
- 备份与 RPO/RTO、保留周期、恢复步骤成文（`docs/service` / `docs/data`）

## 认证 · RBAC · 审计

- LDAP + OAuth/OIDC（+ 本地若需要）；IdP 失败≠放行；进管理面
- 管理面/业务面 API 与权限分离
- 敏感写必审计；高危操作后端二次确认

## 配置热改（有 Web 管理面）

启动 yaml 仅连接与根密钥等；其余进 DB + 管理面热改。禁长串业务 env。

## 国密 · 密钥（强制）

业务加解密/签名/摘要默认 **SM4 / SM3 / SM2**。无 ADR 不得用 AES/RSA/SHA-2 等作主路径；外部强制国际算法 → ADR + 适配器。统一 crypto 封装。根密钥/DEK/凭证分档；落库敏感字段加密；可轮换；危险默认可拒启。

## 异步作业（有 worker/队列）

任务幂等；重试 vs 死信可观测；日志关联业务/请求 id；禁 API 内无界长任务（除非 arch 允许）。

## 测试门禁

新 service/路由：单测或 API 测含失败语义；新外部依赖：沙箱/真打 smoke 留证。合入前约定 CI/`make test` 须绿。禁假绿与无测关键路径。

外部集成 smoke 选源：跨项目可达的主机/库/S3/IdP/观测 → `$HOME/.dev`（**create-home-dev**）；本项目 URL/走查账号/项目级 integrations → 仓库 `.dev`（**create-dev-config**）。只读变量名与非密端点，禁止把密钥写进规则或报告。

## 文案 · UI

人话；禁 PRD 编号/甲乙方。FE 先 `docs/ui/`。多租户产品须防串租（arch 单租户须标明）。

## 质量

契约优先；密钥不进 git；交付诚实。等保/i18n/边缘/SBOM 按 arch 与 R26 启用；SBOM 执行跟 release-package。
