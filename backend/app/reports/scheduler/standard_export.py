from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.models import get_meta_engine
from app.reports.render.render_from_spec import content_type_for, render_document
from app.reports.standard.labels import THEME_LABELS
from app.reports.standard.schemas import RunIn
from app.reports.standard.service import get_pack, run_pack


def export_standard_attachments(
    pack_key: str,
    formats: list[str],
    actor: UserContext,
) -> tuple[str, str | None, list[tuple[bytes, str, str]], str | None]:
    pack = get_pack(pack_key, actor)
    sections: list[dict] = []
    export_error: str | None = None
    try:
        with Session(bind=get_meta_engine()) as db:
            for theme in pack.enabled_themes:
                run_out = run_pack(db, pack_key, RunIn(theme=theme), actor)
                for section in run_out.render_spec.get("sections") or []:
                    sections.append({**section, "title": THEME_LABELS.get(theme, theme)})
    except Exception as exc:
        from app.reports.scheduler.user_errors import user_visible_export_error

        return f"semi://reports/standard/{pack_key}", None, [], user_visible_export_error(exc)

    if not sections:
        return f"semi://reports/standard/{pack_key}", None, [], "标准分析未返回任何主题数据"

    attachments: list[tuple[bytes, str, str]] = []
    for fmt in formats:
        if fmt != "pdf":
            if export_error is None:
                export_error = "标准分析定时投递当前仅支持 PDF 附件"
            continue
        try:
            data = render_document({"sections": sections}, fmt, title=pack.display_name)
            mime = content_type_for(fmt)
            attachments.append((data, mime, f"standard-{pack_key}.pdf"))
        except Exception as exc:
            from app.reports.scheduler.user_errors import user_visible_export_error

            export_error = user_visible_export_error(exc)
            break

    kind = "standard_render" if attachments else None
    artifact_ref = f"semi://reports/standard/{pack_key}/{uuid.uuid4()}"
    return artifact_ref, kind, attachments, export_error
