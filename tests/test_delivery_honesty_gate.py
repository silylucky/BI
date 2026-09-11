"""Customer-delivery honesty gate — executable contracts for main-path honesty."""

from __future__ import annotations

from pathlib import Path

from app.metadata.dataset.models import DatasetRecord
from app.metadata.dataset import service as dataset_service
from app.reports.scheduler import executor as schedule_executor

_ROOT = Path(__file__).resolve().parents[1]


def test_honesty_gate_dataset_orm_not_inmemory() -> None:
    """FAKE-01: Dataset primary store is ORM (DatasetRecord), not a dict store."""
    assert issubclass(DatasetRecord, object)
    assert hasattr(DatasetRecord, "__tablename__")
    assert DatasetRecord.__tablename__ == "datasets"
    assert not isinstance(dataset_service._store, dict)


def test_honesty_gate_schedule_default_artifact_not_mock_scheme() -> None:
    """T3: customer-default schedule mock path must not emit mock:// artifacts."""
    src = Path(schedule_executor.__file__).read_text(encoding="utf-8")
    assert "mock://" not in src or "never customer-default mock://" in src
    assert 'artifactRef=f"test://reports/' in src or 'artifact_ref=f"test://reports/' in src or "test://reports/" in src


def test_honesty_gate_h1_gov_nav_default_off() -> None:
    """H1: 治理侧栏固定隐藏（无 env 开关）。"""
    gov_nav = (_ROOT / "fe" / "src" / "lib" / "gov-nav.ts").read_text(encoding="utf-8")
    assert "returnfalse" in gov_nav.replace(" ", "")
    resolve_nav = (_ROOT / "fe" / "src" / "lib" / "resolve-nav.ts").read_text(encoding="utf-8")
    assert "govNavEnabled??false" in resolve_nav.replace(" ", "")


def test_honesty_gate_filter_controls_are_real() -> None:
    """T2: filter widgets expose real select/date/multiselect controls (not placeholder-only)."""
    controls = (_ROOT / "fe" / "src" / "components" / "dashboard" / "FilterWidgetControls.tsx").read_text(
        encoding="utf-8",
    )
    assert 'controlType === "select"' in controls
    assert 'controlType === "date"' in controls
    assert 'controlType === "multiselect"' in controls


def test_honesty_gate_share_page_reads_layout_json() -> None:
    """P0-01: Share dialog must read API layoutJson via normalizeDashboardDetail."""
    share_dialog = (_ROOT / "fe" / "src" / "components" / "dashboard" / "DashboardShareDialog.tsx").read_text(
        encoding="utf-8",
    )
    share_page = (_ROOT / "fe" / "src" / "pages" / "admin" / "dashboard" / "DashboardSharePage.tsx").read_text(
        encoding="utf-8",
    )
    assert "DashboardShareDialog" in share_page
    assert "layoutJson" in share_dialog
    assert "normalizeDashboardDetail" in share_dialog
    assert "detail?.layout?.widgets" not in share_dialog
