from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AuthRole(Base):
    __tablename__ = "auth_roles"
    __table_args__ = (
        CheckConstraint("NOT is_root OR code = 'admin'", name="ck_auth_roles_root_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=func.false()
    )
    is_root: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=func.false()
    )
    permission_version: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    rls_version: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AuthPermission(Base):
    __tablename__ = "auth_permissions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthRolePermission(Base):
    __tablename__ = "auth_role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_permissions.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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
    display_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, server_default="")
    org_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("auth_org_nodes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, server_default=func.true()
    )
    failed_login_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    token_version: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False, server_default="1"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


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


class AuthAuditEvent(Base):
    __tablename__ = "auth_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[str] = mapped_column(String(128), nullable=False)
    actor_username: Mapped[str | None] = mapped_column(String(128), nullable=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthDimensionGroup(Base):
    __tablename__ = "auth_dimension_groups"
    __table_args__ = (
        UniqueConstraint("dimension_type_id", "code", name="uq_auth_dimension_groups_type_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dimension_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("auth_dimension_groups.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthDimensionGroupValue(Base):
    __tablename__ = "auth_dimension_group_values"
    __table_args__ = (UniqueConstraint("group_id", "value", name="uq_auth_dimension_group_values"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_dimension_groups.id", ondelete="CASCADE"), nullable=False
    )
    value: Mapped[str] = mapped_column(String(256), nullable=False)


class AuthRoleDimensionValue(Base):
    __tablename__ = "auth_role_dimension_values"
    __table_args__ = (
        UniqueConstraint(
            "role_id", "dimension_type_id", "value", name="uq_auth_role_dimension_values"
        ),
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True
    )
    dimension_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"), primary_key=True
    )
    value: Mapped[str] = mapped_column(String(256), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthRoleDimensionGroup(Base):
    __tablename__ = "auth_role_dimension_groups"

    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_dimension_groups.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthDimensionTypeRef(Base):
    __tablename__ = "auth_dimension_type_refs"

    dimension_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    ref_source: Mapped[str] = mapped_column(String(32), nullable=False, server_default="group")


class AuthUserResourceGrant(Base):
    __tablename__ = "auth_user_resource_grants"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "resource_type", "resource_id", name="uq_auth_user_resource_grants"
        ),
        CheckConstraint("effect IN ('add', 'deny')", name="ck_auth_user_resource_grants_effect"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    effect: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthUserDimensionOverride(Base):
    __tablename__ = "auth_user_dimension_overrides"
    __table_args__ = (
        CheckConstraint(
            "effect IN ('add', 'deny')", name="ck_auth_user_dimension_overrides_effect"
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_users.id", ondelete="CASCADE"), primary_key=True
    )
    dimension_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"), primary_key=True
    )
    value: Mapped[str] = mapped_column(String(256), primary_key=True)
    effect: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthColumnMask(Base):
    __tablename__ = "auth_column_masks"
    __table_args__ = (
        UniqueConstraint(
            "datasource_id",
            "dataset_id",
            "table_name",
            "column_name",
            name="uq_auth_column_masks_scope",
        ),
        CheckConstraint(
            "mask_strategy IN ('hide', 'partial', 'hash')",
            name="ck_auth_column_masks_strategy",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    datasource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    dataset_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    table_name: Mapped[str] = mapped_column(String(128), nullable=False)
    column_name: Mapped[str] = mapped_column(String(64), nullable=False)
    mask_strategy: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthRlsColumnBinding(Base):
    __tablename__ = "auth_rls_column_bindings"
    __table_args__ = (
        UniqueConstraint(
            "datasource_id",
            "dataset_id",
            "table_name",
            "dimension_type_id",
            name="uq_auth_rls_column_bindings_scope",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    datasource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    dataset_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    table_name: Mapped[str] = mapped_column(String(128), nullable=False)
    dimension_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_dimension_types.id", ondelete="RESTRICT"), nullable=False
    )
    column_name: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


from app.core.db.meta import get_meta_engine, get_meta_session

__all__ = ["get_meta_engine", "get_meta_session"]
