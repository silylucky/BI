---
name: release-package
description: >
  将当前仓库打成可线上交付产物并上传 S3（mc）：先分析技术栈与 README/脚本编译顺序
  （Python / Node Hono / Vue·React / Go；前端 embed 则先编前端再编后端再打包），再读取
  .dev 顶层 release.mc_alias / s3_prefix，执行 scripts/release.sh。
  Use when the user asks to release, package for delivery, upload to S3, run release.sh,
  打发布包, 发布到 S3, or 线上交付产物.
---

# Release Package（发布打包 → S3）

构建可交付产物（zip/tar）并上传到 **本机已配置的 mc alias** 所指对象存储。

- 路径/别名真源：仓库 `.dev` 顶层 `release:`（create-dev-config 阶段 D）
- 缺 alias/前缀时：可从家目录 [create-home-dev](../create-home-dev/SKILL.md) 的 `object_storage[]` 推荐（须确认）；见 [consume.md](../create-home-dev/references/consume.md)
- 构建顺序真源：`scripts/release.sh` + README + [build-stack.md](../create-dev-config/references/build-stack.md)
- **凭据不在脚本、也不在仓库 `.dev`**（见下节；家目录只登记变量名 / mc alias）

演示机部署用 [deploy-dev](../deploy-dev/SKILL.md)，不要与本 Skill 混成一步。

## S3 凭据写在哪？

| 存放处 | 有什么 | 有没有 AccessKey/密码 |
|--------|--------|------------------------|
| `scripts/release.sh` | 只写 **alias 名**（如 `MC_ALIAS=s3`）和 **桶内路径前缀** | **无** |
| 仓库 `.dev` `release:` | 只登记 `mc_alias` + `s3_prefix`（给 agent 默认值） | **无**（禁止写入） |
| 家目录 `~/.dev` `object_storage[]` | endpoint / `mc_alias` / 前缀 + `credential_env` 变量名 | **无**明文；值可在 `~/.dev/secrets.env` |
| 本机 `mc` 配置（如 `~/.mc/config.json`） | alias → endpoint + access/secret | **有**（用户事先 `mc alias set`） |

流程：脚本调用 `mc cp … s3/release/…` → mc 用本地 alias 凭据上传。  
Agent **不**索要、不回显、不把 AK/SK 写进 `.dev` / 报告。若 `mc` 未配置 → 停并让用户本机配置 alias，或改用 `SKIP_UPLOAD=1` 只打本地包。

## 何时使用

| 场景 | 动作 |
|------|------|
| 「打发布包 / release / 上传 S3」 | 侦察栈 → 读 `.dev` → 确认 → 跑脚本 |
| `.dev` 缺 alias/前缀 | 用脚本默认或 `$HOME/.dev` `object_storage[]` 作推荐，先确认；提示补 create-dev-config / create-home-dev |
| 只要本地包 | `SKIP_UPLOAD=1` |
| 无 `scripts/release.sh` | **停** |

## 前置

1. 存在 `scripts/release.sh`
2. 工具链满足脚本（栈侦察列出；上传另需 `mc`）
3. 上传时对应 alias 已在本机配置好写权限
4. 版号常含 `git rev-parse --short HEAD`——脏工作区须让用户知情
5. **宿主**：Mac / Windows / Linux 均可；Windows 用 **WSL2 或 Git Bash**。Go 仓默认目标 **`linux/amd64`（x86）**，可按脚本用环境变量或追加参数改架构/平台（如 `GOARCH=arm64`）；见 [build-stack.md §0](../create-dev-config/references/build-stack.md)。打 macOS `.app` 须在 Mac；脚本不支持的目标勿硬编

## 流程

### 0 · 技术栈与编译顺序（必做）

按 [build-stack.md](../create-dev-config/references/build-stack.md)：

1. 读 `release.sh`：是否先前端再后端、是否 embed、产物是否含 `fe/dist`
2. 对照 `README.md` Build/Release 节
3. 判定：`backend` / `frontend` / `frontend_relation`（embed | separate | none）
4. 预览卡写清顺序；**执行仍以脚本为准**（不手写第二套 build，除非用户要求绕过脚本）

典型：

- **Go + embed SPA**：fe build → 拷入 embed 目录 → `GOOS=linux go build` → zip → `mc cp`
- **Node + 独立前端**（如 gateway）：`npm run build` → `fe:build` → tar 含 `dist/` + `fe/dist/` → `mc cp`
- **纯后端 / Python**：按脚本与 README，无 fe 步骤

### 1 · 解析发布参数

| 项 | `.dev` | 回退 |
|----|--------|------|
| 脚本 | `release.script` | `scripts/release.sh` |
| mc alias | `release.mc_alias` | `MC_ALIAS:-s3` 或脚本硬编码 `s3/…` |
| S3 前缀 | `release.s3_prefix` | 从 `S3_PREFIX` / `mc cp` 去掉 alias |
| GOOS/GOARCH | `release.goos` / `goarch` | 脚本默认；非 Go 可空 |
| 产品 / 平台 | `product_slug` / `platforms` | 目录名 / 脚本 |

```bash
export MC_ALIAS="<mc_alias>"   # 仅别名，不是密钥
# Go：默认即 linux/amd64；改目标时按脚本支持的方式覆盖，例如：
export GOOS=linux GOARCH=arm64
# 或：./scripts/release.sh <脚本文档中的额外参数>
# SKIP_UPLOAD=1 | SKIP_FE=1 | SKIP_DESKTOP=1  # 仅用户明确且脚本支持
```

未指定时按 `.dev` 的 `release.goos/goarch`，再回退 **linux/amd64**。用户说「打 arm64 / 多架构」→ 读脚本头，用其支持的 env 或追加参数，预览卡写明本次目标。

### 2 · 确认（必做）

```markdown
## 发布预览
### 构建栈
- 后端 / 前端 / 关系: …
- 顺序: 1) … 2) … 3) package → upload
- 依据: scripts/release.sh / README
### 上传
- mc alias: <名>（凭据在本机 mc 配置，不在 .dev）
- S3 前缀: <s3_prefix>
- 预期对象: <alias>/<prefix>/latest_…
- 上传: 是 | SKIP_UPLOAD=1
```

### 3 · 执行

```bash
./scripts/release.sh
# 或 SKIP_UPLOAD=1 ./scripts/release.sh
```

失败保留退出码与尾部日志（缺 mc、lockfile、交叉编译链、未编前端导致 embed 空等）。

### 4 · 交接

```markdown
## 发布结果
- status: DONE | DONE_LOCAL_ONLY | FAILED
- build: <embed|separate|none>
- version / s3 路径 / 本地产物
- .dev 缺口: （若有）
```

## 红线

- 无 `release.sh` 不猜测 `mc cp` 路径
- **禁止**把 S3 AccessKey/Secret/密码写入脚本、`.dev`、报告或对话复述
- 未确认不上传；不默认 `SIGN=1`
- 不与 deploy-dev 混为同一步
- embed 仓勿在未构建前端时滥用 `SKIP_FE`

## 关联

- [build-stack.md](../create-dev-config/references/build-stack.md) · [release-deploy-schema.md](../create-dev-config/references/release-deploy-schema.md)
- [create-dev-config](../create-dev-config/SKILL.md) · [deploy-dev](../deploy-dev/SKILL.md)
