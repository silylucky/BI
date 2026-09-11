from __future__ import annotations

import uuid


def datasource_or_dataset_scope_ok(
    datasource_id: uuid.UUID | None,
    dataset_id: str | None,
) -> bool:
    return datasource_id is not None or bool(dataset_id and dataset_id.strip())
