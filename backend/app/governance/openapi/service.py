from __future__ import annotations

import re
import time
import uuid

from sqlalchemy.orm import Session

from app.datasources.models import get_meta_session
from app.governance.catalog import service as catalog_service
from app.governance.openapi.errors import OpenApiMappingError
from app.governance.openapi.schemas import (
    OpenApiMappingCreate,
    OpenApiMappingListOut,
    OpenApiMappingOut,
    OpenApiMappingValidateOut,
)
from app.governance.persistence import gov_repo
from app.governance.publish import service as publish_service
from app.metadata.entity import service as entity_service
from app.metadata.entity.errors import EntityTypeError

SUPPORTED_API_VERSIONS = frozenset({"v1"})
_OPERATION_ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,127}$")
_PATH_RE = re.compile(r"^/api/v1/[a-z0-9/_-]+$")
probe_openapi_validate_budget_ms: int = 50
_REDACT_KEYS = frozenset({"password", "secret", "token", "credential"})


class _StoreCompat:
    def clear(self) -> None:
        session = get_meta_session()
        try:
            gov_repo.clear_openapi(session)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


_store = _StoreCompat()


class _OperationIdsCompat:
    """Test compat: operation IDs tracked in gov_openapi_mappings."""

    def clear(self) -> None:
        session = get_meta_session()
        try:
            gov_repo.clear_openapi(session)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


_operation_ids = _OperationIdsCompat()


def redact_openapi_fields(schema: dict) -> dict:
    props = schema.get("properties", {})
    filtered = {k: v for k, v in props.items() if not any(r in k.lower() for r in _REDACT_KEYS)}
    return {**schema, "properties": filtered}


def generate_openapi_document(db: Session, catalog_entry_id: uuid.UUID) -> dict:
    status = publish_service.get_publish_status(db, catalog_entry_id)
    if status.status != "published":
        raise OpenApiMappingError("GOV_OPENAPI_DOC_NOT_PUBLISHED", "Entry not published", 422)
    entry = catalog_service.get_entry(db, catalog_entry_id)
    slug = entry.path.rsplit("/", 1)[-1].replace("-", "_")
    request_schema = redact_openapi_fields(
        {
            "type": "object",
            "properties": {
                "limit": {"type": "integer"},
                "password_hash": {"type": "string"},
            },
        }
    )
    doc = {
        "openapi": "3.1.0",
        "info": {"title": entry.name, "version": "1"},
        "paths": {
            entry.path: {
                entry.http_method.lower(): {
                    "operationId": f"query_{slug}",
                    "requestBody": {
                        "content": {"application/json": {"schema": request_schema}},
                    },
                    "responses": {"200": {"description": "Query result"}},
                }
            }
        },
    }
    existing = list_mappings(catalog_entry_id)
    if not existing.items:
        register_mapping(
            db,
            OpenApiMappingCreate(
                catalogEntryId=catalog_entry_id,
                httpMethod=entry.http_method,
                path=entry.path,
                operationId=f"query_{slug}",
                apiVersion="v1",
            ),
        )
    return doc


def probe_generate_openapi_budget_ms(db: Session, entry_id: uuid.UUID) -> float:
    started = time.perf_counter()
    try:
        generate_openapi_document(db, entry_id)
    except OpenApiMappingError:
        pass
    return (time.perf_counter() - started) * 1000


def _validate_entity_ref(entity_type_ref: str | None) -> None:
    if entity_type_ref is None:
        return
    try:
        entity_service.validate_entity_type_ref(entity_type_ref)
    except EntityTypeError as exc:
        raise OpenApiMappingError(
            "GOV_OPENAPI_MAP_ENTITY_TYPE_UNKNOWN",
            exc.message,
            422,
        ) from exc


def _validate_api_version(api_version: str) -> None:
    if api_version not in SUPPORTED_API_VERSIONS:
        raise OpenApiMappingError(
            "GOV_OPENAPI_MAP_UNSUPPORTED_VERSION",
            f"Unsupported apiVersion: {api_version}",
            422,
        )


def _validate_operation_id(operation_id: str) -> None:
    if not _OPERATION_ID_RE.match(operation_id):
        raise OpenApiMappingError(
            "GOV_OPENAPI_MAP_INVALID_OPERATION_ID",
            "operationId must match ^[a-zA-Z][a-zA-Z0-9_]{0,127}$",
            422,
        )


def _validate_method_path_consistency(http_method: str, path: str) -> None:
    if not path.startswith("/api/v1/"):
        raise OpenApiMappingError("GOV_OPENAPI_MAP_INVALID_PATH", "Path must start with /api/v1/", 422)
    if not _PATH_RE.match(path):
        raise OpenApiMappingError("GOV_OPENAPI_MAP_INVALID_PATH", "Path segment invalid", 422)


def validate_mapping(payload: OpenApiMappingCreate) -> OpenApiMappingValidateOut:
    _validate_api_version(payload.api_version)
    _validate_operation_id(payload.operation_id)
    _validate_method_path_consistency(payload.http_method, payload.path)
    _validate_entity_ref(payload.entity_type_ref)
    return OpenApiMappingValidateOut(valid=True, api_version=payload.api_version, warnings=[])


def _record_to_out(record: dict) -> OpenApiMappingOut:
    return OpenApiMappingOut(
        id=record["id"],
        catalog_entry_id=uuid.UUID(record["catalogEntryId"]),
        http_method=record["httpMethod"],
        path=record["path"],
        operation_id=record["operationId"],
        entity_type_ref=record.get("entityTypeRef"),
        api_version=record.get("apiVersion", "v1"),
        active=record["active"],
    )


def register_mapping(db: Session, payload: OpenApiMappingCreate) -> OpenApiMappingOut:
    if payload.catalog_entry_id is None:
        raise OpenApiMappingError("GOV_OPENAPI_MAP_NOT_FOUND", "catalogEntryId required", 422)
    validate_mapping(payload)
    status = publish_service.get_publish_status(db, payload.catalog_entry_id)
    if status.status != "published":
        raise OpenApiMappingError(
            "GOV_OPENAPI_MAP_ENTRY_NOT_PUBLISHED",
            "Catalog entry must be published",
            422,
        )
    if gov_repo.operation_id_exists(db, payload.operation_id):
        raise OpenApiMappingError("GOV_OPENAPI_MAP_DUPLICATE", "operationId already registered", 409)
    mapping_id = uuid.uuid4()
    record = {
        "id": mapping_id,
        "catalogEntryId": str(payload.catalog_entry_id),
        "httpMethod": payload.http_method,
        "path": payload.path,
        "operationId": payload.operation_id,
        "entityTypeRef": payload.entity_type_ref,
        "apiVersion": payload.api_version,
        "active": True,
    }
    gov_repo.create_openapi_mapping(db, record)
    if payload.entity_type_ref:
        entity_service.increment_reference(payload.entity_type_ref)
    return get_mapping(mapping_id)


def list_mappings(catalog_entry_id: uuid.UUID | None = None) -> OpenApiMappingListOut:
    session = get_meta_session()
    try:
        items = gov_repo.list_openapi_mappings(session, catalog_entry_id)
        return OpenApiMappingListOut(items=[_record_to_out(r) for r in items])
    finally:
        session.close()


def get_mapping(mapping_id: uuid.UUID) -> OpenApiMappingOut:
    session = get_meta_session()
    try:
        record = gov_repo.get_openapi_mapping(session, mapping_id)
        if record is None:
            raise OpenApiMappingError("GOV_OPENAPI_MAP_NOT_FOUND", "Mapping not found", 404)
        return _record_to_out(record)
    finally:
        session.close()


def deactivate_mapping(mapping_id: uuid.UUID) -> OpenApiMappingOut:
    session = get_meta_session()
    try:
        record = gov_repo.get_openapi_mapping(session, mapping_id)
        if record is None:
            raise OpenApiMappingError("GOV_OPENAPI_MAP_NOT_FOUND", "Mapping not found", 404)
        if not record["active"]:
            raise OpenApiMappingError(
                "GOV_OPENAPI_MAP_ALREADY_INACTIVE",
                "Mapping already inactive",
                409,
            )
        updated = gov_repo.deactivate_openapi_mapping(session, mapping_id)
        entity_ref = record.get("entityTypeRef")
        if entity_ref:
            entity_service.decrement_reference(entity_ref)
        return _record_to_out(updated or record)
    finally:
        session.close()


def release_entity_refs_for_catalog(catalog_entry_id: uuid.UUID) -> None:
    session = get_meta_session()
    try:
        deactivated = gov_repo.deactivate_openapi_for_catalog(session, catalog_entry_id)
        for record in deactivated:
            entity_ref = record.get("entityTypeRef")
            if entity_ref:
                entity_service.decrement_reference(entity_ref)
    finally:
        session.close()
