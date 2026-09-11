# 技术栈探测（生成 / 体检前必做）

**禁止**未评估栈就默认落 `go-zero.mdc`。先填下表，再按 [rule-catalog.md](rule-catalog.md) 选模板。多框架并存时**每个命中的后端框架各产一份**框架 mdc；`production` / `project` / `prd-sync` 仍只产一套。

## 探测顺序

1. 读 `docs/arch.md` 技术栈节（若有）→ 记「宣称栈」
2. 读依赖清单对账（勿只信 arch）：
   - Go：`go.mod` require
   - Python：`pyproject.toml` / `requirements*.txt` / `Pipfile`
   - Node：根或 `apps/*/package.json`、`pnpm-workspace.yaml`
3. 扫契约与入口：`*.api`、OpenAPI、`main.py`、`cmd/`、`app/`、`src/`
4. Card 写清：**后端框架 = X**（置信：confirmed / inferred）；冲突则一次一问用户

## 后端框架判定表

| 框架 | 强信号（命中即选） | 弱信号（需与 arch 交叉） | 产出 mdc |
|------|-------------------|-------------------------|----------|
| **go-zero** | `go.mod` 含 `go-zero`；存在 `*.api` + goctl 用法 | `rest.RestConf`、`svc.ServiceContext` | `go-zero.mdc` + 通常 `go-common.mdc` |
| **GoFrame** | `go.mod` 含 `github.com/gogf/gf` | `gdef`、`g.Server`、`hack/config.yaml` | `goframe.mdc` + 通常 `go-common.mdc` |
| **FastAPI** | 依赖 `fastapi`；`APIRouter` / `FastAPI()` | `uvicorn`、Pydantic `BaseModel` 作请求体 | `fastapi.mdc`（可附短 `python-common` 并入同文件或另文件） |
| **Flask** | 依赖 `flask`；`Flask(__name__)` / Blueprint | `flask-restx` / `flask-smorest` | `flask.mdc` |
| **Express** | 依赖 `express`；`express()` / `Router()` | `app.listen`、常见 `src/routes` | `express.mdc` |
| **Hono** | 依赖 `hono`；`new Hono()` | `@hono/*` 中间件、Bun/CF Workers 入口 | `hono.mdc` |

未命中上表但有明确后端 → 用最接近模板改写，或新建 `{{stack}}.mdc`（仍须挂 production）；Card 标 `（待确认框架细则）`。

## 互斥与并存

| 情况 | 处理 |
|------|------|
| 同时像 go-zero 与 GoFrame | 看 `go.mod` 主依赖 + 入口；**不要两份都当主框架**除非 monorepo 多服务 |
| FastAPI + Flask 同仓 | 按服务/目录拆 globs，各产 mdc |
| 后端 Go + 前端 SPA | 后端框架 mdc + `fe-ui.mdc` |
| 仅 FE / 无后端 | 不产后端框架 mdc；production 中多库/认证等仍适用则保留 |

## 前端（独立于后端框架）

| 信号 | 产出 |
|------|------|
| `fe/` 或 Vite/React/Vue SPA | `fe-ui.mdc` |
| 站内 help 内容目录 | `fe-help.mdc` |

## Card 必填行

```text
| 后端框架 | go-zero / goframe / fastapi / flask / express / hono / 其他(…) |
| 框架置信 | confirmed（依赖+入口） / inferred（仅 arch） |
| 将产框架 mdc | 列表（无则写「无——理由」） |
```
