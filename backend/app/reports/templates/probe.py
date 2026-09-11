from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.reports.templates import service as template_service
from app.reports.templates.schemas import TemplateDefinitionIn

probe_template_budget_ms_limit = 50


@dataclass(frozen=True)
class TemplateProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_template_budget_ms(payload: TemplateDefinitionIn) -> TemplateProbeResult:
    started = time.perf_counter()
    template_service.validate_template_definition(payload)
    elapsed = (time.perf_counter() - started) * 1000
    return TemplateProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_template_budget_ms_limit)


def probe_get_template_budget_ms(key: str, actor: UserContext) -> TemplateProbeResult:
    started = time.perf_counter()
    template_service.get_template_definition(key, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return TemplateProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_template_budget_ms_limit)


def probe_list_templates_budget_ms(actor: UserContext) -> TemplateProbeResult:
    started = time.perf_counter()
    template_service.list_template_definitions(actor)
    elapsed = (time.perf_counter() - started) * 1000
    return TemplateProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_template_budget_ms_limit)
