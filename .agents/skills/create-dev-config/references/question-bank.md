# 问题库与扫仓默认

一次只问**一题**。先扫仓填推荐项。

## 扫仓推断（提问前）

| 目标 | 搜什么 |
|------|--------|
| 本机 browser / 端口 | README localhost；vite/next port；compose ports；`package.json` scripts |
| start | `npm/pnpm/yarn dev`；monorepo → `start_cwd` |
| login_path | `/login` `/signin` `/auth` |
| api_url | `VITE_*` / `NEXT_PUBLIC_*` / proxy / compose 后端端口 |
| staging/prod URL | README、docs/service、helm values、CI 环境变量名（只采 URL，不采密） |
| 日志/Grafana | docs/runbook、README「观测」、compose 里 grafana 端口 |
| 部署 | `deploy/`、Helm、`.github/workflows`、docs/service 部署节 |
| 演示部署脚本 | `scripts/deploy_dev.sh`：`DEV_HOST:-…`、`*_ROOT:-…`、末尾 `http://host:port` |
| 发布打包脚本 | `scripts/release.sh`：`MC_ALIAS:-…`、`S3_PREFIX=` / `mc cp "…/release/…"`、`GOARCH:-…` |
| 第三方集成 | 依赖清单里的厂商 SDK、`docs/integrations/*.md`、`contracts/*.smoke.*`、`.env.example` 里的 `*_KEY` / `*_SECRET` / `*_TOKEN` **变量名**（只采名，不采值） |

---

## 阶段 A · 最小可走查

### A1 · active_env

> 这次走查 / 默认瞄准哪套环境？  
> **推荐**：`local`（本机）  
> A) local  B) staging  C) 其他（命名）  D) 先配地图，active 稍后再定（仍推荐先 local）

→ `active_env`（禁止无确认选 prod；若用户坚持 → 警告 + 要求 `allow_prod` 明示）

### A2 · 浏览器 URL

> `active_env` 的**浏览器访问地址**？  
> **推荐**：扫到的本机 URL  
> A) 用推荐  B) 我提供  C) 占位稍后改

→ `environments.<id>.browser_url` + `app.base_url`

### A3 · 启动（local）

> 需要 agent 走查前启动应用吗？（非 local 可跳过）  
> A) 用推荐命令  B) 我提供  C) 手动已启动 / 远端无需 start

→ `start` / `start_cwd` / `ready_timeout_sec`

### A4 · 登录策略

> 登录方式？  
> A) 表单  B) Basic  C) Cookie/Header  D) 无登录

→ `auth.strategy` + `login_path`

### A5 · 用户名

> 管理员用户名？ **推荐** `admin`  
> A) 推荐  B) 我提供

### A6 · 密码存放

> 密码怎么放？（**推荐 A**；若 active 将是生产 → 跳过收密，只做地图）  
> A) `secrets.env` + `password_env`  
> B) 写入 yaml（须 gitignore 整 `.dev`）  
> C) 占位稍后改

### A7 · 写边界

> 是否允许走查写数据 / 删除？  
> **推荐**：A 只读  
> A) 只读  B) 可写不可删  C) 可写可删（高风险）

### A8 · API URL

> 服务接口基址（与页面不同源时）？  
> A) 跳过（同源）  B) 用推荐  C) 我提供

→ `api_url` + `external.api_base`

---

## 阶段 B · 环境地图

### B0 · 建哪些环境

> `.dev` 里要登记哪些环境？（可多选）  
> **推荐**：local + staging + prod（prod 仅 URL/运维地图）  
> A) 仅 local  B) local+staging  C) local+staging+prod  D) 自定义列表

### 对每个选中环境循环（一次只问当前环境的一题）

#### Bx.1 浏览器 URL

> 【&lt;env&gt;】浏览器访问 URL？

#### Bx.2 API URL

> 【&lt;env&gt;】服务 API 基址？  
> A) 与浏览器同源 / 未知先空  B) 我提供

#### Bx.3 部署

> 【&lt;env&gt;】部署在哪？怎么发？有控制台/流水线链接吗？  
> 可答：`location` / `method` / `region` / `link`；未知则「跳过」  
> 若该环境是演示机且存在 `scripts/deploy_dev.sh`：摘要可先用推荐（如 `method: ssh+rsync+systemd-user`），细项留给阶段 D

→ `deploy`（人类可读四键；脚本可执行键见阶段 D）

#### Bx.4 日志

> 【&lt;env&gt;】日志在哪查？（控制台 URL + 可选查询提示）  
> A) 跳过  B) 我提供 url 与 query_hint

→ `logs`；可顺带问一句指标/Trace 是否有 URL（合并为一问若用户愿意）

#### Bx.5 网络

> 【&lt;env&gt;】是否要 VPN/堡垒机？kubectl context 名？（不要贴 kubeconfig）  
> A) 无需  B) 要 VPN  C) 说明…

→ `network`

#### Bx.6 连接摘要（可选）

> 【&lt;env&gt;】需要登记 DB/Redis/MQ 等主机端口吗？（不要密码）  
> A) 跳过  B) 逐条提供 name/kind/host/port

→ `connections`

#### Bx.7 health（可选）

> 【&lt;env&gt;】health/ready 探活 URL？  
> A) 跳过  B) 提供

### B-prod · 生产收尾（含 prod 时必问）

> 生产环境将：**只存访问/部署/日志地图**，不收生产密码，且 `walkthrough.enabled=false`。确认？  
> A) 确认  B) 我坚持要配置生产走查账号（须同时确认 `allow_prod=true`，并警告风险）

默认只接受 A。

### B-meta · 项目元信息（可选）

> 负责人 / oncall、架构或 runbook 文档路径要写进 project 吗？  
> A) 跳过  B) 提供

---

## 阶段 C · 集成凭据登记

只登记**变量名**与状态；**任何一问都不要求用户贴凭据值**（用户主动贴 → 提醒改走 `secrets.env`/密钥库，且不复述进报告）。

### C1 · 有哪些第三方

> 扫到这些仓外服务：&lt;列表&gt;。要登记进 `.dev` `integrations` 吗？（可增删）  
> A) 用扫到的  B) 我补充/删减  C) 暂无第三方，跳过阶段 C

### 对每个服务循环（一次一题）

#### Cx.1 用途与端点

> 【&lt;服务&gt;】用来做什么？端点 URL？**推荐**沙箱优先（`env: sandbox`），未知先留空

→ `purpose` / `env` / `endpoint`

#### Cx.2 env 变量名

> 【&lt;服务&gt;】凭据用哪些**环境变量名**？（**只要名字，别贴值**）  
> A) 用扫到的 `<SVC>_KEY_ID` / `<SVC>_KEY_SECRET`  B) 我提供名字  C) 还没定（本 Skill 起名并标 `（待确认）`）

→ `credential_env[]`

#### Cx.3 现在拿得到吗

> 【&lt;服务&gt;】这套凭据现在拿得到吗？拿不到的话谁去哪开？  
> A) 已有（值在 secrets.env / 密钥库）→ `have`  B) 要申请 → `need` + 写清谁在哪个控制台开  C) 需 NDA / 现场 / 未开放 → `blocked`

→ `credential` + `obtain`

#### Cx.4 smoke 脚本

> 【&lt;服务&gt;】最小真实调用脚本放哪？  
> A) 用推荐 `contracts/<slug>.smoke.<ext>`（扩展名跟仓：POSIX shell 仓 `.sh`；跨平台/Windows 优先 `.py`（`python3 contracts/<slug>.smoke.py`）或 `.ps1`）  B) 已有，路径是…  C) 还没写（由 integration-research 补）

→ `smoke`

---

## 阶段 D · 演示部署与发布打包

无 `scripts/deploy_dev.sh` 且无 `scripts/release.sh` → 整阶段跳过。  
有脚本时：**每问先亮推荐默认**（来自脚本解析；扫不到用组织共性，见 [release-deploy-schema.md](release-deploy-schema.md)）。

### D0 · 演示环境 id（仅有 deploy_dev 时）

> 演示部署打哪套 `.dev` 环境？  
> **推荐**：`staging`（若 B0 已建；否则建议新建 staging）  
> A) 用推荐  B) 用已有环境 `&lt;列表&gt;`  C) 新建 id（如 `demo`）

→ 后续 D1/D2 写入该环境的 `deploy.*` / `browser_url`

### D1 · SSH 与远程根（有 deploy_dev 时）

> 演示机 SSH 与远程安装目录？  
> **推荐**：`ssh_host=&lt;从脚本 DEV_HOST&gt;`，`remote_root=&lt;从 *_ROOT&gt;`（`remote_root_env=&lt;变量名&gt;`）  
> A) 用推荐  B) 我改 host / 路径  C) 稍后补（预览标待确认）

→ `deploy.script`（默认 `scripts/deploy_dev.sh`）+ `ssh_host` + `remote_root` + `remote_root_env`；同步摘要 `location`（主机）/ `method: ssh+rsync+systemd-user`

### D2 · 演示机 URL（有 deploy_dev 且该环境 browser_url 空时）

> 演示机浏览器地址？  
> **推荐**：脚本末尾打印的 `http://…`（或由 ssh 主机 IP + 扫到的端口拼）  
> A) 用推荐  B) 我提供  C) 跳过

→ `environments.<id>.browser_url`（若该环境即 active，同步顶栏）

### D3 · 发布 S3（有 release.sh 时）

> 发布上传用哪个 mc alias、S3 前缀（alias 之后的路径）？  
> **推荐约定**：`s3_prefix=release/projects/&lt;slug&gt;/&lt;arch&gt;/&lt;os&gt;`（例：`release/projects/nex/amd64/linux`）  
> 若脚本里已有路径：先亮脚本值，并注明与约定差异；`mc_alias` 默认 `s3`  
> A) 用约定/推荐  B) 用脚本现有路径  C) 我改  D) 稍后补

→ 顶层 `release.script`（默认 `scripts/release.sh`）+ `mc_alias` + `s3_prefix`

### D4 · 架构与产品名（有 release.sh 时，可合并一问）

> 发布目标架构与产品 slug？  
> **推荐**：`goos/goarch=&lt;脚本默认，多为 linux/amd64&gt;`，`product_slug=&lt;仓库目录名&gt;`；多平台仓带上扫到的 platforms  
> A) 用推荐  B) 我改  C) 跳过（仅保留 D3）

→ `release.goos` / `goarch` / `product_slug` / `platforms`

---

## 补缺速查

| 缺什么 | 问 |
|--------|-----|
| browser_url / base_url | A2 |
| 账号密码 | A5–A6 |
| 无 environments | B0 起 |
| 无 staging/prod 地图 | B0 选中后循环 |
| 无日志入口 | Bx.4 |
| active=prod 且未 allow_prod | 改回 staging/local 或明示允许 |
| smoke 缺凭据 / 无 integrations 段 | C1 起（`inventory-only` 时不提问，直接产缺口清单） |
| 有 deploy_dev.sh 缺 ssh_host/remote_root | D1（先给推荐） |
| 有 release.sh 缺 release.mc_alias/s3_prefix | D3（先给推荐） |

## 体检评分

| 维 | 分 | 标准 |
|----|-----|------|
| 走查必填 | 35 | active 可打开 + 非 prod 认证齐或 prod 未启用走查 |
| 安全 | 25 | secrets 分离；生产无密码；allow_prod 默认 false；gitignore |
| 地图覆盖 | 25 | local+staging 有 browser/api；prod 有 URL+deploy 或 logs 之一 |
| 可运维 | 15 | 至少一环境有 logs 或 deploy.link；VPN 已声明；**若有脚本则 D 字段齐可加满本维** |

&lt;70 走查维 → 不宣称可走查；地图维低 → 报告「地图不完整」但不阻塞只读本机走查。

**集成登记加减项**（不占上表 100 分，单独报）：仓内有第三方 SDK 却无 `integrations` 段 → 报「凭据无归属地」；任一条 `credential: have` 却无 `smoke` 路径 → 报「已有凭据但无真打脚本」。两者都不阻塞走查，但须进回传 blockers。

**脚本可执行加减项**（单独报，不阻塞走查）：有 `deploy_dev.sh`/`release.sh` 但对应 `.dev` 字段缺 → 报告「可补充演示部署/发布配置」并附推荐默认；用户未补时 `scripts.*: gaps`，交接提示可跑 create-dev-config 补 D 或直接口头确认后由 deploy-dev/release-package 临时用脚本内默认。
