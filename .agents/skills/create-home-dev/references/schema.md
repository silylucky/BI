# 家目录 `~/.dev` Schema

路径：`$HOME/.dev/`（展开后的绝对路径写入回传 `home_dev`）。

```
~/.dev/
├── config.yaml      # 台账本体（无密）
└── secrets.env      # 本地密钥；权限 0600；永不进 git
```

## 顶层结构

```yaml
schema_version: 1

owner:
  label: ""            # 如「Kevin 本机台账」
  notes: ""

hosts: []              # H1 SSH 设备
object_storage: []     # H2
databases: []          # H3
observability:
  logs: []
  metrics: []
  traces: []
identity:
  ldap: []
  oauth: []
integrations: []       # H5 通用（短信/支付/厂商 API…）
```

无某类资源时保留空数组或省略该键均可；推荐**保留空数组**便于下次补。

---

## `hosts[]`（SSH 可达设备）

```yaml
hosts:
  - id: demo-22                 # 稳定短 id；消费方引用用此 id
    label: 演示机
    ssh: ontomind@192.168.10.22 # user@host 或仅 host
    port: 22
    bastion: ""                 # 另一 hosts[].id；无则空
    tags: [demo, staging]
    remote_roots:               # 已知应用根（可选）
      - /opt/apps
    auth: agent                 # agent | key | password
    identity_file_hint: ""      # 仅路径提示如 ~/.ssh/id_ed25519；禁止写入私钥内容
    credential_env: []          # auth=password 时如 [SSH_DEMO_PASSWORD]
    credential: have            # have | need | blocked（password/key 密语是否齐）
    notes: ""
```

---

## `object_storage[]`

```yaml
object_storage:
  - id: s3-release
    kind: s3                    # s3 | minio | oss | cos | other
    label: 发布桶
    endpoint: https://s3.example.com
    region: ""
    mc_alias: s3                # 供 release.sh / mc 使用
    bucket_or_prefix: release/projects
    credential_env: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY]
    credential: have
    obtain: ""                  # credential != have 时必填
    notes: ""
```

---

## `databases[]`

```yaml
databases:
  - id: pg-lab
    engine: postgres            # mysql | postgres | tidb | mariadb | other
    label: 实验 Postgres
    host: 192.168.10.30
    port: 5432
    database: app
    username: app
    ssl_mode: prefer            # disable | prefer | require | …；不明可空
    tags: [lab]
    credential_env: [PGPASSWORD]
    credential: need
    obtain: "找 DBA 开只读账号"
    notes: ""
```

MySQL 示例变量名：`MYSQL_PWD` 或项目约定的 `MYSQL_PASSWORD`（与消费方脚本一致即可）。

---

## `observability`

```yaml
observability:
  logs:
    - id: loki-lab
      kind: loki                # loki | elasticsearch | sls | cloudwatch | other
      label: 实验室志
      url: https://loki.example.com
      query_hint: '{app="my-app"}'
      credential_env: []
      credential: have
      notes: ""
  metrics:
    - id: grafana-lab
      kind: grafana
      url: https://grafana.example.com
      credential_env: [GRAFANA_TOKEN]
      credential: need
      obtain: ""
      notes: ""
  traces:
    - id: tempo-lab
      kind: tempo               # jaeger | tempo | otlp | other
      url: https://tempo.example.com
      credential_env: []
      credential: have
      notes: ""
```

---

## `identity`

```yaml
identity:
  ldap:
    - id: corp-ldap
      label: 公司 LDAP
      host: ldap.example.com
      port: 636
      use_tls: true
      base_dn: dc=example,dc=com
      bind_dn: cn=readonly,ou=svc,dc=example,dc=com
      credential_env: [LDAP_BIND_PASSWORD]
      credential: need
      obtain: ""
      notes: ""
  oauth:
    - id: corp-oidc
      kind: oidc                # oidc | oauth2
      label: 公司 OIDC
      issuer: https://sso.example.com/realms/main
      client_id: my-console
      scopes: [openid, profile]
      credential_env: [OIDC_CLIENT_SECRET]
      credential: need
      obtain: ""
      notes: ""
```

---

## `integrations[]`（通用可认证外部服务）

与仓库 `.dev` 的 integrations 同纪律：**只记变量名**。

```yaml
integrations:
  - name: 短信网关
    slug: sms-gateway
    purpose: 验证码
    endpoint: https://sms.example.com
    credential_env: [SMS_API_KEY]
    credential: need
    obtain: ""
    notes: ""
```

---

## `secrets.env`

```bash
# 键名必须与上述 credential_env 完全一致
# SSH_DEMO_PASSWORD=...
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# PGPASSWORD=...
# LDAP_BIND_PASSWORD=...
# OIDC_CLIENT_SECRET=...
```

Agent 落盘时默认只追加**缺失的键名行**（值为空或注释占位）；**不**把用户口头说的秘密回显进聊天记录的可提交产物。

---

## 禁止出现在 `config.yaml` 的内容

- 密码、AK/SK、Bearer Token、连接串含密（`postgres://user:pass@…`）
- SSH 私钥 / kubeconfig 全文
- 客户真实 PII
