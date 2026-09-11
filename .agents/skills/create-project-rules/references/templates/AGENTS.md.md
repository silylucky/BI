# AGENTS.md

{{PRODUCT}} 代理协作说明。真理源：`docs/automate/goal.md` · `docs/arch.md` ·（功能）`docs/automate/prd.md`。
规则：`.cursor/rules/*.mdc`。本文件只补**长期、非显而易见**约定。

## 会话启动

1. 读 `docs/arch.md` 与 `docs/automate/goal.md`
2. 扫顶层目录
3. 红线：`production.mdc`（含**国密**、弹性、观测）· `engineering.mdc`（信封/分层）· `delivery.mdc`（交付指针）· `prd-sync.mdc`

## 交付与发布（勿在本文件写操作手册）

- 打包装、上传制品 → 姊妹 skill **release-package** + `scripts/release.sh` + `.dev` `release:`
- 演示机部署 → **deploy-dev**
- 仓内只遵守 `.cursor/rules/delivery.mdc` 门禁（版本、禁 AK 进仓、可回滚）

## 环境与外部集成选源

| 需求 | 查哪里 | 生成 skill |
|------|--------|------------|
| 本项目启动/走查、演示机 SSH、项目已登记的发布参数 | 仓库根 `.dev/config.yaml`（密钥：`.dev/secrets.env`，勿提交） | **create-dev-config** |
| 外部库 / S3 / LDAP / OAuth / 日志·Trace 等跨项目联调与 smoke | `$HOME/.dev/config.yaml`（密钥：`~/.dev/secrets.env`） | **create-home-dev** |
| 功能是否完成、验收勾选 | `docs/automate/prd.md` + `docs/automate/prd/` | **create-evolution-prd** |

纪律：可提交文件只记主机/URL/**环境变量名**；外部依赖真打优先读家目录台账的 `credential_env`，再与仓库 `.dev` `integrations` 对齐。细则见 `.cursor/rules/delivery.mdc`。

## 后端红线摘要（按栈保留一节）

### go-zero（仅当栈为 go-zero）

- 先改契约再 goctl（`--style go_zero`）；禁手改 `routes.go`/`types.go`
- 细则：`.cursor/rules/go-zero.mdc`

### 其他

GoFrame / FastAPI / Flask / Express / Hono → 对应 `.cursor/rules/*.mdc`

## 前端（若有）

`docs/ui/` + `.cursor/rules/fe-ui.mdc`（含性能/a11y）；文案人话

## 本地启动（非显而易见）

{{DEV_NOTES}}

## 其他长期约定

{{EXTRA_NOTES}}
