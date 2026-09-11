from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat03 import service as cat03_service
from app.governance.catalog.cat03.schemas import GeoRegionCreate, GeoRegionMove

probe_geo_list_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat03ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_list_geo_nodes_budget_ms(parent_id: uuid.UUID | None = None) -> Cat03ProbeResult:
    started = time.perf_counter()
    cat03_service.list_geo_nodes(parent_id, limit=100, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat03ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_geo_list_budget_ms_limit)


def probe_move_geo_region_budget_ms() -> Cat03ProbeResult:
    actor = UserContext(id="probe", username="probe", roles=["admin"])
    started = time.perf_counter()
    root = cat03_service.create_geo_node(
        GeoRegionCreate(
            region_code=f"CN-P{uuid.uuid4().hex[:4].upper()}",
            name="Probe Root",
            parent_id=None,
            level="country",
            sort_order=0,
        ),
        actor,
    )
    child = cat03_service.create_geo_node(
        GeoRegionCreate(
            region_code=f"CN-C{uuid.uuid4().hex[:4].upper()}",
            name="Probe Child",
            parent_id=root.region_id,
            level="province",
            sort_order=0,
        ),
        actor,
    )
    cat03_service.move_geo_node(child.region_id, GeoRegionMove(parent_id=root.region_id, sort_order=1), actor)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat03ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_geo_list_budget_ms_limit)
