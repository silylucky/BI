"""同步任务 source_table 校验：SQL 表名 vs REST API 路径等 Native 源对象。"""

from __future__ import annotations

import re

from app.auth.rls.predicate import RlsConfigError
from app.query.rls.guard import validate_identifier

_REST_API_PATH_RE = re.compile(r"^/[a-zA-Z0-9][a-zA-Z0-9_./-]{0,126}$")


class SyncSourceTableError(ValueError):
    """用户可读的源对象校验错误。"""


def normalize_rest_api_path(raw: str) -> str:
    trimmed = raw.strip()
    if not trimmed:
        raise SyncSourceTableError("REST API 路径不能为空")
    return trimmed if trimmed.startswith("/") else f"/{trimmed}"


def validate_sync_source_table(source_type: str, source_table: str) -> str:
    trimmed = source_table.strip()
    if not trimmed:
        raise SyncSourceTableError("须指定源对象")
    if source_type == "rest_api":
        path = normalize_rest_api_path(trimmed)
        if not _REST_API_PATH_RE.match(path):
            raise SyncSourceTableError("REST API 路径格式无效")
        return path
    try:
        validate_identifier(trimmed)
    except RlsConfigError as exc:
        raise SyncSourceTableError(str(exc)) from exc
    return trimmed
