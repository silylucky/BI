"""DashboardView protocol layer (VIEW-001)."""

from app.views.schemas import DashboardView, ViewError
from app.views.validate import validate_dashboard_view, validate_layout_dict

__all__ = [
    "DashboardView",
    "ViewError",
    "validate_dashboard_view",
    "validate_layout_dict",
]
