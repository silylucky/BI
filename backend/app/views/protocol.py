from __future__ import annotations

from typing import Any

from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view

VIEW_PROTOCOL_VERSION = 1


def assert_protocol_version(data: dict[str, Any]) -> None:
    raw = data.get("protocolVersion")
    if raw is None:
        return
    if int(raw) != VIEW_PROTOCOL_VERSION:
        raise ViewError(
            "VIEW_PROTOCOL_UNSUPPORTED",
            f"Unsupported protocolVersion: {raw}",
            422,
            [{"field": "protocolVersion", "message": f"Expected {VIEW_PROTOCOL_VERSION}"}],
        )


def round_trip_view_document(data: dict[str, Any]) -> dict[str, Any]:
    view = validate_dashboard_view(data)
    dumped = view.model_dump(by_alias=True, mode="json")
    validate_dashboard_view(dumped)
    return dumped


def export_view_json_schema() -> dict[str, Any]:
    from app.views.schemas import DashboardView

    return DashboardView.model_json_schema()
