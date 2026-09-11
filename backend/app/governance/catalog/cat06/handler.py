from __future__ import annotations

import time
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat06 import service as cat06_service
from app.governance.catalog.cat06.probe import (
    probe_production_stats_budget_ms,
    probe_validate_production_stats_budget_ms,
)
from app.governance.catalog.cat06.schemas import ProductionStatsItemIn
from app.governance.catalog.cat06.service import set_user_brand_scope


class Cat06CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-06", alias="categoryCode")
    template_count: int = Field(alias="templateCount")
    validate_probe_ok: bool = Field(alias="validateProbeOk")
    stats_probe_ok: bool = Field(alias="statsProbeOk")
    acl_ready: bool = Field(alias="aclReady")
    elapsed_ms: float = Field(alias="elapsedMs")


def _ensure_seed_stats(actor: UserContext) -> str:
    listing = cat06_service.list_production_stats(actor, 10, 0)
    if listing.total > 0:
        return listing.items[0].stats_key
    key = f"PS_R237_{uuid.uuid4().hex[:4].upper()}"
    cat06_service.create_production_stats(
        ProductionStatsItemIn.model_validate({
            "statsKey": key,
            "displayName": "R237 Probe",
            "vendorType": "enterprise",
            "brandId": "BRAND01",
            "locType": "all",
            "metricKeys": ["inbound"],
        }),
        actor,
    )
    return key


def run_cat06_catalog_probe(actor: UserContext) -> Cat06CatalogProbeOut:
    started = time.perf_counter()
    validate_probe = probe_validate_production_stats_budget_ms()
    key = _ensure_seed_stats(actor)
    cat06_service.get_production_stats(key, actor)
    stats_probe = probe_production_stats_budget_ms(key)
    listing = cat06_service.list_production_stats(actor, 100, 0)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat06CatalogProbeOut(
        categoryCode="CAT-06",
        templateCount=listing.total,
        validateProbeOk=validate_probe.ok,
        statsProbeOk=stats_probe.ok,
        aclReady=callable(set_user_brand_scope),
        elapsedMs=elapsed,
    )
