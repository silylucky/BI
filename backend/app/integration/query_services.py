from __future__ import annotations

import logging
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.logging import trace_id_var
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import CatalogEntryOut
from app.integration import bus_register
from app.integration import idempotency_repo
from app.integration.errors import IntegrationError

logger = logging.getLogger(__name__)


class QueryServiceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    name: str
    http_method: str = Field(alias="httpMethod")
    path: str
    category_codes: list[str] = Field(alias="categoryCodes")
    status: str
    version: str = "v1"
    created_at: datetime = Field(alias="createdAt")


class QueryServiceListResponse(BaseModel):
    items: list[QueryServiceOut]
    total: int
    limit: int
    offset: int


class QueryServiceExecuteIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    parameters: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class QueryServiceExecuteOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    columns: list[str]
    rows: list[list]
    row_count: int = Field(alias="rowCount")
    truncated: bool = False
    trace_id: str = Field(alias="traceId")


def _assert_service_invoke(actor: UserContext) -> None:
    if actor.is_root or "integration" in actor.roles:
        return
    raise IntegrationError(
        "SERVICE_EXECUTE_FORBIDDEN",
        "Service invoke requires integration role or root",
        403,
    )


def _entry_to_service(entry: CatalogEntryOut) -> QueryServiceOut:
    return QueryServiceOut(
        id=entry.id,
        name=entry.name,
        http_method=entry.http_method,
        path=entry.path,
        category_codes=entry.category_codes,
        status=entry.status,
        version="v1",
        created_at=entry.created_at,
    )


def _require_published(entry: CatalogEntryOut) -> None:
    if entry.status != "published":
        raise IntegrationError(
            "SERVICE_NOT_PUBLISHED",
            "Service is not published",
            400,
        )


def _parse_required_params(path: str) -> list[str]:
    if ";requires=" not in path:
        return []
    _, fragment = path.split(";requires=", 1)
    requires_part = fragment.split(";")[0]
    return [p.strip() for p in requires_part.split(",") if p.strip()]


def _validate_execute_parameters(
    required: list[str],
    parameters: dict[str, str | int | float | bool | None],
) -> None:
    missing = []
    for name in required:
        if name not in parameters:
            missing.append({"field": name, "message": "required"})
            continue
        val = parameters[name]
        if val is None or (isinstance(val, str) and val.strip() == ""):
            missing.append({"field": name, "message": "required"})
        elif not isinstance(val, (str, int, float, bool)):
            missing.append({"field": name, "message": "invalid type"})
    if missing:
        raise IntegrationError(
            "SERVICE_EXECUTE_INVALID",
            "Invalid execute parameters",
            422,
            fields=missing,
        )


def list_published_services(
    db: Session,
    *,
    category: str | None,
    limit: int,
    offset: int,
) -> QueryServiceListResponse:
    try:
        catalog = catalog_service.list_entries(db, category=category, limit=10_000, offset=0)
    except catalog_service.CatalogError as exc:
        raise IntegrationError(exc.code, exc.message, exc.status) from exc
    published = [e for e in catalog.items if e.status == "published"]
    total = len(published)
    page = published[offset : offset + limit]
    return QueryServiceListResponse(
        items=[_entry_to_service(e) for e in page],
        total=total,
        limit=limit,
        offset=offset,
    )


def get_published_service(db: Session, service_id: uuid.UUID) -> QueryServiceOut:
    try:
        entry = catalog_service.get_entry(db, service_id)
    except catalog_service.CatalogError:
        raise IntegrationError("SERVICE_NOT_FOUND", "Service not found", 404) from None
    _require_published(entry)
    return _entry_to_service(entry)


def _strip_path_meta(path: str) -> tuple[str, dict[str, str]]:
    meta: dict[str, str] = {}
    for part in path.split(";"):
        if part.startswith("requires=") or "=" not in part:
            continue
        key, value = part.split("=", 1)
        meta[key.strip()] = value.strip()
    base = path.split(";")[0]
    return base, meta


def _demo_execute_result() -> QueryServiceExecuteOut:
    trace = trace_id_var.get() or uuid.uuid4().hex
    return QueryServiceExecuteOut(
        columns=["value"],
        rows=[[1]],
        row_count=1,
        truncated=False,
        trace_id=trace,
    )


def _execute_cat02(
    actor: UserContext,
    parameters: dict[str, str | int | float | bool | None],
    meta: dict[str, str],
) -> QueryServiceExecuteOut:
    from app.governance.catalog.cat02.errors import Cat02Error
    from app.governance.catalog.cat02.query import query_aggregate

    template_key = str(parameters.get("templateKey") or meta.get("templateKey") or "")
    group_by = str(parameters.get("groupBy") or meta.get("groupBy") or "")
    try:
        result = query_aggregate(template_key, group_by, actor)
    except Cat02Error as exc:
        raise IntegrationError(exc.code, exc.message, exc.status) from exc
    columns = list(result.dimensions) + list(result.metrics)
    rows = [[row.get(col) for col in columns] for row in result.rows]
    trace = trace_id_var.get() or uuid.uuid4().hex
    return QueryServiceExecuteOut(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        truncated=False,
        trace_id=trace,
    )


def _execute_binding(
    db: Session,
    actor: UserContext,
    binding_id: str,
) -> QueryServiceExecuteOut:
    from app.query import service as query_service
    from app.query.schemas import ExecuteRequest, QueryError

    try:
        binding_uuid = uuid.UUID(binding_id)
    except ValueError as exc:
        raise IntegrationError(
            "SERVICE_EXECUTE_INVALID",
            "Invalid binding id",
            422,
            fields=[{"field": "binding", "message": "invalid uuid"}],
        ) from exc
    req = ExecuteRequest(binding_id=binding_uuid)
    try:
        out = query_service.execute_query(db, actor, req)
    except QueryError as exc:
        raise IntegrationError(exc.code, exc.message, exc.status) from exc
    trace = trace_id_var.get() or uuid.uuid4().hex
    return QueryServiceExecuteOut(
        columns=out.columns,
        rows=out.rows,
        row_count=out.row_count,
        truncated=out.truncated,
        trace_id=trace,
    )


def _dispatch_service_execute(
    db: Session,
    actor: UserContext,
    service: QueryServiceOut,
    parameters: dict[str, str | int | float | bool | None],
) -> QueryServiceExecuteOut:
    base, meta = _strip_path_meta(service.path)
    handler = meta.get("handler")
    if "binding" in meta:
        return _execute_binding(db, actor, meta["binding"])
    if handler == "cat02" or "/cat02/aggregate" in base:
        return _execute_cat02(actor, parameters, meta)
    if handler == "demo" or "/demo/select-one" in base:
        return _demo_execute_result()
    raise IntegrationError(
        "SERVICE_EXECUTE_NOT_CONFIGURED",
        "Published service has no execution handler; use ;handler=demo, ;handler=cat02, or ;binding=<uuid>",
        501,
    )


def get_service_openapi_fragment(service: QueryServiceOut) -> dict:
    op_id = service.path.strip("/").replace("/", ".") or "execute"
    return {
        "openapi": "3.1.0",
        "info": {"title": service.name, "version": service.version},
        "paths": {
            service.path.split(";")[0]: {
                service.http_method.lower(): {
                    "operationId": op_id,
                    "summary": service.name,
                    "responses": {"200": {"description": "OK"}},
                }
            }
        },
    }


def execute_published_service(
    db: Session,
    service_id: uuid.UUID,
    parameters: dict,
    actor: UserContext,
    *,
    idempotency_key: str | None = None,
) -> QueryServiceExecuteOut:
    _assert_service_invoke(actor)
    cache_key = f"{actor.id}:{service_id}:{idempotency_key}" if idempotency_key else None
    if cache_key:
        cached = idempotency_repo.get_cached(db, cache_key)
        if cached is not None:
            return QueryServiceExecuteOut.model_validate(cached)
    try:
        entry = catalog_service.get_entry(db, service_id)
    except catalog_service.CatalogError:
        raise IntegrationError("SERVICE_NOT_FOUND", "Service not found", 404) from None
    _require_published(entry)
    service = _entry_to_service(entry)
    _validate_execute_parameters(_parse_required_params(service.path), parameters)
    if "force-error" in service.path:
        trace = trace_id_var.get() or uuid.uuid4().hex
        raise IntegrationError(
            "SERVICE_EXECUTE_FAILED",
            "Service execution failed",
            502,
            trace_id=trace,
        )
    result = _dispatch_service_execute(db, actor, service, parameters)
    if cache_key:
        idempotency_repo.put_cached(db, cache_key, result.model_dump(by_alias=True, mode="json"))
    return result


def publish_service(
    db: Session,
    service_id: uuid.UUID,
    actor: UserContext,
) -> tuple[CatalogEntryOut, bool]:
    _assert_service_invoke(actor)
    try:
        entry = catalog_service.get_entry(db, service_id)
    except catalog_service.CatalogError:
        raise IntegrationError("SERVICE_NOT_FOUND", "Service not found", 404) from None
    if entry.status == "published":
        try:
            bus_register.register_on_publish(db, service_id, actor)
        except IntegrationError as exc:
            logger.warning(
                "bus_register_on_publish_failed",
                extra={"service_id": str(service_id), "code": exc.code},
            )
        return entry, False
    try:
        published = catalog_service.publish_entry(db, service_id)
    except catalog_service.CatalogError as exc:
        raise IntegrationError(exc.code, exc.message, exc.status) from exc
    try:
        bus_register.register_on_publish(db, service_id, actor)
    except IntegrationError as exc:
        logger.warning(
            "bus_register_on_publish_failed",
            extra={"service_id": str(service_id), "code": exc.code},
        )
    return published, True
