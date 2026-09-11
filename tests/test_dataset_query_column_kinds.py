"""dataset_query payload columnKinds 校验。"""
from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.query.config_store.schemas import DatasetQueryConfigPayload


def _base_payload(**overrides: object) -> dict:
    base = {
        "dataSourceId": str(uuid.uuid4()),
        "connectorType": "postgresql",
        "schema": "public",
        "table": "orders",
        "columns": ["id", "amount", "region"],
    }
    base.update(overrides)
    return base


def test_column_kinds_accepts_valid_overrides():
    payload = DatasetQueryConfigPayload.model_validate(
        _base_payload(columnKinds={"amount": "metric", "region": "dimension"}),
    )
    assert payload.column_kinds == {"amount": "metric", "region": "dimension"}


def test_column_kinds_rejects_unknown_column():
    with pytest.raises(ValidationError):
        DatasetQueryConfigPayload.model_validate(
            _base_payload(columnKinds={"missing_col": "metric"}),
        )


def test_column_kinds_rejects_invalid_kind():
    with pytest.raises(ValidationError):
        DatasetQueryConfigPayload.model_validate(
            _base_payload(columnKinds={"amount": "unknown"}),
        )
