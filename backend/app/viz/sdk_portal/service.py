from __future__ import annotations

from app.auth.deps import UserContext
from app.viz.embed import _ORIGIN_RE
from app.viz.sdk_portal.errors import (
    SdkPortalError,
    VIZ_SDK_DUPLICATE_ORIGIN,
    VIZ_SDK_FORBIDDEN,
    VIZ_SDK_TOKEN_REQUIRED,
)
from app.viz.sdk_portal.schemas import (
    SdkCapabilitiesOut,
    SdkLifecycleIn,
    SdkLifecycleOut,
    SdkPortalInitIn,
    SdkPortalValidateOut,
)

_SDK_VERSION = "0.1.0-l1"


def validate_sdk_init(payload: SdkPortalInitIn) -> SdkPortalValidateOut:
    if payload.target_type in {"chart", "dashboard"} and payload.target_id is None:
        raise SdkPortalError(
            "VIZ_SDK_TARGET_REQUIRED",
            "targetId is required for chart/dashboard targets",
            422,
            [{"field": "targetId", "message": "required"}],
        )
    invalid = [
        {"field": f"allowedOrigins[{i}]", "message": f"invalid origin: {o}"}
        for i, o in enumerate(payload.allowed_origins)
        if not _ORIGIN_RE.match(o)
    ]
    if invalid:
        raise SdkPortalError("VIZ_SDK_INVALID_ORIGIN", "invalid origin", 422, invalid)
    if payload.auth_mode == "token" and not payload.embed_token:
        raise SdkPortalError(
            VIZ_SDK_TOKEN_REQUIRED,
            "embedToken is required when authMode is token",
            422,
            [{"field": "embedToken", "message": "required"}],
        )
    seen: set[str] = set()
    for i, origin in enumerate(payload.allowed_origins):
        if origin in seen:
            raise SdkPortalError(
                VIZ_SDK_DUPLICATE_ORIGIN,
                "duplicate allowedOrigins entry",
                422,
                [{"field": f"allowedOrigins[{i}]", "message": "duplicate"}],
            )
        seen.add(origin)
    return SdkPortalValidateOut(
        valid=True,
        app_id=payload.app_id,
        token_required=payload.auth_mode == "token",
    )


def lifecycle_manifest(payload: SdkLifecycleIn, actor: UserContext) -> SdkLifecycleOut:
    if payload.phase == "destroy":
        roles = set(actor.roles)
        if not roles.intersection({"admin", "editor"}):
            raise SdkPortalError(VIZ_SDK_FORBIDDEN, "destroy lifecycle requires admin or editor", 403)
    return SdkLifecycleOut(phase=payload.phase, ready=True, sdk_version=_SDK_VERSION)


def list_capabilities() -> SdkCapabilitiesOut:
    return SdkCapabilitiesOut(target_types=["chart", "dashboard"], auth_modes=["token", "none"])
