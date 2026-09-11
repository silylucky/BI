"""Builtin chart misroute lint — block customViz fake treemap/pie etc."""

from __future__ import annotations

from app.ai_viz.style_compliance import collect_bundle_style_compliance_warnings

_MIN_MANIFEST = {
    "id": "biz-treemap-v1",
    "displayName": "商务矩形树图",
    "fieldSlots": {"dimensions": {"min": 1}, "metrics": {"min": 1}},
    "runtime": "html",
}


def _warn_codes(entry_html: str, *, manifest: dict | None = None) -> set[str]:
    m = manifest or _MIN_MANIFEST
    warnings = collect_bundle_style_compliance_warnings(
        {"index.html": entry_html},
        "index.html",
        m,
    )
    return {item.code for item in warnings}


def test_treemap_display_name_triggers_misroute() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){var st=(p&&p.style)||{};"
        "p.rows.forEach(function(r){var d=document.createElement('div');"
        "d.textContent=r[0]+' '+r[1];});});</script>"
    )
    codes = _warn_codes(html)
    assert "AIVIZ_WARN_BUILTIN_MISROUTE" in codes


def test_generic_kpi_name_no_misroute() -> None:
    manifest = {**_MIN_MANIFEST, "id": "hex-kpi-grid", "displayName": "六边形 KPI"}
    html = (
        "<script>host.vsCv.mount(function(p){var st=(p&&p.style)||{};"
        "if(st.labelShow){};});</script>"
    )
    assert "AIVIZ_WARN_BUILTIN_MISROUTE" not in _warn_codes(html, manifest=manifest)
