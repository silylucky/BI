# `~/.dev` 落盘检查清单

Schema：[schema.md](schema.md)。

## 1. 目录

```
$HOME/.dev/
├── config.yaml
└── secrets.env
```

创建目录：`mkdir -p "$HOME/.dev"`。  
建议权限：`chmod 700 "$HOME/.dev"`；`chmod 600 config.yaml secrets.env`。

## 2. 最小示例

```yaml
schema_version: 1

owner:
  label: Kevin 本机台账
  notes: ""

hosts:
  - id: demo-22
    label: 演示机
    ssh: ontomind@192.168.10.22
    port: 22
    bastion: ""
    tags: [demo, staging]
    remote_roots:
      - /opt/apps
    auth: agent
    identity_file_hint: ""
    credential_env: []
    credential: have
    notes: ""

object_storage:
  - id: s3-release
    kind: s3
    label: 发布
    endpoint: ""
    region: ""
    mc_alias: s3
    bucket_or_prefix: release/projects
    credential_env: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY]
    credential: need
    obtain: "从团队密钥库取发布账号"
    notes: ""

databases: []

observability:
  logs: []
  metrics: []
  traces: []

identity:
  ldap: []
  oauth: []

integrations: []
```

## 3. `secrets.env`

- 仅追加**缺失键名**；已有键不覆盖值
- 键名与各条 `credential_env` 完全一致
- 禁止把值写进 `config.yaml`、报告、回传块

```bash
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
```

## 4. id 稳定性

- `id` 一经写入，下游可能引用（如项目 `.dev` 注释 `home_ref: hosts/demo-22`）
- 改连接信息可改 `ssh`/`host`；**不要随意改 id**；废弃则加 `notes: deprecated` 或移入注释块，勿默删被引用项

## 5. 写入后自检

| 检查 | 通过 |
|------|------|
| `config.yaml` 无密码/AKSK/Token/含密 URL | ✓ |
| 每条需密资源有 `credential_env`（或明确 auth=agent/key 且 credential=have） | ✓ |
| `credential != have` 时 `obtain` 非空（或用户书面跳过） | ✓ |
| `secrets.env` 含全部 have 所需键（值可暂空，但键在）或用户确认外置密钥库 | ✓ |
| 目录/文件权限不是 world-readable（能改则改） | ✓ |
| 未建议把 `~/.dev` 加入任何仓库 git | ✓ |

## 6. 禁止

- 未确认覆盖精修整个 `config.yaml`
- 读取并粘贴 SSH 私钥 / kubeconfig
- 无人值守写入秘密值或把 `credential` 标 `have`
- 在聊天可提交产物中回显用户粘贴的密钥
