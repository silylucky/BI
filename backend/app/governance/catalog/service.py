from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.governance.catalog.appendix_e import (
    APPENDIX_E_TAXONOMY,
    export_appendix_e_schema,
    taxonomy_as_dicts,
)
from app.governance.catalog.models import (
    VALID_CATEGORY_CODES,
    BusRegistration,
    CatalogCategory,
    CatalogEntry,
)
from app.governance.catalog.schemas import (
    AppendixETaxonomyOut,
    BusRegisterOut,
    CatalogEntryCreate,
    CatalogEntryOut,
    CatalogListResponse,
    CategoryListResponse,
    CatalogCategoryOut,
)
from app.governance.bus import poc_fsm
from app.governance.bus.poc import BusPoCAdapter, InMemoryBusPoCAdapter
from app.core.logging import trace_id_var


class CatalogError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.trace_id: str | None = None
        super().__init__(message)


_USER_CATALOG_TAXONOMY_SCOPE: dict[str, str] = {}


def set_user_catalog_taxonomy_scope(user_id: str, allowed_prefix: str) -> None:
    _USER_CATALOG_TAXONOMY_SCOPE[user_id] = allowed_prefix


def _assert_appendix_acl(actor: UserContext) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_CATALOG_TAXONOMY_SCOPE.get(actor.id, "CAT-")
    if prefix != "CAT-":
        raise CatalogError(
            "GOV_APPENDIX_E_FORBIDDEN",
            "enterprise user out of appendix-e taxonomy scope",
            403,
        )


def get_appendix_e_taxonomy() -> AppendixETaxonomyOut:
    return AppendixETaxonomyOut(
        taxonomy=taxonomy_as_dicts(),
        schema_=export_appendix_e_schema(),
    )


def get_appendix_e_taxonomy_for_actor(actor: UserContext) -> AppendixETaxonomyOut:
    _assert_appendix_acl(actor)
    return get_appendix_e_taxonomy()


def _ensure_seed_categories(db: Session) -> None:
    for cat in APPENDIX_E_TAXONOMY:
        existing = db.get(CatalogCategory, cat.code)
        if existing is None:
            db.add(
                CatalogCategory(
                    code=cat.code,
                    name=cat.name,
                    kind=cat.kind,
                    description=cat.description,
                )
            )
    db.commit()


def _entry_to_out(row: CatalogEntry) -> CatalogEntryOut:
    return CatalogEntryOut(
        id=row.id,
        name=row.name,
        http_method=row.http_method,
        path=row.path,
        category_codes=row.category_codes,
        openapi_operation_id=row.openapi_operation_id,
        status=row.status,
        created_at=row.created_at,
    )


def list_categories(db: Session) -> CategoryListResponse:
    _ensure_seed_categories(db)
    rows = db.scalars(select(CatalogCategory).order_by(CatalogCategory.code)).all()
    return CategoryListResponse(items=[CatalogCategoryOut.model_validate(r) for r in rows])


def create_entry(db: Session, payload: CatalogEntryCreate) -> CatalogEntryOut:
    _ensure_seed_categories(db)
    invalid = set(payload.category_codes) - VALID_CATEGORY_CODES
    if invalid:
        raise CatalogError(
            "CATALOG_INVALID_CATEGORY",
            f"Unknown categories: {sorted(invalid)}",
            400,
        )
    row = CatalogEntry(
        name=payload.name,
        http_method=payload.http_method,
        path=payload.path,
        category_codes=payload.category_codes,
        openapi_operation_id=payload.openapi_operation_id,
        status=payload.status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _entry_to_out(row)


def list_entries(
    db: Session,
    *,
    category: str | None,
    limit: int,
    offset: int,
) -> CatalogListResponse:
    _ensure_seed_categories(db)
    if category is not None and category not in VALID_CATEGORY_CODES:
        raise CatalogError("CATALOG_INVALID_CATEGORY", f"Unknown category: {category}", 400)
    rows = list(db.scalars(select(CatalogEntry).order_by(CatalogEntry.created_at.desc())).all())
    if category is not None:
        rows = [r for r in rows if category in r.category_codes]
    total = len(rows)
    page = rows[offset : offset + limit]
    return CatalogListResponse(
        items=[_entry_to_out(r) for r in page],
        total=total,
        limit=limit,
        offset=offset,
    )


def get_entry(db: Session, entry_id: uuid.UUID) -> CatalogEntryOut:
    row = db.scalar(select(CatalogEntry).where(CatalogEntry.id == entry_id))
    if row is None:
        raise CatalogError("CATALOG_ENTRY_NOT_FOUND", "Catalog entry not found", 404)
    return _entry_to_out(row)


def delete_entry(db: Session, entry_id: uuid.UUID) -> None:
    row = db.scalar(select(CatalogEntry).where(CatalogEntry.id == entry_id))
    if row is None:
        raise CatalogError("CATALOG_ENTRY_NOT_FOUND", "Catalog entry not found", 404)
    db.delete(row)
    db.commit()


def publish_entry(db: Session, entry_id: uuid.UUID) -> CatalogEntryOut:
    row = db.scalar(select(CatalogEntry).where(CatalogEntry.id == entry_id))
    if row is None:
        raise CatalogError("CATALOG_ENTRY_NOT_FOUND", "Catalog entry not found", 404)
    if row.status == "published":
        return _entry_to_out(row)
    if row.status != "draft":
        raise CatalogError(
            "CATALOG_INVALID_STATUS",
            f"Cannot publish from status {row.status}",
            400,
        )
    row.status = "published"
    db.commit()
    db.refresh(row)
    return _entry_to_out(row)


_default_bus_adapter: BusPoCAdapter = InMemoryBusPoCAdapter()


def register_entry_to_bus(
    db: Session,
    entry_id: uuid.UUID,
    *,
    adapter: BusPoCAdapter | None = None,
) -> tuple[BusRegisterOut, bool]:
    try:
        entry = get_entry(db, entry_id)
    except CatalogError:
        raise CatalogError("CATALOG_ENTRY_NOT_FOUND", "Catalog entry not found", 404) from None

    if entry.status == "draft":
        raise CatalogError("BUS_ENTRY_NOT_PUBLISHABLE", "Draft entry cannot be published", 400)

    trace_id = trace_id_var.get() or uuid.uuid4().hex
    existing = db.scalar(
        select(BusRegistration).where(
            BusRegistration.catalog_entry_id == entry_id,
            BusRegistration.status == "succeeded",
        )
    )
    if existing is not None:
        poc_fsm.transition_semi_auto_fsm(entry_id, "registered")
        return (
            BusRegisterOut(
                id=existing.id,
                status=existing.status,
                trace_id=existing.trace_id,
                bus_response=existing.bus_payload,
            ),
            False,
        )

    poc_fsm.transition_semi_auto_fsm(entry_id, "pending")
    bus = adapter or _default_bus_adapter
    result = bus.register(entry=entry, trace_id=trace_id)

    if result.status == "failed":
        code = result.error_code or "BUS_REGISTRATION_FAILED"
        status_map = {
            "BUS_REGISTRATION_REJECTED": 502,
            "BUS_REGISTRATION_SERVER_ERROR": 502,
            "BUS_REGISTRATION_TIMEOUT": 504,
            "BUS_REGISTRATION_CLIENT_ERROR": 400,
            "BUS_ENTRY_NOT_PUBLISHABLE": 400,
        }
        status = status_map.get(code, 400)
        poc_fsm.transition_semi_auto_fsm(entry_id, "failed")
        err = CatalogError(code, result.error_message or "Bus registration failed", status)
        err.trace_id = trace_id
        raise err

    row = BusRegistration(
        catalog_entry_id=entry_id,
        status="succeeded",
        trace_id=trace_id,
        bus_payload=result.bus_payload,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    poc_fsm.transition_semi_auto_fsm(entry_id, "registered")
    return (
        BusRegisterOut(
            id=row.id,
            status=row.status,
            trace_id=row.trace_id,
            bus_response=result.bus_payload,
        ),
        True,
    )
