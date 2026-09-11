"""demo_instances seed 规格契约。"""

from __future__ import annotations

from app.dashboard.demo_instances.seed import DEMO_INSTANCE_SLUGS, DEMO_INSTANCE_SPECS


def test_demo_instance_specs_have_unique_slugs() -> None:
    slugs = [spec["slug"] for spec in DEMO_INSTANCE_SPECS]
    assert len(slugs) == len(set(slugs))
    assert set(slugs) == DEMO_INSTANCE_SLUGS


def test_demo_instance_specs_cover_dashboard_and_screen() -> None:
    surfaces = {spec["surface_kind"] for spec in DEMO_INSTANCE_SPECS}
    assert surfaces == {"dashboard", "data-screen"}
    assert len(DEMO_INSTANCE_SPECS) == 3
