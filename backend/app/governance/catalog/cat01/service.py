from __future__ import annotations

import re

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.governance.catalog import gov_config_store
from app.governance.catalog.cat01.errors import (
    CAT01_EMPTY_ROLES,
    CAT01_DUPLICATE_STAGE,
    CAT01_EMPTY_STAGES,
    CAT01_FORBIDDEN,
    CAT01_INVALID_ENTITY_TYPE,
    CAT01_KEY_CONFLICT,
    CAT01_NOT_FOUND,
    CAT01_STAGE_INDEX_OUT_OF_BOUNDS,
    CAT01_STAGE_NOT_FOUND,
    Cat01Error,
)
from app.governance.catalog.cat01.schemas import (
    LifecycleStageMove,
    LifecycleTemplateIn,
    LifecycleTemplateListResponse,
    LifecycleTemplateOut,
    LifecycleTemplateValidateOut,
)

_ENTITY_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
_CONFIG_TYPE = "gov_lifecycle_template"
_REF_TYPE = "lifecycle_template"
_USER_ENTITY_SCOPE: dict[str, str] = {}


class _StoreCompat:
    def clear(self) -> None:
        session = get_meta_session()
        try:
            gov_config_store.clear_type(session, _CONFIG_TYPE)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


_store = _StoreCompat()


def set_user_entity_scope(user_id: str, entity_prefix: str) -> None:
    _USER_ENTITY_SCOPE[user_id] = entity_prefix


def _session():
    return get_meta_session()


def _assert_lifecycle_write_access(user: UserContext, entity_type_code: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise Cat01Error(CAT01_FORBIDDEN, "viewer cannot modify lifecycle templates", 403)
    if "enterprise" in roles:
        prefix = _USER_ENTITY_SCOPE.get(user.id, "ticket")
        if not entity_type_code.startswith(prefix):
            raise Cat01Error(CAT01_FORBIDDEN, "enterprise user out of entity scope", 403)


def _validate_payload(payload: LifecycleTemplateIn) -> LifecycleTemplateIn:
    if not payload.lifecycle_stages:
        raise Cat01Error(
            CAT01_EMPTY_STAGES,
            "lifecycleStages must not be empty",
            422,
            [{"field": "lifecycleStages", "message": "must not be empty"}],
        )
    if len(payload.lifecycle_stages) != len(set(payload.lifecycle_stages)):
        raise Cat01Error(CAT01_DUPLICATE_STAGE, "duplicate lifecycle stage", 422)
    if not _ENTITY_RE.match(payload.entity_type_code):
        raise Cat01Error(CAT01_INVALID_ENTITY_TYPE, "invalid entityTypeCode", 422)
    if not payload.allowed_roles:
        raise Cat01Error(
            CAT01_EMPTY_ROLES,
            "allowedRoles must not be empty",
            422,
            [{"field": "allowedRoles", "message": "must not be empty"}],
        )
    return payload


def validate_lifecycle_template(payload: LifecycleTemplateIn) -> LifecycleTemplateValidateOut:
    item = _validate_payload(payload)
    return LifecycleTemplateValidateOut(valid=True, template_key=item.template_key)


def get_lifecycle_template(template_key: str) -> LifecycleTemplateOut:
    session = _session()
    try:
        row = gov_config_store.get_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=template_key
        )
        if row is None:
            raise Cat01Error(CAT01_NOT_FOUND, f"templateKey not found: {template_key}", 404)
        return LifecycleTemplateOut.model_validate(row)
    finally:
        session.close()


def create_lifecycle_template(payload: LifecycleTemplateIn, user: UserContext) -> LifecycleTemplateOut:
    item = _validate_payload(payload)
    _assert_lifecycle_write_access(user, item.entity_type_code)
    key = item.template_key
    session = _session()
    try:
        if gov_config_store.get_json(session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key):
            raise Cat01Error(CAT01_KEY_CONFLICT, f"templateKey already exists: {key}", 409)
        data = item.model_dump(by_alias=True, mode="json")
        gov_config_store.upsert_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key, payload=data
        )
        return LifecycleTemplateOut.model_validate(data)
    finally:
        session.close()


def list_lifecycle_templates(
    limit: int, offset: int, user: UserContext | None = None,
) -> LifecycleTemplateListResponse:
    session = _session()
    try:
        items = gov_config_store.list_json(session, config_type=_CONFIG_TYPE)
        if user is not None and "enterprise" in set(user.roles) and "admin" not in set(user.roles):
            prefix = _USER_ENTITY_SCOPE.get(user.id, "ticket")
            items = [i for i in items if str(i.get("entityTypeCode", "")).startswith(prefix)]
        page = items[offset : offset + limit]
        return LifecycleTemplateListResponse(
            items=[LifecycleTemplateOut.model_validate(i) for i in page],
            total=len(items),
        )
    finally:
        session.close()


def move_lifecycle_stage(
    template_key: str, payload: LifecycleStageMove, user: UserContext,
) -> LifecycleTemplateOut:
    session = _session()
    try:
        row = gov_config_store.get_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=template_key
        )
        if row is None:
            raise Cat01Error(CAT01_NOT_FOUND, f"templateKey not found: {template_key}", 404)
        _assert_lifecycle_write_access(user, row["entityTypeCode"])
        stages: list[str] = list(row["lifecycleStages"])
        try:
            from_index = stages.index(payload.stage_name)
        except ValueError as exc:
            raise Cat01Error(
                CAT01_STAGE_NOT_FOUND,
                f"stageName not found: {payload.stage_name}",
                404,
            ) from exc
        if payload.to_index < 0 or payload.to_index >= len(stages):
            raise Cat01Error(
                CAT01_STAGE_INDEX_OUT_OF_BOUNDS,
                "toIndex out of bounds",
                422,
                [{"field": "toIndex", "message": f"must be 0..{len(stages) - 1}"}],
            )
        stage = stages.pop(from_index)
        stages.insert(payload.to_index, stage)
        row["lifecycleStages"] = stages
        gov_config_store.upsert_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=template_key, payload=row
        )
        return LifecycleTemplateOut.model_validate(row)
    finally:
        session.close()
