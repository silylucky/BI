# M1 后端启动链实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/core/`、`backend/app/main.py`、`backend/app/api/v1/`、`backend/app/auth/`、`backend/pyproject.toml`、`backend/.env.example`、`backend/alembic.ini`、`backend/migrations/`、`docker-compose.yml`、`fe/.env.example`（共 20 文件含 `__init__.py`）
> **子项：** BOOT-004、BOOT-001、BOOT-005、BOOT-003
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `backend/**/*.py`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 从零落地 M1 后端最小可联调闭环：Settings/JSON 日志/trace → FastAPI `/health`+CORS+OpenAPI → PostgreSQL+Alembic 空 revision → 鉴权中间件与 `GET /api/v1/me`。

**Architecture:** `pydantic-settings` 单例 `get_settings()` 供 `main.py` 与 `migrations/env.py` 复用；`TraceIdMiddleware` 经 `contextvars` 注入 JSON 日志；`AuthMiddleware` 在 `auth/middleware.py` 实现、`main.py` 注册，白名单 `PUBLIC_PATHS`；Alembic `target_metadata = None` 空初始 revision。

**Tech Stack:** Python 3.11+、FastAPI、uvicorn、pydantic-settings、SQLAlchemy 2.x、Alembic、psycopg3、PostgreSQL 16（docker compose）

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- API 前缀 `/api/v1/`；健康检查 `/health` 无 v1 前缀
- 错误体：`{"code", "message", "detail"}`
- `AuthMiddleware` 在 `backend/app/auth/middleware.py`，**`main.py` 注册**（非 `core/`）
- M1 `/me` 路径：`GET /api/v1/me`（非 `/api/v1/auth/me`）
- `Bearer dev` 仅 `VITALSPAN_ENV=development` 有效
- 单函数 ≤60 行；单 py 业务文件 ≤200 行
- 本轮不建 `tests/`、不写 PRD/API 文档回写
- 所有 shell 验证在对应 Task 完成后执行；`cd backend` 为 Alembic/uvicorn 工作目录

---

## 文件结构总览

| 文件 | BOOT | 职责 |
|------|------|------|
| `backend/app/__init__.py` | 004 | 包标记 |
| `backend/app/core/__init__.py` | 004 | 包标记 |
| `backend/app/core/config.py` | 004 | Settings + get_settings |
| `backend/app/core/logging.py` | 004 | JSON 日志 + traceId |
| `backend/app/core/middleware.py` | 004 | TraceIdMiddleware |
| `backend/.env.example` | 004 | 后端 env 模板 |
| `fe/.env.example` | 004 | 前端 env 模板 |
| `backend/pyproject.toml` | 001 | 依赖与工具配置 |
| `backend/app/main.py` | 001→003 | ASGI 入口、中间件、路由 |
| `backend/app/api/v1/__init__.py` | 001 | 导出 api_v1_router |
| `backend/app/api/v1/router.py` | 001→003 | v1 路由聚合 |
| `docker-compose.yml` | 005 | PostgreSQL 16 |
| `backend/alembic.ini` | 005 | Alembic 配置 |
| `backend/migrations/env.py` | 005 | 从 Settings 读 DATABASE_URL |
| `backend/migrations/script.py.mako` | 005 | revision 模板 |
| `backend/migrations/versions/0001_initial.py` | 005 | 空 revision |
| `backend/app/auth/__init__.py` | 003 | 包标记 |
| `backend/app/auth/middleware.py` | 003 | AuthMiddleware + PUBLIC_PATHS |
| `backend/app/auth/deps.py` | 003 | UserContext + get_current_user |
| `backend/app/api/v1/me.py` | 003 | GET /me |

---

### Task 1: BOOT-004 — 配置与日志基线

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/logging.py`
- Create: `backend/app/core/middleware.py`
- Create: `backend/.env.example`
- Create: `fe/.env.example`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `backend/app/core/`（`backend-fastapi.mdc`）

**Interfaces:**
- Produces: `get_settings() -> Settings`、`configure_logging(settings)`、`trace_id_var: ContextVar[str]`、`TraceIdMiddleware`

**验收标准:**
- V4-1：`get_settings()` 从 `backend/.env` 加载 `database_url`，无异常
- V4-3：`backend/.env.example`、`fe/.env.example` 覆盖 `arch.md` §7.2/§7.3 全部必填项
- 中间件与日志模块可 import，无语法错误

- [ ] **Step 1: 创建包 `__init__.py`**

创建空文件：

`backend/app/__init__.py` 与 `backend/app/core/__init__.py` 内容均为空文件（0 字节或仅换行）。

- [ ] **Step 2: 实现 `backend/app/core/config.py`**

```python
from functools import lru_cache
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    vitalspan_env: Literal["development", "staging", "production"] = "development"
    database_url: str
    secret_key: str
    credential_fernet_key: str
    cors_origins_raw: str = "http://localhost:5173"
    log_level: str = "INFO"
    query_default_limit: int = 1000
    query_timeout_seconds: int = 30
    analytics_database_url: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: 实现 `backend/app/core/logging.py`**

```python
import json
import logging
import logging.config
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

from app.core.config import Settings

trace_id_var: ContextVar[str | None] = ContextVar("trace_id", default=None)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        trace_id = trace_id_var.get()
        if trace_id:
            payload["traceId"] = trace_id
        for key in ("method", "path", "status_code"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(settings: Settings) -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"json": {"()": JsonFormatter}},
            "handlers": {
                "stdout": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {"handlers": ["stdout"], "level": settings.log_level.upper()},
        }
    )
```

- [ ] **Step 4: 实现 `backend/app/core/middleware.py`**

```python
import logging
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import trace_id_var

logger = logging.getLogger("vitalspan.http")


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("X-Trace-Id")
        trace_id = incoming or uuid.uuid4().hex
        token = trace_id_var.set(trace_id)
        logger.info(
            "request_started",
            extra={"method": request.method, "path": request.url.path},
        )
        try:
            response = await call_next(request)
        finally:
            trace_id_var.reset(token)
        response.headers["X-Trace-Id"] = trace_id
        logger.info(
            "request_finished",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
            },
        )
        return response
```

- [ ] **Step 5: 创建环境变量模板**

`backend/.env.example`:

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

`fe/.env.example`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 6: 验证 V4-1**

```bash
cd /workspace/backend
cp .env.example .env
python -c "from app.core.config import get_settings; print(get_settings().database_url)"
```

Expected: 打印 `postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan`，exit 0。

- [ ] **Step 7: 验证 V4-3（变量名对照）**

```bash
grep -E '^(VITALSPAN_ENV|DATABASE_URL|SECRET_KEY|CREDENTIAL_FERNET_KEY|CORS_ORIGINS|LOG_LEVEL|QUERY_DEFAULT_LIMIT|QUERY_TIMEOUT_SECONDS)' /workspace/backend/.env.example | wc -l
grep 'VITE_API_BASE_URL' /workspace/fe/.env.example
```

Expected: 第一命令输出 `8`；第二命令匹配 `VITE_API_BASE_URL=http://localhost:8000`。

- [ ] **Step 8: Commit**

```bash
git add backend/app/__init__.py backend/app/core/ backend/.env.example fe/.env.example
git commit -m "feat(backend): BOOT-004 settings, JSON logging, and trace middleware"
```

---

### Task 2: BOOT-001 — FastAPI 工程骨架

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/main.py`
- Create: `backend/app/api/v1/__init__.py`
- Create: `backend/app/api/v1/router.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `backend/app/main.py`、`backend/app/api/v1/`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `get_settings()`, `configure_logging()`, `TraceIdMiddleware`
- Produces: `app: FastAPI`、`api_v1_router: APIRouter`

**验收标准:**
- V1-1：`uvicorn app.main:app --reload --port 8000` 无 ImportError
- V1-2：`curl /health` → HTTP 200
- V1-3：浏览器 `/docs` 可加载
- V1-4：OPTIONS 预检含 `access-control-allow-origin`
- V1-5：`pyproject.toml` 含全部规定依赖
- V4-2：`/health` 响应日志 JSON 含非空 `traceId`

- [ ] **Step 1: 创建 `backend/pyproject.toml`**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "vitalspan-backend"
version = "0.1.0"
description = "VitalSpan BI platform backend"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "pydantic-settings>=2.6.0",
    "sqlalchemy>=2.0.36",
    "alembic>=1.14.0",
    "psycopg[binary]>=3.2.0",
]

[project.optional-dependencies]
dev = [
    "ruff>=0.8.0",
    "pytest>=8.3.0",
    "httpx>=0.28.0",
]

[tool.hatch.build.targets.wheel]
packages = ["app"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.pytest.ini_options]
testpaths = ["../tests"]
```

- [ ] **Step 2: 安装依赖（editable）**

```bash
cd /workspace/backend
pip install -e ".[dev]"
```

Expected: 安装成功，无错误。

- [ ] **Step 3: 创建 `backend/app/api/v1/router.py`**

```python
from fastapi import APIRouter

api_v1_router = APIRouter()
```

- [ ] **Step 4: 创建 `backend/app/api/v1/__init__.py`**

```python
from app.api.v1.router import api_v1_router

__all__ = ["api_v1_router"]
```

- [ ] **Step 5: 创建 `backend/app/main.py`（不含 AuthMiddleware）**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_v1_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.middleware import TraceIdMiddleware

settings = get_settings()
configure_logging(settings)

app = FastAPI(
    title="VitalSpan",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TraceIdMiddleware)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_v1_router, prefix="/api/v1")
```

- [ ] **Step 6: 启动服务并验证 V1-1 / V1-2 / V4-2**

终端 A：

```bash
cd /workspace/backend
uvicorn app.main:app --reload --port 8000
```

终端 B：

```bash
curl -i http://localhost:8000/health
```

Expected: `HTTP/1.1 200`；响应体 `{"status":"ok"}`；响应头含 `X-Trace-Id`；终端 A stdout 出现含 `"traceId"` 的 JSON 日志行。

- [ ] **Step 7: 验证 V1-4 CORS 预检**

```bash
curl -i -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:8000/health
```

Expected: 响应头含 `access-control-allow-origin`（值 `http://localhost:5173` 或 `*`）。

- [ ] **Step 8: 验证 V1-3**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs
```

Expected: `200`。

- [ ] **Step 9: 验证 V1-5**

```bash
grep -E 'fastapi|uvicorn|pydantic-settings|sqlalchemy|alembic|psycopg|ruff|pytest|httpx' /workspace/backend/pyproject.toml
```

Expected: 9 个包名均出现。

- [ ] **Step 10: 停止 uvicorn 并 Commit**

```bash
git add backend/pyproject.toml backend/app/main.py backend/app/api/v1/
git commit -m "feat(backend): BOOT-001 FastAPI skeleton with health, CORS, and v1 router"
```

---

### Task 3: BOOT-005 — 数据库迁移框架

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/alembic.ini`
- Create: `backend/migrations/env.py`
- Create: `backend/migrations/script.py.mako`
- Create: `backend/migrations/versions/0001_initial.py`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `backend/migrations/`、`docker-compose.yml`

**Interfaces:**
- Consumes: `get_settings().database_url`
- Produces: Alembic 可 `upgrade head` 的空 revision 链

**验收标准:**
- V5-1：`docker compose up -d` 后 postgres 健康
- V5-2：`alembic upgrade head` exit 0，`alembic_version` 表存在
- V5-3：`migrations/env.py` 连接串来自 `get_settings()`，非硬编码

- [ ] **Step 1: 创建仓库根 `docker-compose.yml`**

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

- [ ] **Step 2: 创建 `backend/alembic.ini`**

```ini
[alembic]
script_location = migrations
prepend_sys_path = .
version_path_separator = os

sqlalchemy.url =

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 3: 创建 `backend/migrations/env.py`**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = None


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: 创建 `backend/migrations/script.py.mako`**

使用 Alembic 标准模板（`alembic init` 默认内容）：

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 5: 创建 `backend/migrations/versions/0001_initial.py`**

```python
"""initial empty revision

Revision ID: 0001
Revises:
Create Date: 2026-07-03

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
```

- [ ] **Step 6: 启动 PostgreSQL（V5-1）**

```bash
cd /workspace
docker compose up -d
docker compose ps postgres
```

Expected: `postgres` 状态 `healthy` 或 `running` 且 healthcheck 通过。

- [ ] **Step 7: 执行迁移（V5-2）**

```bash
cd /workspace/backend
cp -n .env.example .env
alembic upgrade head
```

Expected: exit 0；输出含 `Running upgrade  -> 0001`。

- [ ] **Step 8: 确认 `alembic_version` 表**

```bash
cd /workspace/backend
python -c "
from sqlalchemy import create_engine, text
from app.core.config import get_settings
engine = create_engine(get_settings().database_url)
with engine.connect() as conn:
    row = conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
    print(row)
"
```

Expected: 打印 `0001`。

- [ ] **Step 9: 验证 V5-3（无硬编码 URL）**

```bash
grep -n 'get_settings' /workspace/backend/migrations/env.py
grep -E 'postgresql\+psycopg://' /workspace/backend/migrations/env.py && exit 1 || echo "no hardcoded url"
```

Expected: `get_settings` 出现；第二命令输出 `no hardcoded url`。

- [ ] **Step 10: Commit**

```bash
git add docker-compose.yml backend/alembic.ini backend/migrations/
git commit -m "feat(backend): BOOT-005 PostgreSQL docker and Alembic empty revision"
```

---

### Task 4: BOOT-003 — 鉴权中间件骨架

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/middleware.py`
- Create: `backend/app/auth/deps.py`
- Create: `backend/app/api/v1/me.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `backend/app/main.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `backend/app/auth/`、`backend/app/api/v1/me.py`、`backend/app/main.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `get_settings()`, `app: FastAPI`, `api_v1_router`
- Produces: `AuthMiddleware`, `PUBLIC_PATHS`, `get_current_user`, `GET /api/v1/me`

**验收标准:**
- V3-1：`GET /health` 无 Token → 200
- V3-2：`GET /api/v1/me` 无 Token → 401
- V3-3：`Bearer dev` → 200，JSON 含 `id`、`username`、`roles`
- V3-4：`GET /docs` 无 Token → 200
- V3-5：`main.py` 含 `AuthMiddleware` 注册与 `include_router(..., prefix="/api/v1")`

- [ ] **Step 1: 创建 `backend/app/auth/__init__.py`**

空文件。

- [ ] **Step 2: 实现 `backend/app/auth/deps.py`**

```python
from fastapi import HTTPException, Request
from pydantic import BaseModel


class UserContext(BaseModel):
    id: str
    username: str
    roles: list[str]


async def get_current_user(request: Request) -> UserContext:
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Not authenticated", "detail": None},
        )
    return user
```

- [ ] **Step 3: 实现 `backend/app/auth/middleware.py`**

```python
import json

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.auth.deps import UserContext
from app.core.config import Settings, get_settings

PUBLIC_PATHS: frozenset[str] = frozenset({
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
})


def _unauthorized_response() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"code": "UNAUTHORIZED", "message": "Missing or invalid bearer token", "detail": None},
    )


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings | None = None) -> None:
        super().__init__(app)
        self.settings = settings or get_settings()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith("/docs"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _unauthorized_response()

        token = auth_header.removeprefix("Bearer ").strip()
        if (
            token == "dev"
            and self.settings.vitalspan_env == "development"
        ):
            request.state.user = UserContext(id="dev", username="dev", roles=["admin"])
            return await call_next(request)

        return _unauthorized_response()
```

- [ ] **Step 4: 实现 `backend/app/api/v1/me.py`**

```python
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.deps import UserContext, get_current_user

router = APIRouter(tags=["auth"])


class UserResponse(BaseModel):
    id: str
    username: str
    roles: list[str]


@router.get("/me", response_model=UserResponse)
async def read_me(
    current_user: Annotated[UserContext, Depends(get_current_user)],
) -> UserContext:
    return current_user
```

- [ ] **Step 5: 修改 `backend/app/api/v1/router.py` 挂载 me**

```python
from fastapi import APIRouter

from app.api.v1.me import router as me_router

api_v1_router = APIRouter()
api_v1_router.include_router(me_router)
```

- [ ] **Step 6: 修改 `backend/app/main.py` 注册 AuthMiddleware**

在 `TraceIdMiddleware` **之后**追加（`add_middleware` 后注册者先执行，Auth 为最外层）：

```python
from app.auth.middleware import AuthMiddleware

# ... existing middleware ...
app.add_middleware(TraceIdMiddleware)
app.add_middleware(AuthMiddleware)
```

完整 `main.py` 中间件段应为：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TraceIdMiddleware)
app.add_middleware(AuthMiddleware)
```

- [ ] **Step 7: 启动服务并验证 V3-1 ~ V3-4**

```bash
cd /workspace/backend
uvicorn app.main:app --reload --port 8000
```

另开终端：

```bash
# V3-1
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health
# Expected: 200

# V3-2
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/me
# Expected: 401

# V3-3
curl -s -H "Authorization: Bearer dev" http://localhost:8000/api/v1/me
# Expected: {"id":"dev","username":"dev","roles":["admin"]}

# V3-4
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs
# Expected: 200
```

- [ ] **Step 8: 验证 V3-5**

```bash
grep 'AuthMiddleware' /workspace/backend/app/main.py
grep "include_router(api_v1_router, prefix=\"/api/v1\")" /workspace/backend/app/main.py
```

Expected: 两行均匹配。

- [ ] **Step 9: 验证非 development 拒绝 dev token（安全）**

```bash
cd /workspace/backend
VITALSPAN_ENV=production uvicorn app.main:app --port 8001 &
sleep 2
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer dev" http://localhost:8001/api/v1/me
kill %1
```

Expected: `401`（若 shell 后台任务不便，可临时改 `.env` 中 `VITALSPAN_ENV=production` 后同样验证）。

- [ ] **Step 10: Commit**

```bash
git add backend/app/auth/ backend/app/api/v1/me.py backend/app/api/v1/router.py backend/app/main.py
git commit -m "feat(backend): BOOT-003 auth middleware and GET /api/v1/me"
```

---

## 全链路验收（Task 4 完成后）

在 `backend/` 目录，PostgreSQL 已 `docker compose up -d`：

```bash
cd /workspace/backend
uvicorn app.main:app --port 8000 &
UVICORN_PID=$!
sleep 2

curl -sf http://localhost:8000/health | grep -q '"status":"ok"'
curl -sf -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/me | grep -q 401
curl -sf -H "Authorization: Bearer dev" http://localhost:8000/api/v1/me | grep -q '"username":"dev"'
alembic upgrade head

kill $UVICORN_PID
```

Expected: 全部命令 exit 0。

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| design 四子项均有 Task | ✅ Task 1–4 对应 BOOT-004/001/005/003 |
| 无 TBD/TODO 占位 | ✅ |
| 每 Task 有验证命令与预期输出 | ✅ |
| 文件数 ≤20 | ✅ 20 文件 |
| 前端 UI Task / UI skill | ✅ 无 UI；各 Task 标明 `UI skill: none` |
| 执行模式 option 1 | ✅ 头部已声明 |

---

## 执行交接

**Plan complete:** `docs/superpowers/plans/2026-07-03-m1-backend-bootstrap.md`

**执行方式（已选定）：** subagent-driven-development (option 1) — 每 Task 派发独立 implementer subagent，Task 间做 spec 合规 + 代码质量 review，末 Task 后做全分支 review。

**P3 入口 subagent:** `evolution-implementer`
