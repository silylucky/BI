# `.dev` 落盘检查清单

Schema：[dev-config.md](../../browser-reviewer/references/dev-config.md)。

## 1. 目录

```
.dev/
├── config.yaml
├── secrets.env
├── baselines/      # 可选
├── playbooks/      # 可选
└── walkthrough/    # 可选，产物
```

## 2. 写入时同步规则

1. 写完 / 改完 `environments` 与 `active_env` 后，**同步顶栏**：
   - `app.name` ← `project.name`
   - `app.base_url` ← `environments[active].browser_url`
   - `app.start` / `start_cwd` ← 仅当 active 为 local 且有值
   - `external.api_base` ← `environments[active].api_url`
   - `auth` ← `environments[active].auth`（若有）
   - `walkthrough.allow_*` ← 与 active 环境对齐（取更严：任一 false 则 false）
2. `prod` / `kind: production`：`walkthrough.enabled=false`；无 `password` / 无生产 `password_env`（除非用户明示 allow_prod 且书面确认——仍强烈不推荐）
3. `walkthrough.allow_prod` 默认 `false`

## 3. 最小示例（local + 地图骨架）

```yaml
project:
  name: my-console

active_env: local

environments:
  local:
    kind: local
    label: 本机开发
    browser_url: http://127.0.0.1:5173
    api_url: http://127.0.0.1:8080
    start: npm run dev
    start_cwd: fe
    ready_timeout_sec: 120
    deploy: { location: "", method: "", region: "", link: "" }
    logs: { url: "", query_hint: "" }
    network: { vpn_or_bastion: none, note: "", kubectl_context: "" }
    connections: []
    auth:
      strategy: form
      login_path: /login
      username: admin
      password_env: DEV_ADMIN_PASSWORD
    walkthrough:
      enabled: true
      allow_writes: false
      allow_destructive: false

  staging:
    kind: staging
    label: 远端测试 / 演示机
    browser_url: https://staging.example.com   # 待确认可先占位；有 deploy_dev 时用脚本末尾 URL
    api_url: ""
    deploy:
      location: ""
      method: ""
      region: ""
      link: ""
      # 有 scripts/deploy_dev.sh 时由阶段 D 填写（消费方：deploy-dev）
      # script: scripts/deploy_dev.sh
      # ssh_host: ontomind@192.168.10.22
      # remote_root: /opt/apps/my-app
      # remote_root_env: APP_ROOT
      # health_path: /login
    logs: { url: "", query_hint: "" }
    network: { vpn_or_bastion: required, note: "", kubectl_context: "" }
    connections: []
    auth:
      strategy: form
      login_path: /login
      username: admin
      password_env: STAGING_ADMIN_PASSWORD
    walkthrough:
      enabled: true
      allow_writes: false
      allow_destructive: false

  prod:
    kind: production
    label: 生产
    browser_url: https://example.com
    api_url: ""
    deploy: { location: "", method: "", region: "", link: "" }
    logs: { url: "", query_hint: "" }
    network: { vpn_or_bastion: required, note: "", kubectl_context: "" }
    connections: []
    auth:
      strategy: form
      login_path: /login
      username: ""
    walkthrough:
      enabled: false
      allow_writes: false
      allow_destructive: false

# 有 scripts/release.sh 时由阶段 D 填写（消费方：release-package）
# release:
#   script: scripts/release.sh
#   mc_alias: s3
#   s3_prefix: release/projects/nex/amd64/linux
#   goos: linux
#   goarch: amd64
#   product_slug: my-app
#   platforms: []
#   notes: ""

app:
  name: my-console
  base_url: http://127.0.0.1:5173
  start: npm run dev
  start_cwd: fe
  ready_timeout_sec: 120

auth:
  strategy: form
  login_path: /login
  username: admin
  password_env: DEV_ADMIN_PASSWORD
  success:
    url_includes: /

external:
  api_base: http://127.0.0.1:8080

walkthrough:
  allow_writes: false
  allow_destructive: false
  allow_prod: false
  artifact_dir: .dev/walkthrough
  baseline_dir: .dev/baselines
  pixel:
    mode: perceptual
    threshold: 0.01

viewport:
  desktop: { width: 1440, height: 900 }
```

## 3.1 `integrations`（第三方凭据登记 · 顶层段）

**只登记变量名与状态，永不写值。** 消费方：integration-research / go-fast 契约验真门。

```yaml
integrations:
  - name: 阿里云 OSS               # 规范名（与简报「术语对齐」一致）
    slug: objstore-oss             # ↔ docs/integrations/<slug>.md
    purpose: 工单附件存储
    env: sandbox                   # sandbox | production | self_hosted —— 这套凭据打向哪
    endpoint: https://oss-cn-hangzhou.aliyuncs.com   # 真实/沙箱端点；禁止填本地 mock
    credential: have               # have | need | blocked
    credential_env: [OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET]   # 只记变量名；值在 secrets.env 或密钥库
    obtain: ""                     # credential != have 时必填：谁在哪个控制台开
    smoke: contracts/objstore-oss.smoke.sh
    last_smoke: ""                 # 可空；最近一次成功 smoke 工件 .evidence/<run_id>/…
    notes: ""
```

缺凭据的条目同结构，只是 `credential: need|blocked` + `obtain` 写清谁在哪开、`last_smoke` 留空 —— **该依赖一律不得标已对接**。无第三方依赖时整段可省略；`inventory-only` 模式只允许追加此类占位条目。

## 3.2 `release:` 与 `deploy` 脚本扩展（阶段 D）

完整字段与扫仓规则见 [release-deploy-schema.md](release-deploy-schema.md)。

```yaml
release:
  script: scripts/release.sh
  mc_alias: s3
  s3_prefix: release/projects/nex/amd64/linux   # 约定 release/projects/<slug>/<arch>/<os>；完整 = ${mc_alias}/${s3_prefix}/…
  goos: linux
  goarch: amd64
  product_slug: ark
  platforms: []
  notes: ""

environments:
  staging:
    deploy:
      location: "192.168.10.22"
      method: ssh+rsync+systemd-user
      script: scripts/deploy_dev.sh
      ssh_host: ontomind@192.168.10.22
      remote_root: /opt/apps/ark
      remote_root_env: ARK_ROOT
      health_path: /login
```

无对应脚本时整段/扩展键可省略。禁止写入 SSH 私钥或云 AK/SK。

占位 URL 在预览中标 `（待确认）`；用户跳过的环境可只留空字符串，不要删键（便于下次补地图）。

## 4. `secrets.env`

```bash
DEV_ADMIN_PASSWORD=...
STAGING_ADMIN_PASSWORD=...
# 第三方沙箱凭据：变量名须与 integrations[].credential_env 完全一致
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
```

禁止默认写入 `PROD_*` 密码；禁止无人值守写入本文件（`inventory-only` 只列变量名，不落值）。

## 5. `.gitignore`

推荐：

```
.dev/
```

## 6. 写入后自检

| 检查 | 通过 |
|------|------|
| active 的 browser_url 或 app.base_url 非空 | ✓ |
| 顶栏 app/auth/external 与 active 一致 | ✓ |
| 非 prod 走查：有密码来源 | ✓ |
| prod：enabled=false；无生产密码字段 | ✓ |
| allow_prod 默认 false | ✓ |
| connections 无明文密码 | ✓ |
| **integrations 段无明文密钥**（只有 `credential_env` 变量名；无 `AKIA…`/`sk-…`/`Bearer …`/长随机串） | ✓ |
| integrations 每条 `credential != have` 时 `obtain` 非空；`endpoint` 非 localhost/mock | ✓ |
| `credential_env` 变量名与 `secrets.env` / 密钥库、smoke 脚本内读取名三处一致 | ✓ |
| 有 `deploy_dev.sh` → 演示环境 `deploy.ssh_host` + `remote_root` 已填（或用户书面跳过） | ✓ |
| 有 `release.sh` → 顶层 `release.mc_alias` + `s3_prefix` 已填（或用户书面跳过） | ✓ |
| `release` / `deploy` 扩展段无云密钥、无 SSH 私钥 | ✓ |
| secrets / `.dev` 被 ignore；未被 git 跟踪含密文件 | ✓ |

## 7. 禁止

- 把生产密码、kubeconfig、云 AK/SK 写入 yaml  
- 未确认覆盖精修 `.dev`  
- commit 含密钥的 `.dev` 文件  
- 静默将 `active_env` 设为 prod  
- 无人值守把 `credential` 标 `have`、编造变量值、或让 `endpoint` 指向本地 mock 以求 smoke「过」
