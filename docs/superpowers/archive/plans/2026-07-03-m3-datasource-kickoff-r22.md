# M3 数据源平台 kickoff r22 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/`、`backend/app/api/v1/datasources.py`、`backend/app/api/v1/router.py`、`backend/migrations/versions/0008_datasources_table.py`、`tests/test_datasources_l1.py`、`tests/test_migrations.py`、`docs/api/README.md`、`docs/services/datasources.md`
> **子项：** DS-001, DS-002, DS-005, DS-003, CONN-001
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 交付 M3 数据源 L1 五件套——`ConnectorRegistry` + MySQL 方言、`data_sources` 元表与 Alembic `0008`、凭证 Fernet 加密、CRUD + 双连通测试 API、约 25 项 pytest smoke。

**Architecture:** entry（`api/v1/datasources.py`）薄层 + domain（`datasources/service.py`）+ `registry`/`dialects`/`credentials`/`models`；与 auth/ingestion 共用 `Settings.database_url` 元库；`import app.datasources` 经 router 触发方言注册；测试模块级 sqlite shared memory + `Base.metadata.create_all` + `unittest.mock.patch` 拦截 `pymysql.connect`。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Alembic · Pydantic v2 · pymysql · cryptography(Fernet) · pytest · ruff

## Global Constraints

- 纯后端 L1；**不修改** `fe/`、`main.py`；**UI skill: none**（全 Task）
- 不修改 `docs/automate/goal.md` / `plan.md` 结构
- 不含 DS-004/006/007/008、CONN-002、Admin UI、连接池、schema 浏览、`core/credentials.py` 抽取
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": ...}`
- L1 鉴权：全部路由 `Depends(get_current_user)`；`Bearer dev` 可操作
- 连通测试 HTTP 恒 200 + `ok` 字段（资源不存在 404 仅用于 `/{id}/test`）
- API 路径：`POST /api/v1/datasources/{id}/test`（非 `test-connection`）
- 文件预算：新建 12 + 修改 3 + 文档 2 = **17 ≤ 20**
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: ConnectorRegistry、方言契约与 MySQL 插件（DS-001 + CONN-001）

**Files:**
- Create: `backend/app/datasources/registry.py`
- Create: `backend/app/datasources/dialects/__init__.py`
- Create: `backend/app/datasources/dialects/base.py`
- Create: `backend/app/datasources/dialects/mysql.py`
- Create: `backend/app/datasources/__init__.py`
- Create: `tests/test_datasources_l1.py`（registry + mysql 单元测试段）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `pymysql`（已在 `pyproject.toml`）
- Produces: `ConnectorDescriptor`, `ConnectorNotFoundError`, `ConnectorAlreadyRegisteredError`, `ConnectorRegistry`, `registry`, `register_dialect`, `DialectConnector`, `TestConnectionResult`, `MysqlConnector`, `register_builtin_dialects()`

- [ ] **Step 1: 创建 `backend/app/datasources/dialects/base.py`**

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class TestConnectionResult:
    ok: bool
    message: str
    latency_ms: int | None


class DialectConnector(Protocol):
    @property
    def type(self) -> str: ...

    @property
    def category(self) -> str: ...

    @property
    def capabilities(self) -> tuple[str, ...]: ...

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
    ) -> TestConnectionResult: ...
```

- [ ] **Step 2: 创建 `backend/app/datasources/registry.py`**

```python
from __future__ import annotations

from dataclasses import dataclass

from app.datasources.dialects.base import DialectConnector


class ConnectorNotFoundError(KeyError):
    pass


class ConnectorAlreadyRegisteredError(ValueError):
    pass


@dataclass(frozen=True)
class ConnectorDescriptor:
    type: str
    category: str
    capabilities: tuple[str, ...]


class ConnectorRegistry:
    def __init__(self) -> None:
        self._connectors: dict[str, DialectConnector] = {}

    def register(self, connector: DialectConnector) -> None:
        if connector.type in self._connectors:
            raise ConnectorAlreadyRegisteredError(f"connector type already registered: {connector.type}")
        self._connectors[connector.type] = connector

    def get(self, type: str) -> DialectConnector:
        try:
            return self._connectors[type]
        except KeyError as exc:
            raise ConnectorNotFoundError(type) from exc

    def list_types(self) -> list[ConnectorDescriptor]:
        return [
            ConnectorDescriptor(
                type=c.type,
                category=c.category,
                capabilities=c.capabilities,
            )
            for c in self._connectors.values()
        ]


registry = ConnectorRegistry()


def register_dialect(connector: DialectConnector) -> None:
    registry.register(connector)
```

- [ ] **Step 3: 创建 `backend/app/datasources/dialects/mysql.py`**

```python
from __future__ import annotations

import time

import pymysql
import pymysql.err

from app.datasources.dialects.base import TestConnectionResult


class MysqlConnector:
    type = "mysql"
    category = "relational"
    capabilities = ("connectivity_test",)

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
    ) -> TestConnectionResult:
        started = time.perf_counter()
        timeout = max(1, int(timeout_sec))
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=username,
                password=password,
                database=database,
                connect_timeout=timeout,
                read_timeout=timeout,
                write_timeout=timeout,
            )
            try:
                connection.ping(reconnect=False)
            finally:
                connection.close()
        except pymysql.err.OperationalError as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc.args[1] if len(exc.args) > 1 else exc), latency_ms=latency_ms)
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return TestConnectionResult(ok=False, message=str(exc), latency_ms=latency_ms)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=latency_ms)
```

- [ ] **Step 4: 创建 `backend/app/datasources/dialects/__init__.py`**

```python
from app.datasources.dialects.base import DialectConnector, TestConnectionResult
from app.datasources.dialects.mysql import MysqlConnector

__all__ = ["DialectConnector", "MysqlConnector", "TestConnectionResult"]
```

- [ ] **Step 5: 创建 `backend/app/datasources/__init__.py`**

```python
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.registry import register_dialect


def register_builtin_dialects() -> None:
    register_dialect(MysqlConnector())


register_builtin_dialects()
```

- [ ] **Step 6: 创建 `tests/test_datasources_l1.py` registry/mysql 段**

```python
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.datasources import register_builtin_dialects
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.registry import (
    ConnectorAlreadyRegisteredError,
    ConnectorNotFoundError,
    registry,
    register_dialect,
)


@pytest.fixture(autouse=True)
def reset_registry():
    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()


def test_registry_list_types_includes_mysql():
    """T-DS-R01: list_types() 含 mysql。"""
    types = {item.type: item for item in registry.list_types()}
    assert "mysql" in types
    assert types["mysql"].category == "relational"
    assert "connectivity_test" in types["mysql"].capabilities


def test_registry_get_mysql_returns_connector():
    """T-DS-R02: get('mysql') 返回方言实例。"""
    connector = registry.get("mysql")
    assert connector.type == "mysql"
    assert callable(connector.test_connection)


def test_registry_get_unknown_raises():
    """T-DS-R03: get('unknown') 抛 ConnectorNotFoundError。"""
    with pytest.raises(ConnectorNotFoundError):
        registry.get("unknown")


def test_registry_duplicate_register_rejected():
    """T-DS-R04: 重复 register 同 type 抛 ConnectorAlreadyRegisteredError。"""
    with pytest.raises(ConnectorAlreadyRegisteredError):
        register_dialect(MysqlConnector())


def test_mysql_connector_attributes():
    """T-CONN-M01: 方言属性符合契约。"""
    connector = MysqlConnector()
    assert connector.type == "mysql"
    assert connector.category == "relational"
    assert connector.capabilities == ("connectivity_test",)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_mock_connect_success(mock_connect):
    """T-CONN-M02: mock connect 成功。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    result = MysqlConnector().test_connection(
        host="127.0.0.1",
        port=3306,
        database="demo",
        username="root",
        password="secret",
    )
    assert result.ok is True
    assert result.latency_ms is not None
    connection.ping.assert_called_once_with(reconnect=False)
    connection.close.assert_called_once()


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_mock_operational_error(mock_connect):
    """T-CONN-M03: mock OperationalError 脱敏失败。"""
    import pymysql.err

    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied for user")
    result = MysqlConnector().test_connection(
        host="127.0.0.1",
        port=3306,
        database="demo",
        username="root",
        password="secret",
    )
    assert result.ok is False
    assert "Access denied" in result.message
    assert "secret" not in result.message
```

- [ ] **Step 7: 运行 registry/mysql 测试**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_l1.py -k "registry or mysql" -v`
Expected: 7 passed

- [ ] **Step 8: Commit**

```bash
git add backend/app/datasources/ tests/test_datasources_l1.py
git commit -m "feat(datasources): add ConnectorRegistry and MySQL dialect"
```

---

### Task 2: 凭证 Fernet 加解密模块（DS-005）

**Files:**
- Create: `backend/app/datasources/credentials.py`
- Modify: `tests/test_datasources_l1.py`（追加 T-DS-K01、T-DS-K04）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `get_settings().credential_fernet_key`（对齐 `ingestion/models.py` `_fernet()` 模式）
- Produces: `encrypt_credential(plain: str) -> str`, `decrypt_credential(cipher: str) -> str`

- [ ] **Step 1: 创建 `backend/app/datasources/credentials.py`**

```python
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _fernet() -> Fernet:
    return Fernet(get_settings().credential_fernet_key.encode())


def encrypt_credential(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_credential(cipher: str) -> str:
    try:
        return _fernet().decrypt(cipher.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("invalid encrypted credential") from exc
```

- [ ] **Step 2: 追加凭证测试到 `tests/test_datasources_l1.py`**

```python
import os

from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.datasources.credentials import decrypt_credential, encrypt_credential


def test_credential_encrypt_decrypt_roundtrip():
    """T-DS-K01: 加解密 round-trip。"""
    plain = "mysql-source-password"
    cipher = encrypt_credential(plain)
    assert cipher != plain
    assert decrypt_credential(cipher) == plain


def test_settings_missing_credential_fernet_key_raises(monkeypatch):
    """T-DS-K04: 缺 CREDENTIAL_FERNET_KEY 时 Settings 构造失败。"""
    monkeypatch.delenv("CREDENTIAL_FERNET_KEY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        Settings(
            database_url=os.environ["DATABASE_URL"],
            secret_key=os.environ["SECRET_KEY"],
        )
    get_settings.cache_clear()
```

- [ ] **Step 3: 运行凭证测试**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_l1.py -k "credential or fernet" -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add backend/app/datasources/credentials.py tests/test_datasources_l1.py
git commit -m "feat(datasources): add Fernet credential encryption module"
```

---

### Task 3: DataSource ORM、元库 Session 与 Alembic 0008（DS-002 基建）

**Files:**
- Create: `backend/app/datasources/models.py`
- Create: `backend/migrations/versions/0008_datasources_table.py`
- Modify: `tests/test_datasources_l1.py`（追加模块级 sqlite fixture + 表存在断言）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `get_settings().database_url`
- Produces: `Base`, `DataSource`, `get_meta_engine()`, `get_meta_session()`

- [ ] **Step 1: 创建 `backend/app/datasources/models.py`**

```python
from __future__ import annotations

import uuid
from datetime import datetime
from functools import lru_cache

from sqlalchemy import DateTime, Integer, String, Text, Uuid, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database: Mapped[str] = mapped_column(String(128), nullable=False)
    username: Mapped[str] = mapped_column(String(128), nullable=False)
    password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


@lru_cache
def get_meta_engine():
    url = get_settings().database_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


def get_meta_session():
    return sessionmaker(bind=get_meta_engine(), autoflush=False, autocommit=False)()
```

- [ ] **Step 2: 创建 `backend/migrations/versions/0008_datasources_table.py`**

```python
"""data_sources table

Revision ID: 0008
Revises: 0007
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("database", sa.String(128), nullable=False),
        sa.Column("username", sa.String(128), nullable=False),
        sa.Column("password_encrypted", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("data_sources")
```

- [ ] **Step 3: 在 `tests/test_datasources_l1.py` 顶部追加模块级 sqlite fixture**

```python
_DS_SQLITE_URL = "sqlite+pysqlite:///file:ds_l1_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_l1_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DS_SQLITE_URL
    get_settings.cache_clear()
    from app.datasources.models import get_meta_engine

    get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_data_sources_table():
    from app.datasources.models import Base, get_meta_engine

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))


@pytest.fixture(autouse=True)
def clean_data_sources_between_tests():
    from app.datasources.models import get_meta_engine

    yield
    engine = get_meta_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))
```

同时在文件顶部补充：

```python
import os

from sqlalchemy import text

from app.core.config import get_settings
```

- [ ] **Step 4: 追加表存在测试**

```python
def test_data_sources_table_exists():
    """T-DS-INFRA: data_sources 表 create_all 成功。"""
    from app.datasources.models import Base, get_meta_engine

    assert "data_sources" in Base.metadata.tables
    assert get_meta_engine() is not None
```

- [ ] **Step 5: 运行基建测试**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_l1.py -k "infra or data_sources_table" -v`
Expected: 1 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasources/models.py backend/migrations/versions/0008_datasources_table.py tests/test_datasources_l1.py
git commit -m "feat(datasources): add DataSource ORM and migration 0008"
```

---

### Task 4: DTO 与域服务 CRUD + 连通测试编排（DS-002 + DS-003 + DS-005）

**Files:**
- Create: `backend/app/datasources/schemas.py`
- Create: `backend/app/datasources/service.py`
- Modify: `tests/test_datasources_l1.py`（追加 service 层 T-DS-K02/K03、CRUD 预备）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `registry`, `encrypt_credential`, `decrypt_credential`, `DataSource`, `get_meta_session`
- Produces: `DataSourceCreate`, `DataSourceUpdate`, `DataSourceOut`, `DataSourceListResponse`, `TestConnectionIn`, `TestConnectionOut`, `DataSourceError`, `create_data_source`, `list_data_sources`, `get_data_source`, `update_data_source`, `delete_data_source`, `test_connection_draft`, `test_connection_by_id`

- [ ] **Step 1: 创建 `backend/app/datasources/schemas.py`**

```python
from __future__ import annotations

import re
import uuid

from pydantic import BaseModel, Field, field_validator

from app.datasources.dialects.base import TestConnectionResult

DATASOURCE_CODE_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")


class DataSourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str
    type: str = Field(min_length=1, max_length=32)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1)
    description: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not DATASOURCE_CODE_RE.match(value):
            raise ValueError("code must match ^[a-z][a-z0-9_-]{1,63}$")
        return value


class DataSourceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    password: str = ""
    description: str | None = None


class DataSourceOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    type: str
    host: str
    port: int
    database: str
    username: str
    password: str = "***"
    description: str | None


class DataSourceListResponse(BaseModel):
    items: list[DataSourceOut]


class TestConnectionIn(DataSourceCreate):
    pass


class TestConnectionOut(BaseModel):
    ok: bool
    message: str
    latency_ms: int | None = Field(serialization_alias="latencyMs")

    model_config = {"populate_by_name": True}

    @classmethod
    def from_result(cls, result: TestConnectionResult) -> TestConnectionOut:
        return cls(ok=result.ok, message=result.message, latency_ms=result.latency_ms)
```

- [ ] **Step 2: 创建 `backend/app/datasources/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.datasources.credentials import decrypt_credential, encrypt_credential
from app.datasources.dialects.base import TestConnectionResult
from app.datasources.models import DataSource
from app.datasources.registry import ConnectorNotFoundError, registry
from app.datasources.schemas import (
    DataSourceCreate,
    DataSourceOut,
    DataSourceUpdate,
    TestConnectionIn,
    TestConnectionOut,
)


class DataSourceError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _to_out(row: DataSource) -> DataSourceOut:
    return DataSourceOut(
        id=row.id,
        name=row.name,
        code=row.code,
        type=row.type,
        host=row.host,
        port=row.port,
        database=row.database,
        username=row.username,
        password="***",
        description=row.description,
    )


def _resolve_connector(type: str):
    try:
        return registry.get(type)
    except ConnectorNotFoundError as exc:
        raise DataSourceError("UNKNOWN_CONNECTOR_TYPE", f"Unknown connector type: {type}", 422) from exc


def _run_test(
  connector,
  *,
  host: str,
  port: int,
  database: str,
  username: str,
  password: str,
) -> TestConnectionOut:
    result = connector.test_connection(
        host=host,
        port=port,
        database=database,
        username=username,
        password=password,
    )
    return TestConnectionOut.from_result(result)


def list_data_sources(session: Session) -> list[DataSourceOut]:
    rows = list(session.scalars(select(DataSource).order_by(DataSource.code)))
    return [_to_out(row) for row in rows]


def create_data_source(session: Session, payload: DataSourceCreate) -> DataSourceOut:
    _resolve_connector(payload.type)
    row = DataSource(
        name=payload.name,
        code=payload.code,
        type=payload.type,
        host=payload.host,
        port=payload.port,
        database=payload.database,
        username=payload.username,
        password_encrypted=encrypt_credential(payload.password),
        description=payload.description,
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        message = str(exc.orig).lower() if exc.orig else ""
        if "code" in message:
            raise DataSourceError("DATASOURCE_CODE_CONFLICT", "Data source code already exists", 409) from exc
        raise DataSourceError("DATASOURCE_NAME_CONFLICT", "Data source name already exists", 409) from exc
    session.refresh(row)
    return _to_out(row)


def get_data_source(session: Session, data_source_id: uuid.UUID) -> DataSourceOut:
    row = session.get(DataSource, data_source_id)
    if row is None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    return _to_out(row)


def update_data_source(
    session: Session,
    data_source_id: uuid.UUID,
    payload: DataSourceUpdate,
) -> DataSourceOut:
    row = session.get(DataSource, data_source_id)
    if row is None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    row.name = payload.name
    row.host = payload.host
    row.port = payload.port
    row.database = payload.database
    row.username = payload.username
    if payload.password:
        row.password_encrypted = encrypt_credential(payload.password)
    row.description = payload.description
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise DataSourceError("DATASOURCE_NAME_CONFLICT", "Data source name already exists", 409) from exc
    session.refresh(row)
    return _to_out(row)


def delete_data_source(session: Session, data_source_id: uuid.UUID) -> None:
    row = session.get(DataSource, data_source_id)
    if row is None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    session.delete(row)
    session.commit()


def test_connection_draft(payload: TestConnectionIn) -> TestConnectionOut:
    connector = _resolve_connector(payload.type)
    return _run_test(
        connector,
        host=payload.host,
        port=payload.port,
        database=payload.database,
        username=payload.username,
        password=payload.password,
    )


def test_connection_by_id(session: Session, data_source_id: uuid.UUID) -> TestConnectionOut:
    row = session.get(DataSource, data_source_id)
    if row is None:
        raise DataSourceError("DATASOURCE_NOT_FOUND", "Data source not found", 404)
    connector = _resolve_connector(row.type)
    password = decrypt_credential(row.password_encrypted)
    return _run_test(
        connector,
        host=row.host,
        port=row.port,
        database=row.database,
        username=row.username,
        password=password,
    )
```

- [ ] **Step 3: 追加 service 层凭证测试**

```python
from sqlalchemy import select

from app.datasources.models import DataSource, get_meta_session
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source


def _sample_create() -> DataSourceCreate:
    return DataSourceCreate(
        name="Demo MySQL",
        code="demo_mysql",
        type="mysql",
        host="127.0.0.1",
        port=3306,
        database="demo",
        username="root",
        password="plain-secret",
    )


def test_db_stores_encrypted_password_not_plaintext():
    """T-DS-K02: DB 存密文非明文。"""
    session = get_meta_session()
    try:
        create_data_source(session, _sample_create())
        row = session.scalar(select(DataSource).where(DataSource.code == "demo_mysql"))
        assert row is not None
        assert row.password_encrypted != "plain-secret"
    finally:
        session.close()


def test_data_source_out_masks_password():
    """T-DS-K03: API Out 层脱敏。"""
    session = get_meta_session()
    try:
        out = create_data_source(session, _sample_create())
        assert out.password == "***"
        assert not hasattr(out, "password_encrypted")
    finally:
        session.close()
```

- [ ] **Step 4: 运行 service 凭证测试**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_l1.py -k "K02 or K03 or encrypted or masks" -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/schemas.py backend/app/datasources/service.py tests/test_datasources_l1.py
git commit -m "feat(datasources): add schemas and CRUD/test service layer"
```

---

### Task 5: API 路由入口与 router 注册（DS-002 + DS-003）

**Files:**
- Create: `backend/app/api/v1/datasources.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `tests/test_datasources_l1.py`（追加 HTTP CRUD + 连通测试段）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `service.*`, `get_meta_session`, `get_current_user`
- Produces: FastAPI router `prefix="/datasources"`；`api_v1_router` 挂载

- [ ] **Step 1: 创建 `backend/app/api/v1/datasources.py`**

```python
from __future__ import annotations

import uuid
from typing import Annotated

import app.datasources  # noqa: F401 — trigger register_builtin_dialects
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.datasources.models import get_meta_session
from app.datasources.schemas import (
    DataSourceCreate,
    DataSourceListResponse,
    DataSourceOut,
    DataSourceUpdate,
    TestConnectionIn,
    TestConnectionOut,
)
from app.datasources import service as ds_service

router = APIRouter(prefix="/datasources", tags=["datasources"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: ds_service.DataSourceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=DataSourceListResponse)
def list_data_sources(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceListResponse:
    return DataSourceListResponse(items=ds_service.list_data_sources(db))


@router.post("", response_model=DataSourceOut, status_code=status.HTTP_201_CREATED)
def create_data_source(
    payload: DataSourceCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceOut | JSONResponse:
    try:
        return ds_service.create_data_source(db, payload)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)


@router.get("/{data_source_id}", response_model=DataSourceOut)
def get_data_source(
    data_source_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceOut | JSONResponse:
    try:
        return ds_service.get_data_source(db, data_source_id)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)


@router.put("/{data_source_id}", response_model=DataSourceOut)
def update_data_source(
    data_source_id: uuid.UUID,
    payload: DataSourceUpdate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DataSourceOut | JSONResponse:
    try:
        return ds_service.update_data_source(db, data_source_id, payload)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)


@router.delete("/{data_source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_data_source(
    data_source_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        ds_service.delete_data_source(db, data_source_id)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test", response_model=TestConnectionOut)
def test_connection_draft(
    payload: TestConnectionIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> TestConnectionOut | JSONResponse:
    try:
        return ds_service.test_connection_draft(payload)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)


@router.post("/{data_source_id}/test", response_model=TestConnectionOut)
def test_connection_saved(
    data_source_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> TestConnectionOut | JSONResponse:
    try:
        return ds_service.test_connection_by_id(db, data_source_id)
    except ds_service.DataSourceError as exc:
        return _error_response(exc)
```

- [ ] **Step 2: 修改 `backend/app/api/v1/router.py`**

在 import 区追加：

```python
from app.api.v1.datasources import router as datasources_router
```

在 `api_v1_router.include_router(...)` 列表追加（建议 ingestion 之后）：

```python
api_v1_router.include_router(datasources_router)
```

- [ ] **Step 3: 追加 HTTP 测试到 `tests/test_datasources_l1.py`**

```python
import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev"}


def _payload() -> dict:
    return {
        "name": "Demo MySQL",
        "code": "demo_mysql",
        "type": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "database": "demo",
        "username": "root",
        "password": "plain-secret",
    }


def test_openapi_includes_datasources_paths(client):
    """T-DS-R-openapi: OpenAPI 含 datasources 路径。"""
    spec = client.get("/openapi.json").json()
    assert "/api/v1/datasources" in spec["paths"]


def test_create_list_get_update_delete_roundtrip(client, auth_headers):
    """T-DS-C01~C05: CRUD roundtrip。"""
    created = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    assert created.status_code == 201
    body = created.json()
    ds_id = body["id"]
    assert body["password"] == "***"

    listed = client.get("/api/v1/datasources", headers=auth_headers)
    assert listed.status_code == 200
    assert any(item["id"] == ds_id for item in listed.json()["items"])

    detail = client.get(f"/api/v1/datasources/{ds_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["password"] == "***"

    updated = client.put(
        f"/api/v1/datasources/{ds_id}",
        json={
            "name": "Demo MySQL Updated",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "demo",
            "username": "root",
            "password": "",
            "description": "updated",
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Demo MySQL Updated"
    assert updated.json()["code"] == "demo_mysql"
    assert updated.json()["type"] == "mysql"

    deleted = client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/datasources/{ds_id}", headers=auth_headers).status_code == 404


def test_duplicate_code_conflict(client, auth_headers):
    """T-DS-C06: 重复 code → 409。"""
    assert client.post("/api/v1/datasources", json=_payload(), headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "DATASOURCE_CODE_CONFLICT"


def test_duplicate_name_conflict(client, auth_headers):
    """T-DS-C07: 重复 name → 409。"""
    first = _payload()
    second = {**_payload(), "code": "demo_mysql_2"}
    assert client.post("/api/v1/datasources", json=first, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/datasources", json=second, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "DATASOURCE_NAME_CONFLICT"


def test_invalid_connector_type(client, auth_headers):
    """T-DS-C08: 非法 type → 422。"""
    bad = {**_payload(), "type": "oracle", "code": "oracle_ds"}
    resp = client.post("/api/v1/datasources", json=bad, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "UNKNOWN_CONNECTOR_TYPE"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_draft_test_connection_success(mock_connect, client, auth_headers):
    """T-DS-T01: POST /datasources/test mock 成功。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    resp = client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert isinstance(body["latencyMs"], int)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_draft_test_connection_refused(mock_connect, client, auth_headers):
    """T-DS-T02: mock 拒绝连接。"""
    import pymysql.err

    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Connection refused")
    resp = client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "refused" in body["message"].lower() or "Connection refused" in body["message"]
    assert "plain-secret" not in body["message"]


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_saved_test_connection_success(mock_connect, client, auth_headers):
    """T-DS-T03: POST /{id}/test 已保存实例。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    created = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    ds_id = created.json()["id"]
    resp = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_saved_test_bad_credentials(mock_connect, client, auth_headers):
    """T-DS-T04: 错误凭据 mock。"""
    import pymysql.err

    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied for user 'root'@'localhost'")
    created = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    ds_id = created.json()["id"]
    resp = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is False
    assert "plain-secret" not in resp.json()["message"]


def test_saved_test_not_found(client, auth_headers):
    """T-DS-T05: 不存在 id → 404。"""
    missing = uuid.uuid4()
    resp = client.post(f"/api/v1/datasources/{missing}/test", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == "DATASOURCE_NOT_FOUND"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_end_to_end_create_and_test(mock_connect, client, auth_headers):
    """T-CONN-M04: 创建 mysql + test 串联。"""
    connection = MagicMock()
    mock_connect.return_value = connection
    created = client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    assert created.status_code == 201
    ds_id = created.json()["id"]
    tested = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert tested.status_code == 200
    assert tested.json()["ok"] is True
```

- [ ] **Step 4: 运行 datasources HTTP 测试**

Run: `cd backend && python3 -m pytest ../tests/test_datasources_l1.py -v`
Expected: 全部 test_datasources_l1 用例 passed（约 20+）

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/datasources.py backend/app/api/v1/router.py tests/test_datasources_l1.py
git commit -m "feat(datasources): add CRUD and connectivity test API routes"
```

---

### Task 6: 迁移测试扩展（T-MIG-36/37）

**Files:**
- Modify: `tests/test_migrations.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: revision `0008_datasources_table.py`
- Produces: `test_revision_chain_head_is_0008`, `test_alembic_upgrade_head_sql_contains_data_sources`

- [ ] **Step 1: 将 `test_migrations.py` 中所有断言 head=`0007` 的用例更新为 `0008`**

涉及函数（按文件内 docstring 定位）：
- `test_revision_directory_single_head_chain`（T-MIG-15）
- `test_alembic_heads_single_head`（T-MIG-25）
- `test_revision_chain_no_orphans_head_0003`（T-MIG-30）
- `test_revision_chain_head_is_0007` → 重命名为 `test_revision_chain_head_is_0008`（T-MIG-34）

`test_revision_chain_head_is_0008` 实现：

```python
def test_revision_chain_head_is_0008():
    """T-MIG-34: revision 链唯一 head 为 0008；0008.down_revision==0007。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev, down in revisions.items() if not any(d == rev for d in revisions.values())]
    assert heads == ["0008"]

    mod = importlib.import_module("migrations.versions.0008_datasources_table")
    assert mod.down_revision == "0007"
```

- [ ] **Step 2: 追加 T-MIG-36 与 T-MIG-37**

```python
def test_revision_chain_head_0008_down_revision():
    """T-MIG-36: heads 含 0008；0008.down_revision==0007。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert "0008" in heads
    assert revisions["0008"] == "0007"


def test_alembic_upgrade_head_sql_contains_data_sources():
    """T-MIG-37: upgrade head --sql 含 data_sources。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "data_sources" in result.stdout
```

- [ ] **Step 3: 运行迁移测试**

Run: `cd backend && python3 -m pytest ../tests/test_migrations.py -k "0008 or data_sources or head" -v`
Expected: 相关用例全部 passed

- [ ] **Step 4: Commit**

```bash
git add tests/test_migrations.py
git commit -m "test(migrations): extend head chain assertions to 0008 data_sources"
```

---

### Task 7: 文档同步与全量验证

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: 已实现路由与域模块
- Produces: API 登记簿状态「已实现」；域附录状态更新

- [ ] **Step 1: 更新 `docs/api/README.md` 数据源节**

将以下路由状态列由「规划」改为「已实现」（路径保持不变）：
- `GET /api/v1/datasources`
- `POST /api/v1/datasources`
- `GET /api/v1/datasources/{id}`
- `PUT /api/v1/datasources/{id}`
- `DELETE /api/v1/datasources/{id}`
- `POST /api/v1/datasources/test`
- `POST /api/v1/datasources/{id}/test`

`GET /api/v1/datasources/types` 与 schema 浏览路由保持「规划」。

- [ ] **Step 2: 更新 `docs/services/datasources.md`**

更新 frontmatter 表：
- 状态：**已实现（L1）**

更新「主要类型 / 入口」表：
- `ConnectorRegistry` → 已实现
- `dialects/mysql.py` → 已实现（CONN-001）
- `DataSourceService`（`service.py`）→ 已实现（DS-002/003/005）

在「实现笔记」追加一行：
- L1：`data_sources` 表 + CRUD + 凭证 Fernet + 双连通测试端点；首期方言 `mysql`；不含连接池与 schema 浏览。

- [ ] **Step 3: 全量验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v`
Expected: ruff 无违规；既有 394+ 用例保持绿 + `test_datasources_l1.py` 新增约 25 项 + `test_migrations.py` T-MIG-36~37 全绿

- [ ] **Step 4: Commit**

```bash
git add docs/api/README.md docs/services/datasources.md
git commit -m "docs(datasources): mark L1 API and domain as implemented"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| DS-001 ConnectorRegistry | Task 1 |
| DS-002 CRUD API + 模型 + 迁移 | Task 3–5 |
| DS-005 凭证加密 | Task 2 + Task 4 |
| DS-003 连通性测试 | Task 4–5 |
| CONN-001 MySQL 方言 | Task 1 |
| 文件数 17 ≤ 20 | 通过 |
| 无 TBD/TODO | 通过 |
| 全 Task UI skill: none | 通过 |
| 每 Task 含验证命令 | 通过 |
