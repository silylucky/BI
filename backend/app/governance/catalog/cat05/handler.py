from __future__ import annotations

import time
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat05 import service as cat05_service
from app.governance.catalog.cat05.probe import probe_ticket_stats_budget_ms
from app.governance.catalog.cat05.schemas import TicketStatsItemIn
from app.governance.catalog.cat05.service import set_user_ticket_scope


class Cat05CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-05", alias="categoryCode")
    template_count: int = Field(alias="templateCount")
    stats_probe_ok: bool = Field(alias="statsProbeOk")
    acl_ready: bool = Field(alias="aclReady")
    elapsed_ms: float = Field(alias="elapsedMs")


def _ensure_seed_ticket(actor: UserContext) -> str:
    listing = cat05_service.list_ticket_items(10, 0)
    if listing.total > 0:
        return listing.items[0].ticket_category_key
    key = f"TICKET_R237_{uuid.uuid4().hex[:4].upper()}"
    cat05_service.create_ticket_item(
        TicketStatsItemIn.model_validate({
            "ticketCategoryKey": key,
            "displayName": "R237 Probe Seed",
            "statusFilters": ["open"],
        }),
        actor,
    )
    return key


def run_cat05_catalog_probe(actor: UserContext) -> Cat05CatalogProbeOut:
    started = time.perf_counter()
    key = _ensure_seed_ticket(actor)
    cat05_service.get_ticket_stats(key, actor)
    stats_probe = probe_ticket_stats_budget_ms(key)
    listing = cat05_service.list_ticket_items(100, 0)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat05CatalogProbeOut(
        categoryCode="CAT-05",
        templateCount=listing.total,
        statsProbeOk=stats_probe.ok,
        aclReady=callable(set_user_ticket_scope),
        elapsedMs=elapsed,
    )
