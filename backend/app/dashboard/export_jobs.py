"""Dashboard export jobs (G5): visual PDF via Playwright or layout fallback."""

from __future__ import annotations

import re
import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.dashboard import service as dash_service
from app.dashboard.export_jobs_schemas import DashboardExportJobOut
from app.dashboard.export_layout import build_dashboard_excel_csv, build_dashboard_pdf
from app.dashboard.export_layout_mode import (
    EXPORT_LAYOUT_FULL_PAGE,
    MODE_LABELS,
)
from app.dashboard.export_persistence import (
    get_export_job_meta,
    read_export_job_bytes,
    save_export_job,
)
from app.dashboard.export_render import render_dashboard_visual_pdf
from app.dashboard.export_token import issue_export_token
from app.dashboard.surface_kind import layout_to_dict, read_surface_kind_from_layout

_EXPORT_JOB_URL_RE = re.compile(r"/export-jobs/([0-9a-f-]{36})/download", re.I)


def parse_export_job_id_from_download_url(download_url: str | None) -> uuid.UUID | None:
    if not download_url:
        return None
    match = _EXPORT_JOB_URL_RE.search(download_url)
    if match is None:
        return None
    try:
        return uuid.UUID(match.group(1))
    except ValueError:
        return None


def read_export_attachment(job_id: uuid.UUID) -> tuple[bytes, str, str] | None:
    """Internal delivery path: no auth check."""
    meta = get_export_job_meta(job_id)
    data = read_export_job_bytes(job_id)
    if meta is None or data is None or meta.status != "ready":
        return None
    content_type = "application/pdf" if meta.fmt == "pdf" else "application/vnd.ms-excel"
    filename = f"dashboard-{meta.dashboard_id}.{meta.fmt}"
    return data, content_type, filename


def _build_pdf_bytes(db: Session, dashboard_id: uuid.UUID, row) -> tuple[bytes, str]:
    settings = get_settings()
    surface = read_surface_kind_from_layout(row.layout_json)
    surface_key = "data_screen" if surface == "data-screen" else "dashboard"
    token = issue_export_token(dashboard_id)
    try:
        data = render_dashboard_visual_pdf(
            dashboard_id, token=token, surface=surface_key, layout_mode=EXPORT_LAYOUT_FULL_PAGE,
        )
        return data, "visual_snapshot_full_page"
    except dash_service.DashboardError:
        if settings.rpt_export_fallback:
            return (
                build_dashboard_pdf(row.name, dashboard_id, row.description, row.layout_json),
                "layout_inventory",
            )
        raise


def build_dashboard_schedule_pdf_attachments(
    db: Session,
    dashboard_id: uuid.UUID,
    actor: UserContext,
) -> list[tuple[bytes, str, str]]:
    """Scheduled delivery: single full-page HD visual snapshot PDF."""
    row = dash_service.get_dashboard(db, dashboard_id)
    layout = layout_to_dict(row.layout_json)
    settings = get_settings()
    if _count_widgets(layout) == 0 and not settings.rpt_export_fallback:
        raise dash_service.DashboardError(
            "DASHBOARD_EXPORT_EMPTY",
            "看板为空，无法导出。请先添加组件后再创建定时报告。",
            422,
        )
    surface = read_surface_kind_from_layout(row.layout_json)
    surface_key = "data_screen" if surface == "data-screen" else "dashboard"
    token = issue_export_token(dashboard_id)
    try:
        data = render_dashboard_visual_pdf(
            dashboard_id, token=token, surface=surface_key, layout_mode=EXPORT_LAYOUT_FULL_PAGE,
        )
        return [(data, "application/pdf", f"dashboard-{dashboard_id}-可视化报告.pdf")]
    except dash_service.DashboardError:
        if settings.rpt_export_fallback:
            data = build_dashboard_pdf(row.name, dashboard_id, row.description, row.layout_json)
            return [(data, "application/pdf", f"dashboard-{dashboard_id}-可视化报告.pdf")]
        raise


def _count_widgets(layout: dict) -> int:
    widgets = layout.get("widgets") or []
    return len(widgets) if isinstance(widgets, list) else 0


def submit_dashboard_export(
    db: Session,
    dashboard_id: uuid.UUID,
    fmt: str,
    actor: UserContext,
) -> DashboardExportJobOut:
    if fmt not in {"pdf", "excel"}:
        raise dash_service.DashboardError("DASH_EXPORT_INVALID_FORMAT", "Invalid export format", 422)
    row = dash_service.get_dashboard(db, dashboard_id)
    dash_service.assert_dashboard_access(db, actor, dashboard_id, row.created_by, slug=row.slug)
    layout = layout_to_dict(row.layout_json)
    settings = get_settings()
    if _count_widgets(layout) == 0 and not (fmt == "excel" or settings.rpt_export_fallback):
        raise dash_service.DashboardError(
            "DASHBOARD_EXPORT_EMPTY",
            "看板为空，无法导出。请先添加组件后再创建定时报告。",
            422,
        )
    job_id = uuid.uuid4()
    artifact_kind: str | None = None
    if fmt == "pdf":
        data, artifact_kind = _build_pdf_bytes(db, dashboard_id, row)
    else:
        data = build_dashboard_excel_csv(row.name, dashboard_id, layout)
        artifact_kind = "layout_inventory"
    save_export_job(
        job_id=job_id,
        dashboard_id=dashboard_id,
        owner_id=actor.id,
        fmt=fmt,
        artifact_kind=artifact_kind,
        data=data,
    )
    return DashboardExportJobOut(
        jobId=job_id,
        status="ready",
        downloadUrl=f"/api/v1/dashboards/export-jobs/{job_id}/download",
        artifactKind=artifact_kind,
    )


def get_dashboard_export_job(job_id: uuid.UUID, actor: UserContext) -> DashboardExportJobOut:
    meta = get_export_job_meta(job_id)
    if meta is None:
        raise dash_service.DashboardError("DASH_EXPORT_JOB_NOT_FOUND", "Export job not found", 404)
    if meta.owner_id != actor.id and not actor.is_root:
        raise dash_service.DashboardError("DASH_EXPORT_FORBIDDEN", "Forbidden", 403)
    return DashboardExportJobOut(
        jobId=meta.job_id,
        status=meta.status,
        downloadUrl=f"/api/v1/dashboards/export-jobs/{job_id}/download",
        artifactKind=meta.artifact_kind,
    )


def read_dashboard_export_bytes(job_id: uuid.UUID, actor: UserContext) -> tuple[bytes, str, str]:
    meta = get_export_job_meta(job_id)
    if meta is None:
        raise dash_service.DashboardError("DASH_EXPORT_JOB_NOT_FOUND", "Export job not found", 404)
    if meta.owner_id != actor.id and not actor.is_root:
        raise dash_service.DashboardError("DASH_EXPORT_FORBIDDEN", "Forbidden", 403)
    data = read_export_job_bytes(job_id)
    if data is None or meta.status != "ready":
        raise dash_service.DashboardError("DASH_EXPORT_NOT_READY", "Export not ready", 409)
    content_type = "application/pdf" if meta.fmt == "pdf" else "application/vnd.ms-excel"
    filename = f"dashboard-{meta.dashboard_id}.{meta.fmt}"
    return data, content_type, filename


def reset_export_jobs_for_tests() -> None:
    from app.dashboard.export_persistence import reset_export_persistence_for_tests

    reset_export_persistence_for_tests()
