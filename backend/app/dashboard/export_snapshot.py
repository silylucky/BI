"""Export-layout read + query proxy for headless snapshot pages."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard import service as dash_service
from app.dashboard.export_token import require_export_token
from app.dashboard.surface_kind import layout_to_dict, read_surface_kind_from_layout
from app.query import service as query_service
from app.query.dataset.execute_config import execute_dataset_from_config
from app.query.dataset.schemas import DatasetExecuteRequest
from app.query.schemas import ExecuteRequest, QueryError


def _export_actor() -> UserContext:
    """Token 已校验通过后的合成主体：绕过 datasource/config ACL，权限边界由 export token 承担。"""
    return UserContext(
        id="export-renderer",
        username="export-renderer",
        roles=["admin"],
        permissions={"query:execute", "datasource:read", "dashboard:read"},
        is_root=True,
    )


def get_export_layout(db: Session, dashboard_id: UUID, token: str) -> dict:
    require_export_token(token, dashboard_id)
    row = dash_service.get_dashboard(db, dashboard_id)
    layout_dict = layout_to_dict(row.layout_json)
    surface = read_surface_kind_from_layout(layout_dict)
    return {
        "id": str(row.id),
        "name": row.name,
        "description": row.description,
        "layoutJson": layout_dict,
        "surfaceKind": surface,
    }


def execute_export_query(
    db: Session,
    dashboard_id: UUID,
    token: str,
    payload: ExecuteRequest,
) -> dict:
    require_export_token(token, dashboard_id)
    try:
        return query_service.execute_query(db, _export_actor(), payload).model_dump(by_alias=True)
    except QueryError as exc:
        raise dash_service.DashboardError(exc.code, exc.message, exc.status) from exc


def execute_export_dataset_query(
    db: Session,
    dashboard_id: UUID,
    token: str,
    payload: DatasetExecuteRequest,
) -> dict:
    require_export_token(token, dashboard_id)
    try:
        return execute_dataset_from_config(db, _export_actor(), payload).model_dump(by_alias=True)
    except QueryError as exc:
        raise dash_service.DashboardError(exc.code, exc.message, exc.status) from exc
