from __future__ import annotations

from typing import Protocol


class UnsupportedDialectError(Exception):
    def __init__(self, connector_type: str) -> None:
        self.connector_type = connector_type
        super().__init__(f"Unsupported SQL dialect: {connector_type}")


class SqlDialect(Protocol):
    @property
    def connector_type(self) -> str: ...

    def quote_identifier(self, name: str) -> str: ...

    def qualify_table(self, schema: str, table: str) -> str: ...

    def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str: ...

    def build_table_select(
        self, schema: str, table: str, *, limit: int, offset: int = 0,
    ) -> str: ...
