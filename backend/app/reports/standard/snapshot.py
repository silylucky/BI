from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.reports.persistence import standard_repo
from app.reports import label_translation
from app.reports.standard.schemas import RunIn, SnapshotListResponse, SnapshotOut
from app.reports.standard import service as pack_service


def _section_payload(run_out) -> dict:
    sections = run_out.render_spec.get("sections") or []
    if not sections:
        return {"columns": [], "rows": []}
    first = sections[0]
    return {"columns": first.get("columns") or [], "rows": first.get("rows") or []}


def capture_snapshot(
    db: Session,
    pack_key: str,
    theme: str,
    user: UserContext,
    *,
    period_kind: str | None = None,
    period_key: str | None = None,
    skip_acl: bool = False,
) -> SnapshotOut:
    pack = pack_service.get_pack(pack_key, user, skip_acl=skip_acl)
    run_out = pack_service.run_pack(db, pack_key, RunIn(theme=theme), user, skip_acl=skip_acl)
    kind, key = (
        (period_kind, period_key)
        if period_kind and period_key
        else pack_service.period_key_for(pack.snapshot_cron_preset)
    )
    raw = standard_repo.upsert_snapshot(pack_key, theme, kind, key, _section_payload(run_out))
    retain = pack.snapshot_retention_periods
    standard_repo.prune_snapshots(pack_key, theme, kind, retain)
    return SnapshotOut.model_validate(raw)


def capture_all_enabled_themes(db: Session, pack_key: str, user: UserContext) -> list[SnapshotOut]:
    pack = pack_service.get_pack(pack_key, user, skip_acl=True)
    results: list[SnapshotOut] = []
    for theme in pack.enabled_themes:
        results.append(capture_snapshot(db, pack_key, theme, user, skip_acl=True))
    return results


def list_snapshots(pack_key: str, theme: str | None, user: UserContext) -> SnapshotListResponse:
    from app.datasources.models import get_meta_session

    pack = pack_service.get_pack(pack_key, user)
    items: list[SnapshotOut] = []
    session = get_meta_session()
    try:
        for raw in standard_repo.list_snapshots(pack_key, theme=theme):
            item = dict(raw)
            payload = item.get("payload")
            snap_theme = item.get("theme")
            if payload and snap_theme in pack.enabled_themes:
                bindings = label_translation.standard_analysis_bindings(snap_theme, pack.field_mapping)
                if bindings:
                    translated, tmeta = label_translation.translate_table_payload(
                        session, payload, bindings,
                    )
                    item["payload"] = translated
            items.append(SnapshotOut.model_validate(item))
    finally:
        session.close()
    return SnapshotListResponse(items=items, total=len(items))
