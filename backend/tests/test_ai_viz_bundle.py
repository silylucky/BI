from app.ai_viz.errors import AiVizError
from app.ai_viz.models import (
    INLINE_D3_MIN_BYTES,
    MAX_BUNDLE_BYTES,
    validate_bundle_files,
    validate_manifest,
)
from app.ai_viz.style_compliance import (
    collect_bundle_style_compliance_warnings,
    resolve_style_compliance_tier,
)

_MIN_MANIFEST = {
    "fieldSlots": {"dimensions": {"min": 1}, "metrics": {"min": 1}},
    "styleSchema": {"properties": {"accentColor": {"type": "string"}}},
}


def test_validate_manifest_accepts_html_and_d3_runtime() -> None:
    validate_manifest({**_MIN_MANIFEST, "runtime": "html"})
    validate_manifest({**_MIN_MANIFEST, "runtime": "d3"})
    validate_manifest({**_MIN_MANIFEST, "rendererHint": "d3"})


def test_validate_manifest_rejects_unknown_runtime() -> None:
    try:
        validate_manifest({**_MIN_MANIFEST, "runtime": "echarts"})
    except AiVizError as exc:
        assert exc.code == "AIVIZ_INVALID_MANIFEST"
        return
    raise AssertionError("expected AIVIZ_INVALID_MANIFEST")


def test_validate_manifest_allows_detail_table_metrics_min_zero() -> None:
    validate_manifest(
        {
            **_MIN_MANIFEST,
            "runtime": "html",
            "fieldSlots": {
                "dimensions": {"min": 1, "max": 6},
                "metrics": {"min": 0, "max": 0},
            },
        }
    )


def test_bundle_rejects_inline_d3_library() -> None:
    blob = ("x" * INLINE_D3_MIN_BYTES) + "d3.version"
    try:
        validate_bundle_files({"index.html": blob}, "index.html")
    except AiVizError as exc:
        assert exc.code == "AIVIZ_INLINE_D3_FORBIDDEN"
        return
    raise AssertionError("expected AIVIZ_INLINE_D3_FORBIDDEN")


def test_bundle_rejects_d3_without_mount() -> None:
    html = "<!DOCTYPE html><html><body><script>host.vsCv.onPayload(function(){});</script></body></html>"
    manifest = {**_MIN_MANIFEST, "runtime": "d3"}
    try:
        validate_bundle_files({"index.html": html}, "index.html", manifest)
    except AiVizError as exc:
        assert exc.code == "AIVIZ_MOUNT_REQUIRED"
        return
    raise AssertionError("expected AIVIZ_MOUNT_REQUIRED")


def test_bundle_accepts_d3_with_mount() -> None:
    html = "<!DOCTYPE html><html><body><script>host.vsCv.mount(function(){});</script></body></html>"
    manifest = {**_MIN_MANIFEST, "runtime": "d3"}
    validate_bundle_files({"index.html": html}, "index.html", manifest)


def test_bundle_rejects_forbidden_root_id() -> None:
    html = '<!DOCTYPE html><html><body><div id="root"></div></body></html>'
    try:
        validate_bundle_files({"index.html": html}, "index.html", _MIN_MANIFEST)
    except AiVizError as exc:
        assert exc.code == "AIVIZ_FORBIDDEN_HOST_ID"
        return
    raise AssertionError("expected AIVIZ_FORBIDDEN_HOST_ID")


def test_official_d3_example_passes_mount_lint() -> None:
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    doc = json.loads((root / "docs/api/vs-ai-spec/examples/custom-viz-d3-bundle.json").read_text(encoding="utf-8"))
    html = doc["files"]["index.html"]
    manifest = doc["manifest"]
    validate_bundle_files({"index.html": html}, "index.html", manifest)


def test_official_ranking_bar_medal_passes_lint() -> None:
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    doc = json.loads(
        (root / "docs/api/vs-ai-spec/examples/custom-viz-ranking-bar-medal.json").read_text(encoding="utf-8")
    )
    html = doc["files"]["index.html"]
    manifest = doc["manifest"]
    validate_manifest(manifest)
    validate_bundle_files({"index.html": html}, "index.html", manifest)
    assert "vsCv.mount" in html


def test_bundle_size_limit_is_2mb() -> None:
    assert MAX_BUNDLE_BYTES == 2 * 1024 * 1024
    modest = "a" * 1024
    validate_bundle_files({"index.html": modest}, "index.html")
    validate_bundle_files({"index.html": "a" * MAX_BUNDLE_BYTES}, "index.html")
    try:
        validate_bundle_files({"index.html": "a" * (MAX_BUNDLE_BYTES + 1)}, "index.html")
    except AiVizError as exc:
        assert exc.code == "AIVIZ_BUNDLE_TOO_LARGE"
        assert exc.status == 413
        return
    raise AssertionError("expected AIVIZ_BUNDLE_TOO_LARGE")


def test_style_compliance_warns_html_without_mount_or_style() -> None:
    html = "<!DOCTYPE html><html><body><div>static</div></body></html>"
    manifest = {**_MIN_MANIFEST, "runtime": "html"}
    warnings = collect_bundle_style_compliance_warnings({"index.html": html}, "index.html", manifest)
    codes = {item.code for item in warnings}
    assert "AIVIZ_WARN_MOUNT_RECOMMENDED" in codes
    assert "AIVIZ_WARN_STYLE_COMPLIANCE" in codes


def test_style_compliance_warns_detail_table_with_required_metrics() -> None:
    manifest = {
        **_MIN_MANIFEST,
        "runtime": "html",
        "fieldSlots": {
            "dimensions": {"min": 1, "max": 6, "label": "明细列"},
            "metrics": {"min": 1, "max": 1, "label": "数值列"},
        },
    }
    warnings = collect_bundle_style_compliance_warnings(
        {"index.html": "<html><script>host.vsCv.mount(function(){});</script></html>"},
        "index.html",
        manifest,
    )
    codes = {item.code for item in warnings}
    assert "AIVIZ_WARN_DETAIL_TABLE_METRICS" in codes


def test_style_compliance_accepts_payload_style_only() -> None:
    html = (
        "<!DOCTYPE html><html><body><script>"
        "host.vsCv.mount(function(p){var st=(p&&p.style)||{};"
        "if(st.labelShow===false)return;"
        "});"
        "</script></body></html>"
    )
    manifest = {**_MIN_MANIFEST, "runtime": "html"}
    warnings = collect_bundle_style_compliance_warnings({"index.html": html}, "index.html", manifest)
    assert warnings == []


def test_style_compliance_warns_dom_lookup_antipatterns() -> None:
    host_bad = """<!DOCTYPE html><html><body><script>(function(){
      var host=document.currentScript.parentElement;
      function q(id){return (host||document).getElementById(id)}
      host.vsCv.mount(function(p){ var st=(p&&p.style)||{}; q('x'); });
    })();</script></body></html>"""
    doc_bad = """<!DOCTYPE html><html><body><script>(function(){
      var host=document.currentScript.parentElement;
      host.vsCv.mount(function(p){ var st=(p&&p.style)||{}; document.getElementById('vs-cv-root'); });
    })();</script></body></html>"""
    manifest = {**_MIN_MANIFEST, "runtime": "html"}
    host_warnings = collect_bundle_style_compliance_warnings(
        {"index.html": host_bad},
        "index.html",
        manifest,
    )
    doc_warnings = collect_bundle_style_compliance_warnings(
        {"index.html": doc_bad},
        "index.html",
        manifest,
    )
    assert "AIVIZ_WARN_DOM_HOST_LOOKUP" in {item.code for item in host_warnings}
    assert "AIVIZ_WARN_DOM_DOCUMENT_LOOKUP" in {item.code for item in doc_warnings}


def test_official_custom_viz_examples_have_no_style_warnings() -> None:
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    examples_dir = root / "docs/api/vs-ai-spec/examples"
    paths = sorted(examples_dir.glob("custom-viz-*.json"))
    assert paths, "expected at least one custom-viz example"
    for path in paths:
        doc = json.loads(path.read_text(encoding="utf-8"))
        manifest = doc["manifest"]
        entry = manifest.get("entry") or "index.html"
        warnings = collect_bundle_style_compliance_warnings(doc["files"], entry, manifest)
        assert warnings == [], f"{path.name}: {[item.code for item in warnings]}"


def test_style_compliance_warns_platform_duplicate_style_keys() -> None:
    manifest = {
        **_MIN_MANIFEST,
        "runtime": "html",
        "styleSchema": {
            "type": "object",
            "properties": {
                "maxItems": {"type": "number", "title": "最多显示条数"},
            },
        },
        "defaultStyle": {"maxItems": 10},
    }
    html = "<!DOCTYPE html><html><body><script>host.vsCv.mount(function(p){var st=(p&&p.style)||{}})</script></body></html>"
    warnings = collect_bundle_style_compliance_warnings({"index.html": html}, "index.html", manifest)
    codes = {item.code for item in warnings}
    assert "AIVIZ_WARN_PLATFORM_DUPLICATE_STYLE" in codes


def test_style_compliance_warns_when_style_read_without_platform_keys() -> None:
    manifest = {**_MIN_MANIFEST, "runtime": "html"}
    html = (
        "<!DOCTYPE html><html><body><script>"
        "host.vsCv.mount(function(p){var st=(p&&p.style)||{};"
        "var c=st.accentColor||'#111';})"
        "</script></body></html>"
    )
    warnings = collect_bundle_style_compliance_warnings({"index.html": html}, "index.html", manifest)
    codes = {item.code for item in warnings}
    assert "AIVIZ_WARN_PLATFORM_STYLE_KEYS" in codes


def test_style_compliance_accepts_css_palette_vars_without_platform_keys() -> None:
    manifest = {**_MIN_MANIFEST, "runtime": "html"}
    html = (
        "<!DOCTYPE html><html><head><style>"
        ".fill{background:var(--vs-palette-0,#3b82f6)}"
        "</style></head><body><div class='fill'></div>"
        "<script>host.vsCv.mount(function(p){})</script></body></html>"
    )
    warnings = collect_bundle_style_compliance_warnings({"index.html": html}, "index.html", manifest)
    codes = {item.code for item in warnings}
    assert "AIVIZ_WARN_PLATFORM_STYLE_KEYS" not in codes


def test_valid_style_hooks_suppresses_style_compliance_warning() -> None:
    html = (
        "<!DOCTYPE html><html><body><div class='fill'></div>"
        "<script>host.vsCv.mount(function(){})</script></body></html>"
    )
    manifest = {
        **_MIN_MANIFEST,
        "runtime": "html",
        "styleSchema": {
            "type": "object",
            "properties": {
                "accentColor": {"type": "string", "format": "color"},
            },
        },
        "styleHooks": {
            "accentColor": {"selectors": [".fill"], "property": "background"},
        },
    }
    warnings = collect_bundle_style_compliance_warnings({"index.html": html}, "index.html", manifest)
    codes = {item.code for item in warnings}
    assert "AIVIZ_WARN_STYLE_COMPLIANCE" not in codes
    assert resolve_style_compliance_tier(warnings, manifest) == "full"


def test_unknown_style_hook_key_warns() -> None:
    manifest = {
        **_MIN_MANIFEST,
        "runtime": "html",
        "styleHooks": {
            "unknownKey": {"selectors": [".x"]},
        },
    }
    warnings = collect_bundle_style_compliance_warnings(
        {"index.html": "<html></html>"},
        "index.html",
        manifest,
    )
    codes = {item.code for item in warnings}
    assert "AIVIZ_WARN_STYLE_HOOK_UNKNOWN_KEY" in codes
    assert resolve_style_compliance_tier(warnings, manifest) == "visual-only"
