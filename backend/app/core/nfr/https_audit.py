from __future__ import annotations

import os
import time
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.core.nfr.errors import (
    HTTPS_AUDIT_EMPTY_PAYLOAD,
    HTTPS_AUDIT_FORBIDDEN,
    HTTPS_AUDIT_INSECURE_URL,
    HTTPS_AUDIT_INVALID_SCOPE,
    HTTPS_AUDIT_UNKNOWN_FIELD,
)

_SENSITIVE_DEFAULTS = frozenset({"password", "apiKey", "credential", "secret"})
_MASK_KEYS = frozenset({"password", "apiKey", "credential", "secret", "token"})
_ALLOWED_SCOPES = frozenset({"api", "webhook", "connector"})
_USER_HTTPS_AUDIT_SCOPE: dict[str, frozenset[str]] = {}
probe_https_audit_budget_ms_limit = 50

_AUDIT_RING: deque[dict] = deque(maxlen=32)


@dataclass(frozen=True)
class HttpsAuditProbeResult:
    elapsed_ms: float
    ok: bool


class HttpsAuditError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class HttpsAuditStatusOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    https_enforced: bool = Field(alias="httpsEnforced")
    webhook_https_only: bool = Field(alias="webhookHttpsOnly")
    tls_min_version: str = Field(default="1.2", alias="tlsMinVersion")
    checked_at: datetime = Field(alias="checkedAt")


class HttpsAuditMaskProbeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sample_payload: dict[str, Any] = Field(alias="samplePayload")
    sensitive_fields: list[str] = Field(
        default_factory=lambda: ["password", "apiKey", "credential"],
        alias="sensitiveFields",
    )
    webhook_url: str | None = Field(default=None, alias="webhookUrl")
    audit_scope: str = Field(default="api", alias="auditScope")
    simulate_audit_failure: bool = Field(default=False, alias="simulateAuditFailure")


class HttpsAuditMaskProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    masked_payload: dict[str, Any] = Field(alias="maskedPayload")
    masked_fields: list[str] = Field(alias="maskedFields")
    audit_logged: bool = Field(default=True, alias="auditLogged")
    insecure_webhook: bool = Field(default=False, alias="insecureWebhook")


class AuditEventOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    trace_id: str = Field(alias="traceId")
    path: str
    method: str
    masked_fields: list[str] = Field(alias="maskedFields")
    timestamp: datetime


class AuditProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    events: list[AuditEventOut]
    event_count: int = Field(alias="eventCount")
    plaintext_leaked: bool = Field(alias="plaintextLeaked")


def set_user_https_audit_scope(user_id: str, allowed_scopes: frozenset[str]) -> None:
    _USER_HTTPS_AUDIT_SCOPE[user_id] = allowed_scopes


def _assert_acl(actor: UserContext, audit_scope: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    allowed = _USER_HTTPS_AUDIT_SCOPE.get(actor.id, frozenset({"api", "webhook"}))
    if audit_scope not in allowed:
        raise HttpsAuditError(HTTPS_AUDIT_FORBIDDEN, "enterprise user out of https audit scope", 403)


def _guard_scope(audit_scope: str) -> None:
    if audit_scope not in _ALLOWED_SCOPES:
        raise HttpsAuditError(
            HTTPS_AUDIT_INVALID_SCOPE,
            "Invalid auditScope",
            422,
            [{"field": "auditScope", "message": f"must be one of {sorted(_ALLOWED_SCOPES)}"}],
        )


def get_https_audit_status() -> HttpsAuditStatusOut:
    settings = get_settings()
    https_enforced = settings.vitalspan_env == "production"
    webhook_https_only = True
    return HttpsAuditStatusOut(
        httpsEnforced=https_enforced,
        webhookHttpsOnly=webhook_https_only,
        tlsMinVersion="1.2",
        checkedAt=datetime.now(UTC),
    )


def probe_https_mask(payload: HttpsAuditMaskProbeIn, actor: UserContext | None = None) -> HttpsAuditMaskProbeOut:
    actor = actor or UserContext(id="dev", username="dev", roles=["admin"])
    _guard_scope(payload.audit_scope)
    _assert_acl(actor, payload.audit_scope)
    if not payload.sample_payload:
        raise HttpsAuditError(HTTPS_AUDIT_EMPTY_PAYLOAD, "samplePayload must not be empty", 422)
    unknown = [f for f in payload.sensitive_fields if f not in _SENSITIVE_DEFAULTS and f not in _MASK_KEYS]
    if unknown:
        raise HttpsAuditError(
            HTTPS_AUDIT_UNKNOWN_FIELD,
            f"unknown sensitive field policy: {unknown[0]}",
            422,
            [{"field": "sensitiveFields", "message": unknown[0]}],
        )
    if payload.webhook_url and payload.webhook_url.startswith("http://"):
        raise HttpsAuditError(HTTPS_AUDIT_INSECURE_URL, "webhookUrl must use https", 422)
    masked: dict[str, Any] = dict(payload.sample_payload)
    masked_fields: list[str] = []
    for key in payload.sensitive_fields:
        if key in masked:
            masked[key] = "***"
            masked_fields.append(key)
    for key in list(masked):
        if key in _MASK_KEYS and key not in masked_fields:
            masked[key] = "***"
            masked_fields.append(key)
    insecure = bool(payload.webhook_url and payload.webhook_url.startswith("http://"))
    audit_logged = not payload.simulate_audit_failure
    return HttpsAuditMaskProbeOut(
        maskedPayload=masked,
        maskedFields=masked_fields,
        auditLogged=audit_logged,
        insecureWebhook=insecure,
    )


def probe_https_mask_budget_ms(actor: UserContext) -> HttpsAuditProbeResult:
    started = time.perf_counter()
    probe_https_mask(
        HttpsAuditMaskProbeIn(samplePayload={"password": "x"}, auditScope="api"),
        actor,
    )
    elapsed = (time.perf_counter() - started) * 1000
    return HttpsAuditProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_https_audit_budget_ms_limit)


def probe_https_status_budget_ms() -> HttpsAuditProbeResult:
    started = time.perf_counter()
    get_https_audit_status()
    elapsed = (time.perf_counter() - started) * 1000
    return HttpsAuditProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_https_audit_budget_ms_limit)


def record_audit_event(
    *, trace_id: str, path: str, method: str, body: dict,
) -> list[str]:
    masked_fields: list[str] = []
    for key in body:
        if key in _MASK_KEYS and body[key] not in (None, "***"):
            masked_fields.append(key)
    masked_body = {
        key: ("***" if key in _MASK_KEYS else value)
        for key, value in body.items()
    }
    _AUDIT_RING.append({
        "traceId": trace_id,
        "path": path,
        "method": method,
        "maskedFields": masked_fields,
        "body": masked_body,
        "timestamp": datetime.now(UTC).isoformat(),
    })
    return masked_fields


def _ring_has_plaintext_leak() -> bool:
    for entry in _AUDIT_RING:
        body = entry.get("body")
        if not isinstance(body, dict):
            continue
        for key in _MASK_KEYS:
            if key in body and body[key] not in (None, "***"):
                return True
    return False


def export_audit_probe(actor: UserContext) -> AuditProbeOut:
    _assert_acl(actor, "api")
    events = [AuditEventOut.model_validate(e) for e in list(_AUDIT_RING)]
    return AuditProbeOut(
        events=events,
        eventCount=len(events),
        plaintextLeaked=_ring_has_plaintext_leak(),
    )


def clear_audit_ring_for_tests() -> None:
    _AUDIT_RING.clear()
