from __future__ import annotations

from typing import Any

from app.datasources.models import get_meta_session
from app.views import role_defaults_repo


def get_role_defaults(role_key: str) -> dict[str, Any] | None:
    session = get_meta_session()
    try:
        return role_defaults_repo.get_role_defaults(session, role_key)
    finally:
        session.close()


def set_role_defaults(role_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    session = get_meta_session()
    try:
        return role_defaults_repo.set_role_defaults(session, role_key, payload)
    finally:
        session.close()


def clear_role_defaults() -> None:
    session = get_meta_session()
    try:
        role_defaults_repo.clear_role_defaults(session)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
