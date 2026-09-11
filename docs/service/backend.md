# 后端服务 · 运维与联调

> **定位**：配置、健康检查、本地/演示部署要点；**不是** API 端点目录。  
> **API 契约**： [api/README.md](../api/README.md) · 可消费联调见 [api/auth.md](../api/auth.md) 等域附录。  
> **架构与环境变量全集**： [arch.md](../arch.md) §7–§9。

```yaml
service: vitalspan-api
module: backend/app/main.py
default_port: 8000
health_path: /health
```

## 进程与入口

| 项 | 值 |
|----|-----|
| 框架 | FastAPI（`uvicorn app.main:app`） |
| 入口 | `backend/app/main.py` |
| API 前缀 | `/api/v1/` |
| OpenAPI | `/docs` · `/redoc` · `/openapi.json`（免鉴权） |
| 样例 REST 连接器 | `/sample-api/*`（REST 数据源测连用，见 [integration.md](../services/integration.md)） |

## 健康检查与探针

| 路径 | 鉴权 | 行为 | 用途 |
|------|------|------|------|
| `GET /health` | 免鉴权 | 返回 `{"status":"ok"}` | **进程存活**（liveness） |
| `GET /sample-api/health` | 按 sample-api 配置 | 样例 API 存活 | REST 连接器联调 |

**当前无独立 readiness 端点**：`/health` 不探测 `DATABASE_URL` 连通性。生产编排建议：

- **Liveness**：`GET /health`（失败则重启进程）
- **Readiness**：自定义脚本或网关侧探测 `GET /health` + `alembic current` 门禁 + 业务冒烟（如 `GET /api/v1/me` 带 token）；或后续在 arch 批准后再增 `GET /ready` 探测元库

公开免鉴权路径登记：`AuthMiddleware.PUBLIC_PATHS`（`/health`、`/docs`、`/redoc`、`/openapi.json`、`POST /api/v1/auth/login` 等）— 见 `backend/app/auth/middleware.py`。

## 配置真源

| 文件 | 说明 |
|------|------|
| `backend/.env.example` | 环境变量模板（可提交） |
| `backend/.env` | 本地/部署秘密（**禁止提交**） |
| `app/core/config.py` | `Settings`（pydantic-settings） |

**必填（生产）**：`DATABASE_URL` · `JWT_SM2_*` · `CREDENTIAL_SM4_KEY`；生产 `VITALSPAN_ENV=production` 时报表 SMTP 相关见 arch §7.2。

**无运行时功能开关**：`VITALSPAN_ENV` 仅为部署标识，不切换业务/NFR/mock 行为（见 production 红线）。

## 本地启动（最短路径）

```bash
# 1. 平台库 + 样例库
docker compose up -d postgres sample-mysql

# 2. 后端
cd backend
cp .env.example .env    # 填国密密钥
alembic upgrade head    # head 见 docs/data/README.md
uvicorn app.main:app --reload --port 8000

# 3. 前端（另终端）
cd fe && pnpm dev       # :5173
```

开发管理员：`username=admin`，密码 `VITALSPAN_DEV_ADMIN_PASSWORD`（默认 `changeme`，仅 development 种子）。

## 数据库迁移

| 项 | 说明 |
|----|------|
| 工具 | Alembic `backend/migrations/` |
| 当前 head | **0041** — [data/README.md](../data/README.md) |
| 升级 | `alembic upgrade head` |
| 回滚 | 按 revision 链 `alembic downgrade -1`（生产须 runbook） |

平台元库与业务分析库**分离**（ADR-07）：`DATABASE_URL` ≠ 各数据源连接串。

## 日志与观测

- 结构化 JSON 日志；请求 `traceId`（可透传 `X-Trace-Id`）
- 分类：请求 / 进程 / 作业；禁止生产裸 `print`
- 指标与告警归属：见 `docs/services/nfr.md` 与 production 红线 R2/R17

## 打包与演示部署

- 制品打包、上传、版本回滚 → **release-package** skill + `.cursor/rules/delivery.mdc`
- 演示机 SSH / 环境地图 → 仓库 `.dev/config.yaml`（密钥 `.dev/secrets.env`）
- 禁止无版本号手工拷贝二进制冒充交付

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-08-09 | 初版：健康探针、配置、迁移、本地启动 |
