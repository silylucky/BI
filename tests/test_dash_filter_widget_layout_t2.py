from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.dashboard.global_filters.schemas import FilterBinding
from app.dashboard.schemas import (
    DashboardLayout,
    FilterWidgetConfig,
    LayoutWidget,
    TextWidgetConfig,
)


def test_layout_widget_defaults_missing_type_to_chart():
    wid = uuid.uuid4()
    raw = {
        "id": str(wid),
        "title": "旧图",
        "colSpan": 6,
        "rowSpan": 2,
        "order": 0,
        "chartConfig": {
            "chartType": "bar",
            "dataSourceId": str(uuid.uuid4()),
            "mode": "dataset",
            "datasetId": "demo-orders",
            "configId": str(uuid.uuid4()),
            "dimensions": [{"field": "x"}],
            "metrics": [{"field": "y"}],
        },
    }
    widget = LayoutWidget.model_validate(raw)
    assert widget.type == "chart"
    assert widget.chart_config is not None


def test_filter_widget_round_trip():
    wid = uuid.uuid4()
    layout = DashboardLayout.model_validate(
        {
            "version": 1,
            "widgets": [
                {
                    "id": str(wid),
                    "type": "filter",
                    "title": "区域",
                    "colSpan": 4,
                    "rowSpan": 2,
                    "order": 0,
                    "filterConfig": {
                        "filterId": str(wid),
                        "dimensionRef": "region",
                        "controlType": "select",
                        "options": [{"label": "华东", "value": "east"}],
                        "parameterKey": "region",
                    },
                }
            ],
            "globalFilters": [],
        }
    )
    dumped = layout.model_dump(by_alias=True, mode="json")
    again = DashboardLayout.model_validate(dumped)
    assert again.widgets[0].type == "filter"
    assert again.widgets[0].filter_config is not None
    assert again.widgets[0].filter_config.control_type == "select"
    assert again.widgets[0].filter_config.options[0].value == "east"


def test_filter_binding_defaults_control_type_text():
    binding = FilterBinding.model_validate(
        {"filterId": "f1", "dimensionRef": "region_code", "defaultValue": "all"}
    )
    assert binding.control_type == "text"


def test_text_and_media_widget_round_trip():
    wid = uuid.uuid4()
    layout = DashboardLayout.model_validate(
        {
            "version": 1,
            "widgets": [
                {
                    "id": str(wid),
                    "type": "text",
                    "title": "说明",
                    "colSpan": 6,
                    "rowSpan": 2,
                    "order": 0,
                    "textConfig": {"content": "Hello", "variant": "plain"},
                }
            ],
            "globalFilters": [],
            "styleConfig": {"widgetGap": 12},
        }
    )
    dumped = layout.model_dump(by_alias=True, mode="json")
    again = DashboardLayout.model_validate(dumped)
    assert again.widgets[0].type == "text"
    assert again.widgets[0].text_config is not None
    assert again.widgets[0].text_config.content == "Hello"
    assert again.style_config is not None
    assert again.style_config.widget_gap == 12


def test_tabs_widget_round_trip():
    tabs_id = uuid.uuid4()
    pane_id = str(uuid.uuid4())
    layout = DashboardLayout.model_validate(
        {
            "version": 1,
            "widgets": [
                {
                    "id": str(tabs_id),
                    "type": "tabs",
                    "title": "Tabs",
                    "colSpan": 12,
                    "rowSpan": 4,
                    "order": 0,
                    "tabsConfig": {
                        "tabsId": str(tabs_id),
                        "activePaneId": pane_id,
                        "panes": [{"id": pane_id, "title": "A", "childWidgetIds": []}],
                    },
                }
            ],
            "globalFilters": [],
        }
    )
    assert layout.widgets[0].tabs_config is not None
    assert layout.widgets[0].tabs_config.active_pane_id == pane_id

    cfg = FilterWidgetConfig.model_validate(
        {
            "filterId": "f1",
            "dimensionRef": "dt",
            "controlType": "date",
            "defaultValue": "2026-07-10",
        }
    )
    assert cfg.control_type == "date"


def test_text_widget_html_round_trip():
    wid = uuid.uuid4()
    layout = DashboardLayout.model_validate(
        {
            "version": 1,
            "widgets": [
                {
                    "id": str(wid),
                    "type": "text",
                    "title": "说明",
                    "colSpan": 6,
                    "rowSpan": 2,
                    "order": 0,
                    "textConfig": {
                        "content": "<p><strong>重要</strong></p>",
                        "variant": "html",
                    },
                }
            ],
            "globalFilters": [],
        }
    )
    dumped = layout.model_dump(by_alias=True, mode="json")
    assert dumped["widgets"][0]["textConfig"]["variant"] == "html"
    assert DashboardLayout.model_validate(dumped).widgets[0].text_config.content == (
        "<p><strong>重要</strong></p>"
    )


def test_text_widget_rejects_unknown_variant():
    with pytest.raises(ValidationError):
        TextWidgetConfig.model_validate({"content": "x", "variant": "wysiwyg"})
