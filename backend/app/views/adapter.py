from __future__ import annotations

import uuid
from typing import Any

from app.views.protocol import VIEW_PROTOCOL_VERSION


def dashboard_layout_to_view(
    *,
    dashboard_id: uuid.UUID,
    name: str,
    layout_json: dict[str, Any],
) -> dict[str, Any]:
    """Map dashboard storage shape to DashboardView protocol document."""
    return {
        "name": name,
        "protocolVersion": VIEW_PROTOCOL_VERSION,
        "dashboardId": str(dashboard_id),
        "layout": layout_json,
    }
