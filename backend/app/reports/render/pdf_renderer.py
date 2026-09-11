"""PDF renderer from report sections (reportlab)."""

from __future__ import annotations

import io
from typing import Any
from xml.sax.saxutils import escape

from app.reports.render.pdf_fonts import resolve_report_pdf_font_name


def _section_label(section: dict[str, Any], idx: int) -> str:
    return str(
        section.get("title")
        or section.get("metricKey")
        or section.get("kind")
        or f"Section {idx + 1}"
    )


def _section_table_data(section: dict[str, Any]) -> tuple[list[str], list[list[Any]]]:
    if section.get("kind") == "crosstab":
        col_labels = [str(c) for c in (section.get("colLabels") or [])]
        row_labels = [str(r) for r in (section.get("rowLabels") or [])]
        matrix = section.get("matrix") or []
        cols = [""] + col_labels
        rows = [[row_labels[i], *[str(c) for c in matrix[i]]] for i in range(len(row_labels))]
        return cols, rows
    cols = [str(c) for c in (section.get("columns") or [])]
    return cols, list(section.get("rows") or [])


def render_pdf(title: str, sections: list[dict[str, Any]]) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError("reportlab not installed") from exc

    font_name = resolve_report_pdf_font_name()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName=font_name,
    )
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontName=font_name,
    )
    heading_style = ParagraphStyle(
        "ReportHeading",
        parent=styles["Heading2"],
        fontName=font_name,
    )
    story: list = [Paragraph(escape(title), title_style), Spacer(1, 12)]
    for idx, section in enumerate(sections):
        label = _section_label(section, idx)
        story.append(Paragraph(escape(label), heading_style))
        cols, rows = _section_table_data(section)
        if cols and rows:
            data = [cols] + [[str(c) for c in row] for row in rows]
            table = Table(data, repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("FONTNAME", (0, 0), (-1, -1), font_name),
            ]))
            story.append(table)
        elif section.get("placeholder"):
            story.append(Paragraph("(no data)", body_style))
        story.append(Spacer(1, 12))
    doc.build(story)
    return buf.getvalue()
