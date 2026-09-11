from __future__ import annotations

from app.viz.components.reference_counts import _collect_linked_component_ids


def test_collect_linked_component_ids_skips_detached() -> None:
    layout = {
        "version": 1,
        "widgets": [
            {"id": "w1", "componentRef": {"componentId": "c1"}},
            {"id": "w2", "componentRef": {"componentId": "c2", "detached": True}},
            {"id": "w3", "type": "text"},
        ],
    }
    assert _collect_linked_component_ids(layout) == ["c1"]


def test_iter_linked_widgets_returns_widget_meta() -> None:
    from app.viz.components.reference_counts import _iter_linked_widgets

    layout = {
        "widgets": [
            {"id": "w1", "title": "销售图", "componentRef": {"componentId": "c1"}},
            {"id": "w2", "componentRef": {"componentId": "c1", "detached": True}},
        ],
    }
    assert _iter_linked_widgets(layout, "c1") == [("w1", "销售图")]
