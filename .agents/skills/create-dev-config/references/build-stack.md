# 构建栈侦察（deploy-dev / release-package 共用）

在跑 `deploy_dev.sh` / `release.sh` **之前**做只读侦察。有脚本时**以脚本步骤为准**；脚本含糊或缺步骤时，用本表 + README 补全理解，并在预览卡写明「构建顺序」。

**不要**在脚本已正确编排时另起一套手写构建（除非用户明确要求绕过脚本）。

---

## 0 · 宿主平台（Mac / Windows / Linux 都能跑吗？）

**可以生成**：多数 `release.sh` / `deploy_dev.sh` 在 **Mac 或 Windows** 上执行，目标产物仍是 **Linux**（`GOOS=linux` 交叉编译，或 Node/前端与 OS 无关的 build）。演示机部署同样是本机编出 linux 二进制再 `ssh`+`rsync` 到 Linux 演示机。

| 宿主 | release（打交付包） | deploy-dev（推演示机） |
|------|---------------------|------------------------|
| **macOS** | 通常可直接跑 bash 脚本；Go 交叉编 linux 没问题 | 需本机 `ssh`/`rsync`（一般自带或 brew） |
| **Windows** | 在 **Git Bash / WSL2** 里跑 `*.sh`（脚本是 bash，不是 cmd/PowerShell） | 同上；WSL 内 `ssh`/`rsync` 更省事 |
| **Linux** | 原生最省事 | 原生最省事 |

### Go 交叉编译与目标平台（默认 x86 Linux）

Go 仓通常 **支持交叉编译**：在 Mac/Windows/Linux 宿主上编出其它 `GOOS`/`GOARCH` 产物。

| 项 | 约定 |
|----|------|
| **默认目标** | `linux` / `amd64`（x86_64 Linux）——`deploy_dev.sh` 与 `release.sh` 未指定时按此编译 |
| **改架构/平台** | 通过脚本支持的 **环境变量** 或 **追加参数**（以脚本头注释为准），例如 `GOARCH=arm64`、`GOOS=linux`、`LINUX_ARCHS="amd64 arm64"`，或 `./scripts/release.sh --arch arm64`（若脚本实现了该 flag） |
| **`.dev` 默认** | `release.goos` / `release.goarch`（缺省 `linux`/`amd64`）；单次运行可用用户口述覆盖，不必先改 `.dev` |
| **演示机** | `deploy_dev` 默认仍推 **linux/amd64**（演示机多为 x86）；用户要 arm 演示机时同样追加/导出架构变量，并确认远端是对应架构 |

执行前读脚本：支持哪些覆盖方式（`GOOS`/`GOARCH` / `LINUX_ARCHS` / 位置参数 / `--arch`）。**只使用脚本已支持的开关**，不要臆造 flag。  
部分脚本限制「仅 Linux 包」（允许改 `GOARCH`，但不允许 `GOOS=darwin` 走同一 release 路径）——预览卡写清。

**与宿主绑定的例外**（预览卡必须写明）：

| 情况 | 约束 |
|------|------|
| 打 **macOS .app**（如 Wails） | 须在 **macOS** 上构建；其它宿主脚本常跳过或报错 |
| 打 **Windows 桌面 exe**（CGO/Wails） | 常需 mingw 等；失败时脚本可能回退 headless |
| 纯 **Linux 包 / headless zip** | Mac/Windows 交叉编译即可（Go `CGO_ENABLED=0` 最稳） |
| 脚本 `#!/usr/bin/env bash` | Windows 勿用原生 PowerShell 直接执行；用 WSL/Git Bash |

预览卡加一行：`宿主: darwin|windows|linux → 目标产物: linux/amd64（+…）`。若当前宿主做不到某平台产物 → 说明跳过项或改 `SKIP_DESKTOP=1`，不要假装已生成。

---

## 1 · 扫什么

| 信号 | 推断 |
|------|------|
| `go.mod` / `cmd/` / `package main` | Go 服务 / CLI |
| `package.json` + `hono` / `@hono/*` | Node（Hono）后端 |
| `pyproject.toml` / `requirements*.txt` / `setup.py` / `*.py` + uvicorn/fastapi/flask | Python 服务 |
| `fe/` / `web/` / `frontend/` + `vite` / `vue` / `react` | 前端工程（Vue/React 等） |
| `//go:embed`、`embed` 目录、`internal/static`、脚本里 `embed-sync` / 复制进 `server/…` | **前端嵌入后端二进制** |
| 发布包含 `fe/dist` 或单独静态目录 | **前端与后端分开发布**（非 embed） |
| 仅后端、无 fe 目录且 README 写「无控制台」 | **无前端** |
| `README.md` / `docs/` 的 Build、Release、嵌入、部署节 | 官方编译顺序与开关（`SKIP_FE` 等） |

优先读：

1. `scripts/release.sh` / `scripts/deploy_dev.sh`（真实步骤）
2. 仓库根 `README.md`（及 README 指向的 build 文档）
3. 根/`fe`/`server` 的 `package.json` scripts、`Makefile`、`go:embed` 引用

---

## 2 · 前端关系（必须判定）

| 形态 | 特征 | 构建顺序 |
|------|------|----------|
| **embed** | Go（或其它）二进制 `go:embed` 静态资源；脚本先 `pnpm/vite build` 再 `go build`；zip **不含** `fe/dist` | ① 装依赖+编前端 → ② 同步/拷贝到 embed 目录 → ③ 编后端 → ④ 打包/rsync |
| **separate** | 产物里同时有后端包 + `fe/dist`（如 gateway 的 `tar` 含 `dist/` + `fe/dist/`） | ① 后端 build → ② 前端 build（可并行若无依赖）→ ③ 一并打包 |
| **none** | 无 SPA；纯 API / agent / Python worker | 只编后端（或语言对应产物） |
| **desktop+embed** | Wails 等桌面壳 + 嵌入 UI（gateway-tob） | 按脚本：先 fe，再各平台 desktop/headless |

判定写进预览卡：`frontend: embed | separate | none`。

---

## 3 · 语言默认工具链（脚本未写死时的预期）

| 栈 | 常见命令线索 |
|----|----------------|
| Go | 默认 `CGO_ENABLED=0 GOOS=linux GOARCH=amd64`；交叉编译改 `GOOS`/`GOARCH`（或脚本等价参数）；多二进制扫 `cmd/*` |
| Node/Hono | `npm/pnpm/yarn build`；入口 `src`→`dist` |
| Python | `pip install` / `poetry` / 打 wheel；或只同步源码+venv（以 README/脚本为准） |
| Vue/React（Vite） | `pnpm --dir fe build` / `vite build`；产物 `fe/dist` |

Monorepo：注意 `start_cwd` / `--dir fe`；锁文件决定用 pnpm 还是 npm。

---

## 4 · 与脚本的关系

| 情况 | 动作 |
|------|------|
| 脚本已含完整顺序（先 fe 再 go） | **只跑脚本**；预览复述其步骤作核对 |
| 脚本假设「已有 embed」或支持 `SKIP_FE=1` | 确认 embed 目录已新；否则去掉 SKIP_FE / 先编前端 |
| 无脚本、用户仍要发布 | **停**或转 create-dev-config；勿猜测 S3 路径 |
| README 与脚本冲突 | **以脚本为准**，预览注明冲突点 |

---

## 5 · 预览卡应包含的构建摘要

```markdown
## 构建栈
- 后端: go | node-hono | python | …
- 前端: vue | react | none
- 关系: embed | separate | none
- 目标: linux/amd64（默认）| 本次覆盖: …
- 覆盖方式: GOARCH=arm64 | 脚本参数 …
- 顺序: 1) …  2) …  3) …
- 依据: scripts/release.sh L… / README §…
```

---

## 6 · `.dev` 可选记录（阶段 D）

不强制；便于下次跳过重扫：

```yaml
release:
  # …
  build:
    backend: go              # go | node | python | …
    frontend: vue            # vue | react | none | …
    frontend_relation: embed # embed | separate | none
    order: [fe, embed-sync, go, package]
    notes: "控制台 SPA go:embed 进 server；包内无 fe/dist"
```

演示部署侧可把同样摘要放进对应环境 `deploy.notes` 或复用顶层 `release.build`（两脚本构建顺序通常一致）。
