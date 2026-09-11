from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.metadata._acl import _assert_meta_write
from app.metadata.glossary.models import GlossaryTerm, TermPhysicalMapping
from app.metadata.glossary.schemas import (
    GlossaryError,
    META_TERM_FORBIDDEN,
    TermFieldMappingItem,
)

_FQN_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{1,63}$")
_COLUMN_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


def _forbidden() -> GlossaryError:
    return GlossaryError(META_TERM_FORBIDDEN, "insufficient role to modify glossary terms", 403)


def _validate_item(item: TermFieldMappingItem) -> None:
    if not _FQN_RE.match(item.table_fqn):
        raise GlossaryError(
            "META_TERM_MAPPING_INVALID_FQN",
            "Invalid tableFqn",
            422,
            fields=[{"field": "tableFqn", "message": "invalid pattern"}],
        )
    if not _COLUMN_RE.match(item.column_name):
        raise GlossaryError(
            "META_TERM_MAPPING_INVALID_COLUMN",
            "Invalid columnName",
            422,
            fields=[{"field": "columnName", "message": "invalid pattern"}],
        )


def list_field_mappings(session: Session, term_id: uuid.UUID) -> list[TermPhysicalMapping]:
    term = session.get(GlossaryTerm, term_id)
    if term is None:
        raise GlossaryError("META_TERM_NOT_FOUND", "Term not found", 404)
    return list(
        session.scalars(
            select(TermPhysicalMapping)
            .where(TermPhysicalMapping.term_id == term_id)
            .order_by(TermPhysicalMapping.table_fqn, TermPhysicalMapping.column_name)
        )
    )


def replace_field_mappings(
    session: Session,
    term_id: uuid.UUID,
    items: list[TermFieldMappingItem],
    user: UserContext,
) -> list[TermPhysicalMapping]:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    term = session.get(GlossaryTerm, term_id)
    if term is None:
        raise GlossaryError("META_TERM_NOT_FOUND", "Term not found", 404)
    seen: set[tuple[str, str]] = set()
    for item in items:
        _validate_item(item)
        key = (item.table_fqn.lower(), item.column_name.lower())
        if key in seen:
            raise GlossaryError(
                "META_TERM_MAPPING_DUPLICATE",
                "Duplicate mapping in batch",
                422,
                fields=[{"field": "tableFqn", "message": f"duplicate: {item.table_fqn}.{item.column_name}"}],
            )
        seen.add(key)
    existing = list(
        session.scalars(select(TermPhysicalMapping).where(TermPhysicalMapping.term_id == term_id))
    )
    for row in existing:
        session.delete(row)
    created: list[TermPhysicalMapping] = []
    for item in items:
        row = TermPhysicalMapping(
            term_id=term_id,
            table_fqn=item.table_fqn.lower(),
            column_name=item.column_name.lower(),
        )
        session.add(row)
        created.append(row)
    session.commit()
    for row in created:
        session.refresh(row)
    return created
