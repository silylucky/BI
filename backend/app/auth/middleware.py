import logging
import uuid
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.auth.bootstrap_root import has_enabled_root_user
from app.auth.deps import UserContext
from app.auth.jwt import JwtError, decode_access_token, token_version_from_claims
from app.auth.models import AuthUser, get_meta_session
from app.auth.permissions import resolve_user_permissions
from app.auth.users import service as user_service
from app.core.config import Settings, get_settings
from app.core.template_assets import is_template_assets_path
from app.core.logging import trace_id_var

PUBLIC_PATHS_BASE: frozenset[str] = frozenset({
    "/health",
    "/api/v1/auth/login",
    "/api/v1/auth-integration/oidc/callback",
})

PUBLIC_PATHS_DEV: frozenset[str] = frozenset({
    "/docs",
    "/redoc",
    "/openapi.json",
})

PUBLIC_PATHS = PUBLIC_PATHS_BASE | PUBLIC_PATHS_DEV

logger = logging.getLogger(__name__)


def _unauthorized_response() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"code": "UNAUTHORIZED", "message": "Missing or invalid bearer token", "detail": None},
    )


def _token_revoked_response() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"code": "TOKEN_REVOKED", "message": "Token has been revoked", "detail": None},
    )


def _user_disabled_response() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={"code": "AUTH_USER_DISABLED", "message": "账户已被禁用", "detail": None},
    )


def _user_locked_response() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={"code": "AUTH_USER_LOCKED", "message": "账户已锁定", "detail": None},
    )


def _context_unavailable_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "code": "AUTH_CONTEXT_UNAVAILABLE",
            "message": "Authorization context is temporarily unavailable",
            "detail": None,
        },
    )


def _root_not_initialized_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "code": "AUTH_ROOT_NOT_INITIALIZED",
            "message": "Root admin is not initialized; run bootstrap_root",
            "detail": None,
        },
    )


def _is_locked(user: AuthUser) -> bool:
    locked_until = user.locked_until
    if locked_until is None:
        return False
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    return locked_until > datetime.now(timezone.utc)


class _ResolvedContext:
    """中间件在单个 DB 会话内解析出的鉴权上下文。"""

    def __init__(self) -> None:
        self.roles: list[str] = []
        self.permissions: set[str] = set()
        self.is_root: bool = False
        self.token_revoked: bool = False
        self.root_initialized: bool = False
        self.user_disabled: bool = False
        self.user_locked: bool = False


def _public_paths_for(settings: Settings) -> frozenset[str]:
    if settings.vitalspan_env == "development":
        return PUBLIC_PATHS_BASE | PUBLIC_PATHS_DEV
    return PUBLIC_PATHS_BASE


def _is_public_export_route(path: str, request: Request) -> bool:
    if "/export-layout" in path and request.query_params.get("token"):
        return True
    if path == "/api/v1/dashboards/export-query/execute":
        token = request.headers.get("X-Export-Token", "").strip()
        dash_id = request.headers.get("X-Export-Dashboard-Id", "").strip()
        return bool(token and dash_id)
    if path == "/api/v1/dashboards/export-query/dataset/execute":
        token = request.headers.get("X-Export-Token", "").strip()
        dash_id = request.headers.get("X-Export-Dashboard-Id", "").strip()
        return bool(token and dash_id)
    return False


def _is_public_embed_route(path: str, request: Request) -> bool:
    if path == "/api/v1/embed/sdk-params" and request.query_params.get("token"):
        return True
    if path == "/api/v1/embed/chart-view" and request.query_params.get("token"):
        return True
    if path == "/api/v1/embed/dashboard-layout" and request.query_params.get("token"):
        return True
    if path in {"/api/v1/embed/query/execute", "/api/v1/embed/dataset/execute"}:
        # 由 embed handler 校验 X-Embed-Token；勿在中间件层要求 Bearer，否则匿名分享误报 JWT 过期。
        return True
    return False


def _lookup_user(session, user_id: str, username: str) -> AuthUser | None:
    try:
        user_uuid = uuid.UUID(str(user_id))
    except ValueError:
        return user_service.get_user_by_username(session, str(username))
    return user_service.get_user_by_id_or_matching_username(session, user_uuid, str(username))


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings | None = None) -> None:
        super().__init__(app)
        self.settings = settings or get_settings()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if path in _public_paths_for(self.settings) or path.startswith("/docs"):
            return await call_next(request)
        if is_template_assets_path(path, self.settings):
            return await call_next(request)
        if path.startswith("/sample-api"):
            return await call_next(request)
        if _is_public_embed_route(path, request):
            return await call_next(request)
        if _is_public_export_route(path, request):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _unauthorized_response()

        token = auth_header.removeprefix("Bearer ").strip()
        try:
            claims = decode_access_token(token)
            user_id = claims.get("sub")
            username = claims.get("username", "")
            if not user_id:
                return _unauthorized_response()
        except JwtError:
            return _unauthorized_response()

        claimed_version = token_version_from_claims(claims)

        try:
            resolved = self._resolve_context(str(user_id), str(username), claimed_version)
        except (OperationalError, ProgrammingError):
            logger.error(
                "auth_context_unavailable",
                extra={"traceId": trace_id_var.get() or "", "path": path},
            )
            return _context_unavailable_response()

        if not resolved.root_initialized:
            return _root_not_initialized_response()
        if resolved.token_revoked:
            return _token_revoked_response()
        if resolved.user_disabled:
            return _user_disabled_response()
        if resolved.user_locked:
            return _user_locked_response()

        request.state.user = UserContext(
            id=str(user_id),
            username=str(username),
            roles=resolved.roles,
            permissions=resolved.permissions,
            is_root=resolved.is_root,
        )
        return await call_next(request)

    def _resolve_context(self, user_id: str, username: str, claimed_version: int) -> _ResolvedContext:
        resolved = _ResolvedContext()
        session = get_meta_session()
        try:
            user = _lookup_user(session, user_id, username)
            if user is not None:
                if user.token_version != claimed_version:
                    resolved.token_revoked = True
                resolved.roles = user_service.resolve_role_codes_for_user(session, user.id)
                permissions, is_root = resolve_user_permissions(session, user.id)
                if not user.is_active:
                    resolved.user_disabled = True
                elif _is_locked(user):
                    resolved.user_locked = True
                else:
                    resolved.permissions = permissions
                    resolved.is_root = is_root
            resolved.root_initialized = has_enabled_root_user(session)
        finally:
            try:
                session.close()
            except (OperationalError, ProgrammingError):
                pass
        return resolved
