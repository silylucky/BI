from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.designer.schemas import (
    ALLOWED_OUTPUT_AGGREGATES,
    AggregateItem,
    DESIGNER_FIELD_REGISTRY,
    DesignerError,
    MAX_AGGREGATES,
    MAX_OUTPUT_FIELDS,
    OutputFieldItem,
    OutputFieldsConfig,
)
from app.metadata.dataset import service as dataset_service
from app.metadata.glossary import service as glossary_service
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert

probe_output_fields_validate_budget_ms = 50


@dataclass(frozen=True)
class OutputFieldsProbeResult:
    elapsed_ms: float
    ok: bool


def _glossary_codes(session: Session) -> set[str]:
    items, _ = glossary_service.list_terms(session, limit=500, offset=0)
    return {item.code for item in items}


def _dataset_field_names(dataset_id: uuid.UUID | None) -> set[str]:
    if dataset_id is None:
        return set()
    try:
        ds = dataset_service.get_dataset(str(dataset_id))
        return {cf.name for cf in ds.computed_fields}
    except Exception:
        return set()


def validate_output_fields_config(
    session: Session,
    config: OutputFieldsConfig,
    dataset_id: uuid.UUID | None = None,
) -> OutputFieldsConfig:
    if not config.fields:
        raise DesignerError(
            "DESIGN_EMPTY_OUTPUT_FIELDS",
            "At least one output field is required",
            422,
            fields=[{"field": "fields", "message": "must not be empty"}],
        )
    if len(config.fields) > MAX_OUTPUT_FIELDS:
        raise DesignerError(
            "DESIGN_TOO_MANY_OUTPUT_FIELDS",
            f"At most {MAX_OUTPUT_FIELDS} output fields allowed",
            422,
            fields=[{"field": "fields", "message": f"max {MAX_OUTPUT_FIELDS}"}],
        )
    field_ids = [f.field_id for f in config.fields]
    if len(field_ids) != len(set(field_ids)):
        raise DesignerError(
            "DESIGN_DUPLICATE_OUTPUT_FIELD",
            "Duplicate fieldId in output fields",
            422,
            fields=[{"field": "fields", "message": "duplicate fieldId"}],
        )
    if len(config.aggregates) > MAX_AGGREGATES:
        raise DesignerError(
            "DESIGN_TOO_MANY_AGGREGATES",
            f"At most {MAX_AGGREGATES} aggregates allowed",
            422,
            fields=[{"field": "aggregates", "message": f"max {MAX_AGGREGATES}"}],
        )
    glossary = _glossary_codes(session)
    allowed_fields = DESIGNER_FIELD_REGISTRY | _dataset_field_names(dataset_id)
    for idx, field in enumerate(config.fields):
        prefix = f"fields[{idx}]"
        if field.field_id not in allowed_fields:
            raise DesignerError(
                "DESIGN_UNKNOWN_FIELD",
                "Unknown field in output",
                422,
                fields=[{"field": f"{prefix}.fieldId", "message": f"{field.field_id} not registered"}],
            )
        if field.meta_field_ref and field.meta_field_ref not in DESIGNER_FIELD_REGISTRY:
            if field.meta_field_ref not in glossary:
                raise DesignerError(
                    "DESIGN_UNKNOWN_META_REF",
                    "Unknown meta field reference",
                    422,
                    fields=[
                        {
                            "field": f"{prefix}.metaFieldRef",
                            "message": f"{field.meta_field_ref} not in glossary or registry",
                        }
                    ],
                )
    for idx, agg in enumerate(config.aggregates):
        prefix = f"aggregates[{idx}]"
        if agg.fn not in ALLOWED_OUTPUT_AGGREGATES:
            raise DesignerError(
                "DESIGN_INVALID_AGGREGATE",
                f"Aggregate function not allowed: {agg.fn}",
                422,
                fields=[{"field": f"{prefix}.fn", "message": "not in whitelist"}],
            )
        if agg.field_id not in allowed_fields:
            raise DesignerError(
                "DESIGN_UNKNOWN_FIELD",
                "Unknown field in aggregate",
                422,
                fields=[{"field": f"{prefix}.fieldId", "message": f"{agg.field_id} not registered"}],
            )
        for j, gb in enumerate(agg.group_by):
            if gb not in allowed_fields:
                raise DesignerError(
                    "DESIGN_UNKNOWN_FIELD",
                    "Unknown groupBy field",
                    422,
                    fields=[{"field": f"{prefix}.groupBy[{j}]", "message": f"{gb} not registered"}],
                )
    return config


def probe_validate_output_fields(session: Session) -> OutputFieldsProbeResult:
    started = time.perf_counter()
    cfg = OutputFieldsConfig(
        fields=[OutputFieldItem(fieldId="order_amount")],
        refId=uuid.uuid4(),
    )
    try:
        validate_output_fields_config(session, cfg)
        ok = True
    except DesignerError:
        ok = False
    return OutputFieldsProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)


def _output_payload(config: OutputFieldsConfig) -> dict:
    return {
        "schemaVersion": config.schema_version,
        "fields": [f.model_dump(by_alias=True) for f in config.fields],
        "aggregates": [a.model_dump(by_alias=True) for a in config.aggregates],
    }


def save_output_fields(
    session: Session,
    config: OutputFieldsConfig,
    owner_id: uuid.UUID | None = None,
    *,
    dataset_id: uuid.UUID | None = None,
):
    validate_output_fields_config(session, config, dataset_id=dataset_id)
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="output_fields",
            schema_version=config.schema_version,
            ref_type=config.ref_type,
            ref_id=config.ref_id,
            payload=_output_payload(config),
        ),
        owner_id=owner_id,
    )
    return config, record


def get_output_fields(session: Session, ref_type: str, ref_id: uuid.UUID) -> OutputFieldsConfig:
    record = config_store.get_config_by_ref(session, "output_fields", ref_type, ref_id)
    payload = record.payload
    return OutputFieldsConfig(
        schema_version=payload.get("schemaVersion", "1.0"),
        fields=[OutputFieldItem.model_validate(f) for f in payload["fields"]],
        aggregates=[AggregateItem.model_validate(a) for a in payload.get("aggregates", [])],
        ref_type=ref_type,
        ref_id=ref_id,
    )
