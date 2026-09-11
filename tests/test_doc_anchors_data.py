from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_prd_f16_data_source_connection_field_anchors():
    """T-D05-03: F16-DATA.md 含 SourceConnection 字段表关键字。"""
    text = (ROOT / "docs/automate/prd/F16-DATA.md").read_text(encoding="utf-8")
    assert "SourceConnection" in text
    for field in ("type", "host", "password", "table"):
        assert field in text


def test_services_ingestion_symbol_anchors():
    """T-D05-04: ingestion.md 含 sync_executor/etl_rules/scheduler 锚点。"""
    text = (ROOT / "docs/services/ingestion.md").read_text(encoding="utf-8")
    for symbol in (
        "ingestion.sync_executor",
        "ingestion.etl_rules",
        "ingestion.scheduler",
    ):
        assert symbol in text


def test_api_readme_section9_ingestion_routes():
    """T-D05-05: api/README.md §9 含 sync-jobs 与 source 字段。"""
    text = (ROOT / "docs/api/README.md").read_text(encoding="utf-8")
    assert "/api/v1/ingestion/sync-jobs" in text
    assert "source" in text
    assert "SourceConnection" in text or '"type"' in text


def test_prd_f16_data005_acceptance_test_anchors():
    """T-D05-06: F16-DATA DATA-005 验收含 test_ingestion 锚点。"""
    text = (ROOT / "docs/automate/prd/F16-DATA.md").read_text(encoding="utf-8")
    assert "DATA-005" in text
    assert "test_ingestion" in text


def test_services_ingestion_implemented_status():
    """T-D05-07: ingestion.md 状态为已实现。"""
    text = (ROOT / "docs/services/ingestion.md").read_text(encoding="utf-8")
    assert "已实现" in text


def test_prd_f16_data005_l1_smoke_anchor():
    """T-D05-08: F16-DATA DATA-005 演化建议含 test_ingestion_l1_smoke 锚点。"""
    text = (ROOT / "docs/automate/prd/F16-DATA.md").read_text(encoding="utf-8")
    section_start = text.find("DATA-005")
    assert section_start != -1
    section = text[section_start : section_start + 4000]
    assert "test_ingestion_l1_smoke" in section


def test_services_ingestion_data005_or_data_smoke_reference():
    """T-D05-09: services/ingestion.md 含 DATA-005 或 DATA-SMOKE 引用。"""
    text = (ROOT / "docs/services/ingestion.md").read_text(encoding="utf-8")
    assert "DATA-005" in text or "DATA-SMOKE" in text


def test_prd_f16_data005_l1_orchestrator_anchor():
    """T-D05-10: F16-DATA DATA-005 演化建议含 T-L1-07 或 test_l1_data_smoke_orchestrator。"""
    text = (ROOT / "docs/automate/prd/F16-DATA.md").read_text(encoding="utf-8")
    section_start = text.find("DATA-005")
    assert section_start != -1
    section = text[section_start : section_start + 4000]
    assert "T-L1-07" in section or "test_l1_data_smoke_orchestrator" in section


def test_services_ingestion_l1_orchestrator_anchor():
    """T-D05-11: services/ingestion.md §验收含 T-L1-07。"""
    text = (ROOT / "docs/services/ingestion.md").read_text(encoding="utf-8")
    assert "T-L1-07" in text


def test_prd_f16_data002_full_refresh_anchor():
    """T-D05-12: F16-DATA DATA-002 演化建议含 T-D02-19（全量契约）。"""
    text = (ROOT / "docs/automate/prd/F16-DATA.md").read_text(encoding="utf-8")
    section_start = text.find("DATA-002")
    assert section_start != -1
    section = text[section_start : section_start + 4000]
    assert "T-D02-19" in section
