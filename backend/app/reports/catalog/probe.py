from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.reports.catalog import service as catalog_service
from app.reports.catalog.schemas import CatalogNodeCreate

probe_list_catalog_budget_ms_limit = 50


@dataclass(frozen=True)
class CatalogProbeResult:
    elapsed_ms: float
    ok: bool


def _seed_probe_tree(count: int = 50) -> None:
    catalog_service._nodes.clear()  # noqa: SLF001 — test/probe only
    root = catalog_service.create_node(
        CatalogNodeCreate(name="probe-root", nodeType="folder"),
        UserContext(id="probe", username="probe", roles=["admin"]),
    )
    for i in range(count):
        catalog_service.create_node(
            CatalogNodeCreate(
                name=f"tpl-{i}",
                parentId=root.id,
                nodeType="template",
                templateKind="pdf",
            ),
            UserContext(id="probe", username="probe", roles=["admin"]),
        )


def probe_list_catalog_budget_ms(actor: UserContext) -> CatalogProbeResult:
    started = time.perf_counter()
    catalog_service.list_nodes(None, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return CatalogProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_list_catalog_budget_ms_limit)
