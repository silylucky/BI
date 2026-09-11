---
name: create-dev-config
description: >
  苏格拉底式交互创建、体检或修订仓库根目录 .dev：多环境地图（本机/测试/生产）、浏览器与
  API 访问、部署位置、连接摘要、日志/指标入口、走查用 active_env 与账号密钥，第三方
  集成凭据登记（integrations：只记 env 变量名与状态，不记值），以及演示部署/发布打包
  （scripts/deploy_dev.sh → deploy.ssh_host/remote_root；scripts/release.sh → 顶层 release）。
  一次只问一个问题，先扫仓推断默认值，写入前预览确认；已有 .dev 时体检并提示可补脚本缺口；
  禁止默认写入生产密码；无人值守只允许 mode=inventory-only。
  Use when initializing .dev, multi-env setup, staging/prod URLs, deploy/log links, missing
  base_url or admin password for walkthrough, browser-reviewer blocked on .dev, go-fast 开工前
  0.6 缺第三方凭据归属地, deploy_dev/release 脚本缺 .dev 字段, or user asks for 初始化.dev /
  环境地图 / 配置走查账号 / 登记集成凭据 / 补全 .dev / 补演示部署与发布配置 — Console/Admin/SPA.
---

# Create Dev Config（人工交互 · `.dev`）

苏格拉底式引导用户产出或修好**仓库根** `.dev/`：既是**环境地图**（本机 / 测试 / 生产的访问、部署、日志、连接），是**走查枪口**（`active_env` + 账号），是**第三方凭据归属地**（`integrations` 只登记变量名与状态），也是**演示部署 / S3 发布**的脚本参数真源（阶段 D）。

- **Schema 真源**：走查相关键见 [browser-reviewer/references/dev-config.md](../browser-reviewer/references/dev-config.md)；**`integrations:` / `release:` / `deploy` 脚本扩展键**为本 Skill 定义（browser-reviewer 忽略），格式见 [write-checklist.md](references/write-checklist.md) 与 [release-deploy-schema.md](references/release-deploy-schema.md)
- **禁止**：默认写入生产密码；未确认把 `active_env` 设为生产并开启走查；无人值守写入任何凭据值（仅允许 `mode=inventory-only`，见下）

与姊妹 skill：

| Skill | 关系 |
|-------|------|
| **本 Skill** | 交互写出/修好**仓库根** `.dev`（地图 + 走查目标 + 集成凭据 + 发布/演示部署参数） |
| [create-home-dev](../create-home-dev/SKILL.md) | **家目录** `~/.dev` 基础设施台账（SSH / S3 / DB / 日志·Trace / LDAP·OAuth）；阶段 D 与 integrations 可从中选源，见 [consume.md](../create-home-dev/references/consume.md) |
| [scenario-playbook](../scenario-playbook/SKILL.md) | 读 active 环境的 allow_* / roles |
| [browser-reviewer](../browser-reviewer/SKILL.md) | 只打 `active_env`；缺配置先本 Skill |
| [integration-research](../integration-research/SKILL.md) / [go-fast](../go-fast/SKILL.md) | 读 `integrations[].credential_env` 取变量名跑 smoke；**不回写**本文件 |
| [deploy-dev](../deploy-dev/SKILL.md) | 读 staging（或 demo）`deploy.ssh_host` / `remote_root` 跑 `deploy_dev.sh` |
| [release-package](../release-package/SKILL.md) | 读顶层 `release:` 跑 `release.sh` 打包上传 S3 |

## 何时使用

| 场景 | 动作 |
|------|------|
| `.dev` 不存在 | **新建**：最小走查 →（推荐）环境地图 →（有脚本则）阶段 D → 预览落盘 |
| 只有本机 URL、缺测试/生产地图 | **补地图**：只问环境相关 |
| 缺必填（browser_url / 账号） | **补缺** |
| 已有 `.dev`，仓内有 `deploy_dev.sh`/`release.sh` 但字段缺 | **体检**列出缺口 + 推荐默认 → 用户确认后补 |
| 切换走查目标环境 | **修订** `active_env` + 同步顶栏 app/auth |
| browser-reviewer 发现缺 `.dev` | 停走查，转本 Skill |
| go-fast 开工前 0.6 / smoke 缺第三方凭据 | **补 `integrations`**：attended 问齐；unattended 走 `inventory-only` |
| deploy-dev / release-package 缺参数 | **补阶段 D**；给齐默认值再问 |

## 工作模式

| 模式 | 触发 | 输出 |
|------|------|------|
| 新建 | 无 config.yaml | 完整骨架 + gitignore + secrets |
| 补缺 / 补地图 | 缺必填或缺 environments | 最小 diff |
| 体检 | 用户要求检查 / 重复执行且已有 `.dev` | 走查可跑分 + 地图完整度 + **脚本可执行缺口**；默认不写，提示可补 |
| 修订 | 用户确认改某项 | 逐条确认 |

## 提问纪律（苏格拉底式）

1. **一次只问一个问题**；选项 + **推荐项**
2. 先只读扫仓（[question-bank.md](references/question-bank.md)）
3. 跳过 → 用推荐，预览标 `（待确认）`
4. **写入前**脱敏预览 → 明确确认
5. 密码优先 `password_env` + `secrets.env`；**生产默认不收密码**
6. 两阶段：`A 最小可走查` 可先落盘；`B 环境地图` 可同会话继续或下次补

## 两阶段收敛

### 阶段 A · 最小可走查（必做）

| 顺序 | 主题 | 写入 |
|------|------|------|
| A1 | 走查瞄准哪套环境 | `active_env`（推荐 `local`） |
| A2 | 该环境浏览器 URL | `environments.*.browser_url` + `app.base_url` |
| A3 | 启动命令（local） | `start` / `start_cwd` 或手动 |
| A4 | 登录方式 | `auth` |
| A5 | 用户名 | `auth.username` |
| A6 | 密码存放 | `password_env` / secrets（非 prod） |
| A7 | 写操作边界 | `walkthrough.allow_*` |
| A8 | API URL（可选） | `api_url` / `external.api_base` |

### 阶段 B · 环境地图（强烈推荐）

| 顺序 | 主题 | 写入 |
|------|------|------|
| B0 | 要建哪些环境 | `local` / `staging` / `prod` 多选 |
| B1… | 每环境：browser + api | `browser_url` / `api_url` |
| B2… | 每环境：部署位置/方式/链接 | `deploy` |
| B3… | 每环境：日志（+ 可选指标/链路） | `logs` / `metrics_url` / `traces_url` |
| B4… | 每环境：VPN/跳板/kubectl 名 | `network` |
| B5… | 每环境：依赖连接摘要（非密） | `connections` |
| B6… | health/ready（可选） | `health_url` / `ready_url` |
| B7 | 项目 owner / 文档链接（可选） | `project` |
| B8 | 生产确认 | `walkthrough.enabled=false`；无生产密码；`allow_prod=false` |

### 阶段 C · 集成凭据登记（有第三方依赖时必做）

管**仓外**服务（OAuth/IdP、短信、对象存储、支付、厂商 API…）的凭据**归属地**。与 `connections`（本系统依赖的主机端口摘要，非密）分工不同：`integrations` 面向外部契约与 smoke。

逐服务问四题（C1 有哪些 → Cx.1 用途/端点 → Cx.2 **env 变量名** → Cx.3 拿得到吗 → Cx.4 smoke 路径），写入 `integrations[]` 的 `name`/`slug`/`purpose`/`env`/`endpoint`/`credential_env[]`/`credential`/`obtain`/`smoke`。

**铁律**：`config.yaml` 里**只有变量名**；值走 `.dev/secrets.env`（gitignore）或团队密钥库。任何形如 `AKIA…` / `sk-…` / `Bearer …` 的字面量出现在 yaml → P0。

细节：[question-bank.md](references/question-bank.md)。落盘：[write-checklist.md](references/write-checklist.md)。

### 阶段 D · 演示部署与发布打包（有对应脚本时必做）

仓内出现 `scripts/deploy_dev.sh` 和/或 `scripts/release.sh` 时进入。先读脚本头注释与默认 env 填推荐，**再问用户**（一次一题，选项含推荐）。

| 顺序 | 主题 | 写入 |
|------|------|------|
| D0 | 演示环境 id（有 deploy_dev 时） | 通常 `staging`；与 B0 对齐 |
| D1 | SSH 目标 / 远程根 | `deploy.ssh_host` / `remote_root` / `remote_root_env` / `script`；若 `$HOME/.dev` 有 `hosts[]`，选项优先从台账选（见 create-home-dev） |
| D2 | 演示机 browser_url（若空） | `environments.<id>.browser_url` + 同步 `deploy.location/method` 摘要 |
| D3 | 发布：mc alias + S3 前缀 | 顶层 `release.mc_alias` / `s3_prefix` / `script`；可从 `$HOME/.dev` 的 `object_storage[]` 选 |
| D4 | 发布：架构 / 产品 slug（可选） | `release.goos` / `goarch` / `product_slug` / `platforms` |

Schema 与扫仓表：[release-deploy-schema.md](references/release-deploy-schema.md)。

**已有 `.dev` 重复执行**：Phase 0 体检必须对照脚本列缺口；报告用「可补充」语气 + 推荐默认；用户说补再问、再写。无脚本 → 跳过 D，不造字段。

### 建议一并想过的补充项

阶段 A/B/C/D 未覆盖、值得顺带问或写进 `notes` 的：**多租户 tenant / 功能开关**（走查夹具）、**时区与测试数据策略**（staging 可否清数、是否含 PII）。其余（health/ready、指标 Trace、VPN、kubectl context、DB/Redis/MQ 端口、owner、CI 链接）已由阶段 B 各问覆盖，不再另列。

**不要塞进 `.dev`**：生产私钥、kubeconfig 全文、客户真实 PII、长期个人 Token、第三方 AK/SK 明文、SSH 私钥（一律用团队密钥库 / 本机 ssh-agent；`.dev` 只登记**变量名**、主机与路径）。

## `mode=inventory-only`（唯一允许的无人值守用法）

「禁止无人值守调用」的本意是**禁止 agent 自行编造/写入凭据**，不是让无人值守链路在缺凭据处彻底断掉 —— 断掉的结果反而是 agent 硬着头皮写「看起来接上了」的代码。故开一个受限口子：

| 项 | 规则 |
|----|------|
| 触发 | 调用方（go-fast / loop-*）传 `attendance=unattended` **且** `mode=inventory-only` |
| **只能做** | 只读扫仓 + 读已有 `.dev` → 盘点本批需要哪些第三方凭据 → 产出缺口清单（服务名 / 建议 env 变量名 / 获取方式 / `credential` 状态） |
| 允许写入 | **仅** `integrations[]` 中 `credential: need\|blocked` 的**占位条目**（`name`/`slug`/`purpose`/`endpoint`/`credential_env` 变量名/`obtain`/`smoke`），且 `credential_value` 类字段一律不存在 |
| **禁止** | 写任何凭据值；写 `secrets.env`；把 `credential` 标成 `have`；改 `active_env` / `auth` / `walkthrough` / 环境地图；创建 `.dev`（不存在 → 只回缺口清单，不落盘） |
| 出口 | 缺口清单进调用方 `blockers` + `external_deps[].credential=need`；对应依赖**不得**标已对接，走 `DONE_WITH_CONCERNS` 或 `park` |
| 完整交互模式 | 仍**必须** attended：问密码、定 `active_env`、生产相关一律停问 |

净效果：无人值守链路能推进到「**明确知道缺什么**」并停在那里，而不是假装接上了。

---

## 流程（必须）

### Phase 0 · 侦察

`.dev` 现状、gitignore、推断本机 URL/start/login/API；探测 `scripts/deploy_dev.sh` / `scripts/release.sh` 并解析默认 env → **Dev Setup Card**（含「脚本可执行」缺口行）。

**已有 `.dev`**：以体检为主——走查维 + 地图维 + 阶段 D 缺口表；默认不写文件，输出「可补充」清单（每项带推荐默认）。用户确认「补缺 / 补发布配置」后再进 Phase 1。

### Phase 1 · 提问

先 A；用户要「完整环境」或体检地图不完整 → 再 B；扫到第三方 SDK/`docs/integrations/` → 再 C；有 deploy/release 脚本 → 再 D。一次一问；D 各问**必须先给出扫仓推荐值**。

### Phase 2 · 预览

列出：`active_env`、各环境 URL、deploy/logs 是否填写、密码仅 secrets、生产无密码且走查关闭、`integrations` 仅变量名无值、`release` / 演示 `deploy.ssh_host` 是否齐。

### Phase 3 · 落盘

按 write-checklist；同步顶栏 `app`/`auth`/`external` 与 `active_env`；不 git add 密钥。

### Phase 4 · 交接

```markdown
## 下一步
- scenario-playbook → browser-reviewer（瞄准 active_env=…）
- 地图仍缺 staging/prod：可再说「补环境地图」
- 演示部署参数已齐：可用 deploy-dev（./scripts/deploy_dev.sh）
- 发布参数已齐：可用 release-package（./scripts/release.sh → S3）
- 脚本字段仍缺：可再说「补演示部署 / 补发布配置」
```

---

## 进度清单

```
- [ ] 0. 侦察 + Dev Setup Card（含脚本缺口）
- [ ] 1a. 阶段 A 最小可走查
- [ ] 1b. （推荐）阶段 B 环境地图
- [ ] 1c. （有第三方依赖时）阶段 C 集成凭据登记
- [ ] 1d. （有 deploy_dev/release 脚本时）阶段 D 演示部署与发布
- [ ] 2. 预览确认
- [ ] 3. 落盘 + gitignore + 生产安全自检
- [ ] 4. 交接
```

## 红线

- 未确认不写文件  
- **默认不收集、不写入生产密码**  
- **默认 `allow_prod: false`**；生产环境 `walkthrough.enabled: false`  
- 真实密码不进报告 / 可提交源码  
- `.dev` 含密且被 git 跟踪 → P0  
- 禁止自动化批量写密码；**无人值守只允许 `mode=inventory-only`**，禁止写入或编造任何凭据值、禁止把 `credential` 标成 `have`  
- `integrations` 只准出现 **env 变量名**；出现凭据字面量 → P0  

## 落盘位置

| 产物 | 位置 |
|------|------|
| 配置本体 | 仓库根 `.dev/`（`config.yaml` + gitignore 的 `secrets.env`） |
| 体检 / 缺口报告 | `docs/material/create-dev-config/<YYYY-MM-DD>-<slug>.md`（`slug` 如 `inventory` / `env-map`） |

报告与回传**只写 env 变量名与状态**；真实密码、Token、AK/SK 一律不得出现在 `docs/material/` 或回传块中。

## 回传格式

**禁令（硬）**：下方 `integrations[]` 与报告中**只准出现 env 变量名与 `have|need|blocked` 状态**，绝不写凭据值；出现任何 `AKIA…` / `sk-…` / `Bearer …` / 明文密码 → P0，立刻改回变量名。

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: create-dev-config
mode: create | fill-gap | env-map | audit | revise | inventory-only
attendance: attended | unattended        # unattended 时 mode 只能是 inventory-only
report: ""                  # docs/material/create-dev-config/<YYYY-MM-DD>-<slug>.md
written: []                 # 实际改动的文件路径；audit / 未落盘为 []
active_env: ""              # local | staging | prod（未定为空）
envs:
  - name: local | staging | prod
    browser_url: set | missing
    api_url: set | missing | n/a
    deploy: set | missing | n/a
    logs: set | missing | n/a
    auth: set | missing      # 用户名 + password_env 是否齐
    walkthrough: enabled | disabled      # prod 必须 disabled
    gaps: []                 # 仍缺的键名
integrations:               # 只记变量名与状态，绝不记值
  - name: ""
    slug: ""
    credential_env: []      # 仅变量名，如 [OIDC_CLIENT_SECRET]
    credential: have | need | blocked
    smoke: ""               # smoke 脚本路径；无则 ""
scripts:                    # 仓内脚本 vs .dev 字段
  deploy_dev: absent | ready | gaps   # absent=无脚本
  release: absent | ready | gaps
  gaps: []                  # 如 deploy.ssh_host / release.s3_prefix
remaining: []               # 待确认项 / 用户跳过用推荐值的键
coverage:
  blind_spots: []           # `阶段 | 未覆盖内容 | 原因`；非空 → status 禁止 DONE
  stages_done: []           # A / B / C / D
blockers:
  - ""                      # 缺凭据条目形如「<服务>: <ENV_VAR_NAME> = need」
```

**`status` 与覆盖度的绑定**：阶段 A 齐、涉及的 B/C/D 已覆盖（或用户书面跳过）且无未消解盲区 → 可 `DONE`；盲区仅在**边缘面**（可选 metrics/traces、未启用环境、非本批依赖的集成、无脚本故跳过 D）→ 最多 `DONE_WITH_CONCERNS` 且盲区进 `remaining`；盲区落在**主路径**（`active_env` 未定 / 走查 URL 或账号缺失 / 本批 smoke 必需的 `credential: need\|blocked`）→ `BLOCKED`，对应依赖**不得**标已对接。有脚本但 D 未齐 → 不阻塞走查，须进 `scripts.gaps` 与交接「可补充」；`inventory-only` 天然不写凭据，其上限为 `DONE_WITH_CONCERNS`。

## 关联

- Schema：[dev-config.md](../browser-reviewer/references/dev-config.md) · [release-deploy-schema.md](references/release-deploy-schema.md)
- [question-bank.md](references/question-bank.md) · [write-checklist.md](references/write-checklist.md)
- 下游：[scenario-playbook](../scenario-playbook/SKILL.md) · [browser-reviewer](../browser-reviewer/SKILL.md) · [deploy-dev](../deploy-dev/SKILL.md) · [release-package](../release-package/SKILL.md)
