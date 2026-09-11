from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user, require_permission

PERM_READ = "metadata:read"
PERM_MANAGE = "metadata:manage"
from app.datasources.models import get_meta_session
from app.metadata.glossary import service as glossary_service
from app.metadata.glossary.schemas import GlossaryError, TermCreate, TermListResponse, TermOut, TermUpdate
from app.metadata.glossary.schemas import (
    TermFieldMappingListResponse,
    TermFieldMappingOut,
    TermFieldMappingsReplace,
)
from app.metadata.dimensions import service as dimension_service
from app.metadata.dimensions.schemas import (
    DimensionCreate,
    DimensionError,
    DimensionListResponse,
    DimensionOut,
    DimensionResolveOut,
    DimensionUpdate,
    DimensionValueListResponse,
    DimensionValueOut,
    DimensionValuesRegister,
)
from app.metadata.themes import service as themes_service
from app.metadata.themes.schemas import (
    ThemeCreate,
    ThemeError,
    ThemeListResponse,
    ThemeMove,
    ThemeOut,
    ThemeUpdate,
)
from app.metadata.entity import service as entity_service
from app.metadata.physical.errors import PhysicalTableError
from app.metadata.physical.schemas import (
    PhysicalTableOut,
    PhysicalTableRegisterFromSchemaIn,
    PhysicalTableRegisterIn,
    PhysicalTableUpdateIn,
    PhysicalTableValidateOut,
)
from app.metadata.physical import service as physical_service
from app.metadata.entity.errors import EntityTypeError
from app.metadata.entity.schemas import (
    EntityQueryBindingsOut,
    EntityTypeCreate,
    EntityTypeListOut,
    EntityTypeUpdate,
    EntityTypeValidateOut,
)

router = APIRouter(prefix="/metadata", tags=["metadata"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _glossary_error(exc: GlossaryError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _theme_error(exc: ThemeError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _dimension_error(exc: DimensionError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _entity_type_error(exc: EntityTypeError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/entity-types", response_model=EntityTypeListOut)
def list_entity_types(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> EntityTypeListOut:
    return EntityTypeListOut(items=entity_service.list_entity_types())


@router.post("/entity-types", status_code=status.HTTP_201_CREATED, response_model=None)
def create_entity_type(
    payload: EntityTypeCreate,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return entity_service.create_entity_type(payload)
    except EntityTypeError as exc:
        return _entity_type_error(exc)


@router.post("/entity-types/validate", response_model=EntityTypeValidateOut)
def validate_entity_type(
    payload: EntityTypeCreate,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return entity_service.validate_entity_type_draft(payload)
    except EntityTypeError as exc:
        return _entity_type_error(exc)


@router.get("/entity-types/{type_code}/query-bindings", response_model=EntityQueryBindingsOut)
def get_entity_query_bindings(
    type_code: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return entity_service.get_query_bindings(type_code)
    except EntityTypeError as exc:
        return _entity_type_error(exc)


@router.get("/entity-types/{type_code}", response_model=None)
def get_entity_type(
    type_code: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return entity_service.get_entity_type(type_code)
    except EntityTypeError as exc:
        return _entity_type_error(exc)


@router.put("/entity-types/{type_code}", response_model=None)
def update_entity_type(
    type_code: str,
    payload: EntityTypeUpdate,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return entity_service.update_entity_type(type_code, payload)
    except EntityTypeError as exc:
        return _entity_type_error(exc)


@router.delete("/entity-types/{type_code}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_entity_type(
    type_code: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        entity_service.delete_entity_type(type_code)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except EntityTypeError as exc:
        return _entity_type_error(exc)


@router.get("/glossary", response_model=TermListResponse)
def list_glossary_terms(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    code_prefix: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> TermListResponse:
    items, total = glossary_service.list_terms(db, code_prefix, limit, offset)
    return TermListResponse(items=[TermOut.model_validate(t) for t in items], total=total)


@router.post("/glossary", response_model=TermOut, status_code=status.HTTP_201_CREATED)
def create_glossary_term(
    payload: TermCreate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> TermOut | JSONResponse:
    try:
        term = glossary_service.create_term(db, payload, actor)
    except GlossaryError as exc:
        return _glossary_error(exc)
    return TermOut.model_validate(term)


@router.get("/glossary/{term_id}", response_model=TermOut)
def get_glossary_term(
    term_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> TermOut | JSONResponse:
    try:
        term = glossary_service.get_term(db, term_id)
    except GlossaryError as exc:
        return _glossary_error(exc)
    return TermOut.model_validate(term)


@router.put("/glossary/{term_id}", response_model=TermOut)
def update_glossary_term(
    term_id: uuid.UUID,
    payload: TermUpdate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> TermOut | JSONResponse:
    try:
        term = glossary_service.update_term(db, term_id, payload, actor)
    except GlossaryError as exc:
        return _glossary_error(exc)
    return TermOut.model_validate(term)


@router.delete("/glossary/{term_id}", response_model=None)
def delete_glossary_term(
    term_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        glossary_service.delete_term(db, term_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except GlossaryError as exc:
        return _glossary_error(exc)


@router.get("/glossary/{term_id}/field-mappings", response_model=TermFieldMappingListResponse)
def list_term_field_mappings(
    term_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> TermFieldMappingListResponse | JSONResponse:
    from app.metadata.glossary import field_mappings as term_field_mappings

    try:
        items = term_field_mappings.list_field_mappings(db, term_id)
    except GlossaryError as exc:
        return _glossary_error(exc)
    return TermFieldMappingListResponse(
        items=[TermFieldMappingOut.model_validate(i) for i in items],
    )


@router.put("/glossary/{term_id}/field-mappings", response_model=TermFieldMappingListResponse)
def replace_term_field_mappings(
    term_id: uuid.UUID,
    payload: TermFieldMappingsReplace,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> TermFieldMappingListResponse | JSONResponse:
    from app.metadata.glossary import field_mappings as term_field_mappings

    try:
        items = term_field_mappings.replace_field_mappings(db, term_id, payload.items, actor)
    except GlossaryError as exc:
        return _glossary_error(exc)
    return TermFieldMappingListResponse(
        items=[TermFieldMappingOut.model_validate(i) for i in items],
    )


@router.get("/themes", response_model=ThemeListResponse)
def list_theme_nodes(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    parent_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ThemeListResponse:
    items, total = themes_service.list_theme_nodes(db, parent_id, limit, offset)
    return ThemeListResponse(items=[ThemeOut.model_validate(n) for n in items], total=total)


@router.post("/themes", response_model=ThemeOut, status_code=status.HTTP_201_CREATED)
def create_theme_node(
    payload: ThemeCreate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> ThemeOut | JSONResponse:
    try:
        node = themes_service.create_theme_node(db, payload, actor)
    except ThemeError as exc:
        return _theme_error(exc)
    return ThemeOut.model_validate(node)


@router.get("/themes/{node_id}", response_model=ThemeOut)
def get_theme_node(
    node_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> ThemeOut | JSONResponse:
    try:
        node = themes_service.get_theme_node(db, node_id)
    except ThemeError as exc:
        return _theme_error(exc)
    return ThemeOut.model_validate(node)


@router.put("/themes/{node_id}", response_model=ThemeOut)
def update_theme_node(
    node_id: uuid.UUID,
    payload: ThemeUpdate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> ThemeOut | JSONResponse:
    try:
        node = themes_service.update_theme_node(db, node_id, payload, actor)
    except ThemeError as exc:
        return _theme_error(exc)
    return ThemeOut.model_validate(node)


@router.delete("/themes/{node_id}", response_model=None)
def delete_theme_node(
    node_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        themes_service.delete_theme_node(db, node_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ThemeError as exc:
        return _theme_error(exc)


@router.post("/themes/{node_id}/move", response_model=ThemeOut)
def move_theme_node(
    node_id: uuid.UUID,
    payload: ThemeMove,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> ThemeOut | JSONResponse:
    try:
        node = themes_service.move_theme_node(db, node_id, payload.parent_id, payload.sort_order, actor)
    except ThemeError as exc:
        return _theme_error(exc)
    return ThemeOut.model_validate(node)


@router.get("/dimensions/resolve", response_model=DimensionResolveOut)
def resolve_dimension(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    code: str = Query(min_length=1, max_length=64),
) -> DimensionResolveOut | JSONResponse:
    try:
        dimension = dimension_service.resolve_dimension_by_code(db, code)
    except DimensionError as exc:
        return _dimension_error(exc)
    return DimensionResolveOut.model_validate(dimension)


@router.get("/dimensions", response_model=DimensionListResponse)
def list_dimensions(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    code_prefix: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> DimensionListResponse:
    items, total = dimension_service.list_dimensions(db, code_prefix, limit, offset)
    return DimensionListResponse(items=[DimensionOut.model_validate(d) for d in items], total=total)


@router.post("/dimensions", response_model=DimensionOut, status_code=status.HTTP_201_CREATED)
def create_dimension(
    payload: DimensionCreate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionOut | JSONResponse:
    try:
        dimension = dimension_service.create_dimension(db, payload, actor)
    except DimensionError as exc:
        return _dimension_error(exc)
    return DimensionOut.model_validate(dimension)


@router.get("/dimensions/{dimension_id}", response_model=DimensionOut)
def get_dimension(
    dimension_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionOut | JSONResponse:
    try:
        dimension = dimension_service.get_dimension(db, dimension_id)
    except DimensionError as exc:
        return _dimension_error(exc)
    return DimensionOut.model_validate(dimension)


@router.put("/dimensions/{dimension_id}", response_model=DimensionOut)
def update_dimension(
    dimension_id: uuid.UUID,
    payload: DimensionUpdate,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionOut | JSONResponse:
    try:
        dimension = dimension_service.update_dimension(db, dimension_id, payload, actor)
    except DimensionError as exc:
        return _dimension_error(exc)
    return DimensionOut.model_validate(dimension)


@router.delete("/dimensions/{dimension_id}", response_model=None)
def delete_dimension(
    dimension_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        dimension_service.delete_dimension(db, dimension_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DimensionError as exc:
        return _dimension_error(exc)


@router.get("/dimensions/{dimension_id}/values", response_model=DimensionValueListResponse)
def list_dimension_values(
    dimension_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> DimensionValueListResponse | JSONResponse:
    try:
        items, total = dimension_service.list_values(db, dimension_id, limit, offset)
    except DimensionError as exc:
        return _dimension_error(exc)
    return DimensionValueListResponse(
        items=[DimensionValueOut.model_validate(v) for v in items],
        total=total,
    )


@router.post(
    "/dimensions/{dimension_id}/values",
    response_model=DimensionValueListResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_dimension_values(
    dimension_id: uuid.UUID,
    payload: DimensionValuesRegister,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> DimensionValueListResponse | JSONResponse:
    try:
        items = dimension_service.register_values(db, dimension_id, payload.items, actor)
    except DimensionError as exc:
        return _dimension_error(exc)
    return DimensionValueListResponse(
        items=[DimensionValueOut.model_validate(v) for v in items],
        total=len(items),
    )


@router.delete("/dimensions/{dimension_id}/values/{value_id}", response_model=None)
def delete_dimension_value(
    dimension_id: uuid.UUID,
    value_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        dimension_service.delete_value(db, dimension_id, value_id, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DimensionError as exc:
        return _dimension_error(exc)


def _physical_error(exc: PhysicalTableError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.get("/physical-tables", response_model=None)
def physical_tables_get(
    fqn: str | None = Query(default=None),
    entity_type_code: str | None = Query(default=None, alias="entityTypeCode"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))] = None,
):
    if fqn is not None:
        try:
            return physical_service.get_physical_table(fqn)
        except PhysicalTableError as exc:
            return _physical_error(exc)
    return physical_service.list_physical_tables(limit, offset, entity_type_code)


@router.post(
    "/physical-tables/register-from-schema",
    status_code=status.HTTP_201_CREATED,
    response_model=None,
)
def physical_tables_register_from_schema(
    payload: PhysicalTableRegisterFromSchemaIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return physical_service.register_from_schema(db, actor.roles, payload, actor)
    except PhysicalTableError as exc:
        return _physical_error(exc)


@router.post("/physical-tables", response_model=PhysicalTableOut, status_code=status.HTTP_201_CREATED)
def physical_tables_register(
    payload: PhysicalTableRegisterIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
) -> PhysicalTableOut | JSONResponse:
    try:
        return physical_service.register_physical_table(payload, actor)
    except PhysicalTableError as exc:
        return _physical_error(exc)


@router.post("/physical-tables/validate", response_model=PhysicalTableValidateOut)
def physical_tables_validate(
    payload: PhysicalTableRegisterIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> PhysicalTableValidateOut | JSONResponse:
    try:
        return physical_service.validate_physical_table(payload)
    except PhysicalTableError as exc:
        return _physical_error(exc)


@router.put("/physical-tables/{fqn}", response_model=None)
def physical_tables_update(
    fqn: str,
    payload: PhysicalTableUpdateIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return physical_service.update_physical_table(fqn, payload, actor)
    except PhysicalTableError as exc:
        return _physical_error(exc)


@router.delete("/physical-tables/{fqn}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def physical_tables_delete(
    fqn: str,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        physical_service.delete_physical_table(fqn, actor)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except PhysicalTableError as exc:
        return _physical_error(exc)


@router.get("/physical-tables/{fqn}/lineage", response_model=None)
def physical_tables_lineage(
    fqn: str,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return physical_service.get_physical_lineage(fqn)
    except PhysicalTableError as exc:
        return _physical_error(exc)
