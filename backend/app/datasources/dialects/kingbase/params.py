from __future__ import annotations

from app.datasources.dialects.errors import KINGBASE_INVALID_PARAMS, KINGBASE_PORT_OUT_OF_RANGE


class KingbaseParamsError(Exception):
    def __init__(self, code: str, message: str, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.fields = fields or []
        super().__init__(message)


def validate_kingbase_connection_params(
    *,
    host: str | None,
    port: int | None,
    database: str | None,
    username: str | None,
    **_,
) -> None:
    missing = []
    if not host or not str(host).strip():
        missing.append({"field": "host", "message": "required"})
    if not database or not str(database).strip():
        missing.append({"field": "database", "message": "required"})
    if not username or not str(username).strip():
        missing.append({"field": "username", "message": "required"})
    if missing:
        raise KingbaseParamsError(KINGBASE_INVALID_PARAMS, "Invalid kingbase connection params", missing)
    if port is not None and (port < 1 or port > 65535):
        raise KingbaseParamsError(
            KINGBASE_PORT_OUT_OF_RANGE,
            "port out of range",
            [{"field": "port", "message": "must be 1-65535"}],
        )
