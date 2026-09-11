from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat01 import service as cat01_service
from app.governance.catalog.cat01.probe import (
    probe_list_lifecycle_templates_budget_ms,
    probe_validate_lifecycle_budget_ms,
)
from app.governance.catalog.cat01.service import set_user_entity_scope


class Cat01CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-01", alias="categoryCode")
    template_count: int = Field(alias="templateCount")
    acl_ready: bool = Field(alias="aclReady")
    list_probe_ok: bool = Field(alias="listProbeOk")
    validate_probe_ok: bool = Field(alias="validateProbeOk")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat01_catalog_probe(actor: UserContext) -> Cat01CatalogProbeOut:
    started = time.perf_counter()
    listing = cat01_service.list_lifecycle_templates(50, 0, actor)
    list_probe = probe_list_lifecycle_templates_budget_ms()
    validate_probe = probe_validate_lifecycle_budget_ms()
    acl_ready = callable(set_user_entity_scope)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat01CatalogProbeOut(
        categoryCode="CAT-01",
        templateCount=listing.total,
        aclReady=acl_ready,
        listProbeOk=list_probe.ok,
        validateProbeOk=validate_probe.ok,
        elapsedMs=elapsed,
    )
