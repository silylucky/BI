from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat03 import service as cat03_service
from app.governance.catalog.cat03.probe import (
    probe_list_geo_nodes_budget_ms,
    probe_move_geo_region_budget_ms,
)


class Cat03CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-03", alias="categoryCode")
    region_count: int = Field(alias="regionCount")
    list_probe_ok: bool = Field(alias="listProbeOk")
    move_probe_ok: bool = Field(alias="moveProbeOk")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat03_catalog_probe(actor: UserContext) -> Cat03CatalogProbeOut:
    started = time.perf_counter()
    listing = cat03_service.list_geo_nodes(None, 100, 0)
    list_probe = probe_list_geo_nodes_budget_ms()
    move_probe = probe_move_geo_region_budget_ms()
    elapsed = (time.perf_counter() - started) * 1000
    return Cat03CatalogProbeOut(
        categoryCode="CAT-03",
        regionCount=listing.total,
        listProbeOk=list_probe.ok,
        moveProbeOk=move_probe.ok,
        elapsedMs=elapsed,
    )
