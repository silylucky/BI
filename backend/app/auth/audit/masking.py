from __future__ import annotations

import json
import re

_SENSITIVE_KEY = re.compile(
    r"password|passwd|secret|token|credential|api[_-]?key|private[_-]?key|access[_-]?key",
    re.IGNORECASE,
)


def mask_audit_detail(detail: str | None) -> str | None:
    if detail is None:
        return None
    try:
        payload = json.loads(detail)
    except json.JSONDecodeError:
        return detail
    if not isinstance(payload, dict):
        return detail

    def _mask_obj(obj: object) -> object:
        if isinstance(obj, dict):
            return {
                k: ("***" if _SENSITIVE_KEY.search(k) else _mask_obj(v))
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [_mask_obj(v) for v in obj]
        return obj

    return json.dumps(_mask_obj(payload))
