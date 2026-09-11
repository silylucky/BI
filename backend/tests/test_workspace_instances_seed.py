"""workspace_instances seed 规格契约。"""

from app.dashboard.workspace_instances.seed import WORKSPACE_INSTANCE_SLUGS, WORKSPACE_INSTANCE_SPECS


def test_workspace_instance_specs_unique_slugs() -> None:
    slugs = [spec["slug"] for spec in WORKSPACE_INSTANCE_SPECS]
    assert len(slugs) == len(set(slugs))
    assert set(slugs) == WORKSPACE_INSTANCE_SLUGS


def test_workspace_instance_surface_kinds() -> None:
    dashboards = [spec for spec in WORKSPACE_INSTANCE_SPECS if spec["surface_kind"] == "dashboard"]
    screens = [spec for spec in WORKSPACE_INSTANCE_SPECS if spec["surface_kind"] == "data-screen"]
    assert len(dashboards) == 5
    assert len(screens) == 5
