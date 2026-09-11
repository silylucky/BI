from __future__ import annotations

import copy
import uuid
from typing import Any


def _new_id() -> str:
    return str(uuid.uuid4())


def regenerate_widget_ids(layout: dict[str, Any]) -> dict[str, Any]:
    """Clone layout and assign fresh widget ids; remap tabs childWidgetIds and chartId."""
    cloned = copy.deepcopy(layout)
    widgets = cloned.get("widgets")
    if not isinstance(widgets, list):
        return cloned

    id_map: dict[str, str] = {}
    for widget in widgets:
        if not isinstance(widget, dict):
            continue
        old_id = str(widget.get("id", ""))
        new_id = _new_id()
        if old_id:
            id_map[old_id] = new_id
        widget["id"] = new_id

    for widget in widgets:
        if not isinstance(widget, dict):
            continue
        chart_cfg = widget.get("chartConfig")
        if isinstance(chart_cfg, dict):
            chart_cfg["chartId"] = widget["id"]
        tabs_cfg = widget.get("tabsConfig")
        if isinstance(tabs_cfg, dict):
            panes = tabs_cfg.get("panes")
            if isinstance(panes, list):
                for pane in panes:
                    if not isinstance(pane, dict):
                        continue
                    child_ids = pane.get("childWidgetIds")
                    if isinstance(child_ids, list):
                        pane["childWidgetIds"] = [
                            id_map.get(str(cid), str(cid)) for cid in child_ids
                        ]
        filter_cfg = widget.get("filterConfig")
        if isinstance(filter_cfg, dict) and "filterId" in filter_cfg:
            filter_cfg["filterId"] = _new_id()

    cloned["widgets"] = widgets
    return cloned


def sanitize_layout_for_template(layout: dict[str, Any]) -> dict[str, Any]:
    """Strip runtime-only fields; keep structure and non-secret binding refs."""
    cloned = copy.deepcopy(layout)
    widgets = cloned.get("widgets")
    if not isinstance(widgets, list):
        return cloned
    for widget in widgets:
        if not isinstance(widget, dict):
            continue
        chart_cfg = widget.get("chartConfig")
        if isinstance(chart_cfg, dict):
            chart_cfg.pop("lastExecuteAt", None)
            chart_cfg.pop("cachedRows", None)
    return cloned
