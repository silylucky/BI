"""Layout-aware dashboard export bytes (PDF inventory / CSV excel)."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import UTC, datetime
from typing import Any

from app.dashboard.schemas import DashboardLayout, LayoutWidget


def _escape_pdf_text(text: str) -> str:
    safe = text.encode("latin-1", errors="replace").decode("latin-1")
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _widget_position_label(widget: LayoutWidget) -> str:
    if widget.grid_x is not None and widget.col_span is not None:
        return f"grid ({widget.grid_x},{widget.grid_y or 0}) {widget.col_span}x{widget.row_span or 1}"
    if widget.x is not None and widget.width is not None:
        return f"pixel ({widget.x},{widget.y or 0}) {widget.width}x{widget.height or 0}"
    return ""


def _widget_detail(widget: LayoutWidget, index: int) -> str:
    parts = [f"{index + 1}. [{widget.type}] {widget.title}"]
    if widget.chart_config is not None:
        parts.append(f"chart={widget.chart_config.chart_type}")
    pos = _widget_position_label(widget)
    if pos:
        parts.append(pos)
    if widget.hidden:
        parts.append("hidden")
    return " | ".join(parts)


def widget_summary_lines(layout: DashboardLayout | dict[str, Any]) -> list[str]:
    parsed = layout if isinstance(layout, DashboardLayout) else DashboardLayout.model_validate(layout)
    ordered = sorted(parsed.widgets, key=lambda w: w.order)
    return [_widget_detail(widget, idx) for idx, widget in enumerate(ordered)]


def _assemble_pdf(objects: list[bytes]) -> bytes:
    header = b"%PDF-1.4\n"
    offsets: list[int] = []
    body = bytearray()
    for obj in objects:
        offsets.append(len(header) + len(body))
        body.extend(obj)
    xref_pos = len(header) + len(body)
    xref = bytearray(b"xref\n")
    xref.extend(f"0 {len(objects) + 1}\n".encode())
    xref.extend(b"0000000000 65535 f \n")
    for off in offsets:
        xref.extend(f"{off:010d} 00000 n \n".encode())
    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return header + bytes(body) + bytes(xref) + trailer


def build_dashboard_pdf(
    name: str,
    dashboard_id: uuid.UUID,
    description: str | None,
    layout: DashboardLayout | dict[str, Any],
) -> bytes:
    widget_lines = widget_summary_lines(layout)
    header_lines = [
        "VitalSpan Dashboard Export — LAYOUT INVENTORY PREVIEW",
        "NOTE: This PDF lists dashboard widgets; it is NOT a chart render snapshot.",
        f"Name: {name}",
        f"Dashboard ID: {dashboard_id}",
        f"Exported: {datetime.now(UTC).isoformat()}",
    ]
    if description:
        header_lines.append(f"Description: {description}")
    header_lines.append(f"Widget count: {len(widget_lines)}")
    header_lines.append("")
    header_lines.append("Widget inventory:")
    if widget_lines:
        header_lines.extend(widget_lines)
    else:
        header_lines.append("  (empty layout)")

    y = 750
    ops: list[str] = []
    for line in header_lines:
        ops.append(f"BT /F1 11 Tf 50 {y} Td ({_escape_pdf_text(line)}) Tj ET")
        y -= 14
        if y < 50:
            break
    stream = "\n".join(ops).encode("latin-1", errors="replace")
    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        (
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        ),
        f"4 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream\nendobj\n",
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ]
    return _assemble_pdf(objects)


def build_dashboard_excel_csv(
    name: str,
    dashboard_id: uuid.UUID,
    layout: DashboardLayout | dict[str, Any],
) -> bytes:
    parsed = layout if isinstance(layout, DashboardLayout) else DashboardLayout.model_validate(layout)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["dashboard_name", "dashboard_id", "exported_at"])
    writer.writerow([name, str(dashboard_id), datetime.now(UTC).isoformat()])
    writer.writerow([])
    writer.writerow(["order", "type", "title", "chart_type", "position", "hidden"])
    for widget in sorted(parsed.widgets, key=lambda w: w.order):
        chart_type = widget.chart_config.chart_type if widget.chart_config else ""
        writer.writerow([
            widget.order,
            widget.type,
            widget.title,
            chart_type,
            _widget_position_label(widget),
            bool(widget.hidden),
        ])
    return buf.getvalue().encode("utf-8-sig")
