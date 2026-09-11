from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.governance.catalog.appendix_e import APPENDIX_E_TAXONOMY
from app.governance.catalog.cat07 import service as cat07_service
from app.governance.catalog.cat07.probe import probe_workno_behavior_budget_ms
from app.governance.catalog.cat07.service import set_user_workno_scope


class Cat07CatalogProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    category_code: str = Field(default="CAT-07", alias="categoryCode")
    taxonomy_registered: bool = Field(alias="taxonomyRegistered")
    behavior_probe_ok: bool = Field(alias="behaviorProbeOk")
    acl_ready: bool = Field(alias="aclReady")
    sample_workno: str = Field(default="EMP1001", alias="sampleWorkno")
    behavior_count: int = Field(alias="behaviorCount")
    elapsed_ms: float = Field(alias="elapsedMs")


def run_cat07_catalog_probe(actor: UserContext) -> Cat07CatalogProbeOut:
    started = time.perf_counter()
    codes = {c.code for c in APPENDIX_E_TAXONOMY}
    taxonomy_ok = "CAT-07" in codes
    out = cat07_service.query_behavior("EMP1001", None, None, 50, 0, actor)
    budget = probe_workno_behavior_budget_ms()
    elapsed = (time.perf_counter() - started) * 1000
    return Cat07CatalogProbeOut(
        categoryCode="CAT-07",
        taxonomyRegistered=taxonomy_ok,
        behaviorProbeOk=budget.ok,
        aclReady=callable(set_user_workno_scope),
        sampleWorkno="EMP1001",
        behaviorCount=out.total,
        elapsedMs=elapsed,
    )
