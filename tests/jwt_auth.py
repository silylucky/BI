"""Shared JWT auth headers for tests (replaces Bearer dev)."""

from app.auth.jwt import DEFAULT_TOKEN_VERSION, create_access_token

# conftest._seed_ci_admin_user 幂等 seed 的 root 管理员 UUID（每个测试前重建）。
# 默认 JWT 身份必须对应真实 DB 用户，才能被 AuthMiddleware 解析出
# roles=["admin"]、is_root=True——移除 middleware admin 回退后，历史测试
# 依赖此默认身份为真实 root。
DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


def jwt_auth_headers(
    *,
    user_id: str | None = None,
    username: str = "admin",
    token_version: int | None = None,
) -> dict[str, str]:
    resolved_id = user_id if user_id is not None else resolve_admin_user_id()
    resolved_version = (
        token_version if token_version is not None else resolve_admin_token_version(resolved_id)
    )
    token = create_access_token(resolved_id, username, token_version=resolved_version)
    return {"Authorization": f"Bearer {token}"}


def resolve_admin_token_version(user_id: str) -> int:
    """对齐 DB 中 admin 用户 token_version，避免 TOKEN_REVOKED。"""
    import uuid as _uuid

    from app.auth.models import AuthUser, Base, get_meta_engine
    from sqlalchemy.orm import Session

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        user = session.get(AuthUser, _uuid.UUID(user_id))
        if user is None:
            user = session.query(AuthUser).filter(AuthUser.username == "admin").first()
        if user is not None:
            return int(user.token_version or DEFAULT_TOKEN_VERSION)
    return DEFAULT_TOKEN_VERSION


def resolve_admin_user_id() -> str:
    """对齐 DB 中 admin 用户 id（postgres 迁移 seed 与 sqlite 固定 seed 兼容）。"""
    import uuid as _uuid

    from app.auth.models import AuthUser, Base, get_meta_engine
    from sqlalchemy.orm import Session

    fixed = str(_uuid.UUID("00000000-0000-0000-0000-000000000001"))
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        user = session.get(AuthUser, _uuid.UUID(fixed))
        if user is None:
            user = session.query(AuthUser).filter(AuthUser.username == "admin").first()
        return str(user.id) if user is not None else fixed


AUTH = jwt_auth_headers()
