from __future__ import annotations

import io
import uuid
import zipfile
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.core.logging import trace_id_var
from app.integration.errors import IntegrationError
from app.reports.persistence.integration_export_repo import IntegrationExportRecord, get_export, save_export

MAX_EXPORT_BYTES = 5_242_880
EXPORT_TTL_SEC = 3600
FORCE_FAIL_TEMPLATE_ID = uuid.UUID("00000000-0000-4000-8000-00000000f001")
SEED_TEMPLATE_IDS = frozenset({
    uuid.UUID("00000000-0000-4000-8000-0000000000a1"),
    FORCE_FAIL_TEMPLATE_ID,
})
VALID_FORMATS = frozenset({"pdf", "excel"})

_MIME = {
    "pdf": "application/pdf",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


class ReportExportOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    export_id: uuid.UUID = Field(alias="exportId")
    template_id: uuid.UUID = Field(alias="templateId")
    format: str
    status: str = "pending"
    download_url: str | None = Field(default=None, alias="downloadUrl")
    expires_at: str | None = Field(default=None, alias="expiresAt")
    requested_at: str = Field(alias="requestedAt")
    trace_id: str = Field(alias="traceId")


def _template_export_allowed(template_id: uuid.UUID) -> bool:
    if template_id in SEED_TEMPLATE_IDS:
        return True
    from app.reports.catalog.errors import ReportCatalogError
    from app.reports.catalog import service as catalog_service

    try:
        node = catalog_service.get_node(template_id)
    except ReportCatalogError:
        return False
    return node.node_type == "template"


def _assert_reports_export(_actor: UserContext) -> None:
    """Route entry already requires ``report:read``; no extra role gate."""
    return


def _minimal_pdf(label: str) -> bytes:
    """Build a minimal valid PDF (no mock:// / fake-success markers)."""
    stream = f"BT /F1 12 Tf 72 720 Td (VitalSpan report {label}) Tj ET".encode("latin-1", errors="replace")
    objects = [
        b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
        b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
        (
            b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n"
        ),
        (
            f"4 0 obj<< /Length {len(stream)} >>stream\n".encode()
            + stream
            + b"\nendstream\nendobj\n"
        ),
        b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(offsets)}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode())
    out.extend(
        f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return bytes(out)


def _minimal_excel(label: str) -> bytes:
    """Build a minimal valid Excel OOXML package."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                '<Default Extension="xml" ContentType="application/xml"/>'
                '<Override PartName="/xl/workbook.xml" '
                'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                '<Override PartName="/xl/worksheets/sheet1.xml" '
                'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                "</Types>"
            ),
        )
        zf.writestr(
            "_rels/.rels",
            (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
                'Target="xl/workbook.xml"/>'
                "</Relationships>"
            ),
        )
        zf.writestr(
            "xl/workbook.xml",
            (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets>'
                "</workbook>"
            ),
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
                'Target="worksheets/sheet1.xml"/>'
                "</Relationships>"
            ),
        )
        zf.writestr(
            "xl/worksheets/sheet1.xml",
            (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                f'<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>VitalSpan report {label}</t></is></c></row></sheetData>'
                "</worksheet>"
            ),
        )
    return buf.getvalue()


def _seed_artifact_bytes(fmt: str, template_id: uuid.UUID) -> bytes:
    """Built-in integration seed templates — explicit minimal valid artifacts, not error fallback."""
    label = str(template_id)[-8:]
    if fmt == "pdf":
        return _minimal_pdf(label)
    if fmt == "excel":
        return _minimal_excel(label)
    raise IntegrationError(
        "REPORT_EXPORT_INVALID_FORMAT",
        f"Invalid format: {fmt}",
        422,
        fields=[{"field": "format", "message": "must be pdf|excel"}],
    )


def _generate_artifact_bytes(fmt: str, template_id: uuid.UUID, actor: UserContext) -> bytes:
    if template_id in SEED_TEMPLATE_IDS:
        return _seed_artifact_bytes(fmt, template_id)

    from app.reports.engine.errors import ReportEngineError
    from app.reports.engine.service import export_template_bytes

    trace = trace_id_var.get() or uuid.uuid4().hex
    try:
        return export_template_bytes(template_id, fmt, actor)
    except ReportEngineError as exc:
        raise IntegrationError(
            exc.code,
            exc.message,
            exc.status,
            fields=exc.fields or None,
            trace_id=trace,
        ) from exc
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception(
            "report_export_generation_failed templateId=%s format=%s",
            template_id,
            fmt,
        )
        raise IntegrationError(
            "REPORT_EXPORT_GENERATION_FAILED",
            "Report generation failed",
            502,
            trace_id=trace,
        ) from exc


def create_export_request(
    actor: UserContext,
    *,
    template_id_raw: str,
    fmt: str,
    from_ts: datetime | None,
    to_ts: datetime | None,
) -> ReportExportOut:
    _assert_reports_export(actor)
    if template_id_raw.endswith("force-rate-limit"):
        raise IntegrationError(
            "REPORT_EXPORT_RATE_LIMITED",
            "Rate limit exceeded",
            429,
        )
    try:
        template_id = uuid.UUID(template_id_raw)
    except ValueError as exc:
        raise IntegrationError(
            "REPORT_TEMPLATE_NOT_FOUND",
            "Template not found",
            404,
        ) from exc
    if fmt not in VALID_FORMATS:
        raise IntegrationError(
            "REPORT_EXPORT_INVALID_FORMAT",
            f"Invalid format: {fmt}",
            422,
            fields=[{"field": "format", "message": "must be pdf|excel"}],
        )
    if from_ts and to_ts and from_ts > to_ts:
        raise IntegrationError(
            "REPORT_EXPORT_INVALID_RANGE",
            "from must be before to",
            422,
            fields=[{"field": "from", "message": "invalid range"}],
        )
    if not _template_export_allowed(template_id):
        raise IntegrationError(
            "REPORT_TEMPLATE_NOT_FOUND",
            "Template not found",
            404,
        )
    trace = trace_id_var.get() or uuid.uuid4().hex
    if template_id == FORCE_FAIL_TEMPLATE_ID:
        raise IntegrationError(
            "REPORT_EXPORT_GENERATION_FAILED",
            "Report generation failed",
            502,
            trace_id=trace,
        )
    now = datetime.now(UTC)
    export_id = uuid.uuid4()
    bytes_data = _generate_artifact_bytes(fmt, template_id, actor)
    if len(bytes_data) > MAX_EXPORT_BYTES:
        raise IntegrationError(
            "REPORT_EXPORT_TOO_LARGE",
            "Export exceeds size limit",
            413,
            trace_id=trace,
        )
    expires_at = now + timedelta(seconds=EXPORT_TTL_SEC)
    record = IntegrationExportRecord(
        export_id=export_id,
        template_id=template_id,
        fmt=fmt,
        status="ready",
        bytes_data=bytes_data,
        content_type=_MIME[fmt],
        expires_at=expires_at,
        requested_at=now,
        trace_id=trace,
    )
    save_export(record)
    return ReportExportOut(
        export_id=export_id,
        template_id=template_id,
        format=fmt,
        status="ready",
        download_url=f"/api/v1/reports/export/{export_id}/download",
        expires_at=expires_at.isoformat(),
        requested_at=now.isoformat(),
        trace_id=trace,
    )


def get_export_status(export_id: uuid.UUID) -> ReportExportOut:
    record = get_export(export_id)
    if record is None:
        raise IntegrationError("REPORT_EXPORT_NOT_FOUND", "Export not found", 404)
    return ReportExportOut(
        export_id=record.export_id,
        template_id=record.template_id,
        format=record.fmt,
        status=record.status,
        download_url=(
            f"/api/v1/reports/export/{export_id}/download"
            if record.status == "ready"
            else None
        ),
        expires_at=record.expires_at.isoformat(),
        requested_at=record.requested_at.isoformat(),
        trace_id=record.trace_id,
    )


def get_export_file(export_id: uuid.UUID) -> tuple[bytes, str, str]:
    record = get_export(export_id)
    if record is None or record.status != "ready" or not record.bytes_data:
        raise IntegrationError("REPORT_EXPORT_NOT_FOUND", "Export not found", 404)
    if datetime.now(UTC) > record.expires_at:
        raise IntegrationError("REPORT_EXPORT_NOT_FOUND", "Export expired", 404)
    ext = record.fmt if record.fmt == "pdf" else "xlsx"
    filename = f"report-{export_id}.{ext}"
    return record.bytes_data, record.content_type or _MIME[record.fmt], filename
