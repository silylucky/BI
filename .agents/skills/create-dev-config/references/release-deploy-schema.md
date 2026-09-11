# `.dev` · 演示部署与发布打包（阶段 D）

本段由 **create-dev-config** 定义；[deploy-dev](../../deploy-dev/SKILL.md) / [release-package](../../release-package/SKILL.md) 消费。browser-reviewer **忽略**这些键。

扫到仓内 `scripts/deploy_dev.sh` 和/或 `scripts/release.sh` 时进入阶段 D；无脚本则整段可省略。  
构建栈与前端 embed/分发判定见 [build-stack.md](build-stack.md)（deploy-dev / release-package 执行前必读）。

## 字段分工

| 段 | 用途 | 消费方 |
|----|------|--------|
| `environments.<demo>.deploy` 扩展键 | `deploy_dev.sh`：SSH 目标、远程根目录、脚本路径 | deploy-dev |
| 顶层 `release:` | `release.sh`：mc alias、S3 前缀、目标架构 | release-package |
| 既有 `deploy.location/method/region/link` | 人类可读地图摘要（走查/运维卡片） | 地图体检；可与扩展键并存 |

「演示环境」通常对应 `environments.staging`（或用户命名的 `demo` / `dev`）；**不要**把演示机写成 `prod`。

---

## `environments.<id>.deploy` 扩展（演示机）

在既有四键上追加（均可空；有 `scripts/deploy_dev.sh` 时体检要求齐）：

```yaml
environments:
  staging:
    kind: staging
    label: 演示机
    browser_url: http://192.168.10.22:7001
    deploy:
      location: "192.168.10.22"          # 摘要：主机
      method: ssh+rsync+systemd-user      # 摘要：方式
      region: ""
      link: ""
      # —— 脚本可执行字段（阶段 D）——
      script: scripts/deploy_dev.sh       # 相对仓库根
      ssh_host: ontomind@192.168.10.22   # → 环境变量 DEV_HOST
      remote_root: /opt/apps/ark          # 远程安装根
      remote_root_env: ARK_ROOT           # 脚本读取的 env 名（ARK_ROOT / NEX_ROOT / …）
      health_path: /login                 # 远端探活路径（可选）
```

| 键 | 说明 |
|----|------|
| `script` | 相对仓库根；默认 `scripts/deploy_dev.sh` |
| `ssh_host` | `user@host`；导出为 `DEV_HOST` |
| `remote_root` | 远程目录；导出为 `remote_root_env` 所指变量 |
| `remote_root_env` | 从脚本默认行推断（如 `ARK_ROOT` / `NEX_ROOT`） |
| `health_path` | 可选；脚本里 curl 探活路径 |

**禁止**把 SSH 私钥、密码写入 yaml；依赖本机 `ssh`/`rsync` 已配好的密钥。

---

## 顶层 `release:`（S3 打包发布）

```yaml
release:
  script: scripts/release.sh          # 相对仓库根
  mc_alias: s3                        # → MC_ALIAS；mc 客户端 alias 名
  s3_prefix: release/projects/nex/amd64/linux   # 约定：release/projects/<slug>/<arch>/<os>
  # 完整远端形如：${mc_alias}/${s3_prefix}/latest.zip（或脚本约定的文件名）
  goos: linux                         # 可选；Go 仓默认 linux
  goarch: amd64                       # 可选；默认 amd64
  product_slug: nex                   # 与 s3_prefix 中 <slug> 对齐；可从仓库名推断
  platforms: []                       # 多平台时填，如 [linux, mac, windows]；单平台可 []
  notes: ""                           # 如「前端已 embed；SKIP_UPLOAD=1 仅本地」
```

| 键 | 说明 |
|----|------|
| `script` | 默认 `scripts/release.sh` |
| `mc_alias` | 默认扫脚本 `MC_ALIAS:-s3` 或硬编码 `s3/...` |
| `s3_prefix` | **示例约定** `release/projects/<slug>/<arch>/<os>`（如 `release/projects/nex/amd64/linux`）。扫仓时若脚本仍是旧路径，以脚本为准作推荐，并提示可迁到此约定；**去掉** alias 前缀 |
| `goos` / `goarch` | **Go 默认 `linux` / `amd64`（x86）**；可改为 `arm64` 等。Node/纯前端仓可省略。单次发布可用环境变量/脚本参数覆盖，不必先改 `.dev` |
| `product_slug` | 仓库目录名或脚本里的包名前缀 |
| `platforms` | gateway-tob 等多平台；单平台 Go zip 可 `[]` 或 `[linux]` |

Go 交叉编译：宿主可以是 Mac/Windows；默认仍打 linux/amd64。改目标时优先 `GOOS`/`GOARCH`（或脚本文档中的追加参数 / `LINUX_ARCHS`），详见 [build-stack.md](build-stack.md)「Go 交叉编译」。

### S3 凭据归属（重要）

| 位置 | 登记内容 |
|------|----------|
| `release.sh` | 仅 **alias 名** + **路径前缀**（无用户名密码） |
| `.dev` `release:` | 同上：`mc_alias` / `s3_prefix`（供默认值与体检） |
| 本机 `mc`（`~/.mc/config.json` 等） | endpoint + AccessKey/Secret（用户事先 `mc alias set`） |

**禁止**把云 AK/SK、密码写入本段或脚本。Agent 只读别名与前缀。若对象存储是**业务依赖**（应用读写桶），另走阶段 C `integrations`（只记变量名）；与「发布上传用的 mc alias」不是同一回事。

可选构建摘要（供 deploy-dev / release-package 跳过重扫）见 [build-stack.md](build-stack.md) 第 6 节 `release.build`。

---

## 扫仓默认（提问前填推荐）

| 源 | 推断 |
|----|------|
| `scripts/deploy_dev.sh` 存在 | 进入 D-deploy；`script` 默认该路径 |
| `DEV_HOST="${DEV_HOST:-…}"` | → `ssh_host` |
| `*_ROOT="${*_ROOT:-/opt/apps/…}"` | → `remote_root` + `remote_root_env` |
| 脚本末尾 `http://host:port` | → 该环境 `browser_url`（若 staging 尚空） |
| `scripts/release.sh` 存在 | 进入 D-release |
| `MC_ALIAS="${MC_ALIAS:-s3}"` | → `mc_alias` |
| `S3_PREFIX="${MC_ALIAS}/release/…"` 或 `mc cp … "s3/release/…"` | → `s3_prefix`（去 alias） |
| `GOARCH="${GOARCH:-amd64}"` | → `goarch` |
| 仓库目录名 / `pkg_root` 前缀 | → `product_slug` |

常见默认（本组织多仓共性，扫不到时作推荐）：

| 项 | 推荐默认 |
|----|----------|
| `ssh_host` | `ontomind@192.168.10.22` |
| `remote_root` | `/opt/apps/<product_slug>` |
| `mc_alias` | `s3` |
| `s3_prefix`（无脚本/新建约定） | `release/projects/<product_slug>/<goarch>/<goos>`（例：`release/projects/nex/amd64/linux`） |
| `goos` / `goarch` | `linux` / `amd64` |

---

## 体检缺口（已有 `.dev` 时）

若存在对应脚本但字段缺失，体检报告列出可补项（**不自动覆写**，问用户确认后最小 diff）：

| 条件 | 缺口提示 |
|------|----------|
| 有 `deploy_dev.sh`，无 `deploy.ssh_host` 或 `remote_root` | 「可补演示部署：SSH / 远程根（推荐值：…）」 |
| 有 `deploy_dev.sh`，staging `browser_url` 空 | 「可补演示机 browser_url（推荐：脚本末尾 URL）」 |
| 有 `release.sh`，无顶层 `release:` 或缺 `mc_alias`/`s3_prefix` | 「可补发布打包：mc alias / S3 前缀（推荐：…）」 |
| 脚本存在且字段齐全 | 地图维「脚本可执行」打勾；交接可提示 deploy-dev / release-package |

体检模式默认只报告；用户说「补一下」再进入提问 → 预览 → 落盘。
