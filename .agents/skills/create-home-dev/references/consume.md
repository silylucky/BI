# 下游如何消费 `~/.dev`

家目录台账是**选源与变量名真源**，不是替代仓库 `.dev`。项目仍写自己的 `<repo>/.dev/config.yaml`；需要主机/S3/库时从 `$HOME/.dev` **挑选并复制摘要字段**。

## 解析路径

```
HOME_DEV="${HOME}/.dev"
# 若用户设置了 HOME_DEV_ROOT 则用之（少见；本 Skill 默认不依赖）
```

有 `config.yaml` 才视为可用；缺失 → 调用方提示用户跑 **create-home-dev**，或继续口头询问单次值（不落家目录，除非用户要登记）。

## create-dev-config（阶段 D）

问 `deploy.ssh_host` 前：

1. 读 `hosts[]`，过滤 `tags` 含 `demo`/`staging` 或用户指定
2. 选项列出 `label — ssh`；用户选中后写入项目  
   `environments.<id>.deploy.ssh_host` ← `hosts[].ssh`（含 port 非 22 时用 `user@host -p port` 或脚本约定）
3. 若有 `remote_roots[0]` → 推荐为 `deploy.remote_root`
4. 可在项目 yaml 注释：`# home_ref: hosts/<id>`

问 `release.mc_alias` / `s3_prefix` 前：从 `object_storage[]` 选 `mc_alias` + `bucket_or_prefix`。

问第三方 `integrations` 时：若家目录已有同 slug/同 endpoint，**复用 `credential_env` 变量名**（值仍在家目录或项目 `secrets.env`，由用户对齐）。

## deploy-dev

1. 优先项目 `.dev` 的 `deploy.ssh_host`
2. 若缺且 `~/.dev` 有唯一 `tags: [demo]` 主机 → 作为推荐默认，**仍须确认**后才用
3. 不把家目录路径写进远程；只消费 `ssh` / `remote_roots`

## release-package

1. 优先项目 `release.mc_alias` / `s3_prefix`
2. 缺则推荐 `object_storage` 中 `kind: s3|minio` 且带 `mc_alias` 的条目
3. 凭据：确认环境已 load `$HOME/.dev/secrets.env` 或项目 secrets（**不要**把文件打进发布包）

## go-fast / integration-research

| 需要 | 查 |
|------|-----|
| DB smoke | `databases[]` → host/port/db/user + `credential_env` |
| LDAP/OIDC | `identity.ldap` / `identity.oauth` |
| 日志验真 | `observability.logs[]` |
| 通用厂商 | `integrations[]` |

只取变量名与非密端点；`credential: need|blocked` → 依赖不得标已对接。

## 项目仓规则指针

agent 做外部集成/smoke 前应先读项目 `AGENTS.md` / `.cursor/rules/delivery.mdc` 的「环境与外部集成选源」；文案规范见 [project-pointer.md](project-pointer.md)。  
仓库 `.dev` = 本项目运行面（create-dev-config）；`$HOME/.dev` = 跨项目外部验真（本台账）；PRD = create-evolution-prd（功能，非环境）。

## 安全

- 消费方报告同样禁止打印 secrets 值
- 不要 `source` secrets 后把环境 dump 进日志
- 多台主机时禁止静默猜生产机；无 tag 匹配则问用户
