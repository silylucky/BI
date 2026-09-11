"""Short-lived tokens for headless dashboard export (G5 visual PDF)."""

from __future__ import annotations

from uuid import UUID

from app.dashboard import service as dash_service
from app.dashboard.export_persistence import (
    EXPORT_TOKEN_TTL_SECONDS,
    issue_export_token as _issue_export_token,
    reset_export_persistence_for_tests,
    validate_export_token,
)

__all__ = [
    "EXPORT_TOKEN_TTL_SECONDS",
    "ExportTokenError",
    "issue_export_token",
    "require_export_token",
    "resolve_export_actor_id",
    "reset_export_tokens_for_tests",
]


class ExportTokenError(dash_service.DashboardError):
    pass


def issue_export_token(dashboard_id: UUID) -> str:
    return _issue_export_token(dashboard_id)


def require_export_token(token: str, dashboard_id: UUID) -> None:
    code = validate_export_token(token, dashboard_id)
    if code == "DASH_EXPORT_TOKEN_INVALID":
        raise ExportTokenError("DASH_EXPORT_TOKEN_INVALID", "Export token invalid", 403)
    if code == "DASH_EXPORT_TOKEN_MISMATCH":
        raise ExportTokenError("DASH_EXPORT_TOKEN_MISMATCH", "Export token mismatch", 403)
    if code == "DASH_EXPORT_TOKEN_EXPIRED":
        raise ExportTokenError("DASH_EXPORT_TOKEN_EXPIRED", "Export token expired", 403)


def resolve_export_actor_id() -> str:
    return "export-renderer"


def reset_export_tokens_for_tests() -> None:
    reset_export_persistence_for_tests()
