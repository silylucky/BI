from __future__ import annotations

import time

from pydantic import ValidationError

from app.query.config_store.models import QueryConfigRecord
from app.query.config_store.schemas import DatasetQueryConfigPayload
from app.query.translator.schemas import TranslateError, TranslateRequest, TranslateResponse
from app.query.translator.service import translate_config_to_sql


def translate_from_config_record(record: QueryConfigRecord) -> TranslateResponse:
    if record.config_type != "dataset_query":
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            f"config type must be dataset_query, got {record.config_type}",
            422,
        )
    try:
        payload = DatasetQueryConfigPayload.model_validate(record.payload)
    except ValidationError as exc:
        fields = [
            {"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            "Invalid dataset_query payload",
            422,
            fields=fields,
        ) from exc
    request = TranslateRequest(
        connectorType=payload.connector_type,
        schema=payload.schema_name,
        table=payload.table,
        columns=payload.columns,
        conditions=payload.conditions,
        limit=payload.limit,
        offset=payload.offset,
    )
    return translate_config_to_sql(request)


def probe_translate_from_config_budget_ms(record: QueryConfigRecord) -> float:
    start = time.perf_counter()
    translate_from_config_record(record)
    return (time.perf_counter() - start) * 1000.0
