"""同步源连接器能力：与连接管理目录对齐。"""

from __future__ import annotations

from app.query.capabilities import (
    is_native_query_capable,
    is_query_capable,
    is_sql_query_capable,
    resolve_sql_dialect_type,
)


def is_sync_source_capable(connector_type: str) -> bool:
    """与连接管理「可查询」目录一致：SQL 表源 + Native 源。"""
    return is_query_capable(connector_type)


def resolve_sync_fetch_mode(connector_type: str) -> str | None:
    if is_sql_query_capable(connector_type):
        return "sql"
    if is_native_query_capable(connector_type):
        return "native"
    return None


def resolve_sql_dialect_for_sync(connector_type: str) -> str:
    return resolve_sql_dialect_type(connector_type)


def is_sync_fetch_implemented(connector_type: str) -> bool:
    """可查询类型均支持同步拉数（最终形态）。"""
    return is_sync_source_capable(connector_type)


def sync_fetch_not_implemented_message(connector_type: str) -> str:
    mode = resolve_sync_fetch_mode(connector_type)
    if mode is None:
        return f"连接器「{connector_type}」不支持表级同步，仅可登记连接与浏览元数据"
    return f"同步拉数暂未实现 Native/SQL 源「{connector_type}」"
