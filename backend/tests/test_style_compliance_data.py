"""Data contract lint — encoding + sorted domain for cartesian customViz."""

from __future__ import annotations

from app.ai_viz.style_compliance import collect_bundle_style_compliance_warnings

_MIN_MANIFEST = {
    "id": "my-trend",
    "displayName": "炫丽趋势",
    "fieldSlots": {"dimensions": {"min": 1}, "metrics": {"min": 1}},
    "runtime": "d3",
}


def _codes(html: str) -> set[str]:
    warnings = collect_bundle_style_compliance_warnings(
        {"index.html": html},
        "index.html",
        _MIN_MANIFEST,
    )
    return {item.code for item in warnings}


def test_cartesian_without_encoding_warns() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){var d3=host.vsCv.d3;"
        "var data=p.rows.map(function(r){return {x:r[0],y:r[1]};});"
        "var xScale=d3.scalePoint().domain(data.map(function(d){return d.x;}));"
        "var lineGen=d3.line().x(function(d){return xScale(d.x);});});</script>"
    )
    codes = _codes(html)
    assert "AIVIZ_WARN_DATA_ENCODING" in codes
    assert "AIVIZ_WARN_DATA_DOMAIN_SORT" in codes


def test_rows_to_series_passes_data_lint() -> None:
    html = (
        "<script>host.vsCv.mount(function(p){var d3=host.vsCv.d3;var st=(p&&p.style)||{};"
        "function rowsToSeries(p){return [];} "
        "var data=rowsToSeries(p);"
        "var xScale=d3.scalePoint().domain(data.map(function(d){return d.category;}));"
        "var lineGen=d3.line().x(function(d){return xScale(d.category);});});</script>"
    )
    codes = _codes(html)
    assert "AIVIZ_WARN_DATA_ENCODING" not in codes
    assert "AIVIZ_WARN_DATA_DOMAIN_SORT" not in codes


def test_generic_blank_no_cartesian_no_data_warn() -> None:
    path = (
        __import__("pathlib").Path(__file__).resolve().parents[2]
        / "docs/api/vs-ai-spec/examples/generic-blank-d3.json"
    )
    import json

    bundle = json.loads(path.read_text(encoding="utf-8"))
    warnings = collect_bundle_style_compliance_warnings(
        bundle["files"],
        bundle["manifest"]["entry"],
        bundle["manifest"],
    )
    data_codes = {w.code for w in warnings if w.code.startswith("AIVIZ_WARN_DATA_")}
    assert data_codes == set()
