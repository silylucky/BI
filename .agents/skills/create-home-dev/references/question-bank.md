# 问题库与侦察默认

一次只问**一题**。先侦察再填推荐。

## 侦察（提问前）

| 目标 | 做什么 |
|------|--------|
| 已有台账 | 读 `$HOME/.dev/config.yaml`；列各类 count 与 `credential: need` |
| SSH 别名 | 若存在 `~/.ssh/config`，只解析 `Host` / `HostName` / `User` / `Port` / `ProxyJump` 作推荐；**禁止**读 `IdentityFile` 指向的私钥内容 |
| mc | 若 `mc` 在 PATH：`mc alias list` 得 alias 名（不采密钥） |
| 环境变量名 | 本机会话已 export 的 `*_PASSWORD` / `AWS_*` 等**仅作变量名提示**，不把值写入 yaml 或报告 |

---

## H0 · 元信息

### H0.1 · 台账标签

> 给这份家目录台账起个短标签？  
> **推荐**：`<用户名> 本机台账`  
> A) 推荐  B) 我提供  C) 跳过

→ `owner.label` / `owner.notes`

---

## H1 · SSH 设备

### H1.0 · 要登哪些

> 要登记哪些 SSH 可达设备？（可多选 / 稍后逐台补）  
> **推荐**：把 `~/.ssh/config` 里非 github/gitlab 的 Host 列出来供勾选  
> A) 用推荐列表  B) 我口述 IP  C) 暂无 SSH，跳过 H1

### H1.x.1 · 连接串

> 【&lt;label&gt;】SSH 目标？格式 `user@host`  
> **推荐**：扫到的 User@HostName  
> A) 推荐  B) 我提供

→ `hosts[].ssh` + 生成 `id`（如 `host-192-168-10-22` 或用户给的短名）

### H1.x.2 · 端口与跳板

> 【&lt;id&gt;】端口与跳板？  
> **推荐**：22；无跳板  
> A) 推荐  B) 端口…  C) 跳板为已登记某 host id

### H1.x.3 · 标签与 remote_root

> 【&lt;id&gt;】标签（demo/staging/lab…）与已知远程应用根？  
> A) 仅标签  B) 标签 + remote_root  C) 跳过

### H1.x.4 · 认证

> 【&lt;id&gt;】SSH 怎么认证？  
> **推荐**：A agent/已有 key  
> A) ssh-agent / 默认 key  B) 指定 key 路径提示（只记 hint）  C) 密码（只登记 `credential_env` 变量名）

→ `auth` / `identity_file_hint` / `credential_env`；C 时 `credential: need` 直到用户确认 secrets 已填

问完一台 → 「还有下一台吗？」→ 是则循环，否则进 H2 或结束。

---

## H2 · 对象存储

### H2.0

> 要登记外部对象存储吗？（S3 / MinIO / OSS / COS…）  
> A) 是（进入逐条）  B) 跳过  C) 用 `mc alias list` 推荐

### H2.x

逐条问：`kind` → `endpoint`/`region` → `mc_alias` → `bucket_or_prefix` → `credential_env` 变量名 → `credential` 是否已有值在 secrets。

---

## H3 · 数据库

### H3.0

> 要登记外部数据库吗？（MySQL / PostgreSQL / TiDB…）  
> A) 是  B) 跳过

### H3.x

`engine` → `host:port` → `database` → `username` → `ssl_mode`（可选）→ `credential_env` → 状态。

**生产库**：默认只登主机与账号名，`credential: need`，不收密码值。

---

## H4 · 观测

### H4.0

> 要登记外部日志 / 指标 / Trace 入口吗？  
> A) 日志  B) 指标  C) Trace  D) 多选继续  E) 跳过

每条：`kind` + `url` + 可选 `query_hint` + `credential_env`。

---

## H5 · 身份与通用集成

### H5.0

> 要登记可认证身份源或其它外部服务吗？  
> A) LDAP  B) OAuth/OIDC  C) 其它（integrations）  D) 跳过

### LDAP

`host:port` → TLS → `base_dn` → `bind_dn` → `credential_env`

### OAuth/OIDC

`kind` → `issuer` → `client_id` → `scopes` → `credential_env`（client secret 变量名）

### 通用 integrations

与 create-dev-config 阶段 C 同构：`name`/`slug`/`purpose`/`endpoint`/`credential_env`/`credential`/`obtain`

---

## 体检提问（已有台账）

不主动重问已填字段。输出缺口表后只问：

> 要补哪一类？  
> A) SSH  B) 对象存储  C) 数据库  D) 观测  E) 身份  F) 只对齐 secrets 键名  G) 全部不补

---

## 变量名推荐惯例

| 资源 | 推荐 env 名 |
|------|-------------|
| SSH 密码 | `SSH_<ID_UPPER>_PASSWORD` |
| S3 | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` 或厂商前缀 |
| Postgres | `PGPASSWORD` |
| MySQL | `MYSQL_PWD` 或 `MYSQL_PASSWORD` |
| LDAP bind | `LDAP_BIND_PASSWORD` |
| OIDC | `OIDC_CLIENT_SECRET` |
