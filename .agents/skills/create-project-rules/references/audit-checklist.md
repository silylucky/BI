# 已有 rules 体检清单

对照 [redlines.md](redlines.md)。每项：`OK` / `弱` / `缺` / `冲突`。

## A. 结构

| # | 检查 |
|---|------|
| A1 | `project.mdc` alwaysApply + arch/goal |
| A2 | `production.mdc`（含国密、弹性、指标） |
| A2b | `engineering.mdc`（体量、信封、分层） |
| A2c | `delivery.mdc`（指针 release-package，非重复手册；含仓库 `.dev` + `$HOME/.dev` 选源） |
| A3 | `prd-sync.mdc` + api/domain/service 深度 |
| A4 | 框架 mdc ↔ [stack-detect](stack-detect.md) |
| A4b | 有 FE → `fe-ui.mdc`（含性能/a11y） |
| A5 | `AGENTS.md` 精炼（含「环境与外部集成选源」） |
| A6 | 单文件不过度膨胀 |

## B. 红线覆盖（摘要）

| # | 红线 | 合格信号 |
|---|------|----------|
| B1–B10 | R1–R10 | 同前；**R9** 含 migrations+seed+表定义+强制改密（路径按栈） |
| B11–B14 | R11–R14 | 体量豁免、信封、分层、文档深度 |
| B15 | R15 国密 | SM2/SM3/SM4 默认；例外走 ADR |
| B16 | R16 弹性 | 超时/重试/限流/熔断/幂等 |
| B17 | R17 观测 | 指标+trace，非仅日志 |
| B18 | R18 交付 | delivery 指针 + 禁裸交付/禁 AK 进仓 + 双 `.dev` 选源 |
| B19–B24 | R19–R24 | RBAC 审计、密钥分级、作业、测试门禁、备份、FE a11y |
| B25–B26 | R25–R26 | 多租户/合规/i18n/边缘/SBOM（按 arch 启用） |

## C. 漂移

目录/API/框架路径与仓一致；无错误姊妹仓产品名；delivery **未**粘贴 release.sh 全文。

## D. 报告

结构 x/9 · 红线 R1–R26 覆盖表 · P0 缺口优先。

**P0**：缺国密/弹性/指标/delivery 指针，或 production 关键条缺失。  
默认体检不写盘。
