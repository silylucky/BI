from __future__ import annotations

import uuid

from sqlalchemy import and_, delete as sa_delete, select
from sqlalchemy.orm import Session

from app.metadata.physical.models import PhysicalTableRecord


def _row_to_dict(row: PhysicalTableRecord) -> dict:
    out = {
        "tableFqn": row.table_fqn,
        "dataSourceId": str(row.data_source_id),
        "displayName": row.display_name,
        "entityTypeCode": row.entity_type_code,
        "columns": row.columns or [],
    }
    if row.source_schema:
        out["sourceSchema"] = row.source_schema
    if row.source_table:
        out["sourceTable"] = row.source_table
    return out


def list_all(db: Session, entity_type_code: str | None = None) -> list[dict]:
    q = db.query(PhysicalTableRecord)
    if entity_type_code:
        q = q.filter(PhysicalTableRecord.entity_type_code == entity_type_code)
    rows = q.order_by(PhysicalTableRecord.table_fqn).all()
    return [_row_to_dict(r) for r in rows]


def get(db: Session, fqn: str) -> dict | None:
    row = db.get(PhysicalTableRecord, fqn)
    return _row_to_dict(row) if row else None


def exists_ds_table(db: Session, data_source_id: uuid.UUID, schema: str, table: str) -> bool:
    stmt = select(PhysicalTableRecord).where(
        and_(
            PhysicalTableRecord.data_source_id == data_source_id,
            PhysicalTableRecord.source_schema == schema,
            PhysicalTableRecord.source_table == table,
        )
    )
    return db.scalar(stmt) is not None


def create(db: Session, record: dict) -> dict:
    row = PhysicalTableRecord(
        table_fqn=record["tableFqn"],
        data_source_id=uuid.UUID(str(record["dataSourceId"])),
        display_name=record["displayName"],
        entity_type_code=record.get("entityTypeCode"),
        columns=record.get("columns") or [],
        source_schema=record.get("sourceSchema"),
        source_table=record.get("sourceTable"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def update_record(db: Session, fqn: str, patch: dict) -> dict:
    row = db.get(PhysicalTableRecord, fqn)
    if row is None:
        raise KeyError(fqn)
    if "displayName" in patch:
        row.display_name = patch["displayName"]
    if "entityTypeCode" in patch:
        row.entity_type_code = patch.get("entityTypeCode")
    if "columns" in patch:
        row.columns = patch["columns"]
    if "sourceSchema" in patch:
        row.source_schema = patch.get("sourceSchema")
    if "sourceTable" in patch:
        row.source_table = patch.get("sourceTable")
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def bind_entity_type(db: Session, fqn: str, type_code: str) -> None:
    row = db.get(PhysicalTableRecord, fqn)
    if row is None:
        raise KeyError(fqn)
    row.entity_type_code = type_code
    db.commit()


def remove(db: Session, fqn: str) -> None:
    row = db.get(PhysicalTableRecord, fqn)
    if row is None:
        raise KeyError(fqn)
    db.delete(row)
    db.commit()


def clear_all(db: Session) -> None:
    db.execute(sa_delete(PhysicalTableRecord))
    db.commit()
