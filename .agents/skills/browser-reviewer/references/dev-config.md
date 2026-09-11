# `.dev` 配置约定

本地开发与走查的**配置真源**（含多环境地图）。仓库根目录 `.dev/`（必须被 gitignore）。

用途：

| 用途 | 谁读 |
|------|------|
| 真机走查目标 | [browser-reviewer](../SKILL.md)（只打 `active_env`） |
| 剧本写边界 | [scenario-playbook](../../scenario-playbook/SKILL.md) |
| 人读环境地图 | 本机 / 测试 / 生产的 URL、部署位置、日志入口、连接摘要 |

初始化用 [create-dev-config](../../create-dev-config/SKILL.md)。

## 推荐结构

```
.dev/
├── config.yaml          # 主配置（环境地图 + 走查目标）
├── secrets.env          # 仅密钥（按环境分前缀）
├── baselines/           # 可选：像素金样
│   └── _candidates/     # 新页自动收录的候选金样，待人确认后转正（建议 gitignore）
├── playbooks/           # 可选：scenario-playbook 产出
└── walkthrough/         # 运行产物（必 gitignore）
```

`config.yaml` 另有顶层 `integrations:` 段（第三方服务凭据的**变量名**登记，与走查无关，本文忽略）——
其 schema 真源在 [create-dev-config/references/write-checklist.md](../../create-dev-config/references/write-checklist.md) §3.1。

若仓内已有习惯（如 `.dev/admin.json`），Agent 应**适配读取**并在 Dev Card 写明映射；新仓按本约定初始化。

## 设计原则

1. **`environments` = 地图**（local / staging / prod …）；**`active_env` = 走查枪口**（默认 `local`）。
2. **顶栏 `app` / `auth` / `external`** = 从 `active_env` **同步**出的走查快捷字段（兼容旧消费者）；改环境后须重同步或改 `active_env`。
3. **生产默认只读地图**：可写 browser/api/日志/部署位置；**默认不写生产密码**；**默认禁止**把 `active_env` 设为 `prod` 做 browser-reviewer。
4. **连接信息**：只写 host/port/库名/主题等非密；密码/Token 一律 `*_env` → `secrets.env`。
5. 密钥不出报告；`.dev` 不入库（或至少 secrets + 含密 yaml 不入库）。

## `config.yaml` schema

```yaml
# .dev/config.yaml
project:
  name: my-console
  owner: ""                    # 可选：负责人/团队
  docs:                        # 可选：相关文档
    arch: docs/arch.md
    runbook: docs/service/api.md

# 走查 / 剧本默认瞄准的环境（禁止默认 prod）
active_env: local              # local | staging | prod | <自定义>

environments:
  local:
    kind: local                # local | staging | production | other
    label: 本机开发
    # —— 访问 ——
    browser_url: http://127.0.0.1:5173
    api_url: http://127.0.0.1:8080
    health_url: http://127.0.0.1:8080/healthz   # 可选
    ready_url: http://127.0.0.1:8080/ready      # 可选
    # —— 本机启动（仅 local 常用）——
    start: npm run dev
    start_cwd: fe
    ready_timeout_sec: 120
    # —— 部署（local 可省略）——
    deploy:
      location: ""             # 如 k8s ns、主机名、云项目
      method: ""               # helm / compose / systemd / 流水线名
      region: ""
      link: ""                 # 部署控制台或流水线 URL
      # 以下可选键由 create-dev-config 阶段 D 填写；本 Skill（走查）忽略
      # script / ssh_host / remote_root / remote_root_env / health_path
      # 顶层 release: 见 create-dev-config/references/release-deploy-schema.md
    # —— 可观测 ——
    logs:
      url: ""                  # 日志查询页（Grafana/Loki/云日志…）
      query_hint: ""           # 如 '{app="console"}' 或过滤提示
    metrics_url: ""
    traces_url: ""
    # —— 网络与跳板 ——
    network:
      vpn_or_bastion: none     # none | required | optional
      note: ""                 # 如「需连公司 VPN」
      kubectl_context: ""      # 仅上下文名，禁止贴 kubeconfig
      cloud_account: ""        # 账号/订阅名，非密钥
    # —— 依赖连接（非密）——
    connections:
      - name: postgres
        kind: db               # db | redis | mq | s3 | other
        host: 127.0.0.1
        port: 5432
        database: app
        note: ""
      # - name: redis
      #   kind: redis
      #   host: 127.0.0.1
      #   port: 6379
    # —— 该环境登录（可覆盖全局）——
    auth:
      strategy: form
      login_path: /login
      username: admin
      password_env: DEV_ADMIN_PASSWORD
    # —— 该环境走查边界 ——
    walkthrough:
      enabled: true
      allow_writes: false
      allow_destructive: false
    notes: ""

  staging:
    kind: staging
    label: 远端测试
    browser_url: https://console.staging.example.com
    api_url: https://api.staging.example.com
    health_url: https://api.staging.example.com/healthz
    deploy:
      location: k8s/ns-staging
      method: helm
      region: cn-hangzhou
      link: https://ci.example.com/staging
    logs:
      url: https://grafana.example.com/d/logs
      query_hint: '{namespace="staging",app="console"}'
    metrics_url: https://grafana.example.com/d/metrics
    traces_url: ""
    network:
      vpn_or_bastion: required
      note: 需 VPN
      kubectl_context: staging
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
    notes: 测试数据可清；勿用生产账号

  prod:
    kind: production
    label: 生产
    browser_url: https://console.example.com
    api_url: https://api.example.com
    health_url: https://api.example.com/healthz
    deploy:
      location: k8s/ns-prod
      method: helm
      region: cn-hangzhou
      link: https://ci.example.com/prod
    logs:
      url: https://grafana.example.com/d/prod-logs
      query_hint: '{namespace="prod",app="console"}'
    metrics_url: https://grafana.example.com/d/prod-metrics
    traces_url: ""
    network:
      vpn_or_bastion: required
      kubectl_context: prod
      cloud_account: ""
    connections: []           # 生产连接摘要可选；密码禁止
    # 生产默认不写 auth 密码字段
    auth:
      strategy: form
      login_path: /login
      username: ""             # 可选占位；密码勿填
      # password_env: 禁止默认配置生产密码
    walkthrough:
      enabled: false           # 默认禁止真机走查打生产
      allow_writes: false
      allow_destructive: false
    notes: 仅运维地图；走查勿切 active_env=prod

# —— 走查快捷区：与 active_env 同步（消费者可读这里）——
app:
  name: my-console
  base_url: http://127.0.0.1:5173    # = environments[active].browser_url
  start: npm run dev                   # 仅 local 有意义
  start_cwd: fe
  ready_timeout_sec: 120

auth:
  strategy: form
  login_path: /login
  username: admin
  password_env: DEV_ADMIN_PASSWORD
  selectors:
    username: "input[name='username']"
    password: "input[type='password']"
    submit: "button[type='submit']"
  success:
    url_includes: /dashboard
    selector: "[data-testid='app-shell']"

external:
  api_base: http://127.0.0.1:8080     # = environments[active].api_url

viewport:
  desktop: { width: 1440, height: 900 }
  # tablet / mobile 声明了才抽检

walkthrough:
  allow_writes: false                  # 与 active 环境对齐；取更严
  allow_destructive: false
  allow_prod: false                    # true 才允许 active_env=prod（须用户明示）
  console_warning_allowlist:
    - "Download the React DevTools"
  network_ignore_url_substrings:
    - "googletagmanager"
  baseline_dir: .dev/baselines
  artifact_dir: .dev/walkthrough
  pixel:
    mode: perceptual
    threshold: 0.01

roles:
  - id: admin
    username: admin
    password_env: DEV_ADMIN_PASSWORD
```

### 解析规则（消费者）

1. 若存在 `environments` + `active_env`：以该环境的 `browser_url` / `api_url` / `auth` / `walkthrough` 为准；顶栏 `app`/`auth`/`external` 应为同步副本。  
2. 仅有旧式 `app.base_url`（无 `environments`）：仍可用；Dev Card 注明「无环境地图」。  
3. `active_env` 指向 `kind: production` 或 id=`prod` 时：若 `walkthrough.allow_prod` 不为 true → **拒绝走查**，提示改 `active_env` 或走 create-dev-config。  
4. 环境 `walkthrough.enabled: false` → 不可作为 active 走查目标。

## 必填项

### 最小可走查（P0）

| 键 | 说明 |
|----|------|
| `active_env` + 对应 `environments.*.browser_url` **或** `app.base_url` | 可打开的前端 URL |
| 该环境 / 顶栏 `auth.username` + 密码来源 | `password` 或 `password_env`（生产地图可无密码） |
| form 时 `login_path` | |

### 推荐环境地图（P1 体检可缺，但不算「地图完整」）

| 环境 | 建议有 |
|------|--------|
| local | browser_url、api_url、start（若需）、auth |
| staging | browser_url、api_url、deploy 摘要、logs.url、network.vpn |
| prod | browser_url、api_url、deploy、logs.url；**无密码**；walkthrough.enabled=false |

`connections` / metrics / traces / owner 可待确认。

## `secrets.env`（可选）

```bash
DEV_ADMIN_PASSWORD=...
STAGING_ADMIN_PASSWORD=...
# 禁止默认：PROD_ADMIN_PASSWORD
DEV_API_TOKEN=...
```

按环境用前缀：`DEV_` / `STAGING_` /（生产密钥不进 `.dev`，用团队密钥库）。

## Gitignore 检查

推荐：

```
.dev/
```

至少：

```
.dev/secrets.env
.dev/walkthrough/
```

密码文件已被 git 跟踪 → **P0**。

## 初始化（人工）

用 [create-dev-config](../../create-dev-config/SKILL.md)：先收敛最小走查，再按需补全多环境地图。

## Dev Card 字段（Phase 0）

| 项 | 来源 |
|----|------|
| active_env / 地图是否完整 | environments |
| base_url / 可达性 | active browser_url 或 app |
| api_url | active api_url / external |
| 登录 | auth（密码仅「已加载」） |
| 部署 / 日志入口 | active deploy、logs（摘要） |
| VPN | network |
| allow_writes / allow_prod | walkthrough |
| viewport / baseline / 浏览器后端 | 同前 |
