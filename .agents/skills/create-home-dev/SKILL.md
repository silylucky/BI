---
name: create-home-dev
description: >
  苏格拉底式交互创建、体检或修订用户家目录 ~/.dev：登记可 SSH 访问的设备（IP/主机）、
  外部 S3/MinIO/OSS、MySQL、PostgreSQL、外部日志、Trace/指标、LDAP、OAuth/OIDC 等可认证
  基础设施；yaml 只记主机/端口/端点与凭据变量名，值进 ~/.dev/secrets.env。一次只问一个问题；
  写入前脱敏预览确认；禁止默认写入生产密码/AKSK 明文。无人值守只允许 mode=inventory-only。
  Use when initializing ~/.dev, home-level .dev, personal infra inventory, register SSH hosts,
  personal S3/MySQL/Postgres/LDAP/OAuth credentials map, or when create-dev-config / deploy-dev /
  release-package / go-fast needs to pick a shared host or external service from the user's
  home inventory — 初始化家目录.dev / 个人基础设施台账 / 登记 SSH 设备 / 登记外部库与认证.
---

# Create Home Dev（人工交互 · 家目录 `~/.dev`）

苏格拉底式引导用户产出或修好**个人家目录** `~/.dev/`：跨项目复用的**基础设施台账**（SSH 设备、对象存储、数据库、观测、身份认证），不是某个仓库的走查枪口。

| | 仓库 `.dev`（[create-dev-config](../create-dev-config/SKILL.md)） | 家目录 `~/.dev`（本 Skill） |
|--|--|--|
| 路径 | `<repo>/.dev/` | `$HOME/.dev/` |
| 范围 | 单项目环境地图 + 走查 + 发布参数 | 个人/团队共用的主机与外部服务 |
| 消费方 | browser-reviewer / deploy-dev / release | create-dev-config 阶段 D、deploy-dev、release-package、go-fast smoke 选源 |

- **Schema 真源**：[references/schema.md](references/schema.md)
- **提问**：[references/question-bank.md](references/question-bank.md)
- **落盘**：[references/write-checklist.md](references/write-checklist.md)
- **被谁怎么读**：[references/consume.md](references/consume.md)
- **客户仓指针**：[references/project-pointer.md](references/project-pointer.md)（在项目目录执行后补 AGENTS / delivery）

## 何时使用

| 场景 | 动作 |
|------|------|
| `~/.dev` 不存在 | **新建**：主机 → 存储/库 → 观测 → 身份 → 预览落盘 |
| 有新机器 / 新库 / 新 IdP | **补登记** |
| 已有 `~/.dev` | **体检**：完整度 + 缺 `credential_env` / secrets 对齐 |
| create-dev-config D1 缺 SSH | 先本 Skill 登记或直接从已有 `hosts[]` 选 |
| 在客户项目仓内执行完毕 | **补** `AGENTS.md` / `delivery.mdc` 双 `.dev` 指针（见 project-pointer） |
| release 缺 mc alias / S3 | 从 `object_storage[]` 选或补登记 |
| go-fast smoke 缺外部库/LDAP | 从对应段选变量名；缺则补占位 |

## 工作模式

| 模式 | 触发 | 输出 |
|------|------|------|
| 新建 | 无 `~/.dev/config.yaml` | 完整骨架 + secrets 模板 |
| 补缺 | 缺某类资源 | 最小 diff |
| 体检 | 用户要求检查 / 重复执行且已有 | 完整度报告；默认不写 |
| 修订 | 用户确认改某项 | 逐条确认 |
| inventory-only | 无人值守且显式该 mode | 只盘点缺口；不写凭据值 |

## 提问纪律

1. **一次只问一个问题**；选项 + **推荐项**
2. 先只读探测：已有 `~/.dev`、`~/.ssh/config` Host 别名（只采 HostName/User，**不读私钥**）、本机 `mc alias list`（若有）
3. 跳过 → 用推荐，预览标 `（待确认）`
4. **写入前**脱敏预览 → 明确确认
5. 密码 / AKSK / Client Secret → **只** `credential_env` + `secrets.env`；yaml **禁止**明文
6. 生产级凭据：默认只登记主机与变量名，`credential: need`，不主动收值

## 分阶段收敛

### 阶段 H0 · 台账元信息

| 顺序 | 主题 | 写入 |
|------|------|------|
| H0.1 | 台账用途说明 / owner 备注 | `owner` |

### 阶段 H1 · SSH 可达设备（核心）

| 顺序 | 主题 | 写入 |
|------|------|------|
| H1.0 | 要登记哪些主机（可多台） | `hosts[]` |
| H1.x | 每台：`user@ip` / 端口 / 跳板 / 标签 / 已知 remote_root | `hosts[].ssh` 等 |
| H1.auth | 认证方式（推荐 agent/key） | `hosts[].auth`；密码则只记 `credential_env` |

### 阶段 H2 · 对象存储

S3 / MinIO / OSS / COS … → `object_storage[]`（`endpoint` / `mc_alias` / `bucket_or_prefix` / `credential_env`）

### 阶段 H3 · 数据库

MySQL / PostgreSQL / TiDB … → `databases[]`（`host`/`port`/`database`/`username`/`credential_env`）

### 阶段 H4 · 观测

日志 / 指标 / Trace → `observability.logs|metrics|traces[]`

### 阶段 H5 · 身份与可认证方式

LDAP / OAuth·OIDC（及通用 `integrations[]`）→ `identity.*` / `integrations[]`

细节见 question-bank。可按用户当下需要只做 H1，其余标「稍后补」。

## `mode=inventory-only`（唯一无人值守口子）

| 项 | 规则 |
|----|------|
| 触发 | `attendance=unattended` **且** `mode=inventory-only` |
| 只能做 | 读已有 `~/.dev` + 对照调用方所需资源类型 → 缺口清单 |
| 允许写入 | **仅**占位条目（`credential: need\|blocked` + 变量名）；不存在目录时**不创建**，只回清单 |
| 禁止 | 写任何凭据值；写 `secrets.env`；把 `credential` 标 `have`；编造 IP |

---

## 流程（必须）

### Phase 0 · 侦察

读 `$HOME/.dev/config.yaml`（若有）、`.gitignore`/`secrets.env` 是否存在；可选扫 `~/.ssh/config` 的 Host 摘要、`mc alias list` → **Home Dev Card**（已有主机数 / 库 / 存储 / 身份 / 缺 secrets 对齐项）。

**已有台账**：默认体检不写；输出「可补充」清单。用户说补再进 Phase 1。

### Phase 1 · 提问

按 H0→H1→… 一次一问；用户说「只要 SSH」则 H2+ 可跳过并记入 `remaining`。

### Phase 2 · 预览

脱敏列出：hosts（user@host）、存储 endpoint/alias、库 host:port/db、观测 URL、LDAP/OAuth issuer；**所有 secret 只显示变量名**。

### Phase 3 · 落盘

按 write-checklist 写 `$HOME/.dev/config.yaml`；需要时追加 `secrets.env` 键名占位（值由用户本地填）；权限建议 `config.yaml` 0600、`secrets.env` 0600。

### Phase 4 · 客户仓指针（在项目目录执行时必做）

若当前工作区是客户/目标 **git 仓库根**（或用户指定了项目根）：

1. 按 [project-pointer.md](references/project-pointer.md) 检查 `AGENTS.md`、`.cursor/rules/delivery.mdc` 是否已有「仓库 `.dev` vs `$HOME/.dev`」说明
2. 缺则**预览补丁**（只加指针节/表行，不复制台账内容）→ 用户确认后写入
3. 两者皆无 → 提示先跑 **create-project-rules**（模板已内置本节），或经确认只写最小 `AGENTS.md` 节
4. `inventory-only` / 非项目目录 → 跳过本阶段，仅在交接里提示

### Phase 5 · 交接

```markdown
## 下一步
- 项目仓已补指针：外部 smoke 查 $HOME/.dev；本项目运行查仓库 .dev
- 项目要演示部署：create-dev-config 阶段 D / deploy-dev 可从 hosts[] 选 ssh
- 项目要发 S3：release-package 可从 object_storage[] 选 mc_alias + prefix
- 契约 smoke：go-fast / integration-research 读 credential_env 变量名
- 补某类资源：再说「补登记家目录 .dev 的 <类>」
```

---

## 进度清单

```
- [ ] 0. 侦察 + Home Dev Card
- [ ] 1a. H0 元信息
- [ ] 1b. H1 SSH 设备
- [ ] 1c. （按需）H2 对象存储
- [ ] 1d. （按需）H3 数据库
- [ ] 1e. （按需）H4 观测
- [ ] 1f. （按需）H5 身份 / 通用集成
- [ ] 2. 预览确认
- [ ] 3. 落盘 + 权限自检
- [ ] 4. （在项目仓）AGENTS / delivery 双 .dev 指针
- [ ] 5. 交接
```

## 红线

- 未确认不写文件
- yaml / 报告 / 回传中**禁止**出现密码、AK/SK、Token、私钥正文
- **禁止**读取或复制 `~/.ssh/id_*`、kubeconfig 全文进台账
- 默认不收集生产库/生产 IdP 的秘密值（可只登主机与 `credential: need`）
- 无人值守只允许 `mode=inventory-only`
- 本台账在家目录，**不要**建议用户把它 commit 进任意 git 仓
- 客户仓只允许写入 **指针文案**（AGENTS / delivery），禁止把 `~/.dev` 内容拷进仓库

## 落盘位置

| 产物 | 位置 |
|------|------|
| 配置本体 | `$HOME/.dev/config.yaml` |
| 密钥 | `$HOME/.dev/secrets.env`（本地填写；agent 默认只写键名占位） |
| 客户仓指针（可选） | 项目根 `AGENTS.md`、`.cursor/rules/delivery.mdc`（仅查找关系，见 project-pointer） |
| 体检报告（可选） | 当前仓库 `docs/material/create-home-dev/<YYYY-MM-DD>-<slug>.md`（仅变量名与主机摘要） |

## 回传格式

**禁令**：下方字段与报告只准主机摘要、URL、**env 变量名**与 `have|need|blocked`；出现明文密钥 → P0。

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: create-home-dev
mode: create | fill-gap | audit | revise | inventory-only
attendance: attended | unattended
home_dev: ""                 # 绝对路径，通常 $HOME/.dev
written: []
project_pointer: absent | skipped | already | patched   # 客户仓 AGENTS/delivery 指针
counts:
  hosts: 0
  object_storage: 0
  databases: 0
  logs: 0
  metrics: 0
  traces: 0
  ldap: 0
  oauth: 0
  integrations: 0
credentials:                 # 只记变量名与状态
  - resource: ""             # hosts/demo-22 或 databases/pg-dev
    credential_env: []
    credential: have | need | blocked
remaining: []
coverage:
  stages_done: []            # H0 / H1 / H2 / H3 / H4 / H5
  blind_spots: []
blockers:
  - ""
```

**status**：至少 H1 有一台可用 SSH（或用户书面跳过并说明只用云 API）且无主路径盲区 → 可 `DONE`；仅边缘类未登 → `DONE_WITH_CONCERNS`；调用方本批必需资源 `credential: need|blocked` → `BLOCKED`。

## 关联

- [schema.md](references/schema.md) · [question-bank.md](references/question-bank.md) · [write-checklist.md](references/write-checklist.md) · [consume.md](references/consume.md) · [project-pointer.md](references/project-pointer.md)
- 姊妹：[create-dev-config](../create-dev-config/SKILL.md) · [create-project-rules](../create-project-rules/SKILL.md) · [deploy-dev](../deploy-dev/SKILL.md) · [release-package](../release-package/SKILL.md) · [integration-research](../integration-research/SKILL.md)
