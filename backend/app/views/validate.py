from __future__ import annotations

import uuid
from typing import Any

from pydantic import ValidationError

from app.dashboard.schemas import DashboardLayout
from app.views.schemas import DashboardView, ViewError


def _widget_id_set(layout: DashboardLayout) -> set[str]:
    return {str(w.id) for w in layout.widgets}


def _check_chart_refs(layout: DashboardLayout, raw_widgets: list[dict[str, Any]]) -> None:
    ids = _widget_id_set(layout)
    for widget, raw in zip(layout.widgets, raw_widgets, strict=False):
        chart_ref = raw.get("chartRef")
        if chart_ref is not None and str(chart_ref) not in ids:
            raise ViewError(
                "VIEW_UNKNOWN_CHART_REF",
                "Unknown chartRef",
                422,
                [{"field": "chartRef", "message": "Unknown chartRef"}],
            )
        if widget.chart_config and widget.chart_config.chart_id is not None:
            cid = str(widget.chart_config.chart_id)
            wid = str(widget.id)
            if cid != wid and cid not in ids:
                raise ViewError(
                    "VIEW_UNKNOWN_CHART_REF",
                    "chartConfig.chartId references unknown widget",
                    422,
                    [{"field": "chartConfig.chartId", "message": "Unknown chart reference"}],
                )


def _map_validation_error(exc: ValidationError) -> ViewError:
    from app.schemas.chart_view import _map_validation_error as map_chart_error

    for err in exc.errors():
        loc = err.get("loc", ())
        if any(str(part) in ("chartConfig", "chart_config") for part in loc):
            chart_exc = map_chart_error(exc)
            return ViewError(chart_exc.code, chart_exc.message, chart_exc.status, chart_exc.fields)

    fields = [
        {"field": ".".join(str(p) for p in err.get("loc", ())), "message": str(err.get("msg", ""))}
        for err in exc.errors()
    ]
    bounds_fields = (
        "colSpan", "rowSpan", "gridX", "gridY", "col_span", "row_span",
        "grid_x", "grid_y", "x", "y", "width", "height", "canvas", "widgets",
    )
    cross_bound_messages = (
        "gridX + colSpan",
        "x + width",
        "y + height",
        "canvas width",
        "canvas height",
    )
    if any(
        any(f["field"] == token or f["field"].endswith(f".{token}") for token in bounds_fields)
        or any(token in f["message"] for token in cross_bound_messages)
        for f in fields
    ):
        return ViewError("VIEW_LAYOUT_BOUNDS", "Layout bounds violation", 422, fields)
    return ViewError("VIEW_INVALID_LAYOUT", "Invalid dashboard view", 422, fields)


def _check_chart_ref_cycle(raw_widgets: list[dict[str, Any]]) -> None:
    by_id = {str(w["id"]): w for w in raw_widgets if w.get("id")}
    for i, widget in enumerate(raw_widgets):
        visited: set[str] = set()
        current: str | None = str(widget.get("id", ""))
        while current:
            if current in visited:
                raise ViewError(
                    "VIEW_CHART_REF_CYCLE",
                    "Circular chart reference",
                    422,
                    [{"field": f"widgets[{i}].chartRef", "message": "Circular chart reference"}],
                )
            visited.add(current)
            node = by_id.get(current)
            if node is None:
                break
            chart_ref = node.get("chartRef")
            if chart_ref is not None:
                current = str(chart_ref)
                continue
            cfg = node.get("chartConfig") or {}
            cid = cfg.get("chartId")
            wid = node.get("id")
            if cid is not None and str(cid) != str(wid):
                current = str(cid)
            else:
                break


def _check_default_view_id(view_id: uuid.UUID | None, default_view_id: uuid.UUID | None) -> None:
    if default_view_id is None:
        return
    if view_id is not None and default_view_id == view_id:
        raise ViewError(
            "VIEW_DEFAULT_SELF_REF",
            "defaultViewId cannot equal id",
            422,
            [{"field": "defaultViewId", "message": "Cannot reference self"}],
        )


def validate_layout_dict(layout: dict[str, Any]) -> dict[str, Any]:
    from app.dashboard.service import _normalize_widget_orders, _validate_layout_business

    parsed = DashboardLayout.model_validate(layout)
    _validate_layout_business(parsed)
    parsed.widgets = _normalize_widget_orders(list(parsed.widgets))
    return parsed.model_dump(by_alias=True, mode="json")


def validate_dashboard_view(data: dict[str, Any]) -> DashboardView:
    from app.schemas.chart_view import ChartViewError
    from app.views.protocol import assert_protocol_version

    assert_protocol_version(data)
    try:
        view = DashboardView.model_validate(data)
    except ValidationError as exc:
        raise _map_validation_error(exc) from exc

    _check_default_view_id(view.id, view.default_view_id)

    raw_widgets = data.get("layout", {}).get("widgets", [])
    raw_widgets_list = raw_widgets if isinstance(raw_widgets, list) else []
    _check_chart_refs(view.layout, raw_widgets_list)
    _check_chart_ref_cycle(raw_widgets_list)

    try:
        from app.schemas.chart_view import validate_chart_view_config

        for widget in view.layout.widgets:
            if widget.type == "chart" and widget.chart_config is not None:
                validate_chart_view_config(
                    widget.chart_config.model_dump(by_alias=True, mode="json")
                )
        normalized_layout = validate_layout_dict(view.layout.model_dump(by_alias=True, mode="json"))
    except ChartViewError as exc:
        raise ViewError(exc.code, exc.message, exc.status, exc.fields) from exc
    except Exception as exc:
        from app.dashboard.service import DashboardError

        if isinstance(exc, DashboardError):
            raise ViewError(exc.code, exc.message, exc.status) from exc
        raise ViewError("VIEW_INVALID_LAYOUT", "Invalid layout", 422) from exc

    parsed_layout = DashboardLayout.model_validate(normalized_layout)
    return view.model_copy(update={"layout": parsed_layout})
