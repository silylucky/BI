"""Dialect connector protocol.

Non-SQL connectors (e.g. Elasticsearch) map metadata browse onto this protocol:
``list_schemas`` → index names; ``list_tables`` → single ``_doc`` pseudo-table;
``list_columns`` → mapping field names/types.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class TestConnectionResult:
    ok: bool
    message: str
    latency_ms: int | None
    code: str | None = None


@dataclass(frozen=True)
class SchemaInfo:
    name: str


@dataclass(frozen=True)
class TableInfo:
    name: str
    type: str


@dataclass(frozen=True)
class ColumnInfo:
    name: str
    data_type: str
    nullable: bool


class DialectConnector(Protocol):
    @property
    def type(self) -> str: ...

    @property
    def category(self) -> str: ...

    @property
    def capabilities(self) -> tuple[str, ...]: ...

    @property
    def display_name(self) -> str: ...

    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
        charset: str = "utf8mb4",
        collation: str | None = None,
        ssl_mode: str = "preferred",
        connect_timeout_sec: float | None = None,
        read_timeout_sec: float | None = None,
    ) -> TestConnectionResult: ...

    def open_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        connect_timeout_sec: float = 5.0,
        ssl_mode: str = "preferred",
    ) -> Any: ...

    def list_schemas(self, connection: Any) -> list[SchemaInfo]: ...

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]: ...

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]: ...
