from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.governance.persistence.models import (
    GovClassificationNode,
    GovGeoRegion,
    GovOpenApiMapping,
    GovPublishSubmitter,
)


def _openapi_to_dict(row: GovOpenApiMapping) -> dict:
    return {
        "id": row.id,
        "catalogEntryId": str(row.catalog_entry_id),
        "httpMethod": row.http_method,
        "path": row.path,
        "operationId": row.operation_id,
        "entityTypeRef": row.entity_type_ref,
        "apiVersion": row.api_version,
        "active": row.active,
    }


def list_openapi_mappings(db: Session, catalog_entry_id: uuid.UUID | None = None) -> list[dict]:
    q = db.query(GovOpenApiMapping)
    if catalog_entry_id is not None:
        q = q.filter(GovOpenApiMapping.catalog_entry_id == catalog_entry_id)
    return [_openapi_to_dict(r) for r in q.all()]


def get_openapi_mapping(db: Session, mapping_id: uuid.UUID) -> dict | None:
    row = db.get(GovOpenApiMapping, mapping_id)
    return _openapi_to_dict(row) if row else None


def operation_id_exists(db: Session, operation_id: str) -> bool:
    return db.scalar(
        select(GovOpenApiMapping).where(GovOpenApiMapping.operation_id == operation_id)
    ) is not None


def create_openapi_mapping(db: Session, record: dict) -> dict:
    row = GovOpenApiMapping(
        id=record["id"],
        catalog_entry_id=uuid.UUID(str(record["catalogEntryId"])),
        http_method=record["httpMethod"],
        path=record["path"],
        operation_id=record["operationId"],
        entity_type_ref=record.get("entityTypeRef"),
        api_version=record.get("apiVersion", "v1"),
        active=record.get("active", True),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _openapi_to_dict(row)


def deactivate_openapi_mapping(db: Session, mapping_id: uuid.UUID) -> dict | None:
    row = db.get(GovOpenApiMapping, mapping_id)
    if row is None:
        return None
    row.active = False
    db.commit()
    db.refresh(row)
    return _openapi_to_dict(row)


def deactivate_openapi_for_catalog(db: Session, catalog_entry_id: uuid.UUID) -> list[dict]:
    rows = db.query(GovOpenApiMapping).filter(
        GovOpenApiMapping.catalog_entry_id == catalog_entry_id,
        GovOpenApiMapping.active.is_(True),
    ).all()
    out = []
    for row in rows:
        row.active = False
        out.append(_openapi_to_dict(row))
    db.commit()
    return out


def clear_openapi(db: Session) -> None:
    db.execute(delete(GovOpenApiMapping))
    db.commit()


def _geo_to_dict(row: GovGeoRegion) -> dict:
    return {
        "regionId": row.region_id,
        "regionCode": row.region_code,
        "name": row.name,
        "parentId": row.parent_id,
        "level": row.level,
        "sortOrder": row.sort_order,
    }


def list_geo_children(db: Session, parent_id: uuid.UUID | None) -> list[dict]:
    rows = db.query(GovGeoRegion).filter(GovGeoRegion.parent_id == parent_id).all()
    return [_geo_to_dict(r) for r in rows]


def geo_code_exists(db: Session, code: str) -> bool:
    return db.scalar(select(GovGeoRegion).where(GovGeoRegion.region_code == code)) is not None


def get_geo(db: Session, region_id: uuid.UUID) -> dict | None:
    row = db.get(GovGeoRegion, region_id)
    return _geo_to_dict(row) if row else None


def create_geo(db: Session, record: dict) -> dict:
    row = GovGeoRegion(
        region_id=record["regionId"],
        region_code=record["regionCode"],
        name=record["name"],
        parent_id=record.get("parentId"),
        level=record.get("level", 0),
        sort_order=record.get("sortOrder", 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _geo_to_dict(row)


def update_geo(db: Session, region_id: uuid.UUID, patch: dict) -> dict:
    row = db.get(GovGeoRegion, region_id)
    if row is None:
        raise KeyError(region_id)
    if "parentId" in patch:
        row.parent_id = patch["parentId"]
    if "sortOrder" in patch:
        row.sort_order = patch["sortOrder"]
    db.commit()
    db.refresh(row)
    return _geo_to_dict(row)


def delete_geo(db: Session, region_id: uuid.UUID) -> None:
    row = db.get(GovGeoRegion, region_id)
    if row is None:
        raise KeyError(region_id)
    db.delete(row)
    db.commit()


def clear_geo(db: Session) -> None:
    db.execute(delete(GovGeoRegion))
    db.commit()


def _class_to_dict(row: GovClassificationNode) -> dict:
    return {
        "nodeId": row.node_id,
        "code": row.code,
        "name": row.name,
        "parentId": row.parent_id,
        "kind": row.kind,
        "sortOrder": row.sort_order,
    }


def list_class_children(db: Session, parent_id: uuid.UUID | None) -> list[dict]:
    rows = db.query(GovClassificationNode).filter(GovClassificationNode.parent_id == parent_id).all()
    return [_class_to_dict(r) for r in rows]


def class_code_exists(db: Session, code: str) -> bool:
    return db.scalar(select(GovClassificationNode).where(GovClassificationNode.code == code)) is not None


def get_class(db: Session, node_id: uuid.UUID) -> dict | None:
    row = db.get(GovClassificationNode, node_id)
    return _class_to_dict(row) if row else None


def create_class(db: Session, record: dict) -> dict:
    row = GovClassificationNode(
        node_id=record["nodeId"],
        code=record["code"],
        name=record["name"],
        parent_id=record.get("parentId"),
        kind=record.get("kind", "category"),
        sort_order=record.get("sortOrder", 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _class_to_dict(row)


def update_class(db: Session, node_id: uuid.UUID, patch: dict) -> dict:
    row = db.get(GovClassificationNode, node_id)
    if row is None:
        raise KeyError(node_id)
    if "parentId" in patch:
        row.parent_id = patch["parentId"]
    if "sortOrder" in patch:
        row.sort_order = patch["sortOrder"]
    db.commit()
    db.refresh(row)
    return _class_to_dict(row)


def delete_class(db: Session, node_id: uuid.UUID) -> None:
    row = db.get(GovClassificationNode, node_id)
    if row is None:
        raise KeyError(node_id)
    from app.auth.cleanup import purge_grants_for_resource

    purge_grants_for_resource(
        db,
        resource_type="gov_catalog_entry",
        resource_id=node_id,
    )
    db.delete(row)
    db.commit()


def clear_classification(db: Session) -> None:
    db.execute(delete(GovClassificationNode))
    db.commit()


def record_publish_submitter(db: Session, entry_id: uuid.UUID, submitter_id: str) -> None:
    row = db.get(GovPublishSubmitter, entry_id)
    if row is None:
        row = GovPublishSubmitter(entry_id=entry_id, submitter_id=submitter_id)
        db.add(row)
    else:
        row.submitter_id = submitter_id
    db.commit()


def get_publish_submitter(db: Session, entry_id: uuid.UUID) -> str | None:
    row = db.get(GovPublishSubmitter, entry_id)
    return row.submitter_id if row else None


def clear_publish_submitters(db: Session) -> None:
    db.execute(delete(GovPublishSubmitter))
    db.commit()
