from __future__ import annotations

import re
from collections.abc import Callable
from typing import TypeVar

from sqlalchemy.orm import Session

from app.datasources.models import get_meta_session
from app.metadata.entity import entity_repo
from app.metadata.entity.errors import EntityTypeError
from app.metadata.entity.schemas import (
    EntityQueryBindingsOut,
    EntityTypeCreate,
    EntityTypeOut,
    EntityTypeUpdate,
    EntityTypeValidateOut,
)
from app.metadata.entity.validation import (
    build_readonly_query_bindings,
    validate_entity_schema_payload,
)
from app.metadata.entity.schemas import _DEFAULT_LIFECYCLE
from app.metadata.physical import service as physical_service
from app.metadata.physical.errors import PhysicalTableError

_ATTR_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
T = TypeVar("T")


class _StoreCompat:
    """Test helper: `.clear()` wipes ORM rows."""

    def clear(self) -> None:
        session = get_meta_session()
        try:
            entity_repo.clear_all(session)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


_store = _StoreCompat()


class _RefCountsCompat:
    """Test compat: ref counts live in entity_types.ref_count column."""

    def clear(self) -> None:
        pass

    def get(self, type_code: str, default: int = 0) -> int:
        session = get_meta_session()
        try:
            if entity_repo.get(session, type_code) is None:
                return default
            return entity_repo.ref_count(session, type_code)
        finally:
            session.close()


_ref_counts = _RefCountsCompat()


def _with_session(fn: Callable[[Session], T]) -> T:
    session = get_meta_session()
    try:
        result = fn(session)
        return result
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _to_out(record: dict) -> EntityTypeOut:
    return EntityTypeOut.model_validate(record)


def _validate_attributes(attrs: list) -> None:
    for attr in attrs:
        if not _ATTR_RE.match(attr.name):
            raise EntityTypeError("META_ENTITY_TYPE_INVALID_ATTR", "Invalid attribute name", 422)


def _apply_physical_mapping(session: Session, type_code: str, physical_fqn: str | None) -> None:
    if not physical_fqn:
        return
    try:
        physical = physical_service.get_physical_table(physical_fqn)
    except PhysicalTableError as exc:
        raise EntityTypeError("META_PHYSICAL_NOT_FOUND", exc.message, 422) from exc
    existing = physical.entity_type_code
    if existing and existing != type_code:
        raise EntityTypeError(
            "META_ENTITY_TYPE_MAPPING_CONFLICT",
            f"physical table already mapped to {existing}",
            409,
        )
    if not existing:
        physical_service.bind_entity_type_code(physical_fqn, type_code)
        increment_reference(type_code)


def create_entity_type(payload: EntityTypeCreate) -> EntityTypeOut:
    def _run(session: Session) -> EntityTypeOut:
        if entity_repo.get(session, payload.type_code) is not None:
            raise EntityTypeError("META_ENTITY_TYPE_CONFLICT", "Entity type already exists", 409)
        _validate_attributes(payload.attributes)
        lifecycle = payload.lifecycle_states or list(_DEFAULT_LIFECYCLE)
        validate_entity_schema_payload(
            payload.type_code, payload.display_name, payload.attributes, lifecycle
        )
        record = {
            "typeCode": payload.type_code,
            "displayName": payload.display_name,
            "attributes": [a.model_dump(by_alias=True) for a in payload.attributes],
            "lifecycleStates": lifecycle,
            "physicalTableFqn": payload.physical_table_fqn,
        }
        entity_repo.create(session, record)
        _apply_physical_mapping(session, payload.type_code, payload.physical_table_fqn)
        return _to_out(record)

    return _with_session(_run)


def list_entity_types() -> list[EntityTypeOut]:
    def _run(session: Session) -> list[EntityTypeOut]:
        return [_to_out(r) for r in entity_repo.list_all(session)]

    return _with_session(_run)


def get_entity_type(type_code: str) -> EntityTypeOut:
    def _run(session: Session) -> EntityTypeOut:
        record = entity_repo.get(session, type_code)
        if record is None:
            raise EntityTypeError("META_ENTITY_TYPE_NOT_FOUND", "Entity type not found", 404)
        return _to_out(record)

    return _with_session(_run)


def validate_entity_type_ref(type_code: str) -> EntityTypeOut:
    return get_entity_type(type_code)


def update_entity_type(type_code: str, payload: EntityTypeUpdate) -> EntityTypeOut:
    def _run(session: Session) -> EntityTypeOut:
        existing = entity_repo.get(session, type_code)
        if existing is None:
            raise EntityTypeError("META_ENTITY_TYPE_NOT_FOUND", "Entity type not found", 404)
        _validate_attributes(payload.attributes)
        lifecycle = payload.lifecycle_states or existing["lifecycleStates"]
        validate_entity_schema_payload(type_code, payload.display_name, payload.attributes, lifecycle)
        record = {
            "typeCode": type_code,
            "displayName": payload.display_name,
            "attributes": [a.model_dump(by_alias=True) for a in payload.attributes],
            "lifecycleStates": lifecycle,
            "physicalTableFqn": payload.physical_table_fqn
            if payload.physical_table_fqn is not None
            else existing.get("physicalTableFqn"),
        }
        entity_repo.update(session, type_code, record)
        if payload.physical_table_fqn is not None:
            _apply_physical_mapping(session, type_code, payload.physical_table_fqn)
        return _to_out(record)

    return _with_session(_run)


def delete_entity_type(type_code: str) -> None:
    def _run(session: Session) -> None:
        if entity_repo.get(session, type_code) is None:
            raise EntityTypeError("META_ENTITY_TYPE_NOT_FOUND", "Entity type not found", 404)
        if entity_repo.ref_count(session, type_code) > 0:
            raise EntityTypeError("META_ENTITY_TYPE_IN_USE", "Entity type referenced by mappings", 409)
        entity_repo.remove(session, type_code)

    _with_session(_run)


def increment_reference(type_code: str) -> None:
    def _run(session: Session) -> None:
        entity_repo.increment_ref(session, type_code)

    _with_session(_run)


def decrement_reference(type_code: str) -> None:
    def _run(session: Session) -> None:
        entity_repo.decrement_ref(session, type_code)

    _with_session(_run)


def validate_entity_type_draft(payload: EntityTypeCreate) -> EntityTypeValidateOut:
    _validate_attributes(payload.attributes)
    lifecycle = payload.lifecycle_states or list(_DEFAULT_LIFECYCLE)
    validate_entity_schema_payload(
        payload.type_code, payload.display_name, payload.attributes, lifecycle
    )
    return EntityTypeValidateOut(valid=True)


def get_query_bindings(type_code: str) -> EntityQueryBindingsOut:
    entity_type = get_entity_type(type_code)
    return build_readonly_query_bindings(entity_type)
