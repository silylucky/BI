"""Legacy standard analysis pack cleanup (physical table binding retirement)."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.datasources.models import get_meta_engine
from app.metadata.dataset.models import DatasetRecord
from app.metadata.physical import service as physical_service
from app.query.config_store.schemas import ConfigUpsert
from app.query.config_store.service import upsert_config
from app.reports.persistence import standard_repo
from app.reports.standard.schemas import AnalysisPackOut
from app.reports.standard.volume_policy import DEFAULT_QUERY_LIMIT


def _stable_ref_id(pack_key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"vitalspan.std-pack.{pack_key}")


def materialize_std_pack_from_physical(db: Session, pack: AnalysisPackOut) -> tuple[str, uuid.UUID]:
    """One-time migration: create std-pack-* dataset + query config from physical table binding."""
    if not pack.physical_table_fqn:
        raise ValueError("physicalTableFqn required for legacy migration")
    dataset_id = f"std-pack-{pack.pack_key}"
    pt = physical_service.get_physical_table(pack.physical_table_fqn)
    schema = (pt.source_schema or "").strip()
    table = pt.source_table or pack.physical_table_fqn.split(".")[-1]
    table_name = f"{schema}.{table}" if schema else table
    columns = [col.name for col in pt.columns if col.name]

    row = db.get(DatasetRecord, dataset_id)
    if row is None:
        row = DatasetRecord(
            dataset_id=dataset_id,
            display_name=pack.display_name,
            tables=[{"name": table_name}],
            computed_fields=[],
            allowed_roles=list(pack.allowed_roles),
            bound_config_id=None,
            table_source_datasource_id=pack.data_source_id,
        )
        db.add(row)
    else:
        row.display_name = pack.display_name
        row.tables = [{"name": table_name}]
        row.allowed_roles = list(pack.allowed_roles)
        row.table_source_datasource_id = pack.data_source_id

    if row.bound_config_id is not None:
        db.commit()
        return dataset_id, row.bound_config_id

    record = upsert_config(
        db,
        ConfigUpsert.model_validate(
            {
                "configType": "dataset_query",
                "schemaVersion": "1.0",
                "refType": "dataset",
                "refId": str(_stable_ref_id(pack.pack_key)),
                "payload": {
                    "dataSourceId": str(pack.data_source_id),
                    "connectorType": "mysql",
                    "schema": schema,
                    "table": table,
                    "columns": columns or ["*"],
                    "conditions": {"logic": "AND", "conditions": []},
                    "limit": DEFAULT_QUERY_LIMIT,
                    "offset": 0,
                },
            },
        ),
    )
    row.bound_config_id = record.id
    db.commit()
    return dataset_id, record.id


def _legacy_pack_from_raw(raw: dict) -> AnalysisPackOut:
    return AnalysisPackOut.model_construct(
        pack_key=raw["packKey"],
        display_name=raw["displayName"],
        business_object_code=raw.get("businessObjectCode"),
        physical_table_fqn=raw.get("physicalTableFqn"),
        dataset_id=raw.get("datasetId"),
        bound_config_id=uuid.UUID(str(raw["boundConfigId"])) if raw.get("boundConfigId") else None,
        data_source_id=uuid.UUID(str(raw["dataSourceId"])),
        field_mapping=raw.get("fieldMapping") or {},
        enabled_themes=raw.get("enabledThemes") or [],
        allowed_roles=raw.get("allowedRoles") or [],
        snapshot_cron_preset=raw.get("snapshotCronPreset", "daily"),
        snapshot_retention_periods=int(raw.get("snapshotRetentionPeriods") or 12),
    )


def migrate_physical_packs_to_dataset() -> int:
    """Move packs on physicalTableFqn to std-pack-* datasets; clear legacy fields."""
    migrated = 0
    with Session(bind=get_meta_engine()) as db:
        for key, raw in list(standard_repo.all_packs().items()):
            if raw.get("datasetId") or not raw.get("physicalTableFqn"):
                continue
            pack = _legacy_pack_from_raw(raw)
            dataset_id, bound_id = materialize_std_pack_from_physical(db, pack)
            updated = pack.model_dump(by_alias=True)
            updated["datasetId"] = dataset_id
            updated["boundConfigId"] = str(bound_id)
            updated.pop("physicalTableFqn", None)
            updated.pop("businessObjectCode", None)
            standard_repo.save_pack(key, updated)
            migrated += 1
    return migrated
