from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext, get_current_user, require_permission

PERM_MANAGE = "governance:manage"
from app.core.config import get_settings
from app.core.nfr.browser_matrix import probe_browser_support
from app.core.nfr.dashboard_availability import (
    CORE_DASHBOARD_IDS,
    P95_THRESHOLD_MS,
    build_dashboard_availability_report,
    probe_core_dashboards_smoke,
)
from app.core.nfr.dashboard_first_screen import (
    DashboardFirstScreenError,
    DashboardFirstScreenProbeIn,
    DashboardFirstScreenProbeOut,
    DashboardFirstScreenValidateOut,
    probe_dashboard_first_screen,
    validate_dashboard_first_screen,
)
from app.core.nfr.dashboard_sla import (
    DashboardSlaAlertsOut,
    DashboardSlaError,
    DashboardSlaProbeIn,
    DashboardSlaProbeOut,
    DashboardSlaValidateOut,
    get_dashboard_sla_alerts,
    probe_dashboard_sla,
    validate_dashboard_sla,
)
from app.core.nfr.deployment_report import (
    build_deployment_acceptance_report,
    render_nfr08_deployment_markdown,
)
from app.core.nfr.errors import NFR_RUNTIME_VIOLATION, XINCHUANG_NON_COMPLIANT
from app.core.nfr.https_audit import (
    AuditProbeOut,
    HttpsAuditError,
    HttpsAuditMaskProbeIn,
    HttpsAuditMaskProbeOut,
    HttpsAuditStatusOut,
    export_audit_probe,
    get_https_audit_status,
    probe_https_mask,
)
from app.core.nfr.plugin_extension import (
    describe_registration_path,
    list_extension_points,
    run_extension_drill,
    teardown_extension_drill,
)
from app.core.nfr.push_channels import dispatch_push_mock
from app.core.nfr.push_config import resolve_push_mode
from app.core.nfr.report_perf import (
    ReportPerfError,
    ReportPerfProbeIn,
    ReportPerfProbeOut,
    ReportPerfValidateOut,
    probe_report_perf,
    validate_report_perf_config,
)
from app.core.nfr.runtime_guard import (
    RuntimeComplianceError,
    RuntimeComplianceReport,
    assert_runtime_compliant,
    build_runtime_report,
)
from app.core.nfr.xinchuang import (
    XinchuangComplianceError,
    assert_xinchuang_compliant,
    build_compliance_report,
    build_xinchuang_deployment_report,
    render_deployment_report_markdown,
)

router = APIRouter(prefix="/nfr", tags=["nfr"])


class ExtensionPointOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    description: str


class ExtensionPointListResponse(BaseModel):
    items: list[ExtensionPointOut]


class PushConfigResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    browser_enabled: bool = Field(alias="browserEnabled")
    wecom_configured: bool = Field(alias="wecomConfigured")
    dingtalk_configured: bool = Field(alias="dingtalkConfigured")
    delivery_mode: str = Field(alias="deliveryMode")
    degraded_reason: str | None = Field(default=None, alias="degradedReason")


class ComplianceItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    status: str
    message: str
    remediation: str | None = None


class ComplianceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: str
    overall_status: str = Field(alias="overallStatus")
    items: list[ComplianceItemOut]
    registered_xinchuang_connectors: list[str] = Field(alias="registeredXinchuangConnectors")


class BrowserMatrixItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    min_version: int = Field(alias="minVersion")
    status: str
    notes: str | None = None


class BrowserMatrixResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[BrowserMatrixItemOut]
    detected_browser: dict | None = Field(default=None, alias="detectedBrowser")
    overall_status: str = Field(alias="overallStatus")
    documentation_url: str = Field(
        default="/docs/nfr/browser-compatibility.md",
        alias="documentationUrl",
    )


class NotificationCreateIn(BaseModel):
    message: str
    channel: str = "browser"


class NotificationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    channel: str
    message: str
    status: str
    created_at: str = Field(alias="createdAt")
    delivery: dict | None = None


class PushProbeIn(BaseModel):
    message: str = "probe"


class PushProbeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    status: str
    channel: str | None = None
    attempted_channels: list[str] = Field(alias="attemptedChannels")
    code: str | None = None


class RegistrationPathResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    connector_type: str = Field(alias="connectorType")
    steps: list[str]
    touches_core_registry: bool = Field(alias="touchesCoreRegistry")


@router.get("/plugin-extension/drill")
def plugin_extension_drill(_: Annotated[UserContext, Depends(get_current_user)]):
    try:
        result = run_extension_drill()
        return {
            "registered": result.registered,
            "types": list(result.types),
            "zeroInvasion": result.zero_invasion,
            "elapsedMs": result.elapsed_ms,
            "connectivityOk": result.connectivity_ok,
            "readonlyQueryOk": result.readonly_query_ok,
        }
    finally:
        teardown_extension_drill()


@router.get("/dashboard-availability/smoke")
def dashboard_availability_smoke(
    simulate_breach: bool = Query(False, alias="simulateBreach"),
    actor: Annotated[UserContext, Depends(get_current_user)] = ...,
):
    try:
        reports = probe_core_dashboards_smoke(actor, simulate_breach=simulate_breach)
    except DashboardSlaError as exc:
        return _dashboard_sla_error(exc)
    except DashboardFirstScreenError as exc:
        return _dashboard_first_screen_error(exc)
    all_ok = all(r.within_sla and r.within_first_screen_budget for r in reports)
    if not all_ok:
        return JSONResponse(
            status_code=503,
            content={
                "code": "DASHBOARD_AVAILABILITY_BREACH",
                "message": "SLA breach",
                "detail": None,
            },
        )
    return {
        "dashboards": [
            {
                "dashboardId": r.dashboard_id,
                "withinSla": r.within_sla,
                "withinFirstScreenBudget": r.within_first_screen_budget,
                "overallStatus": r.overall_status,
                "firstScreenP95Ms": r.first_screen_p95_ms,
            }
            for r in reports
        ],
        "allAvailable": all_ok,
        "p95ThresholdMs": P95_THRESHOLD_MS,
        "coreDashboardIds": list(CORE_DASHBOARD_IDS),
    }


@router.get("/dashboard-availability/report")
def dashboard_availability_report(
    dashboard_id: str = Query(alias="dashboardId"),
    simulate_breach: bool = Query(False, alias="simulateBreach"),
    actor: Annotated[UserContext, Depends(get_current_user)] = ...,
):
    try:
        report = build_dashboard_availability_report(
            dashboard_id, actor, simulate_breach=simulate_breach
        )
    except DashboardSlaError as exc:
        return _dashboard_sla_error(exc)
    except DashboardFirstScreenError as exc:
        return _dashboard_first_screen_error(exc)
    if report.overall_status != "available":
        return JSONResponse(
            status_code=503,
            content={
                "code": "DASHBOARD_AVAILABILITY_BREACH",
                "message": "SLA breach",
                "detail": None,
            },
        )
    return {
        "dashboardId": report.dashboard_id,
        "withinSla": report.within_sla,
        "withinFirstScreenBudget": report.within_first_screen_budget,
        "overallStatus": report.overall_status,
        "slaUptimePercent": report.sla_uptime_percent,
        "firstScreenP95Ms": report.first_screen_p95_ms,
    }


@router.get("/xinchuang/deployment-report")
def xinchuang_deployment_report(
    _: Annotated[UserContext, Depends(get_current_user)],
    format: str = Query("json"),
):
    try:
        report = build_xinchuang_deployment_report()
    except XinchuangComplianceError as exc:
        return JSONResponse(
            status_code=422,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )
    if format == "markdown":
        md = render_deployment_report_markdown(report)
        return Response(content=md, media_type="text/markdown")
    return {
        "schemaVersion": report.schema_version,
        "generatedAt": report.generated_at,
        "missingExpectedTypes": list(report.missing_expected_types),
        "registeredXinchuangConnectors": list(report.registered_xinchuang_connectors),
        "composeServices": list(report.compose_services),
        "dialectReadOnlySmoke": list(report.dialect_readonly_smoke),
        "overallAcceptance": report.overall_acceptance,
        "components": list(report.components),
    }


@router.get("/plugin-extension-points", response_model=ExtensionPointListResponse)
def get_plugin_extension_points(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ExtensionPointListResponse:
    return ExtensionPointListResponse(
        items=[ExtensionPointOut(id=p.id, description=p.description) for p in list_extension_points()]
    )


@router.get("/push-config", response_model=PushConfigResponse)
def get_push_config(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> PushConfigResponse:
    out = resolve_push_mode()
    return PushConfigResponse(
        browserEnabled=out.browser_enabled,
        wecomConfigured=out.wecom_configured,
        dingtalkConfigured=out.dingtalk_configured,
        deliveryMode=out.delivery_mode,
        degradedReason=out.degraded_reason,
    )


@router.get("/xinchuang/compliance", response_model=ComplianceResponse)
def get_xinchuang_compliance(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> ComplianceResponse | JSONResponse:
    settings = get_settings()
    try:
        assert_xinchuang_compliant(settings)
    except XinchuangComplianceError as exc:
        return JSONResponse(
            status_code=422,
            content={"code": XINCHUANG_NON_COMPLIANT, "message": exc.message, "detail": None},
        )
    report = build_compliance_report(settings)
    return ComplianceResponse(
        mode=report.mode,
        overallStatus=report.overall_status,
        items=[
            ComplianceItemOut(id=i.id, status=i.status, message=i.message, remediation=i.remediation)
            for i in report.items
        ],
        registeredXinchuangConnectors=list(report.registered_xinchuang_connectors),
    )


@router.get("/browser-matrix", response_model=BrowserMatrixResponse)
def get_browser_matrix(
    _: Annotated[UserContext, Depends(get_current_user)],
    user_agent: str | None = Query(default=None, alias="userAgent"),
) -> BrowserMatrixResponse:
    report = probe_browser_support(user_agent)
    detected = None
    if report.detected_browser:
        detected = {
            "name": report.detected_browser.name,
            "majorVersion": report.detected_browser.major_version,
            "supported": report.detected_browser.supported,
            "status": report.detected_browser.status,
        }
    return BrowserMatrixResponse(
        items=[
            BrowserMatrixItemOut(name=i.name, minVersion=i.min_version, status=i.status, notes=i.notes)
            for i in report.items
        ],
        detectedBrowser=detected,
        overallStatus=report.overall_status,
        documentationUrl="/docs/nfr/browser-compatibility.md",
    )


@router.post("/notifications", status_code=201, response_model=None)
def create_notification_route(
    payload: NotificationCreateIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    from app.core.nfr.notifications import create_notification

    out = create_notification(payload.message, payload.channel)
    return JSONResponse(status_code=201, content=out.model_dump(by_alias=True, mode="json"))


@router.get("/notifications/{notification_id}", response_model=None)
def get_notification_route(
    notification_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
):
    from app.core.nfr.notifications import get_notification

    try:
        out = get_notification(notification_id)
    except KeyError:
        return JSONResponse(
            status_code=404,
            content={"code": "NFR_NOTIFICATION_NOT_FOUND", "message": "Notification not found", "detail": None},
        )
    return JSONResponse(status_code=200, content=out.model_dump(by_alias=True, mode="json"))


@router.post("/push-probe", response_model=PushProbeResponse)
def post_push_probe(
    payload: PushProbeIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> PushProbeResponse:
    result = dispatch_push_mock({"text": payload.message})
    return PushProbeResponse(
        status=result.status,
        channel=result.channel,
        attemptedChannels=list(result.attempted_channels),
        code=result.code,
    )


@router.get("/registration-path/{connector_type}", response_model=RegistrationPathResponse)
def get_registration_path(
    connector_type: str,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> RegistrationPathResponse:
    doc = describe_registration_path(connector_type)
    return RegistrationPathResponse(
        connectorType=doc.connector_type,
        steps=list(doc.steps),
        touchesCoreRegistry=doc.touches_core_registry,
    )


class RuntimeCheckItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    status: str
    message: str
    remediation: str | None = None


class RuntimeComplianceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    policy_version: str = Field(alias="policyVersion")
    overall_status: str = Field(alias="overallStatus")
    zero_third_party_bi_runtime: bool = Field(alias="zeroThirdPartyBiRuntime")
    scanned_at: str = Field(alias="scannedAt")
    items: list[RuntimeCheckItemOut]


def _runtime_response(report: RuntimeComplianceReport) -> RuntimeComplianceResponse:
    return RuntimeComplianceResponse(
        policyVersion=report.policy_version,
        overallStatus=report.overall_status,
        zeroThirdPartyBiRuntime=report.zero_third_party_bi_runtime,
        scannedAt=report.scanned_at,
        items=[RuntimeCheckItemOut(id=i.id, status=i.status, message=i.message, remediation=i.remediation) for i in report.items],
    )


@router.get("/runtime-compliance", response_model=RuntimeComplianceResponse)
def get_runtime_compliance(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> RuntimeComplianceResponse:
    return _runtime_response(build_runtime_report())


@router.post("/runtime-compliance/assert", response_model=None)
def post_runtime_compliance_assert(
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return _runtime_response(assert_runtime_compliant())
    except RuntimeComplianceError as exc:
        return JSONResponse(status_code=503, content={"code": NFR_RUNTIME_VIOLATION, "message": exc.message, "detail": None})


@router.get("/runtime-compliance/deployment-report", response_model=None)
def get_deployment_report(
    _: Annotated[UserContext, Depends(get_current_user)],
    format: str = Query("json"),
):
    report = build_deployment_acceptance_report()
    if format == "markdown":
        md = render_nfr08_deployment_markdown(report)
        return Response(content=md, media_type="text/markdown")
    return {
        "schemaVersion": report.schema_version,
        "reportVersion": report.report_version,
        "generatedAt": report.generated_at,
        "overallAcceptance": report.overall_acceptance,
        "opsSummary": report.ops_summary,
        "remediationIndex": report.remediation_index,
        "composeServices": list(report.compose_services),
        "forbiddenComposeHits": list(report.forbidden_compose_hits),
        "runtime": {
            "policyVersion": report.runtime.policy_version,
            "overallStatus": report.runtime.overall_status,
            "zeroThirdPartyBiRuntime": report.runtime.zero_third_party_bi_runtime,
            "scannedAt": report.runtime.scanned_at,
            "items": [
                {"id": i.id, "status": i.status, "message": i.message, "remediation": i.remediation}
                for i in report.runtime.items
            ],
        },
        "acceptanceChecklist": [
            {"id": i.id, "status": i.status, "message": i.message, "remediation": i.remediation}
            for i in report.acceptance_checklist
        ],
    }


def _report_perf_error(exc: ReportPerfError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/report-query-perf/probe", response_model=ReportPerfProbeOut)
def report_query_perf_probe(
    payload: ReportPerfProbeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> ReportPerfProbeOut | JSONResponse:
    try:
        return probe_report_perf(payload, actor)
    except ReportPerfError as exc:
        return _report_perf_error(exc)


@router.post("/report-query-perf/validate", response_model=ReportPerfValidateOut)
def report_query_perf_validate(
    payload: ReportPerfProbeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> ReportPerfValidateOut | JSONResponse:
    try:
        return validate_report_perf_config(payload, actor)
    except ReportPerfError as exc:
        return _report_perf_error(exc)


def _dashboard_sla_error(exc: DashboardSlaError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/dashboard-sla/validate", response_model=DashboardSlaValidateOut)
def dashboard_sla_validate(
    payload: DashboardSlaProbeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DashboardSlaValidateOut | JSONResponse:
    try:
        return validate_dashboard_sla(payload, actor)
    except DashboardSlaError as exc:
        return _dashboard_sla_error(exc)


@router.post("/dashboard-sla/probe", response_model=DashboardSlaProbeOut)
def dashboard_sla_probe(
    payload: DashboardSlaProbeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DashboardSlaProbeOut | JSONResponse:
    try:
        return probe_dashboard_sla(payload, actor)
    except DashboardSlaError as exc:
        return _dashboard_sla_error(exc)


@router.get("/dashboard-sla/alerts", response_model=DashboardSlaAlertsOut)
def dashboard_sla_alerts(
    _: Annotated[UserContext, Depends(get_current_user)],
    threshold_percent: float | None = Query(default=None, alias="thresholdPercent"),
) -> DashboardSlaAlertsOut | JSONResponse:
    try:
        return get_dashboard_sla_alerts(threshold_percent)
    except DashboardSlaError as exc:
        return _dashboard_sla_error(exc)


def _dashboard_first_screen_error(exc: DashboardFirstScreenError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/dashboard-first-screen/validate", response_model=DashboardFirstScreenValidateOut)
def dashboard_first_screen_validate(
    payload: DashboardFirstScreenProbeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DashboardFirstScreenValidateOut | JSONResponse:
    try:
        return validate_dashboard_first_screen(payload, actor)
    except DashboardFirstScreenError as exc:
        return _dashboard_first_screen_error(exc)


@router.post("/dashboard-first-screen/probe", response_model=DashboardFirstScreenProbeOut)
def dashboard_first_screen_probe(
    payload: DashboardFirstScreenProbeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> DashboardFirstScreenProbeOut | JSONResponse:
    try:
        return probe_dashboard_first_screen(payload, actor)
    except DashboardFirstScreenError as exc:
        return _dashboard_first_screen_error(exc)


def _https_audit_error(exc: HttpsAuditError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.get("/https-audit/status", response_model=HttpsAuditStatusOut)
def https_audit_status(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> HttpsAuditStatusOut:
    return get_https_audit_status()


@router.post("/https-audit/mask-probe", response_model=HttpsAuditMaskProbeOut)
def https_audit_mask_probe(
    payload: HttpsAuditMaskProbeIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> HttpsAuditMaskProbeOut | JSONResponse:
    try:
        return probe_https_mask(payload, actor)
    except HttpsAuditError as exc:
        return _https_audit_error(exc)


@router.get("/https-audit/audit-probe", response_model=AuditProbeOut)
def https_audit_probe(
    actor: Annotated[UserContext, Depends(get_current_user)],
) -> AuditProbeOut | JSONResponse:
    try:
        return export_audit_probe(actor)
    except HttpsAuditError as exc:
        return _https_audit_error(exc)
