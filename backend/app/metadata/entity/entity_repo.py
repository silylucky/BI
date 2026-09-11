from __future__ import annotations

from sqlalchemy import delete as sa_delete
from sqlalchemy.orm import Session

from app.metadata.entity.models import EntityTypeRecord


def _row_to_dict(row: EntityTypeRecord) -> dict:
    return {
        "typeCode": row.type_code,
        "displayName": row.display_name,
        "attributes": row.attributes or [],
        "lifecycleStates": row.lifecycle_states or [],
        "physicalTableFqn": row.physical_table_fqn,
    }


def list_all(db: Session) -> list[dict]:
    rows = db.query(EntityTypeRecord).order_by(EntityTypeRecord.type_code).all()
    return [_row_to_dict(r) for r in rows]


def get(db: Session, type_code: str) -> dict | None:
    row = db.get(EntityTypeRecord, type_code)
    return _row_to_dict(row) if row else None


def create(db: Session, record: dict) -> dict:
    row = EntityTypeRecord(
        type_code=record["typeCode"],
        display_name=record["displayName"],
        attributes=record.get("attributes") or [],
        lifecycle_states=record.get("lifecycleStates") or [],
        physical_table_fqn=record.get("physicalTableFqn"),
        ref_count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def update(db: Session, type_code: str, record: dict) -> dict:
    row = db.get(EntityTypeRecord, type_code)
    if row is None:
        raise KeyError(type_code)
    row.display_name = record["displayName"]
    row.attributes = record.get("attributes") or []
    row.lifecycle_states = record.get("lifecycleStates") or []
    row.physical_table_fqn = record.get("physicalTableFqn")
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


def remove(db: Session, type_code: str) -> None:
    row = db.get(EntityTypeRecord, type_code)
    if row is None:
        raise KeyError(type_code)
    db.delete(row)
    db.commit()


def increment_ref(db: Session, type_code: str) -> None:
    row = db.get(EntityTypeRecord, type_code)
    if row is not None:
        row.ref_count = (row.ref_count or 0) + 1
        db.commit()


def decrement_ref(db: Session, type_code: str) -> None:
    row = db.get(EntityTypeRecord, type_code)
    if row is not None and (row.ref_count or 0) > 0:
        row.ref_count -= 1
        db.commit()


def ref_count(db: Session, type_code: str) -> int:
    row = db.get(EntityTypeRecord, type_code)
    return row.ref_count if row else 0


def clear_all(db: Session) -> None:
    db.execute(sa_delete(EntityTypeRecord))
    db.commit()
