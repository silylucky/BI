from __future__ import annotations

import time
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.cat02 import service as cat02_service
from app.governance.catalog.cat02.probe import (
    probe_list_aggregate_budget_ms,
    probe_validate_aggregate_budget_ms,
)
from app.governance.catalog.cat02.schemas import AggregateTemplateIn


class Cat02CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-02", alias="categoryCode")
    template_count: int = Field(alias="templateCount")
    attribution_ready: bool = Field(alias="attributionReady")
    list_probe_ok: bool = Field(alias="listProbeOk")
    validate_probe_ok: bool = Field(alias="validateProbeOk")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat02_catalog_probe(actor: UserContext) -> Cat02CatalogProbeOut:
    started = time.perf_counter()
    listing = cat02_service.list_aggregate_templates(50, 0, actor)
    list_probe = probe_list_aggregate_budget_ms()
    validate_probe = probe_validate_aggregate_budget_ms()
    sample_key = f"AGG_M6_{uuid.uuid4().hex[:6].upper()}"
    cat02_service.create_aggregate_template(
        AggregateTemplateIn.model_validate({
            "aggregateKey": sample_key,
            "displayName": "M6 Probe",
            "dimensions": ["region"],
            "metrics": ["amount"],
            "aggregationFn": "sum",
            "attributionLabel": "m6",
        }),
        actor,
    )
    attr = cat02_service.get_aggregate_attribution(sample_key, actor)
    attribution_ready = attr.poc_ready is True
    elapsed = (time.perf_counter() - started) * 1000
    return Cat02CatalogProbeOut(
        categoryCode="CAT-02",
        templateCount=listing.total,
        attributionReady=attribution_ready,
        listProbeOk=list_probe.ok,
        validateProbeOk=validate_probe.ok,
        elapsedMs=elapsed,
    )
