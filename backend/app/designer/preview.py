"""Preview translate helpers (DESIGN-001)."""
from __future__ import annotations

import time
import uuid

from sqlalchemy.orm import Session

from app.designer.schemas import (
    DESIGNER_FIELD_REGISTRY,
    PreviewTranslateIn,
    FieldRegistryOut,
)
from app.designer.service import validate_conditions_config, validate_compute_rules_config
from app.designer import output_fields as output_fields_service
from app.metadata.dataset import service as dataset_service
from app.metadata.glossary import service as glossary_service
from app.query.translator.schemas import TranslateConditionItem, TranslateConditions, TranslateRequest
from app.query.translator.service import translate_config_to_sql

probe_preview_translate_budget_ms_limit = 50


def _resolve_connector_type(session: Session, dataset_id: uuid.UUID | None) -> str:
    if dataset_id is None:
        return "postgresql"
    try:
        ds = dataset_service.get_dataset(str(dataset_id))
        source_id = ds.table_source_datasource_id
        if source_id is None:
            return "postgresql"
        from app.datasources import service as datasource_service

        source = datasource_service.get_data_source(session, source_id, role_codes=["admin"])
        return source.type
    except Exception:
        return "postgresql"


def list_designer_fields(session: Session, dataset_id: uuid.UUID | None = None) -> FieldRegistryOut:
    items, _ = glossary_service.list_terms(session, limit=200, offset=0)
    glossary = [item.code for item in items]
    dataset_fields: list[str] = []
    if dataset_id is not None:
        try:
            ds = dataset_service.get_dataset(str(dataset_id))
            dataset_fields = [t.name for t in ds.tables] + [cf.name for cf in ds.computed_fields]
        except Exception:
            dataset_fields = []
    return FieldRegistryOut(
        registry=sorted(DESIGNER_FIELD_REGISTRY),
        glossary=glossary,
        datasetFields=dataset_fields,
    )


def build_preview_translate_request(session: Session, payload: PreviewTranslateIn) -> TranslateRequest:
    validate_conditions_config(payload.conditions)
    validate_compute_rules_config(payload.compute_rules)
    output_fields_service.validate_output_fields_config(
        session, payload.output_fields, dataset_id=payload.dataset_id
    )

    table = "design_preview"
    columns = [f.field_id for f in payload.output_fields.fields]
    if payload.dataset_id is not None:
        try:
            ds = dataset_service.get_dataset(str(payload.dataset_id))
            if ds.tables:
                table = ds.tables[0].name
        except Exception:
            pass

    conditions = TranslateConditions(
        logic=payload.conditions.logic,
        conditions=[
            TranslateConditionItem.model_validate(c.model_dump(by_alias=True))
            for c in payload.conditions.conditions
        ],
    )
    return TranslateRequest(
        connectorType=_resolve_connector_type(session, payload.dataset_id),
        schema="public",
        table=table,
        columns=columns or ["order_amount"],
        conditions=conditions,
    )


def preview_translate_sql(session: Session, payload: PreviewTranslateIn) -> dict:
    request = build_preview_translate_request(session, payload)
    response = translate_config_to_sql(request)
    sql = response.sql
    for rule in payload.compute_rules.rules:
        sql += f"\n-- rule: {rule.id}={rule.expression}"
    return {
        "sql": sql,
        "parameters": response.parameters,
        "connectorType": response.connector_type,
    }


def probe_preview_translate_budget_ms(session: Session, payload: PreviewTranslateIn) -> float:
    started = time.perf_counter()
    preview_translate_sql(session, payload)
    return (time.perf_counter() - started) * 1000
