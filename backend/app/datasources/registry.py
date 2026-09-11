from __future__ import annotations

import threading
from collections.abc import Callable
from dataclasses import dataclass

from app.datasources.dialects.base import DialectConnector
from app.datasources.taxonomy import label_for_display_group, resolve_display_group
from app.query.capabilities import is_query_capable, resolve_query_mode_for_connector
from app.ingestion.sync_source_capabilities import is_sync_fetch_implemented, is_sync_source_capable


class ConnectorNotFoundError(KeyError):
    pass


class ConnectorAlreadyRegisteredError(ValueError):
    pass


class ConnectorInUseError(ValueError):
    pass


_usage_checkers: list[Callable[[str], bool]] = []


def register_usage_checker(fn: Callable[[str], bool]) -> None:
    _usage_checkers.append(fn)


def unregister(type: str) -> None:
    with registry._lock:
        if type not in registry._connectors:
            raise ConnectorNotFoundError(type)
        if any(checker(type) for checker in _usage_checkers):
            raise ConnectorInUseError(f"connector type in use: {type}")
        del registry._connectors[type]


@dataclass(frozen=True)
class ConnectorDescriptor:
    type: str
    category: str
    capabilities: tuple[str, ...]
    display_name: str


class ConnectorRegistry:
    def __init__(self) -> None:
        self._connectors: dict[str, DialectConnector] = {}
        self._lock = threading.RLock()

    def register(self, connector: DialectConnector) -> None:
        with self._lock:
            if connector.type in self._connectors:
                raise ConnectorAlreadyRegisteredError(
                    f"connector type already registered: {connector.type}"
                )
            self._connectors[connector.type] = connector

    def get(self, type: str) -> DialectConnector:
        with self._lock:
            try:
                return self._connectors[type]
            except KeyError as exc:
                raise ConnectorNotFoundError(type) from exc

    def list_types(self) -> list[ConnectorDescriptor]:
        with self._lock:
            return [
                ConnectorDescriptor(
                    type=c.type,
                    category=c.category,
                    capabilities=c.capabilities,
                    display_name=c.display_name,
                )
                for c in self._connectors.values()
            ]


registry = ConnectorRegistry()


def register_dialect(connector: DialectConnector) -> None:
    registry.register(connector)


def export_type_catalog() -> list[dict]:
    result: list[dict] = []
    for item in registry.list_types():
        group = resolve_display_group(item.category)
        query_capable = is_query_capable(item.type)
        query_mode = resolve_query_mode_for_connector(item.type)
        sync_capable = is_sync_source_capable(item.type)
        result.append(
            {
                "type": item.type,
                "displayName": item.display_name,
                "category": item.category,
                "capabilities": list(item.capabilities),
                "displayGroup": group,
                "categoryLabel": label_for_display_group(group),
                "queryCapable": query_capable,
                "queryMode": query_mode,
                "syncCapable": sync_capable,
                "syncFetchImplemented": is_sync_fetch_implemented(item.type),
            }
        )
    return result
