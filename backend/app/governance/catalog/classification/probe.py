from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.classification import service as classification_service
from app.governance.catalog.classification.schemas import ClassificationNodeCreate, ClassificationNodeMove

probe_classification_list_budget_ms_limit = 50


@dataclass(frozen=True)
class ClassificationProbeResult:
    elapsed_ms: float
    ok: bool


def probe_list_classification_budget_ms(parent_id: uuid.UUID | None = None) -> ClassificationProbeResult:
    started = time.perf_counter()
    classification_service.list_nodes(parent_id, limit=100, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return ClassificationProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_classification_list_budget_ms_limit)


def probe_classification_move_budget_ms() -> ClassificationProbeResult:
    actor = UserContext(id="probe", username="probe", roles=["admin"])
    started = time.perf_counter()
    root = classification_service.create_node(
        ClassificationNodeCreate(
            code=f"CAT_P{uuid.uuid4().hex[:4].upper()}",
            name="Probe Root",
            parent_id=None,
            kind="folder",
            sort_order=0,
        ),
        actor,
    )
    child = classification_service.create_node(
        ClassificationNodeCreate(
            code=f"CAT_C{uuid.uuid4().hex[:4].upper()}",
            name="Probe Child",
            parent_id=root.node_id,
            kind="leaf",
            sort_order=0,
        ),
        actor,
    )
    classification_service.move_node(
        child.node_id, ClassificationNodeMove(parent_id=root.node_id, sort_order=1), actor
    )
    elapsed = (time.perf_counter() - started) * 1000
    return ClassificationProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_classification_list_budget_ms_limit)
