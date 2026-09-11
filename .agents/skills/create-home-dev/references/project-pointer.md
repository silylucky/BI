# 项目仓内「双 .dev」指针（规范文案）

供 **create-project-rules** 写入模板，以及 **create-home-dev** 在客户仓内执行后补缺时复用。  
**禁止**把家目录台账复制进仓库；只写查找关系。

## 分工（钉死）

| 位置 | 谁生成 | 查什么 |
|------|--------|--------|
| `<repo>/.dev/` | **create-dev-config** | 本项目本地/演示运行：`active_env`、browser/API URL、走查账号、`deploy`/`release`、项目级 `integrations` 变量名 |
| `$HOME/.dev/` | **create-home-dev** | 跨项目外部集成验真：SSH 设备、S3/对象存储、MySQL/Postgres、日志/Trace、LDAP/OAuth 等端点与 `credential_env` |
| `docs/automate/prd*` | **create-evolution-prd** | 功能真理源（验收勾选）；**不是**环境台账 |

## 写入 `AGENTS.md` 的节（推荐标题）

```markdown
## 环境与外部集成选源

| 需求 | 查哪里 | 生成 skill |
|------|--------|------------|
| 本项目怎么启动/走查、演示机 SSH、发布 mc alias（项目已登记） | 仓库根 `.dev/config.yaml`（及 gitignore 的 `.dev/secrets.env`） | create-dev-config |
| 外部库 / S3 / LDAP / OAuth / 日志·Trace 等**可复用**联调与 smoke 端点 | `$HOME/.dev/config.yaml`（及 `~/.dev/secrets.env`） | create-home-dev |
| 功能是否算完成、验收勾选 | `docs/automate/prd.md` + `docs/automate/prd/` | create-evolution-prd |

纪律：yaml 与报告只出现主机/URL/**环境变量名**；禁止把 AK/SK、密码、Token 写入可提交文件。外部依赖 smoke 优先读家目录台账的 `credential_env`，再与项目 `.dev` `integrations` 对齐变量名。
```

## 写入 `.cursor/rules/delivery.mdc` 的表行

在「真源」表中保留/补齐：

```markdown
| 本项目运行与走查环境地图 | 仓库 `.dev/`（**create-dev-config**） |
| 外部集成验真（SSH/S3/DB/LDAP/OAuth/观测） | 家目录 `$HOME/.dev/`（**create-home-dev**）；只引用，不入库 |
| 功能验收规格 | `docs/automate/prd*`（**create-evolution-prd**） |
```

## create-home-dev 在客户仓内的补缺动作

当 cwd（或用户指定）是 git 仓库根且刚写完/确认过 `$HOME/.dev`：

1. 若存在 `AGENTS.md` 且无「环境与外部集成选源」节 → **预览**后追加上方节（用户确认）
2. 若存在 `.cursor/rules/delivery.mdc` 且真源表无家目录 `.dev` 行 → **预览**后补行
3. 若两者皆无 → 交接提示：先跑 **create-project-rules**（模板已含本节），或口头同意后只建最小 `AGENTS.md` 节
4. **禁止**把 `~/.dev` 内容复制进仓库；**禁止** `git add` 家目录文件
