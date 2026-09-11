---
name: deploy-dev
description: >
  将当前仓库编译并部署到演示/开发机：先分析技术栈与 README/脚本中的编译顺序
  （Python / Node Hono / Vue·React / Go；前端 embed 则先编前端再编后端），再读取 .dev
  演示环境 deploy.ssh_host / remote_root，执行 scripts/deploy_dev.sh。
  Use when the user asks to deploy to dev/demo/staging host, run deploy_dev.sh, 部署到演示环境,
  开发机部署, or ssh+rsync 更新远端服务.
---

# Deploy Dev（演示机部署）

把**当前工作区**构建产物推到演示/开发机并重启服务。

- 参数真源：仓库 `.dev` 演示环境 `deploy.*`（[create-dev-config](../create-dev-config/SKILL.md) 阶段 D）
- 缺 `ssh_host` 时：可从家目录 [create-home-dev](../create-home-dev/SKILL.md) 的 `hosts[]` 推荐（须确认）；见 [consume.md](../create-home-dev/references/consume.md)
- 构建顺序真源：`scripts/deploy_dev.sh` + README + 栈侦察（[build-stack.md](../create-dev-config/references/build-stack.md)）

## 何时使用

| 场景 | 动作 |
|------|------|
| 用户说「部署到演示 / 开发机 / deploy_dev」 | 侦察栈 → 读 `.dev` → 确认 → 跑脚本 |
| `.dev` 缺 ssh_host / remote_root | 用脚本默认或 `$HOME/.dev` `hosts[]` 作推荐，**先确认**；提示补 create-dev-config / create-home-dev |
| 无 `scripts/deploy_dev.sh` | **停**：勿编造部署流程 |

## 前置

1. 仓库根存在 `scripts/deploy_dev.sh`
2. 本机 `ssh` / `rsync` + 脚本所需工具链（见栈侦察）
3. 已能登录 `ssh_host`（密钥在 ssh-agent / 本机配置，**不**进 `.dev`）
4. 禁止对 `prod` / `kind: production` 执行
5. **宿主**：Mac / Windows / Linux 均可；本机交叉编译后再推 Linux 演示机。Windows 用 **WSL2 或 Git Bash**。Go 默认 **`linux/amd64`**；改架构时用脚本支持的环境变量或追加参数（见 [build-stack.md §0](../create-dev-config/references/build-stack.md)），并确认演示机 CPU 架构一致

## 流程

### 0 · 技术栈与编译顺序（必做）

只读扫仓，按 [build-stack.md](../create-dev-config/references/build-stack.md)：

1. 读 `scripts/deploy_dev.sh` 实际步骤（是否先 `pnpm`/`vite` 再 `go build`、是否 `embed-sync`）
2. 读 `README.md`（及指向的 Build 节）核对
3. 判定后端语言（go / node-hono / python / …）与前端（vue / react / none）
4. 判定前端关系：**embed**（先前端 → 嵌入 → 后端）| **separate** | **none**
5. 写入预览卡「构建栈」；**有脚本则仍只执行脚本**，不另起手写构建链

脚本支持 `SKIP_FE` / `--skip-build` 时：确认 embed/产物仍新鲜，否则不要跳过前端。

### 1 · 解析部署目标

1. 读 `.dev/config.yaml`（若有）
2. 演示环境：带 `deploy.ssh_host` 的优先；否则 `staging` → `demo` → `dev`
3. 字段：

| 变量 | 来源 | 回退 |
|------|------|------|
| `DEV_HOST` | `deploy.ssh_host` | 组织默认 `ontomind@192.168.10.22`；再回退脚本 `DEV_HOST:-…` |
| `REMOTE_ROOT` | `deploy.remote_root` | 脚本 `*_ROOT:-…` |
| `REMOTE_ROOT_ENV` | `deploy.remote_root_env` | 如 `ARK_ROOT` |
| `SCRIPT` | `deploy.script` | `scripts/deploy_dev.sh` |
| URL | 环境 `browser_url` | 将脚本末尾主机换成 `192.168.10.22`（若仍写旧 IP） |

### 2 · 确认（必做）

```markdown
## 演示部署预览
### 构建栈
- 后端 / 前端 / 关系: …
- 顺序: 1) … 2) …（依据: 脚本 / README）
### 目标
- 脚本: <SCRIPT>
- SSH: <DEV_HOST>
- 远程根: <REMOTE_ROOT> （<REMOTE_ROOT_ENV>）
- 预期访问: <url>
- 参数: 默认 | --clean | --skip-build
```

`--clean` 须单独确认。用户已说「直接部署 / --yes」可跳过等待，仍打印预览。

### 3 · 执行

```bash
export DEV_HOST="<ssh_host>"
export <REMOTE_ROOT_ENV>="<remote_root>"
# Go 默认 linux/amd64；若脚本支持，可追加/导出改架构，例如：
# export GOARCH=arm64
./scripts/deploy_dev.sh          # 或 --clean / --skip-build / 脚本支持的其它参数
```

未指定架构 → **linux/amd64**。用户要求其它架构 → 只使用脚本已支持的覆盖方式，并在预览中写明。

失败贴尾部日志。成功回报 URL 与日志命令。

### 4 · 交接

```markdown
## 部署结果
- status: DONE | FAILED
- build: <embed|separate|none> / <顺序摘要>
- host / url / 日志命令
- .dev 缺口: （若有）
```

## 红线

- 无 `deploy_dev.sh` 不伪造步骤
- 不跳过栈侦察；不在 embed 仓未编前端时强行 `--skip-build`/`SKIP_FE`（除非用户明确且产物已存在）
- 不对生产环境执行；不写 SSH 私钥/密码进 `.dev` 或报告
- 未确认不加 `--clean`

## 关联

- [build-stack.md](../create-dev-config/references/build-stack.md) · [release-deploy-schema.md](../create-dev-config/references/release-deploy-schema.md)
- [create-dev-config](../create-dev-config/SKILL.md) · [release-package](../release-package/SKILL.md)
