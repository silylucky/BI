---
name: create-project-rules
description: >
  为大型工程仓生成或体检优化 .cursor/rules 与 AGENTS.md：先读 docs/arch.md 与
  docs/automate/goal.md，按技术栈裁剪框架模板（go-zero/GoFrame/FastAPI/Flask/Express/Hono），
  写入生产与工程红线（国密 SM2/SM3/SM4、API 信封、领域 service、弹性幂等、指标链路、
  RBAC 审计、作业契约、测试门禁、备份保留、多租户/合规等）；交付门禁仅指针到
  release-package/deploy-dev，不重复打包手册；并自动写入双 .dev 选源（仓库 .dev=
  create-dev-config 本项目运行；$HOME/.dev=create-home-dev 外部集成验真）。
  已有规则则体检后最小修订。
  Use when initializing project Cursor rules, AGENTS.md, auditing .cursor/rules,
  国密算法约定, production redlines, or 生成/体检 .cursor/rules — Go·Python·Node + 可选 FE.
---

# Create Project Rules（`.cursor/rules` + `AGENTS.md`）

为**当前目标仓库**生成或体检大型工程协作规则，覆盖开发到交付门禁（打包执行另走 release-package）。

## 何时使用

| 场景 | 动作 |
|------|------|
| 无核心 rules | **新建**：栈判定 → Card → 确认落盘 |
| 已有 rules | **体检** → 报告；确认后**修订** |
| 缺国密/弹性/观测等 | 按 [redlines.md](references/redlines.md) R15–R26 补齐 |

**不要**：未探测栈默认 go-zero；在 delivery 里复制 release-package 全文；臆造 arch；抄参考仓业务事实。

## 姊妹 skill

| Skill | 关系 |
|-------|------|
| **release-package** | 构建产物、打包装、上传 S3；本 skill 的 `delivery.mdc` **只指针+门禁** |
| **deploy-dev** / **create-dev-config** | 演示部署与**仓库** `.dev`（本项目运行/走查/release 字段） |
| **create-home-dev** | 家目录 `$HOME/.dev`（外部集成验真选源）；`AGENTS.md` / `delivery.mdc` **必须**含双 `.dev` 指针（见 [create-home-dev/references/project-pointer.md](../create-home-dev/references/project-pointer.md)） |
| create-evolution-prd | 功能真理源 `docs/automate/prd*`（非环境台账）；AGENTS 指针一并写入 |
| create-evolution-arch/goal · docs-reviewer · create-ui-docs · code-reviewer · go-fast | 真理源、文档、UI、假绿、开工 |

## 必读顺序（≤3）

1. 本文件「必产」+「红线」
2. [redlines.md](references/redlines.md) + [stack-detect.md](references/stack-detect.md) + [rule-catalog.md](references/rule-catalog.md)
3. 扫仓/体检；落盘时只打开命中模板

## 栈门禁

先判定后端框架再选模板；无强信号不产 go-zero.mdc。依赖与 arch 冲突则一问。

## 必产（与框架无关）

```text
project.mdc · production.mdc · engineering.mdc · delivery.mdc · prd-sync.mdc · AGENTS.md
```

+ 命中框架 mdc ± go-common ± fe-ui/fe-help。

## 红线不可软化（摘要）

| 块 | 内容 |
|----|------|
| R1–R14 | 必读、日志、HA、多库、认证、热改、文案、UI、迁移、质量、体量、信封、分层、文档 |
| **R15 国密** | 业务密码学默认 SM4/SM3/SM2 |
| **R16–R18 P0** | 弹性幂等、指标链路、交付指针（release-package） |
| **R19–R24 P1** | RBAC 审计、密钥分级、作业、测试门禁、备份、FE 性能/a11y |
| **R25–R26 P2** | 多租户、等保/i18n/边缘/SBOM（按形态） |

完整条文：[redlines.md](references/redlines.md)。

## 流程

Phase 0 侦察+栈判定 → Phase 1 按 catalog 填模板（production 含国密；delivery 保持薄；**AGENTS.md + delivery.mdc 必含「仓库 `.dev` vs `$HOME/.dev`」选源表**，文案对齐 [project-pointer.md](../create-home-dev/references/project-pointer.md)）→ 预览确认 → 写入 → 自检 R1–R26 落点与栈一致。

体检已有 rules：若缺双 `.dev` 指针 → 列为缺口，确认后按 project-pointer 最小补丁。

## 质量门槛

| 档 | 标准 |
|----|------|
| 可毕业 | 必产含 delivery；国密+弹性+观测在 production；框架与依赖一致；AGENTS/delivery 含仓库 `.dev` + `$HOME/.dev` 选源指针 |
| 不可交付 | 缺国密/信封/production，或 delivery 写成第二本 release 手册 |

## 示例触发语

- 「按 create-project-rules 生成 rules（含国密与弹性）」
- 「体检 rules 是否覆盖 P0–P2」
- 「交付门禁指到 release-package，不要把打包步骤写进 mdc」
