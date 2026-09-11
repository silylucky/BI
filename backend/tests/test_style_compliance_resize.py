"""Resize lifecycle lint for customViz bundles."""

from __future__ import annotations

from app.ai_viz.style_compliance import collect_bundle_style_compliance_warnings

_MIN_MANIFEST = {
    "id": "resize-test-v1",
    "displayName": "Resize Test",
    "fieldSlots": {"dimensions": {"min": 1}, "metrics": {"min": 1}},
}


def _warn_codes(entry_html: str, *, runtime: str = "d3") -> set[str]:
    manifest = {**_MIN_MANIFEST, "runtime": runtime}
    warnings = collect_bundle_style_compliance_warnings(
        {"index.html": entry_html},
        "index.html",
        manifest,
    )
    return {item.code for item in warnings}


def test_d3_without_layout_reads_layout_warning() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){"
        "var w=svgEl.clientWidth||400;var h=svgEl.clientHeight||300;"
        "svg.attr('width',w).attr('height',h);"
        "svg.selectAll('*').remove();"
        "});</script>"
    )
    assert "AIVIZ_WARN_RESIZE_LAYOUT" in _warn_codes(html)


def test_d3_with_layout_ok() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){"
        "var layout=(p&&p.layout)||{};"
        "var w=layout.width||svgEl.clientWidth||400;"
        "svg.attr('width',w);svg.interrupt();svg.selectAll('*').remove();"
        "});</script>"
    )
    assert "AIVIZ_WARN_RESIZE_LAYOUT" not in _warn_codes(html)


def test_d3_transition_without_interrupt_warns() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){"
        "var layout=(p&&p.layout)||{};"
        "clipPath.transition().duration(500);"
        "svg.selectAll('*').remove();"
        "});</script>"
    )
    codes = _warn_codes(html)
    assert "AIVIZ_WARN_D3_INTERRUPT" in codes


def test_d3_transition_with_interrupt_ok() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){"
        "var layout=(p&&p.layout)||{};"
        "svg.interrupt();clipPath.transition().duration(500);"
        "svg.selectAll('*').remove();"
        "});</script>"
    )
    assert "AIVIZ_WARN_D3_INTERRUPT" not in _warn_codes(html)


def test_d3_without_clear_warns() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){"
        "var layout=(p&&p.layout)||{};"
        "svg.interrupt();"
        "});</script>"
    )
    assert "AIVIZ_WARN_D3_CLEAR" in _warn_codes(html)
