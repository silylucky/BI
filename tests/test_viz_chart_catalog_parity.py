"""VIZ chart type catalog parity — FE metadata ↔ backend registry."""

from __future__ import annotations

from app.viz.builtin import ALL_BUILTIN_SPECS, register_builtin_chart_types
from app.viz.registry import export_chart_type_catalog

EXPECTED_CHART_TYPE_COUNT = 50


def test_catalog_count_and_types():
    register_builtin_chart_types()
    catalog = export_chart_type_catalog()
    spec_types = sorted(spec.type for spec in ALL_BUILTIN_SPECS)
    catalog_types = sorted(entry["type"] for entry in catalog)
    assert len(catalog) == EXPECTED_CHART_TYPE_COUNT
    assert len(ALL_BUILTIN_SPECS) == EXPECTED_CHART_TYPE_COUNT
    assert catalog_types == spec_types


def test_catalog_exports_de_unified_fields():
    register_builtin_chart_types()
    for entry in export_chart_type_catalog():
        assert entry.get("library")
        assert entry.get("paletteCategory")
        assert "deprecated" in entry
        assert "migratesTo" in entry
        assert entry.get("fieldRule")


def test_deprecated_types_declare_valid_migrates_to():
    register_builtin_chart_types()
    types = {entry["type"] for entry in export_chart_type_catalog()}
    for entry in export_chart_type_catalog():
        target = entry.get("migratesTo")
        if not entry.get("deprecated"):
            continue
        assert target, entry["type"]
        assert target in types, f"{entry['type']} → {target}"


def test_field_rules_match_fe_snapshot():
    """FE chartCatalogBackendFieldRules.ts must stay in sync with backend catalog."""
    from pathlib import Path

    register_builtin_chart_types()
    backend_rules = {
        entry["type"]: entry["fieldRule"] for entry in export_chart_type_catalog()
    }
    fe_path = (
        Path(__file__).resolve().parents[1]
        / "fe"
        / "src"
        / "components"
        / "charts"
        / "chartCatalogBackendFieldRules.ts"
    )
    text = fe_path.read_text(encoding="utf-8")
    for chart_type, rule in backend_rules.items():
        assert chart_type in text, f"missing type {chart_type} in FE snapshot"
        assert f"minDimensions: {rule['minDimensions']}" in text
        assert f"maxDimensions: {rule['maxDimensions']}" in text
        assert f"minMetrics: {rule['minMetrics']}" in text
        assert f"maxMetrics: {rule['maxMetrics']}" in text

