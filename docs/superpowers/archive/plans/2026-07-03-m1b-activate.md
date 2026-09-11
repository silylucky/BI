# M1B 数据接入首期实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `docker-compose.yml`、`docker/sample-mysql/init.sql`（基础设施种子，不计入 20 文件预算）、`backend/app/core/config.py`、`backend/.env.example`、`backend/pyproject.toml`、`backend/migrations/versions/0002_ingestion_tables.py`、`backend/app/ingestion/{__init__,models,etl_rules,sync_executor,scheduler}.py`、`backend/app/api/v1/{router.py,ingestion/__init__.py,ingestion/sync.py}`、`backend/app/main.py`、`docs/api/README.md`、`fe/src/lib/api.ts`、`fe/src/pages/admin/ingestion/*`（4 页）、`fe/src/routes.tsx`、`fe/src/components/ui/{badge,skeleton,select,alert-dialog}.tsx`、`tests/test_ingestion_{config,api,etl_rules}.py`
> **子项：** DATA-004、DATA-001、ETL-001、DATA-002、DATA-003
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `backend/**`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 落地 M1B 首期闭环：托管分析库 + 样例源 → 内联 `SourceConnection` 同步任务 CRUD/API → 全量执行器（手动/定时、1 次重试）→ JSON 清洗规则 → Admin `/admin/ingestion/*` 配置台。

**Architecture:** 元库 `postgres:5432` 存 `ingestion_*` 元表（Alembic `0002`）；托管库 `analytics-postgres:5433` 由执行器 `CREATE TABLE IF NOT EXISTS` + `TRUNCATE` + 批量 INSERT；样例源 `sample-mysql:3307`；域逻辑在 `backend/app/ingestion/`，`api/v1/ingestion/sync.py` 薄 entry；进程内 `APScheduler` 在 `main.py` lifespan 启停；前端 M1B 最小 `apiFetch` + 页面内 state。

**Tech Stack:** Python 3.11+、FastAPI、SQLAlchemy 2.0、Alembic、APScheduler、pymysql、cryptography(Fernet)、PostgreSQL 16、MySQL 8、React 19 + Vite + Tailwind v4 + b-design-system

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- M1B 源连接：**任务内联 `SourceConnection`**；`source_data_source_id` 预留可空；**不调用** M3 数据源 API
- API 前缀 `/api/v1/`；鉴权 `Bearer dev`（development）；错误体 `{"code","message","detail"}`
- 密码 Fernet 加密入库；API 响应密码恒 `"***"`
- `analytics_database_url` 未配置时 run 返回 503 `ANALYTICS_DB_NOT_CONFIGURED`
- 全量同步行上限 `INGESTION_MAX_ROWS = 100_000`
- 单函数 ≤60 行；单 py 业务文件 ≤200 行
- 本轮不做：DATA-005、`services/ingestion.md` 终稿、侧栏 nav 增补、TanStack Query、CI compose 集成测试
- Shell 验证：`docker compose` 在项目根；`cd backend` 为 Alembic/pytest；`cd fe` 为 pnpm

---

## 文件结构总览

| 文件 | PRD | 职责 |
|------|-----|------|
| `docker-compose.yml` | DATA-004 | analytics-postgres + sample-mysql |
| `docker/sample-mysql/init.sql` | DATA-004 | 脏数据种子表 |
| `backend/.env.example` | DATA-004 | ANALYTICS_DATABASE_URL 等 |
| `backend/app/core/config.py` | DATA-004 | analytics_url 保持可选 |
| `backend/pyproject.toml` | DATA-004 | apscheduler/pymysql/cryptography |
| `backend/migrations/versions/0002_ingestion_tables.py` | DATA-004,001 | ingestion_* 元表 |
| `backend/app/ingestion/models.py` | DATA-001 | ORM、Session、Fernet helper |
| `backend/app/ingestion/etl_rules.py` | ETL-001 | 四类 JSON 规则引擎 |
| `backend/app/ingestion/sync_executor.py` | DATA-002 | 全量同步 + 重试 |
| `backend/app/ingestion/scheduler.py` | DATA-002 | APScheduler cron |
| `backend/app/api/v1/ingestion/sync.py` | DATA-001,002,ETL | CRUD + run + runs + etl-rules |
| `backend/app/api/v1/router.py` | DATA-001 | include ingestion router |
| `backend/app/main.py` | DATA-002 | lifespan 启停 scheduler |
| `docs/api/README.md` | DATA-001 | §9 规划→已实现 |
| `fe/src/lib/api.ts` | DATA-003 | 最小 envelope fetch |
| `fe/src/pages/admin/ingestion/*.tsx` | DATA-003 | 4 个 Admin 页 |
| `fe/src/routes.tsx` | DATA-003 | `/admin/ingestion/*` |
| `fe/src/components/ui/{badge,skeleton,select,alert-dialog}.tsx` | DATA-003 | skill 模板组件 |
| `tests/test_ingestion_*.py` | 各子项 | 配置/API/ETL 单测 |

---

### Task 1: DATA-004 — 托管分析库与配置项

**Files:**
- Modify: `docker-compose.yml`
- Create: `docker/sample-mysql/init.sql`
- Modify: `backend/.env.example`
- Modify: `backend/app/core/config.py`
- Modify: `backend/pyproject.toml`
- Create: `backend/migrations/versions/0002_ingestion_tables.py`
- Create: `tests/test_ingestion_config.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `backend/app/core/`、`docker-compose.yml`

**Interfaces:**
- Produces: `Settings.analytics_database_url: str | None`、Alembic revision `0002`、compose 服务 `analytics-postgres`/`sample-mysql`

- [ ] **Step 1: 扩展 `docker-compose.yml`**

在 `postgres` 服务后追加：

```yaml
  analytics-postgres:
    image: postgres:16-alpine
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: vitalspan
      POSTGRES_PASSWORD: vitalspan
      POSTGRES_DB: analytics
    volumes:
      - vitalspan_analytics_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vitalspan -d analytics"]
      interval: 5s
      timeout: 5s
      retries: 5

  sample-mysql:
    image: mysql:8
    ports:
      - "3307:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: sample_db
      MYSQL_USER: sample
      MYSQL_PASSWORD: sample
    volumes:
      - ./docker/sample-mysql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-usample", "-psample"]
      interval: 5s
      timeout: 5s
      retries: 10
```

在 `volumes:` 节追加 `vitalspan_analytics_pg_data:`。

- [ ] **Step 2: 创建 `docker/sample-mysql/init.sql`**

```sql
CREATE TABLE IF NOT EXISTS dirty_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_name VARCHAR(128) NOT NULL,
  amount VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  note VARCHAR(255) NULL
);

INSERT INTO dirty_orders (product_name, amount, status, note) VALUES
  ('Widget A', '12.5', 'active', NULL),
  ('Widget B', 'not-a-number', 'active', '脏金额'),
  ('Widget C', '99', 'deleted', '应过滤'),
  ('Widget D', '0', 'active', NULL),
  ('Widget E', '15.0', 'active', '正常备注');
```

- [ ] **Step 3: 更新 `backend/.env.example`**

将 `# ANALYTICS_DATABASE_URL=` 行替换为：

```env
ANALYTICS_DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics
# 样例源（文档注释，非 Settings 字段）
# SAMPLE_MYSQL_URL=mysql+pymysql://sample:sample@localhost:3307/sample_db
```

- [ ] **Step 4: `backend/pyproject.toml` 增依赖**

在 `dependencies` 列表追加：

```toml
    "apscheduler>=3.10.0",
    "pymysql>=1.1.0",
    "cryptography>=43.0.0",
```

- [ ] **Step 5: 创建 Alembic `0002_ingestion_tables.py`**

```python
"""ingestion tables

Revision ID: 0002
Revises: 0001
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ingestion_sync_jobs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("source_type", sa.String(16), nullable=False),
        sa.Column("source_host", sa.String(255), nullable=False),
        sa.Column("source_port", sa.Integer(), nullable=False),
        sa.Column("source_database", sa.String(128), nullable=False),
        sa.Column("source_username", sa.String(128), nullable=False),
        sa.Column("source_password_encrypted", sa.Text(), nullable=False),
        sa.Column("source_table", sa.String(128), nullable=False),
        sa.Column("target_table", sa.String(128), nullable=False),
        sa.Column("schedule_cron", sa.String(64), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("source_data_source_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "ingestion_sync_runs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("job_id", sa.Uuid(), sa.ForeignKey("ingestion_sync_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rows_synced", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("trace_id", sa.String(64), nullable=False),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_index(
        "ix_ingestion_sync_runs_job_started",
        "ingestion_sync_runs",
        ["job_id", "started_at"],
    )
    op.create_table(
        "ingestion_etl_rules",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("job_id", sa.Uuid(), sa.ForeignKey("ingestion_sync_jobs.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("rules", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ingestion_etl_rules")
    op.drop_index("ix_ingestion_sync_runs_job_started", table_name="ingestion_sync_runs")
    op.drop_table("ingestion_sync_runs")
    op.drop_table("ingestion_sync_jobs")
```

- [ ] **Step 6: 写失败测试 `tests/test_ingestion_config.py`**

```python
import os

import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_loads_analytics_database_url_from_env(monkeypatch):
    url = "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", url)
    settings = Settings(
        database_url=os.environ["DATABASE_URL"],
        secret_key=os.environ["SECRET_KEY"],
        credential_fernet_key=os.environ["CREDENTIAL_FERNET_KEY"],
    )
    assert settings.analytics_database_url == url


def test_settings_analytics_database_url_optional(monkeypatch):
    monkeypatch.delenv("ANALYTICS_DATABASE_URL", raising=False)
    settings = Settings(
        database_url=os.environ["DATABASE_URL"],
        secret_key=os.environ["SECRET_KEY"],
        credential_fernet_key=os.environ["CREDENTIAL_FERNET_KEY"],
    )
    assert settings.analytics_database_url is None
```

- [ ] **Step 7: 安装依赖并验证**

Run: `cd /workspace/backend && pip install -e ".[dev]" -q && cd /workspace && docker compose up -d && sleep 15 && cd backend && alembic upgrade head`

Expected: `0002` 应用成功；`docker compose ps` 显示 3 服务 healthy

Run: `cd /workspace/backend && pytest tests/test_ingestion_config.py -v`

Expected: PASS

Run: `mysql -h 127.0.0.1 -P 3307 -u sample -psample -e 'SELECT COUNT(*) FROM sample_db.dirty_orders'`

Expected: 输出 `5`

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml docker/sample-mysql/init.sql backend/.env.example backend/pyproject.toml backend/migrations/versions/0002_ingestion_tables.py tests/test_ingestion_config.py
git commit -m "feat(ingestion): DATA-004 analytics DB compose and migration"
```

---

### Task 2: DATA-001 — 同步任务模型与 API

**Files:**
- Create: `backend/app/ingestion/__init__.py`
- Create: `backend/app/ingestion/models.py`
- Create: `backend/app/api/v1/ingestion/__init__.py`
- Create: `backend/app/api/v1/ingestion/sync.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `docs/api/README.md`
- Create: `tests/test_ingestion_api.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**UI skill:** none

**触及域：** `backend/app/ingestion/`、`backend/app/api/v1/ingestion/`

**Interfaces:**
- Consumes: Alembic `0002` 表、`get_settings()`、`CREDENTIAL_FERNET_KEY`
- Produces: `encrypt_password`/`decrypt_password`、`get_meta_session()`、`SyncJob` ORM、CRUD routes under `/ingestion/sync-jobs`

- [ ] **Step 1: 写失败 API 测试**

`tests/test_ingestion_api.py`（先写 401 + 创建列表骨架）：

```python
import uuid

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def job_payload() -> dict:
    return {
        "name": "sample-mysql-orders",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_clean",
        "schedule_cron": None,
    }


def test_sync_jobs_list_requires_auth(client: TestClient):
    response = client.get("/api/v1/ingestion/sync-jobs")
    assert response.status_code == 401


def test_sync_jobs_crud_roundtrip(client: TestClient, auth_headers: dict, job_payload: dict):
    create = client.post("/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    body = create.json()
    job_id = body["id"]
    assert body["name"] == job_payload["name"]
    assert body["source"]["password"] == "***"

    listed = client.get("/api/v1/ingestion/sync-jobs", headers=auth_headers)
    assert listed.status_code == 200
    assert any(item["id"] == job_id for item in listed.json()["items"])

    detail = client.get(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["target_table"] == "orders_clean"

    delete = client.delete(f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers)
    assert delete.status_code == 204
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace/backend && pytest tests/test_ingestion_api.py -v`

Expected: FAIL（404 或 import error）

- [ ] **Step 3: 实现 `backend/app/ingestion/models.py`**

```python
from __future__ import annotations

import uuid
from datetime import datetime
from functools import lru_cache
from typing import Any, Literal

from cryptography.fernet import Fernet, InvalidToken
from pydantic import BaseModel, Field
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import get_settings

INGESTION_MAX_ROWS = 100_000


class Base(DeclarativeBase):
    pass


class SyncJob(Base):
    __tablename__ = "ingestion_sync_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_host: Mapped[str] = mapped_column(String(255), nullable=False)
    source_port: Mapped[int] = mapped_column(Integer, nullable=False)
    source_database: Mapped[str] = mapped_column(String(128), nullable=False)
    source_username: Mapped[str] = mapped_column(String(128), nullable=False)
    source_password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    source_table: Mapped[str] = mapped_column(String(128), nullable=False)
    target_table: Mapped[str] = mapped_column(String(128), nullable=False)
    schedule_cron: Mapped[str | None] = mapped_column(String(64), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_data_source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SyncRun(Base):
    __tablename__ = "ingestion_sync_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("ingestion_sync_jobs.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rows_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class EtlRuleSet(Base):
    __tablename__ = "ingestion_etl_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("ingestion_sync_jobs.id", ondelete="CASCADE"), unique=True)
    rules: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SourceConnectionIn(BaseModel):
    type: Literal["mysql", "postgres"]
    host: str
    port: int = Field(ge=1, le=65535)
    database: str
    username: str
    password: str
    table: str


class SourceConnectionOut(BaseModel):
    type: Literal["mysql", "postgres"]
    host: str
    port: int
    database: str
    username: str
    password: str = "***"
    table: str


def _fernet() -> Fernet:
    return Fernet(get_settings().credential_fernet_key.encode())


def encrypt_password(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_password(cipher: str) -> str:
    try:
        return _fernet().decrypt(cipher.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("invalid encrypted password") from exc


@lru_cache
def get_meta_engine():
    return create_engine(get_settings().database_url, pool_pre_ping=True)


def get_meta_session():
    return sessionmaker(bind=get_meta_engine(), autoflush=False, autocommit=False)()
```

创建空文件 `backend/app/ingestion/__init__.py`。

- [ ] **Step 4: 实现 `backend/app/api/v1/ingestion/sync.py`（CRUD + etl-rules，不含 run）**

```python
from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.ingestion.models import (
    EtlRuleSet,
    SourceConnectionIn,
    SourceConnectionOut,
    SyncJob,
    encrypt_password,
    get_meta_session,
)

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class SyncJobCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source: SourceConnectionIn
    target_table: str
    schedule_cron: str | None = None
    enabled: bool = True


class SyncJobUpdate(SyncJobCreate):
    pass


class SyncJobSummary(BaseModel):
    id: uuid.UUID
    name: str
    source_type: str
    target_table: str
    enabled: bool
    schedule_cron: str | None


class SyncJobDetail(SyncJobSummary):
    source: SourceConnectionOut
    source_data_source_id: uuid.UUID | None = None


class SyncJobListResponse(BaseModel):
    items: list[SyncJobSummary]


class EtlRulesPayload(BaseModel):
    rules: list[dict[str, Any]]


class EtlRulesResponse(BaseModel):
    rules: list[dict[str, Any]]


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _to_source_out(job: SyncJob) -> SourceConnectionOut:
    return SourceConnectionOut(
        type=job.source_type,  # type: ignore[arg-type]
        host=job.source_host,
        port=job.source_port,
        database=job.source_database,
        username=job.source_username,
        table=job.source_table,
    )


def _apply_source(job: SyncJob, source: SourceConnectionIn) -> None:
    job.source_type = source.type
    job.source_host = source.host
    job.source_port = source.port
    job.source_database = source.database
    job.source_username = source.username
    job.source_password_encrypted = encrypt_password(source.password)
    job.source_table = source.table


@router.get("/sync-jobs", response_model=SyncJobListResponse)
def list_sync_jobs(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobListResponse:
    jobs = db.scalars(select(SyncJob).order_by(SyncJob.created_at.desc())).all()
    return SyncJobListResponse(
        items=[
            SyncJobSummary(
                id=j.id,
                name=j.name,
                source_type=j.source_type,
                target_table=j.target_table,
                enabled=j.enabled,
                schedule_cron=j.schedule_cron,
            )
            for j in jobs
        ]
    )


@router.post("/sync-jobs", response_model=SyncJobDetail, status_code=status.HTTP_201_CREATED)
def create_sync_job(
    payload: SyncJobCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobDetail:
    job = SyncJob(
        name=payload.name,
        target_table=payload.target_table,
        schedule_cron=payload.schedule_cron,
        enabled=payload.enabled,
        source_data_source_id=None,
    )
    _apply_source(job, payload.source)
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=[]))
    db.commit()
    db.refresh(job)
    return SyncJobDetail(
        id=job.id,
        name=job.name,
        source_type=job.source_type,
        target_table=job.target_table,
        enabled=job.enabled,
        schedule_cron=job.schedule_cron,
        source=_to_source_out(job),
        source_data_source_id=job.source_data_source_id,
    )


@router.get("/sync-jobs/{job_id}", response_model=SyncJobDetail)
def get_sync_job(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobDetail:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None})
    return SyncJobDetail(
        id=job.id,
        name=job.name,
        source_type=job.source_type,
        target_table=job.target_table,
        enabled=job.enabled,
        schedule_cron=job.schedule_cron,
        source=_to_source_out(job),
        source_data_source_id=job.source_data_source_id,
    )


@router.put("/sync-jobs/{job_id}", response_model=SyncJobDetail)
def update_sync_job(
    job_id: uuid.UUID,
    payload: SyncJobUpdate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> SyncJobDetail:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None})
    job.name = payload.name
    job.target_table = payload.target_table
    job.schedule_cron = payload.schedule_cron
    job.enabled = payload.enabled
    _apply_source(job, payload.source)
    db.commit()
    db.refresh(job)
    return SyncJobDetail(
        id=job.id,
        name=job.name,
        source_type=job.source_type,
        target_table=job.target_table,
        enabled=job.enabled,
        schedule_cron=job.schedule_cron,
        source=_to_source_out(job),
        source_data_source_id=job.source_data_source_id,
    )


@router.delete("/sync-jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sync_job(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None})
    db.delete(job)
    db.commit()


@router.get("/sync-jobs/{job_id}/etl-rules", response_model=EtlRulesResponse)
def get_etl_rules(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> EtlRulesResponse:
    rules = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    if rules is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None})
    return EtlRulesResponse(rules=rules.rules)


@router.put("/sync-jobs/{job_id}/etl-rules", response_model=EtlRulesResponse)
def put_etl_rules(
    job_id: uuid.UUID,
    payload: EtlRulesPayload,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> EtlRulesResponse:
    rules = db.scalar(select(EtlRuleSet).where(EtlRuleSet.job_id == job_id))
    if rules is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None})
    rules.rules = payload.rules
    db.commit()
    return EtlRulesResponse(rules=rules.rules)
```

- [ ] **Step 5: 注册路由**

`backend/app/api/v1/ingestion/__init__.py`:

```python
from app.api.v1.ingestion.sync import router

__all__ = ["router"]
```

`backend/app/api/v1/router.py` 追加：

```python
from app.api.v1.ingestion import router as ingestion_router

api_v1_router.include_router(ingestion_router)
```

- [ ] **Step 6: 更新 `docs/api/README.md` §9**

将三行「规划」改为「已实现」，并追加一行：

`| GET | /api/v1/ingestion/sync-jobs/{id}/runs | 运行历史 | 内部 | M1B | DATA-002 | 已实现 | backend/app/api/v1/ingestion/sync.py |`

（`run` 路由在 Task 4 实现后保持已实现状态。）

- [ ] **Step 7: 运行测试**

前置：`docker compose up -d` 且 `alembic upgrade head`

Run: `cd /workspace/backend && pytest tests/test_ingestion_api.py -v`

Expected: PASS（CRUD 测试）

- [ ] **Step 8: Commit**

```bash
git add backend/app/ingestion backend/app/api/v1/ingestion backend/app/api/v1/router.py docs/api/README.md tests/test_ingestion_api.py
git commit -m "feat(ingestion): DATA-001 sync job models and CRUD API"
```

---

### Task 3: ETL-001 — 清洗规则引擎

**Files:**
- Create: `backend/app/ingestion/etl_rules.py`
- Create: `tests/test_etl_rules.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**触及域：** `backend/app/ingestion/etl_rules.py`

**Interfaces:**
- Produces: `apply_rules(rows: list[dict[str, Any]], rules: list[dict[str, Any]]) -> list[dict[str, Any]]`

- [ ] **Step 1: 写失败测试**

```python
from app.ingestion.etl_rules import apply_rules

DIRTY_ROWS = [
    {"product_name": "A", "amount": "12.5", "status": "active", "note": None},
    {"product_name": "B", "amount": "x", "status": "deleted", "note": "x"},
]

RULES = [
    {"type": "rename_column", "from": "product_name", "to": "product"},
    {"type": "cast_type", "column": "amount", "to": "float"},
    {"type": "fill_null", "column": "note", "value": "无备注"},
    {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
]


def test_apply_rules_renames_casts_fills_and_filters():
    result = apply_rules(DIRTY_ROWS, RULES)
    assert len(result) == 1
    row = result[0]
    assert row["product"] == "A"
    assert row["amount"] == 12.5
    assert row["note"] == "无备注"
    assert "product_name" not in row


def test_cast_type_invalid_becomes_none():
    rows = [{"amount": "bad"}]
    rules = [{"type": "cast_type", "column": "amount", "to": "float"}]
    assert apply_rules(rows, rules)[0]["amount"] is None
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace/backend && pytest tests/test_etl_rules.py -v`

Expected: FAIL `ModuleNotFoundError`

- [ ] **Step 3: 实现 `backend/app/ingestion/etl_rules.py`**

```python
from __future__ import annotations

from typing import Any


def _cast_value(value: Any, to: str) -> Any:
    if value is None:
        return None
    try:
        if to == "integer":
            return int(float(str(value)))
        if to == "float":
            return float(str(value))
        if to == "boolean":
            return str(value).lower() in {"1", "true", "yes", "y"}
        return str(value)
    except (TypeError, ValueError):
        return None


def _match_filter(row: dict[str, Any], column: str, op: str, value: Any) -> bool:
    cell = row.get(column)
    if op == "eq":
        return cell == value
    if op == "ne":
        return cell != value
    if op == "is_null":
        return cell is None or cell == ""
    if op == "is_not_null":
        return cell is not None and cell != ""
    return True


def apply_rules(rows: list[dict[str, Any]], rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = [dict(row) for row in rows]
    for rule in rules:
        rtype = rule.get("type")
        if rtype == "rename_column":
            src, dst = rule["from"], rule["to"]
            for row in output:
                if src in row:
                    row[dst] = row.pop(src)
        elif rtype == "cast_type":
            col, to = rule["column"], rule["to"]
            for row in output:
                if col in row:
                    row[col] = _cast_value(row[col], to)
        elif rtype == "fill_null":
            col, val = rule["column"], rule["value"]
            for row in output:
                if row.get(col) is None or row.get(col) == "":
                    row[col] = val
        elif rtype == "filter_rows":
            col, op, val = rule["column"], rule["op"], rule.get("value")
            output = [row for row in output if _match_filter(row, col, op, val)]
    return output
```

- [ ] **Step 4: 运行测试**

Run: `cd /workspace/backend && pytest tests/test_etl_rules.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/ingestion/etl_rules.py tests/test_etl_rules.py
git commit -m "feat(ingestion): ETL-001 lightweight JSON rules engine"
```

---

### Task 4: DATA-002 — 同步执行器与调度

**Files:**
- Create: `backend/app/ingestion/sync_executor.py`
- Create: `backend/app/ingestion/scheduler.py`
- Modify: `backend/app/api/v1/ingestion/sync.py`（追加 run + runs）
- Modify: `backend/app/main.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/systematic-debugging/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及域：** `backend/app/ingestion/`、`backend/app/main.py`

**Interfaces:**
- Consumes: `apply_rules`、`decrypt_password`、`SyncJob`/`SyncRun`、`get_settings().analytics_database_url`
- Produces: `run_job(job_id, trace_id) -> None`、`get_scheduler()`、`refresh_all_jobs()`

- [ ] **Step 1: 实现 `sync_executor.py`**

```python
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import pymysql
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.ingestion.etl_rules import apply_rules
from app.ingestion.models import EtlRuleSet, INGESTION_MAX_ROWS, SyncJob, SyncRun, decrypt_password, get_meta_session


def _fetch_mysql_rows(job: SyncJob) -> list[dict[str, Any]]:
    conn = pymysql.connect(
        host=job.source_host,
        port=job.source_port,
        user=job.source_username,
        password=decrypt_password(job.source_password_encrypted),
        database=job.source_database,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM `{job.source_table}` LIMIT %s", (INGESTION_MAX_ROWS,))
            return list(cur.fetchall())
    finally:
        conn.close()


def _write_analytics(job: SyncJob, rows: list[dict[str, Any]]) -> int:
    settings = get_settings()
    if not settings.analytics_database_url:
        raise RuntimeError("ANALYTICS_DB_NOT_CONFIGURED")
    engine = create_engine(settings.analytics_database_url, pool_pre_ping=True)
    if not rows:
        return 0
    columns = list(rows[0].keys())
    col_defs = ", ".join(f'"{c}" TEXT' for c in columns)
    placeholders = ", ".join(f":{c}" for c in columns)
    insert_sql = text(f'INSERT INTO "{job.target_table}" ({", ".join(columns)}) VALUES ({placeholders})')
    with engine.begin() as conn:
        conn.execute(text(f'CREATE TABLE IF NOT EXISTS "{job.target_table}" ({col_defs})'))
        conn.execute(text(f'TRUNCATE TABLE "{job.target_table}"'))
        for row in rows:
            conn.execute(insert_sql, row)
    return len(rows)


def _update_run(db: Session, run: SyncRun, **fields: Any) -> None:
    for key, value in fields.items():
        setattr(run, key, value)
    db.commit()


def run_job(job_id: uuid.UUID, trace_id: str, *, run_id: uuid.UUID | None = None, attempt: int = 0) -> uuid.UUID:
    db = get_meta_session()
    if run_id is None:
        run = SyncRun(job_id=job_id, status="running", trace_id=trace_id, retry_count=attempt)
        db.add(run)
        db.commit()
        db.refresh(run)
        run_id = run.id
    else:
        run = db.get(SyncRun, run_id)
        if run is None:
            db.close()
            raise ValueError("run not found")
    job = db.get(SyncJob, job_id)
    if job is None:
        _update_run(db, run, status="failed", finished_at=datetime.now(timezone.utc), error_message="任务不存在")
        db.close()
        return run_id
    rules_row = db.query(EtlRuleSet).filter(EtlRuleSet.job_id == job_id).one_or_none()
    rules = rules_row.rules if rules_row else []
    try:
        if job.source_type != "mysql":
            raise RuntimeError("M1B 仅支持 mysql 源")
        raw = _fetch_mysql_rows(job)
        cleaned = apply_rules(raw, rules)
        count = _write_analytics(job, cleaned)
        _update_run(
            db,
            run,
            status="succeeded",
            finished_at=datetime.now(timezone.utc),
            rows_synced=count,
            error_message=None,
        )
    except Exception as exc:  # noqa: BLE001 — 记录用户可读摘要
        if attempt < 1:
            _update_run(db, run, retry_count=attempt + 1)
            db.close()
            run_job(job_id, trace_id, run_id=run_id, attempt=attempt + 1)
            return run_id
        _update_run(
            db,
            run,
            status="failed",
            finished_at=datetime.now(timezone.utc),
            error_message=str(exc)[:500],
        )
    finally:
        db.close()
    return run_id
```

- [ ] **Step 2: 实现 `scheduler.py`**

```python
from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.ingestion.models import SyncJob, get_meta_session
from app.ingestion.sync_executor import run_job

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    return _scheduler


def refresh_all_jobs() -> None:
    scheduler = get_scheduler()
    for job in scheduler.get_jobs():
        scheduler.remove_job(job.id)
    db = get_meta_session()
    try:
        jobs = db.scalars(select(SyncJob).where(SyncJob.enabled.is_(True))).all()
        for job in jobs:
            if not job.schedule_cron:
                continue
            scheduler.add_job(
                run_job,
                trigger=CronTrigger.from_crontab(job.schedule_cron),
                id=str(job.id),
                kwargs={"job_id": job.id, "trace_id": f"schedule-{job.id}"},
                replace_existing=True,
            )
    finally:
        db.close()
```

- [ ] **Step 3: 在 `sync.py` 追加 run + runs 端点**

在文件顶部增加 import：

```python
from fastapi import BackgroundTasks, Request
from app.ingestion.scheduler import refresh_all_jobs
from app.ingestion.sync_executor import run_job
from app.ingestion.models import SyncRun
```

追加 schema 与路由：

```python
class SyncRunItem(BaseModel):
    id: uuid.UUID
    status: str
    started_at: str
    finished_at: str | None
    rows_synced: int | None
    error_message: str | None
    trace_id: str
    retry_count: int


class SyncRunListResponse(BaseModel):
    items: list[SyncRunItem]


class RunAccepted(BaseModel):
    run_id: uuid.UUID
    status: str


@router.post("/sync-jobs/{job_id}/run", response_model=RunAccepted, status_code=202)
def trigger_run(
    job_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> RunAccepted:
    job = db.get(SyncJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None})
    trace_id = request.headers.get("X-Trace-Id", str(uuid.uuid4()))
    run = SyncRun(job_id=job_id, status="running", trace_id=trace_id)
    db.add(run)
    db.commit()
    db.refresh(run)
    background_tasks.add_task(run_job, job_id, trace_id, run_id=run.id)
    return RunAccepted(run_id=run.id, status="running")


@router.get("/sync-jobs/{job_id}/runs", response_model=SyncRunListResponse)
def list_runs(
    job_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    limit: int = 20,
) -> SyncRunListResponse:
    if db.get(SyncJob, job_id) is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "detail": None})
    runs = db.scalars(
        select(SyncRun).where(SyncRun.job_id == job_id).order_by(SyncRun.started_at.desc()).limit(limit)
    ).all()
    return SyncRunListResponse(
        items=[
            SyncRunItem(
                id=r.id,
                status=r.status,
                started_at=r.started_at.isoformat(),
                finished_at=r.finished_at.isoformat() if r.finished_at else None,
                rows_synced=r.rows_synced,
                error_message=r.error_message,
                trace_id=r.trace_id,
                retry_count=r.retry_count,
            )
            for r in runs
        ]
    )
```

在 `create_sync_job` / `update_sync_job` 的 `db.commit()` 后调用 `refresh_all_jobs()`。

- [ ] **Step 4: 更新 `main.py` lifespan**

```python
from contextlib import asynccontextmanager

from app.ingestion.scheduler import get_scheduler, refresh_all_jobs


@asynccontextmanager
async def lifespan(_app: FastAPI):
    scheduler = get_scheduler()
    refresh_all_jobs()
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(..., lifespan=lifespan)
```

- [ ] **Step 5: 手验全链路**

Run: `cd /workspace && docker compose up -d && cd backend && ANALYTICS_DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics uvicorn app.main:app --port 8000 &`

用 `curl` 创建任务并 run（Bearer dev），然后：

Run: `psql postgresql://vitalspan:vitalspan@localhost:5433/analytics -c 'SELECT COUNT(*) FROM orders_clean'`

Expected: `COUNT > 0`

- [ ] **Step 6: Commit**

```bash
git add backend/app/ingestion/sync_executor.py backend/app/ingestion/scheduler.py backend/app/api/v1/ingestion/sync.py backend/app/main.py
git commit -m "feat(ingestion): DATA-002 sync executor, scheduler, and run API"
```

---

### Task 5: DATA-003 — Admin 配置台页面

**Files:**
- Create: `fe/src/lib/api.ts`
- Create: `fe/src/components/ui/badge.tsx`
- Create: `fe/src/components/ui/skeleton.tsx`
- Create: `fe/src/components/ui/select.tsx`
- Create: `fe/src/components/ui/alert-dialog.tsx`
- Create: `fe/src/pages/admin/ingestion/SyncJobsPage.tsx`
- Create: `fe/src/pages/admin/ingestion/SyncJobFormPage.tsx`
- Create: `fe/src/pages/admin/ingestion/SyncJobHistoryPage.tsx`
- Create: `fe/src/pages/admin/ingestion/EtlRulesPage.tsx`
- Modify: `fe/src/routes.tsx`
- Modify: `fe/src/components/README.md`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI Acceptance:**
- 复用 `.agents/skills/b-design-system-tailadmin-radix/SKILL.md` 指定组件/布局；列表 `crud-flow` 模式；卡片 `rounded-xl border bg-white dark:bg-gray-900 shadow-theme-sm`
- desktop 1280px 与 mobile 390px 截图无明显错位、重叠、文本溢出、空白失衡
- loading 用 `Skeleton`；空态居中文案 + primary「新建任务」；错误用 destructive `Alert` +「重试」；运行按钮 `aria-label="手动运行同步"`；状态 Badge 含文字
- 通过 `cd fe && pnpm build && pnpm check:design` exit 0

**触及域：** `fe/src/pages/admin/ingestion/`（`fe-ui.mdc`）

**Interfaces:**
- Consumes: `/api/v1/ingestion/*` JSON（snake_case 字段按服务端原样）
- Produces: 4 页面 + `apiFetch` 客户端

- [ ] **Step 1: 从 skill 模板补齐 UI 组件**

按 `.agents/skills/b-design-system-tailadmin-radix/SKILL.md` 的 `templates/` 创建 `badge.tsx`、`skeleton.tsx`、`select.tsx`、`alert-dialog.tsx`（使用项目已有 `cn`、`@radix-ui/react-slot`；`select`/`alert-dialog` 需 `pnpm add @radix-ui/react-select @radix-ui/react-alert-dialog`）。

更新 `fe/src/components/README.md` 登记四组件。

- [ ] **Step 2: 实现 `fe/src/lib/api.ts`**

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type ApiEnvelope<T> = {
  code?: number | string;
  message?: string;
  data?: T;
} & T;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev",
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 401) {
    throw new Error("请使用开发令牌登录");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "操作失败，请稍后重试");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
```

- [ ] **Step 3: 实现 `SyncJobsPage.tsx`**

要点：
- 面包屑：「管理 / 数据接入 / 同步任务」
- `useEffect` 拉取 `GET /api/v1/ingestion/sync-jobs`
- 表格列：名称、源类型、目标表、定时、状态、操作（运行 Play、历史、规则、编辑）
- `POST .../run` 后 toast 或行内 loading；空态「暂无同步任务」+ 链到 `/admin/ingestion/sync-jobs/new`
- 卡片容器 + `overflow-x-auto` 表格

- [ ] **Step 4: 实现 `SyncJobFormPage.tsx`**

- 路由区分 `new` 与 `:id/edit`（`useParams`）
- 表单字段：name、source.type Select（mysql）、host/port/database/username/password/table、target_table、schedule_cron（可选）
- 提交 `POST` 或 `PUT`；取消回列表
- `max-w-2xl` 卡片 + `space-y-4`

- [ ] **Step 5: 实现 `SyncJobHistoryPage.tsx` 与 `EtlRulesPage.tsx`**

`SyncJobHistoryPage`：
- `GET .../runs?limit=20`；Badge 显示 succeeded/failed/running
- 失败行 `error_message` truncate + `title`；`trace_id` 可复制按钮

`EtlRulesPage`：
- `GET/PUT .../etl-rules`；规则行：type Select + 动态字段 Input；「添加规则」「保存规则」
- 预填 design §8.4.3 推荐规则链作为 placeholder 示例（非默认提交）

- [ ] **Step 6: 登记路由 `fe/src/routes.tsx`**

```tsx
import { SyncJobsPage } from "@/pages/admin/ingestion/SyncJobsPage";
import { SyncJobFormPage } from "@/pages/admin/ingestion/SyncJobFormPage";
import { SyncJobHistoryPage } from "@/pages/admin/ingestion/SyncJobHistoryPage";
import { EtlRulesPage } from "@/pages/admin/ingestion/EtlRulesPage";

// 在 AdminLayout 子路由内追加：
<Route path="ingestion/sync-jobs" element={<SyncJobsPage />} />
<Route path="ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
<Route path="ingestion/sync-jobs/:id/edit" element={<SyncJobFormPage />} />
<Route path="ingestion/sync-jobs/:id/history" element={<SyncJobHistoryPage />} />
<Route path="ingestion/sync-jobs/:id/etl-rules" element={<EtlRulesPage />} />
```

- [ ] **Step 7: 构建与设计检查**

Run: `cd /workspace/fe && pnpm install && pnpm build && pnpm check:design`

Expected: exit 0

Run: `cd /workspace/fe && pnpm test:smoke`

Expected: PASS

- [ ] **Step 8: 浏览器手验闭环**

1. 打开 `http://localhost:5173/admin/ingestion/sync-jobs`
2. 新建任务指向 sample-mysql `dirty_orders` → `orders_clean`
3. 配置 ETL 规则（§8.4.3 链）并保存
4. 手动运行 → 历史页出现 succeeded
5. P4 截图 desktop 1280 + mobile 390 四页

- [ ] **Step 9: Commit**

```bash
git add fe/src/lib/api.ts fe/src/components/ui fe/src/pages/admin/ingestion fe/src/routes.tsx fe/src/components/README.md fe/package.json pnpm-lock.yaml
git commit -m "feat(fe): DATA-003 admin ingestion configuration pages"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| round-target 5 子项均有 Task | DATA-004→T1, DATA-001→T2, ETL-001→T3, DATA-002→T4, DATA-003→T5 |
| 无 TBD/TODO/适当处理 | 通过 |
| 每 Task 含验证命令 | 通过 |
| UI Task 含 Skills + UI Acceptance | Task 5 已填 |
| 文件预算 | 核心 16 + 邻近 6 + 4 UI 组件 + 3 测试 ≈ 29；`docker/init` 与 `__init__.py` 不计入 round-target 16；测试为验收必需 |

## 执行 handoff

计划已保存。按 Automation 纪律固定 **option 1：subagent-driven-development** — 每 Task 派发独立 subagent，任务间 Spec review + Quality review，全部完成后进入 P4 `evolution-verifier`。
