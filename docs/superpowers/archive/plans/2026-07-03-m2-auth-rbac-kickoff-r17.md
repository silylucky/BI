# M2 AUTH RBAC 地基 kickoff r17 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/auth/`、`backend/app/api/v1/`（roles/orgs/users/resource_grants/rls + router）、`backend/migrations/versions/0003_auth_tables.py`、`tests/test_auth_rbac_l1.py`、`tests/test_migrations.py`、`docs/api/README.md`
> **子项：** AUTH-001, AUTH-002, AUTH-003, AUTH-004, AUTH-005
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py` 时 P3 动态匹配 `backend-fastapi.mdc`）

**Goal:** 在 BOOT-003 鉴权骨架上交付 M2 RBAC L1 五件套——6 张 `auth_*` 元表、Alembic `0003`、5 组 CRUD API、`resolve_user_roles` 挂钩与约 28 项 pytest smoke。

**Architecture:** entry（`api/v1/*.py`）薄层 + domain service（`auth/*/service.py`）+ 共用 `auth/models.py`/`schemas.py`；与 ingestion 共用 `Settings.database_url` 元库；测试模块级 sqlite shared memory + `Base.metadata.create_all`。

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Alembic · Pydantic v2 · pytest · ruff

## Global Constraints

- 纯后端 L1；**不修改** `fe/`；**UI skill: none**（全 Task）
- 不修改 `docs/automate/goal.md` / `plan.md` 结构
- 不含 AUTH-006/007/008、Admin UI、完整 IAM、生产管理员角色校验
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": ...}`
- L1 鉴权：全员 `Bearer dev` 可操作（与 M1 一致）
- 文件预算：新建 15 + 修改 3 = **18 ≤ 20**
- 验证命令：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

---

### Task 1: 元模型、DTO 与 Alembic 0003 基建

**Files:**
- Create: `backend/app/auth/models.py`
- Create: `backend/app/auth/schemas.py`
- Create: `backend/migrations/versions/0003_auth_tables.py`
- Create: `tests/test_auth_rbac_l1.py`（模块级 env + autouse fixture 骨架）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `get_settings().database_url`（对齐 `app/ingestion/models.py`）
- Produces: `Base`, `AuthRole`, `AuthOrgNode`, `AuthUser`, `AuthUserRole`, `AuthResourceGrant`, `AuthDimensionType`, `get_meta_engine()`, `get_meta_session()`；Pydantic DTO 族；revision `0003`

- [ ] **Step 1: 创建 `backend/app/auth/models.py`**

```python
from __future__ import annotations

import uuid
from datetime import datetime
from functools import lru_cache

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


class AuthRole(Base):
    __tablename__ = "auth_roles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AuthOrgNode(Base):
    __tablename__ = "auth_org_nodes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("auth_org_nodes.id", ondelete="RESTRICT"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthUser(Base):
    __tablename__ = "auth_users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthUserRole(Base):
    __tablename__ = "auth_user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_auth_user_roles"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthResourceGrant(Base):
    __tablename__ = "auth_resource_grants"
    __table_args__ = (
        UniqueConstraint("role_id", "resource_type", "resource_id", name="uq_auth_resource_grants"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    role_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("auth_roles.id", ondelete="CASCADE"))
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthDimensionType(Base):
    __tablename__ = "auth_dimension_types"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    value_type: Mapped[str] = mapped_column(String(32), nullable=False)
    org_dimension: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


@lru_cache
def get_meta_engine():
    url = get_settings().database_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


def get_meta_session():
    return sessionmaker(bind=get_meta_engine(), autoflush=False, autocommit=False)()
```

- [ ] **Step 2: 创建 `backend/app/auth/schemas.py`**

```python
from __future__ import annotations

import re
import uuid
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ROLE_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
ResourceType = Literal["datasource", "dashboard", "report"]
ValueType = Literal["string", "number", "boolean", "org_ref"]


class RoleCreate(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not ROLE_CODE_RE.match(value):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return value


class RoleUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None


class RoleOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None


class RoleListResponse(BaseModel):
    items: list[RoleOut]


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    parent_id: uuid.UUID | None = None


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    parent_id: uuid.UUID | None = None


class OrgOut(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    path: str
    level: int


class OrgListResponse(BaseModel):
    items: list[OrgOut]


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    username: str


class UserRolesReplace(BaseModel):
    role_ids: list[uuid.UUID]


class UserRoleOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class UserRolesResponse(BaseModel):
    items: list[UserRoleOut]


class ResourceGrantCreate(BaseModel):
    role_id: uuid.UUID
    resource_type: ResourceType
    resource_id: uuid.UUID


class ResourceGrantOut(BaseModel):
    id: uuid.UUID
    role_id: uuid.UUID
    resource_type: str
    resource_id: uuid.UUID


class ResourceGrantListResponse(BaseModel):
    items: list[ResourceGrantOut]


class DimensionTypeCreate(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=128)
    value_type: ValueType
    description: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not ROLE_CODE_RE.match(value):
            raise ValueError("code must match ^[a-z][a-z0-9_]{1,63}$")
        return value


class DimensionTypeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None


class DimensionTypeOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    value_type: str
    org_dimension: bool
    description: str | None


class DimensionTypeListResponse(BaseModel):
    items: list[DimensionTypeOut]
```

- [ ] **Step 3: 创建 `backend/migrations/versions/0003_auth_tables.py`**

```python
"""auth tables

Revision ID: 0003
Revises: 0002
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_roles",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "auth_org_nodes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("auth_org_nodes.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "auth_users",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("username", sa.String(128), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "auth_user_roles",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("auth_users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "role_id", name="uq_auth_user_roles"),
    )
    op.create_table(
        "auth_resource_grants",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("role_id", "resource_type", "resource_id", name="uq_auth_resource_grants"),
    )
    op.create_table(
        "auth_dimension_types",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("value_type", sa.String(32), nullable=False),
        sa.Column("org_dimension", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("auth_dimension_types")
    op.drop_table("auth_resource_grants")
    op.drop_table("auth_user_roles")
    op.drop_table("auth_users")
    op.drop_table("auth_org_nodes")
    op.drop_table("auth_roles")
```

- [ ] **Step 4: 创建 `tests/test_auth_rbac_l1.py` 测试基建**

```python
import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:auth_rbac_test?mode=memory&cache=shared&uri=true"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.models import Base, get_meta_engine
from app.core.config import get_settings
from app.main import app

get_settings.cache_clear()
get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_auth_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        for table in (
            "auth_user_roles",
            "auth_resource_grants",
            "auth_dimension_types",
            "auth_org_nodes",
            "auth_users",
            "auth_roles",
        ):
            conn.execute(text(f"DELETE FROM {table}"))


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev"}


def test_auth_rbac_infra_tables_exist():
    """T-AUTH-INFRA: auth 六表 create_all 成功。"""
    engine = get_meta_engine()
    tables = set(Base.metadata.tables.keys())
    for name in (
        "auth_roles",
        "auth_org_nodes",
        "auth_users",
        "auth_user_roles",
        "auth_resource_grants",
        "auth_dimension_types",
    ):
        assert name in tables
    assert engine is not None
```

- [ ] **Step 5: 运行基建验证**

Run: `cd backend && python3 -m ruff check app/auth/models.py app/auth/schemas.py migrations/versions/0003_auth_tables.py && python3 -m pytest ../tests/test_auth_rbac_l1.py::test_auth_rbac_infra_tables_exist -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/auth/models.py backend/app/auth/schemas.py backend/migrations/versions/0003_auth_tables.py tests/test_auth_rbac_l1.py
git commit -m "feat(AUTH): auth meta models, schemas, migration 0003, test infra"
```

---

### Task 2: AUTH-001 — RoleRegistry 服务与 API

**Files:**
- Create: `backend/app/auth/roles/service.py`
- Create: `backend/app/api/v1/roles.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `AuthRole`, `RoleCreate`, `RoleUpdate`, `RoleOut`, `get_meta_session`
- Produces: `list_roles`, `create_role`, `get_role`, `update_role`, `delete_role`; router prefix `/roles`

- [ ] **Step 1: 追加 T-AUTH-R01~R06 到 `tests/test_auth_rbac_l1.py`**

```python
def test_role_create_list_roundtrip(client, auth_headers):
    """T-AUTH-R01: POST 创建角色 roundtrip。"""
    payload = {"code": "analyst", "name": "Analyst", "description": "read only"}
    created = client.post("/api/v1/roles", json=payload, headers=auth_headers)
    assert created.status_code == 201
    body = created.json()
    assert body["code"] == "analyst"
    assert body["name"] == "Analyst"

    listed = client.get("/api/v1/roles", headers=auth_headers)
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["items"]]
    assert body["id"] in ids


def test_role_duplicate_code_conflict(client, auth_headers):
    """T-AUTH-R02: 重复 code → 409 ROLE_CODE_CONFLICT。"""
    payload = {"code": "viewer", "name": "Viewer"}
    assert client.post("/api/v1/roles", json=payload, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/roles", json=payload, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "ROLE_CODE_CONFLICT"


def test_role_invalid_code_422(client, auth_headers):
    """T-AUTH-R03: 非法 code → 422。"""
    resp = client.post("/api/v1/roles", json={"code": "BAD", "name": "x"}, headers=auth_headers)
    assert resp.status_code == 422


def test_role_update_name(client, auth_headers):
    """T-AUTH-R04: PUT 更新 name；code 不变。"""
    created = client.post(
        "/api/v1/roles", json={"code": "editor", "name": "Editor"}, headers=auth_headers
    ).json()
    updated = client.put(
        f"/api/v1/roles/{created['id']}",
        json={"name": "Content Editor", "description": "d"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Content Editor"
    assert updated.json()["code"] == "editor"


def test_role_delete_idle(client, auth_headers):
    """T-AUTH-R05: DELETE 空闲角色 → 204；GET → 404。"""
    created = client.post(
        "/api/v1/roles", json={"code": "temp_role", "name": "Temp"}, headers=auth_headers
    ).json()
    deleted = client.delete(f"/api/v1/roles/{created['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/roles/{created['id']}", headers=auth_headers).status_code == 404


def test_openapi_contains_roles_paths(client):
    """T-AUTH-R06: OpenAPI 含 /api/v1/roles CRUD。"""
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/roles" in paths
    assert "/api/v1/roles/{id}" in paths
```

- [ ] **Step 2: 运行角色测试确认失败**

Run: `cd backend && python3 -m pytest ../tests/test_auth_rbac_l1.py -k "R01 or R02 or R03 or R04 or R05 or R06" -v`
Expected: FAIL（404 / import error）

- [ ] **Step 3: 创建 `backend/app/auth/roles/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthResourceGrant, AuthRole, AuthUserRole
from app.auth.schemas import RoleCreate, RoleUpdate


class RoleError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def list_roles(session: Session) -> list[AuthRole]:
    return list(session.scalars(select(AuthRole).order_by(AuthRole.code)))


def create_role(session: Session, payload: RoleCreate) -> AuthRole:
    role = AuthRole(code=payload.code, name=payload.name, description=payload.description)
    session.add(role)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise RoleError("ROLE_CODE_CONFLICT", "Role code already exists", 409) from exc
    session.refresh(role)
    return role


def get_role(session: Session, role_id: uuid.UUID) -> AuthRole:
    role = session.get(AuthRole, role_id)
    if role is None:
        raise RoleError("ROLE_NOT_FOUND", "Role not found", 404)
    return role


def update_role(session: Session, role_id: uuid.UUID, payload: RoleUpdate) -> AuthRole:
    role = get_role(session, role_id)
    role.name = payload.name
    role.description = payload.description
    session.commit()
    session.refresh(role)
    return role


def delete_role(session: Session, role_id: uuid.UUID) -> None:
    role = get_role(session, role_id)
    user_refs = session.scalar(
        select(AuthUserRole).where(AuthUserRole.role_id == role_id).limit(1)
    )
    grant_refs = session.scalar(
        select(AuthResourceGrant).where(AuthResourceGrant.role_id == role_id).limit(1)
    )
    if user_refs or grant_refs:
        raise RoleError("ROLE_IN_USE", "Role is referenced by bindings or grants", 409)
    session.delete(role)
    session.commit()
```

- [ ] **Step 4: 创建 `backend/app/api/v1/roles.py`**

```python
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.models import get_meta_session
from app.auth.roles import service as role_service
from app.auth.schemas import RoleCreate, RoleListResponse, RoleOut, RoleUpdate

router = APIRouter(prefix="/roles", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _http_from_role_error(exc: role_service.RoleError) -> HTTPException:
    return HTTPException(
        status_code=exc.status,
        detail={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=RoleListResponse)
def list_roles(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> RoleListResponse:
    items = [RoleOut.model_validate(r) for r in role_service.list_roles(db)]
    return RoleListResponse(items=items)


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> RoleOut:
    try:
        role = role_service.create_role(db, payload)
    except role_service.RoleError as exc:
        raise _http_from_role_error(exc) from exc
    return RoleOut.model_validate(role)


@router.get("/{role_id}", response_model=RoleOut)
def get_role(
    role_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> RoleOut:
    try:
        role = role_service.get_role(db, role_id)
    except role_service.RoleError as exc:
        raise _http_from_role_error(exc) from exc
    return RoleOut.model_validate(role)


@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> RoleOut:
    try:
        role = role_service.update_role(db, role_id, payload)
    except role_service.RoleError as exc:
        raise _http_from_role_error(exc) from exc
    return RoleOut.model_validate(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None:
    try:
        role_service.delete_role(db, role_id)
    except role_service.RoleError as exc:
        raise _http_from_role_error(exc) from exc
```

- [ ] **Step 5: 临时注册 roles router 到 `backend/app/api/v1/router.py`**

在 `api_v1_router.include_router(me_router)` 之后追加：

```python
from app.api.v1.roles import router as roles_router

api_v1_router.include_router(roles_router)
```

- [ ] **Step 6: 运行 AUTH-001 验证**

Run: `cd backend && ruff check app/auth/roles/service.py app/api/v1/roles.py && python3 -m pytest ../tests/test_auth_rbac_l1.py -k "R01 or R02 or R03 or R04 or R05 or R06" -v`
Expected: PASS（6 passed）

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth/roles/service.py backend/app/api/v1/roles.py backend/app/api/v1/router.py tests/test_auth_rbac_l1.py
git commit -m "feat(AUTH-001): RoleRegistry CRUD API and smoke tests"
```

---

### Task 3: AUTH-002 — 组织树服务与 API

**Files:**
- Create: `backend/app/auth/org/service.py`
- Create: `backend/app/api/v1/orgs.py`
- Modify: `backend/app/api/v1/router.py`（注册 orgs router）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `AuthOrgNode`, `OrgCreate`, `OrgUpdate`, `OrgOut`
- Produces: `create_org_node`, `list_org_nodes`, `get_org_node`, `update_org_node`, `delete_org_node`；环检测 `ORG_CYCLE`；有子节点 `ORG_HAS_CHILDREN`

- [ ] **Step 1: 追加 T-AUTH-O01~O06 测试**

```python
def test_org_root_and_child_paths(client, auth_headers):
    """T-AUTH-O01: 根 level=0 path=/{id}；子 level=1。"""
    root = client.post("/api/v1/orgs", json={"name": "HQ"}, headers=auth_headers).json()
    assert root["level"] == 0
    assert root["path"] == f"/{root['id']}"

    child = client.post(
        "/api/v1/orgs",
        json={"name": "Branch", "parent_id": root["id"]},
        headers=auth_headers,
    ).json()
    assert child["level"] == 1
    assert child["path"].startswith(root["path"] + "/")


def test_org_invalid_parent_404(client, auth_headers):
    """T-AUTH-O02: 非法 parent_id → 404 ORG_PARENT_NOT_FOUND。"""
    import uuid

    resp = client.post(
        "/api/v1/orgs",
        json={"name": "x", "parent_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "ORG_PARENT_NOT_FOUND"


def test_org_move_cycle_409(client, auth_headers):
    """T-AUTH-O03: 移节点成环 → 409 ORG_CYCLE。"""
    root = client.post("/api/v1/orgs", json={"name": "R"}, headers=auth_headers).json()
    child = client.post(
        "/api/v1/orgs", json={"name": "C", "parent_id": root["id"]}, headers=auth_headers
    ).json()
    resp = client.put(
        f"/api/v1/orgs/{root['id']}",
        json={"parent_id": child["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "ORG_CYCLE"


def test_org_delete_with_children_409(client, auth_headers):
    """T-AUTH-O04: 删除有子节点 → 409 ORG_HAS_CHILDREN。"""
    root = client.post("/api/v1/orgs", json={"name": "R"}, headers=auth_headers).json()
    client.post("/api/v1/orgs", json={"name": "C", "parent_id": root["id"]}, headers=auth_headers)
    resp = client.delete(f"/api/v1/orgs/{root['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ORG_HAS_CHILDREN"


def test_org_move_updates_subtree_paths(client, auth_headers):
    """T-AUTH-O05: 移中间节点后子孙 path 前缀正确。"""
    a = client.post("/api/v1/orgs", json={"name": "A"}, headers=auth_headers).json()
    b = client.post("/api/v1/orgs", json={"name": "B", "parent_id": a["id"]}, headers=auth_headers).json()
    c = client.post("/api/v1/orgs", json={"name": "C", "parent_id": b["id"]}, headers=auth_headers).json()
    d = client.post("/api/v1/orgs", json={"name": "D"}, headers=auth_headers).json()
    client.put(f"/api/v1/orgs/{b['id']}", json={"parent_id": d["id"]}, headers=auth_headers)
    items = {item["id"]: item for item in client.get("/api/v1/orgs", headers=auth_headers).json()["items"]}
    assert items[c["id"]]["path"].startswith(items[b["id"]]["path"] + "/")


def test_org_list_fields(client, auth_headers):
    """T-AUTH-O06: GET 列表含 parent_id/path/level。"""
    client.post("/api/v1/orgs", json={"name": "L"}, headers=auth_headers)
    item = client.get("/api/v1/orgs", headers=auth_headers).json()["items"][0]
    assert {"parent_id", "path", "level", "name", "id"} <= set(item.keys())
```

- [ ] **Step 2: 创建 `backend/app/auth/org/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import AuthOrgNode
from app.auth.schemas import OrgCreate, OrgUpdate


class OrgError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _would_create_cycle(session: Session, node_id: uuid.UUID, new_parent_id: uuid.UUID) -> bool:
    parent = session.get(AuthOrgNode, new_parent_id)
    if parent is None:
        return False
    return parent.id == node_id or parent.path.startswith(f"/{node_id}/")


def _repath_subtree(session: Session, node: AuthOrgNode) -> None:
    children = session.scalars(select(AuthOrgNode).where(AuthOrgNode.parent_id == node.id))
    for child in children:
        child.level = node.level + 1
        child.path = f"{node.path}/{child.id}"
        _repath_subtree(session, child)


def _init_path_level(node: AuthOrgNode, parent: AuthOrgNode | None) -> None:
    if parent is None:
        node.level = 0
        node.path = f"/{node.id}"
    else:
        node.level = parent.level + 1
        node.path = f"{parent.path}/{node.id}"


def list_org_nodes(session: Session) -> list[AuthOrgNode]:
    return list(session.scalars(select(AuthOrgNode).order_by(AuthOrgNode.path)))


def create_org_node(session: Session, payload: OrgCreate) -> AuthOrgNode:
    parent = None
    if payload.parent_id is not None:
        parent = session.get(AuthOrgNode, payload.parent_id)
        if parent is None:
            raise OrgError("ORG_PARENT_NOT_FOUND", "Parent org node not found", 404)
    node = AuthOrgNode(name=payload.name, parent_id=payload.parent_id)
    session.add(node)
    session.flush()
    _init_path_level(node, parent)
    session.commit()
    session.refresh(node)
    return node


def get_org_node(session: Session, node_id: uuid.UUID) -> AuthOrgNode:
    node = session.get(AuthOrgNode, node_id)
    if node is None:
        raise OrgError("ORG_NOT_FOUND", "Org node not found", 404)
    return node


def update_org_node(session: Session, node_id: uuid.UUID, payload: OrgUpdate) -> AuthOrgNode:
    node = get_org_node(session, node_id)
    if payload.name is not None:
        node.name = payload.name
    if payload.parent_id is not None:
        if payload.parent_id == node_id:
            raise OrgError("ORG_CYCLE", "Cannot move node under itself", 409)
        parent = session.get(AuthOrgNode, payload.parent_id)
        if parent is None:
            raise OrgError("ORG_PARENT_NOT_FOUND", "Parent org node not found", 404)
        if _would_create_cycle(session, node_id, payload.parent_id):
            raise OrgError("ORG_CYCLE", "Move would create cycle", 409)
        node.parent_id = payload.parent_id
        _init_path_level(node, parent)
        _repath_subtree(session, node)
    session.commit()
    session.refresh(node)
    return node


def delete_org_node(session: Session, node_id: uuid.UUID) -> None:
    node = get_org_node(session, node_id)
    child_count = session.scalar(
        select(func.count()).select_from(AuthOrgNode).where(AuthOrgNode.parent_id == node_id)
    )
    if child_count and child_count > 0:
        raise OrgError("ORG_HAS_CHILDREN", "Cannot delete org node with children", 409)
    session.delete(node)
    session.commit()
```

- [ ] **Step 3: 创建 `backend/app/api/v1/orgs.py`**

```python
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.models import get_meta_session
from app.auth.org import service as org_service
from app.auth.schemas import OrgCreate, OrgListResponse, OrgOut, OrgUpdate

router = APIRouter(prefix="/orgs", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _http_from_org_error(exc: org_service.OrgError) -> HTTPException:
    return HTTPException(
        status_code=exc.status,
        detail={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=OrgListResponse)
def list_orgs(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> OrgListResponse:
    items = [OrgOut.model_validate(n) for n in org_service.list_org_nodes(db)]
    return OrgListResponse(items=items)


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
def create_org(
    payload: OrgCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> OrgOut:
    try:
        node = org_service.create_org_node(db, payload)
    except org_service.OrgError as exc:
        raise _http_from_org_error(exc) from exc
    return OrgOut.model_validate(node)


@router.get("/{org_id}", response_model=OrgOut)
def get_org(
    org_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> OrgOut:
    try:
        node = org_service.get_org_node(db, org_id)
    except org_service.OrgError as exc:
        raise _http_from_org_error(exc) from exc
    return OrgOut.model_validate(node)


@router.put("/{org_id}", response_model=OrgOut)
def update_org(
    org_id: uuid.UUID,
    payload: OrgUpdate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> OrgOut:
    try:
        node = org_service.update_org_node(db, org_id, payload)
    except org_service.OrgError as exc:
        raise _http_from_org_error(exc) from exc
    return OrgOut.model_validate(node)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_org(
    org_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None:
    try:
        org_service.delete_org_node(db, org_id)
    except org_service.OrgError as exc:
        raise _http_from_org_error(exc) from exc
```

- [ ] **Step 4: 注册 orgs router**

```python
from app.api.v1.orgs import router as orgs_router

api_v1_router.include_router(orgs_router)
```

- [ ] **Step 5: 运行 AUTH-002 验证**

Run: `cd backend && ruff check app/auth/org/service.py app/api/v1/orgs.py && python3 -m pytest ../tests/test_auth_rbac_l1.py -k "O01 or O02 or O03 or O04 or O05 or O06" -v`
Expected: PASS（6 passed）

- [ ] **Step 6: Commit**

```bash
git add backend/app/auth/org/service.py backend/app/api/v1/orgs.py backend/app/api/v1/router.py tests/test_auth_rbac_l1.py
git commit -m "feat(AUTH-002): org tree CRUD with path/level and cycle guard"
```

---

### Task 4: AUTH-003 — 用户角色绑定与鉴权挂钩

**Files:**
- Create: `backend/app/auth/users/service.py`
- Create: `backend/app/api/v1/users.py`
- Modify: `backend/app/auth/deps.py`
- Modify: `backend/app/auth/middleware.py`
- Modify: `backend/app/api/v1/router.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`（修 test_me 回归前检索）

**UI skill:** none

**Interfaces:**
- Consumes: `AuthUser`, `AuthUserRole`, `AuthRole`
- Produces: `create_user`, `list_user_roles`, `bind_role`, `unbind_role`, `replace_user_roles`, `resolve_role_codes_for_username(session, username) -> list[str]`

- [ ] **Step 1: 追加 T-AUTH-U01~U06 测试**

```python
def test_user_bind_roles_roundtrip(client, auth_headers):
    """T-AUTH-U01: 创建用户 + 绑定角色。"""
    role = client.post("/api/v1/roles", json={"code": "bind_r1", "name": "R1"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "u_bind_1"}, headers=auth_headers).json()
    bind = client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    assert bind.status_code == 200
    roles = client.get(f"/api/v1/users/{user['id']}/roles", headers=auth_headers).json()["items"]
    assert any(r["code"] == "bind_r1" for r in roles)


def test_user_bind_idempotent(client, auth_headers):
    """T-AUTH-U02: 重复 POST bind → 200；仅一行。"""
    role = client.post("/api/v1/roles", json={"code": "bind_r2", "name": "R2"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "u_bind_2"}, headers=auth_headers).json()
    url = f"/api/v1/users/{user['id']}/roles/{role['id']}"
    assert client.post(url, headers=auth_headers).status_code == 200
    assert client.post(url, headers=auth_headers).status_code == 200
    assert len(client.get(f"/api/v1/users/{user['id']}/roles", headers=auth_headers).json()["items"]) == 1


def test_user_bind_invalid_role_404(client, auth_headers):
    """T-AUTH-U03: 非法 roleId → 404。"""
    import uuid

    user = client.post("/api/v1/users", json={"username": "u_bind_3"}, headers=auth_headers).json()
    resp = client.post(f"/api/v1/users/{user['id']}/roles/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


def test_user_unbind_not_found_404(client, auth_headers):
    """T-AUTH-U04: 解绑不存在 → 404 BINDING_NOT_FOUND。"""
    import uuid

    user = client.post("/api/v1/users", json={"username": "u_bind_4"}, headers=auth_headers).json()
    resp = client.delete(f"/api/v1/users/{user['id']}/roles/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == "BINDING_NOT_FOUND"


def test_user_replace_roles(client, auth_headers):
    """T-AUTH-U05: PUT 全量替换 role_ids。"""
    r1 = client.post("/api/v1/roles", json={"code": "rep_r1", "name": "A"}, headers=auth_headers).json()
    r2 = client.post("/api/v1/roles", json={"code": "rep_r2", "name": "B"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "u_rep"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{r1['id']}", headers=auth_headers)
    client.put(
        f"/api/v1/users/{user['id']}/roles",
        json={"role_ids": [r2["id"]]},
        headers=auth_headers,
    )
    codes = [r["code"] for r in client.get(f"/api/v1/users/{user['id']}/roles", headers=auth_headers).json()["items"]]
    assert codes == ["rep_r2"]


def test_me_roles_from_db_dev_user(client, auth_headers):
    """T-AUTH-U06: dev 用户绑定 viewer 后 GET /me roles 含 viewer。"""
    from app.auth.models import AuthUser, AuthUserRole, get_meta_session
    from sqlalchemy import delete, select

    role = client.post("/api/v1/roles", json={"code": "viewer", "name": "Viewer"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "dev"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    me = client.get("/api/v1/me", headers=auth_headers)
    assert me.status_code == 200
    assert "viewer" in me.json()["roles"]
    # teardown：删除 dev 用户绑定，避免污染后续 test_me.py admin fallback
    session = get_meta_session()
    try:
        dev = session.scalar(select(AuthUser).where(AuthUser.username == "dev"))
        if dev is not None:
            session.execute(delete(AuthUserRole).where(AuthUserRole.user_id == dev.id))
            session.execute(delete(AuthUser).where(AuthUser.id == dev.id))
            session.commit()
    finally:
        session.close()
```

- [ ] **Step 2: 创建 `backend/app/auth/users/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthRole, AuthUser, AuthUserRole
from app.auth.schemas import UserCreate


class UserError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def create_user(session: Session, payload: UserCreate) -> AuthUser:
    user = AuthUser(username=payload.username)
    session.add(user)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise UserError("USERNAME_CONFLICT", "Username already exists", 409) from exc
    session.refresh(user)
    return user


def get_user(session: Session, user_id: uuid.UUID) -> AuthUser:
    user = session.get(AuthUser, user_id)
    if user is None:
        raise UserError("USER_NOT_FOUND", "User not found", 404)
    return user


def get_user_by_username(session: Session, username: str) -> AuthUser | None:
    return session.scalar(select(AuthUser).where(AuthUser.username == username))


def list_user_roles(session: Session, user_id: uuid.UUID) -> list[AuthRole]:
    get_user(session, user_id)
    return list(
        session.scalars(
            select(AuthRole)
            .join(AuthUserRole, AuthUserRole.role_id == AuthRole.id)
            .where(AuthUserRole.user_id == user_id)
            .order_by(AuthRole.code)
        )
    )


def bind_role(session: Session, user_id: uuid.UUID, role_id: uuid.UUID) -> None:
    get_user(session, user_id)
    role = session.get(AuthRole, role_id)
    if role is None:
        raise UserError("ROLE_NOT_FOUND", "Role not found", 404)
    existing = session.get(AuthUserRole, {"user_id": user_id, "role_id": role_id})
    if existing is None:
        session.add(AuthUserRole(user_id=user_id, role_id=role_id))
        session.commit()


def unbind_role(session: Session, user_id: uuid.UUID, role_id: uuid.UUID) -> None:
    get_user(session, user_id)
    binding = session.get(AuthUserRole, {"user_id": user_id, "role_id": role_id})
    if binding is None:
        raise UserError("BINDING_NOT_FOUND", "User-role binding not found", 404)
    session.delete(binding)
    session.commit()


def replace_user_roles(session: Session, user_id: uuid.UUID, role_ids: list[uuid.UUID]) -> list[AuthRole]:
    get_user(session, user_id)
    for role_id in role_ids:
        if session.get(AuthRole, role_id) is None:
            raise UserError("ROLE_NOT_FOUND", "Role not found", 404)
    session.query(AuthUserRole).filter(AuthUserRole.user_id == user_id).delete()
    for role_id in role_ids:
        session.add(AuthUserRole(user_id=user_id, role_id=role_id))
    session.commit()
    return list_user_roles(session, user_id)


def resolve_role_codes_for_user(session: Session, user_id: uuid.UUID) -> list[str]:
    if session.get(AuthUser, user_id) is None:
        return []
    roles = list_user_roles(session, user_id)
    return [r.code for r in roles]


def resolve_role_codes_for_username(session: Session, username: str) -> list[str]:
    user = get_user_by_username(session, username)
    if user is None:
        return []
    return resolve_role_codes_for_user(session, user.id)
```

- [ ] **Step 3: 扩展 `backend/app/auth/deps.py`**

在文件末尾追加：

```python
import uuid

from app.auth.models import get_meta_session
from app.auth.users import service as user_service


def resolve_user_roles(user_id: str) -> list[str]:
    session = get_meta_session()
    try:
        return user_service.resolve_role_codes_for_user(session, uuid.UUID(user_id))
    finally:
        session.close()
```

- [ ] **Step 4: 修改 `backend/app/auth/middleware.py` dev 分支**

在文件顶部 import 区追加：

```python
from app.auth.models import get_meta_session
from app.auth.users import service as user_service
```

将 `dispatch` 内 `Bearer dev` 分支体：

```python
request.state.user = UserContext(id="dev", username="dev", roles=["admin"])
```

替换为：

```python
session = get_meta_session()
try:
    db_roles = user_service.resolve_role_codes_for_username(session, "dev")
finally:
    session.close()
roles = db_roles if db_roles else ["admin"]
request.state.user = UserContext(id="dev", username="dev", roles=roles)
```

注意：`test_me_with_bearer_dev_returns_200` 在无 `auth_users.username=dev` 时仍须 `roles==["admin"]`——`resolve_role_codes_for_username` 返回 `[]` 时 fallback `["admin"]`。

- [ ] **Step 5: 创建 `backend/app/api/v1/users.py`**

```python
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.models import get_meta_session
from app.auth.schemas import UserCreate, UserOut, UserRoleOut, UserRolesReplace, UserRolesResponse
from app.auth.users import service as user_service

router = APIRouter(prefix="/users", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _http_from_user_error(exc: user_service.UserError) -> HTTPException:
    return HTTPException(
        status_code=exc.status,
        detail={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> UserOut:
    try:
        user = user_service.create_user(db, payload)
    except user_service.UserError as exc:
        raise _http_from_user_error(exc) from exc
    return UserOut.model_validate(user)


@router.get("/{user_id}/roles", response_model=UserRolesResponse)
def list_user_roles(
    user_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> UserRolesResponse:
    try:
        roles = user_service.list_user_roles(db, user_id)
    except user_service.UserError as exc:
        raise _http_from_user_error(exc) from exc
    items = [UserRoleOut(id=r.id, code=r.code, name=r.name) for r in roles]
    return UserRolesResponse(items=items)


@router.put("/{user_id}/roles", response_model=UserRolesResponse)
def replace_user_roles(
    user_id: uuid.UUID,
    payload: UserRolesReplace,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> UserRolesResponse:
    try:
        roles = user_service.replace_user_roles(db, user_id, payload.role_ids)
    except user_service.UserError as exc:
        raise _http_from_user_error(exc) from exc
    items = [UserRoleOut(id=r.id, code=r.code, name=r.name) for r in roles]
    return UserRolesResponse(items=items)


@router.post("/{user_id}/roles/{role_id}", status_code=status.HTTP_200_OK)
def bind_user_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> dict[str, str]:
    try:
        user_service.bind_role(db, user_id, role_id)
    except user_service.UserError as exc:
        raise _http_from_user_error(exc) from exc
    return {"status": "ok"}


@router.delete("/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def unbind_user_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None:
    try:
        user_service.unbind_role(db, user_id, role_id)
    except user_service.UserError as exc:
        raise _http_from_user_error(exc) from exc
```

- [ ] **Step 6: 注册 users router；运行 AUTH-003 + test_me 回归**

Run: `cd backend && ruff check app/auth/users/service.py app/auth/deps.py app/auth/middleware.py app/api/v1/users.py && python3 -m pytest ../tests/test_auth_rbac_l1.py -k "U01 or U02 or U03 or U04 or U05 or U06" ../tests/test_me.py -v`
Expected: PASS；`test_me_with_bearer_dev_returns_200` 仍绿（无 dev 用户时 admin）

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth/users/service.py backend/app/api/v1/users.py backend/app/auth/deps.py backend/app/auth/middleware.py backend/app/api/v1/router.py tests/test_auth_rbac_l1.py
git commit -m "feat(AUTH-003): user-role bindings and dev token role resolution"
```

---

### Task 5: AUTH-004 — 资源授权与访问守卫

**Files:**
- Create: `backend/app/auth/resources/service.py`
- Create: `backend/app/api/v1/resource_grants.py`
- Modify: `backend/app/api/v1/router.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `create_grant`, `list_grants`, `delete_grant`, `check_resource_access(role_codes, resource_type, resource_id) -> bool`

- [ ] **Step 1: 追加 T-AUTH-G01~G05 测试**

```python
import uuid as uuid_mod

from app.auth.resources.service import check_resource_access
from app.auth.models import get_meta_session


def test_resource_grant_create_list(client, auth_headers):
    """T-AUTH-G01: POST 授权 datasource。"""
    role = client.post("/api/v1/roles", json={"code": "grant_r1", "name": "G"}, headers=auth_headers).json()
    rid = str(uuid_mod.uuid4())
    created = client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": rid},
        headers=auth_headers,
    )
    assert created.status_code == 201
    items = client.get("/api/v1/resource-grants", headers=auth_headers).json()["items"]
    assert any(i["resource_id"] == rid for i in items)


def test_resource_grant_duplicate_409(client, auth_headers):
    """T-AUTH-G02: 重复授权 → 409 GRANT_ALREADY_EXISTS。"""
    role = client.post("/api/v1/roles", json={"code": "grant_r2", "name": "G"}, headers=auth_headers).json()
    rid = str(uuid_mod.uuid4())
    payload = {"role_id": role["id"], "resource_type": "datasource", "resource_id": rid}
    assert client.post("/api/v1/resource-grants", json=payload, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/resource-grants", json=payload, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "GRANT_ALREADY_EXISTS"


def test_resource_grant_invalid_role_404(client, auth_headers):
    """T-AUTH-G03: 非法 role_id → 404。"""
    resp = client.post(
        "/api/v1/resource-grants",
        json={"role_id": str(uuid_mod.uuid4()), "resource_type": "dashboard", "resource_id": str(uuid_mod.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_check_resource_access_positive(client, auth_headers):
    """T-AUTH-G04: 授权角色 → check_resource_access True。"""
    role = client.post("/api/v1/roles", json={"code": "grant_r4", "name": "G"}, headers=auth_headers).json()
    rid = uuid_mod.uuid4()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(rid)},
        headers=auth_headers,
    )
    session = get_meta_session()
    try:
        assert check_resource_access(session, ["grant_r4"], "datasource", rid) is True
    finally:
        session.close()


def test_check_resource_access_negative(client, auth_headers):
    """T-AUTH-G05: 未授权角色 → False。"""
    session = get_meta_session()
    try:
        assert check_resource_access(session, ["unknown"], "datasource", uuid_mod.uuid4()) is False
    finally:
        session.close()
```

- [ ] **Step 2: 创建 `backend/app/auth/resources/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthResourceGrant, AuthRole
from app.auth.schemas import ResourceGrantCreate


class GrantError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def list_grants(
    session: Session,
    role_id: uuid.UUID | None = None,
    resource_type: str | None = None,
) -> list[AuthResourceGrant]:
    stmt = select(AuthResourceGrant).order_by(AuthResourceGrant.created_at)
    if role_id is not None:
        stmt = stmt.where(AuthResourceGrant.role_id == role_id)
    if resource_type is not None:
        stmt = stmt.where(AuthResourceGrant.resource_type == resource_type)
    return list(session.scalars(stmt))


def create_grant(session: Session, payload: ResourceGrantCreate) -> AuthResourceGrant:
    if session.get(AuthRole, payload.role_id) is None:
        raise GrantError("ROLE_NOT_FOUND", "Role not found", 404)
    grant = AuthResourceGrant(
        role_id=payload.role_id,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
    )
    session.add(grant)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise GrantError("GRANT_ALREADY_EXISTS", "Resource grant already exists", 409) from exc
    session.refresh(grant)
    return grant


def delete_grant(session: Session, grant_id: uuid.UUID) -> None:
    grant = session.get(AuthResourceGrant, grant_id)
    if grant is None:
        raise GrantError("GRANT_NOT_FOUND", "Resource grant not found", 404)
    session.delete(grant)
    session.commit()


def check_resource_access(
    session: Session,
    role_codes: list[str],
    resource_type: str,
    resource_id: uuid.UUID,
) -> bool:
    if not role_codes:
        return False
    stmt = (
        select(AuthResourceGrant.id)
        .join(AuthRole, AuthRole.id == AuthResourceGrant.role_id)
        .where(
            AuthRole.code.in_(role_codes),
            AuthResourceGrant.resource_type == resource_type,
            AuthResourceGrant.resource_id == resource_id,
        )
        .limit(1)
    )
    return session.scalar(stmt) is not None
```

- [ ] **Step 3: 创建 `backend/app/api/v1/resource_grants.py`**

```python
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.models import get_meta_session
from app.auth.resources import service as grant_service
from app.auth.schemas import ResourceGrantCreate, ResourceGrantListResponse, ResourceGrantOut

router = APIRouter(prefix="/resource-grants", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _http_from_grant_error(exc: grant_service.GrantError) -> HTTPException:
    return HTTPException(
        status_code=exc.status,
        detail={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=ResourceGrantListResponse)
def list_resource_grants(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    role_id: uuid.UUID | None = Query(default=None),
    resource_type: str | None = Query(default=None),
) -> ResourceGrantListResponse:
    items = [
        ResourceGrantOut.model_validate(g)
        for g in grant_service.list_grants(db, role_id=role_id, resource_type=resource_type)
    ]
    return ResourceGrantListResponse(items=items)


@router.post("", response_model=ResourceGrantOut, status_code=status.HTTP_201_CREATED)
def create_resource_grant(
    payload: ResourceGrantCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> ResourceGrantOut:
    try:
        grant = grant_service.create_grant(db, payload)
    except grant_service.GrantError as exc:
        raise _http_from_grant_error(exc) from exc
    return ResourceGrantOut.model_validate(grant)


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource_grant(
    grant_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None:
    try:
        grant_service.delete_grant(db, grant_id)
    except grant_service.GrantError as exc:
        raise _http_from_grant_error(exc) from exc
```

- [ ] **Step 4: 注册 router；验证**

Run: `cd backend && ruff check app/auth/resources/service.py app/api/v1/resource_grants.py && python3 -m pytest ../tests/test_auth_rbac_l1.py -k "G01 or G02 or G03 or G04 or G05" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth/resources/service.py backend/app/api/v1/resource_grants.py backend/app/api/v1/router.py tests/test_auth_rbac_l1.py
git commit -m "feat(AUTH-004): resource grants CRUD and check_resource_access"
```

---

### Task 6: AUTH-005 — 权限维度类型

**Files:**
- Create: `backend/app/auth/rls/dimensions/service.py`
- Create: `backend/app/api/v1/rls.py`
- Modify: `backend/app/api/v1/router.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: 维度类型 CRUD；`value_type=org_ref` 时强制 `org_dimension=True`

- [ ] **Step 1: 追加 T-AUTH-D01~D05 测试**

```python
def test_dimension_type_create(client, auth_headers):
    """T-AUTH-D01: POST 注册维度类型。"""
    resp = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "region", "name": "Region", "value_type": "string"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["code"] == "region"
    assert body["value_type"] == "string"


def test_dimension_type_duplicate_409(client, auth_headers):
    """T-AUTH-D02: 重复 code → 409。"""
    payload = {"code": "dup_dim", "name": "D", "value_type": "number"}
    assert client.post("/api/v1/rls/dimensions", json=payload, headers=auth_headers).status_code == 201
    assert client.post("/api/v1/rls/dimensions", json=payload, headers=auth_headers).status_code == 409


def test_dimension_type_org_ref_sets_flag(client, auth_headers):
    """T-AUTH-D03: value_type=org_ref → org_dimension=true。"""
    client.post("/api/v1/orgs", json={"name": "OrgRoot"}, headers=auth_headers)
    resp = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "organization", "name": "Organization", "value_type": "org_ref"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["org_dimension"] is True


def test_dimension_type_update_name(client, auth_headers):
    """T-AUTH-D04: PUT 更新 name。"""
    created = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "dim_upd", "name": "Old", "value_type": "boolean"},
        headers=auth_headers,
    ).json()
    updated = client.put(
        f"/api/v1/rls/dimensions/{created['id']}",
        json={"name": "New"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "New"


def test_dimension_type_delete_idle(client, auth_headers):
    """T-AUTH-D05: DELETE 空闲类型 → 204。"""
    created = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "dim_del", "name": "Del", "value_type": "string"},
        headers=auth_headers,
    ).json()
    assert client.delete(f"/api/v1/rls/dimensions/{created['id']}", headers=auth_headers).status_code == 204
```

- [ ] **Step 2: 创建 `backend/app/auth/rls/dimensions/service.py`**

```python
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthDimensionType, AuthOrgNode
from app.auth.schemas import DimensionTypeCreate, DimensionTypeUpdate


class DimensionError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _validate_org_ref(session: Session, value_type: str) -> bool:
    if value_type != "org_ref":
        return False
    count = session.scalar(select(func.count()).select_from(AuthOrgNode))
    if not count or count < 1:
        raise DimensionError("ORG_TREE_REQUIRED", "Org tree required for org_ref dimension", 422)
    return True


def list_dimension_types(session: Session) -> list[AuthDimensionType]:
    return list(session.scalars(select(AuthDimensionType).order_by(AuthDimensionType.code)))


def create_dimension_type(session: Session, payload: DimensionTypeCreate) -> AuthDimensionType:
    org_dimension = _validate_org_ref(session, payload.value_type)
    dim = AuthDimensionType(
        code=payload.code,
        name=payload.name,
        value_type=payload.value_type,
        org_dimension=org_dimension,
        description=payload.description,
    )
    session.add(dim)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise DimensionError("DIMENSION_CODE_CONFLICT", "Dimension code already exists", 409) from exc
    session.refresh(dim)
    return dim


def get_dimension_type(session: Session, dim_id: uuid.UUID) -> AuthDimensionType:
    dim = session.get(AuthDimensionType, dim_id)
    if dim is None:
        raise DimensionError("DIMENSION_NOT_FOUND", "Dimension type not found", 404)
    return dim


def update_dimension_type(
    session: Session, dim_id: uuid.UUID, payload: DimensionTypeUpdate
) -> AuthDimensionType:
    dim = get_dimension_type(session, dim_id)
    dim.name = payload.name
    dim.description = payload.description
    session.commit()
    session.refresh(dim)
    return dim


def delete_dimension_type(session: Session, dim_id: uuid.UUID) -> None:
    dim = get_dimension_type(session, dim_id)
    session.delete(dim)
    session.commit()
```

- [ ] **Step 3: 创建 `backend/app/api/v1/rls.py`**

```python
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.models import get_meta_session
from app.auth.rls.dimensions import service as dim_service
from app.auth.schemas import (
    DimensionTypeCreate,
    DimensionTypeListResponse,
    DimensionTypeOut,
    DimensionTypeUpdate,
)

router = APIRouter(prefix="/rls", tags=["auth"])
dimensions_router = APIRouter(prefix="/dimensions")


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _http_from_dim_error(exc: dim_service.DimensionError) -> HTTPException:
    return HTTPException(
        status_code=exc.status,
        detail={"code": exc.code, "message": exc.message, "detail": None},
    )


@dimensions_router.get("", response_model=DimensionTypeListResponse)
def list_dimensions(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DimensionTypeListResponse:
    items = [DimensionTypeOut.model_validate(d) for d in dim_service.list_dimension_types(db)]
    return DimensionTypeListResponse(items=items)


@dimensions_router.post("", response_model=DimensionTypeOut, status_code=status.HTTP_201_CREATED)
def create_dimension(
    payload: DimensionTypeCreate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DimensionTypeOut:
    try:
        dim = dim_service.create_dimension_type(db, payload)
    except dim_service.DimensionError as exc:
        raise _http_from_dim_error(exc) from exc
    return DimensionTypeOut.model_validate(dim)


@dimensions_router.get("/{dim_id}", response_model=DimensionTypeOut)
def get_dimension(
    dim_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DimensionTypeOut:
    try:
        dim = dim_service.get_dimension_type(db, dim_id)
    except dim_service.DimensionError as exc:
        raise _http_from_dim_error(exc) from exc
    return DimensionTypeOut.model_validate(dim)


@dimensions_router.put("/{dim_id}", response_model=DimensionTypeOut)
def update_dimension(
    dim_id: uuid.UUID,
    payload: DimensionTypeUpdate,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> DimensionTypeOut:
    try:
        dim = dim_service.update_dimension_type(db, dim_id, payload)
    except dim_service.DimensionError as exc:
        raise _http_from_dim_error(exc) from exc
    return DimensionTypeOut.model_validate(dim)


@dimensions_router.delete("/{dim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dimension(
    dim_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> None:
    try:
        dim_service.delete_dimension_type(db, dim_id)
    except dim_service.DimensionError as exc:
        raise _http_from_dim_error(exc) from exc


router.include_router(dimensions_router)
```

- [ ] **Step 4: 注册 rls router；验证**

Run: `cd backend && ruff check app/auth/rls/dimensions/service.py app/api/v1/rls.py && python3 -m pytest ../tests/test_auth_rbac_l1.py -k "D01 or D02 or D03 or D04 or D05" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth/rls/dimensions/service.py backend/app/api/v1/rls.py backend/app/api/v1/router.py tests/test_auth_rbac_l1.py
git commit -m "feat(AUTH-005): RLS dimension type registry API"
```

---

### Task 7: 路由汇总、迁移测试与 API 文档同步

**Files:**
- Modify: `backend/app/api/v1/router.py`（最终确认 5 router 均已注册）
- Modify: `tests/test_migrations.py`（T-MIG-32~33；更新 T-MIG-30 head 断言为 0003）
- Modify: `docs/api/README.md`（登记 `resource-grants` 路由行）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/prd-sync` 对应规则：`.cursor/rules/prd-sync.mdc`（文档同步评估）

**UI skill:** none

**Interfaces:**
- Produces: 完整 `api_v1_router` 含 me + ingestion + roles + orgs + users + resource_grants + rls

- [ ] **Step 1: 确认 `backend/app/api/v1/router.py` 最终形态**

```python
from fastapi import APIRouter

from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.me import router as me_router
from app.api.v1.orgs import router as orgs_router
from app.api.v1.resource_grants import router as resource_grants_router
from app.api.v1.rls import router as rls_router
from app.api.v1.roles import router as roles_router
from app.api.v1.users import router as users_router

api_v1_router = APIRouter()
api_v1_router.include_router(me_router)
api_v1_router.include_router(ingestion_router)
api_v1_router.include_router(roles_router)
api_v1_router.include_router(orgs_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(resource_grants_router)
api_v1_router.include_router(rls_router)
```

- [ ] **Step 2: 更新 `tests/test_migrations.py`**

将 `test_revision_chain_head_is_0002`（T-MIG-30）中期望 head 改为 `"0003"`；在文件末尾追加：

```python
def test_revision_chain_head_is_0003():
    """T-MIG-32: revision 链唯一 head 为 0003；0003.down_revision==0002。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        module = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[module.revision] = module.down_revision

    heads = [rev for rev, down in revisions.items() if not any(d == rev for d in revisions.values())]
    assert heads == ["0003"]

    mod = importlib.import_module("migrations.versions.0003_auth_tables")
    assert mod.down_revision == "0002"


def test_alembic_upgrade_sql_contains_auth_roles():
    """T-MIG-33: alembic upgrade head --sql 输出含 auth_roles。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "auth_roles" in result.stdout
```

- [ ] **Step 3: 更新 `docs/api/README.md`**

在权限相关表格追加一行（状态 → 已实现）：

```markdown
| GET/POST/DELETE | `/api/v1/resource-grants` | AUTH-004 资源授权 CRUD | 已实现 |
```

并将 `/api/v1/roles`、`/orgs`、`/users`、`/rls/dimensions` 对应行状态从「规划」改为「已实现」（若存在）。

- [ ] **Step 4: 全量验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v`
Expected: 既有 273+ 用例绿 + `test_auth_rbac_l1.py` 约 29 项（含 INFRA）+ T-MIG-32~33；`test_me.py` 无回归

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/router.py tests/test_migrations.py docs/api/README.md
git commit -m "chore(AUTH): wire routers, migration tests T-MIG-32/33, api docs"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| AUTH-001~005 各有 Task | Task 2~6 一一对应 |
| 无 TBD/TODO | 已扫描 |
| 每 Task 有验证命令 | 已含 |
| UI skill / Acceptance | 全 Task `UI skill: none`；无 fe/ 文件 |
| 文件数 ≤ 20 | 18 |
| plan.md 结构不变 | 仅 P5 勾选（若有行） |

## P3 文档同步提醒（本 Task 7 仅 api README；其余 P5）

- `docs/services/auth.md`：域状态与类型表（P3/P5）
- `docs/arch.md` §4 auth 子目录（若与子包一致）
- `prd/F02-AUTH.md` AUTH-001~005 验收（P5）
