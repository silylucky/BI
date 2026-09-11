"""Linked viz-component widgets may omit inline chartConfig on save (ADR-14)."""
from __future__ import annotations

import uuid

import pytest

from app.dashboard.schemas import DashboardLayout, LayoutWidget
from app.dashboard.service import DashboardError, validate_layout


def _linked_chart_widget() -> dict:
    wid = str(uuid.uuid4())
    return {
        "id": wid,
        "type": "chart",
        "title": "区域地图",
        "order": 0,
        "componentRef": {"componentId": str(uuid.uuid4())},
    }


def test_validate_layout_allows_linked_chart_without_chart_config() -> None:
    layout = {
        "version": 1,
        "widgets": [_linked_chart_widget()],
    }
    validated = validate_layout(layout)
    widget = validated["widgets"][0]
    assert widget.get("componentRef") is not None
    assert widget.get("chartConfig") is None


def test_validate_layout_rejects_unlinked_chart_without_chart_config() -> None:
    wid = str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [{"id": wid, "type": "chart", "title": "柱状图", "order": 0}],
    }
    with pytest.raises(DashboardError) as exc:
        validate_layout(layout)
    assert exc.value.code == "DASH_MISSING_CHART_CONFIG"


def test_validate_layout_requires_chart_config_when_detached() -> None:
    wid = str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": wid,
                "type": "chart",
                "title": "柱状图",
                "order": 0,
                "componentRef": {"componentId": str(uuid.uuid4()), "detached": True},
            },
        ],
    }
    with pytest.raises(DashboardError) as exc:
        validate_layout(layout)
    assert exc.value.code == "DASH_MISSING_CHART_CONFIG"
