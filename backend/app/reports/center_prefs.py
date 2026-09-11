"""Report center favorites and recent views."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.models import get_meta_engine
from app.reports.contract import CenterResourceType, ReportCenterPreferencesOut
from app.reports.models import ReportRecentView, ReportUserFavorite

_MAX_RECENT = 20
_MEMORY_FAVORITES: dict[str, list[dict[str, str]]] = {}
_MEMORY_RECENT: dict[str, list[dict[str, str]]] = {}


def _favorite_key(user_id: str, resource_type: str, resource_id: str) -> tuple[str, str, str]:
    return user_id, resource_type, resource_id


def _clear_memory_cache(user_id: str) -> None:
    _MEMORY_FAVORITES.pop(user_id, None)
    _MEMORY_RECENT.pop(user_id, None)


def _read_from_db(user: UserContext) -> ReportCenterPreferencesOut:
    with Session(bind=get_meta_engine()) as db:
        favorites = db.scalars(
            select(ReportUserFavorite).where(ReportUserFavorite.user_id == user.id),
        ).all()
        recent = db.scalars(
            select(ReportRecentView)
            .where(ReportRecentView.user_id == user.id)
            .order_by(ReportRecentView.viewed_at.desc())
            .limit(_MAX_RECENT),
        ).all()
        return ReportCenterPreferencesOut(
            favorites=[
                {"resourceType": f.resource_type, "resourceId": f.resource_id}
                for f in favorites
            ],
            recent=[
                {
                    "resourceType": r.resource_type,
                    "resourceId": r.resource_id,
                    "resourceLabel": r.resource_label or "",
                    "viewedAt": r.viewed_at.isoformat() if r.viewed_at else "",
                }
                for r in recent
            ],
        )


def get_preferences(user: UserContext) -> ReportCenterPreferencesOut:
    try:
        result = _read_from_db(user)
        _clear_memory_cache(user.id)
        return result
    except Exception:
        return ReportCenterPreferencesOut(
            favorites=_MEMORY_FAVORITES.get(user.id, []),
            recent=_MEMORY_RECENT.get(user.id, []),
        )


def set_favorites(user: UserContext, favorites: list[dict[str, str]]) -> ReportCenterPreferencesOut:
    cleaned = [
        {"resourceType": item["resourceType"], "resourceId": item["resourceId"]}
        for item in favorites
        if item.get("resourceType") in {t.value for t in CenterResourceType}
        and item.get("resourceId")
    ]
    with Session(bind=get_meta_engine()) as db:
        db.execute(delete(ReportUserFavorite).where(ReportUserFavorite.user_id == user.id))
        for item in cleaned:
            db.add(ReportUserFavorite(
                user_id=user.id,
                resource_type=item["resourceType"],
                resource_id=item["resourceId"],
            ))
        db.commit()
    _clear_memory_cache(user.id)
    return get_preferences(user)


def record_recent_view(
    user: UserContext,
    *,
    resource_type: str,
    resource_id: str,
    resource_label: str | None = None,
) -> None:
    if resource_type not in {t.value for t in CenterResourceType}:
        return
    entry = {
        "resourceType": resource_type,
        "resourceId": resource_id,
        "resourceLabel": resource_label or "",
        "viewedAt": datetime.now(UTC).isoformat(),
    }
    try:
        with Session(bind=get_meta_engine()) as db:
            db.add(ReportRecentView(
                user_id=user.id,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_label=resource_label,
            ))
            db.commit()
        _clear_memory_cache(user.id)
    except Exception:
        current = [e for e in _MEMORY_RECENT.get(user.id, []) if e["resourceId"] != resource_id]
        _MEMORY_RECENT[user.id] = [entry, *current][:_MAX_RECENT]


def reset_center_prefs_for_tests() -> None:
    _MEMORY_FAVORITES.clear()
    _MEMORY_RECENT.clear()
    try:
        with Session(bind=get_meta_engine()) as db:
            db.query(ReportUserFavorite).delete()
            db.query(ReportRecentView).delete()
            db.commit()
    except Exception:
        pass
