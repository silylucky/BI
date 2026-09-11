"""Alembic revision discovery helpers for migration gate tests."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_VERSIONS_DIR = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"


def load_revision_modules() -> list[object]:
    modules: list[object] = []
    for path in sorted(_VERSIONS_DIR.glob("*.py")):
        if path.name.startswith("__"):
            continue
        spec = importlib.util.spec_from_file_location(path.stem, path)
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        modules.append(module)
    return modules


def revision_graph() -> dict[str, str | None]:
    graph: dict[str, str | None] = {}
    for module in load_revision_modules():
        revision = getattr(module, "revision", None)
        if not isinstance(revision, str):
            continue
        down = getattr(module, "down_revision", None)
        graph[revision] = down if isinstance(down, str) else None
    return graph


def single_head() -> str:
    graph = revision_graph()
    referred = {down for down in graph.values() if down}
    heads = [rev for rev in graph if rev not in referred]
    if len(heads) != 1:
        raise AssertionError(f"expected single Alembic head, got {heads!r}")
    return heads[0]
