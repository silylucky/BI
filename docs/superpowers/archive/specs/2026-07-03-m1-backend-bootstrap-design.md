# M1 后端启动链设计 — BOOT-004 / BOOT-001 / BOOT-005 / BOOT-003

```yaml
date: 2026-07-03
milestone: M1
round_target: docs/superpowers/evolution/2026-07-03-round-target.md
prd_ids: [BOOT-004, BOOT-001, BOOT-005, BOOT-003]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| 主题 | PRD ID | 执行顺序 | 用户感知 |
|------|--------|:--------:|----------|
| 配置与日志基线 | BOOT-004 | 1 | 启动可读 `.env`；`/health` 日志含 `traceId` |
| FastAPI 工程骨架 | BOOT-001 | 2 | `uvicorn` 启动；`/health` 200；`/docs` 可浏览；CORS 预检通过 |
| 数据库迁移框架 | BOOT-005 | 3 | `docker compose up` 后元库可连；`alembic upgrade head` 成功 |
| 鉴权中间件骨架 | BOOT-003 | 4 | 无 Token `/api/v1/me` → 401；`Bearer dev` → 200；`/health` 仍公开 |

**依赖链**：004 提供 `Settings`/日志/trace → 001 挂载中间件与 `/health` → 005 消费 `DATABASE_URL` → 003 在 001 路由壳上注册鉴权与 `/me`。

## 2. 现状与约束

- **代码现状**：`backend/` 目录尚未落地；本轮为 **从零补缺**，须严格遵循 `docs/arch.md` §4.2、`docs/automate/plan.md` §M1 实施展开。
- **范围框定模块**（≤3 业务域 + 基础设施）：`backend/app/core/`、`backend/app/`（`main.py` + `api/v1/`）、`backend/app/auth/`；`docker-compose.yml` + `backend/migrations/` 为基础设施交付物。
- **不含**：`fe/` 壳层（BOOT-002）、CI/测试门禁（BOOT-006）、业务域（`datasources/`、`query/` 等）、真实 JWT/用户表、Dataset、文档回写 checklist。
- **真理源优先级**：`round-target` > `plan.md` §M1 > `arch.md` > `prd/F01-BOOT.md`。
- **路径约定修正**：PRD F01-BOOT BOOT-003 代码锚点写「中间件注册于 `core/`」；**本轮以 plan/round-target 为准**：`AuthMiddleware` 实现在 `auth/middleware.py`，**`main.py` 注册**。

## 3. 方案比选（摘要）

### 3.1 配置加载（BOOT-004）

| 方案 | 说明 | 结论 |
|------|------|------|
| A `pydantic-settings` + `.env` | 类型校验、与 arch §7.2 字段表对齐 | **采用** |
| B 裸 `os.environ` | 无校验、易漂移 | 否决 |
| C YAML 配置文件 | 与 arch §7.1 约定不符 | 否决 |

### 3.2 请求 trace（BOOT-004）

| 方案 | 说明 | 结论 |
|------|------|------|
| A `contextvars` + JSON 日志 Formatter | 中间件写入 context，日志自动带 `traceId` | **采用** |
| B 每处手动传参 | 易遗漏、不可维护 | 否决 |

### 3.3 鉴权边界（BOOT-003）

| 方案 | 说明 | 结论 |
|------|------|------|
| A ASGI `AuthMiddleware` + 路由 `Depends` | 统一拦截未登记公开路径；handler 可注入用户上下文 | **采用** |
| B 仅 `Depends` 逐路由声明 | 易漏路由、OpenAPI 与运行时行为不一致 | 否决 |
| C 第三方 OAuth 库 | M1 超范围 | 否决 |

### 3.4 M1 `/me` 路径

| 方案 | 说明 | 结论 |
|------|------|------|
| A `GET /api/v1/me`（plan 验收路径） | M1 占位；二期迁移至 `GET /api/v1/auth/me`（见 `api/README`） | **采用** |
| B 直接 `GET /api/v1/auth/me` | 与 plan 验收命令不一致 | 本轮不采用 |

## 4. 总体架构

```mermaid
flowchart TB
    subgraph request [入站请求]
        Client[Client / curl / fe dev]
    end
    subgraph middleware [Starlette 中间件栈 — 后注册者先执行]
        CORS[CORSMiddleware]
        Trace[TraceIdMiddleware]
        Auth[AuthMiddleware]
    end
    subgraph app [FastAPI app]
        Health["GET /health"]
        V1["api_v1_router /api/v1/*"]
        Me["GET /me"]
    end
    subgraph infra [基础设施]
        Settings[core.config.Settings]
        Log[core.logging JSON]
        PG[(PostgreSQL docker)]
        Alembic[Alembic migrations]
    end
    Client --> CORS --> Trace --> Auth
    Auth --> Health
    Auth --> V1
    V1 --> Me
    Settings --> Alembic
    Trace --> Log
    Alembic --> PG
```

**中间件注册顺序**（`main.py` 中 `add_middleware` 调用顺序，自下而上执行）：

1. `CORSMiddleware`（最先 `add`，最内层；确保预检与响应头正确）
2. `TraceIdMiddleware`
3. `AuthMiddleware`（最后 `add`，最外层；除 `PUBLIC_PATHS` 外统一鉴权）

**`OPTIONS` 处理**：`AuthMiddleware` 对 `request.method == "OPTIONS"` **直接放行**，避免 CORS 预检被 401 拦截。

## 5. 分项设计

### 5.1 BOOT-004 — 配置与日志基线

#### 5.1.1 `backend/app/core/config.py`

- 基类：`pydantic_settings.BaseSettings`，`SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")`。
- 字段（对齐 `arch.md` §7.2）：

| 字段 | 环境变量 | 类型 | 默认 | 必填 |
|------|----------|------|------|:----:|
| `vitalspan_env` | `VITALSPAN_ENV` | `Literal["development","staging","production"]` | `development` | |
| `database_url` | `DATABASE_URL` | `str` | — | ✅ |
| `secret_key` | `SECRET_KEY` | `str` | — | ✅ |
| `credential_fernet_key` | `CREDENTIAL_FERNET_KEY` | `str` | — | ✅（M1 占位，业务未启用） |
| `cors_origins_raw` | `CORS_ORIGINS` | `str` | `http://localhost:5173` | |
| `log_level` | `LOG_LEVEL` | `str` | `INFO` | |
| `query_default_limit` | `QUERY_DEFAULT_LIMIT` | `int` | `1000` | |
| `query_timeout_seconds` | `QUERY_TIMEOUT_SECONDS` | `int` | `30` | |
| `analytics_database_url` | `ANALYTICS_DATABASE_URL` | `str \| None` | `None` | |

- `@computed_field` 或 `@property`：`cors_origins: list[str]` — 将 `CORS_ORIGINS` 按逗号拆分并 `strip()`。
- 单例：`@lru_cache` 的 `get_settings() -> Settings`，供 `main.py`、`migrations/env.py`、后续域模块复用。

#### 5.1.2 `backend/app/core/logging.py`

- 配置根 logger：`logging.config.dictConfig` 或等效初始化函数 `configure_logging(settings: Settings)`。
- **JSON 单行**输出到 stdout；字段至少包含：`timestamp`、`level`、`logger`、`message`、`traceId`（无请求上下文时省略或 `"-"`）。
- 实现方式：自定义 `logging.Formatter` 读取 `contextvars.ContextVar[str]`（`trace_id_var`），或使用 `python-json-logger`（若加入依赖须写入 `pyproject.toml`）；**优先标准库 Formatter**，避免额外运行时依赖。
- `LOG_LEVEL` 来自 `Settings`。

#### 5.1.3 `backend/app/core/middleware.py`

- `TraceIdMiddleware`（`BaseHTTPMiddleware` 或纯 ASGI，行数 ≤60）：
  - 入站：读取 `X-Trace-Id` 请求头；缺失则 `uuid.uuid4().hex`。
  - 写入 `trace_id_var`；`try/finally` 在请求结束重置。
  - 出站：响应头回写 `X-Trace-Id`（与 plan「可选」一致，**M1 实现**以便联调）。
  - 请求开始/结束各打一条 INFO 日志（含 `method`、`path`、`status_code`），日志 JSON 含 `traceId`。

#### 5.1.4 环境变量模板

**`backend/.env.example`**（提交 Git）：

```dotenv
VITALSPAN_ENV=development
DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan
SECRET_KEY=change-me-in-production
CREDENTIAL_FERNET_KEY=change-me-32-byte-fernet-key-placeholder
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
# 二期查询硬上限（M1 仅占位）
QUERY_DEFAULT_LIMIT=1000
QUERY_TIMEOUT_SECONDS=30
# ANALYTICS_DATABASE_URL=  # M1B 同步/清洗目标库
```

**`fe/.env.example`**：

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

#### 5.1.5 验收标准（可测试）

| # | 条件 | 预期 |
|---|------|------|
| V4-1 | `cd backend && python -c "from app.core.config import get_settings; print(get_settings().database_url)"` 且存在 `.env` | 打印非空连接串，无异常 |
| V4-2 | 启动服务后 `curl -i http://localhost:8000/health` | 响应 200；对应 stdout 日志 JSON 含 `"traceId"` 且非空 |
| V4-3 | 对比 `backend/.env.example`、`fe/.env.example` 与 `arch.md` §7.2/§7.3 | 变量名与注释覆盖 arch 表全部必填项 |

---

### 5.2 BOOT-001 — FastAPI 工程骨架

#### 5.2.1 `backend/pyproject.toml`

- **运行时**：`fastapi`、`uvicorn[standard]`、`pydantic-settings`、`sqlalchemy`、`alembic`、`psycopg[binary]`。
- **开发**：`ruff`、`pytest`、`httpx`。
- `[tool.ruff]`：line-length 100，target py311+（与仓库 Python 版本一致）。
- `[tool.pytest.ini_options]`：`testpaths = ["../tests"]`（为 BOOT-006 预留，本轮不建测试）。
- 包发现：`[tool.setuptools.packages.find]` 或 hatchling 等价配置，使 `app` 可从 `backend/` 目录 import。

#### 5.2.2 `backend/app/main.py`

- `app = FastAPI(title="VitalSpan", version="0.1.0", docs_url="/docs", redoc_url="/redoc", openapi_url="/openapi.json")`。
- 启动时：`configure_logging(get_settings())`。
- 中间件：按 §4 顺序注册 CORS（`allow_origins=settings.cors_origins`、`allow_credentials=True`、`allow_methods=["*"]`、`allow_headers=["*"]`）、`TraceIdMiddleware`。
- `@app.get("/health")` → `{"status": "ok"}`（200）。
- `from app.api.v1 import api_v1_router`；`app.include_router(api_v1_router, prefix="/api/v1")`（BOOT-003 前 router 可为空）。
- **不在此轮**注册 `AuthMiddleware`（003 增量修改同一文件）。

#### 5.2.3 `backend/app/api/v1/router.py` + `__init__.py`

- `api_v1_router = APIRouter()`，M1 初始无子路由。
- `__init__.py` 导出 `api_v1_router`。

#### 5.2.4 隐含包初始化

- 实现阶段须添加最小 `backend/app/__init__.py`、`backend/app/core/__init__.py`（空文件即可），不扩展为第四业务域。

#### 5.2.5 验收标准（可测试）

| # | 条件 | 预期 |
|---|------|------|
| V1-1 | `cd backend && uvicorn app.main:app --reload --port 8000` | 进程启动无 ImportError |
| V1-2 | `curl -i http://localhost:8000/health` | `HTTP/1.1 200` |
| V1-3 | 浏览器访问 `http://localhost:8000/docs` | OpenAPI Swagger UI 可加载 |
| V1-4 | `curl -i -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET" http://localhost:8000/health` | 响应含 `access-control-allow-origin` |
| V1-5 | `pyproject.toml` 依赖表 | 含 fastapi、uvicorn、pydantic-settings、sqlalchemy、alembic、psycopg、ruff、pytest、httpx |

---

### 5.3 BOOT-005 — 数据库迁移框架

#### 5.3.1 `docker-compose.yml`（仓库根）

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: vitalspan
      POSTGRES_PASSWORD: vitalspan
      POSTGRES_DB: vitalspan
    volumes:
      - vitalspan_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vitalspan"]
      interval: 5s
      timeout: 5s
      retries: 5
volumes:
  vitalspan_pg_data:
```

- 与 `backend/.env.example` 中 `DATABASE_URL` **主机/库名/凭据一致**。
- 本轮 **仅 PostgreSQL**；arch §9 提及的可选 MySQL 样例库属后续里程碑。

#### 5.3.2 Alembic 布局

| 文件 | 职责 |
|------|------|
| `backend/alembic.ini` | `script_location = migrations`；`sqlalchemy.url` 留空或占位（**运行时由 env.py 覆盖**） |
| `backend/migrations/env.py` | `from app.core.config import get_settings`；`config.set_main_option("sqlalchemy.url", get_settings().database_url)`；`target_metadata = None`（M1 无 ORM 模型） |
| `backend/migrations/script.py.mako` | Alembic 标准模板 |
| `backend/migrations/versions/<rev>_initial.py` | `upgrade()`/`downgrade()` 均为 `pass`（空 revision） |

- `env.py` 须在 `backend/` 为 cwd 时可 import `app`（与 `alembic upgrade` 工作目录一致）。

#### 5.3.3 验收标准（可测试）

| # | 条件 | 预期 |
|---|------|------|
| V5-1 | 仓库根 `docker compose up -d` | `postgres` 健康 |
| V5-2 | `cd backend && cp .env.example .env && alembic upgrade head` | exit 0；`alembic_version` 表存在 |
| V5-3 | 检查 `migrations/env.py` | 连接串来源 `get_settings().database_url`，非硬编码 |

---

### 5.4 BOOT-003 — 鉴权中间件骨架

#### 5.4.1 公开路径

```python
PUBLIC_PATHS: frozenset[str] = frozenset({
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
})
```

- 匹配规则：**精确路径**等于上表；`/docs/oauth2-redirect` 等 Swagger 静态资源随 `/docs` 路由由 FastAPI 处理，中间件在路由层之前仅见 API 路径——若实测 `/docs` 子路径被拦截，扩展为 `path.startswith("/docs")` 等前缀规则（实现时以 `curl /docs` 可访问为验收）。
- `PUBLIC_PATHS` 定义在 `auth/middleware.py` 并导出，供测试与文档引用。

#### 5.4.2 `backend/app/auth/middleware.py`

- `AuthMiddleware`：
  - `OPTIONS` → 直接 `call_next`。
  - `request.url.path in PUBLIC_PATHS` → 放行。
  - 解析 `Authorization: Bearer <token>`；缺失或格式错误 → **401** JSON：`{"code": "UNAUTHORIZED", "message": "...", "detail": null}`（对齐 `backend-fastapi.mdc` 错误体）。
  - M1 占位：token == `"dev"` **且** `settings.vitalspan_env == "development"` → 注入 `request.state.user`（`UserContext` 简单 dataclass/Pydantic：`id`, `username`, `roles`）。
  - 非 development 环境接受 `dev` token → 401（防止生产误用）。
  - 其他 token → 401（M1 不实现 JWT 校验）。

#### 5.4.3 `backend/app/auth/deps.py`

- `UserContext` 模型：`id: str`, `username: str`, `roles: list[str]`。
- `async def get_current_user(request: Request) -> UserContext`：从 `request.state.user` 读取；缺失抛 `HTTPException(401)`（供路由层 `Depends` 使用）。

#### 5.4.4 `backend/app/api/v1/me.py`

- `@router.get("/me", response_model=UserResponse)`。
- `UserResponse` 字段与 `UserContext` 一致（可放在 `me.py` 或内联 Pydantic，**不新建 `schemas/` 目录**以控制文件数）。
- 依赖：`Annotated[UserContext, Depends(get_current_user)]`。
- 占位响应（`Bearer dev`）：`{"id": "dev", "username": "dev", "roles": ["admin"]}`。

#### 5.4.5 `backend/app/api/v1/router.py`（增量）

- `api_v1_router.include_router(me_router)`（`me_router` 无额外 prefix，最终路径 `GET /api/v1/me`）。

#### 5.4.6 `backend/app/main.py`（增量）

- `app.add_middleware(AuthMiddleware)` 在 `TraceIdMiddleware` **之后**注册（见 §4）。
- 保持 `include_router(api_v1_router, prefix="/api/v1")`。

#### 5.4.7 验收标准（可测试）

| # | 条件 | 预期 |
|---|------|------|
| V3-1 | `curl -i http://localhost:8000/health` | 200，无 `Authorization` |
| V3-2 | `curl -i http://localhost:8000/api/v1/me` | 401 |
| V3-3 | `curl -i -H "Authorization: Bearer dev" http://localhost:8000/api/v1/me` | 200；JSON 含 `id`、`username`、`roles` |
| V3-4 | `curl -i http://localhost:8000/docs` | 200，无 Token |
| V3-5 | 检查 `main.py` | 存在 `AuthMiddleware` 注册与 `include_router(..., prefix="/api/v1")` |

## 6. 范围框定文件列表

| 文件 | BOOT | 操作 |
|------|------|------|
| `backend/app/core/config.py` | 004 | 新建 |
| `backend/app/core/logging.py` | 004 | 新建 |
| `backend/app/core/middleware.py` | 004 | 新建 |
| `backend/.env.example` | 004 | 新建 |
| `fe/.env.example` | 004 | 新建 |
| `backend/pyproject.toml` | 001 | 新建 |
| `backend/app/main.py` | 001, 003 | 新建 → 增量 |
| `backend/app/api/v1/router.py` | 001, 003 | 新建 → 增量 |
| `backend/app/api/v1/__init__.py` | 001 | 新建 |
| `docker-compose.yml` | 005 | 新建 |
| `backend/alembic.ini` | 005 | 新建 |
| `backend/migrations/env.py` | 005 | 新建 |
| `backend/migrations/versions/*_initial.py` | 005 | 新建 |
| `backend/migrations/script.py.mako` | 005 | 新建 |
| `backend/app/auth/middleware.py` | 003 | 新建 |
| `backend/app/auth/deps.py` | 003 | 新建 |
| `backend/app/api/v1/me.py` | 003 | 新建 |

**合计**：17 个显式路径 + 最少 3 个空 `__init__.py`（`app/`、`core/`、`auth/`）≈ 20 文件上限内。

## 7. 非目标（明确不做）

| 项 | 原因 |
|----|------|
| `fe/` React 壳层、主题、路由 | BOOT-002 下轮；本轮仅 `fe/.env.example` |
| `.github/` CI、`tests/` 用例 | BOOT-006 下轮 |
| 真实 JWT 签发/校验、用户 ORM、登录 API | AUTH-* / M7 |
| `GET /api/v1/auth/me` 正式路径 | 二期对齐 `api/README`；M1 仅用 `/api/v1/me` |
| `core/` 内实现 `AuthMiddleware` | 与 plan 冲突；鉴权归 `auth/` |
| 业务表 migration、SQLAlchemy models | 后续里程碑 |
| `CREDENTIAL_FERNET_KEY` 加解密逻辑 | M1 仅占位环境变量 |
| PRD/plan/services/api 文档回写 | M1 文档 checklist 单独轮次 |
| GPL BI 运行时依赖 | NFR-08 |

## 8. PRD 8 维薄弱项对齐

| 薄弱维 | 本轮对策 |
|--------|----------|
| **完整度**（各子项 ≈5%） | 四项形成可联调闭环：配置→HTTP 壳→元库迁移→鉴权分界；交付物与 plan 表一一对应 |
| **可靠性**（0%） | 结构化 JSON 日志 + 全链路 `traceId`；`/health` 探针；Alembic 可重复 `upgrade head`；docker healthcheck |
| **测试覆盖**（0%） | 本轮不建测试；设计预留 `testpaths` 与可脚本化 curl 验收，供 BOOT-006 转为 `TestClient` smoke |
| **架构**（8–12%） | 严格 entry/core/auth 分层；`core` 不依赖 domain；`main.py` 薄编排 |
| **安全**（8–12%） | `PUBLIC_PATHS` 白名单；`Bearer dev` 仅 `development`；统一 401 错误体；密钥仅 `.env` 不入库 |
| **性能 / 交互** | M1 不评；无前端 UI |

## 9. 实施顺序与合并策略

单 PR 按依赖顺序提交（推荐 commit 分组便于 review）：

1. **Commit A — BOOT-004**：`core/*` + `.env.example` ×2  
2. **Commit B — BOOT-001**：`pyproject.toml`、`main.py`（无 Auth）、`api/v1/*`  
3. **Commit C — BOOT-005**：`docker-compose.yml`、Alembic 全家桶  
4. **Commit D — BOOT-003**：`auth/*`、`me.py`、`router.py`/`main.py` 增量  

每步后执行对应验收表；**全部通过后**方可标记 plan 勾选（文档回写非本轮）。

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Alembic `env.py` import 路径失败 | 统一 `cd backend` 执行；`pyproject.toml` 配置 PYTHONPATH 或 editable install |
| CORS 预检被 Auth 拦截 | `OPTIONS` 放行 + CORSMiddleware 在内层 |
| `/docs` 子资源 401 | 验收失败时扩展 `PUBLIC_PATHS` 前缀规则并记录于实现 PR |
| `Bearer dev` 泄露生产 | `vitalspan_env != development` 时拒绝 dev token |

## 11. Self-review 清单

- [x] 覆盖 round-target 全部 4 子项
- [x] 未超出范围框定模块与 ~20 文件上限
- [x] 无 TBD / TODO 占位
- [x] 验收标准可脚本化测试
- [x] 未触及前端 UI 文件 → `ui_design_skill: none`
- [x] 与 `arch.md`、`plan.md`、`backend-fastapi.mdc` 一致
- [x] 禁止生产代码（本文档仅设计）
