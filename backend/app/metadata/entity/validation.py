from __future__ import annotations

from app.metadata.entity.errors import EntityTypeError
from app.metadata.entity.schemas import EntityQueryBindingsOut, EntityTypeOut

_REQUIRED_LIFECYCLE = frozenset({"draft", "active", "retired"})
probe_schema_validate_budget_ms: int = 50


def validate_entity_schema_payload(type_code, display_name, attributes, lifecycle_states) -> None:
    names = [a.name for a in attributes]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        raise EntityTypeError(
            "META_ENTITY_SCHEMA_INVALID",
            "Duplicate attribute names",
            422,
            fields={"duplicateAttributes": dupes},
        )
    if lifecycle_states:
        missing = sorted(_REQUIRED_LIFECYCLE - set(lifecycle_states))
        if missing:
            raise EntityTypeError(
                "META_ENTITY_SCHEMA_INVALID",
                "lifecycleStates must include draft/active/retired",
                422,
                fields={"missingLifecycleStates": missing},
            )


def build_readonly_query_bindings(entity_type: EntityTypeOut) -> EntityQueryBindingsOut:
    bindings = [
        {
            "name": a.name,
            "dataType": a.data_type,
            "filterable": a.data_type != "json",
            "readOnly": True,
        }
        for a in entity_type.attributes
    ]
    return EntityQueryBindingsOut(type_code=entity_type.type_code, bindings=bindings)
