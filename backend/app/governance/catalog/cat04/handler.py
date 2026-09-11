from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat04.probe import (
    probe_classification_move_budget_ms,
    probe_list_classification_budget_ms,
)
from app.governance.catalog.classification import service as classification_service
from app.governance.catalog.classification.service import set_user_class_scope


class Cat04CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-04", alias="categoryCode")
    node_count: int = Field(alias="nodeCount")
    list_probe_ok: bool = Field(alias="listProbeOk")
    move_probe_ok: bool = Field(alias="moveProbeOk")
    acl_ready: bool = Field(alias="aclReady")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat04_catalog_probe(actor: UserContext) -> Cat04CatalogProbeOut:
    started = time.perf_counter()
    listing = classification_service.list_nodes(None, limit=100, offset=0)
    list_probe = probe_list_classification_budget_ms()
    move_probe = probe_classification_move_budget_ms()
    elapsed = (time.perf_counter() - started) * 1000
    return Cat04CatalogProbeOut(
        categoryCode="CAT-04",
        nodeCount=listing.total,
        listProbeOk=list_probe.ok,
        moveProbeOk=move_probe.ok,
        aclReady=callable(set_user_class_scope),
        elapsedMs=elapsed,
    )
